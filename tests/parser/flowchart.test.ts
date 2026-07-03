import { describe, it, expect } from "vitest";
import { parse } from "../../src/parser/index.js";

describe("flowchart parser", () => {
  it("parses a simple two-node flowchart", () => {
    const { ast, warnings } = parse(`flowchart LR
      A --> B`);

    expect(ast.type).toBe("flowchart");
    expect(ast.direction).toBe("LR");
    expect(ast.nodes).toHaveLength(2);
    expect(ast.edges).toHaveLength(1);
    expect(ast.edges[0]!.from).toBe("A");
    expect(ast.edges[0]!.to).toBe("B");
    expect(ast.edges[0]!.style).toBe("solid");
    expect(warnings).toHaveLength(0);
  });

  it("parses a header preceded by blank lines", () => {
    const { ast, warnings } = parse(`\n\nflowchart LR\n  A --> B`);

    expect(ast.type).toBe("flowchart");
    expect(ast.direction).toBe("LR");
    expect(ast.nodes).toHaveLength(2);
    expect(warnings).toHaveLength(0);
  });

  it("parses node labels in brackets", () => {
    const { ast } = parse(`flowchart TD
      A[Start] --> B[End]`);

    expect(ast.nodes.find((n) => n.id === "A")!.label).toBe("Start");
    expect(ast.nodes.find((n) => n.id === "B")!.label).toBe("End");
  });

  it("parses diamond shapes", () => {
    const { ast } = parse(`flowchart TD
      A{Decision}`);

    const node = ast.nodes.find((n) => n.id === "A");
    expect(node!.shape).toBe("diamond");
    expect(node!.label).toBe("Decision");
  });

  it("parses rounded shapes", () => {
    const { ast } = parse(`flowchart TD
      A(Rounded)`);

    const node = ast.nodes.find((n) => n.id === "A");
    expect(node!.shape).toBe("rounded");
    expect(node!.label).toBe("Rounded");
  });

  it("parses stadium shapes", () => {
    const { ast } = parse(`flowchart TD
      A([Stadium])`);

    const node = ast.nodes.find((n) => n.id === "A");
    expect(node!.shape).toBe("stadium");
    expect(node!.label).toBe("Stadium");
  });

  it("parses circle shapes", () => {
    const { ast, warnings } = parse(`flowchart TD
      A((Start))`);

    const node = ast.nodes.find((n) => n.id === "A");
    expect(node!.shape).toBe("circle");
    expect(node!.label).toBe("Start");
    expect(warnings).toHaveLength(0);
  });

  it("parses circle shapes in chains", () => {
    const { ast } = parse(`flowchart TD
      A((Start)) --> B[Process] --> C((End))`);

    expect(ast.nodes).toHaveLength(3);
    expect(ast.nodes.find((n) => n.id === "A")!.shape).toBe("circle");
    expect(ast.nodes.find((n) => n.id === "C")!.shape).toBe("circle");
    expect(ast.edges).toHaveLength(2);
  });

  it("parses cylinder shapes", () => {
    const { ast } = parse(`flowchart TD
      A[(Database)]`);

    const node = ast.nodes.find((n) => n.id === "A");
    expect(node!.shape).toBe("cylinder");
    expect(node!.label).toBe("Database");
  });

  it("parses cylinder shapes in chains", () => {
    const { ast } = parse(`flowchart LR
      A[Producer] --> B[(Kafka)] --> C[Consumer]`);

    expect(ast.nodes).toHaveLength(3);
    expect(ast.nodes.find((n) => n.id === "B")!.shape).toBe("cylinder");
    expect(ast.edges).toHaveLength(2);
  });

  it("parses edge labels", () => {
    const { ast } = parse(`flowchart LR
      A -->|Yes| B`);

    expect(ast.edges[0]!.label).toBe("Yes");
  });

  it("parses dotted edges", () => {
    const { ast } = parse(`flowchart LR
      A -.-> B`);

    expect(ast.edges[0]!.style).toBe("dotted");
  });

  it("parses thick edges", () => {
    const { ast } = parse(`flowchart LR
      A ==> B`);

    expect(ast.edges[0]!.style).toBe("thick");
  });

  it("parses open links (undirected edges)", () => {
    const { ast, warnings } = parse(`flowchart LR
      A --- B`);

    expect(ast.edges).toHaveLength(1);
    expect(ast.edges[0]!.arrowType).toBe("open");
    expect(ast.edges[0]!.style).toBe("solid");
    expect(warnings).toHaveLength(0);
  });

  it("parses dotted and thick open links", () => {
    const { ast } = parse(`flowchart LR
      A -.- B
      C === D`);

    expect(ast.edges[0]!.arrowType).toBe("open");
    expect(ast.edges[0]!.style).toBe("dotted");
    expect(ast.edges[1]!.arrowType).toBe("open");
    expect(ast.edges[1]!.style).toBe("thick");
  });

  it("parses open links with pipe labels", () => {
    const { ast } = parse(`flowchart LR
      A ---|connects| B`);

    expect(ast.edges[0]!.arrowType).toBe("open");
    expect(ast.edges[0]!.label).toBe("connects");
  });

  it("parses inline edge labels (-- text ---)", () => {
    const { ast, warnings } = parse(`flowchart LR
      A -- talks to --- B`);

    expect(ast.edges).toHaveLength(1);
    expect(ast.edges[0]!.arrowType).toBe("open");
    expect(ast.edges[0]!.label).toBe("talks to");
    expect(warnings).toHaveLength(0);
  });

  it("parses inline edge labels on directed edges (-- text -->)", () => {
    const { ast } = parse(`flowchart LR
      A -- yes --> B`);

    expect(ast.edges[0]!.arrowType).toBe("arrow");
    expect(ast.edges[0]!.label).toBe("yes");
  });

  it("reports an error for an unclosed inline edge label", () => {
    const { ast, warnings } = parse(`flowchart LR
      A -- dangling label
      C --> D`);

    expect(ast.edges).toHaveLength(1);
    expect(ast.edges[0]!.from).toBe("C");
    expect(warnings.some((w) => w.severity === "error" && w.message.includes("label"))).toBe(true);
  });

  it("parses bidirectional arrows", () => {
    const { ast, warnings } = parse(`flowchart LR
      Client <--> Server`);

    expect(ast.edges).toHaveLength(1);
    expect(ast.edges[0]!.arrowType).toBe("bidirectional");
    expect(ast.edges[0]!.style).toBe("solid");
    expect(warnings).toHaveLength(0);
  });

  it("parses dotted and thick bidirectional arrows", () => {
    const { ast } = parse(`flowchart LR
      A <-.-> B
      C <==> D`);

    expect(ast.edges[0]!.arrowType).toBe("bidirectional");
    expect(ast.edges[0]!.style).toBe("dotted");
    expect(ast.edges[1]!.arrowType).toBe("bidirectional");
    expect(ast.edges[1]!.style).toBe("thick");
  });

  it("parses bidirectional arrows with pipe labels", () => {
    const { ast } = parse(`flowchart LR
      A <-->|syncs| B`);

    expect(ast.edges[0]!.arrowType).toBe("bidirectional");
    expect(ast.edges[0]!.label).toBe("syncs");
  });

  it("parses bidirectional arrows with inline labels (<-- text -->)", () => {
    const { ast, warnings } = parse(`flowchart LR
      A <-- syncs --> B`);

    expect(ast.edges).toHaveLength(1);
    expect(ast.edges[0]!.arrowType).toBe("bidirectional");
    expect(ast.edges[0]!.label).toBe("syncs");
    expect(warnings).toHaveLength(0);
  });

  it("parses bidirectional arrows without spaces", () => {
    const { ast } = parse(`flowchart LR
      A<-->B`);

    expect(ast.edges).toHaveLength(1);
    expect(ast.edges[0]!.arrowType).toBe("bidirectional");
  });

  it("directed edges default to arrow type", () => {
    const { ast } = parse(`flowchart LR
      A --> B`);

    expect(ast.edges[0]!.arrowType).toBe("arrow");
  });

  it("parses multiple edges in a chain", () => {
    const { ast } = parse(`flowchart LR
      A --> B --> C`);

    expect(ast.nodes).toHaveLength(3);
    expect(ast.edges).toHaveLength(2);
    expect(ast.edges[0]!.from).toBe("A");
    expect(ast.edges[0]!.to).toBe("B");
    expect(ast.edges[1]!.from).toBe("B");
    expect(ast.edges[1]!.to).toBe("C");
  });

  it("parses multi-line flowcharts", () => {
    const { ast } = parse(`flowchart TD
      A[Start] --> B{Decision}
      B -->|Yes| C[Do thing]
      B -->|No| D[Other thing]`);

    expect(ast.nodes).toHaveLength(4);
    expect(ast.edges).toHaveLength(3);
  });

  it("parses click bindings with a URL", () => {
    const { ast, warnings } = parse(`flowchart LR
      A[Docs] --> B[API]
      click A "https://docs.example.com"`);

    const node = ast.nodes.find((n) => n.id === "A");
    expect(node!.link).toEqual({ url: "https://docs.example.com", tooltip: undefined, target: undefined });
    expect(warnings).toHaveLength(0);
  });

  it("parses click bindings with tooltip and target", () => {
    const { ast } = parse(`flowchart LR
      A --> B
      click A "https://docs.example.com" "Open docs"
      click B "https://api.example.com" _blank`);

    expect(ast.nodes.find((n) => n.id === "A")!.link).toEqual({
      url: "https://docs.example.com",
      tooltip: "Open docs",
      target: undefined,
    });
    expect(ast.nodes.find((n) => n.id === "B")!.link).toEqual({
      url: "https://api.example.com",
      tooltip: undefined,
      target: "_blank",
    });
  });

  it("parses click bindings that appear before the node definition", () => {
    const { ast, warnings } = parse(`flowchart LR
      click A "https://example.com"
      A[Late] --> B`);

    expect(ast.nodes.find((n) => n.id === "A")!.link!.url).toBe("https://example.com");
    expect(warnings).toHaveLength(0);
  });

  it("warns when a click binding references an unknown node", () => {
    const { ast, warnings } = parse(`flowchart LR
      A --> B
      click Missing "https://example.com"`);

    expect(ast.nodes.every((n) => !n.link)).toBe(true);
    expect(warnings.some((w) => w.severity === "error" && w.message.includes("Missing"))).toBe(true);
  });

  it("rejects unsafe URL schemes in click bindings", () => {
    const { ast, warnings } = parse(`flowchart LR
      A --> B
      click A "javascript:alert(1)"`);

    expect(ast.nodes.find((n) => n.id === "A")!.link).toBeUndefined();
    expect(warnings.some((w) => w.severity === "error" && w.message.includes("Unsafe URL"))).toBe(true);
  });

  it("warns when a click binding has no quoted URL", () => {
    const { warnings } = parse(`flowchart LR
      A --> B
      click A`);

    expect(warnings.some((w) => w.severity === "error" && w.message.includes("URL"))).toBe(true);
  });

  it("still allows a node named click", () => {
    const { ast } = parse(`flowchart LR
      click[Click me] --> B`);

    expect(ast.nodes.find((n) => n.id === "click")!.label).toBe("Click me");
    expect(ast.edges).toHaveLength(1);
  });

  it("defaults to TB direction", () => {
    const { ast } = parse(`flowchart
      A --> B`);

    expect(ast.direction).toBe("TB");
  });

  it("falls back to flowchart on unknown input instead of throwing", () => {
    const { ast } = parse("unknown A --> B");

    expect(ast.type).toBe("flowchart");
  });

  it("returns unsupported AST for known non-flowchart types", () => {
    const { ast } = parse("sequenceDiagram\n  Alice->>Bob: Hello");

    expect(ast.type).toBe("unsupported");
    if (ast.type === "unsupported") {
      expect(ast.detectedType).toBe("sequenceDiagram");
    }
  });
});
