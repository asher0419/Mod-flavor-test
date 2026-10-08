import {localRecord,formulaKey,validCAS} from './core.js';
const allowed=new Set(['www.thegoodscentscompany.com','thegoodscentscompany.com','scentsandflavors.com','www.scentsandflavors.com']);
export async function request(url,options={}){
 const response=await fetch(url,{...options,signal:AbortSignal.timeout(8000)});
 if(!response.ok)throw new Error(`來源回應 ${response.status}`);return response;
}
export function parsePage(html,expectedCAS,expectedName=''){
 const text=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/&amp;/g,'&').replace(/\*\*/g,'').replace(/\s+/g,' ');
 const labelCAS=text.match(/CAS\s*(?:Number|No\.?|#)?\s*:?\s*(\d{2,7}-\d{2}-\d)/i)?.[1];
 if(!labelCAS||!validCAS(labelCAS))return null;
 if(expectedCAS&&labelCAS!==expectedCAS)return null;
 if(!expectedCAS){
  const escaped=expectedName.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const identity=new RegExp(`(?:^|\\s)(?:Name|Chemical Name|Product Name)\\s*:?\\s*${escaped}(?=\\s+(?:CAS|Chemical|Formula|Molecular|Synonym|IUPAC)|$)`,'i');
  if(!expectedName||!identity.test(text))return null;
 }
 const label=text.match(/(?:Molecular\s+Formula|Formula)\s*:?\s*/i);
 const part=label?text.slice(label.index+label[0].length).match(/^((?:[A-Z][a-z]?(?![a-z])\s*[₀-₉\d]*\s*)+)/)?.[1]?.trim():null;
 const formula=formulaKey(part);if(!formula)return null;
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
   const r=await request('https://api.tavily.com/search',{method:'POST',headers:{'Authorization':`Bearer ${apiKey}`,'Content-Type':'application/json'},body:JSON.stringify({query:`"${query}" CAS molecular formula`,include_domains:[domain],search_depth:'basic',auto_parameters:false,max_results:2,include_answer:false,include_raw_content:'text'})});
   const json=await r.json();
   for(const hit of (json.results||[]).slice(0,2)){
    try{
     const u=new URL(hit.url);if(u.protocol!=='https:'||!(u.hostname===domain||u.hostname===`www.${domain}`))continue;
     // Only full source content or a fetched document is chemical evidence; never search snippets or generated answers.
     let record=hit.raw_content?parsePage(hit.raw_content,expectedCAS,expectedName):null;
     if(!record)record=parsePage(await fetchPage(hit.url),expectedCAS,expectedName);
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
