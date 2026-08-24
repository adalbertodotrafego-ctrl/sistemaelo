-- =====================================================================
-- Responsáveis (board_members) passam a restringir de verdade o acesso
-- =====================================================================
-- Sintoma: em "Permissões e aparência" o admin escolhe os responsáveis de
-- um quadro, mas todo mundo continuava vendo o quadro na barra de Tarefas.
-- Causa: can_access_board só respeitava board_members quando kind='private',
-- e a UI nunca oferece marcar um quadro como privado (todo quadro nasce
-- 'public' em boards_core.sql) — então a lista de responsáveis não tinha
-- efeito nenhum na prática.
--
-- Nova regra: se o quadro tem QUALQUER responsável cadastrado em
-- board_members, só esses responsáveis (+ dono do quadro + admin do
-- sistema) o enxergam — não importa mais o campo kind. Quadro sem nenhum
-- responsável continua visível a todo membro do workspace (comportamento
-- anterior, não quebra quadro já existente sem membros configurados).
-- Admin do sistema (user_roles.role='admin') sempre enxerga tudo.
-- =====================================================================

create or replace function public.can_access_board(_board_id uuid, _user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.boards b
    join public.workspace_members wm
      on wm.workspace_id = b.workspace_id and wm.user_id = _user_id
    where b.id = _board_id
      and (
        public.has_role(_user_id, 'admin')
        or b.owner_id = _user_id
        or exists (select 1 from public.board_members bm where bm.board_id = b.id and bm.user_id = _user_id)
        or not exists (select 1 from public.board_members bm2 where bm2.board_id = b.id)
      )
  );
$$;
