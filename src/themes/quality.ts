import type { VisualQuality } from "./schema";

export interface VisualQualityProfile {
  particleScale: number;
  effectScale: number;
  detailScale: number;
  dprScale: number;
  distantScale: number;
  fps: number;
}

// Each Auto step reduces one cost before touching the next. No device data is
// persisted or sent anywhere; the measured stage lasts only for this app visit.
export function visualQualityProfile(level: VisualQuality, stage = 0, compact = false, preview = false): VisualQualityProfile {
  const scale = level === "low" ? .4 : level === "medium" ? .7 : level === "ultra" ? 1.2 : 1;
  const auto = level === "auto" ? Math.max(0, Math.min(5, Math.floor(stage))) : 0;
  return {
    particleScale: scale * (auto >= 1 ? .55 : 1),
    effectScale: Math.min(1.2, scale) * (auto >= 2 ? .5 : 1),
    detailScale: scale * (auto >= 3 ? .55 : 1),
    dprScale: (level === "low" ? .75 : level === "medium" ? .9 : level === "ultra" ? 1.2 : 1) * (auto >= 4 ? .7 : 1),
    distantScale: (level === "low" ? .5 : 1) * (auto >= 5 ? .4 : 1),
    fps: preview ? 20 : compact || level === "low" ? 24 : level === "ultra" ? 36 : 30,
  };
}

export class AdaptiveQuality {
  stage = 0;
  private count = 0;
  private slow = 0;
  private windows = 0;
  observe(costMs: number, intervalMs: number, targetMs: number): boolean {
    // Callers omit hidden and initial frames. Weight visible missed deadlines
    // so a few expensive atmosphere frames cannot hide behind many cheap ones.
    // A single suspension contributes at most 12 units and cannot lower quality.
    if (![costMs, intervalMs, targetMs].every(Number.isFinite) || costMs < 0 || intervalMs <= 0 || targetMs <= 0 || this.stage >= 5) return false;
    const weight = Math.min(12, Math.max(1, Math.floor(intervalMs / targetMs)));
    this.count += weight;
    if (costMs > targetMs * .38 || intervalMs > targetMs * 1.8) this.slow += weight;
    if (this.count < 90) return false;
    this.windows = this.slow / this.count > .35 ? this.windows + 1 : 0;
    this.count = this.slow = 0;
    if (this.windows < 2) return false;
    this.windows = 0;
    this.stage++;
    return true;
  }
}
