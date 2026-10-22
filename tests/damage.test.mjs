import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {transformWithEsbuild} from 'vite';
import * as THREE from 'three';
import {TessellateModifier} from 'three/addons/modifiers/TessellateModifier.js';

// Exercise the real deformation/ownership implementation without a GPU or DOM.
const file=new URL('../src/vehicle-damage.ts',import.meta.url);
const input=(await readFile(file,'utf8')).replace(/(['"])three\1/g,JSON.stringify(new URL('../node_modules/three/build/three.module.js',import.meta.url).href)).replace(/(['"])three\/addons\/([^'"]+)\1/g,(_all,_quote,path)=>JSON.stringify(new URL('../node_modules/three/examples/jsm/'+path,import.meta.url).href));
const {code}=await transformWithEsbuild(input,'vehicle-damage.ts',{loader:'ts',target:'es2022'});
const {VehicleDamage,GlassFragments,prepareDamageGeometry}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));

function template(){
 const group=new THREE.Group(),paint=new THREE.MeshPhysicalMaterial({color:0x7c8792,metalness:.55,roughness:.3}),glass=new THREE.MeshPhysicalMaterial({color:0x172c38,roughness:.12}),trim=new THREE.MeshStandardMaterial({color:0x1f2528});
 paint.userData.vehicleSurface='paint';glass.userData.vehicleSurface='glass';
 group.userData={id:'car',spec:{length:3.5,width:1.8,height:1.8},damageZones:{
  windshield:{center:[1.1,1.30,0],right:[0,0,-1],up:[-.6,.8,0],width:1.48,height:.78},
  roof:{center:[0,1.70,0],halfSize:[1.6,.12,.85]},
  doors:[{center:[0,1.02,.88],halfSize:[1.5,.43,.06],side:1},{center:[0,1.02,-.88],halfSize:[1.5,.43,.06],side:-1}],
 }};
 const part=(name,geometry,material,surface)=>{const mesh=new THREE.Mesh(geometry.toNonIndexed(),material);mesh.name=name;mesh.userData.surface=surface;group.add(mesh);return mesh;};
 part('roof',new THREE.BoxGeometry(3.2,.24,1.7,16,2,12).translate(0,1.60,0),paint,'paint');
 for(const side of [-1,1])part('door-'+side,new THREE.BoxGeometry(3.0,.86,.06,12,8,1).translate(0,1.02,side*.88),paint,'paint');
 const normal=new THREE.Vector3().crossVectors(new THREE.Vector3(0,0,-1),new THREE.Vector3(-.6,.8,0));
 const basis=new THREE.Matrix4().makeBasis(new THREE.Vector3(0,0,-1),new THREE.Vector3(-.6,.8,0),normal).setPosition(1.1,1.30,0);
 part('windshield',new THREE.PlaneGeometry(1.48,.78,8,6).applyMatrix4(basis),glass,'glass');
 part('chassis',new THREE.BoxGeometry(3.1,.26,1.62).translate(0,.40,0),trim,'trim');
 // Place rigid wheel/lens samples inside a dent zone so material filtering is exercised.
 part('wheel-rim',new THREE.BoxGeometry(.42,.24,.06,3,2,1).translate(.15,1.04,.91),new THREE.MeshPhysicalMaterial({color:0xa8b0b6,metalness:.92,roughness:.22}),'trim');
 part('tire',new THREE.BoxGeometry(.42,.24,.06,3,2,1).translate(.60,1.04,.91),new THREE.MeshPhysicalMaterial({color:0x17191b,metalness:0,roughness:.95}),'trim');
 part('lamp',new THREE.BoxGeometry(.28,.18,.06,2,2,1).translate(-.55,1.04,.91),new THREE.MeshPhysicalMaterial({color:0xd1e3ef,metalness:.2,roughness:.15,emissive:0x8caac2,emissiveIntensity:.2}),'trim');
 return group;
}
const bytes=geometry=>Array.from(geometry.attributes.position.array);
const properties=material=>({color:material.color.getHex(),roughness:material.roughness,metalness:material.metalness,opacity:material.opacity,transparent:material.transparent});
const roofPoint=()=>new THREE.Vector3(0,1.72,.35);
function assertFinite(model){model.traverse(mesh=>{if(!mesh.isMesh)return;for(const attribute of ['position','normal']){const data=mesh.geometry.getAttribute(attribute);if(data)assert.ok(data.array.every(Number.isFinite),`${mesh.name}: finite ${attribute}`);}});}
function visibleTriangles(geometry){
 const positions=geometry.getAttribute('position'),a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();let count=0;
 for(let i=0;i<positions.count;i+=3){a.fromBufferAttribute(positions,i);b.fromBufferAttribute(positions,i+1).sub(a);c.fromBufferAttribute(positions,i+2).sub(a);if(b.cross(c).lengthSq()>1e-12)count++;}
 return count;
}

