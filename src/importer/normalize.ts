import { courseColors, normalizedSemesterSchema, timeSchema, type NormalizedSemester } from "../lib/domain";
import { getUniversityAdapter } from "../universities";
import type { AcademicContext, ImporterResult } from "./types";
import { validateImporterResult } from "./validation";

export function reviewIssues(result:ImporterResult) {
  const issues:string[]=[];
  if(!result.courses.length) issues.push("Add at least one course, or open an empty workspace from Welcome.");
  if(result.courses.length>100||result.sessions.length>500) issues.push("This semester exceeds the supported course or session limit.");
  const codes=result.courses.map(c=>c.code.value?.trim().toUpperCase());
  if(codes.some(c=>!c)) issues.push("Every course needs a code.");
  if(new Set(codes).size!==codes.length) issues.push("Course codes must be unique.");
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
  const issues=reviewIssues(result);if(issues.length) throw new Error(issues[0]);
  const adapter=getUniversityAdapter(context.adapterId);
  if(result.adapterId!==adapter.id) throw new Error("The university selection changed. Read the timetable again with the selected university.");
  const semesterId=crypto.randomUUID();
  const rooms=[...new Set(result.sessions.map(s=>s.room.value?.trim()).filter((r):r is string=>!!r))].map((label,i)=>({id:`room-${i+1}`,label,building:null}));
  return normalizedSemesterSchema.parse({schemaVersion:1,origin:result.sources.length?"import":"manual",
    student:{id:"student",displayName:context.name.trim()},university:adapter.profile,
    program:context.program.trim()?{id:"program",name:context.program.trim(),specialization:context.specialization.trim()||null}:null,
    level:context.level.trim()?{id:"level",label:context.level.trim()}:null,
    semester:{id:semesterId,name:context.semesterName.trim()||"My semester",start:context.start,end:context.end},
    courses:result.courses.map((c,i)=>({id:c.id,code:c.code.value!.trim(),name:c.name.value?.trim()||null,shortName:null,credits:c.credits.value,prerequisite:c.prerequisite.value,prerequisiteKnown:c.prerequisite.confidence.level!=="unknown",hours:c.hours.value,color:courseColors[i%courseColors.length]})),
    offerings:result.courses.map(c=>({id:`offering-${c.id}`,courseId:c.id,semesterId,section:null})),
    sessions:result.sessions.map(s=>({id:s.id,courseId:s.courseId,offeringId:`offering-${s.courseId}`,day:s.day.value!,type:s.type.value!,start:s.start.value!,end:s.end.value!,room:s.room.value?.trim()||"",roomId:rooms.find(r=>r.label===s.room.value?.trim())?.id??null,timeConfirmed:true})),
    rooms,confirmedAt:new Date().toISOString()});
}
