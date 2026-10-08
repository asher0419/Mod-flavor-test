import {readFileSync} from 'node:fs';
export const data=JSON.parse(readFileSync(new URL('./data.json',import.meta.url),'utf8'));
const elements=new Set('H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr Rf Db Sg Bh Hs Mt Ds Rg Cn Nh Fl Mc Lv Ts Og'.split(' '));
export function nameKey(v){return String(v||'').normalize('NFKC').trim().toLowerCase().replace(/\s+/g,' ');}
export function formulaKey(value){
 const raw=String(value||'').trim().replace(/[₀-₉]/g,c=>String('₀₁₂₃₄₅₆₇₈₉'.indexOf(c))).replace(/\s/g,'');
 if(!raw||!/^([A-Z][a-z]?\d*)+$/.test(raw))return null;
 const atoms=new Map();for(const [,el,n] of raw.matchAll(/([A-Z][a-z]?)(\d*)/g)){if(!elements.has(el))return null;const count=n?Number(n):1;if(!Number.isSafeInteger(count)||count<1||count>100000)return null;atoms.set(el,(atoms.get(el)||0)+count);}
 const names=[...atoms.keys()].sort((a,b)=>atoms.has('C')?(a==='C'?-1:b==='C'?1:a==='H'?-1:b==='H'?1:a.localeCompare(b)):a.localeCompare(b));
 return names.map(e=>e+(atoms.get(e)===1?'':atoms.get(e))).join('');
}
export function validCAS(cas){
 if(!/^\d{2,7}-\d{2}-\d$/.test(cas))return false;
 const digits=cas.replace(/-/g,'');let sum=0;[...digits.slice(0,-1)].reverse().forEach((n,i)=>sum+=Number(n)*(i+1));return sum%10===Number(digits.at(-1));
}
export function localRecord(query){
 const q=nameKey(query);const pool=[...data.banned,...data.known];
 const found=pool.filter(r=>r.cas.includes(query.trim())||nameKey(r.zh)===q||nameKey(r.en)===q);
 if(!found.length)return null;
 const formulas=new Set(found.map(r=>formulaKey(r.formula)).filter(Boolean));
 if(formulas.size>1)throw new Error('Excel 同一名稱或 CAS 有不同分子式，請先核對。');
 return {...found[0],cas:[...new Set(found.flatMap(r=>r.cas))],formula:[...formulas][0]||null,sources:[{label:'使用者 Excel',url:null}],identity:'local'};
}
export function classify(record,banned=data.banned){
 const direct=banned.filter(b=>(record.cas||[]).some(c=>b.cas.includes(c))||(record.identity==='local'&&(nameKey(record.zh)===nameKey(b.zh)||nameKey(record.en)===nameKey(b.en))));
 if(direct.length)return {status:'banned',matches:direct,reason:'命中你列出的禁用名稱或 CAS。'};
 const formula=formulaKey(record.formula);if(!formula)return {status:'unresolved',matches:[],reason:'缺少有效分子式。'};
 const matches=banned.filter(b=>formulaKey(b.formula)===formula);
 if(matches.length){if(!(record.cas||[]).length)return {status:'unresolved',matches,reason:'分子式命中禁用項目，但缺少 CAS，無法區分同一物質與異構物。'};return {status:'isomer',matches,reason:'分子式與禁用物質相同，已取得的 CAS 未命中清單；依你的規則列為異構物。'};}
 return {status:'clear',matches:[],reason:'未命中目前 27 項禁用清單及其分子式。'};
}
