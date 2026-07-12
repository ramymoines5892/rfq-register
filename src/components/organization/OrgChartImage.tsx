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
  const ar = lang === "ar";
  const roots = departments.filter((d) => !d.parent_id);

  return (
    <div
      ref={ref}
      dir={ar ? "rtl" : "ltr"}
      style={{
        padding: 24,
        background: "#ffffff",
        fontFamily: ar
          ? "'Cairo', 'Tajawal', system-ui, sans-serif"
          : "system-ui, -apple-system, 'Segoe UI', sans-serif",
        color: "#0f172a",
        minWidth: 520,
      }}
    >
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <div style={{ fontSize: 20, fontWeight: 800 }}>
          {companyName || (ar ? "الهيكل التنظيمي" : "Organization Chart")}
        </div>
        {companyName && (
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
            {ar ? "الهيكل التنظيمي" : "Organization Chart"}
          </div>
        )}
      </div>

      <div
        style={{
          border: "1px solid #e2e8f0",
          borderRadius: 12,
          overflow: "hidden",
          background: "#ffffff",
        }}
      >
        {roots.map((r, i) => (
          <TreeRow
            key={r.id}
            dept={r}
            depts={departments}
            jobs={jobs}
            lang={lang}
            depth={0}
            isLast={i === roots.length - 1}
          />
        ))}
      </div>
    </div>
  );
});

function TreeRow({
  dept,
  depts,
  jobs,
  lang,
  depth,
  isLast,
}: {
  dept: Department;
  depts: Department[];
  jobs: JobTitle[];
  lang: "ar" | "en";
  depth: number;
  isLast: boolean;
}) {
  const ar = lang === "ar";
  const color = dept.color || "#3b6fa0";
  const children = depts.filter((c) => c.parent_id === dept.id);
  const deptJobs = jobs.filter((j) => j.department_id === dept.id);
  const indent = depth * 20;

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "10px 14px",
          [ar ? "paddingRight" : "paddingLeft"]: 14 + indent,
          borderBottom: isLast && children.length === 0 && deptJobs.length === 0 ? "none" : "1px solid #f1f5f9",
          background: depth === 0 ? "#f8fafc" : "#ffffff",
        }}
      >
        {/* Color dot */}
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: 999,
            background: color,
            flexShrink: 0,
          }}
        />
        {/* Icon square */}
        <div
          style={{
            width: 26,
            height: 26,
            borderRadius: 6,
            background: `${color}18`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color,
            fontSize: 13,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {(pick(dept, lang) || "?").trim().charAt(0)}
        </div>
        {/* Name */}
        <div
          style={{
            flex: 1,
            fontSize: 13,
            fontWeight: depth === 0 ? 700 : 600,
            color: "#0f172a",
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {pick(dept, lang)}
        </div>
        {/* Meta */}
        {dept.code && (
          <div
            style={{
              fontSize: 11,
              color: "#64748b",
              fontFamily: "monospace",
              flexShrink: 0,
            }}
          >
            {dept.code}
          </div>
        )}
        {deptJobs.length > 0 && (
          <div
            style={{
              fontSize: 10,
              color,
              background: `${color}12`,
              padding: "2px 8px",
              borderRadius: 999,
              flexShrink: 0,
            }}
          >
            {deptJobs.length} {ar ? "مسمى" : "jobs"}
          </div>
        )}
      </div>

      {/* Jobs listed under department */}
      {deptJobs.map((j) => (
        <div
          key={j.id}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "6px 14px",
            [ar ? "paddingRight" : "paddingLeft"]: 14 + indent + 34,
            borderBottom: "1px solid #f8fafc",
            background: "#ffffff",
          }}
        >
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: 999,
              background: "#cbd5e1",
              flexShrink: 0,
            }}
          />
          <div style={{ fontSize: 12, color: "#334155", flex: 1 }}>{pick(j, lang)}</div>
          {j.code && (
            <div style={{ fontSize: 10, color: "#94a3b8", fontFamily: "monospace" }}>{j.code}</div>
          )}
        </div>
      ))}

      {/* Nested children */}
      {children.map((c, i) => (
        <TreeRow
          key={c.id}
          dept={c}
          depts={depts}
          jobs={jobs}
          lang={lang}
          depth={depth + 1}
          isLast={isLast && i === children.length - 1}
        />
      ))}
    </div>
  );
}
