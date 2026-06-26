import type { LayoutResult, LayoutNode, LayoutEdge, LayoutSubgraph, FloraTheme, FloraOptions, NodeColorSet } from "../types.js";
import { resolveTheme } from "../themes/index.js";
import { buildAdjacencyList, getUpstream, getDownstream } from "./highlight.js";

// ---------------------------------------------------------------------------
// Sketch utilities — lightweight hand-drawn path generation (no dependencies)
// ---------------------------------------------------------------------------

const SKETCH_AMP = 1.2; // jitter amplitude in pixels

class Rng {
  private s: number;
  constructor(seed: number) {
    this.s = (seed % 2147483647) || 1;
    if (this.s < 0) this.s += 2147483646;
  }
  next(): number {
    this.s = (this.s * 16807) % 2147483647;
    return (this.s - 1) / 2147483646;
  }
  offset(amp: number): number {
    return (this.next() - 0.5) * 2 * amp;
  }
}

function hashSeed(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h) || 1;
}

/** Wobbly straight line — returns L commands only (no M). */
function skLine(x1: number, y1: number, x2: number, y2: number, rng: Rng, amp = SKETCH_AMP): string {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1) return `L ${x2} ${y2} `;
  const px = -dy / len, py = dx / len; // perpendicular unit
  const n = Math.max(2, Math.ceil(len / 25));
  let d = "";
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const j = i < n ? rng.offset(amp) : 0;
    d += `L ${(x1 + dx * t + px * j).toFixed(2)} ${(y1 + dy * t + py * j).toFixed(2)} `;
  }
  return d;
}

/** Wobbly elliptical arc — returns L commands only. */
function skArc(cx: number, cy: number, rx: number, ry: number,
  start: number, end: number, rng: Rng, n?: number): string {
  const segs = n ?? Math.max(8, Math.ceil(Math.abs(end - start) / (Math.PI / 8)));
  let d = "";
  for (let i = 1; i <= segs; i++) {
    const angle = start + (i / segs) * (end - start);
    const j = i < segs ? rng.offset(SKETCH_AMP) : 0;
    d += `L ${(cx + (rx + j) * Math.cos(angle)).toFixed(2)} ${(cy + (ry + j) * Math.sin(angle)).toFixed(2)} `;
  }
  return d;
}

function skRect(x: number, y: number, w: number, h: number, rng: Rng): string {
  const j = SKETCH_AMP * 0.3;
  return `M ${(x + rng.offset(j)).toFixed(2)} ${(y + rng.offset(j)).toFixed(2)} ` +
    skLine(x, y, x + w, y, rng) +
    skLine(x + w, y, x + w, y + h, rng) +
    skLine(x + w, y + h, x, y + h, rng) +
    skLine(x, y + h, x, y, rng) + "Z";
}

function skRoundedRect(x: number, y: number, w: number, h: number, r: number, rng: Rng): string {
  const j = SKETCH_AMP * 0.3;
  let d = `M ${(x + r + rng.offset(j)).toFixed(2)} ${(y + rng.offset(j)).toFixed(2)} `;
  d += skLine(x + r, y, x + w - r, y, rng);
  d += skArc(x + w - r, y + r, r, r, -Math.PI / 2, 0, rng, 4);
  d += skLine(x + w, y + r, x + w, y + h - r, rng);
  d += skArc(x + w - r, y + h - r, r, r, 0, Math.PI / 2, rng, 4);
  d += skLine(x + w - r, y + h, x + r, y + h, rng);
  d += skArc(x + r, y + h - r, r, r, Math.PI / 2, Math.PI, rng, 4);
  d += skLine(x, y + h - r, x, y + r, rng);
  d += skArc(x + r, y + r, r, r, Math.PI, Math.PI * 1.5, rng, 4);
  return d + "Z";
}

function skStadium(x: number, y: number, w: number, h: number, rng: Rng): string {
  const r = h / 2;
  const j = SKETCH_AMP * 0.3;
  let d = `M ${(x + r + rng.offset(j)).toFixed(2)} ${(y + rng.offset(j)).toFixed(2)} `;
  d += skLine(x + r, y, x + w - r, y, rng);
  d += skArc(x + w - r, y + r, r, r, -Math.PI / 2, Math.PI / 2, rng, 8);
  d += skLine(x + w - r, y + h, x + r, y + h, rng);
  d += skArc(x + r, y + r, r, r, Math.PI / 2, Math.PI * 1.5, rng, 8);
  return d + "Z";
}

