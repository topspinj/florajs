import type { FloraTheme } from "../types.js";

export const sketchTheme: FloraTheme = {
  background: "#FFFFFF",
  nodeColors: {
    fill: "#FFFFFF",
    fillGradientEnd: "#FFFFFF",
    stroke: "#1e1e1e",
    text: "#1e1e1e",
  },
  shapeColors: {
    diamond: {
      fill: "#fff3bf",
      fillGradientEnd: "#fff3bf",
      stroke: "#1e1e1e",
      text: "#1e1e1e",
    },
    stadium: {
      fill: "#b2f2bb",
      fillGradientEnd: "#b2f2bb",
      stroke: "#1e1e1e",
      text: "#1e1e1e",
    },
    rounded: {
      fill: "#eebefa",
      fillGradientEnd: "#eebefa",
      stroke: "#1e1e1e",
      text: "#1e1e1e",
    },
    cylinder: {
      fill: "#a5d8ff",
      fillGradientEnd: "#a5d8ff",
      stroke: "#1e1e1e",
      text: "#1e1e1e",
    },
    queue: {
      fill: "#ffc9c9",
      fillGradientEnd: "#ffc9c9",
      stroke: "#1e1e1e",
      text: "#1e1e1e",
    },
  },
  edgeColors: {
    stroke: "#1e1e1e",
    label: "#1e1e1e",
    labelBackground: "#FFFFFF",
  },
  fontFamily: '"Virgil", "Caveat", "Segoe Print", cursive',
  fontSize: 20,
  nodeRadius: 6,
  nodePadding: { x: 30, y: 18 },
  edgeWidth: 2,
  shadow: false,
  handDrawn: true,
  subgraphColors: {
    fill: "rgba(30, 30, 30, 0.03)",
    stroke: "#1e1e1e",
    label: "#1e1e1e",
  },
};
