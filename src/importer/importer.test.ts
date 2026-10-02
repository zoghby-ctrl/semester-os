import { describe, expect, it } from "vitest";
import { ECUAdapter, GenericAdapter } from "../universities";
import { field, confirmedField, needsConfirmation } from "./confidence";
import { validateDocument } from "./extract";
import { enrichMaterialPlan, manualCourse, manualSession, parseTimetable, readTime } from "./parse";
import { normalizeImport, reviewIssues } from "./normalize";
import type { AcademicContext, ExtractionPage, ExtractionWord } from "./types";

const word = (text:string,x:number,y:number,score:number|null=null):ExtractionWord => ({text,x,y,width:text.length*7,height:12,score});
const page = (words:ExtractionWord[],method:ExtractionPage["method"]="pdf-text"):ExtractionPage => ({page:1,source:"timetable.pdf",method,width:1000,height:700,text:words.map(w=>w.text).join(" "),words,blocks:[]});
const context:AcademicContext={name:"Student",adapterId:"ecu",program:"",level:"",semesterName:"Autumn",specialization:"",start:null,end:null};
const rows=()=>page([word("Saturday",10,10),word("CSC2105",120,10),word("Lecture",230,10),word("08:00–09:30",340,10),word("A403",500,10),word("Saturday",10,40),word("CSC2105",120,40),word("Lab",230,40),word("10:00–11:00",340,40)]);

