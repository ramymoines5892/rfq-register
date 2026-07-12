-- CUSTOMERS
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS name_ar text,
  ADD COLUMN IF NOT EXISTS name_en text,
  ADD COLUMN IF NOT EXISTS address_ar text,
  ADD COLUMN IF NOT EXISTS address_en text,
  ADD COLUMN IF NOT EXISTS industry_ar text,
  ADD COLUMN IF NOT EXISTS industry_en text,
  ADD COLUMN IF NOT EXISTS payment_terms_ar text,
  ADD COLUMN IF NOT EXISTS payment_terms_en text;

UPDATE public.customers SET
  name_ar = COALESCE(name_ar, name),
  name_en = COALESCE(name_en, name),
  address_ar = COALESCE(address_ar, address),
  address_en = COALESCE(address_en, address),
  industry_ar = COALESCE(industry_ar, industry),
  industry_en = COALESCE(industry_en, industry),
  payment_terms_ar = COALESCE(payment_terms_ar, payment_terms),
  payment_terms_en = COALESCE(payment_terms_en, payment_terms);

-- CUSTOMER_CONTACTS  (title column is the job title)
ALTER TABLE public.customer_contacts
  ADD COLUMN IF NOT EXISTS name_ar text,
  ADD COLUMN IF NOT EXISTS name_en text,
  ADD COLUMN IF NOT EXISTS title_ar text,
  ADD COLUMN IF NOT EXISTS title_en text;

UPDATE public.customer_contacts SET
  name_ar = COALESCE(name_ar, name),
  name_en = COALESCE(name_en, name),
  title_ar = COALESCE(title_ar, title),
  title_en = COALESCE(title_en, title);

-- CUSTOMER_BANKS
ALTER TABLE public.customer_banks
  ADD COLUMN IF NOT EXISTS bank_name_ar text,
  ADD COLUMN IF NOT EXISTS bank_name_en text,
  ADD COLUMN IF NOT EXISTS account_name_ar text,
  ADD COLUMN IF NOT EXISTS account_name_en text,
  ADD COLUMN IF NOT EXISTS branch_ar text,
  ADD COLUMN IF NOT EXISTS branch_en text;

UPDATE public.customer_banks SET
  bank_name_ar = COALESCE(bank_name_ar, bank_name),
  bank_name_en = COALESCE(bank_name_en, bank_name),
  account_name_ar = COALESCE(account_name_ar, account_name),
  account_name_en = COALESCE(account_name_en, account_name),
  branch_ar = COALESCE(branch_ar, branch),
  branch_en = COALESCE(branch_en, branch);

-- DEPARTMENTS
ALTER TABLE public.departments
  ADD COLUMN IF NOT EXISTS name_ar text,
  ADD COLUMN IF NOT EXISTS name_en text;

UPDATE public.departments SET
  name_ar = COALESCE(name_ar, name),
  name_en = COALESCE(name_en, name);

-- JOB_TITLES
ALTER TABLE public.job_titles
  ADD COLUMN IF NOT EXISTS name_ar text,
  ADD COLUMN IF NOT EXISTS name_en text;

UPDATE public.job_titles SET
  name_ar = COALESCE(name_ar, name),
  name_en = COALESCE(name_en, name);
