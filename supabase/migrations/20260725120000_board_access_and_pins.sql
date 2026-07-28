-- =====================================================================
-- Correção de acesso ao quadro rei + páginas fixadas por usuário
-- =====================================================================
-- BUG corrigido: o responsável (board_members) de um quadro não via NADA em
-- Tarefas. A árvore parte de `workspaces`, cuja policy de SELECT exigia ser
-- MEMBRO da área — e ser responsável de um quadro não te torna membro da área.
-- Resultado: a área rei (Elo Marketing OS) ficava invisível e, com ela, o
-- quadro do responsável. No modelo de "quadro rei" a área é única e deve ser
-- visível para todo mundo; quem controla o acesso é a policy de cada BOARD
-- (can_access_board = responsável, dono ou admin). Então liberamos a leitura
-- da área (e das pastas) para qualquer autenticado.
-- =====================================================================
DROP POLICY IF EXISTS "workspaces readable by members" ON public.workspaces;
DROP POLICY IF EXISTS "workspaces readable by all auth" ON public.workspaces;
CREATE POLICY "workspaces readable by all auth" ON public.workspaces
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "board_folders readable by workspace members" ON public.board_folders;
DROP POLICY IF EXISTS "board_folders readable by all auth" ON public.board_folders;
CREATE POLICY "board_folders readable by all auth" ON public.board_folders
  FOR SELECT TO authenticated USING (true);

-- ── Páginas fixadas (cada usuário tem os seus atalhos fixados) ───────
CREATE TABLE public.user_pins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  label TEXT NOT NULL,
  icon TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, path)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_pins TO authenticated;
GRANT ALL ON public.user_pins TO service_role;
ALTER TABLE public.user_pins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_pins own" ON public.user_pins FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
