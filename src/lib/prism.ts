export type RandomSource = () => number;
export const starCount = (density: number, compact: boolean) =>
  Math.round(Math.max(0, Math.min(100, density)) * (compact ? 7 : 11));

// Stable stars avoid reshuffling the sky as density or viewport size changes.
export function seededRandom(seed: number): RandomSource {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createStarField(
  density: number,
  aspect: number,
  compact = false,
) {
  const count = starCount(density, compact);
  const random = seededRandom(2105);
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const phases = new Float32Array(count);
  const luminance = new Float32Array(count);
  const layers = new Float32Array(count);
  const screen = new Float32Array(count * 2);
  const spectral = [
    [0.8, 0.83, 1],
    [0.8, 0.93, 1],
    [0.83, 1, 0.96],
  ];
  for (let i = 0; i < count; i++) {
    const layer = random();
    layers[i] = layer < 0.52 ? 0 : layer < 0.85 ? 1 : 2;
    const distance =
      layer < 0.52
        ? 55 + random() * 35
        : layer < 0.85
          ? 28 + random() * 20
          : 16 + random() * 8;
    const x = (random() - 0.5) * 2.18;
    const y = (random() - 0.5) * 2.18;
    const halfHeight = Math.tan((25 * Math.PI) / 180) * distance;
    positions.set(
      [x * halfHeight * aspect, y * halfHeight, 8 - distance],
      i * 3,
    );
    screen.set([(x + 1) / 2, (y + 1) / 2], i * 2);
    const temperature = random();
    let color =
      temperature < 0.56
        ? [0.94, 0.97, 1]
        : [0.74 + temperature * 0.12, 0.86 + temperature * 0.1, 1];
    if (i % 29 === 0 && Math.abs(y - (x * 0.38 - 0.18)) < 0.55)
      color = spectral[i % spectral.length];
    colors.set(color, i * 3);
    sizes[i] = 4 + Math.pow(random(), 2) * 3.5;
    phases[i] = random() * Math.PI * 2;
    luminance[i] = (0.42 + random() * 0.45) * (distance > 50 ? 0.7 : 1);
  }
  return { count, positions, colors, sizes, phases, luminance, layers, screen };
}

// Ignore stalled/background time. Both scene motion and schedulers use this.
export const frameDelta = (delta: number) =>
  Number.isFinite(delta) ? Math.max(0, Math.min(delta, 0.075)) : 0;

export const driftIntensity = (
  drift: "off" | "subtle" | "normal",
  motion: number,
) =>
  motion <= 0 || drift === "off"
    ? 0
    : (drift === "subtle" ? 0.4 : 1) * (0.4 + (motion / 100) * 0.6);
