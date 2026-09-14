import fs from 'node:fs/promises';

const ECB='https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml';
const BOC='https://www.bankofcanada.ca/valet/observations/FXUSDCAD,FXEURCAD,FXGBPCAD,FXJPYCAD/json?recent=1';

const bp=(a,b)=>(a/b-1)*10000;
const finite=x=>Number.isFinite(Number(x));
const round=(x,d=6)=>Number(Number(x).toFixed(d));

function parseECB(xml){
  const rates={EUR:1};
  for(const m of xml.matchAll(/currency=['"]([A-Z]{3})['"]\s+rate=['"]([0-9.]+)['"]/g)) rates[m[1]]=Number(m[2]);
  const date=(xml.match(/time=['"](\d{4}-\d{2}-\d{2})['"]/)||[])[1];
  if(!date||Object.keys(rates).length<10) throw new Error('ECB payload did not contain expected daily reference rates');
  return {date,rates};
}
function latestBoC(j){
  const row=j?.observations?.at(-1); if(!row) throw new Error('BoC payload has no observations');
  const vals={};
  for(const [k,v] of Object.entries(row)) if(k.startsWith('FX')&&finite(v?.v)) vals[k]=Number(v.v);
  return {date:row.d,vals};
}
export function buildSnapshot(ecb,boc){
  const codes=Object.keys(ecb.rates).sort();
  const edges=[]; for(let i=0;i<codes.length;i++)for(let j=i+1;j<codes.length;j++)edges.push({from:codes[i],to:codes[j],classification:'normal'});
  const specs=[
    {series:'FXUSDCAD',base:'USD',quote:'CAD'},
    {series:'FXEURCAD',base:'EUR',quote:'CAD'},
    {series:'FXGBPCAD',base:'GBP',quote:'CAD'},
    {series:'FXJPYCAD',base:'JPY',quote:'CAD'}
  ];
  const triangles=[],dislocations=[];
  for(const s of specs){
    const direct=boc.vals[s.series], rb=ecb.rates[s.base], rq=ecb.rates[s.quote];
    if(!finite(direct)||!finite(rb)||!finite(rq)) continue;
    const implied=rq/rb, gap=bp(direct,implied), abs=Math.abs(gap);
    const x={
      id:`REF-${s.base}-CAD`,path:`${s.base}→CAD→EUR→${s.base}`,
      rawGapBp:round(gap,2),frictionBp:null,residualGapBp:null,
      persistence:'1 reference observation',synchronization:'NON-SYNCHRONOUS',
      classification:abs>=5?'review':'normal',
      directRate:round(direct),impliedRate:round(implied),
      note:`Bank of Canada ${s.series} versus ECB-implied ${s.base}/CAD. Reference observations are not synchronized; this is a pricing-consistency diagnostic, not an executable arbitrage signal.`,
      sourceA:'Bank of Canada Valet API',sourceB:'European Central Bank euro reference rates'
    };
    triangles.push(x); if(x.classification==='review')dislocations.push(x);
  }
  dislocations.sort((a,b)=>Math.abs(b.rawGapBp)-Math.abs(a.rawGapBp));
  const largest=dislocations[0]?.rawGapBp ?? triangles.reduce((m,x)=>Math.abs(x.rawGapBp)>Math.abs(m)?x.rawGapBp:m,0);
  return {
    schemaVersion:'BSARB-1.0',modelVersion:'FX-REFERENCE-DISLOCATION-1.0',
    asOf:new Date().toISOString(),dataState:'REFERENCE',
    sourceDates:{ecb:ecb.date,bankOfCanada:boc.date},
    summary:{currencies:codes.length,triangles:triangles.length,dislocations:dislocations.length,largestGapBp:round(Math.abs(largest),2)},
    currencies:codes.map(code=>({code})),edges,triangles,dislocations,
    methodology:{executable:false,reason:'Current engine compares official reference observations that are not synchronized and do not contain executable bid/ask quotes.'},
    sources:[
      {name:'European Central Bank',dataset:'Euro foreign exchange reference rates',url:ECB},
      {name:'Bank of Canada',dataset:'Valet FX observations',url:BOC}
    ]
  };
}
async function main(){
  const [er,br]=await Promise.all([fetch(ECB),fetch(BOC)]);
  if(!er.ok)throw new Error(`ECB ${er.status}`); if(!br.ok)throw new Error(`BoC ${br.status}`);
  const ecb=parseECB(await er.text()),boc=latestBoC(await br.json());
  const out=buildSnapshot(ecb,boc);
  await fs.mkdir('data/output',{recursive:true});
  await fs.writeFile('data/output/global-arbitrage-observatory.json',JSON.stringify(out,null,2)+'\n');
  console.log(`Built ${out.schemaVersion}: ${out.summary.currencies} currencies, ${out.summary.triangles} official-reference comparisons, ${out.summary.dislocations} review gaps.`);
}
if(import.meta.url===`file://${process.argv[1]}`) main().catch(e=>{console.error(e);process.exit(1)});
