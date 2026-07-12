import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { layoutTree } from "./orgLayout";
import { Building2, Briefcase, Users, Hash } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export type OrgNodeData = {
  label: string;
  code?: string | null;
  color?: string | null;
  kind: "department" | "job_title";
  childCount?: number;
  jobCount?: number;
  memberCount?: number;
  selected?: boolean;
};

function DeptNode({ data, selected }: NodeProps) {
  const d = data as unknown as OrgNodeData;
  const color = d.color || "#3b6fa0";
  const Icon = d.kind === "department" ? Building2 : Briefcase;
  return (
    <div
      className={`group relative rounded-md bg-card shadow-sm border transition-all hover:shadow-md hover:z-10 ${
        selected ? "ring-2 ring-primary ring-offset-1 ring-offset-background" : ""
      }`}
      style={{ borderColor: color, borderLeftWidth: 3, width: 96, height: 32 }}
      title={d.label}
    >
      <Handle type="target" position={Position.Top} className="!w-1.5 !h-1.5 !bg-muted-foreground/40 !border-0" />
      <div className="h-full px-1.5 flex items-center gap-1 rounded-md" style={{ backgroundColor: `${color}12` }}>
        <Icon className="h-3 w-3 shrink-0" style={{ color }} />
        <div className="text-[10px] font-medium truncate flex-1 leading-tight">{d.label}</div>
      </div>

      {/* Hover details popover */}
      <div
        className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-1.5 z-30 opacity-0 group-hover:opacity-100 transition-opacity duration-150 w-52 rounded-lg border bg-popover text-popover-foreground shadow-lg"
        style={{ borderColor: color }}
      >
        <div className="px-2.5 py-1.5 border-b flex items-center gap-2" style={{ backgroundColor: `${color}15` }}>
          <Icon className="h-3.5 w-3.5 shrink-0" style={{ color }} />
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold truncate">{d.label}</div>
            {d.code && <div className="text-[9px] font-mono uppercase text-muted-foreground truncate">{d.code}</div>}
          </div>
        </div>
        {d.kind === "department" && (
          <div className="px-2.5 py-1.5 flex items-center gap-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{d.childCount ?? 0}</span>
            <span className="flex items-center gap-1"><Briefcase className="h-3 w-3" />{d.jobCount ?? 0}</span>
            <span className="flex items-center gap-1"><Users className="h-3 w-3" />{d.memberCount ?? 0}</span>
          </div>
        )}
        <div className="px-2.5 py-1 text-[9px] text-muted-foreground/70 border-t bg-muted/30 rounded-b-lg">
          Double-click for details
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!w-1.5 !h-1.5 !bg-muted-foreground/40 !border-0" />
    </div>
  );
}


const nodeTypes = { org: DeptNode };

export type OrgChartInput = {
  departments: Array<{ id: string; name: string; code?: string | null; color?: string | null; parent_id?: string | null; }>;
  jobTitles?: Array<{ id: string; name: string; code?: string | null; department_id?: string | null; }>;
  memberCounts?: Record<string, number>;
  selectedId?: string | null;
  onSelect?: (id: string, kind: "department" | "job_title") => void;
};

