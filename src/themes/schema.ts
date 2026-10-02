import { z } from "zod";
export const themeIds=["prism","black-rose","rose-orbit","cherry-night","lavender-sky","blush-glass","pastel-nebula","pearl-bloom","midnight","neon","aurora","campus","focus","custom"] as const;
export const themeIdSchema=z.enum(themeIds);
export type ThemeId=z.infer<typeof themeIdSchema>;
const color=z.string().regex(/^#[\da-f]{6}$/i);
export const motionEnvironments = ["none", "stars", "space", "orbit", "dust", "fragments", "orbs", "nebula", "aurora", "grid", "caustics", "dappled", "mist"] as const;
export type MotionEnvironment = typeof motionEnvironments[number];
export const environmentLabels: Record<MotionEnvironment, string> = {
  none: "None", stars: "Stars", space: "Space", orbit: "Orbit", dust: "Dust", fragments: "Petals / fragments",
  orbs: "Light orbs", nebula: "Nebula", aurora: "Aurora", grid: "Grid", caustics: "Caustic glass", dappled: "Dappled light", mist: "Mist",
};
export const visualQualitySchema = z.enum(["auto", "low", "medium", "high", "ultra"]);
export type VisualQuality = z.infer<typeof visualQualitySchema>;
export const customThemeSchema=z.object({primary:color,secondary:color,accent:color,background:color,particle:z.enum(["dust","stars","orbs","none"]),animation:z.enum(["drift","orbit","waves","none"]),environment:z.enum(motionEnvironments).optional()}).transform(c => ({
  ...c, environment: c.environment ?? (c.animation === "none" ? "none" : c.animation === "orbit" ? "orbit" : c.animation === "waves" ? "caustics" : c.particle === "stars" ? "stars" : c.particle === "orbs" ? "orbs" : "dust"),
}));
export const defaultCustomTheme={primary:"#d58bb5",secondary:"#9689d9",accent:"#e3b2d0",background:"#171019",particle:"dust" as const,animation:"orbit" as const,environment:"orbit" as const};
export type CustomTheme=z.infer<typeof customThemeSchema>;
export const atmosphereSchema=z.object({surfaceOpacity:z.number().min(85).max(100),particleDensity:z.number().min(0).max(100),glow:z.number().min(0).max(100),intensity:z.number().min(0).max(100),blur:z.number().min(0).max(12),dim:z.number().min(0).max(90),parallax:z.number().min(0).max(50),speed:z.number().min(0).max(100).default(50),depth:z.number().min(0).max(100).default(50)});
export const defaultAtmosphere={surfaceOpacity:100,particleDensity:40,glow:50,intensity:55,blur:0,dim:12,parallax:12,speed:50,depth:50};
export type AtmosphereSettings=z.infer<typeof atmosphereSchema>;
