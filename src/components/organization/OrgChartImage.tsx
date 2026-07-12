import { forwardRef } from "react";
import type { Database } from "@/integrations/supabase/types";

type Department = Database["public"]["Tables"]["departments"]["Row"];
type JobTitle = Database["public"]["Tables"]["job_titles"]["Row"];

type Props = {
  departments: Department[];
  jobs: JobTitle[];
  companyName?: string;
  lang: "ar" | "en";
};

function pick(row: { name_ar?: string | null; name_en?: string | null; name: string }, lang: string) {
  if (lang === "ar") return row.name_ar || row.name;
  return row.name_en || row.name;
}

export const OrgChartImage = forwardRef<HTMLDivElement, Props>(function OrgChartImage(
  { departments, jobs, companyName, lang },
  ref,
) {
  const roots = departments.filter((d) => !d.parent_id);
  const ar = lang === "ar";

  return (
    <div
      ref={ref}
      dir={ar ? "rtl" : "ltr"}
      style={{
        padding: 32,
        background: "#ffffff",
        fontFamily: ar
          ? "'Cairo', 'Tajawal', system-ui, sans-serif"
          : "system-ui, -apple-system, 'Segoe UI', sans-serif",
        color: "#0f172a",
        display: "inline-block",
        minWidth: "100%",
      }}
    >
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: 0.2 }}>
          {companyName || (ar ? "الهيكل التنظيمي" : "Organization Chart")}
        </div>
        {companyName && (
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
            {ar ? "الهيكل التنظيمي" : "Organization Chart"}
          </div>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "center", gap: 32, flexWrap: "nowrap" }}>
        {roots.map((r) => (
          <TreeNode key={r.id} dept={r} depts={departments} jobs={jobs} lang={lang} />
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
}: {
  dept: Department;
  depts: Department[];
  jobs: JobTitle[];
  lang: "ar" | "en";
}) {
  const color = dept.color || "#3b6fa0";
  const children = depts.filter((c) => c.parent_id === dept.id);
  const deptJobs = jobs.filter((j) => j.department_id === dept.id);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", position: "relative" }}>
      {/* Card */}
      <div
        style={{
          minWidth: 180,
          maxWidth: 240,
          borderRadius: 12,
          border: `2px solid ${color}`,
          background: "#ffffff",
          boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
          overflow: "hidden",
        }}
      >
        <div style={{ background: color, color: "#fff", padding: "8px 12px", textAlign: "center" }}>
          <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.25 }}>{pick(dept, lang)}</div>
          {dept.code && (
            <div style={{ fontSize: 10, opacity: 0.85, fontFamily: "monospace", marginTop: 2 }}>{dept.code}</div>
          )}
        </div>
        {deptJobs.length > 0 && (
          <div style={{ padding: "8px 10px", display: "flex", flexDirection: "column", gap: 4 }}>
            {deptJobs.map((j) => (
              <div
                key={j.id}
                style={{
                  fontSize: 11,
                  color: "#334155",
                  background: "#f1f5f9",
                  borderRadius: 6,
                  padding: "3px 8px",
                  textAlign: "center",
                }}
              >
                {pick(j, lang)}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Children */}
      {children.length > 0 && (
        <>
          <div style={{ width: 2, height: 24, background: color }} />
          <div
            style={{
              display: "flex",
              gap: 24,
              position: "relative",
              paddingTop: 12,
            }}
          >
            {/* horizontal connector line spanning children */}
            {children.length > 1 && (
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: "10%",
                  right: "10%",
                  height: 2,
                  background: color,
                }}
              />
            )}
            {children.map((c) => (
              <div key={c.id} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{ width: 2, height: 12, background: color, marginTop: -12 }} />
                <TreeNode dept={c} depts={depts} jobs={jobs} lang={lang} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
