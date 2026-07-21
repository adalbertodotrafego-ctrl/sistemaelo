-- =====================================================================
-- Tarefas: hierarquia de admin, acesso por responsável e campos novos
-- =====================================================================
-- Mudanças de REGRA:
--   1. Admin do sistema (public.has_role(uid,'admin')) enxerga e gerencia
--      TUDO — todos os workspaces, quadros, itens.
--   2. Quadro deixa de ser visível para toda a área de trabalho: passa a
--      ser visível só para os RESPONSÁVEIS (board_members), o dono e os
--      admins. Quem não é responsável não vê o quadro.
--   3. Só ADMIN define os responsáveis de um quadro (board_members).
--
-- Campos novos: ícone/emoji e cor do quadro, largura da coluna
-- (redimensionar como planilha) e descrição da demanda.
-- =====================================================================

-- ── Campos novos ─────────────────────────────────────────────────────
alter table public.boards  add column if not exists icon  text;
alter table public.boards  add column if not exists color text;
alter table public.columns add column if not exists width integer;
alter table public.items   add column if not exists description text;

-- ── Acesso ao quadro: responsável, dono ou admin ─────────────────────
create or replace function public.can_access_board(_board_id uuid, _user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select
    public.has_role(_user_id, 'admin')
    or exists (
      select 1
      from public.boards b
      where b.id = _board_id
        and (
          b.owner_id = _user_id
          or exists (select 1 from public.board_members bm
                     where bm.board_id = b.id and bm.user_id = _user_id)
        )
    );
$$;

-- Membro do workspace: admin conta como membro de todos.
create or replace function public.is_workspace_member(_workspace_id uuid, _user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select
    public.has_role(_user_id, 'admin')
    or exists (
      select 1 from public.workspace_members
      where workspace_id = _workspace_id and user_id = _user_id
    );
$$;

create or replace function public.is_workspace_admin(_workspace_id uuid, _user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select
    public.has_role(_user_id, 'admin')
    or exists (
      select 1 from public.workspace_members
      where workspace_id = _workspace_id and user_id = _user_id
        and role in ('owner', 'admin')
    );
$$;

-- ── boards: leitura/edição/exclusão ──────────────────────────────────
drop policy if exists "boards readable when accessible"      on public.boards;
drop policy if exists "boards managed by owner or ws admin"  on public.boards;
drop policy if exists "boards deletable by owner or ws admin" on public.boards;

create policy "boards readable when accessible"
  on public.boards for select to authenticated
  using (public.can_access_board(id, auth.uid()));
create policy "boards managed by owner or ws admin"
  on public.boards for update to authenticated
  using (owner_id = auth.uid() or public.is_workspace_admin(workspace_id, auth.uid()))
  with check (owner_id = auth.uid() or public.is_workspace_admin(workspace_id, auth.uid()));
create policy "boards deletable by owner or ws admin"
  on public.boards for delete to authenticated
  using (owner_id = auth.uid() or public.is_workspace_admin(workspace_id, auth.uid()));

-- ── board_members: quem é responsável. Só ADMIN do sistema gerencia ──
drop policy if exists "board_members readable when board accessible"     on public.board_members;
drop policy if exists "board_members managed by board owner or ws admin" on public.board_members;
drop policy if exists "board_members managed by system admin"            on public.board_members;

create policy "board_members readable when board accessible"
  on public.board_members for select to authenticated
  using (public.can_access_board(board_id, auth.uid()));
create policy "board_members managed by system admin"
  on public.board_members for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- ── Admin enxerga todos os workspaces ────────────────────────────────
drop policy if exists "workspaces readable by members" on public.workspaces;
create policy "workspaces readable by members"
  on public.workspaces for select to authenticated
  using (public.is_workspace_member(id, auth.uid()));

-- ── Perfis: a lista de pessoas precisa ser legível para atribuir ─────
-- (o Sistema Elo já libera SELECT em profiles para autenticados)

-- ── Conferência ──────────────────────────────────────────────────────
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('boards','board_members','workspaces')
order by tablename, cmd;
