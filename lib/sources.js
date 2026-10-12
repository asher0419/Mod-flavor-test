import {localRecord,formulaKey,validCAS} from './core.js';
import {allowedSourceURL,ingredientURL,discoverLinks,failureCode} from './discovery.js';
const allowed=new Set(['www.thegoodscentscompany.com','thegoodscentscompany.com','scentsandflavors.com','www.scentsandflavors.com']);
const verifiedURLs={'78-69-3':'https://www.thegoodscentscompany.com/data/rw1011312.html','102-20-5':'https://www.thegoodscentscompany.com/data/rw1010111.html','63500-71-0':'https://www.thegoodscentscompany.com/data/rw1045182.html','10339-55-6':'https://www.thegoodscentscompany.com/data/rw1015171.html','1365-19-1':'https://www.thegoodscentscompany.com/data/rw1014332.html','7212-44-4':'https://www.thegoodscentscompany.com/data/rw1009032.html','106-25-2':'https://www.thegoodscentscompany.com/data/rw1008952.html','106-24-1':'https://www.thegoodscentscompany.com/data/rw1006992.html','4602-84-0':'https://www.thegoodscentscompany.com/data/rw1005092.html','18479-58-8':'https://www.thegoodscentscompany.com/data/rw1006052.html','7452-79-1':'https://www.thegoodscentscompany.com/data/rw1004871.html','14901-07-6':'https://www.thegoodscentscompany.com/data/rw1006632.html','78-70-6':'https://www.thegoodscentscompany.com/data/rw1007872.html','68845-36-3':'https://www.thegoodscentscompany.com/data/rw1043231.html','928-96-1':'https://www.thegoodscentscompany.com/data/rw1005932.html','1125-21-9':'https://www.thegoodscentscompany.com/data/rw1029401.html','106-27-4':'https://www.thegoodscentscompany.com/data/rw1006752.html','507-70-0':'https://www.thegoodscentscompany.com/data/rw1039711.html','464-43-7':'https://www.thegoodscentscompany.com/data/rw1106071.html','464-45-9':'https://www.thegoodscentscompany.com/data/rw1011571.html','124-76-5':'https://www.thegoodscentscompany.com/data/rw1002091.html','106-22-9':'https://www.thegoodscentscompany.com/data/rw1007031.html','123-86-4':'https://www.thegoodscentscompany.com/data/rw1019351.html','504-96-1':'https://www.thegoodscentscompany.com/data/rw1440061.html','67662-96-8':'https://www.thegoodscentscompany.com/data/rw1018371.html','5595-79-9':'https://www.thegoodscentscompany.com/data/rw1009761.html'};
export function normalizedCAS(value){return String(value).replace(/^0+(?=\d)/,'');}
const mixtureNames={'8008-57-9':'Orange sweet oil','8016-03-3':'Davana oil'};
export function extractFormula(section){
 const cleaned=section.replace(/[₀-₉]/g,c=>String('₀₁₂₃₄₅₆₇₈₉'.indexOf(c))).replace(/^[\s:|*]+/,'');
 // Accept an entire bounded field, never concatenate a prefix with neighboring words.
 const field=cleaned.split(/[\r\n|]/)[0].split(/\b(?:BioActivity|NMR|EFSA|JECFA|Chemical\s+Information|Molecular\s+Weight|MOL\s+WT|Category|Name\s*:|CAS\s+Number|Ch\s+In)\b/i)[0].trim();
 if(!field||!/^(?:[A-Z][a-z]?\d*\s*)+$/.test(field))return null;
 const formula=formulaKey(field);if(!formula||!/^C(?:\d|H|N|O|S|F|Cl|Br|I)/.test(formula))return null;
 // Organic fragrance formula fields may not contain label-derived metals or arbitrary letters.
 if([...field.replace(/\s/g,'').matchAll(/([A-Z][a-z]?)/g)].some(m=>!['C','H','O','N','S','P','F','Cl','Br','I','Si','B'].includes(m[1])))return null;
 return formula;
}
export async function request(url,options={}){
 const response=await fetch(url,{...options,signal:AbortSignal.timeout(6000)});
 if(!response.ok)throw new Error(`來源回應 ${response.status}`);return response;
}
export function parsePage(html,expectedCAS,expectedName=''){
 const text=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<\/(?:tr|p|div|li|h[1-6])\s*>|<br\s*\/?\s*>/gi,'\n').replace(/<\/(?:td|th)\s*>/gi,' | ').replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/&amp;/g,'&').replace(/\*\*/g,'').replace(/\[([^\]]+)\]\([^)]*\)/g,'$1').replace(/[ \t]+/g,' ');
 const casLabels=[...text.matchAll(/CAS\s*(?:Number|Num|No\.?|#)?[\s:|]*(\d{2,7}-\d{2}-\d)/gi)];
 const selected=expectedCAS?casLabels.find(m=>normalizedCAS(m[1])===normalizedCAS(expectedCAS)):casLabels[0];
 const labelCAS=selected?normalizedCAS(selected[1]):null;
 if(!labelCAS||!validCAS(labelCAS))return null;
 if(expectedCAS&&labelCAS!==expectedCAS)return null;
 if(!expectedCAS){
  const escaped=expectedName.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const identity=new RegExp(`(?:^|\\s)(?:Name|Chemical Name|Product Name)\\s*:?\\s*${escaped}(?=\\s+(?:CAS|Chemical|Formula|Molecular|Synonym|IUPAC)|$)`,'i');
  if(!expectedName||!identity.test(text))return null;
 }
 const afterCAS=text.slice(selected.index+selected[0].length).split(/CAS\s*(?:Number|Num|No\.?|#)?\s*:/i)[0];
 const label=afterCAS.match(/(?:Molecular\s+Formula|MOL\s+FOR|Formula)\s*:?\s*/i);
 const originalField=label?afterCAS.slice(label.index+label[0].length):'';
 const formula=label?extractFormula(originalField):null;if(!formula)return null;
 const prefix=text.slice(0,selected.index);const nameLabels=[...prefix.matchAll(/(?:^|[\s|])(?:Name|Chemical Name|Product Name)\s*[:|]\s*/gi)];const lastName=nameLabels.at(-1);const sourceName=lastName?prefix.slice(lastName.index+lastName[0].length).split(/(?:Std\.)?InChI(?:Key)?\s*:|SMILES\s*:|Molecular\s+Weight\s*:/i)[0].replace(/[|\r\n]+/g,' ').trim():'';
 return {formula,cas:[labelCAS],sourceName,formulaEvidence:originalField.trim().split(/[\r\n|]/)[0].slice(0,160)};
}
async function getSourcePage(url){
 const u=new URL(url);if(u.protocol!=='https:'||!allowed.has(u.hostname))throw new Error('來源網址不受支援');
 const r=await request(u.href,{redirect:'manual',headers:{'User-Agent':'FlavorScreen/2.0'}});
 const reader=r.body.getReader();let size=0;const chunks=[];
 while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>2000000){await reader.cancel();throw new Error('來源頁面過大');}chunks.push(value);}
 return Buffer.concat(chunks).toString('utf8');
}
export async function searchSources(query,{expectedCAS=null,expectedName='',apiKey=process.env.TAVILY_API_KEY,fetchPage=getSourcePage,useKnownURLs=true,sourceURL=null,sourceHint=null}={}){
 if(sourceURL&&!allowedSourceURL(sourceURL)){const e=new Error('來源網址只允許 TGSC 與 Scents and Flavors 的 HTTPS 頁面。');e.code='INVALID_SOURCE';throw e;}
 if(!apiKey&&!sourceURL)throw new Error('請先在 Vercel 設定 TAVILY_API_KEY，再重新部署。');
 const attempts=[];const candidates=[];const deadline=Date.now()+45000;let loads=0;
 const load=async(url,raw)=>{
  if(raw)return raw;
  if(++loads>6||Date.now()>deadline)throw new Error('本次來源讀取已達上限，請重試或指定來源網址。');
  try{return await fetchPage(url);}catch(error){
   if(!apiKey)throw error;
   const er=await request('https://api.tavily.com/extract',{method:'POST',headers:{'Authorization':`Bearer ${apiKey}`,'Content-Type':'application/json'},body:JSON.stringify({urls:[url],extract_depth:'basic',format:'markdown'})});
   const text=(await er.json()).results?.[0]?.raw_content;if(!text)throw new Error('來源讀取失敗，Extract 未回傳全文');return text;
  }
 };
 const inspect=async(url,raw,attempt,depth=0)=>{
  if(!allowedSourceURL(url)||Date.now()>deadline)return null;
  try{
   const content=await load(url,raw);
   if(ingredientURL(url)){
    const record=parsePage(content,expectedCAS,expectedName);
    if(record){attempt.details.push(url+'：CAS與分子式核對成功');return {...record,sources:[{label:attempt.domain,url}],attempts};}
    if(!expectedCAS){
     const cas=normalizedCAS(content.match(/CAS\s*(?:Number|Num|No\.?|#)?[\s:|]*(\d{2,7}-\d{2}-\d)/i)?.[1]||'');
     const option=validCAS(cas)?parsePage(content,cas):null;
     if(option)candidates.push({cas,name:option.sourceName||cas,url});
    }
    attempt.status='rejected';attempt.details.push(url+'：已取得全文，但身分或分子式未通過核對');
   }
   if(depth<1){
    const next=discoverLinks(content,url,expectedCAS);attempt.details.push(url+`：找到 ${next.length} 個符合CAS的成分連結`);
    for(const link of next){const record=await inspect(link,null,attempt,depth+1);if(record)return record;}
   }
  }catch(e){attempt.status='unreadable';attempt.details.push(url+'：'+e.message);}
  return null;
 };
 if(sourceURL){
  const attempt={domain:new URL(sourceURL).hostname,status:'rejected',details:[]};attempts.push(attempt);
  const r=await inspect(sourceURL,null,attempt);if(r){attempt.status='found';return r;}
  return {notFound:true,attempts,failureCode:expectedCAS?'PARSE_FAILED':'AMBIGUOUS',candidates};
 }
 if(sourceHint&&allowedSourceURL(sourceHint)){
  const attempt={domain:new URL(sourceHint).hostname,status:'rejected',details:['重讀之前核對成功的來源頁']};attempts.push(attempt);
  const r=await inspect(sourceHint,null,attempt);if(r){attempt.status='found';return r;}
 }
 for(const domain of ['thegoodscentscompany.com','scentsandflavors.com']){
  const attempt={domain,status:'notfound',details:[]};attempts.push(attempt);
  if(domain==='thegoodscentscompany.com'&&useKnownURLs&&verifiedURLs[expectedCAS]){const r=await inspect(verifiedURLs[expectedCAS],null,attempt);if(r){attempt.status='found';return r;}}
  const searches=[query,...(expectedCAS&&expectedName&&expectedName!==query?[expectedName]:[])];
  for(const term of searches){
   if(Date.now()>deadline)break;
   try{
    const r=await request('https://api.tavily.com/search',{method:'POST',headers:{'Authorization':`Bearer ${apiKey}`,'Content-Type':'application/json'},body:JSON.stringify({query:`"${term}"`,include_domains:[domain],search_depth:'basic',auto_parameters:false,max_results:5,include_answer:false,include_raw_content:'markdown'})});
    const hits=(await r.json()).results||[];attempt.details.push(`搜尋「${term}」：${hits.length} 筆候選頁`);if(hits.length)attempt.status='rejected';
    for(const hit of hits.sort((a,b)=>Number(ingredientURL(b.url))-Number(ingredientURL(a.url)))){
     if(!allowedSourceURL(hit.url)||!new URL(hit.url).hostname.endsWith(domain))continue;
     const record=await inspect(hit.url,hit.raw_content,attempt);if(record){attempt.status='found';return record;}
    }
   }catch(e){if(/401|403/.test(e.message)){e.code='API_KEY';e.message='Tavily 金鑰無效或無存取權限';throw e;}if(/429|432|433/.test(e.message)){e.code='API_LIMIT';throw e;}attempt.status='error';attempt.details.push(e.message);}
  }
 }
 return {notFound:true,attempts,failureCode:candidates.length?'AMBIGUOUS':failureCode(attempts),candidates:[...new Map(candidates.map(c=>[c.cas,c])).values()]};
}
export async function lookup(query,options={}){
 const local=localRecord(query);const inputCAS=validCAS(query)?query:local?.cas[0];
 if(mixtureNames[inputCAS])return {kind:'mixture',cas:[inputCAS],formula:null,sourceName:mixtureNames[inputCAS],en:mixtureNames[inputCAS],zh:local?.zh||'',identity:'known-mixture',notes:[],sources:[]};
 if(/^\d[\d\s-]+$/.test(query)&&!validCAS(query)&&!local){const e=new Error('CAS 格式或檢查碼不正確，請核對 OCR 或輸入。');e.code='INVALID_CAS';throw e;}
 // Excel translates known names to CAS. Formulas always come from the user's two sources.
 const expectedCAS=validCAS(query)?query:(local?.cas[0]||null);
 const expectedName=local?.en||query;
 const result=await searchSources(expectedCAS||expectedName,{expectedCAS,expectedName,...options});
 if(result.notFound){const error=new Error('未取得可核對的成分資料');error.code=result.failureCode||'SEARCH_EMPTY';error.attempts=result.attempts;error.candidates=result.candidates||[];throw error;}
 return {...result,zh:local?.zh||'',en:result.sourceName||local?.en||'',identity:'online',notes:result.attempts.filter(a=>a.status!=='found').map(a=>`${a.domain} 未取得可核對的成分資料，已改查下一來源。`)};
}
