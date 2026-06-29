import { describe, it, expect } from "vitest";
import { parse } from "../../src/parser/index.js";
import { tokenize } from "../../src/parser/tokenizer.js";

describe("fault-tolerant tokenizer", () => {
  it("handles unterminated brackets", () => {
    const { tokens, warnings } = tokenize(`flowchart LR
      A[Start --> B`);

    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0]!.message).toContain("Unterminated");
    // Should still produce tokens, not hang
    expect(tokens.length).toBeGreaterThan(0);
  });

  it("handles unterminated pipe text", () => {
    const { tokens, warnings } = tokenize(`flowchart LR
      A -->|Yes B`);

    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0]!.message).toContain("Unterminated edge label");
    // Should still produce the pipe_text token with what it got
    const pipeToken = tokens.find((t) => t.type === "pipe_text");
    expect(pipeToken).toBeDefined();
    expect(pipeToken!.value).toBe("Yes B");
  });

  it("handles unterminated quoted strings", () => {
    const { warnings: quoteWarnings } = tokenize(`flowchart LR
      A "Start`);

    expect(quoteWarnings.length).toBeGreaterThan(0);
    expect(quoteWarnings.some((w) => w.message.includes("Unterminated string"))).toBe(true);
  });

  it("handles unterminated bracket at EOF", () => {
    const { warnings } = tokenize(`flowchart LR
      A["Start`);

    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings.some((w) => w.message.includes("Unterminated"))).toBe(true);
  });

  it("handles unexpected characters gracefully", () => {
    const { tokens, warnings } = tokenize(`flowchart LR
      A @ B`);

    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0]!.message).toContain("Unexpected character");
    // Should still tokenize A and B
    const identifiers = tokens.filter((t) => t.type === "identifier");
    expect(identifiers.length).toBe(2);
  });
});

describe("fault-tolerant parser", () => {
  it("recovers from a broken line in a multi-line flowchart", () => {
    const { ast, warnings } = parse(`flowchart TD
      A[Start] --> B{Decision}
      B -->
      B -->|No| D[Other thing]`);

    // Should parse A, B, D despite the broken third line
    expect(ast.nodes.length).toBeGreaterThanOrEqual(3);
    // Should have at least the valid edges
    expect(ast.edges.length).toBeGreaterThanOrEqual(2);
    // Should warn about the dangling arrow
    expect(warnings.length).toBeGreaterThan(0);
  });

  it("returns unsupported AST for known-but-unsupported diagram types", () => {
    const { ast, warnings } = parse(`sequenceDiagram
      Alice->>Bob: Hello`);

    expect(ast.type).toBe("unsupported");
    if (ast.type === "unsupported") {
      expect(ast.detectedType).toBe("sequenceDiagram");
    }
    // No warnings — this is a clean detection, not a fallback
    expect(warnings).toHaveLength(0);
  });

  it("detects multiple unsupported diagram types", () => {
    const unsupportedTypes = [
      "classDiagram",
      "stateDiagram",
      "erDiagram",
      "gantt",
      "journey",
      "pie",
      "mindmap",
      "timeline",
    ];

    for (const type of unsupportedTypes) {
      const { ast } = parse(`${type}\n  content here`);
      expect(ast.type).toBe("unsupported");
      if (ast.type === "unsupported") {
        expect(ast.detectedType).toBe(type);
      }
    }
  });

  it("still falls back to flowchart for genuinely unknown input", () => {
    const { ast } = parse(`somethingRandom
      A --> B`);

    expect(ast.type).toBe("flowchart");
  });

  it("handles unterminated subgraph", () => {
    const { ast, warnings } = parse(`flowchart TD
      subgraph group1
        A --> B`);

    expect(ast.type).toBe("flowchart");
    expect(warnings.some((w) => w.message.includes("Unterminated subgraph"))).toBe(true);
  });

  it("parses valid nodes even when some lines are broken", () => {
    const { ast, warnings } = parse(`flowchart LR
      A[Start] --> B[Middle]
      C[
      D[End] --> E[Final]`);

    // A, B should be parsed from line 1
    expect(ast.nodes.find((n) => n.id === "A")).toBeDefined();
    expect(ast.nodes.find((n) => n.id === "B")).toBeDefined();
    // D, E should be parsed from line 3
    expect(ast.nodes.find((n) => n.id === "D")).toBeDefined();
    expect(ast.nodes.find((n) => n.id === "E")).toBeDefined();
    // Should have warnings about the broken bracket
    expect(warnings.length).toBeGreaterThan(0);
  });

  it("renders a completely empty flowchart without crashing", () => {
    const { ast, warnings } = parse("flowchart LR");

    expect(ast.type).toBe("flowchart");
    expect(ast.nodes).toHaveLength(0);
    expect(ast.edges).toHaveLength(0);
    expect(warnings).toHaveLength(0);
  });

  it("handles input with only whitespace after diagram type", () => {
    const { ast } = parse("flowchart LR\n\n\n");

    expect(ast.type).toBe("flowchart");
    expect(ast.nodes).toHaveLength(0);
  });

  it("handles arrow followed by non-identifier token", () => {
    const { ast, warnings } = parse(`flowchart LR
      A --> {Bad}
      B --> C`);

    // B --> C should still parse
    expect(ast.nodes.find((n) => n.id === "B")).toBeDefined();
    expect(ast.nodes.find((n) => n.id === "C")).toBeDefined();
    expect(warnings.length).toBeGreaterThan(0);
  });
});
