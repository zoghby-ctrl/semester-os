import type { UniversityAdapter } from "../universities/types";
import { matchCourseCodes } from "../universities";
import { field, confirmedField } from "./confidence";
import type { CandidateCourse, CandidateSession, ExtractedField, ExtractionPage, ExtractionWord, ImporterResult } from "./types";
import { validateExtractionPages, validateImporterResult } from "./validation";
import { universityProfileSchema } from "../lib/domain";

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
function anchorsFor(page: ExtractionPage, adapter:UniversityAdapter) {
  const found:{code:string;word:ExtractionWord}[]=[];
  for(const line of linesFor(page))
    for(let i=0;i<line.words.length;i++) {
      const word=line.words[i],next=line.words[i+1];
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
export function parseTimetable(pages:ExtractionPage[],adapter:UniversityAdapter):ImporterResult {
  pages = validateExtractionPages(pages);
  universityProfileSchema.parse(adapter.profile);
  const result=emptyImport(adapter.id);
  for(const page of pages) {
    const lines=linesFor(page),anchors=anchorsFor(page,adapter);
    const headers=page.words.map(w=>({day:adapter.weekday(w.text),word:w})).filter((h):h is {day:number;word:ExtractionWord}=>h.day!==null && h.word.y<page.height*.35);
    const grid=headers.length>=2 && new Set(headers.map(h=>h.day)).size>=2;
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
    for(const {code,word} of anchors) {
      if(!result.courses.some(c=>c.code.value===code)) result.courses.push(emptyCourse(code,page,word));
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
          const detected=row.words.map(w=>adapter.weekday(w.text)).find(d=>d!==null);
          if(detected!==undefined) previousDay=detected;
        }
        day=previousDay;local=line.words;
        [start,end]=rangesFor(line.text);
      }
      if(start&&end&&end<=start) {start=null;end=null;}
      const text=local.map(w=>w.text).join(" ");
      const type=adapter.sessionType(text);
      const rooms=[...new Set([...text.matchAll(new RegExp(adapter.roomPattern.source,"gi"))].map(m=>m[0].replace(/\s+/g,"")))];
      const room=rooms.length?rooms.join(" / "):null;
      const roomField=field(room,page,local);if(rooms.length>1) {roomField.confidence.level="low";roomField.confidence.reason="More than one room was detected in this session. Choose the correct room.";}
      const session:CandidateSession={id:`session-${result.sessions.length+1}`,courseId:result.courses.find(c=>c.code.value===code)!.id,day:field(day,page,local,grid),type:field(type,page,local),start:field(start,page,local,layoutTimes),end:field(end,page,local,layoutTimes),room:roomField,reviewed:false};
      // Duplicated PDF layers should not create duplicate sessions.
      if(!result.sessions.some(s=>s.courseId===session.courseId&&s.day.value===day&&s.start.value!==null&&s.start.value===start&&s.end.value===end&&s.type.value===type)) result.sessions.push(session);
    }
    result.sources.push({name:page.source,pages:page.page,method:page.method});
  }
  if(!result.sessions.length) result.warnings.push("We couldn't confidently find sessions. Try a clearer image or the PDF, or add the missing sessions below.");
  if(result.courses.some(c=>c.name.value===null)) result.warnings.push("Course names were not supplied in the timetable. Add them yourself or upload the material plan; course codes remain usable.");
  return result;
}

