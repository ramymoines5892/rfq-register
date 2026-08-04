import { createFileRoute, redirect } from "@tanstack/react-router";

/** Legacy route: /partners was split into /customers and /suppliers. */
export const Route = createFileRoute("/_authenticated/partners")({
  validateSearch: (s: Record<string, unknown>) => ({ role: typeof s.role === "string" ? s.role : undefined }),
  beforeLoad: ({ search }) => {
    throw redirect({ to: search.role === "supplier" ? "/suppliers" : "/customers" });
  },
  component: () => null,
});
