import { describe, it, expect } from "vitest";
import { parse } from "../../src/parser/index.js";

describe("subgraph parsing", () => {
  it("parses a subgraph with nodes", () => {
    const { ast } = parse(`flowchart TD
      subgraph SG1
        A --> B
      end`);

    expect(ast.subgraphs).toHaveLength(1);
    expect(ast.subgraphs[0]!.id).toBe("SG1");
    expect(ast.subgraphs[0]!.label).toBe("SG1");
    expect(ast.subgraphs[0]!.nodeIds).toContain("A");
    expect(ast.subgraphs[0]!.nodeIds).toContain("B");
    expect(ast.subgraphs[0]!.parentId).toBeUndefined();
  });

  it("parses nested subgraphs", () => {
    const { ast } = parse(`flowchart TD
      subgraph Outer
        A --> B
        subgraph Inner
          C --> D
        end
      end`);

    expect(ast.subgraphs).toHaveLength(2);

    const inner = ast.subgraphs.find((sg) => sg.id === "Inner");
    const outer = ast.subgraphs.find((sg) => sg.id === "Outer");

    expect(inner).toBeDefined();
    expect(outer).toBeDefined();
    expect(inner!.parentId).toBe("Outer");
    expect(outer!.parentId).toBeUndefined();
    expect(inner!.nodeIds).toContain("C");
    expect(inner!.nodeIds).toContain("D");
    expect(outer!.nodeIds).toContain("A");
    expect(outer!.nodeIds).toContain("B");
  });

  it("handles multiple sibling subgraphs", () => {
    const { ast } = parse(`flowchart TD
      subgraph SG1
        A --> B
      end
      subgraph SG2
        C --> D
      end`);

    expect(ast.subgraphs).toHaveLength(2);
    expect(ast.subgraphs[0]!.id).toBe("SG1");
    expect(ast.subgraphs[1]!.id).toBe("SG2");
  });

  it("warns on unterminated subgraph", () => {
    const { ast, warnings } = parse(`flowchart TD
      subgraph SG1
        A --> B`);

    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings.some((w) => w.message.includes("Unterminated subgraph"))).toBe(true);
    expect(ast.subgraphs).toHaveLength(1);
  });
});
