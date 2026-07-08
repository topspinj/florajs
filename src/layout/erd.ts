import dagre from "@dagrejs/dagre";
import type { ERDAST, ERDLayoutResult, ERDLayoutEntity, ERDLayoutRelationship, FloraTheme } from "../types.js";
import { defaultTheme } from "../themes/default.js";

const ENTITY_MIN_WIDTH = 180;
const HEADER_HEIGHT = 36;
const ATTR_ROW_HEIGHT = 28;

function estimateTextWidth(text: string, fontSize: number): number {
  return text.length * fontSize * 0.62;
}

type Point = { x: number; y: number };

function intersectEntityRect(entity: ERDLayoutEntity, toward: Point): Point {
  const dx = toward.x - entity.x;
  const dy = toward.y - entity.y;
  const hw = entity.width / 2;
  const hh = entity.height / 2;
  if (dx === 0 && dy === 0) return { x: entity.x, y: entity.y - hh };
  let sx: number, sy: number;
  if (Math.abs(dy) * hw > Math.abs(dx) * hh) {
    sy = dy > 0 ? hh : -hh;
    sx = (sy * dx) / dy;
  } else {
    sx = dx > 0 ? hw : -hw;
    sy = (sx * dy) / dx;
  }
  return { x: entity.x + sx, y: entity.y + sy };
}

export function computeERDLayout(ast: ERDAST, theme: FloraTheme = defaultTheme): ERDLayoutResult {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "LR", nodesep: 80, ranksep: 140, marginx: 40, marginy: 40 });
  g.setDefaultEdgeLabel(() => ({}));

  const dims = new Map<string, { width: number; height: number }>();

  // Keep in sync with NAME_COL_X constant in renderer/erd.ts and renderer/erd-string.ts
  const NAME_COL_X = 56;
  const BADGE_PAD = 10; // right-edge padding matching the renderer

  for (const entity of ast.entities) {
    let maxWidth = estimateTextWidth(entity.id, theme.fontSize + 2) + 48;
    for (const attr of entity.attributes) {
      const nameW = estimateTextWidth(attr.name, theme.fontSize - 1);
      const badgeW = attr.key ? estimateTextWidth(attr.key, theme.fontSize - 3) + 14 : 0;
      maxWidth = Math.max(maxWidth, NAME_COL_X + nameW + badgeW + BADGE_PAD + 8);
    }
    const width = Math.max(ENTITY_MIN_WIDTH, maxWidth);
    const height = HEADER_HEIGHT + entity.attributes.length * ATTR_ROW_HEIGHT + (entity.attributes.length > 0 ? 2 : 0);
    dims.set(entity.id, { width, height });
    g.setNode(entity.id, { width, height });
  }

  for (const rel of ast.relationships) {
    if (g.hasNode(rel.from) && g.hasNode(rel.to)) {
      g.setEdge(rel.from, rel.to, {});
    }
  }

  dagre.layout(g);

  const layoutEntities: ERDLayoutEntity[] = ast.entities.map((entity) => {
    const n = g.node(entity.id);
    return { id: entity.id, attributes: entity.attributes, x: n.x, y: n.y, width: n.width, height: n.height };
  });

  const entityMap = new Map(layoutEntities.map((e) => [e.id, e]));

  const layoutRelationships: ERDLayoutRelationship[] = ast.relationships
    .filter((rel) => g.hasNode(rel.from) && g.hasNode(rel.to))
    .map((rel) => {
      const edge = g.edge(rel.from, rel.to);
      const points: Point[] = edge?.points ? [...edge.points] : [];

      const fromEntity = entityMap.get(rel.from);
      const toEntity = entityMap.get(rel.to);

      if (fromEntity && points.length >= 2) {
        points[0] = intersectEntityRect(fromEntity, points[1]!);
      }
      if (toEntity && points.length >= 2) {
        points[points.length - 1] = intersectEntityRect(toEntity, points[points.length - 2]!);
      }

      return {
        from: rel.from,
        to: rel.to,
        label: rel.label,
        fromCardinality: rel.fromCardinality,
        toCardinality: rel.toCardinality,
        identifying: rel.identifying,
        points,
      };
    });

  const graphInfo = g.graph();
  return {
    entities: layoutEntities,
    relationships: layoutRelationships,
    width: graphInfo.width ?? 400,
    height: graphInfo.height ?? 300,
  };
}
