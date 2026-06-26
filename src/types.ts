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
  parentId?: string;
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
  subgraphSummary?: string;
}

export interface LayoutSubgraph {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  collapsed: boolean;
  nodeCount: number;
  parentId?: string;
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
  subgraphs: LayoutSubgraph[];
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
  subgraphColors: {
    fill: string;
    stroke: string;
    label: string;
  };
}

export type ThemePreset = "default" | "tufte" | "digital";

export interface FloraOptions {
  theme?: ThemePreset | Partial<FloraTheme>;
  interactive?: boolean;
  onNodeClick?: (nodeId: string) => void;
  onNodeHover?: (nodeId: string | null) => void;
  onSubgraphClick?: (subgraphId: string) => void;
  onHighlight?: (nodeId: string, upstream: string[], downstream: string[]) => void;
}

export interface ParseWarning {
  line: number;
  col: number;
  message: string;
}

export interface ParseResult {
  ast: DiagramAST;
  warnings: ParseWarning[];
}
