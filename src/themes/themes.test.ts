import { describe, expect, it } from "vitest";
import { defaultSettings, settingsSchema } from "../lib/schema";
import { defaultAtmosphere, defaultCustomTheme } from "./schema";
import { contrast, getThemeDefinition, mix, signatureThemes, themePaused, themeTokens } from "./definitions";
import { ambientDelta, createParticles, particleBudget } from "./particles";

describe("Shared themes and accessibility", () => {
  it("keeps every curated identity unique and keeps Prism on its existing renderer", () => {
    expect(signatureThemes).toHaveLength(13);
    expect(new Set(signatureThemes.map(t => t.id)).size).toBe(13);
    expect(signatureThemes.filter(t => t.background.renderer === "prism").map(t => t.id)).toEqual(["prism"]);
    expect(new Set(signatureThemes.map(t => JSON.stringify([t.palette, t.background, t.typography]))).size).toBe(13);
    expect(themeTokens(signatureThemes[0], defaultAtmosphere)).toEqual({});
  });
  it("protects text, accents, and buttons for curated and hostile custom palettes", () => {
    const custom = ["#777777", "#ffffff", "#000000", "#00ff00", "#ff0000", "#ffc0ff", "#0000ff", "#aaaaaa"].map(background => getThemeDefinition("custom", { ...defaultCustomTheme, background, accent: background }));
    for (const t of [...signatureThemes, ...custom]) {
      const tokens = themeTokens(t, { ...defaultAtmosphere, surfaceOpacity: 85 }, true) as Record<string, string>;
      for (const key of ["--surface", "--surface-2", "--input", "--sidebar", "--bg"]) {
        const surface = tokens[key].slice(0, 7);
        expect(contrast(tokens["--text"], surface), `${t.id} text on ${key}`).toBeGreaterThanOrEqual(4.5);
        expect(contrast(tokens["--muted"], surface), `${t.id} muted on ${key}`).toBeGreaterThanOrEqual(4.5);
      }
      const surface = tokens["--surface"].slice(0, 7);
      expect(contrast(tokens["--accent"], mix(surface, "#ffffff", .08))).toBeGreaterThanOrEqual(4.5);
      expect(contrast(tokens["--button-text"], tokens["--button"])).toBeGreaterThanOrEqual(4.5);
    }
  });
  it("respects system motion, manual motion, pause, zero movement, and hidden pages", () => {
    for (const t of signatureThemes) {
      const s = { ...defaultSettings, theme: t.id };
      expect(themePaused(s, true, true)).toBe(true);
      expect(themePaused({ ...s, reduceMotion: true }, false, true)).toBe(true);
      expect(themePaused({ ...s, wallpaperPaused: true }, false, true)).toBe(true);
      expect(themePaused({ ...s, motion: 0 }, false, true)).toBe(true);
      expect(themePaused(s, false, false)).toBe(true);
    }
    expect(themePaused({ ...defaultSettings, theme: "midnight" }, false, true)).toBe(false);
    expect(themePaused({ ...defaultSettings, theme: "focus" }, false, true)).toBe(false);
  });
  it("retains visual budgets on mobile, stable particle positions, and safe resume deltas", () => {
    const theme = getThemeDefinition("lavender-sky");
    expect(particleBudget(theme, 100, true, false)).toBeGreaterThan(0);
    expect(particleBudget(theme, 100, true, false)).toBeLessThanOrEqual(90);
    expect(particleBudget(theme, 100, false, false)).toBeLessThanOrEqual(180);
    expect(createParticles(10)).toEqual(createParticles(20).slice(0, 10));
    expect(ambientDelta(3600)).toBe(.05); expect(ambientDelta(NaN)).toBe(0);
  });
  it("adds appearance defaults to current saved settings without changing academic IDs", () => {
    const { customTheme: _, atmosphere: __, favoriteThemes: ___, themeFavorites: ____, ...existing } = defaultSettings;
    const migrated = settingsSchema.parse(existing);
    expect(migrated.customTheme).toEqual(defaultCustomTheme); expect(migrated.atmosphere).toEqual(defaultAtmosphere);
    expect(migrated.prism.meteorShower).toBe("shower"); expect(migrated.prism.meteorSpeed).toBe("slow");
    expect(migrated.semester).toBeNull();
  });
});
