-- 1. Create table
CREATE TABLE public.user_ui_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  theme_mode text NOT NULL DEFAULT 'system',
  preset text NOT NULL DEFAULT 'navy',
  primary_color text,
  accent_color text,
  radius text NOT NULL DEFAULT 'md',
  density text NOT NULL DEFAULT 'comfortable',
  font_family text NOT NULL DEFAULT 'outfit',
  sidebar_collapsed boolean NOT NULL DEFAULT false,
  lang text NOT NULL DEFAULT 'ar',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT theme_mode_check CHECK (theme_mode IN ('light','dark','system')),
  CONSTRAINT preset_check CHECK (preset IN ('navy','emerald','slate','indigo','custom')),
  CONSTRAINT radius_check CHECK (radius IN ('sm','md','lg')),
  CONSTRAINT density_check CHECK (density IN ('comfortable','compact')),
  CONSTRAINT font_check CHECK (font_family IN ('outfit','sora','space-grotesk','urbanist','cairo')),
  CONSTRAINT lang_check CHECK (lang IN ('ar','en'))
);

-- 2. Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_ui_preferences TO authenticated;
GRANT ALL ON public.user_ui_preferences TO service_role;

-- 3. RLS
ALTER TABLE public.user_ui_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own ui prefs"
  ON public.user_ui_preferences FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own ui prefs"
  ON public.user_ui_preferences FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own ui prefs"
  ON public.user_ui_preferences FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own ui prefs"
  ON public.user_ui_preferences FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- 4. updated_at trigger
CREATE TRIGGER trg_user_ui_prefs_updated_at
  BEFORE UPDATE ON public.user_ui_preferences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. Auto-create default row when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user_ui_prefs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_ui_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_ui_prefs
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_ui_prefs();

-- 6. Backfill defaults for existing users
INSERT INTO public.user_ui_preferences (user_id)
SELECT id FROM auth.users
ON CONFLICT (user_id) DO NOTHING;