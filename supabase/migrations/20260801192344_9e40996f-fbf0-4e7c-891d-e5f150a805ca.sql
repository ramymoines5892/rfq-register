CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

DO $$
BEGIN
  PERFORM cron.unschedule('company-doc-expiry-notify');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'company-doc-expiry-notify',
  '0 6 * * *',
  $$SELECT public.generate_company_document_notifications();$$
);

SELECT public.generate_company_document_notifications();