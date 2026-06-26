import { describe, it, expect } from "vitest";
import { parse } from "../../src/parser/index.js";
import { computeLayout } from "../../src/layout/index.js";

describe("subgraph layout", () => {
  it("includes subgraph bounding boxes in layout result", () => {
    const { ast } = parse(`flowchart TD
      subgraph SG1
        A[Node A] --> B[Node B]
      end`);

    const layout = computeLayout(ast);

    expect(layout.subgraphs).toHaveLength(1);
    expect(layout.subgraphs[0]!.id).toBe("SG1");
    expect(layout.subgraphs[0]!.collapsed).toBe(false);
    expect(layout.subgraphs[0]!.width).toBeGreaterThan(0);
    expect(layout.subgraphs[0]!.height).toBeGreaterThan(0);
  });

  it("returns empty subgraphs array when none exist", () => {
    const { ast } = parse(`flowchart TD
      A --> B`);

    const layout = computeLayout(ast);
    expect(layout.subgraphs).toHaveLength(0);
  });

  it("subgraph bounding box contains all child nodes", () => {
    const { ast } = parse(`flowchart TD
      subgraph SG1
        A[Node A] --> B[Node B]
      end`);

    const layout = computeLayout(ast);
    const sg = layout.subgraphs[0]!;

    for (const node of layout.nodes) {
      expect(node.x - node.width / 2).toBeGreaterThanOrEqual(sg.x);
      expect(node.y - node.height / 2).toBeGreaterThanOrEqual(sg.y);
      expect(node.x + node.width / 2).toBeLessThanOrEqual(sg.x + sg.width);
      expect(node.y + node.height / 2).toBeLessThanOrEqual(sg.y + sg.height);
    }
  });

  it("collapses a subgraph into a summary node", () => {
    const { ast } = parse(`flowchart TD
      subgraph SG1
        A[Node A] --> B[Node B]
      end
      C[Outside] --> A`);

    const collapsed = new Set(["SG1"]);
    const layout = computeLayout(ast, undefined, collapsed);

    // Summary node should exist
    const summaryNode = layout.nodes.find((n) => n.subgraphSummary === "SG1");
    expect(summaryNode).toBeDefined();
    expect(summaryNode!.label).toContain("SG1");
    expect(summaryNode!.label).toContain("2");

    // Original nodes A, B should not be in layout
    expect(layout.nodes.find((n) => n.id === "A")).toBeUndefined();
    expect(layout.nodes.find((n) => n.id === "B")).toBeUndefined();

    // C should still exist
    expect(layout.nodes.find((n) => n.id === "C")).toBeDefined();

    // Edge from C should now point to summary node
    const edge = layout.edges.find((e) => e.from === "C");
    expect(edge).toBeDefined();
    expect(edge!.to).toBe("__collapsed_SG1");
  });

  it("drops internal edges when subgraph is collapsed", () => {
    const { ast } = parse(`flowchart TD
      subgraph SG1
        A --> B
        B --> C
      end`);

    const collapsed = new Set(["SG1"]);
    const layout = computeLayout(ast, undefined, collapsed);

    // No internal edges should remain
    expect(layout.edges).toHaveLength(0);
  });

  it("handles nested subgraphs in layout", () => {
    const { ast } = parse(`flowchart TD
      subgraph Outer
        A --> B
        subgraph Inner
          C --> D
        end
      end`);

    const layout = computeLayout(ast);

    expect(layout.subgraphs).toHaveLength(2);
    const outer = layout.subgraphs.find((sg) => sg.id === "Outer");
    const inner = layout.subgraphs.find((sg) => sg.id === "Inner");
    expect(outer).toBeDefined();
    expect(inner).toBeDefined();
    expect(inner!.parentId).toBe("Outer");
  });
});
