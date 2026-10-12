import {extractCAS} from './util.js';
function centers(points){const groups=[];for(const p of points){const g=groups.at(-1);if(g&&p-g.at(-1)<=3)g.push(p);else groups.push([p]);}return groups.map(g=>Math.round((g[0]+g.at(-1))/2));}
export function detectTable(image){
 const {width:w,height:h,data:d}=image;const black=(x,y)=>{const i=(y*w+x)*4;return d[i+3]>100&&d[i]<140&&d[i+1]<140&&d[i+2]<140;};const horizontal=[];
 for(let y=0;y<h;y++){let run=0,max=0;for(let x=0;x<w;x++){run=black(x,y)?run+1:0;if(run>max)max=run;}if(max>w*.45)horizontal.push(y);}
 const ys=centers(horizontal);if(ys.length<3)return null;const top=ys[0],bottom=ys.at(-1);const vertical=[];
 for(let x=0;x<w;x++){let count=0;for(let y=top;y<=bottom;y+=2)if(black(x,y))count++;if(count>=(bottom-top)*.39)vertical.push(x);}
 const xs=centers(vertical);if(xs.length!==4)return null;
 return {xs,ys,rows:ys.slice(0,-1).map((y,i)=>({top:y+4,bottom:ys[i+1]-4}))};
}
export async function recognizeTable(canvas,worker,createCanvas,progress=()=>{}){
 const table=detectTable(canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height));if(!table)return null;const rows=[];
 const crop=(left,top,right,bottom)=>{const c=createCanvas(Math.max(1,right-left)+24,Math.max(1,bottom-top)+24);const ctx=c.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(canvas,left,top,right-left,bottom-top,12,12,right-left,bottom-top);return c;};
 for(let i=0;i<table.rows.length;i++){
  progress(i+1,table.rows.length);const r=table.rows[i];if(r.bottom<=r.top)continue;
  await worker.setParameters({tessedit_pageseg_mode:'7',tessedit_char_whitelist:'0123456789-'});
  const c=crop(table.xs[2]+5,r.top,table.xs[3]-5,r.bottom);const cr=await worker.recognize(typeof c.toBuffer==='function'?c.toBuffer('image/png'):c);const raw=cr.data.text.trim();let cas=extractCAS(raw).valid[0]||'';
  await worker.setParameters({tessedit_pageseg_mode:'6',tessedit_char_whitelist:''});
  const n=crop(table.xs[1]+5,r.top,table.xs[2]-5,r.bottom);const nr=await worker.recognize(typeof n.toBuffer==='function'?n.toBuffer('image/png'):n);const name=nr.data.text.trim().replace(/\s*\n\s*/g,' ').replace(/\s+/g,' ');
  if(/^(?:Name|CAS\s*No\.?)$/i.test(name)||!name&&!raw)continue;
  if(!cas){await worker.setParameters({tessedit_pageseg_mode:'6',tessedit_char_whitelist:'0123456789-'});cas=extractCAS((await worker.recognize(typeof c.toBuffer==='function'?c.toBuffer('image/png'):c)).data.text).valid[0]||'';}
  rows.push({name,cas,rawCAS:raw,confidence:cr.data.confidence,needsReview:!cas});
 }
 return rows;
}
export function summarizeRows(rows){const valid=rows.filter(r=>r.cas),unique=[...new Set(valid.map(r=>r.cas))];return {rows:rows.length,validRows:valid.length,unique:unique.length,duplicates:valid.length-unique.length,unresolved:rows.length-valid.length};}
