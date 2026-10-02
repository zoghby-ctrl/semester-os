import { describe, expect, it } from "vitest";
import { courses } from "../data/legacy-academic";
import { ecuCourseCatalog, ecuCurriculumCourses, indexECUCatalog } from "../data/ecu-catalog";
import { ECUAdapter, GenericAdapter, matchCourseCodes } from "../universities";
import { resolveECUCode } from "../universities/ecu-codes";
import { courseSchema } from "../lib/domain";
import { confirmedField } from "./confidence";
import { enrichECUCourse } from "./ecu-enrichment";
import { enrichMaterialPlan, parseTimetable } from "./parse";
import { normalizeImport, reviewIssues } from "./normalize";
import type { AcademicContext, ExtractionPage } from "./types";

const context:AcademicContext={name:"Student",adapterId:"ecu",program:"Computer Science",level:"Level 2",semesterName:"Semester 1",specialization:"",start:null,end:null};
function page(texts:string[],method:ExtractionPage["method"]="ocr",score=91):ExtractionPage {
  return {page:2,source:"synthetic-plan.png",method,width:1300,height:700,text:texts.join(" "),blocks:[],words:texts.map((text,i)=>({text,x:[10,140,340,550,720][i]??900,y:50,width:Math.min(220,text.length*7),height:12,score:method==="ocr"?score:null}))};
}
function timetable(code:string,score=91) {
  const p=page(["Saturday",code,"Lecture","08:00–09:30","A403"],"ocr",score);
  p.words.forEach((w,i)=>w.x=[10,120,230,340,500][i]);
  return p;
}
function imported(code:string,name:string,adapter=ECUAdapter) {
  return enrichMaterialPlan(parseTimetable([timetable(code)],adapter,context),[page([code,name])],adapter,context);
}

