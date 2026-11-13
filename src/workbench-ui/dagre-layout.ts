import dagre from "@dagrejs/dagre";
import type { DiagramGraph, DiagramNode } from "@/core/contracts/document-ast";

export interface LayoutedDiagramNode extends DiagramNode {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LayoutedDiagramEdge {
  from: string;
  to: string;
  label?: string;
  pathD: string;
  labelX: number;
  labelY: number;
}

export interface ComputedDiagramLayout {
  width: number;
  height: number;
  nodes: LayoutedDiagramNode[];
  edges: LayoutedDiagramEdge[];
}

const NODE_WIDTH = 186;
const NODE_HEIGHT = 64;

function buildSmoothSvgPath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  if (points.length === 2) {
    return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)} L ${points[1].x.toFixed(1)} ${points[1].y.toFixed(1)}`;
  }

  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 1; i < points.length - 1; i += 1) {
    const curr = points[i];
    const next = points[i + 1];
    const midX = ((curr.x + next.x) / 2).toFixed(1);
    const midY = ((curr.y + next.y) / 2).toFixed(1);
    d += ` Q ${curr.x.toFixed(1)} ${curr.y.toFixed(1)}, ${midX} ${midY}`;
  }
  const last = points[points.length - 1];
  d += ` L ${last.x.toFixed(1)} ${last.y.toFixed(1)}`;
  return d;
}

export function computeDiagramLayout(diagram: DiagramGraph): ComputedDiagramLayout {
  const g = new dagre.graphlib.Graph();
  const rankdir = diagram.rankdir ?? "LR";
  g.setGraph({
    rankdir,
    nodesep: 28,
    ranksep: rankdir === "LR" ? 54 : 44,
    marginx: 24,
    marginy: 22,
  });
  g.setDefaultEdgeLabel(() => ({}));

  const nodeMap = new Map<string, DiagramNode>();
  for (const node of diagram.nodes) {
    nodeMap.set(node.id, node);
    g.setNode(node.id, {
      label: node.label,
      width: NODE_WIDTH,
      height: node.subLabel ? NODE_HEIGHT : 52,
    });
  }

  for (const edge of diagram.edges) {
    if (nodeMap.has(edge.from) && nodeMap.has(edge.to)) {
      g.setEdge(edge.from, edge.to, { label: edge.label ?? "" });
    }
  }

  dagre.layout(g);

  const layoutedNodes: LayoutedDiagramNode[] = diagram.nodes.map((node) => {
    const positioned = g.node(node.id);
    const width = positioned?.width ?? NODE_WIDTH;
    const height = positioned?.height ?? NODE_HEIGHT;
    return {
      ...node,
      x: (positioned?.x ?? width / 2) - width / 2,
      y: (positioned?.y ?? height / 2) - height / 2,
      width,
      height,
    };
  });

  const layoutedEdges: LayoutedDiagramEdge[] = diagram.edges
    .filter((edge) => nodeMap.has(edge.from) && nodeMap.has(edge.to))
    .map((edge) => {
      const positionedEdge = g.edge(edge.from, edge.to);
      const pts = positionedEdge?.points ?? [];
      const midIdx = Math.floor(pts.length / 2);
      const labelAnchor = pts[midIdx] ?? { x: 0, y: 0 };
      return {
        from: edge.from,
        to: edge.to,
        label: edge.label,
        pathD: buildSmoothSvgPath(pts),
        labelX: labelAnchor.x,
        labelY: labelAnchor.y - 8,
      };
    });

  const graphMeta = g.graph();
  const width = Math.max(320, Math.ceil((graphMeta?.width ?? 640) + 12));
  const height = Math.max(150, Math.ceil((graphMeta?.height ?? 200) + 12));

  return {
    width,
    height,
    nodes: layoutedNodes,
    edges: layoutedEdges,
  };
}
