import { createFileRoute } from "@tanstack/react-router";
import { PartnersDirectory } from "@/modules/partners/components/PartnersDirectory";

export const Route = createFileRoute("/_authenticated/suppliers")({
  head: () => ({
    meta: [
      { title: "الموردون — Suppliers" },
      { name: "description", content: "إدارة بيانات الموردين: جهات الاتصال، العناوين، الشروط المالية والمعاملات." },
      { property: "og:title", content: "Suppliers" },
      { property: "og:description", content: "Manage supplier master data, contacts, terms and transactions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <PartnersDirectory
      role="supplier"
      basePath="/suppliers"
      titleAr="الموردون"
      titleEn="Suppliers"
      subtitleAr="بيانات الموردين — جهات الاتصال، العناوين، الشروط المالية والمعاملات"
      subtitleEn="Supplier master data — contacts, addresses, terms and transactions"
      newLabelAr="مورد جديد"
      newLabelEn="New Supplier"
    />
  ),
});
