// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { prepareOcrImage } from "./ocr-image";

afterEach(()=>vi.restoreAllMocks());
describe("Non-destructive OCR table preparation", () => {
  it.each([0,128])("removes rules at gray level %i without erasing adjacent letters or changing the preview", (shade) => {
    const source=document.createElement("canvas");source.width=400;source.height=300;
    const images=new Map<HTMLCanvasElement,Uint8ClampedArray>();
    const pixels=new Uint8ClampedArray(400*300*4).fill(255);images.set(source,pixels);
    const ink=(x:number,y:number,color=0)=>{const i=(y*400+x)*4;pixels[i]=pixels[i+1]=pixels[i+2]=color;};
    for (const y of [10,100,200,290]) for(let x=10;x<=390;x++) ink(x,y,shade);
    for (const x of [10,100,200,390]) for(let y=10;y<=290;y++) ink(x,y,shade);
    ink(102,120); ink(120,102); // Letter pixels just outside the exact rules.
    const original=pixels.slice();
    vi.spyOn(HTMLCanvasElement.prototype,"getContext").mockImplementation(function(this:HTMLCanvasElement){
      return {
        drawImage:(input:HTMLCanvasElement)=>images.set(this,images.get(input)!.slice()),
        getImageData:()=>({data:images.get(this)!}),
        fillRect:(x:number,y:number,w:number,h:number)=>{const data=images.get(this)!;for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++){const i=(yy*this.width+xx)*4;data[i]=data[i+1]=data[i+2]=255;}},
      } as unknown as CanvasRenderingContext2D;
    });
    const prepared=prepareOcrImage(source),clean=images.get(prepared.canvas)!;
    expect(prepared.table).toEqual({rows:[10,100,200,290],columns:[10,100,200,390]});
    expect(clean[(120*400+100)*4]).toBe(255);
    expect(clean[(120*400+102)*4]).toBe(0);expect(clean[(102*400+120)*4]).toBe(0);
    expect(pixels).toEqual(original);expect(prepared.canvas).not.toBe(source);
  });
});
