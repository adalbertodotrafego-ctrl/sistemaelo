-- =====================================================================
-- Corrige regressão introduzida por 20260824120000: reintroduziu a
-- exigência de workspace_members e removeu a checagem de aprovação
-- =====================================================================
-- SINTOMA 1: usuário responsável pelo PRÓPRIO quadro (cadastrado em
-- board_members) deixou de vê-lo em Tarefas, embora continuasse vendo
-- todas as seções normalmente.
--
-- CAUSA: a migration anterior (20260824120000) acrescentou
--   join public.workspace_members wm
--     on wm.workspace_id = b.workspace_id and wm.user_id = _user_id
-- exigindo, além de ser responsável/dono/admin, também ser membro do
-- workspace. Só que workspace_members nunca é populada para usuários
-- comuns — o modelo de "quadro rei" (20260723140000_king_board.sql) já
-- tinha corrigido exatamente esse ponto antes, liberando a área de
-- trabalho para todo autenticado e deixando cada BOARD controlar seu
-- próprio acesso via can_access_board. A migration de hoje reverteu essa
-- correção sem querer, então qualquer pessoa fora de workspace_members
-- (a maioria) parou de ver todo e qualquer quadro, mesmo sendo
-- responsável por ele.
--
-- De brinde, a reescrita também removeu a checagem is_approved(_user_id)
-- que existia desde 20260809120000_security_hardening.sql.
--
-- SINTOMA 2: abrir um quadro dava "canceling statement due to statement
-- timeout". A policy de items/column_values chama can_access_board por
-- LINHA lida (quadros grandes passam de 10 mil células); com o JOIN extra
-- em workspace_members somado ao "NOT EXISTS (board_members do quadro)"
-- já existente, cada linha pagava duas subconsultas a mais — em volume
-- suficiente para estourar o tempo do statement.
--
-- CORREÇÃO: volta para o modelo sem o JOIN de workspace_members (que
-- nunca deveria ter voltado) mantendo is_approved, e preserva a regra de
-- negócio pretendida por hoje: quadro COM responsável cadastrado só é
-- visível a eles (+ dono + admin); quadro SEM nenhum responsável continua
-- visível a todo usuário aprovado.
--
-- NOTA: a função public.is_approved (definida em
-- 20260809120000_security_hardening.sql) não existia neste banco quando
-- esta migration foi escrita — a coluna profiles.approved já existe desde
-- 20260723160000_access_approval.sql, então só a função ficou faltando.
-- Recriada aqui (idempotente) para não depender do estado dessa outra
-- migration no banco de produção.
-- =====================================================================

create or replace function public.is_approved(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select p.approved from public.profiles p where p.id = _user_id),
    false
  ) or public.has_role(_user_id, 'admin');
$$;
grant execute on function public.is_approved(uuid) to authenticated;

create or replace function public.can_access_board(_board_id uuid, _user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select
    public.is_approved(_user_id)
    and (
      public.has_role(_user_id, 'admin')
      or exists (
        select 1
        from public.boards b
        where b.id = _board_id
          and (
            b.owner_id = _user_id
            or exists (select 1 from public.board_members bm
                       where bm.board_id = b.id and bm.user_id = _user_id)
            or not exists (select 1 from public.board_members bm2
                            where bm2.board_id = b.id)
          )
      )
    );
$$;
