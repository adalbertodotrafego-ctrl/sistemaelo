-- =====================================================================
-- Seção (board_folders) só aparece se tiver algum quadro visível dentro
-- =====================================================================
-- SINTOMA: usuário sem permissão em nenhum quadro de uma seção continuava
-- vendo a seção na barra de Tarefas (GESTÃO, BASE DE CLIENTES, OPERAÇÃO…),
-- todas vazias. Vazamento de estrutura: revela como a agência se organiza
-- e quantos quadros existem, para quem não deveria ver nada daquilo.
--
-- CAUSA: desde 20260725120000_board_access_and_pins.sql a leitura de
-- board_folders é liberada de forma plana — primeiro a todo autenticado,
-- depois (20260809120000) a todo usuário APROVADO. Nunca dependeu do
-- conteúdo da seção. Isso foi deliberado na época (o modelo de "quadro
-- rei" precisava que a árvore fosse legível para o responsável de um
-- quadro conseguir chegar até ele), mas o efeito colateral é a seção
-- aparecer mesmo quando não há nada acessível dentro.
--
-- CORREÇÃO: mantém a exigência de aprovação e acrescenta a condição de
-- ter pelo menos um quadro ATIVO acessível dentro da seção. Admin segue
-- vendo tudo (pode organizar seções vazias). can_access_board é
-- SECURITY DEFINER, então não há recursão de RLS ao consultá-la aqui.
--
-- OBS: a seção "Sem seção" da barra lateral não é uma linha desta tabela
-- (é o grupo dos quadros com folder_id nulo, montado no cliente), e a
-- própria tela já a esconde quando fica vazia.
-- =====================================================================

drop policy if exists "board_folders readable by approved" on public.board_folders;

create policy "board_folders readable when they hold a visible board"
  on public.board_folders for select to authenticated
  using (
    public.is_approved((select auth.uid()))
    and (
      public.has_role((select auth.uid()), 'admin')
      or exists (
        select 1 from public.boards b
        where b.folder_id = public.board_folders.id
          and b.state = 'active'
          and public.can_access_board(b.id, (select auth.uid()))
      )
    )
  );

-- A policy filtra por folder_id + state a cada seção listada.
create index if not exists idx_boards_folder_active
  on public.boards(folder_id, state);
