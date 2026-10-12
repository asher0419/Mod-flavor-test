import {inputQueries,extractCAS,csvCell} from './util.js';
import {readCache,writeCache,savedSourceURL} from './cache.js';
import {recognizeTable,summarizeRows} from './ocr-table.js';
const browserStorage=(()=>{try{return localStorage;}catch{return null;}})();
const $=id=>document.getElementById(id);const names={banned:'禁用物質',isomer:'有禁用物質的異構物',clear:'沒問題',unresolved:'查詢未完成',notfound:'未取得成分資料'};
let results=[],running=false,cancelled=false,filter=null,pdfBusy=false,pdfRows=[],lastOCRText='',ruleKey='',sourceOriginalQuery='';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeURL=url=>{try{const u=new URL(url);return u.protocol==='https:'?u.href:null;}catch{return null;}};
fetch('/api/check').then(r=>r.json()).then(s=>{ruleKey=s.ruleKey?(s.ruleKey+':'+s.parserVersion):'';$('connection').textContent=`${s.count} 項禁用清單 · ${s.parserVersion||s.version}${s.searchConfigured?' · Tavily 搜尋已設定':' · 請設定 TAVILY_API_KEY'}`;}).catch(()=>{$('connection').textContent='無法連線到查詢服務';});
$('example').onclick=()=>{$('ingredients').value='香蘭素\n乙酸乙酯\n丁酸\n覆盆子酮\nnot-a-real-ingredient-xyz';};
function render(){
 $('results').hidden=false;for(const status of ['banned','isomer','clear'])$(status+'Count').textContent=results.filter(r=>r.status===status).length;
 const unresolved=results.filter(r=>r.status==='unresolved').length;const missing=results.filter(r=>r.status==='notfound').length;$('unfinished').textContent=[missing?`未取得成分資料 ${missing} 項`:'',unresolved?`查詢未完成 ${unresolved} 項`:''].filter(Boolean).join('；');
 $('rows').innerHTML=results.filter(r=>!filter||r.status===filter).map((r,index)=>`<tr><td>原始輸入：${esc(r.query)}<small>辨認名稱：${esc([r.zh,r.sourceName].filter(Boolean).join('／')||r.inputName||'名稱未取得')}</small></td><td>${esc(r.formula||'—')}<small>${esc(r.formulaEvidence?'來源欄位：'+r.formulaEvidence:'')}</small><small>${esc((r.cas||[]).join('／')||'—')}</small></td><td><span class="badge">${esc(r.kind==='mixture'?'混合物，需成分清單':names[r.status])}</span></td><td>${(r.matches||[]).map(m=>`${esc(m.zh)} · ${esc(m.formula)}<small>${esc(m.cas.join('／'))}</small>`).join('<br>')}<small>${esc(r.reason)}</small><small>${r.fromCache?'已使用這個瀏覽器保存的結果':''}</small>${['notfound','unresolved'].includes(r.status)&&r.kind!=='mixture'?`<button class="quiet" data-source="${index}">貼來源網址補查</button>`:''}${(r.candidates||[]).map(c=>`<button class="quiet" data-original="${esc(r.query)}" data-cas="${esc(c.cas)}" data-url="${esc(c.url)}">核對 ${esc(c.name)} · ${esc(c.cas)}</button>`).join('')}${(r.attempts||[]).map(a=>`<small>${esc(a.domain)}：${esc(({found:'已取得',notfound:'無匹配結果',unreadable:'未取得可核對資料',error:'搜尋連線失敗',rejected:'找到候選頁，但未取得可核對成分'})[a.status]||a.status)}</small>${(a.details||[]).map(d=>`<small>${esc(d)}</small>`).join('')}`).join('')}${(r.notes||[]).map(n=>`<small>${esc(n)}</small>`).join('')}</td><td>${(r.sources||[]).map(s=>safeURL(s.url)?`<a href="${esc(safeURL(s.url))}" target="_blank" rel="noopener noreferrer">${esc(s.label)} ↗</a>`:`<small>${esc(s.label)}</small>`).join('')}</td></tr>`).join('');
}
document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.filter;render();});$('all').onclick=()=>{filter=null;render();};
async function runQueries(queries,{retry=false}={}){
 if(running||pdfBusy)return;if(!queries.length){$('progress').textContent=retry?'沒有可重查的未完成項目。':'請先輸入成分。';return;}if(queries.length>200){$('progress').textContent='每批最多 200 項，請分批排查。';return;}
 running=true;cancelled=false;if(!retry)results=[];filter=null;let completed=0;$('run').disabled=true;$('stop').disabled=false;document.body.classList.add('busy');
 try{for(let i=0;i<queries.length;i++){
  if(cancelled)break;$('progress').textContent=`查詢 ${i+1}／${queries.length}：${queries[i]}`;
  let record;
  try{record=!retry&&!$('force').checked?readCache(browserStorage,queries[i],ruleKey):null;if(!record){const r=await fetch('/api/check',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:queries[i],sourceHint:savedSourceURL(browserStorage,queries[i])}),signal:AbortSignal.timeout(65000)});if(!r.ok)throw new Error();record=await r.json();writeCache(browserStorage,record,ruleKey);}record.inputName=pdfRows.find(x=>x.cas===queries[i])?.name||'';}
  catch{record={query:queries[i],status:'unresolved',failureCode:'READ_FAILED',reason:'查詢服務連線失敗或逾時，請重試。'};}
  const previous=results.findIndex(r=>r.query===queries[i]);if(retry&&previous>=0)results[previous]=record;else results.push(record);completed++;render();
 }}finally{running=false;$('run').disabled=false;$('stop').disabled=true;document.body.classList.remove('busy');$('progress').textContent=`${cancelled?'已停止；':'完成；'}已處理 ${completed}／${queries.length} 項`;} 
}
$('run').onclick=()=>runQueries(inputQueries($('ingredients').value));
$('retryFailed').onclick=()=>runQueries(results.filter(r=>['notfound','unresolved'].includes(r.status)&&r.kind!=='mixture').map(r=>r.query),{retry:true});
$('stop').onclick=()=>{cancelled=true;$('progress').textContent='目前這一筆完成後停止。';};
$('export').onclick=()=>{const header=['輸入','辨認名称','CAS','分子式','分類','對應禁用物質','判定原因','來源','查詢時間'];const lines=results.map(r=>[r.query,[r.zh,r.sourceName].filter(Boolean).join(' / ')||r.inputName||'名稱未取得',(r.cas||[]).join(';'),r.formula,names[r.status],(r.matches||[]).map(m=>`${m.zh} (${m.formula})`).join(';'),[r.reason,...(r.notes||[])].join(' '),(r.sources||[]).map(s=>s.url||s.label).join(';'),new Date().toISOString()]);const blob=new Blob(['\uFEFF'+[header,...lines].map(row=>row.map(csvCell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'});const u=URL.createObjectURL(blob);const a=document.createElement('a');a.href=u;a.download='香料排查結果.csv';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);};
async function collectCandidates(){
 const text=$('pdftext').value;const {valid,invalid}=extractCAS(text);let candidates=valid;
 if(pdfRows.length&&text===lastOCRText){
  const summary=summarizeRows(pdfRows);candidates=pdfRows.map(r=>r.cas||r.name).filter(Boolean);
  $('pdfsummary').textContent=`文件列數 ${summary.rows}｜有效 CAS 列 ${summary.validRows}｜不重複 CAS ${summary.unique}｜重複 CAS 列 ${summary.duplicates}｜待核對 ${summary.unresolved}`;
  $('pdfrows').innerHTML=pdfRows.map((r,i)=>`<tr><td>${i+1}</td><td>${esc(r.name)}</td><td>${esc(r.cas||r.rawCAS||'未讀出')}</td><td>${r.needsReview?'需核對':pdfRows.findIndex(x=>x.cas===r.cas)<i?'重複 CAS':'已辨識'}</td></tr>`).join('');
 }else if(!valid.length){const catalog=await (await fetch('/catalog.json')).json();candidates=[...new Set(catalog.filter(r=>r.zh&&text.includes(r.zh)||r.en&&text.toLowerCase().includes(r.en.toLowerCase())).map(r=>r.cas[0]||r.zh||r.en))];}
 const existing=pdfRows.length&&text===lastOCRText?'':$('ingredients').value.trim();$('ingredients').value=[...inputQueries(existing),...candidates].join('\n');
 $('pdfstatus').textContent=`保留 ${candidates.length} 列辨识結果，開始排查時相同 CAS 合併查詢。${invalid.length?'檢查碼不符：'+invalid.join('、')+'。':''}請核對下方逐列清單。`;
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
  const mode=$('pdfmode').value;const pages=[];const warnings=[];pdfRows=[];lastOCRText='';$('pdfsummary').textContent='';$('pdfrows').innerHTML='';
  for(let n=1;n<=doc.numPages;n++){
   $('pdfstatus').textContent=`讀取第 ${n}／${doc.numPages} 頁…`;const page=await doc.getPage(n);const content=mode==='ocr'?null:await page.getTextContent();
   let text=content?content.items.map(x=>x.str+(x.hasEOL?'\n':' ')).join(''):'';
   if(mode==='ocr'||mode==='auto'&&text.replace(/\s/g,'').length<30){
    const t=await loadOCR();worker=worker||await t.createWorker($('language').value,1,{workerPath:'/vendor/tesseract/worker.min.js',logger:m=>{$('pdfstatus').textContent=`OCR 第 ${n}／${doc.numPages} 頁 · ${m.status} ${Math.round((m.progress||0)*100)}%`;}});
    const original=page.getViewport({scale:1});const viewport=page.getViewport({scale:Math.min(4,3600/Math.max(original.width,original.height))});const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);const context=canvas.getContext('2d');
    await page.render({canvasContext:context,viewport,background:'rgb(255,255,255)'}).promise;const table=await recognizeTable(canvas,worker,(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;},(i,total)=>{$('pdfstatus').textContent=`表格 OCR 第 ${n} 頁，第 ${i}／${total} 列…`;});
    if(table&&table.length){pdfRows.push(...table.map(r=>({...r,page:n})));text=table.map((r,i)=>`${i+1} | ${r.name} | ${r.cas||r.rawCAS||'[未讀出 CAS]'}`).join('\n');}
    else{await worker.setParameters({tessedit_pageseg_mode:'6',tessedit_char_whitelist:''});const result=await worker.recognize(canvas);text=result.data.text;if(result.data.confidence<75)warnings.push(`第 ${n} 頁 OCR 信心較低`);}
canvas.width=0;canvas.height=0;
   }
   pages.push(`【第 ${n} 頁】\n${text}`);page.cleanup();
  }
  $('pdftext').value=pages.join('\n\n');lastOCRText=$('pdftext').value;await collectCandidates();if(warnings.length)$('pdfstatus').textContent+=' '+warnings.join('；')+'，請仔細核對。';
 }catch(error){$('pdfstatus').textContent=`PDF 辨識未完成：${error.message||'請確認檔案未加密及網路正常。'}`;}
 finally{try{if(worker)await worker.terminate();if(task)await task.destroy();}finally{pdfBusy=false;$('run').disabled=false;$('pdf').disabled=false;$('extract').disabled=false;$('pdf').value='';}}
};

$('rows').onclick=event=>{const button=event.target.closest('button');if(!button)return;$('sourcePanel').hidden=false;if(button.dataset.source!==undefined){const r=results[Number(button.dataset.source)];sourceOriginalQuery=r.query;$('sourceQuery').value=r.query;$('sourceURL').value='';}else if(button.dataset.cas){sourceOriginalQuery=button.dataset.original||'';$('sourceQuery').value=button.dataset.cas;$('sourceURL').value=button.dataset.url;} $('sourceStatus').textContent='填入正確來源頁，CAS核對通過才採用。';$('sourcePanel').scrollIntoView({behavior:'smooth'});};
$('checkSource').onclick=async()=>{if(running||pdfBusy)return;const query=$('sourceQuery').value.trim();const sourceURL=$('sourceURL').value.trim();if(!query||!sourceURL){$('sourceStatus').textContent='請填名稱／CAS及來源網址。';return;}$('checkSource').disabled=true;try{const r=await fetch('/api/check',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query,sourceURL}),signal:AbortSignal.timeout(65000)});if(!r.ok)throw new Error();const record=await r.json();const index=results.findIndex(x=>x.query===(sourceOriginalQuery||query));record.query=sourceOriginalQuery||query;if(index>=0)results[index]=record;else results.push(record);writeCache(browserStorage,record,ruleKey);$('sourceStatus').textContent=record.reason;render();}catch{$('sourceStatus').textContent='補查連線失敗，請重試。';}finally{$('checkSource').disabled=false;}};
