import type { LayoutResult, LayoutNode, LayoutEdge, LayoutSubgraph, FloraTheme, FloraOptions, NodeColorSet } from "../types.js";
import { resolveTheme } from "../themes/index.js";
import { buildAdjacencyList, getUpstream, getDownstream } from "./highlight.js";

function el(tag: string, attrs: Record<string, string | number>): SVGElement {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [key, value] of Object.entries(attrs)) {
    node.setAttribute(key, String(value));
  }
  return node;
}

function colorsForShape(shape: string, theme: FloraTheme): NodeColorSet {
  if (shape === "diamond") return theme.shapeColors.diamond;
  if (shape === "stadium") return theme.shapeColors.stadium;
  if (shape === "rounded") return theme.shapeColors.rounded;
  if (shape === "cylinder") return theme.shapeColors.cylinder;
  if (shape === "queue") return theme.shapeColors.queue;
  return theme.nodeColors;
}

function gradKeyForShape(shape: string): string {
  if (shape === "diamond" || shape === "stadium" || shape === "rounded" || shape === "cylinder" || shape === "queue") return shape;
  return "default";
}

function renderDefs(svg: SVGSVGElement, theme: FloraTheme, nodes: LayoutNode[]): void {
  const defs = el("defs", {}) as SVGDefsElement;

  const usedShapes = new Set(nodes.map((n) => n.shape));
  const colorSets: Array<{ key: string; colors: NodeColorSet }> = [
    { key: "default", colors: theme.nodeColors },
  ];
  if (usedShapes.has("diamond")) colorSets.push({ key: "diamond", colors: theme.shapeColors.diamond });
  if (usedShapes.has("stadium")) colorSets.push({ key: "stadium", colors: theme.shapeColors.stadium });
  if (usedShapes.has("rounded")) colorSets.push({ key: "rounded", colors: theme.shapeColors.rounded });
  if (usedShapes.has("cylinder")) colorSets.push({ key: "cylinder", colors: theme.shapeColors.cylinder });
  if (usedShapes.has("queue")) colorSets.push({ key: "queue", colors: theme.shapeColors.queue });

  for (const { key, colors } of colorSets) {
    const grad = el("linearGradient", { id: `flora-grad-${key}`, x1: "0", y1: "0", x2: "0", y2: "1" });
    const stop1 = el("stop", { offset: "0%", "stop-color": colors.fill });
    const stop2 = el("stop", { offset: "100%", "stop-color": colors.fillGradientEnd });
    grad.append(stop1, stop2);
    defs.appendChild(grad);
  }

  if (theme.shadow) {
    const filter = el("filter", { id: "flora-shadow", x: "-20%", y: "-20%", width: "140%", height: "150%" });
    const blur = el("feGaussianBlur", { in: "SourceAlpha", stdDeviation: "3" });
    const offset = el("feOffset", { dx: "0", dy: "2", result: "shadow" });
    const flood = el("feFlood", { "flood-color": "#0A0F25", "flood-opacity": "0.08" });
    const composite = el("feComposite", { in2: "shadow", operator: "in" });
    const merge = el("feMerge", {});
    merge.append(el("feMergeNode", {}), el("feMergeNode", { in: "SourceGraphic" }));
    filter.append(blur, offset, flood, composite, merge);
    defs.appendChild(filter);
  }

  if (theme.handDrawn) {
    const rough = el("filter", { id: "flora-rough", x: "-5%", y: "-5%", width: "110%", height: "110%" });
    const turb = el("feTurbulence", { type: "turbulence", baseFrequency: "0.03", numOctaves: "3", seed: "1", result: "noise" });
    const disp = el("feDisplacementMap", { in: "SourceGraphic", in2: "noise", scale: "3", xChannelSelector: "R", yChannelSelector: "G" });
    rough.append(turb, disp);
    defs.appendChild(rough);
  }

  const marker = el("marker", {
    id: "flora-arrowhead",
    markerWidth: "12",
    markerHeight: "8",
    refX: "11",
    refY: "4",
    orient: "auto",
    markerUnits: "userSpaceOnUse",
  });
  const arrowPath = el("path", {
    d: "M 1 1 L 10 4 L 1 7",
    fill: "none",
    stroke: theme.edgeColors.stroke,
    "stroke-width": "1.5",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
  });
  marker.appendChild(arrowPath);
  defs.appendChild(marker);

  svg.appendChild(defs);
}