function skEllipse(cx: number, cy: number, rx: number, ry: number, rng: Rng): string {
  const j = SKETCH_AMP * 0.3;
  const sx = cx + rx + rng.offset(j);
  const sy = cy + rng.offset(j);
  return `M ${sx.toFixed(2)} ${sy.toFixed(2)} ` + skArc(cx, cy, rx, ry, 0, Math.PI * 2, rng, 32) + "Z";
}

function skPolygon(points: [number, number][], rng: Rng): string {
  if (!points.length) return "";
  const j = SKETCH_AMP * 0.3;
  let d = `M ${(points[0][0] + rng.offset(j)).toFixed(2)} ${(points[0][1] + rng.offset(j)).toFixed(2)} `;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    d += skLine(x1, y1, x2, y2, rng);
  }
  return d + "Z";
}

/** Emit a filled path + two stroked outlines (double-drawn effect). */
function sketchShape(
  pathFn: (rng: Rng) => string, seed: number,
  fill: string, stroke: string, strokeWidth: number,
): SVGElement[] {
  const out: SVGElement[] = [];
  out.push(el("path", { d: pathFn(new Rng(seed)), fill, stroke: "none" }));
  for (const s of [seed + 101, seed + 202]) {
    out.push(el("path", {
      d: pathFn(new Rng(s)),
      fill: "none", stroke, "stroke-width": strokeWidth,
      "stroke-linecap": "round", "stroke-linejoin": "round",
    }));
  }
  return out;
}

// ---------------------------------------------------------------------------
// SVG helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Defs (gradients, shadow filter, arrowhead marker)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Sketch node renderer
// ---------------------------------------------------------------------------

function renderNodeSketch(node: LayoutNode, theme: FloraTheme, options: FloraOptions): SVGGElement {
  const group = el("g", { class: "flora-node", "data-id": node.id }) as SVGGElement;
  const x = node.x - node.width / 2;
  const y = node.y - node.height / 2;
  const colors = colorsForShape(node.shape, theme);
  const seed = hashSeed(node.id);
  const sw = theme.nodeStrokeWidth;

  let pathFn: ((rng: Rng) => string) | null = null;

  switch (node.shape) {
    case "diamond": {
      const cx = node.x, cy = node.y;
      const hw = node.width / 2, hh = node.height / 2;
      pathFn = (rng) => skPolygon([[cx, cy - hh], [cx + hw, cy], [cx, cy + hh], [cx - hw, cy]], rng);
      break;
    }
    case "circle": {
      const r = Math.max(node.width, node.height) / 2;
      pathFn = (rng) => skEllipse(node.x, node.y, r, r, rng);
      break;
    }
    case "stadium":
      pathFn = (rng) => skStadium(x, y, node.width, node.height, rng);
      break;
    case "rounded":
      pathFn = (rng) => skRoundedRect(x, y, node.width, node.height, 12, rng);
      break;
    case "cylinder": {
      const ry = 10;
      const bodyTop = y + ry;
      const bodyBottom = y + node.height - ry;
      // Body: left side down, bottom arc (curves down), right side up, top arc (curves up) to close
      const bodyFn = (rng: Rng): string => {
        let d = `M ${(x + rng.offset(0.3)).toFixed(2)} ${(bodyTop + rng.offset(0.3)).toFixed(2)} `;
        d += skLine(x, bodyTop, x, bodyBottom, rng);
        // Bottom arc: left-to-right curving downward (π → 2π in SVG's Y-down = visually downward)
        d += skArc(node.x, bodyBottom, node.width / 2, ry, Math.PI, 0, rng, 12);
        d += skLine(x + node.width, bodyBottom, x + node.width, bodyTop, rng);
        // Top closing arc: right-to-left curving upward (0 → π in SVG's Y-down = visually upward)
        d += skArc(node.x, bodyTop, node.width / 2, ry, 0, -Math.PI, rng, 12);
        return d + "Z";
      };
      const bodyParts = sketchShape(bodyFn, seed, colors.fill, colors.stroke, sw);
      bodyParts[0].setAttribute("class", "flora-node-shape");
      for (const p of bodyParts) group.appendChild(p);

      // Top ellipse
      const topFn = (rng: Rng): string => skEllipse(node.x, bodyTop, node.width / 2, ry, rng);
      const topParts = sketchShape(topFn, seed + 50, colors.fill, colors.stroke, sw);
      for (const p of topParts) group.appendChild(p);

      pathFn = null; // already handled
      break;
    }
    case "queue": {
      const rx = 12;
      const bodyLeft = x + rx;
      const bodyRight = x + node.width - rx;
      const bodyFn = (rng: Rng): string => {
        let d = `M ${(bodyLeft + rng.offset(0.3)).toFixed(2)} ${(y + rng.offset(0.3)).toFixed(2)} `;
        d += skLine(bodyLeft, y, bodyRight, y, rng);
        d += skArc(bodyRight, node.y, rx, node.height / 2, -Math.PI / 2, Math.PI / 2, rng, 8);
        d += skLine(bodyRight, y + node.height, bodyLeft, y + node.height, rng);
        d += skArc(bodyLeft, node.y, rx, node.height / 2, Math.PI / 2, Math.PI * 1.5, rng, 8);
        return d + "Z";
      };
      const bodyParts = sketchShape(bodyFn, seed, colors.fill, colors.stroke, sw);
      bodyParts[0].setAttribute("class", "flora-node-shape");
      for (const p of bodyParts) group.appendChild(p);

      // Right ellipse
      const rightFn = (rng: Rng): string => skEllipse(bodyRight, node.y, rx, node.height / 2, rng);
      const rightParts = sketchShape(rightFn, seed + 50, colors.fill, colors.stroke, sw);
      for (const p of rightParts) group.appendChild(p);

      pathFn = null;
      break;
    }
    default:
      pathFn = (rng) => skRect(x, y, node.width, node.height, rng);
  }

  if (pathFn) {
    const parts = sketchShape(pathFn, seed, colors.fill, colors.stroke, sw);
    parts[0].setAttribute("class", "flora-node-shape");
    for (const p of parts) group.appendChild(p);
  }

  const textYOffset = node.shape === "cylinder" ? 6 : 1;
  const text = el("text", {
    x: node.x, y: node.y + textYOffset,
    "text-anchor": "middle", "dominant-baseline": "central",
    fill: colors.text, "font-family": theme.fontFamily,
    "font-size": theme.fontSize, "font-weight": "400",
  });
  text.textContent = node.label;
  group.appendChild(text);

  if (options.interactive !== false) {
    group.addEventListener("mouseenter", () => options.onNodeHover?.(node.id));
    group.addEventListener("mouseleave", () => options.onNodeHover?.(null));
  }

  return group;
}

