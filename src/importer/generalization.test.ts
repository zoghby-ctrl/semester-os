import { describe, expect, it } from "vitest";
import { ECUAdapter, GenericAdapter } from "../universities";
import { ecuCatalogScope } from "../data/ecu-catalog";
import { confirmContext, detectAcademicContext, editContext, emptyAcademicContext } from "./academic-context";
import { confirmedField } from "./confidence";
import { enrichMaterialPlan, manualCourse, manualSession, parseTimetable, recontextualizeImport } from "./parse";
import { normalizeImport, reviewIssues } from "./normalize";
import { planSelectionConflicts, reviewMaterialPlanPages } from "./page-selection";
import type { AcademicContext, ExtractionPage } from "./types";

function page(rows:string[][],pageNo=1,method:ExtractionPage["method"]="pdf-text"):ExtractionPage {
  const words=rows.flatMap((row,i)=>row.map((text,j)=>({text,x:[10,140,380,550,720][j]??900,y:10+i*50,width:Math.min(220,text.length*7),height:12,score:method==="ocr"?40:null})));
  return {page:pageNo,source:"synthetic.pdf",method,width:1100,height:700,text:words.map(w=>w.text).join(" "),words,blocks:[]};
}
const context=(adapterId="ecu",patch:Partial<AcademicContext>={}):AcademicContext=>({...emptyAcademicContext(),adapterId,...patch});
const timetable=(code="CSC2105")=>page([["Monday",code,"Lecture","08:00–09:30","A403"]]);
const reviewed=(result:ReturnType<typeof parseTimetable>)=>{result.courses.forEach(c=>c.reviewed=true);result.sessions.forEach(s=>s.reviewed=true);return result;};
const importCourse=(ctx:AcademicContext,code="CSC2105")=>enrichMaterialPlan(parseTimetable([timetable(code)],ctx.adapterId==="ecu"?ECUAdapter:GenericAdapter,ctx),[],ctx.adapterId==="ecu"?ECUAdapter:GenericAdapter,ctx);

describe("University-agnostic academic context",()=>{
  it("starts with no ECU, level, term, program, faculty, or dates",()=>{
    const fresh=emptyAcademicContext();
    expect(fresh).toMatchObject({adapterId:"",universityName:"",program:"",faculty:"",level:"",semesterName:"",specialization:"",start:null,end:null});
    expect(fresh.provenance).toEqual({});
  });
  it.each([
    ["Level 1","Semester 1"],["Level 1","Semester 2"],["Level 2","Semester 1"],["Level 2","Semester 2"],
    ["Level 3",""],["Level 4",""],["","Semester 1"],["Level 2",""],["",""],["","Summer"],
  ])("accepts ECU %s / %s without seeding any curriculum",(level,semesterName)=>{
    const ctx=context("ecu",{level,semesterName});const result=importCourse(ctx,"QA1001");
    const semester=normalizeImport(reviewed(result),ctx);
    expect(semester.level?.label??"").toBe(level);expect(semester.semester.name).toBe(semesterName||"My semester");
    expect(semester.program).toBeNull();expect(semester.courses.map(c=>c.code)).toEqual(["QA1001"]);
    expect(semester.courses[0].credits).toBeNull();
  });
  it.each(["Cairo University","Ain Shams","Custom Private University","Foreign University",""])("preserves optional generic university %s",universityName=>{
    const ctx=context("generic",{universityName});const semester=normalizeImport(reviewed(importCourse(ctx)),ctx);
    expect(semester.university.name).toBe(universityName||"University not supplied");expect(semester.university.adapterId).toBe("generic");
    expect(semester.courses[0].name).toBeNull();expect(semester.level).toBeNull();expect(semester.program).toBeNull();
  });
  it("keeps specialization and faculty without requiring a program",()=>{
    const ctx=context("generic",{faculty:"School of Design",specialization:"Visual practice",semesterName:"Michaelmas",start:"2026-10-01",end:"2027-01-15"});
    const semester=normalizeImport(reviewed(importCourse(ctx)),ctx);
    expect(semester.program).toBeNull();expect(semester.academicContext).toMatchObject({faculty:"School of Design",specialization:"Visual practice"});
    expect(semester.semester).toMatchObject({name:"Michaelmas",start:ctx.start,end:ctx.end});
  });
});