function renderNode(node: LayoutNode, theme: FloraTheme, options: FloraOptions): SVGGElement {
  const group = el("g", { class: "flora-node", "data-id": node.id }) as SVGGElement;
  const x = node.x - node.width / 2;
  const y = node.y - node.height / 2;
  const colors = colorsForShape(node.shape, theme);
  const gradKey = gradKeyForShape(node.shape);

  let shape: SVGElement;

  switch (node.shape) {
    case "diamond": {
      const cx = node.x;
      const cy = node.y;
      const hw = node.width / 2;
      const hh = node.height / 2;
      const points = [
        `${cx},${cy - hh}`,
        `${cx + hw},${cy}`,
        `${cx},${cy + hh}`,
        `${cx - hw},${cy}`,
      ].join(" ");
      shape = el("polygon", {
        points,
        fill: `url(#flora-grad-${gradKey})`,
        stroke: colors.stroke,
        "stroke-width": "2",
        "stroke-linejoin": "round",
      });
      break;
    }
    case "circle": {
      const r = Math.max(node.width, node.height) / 2;
      shape = el("circle", {
        cx: node.x,
        cy: node.y,
        r,
        fill: `url(#flora-grad-${gradKey})`,
        stroke: colors.stroke,
        "stroke-width": "2",
      });
      break;
    }
    case "cylinder": {
      const ry = 10;
      const bodyTop = y + ry;
      const bodyBottom = y + node.height - ry;
      const d = [
        `M ${x} ${bodyTop}`,
        `A ${node.width / 2} ${ry} 0 0 1 ${x + node.width} ${bodyTop}`,
        `L ${x + node.width} ${bodyBottom}`,
        `A ${node.width / 2} ${ry} 0 0 1 ${x} ${bodyBottom}`,
        `Z`,
      ].join(" ");
      const body = el("path", {
        d,
        fill: `url(#flora-grad-${gradKey})`,
        stroke: colors.stroke,
        "stroke-width": "2",
      });
      group.appendChild(body);
      // Top ellipse drawn on top of the body
      const topEllipse = el("ellipse", {
        cx: node.x,
        cy: bodyTop,
        rx: node.width / 2,
        ry,
        fill: `url(#flora-grad-${gradKey})`,
        stroke: colors.stroke,
        "stroke-width": "2",
      });
      // Use topEllipse as the main shape element for class/filter/hover
      shape = topEllipse;
      // Set class on body too so highlighting works
      body.setAttribute("class", "flora-node-shape");
      break;
    }
    case "queue": {
      const rx = 12;
      const bodyLeft = x + rx;
      const bodyRight = x + node.width - rx;
      // Body: flat top/bottom with elliptical arcs on both sides
      const d = [
        `M ${bodyLeft} ${y}`,
        `L ${bodyRight} ${y}`,
        `A ${rx} ${node.height / 2} 0 0 1 ${bodyRight} ${y + node.height}`,
        `L ${bodyLeft} ${y + node.height}`,
        `A ${rx} ${node.height / 2} 0 0 1 ${bodyLeft} ${y}`,
      ].join(" ");
      const body = el("path", {
        d,
        fill: `url(#flora-grad-${gradKey})`,
        stroke: colors.stroke,
        "stroke-width": "2",
      });
      group.appendChild(body);
      // Right ellipse drawn on top of the body to show the 3D face
      const rightEllipse = el("ellipse", {
        cx: bodyRight,
        cy: node.y,
        rx,
        ry: node.height / 2,
        fill: `url(#flora-grad-${gradKey})`,
        stroke: colors.stroke,
        "stroke-width": "2",
      });
      shape = rightEllipse;
      body.setAttribute("class", "flora-node-shape");
      break;
    }
    case "stadium":
      shape = el("rect", {
        x,
        y,
        width: node.width,
        height: node.height,
        rx: node.height / 2,
        ry: node.height / 2,
        fill: `url(#flora-grad-${gradKey})`,
        stroke: colors.stroke,
        "stroke-width": "2",
      });
      break;
    case "rounded":
      shape = el("rect", {
        x,
        y,
        width: node.width,
        height: node.height,
        rx: 12,
        ry: 12,
        fill: `url(#flora-grad-${gradKey})`,
        stroke: colors.stroke,
        "stroke-width": "2",
      });
      break;
    default:
      shape = el("rect", {
        x,
        y,
        width: node.width,
        height: node.height,
        rx: theme.nodeRadius,
        ry: theme.nodeRadius,
        fill: `url(#flora-grad-${gradKey})`,
        stroke: colors.stroke,
        "stroke-width": "2",
      });
  }

  shape.setAttribute("class", "flora-node-shape");

  if (theme.shadow) {
    shape.setAttribute("filter", "url(#flora-shadow)");
  }

  if (theme.handDrawn) {
    group.setAttribute("filter", "url(#flora-rough)");
  }

  group.appendChild(shape);

  // Shift text down for cylinders to center within the body (below the top ellipse cap)
  const textYOffset = node.shape === "cylinder" ? 6 : 1;

  const text = el("text", {
    x: node.x,
    y: node.y + textYOffset,
    "text-anchor": "middle",
    "dominant-baseline": "central",
    fill: colors.text,
    "font-family": theme.fontFamily,
    "font-size": theme.fontSize,
    "font-weight": "400",
  });
  text.textContent = node.label;
  group.appendChild(text);

  if (options.interactive !== false) {
    group.addEventListener("mouseenter", () => {
      shape.setAttribute("stroke-width", "3");
      shape.style.transition = "stroke-width 0.12s ease";
      options.onNodeHover?.(node.id);
    });
    group.addEventListener("mouseleave", () => {
      shape.setAttribute("stroke-width", "2");
      options.onNodeHover?.(null);
    });
  }

  return group;
}