// ---------------------------------------------------------------------------
// Clean node renderer
// ---------------------------------------------------------------------------

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
        "stroke-width": String(theme.nodeStrokeWidth),
        "stroke-linejoin": "round",
      });
      break;
    }
    case "circle": {
      const r = Math.max(node.width, node.height) / 2;
      shape = el("circle", {
        cx: node.x, cy: node.y, r,
        fill: `url(#flora-grad-${gradKey})`,
        stroke: colors.stroke,
        "stroke-width": String(theme.nodeStrokeWidth),
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
        "stroke-width": String(theme.nodeStrokeWidth),
      });
      group.appendChild(body);
      const topEllipse = el("ellipse", {
        cx: node.x, cy: bodyTop,
        rx: node.width / 2, ry,
        fill: `url(#flora-grad-${gradKey})`,
        stroke: colors.stroke,
        "stroke-width": String(theme.nodeStrokeWidth),
      });
      shape = topEllipse;
      body.setAttribute("class", "flora-node-shape");
      break;
    }
    case "queue": {
      const rx = 12;
      const bodyLeft = x + rx;
      const bodyRight = x + node.width - rx;
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
        "stroke-width": String(theme.nodeStrokeWidth),
      });
      group.appendChild(body);
      const rightEllipse = el("ellipse", {
        cx: bodyRight, cy: node.y,
        rx, ry: node.height / 2,
        fill: `url(#flora-grad-${gradKey})`,
        stroke: colors.stroke,
        "stroke-width": String(theme.nodeStrokeWidth),
      });
      shape = rightEllipse;
      body.setAttribute("class", "flora-node-shape");
      break;
    }
    case "stadium":
      shape = el("rect", {
        x, y, width: node.width, height: node.height,
        rx: node.height / 2, ry: node.height / 2,
        fill: `url(#flora-grad-${gradKey})`,
        stroke: colors.stroke,
        "stroke-width": String(theme.nodeStrokeWidth),
      });
      break;
    case "rounded":
      shape = el("rect", {
        x, y, width: node.width, height: node.height,
        rx: 12, ry: 12,
        fill: `url(#flora-grad-${gradKey})`,
        stroke: colors.stroke,
        "stroke-width": String(theme.nodeStrokeWidth),
      });
      break;
    default:
      shape = el("rect", {
        x, y, width: node.width, height: node.height,
        rx: theme.nodeRadius, ry: theme.nodeRadius,
        fill: `url(#flora-grad-${gradKey})`,
        stroke: colors.stroke,
        "stroke-width": String(theme.nodeStrokeWidth),
      });
  }

  shape.setAttribute("class", "flora-node-shape");

  if (theme.shadow) {
    shape.setAttribute("filter", "url(#flora-shadow)");
  }

  group.appendChild(shape);

  const textYOffset = node.shape === "cylinder" ? 6 : 1;

  const text = el("text", {
    x: node.x, y: node.y + textYOffset,
    "text-anchor": "middle", "dominant-baseline": "central",
    fill: colors.text, "font-family": theme.fontFamily,
    "font-size": theme.fontSize, "font-weight": "400",
  });
  text.textContent = node.label;
  group.appendChild(text);

  if (options.interactive !== false) {
    group.addEventListener("mouseenter", () => {
      shape.setAttribute("stroke-width", String(theme.nodeStrokeWidth + 1));
      shape.style.transition = "stroke-width 0.12s ease";
      options.onNodeHover?.(node.id);
    });
    group.addEventListener("mouseleave", () => {
      shape.setAttribute("stroke-width", String(theme.nodeStrokeWidth));
      options.onNodeHover?.(null);
    });
  }

  return group;
}

