import { forwardRef } from "react";
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
        background: "#ffffff",
        fontFamily: ar
          ? "'Cairo', 'Tajawal', system-ui, sans-serif"
          : "system-ui, -apple-system, 'Segoe UI', sans-serif",
        color: "#0f172a",
        width: "100%",
      }}
    >
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div style={{ fontSize: 22, fontWeight: 800 }}>
          {companyName || (ar ? "الهيكل التنظيمي" : "Organization Chart")}
        </div>
        {companyName && (
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
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
  memberCounts,
  lang,
  depth,
}: {
  dept: Department;
  depts: Department[];
  jobs: JobTitle[];
  memberCounts: Record<string, number>;
  lang: "ar" | "en";
  depth: number;
}) {
  const ar = lang === "ar";
  const color = dept.color || "#3b6fa0";
  const children = depts
    .filter((c) => c.parent_id === dept.id)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const deptJobs = jobs.filter((j) => j.department_id === dept.id);
  const members = memberCounts[dept.id] || 0;

  const size = depth === 0 ? 72 : depth === 1 ? 56 : 44;
  const iconSize = depth === 0 ? 30 : depth === 1 ? 22 : 18;
  const nameSize = depth === 0 ? 13 : depth === 1 ? 12 : 11;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", position: "relative" }}>
      {/* Node card */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 80, flex: "1 1 0", maxWidth: 180 }}>
        <div
          style={{
            width: size,
            height: size,
            borderRadius: "50%",
            border: `2px solid ${color}`,
            background: `${color}14`,
            color,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: iconSize,
            fontWeight: 800,
            boxShadow: "0 1px 2px rgba(15,23,42,0.06)",
          }}
        >
          {(pick(dept, lang) || "?").trim().charAt(0)}
        </div>
        <div
          style={{
            fontSize: nameSize,
            fontWeight: 700,
            textAlign: "center",
            maxWidth: 120,
            lineHeight: 1.2,
          }}
        >
          {pick(dept, lang)}
        </div>
        {(dept.code || deptJobs.length > 0 || members > 0) && (
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "center" }}>
            {dept.code && (
              <span
                style={{
                  fontSize: 9,
                  fontFamily: "monospace",
                  color: "#64748b",
                  background: "#f1f5f9",
                  padding: "1px 6px",
                  borderRadius: 4,
                }}
              >
                {dept.code}
              </span>
            )}
            {deptJobs.length > 0 && (
              <span
                style={{
                  fontSize: 9,
                  color,
                  background: `${color}14`,
                  padding: "1px 6px",
                  borderRadius: 999,
                }}
              >
                {deptJobs.length} {ar ? "مسمى" : "jobs"}
              </span>
            )}
            {members > 0 && (
              <span
                style={{
                  fontSize: 9,
                  color: "#334155",
                  background: "#e2e8f0",
                  padding: "1px 6px",
                  borderRadius: 999,
                }}
              >
                {members} {ar ? "موظف" : "members"}
              </span>
            )}
          </div>
        )}
        {deptJobs.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 3, maxWidth: 140, marginTop: 2 }}>
            {deptJobs.slice(0, 3).map((j) => (
              <span
                key={j.id}
                style={{
                  fontSize: 9,
                  color: "#475569",
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  padding: "1px 5px",
                  borderRadius: 999,
                }}
              >
                {pick(j, lang)}
              </span>
            ))}
            {deptJobs.length > 3 && (
              <span style={{ fontSize: 9, color: "#94a3b8" }}>+{deptJobs.length - 3}</span>
            )}
          </div>
        )}
      </div>

      {/* Children with connector lines */}
      {children.length > 0 && (
        <div style={{ position: "relative", paddingTop: 24, marginTop: 12 }}>
          {/* Vertical trunk from parent */}
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: 0,
              width: 1,
              height: 24,
              background: "#cbd5e1",
              transform: "translateX(-50%)",
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
                  {/* Horizontal bus */}
                  {!only && (
                    <div
                      style={{
                        position: "absolute",
                        top: 0,
                        insetInlineStart: isFirst ? "50%" : 0,
                        insetInlineEnd: isLast ? "50%" : 0,
                        height: 1,
                        background: "#cbd5e1",
                      }}
                    />
                  )}
                  {/* Vertical drop to child */}
                  <div
                    style={{
                      position: "absolute",
                      left: "50%",
                      top: 0,
                      width: 1,
                      height: 24,
                      background: "#cbd5e1",
                      transform: "translateX(-50%)",
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
