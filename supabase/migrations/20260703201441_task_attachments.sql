-- File/image attachments on tasks and on their chat messages.
ALTER TABLE public.tasks ADD COLUMN attachments JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.task_comments ADD COLUMN attachments JSONB NOT NULL DEFAULT '[]'::jsonb;

INSERT INTO storage.buckets (id, name, public) VALUES ('task-files', 'task-files', false) ON CONFLICT (id) DO NOTHING;
CREATE POLICY "Auth users read task files" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'task-files');
CREATE POLICY "Auth users upload task files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'task-files');
CREATE POLICY "Auth users update task files" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'task-files');
CREATE POLICY "Auth users delete task files" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'task-files');
