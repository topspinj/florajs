import { describe, it, expect } from "vitest";
import { buildAdjacencyList, getUpstream, getDownstream } from "../../src/renderer/highlight.js";
import type { LayoutEdge } from "../../src/types.js";

function makeEdge(from: string, to: string): LayoutEdge {
  return { from, to, style: "solid", points: [] };
}

describe("buildAdjacencyList", () => {
  it("builds forward and reverse maps from edges", () => {
    const edges = [makeEdge("A", "B"), makeEdge("B", "C")];
    const adj = buildAdjacencyList(edges);

    expect(adj.forward.get("A")).toEqual(["B"]);
    expect(adj.forward.get("B")).toEqual(["C"]);
    expect(adj.reverse.get("B")).toEqual(["A"]);
    expect(adj.reverse.get("C")).toEqual(["B"]);
  });

  it("handles multiple outgoing edges", () => {
    const edges = [makeEdge("A", "B"), makeEdge("A", "C")];
    const adj = buildAdjacencyList(edges);

    expect(adj.forward.get("A")).toEqual(["B", "C"]);
  });

  it("handles empty edge list", () => {
    const adj = buildAdjacencyList([]);
    expect(adj.forward.size).toBe(0);
    expect(adj.reverse.size).toBe(0);
  });
});

describe("getUpstream", () => {
  it("returns all ancestors of a node", () => {
    // A → B → C → D
    const edges = [makeEdge("A", "B"), makeEdge("B", "C"), makeEdge("C", "D")];
    const adj = buildAdjacencyList(edges);

    const upstream = getUpstream("D", adj);
    expect(upstream).toEqual(new Set(["A", "B", "C"]));
  });

  it("returns empty set for a root node", () => {
    const edges = [makeEdge("A", "B")];
    const adj = buildAdjacencyList(edges);

    expect(getUpstream("A", adj)).toEqual(new Set());
  });

  it("handles diamond dependencies", () => {
    // A → B, A → C, B → D, C → D
    const edges = [makeEdge("A", "B"), makeEdge("A", "C"), makeEdge("B", "D"), makeEdge("C", "D")];
    const adj = buildAdjacencyList(edges);

    const upstream = getUpstream("D", adj);
    expect(upstream).toEqual(new Set(["A", "B", "C"]));
  });
});

describe("getDownstream", () => {
  it("returns all descendants of a node", () => {
    // A → B → C → D
    const edges = [makeEdge("A", "B"), makeEdge("B", "C"), makeEdge("C", "D")];
    const adj = buildAdjacencyList(edges);

    const downstream = getDownstream("A", adj);
    expect(downstream).toEqual(new Set(["B", "C", "D"]));
  });

  it("returns empty set for a leaf node", () => {
    const edges = [makeEdge("A", "B")];
    const adj = buildAdjacencyList(edges);

    expect(getDownstream("B", adj)).toEqual(new Set());
  });

  it("handles fan-out", () => {
    // A → B, A → C, A → D
    const edges = [makeEdge("A", "B"), makeEdge("A", "C"), makeEdge("A", "D")];
    const adj = buildAdjacencyList(edges);

    const downstream = getDownstream("A", adj);
    expect(downstream).toEqual(new Set(["B", "C", "D"]));
  });
});

describe("cycle handling", () => {
  it("does not loop infinitely on cycles", () => {
    // A → B → C → A (cycle)
    const edges = [makeEdge("A", "B"), makeEdge("B", "C"), makeEdge("C", "A")];
    const adj = buildAdjacencyList(edges);

    const downstream = getDownstream("A", adj);
    expect(downstream).toEqual(new Set(["B", "C"]));

    const upstream = getUpstream("A", adj);
    expect(upstream).toEqual(new Set(["B", "C"]));
  });
});

describe("disconnected nodes", () => {
  it("returns empty sets for nodes not in any edge", () => {
    const edges = [makeEdge("A", "B")];
    const adj = buildAdjacencyList(edges);

    expect(getUpstream("X", adj)).toEqual(new Set());
    expect(getDownstream("X", adj)).toEqual(new Set());
  });
});
