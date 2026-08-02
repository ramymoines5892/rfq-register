ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS doc_expiry_warning_days integer NOT NULL DEFAULT 7;

ALTER TABLE public.companies
  ADD CONSTRAINT companies_doc_expiry_warning_days_check
  CHECK (doc_expiry_warning_days BETWEEN 1 AND 365);