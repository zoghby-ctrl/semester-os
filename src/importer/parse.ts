import type { UniversityAdapter } from "../universities/types";
import { matchCourseCodes } from "../universities";
import { field, confirmedField } from "./confidence";
import type { CandidateCourse, CandidateSession, ExtractedField, ExtractionPage, ExtractionWord, ImporterResult } from "./types";
import { importerResultSchema, validateExtractionPages, validateImporterResult } from "./validation";
import { universityProfileSchema } from "../lib/domain";
import { ecuCodeTokens, resolveECUCode, type ECUAcademicContext, type ECUCodeResolution } from "../universities/ecu-codes";
import { enrichECUCourse, recordECUNameEvidence } from "./ecu-enrichment";
import { detectAcademicContext } from "./academic-context";

const centerX=(w:ExtractionWord)=>w.x+w.width/2;
const centerY=(w:ExtractionWord)=>w.y+w.height/2;
export function linesFor(page: ExtractionPage) {
  const lines:{y:number;words:ExtractionWord[];text:string}[]=[];
  for(const word of [...page.words].sort((a,b)=>centerY(a)-centerY(b)||a.x-b.x)) {
    let line:typeof lines[number]|undefined;
    const y=centerY(word),tolerance=Math.max(3,word.height*.55);
    for(let i=lines.length-1;i>=0;i--) { if(y-lines[i].y>tolerance) break; if(Math.abs(lines[i].y-y)<tolerance) line=lines[i]; }
    if(!line) {line={y:centerY(word),words:[],text:""};lines.push(line);}
    line.words.push(word);
  }
  for(const line of lines) {line.words.sort((a,b)=>a.x-b.x);line.text=line.words.map(w=>w.text).join(" ");}
  return lines.sort((a,b)=>a.y-b.y);
}
export function readTime(text: string):string|null {
  const match=text.match(/\b(\d{1,2})[:.](\d{2})\s*(AM|PM)?\b/i);
  if(!match) return null;
  let hour=Number(match[1]);const minute=Number(match[2]);
  if(minute>59 || hour>23 || (match[3] && (hour<1 || hour>12))) return null;
  if(match[3]) hour=hour%12+(/pm/i.test(match[3])?12:0);
  return `${String(hour).padStart(2,"0")}:${String(minute).padStart(2,"0")}`;
}
const rangesFor=(text:string)=>{
  const match=text.match(/(\d{1,2}[:.]\d{2}\s*(?:AM|PM)?)\s*(?:[-–—]|to)\s*(\d{1,2}[:.]\d{2}\s*(?:AM|PM)?)/i);
  return match ? [readTime(match[1]),readTime(match[2])] : [null,null];
};
function anchorsFor(page: ExtractionPage, adapter:UniversityAdapter, context:ECUAcademicContext = {}) {
  const found:{code:string;word:ExtractionWord;resolution?:ECUCodeResolution}[]=[];
  for(const line of linesFor(page))
    for(let i=0;i<line.words.length;i++) {
      const word=line.words[i],next=line.words[i+1];
      if (adapter.id==="ecu") {
        let resolution=resolveECUCode(word.text,context);
        const tokens=ecuCodeTokens(word.text);
        if (resolution.status==="invalid" && !resolution.corrected && tokens.length===1) resolution=resolveECUCode(tokens[0],context);
        if (tokens.length>1) resolution={raw:word.text,code:null,entry:null,status:"ambiguous",candidates:tokens.flatMap(t=>resolveECUCode(t,context).candidates),corrected:false};
        if (resolution.status==="invalid" && !resolution.corrected && next && next.x-word.x-word.width<word.height*3) resolution=resolveECUCode(word.text+next.text,context);
        const code=resolution.code??(resolution.status==="ambiguous" || resolution.corrected ? resolution.raw.trim().toUpperCase() : null);
        if (code && code.length<=40 && !found.some(a=>a.code===code&&Math.abs(a.word.x-word.x)<word.height&&Math.abs(a.word.y-word.y)<word.height)) found.push({code,word,resolution});
        continue;
      }
      let codes=matchCourseCodes(adapter,word.text);
      if(!codes.length && next && next.x-word.x-word.width<word.height*3) codes=matchCourseCodes(adapter,word.text+next.text);
      for(const code of codes) if(!found.some(a=>a.code===code&&Math.abs(a.word.x-word.x)<word.height&&Math.abs(a.word.y-word.y)<word.height)) found.push({code,word});
    }
  return found;
}
function emptyCourse(code:string,page?:ExtractionPage,word?:ExtractionWord):CandidateCourse {
  return {id:code.replace(/[^a-zA-Z0-9._:-]/g,"-") || crypto.randomUUID(),code:field(code,page,word?[word]:[]),name:field<string>(null,page),credits:field<number>(null,page),prerequisite:field<{code:string;name:string}|null>(null,page),hours:field<{lecture:number;lab:number;tutorial:number}>(null,page),reviewed:false};
}
export function emptyImport(adapterId:string):ImporterResult {return {schemaVersion:1,adapterId,courses:[],sessions:[],warnings:[],sources:[]};}
export function parseTimetable(pages:ExtractionPage[],adapter:UniversityAdapter,context:ECUAcademicContext = {}):ImporterResult {
  pages = validateExtractionPages(pages);
  universityProfileSchema.parse(adapter.profile);
  const result=emptyImport(adapter.id);
  for(const page of pages) {
    const lines=linesFor(page),anchors=anchorsFor(page,adapter,context);
    const headers=page.words.map(w=>({day:adapter.weekday(w.text),word:w})).filter((h):h is {day:number;word:ExtractionWord}=>h.day!==null && h.word.y<page.height*.35);
    const grid=headers.length>=2 && new Set(headers.map(h=>h.day)).size>=2
      && Math.max(...headers.map(h=>centerX(h.word)))-Math.min(...headers.map(h=>centerX(h.word)))>page.width*.15
      && Math.max(...headers.map(h=>h.word.y))-Math.min(...headers.map(h=>h.word.y))<Math.max(...headers.map(h=>h.word.height))*2;
    let previousDay:number|null=null;
    const ticks=lines.map(l=>{
      const left=l.words.filter(w=>centerX(w)<Math.min(...headers.map(h=>h.word.x)));
      const time=readTime(left.map(w=>w.text).join(" "));
      return time?{y:l.y,minute:Number(time.slice(0,2))*60+Number(time.slice(3))}:null;
    }).filter((t):t is {y:number;minute:number}=>t!==null);
    const estimate=(y:number):string|null=>{
      if(ticks.length<3) return null;
      const sorted=[...ticks].sort((a,b)=>a.y-b.y);
      if(sorted.some((t,i)=>i>0&&t.minute<=sorted[i-1].minute)) return null;
      let lower=sorted.filter(t=>t.y<=y).at(-1)??sorted[0];
      if(lower===sorted.at(-1)) lower=sorted.at(-2)!;
      const upper=sorted.find(t=>t.y>lower.y)??sorted.at(-1)!;
      if(upper.y===lower.y) return null;
      const minute=Math.round((lower.minute+(y-lower.y)*(upper.minute-lower.minute)/(upper.y-lower.y))/30)*30;
      return minute>=0&&minute<1440?`${String(Math.floor(minute/60)).padStart(2,"0")}:${String(minute%60).padStart(2,"0")}`:null;
    };
    for(const {code,word,resolution} of anchors) {
      if(!result.courses.some(c=>c.code.value===code)) {
        const course=emptyCourse(code,page,word);
        if (resolution?.corrected || resolution?.status==="ambiguous") {
          course.code.confidence.level="low";
          course.code.confidence.reason=`ECU code evidence “${resolution.raw.slice(0,40)}”${resolution.code?" normalized to "+resolution.code:" is uncertain"}. ${resolution.candidates.length?"Catalog candidates: "+resolution.candidates.join(", ")+". ":""}Verify the source code before confirming.`.slice(0,500);
          result.warnings.push(course.code.confidence.reason);
        }
        result.courses.push(course);
      }
      let local:ExtractionWord[],day:number|null,start:string|null,end:string|null,layoutTimes=false;
      if(grid) {
        const header=[...headers].sort((a,b)=>Math.abs(centerX(a.word)-centerX(word))-Math.abs(centerX(b.word)-centerX(word)))[0];
        day=header.day;
        const block=page.blocks.find(b=>centerX(word)>=b.x&&centerX(word)<=b.x+b.width&&centerY(word)>=b.y&&centerY(word)<=b.y+b.height);
        let bounds=block;
        if(block) {
          const inside=anchors.filter(a=>centerX(a.word)>=block.x&&centerX(a.word)<=block.x+block.width&&centerY(a.word)>=block.y&&centerY(a.word)<=block.y+block.height).sort((a,b)=>a.word.y-b.word.y);
          const padding=inside[0].word.y-block.y;
          const next=inside.find(a=>a.word.y>word.y+word.height);
          const top=Math.max(block.y,word.y-padding);
          bounds={...block,y:top,height:(next?next.word.y-padding:block.y+block.height)-top};
          local=page.words.filter(w=>centerX(w)>=bounds!.x&&centerX(w)<=bounds!.x+bounds!.width&&centerY(w)>=bounds!.y&&centerY(w)<=bounds!.y+bounds!.height);
        }
        else {
          const centers=[...headers].sort((a,b)=>centerX(a.word)-centerX(b.word));const idx=centers.indexOf(header);
          const left=idx>0?(centerX(centers[idx-1].word)+centerX(header.word))/2:0;
          const right=idx<centers.length-1?(centerX(centers[idx+1].word)+centerX(header.word))/2:page.width;
          const below=anchors.filter(a=>a.word.y>word.y+word.height&&centerX(a.word)>left&&centerX(a.word)<right).sort((a,b)=>a.word.y-b.word.y)[0];
          local=page.words.filter(w=>centerX(w)>left&&centerX(w)<right&&w.y>=word.y-word.height*.5&&w.y<(below?.word.y??word.y+word.height*6));
        }
        [start,end]=rangesFor(local.map(w=>w.text).join(" "));
        if(!start&&!end&&bounds) {start=estimate(bounds.y);end=estimate(bounds.y+bounds.height);layoutTimes=true;}
      } else {
        const line=lines.find(l=>l.words.includes(word))!;
        const preceding=lines.filter(l=>l.y<=line.y);
        for(const row of preceding) {
          const textDays=[...row.text.matchAll(/\b(?:Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sun|Mon|Tue|Wed|Thu|Fri|Sat)\b/gi)].map(m=>adapter.weekday(m[0]));
          const detected=row.words.map(w=>adapter.weekday(w.text)).find(d=>d!==null) ?? (new Set(textDays).size===1?textDays[0]:undefined);
          if(detected!==undefined) previousDay=detected;
        }
        day=previousDay;local=line.words;
        [start,end]=rangesFor(line.text);
      }
      if(start&&end&&end<=start) {start=null;end=null;}
      const text=local.map(w=>w.text).join(" ");
      if (adapter.id==="generic") {
        const codeMatch=[...text.matchAll(new RegExp(adapter.courseCodePattern.source,"gi"))].find(m=>adapter.normalizeCourseCode(m[0])===code);
        if (codeMatch) {
          const after=text.slice(codeMatch.index!+codeMatch[0].length);
          const name=after.split(/\b(?:lecture|lec|lab|laboratory|practical|tutorial|tut|section|room|hall)\b|\d{1,2}[:.]\d{2}/i)[0].replace(/^[\s|:–—-]+|[\s|:–—-]+$/g,"").trim();
          const course=result.courses.find(c=>c.code.value===code)!;
          if (name && name.length<=200 && !course.name.value) course.name=field(name,page,local);
        }
      }
      const type=adapter.sessionType(text);
      const rooms=[...new Set([...text.matchAll(new RegExp(adapter.roomPattern.source,"gi"))].map(m=>m[0].replace(/\s+/g,"")))];
      const room=rooms.length?rooms.join(" / "):null;
      const roomField=field(room,page,local);if(rooms.length>1) {roomField.confidence.level="low";roomField.confidence.reason="More than one room was detected in this session. Choose the correct room.";}
      const session:CandidateSession={id:`session-${result.sessions.length+1}`,courseId:result.courses.find(c=>c.code.value===code)!.id,day:field(day,page,local,grid),type:field(type,page,local),start:field(start,page,local,layoutTimes),end:field(end,page,local,layoutTimes),room:roomField,reviewed:false};
      // Duplicated PDF layers should not create duplicate sessions.
      if(!result.sessions.some(s=>s.courseId===session.courseId&&s.day.value===day&&s.start.value!==null&&s.start.value===start&&s.end.value===end&&s.type.value===type)) result.sessions.push(session);
    }
    result.sources.push({name:page.source,pages:page.page,method:page.method});
    result.detectedContext=[...(result.detectedContext??[]),...detectAcademicContext(page,"timetable")];
  }
  if(!result.sessions.length) result.warnings.push("We couldn't confidently find sessions. Try a clearer image or the PDF, or add the missing sessions below.");
  if(result.courses.some(c=>c.name.value===null)) result.warnings.push("Course names were not supplied in the timetable. Add them yourself or upload the material plan; course codes remain usable.");
  return result;
}

