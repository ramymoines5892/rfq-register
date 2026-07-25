import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { useI18n } from "@/lib/i18n";
import { useAccess } from "@/hooks/useAccess";
import { Landmark, Building2, Users2 } from "lucide-react";

import { ORG_TAB_IDS, ORG_TABS_META, parseOrgTab, type OrgTabId } from "@/modules/organization/tabs";
import { OrganizationStructurePanel } from "@/modules/organization/StructurePanel";
import { EmployeesPanel } from "@/modules/employees/EmployeesPanel";
import { BranchesPanel } from "@/modules/branches/BranchesPanel";

export const Route = createFileRoute("/_authenticated/organization")({
  component: OrganizationHub,
  head: () => ({ meta: [{ title: "الهيكل التنظيمي | Organization Chart" }] }),
  validateSearch: (s: Record<string, unknown>) => ({
    tab: typeof s.tab === "string" ? (s.tab as OrgTabId) : undefined,
  }),
});

const TAB_ICONS = { landmark: Landmark, building2: Building2, users2: Users2 } as const;

export function OrganizationHub() {
  const { lang, dir } = useI18n();
  const ar = lang === "ar";
  const access = useAccess();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  // URL is the source of truth for the active tab so deep links and
  // back/forward navigation restore the correct section.
  const tab: OrgTabId = parseOrgTab(search.tab);
  const setTab = (id: OrgTabId) => {
    navigate({ search: (prev: { tab?: OrgTabId }) => ({ ...prev, tab: id }), replace: false });
  };

  return (
    <div className="min-h-screen bg-muted/20" dir={dir}>
      <header className="sticky top-0 z-10 border-b bg-background">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <Landmark className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-bold">{ar ? "الهيكل التنظيمي" : "Organization"}</h1>
          <span className="text-xs text-muted-foreground">
            {ar ? "الفروع، الأقسام، والموظفون" : "Branches, departments & employees"}
          </span>
        </div>
        <nav
          data-testid="org-tabs"
          className="max-w-7xl mx-auto px-4 pb-2 flex flex-wrap gap-1"
        >
          {ORG_TAB_IDS.map((id) => {
            const meta = ORG_TABS_META[id];
            const Icon = TAB_ICONS[meta.iconKey];
            return (
              <button
                key={id}
                data-testid={`org-tab-${id}`}
                onClick={() => setTab(id)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors flex items-center gap-1.5 ${
                  tab === id
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background hover:bg-muted border-border"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {ar ? meta.ar : meta.en}
              </button>
            );
          })}
        </nav>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {tab === "branches" && <BranchesPanel canManage={access.isAdmin} />}
        {tab === "structure" && <OrganizationStructurePanel />}
        {tab === "employees" && <EmployeesPanel />}
      </main>
    </div>
  );
}
