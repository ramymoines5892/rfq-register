import { createFileRoute } from "@tanstack/react-router";
import { PartnersDirectory } from "@/modules/partners/components/PartnersDirectory";

export const Route = createFileRoute("/_authenticated/customers/")({
  head: () => ({
    meta: [
      { title: "العملاء — Customers" },
      { name: "description", content: "إدارة بيانات العملاء: جهات الاتصال، العناوين، الشروط المالية والمعاملات." },
      { property: "og:title", content: "Customers" },
      { property: "og:description", content: "Manage customer master data, contacts, terms and transactions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <PartnersDirectory
      role="customer"
      basePath="/customers"
      titleAr="العملاء"
      titleEn="Customers"
      subtitleAr="بيانات العملاء — جهات الاتصال، العناوين، الشروط المالية والمعاملات"
      subtitleEn="Customer master data — contacts, addresses, terms and transactions"
      newLabelAr="عميل جديد"
      newLabelEn="New Customer"
    />
  ),
});
