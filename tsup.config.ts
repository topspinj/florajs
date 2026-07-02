import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/rehype.ts", "src/react.tsx"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  noExternal: ["@dagrejs/dagre"],
});
