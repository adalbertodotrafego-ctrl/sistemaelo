-- =====================================================================
-- Tarefas (núcleo de boards estilo monday) — portado do projeto monday-elo
-- =====================================================================
-- Modelo mental: um Board é uma TABELA com schema próprio.
--   Workspace → Board → Group → Item (+ Subitem via parent_item_id)
--   Cada Board define suas Columns (tipadas); cada Item guarda um
--   column_value por coluna, com o valor em JSONB + um text_cache
--   desnormalizado para busca/ordenação rápida.
--
-- O TIPO da coluna NÃO é enum no banco: o registry vive na aplicação
-- (src/lib/boards/columns), então um tipo novo não exige migração.
--
-- ADAPTAÇÕES ao trazer para o Sistema Elo:
--   1. NÃO cria public.profiles nem o trigger on_auth_user_created —
--      o Sistema Elo já tem os dois (colunas compatíveis: id, full_name,
--      email, avatar_url).
--   2. A tabela de pastas do monday virou public.board_folders, porque
--      public.folders já existe aqui (é a de Arquivos).
--   3. Mantém as colunas monday_id (rastreabilidade), para o script de
--      importação do monday.com continuar viável no futuro.
--
-- Segurança: RLS derivada de MEMBERSHIP no workspace/board — nunca
-- `USING (true)`.
-- =====================================================================

create extension if not exists pgcrypto;

-- ── Enums estruturais ────────────────────────────────────────────────
do $$ begin
  create type public.workspace_role as enum ('owner', 'admin', 'member', 'viewer');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.board_kind as enum ('public', 'private', 'shareable');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.item_state as enum ('active', 'archived', 'deleted');
exception when duplicate_object then null; end $$;

-- updated_at (nome próprio para não colidir com tg_set_updated_at daqui)
create or replace function public.tg_touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end $$;

-- Rastreabilidade de import (profiles já existe: só adiciona a coluna)
alter table public.profiles add column if not exists monday_user_id text;
create unique index if not exists uq_profiles_monday on public.profiles(monday_user_id);

