import { type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useFeature } from "@/features/features/queries";
import { FEATURE_MAP, type FeatureKey } from "@/lib/features/registry";

type Props = {
  feature: FeatureKey | string;
  children: ReactNode;
  /** When true and the feature is off, show a friendly "not enabled" panel
   *  instead of hiding silently. Use for full-page routes. */
  fallbackPanel?: boolean;
  /** Custom fallback ReactNode when the feature is off (overrides fallbackPanel). */
  fallback?: ReactNode;
};

export function FeatureGate({ feature, children, fallbackPanel, fallback }: Props) {
  const enabled = useFeature(feature);
  if (enabled) return <>{children}</>;
  if (fallback !== undefined) return <>{fallback}</>;
  if (fallbackPanel) return <FeatureDisabled feature={feature} />;
  return null;
}

export function FeatureDisabled({ feature }: { feature: string }) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const def = FEATURE_MAP[feature];
  const Icon = def?.icon ?? Lock;
  const label = def ? (ar ? def.ar : def.en) : feature;

  return (
    <div className="max-w-lg mx-auto my-16 border rounded-2xl p-8 text-center bg-background">
      <div className="mx-auto h-14 w-14 rounded-2xl bg-muted grid place-items-center mb-4">
        <Icon className="h-7 w-7 text-muted-foreground" />
      </div>
      <h2 className="text-lg font-bold mb-1">
        {ar ? "هذه الميزة غير مفعّلة" : "This feature is not enabled"}
      </h2>
      <p className="text-sm text-muted-foreground mb-4">
        {ar ? `ميزة "${label}" مقفولة حاليًا لهذه الشركة.` : `The "${label}" feature is currently off for this company.`}
      </p>
      <Link
        to="/settings/features"
        className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90"
      >
        {ar ? "إدارة المميزات" : "Manage Features"}
      </Link>
    </div>
  );
}
