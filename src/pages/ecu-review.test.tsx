// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CourseReview } from "./Welcome";
import { enrichECUCourse } from "../importer/ecu-enrichment";
import { manualCourse } from "../importer/parse";
import type { CandidateCourse } from "../importer/types";
import { confirmedField } from "../importer/confidence";

vi.mock("virtual:pwa-register/react",()=>({useRegisterSW:()=>({needRefresh:[false],offlineReady:[false],updateServiceWorker:vi.fn()})}));
const roots:ReturnType<typeof createRoot>[]=[];
afterEach(async()=>{await act(async()=>roots.splice(0).forEach(r=>r.unmount()));document.body.replaceChildren();});
async function mount() {
  Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
  const container=document.createElement("div");document.body.append(container);const root=createRoot(container);roots.push(root);
  let latest:CandidateCourse=enrichECUCourse(manualCourse("CSC2105"));
  let replace=(course:CandidateCourse)=>{latest=course;};
  function Harness(){const [course,setCourse]=useState(latest);latest=course;replace=setCourse;return <CourseReview course={course} adapterId="ecu" context={{level:"2",semesterName:"1"}} onChange={patch=>setCourse(c=>({...c,...patch}))} onRemove={()=>{}}/>;}
  await act(async()=>root.render(<Harness/>));
  const input=(label:string)=>[...container.querySelectorAll<HTMLLabelElement>("label")].find(l=>l.textContent?.startsWith(label))!.querySelector<HTMLInputElement>("input")!;
  const change=async(label:string,value:string)=>{await act(async()=>{const el=input(label);Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value")!.set!.call(el,value);el.dispatchEvent(new Event("input",{bubbles:true}));});};
  return {container,input,change,course:()=>latest,replace:async(course:CandidateCourse)=>{await act(async()=>replace(course));}};
}
describe("Editable ECU catalog review",()=>{
  it("refreshes weekly hour inputs when a different plan changes evidence for the same code",async()=>{
    const ui=await mount();await ui.replace({...ui.course(),hours:confirmedField({lecture:2,lab:1,tutorial:1})});
    expect(ui.input("Lab hours").value).toBe("1");expect(ui.input("Tutorial hours").value).toBe("1");
  });
  it("keeps partially entered weekly hours editable until all three values are supplied",async()=>{
    const ui=await mount();await ui.replace(manualCourse("CSC9999"));await ui.change("Lecture hours","2");
    expect(ui.input("Lecture hours").value).toBe("2");expect(ui.course().hours.value).toBeNull();
    await ui.change("Lab hours","1");await ui.change("Tutorial hours","0");expect(ui.course().hours.value).toEqual({lecture:2,lab:1,tutorial:0});
  });
  it("labels catalog defaults and lets a student correct the official name and credits",async()=>{
    const ui=await mount();expect(ui.container.textContent).toContain("ECU catalog");expect(ui.input("Official name").value).toBe("Artificial Intelligence");
    expect(ui.input("Official name").disabled).toBe(false);await ui.change("Official name","Updated official title");await ui.change("Credit hours","4");
    expect(ui.course().name.value).toBe("Updated official title");expect(ui.course().name.confidence.method).toBe("manual");expect(ui.course().credits.value).toBe(4);
  });
  it("updates catalog defaults and weekly hour inputs when the course code changes",async()=>{
    const ui=await mount();await ui.change("Course code","CSC2104");
    expect(ui.input("Official name").value).toBe("Computer Architecture");expect(ui.input("Lab hours").value).toBe("1");expect(ui.input("Tutorial hours").value).toBe("1");
    await ui.change("Course code","CSC9999");expect(ui.input("Official name").value).toBe("");expect(ui.input("Credit hours").value).toBe("");expect(ui.input("Lab hours").value).toBe("");
  });
});
