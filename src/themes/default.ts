import type { FloraTheme } from "../types.js";

export const defaultTheme: FloraTheme = {
  background: "#FFFFFF",
  nodeColors: {
    fill: "#EDEAE4",
    fillGradientEnd: "#E6E3DC",
    stroke: "#D5D0C6",
    text: "#37352F",
  },
  shapeColors: {
    diamond: {
      fill: "#FBE5C0",
      fillGradientEnd: "#F6DDB2",
      stroke: "#DFC08E",
      text: "#6B4D24",
    },
    stadium: {
      fill: "#CEEBDA",
      fillGradientEnd: "#C4E5D2",
      stroke: "#9ECDAF",
      text: "#2B6B4F",
    },
    rounded: {
      fill: "#E2D4EE",
      fillGradientEnd: "#DACCE8",
      stroke: "#BAA4D0",
      text: "#5A3A78",
    },
    cylinder: {
      fill: "#CEE0F0",
      fillGradientEnd: "#C4D8EA",
      stroke: "#9ABCD8",
      text: "#2B5A80",
    },
    queue: {
      fill: "#F4CCCC",
      fillGradientEnd: "#EEC4C4",
      stroke: "#DEA0A0",
      text: "#8B3838",
    },
  },
  edgeColors: {
    stroke: "#C0C6D0",
    label: "#7A8290",
    labelBackground: "#FFFFFF",
  },
  fontFamily:
    '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  fontSize: 13,
  nodeRadius: 14,
  nodePadding: { x: 34, y: 20 },
  edgeWidth: 1.2,
  nodeStrokeWidth: 1.5,
  shadow: true,
  handDrawn: false,
  subgraphColors: {
    fill: "rgba(46, 52, 64, 0.03)",
    stroke: "rgba(46, 52, 64, 0.12)",
    label: "#5E6878",
  },
};
