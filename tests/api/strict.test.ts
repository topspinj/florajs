import { describe, it, expect } from "vitest";
import { toAST, toLayout, toSVGString, FloraParseError } from "../../src/index.js";

const BROKEN = `flowchart LR
  A --> B C
  D --> E`;

const DIRECTIVES_ONLY_INFO = `flowchart LR
  A --> B
  classDef red fill:#f00`;

describe("strict mode", () => {
  it("is off by default", () => {
    const { ast, warnings } = toAST(BROKEN);
    expect(ast.type).toBe("flowchart");
    expect(warnings.some((w) => w.severity === "error")).toBe(true);
  });

  it("throws FloraParseError on error diagnostics", () => {
    expect(() => toAST(BROKEN, { strict: true })).toThrow(FloraParseError);
    expect(() => toLayout(BROKEN, { strict: true })).toThrow(FloraParseError);
    expect(() => toSVGString(BROKEN, { strict: true })).toThrow(FloraParseError);
  });

  it("includes the first error's line in the message and all diagnostics on the error", () => {
    try {
      toAST(BROKEN, { strict: true });
      expect.unreachable("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(FloraParseError);
      const err = e as FloraParseError;
      expect(err.message).toContain("line 2");
      expect(err.warnings.length).toBeGreaterThan(0);
    }
  });

  it("throws on unsupported diagram types", () => {
    expect(() => toAST("sequenceDiagram\n  A->>B: hi", { strict: true })).toThrow(FloraParseError);
    expect(() => toAST("sequenceDiagram\n  A->>B: hi", { strict: true })).toThrow(/sequenceDiagram/);
  });

  it("does not throw on info-severity diagnostics", () => {
    const { warnings } = toAST(DIRECTIVES_ONLY_INFO, { strict: true });
    expect(warnings.some((w) => w.severity === "info")).toBe(true);
  });

  it("does not throw on clean input", () => {
    const { svg } = toSVGString("flowchart LR\n  A --> B", { strict: true });
    expect(svg).toMatch(/^<svg/);
  });
});
