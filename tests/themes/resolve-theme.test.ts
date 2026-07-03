import { describe, it, expect } from "vitest";
import { resolveTheme, themes, defaultTheme } from "../../src/themes/index.js";
import type { ThemePreset } from "../../src/types.js";

describe("resolveTheme", () => {
  it("resolves known preset names", () => {
    for (const name of Object.keys(themes) as ThemePreset[]) {
      expect(resolveTheme(name)).toBe(themes[name]);
    }
  });

  it("falls back to the default theme for unknown names", () => {
    expect(resolveTheme("not-a-theme" as ThemePreset)).toBe(defaultTheme);
  });

  it("falls back to the default theme for prototype keys", () => {
    for (const name of ["constructor", "toString", "hasOwnProperty", "__proto__"]) {
      expect(resolveTheme(name as ThemePreset)).toBe(defaultTheme);
    }
  });
});
