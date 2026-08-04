CREATE POLICY "partner_files_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'partner-attachments');

CREATE POLICY "partner_files_write" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'partner-attachments' AND (public.is_admin_or_owner(auth.uid()) OR public.has_permission(auth.uid(), 'customers.manage'::public.app_permission)))
  WITH CHECK (bucket_id = 'partner-attachments' AND (public.is_admin_or_owner(auth.uid()) OR public.has_permission(auth.uid(), 'customers.manage'::public.app_permission)));