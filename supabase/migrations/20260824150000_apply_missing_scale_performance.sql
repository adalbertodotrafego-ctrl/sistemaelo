-- =====================================================================
-- Aplica o que ficou faltando de 20260809130000_scale_performance.sql
-- =====================================================================
-- DESCOBERTA: sondando a API REST do projeto, column_values.board_id e
-- updates.board_id NÃO existem no banco, embora estejam no repositório
-- desde 09/08. As duas migrations daquele dia (security_hardening e
-- scale_performance) nunca chegaram a rodar em produção — foi por isso
-- que public.is_approved também não existia.
--
-- CONSEQUÊNCIA DIRETA: sem essas colunas não existem os índices
-- idx_column_values_board_item nem idx_items_board_active, e carregar um
-- quadro caía no plano ruim (juntar column_values inteira com items antes
-- de filtrar). Em quadro grande — o "Arquivo de Demandas" tem 2.656 itens
-- e ~10 mil células — isso estoura o statement timeout do Supabase, que é
-- exatamente o "canceling statement due to statement timeout" que a tela
-- de Tarefas vinha mostrando.
--
-- Esta migration é o conteúdo de scale_performance.sql, idempotente, para
-- ser aplicada com segurança mesmo que parte dela já exista. Precisa rodar
-- ANTES do app usar .eq("board_id", …) em column_values.
-- =====================================================================

-- ── 1. board_id denormalizado ────────────────────────────────────────
alter table public.column_values add column if not exists board_id uuid;
alter table public.updates       add column if not exists board_id uuid;

-- Backfill do que já existe.
update public.column_values cv
   set board_id = i.board_id
  from public.items i
 where i.id = cv.item_id and cv.board_id is distinct from i.board_id;

update public.updates u
   set board_id = i.board_id
  from public.items i
 where i.id = u.item_id and u.board_id is distinct from i.board_id;

-- Mantido pelo banco: o app não precisa lembrar de preencher.
create or replace function public.tg_sync_board_id()
returns trigger language plpgsql set search_path = public as $$
begin
  select i.board_id into new.board_id from public.items i where i.id = new.item_id;
  return new;
end $$;

drop trigger if exists column_values_board_id on public.column_values;
create trigger column_values_board_id before insert or update of item_id
  on public.column_values for each row execute function public.tg_sync_board_id();

drop trigger if exists updates_board_id on public.updates;
create trigger updates_board_id before insert or update of item_id
  on public.updates for each row execute function public.tg_sync_board_id();

-- Item que muda de quadro leva as células e os comentários junto.
create or replace function public.tg_items_cascade_board_id()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.board_id is distinct from old.board_id then
    update public.column_values set board_id = new.board_id where item_id = new.id;
    update public.updates       set board_id = new.board_id where item_id = new.id;
  end if;
  return new;
end $$;

drop trigger if exists items_cascade_board_id on public.items;
create trigger items_cascade_board_id after update of board_id on public.items
  for each row execute function public.tg_items_cascade_board_id();

-- ── 2. Índices que faltavam (a causa do timeout) ─────────────────────
create index if not exists idx_column_values_board on public.column_values(board_id);
create index if not exists idx_updates_board       on public.updates(board_id);

-- Carregar um quadro é "todas as células deste quadro, em ordem estável":
-- índice composto cobre o filtro e a paginação de uma vez.
create index if not exists idx_column_values_board_item
  on public.column_values(board_id, item_id, column_id);

-- Abrir um quadro filtra por state e ordena por position.
create index if not exists idx_items_board_active
  on public.items(board_id, position) where state = 'active';

-- ── 3. Policies mais baratas ─────────────────────────────────────────
-- Envolver auth.uid() em (select …) faz o Postgres avaliar uma vez por
-- consulta (InitPlan) em vez de uma vez por linha.
drop policy if exists "column_values follow item access"  on public.column_values;
drop policy if exists "column_values follow board access" on public.column_values;
create policy "column_values follow board access" on public.column_values
  for all to authenticated
  using (public.can_access_board(board_id, (select auth.uid())))
  with check (public.can_access_board(board_id, (select auth.uid())));

drop policy if exists "updates follow item access"  on public.updates;
drop policy if exists "updates follow board access" on public.updates;
create policy "updates follow board access" on public.updates
  for all to authenticated
  using (public.can_access_board(board_id, (select auth.uid())))
  with check (public.can_access_board(board_id, (select auth.uid())));

drop policy if exists "items follow board access" on public.items;
create policy "items follow board access" on public.items
  for all to authenticated
  using (public.can_access_board(board_id, (select auth.uid())))
  with check (public.can_access_board(board_id, (select auth.uid())));

drop policy if exists "groups follow board access" on public.groups;
create policy "groups follow board access" on public.groups
  for all to authenticated
  using (public.can_access_board(board_id, (select auth.uid())))
  with check (public.can_access_board(board_id, (select auth.uid())));

drop policy if exists "columns follow board access" on public.columns;
create policy "columns follow board access" on public.columns
  for all to authenticated
  using (public.can_access_board(board_id, (select auth.uid())))
  with check (public.can_access_board(board_id, (select auth.uid())));

drop policy if exists "views follow board access" on public.views;
create policy "views follow board access" on public.views
  for all to authenticated
  using (public.can_access_board(board_id, (select auth.uid())))
  with check (public.can_access_board(board_id, (select auth.uid())));

drop policy if exists "boards readable when accessible" on public.boards;
create policy "boards readable when accessible" on public.boards
  for select to authenticated using (public.can_access_board(id, (select auth.uid())));

-- ── 4. Tempo real filtrado por quadro no servidor ────────────────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'column_values'
  ) then
    alter publication supabase_realtime add table public.column_values;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'updates'
  ) then
    alter publication supabase_realtime add table public.updates;
  end if;
end $$;

-- ── 5. Planejador com estatísticas atualizadas ───────────────────────
analyze public.items;
analyze public.column_values;
analyze public.boards;
