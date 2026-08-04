import { createFileRoute } from "@tanstack/react-router";
import { PartnerDetailPage } from "@/modules/partners/components/PartnerDetailPage";

export const Route = createFileRoute("/_authenticated/customers/$id")({
  head: () => ({
    meta: [
      { title: "بطاقة العميل — Customer Card" },
      { name: "description", content: "بيانات العميل، جهات الاتصال، العناوين، الشروط المالية وسجل المعاملات." },
      { property: "og:title", content: "Customer Card" },
      { property: "og:description", content: "Customer profile, contacts, addresses, financial terms and activity." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CustomerDetailRoute,
});

function CustomerDetailRoute() {
  const { id } = Route.useParams();
  return (
    <PartnerDetailPage
      id={id}
      role="customer"
      basePath="/customers"
      backAr="رجوع للعملاء"
      backEn="Back to Customers"
    />
  );
}
