import {inputQueries,extractCAS,csvCell} from './util.js';
import {readCache,writeCache,savedSourceURL} from './cache.js';
import {recognizeTable,summarizeRows} from './ocr-table.js';
import {loadLibrary,saveLibrary,mergeRows,lookupLibrary,learnedRow,libraryCSV,parseCSV,findLibrary,normalizeRow} from './ingredient-library.js';
import {readXLSX} from './xlsx-reader.js';
const browserStorage=(()=>{try{return localStorage;}catch{return null;}})();
const $=id=>document.getElementById(id);const names={banned:'禁用物質',isomer:'有禁用物質的異構物',clear:'沒問題',unresolved:'查詢未完成',notfound:'未取得成分資料'};
let results=[],running=false,cancelled=false,filter=null,pdfBusy=false,pdfRows=[],lastOCRText='',ruleKey='',sourceOriginalQuery='';
let ingredientLibrary=[],bannedRules=[],libraryReady=false,cloudActive=false,cloudHealthy=false,cloudRevision=0,editingCloudCAS=null,editingRevision=null;
const libraryPromise=Promise.all([fetch('/ingredient-seed.json').then(r=>r.json()),fetch('/banned.json').then(r=>r.json())]).then(([seed,banned])=>{bannedRules=banned;ingredientLibrary=loadLibrary(browserStorage,seed);libraryReady=true;renderLibrary();return refreshCloud();}).catch(()=>{$('libraryStatus').textContent='清單載入失敗，請重新整理；目前仍可網路查詢。';});
function renderLibrary(){ $('libraryCount').textContent=`已錄入 ${ingredientLibrary.length} 筆單體 · 禁用清單 ${bannedRules.length} 項`;$('libraryRows').innerHTML=ingredientLibrary.map((r,index)=>`<tr><td>${esc(r.zh)}<small>${esc(r.en)}</small></td><td>${esc(r.cas.join(';'))}</td><td>${esc(r.formula||'缺少分子式')}</td><td>${esc(lookupLibrary([r],r.cas[0]||r.en||r.zh,bannedRules)?.status?names[lookupLibrary([r],r.cas[0]||r.en||r.zh,bannedRules).status]:'待補資料')}</td><td><button class="quiet" data-edit-index="${index}">編輯</button></td></tr>`).join('');}
function persistLibrary(){const saved=saveLibrary(browserStorage,ingredientLibrary,bannedRules);renderLibrary();if(!saved)$('libraryStatus').textContent='瀏覽器未能保存資料，請立即匯出清單備份。';return saved;}
function learnResult(record){if(cloudActive){record.notes=[...(record.notes||[]),record.cloudSaved===false?'共用清單保存失敗，請稍後重試。':'已使用共用清單。'];return;}if(!libraryReady)return;const raw=learnedRow(record);if(!raw)return;const merged=mergeRows(ingredientLibrary,[raw]);if(merged.errors.length){record.notes=[...(record.notes||[]),'未補入清單：'+merged.errors[0].reason];return;}ingredientLibrary=merged.records;record.notes=[...(record.notes||[]),merged.added?'已新增至單體清單。':'已合併至單體清單。'];if(!persistLibrary())record.notes.push('瀏覽器無法保存，請匯出清單備份。');}
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeURL=url=>{try{const u=new URL(url);return u.protocol==='https:'?u.href:null;}catch{return null;}};
fetch('/api/check').then(r=>r.json()).then(s=>{ruleKey=s.ruleKey?(s.ruleKey+':'+s.parserVersion):'';$('connection').textContent=`${s.count} 項禁用清單 · ${s.parserVersion||s.version}${s.searchConfigured?' · Tavily 搜尋已設定':' · 請設定 TAVILY_API_KEY'}`;}).catch(()=>{$('connection').textContent='無法連線到查詢服務';});
$('example').onclick=()=>{$('ingredients').value='香蘭素\n乙酸乙酯\n丁酸\n覆盆子酮\nnot-a-real-ingredient-xyz';};
function render(){
 $('results').hidden=false;for(const status of ['banned','isomer','clear'])$(status+'Count').textContent=results.filter(r=>r.status===status).length;
 const unresolved=results.filter(r=>r.status==='unresolved').length;const missing=results.filter(r=>r.status==='notfound').length;$('unfinished').textContent=[missing?`未取得成分資料 ${missing} 項`:'',unresolved?`查詢未完成 ${unresolved} 項`:''].filter(Boolean).join('；');
 $('rows').innerHTML=results.filter(r=>!filter||r.status===filter).map((r,index)=>`<tr><td>原始輸入：${esc(r.query)}<small>辨認名稱：${esc([r.zh,r.sourceName].filter(Boolean).join('／')||r.inputName||'名稱未取得')}</small></td><td>${esc(r.formula||'—')}<small>${esc(r.formulaEvidence?'來源欄位：'+r.formulaEvidence:'')}</small><small>${esc((r.cas||[]).join('／')||'—')}</small></td><td><span class="badge">${esc(r.kind==='mixture'?'混合物，需成分清單':names[r.status])}</span></td><td>${(r.matches||[]).map(m=>`${esc(m.zh)} · ${esc(m.formula)}<small>${esc(m.cas.join('／'))}</small>`).join('<br>')}<small>${esc(r.reason)}</small><small>${r.fromLibrary?'已使用錄入清單；分類依目前禁用清單重新計算。':r.fromCache?'已使用這個瀏覽器保存的結果':''}</small>${['notfound','unresolved'].includes(r.status)&&r.kind!=='mixture'?`<button class="quiet" data-source="${index}">貼來源網址補查</button>`:''}${(r.candidates||[]).map(c=>`<button class="quiet" data-original="${esc(r.query)}" data-cas="${esc(c.cas)}" data-url="${esc(c.url)}">核對 ${esc(c.name)} · ${esc(c.cas)}</button>`).join('')}${(r.attempts||[]).map(a=>`<small>${esc(a.domain)}：${esc(({found:'已取得',notfound:'無匹配結果',unreadable:'未取得可核對資料',error:'搜尋連線失敗',rejected:'找到候選頁，但未取得可核對成分'})[a.status]||a.status)}</small>${(a.details||[]).map(d=>`<small>${esc(d)}</small>`).join('')}`).join('')}${(r.notes||[]).map(n=>`<small>${esc(n)}</small>`).join('')}</td><td>${(r.sources||[]).map(s=>safeURL(s.url)?`<a href="${esc(safeURL(s.url))}" target="_blank" rel="noopener noreferrer">${esc(s.label)} ↗</a>`:`<small>${esc(s.label)}</small>`).join('')}</td></tr>`).join('');
}
document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.filter;render();});$('all').onclick=()=>{filter=null;render();};
async function runQueries(queries,{retry=false}={}){
 if(running||pdfBusy)return;if(!queries.length){$('progress').textContent=retry?'沒有可重查的未完成項目。':'請先輸入成分。';return;}if(queries.length>200){$('progress').textContent='每批最多 200 項，請分批排查。';return;}
 running=true;cancelled=false;if(!retry)results=[];filter=null;let completed=0,batchError='';$('run').disabled=true;$('stop').disabled=false;document.body.classList.add('busy');await libraryPromise;
 try{await refreshCloud(true);if(!cloudHealthy)throw new Error('無法確認共用清單最新資料');for(let i=0;i<queries.length;i++){
  if(cancelled)break;$('progress').textContent=`查詢 ${i+1}／${queries.length}：${queries[i]}`;
  let record;
  try{record=!$('force').checked&&libraryReady?lookupLibrary(ingredientLibrary,queries[i],bannedRules):null;if(!record&&!cloudActive&&!retry&&!$('force').checked)record=readCache(browserStorage,queries[i],ruleKey);if(!record){const r=await fetch('/api/check',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:queries[i],force:$('force').checked,sourceHint:findLibrary(ingredientLibrary,queries[i])[0]?.urls.find(u=>/thegoodscentscompany\.com|scentsandflavors\.com/.test(u))||savedSourceURL(browserStorage,queries[i])}),signal:AbortSignal.timeout(65000)});if(!r.ok)throw new Error();record=await r.json();writeCache(browserStorage,record,ruleKey);learnResult(record);}record.inputName=pdfRows.find(x=>x.cas===queries[i])?.name||'';}
  catch{record={query:queries[i],status:'unresolved',failureCode:'READ_FAILED',reason:'查詢服務連線失敗或逾時，請重試。'};}
  const previous=results.findIndex(r=>r.query===queries[i]);if(retry&&previous>=0)results[previous]=record;else results.push(record);completed++;render();
 }}catch(e){batchError=e.message;$('libraryStatus').textContent=e.message;$('progress').textContent='共用清單無法讀取，請重新整理或稍後重試。';}finally{running=false;$('run').disabled=false;$('stop').disabled=true;document.body.classList.remove('busy');$('progress').textContent=batchError?'查詢未開始：'+batchError:`${cancelled?'已停止；':'完成；'}已處理 ${completed}／${queries.length} 項`;} 
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
async function processPDF(file){
 if(!file)return;if(!/\.pdf$/i.test(file.name)&&file.type!=='application/pdf'){$('pdfstatus').textContent='請選擇PDF檔案。';return;}if(running){$('pdfstatus').textContent='請等目前排查完成後再匯入 PDF。';return;}
 if(file.size>20*1024*1024){$('pdfstatus').textContent='PDF 上限為 20 MB，請拆分後匯入。';return;}
 pdfBusy=true;$('run').disabled=true;$('pdf').disabled=true;$('extract').disabled=true;let doc=null,task=null,worker=null;
 try{
  $('pdfstatus').textContent=`已選取 ${file.name}，正在載入PDF工具；首次OCR需下載辨識模型，請稍候…`;pdfjs=pdfjs||await import('/vendor/pdfjs/pdf.mjs');pdfjs.GlobalWorkerOptions.workerSrc='/vendor/pdfjs/pdf.worker.mjs';
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

$('pdf').onchange=()=>processPDF($('pdf').files[0]);
$('pdfDrop').ondragover=event=>{event.preventDefault();};
$('pdfDrop').ondrop=event=>{event.preventDefault();processPDF(event.dataTransfer.files[0]);};

$('rows').onclick=event=>{const button=event.target.closest('button');if(!button)return;$('sourcePanel').hidden=false;if(button.dataset.source!==undefined){const r=results[Number(button.dataset.source)];sourceOriginalQuery=r.query;$('sourceQuery').value=r.query;$('sourceURL').value='';}else if(button.dataset.cas){sourceOriginalQuery=button.dataset.original||'';$('sourceQuery').value=button.dataset.cas;$('sourceURL').value=button.dataset.url;} $('sourceStatus').textContent='填入正確來源頁，CAS核對通過才採用。';$('sourcePanel').scrollIntoView({behavior:'smooth'});};
$('checkSource').onclick=async()=>{if(running||pdfBusy)return;const query=$('sourceQuery').value.trim();const sourceURL=$('sourceURL').value.trim();if(!query||!sourceURL){$('sourceStatus').textContent='請填名稱／CAS及來源網址。';return;}$('checkSource').disabled=true;try{const r=await fetch('/api/check',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query,sourceURL}),signal:AbortSignal.timeout(65000)});if(!r.ok)throw new Error();const record=await r.json();const index=results.findIndex(x=>x.query===(sourceOriginalQuery||query));record.query=sourceOriginalQuery||query;if(index>=0)results[index]=record;else results.push(record);writeCache(browserStorage,record,ruleKey);learnResult(record);$('sourceStatus').textContent=record.reason;render();}catch{$('sourceStatus').textContent='補查連線失敗，請重試。';}finally{$('checkSource').disabled=false;}};

