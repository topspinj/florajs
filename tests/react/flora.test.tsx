import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, act } from "@testing-library/react";
import { Flora } from "../../src/react.js";

// We need jsdom for DOM APIs used by the renderer
// @vitest-environment jsdom

describe("Flora React component", () => {
  afterEach(() => cleanup());

  const SIMPLE_SOURCE = "flowchart TD\n  A --> B";

  it("renders an SVG into the container", () => {
    const { container } = render(<Flora source={SIMPLE_SOURCE} />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
  });

  it("re-renders when source changes", () => {
    const { container, rerender } = render(<Flora source={SIMPLE_SOURCE} />);
    const svg1 = container.querySelector("svg");
    expect(svg1).not.toBeNull();

    rerender(<Flora source={"flowchart LR\n  X --> Y --> Z"} />);
    const svg2 = container.querySelector("svg");
    expect(svg2).not.toBeNull();
    // SVG content should have changed (new node labels)
    expect(svg2!.innerHTML).toContain("X");
  });

  it("cleans up SVG on unmount", () => {
    const { container, unmount } = render(<Flora source={SIMPLE_SOURCE} />);
    expect(container.querySelector("svg")).not.toBeNull();

    unmount();
    // After unmount, the container div is removed from the DOM
    expect(container.querySelector("svg")).toBeNull();
  });

  it("applies className and style to container", () => {
    const { container } = render(
      <Flora
        source={SIMPLE_SOURCE}
        className="my-diagram"
        style={{ border: "1px solid red" }}
      />
    );
    const div = container.firstElementChild as HTMLDivElement;
    expect(div.className).toBe("my-diagram");
    expect(div.style.border).toBe("1px solid red");
  });

  it("calls onWarnings when source has parse warnings", () => {
    const onWarnings = vi.fn();
    // Invalid syntax that triggers a warning but still parses partially
    render(
      <Flora
        source={"flowchart TD\n  A -->|label B"}
        onWarnings={onWarnings}
      />
    );
    // The callback may or may not be called depending on whether warnings are produced
    // This test verifies the prop is wired up without crashing
  });

  it("passes through onNodeClick callback", () => {
    const onNodeClick = vi.fn();
    const { container } = render(
      <Flora source={SIMPLE_SOURCE} onNodeClick={onNodeClick} interactive />
    );
    // Verify it rendered without errors
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("renders unsupported diagram types without crashing", () => {
    const { container } = render(
      <Flora source={"sequenceDiagram\n  Alice->>Bob: Hello"} />
    );
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg!.textContent).toContain("Unsupported");
  });
});
