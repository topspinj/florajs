import type { FloraTheme } from "../types.js";

export const tufteTheme: FloraTheme = {
  background: "#FFFFF8",
  nodeColors: {
    fill: "#FFFFF8",
    fillGradientEnd: "#FAF8F0",
    stroke: "#5E503F",
    text: "#22211D",
  },
  shapeColors: {
    diamond: {
      fill: "#FEFCF5",
      fillGradientEnd: "#F9F3E5",
      stroke: "#9C6B30",
      text: "#22211D",
    },
    stadium: {
      fill: "#F9FBF6",
      fillGradientEnd: "#F0F4E8",
      stroke: "#5F7044",
      text: "#22211D",
    },
    rounded: {
      fill: "#FBF8FC",
      fillGradientEnd: "#F2ECF5",
      stroke: "#7A5C85",
      text: "#22211D",
    },
    cylinder: {
      fill: "#F7F9FB",
      fillGradientEnd: "#ECF1F5",
      stroke: "#4A6A82",
      text: "#22211D",
    },
    queue: {
      fill: "#FCF8F6",
      fillGradientEnd: "#F5EDE8",
      stroke: "#8E5047",
      text: "#22211D",
    },
  },
  edgeColors: {
    stroke: "#8A8070",
    label: "#6E675D",
    labelBackground: "#FFFFF8",
  },
  fontFamily:
    '"ET Book", "Palatino Linotype", "Book Antiqua", Palatino, "Times New Roman", serif',
  fontSize: 16,
  nodeRadius: 0,
  nodePadding: { x: 26, y: 15 },
  edgeWidth: 1,
  shadow: false,
  handDrawn: false,
  subgraphColors: {
    fill: "rgba(94, 80, 63, 0.04)",
    stroke: "rgba(94, 80, 63, 0.2)",
    label: "#5E503F",
  },
};
