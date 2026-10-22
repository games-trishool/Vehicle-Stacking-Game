import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as CANNON from 'cannon-es';
import {DamageGate,contactInModel} from '../src/damage-rules.mjs';

test('damage ignores quiet contacts and duplicate body events without suppressing another simultaneous collision',()=>{
 const gate=new DamageGate();
 assert.equal(gate.accept(1,2,1.59,1),0);
 assert.equal(gate.accept(1,2,NaN,1),0);
 assert.equal(gate.accept(1,2,5,NaN),0);
 assert.ok(gate.accept(1,2,7,1)>0);
 assert.equal(gate.accept(2,1,7,1),0,'the second body reports the same physical impact');
 assert.ok(gate.accept(3,4,7,1)>0,'a second pair must not inherit the sound gate global cooldown');
 assert.equal(gate.accept(1,2,8,1.6),0);
 assert.ok(gate.accept(1,2,8,1.7)>0);
});
test('harder damage impacts are stronger, bounded, and reset between runs',()=>{
 const gate=new DamageGate(),soft=gate.accept(1,2,2,1),hard=gate.accept(3,4,10,1);
 assert.ok(soft>0&&hard>soft&&hard<=1);
 assert.equal(gate.accept(5,6,100,2),1);
 gate.reset();assert.ok(gate.accept(5,6,10,2)>0);
});
test('rotated Cannon contact offsets map into the correct model coordinates for either body',()=>{
 const a=new CANNON.Body({position:new CANNON.Vec3(5,6,7)}),b=new CANNON.Body({position:new CANNON.Vec3(-2,3,4)});
 a.quaternion.setFromEuler(0,0,Math.PI/2);b.quaternion.setFromEuler(0,Math.PI/2,0);
 // One world point (4.5,7,6.75), expressed as world-oriented offsets from both bodies.
 const contact={bi:a,bj:b,ri:new CANNON.Vec3(-.5,1,-.25),rj:new CANNON.Vec3(6.5,4,2.75)};
 const pointA=contactInModel(a,contact,2),pointB=contactInModel(b,contact,3);
 const near=(actual,expected)=>actual.toArray().forEach((value,i)=>assert.ok(Math.abs(value-expected[i])<1e-10,`${actual.toArray()} != ${expected}`));
 near(pointA,[1,1.5,-.25]);near(pointB,[-2.75,5.5,6.5]);
});
