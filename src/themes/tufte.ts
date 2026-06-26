import type { FloraTheme } from "../types.js";

export const tufteTheme: FloraTheme = {
  background: "#FFFFF8",
  nodeColors: {
    fill: "#FFFFF8",
    fillGradientEnd: "#FFFFF8",
    stroke: "#333333",
    text: "#111111",
  },
  shapeColors: {
    diamond: {
      fill: "#FFFFF8",
      fillGradientEnd: "#FFFFF8",
      stroke: "#8B4513",
      text: "#111111",
    },
    stadium: {
      fill: "#FFFFF8",
      fillGradientEnd: "#FFFFF8",
      stroke: "#555555",
      text: "#111111",
    },
    rounded: {
      fill: "#FFFFF8",
      fillGradientEnd: "#FFFFF8",
      stroke: "#444444",
      text: "#111111",
    },
    cylinder: {
      fill: "#FFFFF8",
      fillGradientEnd: "#FFFFF8",
      stroke: "#2B5797",
      text: "#111111",
    },
    queue: {
      fill: "#FFFFF8",
      fillGradientEnd: "#FFFFF8",
      stroke: "#8B0000",
      text: "#111111",
    },
  },
  edgeColors: {
    stroke: "#333333",
    label: "#555555",
    labelBackground: "#FFFFF8",
  },
  fontFamily:
    '"ET Book", "Palatino Linotype", "Book Antiqua", Palatino, "Times New Roman", serif',
  fontSize: 15,
  nodeRadius: 0,
  nodePadding: { x: 24, y: 14 },
  edgeWidth: 1.2,
  shadow: false,
  subgraphColors: {
    fill: "rgba(51, 51, 51, 0.04)",
    stroke: "rgba(51, 51, 51, 0.25)",
    label: "#555555",
  },
};
