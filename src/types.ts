export type DiagramType = "flowchart" | "erd";

export type FlowchartDirection = "TB" | "TD" | "BT" | "LR" | "RL";

export type NodeShape = "rect" | "rounded" | "diamond" | "circle" | "stadium";

export interface FlowchartNode {
  id: string;
  label: string;
  shape: NodeShape;
}

export interface FlowchartEdge {
  from: string;
  to: string;
  label?: string;
  style: "solid" | "dotted" | "thick";
}

export interface FlowchartSubgraph {
  id: string;
  label: string;
  nodeIds: string[];
}

export interface FlowchartAST {
  type: "flowchart";
  direction: FlowchartDirection;
  nodes: FlowchartNode[];
  edges: FlowchartEdge[];
  subgraphs: FlowchartSubgraph[];
}

export type DiagramAST = FlowchartAST;

export interface LayoutNode {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  shape: NodeShape;
}

export interface LayoutEdge {
  from: string;
  to: string;
  label?: string;
  style: "solid" | "dotted" | "thick";
  points: Array<{ x: number; y: number }>;
}

export interface LayoutResult {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  width: number;
  height: number;
}

export interface NodeColorSet {
  fill: string;
  fillGradientEnd: string;
  stroke: string;
  text: string;
}

export interface FloraTheme {
  background: string;
  nodeColors: NodeColorSet;
  shapeColors: {
    diamond: NodeColorSet;
    stadium: NodeColorSet;
    rounded: NodeColorSet;
  };
  edgeColors: {
    stroke: string;
    label: string;
    labelBackground: string;
  };
  fontFamily: string;
  fontSize: number;
  nodeRadius: number;
  nodePadding: { x: number; y: number };
  edgeWidth: number;
  shadow: boolean;
}

export interface FloraOptions {
  theme?: Partial<FloraTheme>;
  interactive?: boolean;
  onNodeClick?: (nodeId: string) => void;
  onNodeHover?: (nodeId: string | null) => void;
}
