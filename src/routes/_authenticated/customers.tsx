import { createFileRoute } from "@tanstack/react-router";
import { PartnersDirectory } from "@/modules/partners/components/PartnersDirectory";

export const Route = createFileRoute("/_authenticated/customers")({
  head: () => ({
    meta: [
      { title: "العملاء — Customers" },
      { name: "description", content: "إدارة بيانات العملاء: جهات الاتصال، العناوين، المستندات والحسابات البنكية." },
      { property: "og:title", content: "Customers" },
      { property: "og:description", content: "Manage customer master data, contacts and documents." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <PartnersDirectory
      role="customer"
      titleAr="العملاء"
      titleEn="Customers"
      subtitleAr="بيانات العملاء — جهات الاتصال، العناوين، المستندات والحسابات البنكية"
      subtitleEn="Customer master data — contacts, addresses, documents and bank accounts"
      newLabelAr="عميل جديد"
      newLabelEn="New Customer"
    />
  ),
});