test('loading prewarm shares subdivision work without mutating pristine or sibling model resources',t=>{
 const shared=template(),model=shared.clone(),sibling=shared.clone(),damage=new VehicleDamage(model);
 const original=shared.children.map(mesh=>({geometry:mesh.geometry,positions:bytes(mesh.geometry),material:mesh.material,properties:properties(mesh.material)}));
 let subdivisions=0;const modify=TessellateModifier.prototype.modify;
 t.mock.method(TessellateModifier.prototype,'modify',function(...args){subdivisions++;return modify.apply(this,args);});
 prepareDamageGeometry(model);const prepared=subdivisions;assert.ok(prepared>0);
 prepareDamageGeometry(sibling);assert.equal(subdivisions,prepared,'clones must reuse shared prepared templates');
 assert.equal(damage.snapshot.ownedGeometryCount,0);assert.equal(damage.snapshot.hits,0);
 for(let i=0;i<original.length;i++)for(const candidate of [shared,model,sibling]){
  assert.equal(candidate.children[i].geometry,original[i].geometry);assert.deepEqual(bytes(candidate.children[i].geometry),original[i].positions);
  assert.equal(candidate.children[i].material,original[i].material);assert.deepEqual(properties(candidate.children[i].material),original[i].properties);
 }
 damage.impact(roofPoint(),.8,true);assert.equal(subdivisions,prepared,'the first real impact must not repeat prepared subdivision');
 assert.ok(damage.snapshot.ownedGeometryCount>0);assert.notEqual(model.getObjectByName('roof').geometry,shared.getObjectByName('roof').geometry);
 assert.notDeepEqual(bytes(model.getObjectByName('roof').geometry),original[0].positions);
 assert.deepEqual(bytes(shared.getObjectByName('roof').geometry),original[0].positions);assert.deepEqual(bytes(sibling.getObjectByName('roof').geometry),original[0].positions);
 assertFinite(model);damage.dispose();
});

