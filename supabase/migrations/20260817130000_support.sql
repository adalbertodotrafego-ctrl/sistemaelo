-- Suporte: bolinha flutuante (qualquer usuário) + página de Suporte (admin).
CREATE TABLE public.support_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT 'blue',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_labels TO authenticated;
GRANT ALL ON public.support_labels TO service_role;
ALTER TABLE public.support_labels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "support_labels read" ON public.support_labels
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "support_labels admin write" ON public.support_labels
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  label_ids UUID[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_messages TO authenticated;
GRANT ALL ON public.support_messages TO service_role;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

-- Qualquer usuário autenticado registra o próprio pedido de suporte...
CREATE POLICY "support_messages insert own" ON public.support_messages
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
-- ...mas só admin lê, edita (etiquetas) e apaga as mensagens.
CREATE POLICY "support_messages admin read" ON public.support_messages
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "support_messages admin update" ON public.support_messages
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "support_messages admin delete" ON public.support_messages
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
