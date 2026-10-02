import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { AdaptiveQuality, visualQualityProfile } from "./quality";
import type { VisualQuality } from "./schema";

const adaptive = new AdaptiveQuality();
const subscribers = new Set<() => void>();
const subscribe = (listener: () => void) => { subscribers.add(listener); return () => { subscribers.delete(listener); }; };
const snapshot = () => adaptive.stage;

export function useVisualQuality(level: VisualQuality, preview = false) {
  const stage = useSyncExternalStore(subscribe, snapshot);
  const [compact, setCompact] = useState(() => matchMedia("(max-width: 700px), (pointer: coarse)").matches);
  useEffect(() => {
    const media = matchMedia("(max-width: 700px), (pointer: coarse)");
    const update = () => setCompact(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const profile = useMemo(() => visualQualityProfile(level, stage, compact, preview), [level, stage, compact, preview]);
  const report = useCallback((costMs: number, intervalMs: number) => {
    if (level !== "auto" || preview || document.hidden) return;
    if (adaptive.observe(costMs, intervalMs, 1000 / profile.fps)) for (const listener of subscribers) listener();
  }, [level, preview, profile.fps]);
  return { profile, report, stage: level === "auto" ? stage : 0 };
}
