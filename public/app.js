import {inputQueries,extractCAS,csvCell} from './util.js';
const $=id=>document.getElementById(id);const names={banned:'禁用物質',isomer:'有禁用物質的異構物',clear:'沒問題',unresolved:'查詢未完成',notfound:'查無該成分'};
let results=[],running=false,cancelled=false,filter=null,pdfBusy=false;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeURL=url=>{try{const u=new URL(url);return u.protocol==='https:'?u.href:null;}catch{return null;}};
fetch('/api/check').then(r=>r.json()).then(s=>{$('connection').textContent=`${s.count} 項禁用清單 · ${s.parserVersion||s.version}${s.searchConfigured?' · Tavily 搜尋已設定':' · 請設定 TAVILY_API_KEY'}`;}).catch(()=>{$('connection').textContent='無法連線到查詢服務';});
$('example').onclick=()=>{$('ingredients').value='香蘭素\n乙酸乙酯\n丁酸\n覆盆子酮\nnot-a-real-ingredient-xyz';};
function render(){
 $('results').hidden=false;for(const status of ['banned','isomer','clear'])$(status+'Count').textContent=results.filter(r=>r.status===status).length;
 const unresolved=results.filter(r=>r.status==='unresolved').length;const missing=results.filter(r=>r.status==='notfound').length;$('unfinished').textContent=[missing?`查無該成分 ${missing} 項`:'',unresolved?`查詢未完成 ${unresolved} 項`:''].filter(Boolean).join('；');
 $('rows').innerHTML=results.filter(r=>!filter||r.status===filter).map(r=>`<tr><td>${esc(r.query)}<small>${esc(r.zh||r.en||'')}</small></td><td>${esc(r.formula||'—')}<small>${esc(r.formulaEvidence?'來源欄位：'+r.formulaEvidence:'')}</small><small>${esc((r.cas||[]).join('／')||'—')}</small></td><td><span class="badge">${esc(names[r.status])}</span></td><td>${(r.matches||[]).map(m=>`${esc(m.zh)} · ${esc(m.formula)}<small>${esc(m.cas.join('／'))}</small>`).join('<br>')}<small>${esc(r.reason)}</small>${(r.attempts||[]).map(a=>`<small>${esc(a.domain)}：${esc(({found:'已取得',notfound:'無匹配結果',unreadable:'未取得可核對資料',error:'搜尋連線失敗'})[a.status]||a.status)}</small>`).join('')}${(r.notes||[]).map(n=>`<small>${esc(n)}</small>`).join('')}</td><td>${(r.sources||[]).map(s=>safeURL(s.url)?`<a href="${esc(safeURL(s.url))}" target="_blank" rel="noopener noreferrer">${esc(s.label)} ↗</a>`:`<small>${esc(s.label)}</small>`).join('')}</td></tr>`).join('');
}
document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.filter;render();});$('all').onclick=()=>{filter=null;render();};
$('run').onclick=async()=>{
 if(running||pdfBusy)return;const queries=inputQueries($('ingredients').value);if(!queries.length){$('progress').textContent='請先輸入成分。';return;}if(queries.length>200){$('progress').textContent='每批最多 200 項，請分批排查。';return;}
 running=true;cancelled=false;results=[];filter=null;$('run').disabled=true;$('stop').disabled=false;document.body.classList.add('busy');
 try{for(let i=0;i<queries.length;i++){
  if(cancelled)break;$('progress').textContent=`查詢 ${i+1}／${queries.length}：${queries[i]}`;
  try{const r=await fetch('/api/check',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:queries[i]}),signal:AbortSignal.timeout(65000)});if(!r.ok)throw new Error();results.push(await r.json());}
  catch{results.push({query:queries[i],status:'unresolved',reason:'查詢服務連線失敗或逾時，請重試。'});}render();
 }}finally{running=false;$('run').disabled=false;$('stop').disabled=true;document.body.classList.remove('busy');$('progress').textContent=`${cancelled?'已停止；':'完成；'}已處理 ${results.length}／${queries.length} 項`;} 
};$('stop').onclick=()=>{cancelled=true;$('progress').textContent='目前這一筆完成後停止。';};
$('export').onclick=()=>{const header=['輸入','辨認名称','CAS','分子式','分類','對應禁用物質','判定原因','來源','查詢時間'];const lines=results.map(r=>[r.query,r.zh||r.en,(r.cas||[]).join(';'),r.formula,names[r.status],(r.matches||[]).map(m=>`${m.zh} (${m.formula})`).join(';'),[r.reason,...(r.notes||[])].join(' '),(r.sources||[]).map(s=>s.url||s.label).join(';'),new Date().toISOString()]);const blob=new Blob(['\uFEFF'+[header,...lines].map(row=>row.map(csvCell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'});const u=URL.createObjectURL(blob);const a=document.createElement('a');a.href=u;a.download='香料排查結果.csv';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);};
async function collectCandidates(){
 const text=$('pdftext').value;const {valid,invalid}=extractCAS(text);let candidates=valid;
 if(!valid.length){const catalog=await (await fetch('/catalog.json')).json();candidates=[...new Set(catalog.filter(r=>r.zh&&text.includes(r.zh)||r.en&&text.toLowerCase().includes(r.en.toLowerCase())).map(r=>r.cas[0]||r.zh||r.en))];}
 const existing=$('ingredients').value.trim();$('ingredients').value=[...new Set([...inputQueries(existing),...candidates])].join('\n');
 $('pdfstatus').textContent=`整理出 ${candidates.length} 個候選成分。${invalid.length?'檢查碼不符的 CAS：'+invalid.join('、')+'。':''}請核對原文；無 CAS 且未在內建名稱表的成分，需手動補入。`;
}
$('extract').onclick=()=>collectCandidates().catch(()=>{$('pdfstatus').textContent='無法整理，請手動複製名稱或 CAS。';});
let pdfjs=null;
async function loadOCR(){if(window.Tesseract)return window.Tesseract;await new Promise((ok,no)=>{const s=document.createElement('script');s.src='/vendor/tesseract/tesseract.min.js';s.onload=ok;s.onerror=no;document.head.append(s);});return window.Tesseract;}
$('pdf').onchange=async()=>{
 const file=$('pdf').files[0];if(!file)return;if(running){$('pdfstatus').textContent='請等目前排查完成後再匯入 PDF。';return;}
 if(file.size>20*1024*1024){$('pdfstatus').textContent='PDF 上限為 20 MB，請拆分後匯入。';return;}
 pdfBusy=true;$('run').disabled=true;$('pdf').disabled=true;$('extract').disabled=true;let doc=null,task=null,worker=null;
 try{
  $('pdfstatus').textContent='正在讀取 PDF…';pdfjs=pdfjs||await import('/vendor/pdfjs/pdf.mjs');pdfjs.GlobalWorkerOptions.workerSrc='/vendor/pdfjs/pdf.worker.mjs';
  task=pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),cMapUrl:'/vendor/cmaps/',cMapPacked:true,standardFontDataUrl:'/vendor/standard_fonts/',wasmUrl:'/vendor/wasm/'});doc=await task.promise;
  if(doc.numPages>30)throw new Error('PDF 超過 30 頁，請拆分後匯入。');
  const mode=$('pdfmode').value;const pages=[];const warnings=[];
  for(let n=1;n<=doc.numPages;n++){
   $('pdfstatus').textContent=`讀取第 ${n}／${doc.numPages} 頁…`;const page=await doc.getPage(n);const content=await page.getTextContent();
   let text=content.items.map(x=>x.str+(x.hasEOL?'\n':' ')).join('');
   if(mode==='ocr'||mode==='auto'&&text.replace(/\s/g,'').length<30){
    const t=await loadOCR();worker=worker||await t.createWorker($('language').value,1,{workerPath:'/vendor/tesseract/worker.min.js',logger:m=>{$('pdfstatus').textContent=`OCR 第 ${n}／${doc.numPages} 頁 · ${m.status} ${Math.round((m.progress||0)*100)}%`;}});
    const original=page.getViewport({scale:1});const viewport=page.getViewport({scale:Math.min(2.5,2600/Math.max(original.width,original.height))});const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);const context=canvas.getContext('2d');
    await page.render({canvasContext:context,viewport,background:'rgb(255,255,255)'}).promise;const result=await worker.recognize(canvas);text=result.data.text;
    if(result.data.confidence<75)warnings.push(`第 ${n} 頁 OCR 信心較低`);canvas.width=0;canvas.height=0;
   }
   pages.push(`【第 ${n} 頁】\n${text}`);page.cleanup();
  }
  $('pdftext').value=pages.join('\n\n');await collectCandidates();if(warnings.length)$('pdfstatus').textContent+=' '+warnings.join('；')+'，請仔細核對。';
 }catch(error){$('pdfstatus').textContent=`PDF 辨識未完成：${error.message||'請確認檔案未加密及網路正常。'}`;}
 finally{try{if(worker)await worker.terminate();if(task)await task.destroy();}finally{pdfBusy=false;$('run').disabled=false;$('pdf').disabled=false;$('extract').disabled=false;$('pdf').value='';}}
};
