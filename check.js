import {lookup} from '../lib/lookup.js';
import {classify,data} from '../lib/core.js';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method==='GET'){res.status(200).json({count:data.banned.length,version:data.version,searchConfigured:!!process.env.TAVILY_API_KEY});return;}
 if(req.method!=='POST'){res.status(405).json({error:'僅支援 POST'});return;}
 const q=req.body?.query;
 if(typeof q!=='string'||!q.trim()||q.length>200){res.status(400).json({error:'請提供 200 字以内的名稱或 CAS'});return;}
 try{const record=await lookup(q.trim());res.status(200).json({query:q,...record,...classify(record)});}
 catch(error){res.status(200).json({query:q,status:error.code==='NOT_FOUND'?'notfound':'unresolved',matches:[],sources:[],reason:error.message||'查詢失敗，請稍後重試',attempts:error.attempts||[]});}
}
