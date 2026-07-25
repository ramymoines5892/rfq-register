# `src/shared/` — Cross-module primitives

Anything reusable across two or more business modules lives here.
Modules (`src/modules/<domain>/`) may import from `shared/` freely;
`shared/` must never import from `modules/`.

## Layout

| Folder            | Purpose                                                      |
| ----------------- | ------------------------------------------------------------ |
| `errors/`         | `normalizeError`, `AppError` — one error shape for the app. |
| `notifications/`  | `notify.success/info/warning/error/promise` — toast wrapper. |
| `loading/`        | `PageLoader`, `InlineSpinner`, `TableSkeleton`, `CardsSkeleton`. |
| `validation/`     | Zod primitives: bilingual names, email, phone, national id. |
| `types/`          | `Id`, `Row<T>`, `Insert<T>`, `Update<T>`, `Paginated<T>`.   |
| `constants/`      | `APP_NAME`, `DEFAULT_PAGE_SIZE`, `STALE_TIME`, `LOCALES`.   |

## Adoption rule

New code MUST use `shared/`. Existing code migrates opportunistically
whenever the surrounding file is touched — no big-bang rewrites.

## Do NOT put in `shared/`

- Domain-specific logic (goes in `modules/<domain>/logic.ts`).
- UI primitives from shadcn (stay in `components/ui/`).
- Anything imported by only one module (put it inside that module).
