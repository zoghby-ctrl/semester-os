import { lazy, memo, Suspense, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { Settings } from "../../lib/schema";
import { getThemeDefinition } from "../../themes/definitions";
import { useVisualQuality } from "../../themes/useVisualQuality";
import { WorldCanvas } from "./WorldCanvas";
const PrismSpace = lazy(() => import("../prism/PrismSpace"));

interface Props { settings: Settings; paused: boolean; visible: boolean; preview?: boolean }
export const ThemeScene = memo(function ThemeScene({ settings, paused, visible, preview = false }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(!preview);
  useEffect(() => {
    if (!host.current) return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { rootMargin: "40px" });
    observer.observe(host.current);
    return () => observer.disconnect();
  }, []);
  const theme = useMemo(() => getThemeDefinition(settings.theme, settings.customTheme), [settings.theme, settings.customTheme]);
  const { profile, report, stage } = useVisualQuality(settings.visualQuality, preview);
  const prism = useMemo(() => ({ ...settings.prism, density: Math.min(100, settings.prism.density * profile.particleScale) }), [settings.prism, profile.particleScale]);
  const active = visible && inView;
  const a = settings.atmosphere;
  const style = {
    "--scene-primary": theme.palette.primary, "--scene-secondary": theme.palette.secondary, "--scene-accent": theme.palette.accent,
    "--scene-glow": a.glow / 100 * theme.effects.glow * profile.effectScale,
    "--scene-blur": `${a.blur}px`, "--scene-dim": a.dim / 100, "--space-blur": `${settings.prism.blur}px`,
    "--space-dim": settings.prism.dim / 100, "--motion": settings.motion / 100,
    "--speed": `${75 - settings.motion * .5}s`, "--grain": settings.grain / 100 * theme.effects.grain,
  } as CSSProperties;
  return <div ref={host} className={`theme-scene ${paused || !active ? "paused" : ""} ${theme.palette.light ? "scene-light" : ""}`}
    style={style} data-scene-theme={theme.id} data-scene-mode={!active ? "hidden" : paused ? "static" : "animated"}
    data-visual-quality={settings.visualQuality} data-quality-stage={stage} aria-hidden="true">
    {theme.background.renderer === "prism" ? <>
      <div className="prism-space-shell"><div className="prism-space-optics"><Suspense fallback={<div className="prism-static-refraction" />}>
        <PrismSpace settings={prism} motion={settings.motion} paused={paused} visible={active} quality={profile} onFrameSample={report} />
      </Suspense></div><div className="prism-space-dim" /><div className="prism-readability" /></div>
      <div className="ambient ambient-one" /><div className="ambient ambient-two" />
    </> : <><div className="scene-atmosphere">
      <WorldCanvas theme={theme} settings={settings} paused={paused} visible={active} preview={preview} quality={profile} onFrameSample={report} />
    </div><div className="scene-dimming" /></>}
    <div className="grain" />
  </div>;
});
