import type { Session, UniversityProfile } from "../lib/domain";

export interface UniversityAdapter {
  id: string;
  profile: UniversityProfile;
  courseCodePattern: RegExp;
  roomPattern: RegExp;
  normalizeCourseCode: (text: string) => string;
  sessionType: (text: string) => Session["type"] | null;
  weekday: (text: string) => number | null;
  materialPlanHeaders: { credits: RegExp; prerequisite: RegExp; name: RegExp };
  // A known, ruled material-plan format. Applies only when actual detected
  // table boundaries and the course-code column match this structure.
  materialPlanTable?: {columnCount:number;name:number;credits:number;prerequisite:number;lecture:number;lab:number;tutorial:number};
  importHelp: string;
}
