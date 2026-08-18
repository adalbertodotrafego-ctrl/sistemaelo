-- Suporte vira chat: cada support_messages é uma conversa (1 por usuário, a
-- mensagem raiz), e as respostas (do usuário e dos admins) entram aqui.
CREATE TABLE public.support_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.support_messages(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX support_replies_message_id_idx ON public.support_replies(message_id);

GRANT SELECT, INSERT ON public.support_replies TO authenticated;
GRANT ALL ON public.support_replies TO service_role;
ALTER TABLE public.support_replies ENABLE ROW LEVEL SECURITY;

-- Lê: admin lê tudo; dono da conversa lê as próprias respostas.
CREATE POLICY "support_replies read" ON public.support_replies
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.support_messages m WHERE m.id = message_id AND m.user_id = auth.uid())
  );

-- Escreve: admin responde qualquer conversa; usuário só responde a própria,
-- e sempre assinando com o próprio id (sem se passar por outro usuário).
CREATE POLICY "support_replies insert" ON public.support_replies
  FOR INSERT TO authenticated WITH CHECK (
    sender_id = auth.uid()
    AND (
      public.has_role(auth.uid(), 'admin')
      OR EXISTS (SELECT 1 FROM public.support_messages m WHERE m.id = message_id AND m.user_id = auth.uid())
    )
  );

-- Realtime: bolinha e painel de admin recebem mensagens novas sem recarregar.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'support_replies'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.support_replies;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'support_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages;
  END IF;
END $$;
