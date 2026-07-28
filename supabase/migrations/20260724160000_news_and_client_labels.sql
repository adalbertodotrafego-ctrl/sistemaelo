-- =====================================================================
-- Onda 2: Novidades do sistema + organização e etiquetas de clientes
-- =====================================================================

-- ── Novidades / avisos do sistema (página "Novidades") ───────────────
CREATE TABLE public.system_news (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT,
  kind TEXT NOT NULL DEFAULT 'update',   -- update | notice | fix | beta
  is_beta BOOLEAN NOT NULL DEFAULT false,
  pinned BOOLEAN NOT NULL DEFAULT false,  -- aviso fixado no topo
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.system_news TO authenticated;
GRANT ALL ON public.system_news TO service_role;
ALTER TABLE public.system_news ENABLE ROW LEVEL SECURITY;
CREATE POLICY "news readable by all" ON public.system_news FOR SELECT TO authenticated USING (true);
CREATE POLICY "news managed by admin" ON public.system_news FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ── Clientes: ordem manual (arrastar) e etiquetas ───────────────────
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS position DOUBLE PRECISION;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS label_ids UUID[] NOT NULL DEFAULT '{}';

-- Semeia a posição inicial pela data de entrada, para o arrastar já ter base.
UPDATE public.clients SET position = extract(epoch FROM created_at) WHERE position IS NULL;

CREATE TABLE public.client_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT 'blue',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_labels TO authenticated;
GRANT ALL ON public.client_labels TO service_role;
ALTER TABLE public.client_labels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "client_labels all auth" ON public.client_labels FOR ALL TO authenticated USING (true) WITH CHECK (true);
