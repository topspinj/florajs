// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";

vi.mock("../../src/layout/index.js", () => ({
  computeLayout: () => {
    throw new Error("forced layout failure");
  },
}));

import { render } from "../../src/index.js";

describe("render() error boundary", () => {
  it("renders an error-state SVG instead of throwing when layout fails", () => {
    const target = document.createElement("div");

    const result = render(`flowchart LR\n  A --> B`, target);

    expect(result.error).toBeInstanceOf(Error);
    expect(result.error!.message).toBe("forced layout failure");
    const svg = target.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg!.textContent).toContain("Diagram failed to render");
  });

  it("still returns parse warnings alongside the internal error", () => {
    const target = document.createElement("div");

    const result = render(`flowchart LR\n  A --> B\n  style A fill:#f9f`, target);

    expect(result.error).toBeInstanceOf(Error);
    expect(result.warnings.some((w) => w.severity === "info")).toBe(true);
    expect(target.querySelector("svg")).not.toBeNull();
  });
});
