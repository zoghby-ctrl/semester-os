export const MAX_BACKUP_BYTES = 100 * 1024 * 1024;
export const MAX_WALLPAPER_BYTES = 50 * 1024 * 1024;
export const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;
export const MAX_IMAGE_PIXELS = 40_000_000;
export function utf8Size(text: string, ceiling = Infinity) {
  let bytes = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c < 128) bytes++; else if (c < 2048) bytes += 2;
    else if (c >= 0xd800 && c <= 0xdbff && i + 1 < text.length && text.charCodeAt(i + 1) >= 0xdc00 && text.charCodeAt(i + 1) <= 0xdfff) { bytes += 4; i++; }
    else bytes += 3;
    if (bytes > ceiling) return bytes;
  }
  return bytes;
}
export function assertPlainData(input: unknown) {
  const stack: { value: unknown; depth: number; leave?: boolean }[] = [{ value: input, depth: 0 }];
  const seen = new WeakSet<object>(), active = new WeakSet<object>();
  let count = 0;
  while (stack.length) {
    const { value, depth, leave } = stack.pop()!;
    if (leave && value && typeof value === "object") { active.delete(value); seen.add(value); continue; }
    if (++count > 2_000_000 || depth > 20) throw new Error("Data is too complex to import safely.");
    if (!value || typeof value !== "object") {
      if (!["string", "number", "boolean", "undefined"].includes(typeof value) && value !== null) throw new Error("Unsupported data value.");
      if (typeof value === "number" && !Number.isFinite(value)) throw new Error("Invalid numeric value.");
      continue;
    }
    if (active.has(value)) throw new Error("Circular object structures are not supported.");
    if (seen.has(value)) continue;
    active.add(value); stack.push({ value, depth, leave: true });
    if (!Array.isArray(value) && ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw new Error("Only plain data objects can be imported.");
    const keys = Object.keys(value);
    if (keys.length > 100_000) throw new Error("Too many entries to import safely.");
    for (const key of keys) {
      if (["__proto__", "constructor", "prototype"].includes(key)) throw new Error("Unsafe object key in imported data.");
      const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
      if (descriptor.get || descriptor.set) throw new Error("Executable properties cannot be imported.");
      stack.push({ value: descriptor.value, depth: depth + 1 });
    }
  }
}
export function parseBackupJson(text: string): unknown {
  if (text.length > MAX_BACKUP_BYTES || utf8Size(text, MAX_BACKUP_BYTES) > MAX_BACKUP_BYTES) throw new Error("Backup must be smaller than 100 MB.");
  // Bound nesting before JSON.parse can allocate a deeply nested resource bomb.
  let depth = 0, quoted = false, escaped = false, containers = 0, separators = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) { if (escaped) escaped = false; else if (c === "\\") escaped = true; else if (c === '"') quoted = false; continue; }
    if (c === '"') quoted = true;
    else if (c === "{" || c === "[") { if (++depth > 20 || ++containers > 300000) throw new Error("Data is too complex to import safely."); }
    else if (c === "}" || c === "]") depth--;
    else if (c === "," && ++separators > 2_000_000) throw new Error("Data has too many values to import safely.");
  }
  let input: unknown;
  try { input = JSON.parse(text); } catch { throw new Error("This backup is not valid JSON. Your existing data has been kept."); }
  assertPlainData(input); return input;
}
export function safeImportMessage(error: unknown, fallback = "This data could not be validated. Your saved workspace has been kept.") {
  // Zod's issue list can include input values. Keep those out of product errors.
  return error instanceof Error && error.name !== "ZodError" ? error.message.slice(0, 300) : fallback;
}
export type MediaFormat = "application/pdf" | "image/png" | "image/jpeg" | "image/webp" | "image/gif" | "video/mp4" | "video/webm" | "video/ogg";
const ascii = (bytes: Uint8Array, start: number, length: number) => String.fromCharCode(...bytes.slice(start, start + length));
export function sniffFormat(b: Uint8Array): MediaFormat | null {
  if (ascii(b, 0, 5) === "%PDF-") return "application/pdf";
  if ([137,80,78,71,13,10,26,10].every((v, i) => b[i] === v)) return "image/png";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 4) === "WEBP") return "image/webp";
  if (["GIF87a", "GIF89a"].includes(ascii(b, 0, 6))) return "image/gif";
  if (ascii(b, 4, 4) === "ftyp") return "video/mp4";
  if ([0x1a,0x45,0xdf,0xa3].every((v,i) => b[i] === v)) return "video/webm";
  if (ascii(b, 0, 4) === "OggS") return "video/ogg";
  return null;
}
export function imageDimensions(b: Uint8Array, type: MediaFormat): { width: number; height: number } | null {
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  if (type === "image/png" && b.length >= 24 && ascii(b, 12, 4) === "IHDR") return { width: view.getUint32(16), height: view.getUint32(20) };
  if (type === "image/gif" && b.length >= 10) return { width: view.getUint16(6, true), height: view.getUint16(8, true) };
  if (type === "image/webp") {
    for (let p = 12; p + 8 <= b.length;) {
      const chunk = ascii(b, p, 4), size = view.getUint32(p + 4, true), start = p + 8;
      if (chunk === "VP8X" && start + 10 <= b.length) return { width: 1 + b[start+4] + (b[start+5] << 8) + (b[start+6] << 16), height: 1 + b[start+7] + (b[start+8] << 8) + (b[start+9] << 16) };
      if (chunk === "VP8 " && start + 10 <= b.length && ascii(b, start + 3, 3) === "\x9d\x01\x2a") return { width: view.getUint16(start + 6, true) & 0x3fff, height: view.getUint16(start + 8, true) & 0x3fff };
      if (chunk === "VP8L" && start + 5 <= b.length && b[start] === 0x2f) return { width: 1 + b[start+1] + ((b[start+2] & 0x3f) << 8), height: 1 + (b[start+2] >> 6) + (b[start+3] << 2) + ((b[start+4] & 15) << 10) };
      p = start + size + (size % 2);
    }
  }
  if (type === "image/jpeg") {
    for (let p = 2; p + 4 < b.length;) {
      if (b[p] !== 0xff) return null;
      while (b[p] === 0xff) p++;
      const marker = b[p++];
      if (marker === 0xd9 || marker === 0xda) break;
      if (marker === 1 || marker >= 0xd0 && marker <= 0xd7) continue;
      if (p + 2 > b.length) break;
      const size = view.getUint16(p); if (size < 2) return null;
      if ([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker) && p + 7 <= b.length) return { width: view.getUint16(p + 5), height: view.getUint16(p + 3) };
      p += size;
    }
  }
  return null;
}
export function validateImageHeader(bytes: Uint8Array, type: MediaFormat, minimum = 1) {
  const size = imageDimensions(bytes, type);
  if (!size || size.width < minimum || size.height < minimum || size.width * size.height > MAX_IMAGE_PIXELS) throw new Error("Choose a readable image under 40 megapixels with a supported image header.");
  return size;
}
