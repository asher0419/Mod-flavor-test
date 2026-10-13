import {createHash} from 'node:crypto';
import {lookup} from '../lib/lookup.js';
import {classify,data} from '../lib/core.js';
import {cloudConfigured,getCloud,learnCloud} from '../lib/cloud-library.js';
import {lookupLibrary} from '../lib/ingredient-library.js';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method==='GET'){res.status(200).json({count:data.banned.length,version:data.version,parserVersion:'2026-10-13-four-groups-v15',ruleKey:createHash('sha256').update(JSON.stringify(data.banned)).digest('hex').slice(0,12),searchConfigured:!!process.env.TAVILY_API_KEY});return;}
 if(req.method!=='POST'){res.status(405).json({error:'僅支援 POST'});return;}
 const q=req.body?.query;
 if(typeof q!=='string'||!q.trim()||q.length>200){res.status(400).json({error:'請提供 200 字以内的名稱或 CAS'});return;}
 try{if(cloudConfigured()&&!req.body.force&&!req.body.sourceURL){const cloud=await getCloud();const saved=lookupLibrary(cloud.records,q.trim(),data.banned);if(saved){res.status(200).json({...saved,fromLibrary:true,cloudRevision:cloud.revision});return;}}const record=await lookup(q.trim(),{sourceURL:typeof req.body.sourceURL==='string'?req.body.sourceURL:null,sourceHint:typeof req.body.sourceHint==='string'?req.body.sourceHint:null});const result={query:q,...record,...classify(record)};if(cloudConfigured()){try{await learnCloud(result);result.cloudSaved=true;}catch(e){result.cloudSaved=false;result.notes=[...(result.notes||[]),'共用清單未保存：'+e.message];}}res.status(200).json(result);}
 catch(error){
  const explanations={SEARCH_EMPTY:'搜尋未找到候選頁，可改用CAS或貼來源網址。',READ_FAILED:'來源讀取失敗或逾時，請重新查詢；持續失敗可貼來源網址。',PARSE_FAILED:'已取得頁面，但CAS或分子式無法核對，請核對來源或貼正確資料頁。',AMBIGUOUS:'名稱未能唯一確認，請選擇候選CAS或輸入廠商CAS。',INVALID_CAS:'CAS檢查碼不正確，請核對輸入或OCR。',INVALID_SOURCE:'僅接受TGSC與Scents and Flavors的HTTPS網址。',API_KEY:'Tavily金鑰無效，請檢查Vercel設定。',API_LIMIT:'Tavily額度或請求限制已達上限，請檢查帳戶或稍後重試。'};
  res.status(200).json({query:q,status:error.code==='SEARCH_EMPTY'?'notfound':'unresolved',failureCode:error.code||'CONFIG',matches:[],sources:[],reason:explanations[error.code]||error.message||'查詢失敗，請稍後重試',attempts:error.attempts||[],candidates:error.candidates||[]});
 }
}
