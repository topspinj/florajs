import dagre from "@dagrejs/dagre";
import type { FlowchartAST, LayoutResult, LayoutNode, LayoutSubgraph, FloraTheme } from "../types.js";
import { defaultTheme } from "../themes/default.js";

function estimateTextWidth(text: string, fontSize: number): number {
  return text.length * fontSize * 0.62;
}

type Point = { x: number; y: number };

function intersectRect(node: LayoutNode, point: Point): Point {
  const dx = point.x - node.x;
  const dy = point.y - node.y;
  const hw = node.width / 2;
  const hh = node.height / 2;

  if (dx === 0 && dy === 0) return { x: node.x, y: node.y - hh };

  let sx: number, sy: number;
  if (Math.abs(dy) * hw > Math.abs(dx) * hh) {
    sy = dy > 0 ? hh : -hh;
    sx = (sy * dx) / dy;
  } else {
    sx = dx > 0 ? hw : -hw;
    sy = (sx * dy) / dx;
  }
  return { x: node.x + sx, y: node.y + sy };
}

function intersectDiamond(node: LayoutNode, point: Point): Point {
  const cx = node.x, cy = node.y;
  const hw = node.width / 2, hh = node.height / 2;
  const dx = point.x - cx, dy = point.y - cy;

  if (dx === 0 && dy === 0) return { x: cx, y: cy - hh };

  const adx = Math.abs(dx), ady = Math.abs(dy);
  const t = 1 / (adx / hw + ady / hh);
  return { x: cx + dx * t, y: cy + dy * t };
}

function intersectCircle(node: LayoutNode, point: Point): Point {
  const dx = point.x - node.x;
  const dy = point.y - node.y;
  const r = Math.max(node.width, node.height) / 2;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist === 0) return { x: node.x, y: node.y - r };
  return { x: node.x + (dx * r) / dist, y: node.y + (dy * r) / dist };
}

function intersectNode(node: LayoutNode, point: Point): Point {
  switch (node.shape) {
    case "diamond":
      return intersectDiamond(node, point);
    case "circle":
      return intersectCircle(node, point);
    default:
      return intersectRect(node, point);
  }
}

function getDepth(sg: { id: string; parentId?: string }, all: Array<{ id: string; parentId?: string }>): number {
  let depth = 0;
  let current = sg;
  while (current.parentId) {
    depth++;
    const parent = all.find((s) => s.id === current.parentId);
    if (!parent) break;
    current = parent;
  }
  return depth;
}

