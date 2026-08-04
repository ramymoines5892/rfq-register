import { createFileRoute } from "@tanstack/react-router";
import { PartnerDetailPage } from "@/modules/partners/components/PartnerDetailPage";

export const Route = createFileRoute("/_authenticated/suppliers/$id")({
  head: () => ({
    meta: [
      { title: "بطاقة المورد — Supplier Card" },
      { name: "description", content: "بيانات المورد، جهات الاتصال، العناوين، الشروط المالية وسجل المعاملات." },
      { property: "og:title", content: "Supplier Card" },
      { property: "og:description", content: "Supplier profile, contacts, addresses, financial terms and activity." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SupplierDetailRoute,
});

function SupplierDetailRoute() {
  const { id } = Route.useParams();
  return (
    <PartnerDetailPage
      id={id}
      role="supplier"
      basePath="/suppliers"
      backAr="رجوع للموردين"
      backEn="Back to Suppliers"
    />
  );
}
