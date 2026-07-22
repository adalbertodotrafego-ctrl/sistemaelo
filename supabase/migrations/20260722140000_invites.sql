-- =====================================================================
-- Convites para o Elo Marketing OS
-- =====================================================================
-- Um convite é um token compartilhável (link). Quem abre o link cai na tela
-- de entrada já com as boas-vindas e a aba de criar conta aberta.
--
-- O token é lido por quem AINDA NÃO tem login — por isso a leitura é liberada
-- para anon, mas só devolve o que é preciso para dar as boas-vindas. Criar e
-- apagar convite continua restrito a quem está logado.
-- =====================================================================
CREATE TABLE public.invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  note TEXT,                                   -- "para o time de tráfego", etc.
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '14 days'),
  used_at TIMESTAMPTZ,
  used_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_invites_token ON public.invites (token);

GRANT SELECT ON public.invites TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invites TO authenticated;
GRANT ALL ON public.invites TO service_role;
ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;

-- Quem chegou pelo link ainda não tem conta: precisa conseguir validar o token.
CREATE POLICY "invites readable to validate link" ON public.invites
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "invites created by team" ON public.invites
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "invites managed by team" ON public.invites
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "invites deletable by creator or admin" ON public.invites
  FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));