describe("Visible context evidence and explicit decisions",()=>{
  it("never derives context from codes, catalog, filename, or page position",()=>{
    const p={...timetable(),source:"ECU-CS-Level-2-Semester-1.pdf",page:6};
    expect(detectAcademicContext(p,"timetable")).toEqual([]);
    const ctx=context();const semester=normalizeImport(reviewed(importCourse(ctx)),ctx);
    expect(semester.level).toBeNull();expect(semester.program).toBeNull();expect(semester.semester.name).toBe("My semester");
  });
  it("records detected level and semester separately without auto-confirming",()=>{
    const p=page([["Level 2 · Semester 1"],["Monday","QA1001","Lecture","08:00–09:30","A403"]]);
    const ctx=context("generic");const result=parseTimetable([p],GenericAdapter,ctx);
    expect(result.detectedContext?.map(s=>[s.key,s.value])).toEqual([["level","Level 2"],["semesterName","Semester 1"]]);
    const semester=normalizeImport(reviewed(result),ctx);
    expect(semester.level).toBeNull();expect(semester.semester.name).toBe("My semester");expect(semester.academicContext?.confirmed).toEqual({});
    expect(semester.academicContext?.detected).toHaveLength(2);
  });
  it("does not auto-confirm low-confidence OCR headings",()=>{
    const p=page([["Level 4 Semester 2"],["Monday","QA1001","Lecture","08:00–09:30","A403"]],1,"ocr");
    const result=parseTimetable([p],GenericAdapter);const ctx=context("generic");
    expect(result.detectedContext?.every(s=>s.confidence.level==="low")).toBe(true);
    expect(normalizeImport(reviewed(result),ctx).level).toBeNull();
    const confirmed=confirmContext(ctx,result.detectedContext!);
    const saved=normalizeImport(result,confirmed);
    expect(saved.level?.label).toBe("Level 4");expect(saved.academicContext?.confirmed.level).toMatchObject({level:"confirmed",method:"ocr",page:1});
  });
  it("requires a decision for conflicting detected and supplied context",()=>{
    const ctx=context("generic",{level:"Level 1",semesterName:"Semester 1"});
    const result=reviewed(parseTimetable([page([["Level 2 Semester 1"],["Monday","QA1001","Lecture","08:00–09:30","A403"]])],GenericAdapter,ctx));
    expect(()=>normalizeImport(result,ctx)).toThrow(/detected academic level conflict/);
    result.contextDecisions=result.detectedContext!.map(s=>s.id);
    expect(normalizeImport(result,ctx).level?.label).toBe("Level 1");
  });
  it("explicit context remains user provided and survives import unchanged",()=>{
    const ctx=context("generic",{level:"Year 7",semesterName:"Research term",program:"Custom program"});
    const saved=normalizeImport(reviewed(importCourse(ctx)),ctx);
    expect(saved.level?.label).toBe("Year 7");expect(saved.semester.name).toBe("Research term");expect(saved.program?.name).toBe("Custom program");
    expect(saved.academicContext?.confirmed.level?.method).toBe("manual");
  });
  it("detecting an ECU name does not enable an ECU adapter",()=>{
    const suggestions=detectAcademicContext(page([["Egyptian Chinese University Level 2 Semester 1"]]),"material-plan");
    expect(confirmContext(context("generic"),suggestions).adapterId).toBe("generic");
  });
  it("can correct or clear confirmed context without retaining its source attribution",()=>{
    const initial=confirmContext(context("generic"),detectAcademicContext(page([["Level 2 Semester 1"]]),"material-plan"));
    const edited=editContext(initial,"level","Year 3");expect(edited.level).toBe("Year 3");expect(edited.provenance?.level?.method).toBe("manual");
    expect(editContext(edited,"level","").level).toBe("");
  });
});

