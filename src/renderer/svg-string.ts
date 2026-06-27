import type { LayoutResult, LayoutNode, LayoutEdge, LayoutSubgraph, FloraTheme, NodeColorSet } from "../types.js";
import { resolveTheme } from "../themes/index.js";
import type { ThemePreset } from "../types.js";

// ---------------------------------------------------------------------------
// String SVG helpers
// ---------------------------------------------------------------------------

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function attrs(a: Record<string, string | number>): string {
  return Object.entries(a)
    .map(([k, v]) => `${k}="${escapeXml(String(v))}"`)
    .join(" ");
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
// Sketch utilities (identical math to svg.ts, string output)
// ---------------------------------------------------------------------------

const SKETCH_AMP = 1.2;

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

function skLine(x1: number, y1: number, x2: number, y2: number, rng: Rng, amp = SKETCH_AMP): string {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1) return `L ${x2} ${y2} `;
  const px = -dy / len, py = dx / len;
  const n = Math.max(2, Math.ceil(len / 25));
  let d = "";
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const j = i < n ? rng.offset(amp) : 0;
    d += `L ${(x1 + dx * t + px * j).toFixed(2)} ${(y1 + dy * t + py * j).toFixed(2)} `;
  }
  return d;
}

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

function sketchShapeStr(
  pathFn: (rng: Rng) => string, seed: number,
  fill: string, stroke: string, strokeWidth: number,
  extraClass?: string,
): string {
  let out = "";
  const cls = extraClass ? ` class="${extraClass}"` : "";
  out += `<path${cls} ${attrs({ d: pathFn(new Rng(seed)), fill, stroke: "none" })}/>`;
  for (const s of [seed + 101, seed + 202]) {
    out += `<path ${attrs({
      d: pathFn(new Rng(s)),
      fill: "none", stroke, "stroke-width": strokeWidth,
      "stroke-linecap": "round", "stroke-linejoin": "round",
    })}/>`;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Defs
// ---------------------------------------------------------------------------

function renderDefs(theme: FloraTheme, nodes: LayoutNode[], id: string): string {
  let defs = "<defs>";

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
    defs += `<linearGradient ${attrs({ id: `flora-grad-${key}-${id}`, x1: "0", y1: "0", x2: "0", y2: "1" })}>`;
    defs += `<stop ${attrs({ offset: "0%", "stop-color": colors.fill })}/>`;
    defs += `<stop ${attrs({ offset: "100%", "stop-color": colors.fillGradientEnd })}/>`;
    defs += `</linearGradient>`;
  }

  if (theme.shadow) {
    defs += `<filter ${attrs({ id: `flora-shadow-${id}`, x: "-20%", y: "-20%", width: "140%", height: "150%" })}>`;
    defs += `<feGaussianBlur ${attrs({ in: "SourceAlpha", stdDeviation: "3" })}/>`;
    defs += `<feOffset ${attrs({ dx: "0", dy: "2", result: "shadow" })}/>`;
    defs += `<feFlood ${attrs({ "flood-color": "#0A0F25", "flood-opacity": "0.08" })}/>`;
    defs += `<feComposite ${attrs({ in2: "shadow", operator: "in" })}/>`;
    defs += `<feMerge><feMergeNode/><feMergeNode ${attrs({ in: "SourceGraphic" })}/></feMerge>`;
    defs += `</filter>`;
  }

  defs += `<marker ${attrs({
    id: `flora-arrowhead-${id}`,
    markerWidth: "12", markerHeight: "8",
    refX: "11", refY: "4",
    orient: "auto", markerUnits: "userSpaceOnUse",
  })}>`;
  defs += `<path ${attrs({
    d: "M 1 1 L 10 4 L 1 7",
    fill: "none", stroke: theme.edgeColors.stroke,
    "stroke-width": "1.5", "stroke-linecap": "round", "stroke-linejoin": "round",
  })}/>`;
  defs += `</marker>`;

  defs += "</defs>";
  return defs;
}

// ---------------------------------------------------------------------------
// Node renderers
// ---------------------------------------------------------------------------

function renderNodeStr(node: LayoutNode, theme: FloraTheme, id: string): string {
  const x = node.x - node.width / 2;
  const y = node.y - node.height / 2;
  const colors = colorsForShape(node.shape, theme);
  const gradKey = gradKeyForShape(node.shape);
  let inner = "";

  switch (node.shape) {
    case "diamond": {
      const cx = node.x, cy = node.y;
      const hw = node.width / 2, hh = node.height / 2;
      const points = `${cx},${cy - hh} ${cx + hw},${cy} ${cx},${cy + hh} ${cx - hw},${cy}`;
      inner += `<polygon class="flora-node-shape" ${attrs({
        points, fill: `url(#flora-grad-${gradKey}-${id})`,
        stroke: colors.stroke, "stroke-width": theme.nodeStrokeWidth, "stroke-linejoin": "round",
        ...(theme.shadow ? { filter: `url(#flora-shadow-${id})` } : {}),
      })}/>`;
      break;
    }
    case "circle": {
      const r = Math.max(node.width, node.height) / 2;
      inner += `<circle class="flora-node-shape" ${attrs({
        cx: node.x, cy: node.y, r,
        fill: `url(#flora-grad-${gradKey}-${id})`,
        stroke: colors.stroke, "stroke-width": theme.nodeStrokeWidth,
        ...(theme.shadow ? { filter: `url(#flora-shadow-${id})` } : {}),
      })}/>`;
      break;
    }
    case "cylinder": {
      const ry = 10;
      const bodyTop = y + ry;
      const bodyBottom = y + node.height - ry;
      const d = `M ${x} ${bodyTop} A ${node.width / 2} ${ry} 0 0 1 ${x + node.width} ${bodyTop} L ${x + node.width} ${bodyBottom} A ${node.width / 2} ${ry} 0 0 1 ${x} ${bodyBottom} Z`;
      inner += `<path class="flora-node-shape" ${attrs({
        d, fill: `url(#flora-grad-${gradKey}-${id})`,
        stroke: colors.stroke, "stroke-width": theme.nodeStrokeWidth,
        ...(theme.shadow ? { filter: `url(#flora-shadow-${id})` } : {}),
      })}/>`;
      inner += `<ellipse class="flora-node-shape" ${attrs({
        cx: node.x, cy: bodyTop,
        rx: node.width / 2, ry,
        fill: `url(#flora-grad-${gradKey}-${id})`,
        stroke: colors.stroke, "stroke-width": theme.nodeStrokeWidth,
      })}/>`;
      break;
    }
    case "queue": {
      const rx = 12;
      const bodyLeft = x + rx;
      const bodyRight = x + node.width - rx;
      const d = `M ${bodyLeft} ${y} L ${bodyRight} ${y} A ${rx} ${node.height / 2} 0 0 1 ${bodyRight} ${y + node.height} L ${bodyLeft} ${y + node.height} A ${rx} ${node.height / 2} 0 0 1 ${bodyLeft} ${y}`;
      inner += `<path class="flora-node-shape" ${attrs({
        d, fill: `url(#flora-grad-${gradKey}-${id})`,
        stroke: colors.stroke, "stroke-width": theme.nodeStrokeWidth,
        ...(theme.shadow ? { filter: `url(#flora-shadow-${id})` } : {}),
      })}/>`;
      inner += `<ellipse class="flora-node-shape" ${attrs({
        cx: bodyRight, cy: node.y,
        rx, ry: node.height / 2,
        fill: `url(#flora-grad-${gradKey}-${id})`,
        stroke: colors.stroke, "stroke-width": theme.nodeStrokeWidth,
      })}/>`;
      break;
    }
    case "stadium":
      inner += `<rect class="flora-node-shape" ${attrs({
        x, y, width: node.width, height: node.height,
        rx: node.height / 2, ry: node.height / 2,
        fill: `url(#flora-grad-${gradKey}-${id})`,
        stroke: colors.stroke, "stroke-width": theme.nodeStrokeWidth,
        ...(theme.shadow ? { filter: `url(#flora-shadow-${id})` } : {}),
      })}/>`;
      break;
    case "rounded":
      inner += `<rect class="flora-node-shape" ${attrs({
        x, y, width: node.width, height: node.height,
        rx: 12, ry: 12,
        fill: `url(#flora-grad-${gradKey}-${id})`,
        stroke: colors.stroke, "stroke-width": theme.nodeStrokeWidth,
        ...(theme.shadow ? { filter: `url(#flora-shadow-${id})` } : {}),
      })}/>`;
      break;
    default:
      inner += `<rect class="flora-node-shape" ${attrs({
        x, y, width: node.width, height: node.height,
        rx: theme.nodeRadius, ry: theme.nodeRadius,
        fill: `url(#flora-grad-${gradKey}-${id})`,
        stroke: colors.stroke, "stroke-width": theme.nodeStrokeWidth,
        ...(theme.shadow ? { filter: `url(#flora-shadow-${id})` } : {}),
      })}/>`;
  }

  const textYOffset = node.shape === "cylinder" ? 6 : 1;
  inner += `<text ${attrs({
    x: node.x, y: node.y + textYOffset,
    "text-anchor": "middle", "dominant-baseline": "central",
    fill: colors.text, "font-family": theme.fontFamily,
    "font-size": theme.fontSize, "font-weight": "400",
  })}>${escapeXml(node.label)}</text>`;

  return `<g class="flora-node" data-id="${escapeXml(node.id)}">${inner}</g>`;
}

function renderNodeSketchStr(node: LayoutNode, theme: FloraTheme): string {
  const x = node.x - node.width / 2;
  const y = node.y - node.height / 2;
  const colors = colorsForShape(node.shape, theme);
  const seed = hashSeed(node.id);
  const sw = theme.nodeStrokeWidth;
  let inner = "";

  switch (node.shape) {
    case "diamond": {
      const cx = node.x, cy = node.y;
      const hw = node.width / 2, hh = node.height / 2;
      inner += sketchShapeStr(
        (rng) => skPolygon([[cx, cy - hh], [cx + hw, cy], [cx, cy + hh], [cx - hw, cy]], rng),
        seed, colors.fill, colors.stroke, sw, "flora-node-shape",
      );
      break;
    }
    case "circle": {
      const r = Math.max(node.width, node.height) / 2;
      inner += sketchShapeStr(
        (rng) => skEllipse(node.x, node.y, r, r, rng),
        seed, colors.fill, colors.stroke, sw, "flora-node-shape",
      );
      break;
    }
    case "stadium":
      inner += sketchShapeStr(
        (rng) => skStadium(x, y, node.width, node.height, rng),
        seed, colors.fill, colors.stroke, sw, "flora-node-shape",
      );
      break;
    case "rounded":
      inner += sketchShapeStr(
        (rng) => skRoundedRect(x, y, node.width, node.height, 12, rng),
        seed, colors.fill, colors.stroke, sw, "flora-node-shape",
      );
      break;
    case "cylinder": {
      const ry = 10;
      const bodyTop = y + ry;
      const bodyBottom = y + node.height - ry;
      inner += sketchShapeStr(
        (rng) => {
          let d = `M ${(x + rng.offset(0.3)).toFixed(2)} ${(bodyTop + rng.offset(0.3)).toFixed(2)} `;
          d += skLine(x, bodyTop, x, bodyBottom, rng);
          d += skArc(node.x, bodyBottom, node.width / 2, ry, Math.PI, 0, rng, 12);
          d += skLine(x + node.width, bodyBottom, x + node.width, bodyTop, rng);
          d += skArc(node.x, bodyTop, node.width / 2, ry, 0, -Math.PI, rng, 12);
          return d + "Z";
        },
        seed, colors.fill, colors.stroke, sw, "flora-node-shape",
      );
      inner += sketchShapeStr(
        (rng) => skEllipse(node.x, bodyTop, node.width / 2, ry, rng),
        seed + 50, colors.fill, colors.stroke, sw,
      );
      break;
    }
    case "queue": {
      const rx = 12;
      const bodyLeft = x + rx;
      const bodyRight = x + node.width - rx;
      inner += sketchShapeStr(
        (rng) => {
          let d = `M ${(bodyLeft + rng.offset(0.3)).toFixed(2)} ${(y + rng.offset(0.3)).toFixed(2)} `;
          d += skLine(bodyLeft, y, bodyRight, y, rng);
          d += skArc(bodyRight, node.y, rx, node.height / 2, -Math.PI / 2, Math.PI / 2, rng, 8);
          d += skLine(bodyRight, y + node.height, bodyLeft, y + node.height, rng);
          d += skArc(bodyLeft, node.y, rx, node.height / 2, Math.PI / 2, Math.PI * 1.5, rng, 8);
          return d + "Z";
        },
        seed, colors.fill, colors.stroke, sw, "flora-node-shape",
      );
      inner += sketchShapeStr(
        (rng) => skEllipse(bodyRight, node.y, rx, node.height / 2, rng),
        seed + 50, colors.fill, colors.stroke, sw,
      );
      break;
    }
    default:
      inner += sketchShapeStr(
        (rng) => skRect(x, y, node.width, node.height, rng),
        seed, colors.fill, colors.stroke, sw, "flora-node-shape",
      );
  }

  const textYOffset = node.shape === "cylinder" ? 6 : 1;
  inner += `<text ${attrs({
    x: node.x, y: node.y + textYOffset,
    "text-anchor": "middle", "dominant-baseline": "central",
    fill: colors.text, "font-family": theme.fontFamily,
    "font-size": theme.fontSize, "font-weight": "400",
  })}>${escapeXml(node.label)}</text>`;

  return `<g class="flora-node" data-id="${escapeXml(node.id)}">${inner}</g>`;
}

// ---------------------------------------------------------------------------
// Edge renderers
// ---------------------------------------------------------------------------

function buildEdgePath(points: Array<{ x: number; y: number }>): string {
  if (points.length < 2) return "";
  let d = `M ${points[0]!.x} ${points[0]!.y}`;
  if (points.length === 2) {
    d += ` L ${points[1]!.x} ${points[1]!.y}`;
    return d;
  }
  for (let i = 1; i < points.length - 1; i++) {
    const curr = points[i]!;
    const next = points[i + 1]!;
    const mx = (curr.x + next.x) / 2;
    const my = (curr.y + next.y) / 2;
    d += ` Q ${curr.x} ${curr.y} ${mx} ${my}`;
  }
  const last = points[points.length - 1]!;
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

function renderEdgeStr(edge: LayoutEdge, theme: FloraTheme, id: string): string {
  let inner = "";
  const strokeWidth = edge.style === "thick" ? theme.edgeWidth * 2 : theme.edgeWidth;
  const dashAttr = edge.style === "dotted" ? ` stroke-dasharray="6,4"` : "";

  inner += `<path ${attrs({
    d: buildEdgePath(edge.points),
    fill: "none", stroke: theme.edgeColors.stroke,
    "stroke-width": strokeWidth,
    "stroke-linecap": "round", "stroke-linejoin": "round",
    "marker-end": `url(#flora-arrowhead-${id})`,
  })}${dashAttr}/>`;

  if (edge.label) {
    const midIdx = Math.floor(edge.points.length / 2);
    const mid = edge.points[midIdx]!;
    const labelWidth = edge.label.length * 8 + 20;
    const labelHeight = 24;
    inner += `<rect ${attrs({
      x: mid.x - labelWidth / 2, y: mid.y - labelHeight / 2,
      width: labelWidth, height: labelHeight, rx: 4,
      fill: theme.edgeColors.labelBackground,
      stroke: theme.edgeColors.stroke, "stroke-width": "1",
    })}/>`;
    inner += `<text ${attrs({
      x: mid.x, y: mid.y + 1,
      "text-anchor": "middle", "dominant-baseline": "central",
      fill: theme.edgeColors.label, "font-family": theme.fontFamily,
      "font-size": theme.fontSize - 3, "font-weight": "400",
    })}>${escapeXml(edge.label)}</text>`;
  }

  return `<g class="flora-edge" data-from="${escapeXml(edge.from)}" data-to="${escapeXml(edge.to)}">${inner}</g>`;
}

function renderEdgeSketchStr(edge: LayoutEdge, theme: FloraTheme): string {
  const seed = hashSeed(edge.from + edge.to);
  const rng = new Rng(seed);
  const strokeWidth = edge.style === "thick" ? theme.edgeWidth * 2 : theme.edgeWidth;
  const dashAttr = edge.style === "dotted" ? ` stroke-dasharray="6,4"` : "";
  let inner = "";

  inner += `<path ${attrs({
    d: buildSketchyEdgePath(edge.points, rng),
    fill: "none", stroke: theme.edgeColors.stroke,
    "stroke-width": strokeWidth,
    "stroke-linecap": "round", "stroke-linejoin": "round",
  })}${dashAttr}/>`;

  // Sketchy arrowhead
  const last = edge.points[edge.points.length - 1]!;
  const prev = edge.points[edge.points.length - 2] || edge.points[0]!;
  const angle = Math.atan2(last.y - prev.y, last.x - prev.x);
  const aLen = 10, spread = Math.PI / 6;
  const a1x = last.x - aLen * Math.cos(angle - spread) + rng.offset(0.6);
  const a1y = last.y - aLen * Math.sin(angle - spread) + rng.offset(0.6);
  const a2x = last.x - aLen * Math.cos(angle + spread) + rng.offset(0.6);
  const a2y = last.y - aLen * Math.sin(angle + spread) + rng.offset(0.6);
  inner += `<path ${attrs({
    d: `M ${a1x.toFixed(2)} ${a1y.toFixed(2)} L ${last.x.toFixed(2)} ${last.y.toFixed(2)} L ${a2x.toFixed(2)} ${a2y.toFixed(2)}`,
    fill: "none", stroke: theme.edgeColors.stroke,
    "stroke-width": "1.5", "stroke-linecap": "round", "stroke-linejoin": "round",
  })}/>`;

  if (edge.label) {
    const midIdx = Math.floor(edge.points.length / 2);
    const mid = edge.points[midIdx]!;
    const labelWidth = edge.label.length * 8 + 20;
    const labelHeight = 24;
    inner += sketchShapeStr(
      (r) => skRoundedRect(mid.x - labelWidth / 2, mid.y - labelHeight / 2, labelWidth, labelHeight, 4, r),
      seed + 300, theme.edgeColors.labelBackground, theme.edgeColors.stroke, 1,
    );
    inner += `<text ${attrs({
      x: mid.x, y: mid.y + 1,
      "text-anchor": "middle", "dominant-baseline": "central",
      fill: theme.edgeColors.label, "font-family": theme.fontFamily,
      "font-size": theme.fontSize - 3, "font-weight": "400",
    })}>${escapeXml(edge.label)}</text>`;
  }

  return `<g class="flora-edge" data-from="${escapeXml(edge.from)}" data-to="${escapeXml(edge.to)}">${inner}</g>`;
}

// ---------------------------------------------------------------------------
// Subgraph renderers
// ---------------------------------------------------------------------------

function renderSubgraphStr(sg: LayoutSubgraph, theme: FloraTheme): string {
  let inner = "";
  inner += `<rect ${attrs({
    x: sg.x, y: sg.y, width: sg.width, height: sg.height,
    rx: 8, ry: 8,
    fill: theme.subgraphColors.fill,
    stroke: theme.subgraphColors.stroke,
    "stroke-width": "1.5", "stroke-dasharray": "6,3",
  })}/>`;

  const labelWidth = sg.label.length * 8 + 20;
  const labelHeight = 22;
  const labelX = sg.x + 12;
  const labelY = sg.y + 8;

  inner += `<rect ${attrs({
    x: labelX, y: labelY, width: labelWidth, height: labelHeight,
    rx: 4, ry: 4, fill: theme.subgraphColors.stroke,
  })}/>`;
  inner += `<text ${attrs({
    x: labelX + labelWidth / 2, y: labelY + labelHeight / 2 + 1,
    "text-anchor": "middle", "dominant-baseline": "central",
    fill: theme.background, "font-family": theme.fontFamily,
    "font-size": theme.fontSize - 3, "font-weight": "600",
  })}>${escapeXml(sg.label)}</text>`;

  return `<g class="flora-subgraph" data-id="${escapeXml(sg.id)}">${inner}</g>`;
}

function renderSubgraphSketchStr(sg: LayoutSubgraph, theme: FloraTheme): string {
  const seed = hashSeed(sg.id);
  let inner = "";

  // Sketchy rect with dashed strokes
  const fillPath = `<path ${attrs({ d: skRoundedRect(sg.x, sg.y, sg.width, sg.height, 8, new Rng(seed)), fill: theme.subgraphColors.fill, stroke: "none" })}/>`;
  let strokePaths = "";
  for (const s of [seed + 101, seed + 202]) {
    strokePaths += `<path ${attrs({
      d: skRoundedRect(sg.x, sg.y, sg.width, sg.height, 8, new Rng(s)),
      fill: "none", stroke: theme.subgraphColors.stroke,
      "stroke-width": 1.5, "stroke-linecap": "round", "stroke-linejoin": "round",
      "stroke-dasharray": "6,3",
    })}/>`;
  }
  inner += fillPath + strokePaths;

  const labelWidth = sg.label.length * 8 + 20;
  const labelHeight = 22;
  const labelX = sg.x + 12;
  const labelY = sg.y + 8;

  inner += sketchShapeStr(
    (rng) => skRoundedRect(labelX, labelY, labelWidth, labelHeight, 4, rng),
    seed + 500, theme.subgraphColors.stroke, theme.subgraphColors.stroke, 1,
  );
  inner += `<text ${attrs({
    x: labelX + labelWidth / 2, y: labelY + labelHeight / 2 + 1,
    "text-anchor": "middle", "dominant-baseline": "central",
    fill: theme.background, "font-family": theme.fontFamily,
    "font-size": theme.fontSize - 3, "font-weight": "600",
  })}>${escapeXml(sg.label)}</text>`;

  return `<g class="flora-subgraph" data-id="${escapeXml(sg.id)}">${inner}</g>`;
}

// ---------------------------------------------------------------------------
// Main entry
// ---------------------------------------------------------------------------

function getSubgraphDepth(sg: LayoutSubgraph, all: LayoutSubgraph[]): number {
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

export interface RenderSVGStringOptions {
  theme?: ThemePreset | Partial<FloraTheme>;
}

export function renderSVGString(layout: LayoutResult, options: RenderSVGStringOptions = {}): string {
  const theme = resolveTheme(options.theme);
  const padding = 60;
  const sketch = theme.handDrawn;
  const id = "s";

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 ${layout.width + padding * 2} ${layout.height + padding * 2}" style="background:${escapeXml(theme.background)}">`;

  svg += renderDefs(theme, layout.nodes, id);

  let content = "";

  const sortedSubgraphs = [...layout.subgraphs].sort((a, b) =>
    getSubgraphDepth(a, layout.subgraphs) - getSubgraphDepth(b, layout.subgraphs),
  );

  for (const sg of sortedSubgraphs) {
    content += sketch ? renderSubgraphSketchStr(sg, theme) : renderSubgraphStr(sg, theme);
  }
  for (const edge of layout.edges) {
    content += sketch ? renderEdgeSketchStr(edge, theme) : renderEdgeStr(edge, theme, id);
  }
  for (const node of layout.nodes) {
    content += sketch ? renderNodeSketchStr(node, theme) : renderNodeStr(node, theme, id);
  }

  svg += `<g transform="translate(${padding},${padding})">${content}</g>`;
  svg += `</svg>`;

  return svg;
}
