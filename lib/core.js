import {readFileSync} from 'node:fs';
export const data=JSON.parse(readFileSync(new URL('./data.json',import.meta.url),'utf8'));
import {nameKey,formulaKey} from './chemistry.js';
export {nameKey,formulaKey,validCAS} from './chemistry.js';
export function localRecord(query){
 const q=nameKey(query);const pool=[...data.banned,...data.known];
 const found=pool.filter(r=>r.cas.includes(query.trim())||nameKey(r.zh)===q||nameKey(r.en)===q);
 if(!found.length)return null;
 const formulas=new Set(found.map(r=>formulaKey(r.formula)).filter(Boolean));
 if(formulas.size>1)throw new Error('Excel 同一名稱或 CAS 有不同分子式，請先核對。');
 return {...found[0],cas:[...new Set(found.flatMap(r=>r.cas))],formula:[...formulas][0]||null,sources:[{label:'使用者 Excel',url:null}],identity:'local'};
}
import {classify as classifyRecord} from './chemistry.js';
export function classify(record,banned=data.banned){return classifyRecord(record,banned);}
