import type { LayoutResult, LayoutNode, LayoutEdge, FloraTheme, FloraOptions, NodeColorSet } from "../types.js";
import { defaultTheme } from "../themes/default.js";

function mergeTheme(partial?: Partial<FloraTheme>): FloraTheme {
  if (!partial) return defaultTheme;
  return {
    ...defaultTheme,
    ...partial,
    nodeColors: { ...defaultTheme.nodeColors, ...partial.nodeColors },
    shapeColors: {
      diamond: { ...defaultTheme.shapeColors.diamond, ...partial.shapeColors?.diamond },
      stadium: { ...defaultTheme.shapeColors.stadium, ...partial.shapeColors?.stadium },
      rounded: { ...defaultTheme.shapeColors.rounded, ...partial.shapeColors?.rounded },
    },
    edgeColors: { ...defaultTheme.edgeColors, ...partial.edgeColors },
    nodePadding: { ...defaultTheme.nodePadding, ...partial.nodePadding },
  };
}

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
  return theme.nodeColors;
}

function gradKeyForShape(shape: string): string {
  if (shape === "diamond" || shape === "stadium" || shape === "rounded") return shape;
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
  group.style.cursor = options.onNodeClick ? "pointer" : "default";

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

  if (theme.shadow) {
    shape.setAttribute("filter", "url(#flora-shadow)");
  }

  group.appendChild(shape);

  const text = el("text", {
    x: node.x,
    y: node.y + 1,
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
    const originalStroke = colors.stroke;
    group.addEventListener("mouseenter", () => {
      shape.setAttribute("stroke-width", "3");
      shape.style.transition = "stroke-width 0.12s ease";
      options.onNodeHover?.(node.id);
    });
    group.addEventListener("mouseleave", () => {
      shape.setAttribute("stroke-width", "2");
      options.onNodeHover?.(null);
    });
    if (options.onNodeClick) {
      group.addEventListener("click", () => options.onNodeClick!(node.id));
    }
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
  const group = el("g", { class: "flora-edge" }) as SVGGElement;

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

  return group;
}

function addZoomPan(svg: SVGSVGElement, content: SVGGElement): void {
  let scale = 1;
  let translateX = 0;
  let translateY = 0;
  let isPanning = false;
  let startX = 0;
  let startY = 0;

  function updateTransform(): void {
    content.setAttribute("transform", `translate(${translateX},${translateY}) scale(${scale})`);
  }

  svg.addEventListener("wheel", (e) => {
    e.preventDefault();
    const rect = svg.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const delta = e.deltaY > 0 ? 0.92 : 1.08;
    const newScale = Math.max(0.1, Math.min(5, scale * delta));
    translateX = mouseX - (mouseX - translateX) * (newScale / scale);
    translateY = mouseY - (mouseY - translateY) * (newScale / scale);
    scale = newScale;
    updateTransform();
  });

  svg.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    isPanning = true;
    startX = e.clientX - translateX;
    startY = e.clientY - translateY;
    svg.style.cursor = "grabbing";
  });

  svg.addEventListener("mousemove", (e) => {
    if (!isPanning) return;
    translateX = e.clientX - startX;
    translateY = e.clientY - startY;
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

export function renderSVG(layout: LayoutResult, options: FloraOptions = {}): SVGSVGElement {
  const theme = mergeTheme(options.theme);
  const padding = 60;

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", "100%");
  svg.setAttribute("viewBox", `0 0 ${layout.width + padding * 2} ${layout.height + padding * 2}`);
  svg.style.background = theme.background;

  renderDefs(svg, theme, layout.nodes);

  const content = el("g", { transform: `translate(${padding},${padding})` }) as SVGGElement;

  for (const edge of layout.edges) {
    content.appendChild(renderEdge(edge, theme));
  }

  for (const node of layout.nodes) {
    content.appendChild(renderNode(node, theme, options));
  }

  svg.appendChild(content);

  if (options.interactive !== false) {
    addZoomPan(svg, content);
  }

  return svg;
}
