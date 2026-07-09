import type { ERDLayoutResult, ERDLayoutEntity, ERDLayoutRelationship, ERDCardinality, FloraTheme, FloraOptions } from "../types.js";
import { resolveTheme } from "../themes/index.js";
import type { ThemePreset } from "../types.js";

const HEADER_HEIGHT = 36;
const ATTR_ROW_HEIGHT = 28;
const MARK_DIST1 = 12;
const MARK_DIST2 = 24;
const MARK_DIST3 = 36;
const MARK_HALF = 10;
const CROW_SPREAD = 10;
const NAME_COL_X = 56;

export interface RenderERDStringOptions {
  theme?: ThemePreset | Partial<FloraTheme>;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function a(attrs: Record<string, string | number>): string {
  return Object.entries(attrs).map(([k, v]) => `${k}="${esc(String(v))}"`).join(" ");
}

function normalize(dx: number, dy: number): { x: number; y: number } {
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 0.001) return { x: 1, y: 0 };
  return { x: dx / len, y: dy / len };
}

// ---------------------------------------------------------------------------
// Entity box
// ---------------------------------------------------------------------------

function entityBoxSVG(entity: ERDLayoutEntity, theme: FloraTheme): string {
  const x = entity.x - entity.width / 2;
  const y = entity.y - entity.height / 2;
  const w = entity.width;
  const r = 4;
  const hh = HEADER_HEIGHT;
  let out = `<g class="flora-erd-entity" data-id="${esc(entity.id)}">`;

  // Background
  out += `<rect ${a({ x, y, width: w, height: entity.height, rx: r, ry: r, fill: theme.nodeColors.fill, stroke: theme.nodeColors.stroke, "stroke-width": theme.nodeStrokeWidth })}/>`;

  // Header path (rounded top, flat bottom)
  const hp = `M ${x + r},${y} L ${x + w - r},${y} A ${r} ${r} 0 0 1 ${x + w},${y + r} L ${x + w},${y + hh} L ${x},${y + hh} L ${x},${y + r} A ${r} ${r} 0 0 1 ${x + r},${y} Z`;
  out += `<path d="${esc(hp)}" fill="${esc(theme.nodeColors.stroke)}" stroke="none"/>`;

  // Entity name
  out += `<text ${a({ x: entity.x, y: y + hh / 2 + 1, "text-anchor": "middle", "dominant-baseline": "central", fill: theme.background, "font-family": theme.fontFamily, "font-size": theme.fontSize + 1, "font-weight": "700" })}>${esc(entity.id)}</text>`;

  // Attribute rows
  const nameColX = entity.attributes.reduce(
    (mx, a) => Math.max(mx, a.type.length * (theme.fontSize - 2) * 0.62 + 14),
    NAME_COL_X,
  );
  for (let i = 0; i < entity.attributes.length; i++) {
    const attr = entity.attributes[i]!;
    const rowY = y + hh + i * ATTR_ROW_HEIGHT;
    const midY = rowY + ATTR_ROW_HEIGHT / 2 + 1;

    if (i % 2 === 1) {
      out += `<rect ${a({ x, y: rowY, width: w, height: ATTR_ROW_HEIGHT, fill: theme.subgraphColors.fill, opacity: "0.6", stroke: "none" })}/>`;
    }
    if (i > 0) {
      out += `<line ${a({ x1: x, y1: rowY, x2: x + w, y2: rowY, stroke: theme.nodeColors.stroke, "stroke-width": "0.5", opacity: "0.3" })}/>`;
    }

    out += `<text ${a({ x: x + 10, y: midY, "text-anchor": "start", "dominant-baseline": "central", fill: theme.edgeColors.label, "font-family": theme.fontFamily, "font-size": theme.fontSize - 2, "font-style": "italic" })}>${esc(attr.type)}</text>`;
    out += `<text ${a({ x: x + nameColX, y: midY, "text-anchor": "start", "dominant-baseline": "central", fill: theme.nodeColors.text, "font-family": theme.fontFamily, "font-size": theme.fontSize - 1, "font-weight": attr.key ? "600" : "400" })}>${esc(attr.name)}</text>`;
    if (attr.key) {
      out += `<text ${a({ x: x + w - 10, y: midY, "text-anchor": "end", "dominant-baseline": "central", fill: theme.shapeColors.stadium.stroke, "font-family": theme.fontFamily, "font-size": theme.fontSize - 3, "font-weight": "700" })}>${esc(attr.key)}</text>`;
    }
  }

  if (entity.attributes.length > 0) {
    out += `<line ${a({ x1: x, y1: y + hh, x2: x + w, y2: y + hh, stroke: theme.nodeColors.stroke, "stroke-width": "1" })}/>`;
  }

  // Border on top
  out += `<rect ${a({ x, y, width: w, height: entity.height, rx: r, ry: r, fill: "none", stroke: theme.nodeColors.stroke, "stroke-width": theme.nodeStrokeWidth })}/>`;

  return out + "</g>";
}

// ---------------------------------------------------------------------------
// Cardinality marks
// ---------------------------------------------------------------------------

