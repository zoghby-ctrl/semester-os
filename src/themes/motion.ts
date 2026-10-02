import type { CSSProperties } from "react";
import type { MotionEnvironment, ThemeId } from "./schema";

export type MotionIdentity = "spectral" | "rose" | "orbit" | "crimson" | "veil" | "glass" | "nebula" | "pearl" | "quiet" | "data" | "tint" | "physical" | "focus";
export interface ThemeMotion {
  identity: MotionIdentity;
  card: { enter: number; hover: number; press: number; effect: string };
  button: { press: number; duration: number };
  page: { enter: number; effect: string };
  modal: { enter: number; scale: number };
  nav: { active: number; effect: string };
  progress: { change: number };
  toast: { enter: number; travel: number };
  surfaceLight: string;
  pageLight: string;
  easing: string;
}

// The scene owns the world's movement; these short, event-driven responses own
// the information layer. Durations are seconds and hover displacement is px.
const identities: Record<ThemeId, { identity: MotionIdentity; duration: number; lift: number; press: number; light: string }> = {
  prism: { identity: "spectral", duration: .24, lift: 0, press: .985, light: "linear-gradient(110deg, transparent 25%, #f8f8ff80 43%, #d5a9dc55 47%, #93cbed55 50%, transparent 65%)" },
  "black-rose": { identity: "rose", duration: .28, lift: 0, press: .976, light: "radial-gradient(ellipse at var(--motion-origin-x, 50%) var(--motion-origin-y, 50%), #e3afc150, #81354f28 35%, transparent 70%)" },
  "rose-orbit": { identity: "orbit", duration: .28, lift: 0, press: .988, light: "conic-gradient(from 35deg, transparent 0deg 185deg, #efb1cf80 220deg, #9d79bb45 250deg, transparent 290deg)" },
  "cherry-night": { identity: "crimson", duration: .25, lift: 0, press: .982, light: "linear-gradient(100deg, transparent 25%, #a6324e20 42%, #f1a2b385 49%, #a6324e30 54%, transparent 70%)" },
  "lavender-sky": { identity: "veil", duration: .27, lift: 0, press: .99, light: "linear-gradient(120deg, transparent 20%, #cdbafb45 45%, #8daedb30 58%, transparent 80%)" },
  "blush-glass": { identity: "glass", duration: .25, lift: 0, press: .985, light: "linear-gradient(108deg, transparent 30%, #ffffffb0 46%, #d694b030 51%, transparent 61%)" },
  "pastel-nebula": { identity: "nebula", duration: .28, lift: 0, press: .99, light: "linear-gradient(115deg, #b284bd00, #b284bd55 30%, #e6bfa950 55%, #78a0c355 80%, #78a0c300)" },
  "pearl-bloom": { identity: "pearl", duration: .26, lift: 0, press: .987, light: "linear-gradient(112deg, transparent 25%, #d4ccdf60 39%, #fffff4b0 49%, #e6c8bf60 58%, transparent 75%)" },
  midnight: { identity: "quiet", duration: .16, lift: 0, press: .995, light: "linear-gradient(100deg, transparent, #617b9935, transparent)" },
  neon: { identity: "data", duration: .2, lift: 0, press: .99, light: "linear-gradient(90deg, transparent 42%, #9bdbb880 48%, #9bdbb840 51%, transparent 55%)" },
  aurora: { identity: "tint", duration: .27, lift: 0, press: .99, light: "linear-gradient(110deg, transparent 10%, #43958555 35%, #a9d7ce65 48%, #7253a055 70%, transparent 90%)" },
  campus: { identity: "physical", duration: .21, lift: -2, press: .976, light: "radial-gradient(ellipse at 20% 20%, #ead7a56b, transparent 75%)" },
  focus: { identity: "focus", duration: .1, lift: 0, press: .998, light: "linear-gradient(90deg, transparent, #c4cfc520, transparent)" },
  custom: { identity: "glass", duration: .24, lift: 0, press: .988, light: "linear-gradient(110deg, transparent 30%, color-mix(in srgb, var(--accent) 45%, transparent) 48%, transparent 65%)" },
};

