import { ecuCatalogSource } from "../data/ecu-catalog";
import { resolveECUCode, type ECUAcademicContext } from "../universities/ecu-codes";
import { field } from "./confidence";
import type { CandidateCourse, ExtractedField, ExtractionPage, ExtractionWord } from "./types";

export function enrichECUCourse(course: CandidateCourse, context: ECUAcademicContext = {}): CandidateCourse {
  const out=structuredClone(course),match=resolveECUCode(out.code.value??"",context);
  // Changing a catalog-backed code must not retain another code's defaults,
  // including when the new catalog entry has only a name.
  for (const key of ["name","credits","prerequisite","hours"] as const) if (out[key].confidence.method==="catalog") {out[key].value=null;out[key].confidence=field(null).confidence;}
  if (match.status==="unknown" && match.code) out.code.value=match.code;
  if (!match.entry) {
    if (match.status==="ambiguous" || match.corrected) {
      out.code.confidence={...out.code.confidence,level:"low",reason:`Uncertain ECU code “${match.raw.slice(0,40)}”. ${match.candidates.length?"Possible catalog codes: "+match.candidates.join(", ")+". ":""}Check the source; no code or catalog metadata was guessed.`.slice(0,500)};
      out.reviewed=false;
    }
    return out;
  }
  if (match.corrected) {
    out.code={value:match.code,confidence:{...out.code.confidence,level:"low",reason:`Normalized likely OCR code “${match.raw.slice(0,40)}” to ${match.code} by structural O/0 or I/1 substitution and an exact local ECU catalog match. Verify the code against the source.`}};
  }
  out.code.value=match.code;
  const confidence={...out.code.confidence,method:"catalog" as const,source:ecuCatalogSource,
    level:["low","medium","unknown"].includes(out.code.confidence.level) ? "low" as const : "high" as const,
    reason:`Local ECU catalog metadata for recognized code ${match.code}. Code evidence: ${out.code.confidence.source??"your entry"}${out.code.confidence.page?", page "+out.code.confidence.page:""}. Catalog is a limited curriculum transcription; review against your current official plan.`};
  const apply=<T>(current:ExtractedField<T>,value:T):ExtractedField<T> => current.confidence.method==="manual" && current.confidence.level==="confirmed" ? current : {value,confidence:{...confidence}};
  out.name=apply(out.name,match.entry.name);
  if (match.entry.credits!==null) out.credits=apply(out.credits,match.entry.credits);
  if (match.entry.prerequisiteKnown) out.prerequisite=apply(out.prerequisite,match.entry.prerequisite);
  if (match.entry.hours!==null) out.hours=apply(out.hours,match.entry.hours);
  out.reviewed=false;
  return out;
}

export function recordECUNameEvidence(course:CandidateCourse,name:string,page:ExtractionPage,words:ExtractionWord[]) {
  const canonical=course.name;
  if (canonical.confidence.method!=="catalog") return null;
  const normalize=(text:string)=>text.normalize("NFKC").toLowerCase().replace(/[^a-z0-9]/g,"");
  if (!name || normalize(name)===normalize(canonical.value??"")) return null;
  const observed=field(name,page,words);
  canonical.confidence.reason=(canonical.confidence.reason+` ${page.method==="ocr"?"OCR":"Document"} name “${name.slice(0,120)}” differs; canonical catalog name retained.`).slice(0,500);
  // Name comparison never selects a course code or overwrites canonical values.
  return `${course.code.value}: ${page.method==="ocr"?"OCR":"Document"} name “${observed.value?.slice(0,120)}” differs from catalog “${canonical.value}”. Catalog defaults retained; compare with the source.`;
}
