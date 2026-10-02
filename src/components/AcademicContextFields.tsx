import { useState } from "react";
import type { AcademicContextKey, ContextSuggestion } from "../lib/domain";
import { comparableContext, contextLabels, contextValue, suggestionConflicts } from "../importer/academic-context";
import { planSelectionConflicts, type MaterialPlanReview } from "../importer/page-selection";
import type { AcademicContext } from "../importer/types";

export function AcademicContextFields({context,onChange,review=false,expanded=false}:{context:AcademicContext;onChange:(key:keyof AcademicContext,value:string)=>void;review?:boolean;expanded?:boolean}) {
  const keys:AcademicContextKey[]=["faculty","program","level","semesterName","specialization","start","end"];
  return <section className="panel setup-context academic-context-editor">
    {review ? <label>University recognition<select value={context.adapterId} onChange={e=>onChange("adapterId",e.target.value)}><option value="" disabled>Choose where you study</option><option value="ecu">Egyptian Chinese University</option><option value="generic">Another university</option></select></label> : <div className="university-choice"><h2>Where do you study?</h2><div className="university-options">
      {[{id:"ecu",name:"Egyptian Chinese University",description:"Enhanced document recognition"},{id:"generic",name:"Another university",description:"Universal timetable importer"}].map(option=><button type="button" key={option.id} className={`university-option ${context.adapterId===option.id?"selected":""}`} aria-label={option.name} aria-pressed={context.adapterId===option.id} onClick={()=>onChange("adapterId",option.id)}><strong>{option.name}</strong><span>{option.description}</span></button>)}
    </div></div>}
    {context.adapterId==="generic" && <label>University name <span className="optional">Optional</span><input maxLength={200} placeholder="Your university" value={context.universityName??""} onChange={e=>onChange("universityName",e.target.value)}/></label>}
    <label>Your name <span className="optional">Optional</span><input maxLength={50} autoComplete="given-name" placeholder="What should we call you?" value={context.name} onChange={e=>onChange("name",e.target.value)}/></label>
    <details className="academic-details" open={expanded||undefined}><summary>{review?"Your academic context":"Academic context"} <span className="optional">Optional · add now or later</span></summary>
      <p className="fine-print">Leave anything you don’t know blank. Semester OS can try to identify it from your documents and ask you to confirm.</p>
      <div className="form-grid">{keys.map(key=><label key={key}>{contextLabels[key]}{review&&contextValue(context,key)&&<small className="context-provenance">{context.provenance?.[key]?.method && context.provenance[key]?.method!=="manual"?"Confirmed from document":"User provided"}</small>}<input maxLength={key==="level"||key==="semesterName"?100:200} type={key==="start"||key==="end"?"date":"text"} placeholder={key==="level"?"Any level or year":key==="semesterName"?"Any semester or term":"Optional"} value={contextValue(context,key)} onChange={e=>onChange(key,e.target.value)}/></label>)}</div>
    </details>
  </section>;
}