const environmentIdentity: Record<MotionEnvironment, ThemeId> = {
  none: "focus", stars: "midnight", space: "prism", orbit: "rose-orbit", dust: "campus", fragments: "black-rose", orbs: "pearl-bloom", nebula: "pastel-nebula", aurora: "aurora", grid: "neon", caustics: "blush-glass", dappled: "campus", mist: "lavender-sky",
};
export function getThemeMotion(id: ThemeId, reduced = false, environment?: MotionEnvironment): ThemeMotion {
  const profile = identities[id === "custom" && environment ? environmentIdentity[environment] : id];
  const p = id === "custom" ? { ...profile, light: profile.identity === "orbit"
    ? "conic-gradient(from 35deg, transparent 0deg 185deg, color-mix(in srgb, var(--accent) 60%, transparent) 235deg, transparent 290deg)"
    : profile.identity === "rose"
      ? "radial-gradient(ellipse at var(--motion-origin-x, 50%) var(--motion-origin-y, 50%), color-mix(in srgb, var(--accent) 45%, transparent), transparent 70%)"
      : "linear-gradient(110deg, transparent 30%, color-mix(in srgb, var(--accent) 45%, transparent) 48%, transparent 65%)" } : profile;
  const duration = reduced ? 0 : p.duration;
  return {
    identity: p.identity,
    card: { enter: duration, hover: reduced ? 0 : p.lift, press: reduced ? 1 : p.press, effect: reduced ? "none" : `motion-surface-${p.identity}` },
    button: { press: reduced ? 1 : p.press, duration: reduced ? 0 : Math.min(.18, duration) },
    page: { enter: duration, effect: reduced ? "none" : `motion-page-${p.identity}` },
    modal: { enter: reduced ? 0 : Math.min(.18, duration), scale: reduced ? 1 : p.identity === "physical" ? .975 : .991 },
    nav: { active: duration, effect: reduced ? "none" : `motion-surface-${p.identity}` },
    progress: { change: reduced ? 0 : Math.min(.3, duration + .02) },
    toast: { enter: reduced ? 0 : Math.min(.2, duration), travel: reduced ? 0 : p.identity === "focus" ? 2 : 7 },
    surfaceLight: p.light,
    pageLight: p.identity === "rose" && id !== "custom" ? "radial-gradient(ellipse at 30% 40%, #57203628, transparent 75%)" : p.light,
    easing: p.identity === "physical" ? "cubic-bezier(.2, .75, .25, 1)" : "cubic-bezier(.22, .61, .36, 1)",
  };
}

export const motionTokenNames = [
  "--motion-card-enter-duration", "--motion-card-hover-y", "--motion-card-press-scale", "--motion-card-effect",
  "--motion-button-press-scale", "--motion-button-duration", "--motion-page-enter-duration", "--motion-page-effect",
  "--motion-modal-enter-duration", "--motion-modal-scale", "--motion-nav-duration", "--motion-nav-effect",
  "--motion-progress-duration", "--motion-toast-duration", "--motion-toast-travel", "--motion-surface-light", "--motion-page-light", "--motion-easing",
] as const;

export function themeMotionTokens(m: ThemeMotion): CSSProperties {
  return {
    "--motion-card-enter-duration": `${m.card.enter}s`, "--motion-card-hover-y": `${m.card.hover}px`, "--motion-card-press-scale": m.card.press, "--motion-card-effect": m.card.effect,
    "--motion-button-press-scale": m.button.press, "--motion-button-duration": `${m.button.duration}s`, "--motion-page-enter-duration": `${m.page.enter}s`, "--motion-page-effect": m.page.effect,
    "--motion-modal-enter-duration": `${m.modal.enter}s`, "--motion-modal-scale": m.modal.scale, "--motion-nav-duration": `${m.nav.active}s`, "--motion-nav-effect": m.nav.effect,
    "--motion-progress-duration": `${m.progress.change}s`, "--motion-toast-duration": `${m.toast.enter}s`, "--motion-toast-travel": `${m.toast.travel}px`, "--motion-surface-light": m.surfaceLight, "--motion-page-light": m.pageLight, "--motion-easing": m.easing,
  } as CSSProperties;
}

export function progressFraction(value: number) {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value / 100)) : 0;
}
