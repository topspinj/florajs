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
  const layout = computeLayout(ast, theme);
  const svg = renderSVG(layout, options);

  target.innerHTML = "";
  target.appendChild(svg);

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

export interface ToPNGOptions extends FloraOptions {
  scale?: number;
}

export async function toPNG(input: string, options: ToPNGOptions = {}): Promise<Blob> {
  const { svg, warnings: _ } = toSVGElement(input, options);
  const scale = options.scale ?? 2;

  // Read the viewBox to get the intrinsic dimensions
  const vb = svg.getAttribute("viewBox")?.split(" ").map(Number) ?? [0, 0, 800, 600];
  const width = vb[2];
  const height = vb[3];

  // Set explicit pixel dimensions so the serialized SVG rasterizes at the right size
  svg.setAttribute("width", String(width * scale));
  svg.setAttribute("height", String(height * scale));

  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(svg);
  const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const img = new Image();
  img.width = width * scale;
  img.height = height * scale;

  const loaded = new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Failed to load SVG as image"));
  });
  img.src = url;
  await loaded;

  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  URL.revokeObjectURL(url);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) resolve(b);
      else reject(new Error("Canvas toBlob failed"));
    }, "image/png");
  });
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
