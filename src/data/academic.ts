// Shared presentation helpers; no university or student data.
export type { Session } from "../lib/domain";
export type Course = Omit<import("../lib/domain").Course, "name" | "shortName"> & { name: string; shortName: string };
export const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const category = (type: import("../lib/domain").Session["type"]) => type === "lecture" ? "Lecture" : "Labs / Tutorials";
