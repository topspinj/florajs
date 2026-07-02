import { parse } from "./parser/index.js";
import { computeLayout } from "./layout/index.js";
import { renderSVGString } from "./renderer/svg-string.js";
import { resolveTheme } from "./themes/index.js";
import { checkStrict } from "./errors.js";
import type { ThemePreset, FloraTheme } from "./types.js";

export interface RehypeFloraOptions {
  theme?: ThemePreset | Partial<FloraTheme>;
  /** Additional CSS class(es) to add to the wrapper <div>. */
  className?: string;
  /** Code block languages to match. Defaults to ["flora", "flowchart"]. */
  languages?: string[];
  /**
   * Fail the build (throw FloraParseError) when a diagram has parse errors
   * or an unsupported type, instead of publishing a silently wrong or
   * missing diagram. Defaults to true; set to false to render best-effort.
   */
  strict?: boolean;
}

interface HastNode {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
  value?: string;
}

function getCodeText(node: HastNode): string {
  if (node.type === "text") return node.value ?? "";
  if (!node.children) return "";
  return node.children.map(getCodeText).join("");
}

function isFloraCodeBlock(node: HastNode, languages: string[]): boolean {
  if (node.type !== "element" || node.tagName !== "pre") return false;
  const children = node.children;
  if (!children || children.length !== 1) return false;
  const code = children[0];
  if (!code || code.type !== "element" || code.tagName !== "code") return false;
  const className = code.properties?.className;
  if (!Array.isArray(className)) return false;
  return className.some(
    (cls) => typeof cls === "string" && languages.some((lang) => cls === `language-${lang}`),
  );
}

function visit(node: HastNode, fn: (node: HastNode, index: number, parent: HastNode) => void): void {
  if (!node.children) return;
  for (let i = 0; i < node.children.length; i++) {
    fn(node.children[i]!, i, node);
    visit(node.children[i]!, fn);
  }
}

export default function rehypeFlora(options: RehypeFloraOptions = {}) {
  const languages = options.languages ?? ["flora", "flowchart"];
  const className = options.className ?? "flora-diagram";
  const strict = options.strict ?? true;

  return (tree: HastNode) => {
    visit(tree, (node, index, parent) => {
      if (!isFloraCodeBlock(node, languages)) return;

      const source = getCodeText(node.children![0]!);
      const { ast, warnings } = parse(source);
      checkStrict(strict, warnings, ast.type === "unsupported" ? ast.detectedType : undefined);
      if (ast.type === "unsupported") return;
      // Nothing parsed — leave the code block so readers at least see the source
      if (ast.nodes.length === 0 && warnings.some((w) => w.severity === "error")) return;
      const theme = resolveTheme(options.theme);
      const layout = computeLayout(ast, theme);
      const svgString = renderSVGString(layout, { theme: options.theme });

      const replacement: HastNode = {
        type: "element",
        tagName: "div",
        properties: { className: [className] },
        children: [{ type: "raw", value: svgString }],
      };

      parent.children!.splice(index, 1, replacement);
    });
  };
}
