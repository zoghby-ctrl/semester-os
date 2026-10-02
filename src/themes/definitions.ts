import type { CSSProperties } from "react";
import type { Settings } from "../lib/schema";
import { defaultAtmosphere, type AtmosphereSettings, type CustomTheme, type ThemeId } from "./schema";

export type Primitive = "haze" | "orbs" | "ribbons" | "aurora" | "waves" | "bloom" | "grid" | "streaks";
export interface ThemeDefinition {
  id: ThemeId; name: string; description: string;
  palette: { background: string; primary: string; secondary: string; accent: string; light: boolean };
  surfaces: { lift: number; readingOpacity: number; radius: number };
  typography: { treatment: "soft" | "technical" | "quiet"; headingSpacing: string; detailFont: string };
  background: { renderer: "prism" | "ambient"; primitives: Primitive[] };
  motionProfile: { style: CustomTheme["animation"]; speed: number; parallax: boolean };
  particleProfile: { style: CustomTheme["particle"]; density: number; depth: number };
  effects: { glow: number; grain: number; blur: number };
  accessibility: { textContrast: number; accentContrast: number; staticIdentity: boolean };
  performance: { desktopParticles: number; compactParticles: number; framesPerSecond: number; previewFramesPerSecond: number };
  settings: readonly (keyof AtmosphereSettings)[];
}
function make(id: ThemeId, name: string, description: string, background: string, primary: string, secondary: string, accent: string,
  primitives: Primitive[], particle: CustomTheme["particle"], light = false, density = 32,
  treatment: ThemeDefinition["typography"]["treatment"] = "soft", radius = 12): ThemeDefinition {
  return {
    id, name, description, palette: { background, primary, secondary, accent, light },
    surfaces: { lift: light ? .76 : .045, readingOpacity: .92, radius },
    typography: { treatment, headingSpacing: treatment === "technical" ? "-.4px" : treatment === "quiet" ? "-.9px" : "-1.2px", detailFont: treatment === "technical" ? "ui-monospace, monospace" : '"Inter Variable", sans-serif' },
    background: { renderer: id === "prism" ? "prism" : "ambient", primitives },
    motionProfile: { style: id === "focus" ? "waves" : primitives.includes("waves") ? "waves" : primitives.includes("orbs") ? "orbit" : "drift", speed: id === "focus" ? .06 : id === "campus" ? .16 : id === "midnight" ? .3 : .65, parallax: id !== "focus" },
    particleProfile: { style: particle, density, depth: 3 },
    effects: { glow: id === "campus" ? .25 : .65, grain: id === "focus" ? 0 : 1, blur: 0 },
    accessibility: { textContrast: 7, accentContrast: 5.5, staticIdentity: true },
    performance: { desktopParticles: 180, compactParticles: 90, framesPerSecond: 30, previewFramesPerSecond: 20 },
    settings: ["surfaceOpacity", "particleDensity", "glow", "intensity", "speed", "depth", "blur", "dim", "parallax"],
  };
}
export const signatureThemes: ThemeDefinition[] = [
  make("prism", "Prism", "Deep space, pooled meteors, and spectral refraction.", "#080b12", "#b7adf0", "#91c9ef", "#c0b8e7", [], "stars"),
  make("black-rose", "Black Rose", "Burgundy haze, dusty rose, and distant streaks.", "#100c10", "#81354f", "#b47185", "#e4aec1", ["haze", "streaks"], "dust", false, 42),
  make("rose-orbit", "Rose Orbit", "Plum glass, floating orbits, and slow light ribbons.", "#1c1220", "#d477a4", "#9d79bb", "#efb1cf", ["orbs", "ribbons"], "orbs", false, 28, "soft", 18),
  make("cherry-night", "Cherry Night", "Cherry glow in a quiet cinematic night.", "#110b0e", "#a6324e", "#64233e", "#f1a2b3", ["haze", "streaks"], "dust", false, 36, "quiet", 10),
  make("lavender-sky", "Lavender Sky", "Violet stars under a soft blue aurora.", "#19162a", "#997ace", "#5d88be", "#cdbafb", ["aurora", "haze"], "stars", false, 55, "soft", 17),
  make("blush-glass", "Blush Glass", "Pearl surfaces, translucent waves, and rose light.", "#f3e7ed", "#d694b0", "#bca5cd", "#86516c", ["waves", "haze"], "dust", true, 28, "soft", 18),
  make("pastel-nebula", "Pastel Nebula", "Lilac, peach, and blue in a drifting light field.", "#eee8f3", "#b284bd", "#78a0c3", "#70507f", ["orbs", "haze", "waves"], "orbs", true, 25, "soft", 20),
  make("pearl-bloom", "Pearl Bloom", "Warm pearl, a luminous bloom, and floating dust.", "#f4eee7", "#dbb9ae", "#c6b7ca", "#805667", ["bloom", "orbs"], "dust", true, 22, "quiet", 14),
  make("midnight", "Midnight", "Moonlight, layered twinkling stars, and high drifting haze.", "#070809", "#455571", "#617b99", "#d5d9e1", ["haze", "streaks"], "stars", false, 32, "quiet", 9),
  make("neon", "Neon Grid", "A spatial grid, a scanning light, and pulsing nodes.", "#080f0e", "#467f69", "#39787b", "#9bdbb8", ["grid", "streaks"], "stars", false, 36, "technical", 4),
  make("aurora", "Aurora", "Flowing violet and jade bands, with atmospheric light.", "#10131b", "#7253a0", "#439585", "#a9d7ce", ["aurora", "ribbons"], "dust", false, 40, "soft", 18),
  make("campus", "Campus", "Warm window light, drifting shadows, and quiet dust motes.", "#f1f0e8", "#99ad91", "#bdc4a4", "#536a50", ["bloom"], "dust", true, 24, "quiet", 10),
  make("focus", "Focus", "A slow breathing light and room for your attention.", "#121314", "#39443c", "#252e2a", "#c4cfc5", ["haze"], "none", false, 0, "quiet", 6),
];
export const themeOptions = [...signatureThemes, make("custom", "Your palette", "Your colours, particles, and movement.", "#171019", "#d58bb5", "#9689d9", "#e3b2d0", ["orbs", "ribbons"], "dust")];
export function getThemeDefinition(id: ThemeId, custom?: CustomTheme): ThemeDefinition {
  const base = themeOptions.find(t => t.id === id) ?? signatureThemes[0];
  if (id !== "custom" || !custom) return base;
  const light = luminance(custom.background) > .45;
  return { ...base, palette: { ...base.palette, ...custom, light }, surfaces: { ...base.surfaces, lift: light ? .76 : .045 },
    background: { renderer: "ambient", primitives: custom.animation === "waves" ? ["waves", "haze"] : custom.animation === "orbit" ? ["orbs", "ribbons"] : ["haze"] },
    motionProfile: { ...base.motionProfile, style: custom.animation }, particleProfile: { ...base.particleProfile, style: custom.particle, density: custom.particle === "none" ? 0 : 32 } };
}
const channels = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
export function mix(a: string, b: string, t: number) {
  return "#" + channels(a).map((n, i) => Math.round(n + (channels(b)[i] - n) * t).toString(16).padStart(2, "0")).join("");
}
export function luminance(hex: string) {
  return channels(hex).map(n => { const v = n / 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }).reduce((sum, n, i) => sum + n * [.2126, .7152, .0722][i], 0);
}
export function contrast(a: string, b: string) {
  const x = luminance(a), y = luminance(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
}
export function readableColor(color: string, surface: string, min = 4.5) {
  if (contrast(color, surface) >= min) return color;
  const target = contrast("#101018", surface) > contrast("#ffffff", surface) ? "#101018" : "#ffffff";
  for (let i = 1; i <= 40; i++) { const next = mix(color, target, i / 40); if (contrast(next, surface) >= min) return next; }
  return target;
}
export function themeTokens(theme: ThemeDefinition, atmosphere: AtmosphereSettings, preview = false): CSSProperties {
  // Prism's production tokens and protected glass remain owned by prism.css.
  if (theme.id === "prism" && !preview) return {};
  const p = theme.palette;
  // Mid-tone custom backgrounds need a protected reading base; retain the
  // requested colour in the ambient palette rather than weakening contrast.
  const base = !p.light && luminance(p.background) > .08 ? mix(p.background, "#0b0d13", .78) : p.background;
  const surface = mix(base, "#ffffff", theme.surfaces.lift);
  const surface2 = mix(base, "#ffffff", p.light ? .93 : .075);
  const contrastSurface = p.light ? base : mix(surface2, "#ffffff", .08);
  const accent = readableColor(p.accent, contrastSurface, 6.5);
  const text = readableColor(p.light ? "#28212a" : "#f0edf3", contrastSurface, 9);
  const muted = readableColor(p.light ? "#706373" : "#aea1b5", contrastSurface, 6);
  const opacity = Math.max(theme.surfaces.readingOpacity, atmosphere.surfaceOpacity / 100);
  return { "--bg": base, "--sidebar": mix(base, "#ffffff", p.light ? .55 : .025),
    "--topbar": mix(base, "#ffffff", p.light ? .7 : .025) + "f5",
    "--surface": surface + Math.round(opacity * 255).toString(16).padStart(2, "0"), "--surface-2": surface2,
    "--input": mix(base, "#ffffff", p.light ? .9 : .025), "--border": mix(surface, p.light ? "#111111" : "#ffffff", .14),
    "--border-bright": mix(surface, p.light ? "#111111" : "#ffffff", .3), "--text": text, "--muted": muted, "--accent": accent,
    "--selected": accent + "12", "--hover": accent + "09", "--button": accent, "--button-text": readableColor(p.light ? "#ffffff" : "#16131c", accent, 7),
    "--track": mix(surface, p.light ? "#111111" : "#ffffff", .12), "--hero": "linear-gradient(115deg," + surface + "f5," + surface2 + "f0)",
    "--radius": String(theme.surfaces.radius) + "px", "--shadow": p.light ? "0 8px 35px #51304308" : "0 8px 35px #00000018",
    "--green": p.light ? "#357255" : "#90c9b4", "--orange": p.light ? "#935a24" : "#e4b181", "--red": p.light ? "#a33f53" : "#df929e", "--purple": p.light ? "#74518c" : "#b7a0df",
    "--today-column": accent + "05", "--theme-heading-spacing": theme.typography.headingSpacing, "--theme-detail-font": theme.typography.detailFont,
  } as CSSProperties;
}
export const themeTokenNames = Object.keys(themeTokens(signatureThemes[1], defaultAtmosphere));
export function themePaused(settings: Pick<Settings, "reduceMotion" | "wallpaperPaused" | "motion" | "theme" | "customTheme" | "atmosphere">, systemReduced: boolean, visible: boolean) {
  return settings.reduceMotion || systemReduced || settings.wallpaperPaused || settings.motion === 0 ||
    (settings.theme !== "prism" && (settings.atmosphere.intensity === 0 || settings.atmosphere.speed === 0)) ||
    (settings.theme === "custom" && (settings.customTheme.animation === "none" || settings.customTheme.environment === "none")) || !visible;
}