function buildEdgePath(points: Array<{ x: number; y: number }>): string {
  if (points.length < 2) return "";

  const pts = points;
  let d = `M ${pts[0]!.x} ${pts[0]!.y}`;

  if (pts.length === 2) {
    d += ` L ${pts[1]!.x} ${pts[1]!.y}`;
    return d;
  }

  for (let i = 1; i < pts.length - 1; i++) {
    const curr = pts[i]!;
    const next = pts[i + 1]!;
    const mx = (curr.x + next.x) / 2;
    const my = (curr.y + next.y) / 2;
    d += ` Q ${curr.x} ${curr.y} ${mx} ${my}`;
  }

  const last = pts[pts.length - 1]!;
  d += ` L ${last.x} ${last.y}`;
  return d;
}

function renderEdge(edge: LayoutEdge, theme: FloraTheme): SVGGElement {
  const group = el("g", { class: "flora-edge", "data-from": edge.from, "data-to": edge.to }) as SVGGElement;

  const path = el("path", {
    d: buildEdgePath(edge.points),
    fill: "none",
    stroke: theme.edgeColors.stroke,
    "stroke-width": theme.edgeWidth,
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
    "marker-end": "url(#flora-arrowhead)",
  });

  if (edge.style === "dotted") {
    path.setAttribute("stroke-dasharray", "6,4");
  } else if (edge.style === "thick") {
    path.setAttribute("stroke-width", String(theme.edgeWidth * 2));
  }

  group.appendChild(path);

  if (edge.label) {
    const midIdx = Math.floor(edge.points.length / 2);
    const mid = edge.points[midIdx]!;
    const labelWidth = edge.label.length * 8 + 20;
    const labelHeight = 24;

    const pill = el("rect", {
      x: mid.x - labelWidth / 2,
      y: mid.y - labelHeight / 2,
      width: labelWidth,
      height: labelHeight,
      rx: 4,
      fill: theme.edgeColors.labelBackground,
      stroke: theme.edgeColors.stroke,
      "stroke-width": "1",
    });
    group.appendChild(pill);

    const text = el("text", {
      x: mid.x,
      y: mid.y + 1,
      "text-anchor": "middle",
      "dominant-baseline": "central",
      fill: theme.edgeColors.label,
      "font-family": theme.fontFamily,
      "font-size": theme.fontSize - 3,
      "font-weight": "400",
    });
    text.textContent = edge.label;
    group.appendChild(text);
  }

  if (theme.handDrawn) {
    group.setAttribute("filter", "url(#flora-rough)");
  }

  return group;
}