describe("Material-plan selection follows evidence, not fixture positions",()=>{
  it.each([1,6,17,101])("suggests Level 2 Semester 1 on arbitrary page %s",number=>{
    const before=number===1?3:number-1,after=number+1;
    const pages=[page([["Level 1 Semester 1"],["QA1101"]],before),page([["Level 2 Semester 1"],["CSC2105"]],number),page([["Level 1 Semester 2"],["QA1201"]],after)];
    const review=reviewMaterialPlanPages(pages,context("ecu",{level:"Level 2",semesterName:"Semester 1"}),["CSC2105"]);
    expect(review.suggestedPages).toEqual([number]);expect(review.usedPages).toEqual([number]);
  });
  it("honors a wrong explicit page and suggests a different page without replacing it",()=>{
    const ctx=context("ecu",{level:"Level 1",semesterName:"Semester 1"});
    const pages=[page([["Level 2 Semester 1"],["CSC2105"]],4),page([["Level 1 Semester 1"],["QA1101"]],9)];
    const review=reviewMaterialPlanPages(pages,ctx,["CSC2105"],[4]);
    expect(review.usedPages).toEqual([4]);expect(review.selectedPages).toEqual([4]);expect(review.suggestedPages).toEqual([9]);
    expect(planSelectionConflicts(review).map(c=>c.page)).toEqual([4]);
    const result=reviewed(importCourse(ctx));result.planReview=review;
    expect(reviewIssues(result,ctx)[0]).toContain("page conflict");
    review.acknowledged=true;expect(()=>normalizeImport(result,ctx)).not.toThrow();
  });
  it("never treats user input or an overlapping course code as proof of a heading",()=>{
    const ctx=context("ecu",{level:"Level 1",semesterName:"Semester 1"});
    const review=reviewMaterialPlanPages([page([["CSC2105"]],12)],ctx,["CSC2105"]);
    expect(review.candidates[0].detected).toEqual([]);expect(review.candidates[0].conflicts).toEqual([]);
    expect(ctx.level).toBe("Level 1");
  });
  it("marks multiple headings uncertain and requires choosing a single value",()=>{
    const suggestions=detectAcademicContext(page([["Level 1 / Level 2 Semester 1"]]),"material-plan");
    expect(suggestions.filter(s=>s.key==="level").every(s=>s.confidence.level==="low")).toBe(true);
    expect(()=>confirmContext(context("generic"),suggestions)).toThrow(/Choose one/);
  });
  it("a confirmed different institution removes the ECU adapter",()=>{
    const suggestions=detectAcademicContext(page([["University: Cairo University"]]),"timetable");
    expect(confirmContext(context("ecu"),suggestions)).toMatchObject({adapterId:"generic",universityName:"Cairo University"});
  });
  it("keeps ambiguous candidate pages reviewable",()=>{
    const review=reviewMaterialPlanPages([page([["Level 3"],["QA3001"]],2),page([["Level 3"],["QA3001"]],8)],context("generic",{level:"Level 3"}),["QA3001"]);
    expect(review.suggestedPages).toEqual([2,8]);expect(review.acknowledged).toBe(false);
  });
});

