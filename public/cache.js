const ttl=7*24*60*60*1000;
export function cacheKey(query,rules){return `flavor-v9:${rules}:${query.trim().toLowerCase()}`;}
export function readCache(storage,query,rules,now=Date.now()){
 if(!rules)return null;try{const item=JSON.parse(storage.getItem(cacheKey(query,rules)));if(item&&now-item.saved<ttl&&item.result.sources?.length&&['banned','isomer','clear'].includes(item.result.status))return {...item.result,query,fromCache:true,savedAt:item.saved};}catch{}return null;
}
export function writeCache(storage,result,rules,now=Date.now()){
 if(!rules||!result.sources?.length||!['banned','isomer','clear'].includes(result.status))return;
 try{const text=JSON.stringify({saved:now,result});for(const key of new Set([result.query,...(result.cas||[])])){storage.setItem(cacheKey(key,rules),text);if(result.sources[0]?.url)storage.setItem('flavor-page:'+key.trim().toLowerCase(),result.sources[0].url);}}catch{}
}
export function savedSourceURL(storage,query){try{return storage.getItem('flavor-page:'+query.trim().toLowerCase())||null;}catch{return null;}}
