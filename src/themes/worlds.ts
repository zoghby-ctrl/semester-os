import type { ThemeDefinition } from "./definitions";
import type { CustomTheme } from "./schema";

export type WorldKind = "none" | "stars" | "space" | "orbit" | "dust" | "fragments" | "orbs" | "nebula" | "aurora" | "grid" | "caustics" | "dappled" | "mist" | "cherry" | "veil" | "pearl" | "night" | "focus";

const curatedWorlds: Partial<Record<ThemeDefinition["id"], WorldKind>> = {
  "black-rose": "fragments", "rose-orbit": "orbit", "cherry-night": "cherry",
  "lavender-sky": "veil", "blush-glass": "caustics", "pastel-nebula": "nebula",
  "pearl-bloom": "pearl", midnight: "night", neon: "grid", aurora: "aurora",
  campus: "dappled", focus: "focus",
};

export function worldKind(theme: ThemeDefinition, custom?: CustomTheme): WorldKind {
  if (theme.id !== "custom") return curatedWorlds[theme.id] ?? "space";
  return custom?.environment ?? "orbit";
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
export const wrap = (value: number) => ((value % 1) + 1) % 1;
export const worldDelta = (seconds: number, limit = .05) => Number.isFinite(seconds) ? clamp(seconds, 0, limit) : 0;

// A shared, stable lattice gives a continuous field without per-frame randomness,
// expensive volumetrics, texture downloads, or short repeated gradient keyframes.
const latticeSize = 64;
const lattice = new Float32Array(latticeSize * latticeSize);
let seed = 0x14c1e57;
for (let i = 0; i < lattice.length; i++) {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  lattice[i] = seed / 4294967296;
}
const smooth = (n: number) => n * n * (3 - 2 * n);
const latticeAt = (a: number, b: number) => lattice[(a & 63) + (b & 63) * latticeSize];
export function noise2(x: number, y: number): number {
  const ix = Math.floor(x), iy = Math.floor(y), u = smooth(x - ix), v = smooth(y - iy);
  const top = latticeAt(ix, iy) * (1 - u) + latticeAt(ix + 1, iy) * u;
  const bottom = latticeAt(ix, iy + 1) * (1 - u) + latticeAt(ix + 1, iy + 1) * u;
  return top * (1 - v) + bottom * v;
}
export function cloudNoise(x: number, y: number, time: number, layer = 0): number {
  const direction = layer % 2 ? -1 : 1;
  const phase = layer * 13.73;
  return noise2(x * 2.2 + phase + time * .026 * direction, y * 2.2 + phase - time * .017) * .56
    + noise2(x * 4.5 - phase - time * .021, y * 4.5 + phase + time * .014 * direction) * .29
    + noise2(x * 9 + phase + time * .013, y * 9 - phase - time * .011) * .15;
}

export interface WorldParticle {
  x: number; y: number; depth: number; size: number; phase: number;
  spin: number; velocity: number; group: number;
}
export function createWorldParticles(count: number): WorldParticle[] {
  let particleSeed = 0xcafebeef;
  const random = () => { particleSeed = (Math.imul(particleSeed, 1664525) + 1013904223) >>> 0; return particleSeed / 4294967296; };
  return Array.from({ length: Math.max(0, Math.floor(count)) }, (_, index) => ({
    x: random(), y: random(), depth: (index % 3 + 1) / 3,
    size: .6 + random() * 1.4, phase: random() * Math.PI * 2,
    spin: (random() - .5) * .18, velocity: .7 + random() * .6, group: index % 4,
  }));
}
export function worldParticleCount(theme: ThemeDefinition, kind: WorldKind, density: number, compact: boolean, preview: boolean, scale = 1): number {
  if (kind === "none" || kind === "focus" || theme.particleProfile.style === "none") return 0;
  const cap = compact ? theme.performance.compactParticles : theme.performance.desktopParticles;
  const roleScale = kind === "fragments" ? .8 : kind === "nebula" ? 1.2 : kind === "night" ? 1.15 : 1;
  return Math.round(Math.min(cap, cap * clamp(density, 0, 100) / 100 * theme.particleProfile.density / 40 * roleScale * clamp(scale, 0, 1.2)) * (preview ? .5 : 1));
}

export function particlePosition(p: WorldParticle, kind: WorldKind, time: number, depthControl = 50, phaseOffset = 0): { x: number; y: number; angle: number } {
  const depth = .4 + p.depth * (.3 + clamp(depthControl, 0, 100) / 100 * .7);
  if (kind === "orbit") {
    const direction = p.group % 2 ? -1 : 1;
    const angle = p.phase + phaseOffset + time * .045 * p.velocity * direction * depth;
    const radiusX = .2 + p.group * .07, radiusY = .07 + p.group * .024;
    const tilt = -.32 + p.group * .19;
    const u = Math.cos(angle) * radiusX, v = Math.sin(angle) * radiusY;
    return { x: .43 + p.group * .04 + u * Math.cos(tilt) - v * Math.sin(tilt), y: .28 + p.group * .09 + u * Math.sin(tilt) + v * Math.cos(tilt), angle };
  }
  if (kind === "nebula" || kind === "space") {
    const angle = time * .008 * depth;
    const x = p.x - .5, y = p.y - .5;
    return { x: .5 + x * Math.cos(angle) - y * Math.sin(angle), y: .5 + x * Math.sin(angle) + y * Math.cos(angle), angle: p.phase };
  }
  const travel = kind === "night" ? .00032 : kind === "stars" ? .0008 : kind === "cherry" ? .003 : kind === "fragments" ? .007 : .004;
  return {
    x: wrap(p.x + time * travel * depth * p.velocity + Math.sin(time * .05 + p.phase) * .006 * depth),
    y: wrap(p.y - time * travel * .6 * depth * p.velocity),
    angle: p.phase + time * p.spin,
  };
}

// Events use long independent intervals. The satellite is a constant-speed point,
// not a meteor; reduced-motion callers explicitly suppress travel events.
export function distantEvent(kind: WorldKind, time: number, paused: boolean): { progress: number; alpha: number } | null {
  if (paused || (kind !== "night" && kind !== "fragments" && kind !== "cherry")) return null;
  const interval = kind === "night" ? 187 : kind === "fragments" ? 113 : 47;
  const duration = kind === "night" ? 38 : kind === "fragments" ? 24 : 22;
  const phase = time % interval;
  if (phase < interval - duration) return null;
  const progress = (phase - interval + duration) / duration;
  return { progress, alpha: Math.sin(progress * Math.PI) };
}

export function gridPoint(column: number, row: number, time: number): { x: number; y: number; depth: number } {
  // Inverse-depth spacing makes the network recede into a stable horizon.
  const depth = (row + wrap(time * .025)) / 12;
  const projection = depth * depth;
  return { x: .5 + (column - 6) * .14 * (.1 + projection), y: .39 + projection * .72, depth };
}

export function ribbonHeight(x: number, time: number, layer: number, aurora: boolean): number {
  const direction = layer % 2 ? -1 : 1;
  const phase = layer * 2.61;
  const speed = .034 + layer * .012;
  return .22 + layer * .095 + Math.sin(x * (aurora ? 7 : 3.2) + phase + time * speed * direction) * (aurora ? .055 : .075)
    + Math.sin(x * 13 - phase + time * speed * .71) * .018
    + (noise2(x * 4 + layer * 5, time * .019 * direction + layer * 3) - .5) * .1;
}

export function focusBreath(time: number): number {
  return .24 + Math.sin(time * Math.PI * 2 / 180) * .06;
}

// Independent phases/speeds keep the three star depths from pulsing together.
export function midnightTwinkle(p: WorldParticle, time: number, paused: boolean): number {
  if (paused) return .72;
  return .59 + Math.sin(time * (.42 + p.depth * .13) * p.velocity + p.phase) * .29
    + Math.sin(time * .19 + p.phase * 2.7) * .1;
}

export function daylightPatches(time: number) {
  return [0, 1, 2].map(i => ({
    x: .27 + i * .28 + Math.sin(time * (.018 + i * .004) + i * 1.9) * .055,
    y: .24 + i * .16 + Math.cos(time * .015 + i * 2.3) * .04,
    radius: .25 + i * .035,
  }));
}
export function daylightAt(x: number, y: number, time: number): number {
  return Math.min(1, daylightPatches(time).reduce((light, patch) => light
    + Math.exp(-(((x - patch.x) / patch.radius) ** 2 + ((y - patch.y) / (patch.radius * .65)) ** 2) * 2), 0));
}
