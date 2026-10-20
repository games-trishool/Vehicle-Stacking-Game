import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as CANNON from 'cannon-es';
import {SPECS} from '../src/vehicle-specs.mjs';
import {createVehicleBody} from '../src/vehicle-physics.mjs';
import {VEHICLES} from '../src/store.mjs';
import {watchSurfaceContacts} from '../src/physics.mjs';
const added=['ambulance','police','rickshaw','fireengine','dumptruck','mixer'];
function world(){
 const simulation=new CANNON.World({gravity:new CANNON.Vec3(0,-12,0)}),hits=[];
 simulation.allowSleep=true;simulation.solver.iterations=16;simulation.defaultContactMaterial.friction=.65;simulation.defaultContactMaterial.restitution=.045;
 const floor=new CANNON.Body({mass:0,shape:new CANNON.Box(new CANNON.Vec3(4.1,.3,4.1)),position:new CANNON.Vec3(0,.19,0)});
 const ground=new CANNON.Body({mass:0,shape:new CANNON.Plane()});ground.quaternion.setFromEuler(-Math.PI/2,0,0);ground.position.y=-.13;
 simulation.addBody(floor);simulation.addBody(ground);watchSurfaceContacts(simulation,[floor,ground],body=>hits.push(body));
 return{simulation,hits};
}
test('every purchasable vehicle has physical specifications and an independent collision body',()=>{
 assert.deepEqual(VEHICLES.filter(v=>v.id!=='mixed').map(v=>v.id).sort(),Object.keys(SPECS).sort());
 for(const id of Object.keys(SPECS)){
  const first=createVehicleBody(id,0,.49),second=createVehicleBody(id,0,.49);
  assert.notEqual(first,second);assert.ok(first.mass>0);first.updateAABB();
  assert.ok([...first.aabb.lowerBound.toArray(),...first.aabb.upperBound.toArray()].every(Number.isFinite));
 }
 assert.equal(createVehicleBody('rickshaw',0,0).shapes.filter(shape=>shape instanceof CANNON.Sphere).length,3);
 for(const id of ['fireengine','dumptruck','mixer'])assert.equal(createVehicleBody(id,0,0).shapes.filter(shape=>shape instanceof CANNON.Sphere).length,6);
});
for(const id of added){
 test(`${id} supports a centered drop using its real gameplay hulls`,()=>{
  const {simulation,hits}=world(),height=SPECS[id].height,base=createVehicleBody(id,0,.49);
  base.type=CANNON.Body.STATIC;base.mass=0;base.updateMassProperties();simulation.addBody(base);
  const dropped=createVehicleBody(id,0,.49+height+3.1);simulation.addBody(dropped);
  for(let i=0;i<1200;i++)simulation.step(1/120);
  assert.equal(hits.length,0,'a centered drop must stay above the platform/ground');
  assert.ok(dropped.position.y>height,'the vehicle remains supported');
  assert.ok(Math.abs(dropped.quaternion.z)<.68,'a centered vehicle must not topple');
  assert.ok(dropped.velocity.length()<1.3,'the landing can settle for the gameplay reward');
 });
 test(`${id} ends on its first platform or ground contact after a miss`,()=>{
  const {simulation,hits}=world(),dropped=createVehicleBody(id,5,4);simulation.addBody(dropped);
  for(let i=0;i<600&&!hits.length;i++)simulation.step(1/120);
  assert.equal(hits[0],dropped);
 });
}
