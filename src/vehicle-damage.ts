import * as THREE from 'three';
import {TessellateModifier} from 'three/addons/modifiers/TessellateModifier.js';

type V3=[number,number,number];
type Zone={center:V3;halfSize:V3};
type WindowZone={center:V3;right:V3;up:V3;width:number;height:number};
type DamageZones={windshield:WindowZone;roof:Zone;doors:(Zone&{side:number})[]};
type Dent={axis:'y'|'z';center:V3;radius:V3;depth:number};
type Owned={mesh:THREE.Mesh;original:THREE.BufferGeometry;geometry:THREE.BufferGeometry;positions:Float32Array;normals:Float32Array};
const marksMaterial=new THREE.LineBasicMaterial({color:0xb5c7cf,transparent:true,opacity:.76,depthWrite:false});
const cabinMaterial=new THREE.MeshStandardMaterial({color:0x131c1e,roughness:.94});
const detail=new TessellateModifier(.44,3);
const subdivided=new WeakMap<THREE.BufferGeometry,THREE.BufferGeometry>();
const clamp=THREE.MathUtils.clamp;
const vector=(v:V3)=>new THREE.Vector3(...v);
function subdivision(geometry:THREE.BufferGeometry){
 if(!subdivided.has(geometry))subdivided.set(geometry,detail.modify(geometry));
 return subdivided.get(geometry)!;
}

/** Prepare shared templates during loading; never replace a model's pristine buffers. */
export function prepareDamageGeometry(model:THREE.Group){
 for(const child of model.children){
  if(!(child instanceof THREE.Mesh)||child.userData.damageEffect||!['paint','panel','glass'].includes(child.userData.surface))continue;
  const material=Array.isArray(child.material)?child.material[0]:child.material;
  if(material instanceof THREE.MeshPhysicalMaterial&&((material.roughness>.8&&child.userData.surface!=='panel')||material.metalness>.65||material.emissive.getHex()!==0))continue;
  subdivision(child.geometry);
 }
}

