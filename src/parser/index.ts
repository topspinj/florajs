import type { DiagramType, ParseResult, ParseWarning } from "../types.js";
import { tokenize } from "./tokenizer.js";
import { parseFlowchart } from "./flowchart.js";

const KNOWN_UNSUPPORTED_TYPES = [
  "sequenceDiagram",
  "classDiagram",
  "stateDiagram",
  "stateDiagram-v2",
  "erDiagram",
  "gantt",
  "journey",
  "pie",
  "mindmap",
  "timeline",
  "gitGraph",
  "C4Context",
  "C4Container",
  "C4Component",
  "C4Deployment",
  "quadrantChart",
  "sankey-beta",
  "xychart-beta",
  "block-beta",
  "packet-beta",
  "kanban",
  "architecture-beta",
];

function detectType(input: string): { type: DiagramType; detectedType?: string } {
  const trimmed = input.trim();
  if (trimmed.startsWith("flowchart") || trimmed.startsWith("graph")) {
    return { type: "flowchart" };
  }
  for (const unsupported of KNOWN_UNSUPPORTED_TYPES) {
    if (trimmed.startsWith(unsupported)) {
      return { type: "unsupported", detectedType: unsupported };
    }
  }
  // Genuinely unknown input — fall back to flowchart recovery
  return { type: "flowchart" };
}

export function parse(input: string): ParseResult {
  const warnings: ParseWarning[] = [];
  const { type: diagramType, detectedType } = detectType(input);

  if (diagramType === "unsupported") {
    return {
      ast: { type: "unsupported", detectedType: detectedType! },
      warnings,
    };
  }

  const { tokens, warnings: tokenWarnings } = tokenize(input);
  warnings.push(...tokenWarnings);
  return { ast: parseFlowchart(tokens, warnings), warnings };
}

export { tokenize } from "./tokenizer.js";
export { parseFlowchart } from "./flowchart.js";
