import { ecuCourseCatalog, type ECUCatalog, type ECUCatalogEntry } from "../data/ecu-catalog";

export interface ECUAcademicContext { adapterId?: string; universityName?: string; program?: string; faculty?: string; level?: string; semesterName?: string }
export interface ECUCodeResolution {
  raw: string; code: string | null; entry: ECUCatalogEntry | null;
  status: "exact" | "normalized" | "unknown" | "ambiguous" | "invalid";
  candidates: string[]; corrected: boolean;
}
const separators = /[\s._,:-]/g;
const contextNumber = (value: string | undefined, kind: "level" | "semester") => {
  const match = value?.trim().match(kind === "level" ? /^(?:(?:level|year)\s*)?(\d{1,2})$/i : /^(?:(?:semester|sem|term)\s*)?(\d{1,2})$/i);
  return match ? Number(match[1]) : undefined;
};
function narrow(entries: readonly ECUCatalogEntry[], context: ECUAcademicContext) {
  if (context.adapterId && context.adapterId!=="ecu") return [];
  if (context.universityName?.trim() && !/^Egyptian Chinese University$/i.test(context.universityName.trim())) return [];
  const level=contextNumber(context.level,"level"),semester=contextNumber(context.semesterName,"semester");
  const program=(context.program?.trim() || context.faculty?.trim() || "").toLowerCase();
  return entries.filter(e=>(!program || !e.program || [e.program.toLowerCase(),"cs"].includes(program))
    && (!context.level?.trim() || e.level===undefined || level===e.level)
    && (!context.semesterName?.trim() || e.semester===undefined || semester===e.semester));
}

export function resolveECUCode(raw: string, context: ECUAcademicContext = {}, catalog: ECUCatalog = ecuCourseCatalog): ECUCodeResolution {
  const invalid: ECUCodeResolution={raw,code:null,entry:null,status:"invalid",candidates:[],corrected:false};
  if (raw.length>80) return invalid;
  const tokens=ecuCodeTokens(raw);
  if (tokens.length>1) return {...invalid,status:"ambiguous",candidates:[...new Set(tokens.flatMap(t=>resolveECUCode(t,context,catalog).candidates))]};
  const compact=raw.trim().replace(/^[([{]+|[)\]}]+$/g,"").replace(separators,"").toUpperCase();
  // The final four positions are numeric, the prefix is alphabetic. Only
  // O/0 and I/1 substitutions in these positions are eligible, and a repaired
  // code is usable only when it exists in the local catalog.
  const match=compact.match(/^([A-Z01]{2,4})([0-9OI?]{4})$/);
  if (!match || !/[A-Z]/.test(match[1])) return invalid;
  const code=match[1].replace(/0/g,"O").replace(/1/g,"I")+match[2].replace(/O/g,"0").replace(/I/g,"1");
  const corrected=code!==compact;
  if (code.includes("?")) {
    const pattern=new RegExp("^"+code.replace(/\?/g,"[0-9]")+"$");
    const entries=narrow([...catalog.values()].flat().filter(e=>pattern.test(e.code)),context);
    return {...invalid,status:"ambiguous",candidates:[...new Set(entries.map(e=>e.code))],corrected:true};
  }
  const entries=narrow(catalog.get(code)??[],context);
  if (entries.length>1) return {...invalid,code,status:"ambiguous",candidates:[code],corrected};
  if (entries.length===1) return {raw,code,entry:entries[0],status:corrected?"normalized":"exact",candidates:[code],corrected};
  // Unknown but literally valid codes stay usable; repaired unknowns do not.
  if (!corrected) return {raw,code,entry:null,status:"unknown",candidates:[],corrected:false};
  return {...invalid,corrected:true};
}

export function ecuCodeTokens(text: string) {
  return [...text.matchAll(/\b(?:[A-Z01][\s._,:-]*){2,4}(?:[0-9OI?][\s._,:-]*){3}[0-9OI?](?![A-Z0-9])/gi)].map(m=>m[0]);
}