/** Cosmetic crush damage: collision support rails and rigid gameplay hulls stay stable. */
export class VehicleDamage {
 private owned=new Map<THREE.Mesh,Owned>();
 private dents:Dent[]=[];
 private marks?:THREE.LineSegments;
 private backing?:THREE.Mesh;
 private glassStress=0;
 private hits=0;
 private removed=0;
 private roofDepth=0;
 private doorDepth=0;
 private disposed=false;
 private zones?:DamageZones;
 constructor(private model:THREE.Group){this.zones=model.userData.damageZones;}
 get snapshot(){return{hits:this.hits,glass:this.glassStress===0?'intact':this.glassStress>=.74?'shattered':'cracked',roofDent:this.roofDepth,doorDent:this.doorDepth,ownedGeometryCount:this.owned.size,glassRemovedTriangles:this.removed};}
 private editable(mesh:THREE.Mesh,tessellate=false){
  let owned=this.owned.get(mesh);if(owned)return owned;
  const original=mesh.geometry;
  const template=tessellate?subdivision(original):original;
  const geometry=template.index?template.toNonIndexed():template.clone();
  mesh.geometry=geometry;
  owned={mesh,original,geometry,positions:new Float32Array(geometry.attributes.position.array),normals:new Float32Array(geometry.attributes.normal.array)};
  this.owned.set(mesh,owned);return owned;
 }
 impact(point:THREE.Vector3,strength:number,fromAbove=false){
  if(this.disposed||!this.zones||!Number.isFinite(strength)||strength<=0||![point.x,point.y,point.z].every(Number.isFinite)||this.hits>=4)return;
  strength=clamp(strength,0,1);this.hits++;
  const before=this.glassStress;this.glassStress=Math.min(1,this.glassStress+strength*.78);
  const {roof,doors,windshield}=this.zones;
  if(fromAbove||point.y>roof.center[1]-.22){
   const depth=.025+strength*.085;this.roofDepth=Math.min(.12,this.roofDepth+depth);
   // Retain the perimeter: the depression sits inside the supporting roof rails.
   this.dents.push({axis:'y',center:[clamp(point.x,roof.center[0]-roof.halfSize[0]*.42,roof.center[0]+roof.halfSize[0]*.42),roof.center[1],clamp(point.z,-roof.halfSize[2]*.22,roof.halfSize[2]*.22)],radius:[roof.halfSize[0]*.88,Math.max(.28,roof.halfSize[1]*2),roof.halfSize[2]*.82],depth});
  }
  const side=point.z<0?-1:1;
  const door=doors.filter(zone=>zone.side===side).sort((a,b)=>Math.abs(a.center[0]-point.x)-Math.abs(b.center[0]-point.x))[0];
  if(door&&strength>.16){
   const depth=.035+strength*.13;this.doorDepth=Math.min(.22,this.doorDepth+depth);
   this.dents.push({axis:'z',center:[door.center[0],door.center[1],door.center[2]],radius:[Math.max(.28,door.halfSize[0]*1.15),Math.max(.20,door.halfSize[1]*1.45),.25],depth:side*depth});
  }
  this.deform();
  // Roof deformation rebuilds glazing from pristine positions and needs a fresh cut.
  // Side-only hits leave existing holes untouched; recutting collapsed triangles loses the count.
  if(this.glassStress>=.74&&(before<.74||this.dents.some(dent=>dent.axis==='y')))this.shatter();
  this.buildMarks();
  return{chips:before<.74&&this.glassStress>=.74?14:before===0?5:2,glassPoint:vector(windshield.center),normal:vector(windshield.right).cross(vector(windshield.up)).normalize()};
 }
 private deform(){
  for(const child of this.model.children){
   if(!(child instanceof THREE.Mesh)||child.userData.damageEffect)continue;
   const glazing=child.userData.surface==='glass';
   if(glazing&&!this.dents.some(dent=>dent.axis==='y'))continue;
   const material=Array.isArray(child.material)?child.material[0]:child.material;
   // Rubber and lenses do not crumple with the painted panels.
   if(!['paint','trim','panel','glass'].includes(child.userData.surface))continue;
   if(material instanceof THREE.MeshPhysicalMaterial&&((material.roughness>.8&&child.userData.surface!=='panel')||material.metalness>.65||material.emissive.getHex()!==0))continue;
   if(!child.geometry.boundingBox)child.geometry.computeBoundingBox();
   if(child.geometry.boundingBox!.max.y<=.77)continue;
   const data=this.editable(child,child.userData.surface==='paint'||child.userData.surface==='panel'||glazing),p=data.geometry.attributes.position,n=data.geometry.attributes.normal;
   for(let i=0;i<p.count;i++){
    const base=i*3,x=data.positions[base],y=data.positions[base+1],z=data.positions[base+2];let yy=y,zz=z,nx=data.normals[base],ny=data.normals[base+1],nz=data.normals[base+2];
    if(y>.77)for(const dent of this.dents){
     if(glazing&&(dent.axis!=='y'||y<this.zones!.roof.center[1]-.15))continue;
     const vertical=dent.axis==='y',u=(x-dent.center[0])/dent.radius[0],v=((vertical?z:y)-dent.center[vertical?2:1])/dent.radius[vertical?2:1];
     const perpendicular=Math.abs((vertical?y:z)-dent.center[vertical?1:2]);
     const q=1-u*u-v*v;if(q<=0||perpendicular>dent.radius[vertical?1:2])continue;
     const depth=dent.depth*q*q,dx=4*dent.depth*q*u/dent.radius[0],dv=4*dent.depth*q*v/dent.radius[vertical?2:1];
     if(vertical){yy-=depth*(glazing?1.22:1);nx-=dx*ny;nz-=dv*ny;}else{zz-=depth;nx-=dx*nz;ny-=dv*nz;}
    }
    // A capped crush preserves roof support and avoids flat/faceted replacement normals.
    yy=Math.max(y-(glazing?.145:.12),yy);zz=clamp(zz,z-.22,z+.22);
    p.setXYZ(i,x,yy,zz);const length=Math.hypot(nx,ny,nz)||1;n.setXYZ(i,nx/length,ny/length,nz/length);
   }
   p.needsUpdate=true;n.needsUpdate=true;data.geometry.computeBoundingBox();data.geometry.computeBoundingSphere();
  }
 }
 private shatter(){
  if(!this.zones)return;
  const zone=this.zones.windshield,center=vector(zone.center),right=vector(zone.right),up=vector(zone.up),normal=right.clone().cross(up).normalize();
  this.removed=0;
  if(!this.backing){
   const geometry=new THREE.PlaneGeometry(zone.width*.88,zone.height*.86);
   geometry.applyMatrix4(new THREE.Matrix4().makeBasis(right,up,normal).setPosition(center.clone().addScaledVector(normal,-.10)));
   this.backing=new THREE.Mesh(geometry,cabinMaterial);this.backing.name='exposed-dark-cabin';this.backing.userData.damageEffect=true;this.backing.receiveShadow=true;this.model.add(this.backing);
  }
  for(const child of this.model.children){
   if(!(child instanceof THREE.Mesh)||child.userData.surface!=='glass')continue;
   const data=this.editable(child,true),p=data.geometry.attributes.position;
   for(let i=0;i<p.count;i+=3){
    const c=new THREE.Vector3().fromBufferAttribute(p,i).add(new THREE.Vector3().fromBufferAttribute(p,i+1)).add(new THREE.Vector3().fromBufferAttribute(p,i+2)).multiplyScalar(1/3).sub(center);
    const u=c.dot(right)/zone.width,v=c.dot(up)/zone.height;
    if(Math.abs(c.dot(normal))<.24&&u*u/.11+v*v/.18<1){
     const x=p.getX(i),y=p.getY(i),z=p.getZ(i);p.setXYZ(i+1,x,y,z);p.setXYZ(i+2,x,y,z);this.removed++;
    }
   }
   p.needsUpdate=true;data.geometry.computeBoundingBox();data.geometry.computeBoundingSphere();
  }
 }
 private buildMarks(){
  if(!this.zones)return;
  const {windshield,doors}=this.zones,center=vector(windshield.center),right=vector(windshield.right),up=vector(windshield.up),normal=right.clone().cross(up).normalize(),positions:number[]=[];
  const glassMeshes=this.model.children.filter(child=>child instanceof THREE.Mesh&&child.userData.surface==='glass') as THREE.Mesh[];
  this.model.updateMatrixWorld(true);
  // Project crack vertices onto the actual curved glazing once per damage update.
  const rays=new THREE.Raycaster(),inverse=this.model.matrixWorld.clone().invert(),normalMatrix=new THREE.Matrix3().getNormalMatrix(this.model.matrixWorld),worldNormal=normal.clone().applyMatrix3(normalMatrix).normalize();
  const project=(x:number,y:number)=>{
   const local=center.clone().addScaledVector(right,x*windshield.width).addScaledVector(up,y*windshield.height),world=local.clone().addScaledVector(normal,.65).applyMatrix4(this.model.matrixWorld);
   rays.set(world,worldNormal.clone().negate());rays.far=1.6;
   const hit=rays.intersectObjects(glassMeshes,false)[0];
   return hit?hit.point.clone().addScaledVector(worldNormal,.009).applyMatrix4(inverse):local.addScaledVector(normal,.015);
  };
  const segment=(a:THREE.Vector3,b:THREE.Vector3)=>positions.push(a.x,a.y,a.z,b.x,b.y,b.z);
  const raysCount=12+Math.min(8,this.hits*2);
  for(let j=0;j<raysCount;j++){
   const angle=j*Math.PI*2/raysCount+.12*Math.sin(j*11),sx=.075,sy=.025;
   const dx=Math.cos(angle),dy=Math.sin(angle),edge=Math.min((.47-Math.sign(dx)*sx)/(Math.abs(dx)||.001),(.46-Math.sign(dy)*sy)/(Math.abs(dy)||.001));
   let previous=project(sx,sy);
   for(let k=1;k<=3;k++){
    const t=edge*k/3,xx=sx+dx*t+Math.sin(j*2+k)*.014,yy=sy+dy*t+Math.cos(j+k*3)*.014,next=project(xx,yy);segment(previous,next);previous=next;
    if(k===2)segment(next,project(xx-dy*.06,yy+dx*.075));
   }
  }
  for(const door of doors){
   if(!this.dents.some(dent=>dent.axis==='z'&&Math.sign(dent.center[2])===door.side))continue;
   const [x,y,z]=door.center,side=door.side;
   const scuff=(xx:number,yy:number)=>{
    let zz=z;
    for(const dent of this.dents)if(dent.axis==='z'&&Math.abs(z-dent.center[2])<=dent.radius[2]){
     const u=(xx-dent.center[0])/dent.radius[0],v=(yy-dent.center[1])/dent.radius[1],q=1-u*u-v*v;if(q>0)zz-=dent.depth*q*q;
    }
    return new THREE.Vector3(xx,yy,clamp(zz,z-.22,z+.22)+side*.008);
   };
   for(let j=0;j<3;j++){
    const yy=y+(j-1)*.06;segment(scuff(x-door.halfSize[0]*.55,yy-.05),scuff(x+door.halfSize[0]*.52,yy+.025));
   }
  }
  if(!this.marks){this.marks=new THREE.LineSegments(new THREE.BufferGeometry(),marksMaterial);this.marks.name='impact-cracks-and-scuffs';this.marks.userData.damageEffect=true;this.model.add(this.marks);}
  this.marks.geometry.dispose();this.marks.geometry=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(positions,3));this.marks.geometry.computeBoundingSphere();
 }
 dispose(){
  if(this.disposed)return;this.disposed=true;
  for(const data of this.owned.values()){data.mesh.geometry=data.original;data.geometry.dispose();}this.owned.clear();
  if(this.marks){this.model.remove(this.marks);this.marks.geometry.dispose();this.marks=undefined;}
  if(this.backing){this.model.remove(this.backing);this.backing.geometry.dispose();this.backing=undefined;}
 }
}

