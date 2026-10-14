import test from 'node:test';
import assert from 'node:assert/strict';
import {parseDocumentText,readDocument,documentHTMLText} from '../public/document-import.js';
import {parsePage,searchSources,lookup} from '../lib/sources.js';
import XLSX from 'xlsx';
test('supplier names and FEMA retained including ingredients without identifiers',()=>{
 const rows=parseDocumentText('Ingredient Compositions (%)\nMedium Chain Triglyceride >60\nFlavor substance (s)\n- Ethyl 2-methylbutyrate (FEMA2443)\n- Soy furanone (FEMA 3623)\nNeotame <1\nThe information provided above');
 assert.equal(rows.length,4);assert.equal(rows[1].query,'Ethyl 2-methylbutyrate (FEMA 2443)');assert.equal(rows[3].name,'Neotame');
 assert.equal(parseDocumentText('FEMA 2443')[0].fema,'2443');
});
test('FEMA must match a labeled source field; multi-identity pages rejected',()=>{
 const page='Name: example CAS Number: 141-78-6 Formula: C4 H8 O2\nFEMA Number: 2443';
 assert.equal(parsePage(page,null,'','2443').formula,'C4H8O2');
 assert.equal(parsePage(page,null,'','2440'),null);
 assert.equal(parsePage(page+'\nCAS Number: 107-92-6 Formula: C4H8O2',null,'','2443'),null);
 assert.equal(parsePage(page.replace('FEMA Number:','Mentioned:'),null,'','2443'),null);
});
test('FEMA search verifies source content and MCT stays mixture',async()=>{
 const original=global.fetch;global.fetch=async()=>Response.json({results:[{url:'https://www.thegoodscentscompany.com/data/rw999991.html',raw_content:'Name: example CAS Number: 141-78-6 Formula: C4 H8 O2\nFEMA: 2443'}]});
 try{const r=await searchSources('FEMA 2443',{expectedFEMA:'2443',apiKey:'test'});assert.deepEqual(r.cas,['141-78-6']);assert.equal((await lookup('Medium Chain Triglyceride')).kind,'mixture');}finally{global.fetch=original;}
});
test('XLSX and legacy XLS read every sheet and preserve FEMA columns',async()=>{
 global.window={XLSX};try{for(const bookType of ['xlsx','xls']){const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet([['Name','FEMA'],['Soy furanone',3623]]),'First');XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet([['Name','CAS'],['Ethyl acetate','141-78-6']]),'Second');const bytes=XLSX.write(book,{bookType,type:'buffer'});const text=await readDocument({name:'supplier.'+bookType,size:bytes.length,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)});const rows=parseDocumentText(text);assert.ok(rows.some(r=>r.fema==='3623'));assert.ok(rows.some(r=>r.cas==='141-78-6'));}}finally{delete global.window;}
});

test('Word tables retain names and separate FEMA columns on one ingredient row',()=>{const rows=parseDocumentText(documentHTMLText('<p>Ingredient List</p><table><tr><td>Ingredient</td><td>FEMA</td></tr><tr><td><p>Soy furanone</p></td><td>3623</td></tr></table>'));assert.equal(rows.length,1);assert.equal(rows[0].query,'Soy furanone (FEMA 3623)');});