export function ContextSuggestions({suggestions,context,decisions,onConfirm,onKeep,onChange}:{suggestions:ContextSuggestion[];context:AcademicContext;decisions:string[];onConfirm:(values:ContextSuggestion[])=>void;onKeep:(values:ContextSuggestion[])=>void;onChange:()=>void}) {
  const groups=new Map<string,ContextSuggestion[]>();
  for(const suggestion of suggestions) {const key=`${suggestion.document}:${suggestion.confidence.source}:${suggestion.confidence.page}`;groups.set(key,[...(groups.get(key)??[]),suggestion]);}
  if (!groups.size) return null;
  return <div className="context-suggestions">{[...groups.entries()].map(([id,values])=>{
    const conflict=values.some(s=>suggestionConflicts(s,context));
    const low=values.some(s=>s.confidence.level!=="high");
    const ambiguous=values.some(s=>values.filter(v=>v.key===s.key).length>1);
    const decided=values.every(s=>decisions.includes(s.id) || comparableContext(contextValue(context,s.key),s.key)===comparableContext(s.value,s.key));
    return <section key={id} className="panel context-suggestion" aria-label="Detected academic context"><div className="eyebrow">DETECTED · {low?"POSSIBLE MATCH — PLEASE CHECK":"SEMESTER OS FOUND"}</div><h3>{values.map(s=>s.value).join(" · ")}</h3>
      <p className="fine-print">Detected from {values[0].document==="material-plan"?"material plan":"timetable"} · {values[0].confidence.source} · Page {values[0].confidence.page}. This is a suggestion; nothing is saved as confirmed automatically.</p>
      {conflict&&!decided&&<p className="review-caution" role="status">This differs from your provided context. Choose which values to keep.</p>}
      <div className="context-actions">{ambiguous?values.map(s=><button key={s.id} className="button small secondary" onClick={()=>onConfirm([s])}>Use {s.value}</button>):<button className="button small secondary" onClick={()=>onConfirm(values)}>{conflict?"Use detected context":"Confirm"}</button>}<button className="text-link" onClick={onChange}>Change</button><button className="text-link" onClick={()=>onKeep(values)}>{values.some(s=>contextValue(context,s.key))?"Keep my context":"Leave unknown"}</button>{decided&&<small className="context-provenance">Reviewed / matches your input</small>}</div>
    </section>;
  })}</div>;
}

export function MaterialPlanPages({review,context,onKeep,onUse,onChoose}:{review:MaterialPlanReview;context:AcademicContext;onKeep:()=>void;onUse:(pages:number[])=>void;onChoose:()=>void}) {
  const [choice,setChoice]=useState("");
  const conflicts=planSelectionConflicts(review);
  const alternative=review.suggestedPages.length>0 && review.suggestedPages.join(",")!==review.usedPages.join(",");
  return <section className="panel plan-page-review" aria-label="Material-plan page review"><div className="eyebrow">MATERIAL PLAN / PAGE SELECTION</div>
    <p>{review.explicit?`Your selected PDF pages: ${review.selectedPages.join(", ")}.`:`Pages used for this draft: ${review.usedPages.join(", ")||"none"}.`}</p>
    {review.suggestedPages.length>0 && <p>We found a likely match on page {review.suggestedPages.join(", ")}. Check its heading and course rows.</p>}
    {conflicts.map(page=>{const academic=page.detected.filter(s=>["level","semesterName"].includes(s.key)||page.conflicts.includes(s.id));return <p key={page.page} className="review-caution" role="alert">This page appears to describe {academic.map(s=>s.value).join(" · ")}, but you selected {academic.map(s=>contextValue(context,s.key)).filter(Boolean).join(" · ")}. PDF page {page.page}{review.acknowledged?" · Selected page kept by you.":" · Please review."}</p>;})}
    {!review.usedPages.length&&<p className="review-caution">No compatible page was identified. Choose a page from the document or change your context.</p>}
    <div className="context-actions">{conflicts.length>0&&<button className="button small secondary" onClick={onKeep}>Keep selected page</button>}{alternative&&<button className="button small secondary" onClick={()=>onUse(review.suggestedPages)}>Use detected page</button>}<button className="text-link" onClick={onChoose}>Choose another page</button></div>
    {review.candidates.length>1&&<details className="academic-details"><summary>Pages checked from selectable text</summary><label>Choose a material-plan page<select value={choice} onChange={e=>setChoice(e.target.value)}><option value="">Choose page</option>{review.candidates.map(c=><option key={c.page} value={c.page}>Page {c.page} · {c.detected.map(s=>s.value).join(" · ")||"Academic heading unknown"}</option>)}</select></label><button className="button small secondary" disabled={!choice} onClick={()=>onUse([Number(choice)])}>Read chosen page</button></details>}
  </section>;
}
