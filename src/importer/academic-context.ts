import type { AcademicContextKey, ContextSuggestion, ExtractionConfidence } from "../lib/domain";
import type { AcademicContext, ExtractionPage } from "./types";
import { confirmedField, field } from "./confidence";

export const contextLabels: Record<AcademicContextKey, string> = {
  universityName:"University name", faculty:"Faculty / school", program:"Program", level:"Academic level",
  semesterName:"Semester / term", specialization:"Specialization", start:"Semester starts", end:"Semester ends",
};
export function emptyAcademicContext(name = ""): AcademicContext {
  return {name,adapterId:"",universityName:"",faculty:"",program:"",level:"",semesterName:"",specialization:"",start:null,end:null,provenance:{}};
}
export function contextValue(context: AcademicContext, key: AcademicContextKey) { return context[key]?.trim() ?? ""; }
export function comparableContext(value: string, key: AcademicContextKey) {
  const normalized=value.normalize("NFKC").toLowerCase().trim().replace(/\s+/g," ");
  if (key==="level" || key==="semesterName") {
    const match=normalized.match(/^(?:(?:level|year|semester|sem|term)\s*)?(\d{1,2})$/);
    if (match) return String(Number(match[1]));
  }
  return normalized;
}
export function suggestionConflicts(suggestion: ContextSuggestion, context: AcademicContext) {
  const supplied=contextValue(context,suggestion.key);
  return !!supplied && comparableContext(supplied,suggestion.key)!==comparableContext(suggestion.value,suggestion.key);
}
export function confirmContext(context: AcademicContext, suggestions: ContextSuggestion[]): AcademicContext {
  for(const key of Object.keys(contextLabels)) if(new Set(suggestions.filter(s=>s.key===key).map(s=>s.value)).size>1) throw new Error("Choose one detected value for each academic field.");
  const next={...context,provenance:{...context.provenance}};
  for (const suggestion of suggestions) {
    const confidence: ExtractionConfidence={...suggestion.confidence,level:"confirmed",reason:("Confirmed by you. "+suggestion.confidence.reason).slice(0,500)};
    Object.assign(next,{[suggestion.key]:suggestion.value});next.provenance[suggestion.key]=confidence;
  }
  // An explicit confirmation of another institution removes ECU recognition.
  // A university heading never silently enables an enhanced adapter.
  if(next.adapterId==="ecu" && next.universityName?.trim() && !/^Egyptian Chinese University$/i.test(next.universityName.trim())) next.adapterId="generic";
  return next;
}
export function editContext(context: AcademicContext, key: keyof AcademicContext, value: string): AcademicContext {
  return {...context,[key]:value || (key==="start" || key==="end" ? null : ""),
    provenance:{...context.provenance,...(key in contextLabels ? {[key]:confirmedField(value).confidence} : {})}};
}

// Only explicit headings in the uploaded page count. Filenames, catalog scope,
// code digits, page position, demo records, and user filters are never evidence.
export function detectAcademicContext(page: ExtractionPage, document: ContextSuggestion["document"]): ContextSuggestion[] {
  const firstCourseY=Math.min(page.height*.35,...page.words.filter(w=>/^[A-Z]{2,6}[ -]?\d{2,6}$/i.test(w.text.trim())).map(w=>w.y));
  const headingWords=page.words.filter(w=>w.y<firstCourseY).sort((a,b)=>a.y-b.y||a.x-b.x);
  const lines: {y:number;text:string}[]=[];
  for (const word of headingWords) {
    const last=lines.at(-1);
    if (last && Math.abs(last.y-word.y)<Math.max(4,word.height*.6)) last.text+=" "+word.text;
    else lines.push({y:word.y,text:word.text});
  }
  const heading=lines.map(l=>l.text).join("\n");
  const found: ContextSuggestion[]=[];
  const add=(key:AcademicContextKey,value:string)=>{
    if (!value || value.length>200 || found.some(s=>s.key===key && s.value===value)) return;
    const evidence=field(value,page,headingWords).confidence;
    found.push({id:`${document}:${page.source}:${page.page}:${key}:${value}`,key,value,document,
      confidence:{...evidence,reason:"Detected from a visible academic heading. Confirm or change this suggestion before treating it as your context."}});
  };
  const ordinal:Record<string,string>={first:"1",second:"2",third:"3",fourth:"4",i:"1",ii:"2",iii:"3",iv:"4",الأول:"1",الثاني:"2",الثالث:"3",الرابع:"4"};
  const numeral=(value:string)=>ordinal[value.toLowerCase()]??value.replace(/[٠-٩]/g,d=>String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
  for (const m of heading.matchAll(/(?:\b(?:level|year)\s*[:#-]?\s*|المستوى\s*)(\d{1,2}|[٠-٩]{1,2}|first|second|third|fourth|iv|iii|ii|i|الأول|الثاني|الثالث|الرابع)(?!\w)/gi)) add("level",`Level ${numeral(m[1])}`);
  for (const m of heading.matchAll(/(?:\b(?:semester|sem|term)\s*[:#-]?\s*|الفصل\s+الدراسي\s*)(\d{1,2}|[٠-٩]{1,2}|first|second|third|fourth|iv|iii|ii|i|summer|autumn|fall|winter|spring|الأول|الثاني)(?!\w)/gi)) {
    const value=numeral(m[1]);add("semesterName",/^\d+$/.test(value)?`Semester ${value}`:value.charAt(0).toUpperCase()+value.slice(1).toLowerCase());
  }
  for (const line of lines) {
    const label=/\b(University|Faculty|School|Program(?:me)?|Specialization|Semester starts|Semester ends)\s*:\s*(.+?)(?=\s+(?:University|Faculty|School|Program(?:me)?|Specialization|Level|Year|Semester|Term)\s*[:\d]|$)/gi;
    for (const m of line.text.matchAll(label)) {
      const key:AcademicContextKey=/university/i.test(m[1])?"universityName":/faculty|school/i.test(m[1])?"faculty":/program/i.test(m[1])?"program":/specialization/i.test(m[1])?"specialization":/starts/i.test(m[1])?"start":"end";
      if ((key==="start" || key==="end") && !/^\d{4}-\d{2}-\d{2}$/.test(m[2].trim())) continue;
      add(key,m[2].trim());
    }
  }
  if (!found.some(s=>s.key==="universityName") && /\bEgyptian Chinese University\b/i.test(heading)) add("universityName","Egyptian Chinese University");
  for(const suggestion of found) if(found.filter(s=>s.key===suggestion.key).length>1) {
    suggestion.confidence.level="low";suggestion.confidence.reason="Multiple academic headings were found on this page. Choose the correct value or leave it unknown.";
  }
  return found.slice(0,16);
}
