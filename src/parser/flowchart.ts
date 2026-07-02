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

  function isStatementTerminator(token: Token): boolean {
    return (
      token.type === "newline" ||
      token.type === "eof" ||
      (token.type === "keyword" && token.value === "end")
    );
  }

  // Parse a single statement (node definition + optional edge chain).
  //
  // The statement is parsed into pending collections and only committed to
  // the diagram if the whole line is understood. A line the parser cannot
  // make sense of contributes nothing and produces one error diagnostic —
  // it is never reinterpreted as extra nodes.
  //
  // Returns the node IDs committed (empty when the line was abandoned).
  function parseStatement(): string[] {
    const nodeIds: string[] = [];
    const definedNodes = new Map<string, FlowchartNode>();
    const referencedIds = new Set<string>();
    const pendingEdges: FlowchartEdge[] = [];
    const currentToken = current();
    let currentId = currentToken.value;
    pos++;
    nodeIds.push(currentId);

    function parseNodeDefinition(id: string): void {
      const shape = inferShape(tokens, pos);
      if (!shape) {
        referencedIds.add(id);
        return;
      }
      definedNodes.set(id, { id, label: shape.label, shape: shape.shape });
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
    }

    function abandon(message: string, at: Token): [] {
      warnings.push({
        line: at.line,
        col: at.col,
        message,
        severity: "error",
      });
      skipToNextLine();
      return [];
    }

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
          nodeIds.push(nextId);
          parseNodeDefinition(nextId);
          referencedIds.add(currentId);
          referencedIds.add(nextId);

          pendingEdges.push({
            from: currentId,
            to: nextId,
            label: edgeLabel,
            style,
          });

          currentId = nextId;
        } else if (!isStatementTerminator(current())) {
          return abandon(
            `Expected node identifier after arrow, got '${current().value || current().type}' — line skipped`,
            current(),
          );
        } else {
          return abandon("Dangling arrow with no target node — line skipped", currentToken);
        }
      }

      if (!isStatementTerminator(current())) {
        return abandon(
          `Could not parse this line — unexpected '${current().value || current().type}' after '${currentId}'`,
          current(),
        );
      }
    } catch {
      return abandon(`Could not parse line starting with '${currentId}' — line skipped`, currentToken);
    }

    // Line fully understood — commit it.
    for (const [id, node] of definedNodes) {
      nodes.set(id, node);
    }
    for (const id of referencedIds) {
      ensureNode(id);
    }
    for (const edge of pendingEdges) {
      edges.push(edge);
    }

    return nodeIds;
  }

  function parseSubgraph(lineStartToken: Token, parentId?: string): void {
    pos++; // skip "subgraph"
    const id = current().value;
    pos++;
    skipNewlines();
    const subgraphNodeIds = new Set<string>();

    while (
      pos < tokens.length &&
      !(current().type === "keyword" && current().value === "end")
    ) {
      if (current().type === "eof") {
        warnings.push({
          line: lineStartToken.line,
          col: lineStartToken.col,
          message: `Unterminated subgraph '${id}' (missing 'end')`,
          severity: "error",
        });
        break;
      }

      skipNewlines();
      if (current().type === "keyword" && current().value === "end") break;

      // Handle nested subgraphs
      if (current().type === "keyword" && current().value === "subgraph") {
        const nestedStart = current();
        parseSubgraph(nestedStart, id);
        continue;
      }

      // Parse statements (node definitions + edges)
      if (current().type === "identifier") {
        const nodeIds = parseStatement();
        for (const nodeId of nodeIds) {
          subgraphNodeIds.add(nodeId);
        }
        continue;
      }

      // Line starts with something that isn't a statement — skip the line
      if (current().type !== "newline" && current().type !== "eof") {
        const unexpected = current();
        warnings.push({
          line: unexpected.line,
          col: unexpected.col,
          message: `Could not parse this line in subgraph '${id}' — unexpected ${unexpected.type}${unexpected.value ? ` '${unexpected.value}'` : ""}`,
          severity: "error",
        });
        skipToNextLine();
      }
    }
    if (current().type === "keyword" && current().value === "end") pos++;

    subgraphs.push({ id, label: id, nodeIds: [...subgraphNodeIds], parentId });
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
      parseStatement();
      continue;
    }

    // Line starts with something that isn't a statement — skip the line
    const unexpected = current();
    warnings.push({
      line: unexpected.line,
      col: unexpected.col,
      message: `Could not parse this line — unexpected ${unexpected.type}${unexpected.value ? ` '${unexpected.value}'` : ""}`,
      severity: "error",
    });
    skipToNextLine();
  }

  return {
    type: "flowchart",
    direction,
    nodes: Array.from(nodes.values()),
    edges,
    subgraphs,
  };
}
