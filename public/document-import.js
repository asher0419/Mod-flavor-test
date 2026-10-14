import {extractCAS} from './util.js';
export function parseDocumentText(text){
 const rows=[];let inIngredients=false;
 for(const raw of text.normalize('NFKC').split(/\r?\n/)){
  const line=raw.trim();if(!line||/^(?:FEMA|CAS(?: Number)?|Compositions?\s*\(%\))$/i.test(line))continue;
  if(/^(?:Name|English Name|中文名稱|英文名稱|名稱)\s*(?:\||$)/i.test(line))continue;
  if(/^(?:Ingredient(?: List)?|Flavor substance\s*\(s\)|成分|原料名稱)/i.test(line)){inIngredients=true;continue;}
  if(/^(?:The information|Revised|Created|TEL|FAX|Product (?:Name|Code))/i.test(line)){inIngredients=false;continue;}
  const {valid,invalid}=extractCAS(line);const fema=line.match(/\bFEMA\s*(?:No\.?|Number|#)?\s*[:：-]?\s*(\d{4})(?!\d)/i)?.[1]||'';
  const name=line.replace(/\bFEMA\s*(?:No\.?|Number|#)?\s*[:：-]?\s*\d{4}/ig,'').replace(/\b\d{2,7}\s*-\s*\d{2}\s*-\s*\d\b/g,'').replace(/[()|]/g,' ').replace(/^\s*[-•·\d]+\s*[.)|]?\s*/,'').replace(/\s+[<>≤≥]?\s*\d+(?:\.\d+)?\s*%?\s*$/,'').replace(/\s+/g,' ').trim();
  if(!valid.length&&!invalid.length&&!fema&&(!inIngredients||!name||/^(?:Compositions|百分比|含量)/i.test(name)))continue;
  if(!valid.length&&!fema&&!/[A-Za-z\u3400-\u9fff]/.test(name))continue;
  for(const cas of valid.length?valid:[''])rows.push({name,cas,fema,rawCAS:invalid.join(';'),needsReview:!cas,query:cas||(fema?`${name} (FEMA ${fema})`:name)});
 }
 return rows;
}
export function documentHTMLText(html){
 const plain=value=>value.replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&nbsp;/g,' ').replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n))).replace(/\s+/g,' ').trim();
 return html.replace(/<table\b[^>]*>[\s\S]*?<\/table>/gi,table=>{let femaColumn=-1;return '\n'+[...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(row=>{const cells=[...row[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(m=>plain(m[1]));const col=cells.findIndex(v=>/^FEMA(?:\s*(?:No\.?|Number|編號))?$/i.test(v));if(col>=0){femaColumn=col;return 'Ingredient';}return cells.map((v,i)=>i===femaColumn&&/^\d{4}$/.test(v)?'FEMA '+v:v).join(' | ');}).join('\n')+'\n';}).replace(/<\/(?:p|h[1-6]|li)>|<br\s*\/?>/gi,'\n').split('\n').map(plain).join('\n');
}
async function loadScript(src,global){if(window[global])return window[global];await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=()=>reject(new Error('文件工具載入失敗'));document.head.append(s);});return window[global];}
export async function readDocument(file){
 if(file.size>20*1024*1024)throw new Error('文件上限20MB');
 if(/\.docx$/i.test(file.name)){const m=await loadScript('/vendor/mammoth/mammoth.browser.min.js','mammoth');const result=await m.convertToHtml({arrayBuffer:await file.arrayBuffer()});return documentHTMLText(result.value);}
 if(/\.(xlsx|xls|csv)$/i.test(file.name)){const x=await loadScript('/vendor/sheetjs/xlsx.full.min.js','XLSX');const book=x.read(await file.arrayBuffer(),{type:'array',dense:true});let total=0;return book.SheetNames.map(name=>{const rows=x.utils.sheet_to_json(book.Sheets[name],{header:1,defval:''});total+=rows.length;if(total>5000)throw new Error('每次最多5000列');let femaColumn=-1;return rows.map(row=>{const col=row.findIndex(v=>/^FEMA(?:\s*(?:No\.?|Number|編號))?$/i.test(String(v).trim()));if(col>=0){femaColumn=col;return 'Ingredient';}return row.map((v,i)=>i===femaColumn&&/^\d{4}$/.test(String(v).trim())?'FEMA '+v:v).join(' | ');}).join('\n');}).join('\n');}
 throw new Error('請選擇PDF、DOCX、XLSX、XLS或CSV；舊版DOC請另存DOCX。');
}
