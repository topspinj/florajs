import { parse } from "./parser/index.js";
import { computeLayout } from "./layout/index.js";
import { renderSVG } from "./renderer/index.js";
import { renderSVGString, type RenderSVGStringOptions } from "./renderer/svg-string.js";
import { defaultTheme } from "./themes/default.js";
import { tufteTheme } from "./themes/tufte.js";
import { digitalTheme } from "./themes/digital.js";
import { resolveTheme } from "./themes/index.js";
import type { FloraOptions, DiagramAST, FloraTheme, LayoutResult, ParseWarning } from "./types.js";
import { checkStrict } from "./errors.js";

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function renderUnsupportedSVG(detectedType: string, theme: FloraTheme): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", "100%");
  svg.setAttribute("viewBox", "0 0 400 120");
  svg.style.background = theme.background;

  const text1 = document.createElementNS("http://www.w3.org/2000/svg", "text");
  text1.setAttribute("x", "200");
  text1.setAttribute("y", "45");
  text1.setAttribute("text-anchor", "middle");
  text1.setAttribute("font-family", theme.fontFamily);
  text1.setAttribute("font-size", String(theme.fontSize));
  text1.setAttribute("fill", theme.edgeColors.stroke);
  text1.textContent = `Unsupported diagram type: ${detectedType}`;
  svg.appendChild(text1);

  const text2 = document.createElementNS("http://www.w3.org/2000/svg", "text");
  text2.setAttribute("x", "200");
  text2.setAttribute("y", "75");
  text2.setAttribute("text-anchor", "middle");
  text2.setAttribute("font-family", theme.fontFamily);
  text2.setAttribute("font-size", String(theme.fontSize - 2));
  text2.setAttribute("fill", theme.edgeColors.label);
  text2.textContent = "Flora currently supports flowchart diagrams only.";
  svg.appendChild(text2);

  return svg;
}

function renderUnsupportedSVGString(detectedType: string, theme: FloraTheme): string {
  const escaped = escapeXml(detectedType);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 400 120" style="background:${escapeXml(theme.background)}">`
    + `<text x="200" y="45" text-anchor="middle" font-family="${escapeXml(theme.fontFamily)}" font-size="${theme.fontSize}" fill="${escapeXml(theme.edgeColors.stroke)}">Unsupported diagram type: ${escaped}</text>`
    + `<text x="200" y="75" text-anchor="middle" font-family="${escapeXml(theme.fontFamily)}" font-size="${theme.fontSize - 2}" fill="${escapeXml(theme.edgeColors.label)}">Flora currently supports flowchart diagrams only.</text>`
    + `</svg>`;
}

export interface RenderResult {
  warnings: ParseWarning[];
  unsupportedType?: string;
}

export function render(input: string, target: HTMLElement, options: FloraOptions = {}): RenderResult {
  const { ast, warnings } = parse(input);
  checkStrict(options.strict, warnings, ast.type === "unsupported" ? ast.detectedType : undefined);

  if (ast.type === "unsupported") {
    target.innerHTML = "";
    target.appendChild(renderUnsupportedSVG(ast.detectedType, resolveTheme(options.theme)));
    return { warnings, unsupportedType: ast.detectedType };
  }

  const theme = resolveTheme(options.theme);
  const layout = computeLayout(ast, theme);
  const svg = renderSVG(layout, options);

  target.innerHTML = "";
  target.appendChild(svg);

  return { warnings };
}

export function toAST(input: string, options: { strict?: boolean } = {}): { ast: DiagramAST; warnings: ParseWarning[] } {
  const result = parse(input);
  checkStrict(options.strict, result.warnings, result.ast.type === "unsupported" ? result.ast.detectedType : undefined);
  return result;
}

export function toLayout(input: string, options: { strict?: boolean } = {}): { layout: LayoutResult; warnings: ParseWarning[]; unsupportedType?: string } {
  const { ast, warnings } = parse(input);
  checkStrict(options.strict, warnings, ast.type === "unsupported" ? ast.detectedType : undefined);
  if (ast.type === "unsupported") {
    return { layout: { nodes: [], edges: [], subgraphs: [], width: 0, height: 0 }, warnings, unsupportedType: ast.detectedType };
  }
  const layout = computeLayout(ast);
  return { layout, warnings };
}

export function toSVGElement(input: string, options: FloraOptions = {}): { svg: SVGSVGElement; warnings: ParseWarning[]; unsupportedType?: string } {
  const { ast, warnings } = parse(input);
  checkStrict(options.strict, warnings, ast.type === "unsupported" ? ast.detectedType : undefined);
  if (ast.type === "unsupported") {
    return { svg: renderUnsupportedSVG(ast.detectedType, resolveTheme(options.theme)), warnings, unsupportedType: ast.detectedType };
  }
  const layout = computeLayout(ast);
  const svg = renderSVG(layout, options);
  return { svg, warnings };
}

export function toSVGString(input: string, options: RenderSVGStringOptions & { strict?: boolean } = {}): { svg: string; warnings: ParseWarning[]; unsupportedType?: string } {
  const { ast, warnings } = parse(input);
  checkStrict(options.strict, warnings, ast.type === "unsupported" ? ast.detectedType : undefined);
  if (ast.type === "unsupported") {
    return { svg: renderUnsupportedSVGString(ast.detectedType, resolveTheme(options.theme)), warnings, unsupportedType: ast.detectedType };
  }
  const theme = resolveTheme(options.theme);
  const layout = computeLayout(ast, theme);
  const svg = renderSVGString(layout, options);
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

export { FloraParseError } from "./errors.js";
export { parse } from "./parser/index.js";
export { computeLayout } from "./layout/index.js";
export { renderSVG } from "./renderer/index.js";
export { renderSVGString } from "./renderer/svg-string.js";
export type { RenderSVGStringOptions } from "./renderer/svg-string.js";
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
  ParseWarningSeverity,
  ParseResult,
  ThemePreset,
  UnsupportedDiagramAST,
} from "./types.js";
