import { render } from "./index.js";
import type { FloraOptions, ThemePreset } from "./types.js";

/**
 * `<flora-diagram>` custom element.
 *
 * Reads its text content as Flora/Mermaid source and renders the diagram
 * into a shadow root, so the source text stays in the light DOM and the
 * element can re-render when it changes.
 *
 * Attributes:
 * - `theme` — theme preset name ("default", "tufte", "digital", "sketch"); unknown names fall back to default
 * - `interactive` — zoom/pan/hover/click, on by default like the core API; set `interactive="false"` to disable
 *
 * Events:
 * - `flora-warnings` — dispatched after a render that produced parse warnings,
 *   with `detail.warnings` set to the `ParseWarning[]` from the core API
 */
export class FloraDiagramElement extends HTMLElement {
  static observedAttributes = ["theme", "interactive"];

  #container: HTMLDivElement;
  #observer: MutationObserver | null = null;

  constructor() {
    super();
    const shadow = this.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = ":host { display: block; }";
    this.#container = document.createElement("div");
    shadow.append(style, this.#container);
  }

  connectedCallback(): void {
    this.#render();
    this.#observer = new MutationObserver(() => this.#render());
    this.#observer.observe(this, { childList: true, characterData: true, subtree: true });
  }

  disconnectedCallback(): void {
    this.#observer?.disconnect();
    this.#observer = null;
  }

  attributeChangedCallback(_name: string, oldValue: string | null, newValue: string | null): void {
    if (oldValue === newValue) return;
    if (this.isConnected) this.#render();
  }

  #render(): void {
    const source = (this.textContent ?? "").trim();
    if (!source) {
      this.#container.innerHTML = "";
      return;
    }

    const options: FloraOptions = {
      // resolveTheme falls back to the default theme for unknown names
      theme: (this.getAttribute("theme") ?? undefined) as ThemePreset | undefined,
      interactive: this.getAttribute("interactive") !== "false",
    };

    const { warnings } = render(source, this.#container, options);
    if (warnings.length > 0) {
      this.dispatchEvent(
        new CustomEvent("flora-warnings", { detail: { warnings }, bubbles: true, composed: true }),
      );
    }
  }
}

let elementClassUsed = false;

export function registerFloraDiagram(tagName = "flora-diagram"): void {
  if (typeof customElements === "undefined" || customElements.get(tagName)) return;
  // A constructor can back only one definition per registry, so tag names
  // beyond the first get their own subclass.
  customElements.define(tagName, elementClassUsed ? class extends FloraDiagramElement {} : FloraDiagramElement);
  elementClassUsed = true;
}

registerFloraDiagram();

export * from "./index.js";
