import dagre from "dagre";
import { Position, type Node, type Edge } from "@xyflow/react";

const NODE_W = 96;
const NODE_H = 32;

export function layoutTree(nodes: Node[], edges: Edge[], direction: "TB" | "LR" = "TB"): Node[] {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: direction, nodesep: 16, ranksep: 34, marginx: 16, marginy: 16 });


  nodes.forEach((n) => g.setNode(n.id, { width: NODE_W, height: NODE_H }));
  edges.forEach((e) => g.setEdge(e.source, e.target));

  dagre.layout(g);

  return nodes.map((n) => {
    const p = g.node(n.id);
    return {
      ...n,
      position: { x: p.x - NODE_W / 2, y: p.y - NODE_H / 2 },
      targetPosition: direction === "TB" ? Position.Top : Position.Left,
      sourcePosition: direction === "TB" ? Position.Bottom : Position.Right,
    };
  });
}

