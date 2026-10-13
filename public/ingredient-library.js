import {nameKey,formulaKey,validCAS,classify} from './chemistry.js';
import {extractCAS,csvCell} from './util.js';
export const headers=['英文名稱','CAS Number','簡式','已確認網址','是否為禁用物質'];
const key='flavor-ingredient-library-v10';
export function normalizeRow(row){
 const raw=Object.fromEntries(Object.entries(row).map(([k,v])=>[k.trim(),String(v??'').trim()]));
 const get=(...keys)=>keys.map(k=>raw[k]).find(Boolean)||'';
 const casText=get('CAS Number','CAS number','CAS','cas');const {valid,invalid}=extractCAS(casText);
 if(invalid.length||(!valid.length&&casText&&!/^[-—–]$/.test(casText)))throw new Error('CAS格式或檢查碼不正確');
 if(!valid.length&&!get('中文名稱','英文名稱'))throw new Error('缺少名稱與CAS');
 const type=get('物質類型','kind');const label=get('是否為禁用物質','是否為禁用物質／異構物');const kind=/聚合物|polymer/i.test(type||label)?'polymer':/混合物|精油|mixture/i.test(type||label)?'mixture':undefined;const massText=get('固定分子量','分子量','Molecular Weight');const molecularWeight=massText&&!/^[-—–]$/.test(massText)?Number(massText):undefined;if(molecularWeight!==undefined&&(!Number.isFinite(molecularWeight)||molecularWeight<=0))throw new Error('分子量須為正數');
 const sourceFormula=get('簡式','化學式','分子式').replace(/^[-—–]$/,'');const formula=formulaKey(sourceFormula);
 if(sourceFormula&&!formula&&kind!=='polymer'&&kind!=='mixture')throw new Error('分子式格式無法核對');
 const urls=get('已確認網址','來源').split(/[;；\s]+/).filter(Boolean);
 for(const url of urls){let u;try{u=new URL(url);}catch{throw new Error('網址格式不正確');}if(u.protocol!=='https:')throw new Error('來源網址須為HTTPS');}
 return {zh:get('中文名稱'),en:get('英文名稱'),cas:valid,formula,aliases:get('英文別稱').split(/[;；\n|]+/).map(s=>s.trim()).filter(Boolean),urls,raw,kind,molecularWeight,massType:kind?'average':'fixed'};
}
export function mergeRows(current,incoming){
 const next=[...current];const errors=[];let added=0,merged=0;
 incoming.forEach((raw,i)=>{try{const r=normalizeRow(raw);const matches=next.map((x,index)=>({x,index})).filter(({x})=>x.cas.some(c=>r.cas.includes(c))||!x.cas.length&&!r.cas.length&&((r.en&&nameKey(r.en)===nameKey(x.en))||(r.zh&&nameKey(r.zh)===nameKey(x.zh))));
  if(matches.length>1)throw new Error('CAS對應多筆既有資料，請先核對');
  if(matches.length){const {x,index}=matches[0];if(x.formula&&r.formula&&formulaKey(x.formula)!==r.formula)throw new Error('同CAS分子式與既有清單衝突，未覆蓋');
   const fields={...x.raw};for(const [k,v] of Object.entries(r.raw))if(v)fields[k]=v;
   next[index]={...x,...r,zh:r.zh||x.zh,en:r.en||x.en,formula:r.formula||x.formula,cas:[...new Set([...x.cas,...r.cas])],aliases:[...new Set([...x.aliases,...r.aliases,...(x.en&&r.en&&x.en!==r.en?[x.en]:[])])],urls:[...new Set([...x.urls,...r.urls])],kind:r.kind||x.kind,molecularWeight:r.molecularWeight??x.molecularWeight,massType:r.kind?'average':x.kind?x.massType:r.massType,raw:fields};merged++;
  }else{next.push(r);added++;}
 }catch(e){errors.push({row:i+2,reason:e.message,raw});}});
 return {records:next,errors,added,merged};
}
export function loadLibrary(storage,seed){let records=mergeRows([],seed).records;try{const saved=JSON.parse(storage?.getItem(key)||'null');if(Array.isArray(saved))records=mergeRows(records,saved).records;}catch{}return records;}
export function exportRows(records,banned){return records.map(r=>({...r.raw,'中文名稱':r.zh,'英文名稱':r.en,'CAS Number':r.cas.join(';'),'簡式':r.formula||((r.kind==='polymer'||r.kind==='mixture')?r.raw['簡式']||'':''),'英文別稱':r.aliases.join(';'),'已確認網址':r.urls.join(';'),'物質類型':r.kind==='polymer'?'聚合物':r.kind==='mixture'?'混合物':'單一物質','分子量':r.molecularWeight||'','是否為禁用物質':({banned:'禁用物質',isomer:'有禁用物質的異構物',mixture:'混合物',clear:'沒問題',unresolved:'查詢未完成'})[classify({...r,identity:'local'},banned).status]}));}
export function saveLibrary(storage,records,banned){try{if(!storage)throw new Error();storage.setItem(key,JSON.stringify(exportRows(records,banned)));return true;}catch{return false;}}
export function findLibrary(records,query){const q=nameKey(query);return records.filter(r=>r.cas.includes(query.trim())||[r.zh,r.en,...r.aliases].some(s=>s&&nameKey(s)===q));}
export function lookupLibrary(records,query,banned){const matches=findLibrary(records,query);if(!matches.length)return null;
 if(matches.length>1)return {query,status:'unresolved',reason:'清單內同名稱對應多筆資料，請改用CAS。',cas:[],sources:[]};
 const r=matches[0];if(!['polymer','mixture'].includes(r.kind)&&!(r.massType==='fixed'&&r.molecularWeight>=250)&&!r.formula&&!banned.some(b=>b.cas.some(c=>r.cas.includes(c))))return null;
 return {query,...r,sourceName:r.en,identity:'local',fromLibrary:true,sources:[{label:'已錄入清單',url:null},...r.urls.map(url=>({label:'清單來源',url}))],...classify({...r,identity:'local'},banned)};
}
export function learnedRow(record){if(!['banned','isomer','clear','mixture'].includes(record.status)||(!record.formula&&!['polymer','mixture'].includes(record.kind))||!record.cas?.every(validCAS)||!record.cas.length)return null;return {'中文名稱':record.zh||'','英文名稱':record.sourceName||record.en||'','CAS Number':record.cas.join(';'),'簡式':record.formula||'','物質類型':record.kind==='polymer'?'聚合物':record.kind==='mixture'?'混合物':'單一物質','英文別稱':validCAS(record.query||'')?'':record.query,'已確認網址':(record.sources||[]).map(s=>s.url).filter(Boolean).join(';')};}
export function parseCSV(text){const rows=[];let row=[],cell='',quoted=false;for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){row.push(cell);cell='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(Boolean))rows.push(row);row=[];cell='';}else cell+=c;}if(quoted)throw new Error('CSV引號未閉合');row.push(cell);if(row.some(Boolean))rows.push(row);const header=(rows.shift()||[]).map(s=>s.replace(/^\uFEFF/,'').trim());return rows.map(values=>Object.fromEntries(header.map((h,i)=>[h,(values[i]||'').replace(/^'(?=[=+@\-\t\r])/,'')])));}
export function libraryCSV(records,banned){const rows=exportRows(records,banned);const columns=records.some(r=>r.kind||r.molecularWeight)?[...headers,'物質類型','分子量']:headers;return '\uFEFF'+[columns,...rows.map(r=>columns.map(h=>r[h]||''))].map(r=>r.map(csvCell).join(',')).join('\r\n');}
