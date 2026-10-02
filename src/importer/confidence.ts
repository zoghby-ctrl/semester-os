import type { ExtractionConfidence } from "../lib/domain";
import type { ExtractedField, ExtractionPage, ExtractionWord } from "./types";
export function field<T>(value: T | null, page?: ExtractionPage, words: ExtractionWord[] = [], inferred = false): ExtractedField<T> {
  const scores = words.map(w => w.score).filter((s):s is number => s !== null);
  const score = scores.length ? Math.min(...scores) : null;
  const method = inferred ? "layout" : page?.method ?? "manual";
  const level = value === null ? "unknown" : inferred ? "low" : method === "pdf-text" ? "high" : method === "manual" ? "confirmed" : score !== null && score >= 90 ? "high" : score !== null && score >= 65 ? "medium" : "low";
  const confidence: ExtractionConfidence = {
    method, level, recognitionScore: score, source: page?.source.slice(0, 200) ?? null, page: page?.page ?? null,
    reason: value === null ? "Not found in the supplied document." : inferred ? "Estimated from visual placement. Check the exact value against your timetable." : method === "pdf-text" ? "Read from the document's selectable text. Review against the source." : method === "manual" ? "Entered or corrected by you." : "Recognized by local OCR. The engine score describes recognition quality, not a probability of correctness.",
  };
  return {value,confidence};
}
export const confirmedField = <T>(value: T): ExtractedField<T> => field(value);
export const needsConfirmation = (f: ExtractedField<unknown>) => !["high","confirmed"].includes(f.confidence.level);