describe("Local document import",()=>{
  it("validates empty, oversized, unsupported, and mismatched file types",()=>{
    for(const file of [{name:"t.pdf",size:0,type:"application/pdf"},{name:"t.exe",size:10,type:""},{name:"t.pdf",size:26*1024*1024,type:"application/pdf"},{name:"t.png",size:10,type:"text/html"}]) expect(()=>validateDocument(file)).toThrow();
    expect(()=>validateDocument({name:"timetable.JPG",size:500,type:"image/jpeg"})).not.toThrow();
  });
  it("reads explicit times without treating OCR scores as probabilities",()=>{
    expect(readTime("8:30 PM")).toBe("20:30"); expect(readTime("24:00")).toBeNull(); expect(readTime("8:99")).toBeNull();
    const p=page([],"ocr"),f=field("B303",p,[word("B303",0,0,72)]);
    expect(f.confidence.level).toBe("medium"); expect(f.confidence.recognitionScore).toBe(72); expect(needsConfirmation(f)).toBe(true);
    expect(field("08:00",p,[],true).confidence.level).toBe("low"); expect(field(null).confidence.level).toBe("unknown"); expect(confirmedField("08:00").confidence.level).toBe("confirmed");
  });
  it("parses a single course, Saturday sessions, missing rooms, and no material plan",()=>{
    const result=parseTimetable([rows()],ECUAdapter);
    expect(result.courses).toHaveLength(1); expect(result.courses[0].name.value).toBeNull(); expect(result.courses[0].credits.value).toBeNull();
    expect(result.sessions.map(s=>[s.day.value,s.type.value,s.start.value,s.end.value,s.room.value])).toEqual([[6,"lecture","08:00","09:30","A403"],[6,"lab","10:00","11:00",null]]);
    expect(result.sessions.every(s=>!s.reviewed)).toBe(true);
  });
  it("keeps low-confidence visual times explicit and does not invent types",()=>{
    const p=page([word("Sunday",180,10),word("Monday",500,10),word("08:00",5,90),word("09:00",5,190),word("10:00",5,290),word("CSC2105",150,125)]);
    p.blocks=[{x:130,y:90,width:170,height:100}];
    const result=parseTimetable([p],ECUAdapter),s=result.sessions[0];
    expect(s.day.value).toBe(0); expect(s.start.value).toBe("08:00"); expect(s.end.value).toBe("09:00"); expect(s.start.confidence.method).toBe("layout"); expect(s.type.value).toBeNull();
  });
  it("enriches matching plan rows by column and excludes prerequisites as enrollments",()=>{
    const result=parseTimetable([rows()],ECUAdapter);
    const plan=page([word("Course Name",140,10),word("Credits",550,10),word("Prerequisite",720,10),word("CSC2105",10,50),word("Artificial Intelligence",140,50),word("3",570,50),word("CSC1100",720,50),word("CSC2200",10,90),word("Different course",140,90),word("4",570,90)]);
    const out=enrichMaterialPlan(result,[plan],ECUAdapter);
    expect(out.courses).toHaveLength(1); expect(out.courses[0].name.value).toBe("Artificial Intelligence"); expect(out.courses[0].credits.value).toBe(3); expect(out.courses[0].prerequisite.value?.code).toBe("CSC1100");
    expect(result.courses[0].name.value).toBeNull();
  });
  it("does not assign unlabeled trailing numbers as credits",()=>{
    const result=enrichMaterialPlan(parseTimetable([rows()],ECUAdapter),[page([word("CSC2105",10,40),word("Artificial Intelligence",140,40),word("82",720,40)])],ECUAdapter);
    expect(result.courses[0].credits.value).toBeNull();
  });
  it("splits adjacent same-color blocks at their separate course anchors",()=>{
    const p=page([word("Sunday",180,10),word("Monday",500,10),word("08:00",5,90),word("09:00",5,190),word("10:00",5,290),word("11:00",5,390),word("12:00",5,490),word("CSC2105",150,120),word("Lecture",150,140),word("A403",150,160),word("CSC2100",150,320),word("Lecture",150,340),word("A401",150,360)]);
    p.blocks=[{x:130,y:96,width:180,height:400}];
    const sessions=parseTimetable([p],ECUAdapter).sessions;
    expect(sessions.map(s=>[s.start.value,s.end.value,s.room.value])).toEqual([["08:00","10:00","A403"],["10:00","12:00","A401"]]);
  });
  it("reads the ECU ruled-plan format from detected columns without default credits",()=>{
    const p=page([word("CSC2105",10,110),word("Artificial Intelligence",110,110),word("2",910,110),word("-",710,110),word("2",810,110),word("3",1010,110),word("N/A",1110,110)],"ocr");
    p.width=1300;p.table={columns:Array.from({length:13},(_,i)=>i*100),rows:[0,100,180]};
    const c=enrichMaterialPlan(parseTimetable([rows()],ECUAdapter),[p],ECUAdapter).courses[0];
    expect(c.credits.value).toBe(3);expect(c.credits.confidence.level).toBe("low");expect(c.hours.value).toEqual({lecture:2,lab:0,tutorial:2});expect(c.prerequisite.confidence.level).toBe("low");
  });
  it("requires session review, accepts explicit corrections and preserves unknown fields",()=>{
    const result=parseTimetable([rows()],ECUAdapter);
    expect(()=>normalizeImport(result,context)).toThrow(/review/);
    result.sessions.forEach(s=>{s.reviewed=true;s.room=confirmedField(s.room.value??"");});
    result.courses.forEach(c=>{c.reviewed=true;});
    result.sessions[0].start=confirmedField("08:15");
    const semester=normalizeImport(result,context);
    expect(semester.sessions[0].start).toBe("08:15"); expect(semester.courses[0].credits).toBeNull(); expect(semester.program).toBeNull();
    expect(()=>normalizeImport(result,{...context,adapterId:"generic"})).toThrow(/selection/);
  });
  it("reports malformed and manual candidates before activation",()=>{
    const result=parseTimetable([page([])],GenericAdapter);
    expect(result.warnings.length).toBeGreaterThan(0); expect(reviewIssues(result).length).toBeGreaterThan(0);
    result.courses=[manualCourse("BIO101")]; result.sessions=[manualSession(result.courses[0].id)];
    expect(reviewIssues(result).join(" ")).toContain("weekday");
    result.sessions[0].day=confirmedField(1);result.sessions[0].type=confirmedField("lecture");result.sessions[0].start=confirmedField("10:00");result.sessions[0].end=confirmedField("09:00");result.sessions[0].reviewed=true;
    expect(reviewIssues(result).join(" ")).toContain("end time");
  });
});
