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

  it("treats an unknown single-word header as an unsupported type, not a flowchart", () => {
    const { ast } = parse(`somethingRandom
      A --> B`);

    expect(ast.type).toBe("unsupported");
    if (ast.type === "unsupported") {
      expect(ast.detectedType).toBe("somethingRandom");
    }
  });

  it("parses a headerless fragment as a flowchart with an info diagnostic", () => {
    const { ast, warnings } = parse(`A --> B
      B --> C`);

    expect(ast.type).toBe("flowchart");
    if (ast.type === "flowchart") {
      expect(ast.nodes.map((n) => n.id).sort()).toEqual(["A", "B", "C"]);
      expect(ast.edges).toHaveLength(2);
    }
    expect(warnings.some((w) => w.severity === "info" && w.message.includes("No diagram type header"))).toBe(true);
  });

  it("never invents nodes from prose", () => {
    const { ast, warnings } = parse(`flowchart LR
      this is not a diagram at all
      A --> B`);

    expect(ast.type).toBe("flowchart");
    if (ast.type === "flowchart") {
      // The prose line contributes nothing; the valid line still parses
      expect(ast.nodes.map((n) => n.id).sort()).toEqual(["A", "B"]);
      expect(ast.edges).toHaveLength(1);
    }
    expect(warnings.some((w) => w.severity === "error")).toBe(true);
  });

  it("skips a whole invalid line instead of committing part of it", () => {
    const { ast } = parse(`flowchart LR
      A --> B C
      D --> E`);

    if (ast.type === "flowchart") {
      // Nothing from the broken line — not even A or B
      expect(ast.nodes.map((n) => n.id).sort()).toEqual(["D", "E"]);
      expect(ast.edges).toHaveLength(1);
    }
  });

  it("ignores Mermaid styling directives with info diagnostics instead of misparsing them", () => {
    const { ast, warnings } = parse(`flowchart LR
      A --> B
      classDef red fill:#f00
      class A red
      style B fill:#f9f,stroke:#333
      linkStyle 0 stroke:#f00
      click A callback`);

    expect(ast.type).toBe("flowchart");
    if (ast.type === "flowchart") {
      expect(ast.nodes.map((n) => n.id).sort()).toEqual(["A", "B"]);
      expect(ast.edges).toHaveLength(1);
    }
    const infos = warnings.filter((w) => w.severity === "info");
    expect(infos).toHaveLength(5);
    expect(warnings.filter((w) => w.severity === "error")).toHaveLength(0);
  });

  it("still allows a directive keyword as a node id when it has a shape", () => {
    const { ast } = parse(`flowchart LR
      style[Style Guide] --> B`);

    if (ast.type === "flowchart") {
      expect(ast.nodes.find((n) => n.id === "style")?.label).toBe("Style Guide");
      expect(ast.edges).toHaveLength(1);
    }
  });

  it("emits an info diagnostic for %%{init}%% directives", () => {
    const { warnings } = parse(`flowchart LR
      %%{init: {"theme": "dark"}}%%
      A --> B`);

    expect(warnings.some((w) => w.severity === "info" && w.message.includes("init directives"))).toBe(true);
  });

  it("parses arrows written without spaces and keeps kebab-case ids", () => {
    const { ast, warnings } = parse(`flowchart LR
      my-node-->other-node
      other-node-.->third`);

    if (ast.type === "flowchart") {
      expect(ast.nodes.map((n) => n.id).sort()).toEqual(["my-node", "other-node", "third"]);
      expect(ast.edges).toHaveLength(2);
      expect(ast.edges[1]!.style).toBe("dotted");
    }
    expect(warnings.filter((w) => w.severity === "error")).toHaveLength(0);
  });

  it("treats semicolons as statement terminators", () => {
    const { ast, warnings } = parse(`graph LR; A-->B; B-->C;`);

    expect(ast.type).toBe("flowchart");
    if (ast.type === "flowchart") {
      expect(ast.nodes.map((n) => n.id).sort()).toEqual(["A", "B", "C"]);
      expect(ast.edges).toHaveLength(2);
    }
    expect(warnings.filter((w) => w.severity === "error")).toHaveLength(0);
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