function cardinalityMarksSVG(
  endpoint: { x: number; y: number },
  dir: { x: number; y: number },
  cardinality: ERDCardinality,
  stroke: string,
): string {
  const px = -dir.y, py = dir.x;
  const inner = { x: endpoint.x + dir.x * MARK_DIST1, y: endpoint.y + dir.y * MARK_DIST1 };
  const outer = { x: endpoint.x + dir.x * MARK_DIST2, y: endpoint.y + dir.y * MARK_DIST2 };
  const lp = { stroke, "stroke-width": "1.5", "stroke-linecap": "round" };

  const tick = (cx: number, cy: number) =>
    `<line ${a({ x1: cx + px * MARK_HALF, y1: cy + py * MARK_HALF, x2: cx - px * MARK_HALF, y2: cy - py * MARK_HALF, ...lp })}/>`;

  const circ = (cx: number, cy: number) =>
    `<circle ${a({ cx, cy, r: 5, fill: "none", ...lp })}/>`;

  const beyond = { x: endpoint.x + dir.x * MARK_DIST3, y: endpoint.y + dir.y * MARK_DIST3 };

  const crowFoot = () =>
    `<line ${a({ x1: outer.x, y1: outer.y, x2: endpoint.x, y2: endpoint.y, ...lp })}/>`
    + `<line ${a({ x1: outer.x, y1: outer.y, x2: inner.x + px * CROW_SPREAD, y2: inner.y + py * CROW_SPREAD, ...lp })}/>`
    + `<line ${a({ x1: outer.x, y1: outer.y, x2: inner.x - px * CROW_SPREAD, y2: inner.y - py * CROW_SPREAD, ...lp })}/>`;

  switch (cardinality) {
    case "exactly-one": return tick(inner.x, inner.y) + tick(outer.x, outer.y);
    case "zero-or-one": return tick(inner.x, inner.y) + circ(outer.x, outer.y);
    case "one-or-many": return tick(inner.x, inner.y) + crowFoot();
    case "zero-or-many": return circ(beyond.x, beyond.y) + crowFoot();
  }
}

// ---------------------------------------------------------------------------
// Relationship line
// ---------------------------------------------------------------------------

function relationshipSVG(rel: ERDLayoutRelationship, theme: FloraTheme): string {
  if (rel.points.length < 2) return "";
  let d = `M ${rel.points[0]!.x} ${rel.points[0]!.y}`;
  for (let i = 1; i < rel.points.length; i++) d += ` L ${rel.points[i]!.x} ${rel.points[i]!.y}`;

  const lineAttrs: Record<string, string | number> = {
    d, fill: "none", stroke: theme.edgeColors.stroke,
    "stroke-width": theme.edgeWidth, "stroke-linecap": "round", "stroke-linejoin": "round",
  };
  if (!rel.identifying) lineAttrs["stroke-dasharray"] = "6,4";
  let out = `<g class="flora-erd-rel" data-from="${esc(rel.from)}" data-to="${esc(rel.to)}">`;
  out += `<path ${a(lineAttrs)}/>`;

  const fp = rel.points[0]!;
  const fn = rel.points[1]!;
  out += cardinalityMarksSVG(fp, normalize(fn.x - fp.x, fn.y - fp.y), rel.fromCardinality, theme.edgeColors.stroke);

  const tp = rel.points[rel.points.length - 1]!;
  const tn = rel.points[rel.points.length - 2]!;
  out += cardinalityMarksSVG(tp, normalize(tn.x - tp.x, tn.y - tp.y), rel.toCardinality, theme.edgeColors.stroke);

  if (rel.label) {
    const mid = rel.points[Math.floor(rel.points.length / 2)]!;
    const lw = rel.label.length * 7 + 16;
    const lh = 20;
    out += `<rect ${a({ x: mid.x - lw / 2, y: mid.y - lh / 2, width: lw, height: lh, rx: 4, fill: theme.edgeColors.labelBackground, stroke: theme.edgeColors.stroke, "stroke-width": "0.5" })}/>`;
    out += `<text ${a({ x: mid.x, y: mid.y + 1, "text-anchor": "middle", "dominant-baseline": "central", fill: theme.edgeColors.label, "font-family": theme.fontFamily, "font-size": theme.fontSize - 3, "font-style": "italic" })}>${esc(rel.label)}</text>`;
  }

  return out + "</g>";
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export function renderERDString(layout: ERDLayoutResult, options: RenderERDStringOptions = {}): string {
  const theme = resolveTheme(options.theme);
  const padding = 60;
  const vw = layout.width + padding * 2;
  const vh = layout.height + padding * 2;

  let out = `<svg xmlns="http://www.w3.org/2000/svg" class="flora-svg flora-erd" width="100%" height="100%" viewBox="0 0 ${vw} ${vh}" style="background:${esc(theme.background)}">`;
  out += `<g transform="translate(${padding},${padding})">`;

  for (const rel of layout.relationships) out += relationshipSVG(rel, theme);
  for (const entity of layout.entities) out += entityBoxSVG(entity, theme);

  out += "</g></svg>";
  return out;
}
