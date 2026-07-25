-- ─── Audit log for permission changes ───────────────────────────────
CREATE TABLE public.permission_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  scope text NOT NULL CHECK (scope IN ('department','job_title','user')),
  target_id uuid NOT NULL,
  target_name text,
  permission public.app_permission NOT NULL,
  action text NOT NULL CHECK (action IN ('grant','revoke')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX permission_audit_log_target_idx ON public.permission_audit_log (scope, target_id, created_at DESC);
CREATE INDEX permission_audit_log_actor_idx  ON public.permission_audit_log (actor_id, created_at DESC);

GRANT SELECT ON public.permission_audit_log TO authenticated;
GRANT ALL ON public.permission_audit_log TO service_role;

ALTER TABLE public.permission_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read audit log"
  ON public.permission_audit_log FOR SELECT
  TO authenticated
  USING (public.is_admin_or_owner(auth.uid()));

-- No client INSERT/UPDATE/DELETE — writes are trigger-only via SECURITY DEFINER.

-- ─── Trigger functions (SECURITY DEFINER so triggers can write even
--     though authenticated has no INSERT policy on the audit table) ──
CREATE OR REPLACE FUNCTION public.log_dept_permission_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _name text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT COALESCE(name_ar, name_en, name) INTO _name FROM public.departments WHERE id = NEW.department_id;
    INSERT INTO public.permission_audit_log(actor_id, scope, target_id, target_name, permission, action)
    VALUES (auth.uid(), 'department', NEW.department_id, _name, NEW.permission, 'grant');
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    SELECT COALESCE(name_ar, name_en, name) INTO _name FROM public.departments WHERE id = OLD.department_id;
    INSERT INTO public.permission_audit_log(actor_id, scope, target_id, target_name, permission, action)
    VALUES (auth.uid(), 'department', OLD.department_id, _name, OLD.permission, 'revoke');
    RETURN OLD;
  END IF;
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.log_job_permission_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _name text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT COALESCE(name_ar, name_en, name) INTO _name FROM public.job_titles WHERE id = NEW.job_title_id;
    INSERT INTO public.permission_audit_log(actor_id, scope, target_id, target_name, permission, action)
    VALUES (auth.uid(), 'job_title', NEW.job_title_id, _name, NEW.permission, 'grant');
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    SELECT COALESCE(name_ar, name_en, name) INTO _name FROM public.job_titles WHERE id = OLD.job_title_id;
    INSERT INTO public.permission_audit_log(actor_id, scope, target_id, target_name, permission, action)
    VALUES (auth.uid(), 'job_title', OLD.job_title_id, _name, OLD.permission, 'revoke');
    RETURN OLD;
  END IF;
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.log_user_permission_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _name text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT COALESCE(full_name, email) INTO _name FROM public.profiles WHERE id = NEW.user_id;
    INSERT INTO public.permission_audit_log(actor_id, scope, target_id, target_name, permission, action)
    VALUES (auth.uid(), 'user', NEW.user_id, _name, NEW.permission, 'grant');
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    SELECT COALESCE(full_name, email) INTO _name FROM public.profiles WHERE id = OLD.user_id;
    INSERT INTO public.permission_audit_log(actor_id, scope, target_id, target_name, permission, action)
    VALUES (auth.uid(), 'user', OLD.user_id, _name, OLD.permission, 'revoke');
    RETURN OLD;
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_log_dept_permission_change ON public.department_permissions;
CREATE TRIGGER trg_log_dept_permission_change
  AFTER INSERT OR DELETE ON public.department_permissions
  FOR EACH ROW EXECUTE FUNCTION public.log_dept_permission_change();

DROP TRIGGER IF EXISTS trg_log_job_permission_change ON public.job_title_permissions;
CREATE TRIGGER trg_log_job_permission_change
  AFTER INSERT OR DELETE ON public.job_title_permissions
  FOR EACH ROW EXECUTE FUNCTION public.log_job_permission_change();

DROP TRIGGER IF EXISTS trg_log_user_permission_change ON public.user_permissions;
CREATE TRIGGER trg_log_user_permission_change
  AFTER INSERT OR DELETE ON public.user_permissions
  FOR EACH ROW EXECUTE FUNCTION public.log_user_permission_change();

-- ─── Server-side guard usable in any RPC ────────────────────────────
CREATE OR REPLACE FUNCTION public.require_permission(_perm public.app_permission)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_permission(auth.uid(), _perm) THEN
    RAISE EXCEPTION 'Missing permission: %', _perm USING ERRCODE = '42501';
  END IF;
END $$;

GRANT EXECUTE ON FUNCTION public.require_permission(public.app_permission) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, public.app_permission) TO authenticated;