test('impact damage changes one clone while cached geometry, materials, and its sibling remain pristine',()=>{
 const shared=template(),damaged=shared.clone(),sibling=shared.clone(),original=shared.children.map(mesh=>({geometry:mesh.geometry,positions:bytes(mesh.geometry),material:mesh.material,properties:properties(mesh.material)}));
 const damage=new VehicleDamage(damaged);assert.equal(damage.snapshot.hits,0);
 const result=damage.impact(roofPoint(),.8,true);assert.ok(result);assert.ok(damage.snapshot.roofDent>0);
 assert.notEqual(damaged.getObjectByName('roof').geometry,shared.getObjectByName('roof').geometry);
 assert.notDeepEqual(bytes(damaged.getObjectByName('roof').geometry),original[0].positions);
 for(let i=0;i<shared.children.length;i++){
  assert.equal(shared.children[i].geometry,original[i].geometry);assert.equal(sibling.children[i].geometry,original[i].geometry);
  assert.deepEqual(bytes(shared.children[i].geometry),original[i].positions);assert.deepEqual(bytes(sibling.children[i].geometry),original[i].positions);
  assert.equal(shared.children[i].material,original[i].material);assert.deepEqual(properties(shared.children[i].material),original[i].properties);
 }
 assertFinite(damaged);damage.dispose();
});
test('a harder impact makes a deeper but bounded roof dent, while chassis and trim stay intact',()=>{
 const shared=template(),softModel=shared.clone(),hardModel=shared.clone(),soft=new VehicleDamage(softModel),hard=new VehicleDamage(hardModel);
 soft.impact(roofPoint(),.25,true);hard.impact(roofPoint(),.95,true);
 assert.ok(hard.snapshot.roofDent>soft.snapshot.roofDent);assert.ok(hard.snapshot.roofDent<=.14);
 for(const name of ['chassis','wheel-rim','tire','lamp'])assert.deepEqual(bytes(hardModel.getObjectByName(name).geometry),bytes(shared.getObjectByName(name).geometry),`${name} must not crumple with the roof or doors`);
 assertFinite(softModel);assertFinite(hardModel);soft.dispose();hard.dispose();
});
test('side impacts visibly dent doors without exceeding the per-instance damage budget',()=>{
 const model=template().clone(),damage=new VehicleDamage(model),before=bytes(model.getObjectByName('door-1').geometry);
 damage.impact(new THREE.Vector3(.15,1.04,.91),.85,false);
 assert.ok(damage.snapshot.doorDent>0);assert.ok(damage.snapshot.doorDent<=.22);
 assert.notDeepEqual(bytes(model.getObjectByName('door-1').geometry),before);
 assertFinite(model);damage.dispose();
});
test('repeated heavy impacts shatter glass, remove windshield triangles, and keep resource use bounded',()=>{
 const model=template().clone(),damage=new VehicleDamage(model);
 damage.impact(roofPoint(),.65,true);assert.notEqual(damage.snapshot.glass,'intact');
 for(let n=0;n<6;n++)damage.impact(new THREE.Vector3((n%3-.9)*.3,1.72,.35),.95,true);
 assert.equal(damage.snapshot.glass,'shattered');assert.ok(damage.snapshot.glassRemovedTriangles>0);
 const count=damage.snapshot.ownedGeometryCount,children=model.children.length;
 for(let n=0;n<100;n++)damage.impact(new THREE.Vector3(0,1.72,.35),1,true);
 assert.equal(damage.snapshot.ownedGeometryCount,count);assert.equal(model.children.length,children);
 assert.ok(damage.snapshot.roofDent<=.14);assert.ok(damage.snapshot.doorDent<=.22);assertFinite(model);damage.dispose();
});
test('repeated side-only hits retain the shattered opening and its exact triangle count',()=>{
 const model=template().clone(),damage=new VehicleDamage(model),glass=model.getObjectByName('windshield'),pristineCount=visibleTriangles(glass.geometry);
 let shatteredPositions,removed;
 for(let hit=0;hit<4;hit++){
  damage.impact(new THREE.Vector3(hit%2?.25:-.25,1.02,hit%2?-.91:.91),.95,false);
  assert.equal(damage.snapshot.roofDent,0);assert.equal(damage.snapshot.glass,'shattered');
  const missing=pristineCount-visibleTriangles(glass.geometry);assert.ok(missing>0);
  assert.equal(damage.snapshot.glassRemovedTriangles,missing,'reported missing triangles must match the actual windshield opening');
  if(hit===0){shatteredPositions=bytes(glass.geometry);removed=missing;}
  else {assert.equal(missing,removed);assert.deepEqual(bytes(glass.geometry),shatteredPositions,'door damage must not rebuild an already shattered windshield');}
 }
 damage.dispose();
});
test('a roof impact after side-only shattering recuts the glass after deformation',()=>{
 const model=template().clone(),damage=new VehicleDamage(model),glass=model.getObjectByName('windshield'),pristineCount=visibleTriangles(glass.geometry);
 damage.impact(new THREE.Vector3(.15,1.04,.91),.95,false);assert.equal(damage.snapshot.glass,'shattered');
 damage.impact(roofPoint(),.95,true);assert.ok(damage.snapshot.roofDent>0);
 const missing=pristineCount-visibleTriangles(glass.geometry);assert.ok(missing>0);
 assert.equal(damage.snapshot.glassRemovedTriangles,missing,'deformation must not restore glass inside the shattered opening');
 assertFinite(model);damage.dispose();
});
test('side-first shattering still prepares coarse roof glazing for a later roof dent',()=>{
 const model=template().clone(),frontGlass=model.getObjectByName('windshield'),roofHeight=1.70;
 const pristine=new THREE.PlaneGeometry(2.4,1.3).rotateX(-Math.PI/2).translate(0,roofHeight,0).toNonIndexed();
 const roofGlass=new THREE.Mesh(pristine,frontGlass.material);roofGlass.name='coarse-roof-glass';roofGlass.userData.surface='glass';model.add(roofGlass);
 const pristinePositions=bytes(pristine),damage=new VehicleDamage(model);
 damage.impact(new THREE.Vector3(.15,1.04,.91),.95,false);assert.equal(damage.snapshot.glass,'shattered');assert.equal(damage.snapshot.roofDent,0);
 const before=roofGlass.geometry.getAttribute('position');for(let i=0;i<before.count;i++)assert.ok(Math.abs(before.getY(i)-roofHeight)<1e-6);
 damage.impact(roofPoint(),.95,true);assert.ok(damage.snapshot.roofDent>0);
 const after=roofGlass.geometry.getAttribute('position');let interiorDent=false;
 for(let i=0;i<after.count;i++)if(Math.abs(after.getX(i))<.4&&Math.abs(after.getZ(i))<.4&&after.getY(i)<roofHeight-.03)interiorDent=true;
 assert.ok(interiorDent,'a later roof impact must deform interior glazing, not leave the coarse flat panel intact');
 assert.deepEqual(bytes(pristine),pristinePositions,'the cached pristine roof glazing stays untouched');assertFinite(model);damage.dispose();
});
test('disposing damage releases owned instance resources but never shared template or overlay materials',()=>{
 const shared=template(),model=shared.clone(),other=shared.clone(),damage=new VehicleDamage(model),otherDamage=new VehicleDamage(other),sharedResources=new Set();let sharedDisposals=0,ownedDisposals=0;
 for(const mesh of shared.children){sharedResources.add(mesh.geometry);sharedResources.add(mesh.material);}
 damage.impact(roofPoint(),.95,true);damage.impact(new THREE.Vector3(.2,1.0,.91),.85,false);
 otherDamage.impact(roofPoint(),.95,true);
 // Overlay materials can be shared across damaged vehicles too; those are not instance-owned.
 const otherResources=new Set();other.traverse(mesh=>{if(!mesh.isMesh&&!mesh.isLineSegments&&!mesh.isLine)return;otherResources.add(mesh.geometry);for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material])otherResources.add(material);});
 model.traverse(mesh=>{if(!mesh.isMesh&&!mesh.isLineSegments&&!mesh.isLine)return;for(const resource of [mesh.geometry,...(Array.isArray(mesh.material)?mesh.material:[mesh.material])])if(otherResources.has(resource))sharedResources.add(resource);});
 for(const resource of sharedResources)resource.addEventListener('dispose',()=>sharedDisposals++);
 const ownedResources=new Set();model.traverse(mesh=>{if(!mesh.isMesh&&!mesh.isLineSegments&&!mesh.isLine)return;if(!sharedResources.has(mesh.geometry))ownedResources.add(mesh.geometry);for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material])if(!sharedResources.has(material))ownedResources.add(material);});
 assert.ok(ownedResources.size>0);for(const resource of ownedResources)resource.addEventListener('dispose',()=>ownedDisposals++);
 damage.dispose();assert.equal(sharedDisposals,0);assert.equal(ownedDisposals,ownedResources.size);
 damage.dispose();assert.equal(sharedDisposals,0);assert.equal(ownedDisposals,ownedResources.size,'disposal is idempotent');
 otherDamage.dispose();assert.equal(sharedDisposals,0);
 assert.equal(damage.impact(roofPoint(),1,true),undefined,'a disposed instance cannot allocate more damage');
});
test('glass fragments use a bounded shared draw, freeze without time, expire, and clean up',()=>{
 const scene=new THREE.Scene(),fragments=new GlassFragments(scene);
 fragments.emit(new THREE.Vector3(0,2,0),new THREE.Vector3(0,0,1),200);assert.ok(fragments.count>0&&fragments.count<=48);
 fragments.update(.1);const mesh=scene.getObjectByName('impact-glass-fragments');assert.ok(mesh.visible);assert.ok(mesh.count<=48);
 const matrices=Array.from(mesh.instanceMatrix.array);fragments.update(0);assert.deepEqual(Array.from(mesh.instanceMatrix.array),matrices);
 fragments.update(2);assert.equal(fragments.count,0);assert.equal(mesh.visible,false);
 fragments.emit(new THREE.Vector3(),new THREE.Vector3(0,1,0),5);fragments.clear();assert.equal(fragments.count,0);assert.equal(mesh.visible,false);
 let disposed=0;for(const resource of [mesh,mesh.geometry,mesh.material])resource.addEventListener('dispose',()=>disposed++);
 fragments.dispose();assert.equal(scene.getObjectByName('impact-glass-fragments'),undefined);assert.equal(disposed,3);
});