describe("ECU code-first catalog enrichment",()=>{
  it.each([
    ["CSC2105","Artiflcial lntelllgence","Artificial Intelligence"],
    ["INF2101","Systern Anaiysis and Deslgn","System Analysis and Design"],
    ["CSC2104","Cornputer Archltecture","Computer Architecture"],
  ])("uses %s rather than the mangled name %s",(code,ocr,canonical)=>{
    const result=imported(code,ocr),c=result.courses[0];
    expect(c.name.value).toBe(canonical);expect(c.credits.value).toBe(3);
    expect(c.name.confidence).toMatchObject({method:"catalog",level:"high",recognitionScore:91,page:2});
    expect(c.name.confidence.source).toContain("local curriculum transcription");
    expect(c.name.confidence.reason).toContain(ocr);expect(result.warnings.join(" ")).toContain("Catalog defaults retained");
    expect(c.reviewed).toBe(false);
  });
  it("uses canonical academic fields even when OCR numeric fields contradict them",()=>{
    const p=page(["CSC2105","Artiflcial lntelllgence"]);p.table={columns:Array.from({length:13},(_,i)=>i*100),rows:[0,100]};
    p.words=[{...p.words[0],x:10},{...p.words[1],x:110,width:150},...[["9",1010],["None",1110],["7",910],["8",710],["6",810]].map(([text,x])=>({text:String(text),x:Number(x),y:50,width:30,height:12,score:99}))];
    const c=enrichMaterialPlan(parseTimetable([timetable("CSC2105")],ECUAdapter),[p],ECUAdapter).courses[0];
    expect(c.credits.value).toBe(3);expect(c.prerequisite.value).toEqual({code:"BSC1103",name:"Discrete Mathematics"});
    expect(c.hours.value).toEqual({lecture:2,lab:2,tutorial:0});
    expect([c.credits,c.prerequisite,c.hours].every(f=>f.confidence.method==="catalog")).toBe(true);
  });
  it("keeps a valid code authoritative with footer noise in its OCR cell",()=>{
    const result=enrichMaterialPlan(parseTimetable([timetable("CSC2105")],ECUAdapter),[page(["CSC2105 | Footer 2026","Artiflcial lntelllgence","Lab Tutorial credits footer"])],ECUAdapter);
    expect(result.courses[0].name.value).toBe("Artificial Intelligence");expect(result.courses).toHaveLength(1);
    expect(result.warnings.join(" ")).not.toContain("No material-plan rows matched");
  });
  it("does not hallucinate an unknown code from a familiar name",()=>{
    const c=imported("CSC9999","Artificial Intelligence").courses[0];
    expect(c.code.value).toBe("CSC9999");expect(c.name.value).toBe("Artificial Intelligence");
    expect(c.name.confidence.method).toBe("ocr");expect(c.credits.value).toBeNull();expect(c.prerequisite.value).toBeNull();
  });
  it("does not transfer ECU defaults or OCR code repairs to the generic adapter",()=>{
    const c=imported("CSC2105","Artiflcial lntelllgence",GenericAdapter).courses[0];
    expect(c.name.value).toBe("Artiflcial lntelllgence");expect(c.credits.value).toBeNull();expect(c.name.confidence.method).toBe("ocr");
    expect(matchCourseCodes(GenericAdapter,"CSC2IO5")).toEqual([]);
  });
  it("works without a material plan but keeps poor code evidence low confidence",()=>{
    const c=enrichMaterialPlan(parseTimetable([timetable("CSC2105",40)],ECUAdapter),[],ECUAdapter).courses[0];
    expect(c.name.value).toBe("Artificial Intelligence");expect(c.name.confidence).toMatchObject({method:"catalog",level:"low",recognitionScore:40});
  });
  it("retains manual corrections including explicitly cleared prerequisites",()=>{
    const c=imported("CSC2105","bad").courses[0];
    c.name=confirmedField("Official updated title");c.credits=confirmedField(4);c.prerequisite={value:null,confidence:confirmedField("None").confidence};
    const out=enrichECUCourse(c);expect(out.name.value).toBe("Official updated title");expect(out.credits.value).toBe(4);expect(out.prerequisite.value).toBeNull();
    expect(out.prerequisite.confidence.method).toBe("manual");
  });
  it("updates defaults after a code correction and clears obsolete catalog fields for an unknown code",()=>{
    const c=imported("CSC2105","bad").courses[0];
    const out=enrichECUCourse({...c,code:confirmedField("CSC2104")});
    expect(out.name.value).toBe("Computer Architecture");expect(out.id).toBe(c.id);
    const reference=enrichECUCourse({...out,code:confirmedField("CSC1100")});
    expect(reference.name.value).toBe("Computer Programming I");expect(reference.credits.value).toBeNull();expect(reference.hours.value).toBeNull();
    const unknown=enrichECUCourse({...out,code:confirmedField("CSC9999")});
    expect(unknown.name.value).toBeNull();expect(unknown.credits.value).toBeNull();expect(unknown.prerequisite.value).toBeNull();expect(unknown.hours.value).toBeNull();
  });
  it("keeps code repair evidence and session links, requiring review",()=>{
    const result=enrichMaterialPlan(parseTimetable([timetable("CSC2IO5")],ECUAdapter),[],ECUAdapter);
    expect(result.courses[0].code.value).toBe("CSC2105");expect(result.courses[0].code.confidence.level).toBe("low");
    expect(result.courses[0].code.confidence.reason).toContain("CSC2IO5");
    expect(result.sessions[0].courseId).toBe(result.courses[0].id);expect(result.courses[0].name.confidence.level).toBe("low");
  });
  it.each(["CSC210?","CSC2104/CSC2105","CSC99O9"])("blocks unresolved code %s even if its checkbox is checked",code=>{
    const result=enrichMaterialPlan(parseTimetable([timetable(code)],ECUAdapter),[],ECUAdapter);
    expect(result.courses).toHaveLength(1);expect(result.courses[0].name.value).toBeNull();
    result.courses[0].reviewed=true;expect(reviewIssues(result).join(" ")).toContain("uncertain ECU code");
    expect(()=>normalizeImport(result,context)).toThrow(/uncertain ECU code/);
    expect(result.sessions).toHaveLength(1);
  });
  it("persists catalog and manually corrected provenance when activating a reviewed semester",()=>{
    const result=imported("CSC2105","bad");result.courses[0].name=confirmedField("Updated official title");
    result.courses.forEach(c=>c.reviewed=true);result.sessions.forEach(s=>s.reviewed=true);
    const c=normalizeImport(result,context).courses[0];
    expect(c.metadataProvenance?.name.method).toBe("manual");expect(c.metadataProvenance?.credits.method).toBe("catalog");
    expect(courseSchema.parse(JSON.parse(JSON.stringify(c))).metadataProvenance).toEqual(c.metadataProvenance);
    expect(courseSchema.safeParse({...c,metadataProvenance:{...c.metadataProvenance,credits:{...c.metadataProvenance?.credits,recognitionScore:101}}}).success).toBe(false);
    const old={...c};delete old.metadataProvenance;expect(courseSchema.parse(old).metadataProvenance).toBeUndefined();
  });
  it("uses one metadata source for the unchanged legacy demo, with name-only prerequisite references",()=>{
    expect(courses.map(c=>[c.id,c.name,c.credits,c.prerequisite,c.hours])).toEqual(ecuCurriculumCourses.map(c=>[c.code,c.name,c.credits,c.prerequisite,c.hours]));
    expect(ecuCourseCatalog.size).toBe(10);expect(resolveECUCode("CSC1100").entry).toMatchObject({name:"Computer Programming I",credits:null,prerequisiteKnown:false,hours:null});
  });
});

