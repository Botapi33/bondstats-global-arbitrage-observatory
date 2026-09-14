import test from 'node:test';import assert from 'node:assert/strict';import {buildSnapshot} from './build.mjs';
test('builds a dense cross-source network and valid classifications',()=>{
 const codes=['EUR','USD','CAD','GBP','JPY','AUD','CHF','CNY','HKD','INR','MXN','NZD','NOK','SEK','ZAR','BRL'];
 const er={EUR:1,USD:1.16,CAD:1.61,GBP:.86,JPY:178,AUD:1.77,CHF:.93,CNY:8.28,HKD:9.02,INR:102,MXN:21.5,NZD:1.99,NOK:11.5,SEK:10.9,ZAR:18.7,BRL:6.3};
 const br={CAD:1,EUR:1.61,USD:1.39,GBP:1.87,JPY:.00903,AUD:.995,CHF:1.70,CNY:.207,HKD:.177,INR:.0145,MXN:.0817,NZD:.807,NOK:.149,SEK:.143,ZAR:.0859,BRL:.272};
 const d=buildSnapshot({date:'2026-09-11',rates:er},{date:'2026-09-11',rates:br});
 assert.equal(d.schemaVersion,'BSARB-2.0');assert.equal(d.methodology.executable,false);
 assert.ok(d.pairs.length>50);assert.equal(d.pairs.length,codes.length*(codes.length-1)/2);
 assert.ok(d.summary.crossRates===d.pairs.length);
});
