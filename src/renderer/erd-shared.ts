export const HEADER_HEIGHT = 36;
export const ATTR_ROW_HEIGHT = 28;
export const MARK_DIST1 = 12;
export const MARK_DIST2 = 24;
export const MARK_DIST3 = 36;
export const MARK_HALF = 10;
export const CROW_SPREAD = 10;
export const NAME_COL_X = 56;

export function normalize(dx: number, dy: number): { x: number; y: number } {
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 0.001) return { x: 1, y: 0 };
  return { x: dx / len, y: dy / len };
}
