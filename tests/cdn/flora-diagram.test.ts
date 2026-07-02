import { describe, it, expect, afterEach } from "vitest";
import { FloraDiagramElement, registerFloraDiagram } from "../../src/cdn.js";

// We need jsdom for DOM APIs used by the renderer
// @vitest-environment jsdom

const SIMPLE_SOURCE = "flowchart TD\n  A[Start] --> B[End]";

// MutationObserver callbacks run as microtasks; flush them before asserting
const flushMutations = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function createDiagram(source = SIMPLE_SOURCE): FloraDiagramElement {
  const el = document.createElement("flora-diagram") as FloraDiagramElement;
  el.textContent = source;
  document.body.appendChild(el);
  return el;
}

describe("<flora-diagram> web component", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("is registered on import", () => {
    expect(customElements.get("flora-diagram")).toBe(FloraDiagramElement);
  });

  it("registerFloraDiagram is idempotent", () => {
    expect(() => registerFloraDiagram()).not.toThrow();
  });

  it("renders an SVG into the shadow root on connect", () => {
    const el = createDiagram();
    const svg = el.shadowRoot!.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg!.innerHTML).toContain("Start");
  });

  it("keeps the source text in the light DOM", () => {
    const el = createDiagram();
    expect(el.textContent).toContain("flowchart TD");
    expect(el.querySelector("svg")).toBeNull();
  });

  it("re-renders when the text content changes", async () => {
    const el = createDiagram();
    el.textContent = "flowchart LR\n  X[Updated] --> Y";
    await flushMutations();
    const svg = el.shadowRoot!.querySelector("svg");
    expect(svg!.innerHTML).toContain("Updated");
    expect(svg!.innerHTML).not.toContain("Start");
  });

  it("re-renders when the theme attribute changes", () => {
    const el = createDiagram();
    const before = el.shadowRoot!.querySelector("svg")!.outerHTML;
    el.setAttribute("theme", "digital");
    const after = el.shadowRoot!.querySelector("svg")!.outerHTML;
    expect(after).not.toBe(before);
  });

  it("ignores unknown theme names instead of crashing", () => {
    const el = createDiagram();
    expect(() => el.setAttribute("theme", "not-a-theme")).not.toThrow();
    expect(el.shadowRoot!.querySelector("svg")).not.toBeNull();
  });

  it("clears the diagram when the source becomes empty", async () => {
    const el = createDiagram();
    el.textContent = "";
    await flushMutations();
    expect(el.shadowRoot!.querySelector("svg")).toBeNull();
  });

  it("stops observing after disconnect", async () => {
    const el = createDiagram();
    el.remove();
    el.textContent = "flowchart LR\n  P[Detached] --> Q";
    await flushMutations();
    const svg = el.shadowRoot!.querySelector("svg");
    expect(svg!.innerHTML).not.toContain("Detached");
  });
});
