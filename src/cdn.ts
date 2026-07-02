import { render } from "./index.js";
import { themes } from "./themes/index.js";
import type { FloraOptions, ThemePreset } from "./types.js";

/**
 * `<flora-diagram>` custom element.
 *
 * Reads its text content as Flora/Mermaid source and renders the diagram
 * into a shadow root, so the source text stays in the light DOM and the
 * element can re-render when it changes.
 *
 * Attributes:
 * - `theme` — theme preset name ("default", "tufte", "digital", "sketch")
 * - `interactive` — zoom/pan/hover/click, on by default like the core API; set `interactive="false"` to disable
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

    const themeAttr = this.getAttribute("theme");
    const options: FloraOptions = {
      theme: themeAttr && themeAttr in themes ? (themeAttr as ThemePreset) : undefined,
      interactive: this.getAttribute("interactive") !== "false",
    };

    render(source, this.#container, options);
  }
}

export function registerFloraDiagram(tagName = "flora-diagram"): void {
  if (typeof customElements !== "undefined" && !customElements.get(tagName)) {
    customElements.define(tagName, FloraDiagramElement);
  }
}

registerFloraDiagram();

export * from "./index.js";
