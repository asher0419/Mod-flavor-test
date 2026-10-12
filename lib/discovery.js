const hosts=new Set(['thegoodscentscompany.com','www.thegoodscentscompany.com','scentsandflavors.com','www.scentsandflavors.com']);
export function allowedSourceURL(value){try{const u=new URL(value);return u.protocol==='https:'&&hosts.has(u.hostname)&&!u.username&&!u.password&&!u.port?u.href:null;}catch{return null;}}
export function ingredientURL(value){const url=allowedSourceURL(value);if(!url)return false;const u=new URL(url);return /thegoodscentscompany/.test(u.hostname)?/^\/(?:data\/rw\d+|episys\/ep\d+|opl\/[\d-]+)\.html$/.test(u.pathname):/^\/database\/[^/]+\/?$/.test(u.pathname);}
export function discoverLinks(document,base,cas){
 const links=[];const add=(href,context)=>{try{const url=new URL(href.replace(/&amp;/g,'&'),base).href;if(ingredientURL(url)&&(!cas||context.includes(cas)))links.push(url);}catch{}};
 const rows=document.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi)||[];
 for(const row of rows){if(cas&&!row.includes(cas))continue;for(const m of row.matchAll(/href\s*=\s*["']([^"']+)["']/gi))add(m[1],row);}
 for(const m of document.matchAll(/\[[^\]]+\]\((https?:\/\/[^\s)]+)\)/g)){const nearby=document.slice(Math.max(0,m.index-180),m.index+m[0].length+180);add(m[1],nearby);}
 // EPI and molecular-view pages expose a single Datasheet link, safe to follow after their exact CAS appears.
 if(cas&&document.includes(cas)&&/\/episys\/|\/opl\//.test(base))for(const m of document.matchAll(/href\s*=\s*["']([^"']+)["'][^>]*>\s*(?:Datasheet|Data Sheet)/gi))add(m[1],document);
 return [...new Set(links)].slice(0,5);
}
export function failureCode(attempts){
 if(attempts.some(a=>a.status==='error'||a.status==='unreadable'))return 'READ_FAILED';
 if(attempts.some(a=>a.status==='rejected'))return 'PARSE_FAILED';return 'SEARCH_EMPTY';
}
