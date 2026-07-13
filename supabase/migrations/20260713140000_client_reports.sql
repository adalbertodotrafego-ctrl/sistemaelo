-- =========================================================================
-- client_reports: relatórios editáveis por cliente (Relatórios → "Novo relatório").
-- "metrics" guarda uma lista livre de indicadores [{label, value}] escolhida
-- pelo usuário — pode ser preenchida automaticamente a partir de campanhas/
-- financeiro/social do cliente, e depois editada à vontade antes de finalizar.
-- =========================================================================
CREATE TABLE public.client_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  period_start DATE,
  period_end DATE,
  status TEXT NOT NULL DEFAULT 'draft',
  summary TEXT,
  metrics JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_reports TO authenticated;
GRANT ALL ON public.client_reports TO service_role;
ALTER TABLE public.client_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "client_reports all auth" ON public.client_reports FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER client_reports_set_updated_at BEFORE UPDATE ON public.client_reports FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
