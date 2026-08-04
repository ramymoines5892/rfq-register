import { createFileRoute } from "@tanstack/react-router";
import { PartnersDirectory } from "@/modules/partners/components/PartnersDirectory";

export const Route = createFileRoute("/_authenticated/suppliers")({
  head: () => ({
    meta: [
      { title: "الموردون — Suppliers" },
      { name: "description", content: "إدارة بيانات الموردين: العقود، المستندات، جهات الاتصال والحسابات البنكية." },
      { property: "og:title", content: "Suppliers" },
      { property: "og:description", content: "Manage supplier master data, contacts and documents." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <PartnersDirectory
      role="supplier"
      titleAr="الموردون"
      titleEn="Suppliers"
      subtitleAr="بيانات الموردين — جهات الاتصال، العناوين، المستندات والحسابات البنكية"
      subtitleEn="Supplier master data — contacts, addresses, documents and bank accounts"
      newLabelAr="مورد جديد"
      newLabelEn="New Supplier"
    />
  ),
});