// Enrich only rows whose actual code matches a detected timetable course.
// Column geometry prevents prerequisites from becoming extra enrolled courses.
export function enrichMaterialPlan(result:ImporterResult,pages:ExtractionPage[],adapter:UniversityAdapter):ImporterResult {
  pages = validateExtractionPages(pages);
  result = validateImporterResult(result);
  const out=structuredClone(result);
  for(const page of pages) {
    const lines=linesFor(page),anchors=anchorsFor(page,adapter);
    const creditsHeader=page.words.find(w=>adapter.materialPlanHeaders.credits.test(w.text));
    const prerequisiteHeader=page.words.find(w=>adapter.materialPlanHeaders.prerequisite.test(w.text));
    const lectureHeader=page.words.find(w=>/^lectures?$/i.test(w.text));
    const labHeader=page.words.find(w=>/^labs?$/i.test(w.text));
    const tutorialHeader=page.words.find(w=>/^tutorials?$/i.test(w.text));
    const firstCodeX=anchors.length?Math.min(...anchors.map(a=>a.word.x)):0;
    const courseAnchors=anchors.filter(a=>Math.abs(a.word.x-firstCodeX)<page.width*.08);
    for(const {code,word} of courseAnchors) {
      const course=out.courses.find(c=>c.code.value===code);if(!course) continue;
      const layout=adapter.materialPlanTable,table=page.table;
      if(layout && table?.columns.length===layout.columnCount+1 && centerX(word)>table.columns[0] && centerX(word)<table.columns[1]) {
        const row=table.rows.findIndex((y,i)=>i<table.rows.length-1&&centerY(word)>y&&centerY(word)<table.rows[i+1]);
        if(row>=0) {
          const cell=(column:number)=>page.words.filter(w=>centerX(w)>table.columns[column]&&centerX(w)<table.columns[column+1]&&centerY(w)>table.rows[row]&&centerY(w)<table.rows[row+1]).sort((a,b)=>a.y-b.y||a.x-b.x);
          const text=(column:number)=>linesFor({...page,words:cell(column)}).map(l=>l.text).join(" ").trim();
          const name=text(layout.name);if(name) course.name=field(name,page,cell(layout.name));
          const numeric=(column:number)=>{const value=text(column);return /^(?:\d{1,2}(?:\.\d+)?)$/.test(value)?Number(value):null;};
          const credit=numeric(layout.credits);if(credit!==null && credit<=30) course.credits=field(credit,page,cell(layout.credits),true);
          const prerequisite=text(layout.prerequisite),codes=matchCourseCodes(adapter,prerequisite);
          if(codes.length===1) course.prerequisite=field({code:codes[0],name:prerequisite.replace(new RegExp(codes[0],"i"),"").trim()},page,cell(layout.prerequisite),true);
          else if(/^(?:N\/?A|none|[-–—])$/i.test(prerequisite)) course.prerequisite={value:null,confidence:field("None",page,cell(layout.prerequisite),true).confidence};
          const hour=(column:number)=>/^[-–—]$/.test(text(column))?0:numeric(column);
          const lecture=hour(layout.lecture),lab=hour(layout.lab),tutorial=hour(layout.tutorial);
          if(lecture!==null&&lab!==null&&tutorial!==null) course.hours=field({lecture,lab,tutorial},page,[...cell(layout.lecture),...cell(layout.lab),...cell(layout.tutorial)],true);
          continue;
        }
      }
      const next=courseAnchors.filter(a=>a.word.y>word.y+word.height*.6).sort((a,b)=>a.word.y-b.word.y)[0];
      const local=page.words.filter(w=>w.y>=word.y-word.height*.5&&w.y<(next?.word.y??word.y+word.height*3));
      const numericHeaders=[lectureHeader,labHeader,tutorialHeader,creditsHeader,prerequisiteHeader].filter((w):w is ExtractionWord=>!!w).map(w=>w.x);
      const endName=numericHeaders.length?Math.min(...numericHeaders.filter(x=>x>word.x+word.width)):page.width*.65;
      const nameWords=local.filter(w=>w.x>word.x+word.width*.8&&w.x<endName-2&&!matchCourseCodes(adapter,w.text).length&&!/^\d+$/.test(w.text));
      const name=nameWords.sort((a,b)=>a.y-b.y||a.x-b.x).map(w=>w.text).join(" ").replace(/\s+/g," ").trim();
      if(name) course.name=field(name,page,nameWords);
      const numeric=(header:ExtractionWord|undefined):ExtractedField<number>=>{
        if(!header) return field<number>(null,page);
        const matches=local.filter(w=>/^\d+(?:\.\d+)?$/.test(w.text)&&Math.abs(centerX(w)-centerX(header))<page.width*.035);
        return matches.length===1?field(Number(matches[0].text),page,matches):field<number>(null,page);
      };
      const credit=numeric(creditsHeader);if(credit.value!==null&&credit.value<=30) course.credits=credit;
      const lecture=numeric(lectureHeader),lab=numeric(labHeader),tutorial=numeric(tutorialHeader);
      if(lecture.value!==null&&lab.value!==null&&tutorial.value!==null) course.hours=field({lecture:lecture.value,lab:lab.value,tutorial:tutorial.value},page,local);
      if(prerequisiteHeader) {
        const entries=local.filter(w=>w.x>=prerequisiteHeader.x-page.width*.025);
        const text=entries.map(w=>w.text).join(" ");
        const codes=matchCourseCodes(adapter,text);
        if(codes.length===1) course.prerequisite=field({code:codes[0],name:text.replace(new RegExp(codes[0],"i"),"").trim()},page,entries);
        else if(/^(?:N\/?A|none|[-–—])$/i.test(text.trim())) course.prerequisite={value:null,confidence:field("None",page,entries).confidence};
      }
    }
    // Keep line building tested even for unrecognized tables; no positional
    // fallback assigns arbitrary trailing numbers as credits.
    if(!lines.length) out.warnings.push(`No text found on material-plan page ${page.page}.`);
    out.sources.push({name:page.source,pages:page.page,method:page.method});
  }
  return out;
}
export function manualCourse(code:string):CandidateCourse {return emptyCourse(code.trim().toUpperCase());}
export function manualSession(courseId:string):CandidateSession {return {id:crypto.randomUUID(),courseId,day:field<number>(null),type:field<"lecture"|"lab"|"tutorial">(null),start:field<string>(null),end:field<string>(null),room:confirmedField(""),reviewed:false};}
