import fs from 'node:fs/promises';
const d=JSON.parse(await fs.readFile('data/output/global-arbitrage-observatory.json','utf8'));
if(d.schemaVersion!=='BSARB-2.0') throw Error('schemaVersion');
if(!Array.isArray(d.currencies)||d.currencies.length<15) throw Error('currency coverage too small');
if(!Array.isArray(d.pairs)||d.pairs.length<50) throw Error('cross-rate coverage too small');
if(d.methodology?.executable!==false) throw Error('reference engine must not claim executability');
for(const x of d.pairs){
  if(!Number.isFinite(x.rawGapBp)||!Number.isFinite(x.ecbCross)||!Number.isFinite(x.bocCross)) throw Error(`invalid pair ${x.id}`);
  if(!['normal','review','dislocation'].includes(x.classification)) throw Error(`bad class ${x.id}`);
}
console.log(`Validation OK: ${d.currencies.length} currencies / ${d.pairs.length} cross-rates`);
