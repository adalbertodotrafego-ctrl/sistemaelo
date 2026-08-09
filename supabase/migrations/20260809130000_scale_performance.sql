-- =====================================================================
-- Escala: preparar o sistema para centenas/milhares de usuários
-- =====================================================================
-- Três gargalos que só aparecem quando o time cresce:
--
--  1. TEMPO REAL EM MEGAFONE. `column_values` e `updates` não tinham
--     board_id, então o app assinava as tabelas INTEIRAS. Uma pessoa
--     editando uma célula acordava TODO mundo que estivesse com qualquer
--     quadro aberto, e cada um recarregava o quadro inteiro. Com 10 pessoas
--     passava batido; com 1000, uma digitação vira mil recargas — o sistema
--     derruba a si mesmo. Agora a coluna existe e o filtro é feito no
--     servidor: só recebe quem está naquele quadro.
--
--  2. POLICY CARA POR LINHA. A regra de `column_values` chamava
--     can_access_item(item_id), que ia até `items` para descobrir o quadro —
--     uma subconsulta por célula, ~24 mil por carregamento. Com board_id na
--     própria linha, a verificação é direta.
--
--  3. auth.uid() REAVALIADO A CADA LINHA. Envolvendo em `(select auth.uid())`
--     o Postgres calcula uma vez só por consulta (InitPlan) em vez de uma vez
--     por linha. É a diferença entre varrer 24 mil chamadas e 1.
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

create index if not exists idx_column_values_board on public.column_values(board_id);
create index if not exists idx_updates_board       on public.updates(board_id);

-- Carregar um quadro é "todas as células deste quadro, em ordem estável":
-- índice composto cobre o filtro e a paginação de uma vez.
create index if not exists idx_column_values_board_item
  on public.column_values(board_id, item_id, column_id);

-- Abrir um quadro filtra por state e ordena por position.
create index if not exists idx_items_board_active
  on public.items(board_id, position) where state = 'active';

-- ── 2. Policies mais baratas ─────────────────────────────────────────
drop policy if exists "column_values follow item access" on public.column_values;
create policy "column_values follow board access" on public.column_values
  for all to authenticated
  using (public.can_access_board(board_id, (select auth.uid())))
  with check (public.can_access_board(board_id, (select auth.uid())));

drop policy if exists "updates follow item access" on public.updates;
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

-- ── 3. Tempo real só para quem interessa ─────────────────────────────
-- A publicação precisa carregar as duas tabelas para o filtro por board_id
-- funcionar no servidor.
--
-- Sobre REPLICA IDENTITY: de propósito ficou no padrão (só a chave). Em
-- INSERT e UPDATE o registro novo já traz board_id, então o filtro casa —
-- e é isso que o sistema faz o tempo todo (salvar célula é sempre upsert,
-- nunca delete). Só o DELETE viajaria sem board_id e seria descartado, e
-- apagar célula acontece em dois pontos raros (reabrir recorrência e trocar
-- tipo de coluna). Ligar REPLICA IDENTITY FULL resolveria esse caso raro
-- cobrando WAL cheio em TODA edição da tabela mais quente do sistema — caro
-- demais para o tamanho do problema.
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

-- ── 4. Planejador com estatísticas atualizadas ───────────────────────
analyze public.items;
analyze public.column_values;
analyze public.boards;
