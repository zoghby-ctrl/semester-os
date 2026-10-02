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
export const courses: Course[] = [
  {
    id: "INF2101",
    name: "System Analysis and Design",
    shortName: "System Analysis",
    credits: 3,
    prerequisite: null,
    color: "#94b5ff",
    hours: { lecture: 2, lab: 2, tutorial: 0 },
  },
  {
    id: "CSC2100",
    name: "Data Structures",
    shortName: "Data Structures",
    credits: 3,
    prerequisite: { code: "CSC1100", name: "Computer Programming I" },
    color: "#c1a2f8",
    hours: { lecture: 2, lab: 2, tutorial: 0 },
  },
  {
    id: "CSC2104",
    name: "Computer Architecture",
    shortName: "Computer Architecture",
    credits: 3,
    prerequisite: { code: "BSC1205", name: "Digital Logic Design" },
    color: "#e9b480",
    hours: { lecture: 2, lab: 1, tutorial: 1 },
  },
  {
    id: "CSC2105",
    name: "Artificial Intelligence",
    shortName: "Artificial Intelligence",
    credits: 3,
    prerequisite: { code: "BSC1103", name: "Discrete Mathematics" },
    color: "#89d7c4",
    hours: { lecture: 2, lab: 2, tutorial: 0 },
  },
  {
    id: "HU2100",
    name: "Ethical and Professional Issues in Computing",
    shortName: "Ethics & Computing",
    credits: 2,
    prerequisite: null,
    color: "#eaa4b7",
    hours: { lecture: 2, lab: 0, tutorial: 0 },
  },
  {
    id: "BSC1301",
    name: "Mathematics III",
    shortName: "Mathematics III",
    credits: 3,
    prerequisite: { code: "BSC1201", name: "Mathematics II" },
    color: "#a7c9ec",
    hours: { lecture: 2, lab: 0, tutorial: 2 },
  },
];
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