describe("Context-safe metadata and real generic imports",()=>{
  it("preserves code-first ECU names and the bounded catalog scope",()=>{
    const ctx=context("ecu",{program:"Computer Science",level:"Level 2",semesterName:"Semester 1"});
    const result=enrichMaterialPlan(importCourse(ctx),[page([["CSC2105","Artiflcial lntelllgence"]],7,"ocr")],ECUAdapter,ctx);
    expect(result.courses[0].name.value).toBe("Artificial Intelligence");expect(result.courses[0].credits.value).toBe(3);
    expect(ecuCatalogScope).toMatchObject({completeRecords:6,nameOnlyReferences:4});
    expect(result.courses).toHaveLength(1);
  });
  it.each([{level:"Level 1"},{level:"Level 3"},{level:"Level 4"},{semesterName:"Semester 2"},{semesterName:"Summer"},{program:"Engineering"},{program:"Business"},{program:"Pharmacy"},{faculty:"Custom Faculty"}])("does not transfer scoped owner metadata into incompatible ECU context %j",patch=>{
    const ctx=context("ecu",patch);const result=enrichMaterialPlan(importCourse(ctx),[page([["CSC2105","Document title"]])],ECUAdapter,ctx);
    expect(result.courses[0].name.value).toBe("Document title");expect(result.courses[0].name.confidence.method).toBe("pdf-text");
    expect(result.courses[0].credits.value).toBeNull();expect(result.courses).toHaveLength(1);
  });
  it("prevents enriching a generic result through the ECU adapter",()=>{
    expect(()=>enrichMaterialPlan(importCourse(context("generic")),[],ECUAdapter)).toThrow(/adapter changed/);
  });
  it("clears catalog fields when correcting university and preserves manual corrections",()=>{
    const ecu=importCourse(context());ecu.courses[0].credits=confirmedField(4);
    const generic=recontextualizeImport(ecu,GenericAdapter,context("generic"));
    expect(generic.courses[0].name.value).toBeNull();expect(generic.courses[0].credits.value).toBe(4);
    expect(generic.courses[0].credits.confidence.method).toBe("manual");expect(generic.sessions).toEqual(ecu.sessions);
  });
  it.each([ECUAdapter,GenericAdapter])("allows context changes while a new $id course is still incomplete",adapter=>{
    const ctx=context(adapter.id),draft=parseTimetable([],adapter);draft.courses=[manualCourse("")];
    const corrected=recontextualizeImport(draft,adapter,{...ctx,level:"Level 3"});
    expect(corrected.courses[0].code.value).toBe("");expect(reviewIssues(corrected,ctx)).toContain("Every course needs a code.");
    expect(()=>normalizeImport(corrected,ctx)).toThrow();
  });
  it("extracts generic course names and sessions without ECU defaults",()=>{
    const p=page([["Tuesday","CSC2105","Ethics and Society Lecture","10:00–12:00","A403"]]);
    const ctx=context("generic");const result=parseTimetable([p],GenericAdapter,ctx);
    expect(result.courses[0].name.value).toBe("Ethics and Society");expect(result.courses[0].credits.value).toBeNull();
    const semester=normalizeImport(reviewed(result),ctx);expect(semester.sessions[0]).toMatchObject({day:2,type:"lecture",start:"10:00",end:"12:00",room:"A403"});
    expect(semester.courses[0].metadataProvenance?.name.method).toBe("pdf-text");
  });
  it("treats weekday rows as rows instead of mistaking them for grid headers",()=>{
    const p=page([["Monday","BIO101","Life Science Lecture","08:00–09:30","A403"],["Tuesday","ART101","Studio Lab","10:00–11:30","B404"],["Friday","ENG101","Writing Tutorial","13:00–14:00","C405"]]);
    const result=parseTimetable([p],GenericAdapter);
    expect(result.sessions.map(s=>[s.day.value,s.type.value,s.start.value])).toEqual([[1,"lecture","08:00"],[2,"lab","10:00"],[5,"tutorial","13:00"]]);
    expect(result.courses.map(c=>c.name.value)).toEqual(["Life Science","Studio","Writing"]);
  });
  it("reads generic row text when a PDF text item contains several fields",()=>{
    const result=parseTimetable([page([["Monday BIO101 Life Science Lecture 08:00-09:30 A403"]])],GenericAdapter);
    expect(result.courses[0].name.value).toBe("Life Science");expect(result.sessions[0]).toMatchObject({day:{value:1},start:{value:"08:00"},end:{value:"09:30"},room:{value:"A403"}});
  });
  it("preserves generic prerequisite text without manufacturing a prerequisite code",()=>{
    const ctx=context("generic");const plan=page([["Course Name","Credits","Prerequisite"],["CSC2105","Ethics", "Permission of department"]]);
    plan.words[0].x=140;plan.words[1].x=550;plan.words[2].x=720;plan.words[3].x=10;plan.words[4].x=140;plan.words[5].x=720;
    const course=enrichMaterialPlan(importCourse(ctx),[plan],GenericAdapter,ctx).courses[0];
    expect(course.prerequisite.value).toEqual({code:"",name:"Permission of department"});
  });
  it("manual entry works with an arbitrary university and no academic context",()=>{
    const ctx=context("generic",{universityName:"My University"});const result=parseTimetable([],GenericAdapter);
    const course=manualCourse("ART101");course.name=confirmedField("Studio Practice");course.reviewed=true;result.courses=[course];
    const s=manualSession(course.id);s.day=confirmedField(5);s.type=confirmedField("tutorial");s.start=confirmedField("14:00");s.end=confirmedField("16:00");s.reviewed=true;result.sessions=[s];
    const saved=normalizeImport(result,ctx);expect(saved.origin).toBe("manual");expect(saved.courses[0].name).toBe("Studio Practice");expect(saved.level).toBeNull();
  });
});
