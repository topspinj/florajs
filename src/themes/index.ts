import type { FloraTheme, ThemePreset } from "../types.js";
import { defaultTheme } from "./default.js";
import { tufteTheme } from "./tufte.js";
import { digitalTheme } from "./digital.js";

export const themes: Record<ThemePreset, FloraTheme> = {
  default: defaultTheme,
  tufte: tufteTheme,
  digital: digitalTheme,
};

export function resolveTheme(theme?: ThemePreset | Partial<FloraTheme>): FloraTheme {
  if (!theme) return defaultTheme;
  if (typeof theme === "string") return themes[theme];
  const base = defaultTheme;
  return {
    ...base,
    ...theme,
    nodeColors: { ...base.nodeColors, ...theme.nodeColors },
    shapeColors: {
      diamond: { ...base.shapeColors.diamond, ...theme.shapeColors?.diamond },
      stadium: { ...base.shapeColors.stadium, ...theme.shapeColors?.stadium },
      rounded: { ...base.shapeColors.rounded, ...theme.shapeColors?.rounded },
    },
    edgeColors: { ...base.edgeColors, ...theme.edgeColors },
    nodePadding: { ...base.nodePadding, ...theme.nodePadding },
    subgraphColors: { ...base.subgraphColors, ...theme.subgraphColors },
  };
}

export { defaultTheme } from "./default.js";
export { tufteTheme } from "./tufte.js";
export { digitalTheme } from "./digital.js";
