import type { FloraTheme } from "../types.js";

export const defaultTheme: FloraTheme = {
  background: "#ffffff",
  nodeColors: {
    fill: "#f0f4ff",
    stroke: "#4f6df5",
    text: "#1e293b",
  },
  edgeColors: {
    stroke: "#94a3b8",
    label: "#64748b",
  },
  fontFamily:
    'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  fontSize: 14,
  nodeRadius: 8,
  nodePadding: { x: 20, y: 12 },
  edgeWidth: 1.5,
  shadow: true,
};
