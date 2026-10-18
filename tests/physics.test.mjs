import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World, Body, Box, Sphere, Plane, Vec3 } from 'cannon-es';
import { watchSurfaceContacts } from '../src/physics.mjs';

function setup(){
  const world=new World({gravity:new Vec3(0,-10,0)}),hits=[];
  const platform=new Body({mass:0,shape:new Box(new Vec3(3,.25,3)),position:new Vec3(0,.25,0)});
  const ground=new Body({mass:0,shape:new Plane()});ground.quaternion.setFromEuler(-Math.PI/2,0,0);ground.position.y=-1;
  world.addBody(platform);world.addBody(ground);watchSurfaceContacts(world,[platform,ground],body=>hits.push(body));
  return {world,platform,ground,hits};
}
function stepUntil(world,condition){for(let i=0;i<300&&!condition();i++)world.step(1/120);}
test('even a wheel touching the platform reports a loss while the chassis is above it',()=>{
  const {world,hits}=setup(),car=new Body({mass:8,position:new Vec3(2.7,3,0)});
  car.addShape(new Box(new Vec3(1,.3,.5)));car.addShape(new Sphere(.25),new Vec3(0,-.65,0));world.addBody(car);
  stepUntil(world,()=>hits.length>0);assert.equal(hits[0],car);
  assert.ok(car.position.y>.5+.3,'Chassis is still above the platform when its wheel makes contact');
});
test('a vehicle missing the platform ends on first contact with the lower ground',()=>{
  const {world,hits}=setup(),car=new Body({mass:8,shape:new Box(new Vec3(.5,.5,.5)),position:new Vec3(6,2,0)});
  world.addBody(car);stepUntil(world,()=>hits.length>0);assert.equal(hits[0],car);
});
test('the static starting vehicle and safe car-on-car contacts do not end the run',()=>{
  const {world,hits}=setup();
  const base=new Body({mass:0,shape:new Box(new Vec3(1,.5,1)),position:new Vec3(0,.99,0)});
  const car=new Body({mass:8,shape:new Box(new Vec3(.5,.5,.5)),position:new Vec3(0,3,0)});
  world.addBody(base);world.addBody(car);
  for(let i=0;i<300;i++)world.step(1/120);
  assert.equal(hits.length,0);assert.ok(car.position.y>1.8);
});
test('a previously supported car is still monitored when it later slides onto the platform',()=>{
  const {world,hits}=setup(),base=new Body({mass:0,shape:new Box(new Vec3(.7,.5,1)),position:new Vec3(0,1,0)});
  const car=new Body({mass:8,shape:new Box(new Vec3(.4,.4,.4)),position:new Vec3(0,2,0)});
  world.addBody(base);world.addBody(car);
  for(let i=0;i<180;i++)world.step(1/120);
  assert.equal(hits.length,0);car.velocity.x=4;car.wakeUp();
  stepUntil(world,()=>hits.length>0);assert.equal(hits[0],car);
});
