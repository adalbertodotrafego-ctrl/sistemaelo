
CREATE POLICY "Auth users read contracts files" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'contracts');
CREATE POLICY "Auth users upload contracts files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'contracts');
CREATE POLICY "Auth users update contracts files" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'contracts');
CREATE POLICY "Auth users delete contracts files" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'contracts');

CREATE POLICY "Auth users read project files" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'project-files');
CREATE POLICY "Auth users upload project files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'project-files');
CREATE POLICY "Auth users update project files" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'project-files');
CREATE POLICY "Auth users delete project files" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'project-files');

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS external_id text;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS external_source text;
CREATE UNIQUE INDEX IF NOT EXISTS events_external_unique ON public.events(external_source, external_id) WHERE external_id IS NOT NULL;
