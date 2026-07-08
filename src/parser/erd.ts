import type { ERDAST, ERDEntity, ERDRelationship, ERDAttribute, ERDCardinality, ParseWarning } from "../types.js";

// Cardinality marker legend:
//   Left side of line (outer → inner, left-to-right):
//     "||"  → exactly-one    "|o"  → zero-or-one
//     "}|"  → one-or-many    "}o"  → zero-or-many
//   Right side of line (inner → outer, left-to-right):
//     "||"  → exactly-one    "o|"  → zero-or-one
//     "|{"  → one-or-many    "o{"  → zero-or-many

function parseLeftCardinality(s: string): ERDCardinality {
  const outer = s[0]!;
  const inner = s[1]!;
  const isMany = outer === "}" || outer === "{";
  const isZero = inner === "o";
  if (isMany) return isZero ? "zero-or-many" : "one-or-many";
  if (isZero) return "zero-or-one";
  return "exactly-one";
}

function parseRightCardinality(s: string): ERDCardinality {
  const inner = s[0]!;
  const outer = s[1]!;
  const isMany = outer === "}" || outer === "{";
  const isZero = inner === "o";
  if (isMany) return isZero ? "zero-or-many" : "one-or-many";
  if (isZero) return "zero-or-one";
  return "exactly-one";
}

const ENTITY_ID = "[A-Za-z][A-Za-z0-9_-]*";
const CARD_CHARS = "[|o}{]{2}";
const REL_TYPE = "(?:--|\\.\\.)+";

const REL_RE = new RegExp(
  `^(${ENTITY_ID})\\s+(${CARD_CHARS})(${REL_TYPE})(${CARD_CHARS})\\s+(${ENTITY_ID})\\s*:\\s*"?([^"]*?)"?\\s*$`,
);

const ENTITY_BLOCK_RE = new RegExp(`^(${ENTITY_ID})\\s*\\{\\s*$`);

const ATTR_RE = /^(\S+)\s+(\S+)(?:\s+(PK|FK|UK)(?:\s*,\s*(PK|FK|UK))?)?(?:\s+"([^"]*)")?$/;

export function parseERD(input: string, warnings: ParseWarning[] = []): ERDAST {
  const entities = new Map<string, ERDEntity>();
  const relationships: ERDRelationship[] = [];

  function ensureEntity(id: string): ERDEntity {
    if (!entities.has(id)) entities.set(id, { id, attributes: [] });
    return entities.get(id)!;
  }

  const lines = input.split("\n");
  let i = 0;

  // Skip to (and past) the "erDiagram" header line
  while (i < lines.length) {
    const t = lines[i]!.trim();
    i++;
    if (t === "erDiagram" || t.startsWith("erDiagram ")) break;
  }

  while (i < lines.length) {
    const raw = lines[i]!;
    const trimmed = raw.trim();
    i++;

    if (!trimmed || trimmed.startsWith("%%")) continue;

    // Entity block: "ENTITY_NAME {"
    const blockMatch = trimmed.match(ENTITY_BLOCK_RE);
    if (blockMatch) {
      const entity = ensureEntity(blockMatch[1]!);
      while (i < lines.length) {
        const attrRaw = lines[i]!;
        const attrTrimmed = attrRaw.trim();
        i++;
        if (attrTrimmed === "}") break;
        if (!attrTrimmed || attrTrimmed.startsWith("%%")) continue;

        const m = attrTrimmed.match(ATTR_RE);
        if (m) {
          const attr: ERDAttribute = { type: m[1]!, name: m[2]! };
          const k1 = m[3] as "PK" | "FK" | "UK" | undefined;
          const k2 = m[4] as "PK" | "FK" | "UK" | undefined;
          // Prefer PK > FK > UK when multiple keys are specified
          attr.key = k1 ?? k2;
          if (m[5]) attr.comment = m[5];
          entity.attributes.push(attr);
        } else {
          warnings.push({ line: i, col: 1, message: `ERD: unrecognised attribute — ${attrTrimmed}`, severity: "error" });
        }
      }
      continue;
    }

    // Relationship line
    const relMatch = trimmed.match(REL_RE);
    if (relMatch) {
      const [, fromId, leftCard, , rightCard, toId, label] = relMatch;
      // relMatch[3] is the rel type (-- or ..)
      const identifying = relMatch[3]!.startsWith("-");
      ensureEntity(fromId!);
      ensureEntity(toId!);
      relationships.push({
        from: fromId!,
        to: toId!,
        label: (label ?? "").trim(),
        fromCardinality: parseLeftCardinality(leftCard!),
        toCardinality: parseRightCardinality(rightCard!),
        identifying,
      });
      continue;
    }

    warnings.push({ line: i, col: 1, message: `ERD: could not parse — ${trimmed}`, severity: "error" });
  }

  return { type: "erd", entities: Array.from(entities.values()), relationships };
}
