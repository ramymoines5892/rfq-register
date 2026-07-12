import { useCallback, useEffect, useMemo } from "react";
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
import { Building2, Briefcase, Users } from "lucide-react";

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
      className={`group relative rounded-lg bg-card shadow-sm border-2 transition-all hover:shadow-md hover:-translate-y-0.5 ${
        selected ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""
      }`}
      style={{ borderColor: color, width: 140 }}
    >
      <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-muted-foreground/40 !border-0" />
      <div className="px-2 py-1.5 flex items-center gap-1.5 rounded-md" style={{ backgroundColor: `${color}15` }}>
        <Icon className="h-3.5 w-3.5 shrink-0" style={{ color }} />
        <div className="text-xs font-semibold truncate flex-1">{d.label}</div>
      </div>

      {/* Hover details popover */}
      <div
        className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-150 w-56 rounded-lg border bg-popover text-popover-foreground shadow-lg"
        style={{ borderColor: color }}
      >
        <div className="px-3 py-2 border-b flex items-center gap-2" style={{ backgroundColor: `${color}15` }}>
          <Icon className="h-4 w-4 shrink-0" style={{ color }} />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold truncate">{d.label}</div>
            {d.code && <div className="text-[10px] font-mono uppercase text-muted-foreground truncate">{d.code}</div>}
          </div>
        </div>
        {d.kind === "department" && (
          <div className="px-3 py-2 flex items-center gap-3 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{d.childCount ?? 0}</span>
            <span className="flex items-center gap-1"><Briefcase className="h-3 w-3" />{d.jobCount ?? 0}</span>
            <span className="flex items-center gap-1"><Users className="h-3 w-3" />{d.memberCount ?? 0}</span>
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !bg-muted-foreground/40 !border-0" />
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
          style: { stroke: d.color || "#94a3b8", strokeWidth: 2 },
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
        style: { stroke: dept?.color || "#94a3b8", strokeWidth: 1.5, strokeDasharray: "4 4" },
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

  const styledNodes = useMemo(
    () => nodes.map((n) => ({ ...n, selected: selectedId ? n.id.endsWith(`:${selectedId}`) : false })),
    [nodes, selectedId]
  );

  return (
    <div className="h-[600px] w-full rounded-xl border bg-muted/10 overflow-hidden">
      <ReactFlow
        nodes={styledNodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.2}
        maxZoom={1.6}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={20} size={1} />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable className="!bg-background !border" />
      </ReactFlow>
    </div>
  );
}