function renderSubgraph(sg: LayoutSubgraph, theme: FloraTheme): SVGGElement {
  const group = el("g", { class: "flora-subgraph", "data-id": sg.id }) as SVGGElement;

  const rect = el("rect", {
    x: sg.x,
    y: sg.y,
    width: sg.width,
    height: sg.height,
    rx: 8,
    ry: 8,
    fill: theme.subgraphColors.fill,
    stroke: theme.subgraphColors.stroke,
    "stroke-width": "1.5",
    "stroke-dasharray": "6,3",
  });
  group.appendChild(rect);

  // Label background pill
  const labelText = sg.label;
  const labelWidth = labelText.length * 8 + 20;
  const labelHeight = 22;
  const labelX = sg.x + 12;
  const labelY = sg.y + 8;

  const labelBg = el("rect", {
    x: labelX,
    y: labelY,
    width: labelWidth,
    height: labelHeight,
    rx: 4,
    ry: 4,
    fill: theme.subgraphColors.stroke,
  });
  group.appendChild(labelBg);

  const label = el("text", {
    x: labelX + labelWidth / 2,
    y: labelY + labelHeight / 2 + 1,
    "text-anchor": "middle",
    "dominant-baseline": "central",
    fill: theme.background,
    "font-family": theme.fontFamily,
    "font-size": theme.fontSize - 3,
    "font-weight": "600",
  });
  label.textContent = labelText;
  group.appendChild(label);

  if (theme.handDrawn) {
    group.setAttribute("filter", "url(#flora-rough)");
  }

  return group;
}

function addZoomPan(svg: SVGSVGElement, content: SVGGElement): void {
  let scale = 1;
  let translateX = 0;
  let translateY = 0;
  let isPanning = false;
  let lastX = 0;
  let lastY = 0;

  function getViewBoxScale(): number {
    const rect = svg.getBoundingClientRect();
    const viewBox = svg.viewBox.baseVal;
    if (!viewBox || rect.width === 0) return 1;
    return viewBox.width / rect.width;
  }

  function updateTransform(): void {
    content.setAttribute("transform", `translate(${translateX},${translateY}) scale(${scale})`);
  }

  svg.addEventListener("wheel", (e) => {
    e.preventDefault();
    const vbScale = getViewBoxScale();
    const rect = svg.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) * vbScale;
    const mouseY = (e.clientY - rect.top) * vbScale;
    const delta = e.deltaY > 0 ? 0.92 : 1.08;
    const newScale = Math.max(0.1, Math.min(50, scale * delta));
    translateX = mouseX - (mouseX - translateX) * (newScale / scale);
    translateY = mouseY - (mouseY - translateY) * (newScale / scale);
    scale = newScale;
    updateTransform();
  });

  svg.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    isPanning = true;
    lastX = e.clientX;
    lastY = e.clientY;
    svg.style.cursor = "grabbing";
  });

  svg.addEventListener("mousemove", (e) => {
    if (!isPanning) return;
    const vbScale = getViewBoxScale();
    const dx = (e.clientX - lastX) * vbScale;
    const dy = (e.clientY - lastY) * vbScale;
    translateX += dx;
    translateY += dy;
    lastX = e.clientX;
    lastY = e.clientY;
    updateTransform();
  });

  svg.addEventListener("mouseup", () => {
    isPanning = false;
    svg.style.cursor = "grab";
  });

  svg.addEventListener("mouseleave", () => {
    isPanning = false;
    svg.style.cursor = "grab";
  });

  svg.style.cursor = "grab";
}

