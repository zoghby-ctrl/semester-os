import { describe, expect, it } from "vitest";
import { demoSettings } from "./legacy";
import { sessionWindow, semesterElapsed, timetableLanes, roomLabel } from "./scheduling";

describe("Dynamic semester experience",()=>{
  const sessions=[{id:"a",day:4,start:"08:00",end:"11:00"},{id:"b",day:4,start:"09:00",end:"10:00"},{id:"c",day:4,start:"10:00",end:"12:00"},{id:"d",day:4,start:"12:00",end:"13:00"}];
  it("shows all current overlaps and does not skip a future class inside another class",()=>{
    const s=demoSettings();s.schedule=[];const template=s.semester!.sessions[0];s.semester!.sessions=sessions.map(x=>({...template,...x}));
    const before=sessionWindow(new Date("2026-10-01T08:30:00"),s);
    expect(before.current?.session.id).toBe("a");expect(before.next?.session.id).toBe("b");
    const during=sessionWindow(new Date("2026-10-01T09:30:00"),s);
    expect(during.currents.map(c=>c.session.id)).toEqual(["a","b"]);expect(during.next?.session.id).toBe("c");
  });
  it("uses separate columns for overlaps, reuses lanes, and restores full width after a group",()=>{
    const lanes=timetableLanes(sessions);
    expect(lanes.get("a")).toEqual({column:0,columns:2});expect(lanes.get("b")).toEqual({column:1,columns:2});expect(lanes.get("c")).toEqual({column:1,columns:2});expect(lanes.get("d")).toEqual({column:0,columns:1});
  });
  it("keeps equal start times and independent weekdays selectable",()=>{
    const lanes=timetableLanes([{...sessions[0],id:"a"},{...sessions[0],id:"b"},{...sessions[0],id:"c",day:5}]);
    expect(lanes.get("b")).toEqual({column:1,columns:2});expect(lanes.get("c")?.columns).toBe(1);
  });
  it("uses no invented room or calendar progress without dates",()=>{
    const s=demoSettings();expect(roomLabel("")).toBe("Room not supplied");expect(semesterElapsed(s,new Date())).toBeNull();
    s.semesterStart="2026-10-01";s.semesterEnd="2026-10-10";
    expect(semesterElapsed(s,new Date("2026-09-30"))?.percentage).toBe(0);expect(semesterElapsed(s,new Date("2026-10-06"))?.percentage).toBe(50);expect(semesterElapsed(s,new Date("2026-11-01"))?.percentage).toBe(100);
  });
});
