import { parse } from "./parser/index.js";
import { computeLayout } from "./layout/index.js";
import { renderSVG } from "./renderer/index.js";
import { defaultTheme } from "./themes/default.js";
import { tufteTheme } from "./themes/tufte.js";
import { digitalTheme } from "./themes/digital.js";
import { resolveTheme } from "./themes/index.js";
import type { FloraOptions, DiagramAST, LayoutResult, ParseWarning } from "./types.js";

export interface RenderResult {
  warnings: ParseWarning[];
}

export function render(input: string, target: HTMLElement, options: FloraOptions = {}): RenderResult {
  const { ast, warnings } = parse(input);
  const theme = resolveTheme(options.theme);
  const collapsedSubgraphs = new Set<string>();

  function doRender(): void {
    const layout = computeLayout(ast, theme, collapsedSubgraphs);
    const svg = renderSVG(layout, options, (subgraphId) => {
      if (collapsedSubgraphs.has(subgraphId)) {
        collapsedSubgraphs.delete(subgraphId);
      } else {
        collapsedSubgraphs.add(subgraphId);
      }
      options.onSubgraphClick?.(subgraphId);
      doRender();
    });

    target.innerHTML = "";
    target.appendChild(svg);
  }

  doRender();

  return { warnings };
}

export function toAST(input: string): { ast: DiagramAST; warnings: ParseWarning[] } {
  return parse(input);
}

export function toLayout(input: string): { layout: LayoutResult; warnings: ParseWarning[] } {
  const { ast, warnings } = parse(input);
  const layout = computeLayout(ast);
  return { layout, warnings };
}

export function toSVGElement(input: string, options: FloraOptions = {}): { svg: SVGSVGElement; warnings: ParseWarning[] } {
  const { ast, warnings } = parse(input);
  const layout = computeLayout(ast);
  const svg = renderSVG(layout, options);
  return { svg, warnings };
}

export { parse } from "./parser/index.js";
export { computeLayout } from "./layout/index.js";
export { renderSVG } from "./renderer/index.js";
export { defaultTheme } from "./themes/default.js";
export { tufteTheme } from "./themes/tufte.js";
export { digitalTheme } from "./themes/digital.js";
export { resolveTheme, themes } from "./themes/index.js";
export type {
  DiagramAST,
  DiagramType,
  FloraOptions,
  FloraTheme,
  FlowchartAST,
  FlowchartNode,
  FlowchartEdge,
  FlowchartSubgraph,
  FlowchartDirection,
  NodeShape,
  LayoutResult,
  LayoutNode,
  LayoutEdge,
  LayoutSubgraph,
  ParseWarning,
  ParseResult,
  ThemePreset,
} from "./types.js";
