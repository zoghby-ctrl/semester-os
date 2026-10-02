import { useEffect, useState, type CSSProperties } from "react";
import { Check, Heart, RotateCcw, Save, Trash2 } from "lucide-react";
import { useApp } from "../../lib/context";
import { useSystemReducedMotion } from "../../lib/motion";
import { getThemeDefinition, themeOptions, themePaused, themeTokens } from "../../themes/definitions";
import { appearanceOf, deleteFavorite, saveFavorite, toggleFavorite, updateAppearance, type Appearance } from "../../themes/preferences";
import { environmentLabels, motionEnvironments, type CustomTheme, type MotionEnvironment, type VisualQuality } from "../../themes/schema";
import { updateSettings } from "../../lib/db";
import { ThemeScene } from "./ThemeScene";
import { Slider } from "../Slider";
import { Modal, SectionHead } from "../ui";

export function AppearanceStudio() {
  const { settings: s, act } = useApp();
  const reduced = useSystemReducedMotion();
  const [visible, setVisible] = useState(!document.hidden), [favoritesOnly, setFavoritesOnly] = useState(false);
  const [previous, setPrevious] = useState<Appearance | null>(null), [saveOpen, setSaveOpen] = useState(false), [name, setName] = useState("");
  useEffect(() => { const change = () => setVisible(!document.hidden); document.addEventListener("visibilitychange", change); return () => document.removeEventListener("visibilitychange", change); }, []);
  const theme = getThemeDefinition(s.theme, s.customTheme);
  const apply = async (next: Partial<Appearance>) => { const before = appearanceOf(s); if (await act(updateAppearance(next))) setPrevious(before); };
  const edit = (patch: Partial<CustomTheme>) => act(updateAppearance({ theme: "custom", customTheme: patch }));
  const chooseEnvironment = (environment: MotionEnvironment) => edit({ environment,
    animation: environment === "none" ? "none" : environment === "orbit" ? "orbit" : ["aurora", "caustics", "dappled", "nebula"].includes(environment) ? "waves" : "drift",
    particle: environment === "none" ? "none" : ["stars", "space", "nebula"].includes(environment) ? "stars" : environment === "orbs" || environment === "orbit" ? "orbs" : "dust",
  });
  return <>
    <section className="panel appearance-studio">
      <SectionHead title="Choose your atmosphere" />
      <div className="studio-layout">
        <figure className="live-theme-preview" style={themeTokens(theme, s.atmosphere, true)} data-preview-theme={s.theme} data-typography={theme.typography.treatment}>
          <ThemeScene settings={s} paused={themePaused(s, reduced, visible)} visible={visible} preview />
          <div className="mini-dashboard" aria-label="Representative dashboard preview">
            <div className="mini-nav"><span>△ SEMESTER OS</span><span>Today</span><span>Schedule</span><span>Courses</span></div>
            <div className="mini-content"><span className="mini-eyebrow">YOUR SEMESTER / TODAY</span><h3>Room to think.</h3>
              <div className="mini-hero"><span>UP NEXT</span><strong>Design your day.</strong><small>Your classes, in one place.</small><i /></div>
              <div className="mini-cards"><div><span>THIS WEEK</span><strong>08:30</strong><small>Next class</small></div><div><span>YOUR PROGRESS</span><strong>Keep going.</strong><div className="mini-track"><i /></div></div></div>
            </div>
          </div>
          <figcaption>LIVE PREVIEW · SAMPLE DASHBOARD</figcaption>
        </figure>
        <div className="studio-intro"><span className="eyebrow">{s.theme === "custom" ? "YOUR OWN ATMOSPHERE" : "CURATED ATMOSPHERE"}</span><h2>{theme.name}</h2><p>{theme.description}</p>
          <p className="fine-print">The preview uses the same background renderer, surfaces, and typography as your workspace. Every choice saves on this device.</p>
          <div className="studio-actions"><button className="button secondary small" onClick={() => { setName(`${theme.name} · my look`); setSaveOpen(true); }}><Save size={15} /> Save this look</button>
            {previous && <button className="text-link" onClick={async () => { if (await act(updateAppearance(previous))) setPrevious(null); }}><RotateCcw size={14} /> Undo theme change</button>}</div>
        </div>
      </div>
      <div className="gallery-toolbar"><div className="tabs"><button aria-pressed={!favoritesOnly} className={!favoritesOnly ? "active" : ""} onClick={() => setFavoritesOnly(false)}>All themes</button><button aria-pressed={favoritesOnly} className={favoritesOnly ? "active" : ""} onClick={() => setFavoritesOnly(true)}>Favorites</button></div><small>Apply instantly · change anytime</small></div>
      <div className="theme-gallery">{themeOptions.filter(t => !favoritesOnly || s.favoriteThemes.includes(t.id)).map(t => <article key={t.id} className={`theme-choice ${s.theme === t.id ? "selected" : ""}`}>
        <button className="theme-apply" onClick={() => apply({ theme: t.id })} aria-label={`Apply ${t.name}`} aria-pressed={s.theme === t.id}>
          <div className="theme-colors" style={{ "--choice-bg": t.palette.background } as CSSProperties}>{[t.palette.primary, t.palette.secondary, t.palette.accent].map((c, i) => <i key={i} style={{ background: c }} />)}{s.theme === t.id && <Check size={15} />}</div>
          <strong>{t.name}</strong><span>{t.description}</span>
        </button>
        <button className="theme-heart icon-button" aria-label={`${s.favoriteThemes.includes(t.id) ? "Unfavorite" : "Favorite"} ${t.name}`} aria-pressed={s.favoriteThemes.includes(t.id)} onClick={() => act(toggleFavorite(t.id))}><Heart size={15} fill={s.favoriteThemes.includes(t.id) ? "currentColor" : "none"} /></button>
      </article>)}</div>
      {favoritesOnly && !s.favoriteThemes.length && <p className="subtle">Use the heart beside a theme to keep it here.</p>}
      {!!s.themeFavorites.length && <div className="saved-looks"><h3>Your saved looks</h3><p className="fine-print">Includes your palette, atmosphere, texture, and Prism settings. Included in backups.</p>{s.themeFavorites.map(f => <div className="saved-look" key={f.id}><button className="saved-look-apply" onClick={() => apply(appearanceOf(f))}><Heart size={15} /><span><strong>{f.name}</strong><small>{getThemeDefinition(f.theme, f.customTheme).name}</small></span></button><button className="icon-button" aria-label={`Delete saved look ${f.name}`} onClick={() => act(deleteFavorite(f.id))}><Trash2 size={15} /></button></div>)}</div>}
    </section>
    <section className="panel custom-palette"><details open={s.theme === "custom" || undefined}><summary><span><strong>Build your own palette</strong><small>Colour, light, and movement that feel like you.</small></span><span className="optional">CUSTOMIZE</span></summary>
      <div className="palette-controls">{(["primary", "secondary", "accent", "background"] as const).map(key => <label className="color-control" key={key}><span>{key.charAt(0).toUpperCase() + key.slice(1)}</span><input type="color" aria-label={`Custom ${key} colour`} value={s.customTheme[key]} onChange={e => edit({ [key]: e.target.value })} /><code>{s.customTheme[key].toUpperCase()}</code></label>)}</div>
      <div className="form-grid"><label>Motion environment<select aria-label="Motion environment" value={s.customTheme.environment} onChange={e => chooseEnvironment(e.target.value as MotionEnvironment)}>{motionEnvironments.map(environment => <option key={environment} value={environment}>{environmentLabels[environment]}</option>)}</select></label><label>Particle style<select aria-label="Particle style" value={s.customTheme.particle} onChange={e => edit({ particle: e.target.value as CustomTheme["particle"] })}><option value="dust">Floating dust</option><option value="stars">Distant stars</option><option value="orbs">Soft light orbs</option><option value="none">No particles</option></select></label></div>
      <label>Animation style<select aria-label="Animation style" value={s.customTheme.animation} onChange={e => { const animation = e.target.value as CustomTheme["animation"]; edit({ animation, environment: animation === "none" ? "none" : animation === "orbit" ? "orbit" : animation === "waves" ? "caustics" : "dust" }); }}><option value="drift">Cinematic drift</option><option value="orbit">Slow orbit</option><option value="waves">Luminous waves</option><option value="none">Still atmosphere</option></select></label>
      <p className="fine-print">Text and accent contrast are protected automatically. Reading surfaces keep at least 92% opacity. Your chosen colours shape the atmosphere.</p>
    </details></section>
    {s.theme !== "prism" && <section className="panel"><SectionHead title="Shape the atmosphere" /><div className="atmosphere-controls">
      {([{ key: "surfaceOpacity", label: "Card opacity", min: 92, max: 100, unit: "%" }, { key: "intensity", label: "Motion intensity", min: 0, max: 100, unit: "%" }, { key: "speed", label: "Speed", min: 0, max: 100, unit: "%" }, { key: "particleDensity", label: "Particle density", min: 0, max: 100, unit: "%" }, { key: "glow", label: "Glow", min: 0, max: 100, unit: "%" }, { key: "depth", label: "Depth", min: 0, max: 100, unit: "%" }, { key: "blur", label: "Background softness", min: 0, max: 12, unit: "px" }, { key: "dim", label: "Background dimming", min: 0, max: 90, unit: "%" }, { key: "parallax", label: "Parallax", min: 0, max: 50, unit: "%" }] as const).map(control => <Slider key={control.key} label={control.label} value={s.atmosphere[control.key]} min={control.min} max={control.max} unit={control.unit} onChange={value => act(updateAppearance({ atmosphere: { [control.key]: value } }))} />)}
    </div><p className="fine-print">Reduced Motion preserves a still version of this atmosphere. Focus keeps a nearly still breathing light; Campus keeps movement restrained.</p></section>}
    <section className="panel"><SectionHead title="Visual quality" /><label>Visual quality<select aria-label="Visual quality" value={s.visualQuality} onChange={e => act(updateSettings({ visualQuality: e.target.value as VisualQuality }))}>{(["auto", "low", "medium", "high", "ultra"] as const).map(level => <option key={level} value={level}>{level === "auto" ? "Auto · adapts to performance" : level.charAt(0).toUpperCase() + level.slice(1)}</option>)}</select></label><p className="fine-print">Auto gradually reduces visual detail to keep your workspace responsive. Your choice saves on this device.</p></section>
    <Modal open={saveOpen} onClose={() => setSaveOpen(false)} title="Keep this look"><form className="form-stack" onSubmit={async e => { e.preventDefault(); if (await act(saveFavorite(name), "Look saved on this device")) setSaveOpen(false); }}><label>Name<input autoFocus required maxLength={60} value={name} onChange={e => setName(e.target.value)} /></label><div className="dialog-actions"><button type="button" className="button secondary" onClick={() => setSaveOpen(false)}>Cancel</button><button className="button" disabled={!name.trim()}><Save size={16} /> Save look</button></div></form></Modal>
  </>;
}
