import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: ["src/index.ts", "src/rehype.ts", "src/react.tsx"],
    format: ["esm", "cjs"],
    dts: true,
    clean: true,
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
]);
