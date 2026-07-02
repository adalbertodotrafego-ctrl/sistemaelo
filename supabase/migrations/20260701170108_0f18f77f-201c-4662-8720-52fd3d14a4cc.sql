CREATE POLICY "avatars read auth" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'avatars');
CREATE POLICY "avatars insert auth" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars');
CREATE POLICY "avatars update auth" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'avatars');
CREATE POLICY "avatars delete auth" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'avatars');

CREATE POLICY "logos read auth" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'logos');
CREATE POLICY "logos insert admin" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'logos' AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "logos update admin" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'logos' AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "logos delete admin" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'logos' AND public.has_role(auth.uid(),'admin'));