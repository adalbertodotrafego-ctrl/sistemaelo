-- =========================================================================
-- Etiquetas do CRM: rótulos coloridos (ex.: "Quente", "Aguardando retorno",
-- "VIP") que a equipe cria e aplica nos leads. A cor da etiqueta pinta o card
-- no quadro, pra destacar prioridade num relance. Cada lead pode ter várias.
-- Também adiciona uma data de próximo follow-up para os avisos de acompanhamento.
-- =========================================================================
CREATE TABLE public.crm_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT 'blue',   -- red, amber, green, blue, purple, pink, cyan, slate
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_labels TO authenticated;
GRANT ALL ON public.crm_labels TO service_role;
ALTER TABLE public.crm_labels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_labels all auth" ON public.crm_labels FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Etiquetas aplicadas ao lead (lista de ids) e data do próximo follow-up.
ALTER TABLE public.crm_leads ADD COLUMN IF NOT EXISTS label_ids UUID[] NOT NULL DEFAULT '{}';
ALTER TABLE public.crm_leads ADD COLUMN IF NOT EXISTS next_action_at DATE;

-- Realtime: novas etiquetas aparecem na hora para toda a equipe.
ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_labels;