describe("Bounded ECU code normalization and contextual lookup",()=>{
  it.each([" c.s.c - 2105 ","CSC21O5","CSC2I05","CSC2IO5","[csc2105]"])("normalizes %s to an exact catalog entry",raw=>{
    expect(resolveECUCode(raw).entry?.name).toBe("Artificial Intelligence");expect(matchCourseCodes(ECUAdapter,raw)).toEqual(["CSC2105"]);
  });
  it("repairs a digit in the alphabetic prefix only for an existing code",()=>{
    expect(resolveECUCode("1NF2101").code).toBe("INF2101");expect(resolveECUCode("INF2I0I").code).toBe("INF2101");
  });
  it.each(["CSC210S","Artiflcial lntelllgence","CSC99O9","CSC21055","ZZZ2IO5"])("does not invent a code from %s",raw=>{
    expect(resolveECUCode(raw).entry).toBeNull();expect(matchCourseCodes(ECUAdapter,raw)).toEqual([]);
  });
  it("never resolves a wildcard, even when context leaves one candidate",()=>{
    expect(resolveECUCode("INF210?",context)).toMatchObject({status:"ambiguous",entry:null,code:null,candidates:["INF2101"]});
    expect(resolveECUCode("CSC210?").candidates).toEqual(["CSC2100","CSC2104","CSC2105"]);
  });
  it("uses explicit level and semester only to narrow catalog variants, without guessing on conflicts",()=>{
    const entry=ecuCurriculumCourses[3],catalog=indexECUCatalog([entry,{...entry,name:"Fixture curriculum variant",level:3,semester:2}]);
    expect(resolveECUCode(entry.code,{},catalog).status).toBe("ambiguous");
    expect(resolveECUCode(entry.code,context,catalog).entry?.name).toBe(entry.name);
    expect(resolveECUCode(entry.code,{level:"3",semesterName:"Semester 2"},catalog).entry?.name).toBe("Fixture curriculum variant");
    expect(resolveECUCode(entry.code,{level:"4"},catalog).entry).toBeNull();
  });
});
