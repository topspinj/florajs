import type { DiagramType, ParseResult, ParseWarning } from "../types.js";
import { tokenize } from "./tokenizer.js";
import { parseFlowchart } from "./flowchart.js";

function detectType(input: string, warnings: ParseWarning[]): DiagramType {
  const trimmed = input.trim();
  if (trimmed.startsWith("flowchart") || trimmed.startsWith("graph")) {
    return "flowchart";
  }
  // Fallback: assume flowchart and warn
  warnings.push({
    line: 1,
    col: 1,
    message: `Unknown diagram type — treating as flowchart`,
  });
  return "flowchart";
}

export function parse(input: string): ParseResult {
  const warnings: ParseWarning[] = [];
  const diagramType = detectType(input, warnings);
  const { tokens, warnings: tokenWarnings } = tokenize(input);
  warnings.push(...tokenWarnings);

  switch (diagramType) {
    case "flowchart":
      return { ast: parseFlowchart(tokens, warnings), warnings };
    default:
      return { ast: parseFlowchart(tokens, warnings), warnings };
  }
}

export { tokenize } from "./tokenizer.js";
export { parseFlowchart } from "./flowchart.js";
