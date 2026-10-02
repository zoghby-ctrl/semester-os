// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { browserExtractor } from "./extract";
import type { ExtractionWord } from "./types";

const mocks = vi.hoisted(() => ({
  getDocument: vi.fn(), createWorker: vi.fn(), prepareOcrImage: vi.fn(),
  render: vi.fn(), cleanup: vi.fn(), destroy: vi.fn(), getPage: vi.fn(),
  recognize: vi.fn(), setParameters: vi.fn(), terminate: vi.fn(),
}));
vi.mock("pdfjs-dist", () => ({GlobalWorkerOptions:{},getDocument:mocks.getDocument,Util:{transform:(_:unknown,t:number[])=>t}}));
vi.mock("tesseract.js", () => ({createWorker:mocks.createWorker,OEM:{LSTM_ONLY:1}}));
vi.mock("./ocr-image", () => ({prepareOcrImage:mocks.prepareOcrImage}));

function file(name = "synthetic.pdf", type = "application/pdf") {
  const f = new File(["%PDF-1.4 test"], name, {type});
  const bytes = new TextEncoder().encode("%PDF-1.4 test").buffer;
  Object.defineProperties(f, {arrayBuffer:{value:async()=>bytes},slice:{value:()=>({arrayBuffer:async()=>bytes})}});
  return f;
}
function content(code: string) {
  return [code,"Course Name","Artificial","Intelligence","Credits","Prerequisite","3","None","Lecture","Tutorial","Lab","Details"].map((str,i)=>({str,width:20,height:12,transform:[1,0,0,12,i*40,50]}));
}
function ocrData(words: ExtractionWord[]) {
  return {data:{text:words.map(w=>w.text).join(" "),blocks:[{paragraphs:[{lines:[{words:words.map(w=>({text:w.text,confidence:w.score??75,bbox:{x0:w.x,y0:w.y,x1:w.x+w.width,y1:w.y+w.height}}))}]}]}]}};
}
const word = (text:string,x:number,y:number):ExtractionWord=>({text,x,y,width:Math.min(80,text.length*10),height:15,score:82});
const options = () => ({signal:new AbortController().signal,progress:vi.fn(),materialPlan:{adapterId:"ecu",courseCodes:["CSC2105"]}});

beforeEach(() => {
  vi.resetAllMocks();
  mocks.render.mockReturnValue({promise:Promise.resolve()});
  mocks.destroy.mockResolvedValue(undefined); mocks.terminate.mockResolvedValue(undefined); mocks.setParameters.mockResolvedValue(undefined);
  mocks.getPage.mockImplementation(async (page:number) => ({
    getViewport:({scale}:{scale:number})=>({width:1000*scale,height:700*scale,transform:[1,0,0,1,0,0]}),
    getTextContent:async()=>({items:content(page===2?"CSC2105":"CSC2200")}),render:mocks.render,cleanup:mocks.cleanup,
  }));
  mocks.getDocument.mockReturnValue({promise:Promise.resolve({numPages:3,getPage:mocks.getPage}),destroy:mocks.destroy});
  mocks.createWorker.mockResolvedValue({recognize:mocks.recognize,setParameters:mocks.setParameters,terminate:mocks.terminate});
  mocks.prepareOcrImage.mockImplementation((canvas:HTMLCanvasElement)=>({canvas,table:undefined}));
  const ctx = {drawImage:vi.fn(),getImageData:()=>({data:new Uint8ClampedArray(4)}),fillRect:vi.fn()};
  vi.spyOn(HTMLCanvasElement.prototype,"getContext").mockImplementation(()=>ctx as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype,"toBlob").mockImplementation(callback=>callback(new Blob(["preview"],{type:"image/png"})));
});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});

