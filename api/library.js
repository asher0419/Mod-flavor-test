import {timingSafeEqual} from 'node:crypto';
import {cloudConfigured,getCloud,writeCloud} from '../lib/cloud-library.js';
export default async function handler(req,res){res.setHeader('Cache-Control','no-store');if(!cloudConfigured()){res.status(503).json({configured:false,error:'尚未連接共用資料庫；目前清單不會跨裝置同步'});return;}
 try{if(req.method==='GET'){const {raw,records,...state}=await getCloud();res.status(200).json({configured:true,...state});return;}if(req.method!=='POST'){res.status(405).json({error:'僅支援GET或POST'});return;}
 const expected=process.env.LIBRARY_ADMIN_TOKEN||'';const supplied=req.headers?.['x-library-token']||'';const a=Buffer.from(expected),b=Buffer.from(typeof supplied==='string'?supplied:'');if(!expected||a.length!==b.length||!timingSafeEqual(a,b)){res.status(401).json({error:'請輸入正確的清單管理密碼才能保存共用資料'});return;}
 const {rows,revision,replaceCAS}=req.body||{};if(!Array.isArray(rows)||rows.length<1||rows.length>5000||!Number.isInteger(revision)||JSON.stringify(rows).length>2*1024*1024){res.status(400).json({error:'請提供有效清單和版本；上限5000筆／2MB'});return;}const next=await writeCloud({rows,revision,replaceCAS:typeof replaceCAS==='string'?replaceCAS:null});res.status(200).json({configured:true,...next});
 }catch(e){res.status(e.code==='CONFLICT'?409:e.code==='VALIDATION'?400:503).json({configured:true,error:e.message});}}
