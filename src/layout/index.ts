import dagre from "@dagrejs/dagre";
import type { FlowchartAST, LayoutResult, FloraTheme } from "../types.js";
import { defaultTheme } from "../themes/default.js";

function estimateTextWidth(text: string, fontSize: number): number {
  return text.length * fontSize * 0.6;
}

export function computeLayout(
  ast: FlowchartAST,
  theme: FloraTheme = defaultTheme
): LayoutResult {
  const g = new dagre.graphlib.Graph();

  g.setGraph({
    rankdir: ast.direction === "LR" || ast.direction === "RL" ? "LR" : "TB",
    nodesep: 50,
    ranksep: 60,
    marginx: 20,
    marginy: 20,
  });

  g.setDefaultEdgeLabel(() => ({}));

  for (const node of ast.nodes) {
    const textWidth = estimateTextWidth(node.label, theme.fontSize);
    const width = Math.max(textWidth + theme.nodePadding.x * 2, 80);
    const height = theme.fontSize + theme.nodePadding.y * 2 + 8;
    g.setNode(node.id, { label: node.label, width, height });
  }

  for (const edge of ast.edges) {
    g.setEdge(edge.from, edge.to, { label: edge.label ?? "" });
  }

  dagre.layout(g);

  const layoutNodes = ast.nodes.map((node) => {
    const dagreNode = g.node(node.id);
    return {
      id: node.id,
      x: dagreNode.x,
      y: dagreNode.y,
      width: dagreNode.width,
      height: dagreNode.height,
      label: node.label,
      shape: node.shape,
    };
  });

  const layoutEdges = ast.edges.map((edge) => {
    const dagreEdge = g.edge(edge.from, edge.to);
    return {
      from: edge.from,
      to: edge.to,
      label: edge.label,
      style: edge.style,
      points: dagreEdge.points ?? [],
    };
  });

  const graphInfo = g.graph();

  return {
    nodes: layoutNodes,
    edges: layoutEdges,
    width: graphInfo.width ?? 400,
    height: graphInfo.height ?? 300,
  };
}
