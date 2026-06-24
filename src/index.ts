import { parse } from "./parser/index.js";
import { computeLayout } from "./layout/index.js";
import { renderSVG } from "./renderer/index.js";
import { defaultTheme } from "./themes/default.js";
import type { FloraOptions, DiagramAST, LayoutResult } from "./types.js";

export function render(input: string, target: HTMLElement, options: FloraOptions = {}): void {
  const ast = parse(input);
  const layout = computeLayout(ast);
  const svg = renderSVG(layout, options);

  target.innerHTML = "";
  target.appendChild(svg);
}

export function toAST(input: string): DiagramAST {
  return parse(input);
}

export function toLayout(input: string): LayoutResult {
  const ast = parse(input);
  return computeLayout(ast);
}

export function toSVGElement(input: string, options: FloraOptions = {}): SVGSVGElement {
  const ast = parse(input);
  const layout = computeLayout(ast);
  return renderSVG(layout, options);
}

export { parse } from "./parser/index.js";
export { computeLayout } from "./layout/index.js";
export { renderSVG } from "./renderer/index.js";
export { defaultTheme } from "./themes/default.js";
export type {
  DiagramAST,
  DiagramType,
  FloraOptions,
  FloraTheme,
  FlowchartAST,
  FlowchartNode,
  FlowchartEdge,
  FlowchartDirection,
  NodeShape,
  LayoutResult,
  LayoutNode,
  LayoutEdge,
} from "./types.js";
