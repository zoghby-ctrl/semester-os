import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, BookOpen, Check, FileText, LoaderCircle, LockKeyhole, Plus, ShieldCheck, Trash2, Upload } from "lucide-react";
import { setupNavigationHint, useApp } from "../lib/context";
import { activateSemester, updateSettings } from "../lib/db";
import { legacySemester } from "../lib/legacy";
import { dateSchema, semesterConflicts } from "../lib/domain";
import { days } from "../data/academic";
import { universityAdapters, getUniversityAdapter } from "../universities";
import { confirmedField, field } from "../importer/confidence";
import { emptyImport, enrichMaterialPlan, manualCourse, manualSession, parseTimetable } from "../importer/parse";
import { enrichECUCourse } from "../importer/ecu-enrichment";
import type { ECUAcademicContext } from "../universities/ecu-codes";
import { normalizeImport, reviewIssues } from "../importer/normalize";
import type { AcademicContext, CandidateCourse, CandidateSession, ExtractedField, ExtractionPage, ImporterResult } from "../importer/types";
import { Modal } from "../components/ui";
import { PrismArt } from "./Today";
import { LegalLinks } from "./Legal";
import { safeImportMessage } from "../lib/security";
import { parsePageSelection } from "../importer/page-selection";

export function Welcome() {
  const { act, navigate, settings } = useApp();
  const [step,setStep]=useState<"welcome"|"upload"|"review"|"ready">("welcome");
  const [context,setContext]=useState<AcademicContext>({name:settings.semester?.origin==="demo"?"":settings.name,adapterId:"ecu",program:"",level:"",semesterName:"",specialization:"",start:null,end:null});
  const [timetable,setTimetable]=useState<File|null>(null),[plan,setPlan]=useState<File|null>(null);
  const [timetableRange,setTimetableRange]=useState(""),[planRange,setPlanRange]=useState("");
  const [result,setResult]=useState<ImporterResult|null>(null),[pages,setPages]=useState<ExtractionPage[]>([]);
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(""),[error,setError]=useState(""),[replace,setReplace]=useState(false);
  const controller=useRef<AbortController|null>(null);
  const [openRequested,setOpenRequested]=useState(false);
  useEffect(()=>()=>controller.current?.abort(),[]);
  // Wait for the reactive repository read before leaving first-run setup.
  // A committed write can resolve before useLiveQuery publishes its new settings.
  useEffect(()=>{if(openRequested&&settings.onboardingComplete) navigate("today");},[openRequested,settings.onboardingComplete,navigate]);
  const changeContext=(key:keyof AcademicContext,value:string)=>setContext(c=>({...c,[key]:value||(["start","end"].includes(key)?null:"")}));
  const extract=async()=>{
    if(!timetable) {setError("Choose your timetable first, or use manual entry.");return;}
    if((context.start&&!dateSchema.safeParse(context.start).success)||(context.end&&!dateSchema.safeParse(context.end).success)||(context.start&&context.end&&context.end<context.start)) {setError("Check the semester dates. The end must follow the start.");return;}
    let timetableSelection: number[] | undefined, planSelection: number[] | undefined;
    try {
      timetableSelection = /\.pdf$/i.test(timetable.name) ? parsePageSelection(timetableRange) : undefined;
      planSelection = plan && /\.pdf$/i.test(plan.name) ? parsePageSelection(planRange) : undefined;
    } catch (e) { setError(safeImportMessage(e, "Check the PDF page numbers.")); return; }
    const operation=new AbortController();controller.current=operation;setBusy(true);setError("");setMessage("Preparing your document…");
    try {
      const {browserExtractor}=await import("../importer/extract");
      const timetablePages=await browserExtractor.extract(timetable,{signal:operation.signal,progress:setMessage,pages:timetableSelection});
      const adapter=getUniversityAdapter(context.adapterId);
      let candidate=parseTimetable(timetablePages,adapter,context),allPages=timetablePages;
      if(adapter.id==="ecu") candidate=enrichMaterialPlan(candidate,[],adapter,context);
      if(plan) {
        try {
          const planPages=await browserExtractor.extract(plan,{signal:operation.signal,progress:setMessage,pages:planSelection,materialPlan:{adapterId:adapter.id,courseCodes:candidate.courses.flatMap(c=>c.code.value?[c.code.value]:[])}});
          candidate=enrichMaterialPlan(candidate,planPages,adapter,context);allPages=[...allPages,...planPages];
        } catch(e) {
          if(operation.signal.aborted) throw e;
          candidate.warnings.push(`Material plan: ${safeImportMessage(e, "This plan could not be read.")} Your timetable is ready to review; you can go back to choose plan pages or enter course details below.`);
        }
      }
      if(operation.signal.aborted) return;
      setResult(candidate);setPages(allPages);setStep("review");window.scrollTo(0,0);
    } catch(e) {if(!operation.signal.aborted) setError(e instanceof Error?e.message:"We couldn't read this timetable. Try the PDF or enter sessions manually.");}
    finally {if(controller.current===operation){setBusy(false);controller.current=null;}}
  };
  const generate=async()=>{
    if(!result) return;setBusy(true);setError("");
    try {
      const semester=normalizeImport(result,context);
      await activateSemester(semester,settings.semester?.semester.id??null);
      setReplace(false);setPages([]);setTimetable(null);setPlan(null);setStep("ready");window.scrollTo(0,0);
    } catch(e) {setError(safeImportMessage(e,"Check the imported fields: a value is missing, out of range, or unsupported. Your existing semester has been kept."));setReplace(false);}
    finally {setBusy(false);}
  };
  if(step==="welcome") return <div className="welcome-space">
    <div className="eyebrow">SEMESTER OS / YOUR NEXT CHAPTER</div>
    <h1>Your semester.<br/><span className="welcome-accent">In your space.</span></h1>
    <p>Semester OS turns your university timetable and academic plan into your personal academic operating system.</p>
    <section className="day-hero"><div className="hero-copy"><div className="eyebrow">BUILT AROUND YOUR CLASSES</div><h2>A place for the whole semester.</h2><p>Know your next class. Track your attendance. Keep course work, notes, and study time together.</p></div><PrismArt/></section>
    <div className="welcome-actions"><button className="button" onClick={()=>setStep("upload")}><Upload size={17}/> Upload your timetable</button>
      {!settings.semester&&<button className="button secondary" disabled={busy} onClick={async()=>{setBusy(true);if(await act(activateSemester(legacySemester("Demo Student",true),null))) setOpenRequested(true);setBusy(false);}}><BookOpen size={17}/> Explore Demo Semester</button>}
      <button className="text-link" onClick={async()=>{if(await act(updateSettings({onboardingComplete:true}))) setOpenRequested(true);}}>{settings.semester?"Return to your semester":"Open an empty workspace"} <ArrowRight size={14}/></button></div>
    {!settings.onboardingComplete && <p className="setup-unlock-note"><LockKeyhole size={13} aria-hidden="true" />{setupNavigationHint}</p>}
    <p className="privacy-line"><ShieldCheck size={15}/> Local-first. No account required. Your semester data is designed to stay on this device during normal local use.</p>
    <p className="setup-legal">By continuing, you acknowledge the Terms of Use and Privacy Policy. <LegalLinks /></p>
  </div>;
  if(step==="ready") return <div className="welcome-space generated-space"><div className="generated-check"><Check size={30}/></div><div className="eyebrow">YOUR SEMESTER IS READY</div><h1>Make it<br/><span className="welcome-accent">your own.</span></h1><p>{result?.courses.length} courses and {result?.sessions.length} weekly sessions, reviewed by you. Your work is saved in this browser.</p><div className="guide-grid"><div><strong>01 / Today</strong><p>Your current class, next room, and the day ahead.</p></div><div><strong>02 / Check in</strong><p>Record your arrival or correct attendance from any class.</p></div><div><strong>03 / Your courses</strong><p>Add notes, assignments, and topics as the semester unfolds.</p></div></div><button className="button" onClick={()=>navigate("today")}>Enter your semester <ArrowRight size={17}/></button><p className="privacy-line">Keep a backup in Settings → Data & backup.</p></div>;
  const issues=result?reviewIssues(result):[];
  const conflicts=result?semesterConflicts(result.sessions.filter(s=>s.day.value!==null&&s.start.value&&s.end.value).map(s=>({id:s.id,day:s.day.value!,start:s.start.value!,end:s.end.value!}))):[];
  return <div className="setup-space">
    <div className="setup-top"><button className="text-link" disabled={busy} onClick={()=>{setError("");setStep(step==="review"?"upload":"welcome");}}><ArrowLeft size={15}/> Back</button><div className="setup-steps"><span className={step==="upload"?"active":""}>01 Upload</span><i/><span className={step==="review"?"active":""}>02 Review</span><i/><span>03 Your semester</span></div></div>
    <div className="page-heading"><div><div className="eyebrow">YOUR NEXT CHAPTER / {step.toUpperCase()}</div><h1>{step==="upload"?"Bring your semester in.":"A careful second look."}</h1><p>{step==="upload"?"Upload your schedule. Review what Semester OS found. Generate your semester.":"Compare with the source, correct anything uncertain, and confirm each course and session."}</p></div></div>
    {error&&<div className="import-warning" role="alert">{error}</div>}
    {step==="upload"?<form onSubmit={e=>{e.preventDefault();void extract();}}>
      <fieldset disabled={busy} className="setup-fields">
        <section className="panel setup-context"><label>University<select value={context.adapterId} onChange={e=>changeContext("adapterId",e.target.value)}>{universityAdapters.map(a=><option key={a.id} value={a.id}>{a.profile.name}</option>)}</select></label><label>Your name <span className="optional">Optional</span><input maxLength={50} autoComplete="given-name" placeholder="What should we call you?" value={context.name} onChange={e=>changeContext("name",e.target.value)}/></label>
          <details className="academic-details"><summary>Academic context <span className="optional">Optional · add now or later</span></summary><div className="form-grid"><label>Program<input maxLength={200} placeholder="Your program" value={context.program} onChange={e=>changeContext("program",e.target.value)}/></label><label>Academic level<input maxLength={100} placeholder="Your level or year" value={context.level} onChange={e=>changeContext("level",e.target.value)}/></label><label>Semester<input maxLength={100} placeholder="Your semester name" value={context.semesterName} onChange={e=>changeContext("semesterName",e.target.value)}/></label><label>Specialization<input maxLength={200} placeholder="If relevant" value={context.specialization} onChange={e=>changeContext("specialization",e.target.value)}/></label><label>Semester starts<input type="date" value={context.start??""} onChange={e=>changeContext("start",e.target.value)}/></label><label>Semester ends<input type="date" value={context.end??""} onChange={e=>changeContext("end",e.target.value)}/></label></div></details>
        </section>
        <div className="upload-grid"><DocumentDrop title="Your timetable" description="PDF, screenshot, or image. Start here." file={timetable} onFile={f=>{setTimetable(f);setTimetableRange("");}}/><DocumentDrop title="Material plan" description="Optional. Adds course names, credits, and prerequisites." file={plan} onFile={f=>{setPlan(f);setPlanRange("");}}/></div>
        <div className="form-grid">
          {timetable&&/\.pdf$/i.test(timetable.name)&&<label>Timetable PDF pages<input value={timetableRange} maxLength={100} placeholder="All pages, or e.g. 1-2" onChange={e=>setTimetableRange(e.target.value)} aria-describedby="pdf-pages-help"/></label>}
          {plan&&/\.pdf$/i.test(plan.name)&&<label>Material plan PDF pages<input value={planRange} maxLength={100} placeholder="Your level's pages, e.g. 4-5" onChange={e=>setPlanRange(e.target.value)} aria-describedby="pdf-pages-help"/></label>}
        </div>
        <p className="fine-print" id="pdf-pages-help">Use PDF page numbers, counting the cover as page 1. Leave blank to read all pages in a PDF of up to 20 pages; for longer PDFs, select up to 20 pages from a document of up to 500 pages. Choosing only your level and semester avoids reading the whole plan.</p>
        <p className="fine-print">{getUniversityAdapter(context.adapterId).importHelp} Up to 25 MB per file. The original selectable-text PDF gives the clearest course names. For screenshots, crop to your semester's table, keep the course-code and name columns and outer table edges, and use the original full-resolution image. English OCR is supported; Arabic text is not transcribed. Detected ECU table rules can identify columns without reading Arabic headers. Review names against the source.</p>
      </fieldset>
      {busy?<div className="extraction-progress" role="status"><LoaderCircle size={19}/><div><strong>{message}</strong><p>Reading on this device. This can take a minute for scanned pages.</p></div><button type="button" className="button secondary small" onClick={()=>{controller.current?.abort();setMessage("Cancelling…");}}>Cancel</button></div>:<div className="welcome-actions"><button className="button" type="submit" disabled={!timetable}><FileText size={17}/> Read my timetable</button><button type="button" className="button secondary" onClick={()=>{setResult(emptyImport(context.adapterId));setPages([]);setError("");setStep("review");}}>Enter courses & sessions manually</button></div>}
      <p className="privacy-line"><ShieldCheck size={15}/> Files stay in memory during review and are released after setup.</p>
    </form>:result&&<>
      <div className="review-summary"><div><strong>{result.courses.length}</strong><span>courses found</span></div><div><strong>{result.sessions.length}</strong><span>weekly sessions</span></div><div><strong>{result.courses.filter(c=>!c.reviewed).length+result.sessions.filter(s=>!s.reviewed).length}</strong><span>still to review</span></div></div>
      {result.warnings.length>0&&<div className="import-warning"><strong>Before you confirm</strong>{result.warnings.map((w,i)=><p key={i}>{w}</p>)}</div>}
      {conflicts.length>0&&<div className="import-warning" role="status">{conflicts.length} overlapping session pair{conflicts.length!==1?"s":""}. Check the times or keep the conflict if it is present in the university timetable. Both sessions will remain visible.</div>}
      <div className="review-layout"><div className="review-content"><div className="section-head"><h2>Your courses</h2><button className="button small secondary" onClick={()=>setResult(r=>r&&({...r,courses:[...r.courses,manualCourse("")]}))}><Plus size={14}/> Add course</button></div>
        {result.courses.map(c=><CourseReview key={c.id} course={c} adapterId={context.adapterId} context={context} onChange={patch=>setResult(r=>r&&({...r,courses:r.courses.map(x=>x.id===c.id?{...x,...patch}:x)}))} onRemove={()=>setResult(r=>r&&({...r,courses:r.courses.filter(x=>x.id!==c.id),sessions:r.sessions.filter(s=>s.courseId!==c.id)}))}/>)}
        <div className="section-head"><h2>Your weekly sessions</h2><button className="button small secondary" disabled={!result.courses.length} onClick={()=>setResult(r=>r&&({...r,sessions:[...r.sessions,manualSession(r.courses[0].id)]}))}><Plus size={14}/> Add session</button></div>
        {result.sessions.map((s,i)=><SessionReview key={s.id} session={s} index={i} courses={result.courses} onChange={patch=>setResult(r=>r&&({...r,sessions:r.sessions.map(x=>x.id===s.id?{...x,...patch}:x)}))} onRemove={()=>setResult(r=>r&&({...r,sessions:r.sessions.filter(x=>x.id!==s.id)}))}/>)}
      </div><SourcePreview pages={pages}/></div>
      <div className="generate-bar"><div><strong>{issues.length?"A few details need your attention":"Everything is ready to create"}</strong><p>{issues[0]??"Only the details you reviewed will become your semester."}</p></div><button className="button" disabled={busy||issues.length>0} onClick={()=>settings.semester?setReplace(true):void generate()}>Generate my semester <ArrowRight size={16}/></button></div>
    </>}
    <Modal open={replace} onClose={()=>!busy&&setReplace(false)} title="Start this semester?" description="Your reviewed timetable will become the active semester."><p>Your current semester and its records will be saved as a local recovery point. The new semester starts with empty attendance, notes, and plans. Appearance preferences carry over.</p><p className="fine-print">Export a backup first if you want a separate copy. Recovery points stay in this browser.</p><div className="dialog-actions"><button className="button secondary" disabled={busy} onClick={()=>setReplace(false)}>Keep reviewing</button><button className="button" disabled={busy} onClick={()=>void generate()}>{busy?"Saving…":"Start reviewed semester"}</button></div></Modal>
  </div>;
}

