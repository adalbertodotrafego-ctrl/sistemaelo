-- =====================================================================
-- Reparo das políticas RLS das Tarefas (boards)
-- =====================================================================
-- Sintoma que motivou este script: criar a área de trabalho falhava com
-- "new row violates row-level security policy for table workspaces", e a
-- listagem vinha vazia sem erro — assinatura clássica de RLS LIGADA porém
-- SEM as policies (o SELECT então filtra tudo e o INSERT é barrado).
-- Acontece se a 20260721120000_boards_core.sql parou no meio (o editor SQL
-- do Supabase confirma statement a statement, então dá pra aplicar as
-- tabelas e não as policies).
--
-- Este script é IDEMPOTENTE: recria as funções de autorização e todas as
-- policies (dropando antes), então pode rodar quantas vezes precisar.
-- =====================================================================

-- ── Funções de autorização (SECURITY DEFINER evita recursão de RLS) ───
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

create or replace function public.can_access_item(_item_id uuid, _user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.can_access_board(
    (select board_id from public.items where id = _item_id), _user_id);
$$;

-- O dono do workspace entra como membro 'owner' (definer → ignora RLS).
create or replace function public.tg_workspace_add_owner()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.workspace_members (workspace_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict (workspace_id, user_id) do nothing;
  return new;
end $$;

drop trigger if exists workspaces_add_owner on public.workspaces;
create trigger workspaces_add_owner after insert on public.workspaces
  for each row execute function public.tg_workspace_add_owner();

-- ── RLS ligada em tudo ───────────────────────────────────────────────
alter table public.workspaces        enable row level security;
alter table public.workspace_members enable row level security;
alter table public.board_folders     enable row level security;
alter table public.boards            enable row level security;
alter table public.board_members     enable row level security;
alter table public.groups            enable row level security;
alter table public.columns           enable row level security;
alter table public.items             enable row level security;
alter table public.column_values     enable row level security;
alter table public.updates           enable row level security;
alter table public.views             enable row level security;

-- ── Grants ───────────────────────────────────────────────────────────
grant select, insert, update, delete on public.workspaces        to authenticated;
grant select, insert, update, delete on public.workspace_members to authenticated;
grant select, insert, update, delete on public.board_folders     to authenticated;
grant select, insert, update, delete on public.boards            to authenticated;
grant select, insert, update, delete on public.board_members     to authenticated;
grant select, insert, update, delete on public.groups            to authenticated;
grant select, insert, update, delete on public.columns           to authenticated;
grant select, insert, update, delete on public.items             to authenticated;
grant select, insert, update, delete on public.column_values     to authenticated;
grant select, insert, update, delete on public.updates           to authenticated;
grant select, insert, update, delete on public.views             to authenticated;

-- ── workspaces ───────────────────────────────────────────────────────
drop policy if exists "workspaces readable by members" on public.workspaces;
drop policy if exists "workspaces insert as owner"     on public.workspaces;
drop policy if exists "workspaces managed by admins"   on public.workspaces;
drop policy if exists "workspaces deletable by admins" on public.workspaces;

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

-- ── workspace_members ────────────────────────────────────────────────
drop policy if exists "members readable within workspace" on public.workspace_members;
drop policy if exists "members managed by admins"         on public.workspace_members;

create policy "members readable within workspace"
  on public.workspace_members for select to authenticated
  using (public.is_workspace_member(workspace_id, auth.uid()));
create policy "members managed by admins"
  on public.workspace_members for all to authenticated
  using (public.is_workspace_admin(workspace_id, auth.uid()))
  with check (public.is_workspace_admin(workspace_id, auth.uid()));

-- ── board_folders ────────────────────────────────────────────────────
drop policy if exists "board_folders readable by workspace members" on public.board_folders;
drop policy if exists "board_folders managed by ws admins"          on public.board_folders;

create policy "board_folders readable by workspace members"
  on public.board_folders for select to authenticated
  using (public.is_workspace_member(workspace_id, auth.uid()));
create policy "board_folders managed by ws admins"
  on public.board_folders for all to authenticated
  using (public.is_workspace_admin(workspace_id, auth.uid()))
  with check (public.is_workspace_admin(workspace_id, auth.uid()));

-- ── boards ───────────────────────────────────────────────────────────
drop policy if exists "boards readable when accessible"    on public.boards;
drop policy if exists "boards insert by workspace members" on public.boards;
drop policy if exists "boards managed by owner or ws admin"   on public.boards;
drop policy if exists "boards deletable by owner or ws admin" on public.boards;

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

-- ── board_members ────────────────────────────────────────────────────
drop policy if exists "board_members readable when board accessible"   on public.board_members;
drop policy if exists "board_members managed by board owner or ws admin" on public.board_members;

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

-- ── groups / columns / items / views (seguem o acesso ao board) ──────
drop policy if exists "groups follow board access"  on public.groups;
create policy "groups follow board access"
  on public.groups for all to authenticated
  using (public.can_access_board(board_id, auth.uid()))
  with check (public.can_access_board(board_id, auth.uid()));

drop policy if exists "columns follow board access" on public.columns;
create policy "columns follow board access"
  on public.columns for all to authenticated
  using (public.can_access_board(board_id, auth.uid()))
  with check (public.can_access_board(board_id, auth.uid()));

drop policy if exists "items follow board access"   on public.items;
create policy "items follow board access"
  on public.items for all to authenticated
  using (public.can_access_board(board_id, auth.uid()))
  with check (public.can_access_board(board_id, auth.uid()));

drop policy if exists "views follow board access"   on public.views;
create policy "views follow board access"
  on public.views for all to authenticated
  using (public.can_access_board(board_id, auth.uid()))
  with check (public.can_access_board(board_id, auth.uid()));

-- ── column_values / updates (seguem o acesso ao item) ────────────────
drop policy if exists "column_values follow item access" on public.column_values;
create policy "column_values follow item access"
  on public.column_values for all to authenticated
  using (public.can_access_item(item_id, auth.uid()))
  with check (public.can_access_item(item_id, auth.uid()));

drop policy if exists "updates follow item access" on public.updates;
create policy "updates follow item access"
  on public.updates for all to authenticated
  using (public.can_access_item(item_id, auth.uid()))
  with check (public.can_access_item(item_id, auth.uid()));

-- ── Conferência: deve listar as policies criadas acima ───────────────
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('workspaces','workspace_members','board_folders','boards',
                    'board_members','groups','columns','items','column_values','updates','views')
order by tablename, cmd;