-- =====================================================================
-- workspaces + membership
-- =====================================================================
create table public.workspaces (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  owner_id    uuid not null references auth.users(id) on delete restrict,
  monday_id   text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  role         public.workspace_role not null default 'member',
  created_at   timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

alter table public.workspaces        enable row level security;
alter table public.workspace_members enable row level security;
grant select, insert, update, delete on public.workspaces        to authenticated;
grant select, insert, update, delete on public.workspace_members to authenticated;
grant all on public.workspaces        to service_role;
grant all on public.workspace_members to service_role;

-- Helpers SECURITY DEFINER: centralizam o acesso e evitam recursão de RLS.
create or replace function public.is_workspace_member(_workspace_id uuid, _user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = _workspace_id and user_id = _user_id
  );
$$;

create or replace function public.is_workspace_admin(_workspace_id uuid, _user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = _workspace_id and user_id = _user_id
      and role in ('owner', 'admin')
  );
$$;

create policy "workspaces readable by members"
  on public.workspaces for select to authenticated
  using (public.is_workspace_member(id, auth.uid()));
create policy "workspaces insert as owner"
  on public.workspaces for insert to authenticated
  with check (owner_id = auth.uid());
create policy "workspaces managed by admins"
  on public.workspaces for update to authenticated
  using (public.is_workspace_admin(id, auth.uid()))
  with check (public.is_workspace_admin(id, auth.uid()));
create policy "workspaces deletable by admins"
  on public.workspaces for delete to authenticated
  using (public.is_workspace_admin(id, auth.uid()));

create policy "members readable within workspace"
  on public.workspace_members for select to authenticated
  using (public.is_workspace_member(workspace_id, auth.uid()));
create policy "members managed by admins"
  on public.workspace_members for all to authenticated
  using (public.is_workspace_admin(workspace_id, auth.uid()))
  with check (public.is_workspace_admin(workspace_id, auth.uid()));

create trigger workspaces_touch before update on public.workspaces
  for each row execute function public.tg_touch_updated_at();

-- Ao criar um workspace, o dono entra como membro 'owner' (definer → ignora RLS).
create or replace function public.tg_workspace_add_owner()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.workspace_members (workspace_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict (workspace_id, user_id) do nothing;
  return new;
end $$;
create trigger workspaces_add_owner after insert on public.workspaces
  for each row execute function public.tg_workspace_add_owner();

-- =====================================================================
-- board_folders (organização de boards dentro do workspace)
-- =====================================================================
create table public.board_folders (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null references public.workspaces(id) on delete cascade,
  parent_folder_id uuid references public.board_folders(id) on delete set null,
  name             text not null,
  position         double precision not null default 0,
  monday_id        text,
  created_at       timestamptz not null default now()
);
alter table public.board_folders enable row level security;
grant select, insert, update, delete on public.board_folders to authenticated;
grant all on public.board_folders to service_role;
create policy "board_folders readable by workspace members"
  on public.board_folders for select to authenticated
  using (public.is_workspace_member(workspace_id, auth.uid()));
create policy "board_folders managed by ws admins"
  on public.board_folders for all to authenticated
  using (public.is_workspace_admin(workspace_id, auth.uid()))
  with check (public.is_workspace_admin(workspace_id, auth.uid()));

-- =====================================================================
-- boards + board_members (acesso a boards privados)
-- =====================================================================
create table public.boards (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  folder_id    uuid references public.board_folders(id) on delete set null,
  name         text not null,
  description  text,
  kind         public.board_kind not null default 'public',
  owner_id     uuid references auth.users(id) on delete set null,
  position     double precision not null default 0,
  state        public.item_state not null default 'active',
  monday_id    text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.board_members (
  board_id   uuid not null references public.boards(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (board_id, user_id)
);

alter table public.boards        enable row level security;
alter table public.board_members enable row level security;
grant select, insert, update, delete on public.boards        to authenticated;
grant select, insert, update, delete on public.board_members to authenticated;
grant all on public.boards        to service_role;
grant all on public.board_members to service_role;

create or replace function public.can_access_board(_board_id uuid, _user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.boards b
    join public.workspace_members wm
      on wm.workspace_id = b.workspace_id and wm.user_id = _user_id
    where b.id = _board_id
      and (
        b.kind <> 'private'
        or b.owner_id = _user_id
        or exists (select 1 from public.board_members bm
                   where bm.board_id = b.id and bm.user_id = _user_id)
      )
  );
$$;

create policy "boards readable when accessible"
  on public.boards for select to authenticated
  using (public.can_access_board(id, auth.uid()));
create policy "boards insert by workspace members"
  on public.boards for insert to authenticated
  with check (public.is_workspace_member(workspace_id, auth.uid())
              and owner_id = auth.uid());
create policy "boards managed by owner or ws admin"
  on public.boards for update to authenticated
  using (owner_id = auth.uid() or public.is_workspace_admin(workspace_id, auth.uid()))
  with check (owner_id = auth.uid() or public.is_workspace_admin(workspace_id, auth.uid()));
create policy "boards deletable by owner or ws admin"
  on public.boards for delete to authenticated
  using (owner_id = auth.uid() or public.is_workspace_admin(workspace_id, auth.uid()));

create policy "board_members readable when board accessible"
  on public.board_members for select to authenticated
  using (public.can_access_board(board_id, auth.uid()));
create policy "board_members managed by board owner or ws admin"
  on public.board_members for all to authenticated
  using (exists (select 1 from public.boards b where b.id = board_id
                 and (b.owner_id = auth.uid()
                      or public.is_workspace_admin(b.workspace_id, auth.uid()))))
  with check (exists (select 1 from public.boards b where b.id = board_id
                 and (b.owner_id = auth.uid()
                      or public.is_workspace_admin(b.workspace_id, auth.uid()))));

create trigger boards_touch before update on public.boards
  for each row execute function public.tg_touch_updated_at();

-- =====================================================================
-- groups (seções coloridas = linhas agrupadas)
-- =====================================================================
create table public.groups (
  id         uuid primary key default gen_random_uuid(),
  board_id   uuid not null references public.boards(id) on delete cascade,
  title      text not null,
  color      text not null default '#579bfc',
  position   double precision not null default 0,
  monday_id  text,
  created_at timestamptz not null default now()
);
alter table public.groups enable row level security;
grant select, insert, update, delete on public.groups to authenticated;
grant all on public.groups to service_role;
create policy "groups follow board access"
  on public.groups for all to authenticated
  using (public.can_access_board(board_id, auth.uid()))
  with check (public.can_access_board(board_id, auth.uid()));

-- =====================================================================
-- columns (o schema tipado DAQUELE board)
-- =====================================================================
create table public.columns (
  id         uuid primary key default gen_random_uuid(),
  board_id   uuid not null references public.boards(id) on delete cascade,
  title      text not null,
  type       text not null,
  settings   jsonb not null default '{}'::jsonb,
  position   double precision not null default 0,
  monday_id  text,
  created_at timestamptz not null default now()
);
alter table public.columns enable row level security;
grant select, insert, update, delete on public.columns to authenticated;
grant all on public.columns to service_role;
create policy "columns follow board access"
  on public.columns for all to authenticated
  using (public.can_access_board(board_id, auth.uid()))
  with check (public.can_access_board(board_id, auth.uid()));

-- =====================================================================
-- items (as linhas) + subitems (parent_item_id, 1 nível no MVP)
-- =====================================================================
create table public.items (
  id             uuid primary key default gen_random_uuid(),
  board_id       uuid not null references public.boards(id) on delete cascade,
  group_id       uuid references public.groups(id) on delete set null,
  parent_item_id uuid references public.items(id) on delete cascade,
  name           text not null default '',
  position       double precision not null default 0,
  state          public.item_state not null default 'active',
  creator_id     uuid references auth.users(id) on delete set null,
  last_edited_by uuid references auth.users(id) on delete set null,
  monday_id      text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
alter table public.items enable row level security;
grant select, insert, update, delete on public.items to authenticated;
grant all on public.items to service_role;
create policy "items follow board access"
  on public.items for all to authenticated
  using (public.can_access_board(board_id, auth.uid()))
  with check (public.can_access_board(board_id, auth.uid()));

create or replace function public.tg_items_touch()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  new.last_edited_by = coalesce(auth.uid(), new.last_edited_by);
  return new;
end $$;
create trigger items_touch before update on public.items
  for each row execute function public.tg_items_touch();

create or replace function public.can_access_item(_item_id uuid, _user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.can_access_board(
    (select board_id from public.items where id = _item_id), _user_id);
$$;

-- =====================================================================
-- column_values (valor tipado por célula; JSONB + text_cache)
-- =====================================================================
create table public.column_values (
  id         uuid primary key default gen_random_uuid(),
  item_id    uuid not null references public.items(id) on delete cascade,
  column_id  uuid not null references public.columns(id) on delete cascade,
  value      jsonb,
  text_cache text,
  updated_at timestamptz not null default now(),
  unique (item_id, column_id)
);
alter table public.column_values enable row level security;
grant select, insert, update, delete on public.column_values to authenticated;
grant all on public.column_values to service_role;
create policy "column_values follow item access"
  on public.column_values for all to authenticated
  using (public.can_access_item(item_id, auth.uid()))
  with check (public.can_access_item(item_id, auth.uid()));
create trigger column_values_touch before update on public.column_values
  for each row execute function public.tg_touch_updated_at();

-- =====================================================================
-- updates (comentários/atualizações por item)
-- =====================================================================
create table public.updates (
  id         uuid primary key default gen_random_uuid(),
  item_id    uuid not null references public.items(id) on delete cascade,
  author_id  uuid references auth.users(id) on delete set null,
  body       text not null,
  created_at timestamptz not null default now()
);
alter table public.updates enable row level security;
grant select, insert, update, delete on public.updates to authenticated;
grant all on public.updates to service_role;
create policy "updates follow item access"
  on public.updates for all to authenticated
  using (public.can_access_item(item_id, auth.uid()))
  with check (public.can_access_item(item_id, auth.uid()));

-- =====================================================================
-- views (Table/Kanban/Calendar… — "view é dado, não código")
-- =====================================================================
create table public.views (
  id         uuid primary key default gen_random_uuid(),
  board_id   uuid not null references public.boards(id) on delete cascade,
  type       text not null default 'table',
  name       text not null default 'Main Table',
  config     jsonb not null default '{}'::jsonb,
  position   double precision not null default 0,
  created_at timestamptz not null default now()
);
alter table public.views enable row level security;
grant select, insert, update, delete on public.views to authenticated;
grant all on public.views to service_role;
create policy "views follow board access"
  on public.views for all to authenticated
  using (public.can_access_board(board_id, auth.uid()))
  with check (public.can_access_board(board_id, auth.uid()));

-- =====================================================================
-- Índices
-- =====================================================================
create index idx_workspace_members_user   on public.workspace_members(user_id);
create index idx_board_folders_workspace  on public.board_folders(workspace_id);
create index idx_boards_workspace         on public.boards(workspace_id);
create index idx_boards_folder            on public.boards(folder_id);
create index idx_groups_board             on public.groups(board_id);
create index idx_columns_board            on public.columns(board_id);
create index idx_items_board              on public.items(board_id);
create index idx_items_group              on public.items(group_id);
create index idx_items_parent             on public.items(parent_item_id) where parent_item_id is not null;
create index idx_column_values_item       on public.column_values(item_id);
create index idx_column_values_column     on public.column_values(column_id);
create index idx_column_values_value_gin  on public.column_values using gin (value);
create index idx_column_values_text       on public.column_values(text_cache);
create index idx_updates_item             on public.updates(item_id);
create index idx_views_board              on public.views(board_id);

-- Rastreabilidade do import (não-parciais: o upsert do PostgREST exige
-- ON CONFLICT sem predicado; NULLs já são distintos entre si no Postgres).
create unique index uq_workspaces_monday    on public.workspaces(monday_id);
create unique index uq_board_folders_monday on public.board_folders(monday_id);
create unique index uq_boards_monday        on public.boards(monday_id);
create unique index uq_items_monday         on public.items(monday_id);
create unique index uq_groups_monday        on public.groups(board_id, monday_id);
create unique index uq_columns_monday       on public.columns(board_id, monday_id);

-- =====================================================================
-- Realtime: colaboração ao vivo
-- =====================================================================
alter publication supabase_realtime add table public.items;
alter publication supabase_realtime add table public.column_values;
alter publication supabase_realtime add table public.groups;
alter publication supabase_realtime add table public.columns;
alter publication supabase_realtime add table public.updates;
