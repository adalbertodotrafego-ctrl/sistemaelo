-- =========================================================================
-- Pastas para organizar os relatórios de clientes (Relatórios → pastas).
-- Uma pasta é só um nome; cada client_report pode ficar em uma pasta (ou em
-- nenhuma = "Sem pasta"). Apagar a pasta não apaga os relatórios — eles voltam
-- para "Sem pasta" (ON DELETE SET NULL).
-- =========================================================================
CREATE TABLE public.report_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.report_folders TO authenticated;
GRANT ALL ON public.report_folders TO service_role;
ALTER TABLE public.report_folders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "report_folders all auth" ON public.report_folders FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.client_reports
  ADD COLUMN folder_id UUID REFERENCES public.report_folders(id) ON DELETE SET NULL;
