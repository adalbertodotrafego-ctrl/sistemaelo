-- =====================================================================
-- Quadro rei: a área de trabalho "Elo Marketing OS" aparece para todos
-- =====================================================================
-- Regra nova: TODA pessoa logada enxerga a área de trabalho (o "quadro rei"),
-- mas os quadros dentro dela continuam restritos aos responsáveis (board_members),
-- ao dono e aos admins — via can_access_board, que já foi ajustado antes.
--
-- Antes, ver a área dependia de estar em workspace_members; agora a leitura da
-- área é liberada a todos os autenticados. Isso NÃO abre os quadros: cada
-- quadro segue com sua própria política de acesso.
-- =====================================================================
DROP POLICY IF EXISTS "workspaces readable by members" ON public.workspaces;
CREATE POLICY "workspaces readable by all authenticated" ON public.workspaces
  FOR SELECT TO authenticated USING (true);

-- Garante que exista a área de trabalho rei. Só cria se não houver nenhuma —
-- se já existir uma, o app a trata como o quadro rei (e o admin pode renomear).
INSERT INTO public.workspaces (name, owner_id)
SELECT 'Elo Marketing OS', NULL
WHERE NOT EXISTS (SELECT 1 FROM public.workspaces);
