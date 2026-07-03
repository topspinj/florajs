import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: ["src/index.ts", "src/rehype.ts", "src/react.tsx"],
    format: ["esm", "cjs"],
    dts: true,
    clean: true,
    noExternal: ["@dagrejs/dagre"],
  },
  {
    // Standalone browser/embedded-engine bundle. Used by the Python package
    // (python/) and anywhere a single <script> tag is needed.
    entry: { flora: "src/index.ts" },
    format: ["iife"],
    globalName: "Flora",
    platform: "browser",
    minify: true,
    noExternal: ["@dagrejs/dagre"],
    outExtension: () => ({ js: ".iife.js" }),
  },
]);
