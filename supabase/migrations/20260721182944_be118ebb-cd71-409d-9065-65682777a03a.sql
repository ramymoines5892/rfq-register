
CREATE POLICY "Auth view company logos" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'company-logos');
CREATE POLICY "Auth upload company logos" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'company-logos');
CREATE POLICY "Auth update company logos" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'company-logos');
CREATE POLICY "Auth delete company logos" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'company-logos');
