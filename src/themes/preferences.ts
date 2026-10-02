import type { Settings } from "../lib/schema";
import { db, saveSettings, uid } from "../lib/db";
import type { AtmosphereSettings, CustomTheme, ThemeId } from "./schema";
export type Appearance = Pick<Settings, "theme" | "customTheme" | "atmosphere" | "motion" | "grain" | "prism">;
export function appearanceOf(settings: Appearance): Appearance {
  return structuredClone({ theme: settings.theme, customTheme: settings.customTheme, atmosphere: settings.atmosphere, motion: settings.motion, grain: settings.grain, prism: settings.prism });
}
export async function updateAppearance(patch: Omit<Partial<Appearance>, "customTheme" | "atmosphere"> & { customTheme?: Partial<CustomTheme>; atmosphere?: Partial<AtmosphereSettings> }) {
  await db.transaction("rw", db.settings, async () => {
    const current = await db.settings.get("main"); if (!current) throw new Error("Appearance is unavailable");
    await saveSettings({ ...current, ...patch, customTheme: { ...current.customTheme, ...patch.customTheme }, atmosphere: { ...current.atmosphere, ...patch.atmosphere } });
  });
}
export async function toggleFavorite(id: ThemeId) {
  await db.transaction("rw", db.settings, async () => {
    const current = await db.settings.get("main"); if (!current) return;
    await saveSettings({ ...current, favoriteThemes: current.favoriteThemes.includes(id) ? current.favoriteThemes.filter(t => t !== id) : [...current.favoriteThemes, id] });
  });
}
export async function saveFavorite(name: string) {
  await db.transaction("rw", db.settings, async () => {
    const current = await db.settings.get("main"); if (!current) return;
    if (current.themeFavorites.length >= 30) throw new Error("Remove a saved look before adding another. You can keep up to 30.");
    await saveSettings({ ...current, themeFavorites: [...current.themeFavorites, { ...appearanceOf(current), id: uid(), name: name.trim() }] });
  });
}
export async function deleteFavorite(id: string) {
  await db.transaction("rw", db.settings, async () => {
    const current = await db.settings.get("main"); if (current) await saveSettings({ ...current, themeFavorites: current.themeFavorites.filter(t => t.id !== id) });
  });
}