export function renderSVG(
  layout: LayoutResult,
  options: FloraOptions = {},
): SVGSVGElement {
  const theme = resolveTheme(options.theme);
  const padding = 60;

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", "100%");
  svg.setAttribute("viewBox", `0 0 ${layout.width + padding * 2} ${layout.height + padding * 2}`);
  svg.style.background = theme.background;

  renderDefs(svg, theme, layout.nodes);

  // Inject highlight/dim CSS
  const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
  style.textContent = `
    .flora-node, .flora-edge, .flora-subgraph {
      transition: opacity 0.2s ease;
    }
    .flora-dimmed {
      opacity: 0.15;
      pointer-events: none;
    }
    .flora-highlighted-source .flora-node-shape {
      stroke-width: 4;
    }
    .flora-highlighted-edge path {
      stroke-width: 2.5;
    }
  `;
  svg.appendChild(style);

  const content = el("g", { transform: `translate(${padding},${padding})` }) as SVGGElement;

  // Render subgraph containers first (behind everything)
  // Sort by depth (parents first) so nested subgraphs render on top of parent containers
  const sortedSubgraphs = [...layout.subgraphs].sort((a, b) => {
    const depthA = getSubgraphDepth(a, layout.subgraphs);
    const depthB = getSubgraphDepth(b, layout.subgraphs);
    return depthA - depthB;
  });

  for (const sg of sortedSubgraphs) {
    content.appendChild(renderSubgraph(sg, theme));
  }

  // Render edges
  for (const edge of layout.edges) {
    content.appendChild(renderEdge(edge, theme));
  }

  // Render nodes
  for (const node of layout.nodes) {
    content.appendChild(renderNode(node, theme, options));
  }

  svg.appendChild(content);

  // Lineage highlighting
  if (options.interactive !== false) {
    const adj = buildAdjacencyList(layout.edges);
    let highlightedNodeId: string | null = null;

    function clearHighlight(): void {
      highlightedNodeId = null;
      content.querySelectorAll(".flora-dimmed").forEach((el) => el.classList.remove("flora-dimmed"));
      content.querySelectorAll(".flora-highlighted-source").forEach((el) => el.classList.remove("flora-highlighted-source"));
      content.querySelectorAll(".flora-highlighted-edge").forEach((el) => el.classList.remove("flora-highlighted-edge"));
    }

    function applyHighlight(nodeId: string): void {
      const upstream = getUpstream(nodeId, adj);
      const downstream = getDownstream(nodeId, adj);
      const highlighted = new Set([nodeId, ...upstream, ...downstream]);

      // Dim/highlight nodes
      content.querySelectorAll<SVGGElement>(".flora-node").forEach((nodeEl) => {
        const id = nodeEl.getAttribute("data-id");
        if (!id || !highlighted.has(id)) {
          nodeEl.classList.add("flora-dimmed");
        } else if (id === nodeId) {
          nodeEl.classList.add("flora-highlighted-source");
        }
      });

      // Dim/highlight edges
      content.querySelectorAll<SVGGElement>(".flora-edge").forEach((edgeEl) => {
        const from = edgeEl.getAttribute("data-from");
        const to = edgeEl.getAttribute("data-to");
        if (from && to && highlighted.has(from) && highlighted.has(to)) {
          edgeEl.classList.add("flora-highlighted-edge");
        } else {
          edgeEl.classList.add("flora-dimmed");
        }
      });

      // Dim subgraphs
      content.querySelectorAll<SVGGElement>(".flora-subgraph").forEach((sgEl) => {
        sgEl.classList.add("flora-dimmed");
      });

      options.onHighlight?.(nodeId, [...upstream], [...downstream]);
    }

    content.querySelectorAll<SVGGElement>(".flora-node").forEach((nodeEl) => {
      const id = nodeEl.getAttribute("data-id");
      if (!id) return;

      nodeEl.style.cursor = "pointer";
      nodeEl.addEventListener("click", (e) => {
        e.stopPropagation();
        if (highlightedNodeId === id) {
          clearHighlight();
        } else {
          clearHighlight();
          highlightedNodeId = id;
          applyHighlight(id);
        }
        options.onNodeClick?.(id);
      });
    });

    // Clear on background click
    svg.addEventListener("click", () => {
      if (highlightedNodeId) clearHighlight();
    });

    // Clear on Escape key
    svg.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && highlightedNodeId) clearHighlight();
    });
    svg.setAttribute("tabindex", "0");

    addZoomPan(svg, content);
  }

  return svg;
}

function getSubgraphDepth(sg: LayoutSubgraph, allSubgraphs: LayoutSubgraph[]): number {
  let depth = 0;
  let current = sg;
  while (current.parentId) {
    depth++;
    const parent = allSubgraphs.find((s) => s.id === current.parentId);
    if (!parent) break;
    current = parent;
  }
  return depth;
}
