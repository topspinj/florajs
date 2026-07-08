import type { ERDLayoutResult, ERDLayoutEntity, ERDLayoutRelationship, ERDCardinality, FloraTheme, FloraOptions } from "../types.js";
import { resolveTheme } from "../themes/index.js";

const HEADER_HEIGHT = 36;
const ATTR_ROW_HEIGHT = 28;
const MARK_DIST1 = 12; // inner mark distance from entity boundary
const MARK_DIST2 = 24; // crow-foot base / outer tick distance
const MARK_DIST3 = 36; // zero-circle distance (beyond crow-foot base)
const MARK_HALF = 10;  // half-width of perpendicular tick lines
const CROW_SPREAD = 10; // perpendicular spread of crow's-foot side prongs
const NAME_COL_X = 56; // fixed name-column start (leaves room for type column)

let _nextId = 0;
function uid(): string { return String(_nextId++); }

function el(tag: string, attrs: Record<string, string | number>): SVGElement {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

function normalize(dx: number, dy: number): { x: number; y: number } {
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 0.001) return { x: 1, y: 0 };
  return { x: dx / len, y: dy / len };
}

// ---------------------------------------------------------------------------
// Entity box
// ---------------------------------------------------------------------------

function renderEntityBox(entity: ERDLayoutEntity, theme: FloraTheme): SVGGElement {
  const group = el("g", { class: "flora-erd-entity", "data-id": entity.id }) as SVGGElement;
  const x = entity.x - entity.width / 2;
  const y = entity.y - entity.height / 2;
  const w = entity.width;

  // Background rect
  group.appendChild(el("rect", {
    x, y, width: w, height: entity.height,
    rx: 4, ry: 4,
    fill: theme.nodeColors.fill,
    stroke: theme.nodeColors.stroke,
    "stroke-width": theme.nodeStrokeWidth,
  }));

  // Header background — rounded-top, flat-bottom path
  const r = 4;
  const hh = HEADER_HEIGHT;
  group.appendChild(el("path", {
    d: `M ${x + r},${y} L ${x + w - r},${y} A ${r} ${r} 0 0 1 ${x + w},${y + r} L ${x + w},${y + hh} L ${x},${y + hh} L ${x},${y + r} A ${r} ${r} 0 0 1 ${x + r},${y} Z`,
    fill: theme.nodeColors.stroke,
    stroke: "none",
  }));

  // Entity name
  const headerText = el("text", {
    x: entity.x, y: y + hh / 2 + 1,
    "text-anchor": "middle", "dominant-baseline": "central",
    fill: theme.background,
    "font-family": theme.fontFamily, "font-size": theme.fontSize + 1, "font-weight": "700",
  });
  headerText.textContent = entity.id;
  group.appendChild(headerText);

  // Attribute rows
  for (let i = 0; i < entity.attributes.length; i++) {
    const attr = entity.attributes[i]!;
    const rowY = y + hh + i * ATTR_ROW_HEIGHT;
    const midY = rowY + ATTR_ROW_HEIGHT / 2 + 1;

    // Alternating row tint
    if (i % 2 === 1) {
      group.appendChild(el("rect", {
        x, y: rowY, width: w, height: ATTR_ROW_HEIGHT,
        fill: theme.subgraphColors.fill, opacity: "0.6",
        stroke: "none",
      }));
    }

    // Row divider
    if (i > 0) {
      group.appendChild(el("line", {
        x1: x, y1: rowY, x2: x + w, y2: rowY,
        stroke: theme.nodeColors.stroke, "stroke-width": "0.5", opacity: "0.3",
      }));
    }

    // Type (italic, left column)
    const typeEl = el("text", {
      x: x + 10, y: midY,
      "text-anchor": "start", "dominant-baseline": "central",
      fill: theme.edgeColors.label,
      "font-family": theme.fontFamily, "font-size": theme.fontSize - 2, "font-style": "italic",
    });
    typeEl.textContent = attr.type;
    group.appendChild(typeEl);

    // Name (center column)
    const nameEl = el("text", {
      x: x + NAME_COL_X, y: midY,
      "text-anchor": "start", "dominant-baseline": "central",
      fill: theme.nodeColors.text,
      "font-family": theme.fontFamily, "font-size": theme.fontSize - 1,
      "font-weight": attr.key ? "600" : "400",
    });
    nameEl.textContent = attr.name;
    group.appendChild(nameEl);

    // Key badge (right)
    if (attr.key) {
      const keyEl = el("text", {
        x: x + w - 10, y: midY,
        "text-anchor": "end", "dominant-baseline": "central",
        fill: theme.shapeColors.stadium.stroke,
        "font-family": theme.fontFamily, "font-size": theme.fontSize - 3, "font-weight": "700",
      });
      keyEl.textContent = attr.key;
      group.appendChild(keyEl);
    }
  }

  // Divider between header and attributes
  if (entity.attributes.length > 0) {
    group.appendChild(el("line", {
      x1: x, y1: y + hh, x2: x + w, y2: y + hh,
      stroke: theme.nodeColors.stroke, "stroke-width": "1",
    }));
  }

  // Re-draw border on top so it's crisp
  group.appendChild(el("rect", {
    x, y, width: w, height: entity.height,
    rx: 4, ry: 4,
    fill: "none",
    stroke: theme.nodeColors.stroke,
    "stroke-width": theme.nodeStrokeWidth,
  }));

  return group;
}

