import type { DiagramAST, DiagramType } from "../types.js";
import { tokenize } from "./tokenizer.js";
import { parseFlowchart } from "./flowchart.js";

function detectType(input: string): DiagramType {
  const trimmed = input.trim();
  if (trimmed.startsWith("flowchart") || trimmed.startsWith("graph")) {
    return "flowchart";
  }
  throw new Error(`Unknown diagram type. Input must start with: flowchart, graph`);
}

export function parse(input: string): DiagramAST {
  const diagramType = detectType(input);
  const tokens = tokenize(input);

  switch (diagramType) {
    case "flowchart":
      return parseFlowchart(tokens);
    default:
      throw new Error(`Unsupported diagram type: ${diagramType}`);
  }
}

export { tokenize } from "./tokenizer.js";
export { parseFlowchart } from "./flowchart.js";
