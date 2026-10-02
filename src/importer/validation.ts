import { z } from "zod";
import { confidenceSchema, idSchema, timeSchema } from "../lib/domain";
import { assertPlainData } from "../lib/security";
import type { ExtractionPage, ImporterResult } from "./types";
const dimension = z.number().finite().positive().max(100000);
const position = z.number().finite().min(-100000).max(100000);
const word = z.object({ text: z.string().max(4000), x: position, y: position, width: z.number().finite().min(0).max(100000), height: z.number().finite().min(0).max(100000), score: z.number().min(0).max(100).nullable() });
const pageSchema = z.object({ page: z.number().int().min(1).max(500), source: z.string().max(255), method: z.enum(["pdf-text", "ocr"]), width: dimension, height: dimension, text: z.string().max(2_000_000), words: z.array(word).max(20000), blocks: z.array(z.object({ x: position, y: position, width: dimension, height: dimension })).max(500), table: z.object({ columns: z.array(position).max(500), rows: z.array(position).max(2000) }).optional(), preview: z.custom<Blob>(b => b instanceof Blob && b.type === "image/png" && b.size <= 25 * 1024 * 1024).optional() });
export function validateExtractionPages(pages: ExtractionPage[]) {
  const result = z.array(pageSchema).max(20).parse(pages);
  if (result.reduce((n, p) => n + p.words.length, 0) > 100000) throw new Error("The extracted document has too much text. Upload only the relevant pages.");
  return result;
}
const field = <T extends z.ZodTypeAny>(value: T) => z.object({ value: value.nullable(), confidence: confidenceSchema });
export const importerResultSchema = z.object({
  schemaVersion: z.literal(1), adapterId: idSchema,
  courses: z.array(z.object({ id: idSchema, code: field(z.string().min(1).max(40)), name: field(z.string().max(200)), credits: field(z.number().min(0).max(30)), prerequisite: field(z.object({ code: z.string().max(100), name: z.string().max(200) })), hours: field(z.object({ lecture: z.number().min(0).max(50), lab: z.number().min(0).max(50), tutorial: z.number().min(0).max(50) })), reviewed: z.boolean() })).max(100),
  sessions: z.array(z.object({ id: idSchema, courseId: idSchema, day: field(z.number().int().min(0).max(6)), type: field(z.enum(["lecture", "lab", "tutorial"])), start: field(timeSchema), end: field(timeSchema), room: field(z.string().max(100)), reviewed: z.boolean() })).max(500),
  warnings: z.array(z.string().max(1000)).max(1000), sources: z.array(z.object({ name: z.string().max(255), pages: z.number().int().min(1).max(500), method: z.enum(["pdf-text", "ocr"]) })).max(40),
});
export function validateImporterResult(input: ImporterResult) { assertPlainData(input); return importerResultSchema.parse(input); }