describe("Local extractor performance and resource safety", () => {
  it("skips extra free-form name OCR when enrolled ECU codes have catalog defaults", async () => {
    mocks.getPage.mockImplementation(async()=>({getViewport:()=>({width:1300,height:700,transform:[]}),getTextContent:async()=>({items:[]}),render:mocks.render,cleanup:mocks.cleanup}));
    mocks.prepareOcrImage.mockImplementation(canvas=>({canvas,table:{columns:Array.from({length:13},(_,i)=>i*100),rows:[0,100,200]}}));
    mocks.recognize.mockResolvedValue(ocrData([word("CSC2105",10,110),word("Artiflcial",110,110)]));
    const [p]=await browserExtractor.extract(file(),{...options(),pages:[1]});
    expect(mocks.recognize).toHaveBeenCalledTimes(1);expect(p.words[1].text).toBe("Artiflcial");
  });
  it("renders only matching selectable plan pages with a smaller preview and no OCR", async () => {
    const pages = await browserExtractor.extract(file(), options());
    expect(pages.map(p=>[p.page,p.method,p.width])).toEqual([[2,"pdf-text",1000]]);
    expect(mocks.render).toHaveBeenCalledTimes(1);
    expect(mocks.render.mock.calls[0][0].viewport.width).toBe(1200);
    expect(mocks.createWorker).not.toHaveBeenCalled();
    expect(mocks.cleanup).toHaveBeenCalledTimes(3); expect(mocks.destroy).toHaveBeenCalled();
  });
  it("keeps all timetable pages and their original preview resolution", async () => {
    const {materialPlan:_,...opts}=options(); void _;
    const pages = await browserExtractor.extract(file(),opts);
    expect(pages).toHaveLength(3); expect(mocks.render).toHaveBeenCalledTimes(3);
    expect(mocks.render.mock.calls[0][0].viewport.width).toBe(2000);
  });
  it("opens only selected pages in a long PDF and preserves original page provenance", async () => {
    mocks.getDocument.mockReturnValue({promise:Promise.resolve({numPages:100,getPage:mocks.getPage}),destroy:mocks.destroy});
    const pages = await browserExtractor.extract(file(),{...options(),pages:[2]});
    expect(mocks.getPage.mock.calls.map(c=>c[0])).toEqual([2]); expect(pages[0].page).toBe(2);
  });
  it("reports page-selection errors without hiding the actionable message", async () => {
    await expect(browserExtractor.extract(file(),{...options(),pages:[4]})).rejects.toThrow(/within this PDF's 3 pages/);
    expect(mocks.getPage).not.toHaveBeenCalled(); expect(mocks.destroy).toHaveBeenCalled();
  });
  it("retains selectable pages without codes instead of discarding uncertain content", async () => {
    mocks.getPage.mockImplementation(async()=>({getViewport:()=>({width:1000,height:700,transform:[]}),getTextContent:async()=>({items:content("Introduction")}),render:mocks.render,cleanup:mocks.cleanup}));
    expect(await browserExtractor.extract(file(),options())).toHaveLength(3);
  });
  it("uses OCR for scanned pages, reuses one local worker, and reports the current page", async () => {
    mocks.getPage.mockImplementation(async()=>({getViewport:({scale}:{scale:number})=>({width:1000*scale,height:700*scale,transform:[]}),getTextContent:async()=>({items:[]}),render:mocks.render,cleanup:mocks.cleanup}));
    mocks.createWorker.mockImplementation(async (_lang,_oem,config)=>({recognize:async()=>{config.logger({status:"recognizing text",progress:.5});return ocrData([word("CSC2105",10,20)]);},setParameters:mocks.setParameters,terminate:mocks.terminate}));
    const opts=options(),pages=await browserExtractor.extract(file(),opts);
    expect(pages.every(p=>p.method==="ocr")).toBe(true);expect(mocks.createWorker).toHaveBeenCalledTimes(1);
    expect(opts.progress).toHaveBeenCalledWith("Reading page 3 with local OCR · 50%");
    const config=mocks.createWorker.mock.calls[0][2];expect(config.workerPath).toContain("/vendor/ocr/");expect(config.workerBlobURL).toBe(false);
  });
  it("recognizes the name column separately and restores multiline word coordinates", async () => {
    mocks.getPage.mockImplementation(async()=>({getViewport:()=>({width:1300,height:700,transform:[]}),getTextContent:async()=>({items:[]}),render:mocks.render,cleanup:mocks.cleanup}));
    mocks.prepareOcrImage.mockImplementation(canvas=>({canvas,table:{columns:Array.from({length:13},(_,i)=>i*100),rows:[0,100,200,300]}}));
    mocks.recognize.mockResolvedValueOnce(ocrData([word("CSC2105",10,110),word("BadName",110,110),word("3",1010,110)]))
      .mockResolvedValueOnce(ocrData([word("Artificial",7,107),word("Intelligence",7,130)]));
    const [p]=await browserExtractor.extract(file(),{...options(),materialPlan:{adapterId:"ecu",courseCodes:["QA1001"]},pages:[1]});
    expect(mocks.recognize).toHaveBeenCalledTimes(2);
    expect(p.words.map(w=>[w.text,w.x,w.y])).toEqual([["CSC2105",10,110],["3",1010,110],["Artificial",110,110],["Intelligence",110,133]]);
    expect(p.words.every(w=>w.score===82)).toBe(true);expect(p.preview).toBeInstanceOf(Blob);
  });
  it("preserves the first name pass when column recognition returns no text", async () => {
    mocks.getPage.mockImplementation(async()=>({getViewport:()=>({width:1300,height:700,transform:[]}),getTextContent:async()=>({items:[]}),render:mocks.render,cleanup:mocks.cleanup}));
    mocks.prepareOcrImage.mockImplementation(canvas=>({canvas,table:{columns:Array.from({length:13},(_,i)=>i*100),rows:[0,100,200,300]}}));
    mocks.recognize.mockResolvedValueOnce(ocrData([word("Artificial",110,110)])).mockResolvedValueOnce(ocrData([]));
    expect((await browserExtractor.extract(file(),{...options(),materialPlan:{adapterId:"ecu",courseCodes:["QA1001"]},pages:[1]}))[0].words[0].text).toBe("Artificial");
  });
  it("cancels during OCR and destroys local workers/documents", async () => {
    const controller=new AbortController();
    mocks.getPage.mockImplementation(async()=>({getViewport:()=>({width:1000,height:700,transform:[]}),getTextContent:async()=>({items:[]}),render:mocks.render,cleanup:mocks.cleanup}));
    mocks.recognize.mockImplementation(()=>{controller.abort();return new Promise(()=>{});});
    await expect(browserExtractor.extract(file(),{...options(),signal:controller.signal})).rejects.toMatchObject({name:"AbortError"});
    expect(mocks.terminate).toHaveBeenCalledTimes(1);expect(mocks.destroy).toHaveBeenCalled();
  });
});
