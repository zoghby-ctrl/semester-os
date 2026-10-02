import type { DocumentExtractor, ExtractionPage, ExtractionWord } from "./types";
import { prepareOcrImage } from "./ocr-image";
import { MAX_DOCUMENT_BYTES, sniffFormat, validateImageHeader } from "../lib/security";
import { validateExtractionPages } from "./validation";

const maxBytes = MAX_DOCUMENT_BYTES;
export function validateDocument(file: Pick<File, "name" | "type" | "size">) {
  if (!file.size) throw new Error("This document is empty. Choose another file.");
  if (file.name.length > 255) throw new Error("Use a shorter document filename.");
  if (file.size > maxBytes) throw new Error("Choose a document smaller than 25 MB.");
  if (!/\.(pdf|png|jpe?g|webp)$/i.test(file.name)) throw new Error("Choose a PDF, PNG, JPG, or WebP timetable.");
  if (file.type && !["application/pdf", "image/png", "image/jpeg", "image/webp"].includes(file.type)) throw new Error("This file type is not supported. Choose a PDF or image.");
}
export async function inspectDocument(file: File) {
  validateDocument(file);
  const bytes = new Uint8Array(await file.slice(0, 1024 * 1024).arrayBuffer());
  const format = sniffFormat(bytes);
  const expected = /\.pdf$/i.test(file.name) ? "application/pdf" : /\.png$/i.test(file.name) ? "image/png" : /\.jpe?g$/i.test(file.name) ? "image/jpeg" : "image/webp";
  if (format !== expected || file.type && file.type !== format) throw new Error("The document contents do not match its file format. Choose the original PDF or image.");
  if (format !== "application/pdf") validateImageHeader(bytes, format, 50);
  return format;
}
const cancelled = () => new DOMException("Import cancelled", "AbortError");
function check(signal: AbortSignal) { if (signal.aborted) throw cancelled(); }
function bounded<T>(task: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve,reject) => {
    const abort=()=>reject(cancelled());
    if(signal.aborted) { reject(cancelled()); return; }
    signal.addEventListener("abort",abort,{once:true});
    task.then(resolve,reject).finally(()=>signal.removeEventListener("abort",abort));
  });
}
const blobFromCanvas = (canvas: HTMLCanvasElement) => new Promise<Blob>((resolve,reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error("Could not preview this image. Try a different file.")), "image/png"));

// Only colorful, filled timetable blocks qualify; blank paper and black text
// never manufacture a session rectangle. Sampling is bounded to 2MP.
export function coloredBlocks(canvas: HTMLCanvasElement) {
  const scale=Math.min(1,1200/canvas.width);
  const small=document.createElement("canvas"); small.width=Math.round(canvas.width*scale); small.height=Math.round(canvas.height*scale);
  const ctx=small.getContext("2d",{willReadFrequently:true}); if(!ctx) return [];
  ctx.drawImage(canvas,0,0,small.width,small.height);
  const {data}=ctx.getImageData(0,0,small.width,small.height);
  const mask=new Uint8Array(small.width*small.height);
  for(let i=0;i<mask.length;i++) {
    const r=data[i*4],g=data[i*4+1],b=data[i*4+2],a=data[i*4+3];
    mask[i]=a>200 && Math.max(r,g,b)-Math.min(r,g,b)>18 && (r+g+b)/3<220 ? 1:0;
  }
  const regions:ExtractionPage["blocks"]=[];
  const queue=new Int32Array(mask.length);
  for(let origin=0;origin<mask.length;origin++) {
    if(!mask[origin]) continue;
    let head=0,tail=1,minX=origin%small.width,maxX=minX,minY=Math.floor(origin/small.width),maxY=minY;
    queue[0]=origin; mask[origin]=0;
    while(head<tail) {
      const i=queue[head++],x=i%small.width,y=Math.floor(i/small.width);
      minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
      for(const next of [x>0?i-1:-1,x<small.width-1?i+1:-1,y>0?i-small.width:-1,y<small.height-1?i+small.width:-1])
        if(next>=0 && mask[next]) {mask[next]=0;queue[tail++]=next;}
    }
    const width=maxX-minX+1,height=maxY-minY+1;
    if(width>small.width*.035 && height>12 && tail>width*height*.35 && width<small.width*.85 && height<small.height*.65)
      regions.push({x:minX/scale,y:minY/scale,width:width/scale,height:height/scale});
  }
  return regions.slice(0,500);
}