// ---------------------------------------------------------------------------
// Edge path builders
// ---------------------------------------------------------------------------

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

function buildSketchyEdgePath(points: Array<{ x: number; y: number }>, rng: Rng): string {
  if (points.length < 2) return "";

  const pts = points.map((p, i) =>
    (i === 0 || i === points.length - 1) ? p : { x: p.x + rng.offset(SKETCH_AMP * 0.6), y: p.y + rng.offset(SKETCH_AMP * 0.6) },
  );

  if (pts.length === 2) {
    const [a, b] = [pts[0]!, pts[1]!];
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1) return `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
    const px = -dy / len, py = dx / len;
    const n = Math.max(2, Math.ceil(len / 30));
    let d = `M ${a.x.toFixed(2)} ${a.y.toFixed(2)}`;
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      const j = i < n ? rng.offset(SKETCH_AMP * 0.8) : 0;
      d += ` L ${(a.x + dx * t + px * j).toFixed(2)} ${(a.y + dy * t + py * j).toFixed(2)}`;
    }
    return d;
  }

  let d = `M ${pts[0]!.x.toFixed(2)} ${pts[0]!.y.toFixed(2)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const curr = pts[i]!;
    const next = pts[i + 1]!;
    const mx = (curr.x + next.x) / 2;
    const my = (curr.y + next.y) / 2;
    d += ` Q ${curr.x.toFixed(2)} ${curr.y.toFixed(2)} ${mx.toFixed(2)} ${my.toFixed(2)}`;
  }
  const last = pts[pts.length - 1]!;
  d += ` L ${last.x.toFixed(2)} ${last.y.toFixed(2)}`;
  return d;
}

// ---------------------------------------------------------------------------
// Sketch edge renderer
// ---------------------------------------------------------------------------

