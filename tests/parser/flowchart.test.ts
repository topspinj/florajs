import { describe, it, expect } from "vitest";
import { parse } from "../../src/parser/index.js";

describe("flowchart parser", () => {
  it("parses a simple two-node flowchart", () => {
    const ast = parse(`flowchart LR
      A --> B`);

    expect(ast.type).toBe("flowchart");
    expect(ast.direction).toBe("LR");
    expect(ast.nodes).toHaveLength(2);
    expect(ast.edges).toHaveLength(1);
    expect(ast.edges[0]!.from).toBe("A");
    expect(ast.edges[0]!.to).toBe("B");
    expect(ast.edges[0]!.style).toBe("solid");
  });

  it("parses node labels in brackets", () => {
    const ast = parse(`flowchart TD
      A[Start] --> B[End]`);

    expect(ast.nodes.find((n) => n.id === "A")!.label).toBe("Start");
    expect(ast.nodes.find((n) => n.id === "B")!.label).toBe("End");
  });

  it("parses diamond shapes", () => {
    const ast = parse(`flowchart TD
      A{Decision}`);

    const node = ast.nodes.find((n) => n.id === "A");
    expect(node!.shape).toBe("diamond");
    expect(node!.label).toBe("Decision");
  });

  it("parses rounded shapes", () => {
    const ast = parse(`flowchart TD
      A(Rounded)`);

    const node = ast.nodes.find((n) => n.id === "A");
    expect(node!.shape).toBe("rounded");
    expect(node!.label).toBe("Rounded");
  });

  it("parses stadium shapes", () => {
    const ast = parse(`flowchart TD
      A([Stadium])`);

    const node = ast.nodes.find((n) => n.id === "A");
    expect(node!.shape).toBe("stadium");
    expect(node!.label).toBe("Stadium");
  });

  it("parses edge labels", () => {
    const ast = parse(`flowchart LR
      A -->|Yes| B`);

    expect(ast.edges[0]!.label).toBe("Yes");
  });

  it("parses dotted edges", () => {
    const ast = parse(`flowchart LR
      A -.-> B`);

    expect(ast.edges[0]!.style).toBe("dotted");
  });

  it("parses thick edges", () => {
    const ast = parse(`flowchart LR
      A ==> B`);

    expect(ast.edges[0]!.style).toBe("thick");
  });

  it("parses multiple edges in a chain", () => {
    const ast = parse(`flowchart LR
      A --> B --> C`);

    expect(ast.nodes).toHaveLength(3);
    expect(ast.edges).toHaveLength(2);
    expect(ast.edges[0]!.from).toBe("A");
    expect(ast.edges[0]!.to).toBe("B");
    expect(ast.edges[1]!.from).toBe("B");
    expect(ast.edges[1]!.to).toBe("C");
  });

  it("parses multi-line flowcharts", () => {
    const ast = parse(`flowchart TD
      A[Start] --> B{Decision}
      B -->|Yes| C[Do thing]
      B -->|No| D[Other thing]`);

    expect(ast.nodes).toHaveLength(4);
    expect(ast.edges).toHaveLength(3);
  });

  it("defaults to TB direction", () => {
    const ast = parse(`flowchart
      A --> B`);

    expect(ast.direction).toBe("TB");
  });

  it("throws on unknown diagram type", () => {
    expect(() => parse("unknown A --> B")).toThrow("Unknown diagram type");
  });
});
