import {cp,mkdir,readFile,writeFile} from 'node:fs/promises';
await mkdir('public/vendor',{recursive:true});
await cp('node_modules/pdfjs-dist/build','public/vendor/pdfjs',{recursive:true});
await cp('node_modules/pdfjs-dist/cmaps','public/vendor/cmaps',{recursive:true});
await cp('node_modules/pdfjs-dist/standard_fonts','public/vendor/standard_fonts',{recursive:true});
await cp('node_modules/pdfjs-dist/wasm','public/vendor/wasm',{recursive:true});
await cp('node_modules/tesseract.js/dist','public/vendor/tesseract',{recursive:true});
const data=JSON.parse(await readFile('lib/data.json','utf8'));
await writeFile('public/catalog.json',JSON.stringify([...data.known,...data.banned].map(({zh,en,cas})=>({zh,en,cas}))));
console.log('Static frontend and PDF/OCR assets ready.');

await cp('lib/chemistry.js','public/chemistry.js');
await writeFile('public/banned.json',JSON.stringify(data.banned));

await cp('public/ingredient-seed.json','lib/ingredient-seed.json');

await mkdir('public/vendor/mammoth',{recursive:true});
await cp('node_modules/mammoth/mammoth.browser.min.js','public/vendor/mammoth/mammoth.browser.min.js');
await mkdir('public/vendor/sheetjs',{recursive:true});
await cp('node_modules/xlsx/dist/xlsx.full.min.js','public/vendor/sheetjs/xlsx.full.min.js');

for(const name of ['fema-catalog.js','fema-index.js','ingredient-library.js'])await cp('public/'+name,'lib/'+name);
