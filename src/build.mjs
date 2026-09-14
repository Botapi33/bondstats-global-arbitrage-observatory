import fs from 'node:fs/promises';

const ECB='https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml';
const BOC='https://www.bankofcanada.ca/valet/observations/group/FX_RATES_DAILY/json?recent=7';

const finite=x=>Number.isFinite(Number(x));
const round=(x,d=6)=>Number(Number(x).toFixed(d));
const gapBp=(a,b)=>(a/b-1)*10000;

function parseECB(xml){
  const rates={EUR:1};
  for(const m of xml.matchAll(/currency=['"]([A-Z]{3})['"]\s+rate=['"]([0-9.]+)['"]/g)) rates[m[1]]=Number(m[2]);
  const date=(xml.match(/time=['"](\d{4}-\d{2}-\d{2})['"]/)||[])[1];
  if(!date||Object.keys(rates).length<20) throw new Error('ECB payload did not contain expected daily reference rates');
  return {date,rates};
}

function parseBoC(j, preferredDate){
  const rows=Array.isArray(j?.observations)?j.observations:[];
  if(!rows.length) throw new Error('BoC payload has no observations');
  let row=rows.find(r=>r.d===preferredDate);
  if(!row){
    row=[...rows].sort((a,b)=>{
      const ca=Object.entries(a).filter(([k,v])=>k.startsWith('FX')&&finite(v?.v)).length;
      const cb=Object.entries(b).filter(([k,v])=>k.startsWith('FX')&&finite(v?.v)).length;
      return cb-ca;
    })[0];
  }
  const rates={CAD:1};
  for(const [k,v] of Object.entries(row)){
    const m=k.match(/^FX([A-Z]{3})CAD$/);
    if(m&&finite(v?.v)) rates[m[1]]=Number(v.v);
  }
  if(Object.keys(rates).length<15) throw new Error('BoC daily group did not contain enough FX observations');
  return {date:row.d,rates};
}

async function previousSnapshot(){
  for(const p of ['data/global-arbitrage-observatory.json','data/output/global-arbitrage-observatory.json']){
    try{return JSON.parse(await fs.readFile(p,'utf8'))}catch{}
  }
  return null;
}

function classification(absGap){
  if(absGap>=25) return 'dislocation';
  if(absGap>=10) return 'review';
  return 'normal';
}

function buildPairs(ecb,boc,prev){
  const overlap=Object.keys(ecb.rates).filter(c=>finite(boc.rates[c])).sort();
  const prevMap=new Map((prev?.pairs||[]).map(x=>[x.id,x]));
  const pairs=[];
  for(let i=0;i<overlap.length;i++){
    for(let j=i+1;j<overlap.length;j++){
      const base=overlap[i],quote=overlap[j];
      const ecbCross=ecb.rates[quote]/ecb.rates[base];
      const bocCross=boc.rates[base]/boc.rates[quote];
      if(!finite(ecbCross)||!finite(bocCross)||ecbCross<=0||bocCross<=0) continue;
      const raw=gapBp(bocCross,ecbCross);
      const abs=Math.abs(raw);
      const id=`${base}-${quote}`;
      const cls=classification(abs);
      const old=prevMap.get(id);
      const persisted=old && old.classification===cls && cls!=='normal'
        ? Math.max(1,Number(old.persistenceCount)||1)+1
        : cls==='normal'?0:1;
      pairs.push({
        id,base,quote,path:`${base}/${quote}`,
        ecbCross:round(ecbCross,8),bocCross:round(bocCross,8),
        rawGapBp:round(raw,2),absGapBp:round(abs,2),
        classification:cls,
        synchronization:ecb.date===boc.date?'SAME REFERENCE DATE':'NON-SYNCHRONOUS',
        ecbDate:ecb.date,bocDate:boc.date,
        persistenceCount:persisted,
        persistence:cls==='normal'?'—':`${persisted} snapshot${persisted===1?'':'s'}`,
        note:`BoC-implied ${base}/${quote} versus ECB-implied ${base}/${quote}. Both are official reference datasets, not executable bid/ask quotes.`
      });
    }
  }
  pairs.sort((a,b)=>b.absGapBp-a.absGapBp);
  return {overlap,pairs};
}

export function buildSnapshot(ecb,boc,prev=null){
  const {overlap,pairs}=buildPairs(ecb,boc,prev);
  const dislocations=pairs.filter(x=>x.classification==='dislocation');
  const reviews=pairs.filter(x=>x.classification==='review');
  const absSorted=pairs.map(x=>x.absGapBp).sort((a,b)=>a-b);
  const median=absSorted.length?absSorted[Math.floor(absSorted.length/2)]:0;
  const edges=pairs.map(x=>({from:x.base,to:x.quote,classification:x.classification,gapBp:x.rawGapBp,id:x.id}));
  const topCurrencies=overlap.map(code=>{
    const linked=pairs.filter(x=>x.base===code||x.quote===code);
    const max=linked.length?Math.max(...linked.map(x=>x.absGapBp)):0;
    const flagged=linked.filter(x=>x.classification!=='normal').length;
    return {code,maxGapBp:round(max,2),flaggedPairs:flagged};
  }).sort((a,b)=>b.maxGapBp-a.maxGapBp);

  const history=Array.isArray(prev?.history)?prev.history.slice(-29):[];
  history.push({
    asOf:new Date().toISOString(),
    ecbDate:ecb.date,bocDate:boc.date,
    largestGapBp:pairs[0]?.absGapBp??0,
    dislocations:dislocations.length,reviews:reviews.length
  });

  return {
    schemaVersion:'BSARB-2.0',
    modelVersion:'FX-CROSS-SOURCE-NETWORK-2.0',
    asOf:new Date().toISOString(),
    dataState:ecb.date===boc.date?'REFERENCE · ALIGNED DATE':'REFERENCE · DATE MISMATCH',
    sourceDates:{ecb:ecb.date,bankOfCanada:boc.date},
    summary:{
      currencies:overlap.length,
      crossRates:pairs.length,
      dislocations:dislocations.length,
      reviews:reviews.length,
      flagged:dislocations.length+reviews.length,
      largestGapBp:pairs[0]?.absGapBp??0,
      medianGapBp:round(median,2)
    },
    currencies:topCurrencies,
    edges,pairs,
    dislocations:[...dislocations,...reviews].slice(0,80),
    history,
    methodology:{
      executable:false,
      thresholdsBp:{review:10,dislocation:25},
      reason:'Official ECB and Bank of Canada reference observations are compared on a cross-rate basis. They are not executable bid/ask quotes.'
    },
    sources:[
      {name:'European Central Bank',dataset:'Euro foreign exchange reference rates',url:ECB,date:ecb.date},
      {name:'Bank of Canada',dataset:'Daily exchange rates (Valet FX_RATES_DAILY)',url:BOC,date:boc.date}
    ]
  };
}

async function main(){
  const [er,br]=await Promise.all([fetch(ECB),fetch(BOC)]);
  if(!er.ok)throw new Error(`ECB ${er.status}`); if(!br.ok)throw new Error(`BoC ${br.status}`);
  const ecb=parseECB(await er.text());
  const boc=parseBoC(await br.json(),ecb.date);
  const prev=await previousSnapshot();
  const out=buildSnapshot(ecb,boc,prev);
  await fs.mkdir('data/output',{recursive:true});
  await fs.writeFile('data/output/global-arbitrage-observatory.json',JSON.stringify(out,null,2)+'\n');
  console.log(`Built ${out.schemaVersion}: ${out.summary.currencies} currencies, ${out.summary.crossRates} cross-rates, ${out.summary.flagged} flagged.`);
}

if(import.meta.url===`file://${process.argv[1]}`) main().catch(e=>{console.error(e);process.exit(1)});
