---
name: UI baseline (scrollbars + responsive)
description: Global scrollbar styling and mandatory responsive behavior across every screen (mobile/tablet/desktop)
type: design
---

## Scrollbars — global, elegant
Applied globally in `src/styles.css` under `@layer base` via `*` selector.
- `scrollbar-width: thin`, transparent track, thumb tinted from `--color-foreground` (18% opacity), hover/active tinted from `--color-primary`.
- Webkit: 10px desktop, 6px on ≤640px viewports.
- Never override with custom colored scrollbars per-component. If a container needs no scrollbar, use `@utility no-scrollbar`.

## Responsive — mandatory rule for every screen
Every new page/component MUST work on mobile (≤640px), tablet (641–1024px), and desktop (>1024px).
- Follow `responsive-layout-patterns`: grid `grid-cols-[minmax(0,1fr)_auto]` on mobile → `sm:flex` on wider, `min-w-0` on text containers, `shrink-0` on icons, `truncate` on single-line headings.
- Tables: wrap in `overflow-x-auto` container, never fixed widths.
- Dialogs/Drawers: max-w with `w-[95vw]` fallback on mobile.
- Sticky headers/toolbars must not overlap content on small screens; test at 375px width.
- No horizontal page scroll on any viewport.