type Fragment={p:THREE.Vector3;v:THREE.Vector3;rotation:THREE.Euler;spin:THREE.Vector3;age:number;life:number;size:number};
/** One bounded instanced draw for all short-lived glass chips in a run. */
export class GlassFragments {
 private fragments:Fragment[]=[];
 private mesh:THREE.InstancedMesh;
 private dummy=new THREE.Object3D();
 private prepared=new Map<string,Promise<void>>();
 constructor(scene:THREE.Scene){
  const geometry=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute([-.5,-.25,0,.5,-.18,0,-.15,.6,0],3));geometry.computeVertexNormals();
  this.mesh=new THREE.InstancedMesh(geometry,new THREE.MeshPhysicalMaterial({color:0xb8d1d6,metalness:.15,roughness:.18,transparent:true,opacity:.64,side:THREE.DoubleSide,depthWrite:false,clearcoat:.6}),48);
  this.mesh.name='impact-glass-fragments';this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.mesh.count=0;this.mesh.visible=false;this.mesh.frustumCulled=false;scene.add(this.mesh);
 }
 /** Compile new effect variants on the game renderer while the loading/menu screen is active. */
 prepare(renderer:THREE.WebGLRenderer,scene:THREE.Scene,camera:THREE.Camera,key:string,isCurrent=()=>true,onRender=()=>{}){
  const ready=this.prepared.get(key);if(ready)return ready;
  const geometry=new THREE.PlaneGeometry(1,1);
  const effects=new THREE.Group(),cracks=new THREE.LineSegments(geometry,marksMaterial),cabin=new THREE.Mesh(geometry,cabinMaterial),chips=new THREE.InstancedMesh(this.mesh.geometry,this.mesh.material,1);
  cabin.receiveShadow=true;effects.add(cracks,cabin,chips);effects.position.y=-2;effects.scale.setScalar(.001);
  for(const proxy of [cracks,cabin,chips])proxy.frustumCulled=false;
  chips.setMatrixAt(0,new THREE.Matrix4());
  // Tiny proxies sit below the opaque ground. An actual draw also completes lazy
  // driver/uniform initialization that compileAsync alone can defer until impact.
  const task=renderer.compileAsync(effects,camera,scene).then(()=>{
   if(!isCurrent()){this.prepared.delete(key);return;}
   if(renderer.getContext().isContextLost())return;
   scene.add(effects);renderer.render(scene,camera);onRender();
  }).finally(()=>{scene.remove(effects);geometry.dispose();chips.dispose();});
  this.prepared.set(key,task);return task;
 }
 get count(){return this.fragments.length;}
 emit(point:THREE.Vector3,normal:THREE.Vector3,count:number){
  for(let i=0;i<count&&this.fragments.length<48;i++)this.fragments.push({p:point.clone(),v:normal.clone().multiplyScalar(.7+Math.random()).add(new THREE.Vector3((Math.random()-.5)*2,.5+Math.random()*1.3,(Math.random()-.5)*2)),rotation:new THREE.Euler(Math.random()*3,Math.random()*3,Math.random()*3),spin:new THREE.Vector3(Math.random()*6,Math.random()*6,Math.random()*6),age:0,life:.65+Math.random()*.55,size:.035+Math.random()*.065});
 }
 update(dt:number){
  if(dt<=0)return;
  for(let i=this.fragments.length-1;i>=0;i--){const f=this.fragments[i];f.age+=dt;if(f.age>=f.life){this.fragments.splice(i,1);continue;}f.v.y-=dt*7;f.p.addScaledVector(f.v,dt);f.rotation.x+=f.spin.x*dt;f.rotation.y+=f.spin.y*dt;f.rotation.z+=f.spin.z*dt;}
  for(let i=0;i<this.fragments.length;i++){const f=this.fragments[i];this.dummy.position.copy(f.p);this.dummy.rotation.copy(f.rotation);this.dummy.scale.setScalar(f.size*(1-f.age/f.life));this.dummy.updateMatrix();this.mesh.setMatrixAt(i,this.dummy.matrix);}
  this.mesh.count=this.fragments.length;this.mesh.visible=this.fragments.length>0;this.mesh.instanceMatrix.needsUpdate=true;
 }
 clear(){this.fragments=[];this.mesh.count=0;this.mesh.visible=false;}
 dispose(){this.clear();this.prepared.clear();this.mesh.removeFromParent();this.mesh.dispose();this.mesh.geometry.dispose();(this.mesh.material as THREE.Material).dispose();}
}
