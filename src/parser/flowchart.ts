import type { Token } from "./tokenizer.js";
import type {
  FlowchartAST,
  FlowchartDirection,
  FlowchartEdge,
  FlowchartNode,
  FlowchartSubgraph,
  NodeLink,
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
  if (token.type === "open_circle") {
    const textToken = tokens[start + 1];
    return { shape: "circle", label: textToken?.value ?? "" };
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

function isEdgeToken(token: Token): boolean {
  return token.type === "arrow" || token.type === "link";
}

// "--", "==", "-.", "<--" — the start of an inline edge label, as in
// "A -- text --> B", "A -- text --- B" or "A <-- text --> B". The closing
// arrow/link determines the edge kind.
function isLabelOpener(token: Token): boolean {
  return token.type === "identifier" && /^<?[-=.]{2}$/.test(token.value);
}

export function parseFlowchart(tokens: Token[], warnings: ParseWarning[] = []): FlowchartAST {
  const nodes = new Map<string, FlowchartNode>();
  const edges: FlowchartEdge[] = [];
  const subgraphs: FlowchartSubgraph[] = [];
  const clickBindings: Array<{ nodeId: string; link: NodeLink; token: Token }> = [];
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
        tokens[pos]!.type !== "link" &&
        tokens[pos]!.type !== "eof"
      ) {
        if (
          tokens[pos]!.type === "close_bracket" ||
          tokens[pos]!.type === "close_paren" ||
          tokens[pos]!.type === "close_circle" ||
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

      while (isEdgeToken(current()) || isLabelOpener(current())) {
        let edgeLabel: string | undefined;
        let arrow = current().value;

        if (isLabelOpener(current())) {
          const opener = current();
          pos++;
          const labelParts: string[] = [];
          while (
            !isEdgeToken(current()) &&
            !isStatementTerminator(current()) &&
            (current().type === "identifier" ||
              current().type === "text" ||
              current().type === "direction")
          ) {
            labelParts.push(current().value);
            pos++;
          }
          if (!isEdgeToken(current())) {
            return abandon(
              `Edge label opened with '${opener.value}' but not closed with an arrow — line skipped`,
              opener,
            );
          }
          edgeLabel = labelParts.join(" ");
          arrow = opener.value + current().value;
        }

        const style = arrowStyle(arrow);
        const arrowType: FlowchartEdge["arrowType"] =
          current().type === "link" ? "open"
            : arrow.startsWith("<") ? "bidirectional"
            : "arrow";
        pos++;

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
            arrowType,
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

  // Parse "click <nodeId> "<url>" ["<tooltip>"] [_self|_blank|_parent|_top]".
  // The binding is applied after the whole diagram is parsed, so click lines
  // may appear before the node they reference.
  function parseClickStatement(): void {
    const clickToken = current();
    pos++;

    function fail(message: string): void {
      warnings.push({ line: clickToken.line, col: clickToken.col, message, severity: "error" });
      skipToNextLine();
    }

    if (current().type !== "identifier") {
      return fail("'click' requires a node id — line skipped");
    }
    const nodeId = current().value;
    pos++;

    if (current().type !== "text") {
      // "click A someCallback" — Mermaid's callback form, deliberately ignored
      if (current().type === "identifier") {
        warnings.push({
          line: clickToken.line,
          col: clickToken.col,
          message: `click callback for '${nodeId}' ignored — use the onNodeClick option; only quoted URL bindings are applied`,
          severity: "info",
        });
        skipToNextLine();
        return;
      }
      return fail(`'click ${nodeId}' requires a quoted URL — line skipped`);
    }
    const url = current().value.trim();
    pos++;

    let tooltip: string | undefined;
    let target: NodeLink["target"];
    while (!isStatementTerminator(current())) {
      const token = current();
      if (token.type === "text" && tooltip === undefined) {
        tooltip = token.value;
        pos++;
      } else if (
        token.type === "identifier" &&
        /^_(self|blank|parent|top)$/.test(token.value) &&
        target === undefined
      ) {
        target = token.value as NodeLink["target"];
        pos++;
      } else {
        return fail(
          `Unexpected '${token.value || token.type}' in click binding for '${nodeId}' — line skipped`,
        );
      }
    }

    if (/^(javascript|data|vbscript):/i.test(url)) {
      return fail(`Unsafe URL scheme in click binding for '${nodeId}' — line skipped`);
    }

    clickBindings.push({ nodeId, link: { url, tooltip, target }, token: clickToken });
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

      if (current().type === "keyword" && current().value === "click") {
        parseClickStatement();
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

    if (current().type === "keyword" && current().value === "click") {
      parseClickStatement();
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

  // Apply click bindings now that every node has been parsed.
  for (const binding of clickBindings) {
    const node = nodes.get(binding.nodeId);
    if (!node) {
      warnings.push({
        line: binding.token.line,
        col: binding.token.col,
        message: `click binding references unknown node '${binding.nodeId}'`,
        severity: "error",
      });
      continue;
    }
    node.link = binding.link;
  }

  return {
    type: "flowchart",
    direction,
    nodes: Array.from(nodes.values()),
    edges,
    subgraphs,
  };
}