function renderEdgeSketch(edge: LayoutEdge, theme: FloraTheme): SVGGElement {
  const group = el("g", { class: "flora-edge", "data-from": edge.from, "data-to": edge.to }) as SVGGElement;

  const seed = hashSeed(edge.from + edge.to);
  const rng = new Rng(seed);
  const strokeWidth = edge.style === "thick" ? theme.edgeWidth * 2 : theme.edgeWidth;

  const path = el("path", {
    d: buildSketchyEdgePath(edge.points, rng),
    fill: "none",
    stroke: theme.edgeColors.stroke,
    "stroke-width": strokeWidth,
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
  });

  if (edge.style === "dotted") {
    path.setAttribute("stroke-dasharray", "6,4");
  }

  group.appendChild(path);

  // Sketchy arrowhead
  const last = edge.points[edge.points.length - 1]!;
  const prev = edge.points[edge.points.length - 2] || edge.points[0]!;
  const angle = Math.atan2(last.y - prev.y, last.x - prev.x);
  const aLen = 10, spread = Math.PI / 6;
  const a1x = last.x - aLen * Math.cos(angle - spread) + rng.offset(0.6);
  const a1y = last.y - aLen * Math.sin(angle - spread) + rng.offset(0.6);
  const a2x = last.x - aLen * Math.cos(angle + spread) + rng.offset(0.6);
  const a2y = last.y - aLen * Math.sin(angle + spread) + rng.offset(0.6);
  const arrow = el("path", {
    d: `M ${a1x.toFixed(2)} ${a1y.toFixed(2)} L ${last.x.toFixed(2)} ${last.y.toFixed(2)} L ${a2x.toFixed(2)} ${a2y.toFixed(2)}`,
    fill: "none",
    stroke: theme.edgeColors.stroke,
    "stroke-width": "1.5",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
  });
  group.appendChild(arrow);

  if (edge.label) {
    const midIdx = Math.floor(edge.points.length / 2);
    const mid = edge.points[midIdx]!;
    const labelWidth = edge.label.length * 8 + 20;
    const labelHeight = 24;

    const pillParts = sketchShape(
      (r) => skRoundedRect(mid.x - labelWidth / 2, mid.y - labelHeight / 2, labelWidth, labelHeight, 4, r),
      seed + 300, theme.edgeColors.labelBackground, theme.edgeColors.stroke, 1,
    );
    for (const p of pillParts) group.appendChild(p);

    const text = el("text", {
      x: mid.x, y: mid.y + 1,
      "text-anchor": "middle", "dominant-baseline": "central",
      fill: theme.edgeColors.label, "font-family": theme.fontFamily,
      "font-size": theme.fontSize - 3, "font-weight": "400",
    });
    text.textContent = edge.label;
    group.appendChild(text);
  }

  return group;
}

// ---------------------------------------------------------------------------
// Clean edge renderer
// ---------------------------------------------------------------------------

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
      x: mid.x, y: mid.y + 1,
      "text-anchor": "middle", "dominant-baseline": "central",
      fill: theme.edgeColors.label, "font-family": theme.fontFamily,
      "font-size": theme.fontSize - 3, "font-weight": "400",
    });
    text.textContent = edge.label;
    group.appendChild(text);
  }

  return group;
}

// ---------------------------------------------------------------------------
// Sketch subgraph renderer
// ---------------------------------------------------------------------------

function renderSubgraphSketch(sg: LayoutSubgraph, theme: FloraTheme): SVGGElement {
  const group = el("g", { class: "flora-subgraph", "data-id": sg.id }) as SVGGElement;
  const seed = hashSeed(sg.id);

  const rectParts = sketchShape(
    (rng) => skRoundedRect(sg.x, sg.y, sg.width, sg.height, 8, rng),
    seed, theme.subgraphColors.fill, theme.subgraphColors.stroke, 1.5,
  );
  // Apply dashed stroke on the stroke paths (indices 1 and 2)
  for (let i = 1; i < rectParts.length; i++) {
    rectParts[i].setAttribute("stroke-dasharray", "6,3");
  }
  for (const p of rectParts) group.appendChild(p);

  const labelText = sg.label;
  const labelWidth = labelText.length * 8 + 20;
  const labelHeight = 22;
  const labelX = sg.x + 12;
  const labelY = sg.y + 8;

  const labelParts = sketchShape(
    (rng) => skRoundedRect(labelX, labelY, labelWidth, labelHeight, 4, rng),
    seed + 500, theme.subgraphColors.stroke, theme.subgraphColors.stroke, 1,
  );
  for (const p of labelParts) group.appendChild(p);

  const label = el("text", {
    x: labelX + labelWidth / 2,
    y: labelY + labelHeight / 2 + 1,
    "text-anchor": "middle", "dominant-baseline": "central",
    fill: theme.background, "font-family": theme.fontFamily,
    "font-size": theme.fontSize - 3, "font-weight": "600",
  });
  label.textContent = labelText;
  group.appendChild(label);

  return group;
}

// ---------------------------------------------------------------------------
// Clean subgraph renderer
// ---------------------------------------------------------------------------

