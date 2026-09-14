import fs from 'node:fs/promises';
const p='data/output/global-arbitrage-observatory.json';const d=JSON.parse(await fs.readFile(p,'utf8'));
if(d.schemaVersion!=='BSARB-1.0')throw Error('schemaVersion');
if(!Array.isArray(d.currencies)||d.currencies.length<10)throw Error('currencies');
if(!Array.isArray(d.triangles))throw Error('triangles');
if(d.methodology?.executable!==false)throw Error('reference engine must not claim executability');
for(const x of d.triangles){if(!Number.isFinite(x.rawGapBp))throw Error(`bad gap ${x.id}`);if(x.synchronization!=='NON-SYNCHRONOUS')throw Error(`sync claim ${x.id}`)}
console.log('Validation OK');
