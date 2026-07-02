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

function detectType(input: string): { type: DiagramType; detectedType?: string; headerless?: boolean } {
  const trimmed = input.trim();
  if (trimmed.startsWith("flowchart") || trimmed.startsWith("graph")) {
    return { type: "flowchart" };
  }
  for (const unsupported of KNOWN_UNSUPPORTED_TYPES) {
    if (trimmed.startsWith(unsupported)) {
      return { type: "unsupported", detectedType: unsupported };
    }
  }
  // A lone word on the first line reads as a diagram-type header Flora
  // doesn't recognize — report that rather than guessing it's a flowchart.
  const firstLine = trimmed.split("\n", 1)[0]!.trim().replace(/;$/, "");
  if (/^[A-Za-z][\w-]*$/.test(firstLine)) {
    return { type: "unsupported", detectedType: firstLine };
  }
  // Anything else (e.g. a pasted fragment like "A --> B") is treated as a
  // headerless flowchart, with a diagnostic saying so.
  return { type: "flowchart", headerless: true };
}

export function parse(input: string): ParseResult {
  const warnings: ParseWarning[] = [];
  const { type: diagramType, detectedType, headerless } = detectType(input);

  if (diagramType === "unsupported") {
    return {
      ast: { type: "unsupported", detectedType: detectedType! },
      warnings,
    };
  }

  if (headerless && input.trim() !== "") {
    warnings.push({
      line: 1,
      col: 1,
      message: "No diagram type header found — assuming 'flowchart'. Start with 'flowchart TD' (or LR) to silence this.",
      severity: "info",
    });
  }

  const { tokens, warnings: tokenWarnings } = tokenize(input);
  warnings.push(...tokenWarnings);
  return { ast: parseFlowchart(tokens, warnings), warnings };
}

export { tokenize } from "./tokenizer.js";
export { parseFlowchart } from "./flowchart.js";
