import {localRecord,formulaKey,validCAS} from './core.js';
const allowed=new Set(['www.thegoodscentscompany.com','thegoodscentscompany.com','scentsandflavors.com','www.scentsandflavors.com']);
const verifiedURLs={'106-22-9':'https://www.thegoodscentscompany.com/data/rw1007031.html','123-86-4':'https://www.thegoodscentscompany.com/data/rw1019351.html','504-96-1':'https://www.thegoodscentscompany.com/data/rw1440061.html','67662-96-8':'https://www.thegoodscentscompany.com/data/rw1018371.html','5595-79-9':'https://www.thegoodscentscompany.com/data/rw1009761.html'};
export function extractFormula(section){
 const cleaned=section.replace(/[₀-₉]/g,c=>String('₀₁₂₃₄₅₆₇₈₉'.indexOf(c))).replace(/^[\s:|*]+/,'');
 const tokens=cleaned.split(/[\s|]+/);const parts=[];
 for(const token of tokens){
  if(!token||!formulaKey(token))break;
  // Stop at adjacent labels even when they resemble valid element symbols.
  if(parts.length&&/^(In|As|At|No)$/i.test(token))break;
  parts.push(token);if(parts.length===1&&/[A-Z].*[A-Z]/.test(token))break;
 }
 const formula=formulaKey(parts.join(''));
 return formula&&/^C(?:\d|H|N|O|S|F|Cl|Br|I)/.test(formula)?formula:null;
}
export async function request(url,options={}){
 const response=await fetch(url,{...options,signal:AbortSignal.timeout(6000)});
 if(!response.ok)throw new Error(`來源回應 ${response.status}`);return response;
}
export function parsePage(html,expectedCAS,expectedName=''){
 const text=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/&amp;/g,'&').replace(/\*\*/g,'').replace(/\s+/g,' ');
 const casLabels=[...text.matchAll(/CAS\s*(?:Number|Num|No\.?|#)?\s*:?\s*(\d{2,7}-\d{2}-\d)/gi)];
 const selected=expectedCAS?casLabels.find(m=>m[1]===expectedCAS):casLabels[0];
 const labelCAS=selected?.[1];
 if(!labelCAS||!validCAS(labelCAS))return null;
 if(expectedCAS&&labelCAS!==expectedCAS)return null;
 if(!expectedCAS){
  const escaped=expectedName.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const identity=new RegExp(`(?:^|\\s)(?:Name|Chemical Name|Product Name)\\s*:?\\s*${escaped}(?=\\s+(?:CAS|Chemical|Formula|Molecular|Synonym|IUPAC)|$)`,'i');
  if(!expectedName||!identity.test(text))return null;
 }
 const afterCAS=text.slice(selected.index+selected[0].length).split(/CAS\s*(?:Number|Num|No\.?|#)?\s*:/i)[0];
 const label=afterCAS.match(/(?:Molecular\s+Formula|MOL\s+FOR|Formula)\s*:?\s*/i);
 const formula=label?extractFormula(afterCAS.slice(label.index+label[0].length)):null;if(!formula)return null;
 return {formula,cas:[labelCAS]};
}
async function getSourcePage(url){
 const u=new URL(url);if(u.protocol!=='https:'||!allowed.has(u.hostname))throw new Error('來源網址不受支援');
 const r=await request(u.href,{redirect:'manual',headers:{'User-Agent':'FlavorScreen/2.0'}});
 const reader=r.body.getReader();let size=0;const chunks=[];
 while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>2000000){await reader.cancel();throw new Error('來源頁面過大');}chunks.push(value);}
 return Buffer.concat(chunks).toString('utf8');
}
export async function searchSources(query,{expectedCAS=null,expectedName='',apiKey=process.env.TAVILY_API_KEY,fetchPage=getSourcePage}={}){
 if(!apiKey)throw new Error('請先在 Vercel 設定 TAVILY_API_KEY，再重新部署。');
 const attempts=[];
 for(const domain of ['thegoodscentscompany.com','scentsandflavors.com']){
  const attempt={domain,status:'notfound'};attempts.push(attempt);
  try{
   if(domain==='thegoodscentscompany.com'&&verifiedURLs[expectedCAS]){
    const url=verifiedURLs[expectedCAS];let record=null;
    try{record=parsePage(await fetchPage(url),expectedCAS,expectedName);}catch{}
    if(!record){try{const er=await request('https://api.tavily.com/extract',{method:'POST',headers:{'Authorization':`Bearer ${apiKey}`,'Content-Type':'application/json'},body:JSON.stringify({urls:[url],extract_depth:'basic',format:'text'})});const ej=await er.json();record=parsePage(ej.results?.[0]?.raw_content||'',expectedCAS,expectedName);}catch{}}
    if(record){attempt.status='found';return {...record,sources:[{label:domain,url}],attempts};}
   }
   const r=await request('https://api.tavily.com/search',{method:'POST',headers:{'Authorization':`Bearer ${apiKey}`,'Content-Type':'application/json'},body:JSON.stringify({query:`"${query}"`,include_domains:[domain],search_depth:'basic',auto_parameters:false,max_results:5,include_answer:false,include_raw_content:'text'})});
   const json=await r.json();
   let pageFetches=0;
   for(const hit of (json.results||[]).sort((a,b)=>Number(/\/data\//.test(b.url))-Number(/\/data\//.test(a.url))).slice(0,5)){
    try{
     const u=new URL(hit.url);if(u.protocol!=='https:'||!(u.hostname===domain||u.hostname===`www.${domain}`))continue;
     // Only full source content or a fetched document is chemical evidence; never search snippets or generated answers.
     let record=hit.raw_content?parsePage(hit.raw_content,expectedCAS,expectedName):null;
     if(!record&&pageFetches<2){pageFetches++;record=parsePage(await fetchPage(hit.url),expectedCAS,expectedName);}
     if(record){attempt.status='found';return {...record,sources:[{label:domain,url:hit.url}],attempts};}
    }catch{attempt.status='unreadable';}
   }
  }catch(error){
   if(/401|403/.test(error.message))throw new Error('Tavily 金鑰無效或無存取權限，請核對 TAVILY_API_KEY。');
   if(/429|432|433/.test(error.message))throw new Error('Tavily 額度或請求限制已達上限，請稍後重試或核對帳戶。');
   attempt.status='error';
  }
 }
 return {notFound:true,attempts};
}
export async function lookup(query){
 const local=localRecord(query);
 if(/^\d[\d\s-]+$/.test(query)&&!validCAS(query)&&!local)throw new Error('CAS 格式或檢查碼不正確，請核對 OCR 或輸入。');
 // Excel translates known names to CAS. Formulas always come from the user's two sources.
 const expectedCAS=validCAS(query)?query:(local?.cas[0]||null);
 const expectedName=local?.en||query;
 const result=await searchSources(expectedCAS||expectedName,{expectedCAS,expectedName});
 if(result.notFound){const error=new Error('查無該成分');error.code='NOT_FOUND';error.attempts=result.attempts;throw error;}
 return {...result,zh:local?.zh||'',en:local?.en||query,identity:'online',notes:result.attempts.filter(a=>a.status!=='found').map(a=>`${a.domain} 未取得可核對的成分資料，已改查下一來源。`)};
}
