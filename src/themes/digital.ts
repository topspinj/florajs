import type { FloraTheme } from "../types.js";

export const digitalTheme: FloraTheme = {
  background: "#0F172A",
  nodeColors: {
    fill: "#1E293B",
    fillGradientEnd: "#1E293B",
    stroke: "#38BDF8",
    text: "#F1F5F9",
  },
  shapeColors: {
    diamond: {
      fill: "#1E293B",
      fillGradientEnd: "#1E293B",
      stroke: "#FB923C",
      text: "#F1F5F9",
    },
    stadium: {
      fill: "#1E293B",
      fillGradientEnd: "#1E293B",
      stroke: "#34D399",
      text: "#F1F5F9",
    },
    rounded: {
      fill: "#1E293B",
      fillGradientEnd: "#1E293B",
      stroke: "#A78BFA",
      text: "#F1F5F9",
    },
    cylinder: {
      fill: "#1E293B",
      fillGradientEnd: "#1E293B",
      stroke: "#60A5FA",
      text: "#F1F5F9",
    },
    queue: {
      fill: "#1E293B",
      fillGradientEnd: "#1E293B",
      stroke: "#F87171",
      text: "#F1F5F9",
    },
  },
  edgeColors: {
    stroke: "#38BDF8",
    label: "#94A3B8",
    labelBackground: "#1E293B",
  },
  fontFamily:
    '"SF Mono", "Fira Code", "Cascadia Code", "JetBrains Mono", monospace',
  fontSize: 14,
  nodeRadius: 2,
  nodePadding: { x: 24, y: 14 },
  edgeWidth: 1.5,
  shadow: false,
  handDrawn: false,
  subgraphColors: {
    fill: "rgba(56, 189, 248, 0.08)",
    stroke: "rgba(56, 189, 248, 0.3)",
    label: "#38BDF8",
  },
};