// Enrich only rows whose actual code matches a detected timetable course.
// Column geometry prevents prerequisites from becoming extra enrolled courses.
export function enrichMaterialPlan(result:ImporterResult,pages:ExtractionPage[],adapter:UniversityAdapter,context:ECUAcademicContext = {}):ImporterResult {
  pages = validateExtractionPages(pages);
  result = validateImporterResult(result);
  if (result.adapterId!==adapter.id) throw new Error("The import adapter changed. Review the university choice before enriching courses.");
  const out=structuredClone(result);
  if (adapter.id==="ecu") out.courses=out.courses.map(c=>enrichECUCourse(c,context));
  let matchedRows = 0;
  for(const page of pages) {
    const lines=linesFor(page),anchors=anchorsFor(page,adapter,context);
    out.detectedContext=[...new Map([...(out.detectedContext??[]),...detectAcademicContext(page,"material-plan")].map(s=>[s.id,s])).values()];
    const creditsHeader=page.words.find(w=>adapter.materialPlanHeaders.credits.test(w.text));
    const prerequisiteHeader=page.words.find(w=>adapter.materialPlanHeaders.prerequisite.test(w.text));
    const lectureHeader=page.words.find(w=>/^lectures?$/i.test(w.text));
    const labHeader=page.words.find(w=>/^labs?$/i.test(w.text));
    const tutorialHeader=page.words.find(w=>/^tutorials?$/i.test(w.text));
    const firstCodeX=anchors.length?Math.min(...anchors.map(a=>a.word.x)):0;
    const courseAnchors=anchors.filter(a=>Math.abs(a.word.x-firstCodeX)<page.width*.08);
    for(const {code,word,resolution} of courseAnchors) {
      if (resolution?.status==="ambiguous" || resolution?.status==="invalid") {
        out.warnings.push(`Uncertain ECU material-plan code “${resolution.raw.slice(0,40)}” on page ${page.page}. ${resolution.candidates.length?"Possible catalog codes: "+resolution.candidates.join(", ")+". ":""}This row did not supply course metadata; check its code.`);
        continue;
      }
      const course=out.courses.find(c=>c.code.value===code);if(!course) continue;
      matchedRows++;
      const setName = (name: string, words: ExtractionWord[]) => {
        if (!name || name.length > 200) return;
        if (adapter.id==="ecu" && course.name.confidence.method==="catalog") {
          const anomaly=recordECUNameEvidence(course,name,page,words);
          if (anomaly && !out.warnings.includes(anomaly)) out.warnings.push(anomaly);
          return;
        }
        const candidate = field(name, page, words);
        // A later scan must not replace exact selectable text or a correction.
        if (course.name.value && (course.name.confidence.method === "manual" || course.name.confidence.method === "pdf-text" && page.method === "ocr")) return;
        course.name = candidate;
      };
      const protectedField=(f:ExtractedField<unknown>)=>f.confidence.method==="manual" && f.confidence.level==="confirmed" || adapter.id==="ecu" && f.confidence.method==="catalog";
      const layout=adapter.materialPlanTable,table=page.table;
      if(layout && table?.columns.length===layout.columnCount+1 && centerX(word)>table.columns[0] && centerX(word)<table.columns[1]) {
        const row=table.rows.findIndex((y,i)=>i<table.rows.length-1&&centerY(word)>y&&centerY(word)<table.rows[i+1]);
        if(row>=0) {
          const cell=(column:number)=>page.words.filter(w=>centerX(w)>table.columns[column]&&centerX(w)<table.columns[column+1]&&centerY(w)>table.rows[row]&&centerY(w)<table.rows[row+1]).sort((a,b)=>a.y-b.y||a.x-b.x);
          const text=(column:number)=>linesFor({...page,words:cell(column)}).map(l=>l.text).join(" ").trim();
          const name=text(layout.name);setName(name,cell(layout.name));
          const numeric=(column:number)=>{const value=text(column);return /^(?:\d{1,2}(?:\.\d+)?)$/.test(value)?Number(value):null;};
          const credit=numeric(layout.credits);if(credit!==null && credit<=30 && !protectedField(course.credits)) course.credits=field(credit,page,cell(layout.credits),true);
          const prerequisite=text(layout.prerequisite),codes=matchCourseCodes(adapter,prerequisite);
          if(!protectedField(course.prerequisite)) {
            if(codes.length===1) course.prerequisite=field({code:codes[0],name:prerequisite.replace(new RegExp(codes[0],"i"),"").trim()},page,cell(layout.prerequisite),true);
            else if(/^(?:N\/?A|none|[-–—])$/i.test(prerequisite)) course.prerequisite={value:null,confidence:field("None",page,cell(layout.prerequisite),true).confidence};
          }
          const hour=(column:number)=>/^[-–—]$/.test(text(column))?0:numeric(column);
          const lecture=hour(layout.lecture),lab=hour(layout.lab),tutorial=hour(layout.tutorial);
          if(lecture!==null&&lab!==null&&tutorial!==null && !protectedField(course.hours)) course.hours=field({lecture,lab,tutorial},page,[...cell(layout.lecture),...cell(layout.lab),...cell(layout.tutorial)],true);
          continue;
        }
      }
      const next=courseAnchors.filter(a=>a.word.y>word.y+word.height*.6).sort((a,b)=>a.word.y-b.word.y)[0];
      const local=page.words.filter(w=>w.y>=word.y-word.height*.5&&w.y<(next?.word.y??word.y+word.height*3));
      // Footer prose ("Lab", "Lecture", etc.) below this course is not a
      // column header and must not truncate its name or supply numeric fields.
      const numericHeaders=[lectureHeader,labHeader,tutorialHeader,creditsHeader,prerequisiteHeader].filter((w):w is ExtractionWord=>!!w && w.y<word.y && w.x>word.x+word.width).map(w=>w.x);
      const endName=numericHeaders.length?Math.min(...numericHeaders):page.width*.65;
      const nameWords=local.filter(w=>w.x>word.x+word.width*.8&&w.x<endName-2&&!matchCourseCodes(adapter,w.text).length&&!/^\d+$/.test(w.text));
      const name=linesFor({...page,words:nameWords}).map(l=>l.text).join(" ").trim();
      setName(name,nameWords);
      const numeric=(header:ExtractionWord|undefined):ExtractedField<number>=>{
        if(!header || header.y>=word.y) return field<number>(null,page);
        const matches=local.filter(w=>/^\d+(?:\.\d+)?$/.test(w.text)&&Math.abs(centerX(w)-centerX(header))<page.width*.035);
        return matches.length===1?field(Number(matches[0].text),page,matches):field<number>(null,page);
      };
      const credit=numeric(creditsHeader);if(credit.value!==null&&credit.value<=30 && !protectedField(course.credits)) course.credits=credit;
      const lecture=numeric(lectureHeader),lab=numeric(labHeader),tutorial=numeric(tutorialHeader);
      if(lecture.value!==null&&lab.value!==null&&tutorial.value!==null && !protectedField(course.hours)) course.hours=field({lecture:lecture.value,lab:lab.value,tutorial:tutorial.value},page,local);
      if(prerequisiteHeader && prerequisiteHeader.y<word.y && !protectedField(course.prerequisite)) {
        const entries=local.filter(w=>w.x>=prerequisiteHeader.x-page.width*.025);
        const text=entries.map(w=>w.text).join(" ");
        const codes=matchCourseCodes(adapter,text);
        if(codes.length===1) course.prerequisite=field({code:codes[0],name:text.replace(new RegExp(codes[0],"i"),"").trim()},page,entries);
        else if(/^(?:N\/?A|none|[-–—])$/i.test(text.trim())) course.prerequisite={value:null,confidence:field("None",page,entries).confidence};
        else if(text.trim() && text.trim().length<=200) course.prerequisite=field({code:"",name:text.trim()},page,entries);
      }
    }
    // Keep line building tested even for unrecognized tables; no positional
    // fallback assigns arbitrary trailing numbers as credits.
    if(!lines.length) out.warnings.push(`No text found on material-plan page ${page.page}.`);
    out.sources.push({name:page.source,pages:page.page,method:page.method});
  }
  if (pages.length && !matchedRows) out.warnings.push("No material-plan rows matched your timetable course codes. Choose the pages for your level and semester, check the codes against the source, or enter course names manually.");
  if (out.courses.every(c=>c.name.value)) out.warnings=out.warnings.filter(w=>!w.startsWith("Course names were not supplied in the timetable."));
  return out;
}
export function manualCourse(code:string):CandidateCourse {return emptyCourse(code.trim().toUpperCase());}
export function recontextualizeImport(result:ImporterResult,adapter:UniversityAdapter,context:ECUAcademicContext,planPages:ExtractionPage[]=[]):ImporterResult {
  const next=structuredClone(result);next.adapterId=adapter.id;
  next.contextDecisions=[];
  next.courses=next.courses.map(c=>{
    const out=structuredClone(c);
    for(const key of ["name","credits","prerequisite","hours"] as const) if(out[key].confidence.method==="catalog") {out[key].value=null;out[key].confidence=field(null).confidence;out.reviewed=false;}
    return out;
  });
  next.warnings=next.warnings.filter(w=>!w.includes("Catalog defaults retained") && !w.startsWith("Uncertain ECU"));
  // Context can be edited while a newly added course is still blank. Validate
  // strictly at activation; do not crash a partially completed review form.
  if(!importerResultSchema.safeParse(next).success) {
    if(adapter.id==="ecu") next.courses=next.courses.map(c=>enrichECUCourse(c,context));
    return next;
  }
  const enriched=enrichMaterialPlan(next,planPages,adapter,context);
  enriched.sources=next.sources; // Context edits do not create another document.
  return enriched;
}
export function manualSession(courseId:string):CandidateSession {return {id:crypto.randomUUID(),courseId,day:field<number>(null),type:field<"lecture"|"lab"|"tutorial">(null),start:field<string>(null),end:field<string>(null),room:confirmedField(""),reviewed:false};}
