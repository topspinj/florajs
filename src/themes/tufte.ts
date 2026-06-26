import type { FloraTheme } from "../types.js";

// Tufte: maximize data-ink ratio. Monochrome, hairline borders, no gradients,
// no shadows. Shape alone encodes semantic class — color does not double-encode.
const ink = "#3B3733";
const paper = "#FFFFF8";
const lightInk = "#9E9789";

const monoNode = {
  fill: paper,
  fillGradientEnd: paper,
  stroke: lightInk,
  text: ink,
};

export const tufteTheme: FloraTheme = {
  background: paper,
  nodeColors: { ...monoNode },
  shapeColors: {
    diamond: { ...monoNode },
    stadium: { ...monoNode },
    rounded: { ...monoNode },
    cylinder: { ...monoNode },
    queue: { ...monoNode },
  },
  edgeColors: {
    stroke: "#C4BEB4",
    label: lightInk,
    labelBackground: paper,
  },
  fontFamily:
    '"ET Book", "Palatino Linotype", "Book Antiqua", Palatino, "Times New Roman", serif',
  fontSize: 16,
  nodeRadius: 0,
  nodePadding: { x: 26, y: 15 },
  edgeWidth: 0.75,
  nodeStrokeWidth: 0.75,
  shadow: false,
  handDrawn: false,
  subgraphColors: {
    fill: "transparent",
    stroke: "rgba(59, 55, 51, 0.15)",
    label: lightInk,
  },
};