export function OrgChart({ departments, jobTitles = [], memberCounts = {}, selectedId, onSelect }: OrgChartInput) {
  const [detail, setDetail] = useState<{ id: string; kind: "department" | "job_title" } | null>(null);

  const built = useMemo(() => {
    const childCount: Record<string, number> = {};
    const jobCount: Record<string, number> = {};
    departments.forEach((d) => { if (d.parent_id) childCount[d.parent_id] = (childCount[d.parent_id] || 0) + 1; });
    jobTitles.forEach((j) => { if (j.department_id) jobCount[j.department_id] = (jobCount[j.department_id] || 0) + 1; });

    const nodes: Node[] = [];
    const edges: Edge[] = [];

    departments.forEach((d) => {
      nodes.push({
        id: `d:${d.id}`,
        type: "org",
        position: { x: 0, y: 0 },
        data: {
          label: d.name,
          code: d.code,
          color: d.color,
          kind: "department" as const,
          childCount: childCount[d.id] || 0,
          jobCount: jobCount[d.id] || 0,
          memberCount: memberCounts[d.id] || 0,
        } as OrgNodeData as unknown as Record<string, unknown>,
      });
      if (d.parent_id) {
        edges.push({
          id: `e:${d.parent_id}->${d.id}`,
          source: `d:${d.parent_id}`,
          target: `d:${d.id}`,
          type: "smoothstep",
          style: { stroke: d.color || "#94a3b8", strokeWidth: 1.5 },
        });
      }
    });

    jobTitles.forEach((j) => {
      if (!j.department_id) return;
      const dept = departments.find((x) => x.id === j.department_id);
      nodes.push({
        id: `j:${j.id}`,
        type: "org",
        position: { x: 0, y: 0 },
        data: {
          label: j.name,
          code: j.code,
          color: dept?.color,
          kind: "job_title" as const,
        } as OrgNodeData as unknown as Record<string, unknown>,
      });
      edges.push({
        id: `ej:${j.department_id}->${j.id}`,
        source: `d:${j.department_id}`,
        target: `j:${j.id}`,
        type: "smoothstep",
        style: { stroke: dept?.color || "#94a3b8", strokeWidth: 1, strokeDasharray: "3 3" },
      });
    });

    return { nodes: layoutTree(nodes, edges, "TB"), edges };
  }, [departments, jobTitles, memberCounts]);

  const [nodes, setNodes, onNodesChange] = useNodesState(built.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(built.edges);

  useEffect(() => {
    setNodes(built.nodes);
    setEdges(built.edges);
  }, [built, setNodes, setEdges]);

  const handleNodeClick = useCallback(
    (_: unknown, node: Node) => {
      const [prefix, id] = node.id.split(":");
      if (onSelect) onSelect(id, prefix === "d" ? "department" : "job_title");
    },
    [onSelect]
  );

  const handleNodeDoubleClick = useCallback((_: unknown, node: Node) => {
    const [prefix, id] = node.id.split(":");
    setDetail({ id, kind: prefix === "d" ? "department" : "job_title" });
  }, []);

  const styledNodes = useMemo(
    () => nodes.map((n) => ({ ...n, selected: selectedId ? n.id.endsWith(`:${selectedId}`) : false })),
    [nodes, selectedId]
  );

  const detailData = useMemo(() => {
    if (!detail) return null;
    if (detail.kind === "department") {
      const dept = departments.find((x) => x.id === detail.id);
      if (!dept) return null;
      const children = departments.filter((x) => x.parent_id === detail.id);
      const deptJobs = jobTitles.filter((x) => x.department_id === detail.id);
      return { kind: "department" as const, dept, children, deptJobs };
    }
    const job = jobTitles.find((x) => x.id === detail.id);
    if (!job) return null;
    const dept = departments.find((x) => x.id === job.department_id);
    return { kind: "job_title" as const, job, dept };
  }, [detail, departments, jobTitles]);

  return (
    <>
      <div className="h-[600px] w-full rounded-xl border bg-muted/10 overflow-hidden">
        <ReactFlow
          nodes={styledNodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={handleNodeClick}
          onNodeDoubleClick={handleNodeDoubleClick}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.2}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={20} size={1} />
          <Controls showInteractive={false} />
          <MiniMap pannable zoomable className="!bg-background !border" />
        </ReactFlow>
      </div>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-md">
          {detailData?.kind === "department" && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" style={{ color: detailData.dept.color || undefined }} />
                  {detailData.dept.name}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                {detailData.dept.code && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Hash className="h-3.5 w-3.5" />
                    <span className="font-mono">{detailData.dept.code}</span>
                  </div>
                )}
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-md border p-2 text-center">
                    <div className="text-xs text-muted-foreground">Sub-depts</div>
                    <div className="text-lg font-bold">{detailData.children.length}</div>
                  </div>
                  <div className="rounded-md border p-2 text-center">
                    <div className="text-xs text-muted-foreground">Jobs</div>
                    <div className="text-lg font-bold">{detailData.deptJobs.length}</div>
                  </div>
                  <div className="rounded-md border p-2 text-center">
                    <div className="text-xs text-muted-foreground">Members</div>
                    <div className="text-lg font-bold">{memberCounts[detailData.dept.id] || 0}</div>
                  </div>
                </div>
                {detailData.deptJobs.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground mb-1">Job titles</div>
                    <div className="flex flex-wrap gap-1">
                      {detailData.deptJobs.map((j) => (
                        <span key={j.id} className="text-xs px-2 py-0.5 rounded-full border bg-muted/40">
                          {j.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {detailData.children.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground mb-1">Sub-departments</div>
                    <div className="flex flex-wrap gap-1">
                      {detailData.children.map((c) => (
                        <span key={c.id} className="text-xs px-2 py-0.5 rounded-full border" style={{ borderColor: c.color || undefined }}>
                          {c.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
          {detailData?.kind === "job_title" && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Briefcase className="h-5 w-5" style={{ color: detailData.dept?.color || undefined }} />
                  {detailData.job.name}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-2 text-sm">
                {detailData.job.code && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Hash className="h-3.5 w-3.5" />
                    <span className="font-mono">{detailData.job.code}</span>
                  </div>
                )}
                {detailData.dept && (
                  <div className="flex items-center gap-2">
                    <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{detailData.dept.name}</span>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
