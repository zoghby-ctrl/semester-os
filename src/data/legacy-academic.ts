import { ecuCurriculumCourses } from "./ecu-catalog";
import { courseColors } from "../lib/domain";
export interface Course {
  id: string;
  name: string;
  shortName: string;
  credits: number;
  prerequisite: { code: string; name: string } | null;
  color: string;
  hours: { lecture: number; lab: number; tutorial: number };
}
export interface Session {
  id: string;
  courseId: string;
  day: number;
  type: "lecture" | "lab" | "tutorial";
  room: string;
  start: string;
  end: string;
  timeConfirmed: boolean;
}
export const courses: Course[] = ecuCurriculumCourses.map((c, i) => ({
  id:c.code,name:c.name,shortName:c.shortName,credits:c.credits!,
  prerequisite:c.prerequisite ? {...c.prerequisite} : null,
  hours:{...c.hours!},color:courseColors[i],
}));
const session = (
  id: string,
  courseId: string,
  day: number,
  type: Session["type"],
  room: string,
  start: string,
  end: string,
): Session => ({
  id,
  courseId,
  day,
  type,
  room,
  start,
  end,
  timeConfirmed: false,
});
export const sourceSessions: Session[] = [
  session("sun-math", "BSC1301", 0, "lecture", "A401", "08:30", "10:30"),
  session("sun-arch", "CSC2104", 0, "lecture", "A401", "10:30", "12:30"),
  session("sun-data", "CSC2100", 0, "lecture", "A401", "12:30", "14:30"),
  session("sun-data-lab", "CSC2100", 0, "lab", "A409", "14:30", "16:30"),
  session("mon-ai", "CSC2105", 1, "lecture", "A403", "08:30", "10:30"),
  session("mon-ethics", "HU2100", 1, "lecture", "A403", "10:30", "12:30"),
  session("mon-math", "BSC1301", 1, "tutorial", "B408", "12:30", "14:30"),
  session("mon-arch", "CSC2104", 1, "tutorial", "B408", "14:30", "16:30"),
  session("tue-ai", "CSC2105", 2, "lab", "A509", "08:30", "10:30"),
  session(
    "tue-system-tutorial",
    "INF2101",
    2,
    "tutorial",
    "B411",
    "10:30",
    "12:30",
  ),
  session("tue-system", "INF2101", 2, "lecture", "B303", "12:30", "14:30"),
];
export const days = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
export const courseById = (id: string) => courses.find((c) => c.id === id)!;
export const category = (type: Session["type"]) =>
  type === "lecture" ? "Lecture" : "Labs / Tutorials";
