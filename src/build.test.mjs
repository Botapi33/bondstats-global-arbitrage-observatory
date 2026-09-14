import test from 'node:test';import assert from 'node:assert/strict';import {buildSnapshot} from './build.mjs';
test('reference gap is calculated and never called executable',()=>{
 const e={date:'2026-09-11',rates:{EUR:1,USD:1.2,CAD:1.6,GBP:.8,JPY:170,CHF:.95,AUD:1.7,NZD:1.9,SEK:11,NOK:12,DKK:7.4}};
 const b={date:'2026-09-11',vals:{FXUSDCAD:1.34,FXEURCAD:1.6,FXGBPCAD:2,FXJPYCAD:.0094}};
 const d=buildSnapshot(e,b);assert.equal(d.methodology.executable,false);assert.ok(d.triangles.length===4);assert.equal(d.triangles[0].synchronization,'NON-SYNCHRONOUS');
});
