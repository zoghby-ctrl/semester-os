import type { UniversityAdapter } from "./types";
import { ecuCodeTokens, resolveECUCode } from "./ecu-codes";

const englishDays = [/^sun(?:day)?$/, /^mon(?:day)?$/, /^tue(?:sday)?$/, /^wed(?:nesday)?$/, /^thu(?:rsday)?$/, /^fri(?:day)?$/, /^sat(?:urday)?$/];
const arabicDays = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const shared = {
  normalizeCourseCode: (text: string) => text.replace(/\s+/g, "").toUpperCase(),
  weekday: (text: string) => {
    const normalized = text.trim().toLowerCase().replace(/[.:]/g, "");
    const english = englishDays.findIndex(d => d.test(normalized));
    if (english >= 0) return english;
    const arabic = arabicDays.findIndex(d => normalized === d);
    return arabic < 0 ? null : arabic;
  },
  sessionType: (text: string) => /\b(?:lab|laboratory|practical)\b/i.test(text) ? "lab" as const : /\b(?:tutorial|tut|section)\b/i.test(text) ? "tutorial" as const : /\b(?:lecture|lec)\b/i.test(text) ? "lecture" as const : null,
  materialPlanHeaders: { credits: /credit|cr\.?\s*hrs?/i, prerequisite: /pre[ -]?requisit/i, name: /course\s*(?:name|title)/i },
};
export const ECUAdapter: UniversityAdapter = {
  ...shared,
  id: "ecu",
  profile: { id: "ecu", name: "Egyptian Chinese University", adapterId: "ecu" },
  courseCodePattern: /\b[A-Z]{2,4}\s*\d{4}\b/gi,
  roomPattern: /\b[A-Z]\s*\d{3,4}\b/gi,
  materialPlanTable: {columnCount:12,name:1,credits:10,prerequisite:11,lecture:9,lab:7,tutorial:8},
  importHelp: "ECU is the first enhanced adapter: selected timetable layouts and one detected 12-column plan format. A limited verified Computer Science catalog can enrich exact known codes when your context is compatible. Other programs, levels, terms, and unknown codes use your documents and editable fields; enhanced curriculum coverage is not claimed.",
};
export const GenericAdapter: UniversityAdapter = {
  ...shared,
  id: "generic",
  profile: { id: "generic", name: "University not supplied", adapterId: "generic" },
  courseCodePattern: /\b[A-Z]{2,6}[ -]?\d{2,6}\b/gi,
  roomPattern: /\b(?:[A-Z]\s*\d{2,4}|(?:room|hall)\s+[A-Z0-9-]+)\b/gi,
  importHelp: "English timetable grids and rows with a day, course code, and time range are supported. Review the results against your original document.",
};
export const universityAdapters = [ECUAdapter, GenericAdapter];
export function getUniversityAdapter(id: string) {
  const adapter = universityAdapters.find(a => a.id === id);
  if (!adapter) throw new Error("Choose a supported university or the generic schedule option.");
  return adapter;
}
export const matchCourseCodes = (adapter: UniversityAdapter, text: string) => adapter.id === "ecu"
  ? ecuCodeTokens(text).flatMap(raw => {const match=resolveECUCode(raw);return match.code && match.status!=="ambiguous" ? [match.code] : [];})
  : [...text.matchAll(new RegExp(adapter.courseCodePattern.source, "gi"))].map(m => adapter.normalizeCourseCode(m[0]));
