import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ImpactGate,createCrashSamples} from '../src/impacts.mjs';

test('crash gating ignores resting contacts, duplicate body events and rapid solver chatter',()=>{
 const gate=new ImpactGate();
 assert.equal(gate.accept(1,2,.8,0),0);
 assert.equal(gate.accept(1,2,NaN,0),0);
 assert.ok(gate.accept(1,2,7,1)>.5);
 assert.equal(gate.accept(2,1,7,1),0);
 assert.equal(gate.accept(1,3,7,1.04),0);
 assert.equal(gate.accept(1,2,7,1.12),0);
 assert.ok(gate.accept(1,3,7,1.14)>0);
 assert.ok(gate.accept(1,2,7,1.4)>0);
});
test('harder collisions sound stronger, clamp at full strength, and reset for replay',()=>{
 const gate=new ImpactGate(),soft=gate.accept(1,2,2,1),hard=gate.accept(3,4,9,2);
 assert.ok(hard>soft&&soft>0);assert.equal(gate.accept(5,6,50,3),1);
 gate.reset();assert.ok(gate.accept(5,6,50,3)>0);
});
test('original crash buffers have a sharp broadband attack, bounded samples and decaying tails',()=>{
 for(const rate of [32000,48000]){
  const samples=createCrashSamples(rate),other=createCrashSamples(rate,1);
  assert.equal(samples.length,Math.ceil(rate*.62));assert.notDeepEqual(samples,other);
  const rms=(from,to)=>Math.sqrt(samples.slice(Math.floor(from*rate),Math.floor(to*rate)).reduce((sum,v)=>sum+v*v,0)/((to-from)*rate));
  assert.ok(samples.every(v=>Number.isFinite(v)&&Math.abs(v)<=.92));
  assert.ok(rms(.002,.08)>.2);assert.ok(rms(.4,.6)<rms(.002,.08)*.1);
  let differences=0;for(let i=1;i<rate*.08;i++)differences+=Math.abs(samples[i]-samples[i-1]);
  assert.ok(differences/(rate*.08)>.1,'impact must contain broadband crunch rather than a simple tone');
 }
});