function DocumentDrop({title,description,file,onFile}:{title:string;description:string;file:File|null;onFile:(file:File|null)=>void}) {
  const [error,setError]=useState("");
  const choose=async(f:File)=>{const {validateDocument}=await import("../importer/extract");try{validateDocument(f);onFile(f);setError("");}catch(e){setError(e instanceof Error?e.message:"Choose a PDF or image.");}};
  return <div className="document-drop" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();const f=e.dataTransfer.files[0];if(f) void choose(f);}}><label><span className="upload-icon"><Upload size={23}/></span><strong>{title}</strong><p>{description}</p><span className="document-name">{file?`${file.name} · ${(file.size/1024/1024).toFixed(1)} MB`:"Drop a file or choose from this device"}</span><input type="file" accept="application/pdf,image/png,image/jpeg,image/webp,.pdf,.png,.jpg,.jpeg,.webp" aria-label={`Choose ${title.toLowerCase()}`} onChange={e=>{const f=e.target.files?.[0];if(f) void choose(f);e.target.value="";}}/></label>{file&&<button type="button" className="text-link" onClick={()=>{onFile(null);setError("");}}>Remove file</button>}{error&&<p className="form-error" role="alert">{error}</p>}</div>;
}
function FieldLabel({label,field,children}:{label:string;field:ExtractedField<unknown>;children:ReactNode}) {
  return <label className={`review-field confidence-${field.confidence.level}`}><span>{label}<small className="confidence-label" title={field.confidence.reason}>{field.confidence.method==="catalog"?"ECU catalog":field.confidence.level==="unknown"?"Not supplied":field.confidence.level==="confirmed"?"Corrected":field.confidence.level==="high"?"Read from source":"Check this"}</small></span>{children}</label>;
}
export function CourseReview({course:c,adapterId,context,onChange,onRemove}:{course:CandidateCourse;adapterId:string;context:ECUAcademicContext;onChange:(patch:Partial<CandidateCourse>)=>void;onRemove:()=>void}) {
  const change=(patch:Partial<CandidateCourse>)=>onChange(adapterId==="ecu"&&patch.code?enrichECUCourse({...c,...patch,reviewed:false},context):{...patch,reviewed:false});
  const [hoursDraft,setHoursDraft]=useState({lecture:c.hours.value?.lecture.toString()??"",lab:c.hours.value?.lab.toString()??"",tutorial:c.hours.value?.tutorial.toString()??""});
  const hoursCode=useRef(c.code.value);
  useEffect(()=>{
    if(hoursCode.current===c.code.value) return;
    hoursCode.current=c.code.value;
    setHoursDraft({lecture:c.hours.value?.lecture.toString()??"",lab:c.hours.value?.lab.toString()??"",tutorial:c.hours.value?.tutorial.toString()??""});
  },[c.code.value,c.hours.value]);
  const incompleteHours=Object.values(hoursDraft).some(Boolean)&&!Object.values(hoursDraft).every(Boolean);
  const changeHours=(type:keyof typeof hoursDraft,value:string)=>{
    const next={...hoursDraft,[type]:value};setHoursDraft(next);
    change({hours:Object.values(next).every(Boolean)?confirmedField({lecture:Number(next.lecture),lab:Number(next.lab),tutorial:Number(next.tutorial)}):field<{lecture:number;lab:number;tutorial:number}>(null)});
  };
  return <section className={`panel review-card ${c.reviewed?"reviewed":""}`}><div className="review-card-head"><span className="eyebrow">COURSE / {c.code.value||"ADD CODE"}</span><button className="icon-button" aria-label={`Remove course ${c.code.value} and its sessions`} onClick={onRemove}><Trash2 size={15}/></button></div><div className="course-review-fields"><FieldLabel label="Course code" field={c.code}><input maxLength={40} value={c.code.value??""} onChange={e=>change({code:confirmedField(e.target.value.toUpperCase())})}/></FieldLabel><FieldLabel label="Official name" field={c.name}><input maxLength={200} placeholder="Optional · course code works on its own" value={c.name.value??""} onChange={e=>change({name:e.target.value?confirmedField(e.target.value):{value:null,confidence:confirmedField("Cleared").confidence}})}/></FieldLabel><FieldLabel label="Credit hours" field={c.credits}><input type="number" min={0} max={30} step="0.5" placeholder="Unknown" value={c.credits.value??""} onChange={e=>change({credits:e.target.value?confirmedField(Number(e.target.value)):{value:null,confidence:confirmedField("Cleared").confidence}})}/></FieldLabel></div>
    {c.name.confidence.method==="catalog"&&<p className="fine-print">Defaults from the local ECU catalog for this course code. Check your current official plan; every field remains editable.</p>}
    <details className="academic-details"><summary>Prerequisite & weekly hours</summary><div className="form-grid"><FieldLabel label="Prerequisite code" field={c.prerequisite}><input maxLength={100} placeholder="Not supplied" value={c.prerequisite.value?.code??""} onChange={e=>change({prerequisite:e.target.value?confirmedField({code:e.target.value,name:c.prerequisite.value?.name??""}):{value:null,confidence:confirmedField("None").confidence}})}/></FieldLabel><FieldLabel label="Prerequisite name" field={c.prerequisite}><input maxLength={200} placeholder="If supplied" value={c.prerequisite.value?.name??""} onChange={e=>change({prerequisite:confirmedField({code:c.prerequisite.value?.code??"",name:e.target.value})})}/></FieldLabel></div><label className="review-check"><input type="checkbox" checked={c.prerequisite.value===null&&c.prerequisite.confidence.level!=="unknown"} onChange={e=>change({prerequisite:{value:null,confidence:{...confirmedField("None").confidence,level:e.target.checked?"confirmed":"unknown"}}})}/> The plan explicitly says no prerequisite</label><div className="hours-review">{(["lecture","lab","tutorial"] as const).map(type=><FieldLabel key={type} label={`${type.charAt(0).toUpperCase()+type.slice(1)} hours`} field={c.hours}><input type="number" min={0} max={50} step="0.5" placeholder="Unknown" value={hoursDraft[type]} onChange={e=>changeHours(type,e.target.value)}/></FieldLabel>)}</div><p className="fine-print">Enter all three weekly hours, or leave all three unknown if the plan does not specify them.</p></details>
    <label className="review-check"><input type="checkbox" disabled={incompleteHours} checked={c.reviewed} onChange={e=>onChange({reviewed:e.target.checked})}/><span>Course details checked <small>{incompleteHours?"Enter all three hours or clear them before confirming.":"Fields not supplied may stay blank."}</small></span></label></section>;
}
function SessionReview({session:s,index,courses,onChange,onRemove}:{session:CandidateSession;index:number;courses:CandidateCourse[];onChange:(patch:Partial<CandidateSession>)=>void;onRemove:()=>void}) {
  const change=(patch:Partial<CandidateSession>)=>onChange({...patch,reviewed:false});
  const inferred=s.start.confidence.method==="layout"||s.end.confidence.method==="layout";
  return <section className={`panel review-card ${s.reviewed?"reviewed":""}`}><div className="review-card-head"><span className="eyebrow">SESSION {String(index+1).padStart(2,"0")} / {courses.find(c=>c.id===s.courseId)?.code.value}</span><button className="icon-button" aria-label={`Remove session ${index+1}`} onClick={onRemove}><Trash2 size={15}/></button></div>{inferred&&<p className="review-caution">Times were estimated from the visual layout. Check the exact minutes against your source.</p>}<div className="session-review-fields"><label>Course<select value={s.courseId} onChange={e=>change({courseId:e.target.value})}>{courses.map(c=><option key={c.id} value={c.id}>{c.code.value} {c.name.value?`— ${c.name.value}`:""}</option>)}</select></label><FieldLabel label="Weekday" field={s.day}><select value={s.day.value??""} onChange={e=>change({day:confirmedField(Number(e.target.value))})}><option value="" disabled>Choose day</option>{days.map((d,i)=><option key={d} value={i}>{d}</option>)}</select></FieldLabel><FieldLabel label="Session type" field={s.type}><select value={s.type.value??""} onChange={e=>change({type:confirmedField(e.target.value as "lecture"|"lab"|"tutorial")})}><option value="" disabled>Choose type</option><option value="lecture">Lecture</option><option value="lab">Lab</option><option value="tutorial">Tutorial</option></select></FieldLabel><FieldLabel label="Starts" field={s.start}><input type="time" value={s.start.value??""} onChange={e=>change({start:confirmedField(e.target.value)})}/></FieldLabel><FieldLabel label="Ends" field={s.end}><input type="time" value={s.end.value??""} onChange={e=>change({end:confirmedField(e.target.value)})}/></FieldLabel><FieldLabel label="Room" field={s.room}><input maxLength={100} placeholder="Not supplied" value={s.room.value??""} onChange={e=>change({room:confirmedField(e.target.value)})}/></FieldLabel></div><label className="review-check"><input type="checkbox" checked={s.reviewed} onChange={e=>onChange({reviewed:e.target.checked})}/><span>Session checked against my timetable <small>Day, type, time, and room reviewed.</small></span></label></section>;
}
function SourcePreview({pages}:{pages:ExtractionPage[]}) {
  const [urls,setUrls]=useState<string[]>([]),[index,setIndex]=useState(0);
  useEffect(()=>{const next=pages.map(p=>p.preview?URL.createObjectURL(p.preview):"");setUrls(next);setIndex(0);return()=>next.forEach(url=>url&&URL.revokeObjectURL(url));},[pages]);
  if(!pages.length) return <aside className="panel source-preview"><ShieldCheck size={22}/><h3>Your details, your decision.</h3><p>Manual entries are validated before saving. You can keep optional academic information unknown.</p></aside>;
  const p=pages[index]??pages[0];return <aside className="panel source-preview"><details open><summary>Original document</summary><label className="sr-only" htmlFor="source-page">Source page</label><select id="source-page" value={index} onChange={e=>setIndex(Number(e.target.value))}>{pages.map((p,i)=><option key={i} value={i}>{p.source} · Page {p.page}</option>)}</select>{urls[index]&&<a href={urls[index]} target="_blank" rel="noreferrer" aria-label="Open original document preview larger"><img src={urls[index]} alt={`${p.source}, page ${p.page}`}/></a>}<p className="fine-print">{p.method==="pdf-text"?"Selectable PDF text":"Local English OCR"} · Click the preview to enlarge. Recognition scores describe OCR quality, not the chance that a field is correct.</p><div className="confidence-key"><span>Read from source</span><span>Check this</span><span>Not supplied</span></div></details></aside>;
}