let editingCAS=null;
const entryFields={'英文名稱':'entryEN','CAS Number':'entryCAS','簡式':'entryFormula','已確認網址':'entryURL'};
function downloadCSV(text,name){const u=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
$('libraryExport').onclick=async()=>{await libraryPromise;if(!libraryReady)return;downloadCSV(libraryCSV(ingredientLibrary,bannedRules),'單體香料排查清單.csv');};
$('libraryFile').onchange=async()=>{const file=$('libraryFile').files[0];if(!file)return;if(running||pdfBusy){$('libraryStatus').textContent='請等待目前排查或OCR完成後再匯入。';$('libraryFile').value='';return;}$('libraryFile').disabled=true;
 try{await libraryPromise;if(!libraryReady)throw new Error('基礎清單未載入，請重新整理');if(file.size>20*1024*1024)throw new Error('清單上限20MB');const rows=/\.xlsx$/i.test(file.name)?await readXLSX(file):parseCSV(await file.text());if(rows.length>5000)throw new Error('每次最多匯入5000筆');const merged=mergeRows(ingredientLibrary,rows);if(!cloudHealthy)throw new Error('無法確認共用清單，請先更新連線');if(cloudActive){await commitCloud(rows.filter((_,i)=>!merged.errors.some(e=>e.row===i+2)));}else ingredientLibrary=merged.records;const saved=persistLibrary();$('libraryStatus').textContent=`匯入完成：新增${merged.added}筆、合併${merged.merged}筆、待核對${merged.errors.length}筆。${cloudActive?'已同步至共用清單。':saved?'僅保存於本機，尚未同步。':'保存失敗，請立即匯出備份。'}`;$('importErrors').innerHTML=merged.errors.length?'<p>以下資料未錄入；請修正原檔後重新匯入：</p>'+merged.errors.map(e=>`<p>第${e.row}列 ${esc(e.raw['中文名稱']||e.raw['英文名稱']||e.raw['CAS Number']||'')}：${esc(e.reason)}</p>`).join(''):'';
 }catch(e){$('libraryStatus').textContent='匯入失敗：'+e.message;}finally{$('libraryFile').disabled=false;$('libraryFile').value='';}};
$('entryClear').onclick=()=>{editingCAS=null;editingCloudCAS=null;editingRevision=null;Object.values(entryFields).forEach(id=>$(id).value='');$('entrySave').textContent='保存到清單';};
$('libraryRows').onclick=event=>{const button=event.target.closest('[data-edit-index]');if(!button)return;const r=ingredientLibrary[Number(button.dataset.editIndex)];if(!r)return;editingCAS=Number(button.dataset.editIndex);editingCloudCAS=r.cas[0]||null;editingRevision=cloudRevision;const row={...r.raw,'中文名稱':r.zh,'英文名稱':r.en,'CAS Number':r.cas.join(';'),'簡式':r.formula||'','英文別稱':r.aliases.join(';'),'已確認網址':r.urls.join(';')};for(const [h,id] of Object.entries(entryFields))$(id).value=row[h]||'';$('entrySave').textContent='保存此筆修改';$('entryEN').scrollIntoView({behavior:'smooth'});};
$('entrySave').onclick=async()=>{if(running||pdfBusy){$('libraryStatus').textContent='請等待目前工作完成後再修改清單。';return;}await libraryPromise;if(!libraryReady)return;
 try{const raw=Object.fromEntries(Object.entries(entryFields).map(([h,id])=>[h,$(id).value.trim()]));const record=normalizeRow(raw);if(!cloudHealthy)throw new Error('無法確認共用清單，請先更新連線');if(!record.en)throw new Error('請填英文名稱');if(!record.cas.length||!record.formula)throw new Error('請填有效CAS與分子式');
  if(cloudActive){await commitCloud([raw],editingCloudCAS,editingRevision??cloudRevision);}else if(editingCAS!==null){const index=editingCAS;if(index<0)throw new Error('找不到要修改的資料');if(ingredientLibrary.some((r,i)=>i!==index&&r.cas.some(c=>record.cas.includes(c))))throw new Error('CAS已被其他資料使用，請先核對');ingredientLibrary[index]={...record,raw:{...ingredientLibrary[index].raw,...raw}};}
  else{const merged=mergeRows(ingredientLibrary,[raw]);if(merged.errors.length)throw new Error(merged.errors[0].reason);ingredientLibrary=merged.records;}
  const saved=persistLibrary();$('libraryStatus').textContent=cloudActive?'已同步共用清單，分公司下次查詢會取得最新資料。':saved?'僅保存於本機，尚未跨裝置同步。':'未能保存，請立即匯出備份。';$('entryClear').click();
 }catch(e){$('libraryStatus').textContent='未保存：'+e.message;}};

async function refreshCloud(required=false){try{const res=await fetch('/api/library',{cache:'no-store',signal:AbortSignal.timeout(12000)});const state=await res.json();if(!res.ok){if(state.configured===false){cloudActive=false;cloudHealthy=true;$('cloudStatus').textContent='尚未設定共用資料庫：目前僅為本機清單，不會跨裝置同步。';return;}throw new Error(state.error||'共用清單連線失敗');}cloudActive=true;cloudHealthy=true;cloudRevision=state.revision;ingredientLibrary=mergeRows([],state.rows).records;saveLibrary(browserStorage,ingredientLibrary,bannedRules);renderLibrary();$('cloudStatus').textContent=`共用清單已連線 · 版本${cloudRevision} · 更新時間${new Date(state.updatedAt).toLocaleString()}`;}catch(e){cloudHealthy=false;$('cloudStatus').textContent='同步失敗：'+e.message+'。請檢查Vercel環境變數後重新部署。';if(required||cloudActive)throw e;}}
async function commitCloud(rows,replaceCAS=null,revision=cloudRevision){if(!rows.length)return;const token=$('teamKey').value;if(!token)throw new Error('請先輸入清單管理密碼；查詢不需要密碼。');const res=await fetch('/api/library',{method:'POST',headers:{'Content-Type':'application/json','x-library-token':token},body:JSON.stringify({rows,revision,replaceCAS}),signal:AbortSignal.timeout(12000)});const state=await res.json();if(!res.ok)throw new Error(state.error||'共用清單未保存');cloudRevision=state.revision;ingredientLibrary=mergeRows([],state.rows).records;renderLibrary();$('cloudStatus').textContent=`已同步共用清單 · 版本${cloudRevision}`;}
$('cloudReload').onclick=()=>refreshCloud(cloudActive).catch(e=>{$('libraryStatus').textContent=e.message;});
setInterval(()=>{if(libraryReady&&!running&&!pdfBusy&&document.visibilityState==='visible')refreshCloud().catch(()=>{});},30000);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&libraryReady&&!running)refreshCloud().catch(()=>{});});
