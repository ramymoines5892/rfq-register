
-- 1) Expand app_permission enum with granular actions
ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'customers.create';
ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'customers.edit';
ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'customers.delete';
ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'customers.view_payment_info';
ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'quotes.view_own';
ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'quotes.view_team';
ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'quotes.view_all';
ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'quotes.create';
ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'quotes.edit';
ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'quotes.delete';
ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'quotes.assign';
ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'users.manage_roles';
ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'templates.manage';
ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'notifications.view';

-- 2) Audit log
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email text,
  action text NOT NULL,        -- e.g. 'insert' | 'update' | 'delete' | 'approve'
  entity_type text NOT NULL,   -- e.g. 'customers', 'quotes', 'profiles'
  entity_id text,
  before jsonb,
  after jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_logs_insert_any_auth ON public.audit_logs
FOR INSERT TO authenticated
WITH CHECK (actor_id = auth.uid());

CREATE POLICY audit_logs_select_admin ON public.audit_logs
FOR SELECT TO authenticated
USING (public.is_admin_or_owner(auth.uid()));

CREATE INDEX IF NOT EXISTS audit_logs_entity_idx ON public.audit_logs (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS audit_logs_actor_idx  ON public.audit_logs (actor_id, created_at DESC);

-- 3) Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  link text,
  kind text NOT NULL DEFAULT 'info',   -- 'info' | 'success' | 'warning' | 'error'
  entity_type text,
  entity_id text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY notifications_select_own ON public.notifications
FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_admin_or_owner(auth.uid()));

CREATE POLICY notifications_update_own ON public.notifications
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY notifications_delete_own ON public.notifications
FOR DELETE TO authenticated
USING (user_id = auth.uid());

CREATE POLICY notifications_insert_admin ON public.notifications
FOR INSERT TO authenticated
WITH CHECK (public.is_admin_or_owner(auth.uid()));

CREATE INDEX IF NOT EXISTS notifications_user_idx ON public.notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_unread_idx ON public.notifications (user_id) WHERE read_at IS NULL;