export const browserExtractor: DocumentExtractor = {
  async extract(file, {signal,progress}) {
    validateDocument(file);check(signal);
    const internal = new AbortController();
    const abort=()=>internal.abort(); signal.addEventListener("abort",abort,{once:true});
    const timeout=setTimeout(abort,180000);
    let worker: import("tesseract.js").Worker | undefined;
    let loading: import("pdfjs-dist").PDFDocumentLoadingTask | undefined;
    const stop=()=>{ if(worker) void worker.terminate().catch(()=>{}); if(loading) void loading.destroy().catch(()=>{}); };
    internal.signal.addEventListener("abort",stop,{once:true});
    const recognize = async (canvas:HTMLCanvasElement,page:number):Promise<ExtractionPage> => {
      check(internal.signal);
      progress(`Reading page ${page} with local OCR…`);
      if(!worker) {
        const {createWorker,OEM}=await import("tesseract.js");
        const base=new URL("vendor/ocr/",document.baseURI).href;
        const pending=createWorker("eng",OEM.LSTM_ONLY,{workerPath:base+"worker.min.js",corePath:base,langPath:base.replace(/\/$/,""),workerBlobURL:false,legacyCore:false,legacyLang:false,logger:m=>{
          if(!internal.signal.aborted && m.status === "recognizing text") progress(`Reading page ${page} · ${Math.round(m.progress*100)}%`);
        }});
        pending.then(w=>{if(internal.signal.aborted) void w.terminate().catch(()=>{});}).catch(()=>{});
        worker=await bounded(pending,internal.signal);
        await worker.setParameters({tessedit_pageseg_mode:"11" as import("tesseract.js").PSM,preserve_interword_spaces:"1"});
      }
      const prepared=prepareOcrImage(canvas);
      let input=prepared.canvas,offsetX=0,offsetY=0;
      if(prepared.table) {
        offsetX=Math.floor(prepared.table.columns[0]);offsetY=Math.floor(prepared.table.rows[0]);
        input=document.createElement("canvas");input.width=Math.ceil(prepared.table.columns.at(-1)!-offsetX);input.height=Math.ceil(prepared.table.rows.at(-1)!-offsetY);
        input.getContext("2d")!.drawImage(prepared.canvas,offsetX,offsetY,input.width,input.height,0,0,input.width,input.height);
      }
      await worker.setParameters({tessedit_pageseg_mode:(prepared.table?"6":"11") as import("tesseract.js").PSM});
      const {data}=await bounded(worker.recognize(input,{}, {text:true,blocks:true}),internal.signal);
      const words:ExtractionWord[]=(data.blocks ?? []).flatMap(b=>b.paragraphs.flatMap(p=>p.lines.flatMap(l=>l.words.map(w=>({text:w.text,x:w.bbox.x0+offsetX,y:w.bbox.y0+offsetY,width:w.bbox.x1-w.bbox.x0,height:w.bbox.y1-w.bbox.y0,score:w.confidence})))));
      return {page,source:file.name,method:"ocr",width:canvas.width,height:canvas.height,text:data.text,words,table:prepared.table,blocks:coloredBlocks(canvas),preview:await blobFromCanvas(canvas)};
    };
    try {
      const format = await bounded(inspectDocument(file), internal.signal);
      if(format === "application/pdf") {
        progress("Opening your PDF on this device…");
        const pdfjs=await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc=new URL("vendor/pdf/pdf.worker.min.mjs",document.baseURI).href;
        loading=pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),useSystemFonts:true,enableXfa:false,maxImageSize:40000000});
        const pdf=await bounded(loading.promise,internal.signal);
        if(pdf.numPages>20) throw new Error("This PDF has more than 20 pages. Upload only the relevant timetable or plan pages.");
        const pages:ExtractionPage[]=[];
        for(let pageNo=1;pageNo<=pdf.numPages;pageNo++) {
          check(internal.signal);progress(`Reading PDF page ${pageNo} of ${pdf.numPages}…`);
          const page=await bounded(pdf.getPage(pageNo),internal.signal);
          const viewport=page.getViewport({scale:1});
          const content=await bounded(page.getTextContent(),internal.signal);
          if (content.items.length > 20000) throw new Error("This PDF page contains too much text. Upload only the relevant pages.");
          const words:ExtractionWord[]=content.items.filter((item):item is import("pdfjs-dist/types/src/display/api").TextItem=>"str" in item && !!item.str.trim()).map(item=>{
            const transform=pdfjs.Util.transform(viewport.transform,item.transform);
            return {text:item.str,x:transform[4],y:transform[5]-Math.abs(transform[3]),width:item.width,height:Math.abs(transform[3]) || item.height,score:null};
          });
          const scale=Math.min(2,2400/Math.max(viewport.width,viewport.height));
          const rendered=page.getViewport({scale});
          const canvas=document.createElement("canvas"); canvas.width=Math.ceil(rendered.width);canvas.height=Math.ceil(rendered.height);
          const canvasContext=canvas.getContext("2d");if(!canvasContext) throw new Error("Image rendering is unavailable in this browser. Try another browser or enter sessions manually.");
          await bounded(page.render({canvas,canvasContext,viewport:rendered}).promise,internal.signal);
          const text=words.map(w=>w.text).join(" ");
          if(text.replace(/\s/g,"").length>=30 && words.length>=12) pages.push({page:pageNo,source:file.name,method:"pdf-text",width:viewport.width,height:viewport.height,text,words,blocks:coloredBlocks(canvas).map(b=>({x:b.x/scale,y:b.y/scale,width:b.width/scale,height:b.height/scale})),preview:await blobFromCanvas(canvas)});
          else pages.push(await recognize(canvas,pageNo));
          page.cleanup();canvas.width=canvas.height=1;
        }
        return validateExtractionPages(pages);
      }
      const pendingBitmap = createImageBitmap(file);
      pendingBitmap.then(image => { if (internal.signal.aborted) image.close(); }).catch(() => {});
      const bitmap=await bounded(pendingBitmap,internal.signal);
      if(bitmap.width*bitmap.height>40000000 || bitmap.width<50 || bitmap.height<50) {bitmap.close();throw new Error("Choose a readable image under 40 megapixels. A PDF or cropped screenshot usually works well.");}
      const scale=Math.min(2,2600/Math.max(bitmap.width,bitmap.height));
      const canvas=document.createElement("canvas");canvas.width=Math.ceil(bitmap.width*scale);canvas.height=Math.ceil(bitmap.height*scale);
      const ctx=canvas.getContext("2d");if(!ctx) {bitmap.close();throw new Error("Image reading is unavailable. Try a PDF or enter sessions manually.");}
      ctx.fillStyle="#fff";ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
      const result=await recognize(canvas,1);canvas.width=canvas.height=1;return validateExtractionPages([result]);
    } catch(error) {
      if(internal.signal.aborted) {
        if(signal.aborted) throw cancelled();
        throw new Error("Reading took too long. Try a cropped image, fewer PDF pages, or enter the uncertain sessions manually.", {cause:error});
      }
      if(error instanceof Error && /password/i.test(error.message)) throw new Error("This PDF needs a password. Upload an unlocked copy or a screenshot.", {cause:error});
      if(error instanceof Error && /pdf|image|decode|invalid|load/i.test(error.message)) throw new Error("We couldn't read this document. Try a clearer image or the original PDF. You can also enter sessions manually.", {cause:error});
      throw error;
    } finally {
      clearTimeout(timeout); signal.removeEventListener("abort",abort); internal.signal.removeEventListener("abort",stop);
      if(worker) await worker.terminate().catch(()=>{});
      if(loading) await loading.destroy().catch(()=>{});
    }
  },
};
