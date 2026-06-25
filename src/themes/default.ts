import type { FloraTheme } from "../types.js";

export const defaultTheme: FloraTheme = {
  background: "#FFFFFF",
  nodeColors: {
    fill: "#F7F8FE",
    fillGradientEnd: "#EDF0FD",
    stroke: "#0D32B2",
    text: "#0A0F25",
  },
  shapeColors: {
    diamond: {
      fill: "#FFF8F0",
      fillGradientEnd: "#FFEFD9",
      stroke: "#C77A20",
      text: "#0A0F25",
    },
    stadium: {
      fill: "#F0FAF6",
      fillGradientEnd: "#DFFAEE",
      stroke: "#1A7F5A",
      text: "#0A0F25",
    },
    rounded: {
      fill: "#F5F0FF",
      fillGradientEnd: "#EBE0FF",
      stroke: "#6B3FA0",
      text: "#0A0F25",
    },
  },
  edgeColors: {
    stroke: "#0D32B2",
    label: "#676C7E",
    labelBackground: "#F7F8FE",
  },
  fontFamily:
    '"Source Sans Pro", "Source Sans 3", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  fontSize: 16,
  nodeRadius: 4,
  nodePadding: { x: 28, y: 16 },
  edgeWidth: 2,
  shadow: false,
  subgraphColors: {
    fill: "rgba(79, 109, 245, 0.06)",
    stroke: "rgba(79, 109, 245, 0.3)",
    label: "#4f6df5",
  },
};
