import type { ThemeDefinition } from "./definitions";

export function particleBudget(theme: ThemeDefinition, density: number, compact: boolean, preview: boolean) {
  if (theme.particleProfile.style === "none") return 0;
  const cap = compact ? theme.performance.compactParticles : theme.performance.desktopParticles;
  return Math.round(Math.min(cap, cap * Math.max(0, Math.min(100, density)) / 100 * theme.particleProfile.density / 40) * (preview ? .65 : 1));
}
export function createParticles(count: number) {
  let seed = 0x6a09e667;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  return Array.from({ length: count }, (_, i) => ({ x: random(), y: random(), phase: random() * Math.PI * 2, depth: (i % 3 + 1) / 3, size: .6 + random() * 1.1 }));
}
export const ambientDelta = (seconds: number) => Math.max(0, Math.min(.05, Number.isFinite(seconds) ? seconds : 0));
