import { describe, it, expect } from "vitest";
import { parse } from "../../src/parser/index.js";
import { computeLayout } from "../../src/layout/index.js";

describe("100-node stress test", () => {
  it("parses and lays out 100 nodes with mixed shapes", () => {
    const shapes = [
      (id: string, label: string) => `${id}[${label}]`,         // rect
      (id: string, label: string) => `${id}(${label})`,         // rounded
      (id: string, label: string) => `${id}{${label}}`,         // diamond
      (id: string, label: string) => `${id}([${label}])`,       // stadium
      (id: string, label: string) => `${id}[(${label})]`,       // cylinder
      (id: string, label: string) => `${id}[[${label}]]`,       // queue
    ];

    const lines: string[] = ["flowchart TD"];

    // Create 100 nodes with various shapes
    for (let i = 0; i < 100; i++) {
      const shapeFn = shapes[i % shapes.length]!;
      lines.push(`  N${i}${shapeFn("", `Node ${i}`).slice(0)}`);
    }

    // Hmm, the above creates standalone nodes. Let's also create edges
    // to form a DAG: 10 "layers" of 10 nodes each, with edges between layers
    const edgeLines: string[] = [];
    for (let layer = 0; layer < 9; layer++) {
      for (let i = 0; i < 10; i++) {
        const from = layer * 10 + i;
        const to = (layer + 1) * 10 + (i % 10);
        edgeLines.push(`  N${from} --> N${to}`);
      }
    }

    // Build proper input: header + node defs + edges
    const nodeLines: string[] = ["flowchart TD"];
    for (let i = 0; i < 100; i++) {
      const shapeFn = shapes[i % shapes.length]!;
      nodeLines.push(`  ${shapeFn(`N${i}`, `Node ${i}`)}`);
    }

    const input = [...nodeLines, ...edgeLines].join("\n");

    const start = performance.now();
    const { ast, warnings } = parse(input);
    const parseTime = performance.now() - start;

    expect(ast.nodes).toHaveLength(100);
    expect(ast.edges).toHaveLength(90);
    expect(warnings).toHaveLength(0);

    // Verify shape distribution
    const shapeCounts = new Map<string, number>();
    for (const node of ast.nodes) {
      shapeCounts.set(node.shape, (shapeCounts.get(node.shape) ?? 0) + 1);
    }
    expect(shapeCounts.get("rect")).toBe(17);
    expect(shapeCounts.get("rounded")).toBe(17);
    expect(shapeCounts.get("diamond")).toBe(17);
    expect(shapeCounts.get("stadium")).toBe(17);
    expect(shapeCounts.get("cylinder")).toBe(16);
    expect(shapeCounts.get("queue")).toBe(16);

    // Layout
    const layoutStart = performance.now();
    const layout = computeLayout(ast);
    const layoutTime = performance.now() - layoutStart;

    expect(layout.nodes).toHaveLength(100);
    expect(layout.edges).toHaveLength(90);

    // All nodes should have valid positions
    for (const node of layout.nodes) {
      expect(node.x).toBeGreaterThan(0);
      expect(node.y).toBeGreaterThan(0);
      expect(node.width).toBeGreaterThan(0);
      expect(node.height).toBeGreaterThan(0);
    }

    console.log(`Parse time: ${parseTime.toFixed(1)}ms`);
    console.log(`Layout time: ${layoutTime.toFixed(1)}ms`);
    console.log(`Total: ${(parseTime + layoutTime).toFixed(1)}ms`);
  });
});
