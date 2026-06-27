import { describe, it, expect } from "vitest";
import { renderSVGString } from "../../src/renderer/svg-string.js";
import { computeLayout } from "../../src/layout/index.js";
import { parse } from "../../src/parser/index.js";

function renderFromSource(source: string, theme?: string) {
  const { ast } = parse(source);
  const layout = computeLayout(ast);
  return renderSVGString(layout, { theme: theme as any });
}

describe("renderSVGString", () => {
  it("returns a valid SVG string", () => {
    const svg = renderFromSource("flowchart TD\n  A --> B");
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    expect(svg).toMatch(/<\/svg>$/);
  });

  it("includes node labels", () => {
    const svg = renderFromSource("flowchart TD\n  A[Hello World] --> B[Goodbye]");
    expect(svg).toContain("Hello World");
    expect(svg).toContain("Goodbye");
  });

  it("includes edge labels", () => {
    const svg = renderFromSource("flowchart TD\n  A -->|yes| B");
    expect(svg).toContain("yes");
  });

  it("renders subgraph labels", () => {
    const svg = renderFromSource("flowchart TD\n  subgraph MyGroup\n    A --> B\n  end");
    expect(svg).toContain("MyGroup");
  });

  it("renders all node shapes", () => {
    const source = `flowchart TD
  A[Rect] --> B{Diamond}
  B --> C([Stadium])
  C --> D((Circle))
  D --> E[(Cylinder)]`;
    const svg = renderFromSource(source);
    expect(svg).toContain("flora-node");
    expect(svg).toContain("Rect");
    expect(svg).toContain("Diamond");
    expect(svg).toContain("Stadium");
    expect(svg).toContain("Circle");
    expect(svg).toContain("Cylinder");
  });

  it("applies digital (dark) theme", () => {
    const svg = renderFromSource("flowchart TD\n  A --> B", "digital");
    expect(svg).toContain("#0F172A"); // digital theme background
  });

  it("applies sketch theme with hand-drawn paths", () => {
    const svg = renderFromSource("flowchart TD\n  A --> B", "sketch");
    // Sketch mode produces multiple <path> elements per node (fill + 2 strokes)
    const pathCount = (svg.match(/<path /g) || []).length;
    expect(pathCount).toBeGreaterThan(2);
  });

  it("does not contain DOM-specific artifacts", () => {
    const svg = renderFromSource("flowchart TD\n  A --> B");
    expect(svg).not.toContain("addEventListener");
    expect(svg).not.toContain("cursor");
    expect(svg).not.toContain("transition");
  });

  it("escapes special characters in labels", () => {
    const svg = renderFromSource('flowchart TD\n  A[<script>alert</script>] --> B');
    expect(svg).not.toContain("<script>");
    expect(svg).toContain("&lt;script&gt;");
  });
});
