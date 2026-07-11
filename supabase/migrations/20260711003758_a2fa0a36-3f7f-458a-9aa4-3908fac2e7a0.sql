
-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profiles TO authenticated;
GRANT UPDATE (full_name) ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated can view profiles" ON public.profiles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "users update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', NULL))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
INSERT INTO public.profiles (id, email, full_name)
SELECT id, email, COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name')
FROM auth.users ON CONFLICT (id) DO NOTHING;

-- ============ WORKFLOW TEMPLATES ============
CREATE TABLE public.workflow_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflow_templates TO authenticated;
GRANT ALL ON public.workflow_templates TO service_role;
ALTER TABLE public.workflow_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own templates" ON public.workflow_templates
  FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE TRIGGER workflow_templates_set_updated_at
  BEFORE UPDATE ON public.workflow_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ WORKFLOW STAGES ============
CREATE TABLE public.workflow_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.workflow_templates(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (template_id, position)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflow_stages TO authenticated;
GRANT ALL ON public.workflow_stages TO service_role;
ALTER TABLE public.workflow_stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "template owner manages stages" ON public.workflow_stages
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.workflow_templates t WHERE t.id = template_id AND t.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.workflow_templates t WHERE t.id = template_id AND t.owner_id = auth.uid()));

-- ============ STAGE APPROVERS ============
CREATE TABLE public.workflow_stage_approvers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id UUID NOT NULL REFERENCES public.workflow_stages(id) ON DELETE CASCADE,
  approver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (stage_id, approver_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflow_stage_approvers TO authenticated;
GRANT ALL ON public.workflow_stage_approvers TO service_role;
ALTER TABLE public.workflow_stage_approvers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "template owner manages approvers" ON public.workflow_stage_approvers
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.workflow_stages s JOIN public.workflow_templates t ON t.id = s.template_id WHERE s.id = stage_id AND t.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.workflow_stages s JOIN public.workflow_templates t ON t.id = s.template_id WHERE s.id = stage_id AND t.owner_id = auth.uid()));
CREATE POLICY "approver can see own assignments" ON public.workflow_stage_approvers
  FOR SELECT TO authenticated USING (approver_id = auth.uid());

-- Now that stage_approvers exists, add approver-read policy on stages
CREATE POLICY "approvers can read stages" ON public.workflow_stages
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.workflow_stage_approvers a WHERE a.stage_id = workflow_stages.id AND a.approver_id = auth.uid()));

-- Approvers can also read templates they belong to
CREATE POLICY "approvers can read templates they belong to" ON public.workflow_templates
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.workflow_stages s
    JOIN public.workflow_stage_approvers a ON a.stage_id = s.id
    WHERE s.template_id = workflow_templates.id AND a.approver_id = auth.uid()
  ));

-- ============ QUOTES modifications ============
CREATE TYPE public.quote_approval_state AS ENUM ('none', 'in_progress', 'approved', 'rejected');

ALTER TABLE public.quotes
  ADD COLUMN workflow_template_id UUID REFERENCES public.workflow_templates(id) ON DELETE SET NULL,
  ADD COLUMN current_stage_id UUID REFERENCES public.workflow_stages(id) ON DELETE SET NULL,
  ADD COLUMN approval_state public.quote_approval_state NOT NULL DEFAULT 'none';

CREATE POLICY "approvers can read assigned quotes" ON public.quotes
  FOR SELECT TO authenticated
  USING (
    workflow_template_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.workflow_stage_approvers a
      JOIN public.workflow_stages s ON s.id = a.stage_id
      WHERE s.template_id = quotes.workflow_template_id AND a.approver_id = auth.uid()
    )
  );

CREATE POLICY "approvers can read assigned quote attachments" ON public.quote_attachments
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.quotes q
    JOIN public.workflow_stages s ON s.template_id = q.workflow_template_id
    JOIN public.workflow_stage_approvers a ON a.stage_id = s.id
    WHERE q.id = quote_attachments.quote_id AND a.approver_id = auth.uid()
  ));

-- ============ QUOTE APPROVALS ============
CREATE TYPE public.approval_decision AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE public.quote_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  stage_id UUID NOT NULL REFERENCES public.workflow_stages(id) ON DELETE CASCADE,
  approver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  decision public.approval_decision NOT NULL DEFAULT 'pending',
  comment TEXT,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (quote_id, stage_id, approver_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quote_approvals TO authenticated;
GRANT ALL ON public.quote_approvals TO service_role;
ALTER TABLE public.quote_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "quote owner reads approvals" ON public.quote_approvals
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = quote_id AND q.user_id = auth.uid()));
CREATE POLICY "approver reads own approvals" ON public.quote_approvals
  FOR SELECT TO authenticated USING (approver_id = auth.uid());
CREATE POLICY "quote owner inserts approvals" ON public.quote_approvals
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = quote_id AND q.user_id = auth.uid()));
CREATE POLICY "approver updates own decision" ON public.quote_approvals
  FOR UPDATE TO authenticated
  USING (approver_id = auth.uid()) WITH CHECK (approver_id = auth.uid());
CREATE POLICY "quote owner deletes approvals" ON public.quote_approvals
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = quote_id AND q.user_id = auth.uid()));
CREATE TRIGGER quote_approvals_set_updated_at
  BEFORE UPDATE ON public.quote_approvals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ EMAIL LOG ============
CREATE TABLE public.quote_email_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  stage_id UUID REFERENCES public.workflow_stages(id) ON DELETE SET NULL,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipients TEXT[] NOT NULL,
  subject TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.quote_email_log TO authenticated;
GRANT ALL ON public.quote_email_log TO service_role;
ALTER TABLE public.quote_email_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "quote owner reads email log" ON public.quote_email_log
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = quote_id AND q.user_id = auth.uid()));
CREATE POLICY "quote owner inserts email log" ON public.quote_email_log
  FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = quote_id AND q.user_id = auth.uid()));

-- ============ Storage policy: approvers can download assigned attachments ============
CREATE POLICY "approvers can read assigned quote files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'quote-attachments'
  AND EXISTS (
    SELECT 1 FROM public.quote_attachments qa
    JOIN public.quotes q ON q.id = qa.quote_id
    JOIN public.workflow_stages s ON s.template_id = q.workflow_template_id
    JOIN public.workflow_stage_approvers a ON a.stage_id = s.id
    WHERE qa.storage_path = storage.objects.name
      AND a.approver_id = auth.uid()
  )
);
