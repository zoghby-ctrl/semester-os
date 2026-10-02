import type { ExtractionConfidence, NormalizedSemester, Session } from "../lib/domain";
export interface ExtractedField<T> { value: T | null; confidence: ExtractionConfidence }
export interface CandidateCourse {
  id: string;
  code: ExtractedField<string>;
  name: ExtractedField<string>;
  credits: ExtractedField<number>;
  prerequisite: ExtractedField<{code:string;name:string} | null>;
  hours: ExtractedField<{lecture:number;lab:number;tutorial:number}>;
  reviewed: boolean;
}
export interface CandidateSession {
  id: string; courseId: string;
  day: ExtractedField<number>; type: ExtractedField<Session["type"]>;
  start: ExtractedField<string>; end: ExtractedField<string>; room: ExtractedField<string>;
  reviewed: boolean;
}
export interface ImporterResult {
  schemaVersion: 1;
  adapterId: string;
  courses: CandidateCourse[];
  sessions: CandidateSession[];
  warnings: string[];
  sources: {name:string;pages:number;method:"pdf-text" | "ocr"}[];
}
export interface ExtractionWord {
  text: string; x: number; y: number; width: number; height: number;
  score: number | null;
}
export interface ExtractionPage {
  page: number; source: string; method:"pdf-text" | "ocr";
  width:number; height:number; text:string; words:ExtractionWord[];
  blocks: {x:number;y:number;width:number;height:number}[];
  table?: {columns:number[];rows:number[]};
  preview?: Blob;
}
export interface AcademicContext {
  name: string; adapterId:string; program:string; level:string;
  semesterName:string; specialization:string;
  start:string | null; end:string | null;
}
export interface DocumentExtractor {
  extract(file: File, options: { signal: AbortSignal; progress: (message:string)=>void }): Promise<ExtractionPage[]>;
}
export type ConfirmedSemester = NormalizedSemester;
