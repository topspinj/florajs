import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: ["src/index.ts", "src/rehype.ts", "src/react.tsx"],
    format: ["esm", "cjs"],
    dts: true,
    // Exclude the IIFE config's output from cleaning: the two configs build
    // concurrently (and rebuild independently in watch mode) into the same
    // outDir, so an unqualified clean here can delete dist/flora.min.js.
    clean: ["!flora.min.js"],
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
