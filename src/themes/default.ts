import type { FloraTheme } from "../types.js";

export const defaultTheme: FloraTheme = {
  background: "#FAFBFF",
  nodeColors: {
    fill: "#FFFFFF",
    fillGradientEnd: "#EEF1FE",
    stroke: "#4361EE",
    text: "#1A1D2E",
  },
  shapeColors: {
    diamond: {
      fill: "#FFFCF5",
      fillGradientEnd: "#FFF0D4",
      stroke: "#E8872B",
      text: "#1A1D2E",
    },
    stadium: {
      fill: "#F4FDF8",
      fillGradientEnd: "#D8F5E5",
      stroke: "#22A95C",
      text: "#1A1D2E",
    },
    rounded: {
      fill: "#F9F5FF",
      fillGradientEnd: "#ECE0FF",
      stroke: "#7C3AED",
      text: "#1A1D2E",
    },
    cylinder: {
      fill: "#F0F7FF",
      fillGradientEnd: "#D6E8FF",
      stroke: "#3B82F6",
      text: "#1A1D2E",
    },
    queue: {
      fill: "#FFF5F5",
      fillGradientEnd: "#FFE0E0",
      stroke: "#EF4444",
      text: "#1A1D2E",
    },
  },
  edgeColors: {
    stroke: "#94A3B8",
    label: "#64748B",
    labelBackground: "#FFFFFF",
  },
  fontFamily:
    '"Inter", "Source Sans Pro", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  fontSize: 15,
  nodeRadius: 6,
  nodePadding: { x: 28, y: 16 },
  edgeWidth: 1.8,
  shadow: true,
  handDrawn: false,
  subgraphColors: {
    fill: "rgba(67, 97, 238, 0.05)",
    stroke: "rgba(67, 97, 238, 0.25)",
    label: "#4361EE",
  },
};
