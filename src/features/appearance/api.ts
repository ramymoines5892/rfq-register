import { supabase } from "@/integrations/supabase/client";

export type ThemeMode = "light" | "dark" | "system";
export type ThemePreset = "navy" | "emerald" | "slate" | "indigo" | "custom";
export type ThemeRadius = "sm" | "md" | "lg";
export type ThemeDensity = "comfortable" | "compact";
export type ThemeFont = "outfit" | "sora" | "space-grotesk" | "urbanist" | "cairo";
export type ThemeLang = "ar" | "en";

export type UIPreferences = {
  user_id: string;
  theme_mode: ThemeMode;
  preset: ThemePreset;
  primary_color: string | null;
  accent_color: string | null;
  radius: ThemeRadius;
  density: ThemeDensity;
  font_family: ThemeFont;
  sidebar_collapsed: boolean;
  lang: ThemeLang;
};

export const DEFAULT_UI_PREFS: Omit<UIPreferences, "user_id"> = {
  theme_mode: "system",
  preset: "navy",
  primary_color: null,
  accent_color: null,
  radius: "md",
  density: "comfortable",
  font_family: "outfit",
  sidebar_collapsed: false,
  lang: "ar",
};

// The auto-generated types.ts is regenerated after migrations run; until it
// includes user_ui_preferences we access the table through an untyped alias.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export async function fetchMyUIPrefs(): Promise<UIPreferences | null> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return null;
  const { data, error } = await db
    .from("user_ui_preferences")
    .select("*")
    .eq("user_id", u.user.id)
    .maybeSingle();
  if (error) throw error;
  if (data) return data as UIPreferences;
  // Fallback: create default row on first read (handles pre-trigger accounts).
  const insert = { user_id: u.user.id, ...DEFAULT_UI_PREFS };
  const { data: created, error: insErr } = await db
    .from("user_ui_preferences")
    .insert(insert)
    .select("*")
    .single();
  if (insErr) throw insErr;
  return created as UIPreferences;
}

export async function updateMyUIPrefs(
  patch: Partial<Omit<UIPreferences, "user_id">>,
): Promise<UIPreferences> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Not authenticated");
  const { data, error } = await db
    .from("user_ui_preferences")
    .update(patch)
    .eq("user_id", u.user.id)
    .select("*")
    .single();
  if (error) throw error;
  return data as UIPreferences;
}
