import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: ["src/index.ts", "src/rehype.ts", "src/react.tsx"],
    format: ["esm", "cjs"],
    dts: true,
    // Exclude the IIFE configs' output from cleaning: the configs build
    // concurrently (and rebuild independently in watch mode) into the same
    // outDir, so an unqualified clean here can delete their bundles.
    clean: ["!flora.min.js", "!flora.iife.js"],
    noExternal: ["@dagrejs/dagre"],
  },
  // Single-file browser bundle for CDN usage: exposes window.Flora and
  // registers the <flora-diagram> custom element. Kept separate from the
  // ESM/CJS builds so it doesn't affect tree-shaking for npm users.
  {
    entry: { flora: "src/cdn.ts" },
    format: ["iife"],
    globalName: "Flora",
    platform: "browser",
    minify: true,
    noExternal: ["@dagrejs/dagre"],
    outExtension: () => ({ js: ".min.js" }),
  },
  // Core-only IIFE bundle: same global, no web component, and loads without
  // a DOM. Vendored into the Python package (python/), which evaluates it in
  // an embedded V8 engine for headless SVG export — src/cdn.ts can't serve
  // that host because `class extends HTMLElement` throws at load time
  // outside a browser.
  {
    entry: { flora: "src/index.ts" },
    format: ["iife"],
    globalName: "Flora",
    platform: "browser",
    minify: true,
    noExternal: ["@dagrejs/dagre"],
    outExtension: () => ({ js: ".iife.js" }),
  },
]);
