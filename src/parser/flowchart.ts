import type { Token } from "./tokenizer.js";
import type {
  FlowchartAST,
  FlowchartDirection,
  FlowchartEdge,
  FlowchartNode,
  FlowchartSubgraph,
  NodeShape,
  ParseWarning,
} from "../types.js";

function inferShape(tokens: Token[], start: number): { shape: NodeShape; label: string } | null {
  const token = tokens[start];
  if (!token) return null;

  if (token.type === "open_bracket") {
    const textToken = tokens[start + 1];
    return { shape: "rect", label: textToken?.value ?? "" };
  }
  if (token.type === "open_paren") {
    const textToken = tokens[start + 1];
    return { shape: "rounded", label: textToken?.value ?? "" };
  }
  if (token.type === "open_brace") {
    const textToken = tokens[start + 1];
    return { shape: "diamond", label: textToken?.value ?? "" };
  }
  if (token.type === "open_stadium") {
    const textToken = tokens[start + 1];
    return { shape: "stadium", label: textToken?.value ?? "" };
  }
  if (token.type === "open_cylinder") {
    const textToken = tokens[start + 1];
    return { shape: "cylinder", label: textToken?.value ?? "" };
  }
  if (token.type === "open_queue") {
    const textToken = tokens[start + 1];
    return { shape: "queue", label: textToken?.value ?? "" };
  }
  return null;
}

function arrowStyle(arrow: string): FlowchartEdge["style"] {
  if (arrow.includes("=")) return "thick";
  if (arrow.includes(".")) return "dotted";
  return "solid";
}

export function parseFlowchart(tokens: Token[], warnings: ParseWarning[] = []): FlowchartAST {
  const nodes = new Map<string, FlowchartNode>();
  const edges: FlowchartEdge[] = [];
  const subgraphs: FlowchartSubgraph[] = [];
  let direction: FlowchartDirection = "TB";
  let pos = 0;

  function skipNewlines(): void {
    while (pos < tokens.length && tokens[pos]!.type === "newline") pos++;
  }

  function current(): Token {
    return tokens[pos] ?? { type: "eof", value: "", line: 0, col: 0 };
  }

  function ensureNode(id: string): void {
    if (!nodes.has(id)) {
      nodes.set(id, { id, label: id, shape: "rect" });
    }
  }

  function skipToNextLine(): void {
    while (
      pos < tokens.length &&
      tokens[pos]!.type !== "newline" &&
      tokens[pos]!.type !== "eof"
    ) {
      pos++;
    }
  }

  function parseNodeDefinition(id: string): void {
    const shape = inferShape(tokens, pos);
    if (shape) {
      nodes.set(id, { id, label: shape.label, shape: shape.shape });
      while (
        pos < tokens.length &&
        tokens[pos]!.type !== "newline" &&
        tokens[pos]!.type !== "arrow" &&
        tokens[pos]!.type !== "eof"
      ) {
        if (
          tokens[pos]!.type === "close_bracket" ||
          tokens[pos]!.type === "close_paren" ||
          tokens[pos]!.type === "close_brace" ||
          tokens[pos]!.type === "close_stadium" ||
          tokens[pos]!.type === "close_cylinder" ||
          tokens[pos]!.type === "close_queue"
        ) {
          pos++;
          break;
        }
        pos++;
      }
    } else {
      ensureNode(id);
    }
  }

  function parseSubgraph(lineStartToken: Token, parentId?: string): void {
    pos++; // skip "subgraph"
    const id = current().value;
    pos++;
    skipNewlines();
    const subgraphNodes: string[] = [];

    while (
      pos < tokens.length &&
      !(current().type === "keyword" && current().value === "end")
    ) {
      if (current().type === "eof") {
        warnings.push({
          line: lineStartToken.line,
          col: lineStartToken.col,
          message: `Unterminated subgraph '${id}' (missing 'end')`,
        });
        break;
      }
      // Handle nested subgraphs
      if (current().type === "keyword" && current().value === "subgraph") {
        const nestedStart = current();
        parseSubgraph(nestedStart, id);
        continue;
      }
      if (current().type === "identifier") {
        subgraphNodes.push(current().value);
      }
      pos++;
    }
    if (current().type === "keyword" && current().value === "end") pos++;

    subgraphs.push({ id, label: id, nodeIds: subgraphNodes, parentId });
  }

  if (current().type === "keyword" && (current().value === "flowchart" || current().value === "graph")) {
    pos++;
    skipNewlines();
    if (current().type === "direction") {
      direction = current().value as FlowchartDirection;
      pos++;
    }
    skipNewlines();
  }

  while (pos < tokens.length && current().type !== "eof") {
    skipNewlines();
    if (current().type === "eof") break;

    const lineStartToken = current();

    if (current().type === "keyword" && current().value === "subgraph") {
      parseSubgraph(lineStartToken);
      continue;
    }

    if (current().type === "identifier") {
      const currentToken = current();
      let currentId = currentToken.value;
      pos++;

      try {
        parseNodeDefinition(currentId);

        while (current().type === "arrow") {
          const arrow = current().value;
          const style = arrowStyle(arrow);
          pos++;

          let edgeLabel: string | undefined;
          if (current().type === "pipe_text") {
            edgeLabel = current().value;
            pos++;
          }

          if (current().type === "identifier") {
            const nextId = current().value;
            pos++;
            parseNodeDefinition(nextId);
            ensureNode(currentId);
            ensureNode(nextId);

            edges.push({
              from: currentId,
              to: nextId,
              label: edgeLabel,
              style,
            });

            currentId = nextId;
          } else if (current().type !== "newline" && current().type !== "eof") {
            // Arrow followed by something unexpected — warn and skip rest of line
            warnings.push({
              line: current().line,
              col: current().col,
              message: `Expected node identifier after arrow, got '${current().value || current().type}'`,
            });
            skipToNextLine();
            break;
          } else {
            // Arrow at end of line with no target — warn
            warnings.push({
              line: currentToken.line,
              col: currentToken.col,
              message: `Dangling arrow with no target node`,
            });
            break;
          }
        }
      } catch {
        // If anything goes wrong parsing this line, skip it and warn
        warnings.push({
          line: currentToken.line,
          col: currentToken.col,
          message: `Could not parse line starting with '${currentId}'`,
        });
        skipToNextLine();
      }
      continue;
    }

    // Unexpected token — skip it and warn
    const unexpected = current();
    warnings.push({
      line: unexpected.line,
      col: unexpected.col,
      message: `Unexpected ${unexpected.type}${unexpected.value ? ` '${unexpected.value}'` : ""}`,
    });
    pos++;
  }

  return {
    type: "flowchart",
    direction,
    nodes: Array.from(nodes.values()),
    edges,
    subgraphs,
  };
}
