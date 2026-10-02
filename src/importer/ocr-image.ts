// Detect long ruled lines before OCR. Text and the original preview are kept
// separate: removing a table rule must never change the student's source.
export function prepareOcrImage(source:HTMLCanvasElement) {
  const canvas=document.createElement("canvas");canvas.width=source.width;canvas.height=source.height;
  const ctx=canvas.getContext("2d",{willReadFrequently:true})!;ctx.drawImage(source,0,0);
  const data=ctx.getImageData(0,0,canvas.width,canvas.height).data;
  const horizontal=new Uint32Array(canvas.height),vertical=new Uint32Array(canvas.width);
  for(let y=0;y<canvas.height;y++) for(let x=0;x<canvas.width;x++) {
    const i=(y*canvas.width+x)*4;
    if(Math.max(data[i],data[i+1],data[i+2])<95) {horizontal[y]++;vertical[x]++;}
  }
  const bands=(counts:Uint32Array,threshold:number)=>{
    const out:{start:number;end:number;center:number}[]=[];
    for(let i=0;i<counts.length;i++) if(counts[i]>threshold) {
      const start=i;while(i+1<counts.length && counts[i+1]>threshold) i++;
      out.push({start,end:i,center:(start+i)/2});
    }
    return out;
  };
  const rows=bands(horizontal,canvas.width*.32),columns=bands(vertical,canvas.height*.2);
  // Solid timetable blocks are not ruled tables. Avoid erasing their fills.
  if(rows.length<4||columns.length<4||rows.some(b=>b.end-b.start>12)||columns.some(b=>b.end-b.start>12)) return {canvas:source,table:undefined};
  ctx.fillStyle="#fff";
  for(const b of rows) ctx.fillRect(0,b.start-2,canvas.width,b.end-b.start+5);
  for(const b of columns) ctx.fillRect(b.start-2,0,b.end-b.start+5,canvas.height);
  return {canvas,table:{rows:rows.map(b=>b.center),columns:columns.map(b=>b.center)}};
}
