import { forwardRef } from "react";
import { getDeptIcon } from "@/lib/deptIcons";
import type { Database } from "@/integrations/supabase/types";

type Department = Database["public"]["Tables"]["departments"]["Row"];
type JobTitle = Database["public"]["Tables"]["job_titles"]["Row"];

type Props = {
  departments: Department[];
  jobs: JobTitle[];
  memberCounts?: Record<string, number>;
  companyName?: string;
  lang: "ar" | "en";
};

function pick(row: { name_ar?: string | null; name_en?: string | null; name: string }, lang: string) {
  if (lang === "ar") return row.name_ar || row.name;
  return row.name_en || row.name;
}


export const OrgChartImage = forwardRef<HTMLDivElement, Props>(function OrgChartImage(
  { departments, jobs, memberCounts = {}, companyName, lang },
  ref,
) {
  const ar = lang === "ar";
  const roots = departments
    .filter((d) => !d.parent_id)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

  return (
    <div
      ref={ref}
      dir={ar ? "rtl" : "ltr"}
      style={{
        padding: "clamp(16px, 3vw, 32px)",
        background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
        fontFamily: ar
          ? "'Cairo', 'Tajawal', system-ui, sans-serif"
          : "system-ui, -apple-system, 'Segoe UI', sans-serif",
        color: "#0f172a",
        width: "100%",
        borderRadius: 12,
      }}
    >
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: ar ? 0 : "-0.01em" }}>
          {companyName || (ar ? "الهيكل التنظيمي" : "Organization Chart")}
        </div>
        {companyName && (
          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2, letterSpacing: "0.05em", textTransform: "uppercase" }}>
            {ar ? "الهيكل التنظيمي" : "Organization Chart"}
          </div>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
        {roots.map((r) => (
          <TreeNode
            key={r.id}
            dept={r}
            depts={departments}
            jobs={jobs}
            memberCounts={memberCounts}
            lang={lang}
            depth={0}
          />
        ))}
      </div>
    </div>
  );
});

function TreeNode({
  dept,
  depts,
  jobs,
  lang,
  depth,
  memberCounts,
}: {
  dept: Department;
  depts: Department[];
  jobs: JobTitle[];
  memberCounts: Record<string, number>;
  lang: "ar" | "en";
  depth: number;
}) {
  const color = dept.color || "#3b6fa0";
  const children = depts
    .filter((c) => c.parent_id === dept.id)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const deptJobs = jobs.filter((j) => j.department_id === dept.id);
  const primaryJob = deptJobs[0];

  const size = depth === 0 ? 72 : depth === 1 ? 60 : 48;
  const iconSize = depth === 0 ? 32 : depth === 1 ? 26 : 20;
  const nameSize = depth === 0 ? 13 : depth === 1 ? 12 : 11;
  const Icon = iconFor(depth);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", position: "relative", flex: "1 1 0", minWidth: 0 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 0, maxWidth: 180 }}>
        <div
          style={{
            width: size,
            height: size,
            borderRadius: "50%",
            background: `linear-gradient(135deg, ${color} 0%, ${color}cc 100%)`,
            color: "#ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: `0 6px 16px -6px ${color}80, 0 2px 4px rgba(15,23,42,0.06), inset 0 -2px 4px rgba(0,0,0,0.08)`,
            border: "3px solid #ffffff",
          }}
        >
          <Icon size={iconSize} strokeWidth={2.25} />
        </div>
        <div
          style={{
            fontSize: nameSize,
            fontWeight: 700,
            textAlign: "center",
            maxWidth: 140,
            lineHeight: 1.25,
            color: "#0f172a",
          }}
        >
          {pick(dept, lang)}
        </div>
        {dept.code && (
          <span
            style={{
              fontSize: 9,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              color,
              background: `${color}12`,
              border: `1px solid ${color}33`,
              padding: "1px 8px",
              borderRadius: 999,
              letterSpacing: "0.05em",
            }}
          >
            {dept.code}
          </span>
        )}
        {primaryJob && (
          <div
            style={{
              fontSize: 10,
              color: "#64748b",
              textAlign: "center",
              maxWidth: 140,
              lineHeight: 1.3,
              fontStyle: "italic",
            }}
          >
            {pick(primaryJob, lang)}
          </div>
        )}
      </div>

      {children.length > 0 && (
        <div style={{ position: "relative", paddingTop: 24, marginTop: 12, width: "100%" }}>
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: 0,
              width: 2,
              height: 24,
              background: "linear-gradient(180deg, #cbd5e1, #e2e8f0)",
              transform: "translateX(-50%)",
              borderRadius: 2,
            }}
          />
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "center", gap: 8 }}>
            {children.map((c, i) => {
              const isFirst = i === 0;
              const isLast = i === children.length - 1;
              const only = children.length === 1;
              return (
                <div
                  key={c.id}
                  style={{
                    position: "relative",
                    paddingTop: 24,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    flex: "1 1 0",
                    minWidth: 0,
                  }}
                >
                  {!only && (
                    <div
                      style={{
                        position: "absolute",
                        top: 0,
                        insetInlineStart: isFirst ? "50%" : 0,
                        insetInlineEnd: isLast ? "50%" : 0,
                        height: 2,
                        background: "#e2e8f0",
                        borderRadius: 2,
                      }}
                    />
                  )}
                  <div
                    style={{
                      position: "absolute",
                      left: "50%",
                      top: 0,
                      width: 2,
                      height: 24,
                      background: "#e2e8f0",
                      transform: "translateX(-50%)",
                      borderRadius: 2,
                    }}
                  />
                  <TreeNode
                    dept={c}
                    depts={depts}
                    jobs={jobs}
                    memberCounts={memberCounts}
                    lang={lang}
                    depth={depth + 1}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
