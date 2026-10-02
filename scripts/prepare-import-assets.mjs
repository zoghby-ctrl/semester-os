import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
// Local, same-origin assets. No document or recognition request uses a CDN.
const copy = async (source, target) => { await fs.mkdir(path.dirname(target), {recursive:true}); await fs.copyFile(source,target); };
await copy("node_modules/pdfjs-dist/build/pdf.worker.min.mjs", "public/vendor/pdf/pdf.worker.min.mjs");
await copy("node_modules/tesseract.js/dist/worker.min.js", "public/vendor/ocr/worker.min.js");
for (const name of await fs.readdir("node_modules/tesseract.js-core"))
  if (/^tesseract-core(?:-(?:simd|relaxedsimd))?-lstm\.wasm(?:\.js)?$/.test(name)) await copy(`node_modules/tesseract.js-core/${name}`, `public/vendor/ocr/${name}`);
const languageRoot="node_modules/@tesseract.js-data/eng";
async function findLanguage(directory) {
  for (const entry of await fs.readdir(directory,{withFileTypes:true})) {
    const source=path.join(directory,entry.name);
    if(entry.isDirectory()) { const found=await findLanguage(source); if(found) return found; }
    else if(entry.name === "eng.traineddata.gz") return source;
  }
}
const preferred=`${languageRoot}/4.0.0_best_int/eng.traineddata.gz`;
const language=await fs.access(preferred).then(()=>preferred).catch(()=>findLanguage(languageRoot));
if(!language) throw new Error("English OCR data is missing. Run npm ci before preparing assets.");
await copy(language, "public/vendor/ocr/eng.traineddata.gz");
for (const [source,target] of [["node_modules/pdfjs-dist/LICENSE","pdf-LICENSE"],["node_modules/tesseract.js/LICENSE.md","tesseract-LICENSE"],["node_modules/tesseract.js-core/LICENSE","core-LICENSE"],[`${languageRoot}/LICENSE`,"eng-LICENSE"]])
  try { await copy(source,`public/vendor/${target}.txt`); } catch(error) { if(error.code!=="ENOENT") throw error; }
console.log("Local PDF worker and English OCR assets prepared.");
const assets = [];
for (const folder of ["ocr", "pdf"]) for (const name of (await fs.readdir(`public/vendor/${folder}`)).sort()) {
  const data = await fs.readFile(`public/vendor/${folder}/${name}`);
  assets.push({ path: `/vendor/${folder}/${name}`, bytes: data.length, sha256: crypto.createHash("sha256").update(data).digest("hex") });
}
const revision = crypto.createHash("sha256").update(JSON.stringify(assets)).digest("hex").slice(0, 16);
await fs.writeFile("public/vendor/manifest.json", JSON.stringify({ revision, assets }, null, 2));
await fs.writeFile("public/sw-maintenance.js", `// Only non-academic extraction caches are removed on release activation.\nself.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('semester-import-') && key !== 'semester-import-${revision}').map(key => caches.delete(key))))));\n`);
