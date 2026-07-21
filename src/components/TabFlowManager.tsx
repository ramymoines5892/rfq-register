import { useEffect } from "react";

/**
 * Global Tab navigation: when focus is inside a form control (input/select/
 * textarea/contenteditable), pressing Tab / Shift+Tab moves focus to the
 * next/previous form control in document order, skipping buttons and links.
 * This matches the user's expectation across the whole app.
 */
export function TabFlowManager() {
  useEffect(() => {
    function isFormControl(el: Element | null): el is HTMLElement {
      if (!el) return false;
      const tag = el.tagName;
      if (tag === "INPUT") {
        const t = (el as HTMLInputElement).type;
        return t !== "hidden" && t !== "button" && t !== "submit" && t !== "reset";
      }
      return (
        tag === "SELECT" ||
        tag === "TEXTAREA" ||
        (el as HTMLElement).isContentEditable === true
      );
    }

    function isVisible(el: HTMLElement) {
      if (el.hidden) return false;
      if ((el as HTMLInputElement).disabled) return false;
      if (el.getAttribute("aria-hidden") === "true") return false;
      const ti = el.getAttribute("tabindex");
      if (ti && parseInt(ti, 10) < 0) return false;
      const rects = el.getClientRects();
      if (rects.length === 0) return false;
      const style = window.getComputedStyle(el);
      if (style.visibility === "hidden" || style.display === "none") return false;
      return true;
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Tab" || e.altKey || e.ctrlKey || e.metaKey) return;
      const active = document.activeElement as HTMLElement | null;
      if (!isFormControl(active)) return;

      const selector =
        'input:not([type=hidden]):not([type=button]):not([type=submit]):not([type=reset]),select,textarea,[contenteditable="true"]';
      const all = Array.from(document.querySelectorAll<HTMLElement>(selector)).filter(isVisible);
      const idx = all.indexOf(active as HTMLElement);
      if (idx === -1) return;
      const nextIdx = e.shiftKey ? idx - 1 : idx + 1;
      const next = all[nextIdx];
      if (!next) return;
      e.preventDefault();
      next.focus();
      if (next.tagName === "INPUT" || next.tagName === "TEXTAREA") {
        try {
          const inp = next as HTMLInputElement;
          const len = inp.value?.length ?? 0;
          inp.setSelectionRange?.(len, len);
        } catch { /* ignore selection errors on non-text inputs */ }
      }
    }

    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, []);

  return null;
}
