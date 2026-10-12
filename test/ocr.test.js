import test from 'node:test';import assert from 'node:assert/strict';
import {summarizeRows,detectTable} from '../public/ocr-table.js';
import {parsePage,searchSources} from '../lib/sources.js';
test('duplicate CAS rows preserved and counted separately',()=>{const rows=Array.from({length:35},(_,i)=>({cas:String(i)}));rows[21].cas=rows[8].cas;assert.deepEqual(summarizeRows(rows),{rows:35,validRows:35,unique:34,duplicates:1,unresolved:0});});
test('rows lacking CAS remain in review count',()=>{assert.deepEqual(summarizeRows([{name:'A',cas:''},{name:'B',cas:'123-86-4'}]),{rows:2,validRows:1,unique:1,duplicates:0,unresolved:1});});
test('blank pages do not invent table rows',()=>{assert.equal(detectTable({width:100,height:100,data:new Uint8ClampedArray(40000).fill(255)}),null);});
test('source name is read back for a CAS-only query',()=>{const r=parsePage('Name: hexyl acetate CAS Number: 142-92-7 Formula: C8 H16 O2 NMR Predictor','142-92-7');assert.equal(r.sourceName,'hexyl acetate');});
test('Linalool goes directly to verified ingredient page and yields menthone isomer',async()=>{const r=await searchSources('78-70-6',{expectedCAS:'78-70-6',apiKey:'test',fetchPage:async url=>{assert.equal(url,'https://www.thegoodscentscompany.com/data/rw1007872.html');return 'Name: 3,7-dimethylocta-1,6-dien-3-ol CAS Number: 78-70-6 Formula: C10 H18 O NMR Predictor';}});assert.equal(r.formula,'C10H18O');assert.equal(r.sourceName,'3,7-dimethylocta-1,6-dien-3-ol');});
