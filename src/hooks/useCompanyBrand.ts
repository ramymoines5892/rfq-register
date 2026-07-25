import { useMemo } from "react";
import { useCurrentCompany } from "@/modules/company/queries";
import { useI18n } from "@/lib/i18n";

/**
 * Returns the current company's brand identity for use in the header/sidebar.
 * Falls back gracefully while loading or before setup.
 */
export function useCompanyBrand() {
  const { data: company, isLoading } = useCurrentCompany();
  const { lang } = useI18n();

  return useMemo(() => {
    const ar = lang === "ar";
    const displayName =
      (ar ? company?.name_ar || company?.name : company?.name || company?.name_ar) ??
      (isLoading ? "" : "CoreSuite");
    const shortName = company?.short_name?.trim() || displayName;
    const initial = (shortName?.[0] || "C").toUpperCase();
    return {
      loading: isLoading,
      displayName: displayName || "CoreSuite",
      shortName: shortName || "CoreSuite",
      logoUrl: company?.logo_url || null,
      initial,
      company,
    };
  }, [company, isLoading, lang]);
}
