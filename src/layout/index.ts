import dagre from "@dagrejs/dagre";
import type { FlowchartAST, LayoutResult, FloraTheme } from "../types.js";
import { defaultTheme } from "../themes/default.js";

function estimateTextWidth(text: string, fontSize: number): number {
  return text.length * fontSize * 0.62;
}

export function computeLayout(
  ast: FlowchartAST,
  theme: FloraTheme = defaultTheme
): LayoutResult {
  const g = new dagre.graphlib.Graph();

  g.setGraph({
    rankdir: ast.direction === "LR" || ast.direction === "RL" ? "LR" : "TB",
    nodesep: 60,
    ranksep: 80,
    marginx: 40,
    marginy: 40,
    edgesep: 20,
  });

  g.setDefaultEdgeLabel(() => ({}));

  for (const node of ast.nodes) {
    const textWidth = estimateTextWidth(node.label, theme.fontSize);
    let width = Math.max(textWidth + theme.nodePadding.x * 2, 100);
    let height = theme.fontSize + theme.nodePadding.y * 2 + 12;

    if (node.shape === "diamond") {
      width = Math.max(width * 1.6, 120);
      height = Math.max(height * 1.6, 80);
    } else if (node.shape === "stadium") {
      width = Math.max(width, 120);
    }

    g.setNode(node.id, { label: node.label, width, height });
  }

  for (const edge of ast.edges) {
    g.setEdge(edge.from, edge.to, {
      label: edge.label ?? "",
      minlen: edge.label ? 2 : 1,
    });
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
