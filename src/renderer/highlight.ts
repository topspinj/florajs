import type { LayoutEdge } from "../types.js";

export interface AdjacencyList {
  forward: Map<string, string[]>; // from → [to] (downstream)
  reverse: Map<string, string[]>; // to → [from] (upstream)
}

export function buildAdjacencyList(edges: LayoutEdge[]): AdjacencyList {
  const forward = new Map<string, string[]>();
  const reverse = new Map<string, string[]>();

  for (const edge of edges) {
    if (!forward.has(edge.from)) forward.set(edge.from, []);
    forward.get(edge.from)!.push(edge.to);

    if (!reverse.has(edge.to)) reverse.set(edge.to, []);
    reverse.get(edge.to)!.push(edge.from);
  }

  return { forward, reverse };
}

function bfs(start: string, adjacency: Map<string, string[]>): Set<string> {
  const visited = new Set<string>();
  const queue = [start];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);
    const neighbors = adjacency.get(current);
    if (neighbors) {
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) queue.push(neighbor);
      }
    }
  }

  visited.delete(start); // exclude the start node itself
  return visited;
}

export function getUpstream(nodeId: string, adj: AdjacencyList): Set<string> {
  return bfs(nodeId, adj.reverse);
}

export function getDownstream(nodeId: string, adj: AdjacencyList): Set<string> {
  return bfs(nodeId, adj.forward);
}
