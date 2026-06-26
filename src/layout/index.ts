import dagre from "@dagrejs/dagre";
import type { FlowchartAST, FlowchartSubgraph, LayoutResult, LayoutNode, LayoutSubgraph, FloraTheme, NodeShape } from "../types.js";
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

function collectAllSubgraphNodes(
  subgraphId: string,
  subgraphMap: Map<string, FlowchartSubgraph>,
  childSubgraphs: Map<string, string[]>
): Set<string> {
  const result = new Set<string>();
  const sg = subgraphMap.get(subgraphId);
  if (!sg) return result;

  for (const nodeId of sg.nodeIds) {
    result.add(nodeId);
  }
  for (const childId of childSubgraphs.get(subgraphId) ?? []) {
    for (const nodeId of collectAllSubgraphNodes(childId, subgraphMap, childSubgraphs)) {
      result.add(nodeId);
    }
  }
  return result;
}

export function computeLayout(
  ast: FlowchartAST,
  theme: FloraTheme = defaultTheme,
  collapsedSubgraphs: Set<string> = new Set()
): LayoutResult {
  const subgraphMap = new Map(ast.subgraphs.map((sg) => [sg.id, sg]));

  // Build parent->children map for subgraphs
  const childSubgraphs = new Map<string, string[]>();
  for (const sg of ast.subgraphs) {
    if (sg.parentId) {
      const children = childSubgraphs.get(sg.parentId) ?? [];
      children.push(sg.id);
      childSubgraphs.set(sg.parentId, children);
    }
  }

  // Determine which nodes are hidden (inside a collapsed subgraph)
  const hiddenNodes = new Set<string>();
  const collapsedSubgraphNodes = new Map<string, Set<string>>();

  for (const sgId of collapsedSubgraphs) {
    const allNodes = collectAllSubgraphNodes(sgId, subgraphMap, childSubgraphs);
    collapsedSubgraphNodes.set(sgId, allNodes);
    for (const nodeId of allNodes) {
      hiddenNodes.add(nodeId);
    }
  }

  // Build effective node list and summary nodes
  const effectiveNodes = ast.nodes.filter((n) => !hiddenNodes.has(n.id));
  const summaryNodes: Array<{ id: string; label: string; shape: NodeShape; subgraphId: string; nodeCount: number }> = [];

  for (const sgId of collapsedSubgraphs) {
    const sg = subgraphMap.get(sgId);
    if (!sg) continue;
    const allNodes = collapsedSubgraphNodes.get(sgId)!;
    const summaryId = `__collapsed_${sgId}`;
    summaryNodes.push({
      id: summaryId,
      label: `${sg.label} (${allNodes.size})`,
      shape: "rounded",
      subgraphId: sgId,
      nodeCount: allNodes.size,
    });
  }

  // Build effective edges: reroute cross-boundary, drop internal
  const effectiveEdges = [];
  for (const edge of ast.edges) {
    const fromHidden = hiddenNodes.has(edge.from);
    const toHidden = hiddenNodes.has(edge.to);

    if (fromHidden && toHidden) {
      // Find which collapsed subgraphs contain each endpoint
      const fromSg = findCollapsedSubgraph(edge.from, collapsedSubgraphs, collapsedSubgraphNodes);
      const toSg = findCollapsedSubgraph(edge.to, collapsedSubgraphs, collapsedSubgraphNodes);
      if (fromSg === toSg) continue; // internal edge — drop
      // Cross-boundary between two different collapsed subgraphs
      effectiveEdges.push({
        ...edge,
        from: `__collapsed_${fromSg}`,
        to: `__collapsed_${toSg}`,
      });
    } else if (fromHidden) {
      const fromSg = findCollapsedSubgraph(edge.from, collapsedSubgraphs, collapsedSubgraphNodes)!;
      effectiveEdges.push({ ...edge, from: `__collapsed_${fromSg}` });
    } else if (toHidden) {
      const toSg = findCollapsedSubgraph(edge.to, collapsedSubgraphs, collapsedSubgraphNodes)!;
      effectiveEdges.push({ ...edge, to: `__collapsed_${toSg}` });
    } else {
      effectiveEdges.push(edge);
    }
  }

  // Deduplicate rerouted edges (multiple edges may map to the same summary pair)
  const edgeKey = (e: { from: string; to: string }) => `${e.from}→${e.to}`;
  const seenEdges = new Set<string>();
  const dedupedEdges = effectiveEdges.filter((e) => {
    const key = edgeKey(e);
    if (seenEdges.has(key)) return false;
    seenEdges.add(key);
    return true;
  });

  // Determine which subgraphs are expanded (not collapsed and not inside a collapsed parent)
  const expandedSubgraphs = ast.subgraphs.filter(
    (sg) => !collapsedSubgraphs.has(sg.id) && !isInsideCollapsed(sg.id, subgraphMap, collapsedSubgraphs)
  );

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
  for (const sg of expandedSubgraphs) {
    g.setNode(sg.id, { label: sg.label, width: 0, height: 0 });
  }

  // Set subgraph parent relationships
  for (const sg of expandedSubgraphs) {
    if (sg.parentId && expandedSubgraphs.some((p) => p.id === sg.parentId)) {
      g.setParent(sg.id, sg.parentId);
    }
  }

  // Add effective nodes
  for (const node of effectiveNodes) {
    const textWidth = estimateTextWidth(node.label, theme.fontSize);
    let width = Math.max(textWidth + theme.nodePadding.x * 2, 100);
    let height = theme.fontSize + theme.nodePadding.y * 2 + 12;

    if (node.shape === "diamond") {
      width = Math.max(width * 1.6, 120);
      height = Math.max(height * 1.6, 80);
    } else if (node.shape === "stadium") {
      width = Math.max(width, 120);
    } else if (node.shape === "cylinder") {
      height += 20; // extra space for the elliptical caps
    } else if (node.shape === "queue") {
      width += 24; // extra space for the elliptical cap on the right
    }

    g.setNode(node.id, { label: node.label, width, height });

    // Set parent for compound layout
    const parentSg = expandedSubgraphs.find((sg) => sg.nodeIds.includes(node.id));
    if (parentSg) {
      g.setParent(node.id, parentSg.id);
    }
  }

  // Add summary nodes for collapsed subgraphs
  for (const sn of summaryNodes) {
    const textWidth = estimateTextWidth(sn.label, theme.fontSize);
    const width = Math.max(textWidth + theme.nodePadding.x * 2, 140);
    const height = theme.fontSize + theme.nodePadding.y * 2 + 12;
    g.setNode(sn.id, { label: sn.label, width, height });

    // If the collapsed subgraph has a parent that is expanded, set parent
    const sg = subgraphMap.get(sn.subgraphId)!;
    if (sg.parentId && expandedSubgraphs.some((p) => p.id === sg.parentId)) {
      g.setParent(sn.id, sg.parentId);
    }
  }

  // Add edges
  for (const edge of dedupedEdges) {
    if (g.hasNode(edge.from) && g.hasNode(edge.to)) {
      g.setEdge(edge.from, edge.to, {
        label: edge.label ?? "",
        minlen: edge.label ? 2 : 1,
      });
    }
  }

  dagre.layout(g);

  // Extract layout nodes
  const allEffectiveNodeIds = [
    ...effectiveNodes.map((n) => n.id),
    ...summaryNodes.map((sn) => sn.id),
  ];

  const layoutNodes: LayoutNode[] = allEffectiveNodeIds.map((id) => {
    const dagreNode = g.node(id);
    const astNode = effectiveNodes.find((n) => n.id === id);
    const summaryNode = summaryNodes.find((sn) => sn.id === id);

    return {
      id,
      x: dagreNode.x,
      y: dagreNode.y,
      width: dagreNode.width,
      height: dagreNode.height,
      label: astNode?.label ?? summaryNode?.label ?? id,
      shape: astNode?.shape ?? summaryNode?.shape ?? "rect",
      subgraphSummary: summaryNode?.subgraphId,
    };
  });

  const nodeMap = new Map(layoutNodes.map((n) => [n.id, n]));

  // Extract layout edges
  const layoutEdges = dedupedEdges
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

  // Compute subgraph bounding boxes from child node positions
  const layoutSubgraphs: LayoutSubgraph[] = expandedSubgraphs.map((sg) => {
    const childNodeIds = sg.nodeIds.filter((id) => nodeMap.has(id));
    // Also include child subgraph bounding boxes
    const childSgs = (childSubgraphs.get(sg.id) ?? [])
      .filter((cid) => expandedSubgraphs.some((s) => s.id === cid));

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

    // Include summary nodes that belong to child collapsed subgraphs
    for (const sn of summaryNodes) {
      if (sg.nodeIds.includes(sn.subgraphId) || childSgs.includes(sn.subgraphId)) {
        // This subgraph's summary node isn't directly in nodeIds but might be laid out as a child
      }
      const snNode = nodeMap.get(sn.id);
      if (snNode && sg.parentId === undefined) {
        // Check if this summary node's subgraph is a child of this subgraph
        const snSg = subgraphMap.get(sn.subgraphId);
        if (snSg?.parentId === sg.id) {
          minX = Math.min(minX, snNode.x - snNode.width / 2);
          minY = Math.min(minY, snNode.y - snNode.height / 2);
          maxX = Math.max(maxX, snNode.x + snNode.width / 2);
          maxY = Math.max(maxY, snNode.y + snNode.height / 2);
        }
      }
    }

    if (minX === Infinity) {
      // No visible children — use dagre's computed position for the subgraph node
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

    return {
      id: sg.id,
      label: sg.label,
      x,
      y,
      width,
      height,
      collapsed: false,
      nodeCount: sg.nodeIds.length,
      parentId: sg.parentId,
    };
  });

  // Add collapsed subgraphs to the result
  for (const sgId of collapsedSubgraphs) {
    const sg = subgraphMap.get(sgId);
    if (!sg) continue;
    if (isInsideCollapsed(sgId, subgraphMap, collapsedSubgraphs)) continue;

    const summaryNode = nodeMap.get(`__collapsed_${sgId}`);
    const allNodes = collapsedSubgraphNodes.get(sgId)!;

    layoutSubgraphs.push({
      id: sg.id,
      label: sg.label,
      x: summaryNode ? summaryNode.x - summaryNode.width / 2 : 0,
      y: summaryNode ? summaryNode.y - summaryNode.height / 2 : 0,
      width: summaryNode?.width ?? 100,
      height: summaryNode?.height ?? 50,
      collapsed: true,
      nodeCount: allNodes.size,
      parentId: sg.parentId,
    });
  }

  const graphInfo = g.graph();

  return {
    nodes: layoutNodes,
    edges: layoutEdges,
    subgraphs: layoutSubgraphs,
    width: graphInfo.width ?? 400,
    height: graphInfo.height ?? 300,
  };
}

function findCollapsedSubgraph(
  nodeId: string,
  collapsedSubgraphs: Set<string>,
  collapsedSubgraphNodes: Map<string, Set<string>>
): string | undefined {
  for (const [sgId, nodes] of collapsedSubgraphNodes) {
    if (collapsedSubgraphs.has(sgId) && nodes.has(nodeId)) {
      return sgId;
    }
  }
  return undefined;
}

function isInsideCollapsed(
  subgraphId: string,
  subgraphMap: Map<string, FlowchartSubgraph>,
  collapsedSubgraphs: Set<string>
): boolean {
  const sg = subgraphMap.get(subgraphId);
  if (!sg?.parentId) return false;
  if (collapsedSubgraphs.has(sg.parentId)) return true;
  return isInsideCollapsed(sg.parentId, subgraphMap, collapsedSubgraphs);
}