// ---------------------------------------------------------------------------
// Cardinality marks (crow's foot notation)
// ---------------------------------------------------------------------------

function drawCardinalityMarks(
  group: SVGGElement,
  endpoint: { x: number; y: number }, // point on entity boundary
  dir: { x: number; y: number },       // unit vector AWAY from entity (along the line)
  cardinality: ERDCardinality,
  stroke: string,
): void {
  const px = -dir.y;  // perpendicular unit vector
  const py = dir.x;

  // Positions along the line from the entity boundary outward
  const inner = { x: endpoint.x + dir.x * MARK_DIST1, y: endpoint.y + dir.y * MARK_DIST1 };
  const outer = { x: endpoint.x + dir.x * MARK_DIST2, y: endpoint.y + dir.y * MARK_DIST2 };
  // beyond: where the "zero" circle sits for zero-or-many — past the crow-foot base
  const beyond = { x: endpoint.x + dir.x * MARK_DIST3, y: endpoint.y + dir.y * MARK_DIST3 };

  const lineProps = { stroke, "stroke-width": "1.5", "stroke-linecap": "round" };

  const tick = (cx: number, cy: number) => el("line", {
    x1: cx + px * MARK_HALF, y1: cy + py * MARK_HALF,
    x2: cx - px * MARK_HALF, y2: cy - py * MARK_HALF,
    ...lineProps,
  });

  const circle = (cx: number, cy: number) => el("circle", {
    cx, cy, r: 5, fill: "none", ...lineProps,
  });

  // Three prongs from "outer" (crow-foot base) toward entity:
  //   center: outer → endpoint (straight along line)
  //   sides:  outer → (inner ± perp*CROW_SPREAD)
  const crowFoot = () => [
    el("line", { x1: outer.x, y1: outer.y, x2: endpoint.x, y2: endpoint.y, ...lineProps }),
    el("line", {
      x1: outer.x, y1: outer.y,
      x2: inner.x + px * CROW_SPREAD, y2: inner.y + py * CROW_SPREAD,
      ...lineProps,
    }),
    el("line", {
      x1: outer.x, y1: outer.y,
      x2: inner.x - px * CROW_SPREAD, y2: inner.y - py * CROW_SPREAD,
      ...lineProps,
    }),
  ];

  switch (cardinality) {
    case "exactly-one":
      group.appendChild(tick(inner.x, inner.y));
      group.appendChild(tick(outer.x, outer.y));
      break;
    case "zero-or-one":
      group.appendChild(tick(inner.x, inner.y));
      group.appendChild(circle(outer.x, outer.y));
      break;
    case "one-or-many":
      group.appendChild(tick(inner.x, inner.y));
      for (const f of crowFoot()) group.appendChild(f);
      break;
    case "zero-or-many":
      // Circle sits beyond the crow-foot base so it doesn't thread through the prongs
      group.appendChild(circle(beyond.x, beyond.y));
      for (const f of crowFoot()) group.appendChild(f);
      break;
  }
}

// ---------------------------------------------------------------------------
// Relationship line
// ---------------------------------------------------------------------------

