import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin/customer-fields")({
  beforeLoad: () => {
    throw redirect({ to: "/settings/form-builder" });
  },
});