function renderSubgraph(sg: LayoutSubgraph, theme: FloraTheme): SVGGElement {
  const group = el("g", { class: "flora-subgraph", "data-id": sg.id }) as SVGGElement;

  const rect = el("rect", {
    x: sg.x, y: sg.y,
    width: sg.width, height: sg.height,
    rx: 8, ry: 8,
    fill: theme.subgraphColors.fill,
    stroke: theme.subgraphColors.stroke,
    "stroke-width": "1.5",
    "stroke-dasharray": "6,3",
  });
  group.appendChild(rect);

  const labelText = sg.label;
  const labelWidth = labelText.length * 8 + 20;
  const labelHeight = 22;
  const labelX = sg.x + 12;
  const labelY = sg.y + 8;

  const labelBg = el("rect", {
    x: labelX, y: labelY,
    width: labelWidth, height: labelHeight,
    rx: 4, ry: 4,
    fill: theme.subgraphColors.stroke,
  });
  group.appendChild(labelBg);

  const label = el("text", {
    x: labelX + labelWidth / 2,
    y: labelY + labelHeight / 2 + 1,
    "text-anchor": "middle", "dominant-baseline": "central",
    fill: theme.background, "font-family": theme.fontFamily,
    "font-size": theme.fontSize - 3, "font-weight": "600",
  });
  label.textContent = labelText;
  group.appendChild(label);

  return group;
}

// ---------------------------------------------------------------------------
// Zoom / pan
// ---------------------------------------------------------------------------

function addZoomPan(svg: SVGSVGElement, content: SVGGElement, isLocked: () => boolean): void {
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
    if (isLocked()) return;
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
    if (e.button !== 0 || isLocked()) return;
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

// ---------------------------------------------------------------------------
// Main render entry point (synchronous — no external dependencies)
// ---------------------------------------------------------------------------

export function renderSVG(
  layout: LayoutResult,
  options: FloraOptions = {},
): SVGSVGElement {
  const theme = resolveTheme(options.theme);
  const padding = 60;
  const sketch = theme.handDrawn;

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", "100%");
  svg.setAttribute("viewBox", `0 0 ${layout.width + padding * 2} ${layout.height + padding * 2}`);
  svg.style.background = theme.background;

  renderDefs(svg, theme, layout.nodes);

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
      stroke-width: ${theme.nodeStrokeWidth + 2};
    }
    .flora-highlighted-edge path {
      stroke-width: ${theme.edgeWidth + 1};
    }
  `;
  svg.appendChild(style);

  const content = el("g", { transform: `translate(${padding},${padding})` }) as SVGGElement;

  const sortedSubgraphs = [...layout.subgraphs].sort((a, b) => {
    const depthA = getSubgraphDepth(a, layout.subgraphs);
    const depthB = getSubgraphDepth(b, layout.subgraphs);
    return depthA - depthB;
  });

  for (const sg of sortedSubgraphs) {
    content.appendChild(sketch ? renderSubgraphSketch(sg, theme) : renderSubgraph(sg, theme));
  }

  for (const edge of layout.edges) {
    content.appendChild(sketch ? renderEdgeSketch(edge, theme) : renderEdge(edge, theme));
  }

  for (const node of layout.nodes) {
    content.appendChild(sketch ? renderNodeSketch(node, theme, options) : renderNode(node, theme, options));
  }

  svg.appendChild(content);

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

      content.querySelectorAll<SVGGElement>(".flora-node").forEach((nodeEl) => {
        const id = nodeEl.getAttribute("data-id");
        if (!id || !highlighted.has(id)) {
          nodeEl.classList.add("flora-dimmed");
        } else if (id === nodeId) {
          nodeEl.classList.add("flora-highlighted-source");
        }
      });

      content.querySelectorAll<SVGGElement>(".flora-edge").forEach((edgeEl) => {
        const from = edgeEl.getAttribute("data-from");
        const to = edgeEl.getAttribute("data-to");
        if (from && to && highlighted.has(from) && highlighted.has(to)) {
          edgeEl.classList.add("flora-highlighted-edge");
        } else {
          edgeEl.classList.add("flora-dimmed");
        }
      });

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

    svg.addEventListener("click", () => {
      if (highlightedNodeId) clearHighlight();
    });

    svg.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && highlightedNodeId) clearHighlight();
    });
    svg.setAttribute("tabindex", "0");

    addZoomPan(svg, content, () => highlightedNodeId !== null);
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
