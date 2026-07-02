import { describe, it, expect } from "vitest";
import rehypeFlora from "../../src/rehype.js";
import { FloraParseError } from "../../src/index.js";

function makeCodeBlock(lang: string, code: string) {
  return {
    type: "root" as const,
    children: [
      {
        type: "element" as const,
        tagName: "pre",
        properties: {},
        children: [
          {
            type: "element" as const,
            tagName: "code",
            properties: { className: [`language-${lang}`] },
            children: [{ type: "text" as const, value: code }],
          },
        ],
      },
    ],
  };
}

describe("rehypeFlora", () => {
  it("transforms a flora code block into an SVG", () => {
    const tree = makeCodeBlock("flora", "flowchart TD\n  A --> B");
    const plugin = rehypeFlora();
    plugin(tree as any);

    const div = tree.children[0] as any;
    expect(div.tagName).toBe("div");
    expect(div.properties.className).toContain("flora-diagram");
    expect(div.children[0].type).toBe("raw");
    expect(div.children[0].value).toMatch(/^<svg/);
  });

  it("transforms a flowchart code block", () => {
    const tree = makeCodeBlock("flowchart", "flowchart LR\n  X --> Y");
    const plugin = rehypeFlora();
    plugin(tree as any);

    const div = tree.children[0] as any;
    expect(div.tagName).toBe("div");
    expect(div.children[0].value).toContain("X");
    expect(div.children[0].value).toContain("Y");
  });

  it("leaves non-flora code blocks untouched", () => {
    const tree = makeCodeBlock("javascript", "const x = 1;");
    const plugin = rehypeFlora();
    plugin(tree as any);

    const pre = tree.children[0] as any;
    expect(pre.tagName).toBe("pre");
  });

  it("applies a custom theme", () => {
    const tree = makeCodeBlock("flora", "flowchart TD\n  A --> B");
    const plugin = rehypeFlora({ theme: "digital" });
    plugin(tree as any);

    const div = tree.children[0] as any;
    expect(div.children[0].value).toContain("#0F172A");
  });

  it("uses custom className", () => {
    const tree = makeCodeBlock("flora", "flowchart TD\n  A --> B");
    const plugin = rehypeFlora({ className: "my-diagram" });
    plugin(tree as any);

    const div = tree.children[0] as any;
    expect(div.properties.className).toContain("my-diagram");
  });

  it("supports custom languages option", () => {
    const tree = makeCodeBlock("graph", "flowchart TD\n  A --> B");
    const plugin = rehypeFlora({ languages: ["graph"] });
    plugin(tree as any);

    const div = tree.children[0] as any;
    expect(div.tagName).toBe("div");
  });

  it("throws FloraParseError on parse errors by default (strict)", () => {
    const tree = makeCodeBlock("flora", "flowchart LR\n  A --> B C");
    const plugin = rehypeFlora();
    expect(() => plugin(tree as any)).toThrow(FloraParseError);
  });

  it("throws FloraParseError on unsupported diagram types by default (strict)", () => {
    const tree = makeCodeBlock("flora", "sequenceDiagram\n  A->>B: hi");
    const plugin = rehypeFlora();
    expect(() => plugin(tree as any)).toThrow(/sequenceDiagram/);
  });

  it("renders best-effort with strict: false", () => {
    const tree = makeCodeBlock("flora", "flowchart LR\n  A --> B C\n  D --> E");
    const plugin = rehypeFlora({ strict: false });
    plugin(tree as any);

    const div = tree.children[0] as any;
    expect(div.tagName).toBe("div");
    expect(div.children[0].value).toContain("D");
  });

  it("does not throw on info-only diagnostics in strict mode", () => {
    const tree = makeCodeBlock("flora", "flowchart LR\n  A --> B\n  classDef red fill:#f00");
    const plugin = rehypeFlora();
    plugin(tree as any);

    const div = tree.children[0] as any;
    expect(div.tagName).toBe("div");
  });
});
