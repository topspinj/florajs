// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, toSVGString } from "../../src/index.js";

const GARBAGE = "this is not a diagram at all";

describe("parse-failure rendering", () => {
  it("render() shows an error card instead of a blank SVG when nothing parses", () => {
    const target = document.createElement("div");
    const { warnings } = render(GARBAGE, target);

    const svg = target.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg!.textContent).toContain("Could not parse diagram");
    expect(svg!.textContent).toMatch(/Line \d+:/);
    expect(warnings.some((w) => w.severity === "error")).toBe(true);
  });

  it("toSVGString() produces the error card for unparseable input", () => {
    const { svg } = toSVGString(GARBAGE);
    expect(svg).toContain("Could not parse diagram");
    expect(svg).toMatch(/Line \d+:/);
  });

  it("does not show the error card when input is empty", () => {
    const { svg } = toSVGString("flowchart LR");
    expect(svg).not.toContain("Could not parse diagram");
  });

  it("does not show the error card when part of the diagram parsed", () => {
    const { svg } = toSVGString("flowchart LR\n  A --> B\n  broken line here");
    expect(svg).not.toContain("Could not parse diagram");
    expect(svg).toContain("flora-node");
  });

  it("caps the listed errors and summarizes the rest", () => {
    const manyBroken = "flowchart LR\n" + Array.from({ length: 6 }, (_, i) => `  x${i} y${i} z${i}\n`).join("");
    const { svg } = toSVGString(manyBroken);
    expect(svg).toContain("Could not parse diagram");
    expect(svg).toContain("and 3 more");
  });
});
