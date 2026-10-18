import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export type VehicleId = 'car'|'suv'|'truck'|'sports'|'bus'|'tractor';
export const SPECS: Record<VehicleId,{length:number;width:number;height:number;color:number}> = {
  car:{length:4.5,width:1.85,height:1.58,color:0xd8ad54},
  suv:{length:4.5,width:2,height:1.95,color:0x7b8e70},
  truck:{length:4.9,width:2,height:1.82,color:0xc27851},
  sports:{length:4.6,width:1.96,height:1.32,color:0xbb4941},
  bus:{length:5.6,width:2.14,height:2.55,color:0xd8bf6a},
  tractor:{length:3.9,width:2.05,height:2.28,color:0x619780},
};
const geometryCache=new Map<string,THREE.BufferGeometry>();
function cached(key:string,create:()=>THREE.BufferGeometry){if(!geometryCache.has(key))geometryCache.set(key,create());return geometryCache.get(key)!;}
const mats=new Map<string,THREE.MeshStandardMaterial>();
function material(color:number,metalness=.0,roughness=.55){const key=`${color}-${metalness}-${roughness}`;if(!mats.has(key))mats.set(key,new THREE.MeshStandardMaterial({color,metalness,roughness}));return mats.get(key)!;}
const rubber=material(0x181d1b,.05,.88), alloy=material(0xbfc5c1,.88,.22), dark=material(0x252d2a,.45,.4), glass=material(0x233e43,.6,.12), headlamp=material(0xf9eac7,.4,.18), red=material(0xac2c22,.2,.28);
function mesh(group:THREE.Group,geo:THREE.BufferGeometry,mat:THREE.Material,x:number,y:number,z:number){const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;group.add(m);return m;}
function box(g:THREE.Group,x:number,y:number,z:number,w:number,h:number,d:number,mat:THREE.Material,r=.04){return mesh(g,cached(`b${w},${h},${d},${r}`,()=>r===0?new THREE.BoxGeometry(w,h,d):new RoundedBoxGeometry(w,h,d,2,Math.min(r,w/4,h/4,d/4))),mat,x,y,z);}
function profile(g:THREE.Group,points:number[][],width:number,mat:THREE.Material){const key=JSON.stringify(points)+width;const geo=cached(key,()=>{const shape=new THREE.Shape();points.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();const extruded=new THREE.ExtrudeGeometry(shape,{depth:width,bevelEnabled:true,bevelSize:.025,bevelThickness:.025,bevelSegments:2,steps:1});extruded.translate(0,0,-width/2);extruded.computeVertexNormals();return extruded;});return mesh(g,geo,mat,0,0,0);}
function wheel(g:THREE.Group,x:number,z:number,r:number){
  const w=new THREE.Group();w.position.set(x,r,z);g.add(w);
  const tire=mesh(w,cached(`tire${r}`,()=>new THREE.CylinderGeometry(r,r,.26,32)),rubber,0,0,0);tire.rotation.x=Math.PI/2;
  for(const s of [-1,1]){
    const rim=mesh(w,cached(`rim${r}`,()=>new THREE.CylinderGeometry(r*.65,r*.65,.025,24)),alloy,0,0,s*.138);rim.rotation.x=Math.PI/2;
    const inner=mesh(w,cached(`inner${r}`,()=>new THREE.CylinderGeometry(r*.48,r*.48,.03,24)),dark,0,0,s*.155);inner.rotation.x=Math.PI/2;
    for(let j=0;j<6;j++){const a=j*Math.PI/3;const spoke=box(w,Math.sin(a)*r*.27,Math.cos(a)*r*.27,s*.175,.055,r*.52,.025,alloy,0);spoke.rotation.z=-a;}
    const hub=mesh(w,cached(`hub${r}`,()=>new THREE.CylinderGeometry(r*.15,r*.15,.04,16)),alloy,0,0,s*.18);hub.rotation.x=Math.PI/2;
  }
  for(let j=0;j<24;j++){const a=j*Math.PI/12;const tread=box(w,Math.sin(a)*(r-.004),Math.cos(a)*(r-.004),0,.045,.025,.25,dark,0);tread.rotation.z=-a;}
}
const models=new Map<string,THREE.Group>();
export function createVehicle(id:VehicleId,color?:number){
  const modelKey=id+String(color);if(models.has(modelKey))return models.get(modelKey)!.clone();
  const spec=SPECS[id],g=new THREE.Group();g.name=id;
  const paint=material(color??spec.color,.42,.27),trim=material(0x454e46,.18,.65);
  const L=spec.length,W=spec.width;
  const radius=id==='tractor'?.57:id==='bus'?.47:.39;
  const axles=id==='tractor'?[-1.16,1.18]:[-L*.31,L*.31];
  for(const x of axles)for(const z of [-W/2,W/2])wheel(g,x,z,id==='tractor'&&x<0?.67:radius);
  box(g,0,.38,0,L*.9,.18,W*.81,dark);
  if(id==='bus'){
    box(g,0,1.46,0,L,2.04,W,paint,.16);
    box(g,0,.72,0,L+.02,.19,W+.025,trim);
    box(g,0,2.49,0,L-.13,.1,W-.12,material(0xe3dcca,.25,.5));
    for(const s of [-1,1]){
      for(let j=0;j<6;j++)box(g,-2.16+j*.79,1.91,s*(W/2+.015),.7,.79,.025,glass);
      for(let j=0;j<2;j++)box(g,-1.5+j*3.15,1.33,s*(W/2+.03),.57,1.6,.024,dark);
      box(g,0,1.1,s*(W/2+.042),L-.2,.08,.025,material(0xeae4cd));
    }
    box(g,L/2+.025,1.86,0,.035,1.05,W-.23,glass);
    box(g,-L/2-.025,1.9,0,.035,.8,W-.2,glass);
    box(g,L/2+.04,.86,0,.06,.2,W*.8,alloy);
  } else if(id==='tractor'){
    box(g,.55,.92,0,2.4,.73,1.25,paint,.14);
    box(g,-.9,1.64,0,1.55,1.15,1.38,glass,.07);
    box(g,-.9,2.25,0,1.8,.13,1.64,paint);
    for(const x of [-1.58,-.22])for(const z of [-.71,.71])box(g,x,1.66,z,.09,1.15,.1,paint);
    for(const z of [-.94,.94])box(g,-1.14,1.3,z,1.6,.15,.62,paint);
    box(g,1.8,.98,0,.05,.46,.94,dark);
    for(let j=0;j<8;j++)box(g,1.83,.98,-.38+j*.11,.03,.41,.025,alloy);
    mesh(g,cached('exhaust',()=>new THREE.CylinderGeometry(.055,.055,1.07,12)),dark,.4,1.83,.48);
    box(g,-.9,.62,0,1.5,.15,1.7,dark);
  } else {
    const sporty=id==='sports',suv=id==='suv',truck=id==='truck';
    profile(g,[[-L/2,.52],[-L/2,.85],[-L*.4,1.0],[L*.27,sporty?.83:1.02],[L*.47,.82],[L/2,.56],[L*.4,.45],[-L*.4,.45]],W,paint);
    if(truck){
      profile(g,[[-.15,.95],[-.15,1.64],[.22,1.82],[1.1,1.82],[1.51,1.02]],W-.08,paint);
      profile(g,[[.0,1.13],[.0,1.58],[.27,1.69],[.99,1.69],[1.33,1.13]],W+.012,glass);
      const windscreen=box(g,1.28,1.44,0,.035,.57,W-.25,glass,.015);windscreen.rotation.z=.45;
      for(const z of [-W/2,W/2])box(g,.55,1.4,z,.08,.55,.04,paint);
      box(g,-1.37,.99,0,1.7,.19,W-.28,dark);
      for(const z of [-W/2+.02,W/2-.02])box(g,-1.35,1.18,z,1.87,.4,.1,paint);
      box(g,-L/2+.08,1.18,0,.1,.38,W,paint);
    }else{
      const roof=sporty?1.28:suv?1.9:1.55;
      profile(g,[[-1.53,.91],[-1.02,roof-.07],[-.69,roof],[.64,roof],[1.36,.94]],W-.12,paint);
      // Window silhouette, then painted pillars: real dimensional glazing on both sides.
      profile(g,[[-1.29,1.02],[-.93,roof-.13],[-.67,roof-.12],[.59,roof-.12],[1.12,1.02]],W+.018,glass);
      for(const z of [-W/2-.022,W/2+.022]){
        box(g,-.18,(roof+1.03)/2,z,.08,roof-1.01,.035,paint);
        box(g,-.05,.93,z,2.55,.035,.04,alloy);
        for(const x of [-.62,.51])box(g,x,.86,z,.19,.032,.033,alloy);
        // Fine door seams.
        for(const x of [-1.34,-.15,1.16])box(g,x,.76,z,.012,.26,.01,trim,0);
      }
      const windshield=box(g,.96,(roof+1.02)/2,0,.045,roof-1.04,W-.22,glass,.01);windshield.rotation.z=.52;
      const rear=box(g,-1.18,(roof+1.02)/2,0,.035,roof-1.05,W-.22,glass,.01);rear.rotation.z=-.55;
      box(g,-.04,roof+.01,0,1.3,.045,W-.22,paint);
      if(suv){for(const z of [-.72,.72])box(g,-.06,roof+.07,z,1.65,.06,.06,dark);box(g,-L/2-.04,.91,0,.1,.14,1.1,alloy);}
      if(sporty){box(g,-1.93,1.02,0,.31,.08,W+.09,dark);for(const z of [-.69,.69])box(g,-1.88,.88,z,.06,.27,.06,dark);box(g,.18,1.0,0,3.9,.012,.19,material(0x262d2b,.5,.4));}
    }
    for(const s of [-1,1]){
      box(g,L/2+.015,.68,s*(W*.34),.06,.16,.39,headlamp);
      box(g,-L/2-.015,.7,s*(W*.35),.06,.15,.32,red);
      box(g,.86,1.07,s*(W/2+.13),.26,.14,.19,paint);
    }
    box(g,L/2+.035,.58,0,.045,.2,W*.48,dark);
    for(let j=0;j<4;j++)box(g,L/2+.062,.52+j*.042,0,.023,.014,W*.45,alloy,.002);
    box(g,L/2+.04,.4,0,.08,.07,W*.91,alloy);
    box(g,-L/2-.04,.43,0,.07,.07,W*.9,alloy);
    box(g,-L/2-.09,.65,0,.016,.13,.31,material(0xe4e2d1));
  }
  if(id==='bus'||id==='tractor')for(const z of [-W*.32,W*.32])box(g,L/2+.04,.86,z,.08,.15,.24,headlamp);
  g.updateMatrixWorld(true);
  const batches=new Map<THREE.Material,THREE.BufferGeometry[]>();
  g.traverse(child=>{if(child instanceof THREE.Mesh){const m=child.material as THREE.Material;if(!batches.has(m))batches.set(m,[]);batches.get(m)!.push((child.geometry.index?child.geometry.toNonIndexed():child.geometry.clone()).applyMatrix4(child.matrixWorld));}});
  const optimized=new THREE.Group();optimized.name=id;optimized.userData={id,spec};
  for(const [mat,geometries] of batches){const merged=mergeGeometries(geometries);geometries.forEach(geo=>geo.dispose());if(merged){const part=new THREE.Mesh(merged,mat);part.castShadow=true;part.receiveShadow=true;optimized.add(part);}}
  models.set(modelKey,optimized);return optimized.clone();
}
