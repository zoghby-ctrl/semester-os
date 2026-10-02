import { courseColors, normalizedSemesterSchema, timeSchema, type NormalizedSemester } from "../lib/domain";
import { getUniversityAdapter } from "../universities";
import type { AcademicContext, ImporterResult } from "./types";
import { validateImporterResult } from "./validation";
import { resolveECUCode } from "../universities/ecu-codes";
import { contextLabels, contextValue, suggestionConflicts } from "./academic-context";
import { confirmedField } from "./confidence";
import { planSelectionConflicts } from "./page-selection";

export function reviewIssues(result:ImporterResult,context?:AcademicContext) {
  const issues:string[]=[];
  if (result.planReview && !result.planReview.acknowledged && planSelectionConflicts(result.planReview).length) issues.push("Review the material-plan page conflict: keep your selected page, use the suggestion, or choose another page.");
  if (context) for(const suggestion of result.detectedContext??[]) if(suggestionConflicts(suggestion,context) && !result.contextDecisions?.includes(suggestion.id)) issues.push(`Review the detected ${contextLabels[suggestion.key].toLowerCase()} conflict with your provided context.`);
  if(!result.courses.length) issues.push("Add at least one course, or open an empty workspace from Welcome.");
  if(result.courses.length>100||result.sessions.length>500) issues.push("This semester exceeds the supported course or session limit.");
  const codes=result.courses.map(c=>c.code.value?.trim().toUpperCase());
  if(codes.some(c=>!c)) issues.push("Every course needs a code.");
  if(new Set(codes).size!==codes.length) issues.push("Course codes must be unique.");
  if (result.adapterId==="ecu") for (const c of result.courses) {
    const match=resolveECUCode(c.code.value??"");
    if (match.status==="ambiguous" || match.status==="invalid" && match.corrected) issues.push(`Course ${c.code.value}: correct the uncertain ECU code against the source before confirming.`);
  }
  for(const c of result.courses) if(!c.reviewed) issues.push(`Course ${c.code.value || "without a code"}: review and confirm its details, including fields not supplied.`);
  for(const [i,s] of result.sessions.entries()) {
    const prefix=`Session ${i+1}: `;
    if(!result.courses.some(c=>c.id===s.courseId)) issues.push(prefix+"choose a course.");
    if(s.day.value===null||s.day.value<0||s.day.value>6) issues.push(prefix+"choose a weekday.");
    if(s.type.value===null) issues.push(prefix+"choose Lecture, Lab, or Tutorial.");
    if(!timeSchema.safeParse(s.start.value).success||!timeSchema.safeParse(s.end.value).success) issues.push(prefix+"enter start and end times.");
    else if(s.end.value!<=s.start.value!) issues.push(prefix+"end time must follow start time.");
    if(!s.reviewed) issues.push(prefix+"review and confirm the session.");
  }
  return issues;
}
export function normalizeImport(result:ImporterResult,context:AcademicContext):NormalizedSemester {
  result = validateImporterResult(result);
  const issues=reviewIssues(result,context);if(issues.length) throw new Error(issues[0]);
  const adapter=getUniversityAdapter(context.adapterId);
  if(result.adapterId!==adapter.id) throw new Error("The university selection changed. Read the timetable again with the selected university.");
  const semesterId=crypto.randomUUID();
  const rooms=[...new Set(result.sessions.map(s=>s.room.value?.trim()).filter((r):r is string=>!!r))].map((label,i)=>({id:`room-${i+1}`,label,building:null}));
  return normalizedSemesterSchema.parse({schemaVersion:1,origin:result.sources.length?"import":"manual",
    student:{id:"student",displayName:context.name.trim()},university:{...adapter.profile,name:adapter.id==="generic" ? context.universityName?.trim() || adapter.profile.name : adapter.profile.name},
    program:context.program.trim()?{id:"program",name:context.program.trim(),specialization:context.specialization.trim()||null}:null,
    level:context.level.trim()?{id:"level",label:context.level.trim()}:null,
    academicContext:{faculty:context.faculty?.trim()||null,specialization:context.specialization.trim()||null,
      confirmed:Object.fromEntries((Object.keys(contextLabels) as (keyof typeof contextLabels)[]).filter(key=>contextValue(context,key)).map(key=>[key,context.provenance?.[key]??confirmedField(contextValue(context,key)).confidence])),
      detected:result.detectedContext??[]},
    semester:{id:semesterId,name:context.semesterName.trim()||"My semester",start:context.start,end:context.end},
    courses:result.courses.map((c,i)=>({id:c.id,code:c.code.value!.trim(),name:c.name.value?.trim()||null,shortName:null,credits:c.credits.value,prerequisite:c.prerequisite.value,prerequisiteKnown:c.prerequisite.confidence.level!=="unknown",hours:c.hours.value,color:courseColors[i%courseColors.length],
      metadataProvenance:{code:c.code.confidence,name:c.name.confidence,credits:c.credits.confidence,prerequisite:c.prerequisite.confidence,hours:c.hours.confidence},
    })),
    offerings:result.courses.map(c=>({id:`offering-${c.id}`,courseId:c.id,semesterId,section:null})),
    sessions:result.sessions.map(s=>({id:s.id,courseId:s.courseId,offeringId:`offering-${s.courseId}`,day:s.day.value!,type:s.type.value!,start:s.start.value!,end:s.end.value!,room:s.room.value?.trim()||"",roomId:rooms.find(r=>r.label===s.room.value?.trim())?.id??null,timeConfirmed:true})),
    rooms,confirmedAt:new Date().toISOString()});
}
