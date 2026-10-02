import type { Settings } from "./schema";
import type { Course } from "../data/academic";
export const coursesFor = (settings: Settings): Course[] => (settings.semester?.courses ?? []).map((c) => ({
  ...c, name: c.name ?? c.code, shortName: c.shortName ?? c.name ?? c.code,
}));
export const findCourse = (settings: Settings, id: string): Course => coursesFor(settings).find((c) => c.id === id) ?? {
  id, code: id, name: "Unavailable course", shortName: "Unavailable course", credits: null,
  prerequisite: null, prerequisiteKnown: false, color: "#a7c9ec", hours: null,
};
export const academicLabel = (settings: Settings) => [settings.semester?.level?.label, settings.semester?.semester.name].filter(Boolean).join(" · ") || "Your semester";
export const creditLabel = (settings: Settings) => {
  const courses = settings.semester?.courses ?? [];
  return courses.length && courses.every((c) => c.credits !== null)
    ? String(courses.reduce((n, c) => n + (c.credits ?? 0), 0)) : "—";
};
