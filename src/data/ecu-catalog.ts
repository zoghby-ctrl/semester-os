// Canonical metadata already transcribed in legacy-academic.ts. This is a
// bounded local curriculum reference, not a complete or live ECU catalog.
export const ecuCatalogSource = "ECU local curriculum transcription · CS Level 2 / Semester 1";
export interface ECUCatalogEntry {
  code: string; name: string; shortName: string; credits: number | null;
  prerequisite: {code:string;name:string} | null;
  prerequisiteKnown: boolean;
  hours: {lecture:number;lab:number;tutorial:number} | null;
  level?: number; semester?: number;
}
const scope = {level:2,semester:1,prerequisiteKnown:true};
export const ecuCurriculumCourses: readonly ECUCatalogEntry[] = [
  {...scope,code:"INF2101",name:"System Analysis and Design",shortName:"System Analysis",credits:3,prerequisite:null,hours:{lecture:2,lab:2,tutorial:0}},
  {...scope,code:"CSC2100",name:"Data Structures",shortName:"Data Structures",credits:3,prerequisite:{code:"CSC1100",name:"Computer Programming I"},hours:{lecture:2,lab:2,tutorial:0}},
  {...scope,code:"CSC2104",name:"Computer Architecture",shortName:"Computer Architecture",credits:3,prerequisite:{code:"BSC1205",name:"Digital Logic Design"},hours:{lecture:2,lab:1,tutorial:1}},
  {...scope,code:"CSC2105",name:"Artificial Intelligence",shortName:"Artificial Intelligence",credits:3,prerequisite:{code:"BSC1103",name:"Discrete Mathematics"},hours:{lecture:2,lab:2,tutorial:0}},
  {...scope,code:"HU2100",name:"Ethical and Professional Issues in Computing",shortName:"Ethics & Computing",credits:2,prerequisite:null,hours:{lecture:2,lab:0,tutorial:0}},
  {...scope,code:"BSC1301",name:"Mathematics III",shortName:"Mathematics III",credits:3,prerequisite:{code:"BSC1201",name:"Mathematics II"},hours:{lecture:2,lab:0,tutorial:2}},
];

export type ECUCatalog = ReadonlyMap<string, readonly ECUCatalogEntry[]>;
export function indexECUCatalog(entries: readonly ECUCatalogEntry[]): ECUCatalog {
  const catalog = new Map<string, ECUCatalogEntry[]>();
  for (const entry of entries) {
    if (!/^[A-Z]{2,4}\d{4}$/.test(entry.code)) throw new Error("Invalid ECU catalog code");
    const variants = catalog.get(entry.code) ?? [];
    variants.push(entry); catalog.set(entry.code, variants);
  }
  return catalog;
}
// Prerequisite references supply names only. Their credits, hours, requirements,
// level and semester are unknown; never manufacture them from code digits.
const references = ecuCurriculumCourses.flatMap(c => c.prerequisite ? [{
  code:c.prerequisite.code,name:c.prerequisite.name,shortName:c.prerequisite.name,
  credits:null,prerequisite:null,prerequisiteKnown:false,hours:null,
}] : []);
export const ecuCourseCatalog = indexECUCatalog([...ecuCurriculumCourses,...references]);
