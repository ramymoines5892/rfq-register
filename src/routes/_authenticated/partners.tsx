import { createFileRoute, redirect } from "@tanstack/react-router";

/** Legacy route: /partners was split into /customers and /suppliers. */
export const Route = createFileRoute("/_authenticated/partners")({
  beforeLoad: ({ location }) => {
    const role = new URLSearchParams(location.searchStr).get("role");
    throw redirect({ to: role === "supplier" ? "/suppliers" : "/customers" });
  },
  component: () => null,
});
