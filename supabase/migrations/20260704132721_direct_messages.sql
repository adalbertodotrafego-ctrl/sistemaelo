-- 1:1 direct messages between team members, with file/image attachments.
-- RLS restricts each row to its two participants; realtime is on so open
-- chats update instantly.
CREATE TABLE public.direct_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT,
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.direct_messages TO authenticated;
GRANT ALL ON public.direct_messages TO service_role;
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "participants read their messages" ON public.direct_messages
  FOR SELECT TO authenticated USING (sender_id = auth.uid() OR recipient_id = auth.uid());
CREATE POLICY "senders insert their messages" ON public.direct_messages
  FOR INSERT TO authenticated WITH CHECK (sender_id = auth.uid());
CREATE POLICY "recipients mark messages read" ON public.direct_messages
  FOR UPDATE TO authenticated USING (recipient_id = auth.uid()) WITH CHECK (recipient_id = auth.uid());
CREATE INDEX idx_dm_recipient_unread ON public.direct_messages(recipient_id) WHERE read_at IS NULL;
CREATE INDEX idx_dm_conversation ON public.direct_messages(sender_id, recipient_id, created_at);
ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;