function renderRelationship(rel: ERDLayoutRelationship, theme: FloraTheme): SVGGElement {
  const group = el("g", { class: "flora-erd-rel", "data-from": rel.from, "data-to": rel.to }) as SVGGElement;
  if (rel.points.length < 2) return group;

  // Main line
  let d = `M ${rel.points[0]!.x} ${rel.points[0]!.y}`;
  for (let i = 1; i < rel.points.length; i++) d += ` L ${rel.points[i]!.x} ${rel.points[i]!.y}`;
  const path = el("path", {
    d,
    fill: "none",
    stroke: theme.edgeColors.stroke,
    "stroke-width": theme.edgeWidth,
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
  });
  if (!rel.identifying) path.setAttribute("stroke-dasharray", "6,4");
  group.appendChild(path);

  // FROM end cardinality (at entity A boundary)
  const fp = rel.points[0]!;
  const fn = rel.points[1]!;
  drawCardinalityMarks(group, fp, normalize(fn.x - fp.x, fn.y - fp.y), rel.fromCardinality, theme.edgeColors.stroke);

  // TO end cardinality (at entity B boundary)
  const tp = rel.points[rel.points.length - 1]!;
  const tn = rel.points[rel.points.length - 2]!;
  drawCardinalityMarks(group, tp, normalize(tn.x - tp.x, tn.y - tp.y), rel.toCardinality, theme.edgeColors.stroke);

  // Relationship label at midpoint
  if (rel.label) {
    const midIdx = Math.floor(rel.points.length / 2);
    const mid = rel.points[midIdx]!;
    const lw = rel.label.length * 7 + 16;
    const lh = 20;
    group.appendChild(el("rect", {
      x: mid.x - lw / 2, y: mid.y - lh / 2, width: lw, height: lh,
      rx: 4, fill: theme.edgeColors.labelBackground,
      stroke: theme.edgeColors.stroke, "stroke-width": "0.5",
    }));
    const labelEl = el("text", {
      x: mid.x, y: mid.y + 1,
      "text-anchor": "middle", "dominant-baseline": "central",
      fill: theme.edgeColors.label,
      "font-family": theme.fontFamily, "font-size": theme.fontSize - 3, "font-style": "italic",
    });
    labelEl.textContent = rel.label;
    group.appendChild(labelEl);
  }

  return group;
}

// ---------------------------------------------------------------------------
// Zoom / pan (mirrors flowchart renderer)
// ---------------------------------------------------------------------------

function addZoomPan(svg: SVGSVGElement, content: SVGGElement): void {
  let scale = 1, tx = 0, ty = 0, panning = false, lx = 0, ly = 0;

  function vbScale(): number {
    const rect = svg.getBoundingClientRect();
    const vb = svg.viewBox.baseVal;
    return !vb || rect.width === 0 ? 1 : vb.width / rect.width;
  }
  function update(): void { content.setAttribute("transform", `translate(${tx},${ty}) scale(${scale})`); }

  svg.addEventListener("wheel", (e) => {
    e.preventDefault();
    const s = vbScale();
    const rect = svg.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * s;
    const my = (e.clientY - rect.top) * s;
    const ns = Math.max(0.1, Math.min(50, scale * (e.deltaY > 0 ? 0.92 : 1.08)));
    tx = mx - (mx - tx) * (ns / scale);
    ty = my - (my - ty) * (ns / scale);
    scale = ns;
    update();
  });
  svg.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    panning = true; lx = e.clientX; ly = e.clientY; svg.style.cursor = "grabbing";
  });
  svg.addEventListener("mousemove", (e) => {
    if (!panning) return;
    const s = vbScale();
    tx += (e.clientX - lx) * s; ty += (e.clientY - ly) * s;
    lx = e.clientX; ly = e.clientY;
    update();
  });
  svg.addEventListener("mouseup", () => { panning = false; svg.style.cursor = "grab"; });
  svg.addEventListener("mouseleave", () => { panning = false; svg.style.cursor = "grab"; });
  svg.style.cursor = "grab";
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export function renderERDSVG(layout: ERDLayoutResult, options: FloraOptions = {}): SVGSVGElement {
  const theme = resolveTheme(options.theme);
  const padding = 60;

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  svg.setAttribute("class", "flora-svg flora-erd");
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", "100%");
  svg.setAttribute("viewBox", `0 0 ${layout.width + padding * 2} ${layout.height + padding * 2}`);
  svg.style.background = theme.background;

  const content = el("g", { transform: `translate(${padding},${padding})` }) as SVGGElement;

  // Relationships behind entities
  for (const rel of layout.relationships) content.appendChild(renderRelationship(rel, theme));
  for (const entity of layout.entities) content.appendChild(renderEntityBox(entity, theme));

  svg.appendChild(content);

  if (options.interactive !== false) addZoomPan(svg, content);

  return svg;
}
