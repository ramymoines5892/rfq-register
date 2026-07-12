
-- Notification preferences
CREATE TABLE public.notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  reminder_enabled boolean NOT NULL DEFAULT true,
  reminder_interval_minutes integer NOT NULL DEFAULT 15 CHECK (reminder_interval_minutes >= 1 AND reminder_interval_minutes <= 240),
  sound_enabled boolean NOT NULL DEFAULT true,
  browser_push_enabled boolean NOT NULL DEFAULT false,
  categories jsonb NOT NULL DEFAULT '{"pending_users":true,"approvals":true,"tasks":true,"system":true}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "np_select_own" ON public.notification_preferences FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "np_insert_own" ON public.notification_preferences FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "np_update_own" ON public.notification_preferences FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TRIGGER trg_np_updated_at BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Extend notifications with priority + category
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'system',
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal';

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Function: notify admins/owners about a new pending user
CREATE OR REPLACE FUNCTION public.notify_admins_new_pending_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _admin RECORD;
  _name text;
BEGIN
  IF NEW.status = 'pending'::public.profile_status THEN
    _name := COALESCE(NEW.full_name, NEW.email, 'مستخدم جديد');
    FOR _admin IN
      SELECT DISTINCT user_id FROM public.user_roles WHERE role IN ('admin','owner')
    LOOP
      INSERT INTO public.notifications (user_id, title, body, link, kind, category, priority, entity_type, entity_id)
      VALUES (
        _admin.user_id,
        'مستخدم جديد بانتظار التفعيل',
        _name || ' سجل حساب جديد ويحتاج تحديد الصلاحيات',
        '/hr',
        'action_required',
        'pending_users',
        'high',
        'profile',
        NEW.id::text
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_new_pending_user ON public.profiles;
CREATE TRIGGER trg_notify_new_pending_user
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.notify_admins_new_pending_user();

-- Also fire when a profile transitions to pending
CREATE OR REPLACE FUNCTION public.notify_admins_profile_status_pending()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _admin RECORD;
  _name text;
BEGIN
  IF NEW.status = 'pending'::public.profile_status AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    _name := COALESCE(NEW.full_name, NEW.email, 'مستخدم');
    FOR _admin IN SELECT DISTINCT user_id FROM public.user_roles WHERE role IN ('admin','owner') LOOP
      INSERT INTO public.notifications (user_id, title, body, link, kind, category, priority, entity_type, entity_id)
      VALUES (_admin.user_id, 'مستخدم بانتظار التفعيل', _name || ' يحتاج مراجعة الصلاحيات', '/hr', 'action_required', 'pending_users', 'high', 'profile', NEW.id::text);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_profile_status ON public.profiles;
CREATE TRIGGER trg_notify_profile_status
  AFTER UPDATE OF status ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.notify_admins_profile_status_pending();
