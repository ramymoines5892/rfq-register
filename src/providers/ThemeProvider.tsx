import { useEffect, type ReactNode } from "react";
import { useMyUIPrefs } from "@/modules/appearance/queries";
import type { UIPreferences } from "@/modules/appearance/api";
import { DEFAULT_UI_PREFS } from "@/modules/appearance/api";

const LS_KEY = "cs.ui.prefs";

/** Read cached prefs before the DB round-trip to avoid a flash. */
function readCached(): Partial<UIPreferences> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as Partial<UIPreferences>) : null;
  } catch {
    return null;
  }
}

function writeCached(p: Partial<UIPreferences>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(p));
  } catch {
    /* quota, private mode — ignore */
  }
}

function systemPrefersDark(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

function applyPrefs(p: Partial<UIPreferences>) {
  if (typeof document === "undefined") return;
  const html = document.documentElement;
  const preset = p.preset ?? DEFAULT_UI_PREFS.preset;
  const font = p.font_family ?? DEFAULT_UI_PREFS.font_family;
  const radius = p.radius ?? DEFAULT_UI_PREFS.radius;
  const density = p.density ?? DEFAULT_UI_PREFS.density;
  const mode = p.theme_mode ?? DEFAULT_UI_PREFS.theme_mode;

  html.setAttribute("data-theme", preset);
  html.setAttribute("data-font", font);
  html.setAttribute("data-radius", radius);
  html.setAttribute("data-density", density);

  const dark = mode === "dark" || (mode === "system" && systemPrefersDark());
  html.classList.toggle("dark", dark);

  // Custom primary override (raw CSS color — hex/oklch/hsl accepted).
  if (preset === "custom" && p.primary_color) {
    html.style.setProperty("--primary", p.primary_color);
    html.style.setProperty("--ring", p.primary_color);
    html.style.setProperty("--sidebar-primary", p.primary_color);
  } else {
    html.style.removeProperty("--primary");
    html.style.removeProperty("--ring");
    html.style.removeProperty("--sidebar-primary");
  }
  if (preset === "custom" && p.accent_color) {
    html.style.setProperty("--accent", p.accent_color);
  } else {
    html.style.removeProperty("--accent");
  }
}

/**
 * Reads the signed-in user's UI preferences from the DB and applies them to
 * <html>. Falls back to localStorage cache while loading. Also listens to
 * OS dark-mode changes when the user picked "system".
 *
 * NOTE: prefs are applied only AFTER hydration. Mutating <html> attributes
 * before React hydrates causes a hydration mismatch on the <html> element.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const { data: prefs } = useMyUIPrefs();

  // Apply the cached prefs as soon as we're on the client (post-hydration).
  useEffect(() => {
    const cached = readCached();
    if (cached) applyPrefs(cached);
  }, []);

  useEffect(() => {
    if (!prefs) return;
    applyPrefs(prefs);
    writeCached(prefs);
  }, [prefs]);


  // React to OS scheme changes while on "system".
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const mode = prefs?.theme_mode ?? DEFAULT_UI_PREFS.theme_mode;
      if (mode === "system") applyPrefs(prefs ?? {});
    };
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, [prefs]);

  return <>{children}</>;
}