export function computeLayout(
  ast: FlowchartAST,
  theme: FloraTheme = defaultTheme,
): LayoutResult {
  // Build parent->children map for subgraphs
  const childSubgraphs = new Map<string, string[]>();
  for (const sg of ast.subgraphs) {
    if (sg.parentId) {
      const children = childSubgraphs.get(sg.parentId) ?? [];
      children.push(sg.id);
      childSubgraphs.set(sg.parentId, children);
    }
  }

  // Create dagre graph with compound support
  const g = new dagre.graphlib.Graph({ compound: true });

  g.setGraph({
    rankdir: ast.direction === "LR" || ast.direction === "RL" ? "LR" : "TB",
    nodesep: 60,
    ranksep: 80,
    marginx: 40,
    marginy: 40,
    edgesep: 20,
  });

  g.setDefaultEdgeLabel(() => ({}));

  // Add subgraph "cluster" nodes
  for (const sg of ast.subgraphs) {
    g.setNode(sg.id, { label: sg.label, width: 0, height: 0 });
  }

  // Set subgraph parent relationships
  for (const sg of ast.subgraphs) {
    if (sg.parentId && ast.subgraphs.some((p) => p.id === sg.parentId)) {
      g.setParent(sg.id, sg.parentId);
    }
  }

  // Add nodes
  for (const node of ast.nodes) {
    const textWidth = estimateTextWidth(node.label, theme.fontSize);
    let width = Math.max(textWidth + theme.nodePadding.x * 2, 100);
    let height = theme.fontSize + theme.nodePadding.y * 2 + 12;

    if (node.shape === "diamond") {
      width = Math.max(width * 1.6, 120);
      height = Math.max(height * 1.6, 80);
    } else if (node.shape === "stadium") {
      width = Math.max(width, 120);
    } else if (node.shape === "cylinder") {
      height += 20;
    } else if (node.shape === "queue") {
      width += 24;
    }

    g.setNode(node.id, { label: node.label, width, height });

    // Set parent for compound layout
    const parentSg = ast.subgraphs.find((sg) => sg.nodeIds.includes(node.id));
    if (parentSg) {
      g.setParent(node.id, parentSg.id);
    }
  }

  // Add edges
  for (const edge of ast.edges) {
    if (g.hasNode(edge.from) && g.hasNode(edge.to)) {
      g.setEdge(edge.from, edge.to, {
        label: edge.label ?? "",
        minlen: edge.label ? 2 : 1,
      });
    }
  }

  dagre.layout(g);

  // Extract layout nodes
  const layoutNodes: LayoutNode[] = ast.nodes.map((node) => {
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

  const nodeMap = new Map(layoutNodes.map((n) => [n.id, n]));

  // Extract layout edges
  const layoutEdges = ast.edges
    .filter((edge) => g.hasNode(edge.from) && g.hasNode(edge.to))
    .map((edge) => {
      const dagreEdge = g.edge(edge.from, edge.to);
      const points: Point[] = dagreEdge?.points ?? [];
      const sourceNode = nodeMap.get(edge.from);
      const targetNode = nodeMap.get(edge.to);

      if (points.length >= 2 && sourceNode) {
        points[0] = intersectNode(sourceNode, points[1]!);
      }
      if (points.length >= 2 && targetNode) {
        points[points.length - 1] = intersectNode(targetNode, points[points.length - 2]!);
      }

      return {
        from: edge.from,
        to: edge.to,
        label: edge.label,
        style: edge.style,
        points,
      };
    });

  // Compute subgraph bounding boxes bottom-up (children before parents)
  const sortedForBounds = [...ast.subgraphs].sort((a, b) => {
    return getDepth(b, ast.subgraphs) - getDepth(a, ast.subgraphs);
  });

  const layoutSubgraphMap = new Map<string, LayoutSubgraph>();

  for (const sg of sortedForBounds) {
    const childNodeIds = sg.nodeIds.filter((id) => nodeMap.has(id));
    const childSgIds = (childSubgraphs.get(sg.id) ?? [])
      .filter((cid) => ast.subgraphs.some((s) => s.id === cid));

    const padding = 30;
    const labelHeight = 28;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    for (const nodeId of childNodeIds) {
      const n = nodeMap.get(nodeId)!;
      minX = Math.min(minX, n.x - n.width / 2);
      minY = Math.min(minY, n.y - n.height / 2);
      maxX = Math.max(maxX, n.x + n.width / 2);
      maxY = Math.max(maxY, n.y + n.height / 2);
    }

    // Include nested subgraph bounding boxes (already computed)
    for (const childSgId of childSgIds) {
      const childSg = layoutSubgraphMap.get(childSgId);
      if (childSg) {
        minX = Math.min(minX, childSg.x);
        minY = Math.min(minY, childSg.y);
        maxX = Math.max(maxX, childSg.x + childSg.width);
        maxY = Math.max(maxY, childSg.y + childSg.height);
      }
    }

    if (minX === Infinity) {
      const dagreNode = g.node(sg.id);
      if (dagreNode) {
        minX = dagreNode.x - 50;
        minY = dagreNode.y - 25;
        maxX = dagreNode.x + 50;
        maxY = dagreNode.y + 25;
      } else {
        minX = 0; minY = 0; maxX = 100; maxY = 50;
      }
    }

    const x = minX - padding;
    const y = minY - padding - labelHeight;
    const width = maxX - minX + padding * 2;
    const height = maxY - minY + padding * 2 + labelHeight;

    const layoutSg: LayoutSubgraph = {
      id: sg.id,
      label: sg.label,
      x,
      y,
      width,
      height,
      nodeCount: sg.nodeIds.length,
      parentId: sg.parentId,
    };

    layoutSubgraphMap.set(sg.id, layoutSg);
  }

  const graphInfo = g.graph();

  return {
    nodes: layoutNodes,
    edges: layoutEdges,
    subgraphs: [...layoutSubgraphMap.values()],
    width: graphInfo.width ?? 400,
    height: graphInfo.height ?? 300,
  };
}
