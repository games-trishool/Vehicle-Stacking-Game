import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
const goldenBonusUrl=new URL('../05_rare_golden_bonus_hypercar.glb',import.meta.url).href;

import {SPECS,VEHICLE_SPECS,BONUS_SPECS} from './vehicle-specs.mjs';
export {SPECS};
export type VehicleId=keyof typeof SPECS|keyof typeof BONUS_SPECS;
const goldenDamageZones={
  windshield:{center:[.76,1.12,0],right:[0,0,-1],up:[-.91,.415,0],width:1.20,height:.76},
  roof:{center:[-.28,1.34,0],halfSize:[1.05,.08,.68]},
  doors:[-1,1].map(side=>({center:[-.02,.79,side*1.02],halfSize:[.83,.31,.045],side})),
};
// All shapes and textures are original, generated once, then shared by every clone.
const geometries=new Map<string,THREE.BufferGeometry>();
function cached(key:string,build:()=>THREE.BufferGeometry){if(!geometries.has(key))geometries.set(key,build());return geometries.get(key)!;}
const materials=new Map<string,THREE.MeshPhysicalMaterial>();
function material(color:number,metalness=.0,roughness=.55,clearcoat=0){
  const key=`${color}/${metalness}/${roughness}/${clearcoat}`;
  if(!materials.has(key))materials.set(key,new THREE.MeshPhysicalMaterial({color,metalness,roughness,clearcoat,clearcoatRoughness:.22,envMapIntensity:.85}));
  return materials.get(key)!;
}
const rubber=material(0x1c1d1b,0,.91),alloy=material(0xaeb5b9,.88,.29),dark=material(0x171c1e,.16,.53),
  glass=material(0x27343b,.12,.085,.95),lamp=material(0xdbe4e8,.12,.20,.7),red=material(0x760b15,.08,.24,.65),
  brake=material(0x4f5459,.82,.54),seam=material(0x15191b,.1,.6);
const goldEdge=material(0xffc24b,.78,.20,.9);goldEdge.emissive.setHex(0x9c3e00);goldEdge.emissiveIntensity=.32;
const carbonFiber=(()=>{
  const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const ctx=canvas.getContext('2d')!;
  ctx.fillStyle='#111417';ctx.fillRect(0,0,128,128);
  for(let y=-16;y<144;y+=8)for(let x=-16;x<144;x+=8){
    ctx.fillStyle='#24292b';ctx.fillRect(x+(y%16?4:0),y,4,3);
    ctx.fillStyle='#090b0d';ctx.fillRect(x+(y%16?4:0)+4,y+3,4,3);
    ctx.fillStyle='#1a1e20';ctx.fillRect(x+(y%16?0:4),y+4,4,3);
  }
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;map.wrapS=map.wrapT=THREE.RepeatWrapping;map.repeat.set(5,2);
  return new THREE.MeshPhysicalMaterial({map,color:0xd1d0c8,metalness:.48,roughness:.38,clearcoat:.48,clearcoatRoughness:.3,envMapIntensity:.95});
})();
glass.userData.vehicleSurface='glass';glass.envMapIntensity=1.42;
glass.ior=1.52;
glass.color.setHex(0x172c39);
alloy.color.setHex(0xd8dfe5);
alloy.roughness=.16;
alloy.envMapIntensity=1.3;
// Tinted laminated glazing keeps reflections while revealing subdued cabin silhouettes.
glass.transparent=true;glass.opacity=.85;glass.depthWrite=true;
lamp.emissive.setHex(0xdcefff);lamp.emissiveIntensity=.38;
red.color.setHex(0xd01222);red.emissive.setHex(0xc90812);red.emissiveIntensity=.25;
let finishGrain:THREE.CanvasTexture|undefined,lensGrain:THREE.CanvasTexture|undefined;
function paintFinish(mat:THREE.MeshPhysicalMaterial){
  mat.userData.vehicleSurface='paint';
  mat.roughness=.255;
  mat.clearcoat=1;
  mat.clearcoatRoughness=.065;
  mat.envMapIntensity=1.48;
  return addPaintGrain(mat);
}
function addPaintGrain(mat:THREE.MeshPhysicalMaterial){
  if(!finishGrain){
    const canvas=document.createElement('canvas');canvas.width=canvas.height=512;const c=canvas.getContext('2d')!,pixels=c.createImageData(512,512);let seed=7391;
    for(let i=0;i<pixels.data.length;i+=4){seed=(Math.imul(seed,1664525)+1013904223)|0;const n=205+(seed>>>24)%40;pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=n;pixels.data[i+3]=255;}
    c.putImageData(pixels,0,0);finishGrain=new THREE.CanvasTexture(canvas);finishGrain.wrapS=finishGrain.wrapT=THREE.RepeatWrapping;finishGrain.repeat.set(5,5);finishGrain.anisotropy=8;
  }
  mat.roughnessMap=finishGrain;mat.bumpMap=finishGrain;mat.bumpScale=.00065;return mat;
}
function headlightFinish(){
  if(lensGrain)return;
  const canvas=document.createElement('canvas');canvas.width=128;canvas.height=64;const c=canvas.getContext('2d')!;
  c.fillStyle='#a8a8a8';c.fillRect(0,0,128,64);
  for(let x=0;x<128;x+=5){c.fillStyle=x%10?'#e2e2e2':'#7b7b7b';c.fillRect(x,0,1,64);}
  for(let y=6;y<64;y+=11){c.fillStyle='#bcbcbc';c.fillRect(0,y,128,1);}
  lensGrain=new THREE.CanvasTexture(canvas);lensGrain.wrapS=lensGrain.wrapT=THREE.RepeatWrapping;lensGrain.repeat.set(2,2);lamp.bumpMap=lensGrain;lamp.bumpScale=.0012;
}
function mesh(g:THREE.Group,geo:THREE.BufferGeometry,mat:THREE.Material,x=0,y=0,z=0){
  const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;g.add(m);return m;
}
function box(g:THREE.Group,x:number,y:number,z:number,w:number,h:number,d:number,mat:THREE.Material,r=.025){
  return mesh(g,cached(`box/${w}/${h}/${d}/${r}`,()=>r===0||Math.max(w,h,d)<.40||Math.min(w,h,d)<.025?new THREE.BoxGeometry(w,h,d):new RoundedBoxGeometry(w,h,d,1,Math.min(r,w/4,h/4,d/4))),mat,x,y,z);
}
function line(g:THREE.Group,points:number[][],mat:THREE.Material,r=.009){
  const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p as [number,number,number])));
  const geo=new THREE.TubeGeometry(curve,Math.max(4,points.length*3),r,5,false);
  const m=mesh(g,geo,mat);m.userData.temporaryGeometry=true;return m;
}
function rod(g:THREE.Group,a:number[],b:number[],radius:number,mat:THREE.Material){
  const start=new THREE.Vector3(...a as [number,number,number]),end=new THREE.Vector3(...b as [number,number,number]);
  const m=mesh(g,cached(`rod/${radius}/${start.distanceTo(end)}`,()=>new THREE.CylinderGeometry(radius,radius,start.distanceTo(end),8)),mat);
  m.position.copy(start).add(end).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),end.sub(start).normalize());
}
function surfacePanel(g:THREE.Group,points:number[][],mat:THREE.Material,side:number,z:number){
  const shape=new THREE.Shape(),coords=side<0?points.map(([x,y])=>[-x,y]):points;
  shape.moveTo(coords[0][0],coords[0][1]);for(let i=1;i<coords.length;i++)shape.lineTo(coords[i][0],coords[i][1]);shape.closePath();
  const panel=mesh(g,new THREE.ShapeGeometry(shape,16),mat,0,0,side*z);if(side<0)panel.rotation.y=Math.PI;return panel;
}
type Section={x:number;ring:number[][]};
function loft(sections:Section[]){
  const vertices:number[]=[],indices:number[]=[],count=sections[0].ring.length;
  sections.forEach(({x,ring})=>ring.forEach(([y,z])=>vertices.push(x,y,z)));
  for(let i=0;i<sections.length-1;i++)for(let j=0;j<count;j++){
    const a=i*count+j,b=(i+1)*count+j,c=(i+1)*count+(j+1)%count,d=i*count+(j+1)%count;
    indices.push(a,c,b,a,d,c);
  }
  for(const end of [0,sections.length-1]){
    const {x,ring}=sections[end],center=vertices.length/3;
    vertices.push(x,ring.reduce((n,p)=>n+p[0],0)/count,0);
    for(let j=0;j<count;j++){const a=end*count+j,b=end*count+(j+1)%count;indices.push(...(end===0?[center,b,a]:[center,a,b]));}
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(vertices.flatMap((_,i)=>i%3===0?[vertices[i],vertices[i+2]]:[]),2));geo.setIndex(indices);geo.computeVertexNormals();return geo;
}
function interpolate(points:number[][],x:number){
  for(let i=1;i<points.length;i++)if(x<=points[i][0]){const [a,va]=points[i-1],[b,vb]=points[i];return THREE.MathUtils.lerp(va,vb,THREE.MathUtils.smoothstep(x,a,b));}
  return points[points.length-1][1];
}
function treadTexture(){
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;const c=canvas.getContext('2d')!;
  c.fillStyle='#b0b0b0';c.fillRect(0,0,512,128);c.strokeStyle='#343434';c.lineWidth=3;
  for(const y of [40,54,74,88]){c.beginPath();c.moveTo(0,y);c.lineTo(512,y);c.stroke();}
  c.lineWidth=2;for(let x=-16;x<528;x+=16){c.beginPath();c.moveTo(x,28);c.lineTo(x+11,64);c.lineTo(x,100);c.stroke();}
  c.fillStyle='#999';c.font='bold 9px sans-serif';c.fillText('ROADSPORT 225/45  •  RADIAL TUBELESS',20,16);
  const texture=new THREE.CanvasTexture(canvas);texture.wrapS=THREE.RepeatWrapping;texture.wrapT=THREE.RepeatWrapping;return texture;
}
function wheel(g:THREE.Group,x:number,z:number,r:number,style:'road'|'tractor'|'patrol'='road',spokePairs=7){
  const tractor=style==='tractor';
  if(!rubber.bumpMap){rubber.bumpMap=treadTexture();rubber.bumpScale=.014;}
  const w=new THREE.Group();w.position.set(x,r,z);g.add(w);
  const width=tractor?(r>.6?.35:.27):r>.4?.25:.23;
  const tire=cached(`tire/${r}/${width}`,()=>{
    const profile=[[.64,-.44],[.82,-.5],[.94,-.46],[.99,-.34],[1,-.22],[1,.22],[.99,.34],[.94,.46],[.82,.5],[.64,.44]];
    const geo=new THREE.LatheGeometry(profile.map(([radius,depth])=>new THREE.Vector2(radius*r,depth*width)),48);geo.rotateX(Math.PI/2);return geo;
  });mesh(w,tire,rubber);
  const cylinder=(radius:number,depth:number,mat:THREE.Material,z:number)=>{const m=mesh(w,cached(`cylinder/${radius}/${depth}`,()=>new THREE.CylinderGeometry(radius,radius,depth,32)),mat,0,0,z);m.rotation.x=Math.PI/2;return m;};
  cylinder(r*.63,width*.86,dark,0);
  for(const side of [-1,1]){
    const face=side*(width*.49);
    if(style==='patrol'){
      cylinder(r*.65,.032,dark,face);
      cylinder(r*.52,.035,brake,face+side*.014);
      for(let slot=0;slot<10;slot++){
        const angle=slot*Math.PI/5;
        const recess=cylinder(r*.069,.008,dark,face+side*.034);
        recess.position.x=r*.402*Math.cos(angle);
        recess.position.y=r*.402*Math.sin(angle);
      }
      cylinder(r*.225,.054,alloy,face+side*.038);
      continue;
    }
    if(tractor){
      // A pressed steel dish carries the axle hub on an agricultural wheel.
      cylinder(r*.65,.036,brake,face);
      cylinder(r*.49,.041,fleetWhite,face+side*.019);
      cylinder(r*.20,.067,brake,face+side*.048);
      for(let bolt=0;bolt<6;bolt++){
        const angle=bolt*Math.PI/3;
        const nut=cylinder(r*.034,.025,alloy,face+side*.053);
        nut.position.x=r*.30*Math.cos(angle);
        nut.position.y=r*.30*Math.sin(angle);
      }
      continue;
    }
    cylinder(r*.51,.015,brake,face);
    // Drilled rotor vents and a finer machined lip catch highlights through the spokes.
    for(let j=0;j<10;j++){
      const a=j*Math.PI/5,hole=cylinder(r*.018,.008,dark,face+side*.009);
      hole.position.set(Math.sin(a)*r*.42,Math.cos(a)*r*.42,face+side*.009);
    }
    const rim=mesh(w,cached(`lip/${r}`,()=>new THREE.TorusGeometry(r*.635,.016,8,48)),alloy,0,0,face+side*.016);
    rim.rotation.z=Math.PI/10;
    for(let j=0;j<spokePairs;j++){
      const a=j*Math.PI*2/spokePairs;
      for(const split of [-1,1]){const angle=a+split*.095;const spoke=box(w,Math.sin(angle)*r*.345,Math.cos(angle)*r*.345,face+side*.027,.026,r*.57,.022,alloy,.006);spoke.rotation.z=-angle;}
      cylinder(r*.022,.024,alloy,face+side*.045);
      const lug=w.children[w.children.length-1];lug.position.x=Math.sin(a)*r*.13;lug.position.y=Math.cos(a)*r*.13;
    }
    cylinder(r*.13,.04,alloy,face+side*.03);
    box(w,r*.39,0,face-side*.013,r*.13,r*.37,.035,dark,.012);
  }
  if(tractor)for(let j=0;j<20;j++)for(const side of [-1,1]){
    const a=j*Math.PI/10;const lug=box(w,Math.sin(a)*(r-.008),Math.cos(a)*(r-.008),side*width*.22,.09,.055,width*.6,rubber,.012);
    lug.rotation.z=-a;lug.rotateY(side*.45);
  }
}
function body(g:THREE.Group,id:VehicleId,paint:THREE.Material,wheelRadius:number){
  const s=VEHICLE_SPECS[id],L=s.length,W=s.width,sport=id==='sports'||id==='gold',bus=id==='bus';
  const stations=bus?[[-L/2,2.28],[-L*.44,2.47],[L*.42,2.47],[L/2,2.27]]:
    id==='truck'?[[-L/2,.78],[-.53,.81],[-.39,1.09],[1.24,1.09],[1.96,1.01],[L/2,.85]]:
    id==='sports'?[[-L/2,.76],[-L*.32,.96],[-.60,.89],[.59,.90],[L*.31,.915],[L*.43,.78],[L/2,.62]]:
    sport?[[-L/2,.72],[-L*.35,.93],[.45,.88],[L*.36,.82],[L/2,.63]]:
    id==='suv'?[[-L/2,1.08],[-L*.40,1.18],[.82,1.16],[L*.40,1.09],[L/2,.93]]:
    [[-L/2,.78],[-L*.37,1.01],[.5,1.02],[L*.37,.94],[L/2,.74]];
  mesh(g,cached(`body/${id}`,()=>{
    const sections:Section[]=[];
    for(let i=0;i<=128;i++){
      const t=i/128,x=(t-.5)*L,top=interpolate(stations,x);
      const waist=id==='sports'?1-.036*Math.exp(-4*x*x):1;
      // Transit body sides stay straight through the passenger window bays.
      const widthFactor=bus?.97+.03*Math.min(t,1-t,.07)/.07:.84+.16*Math.pow(Math.sin(Math.PI*t),.45);
      const half=W*.5*widthFactor*waist;
      const radius=wheelRadius;let edge=sport?.34:.43;
      for(const axle of [-L*.31,L*.31]){const dx=x-axle;if(Math.abs(dx)<radius+.055)edge=Math.max(edge,radius+Math.sqrt((radius+.055)**2-dx*dx));}
      edge=Math.min(edge,top-.045);
      // A curved shoulder and a tucked lower door catch two distinct highlights.
      const depth=top-edge;
      const halfRing=[[top,0],[top-Math.min(.009,depth*.05),half*.48],[top-Math.min(.018,depth*.12),half*.66],
        [top-Math.min(.048,depth*.24),half*.88],[top-Math.min(.086,depth*.34),half*.965],
        [top-Math.min(.14,depth*.48),half],[edge+depth*.24,half*.981],
        [edge,half*.96],[edge,half*.91],[sport?.29:.34,half*.67],[sport?.29:.34,0]];
      sections.push({x,ring:[...halfRing,...halfRing.slice(1,-1).reverse().map(([y,z])=>[y,-z])]});
    }return loft(sections);
  }),paint);
  box(g,0,.34,0,L*.88,.13,W*.62,dark,.045);
  for(const side of [-1,1]){
    line(g,[[-L*.42,.43,side*W*.463],[0,.40,side*W*.495],[L*.42,.43,side*W*.463]],dark,.035);
    for(const axle of [-L*.31,L*.31]){
      const arch=mesh(g,cached(`arch/${id}`,()=>new THREE.TorusGeometry(wheelRadius+.057,id==='suv'?.035:.016,6,32,Math.PI)),id==='suv'?dark:paint,axle,wheelRadius,side*(W*.5+.003));
      arch.rotation.z=0;
    }
  }
}
type Cabin={rear:number;rearRoof:number;frontRoof:number;front:number;base:number;roof:number;width:number};
function cabin(g:THREE.Group,c:Cabin,paint:THREE.Material,key:string){
  g.userData.cabin={...c};
  const {rear,front,rearRoof,frontRoof,base,roof,width}=c;
  const heightAt=(x:number)=>interpolate([[rear,base+.025],[rearRoof,roof-.025],[(rearRoof+frontRoof)/2,roof],[frontRoof,roof-.035],[front,base+.025]],x);
  mesh(g,cached(`glass/${key}`,()=>{
    const sections:Section[]=[];for(let i=0;i<=36;i++){
      const x=THREE.MathUtils.lerp(rear,front,i/36),top=heightAt(x),hw=width*.475;
      sections.push({x,ring:[[top,0],[top-.012,hw*.6],[Math.max(base+.015,top-.055),hw*.82],[base,hw],[base-.01,0],[base,-hw],[Math.max(base+.015,top-.055),-hw*.82],[top-.012,-hw*.6]]});
    }return loft(sections);
  }),glass);
  mesh(g,cached(`roof/${key}`,()=>{
    const sections:Section[]=[];for(let i=0;i<=24;i++){
      const x=THREE.MathUtils.lerp(rearRoof-.035,frontRoof+.025,i/24),top=heightAt(x)+.012,w=width*.398;
      sections.push({x,ring:[[top+.018,0],[top,w*.8],[top-.02,w],[top-.055,w],[top-.045,0],[top-.055,-w],[top-.02,-w],[top,-w*.8]]});
    }return loft(sections);
  }),paint);
  for(const side of [-1,1]){
    rod(g,[front,base,side*width*.479],[frontRoof,roof-.04,side*width*.397],.035,paint);
    rod(g,[rear,base,side*width*.479],[rearRoof,roof-.04,side*width*.397],.055,paint);
    const pillar=THREE.MathUtils.lerp(rearRoof,frontRoof,key==='car'?.18:key==='truck'?.09:.56);
    rod(g,[pillar,base,side*width*.478],[pillar,heightAt(pillar)-.045,side*width*.399],.029,dark);
    line(g,[[rear,base,side*width*.48],[(rear+front)/2,base-.015,side*width*.485],[front,base,side*width*.48]],alloy,.012);
  }
  // Seats and a dashboard read as dark silhouettes through the tinted glazing.
  const seatX=THREE.MathUtils.lerp(rearRoof,frontRoof,.42),seatY=base+.06,seatHeight=Math.min(.42,(roof-base)*.67);
  for(const side of [-1,1]){
    box(g,seatX,seatY,side*width*.235,.35,.12,width*.27,dark,.025);
    const back=box(g,seatX-.15,seatY+seatHeight*.4,side*width*.235,.095,seatHeight*.78,width*.26,dark,.025);back.rotation.z=-.08;
    box(g,seatX-.15,seatY+seatHeight*.90,side*width*.235,.08,seatHeight*.25,width*.13,dark,.02);
  }
  box(g,front-.23,base+.025,0,.22,.13,width*.78,dark,.025);
  const dx=front-frontRoof,dy=roof-.035-(base+.025),slope=Math.sqrt(dx*dx+dy*dy);
  // Rubber glazing seals, washer nozzles and paired wipers fit the front slope.
  for(const side of [-1,1]){
    const lowerX=front-dx*.14,lowerY=heightAt(lowerX)+.018,z=side*width*.22;
    line(g,[[lowerX,lowerY,z-side*.19],[lowerX-dx*.10,lowerY+dy*.10,z+side*.13]],dark,.012);
    rod(g,[lowerX-dx*.02,lowerY+dy*.015,z],[lowerX-dx*.08,lowerY+dy*.08,z+side*.15],.009,dark);
    box(g,front+.026,base-.014,side*width*.23,.035,.016,.028,dark,.004);
  }
  const sealPoints:number[][]=[];
  for(let j=0;j<=12;j++){const t=j/12,z=THREE.MathUtils.lerp(-width*.435,width*.435,t),xx=front-dx*.035;sealPoints.push([xx,heightAt(xx)-Math.abs(z/width)*.065+.013,z]);}
  line(g,sealPoints,dark,Math.min(.016,slope*.018));
}
const fleetWhite=material(0xfffaf1,.12,.42,.45),fleetBlue=material(0x075bbd,.18,.26,.85),
 reflective=material(0xffdc62,.15,.35),orange=material(0xff6918,.26,.42,.45),roofBlack=material(0x121d31,.18,.38,.65);
fleetBlue.emissive.setHex(0x064c9c);fleetBlue.emissiveIntensity=.22;
const labelMaterials=new Map<string,THREE.Material>();
function fleetLabel(g:THREE.Group,text:string,x:number,y:number,z:number,w:number,h:number,side:number){
 if(!labelMaterials.has(text)){
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=96;
  const c=canvas.getContext('2d')!;c.clearRect(0,0,512,96);c.fillStyle='#ffffff';c.font='bold 64px Arial';c.textAlign='center';c.textBaseline='middle';c.fillText(text,256,49,494);
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
  labelMaterials.set(text,new THREE.MeshPhysicalMaterial({map,transparent:true,alphaTest:.15,roughness:.45,depthWrite:false}));
 }
 const decal=mesh(g,cached(`label/${w}/${h}`,()=>new THREE.PlaneGeometry(w,h)),labelMaterials.get(text)!,x,y,z);
 if(side<0)decal.rotation.y=Math.PI;
 return decal;
}
function lightbar(g:THREE.Group,x:number,y:number,width:number){
 box(g,x,y,0,.28,.07,width,dark,.025);
 for(const side of [-1,1]){
  box(g,x,y+.08,side*width*.32,.26,.13,width*.30,side<0?red:fleetBlue,.04);
  for(let j=0;j<3;j++)box(g,x+.14,y+.08,side*width*.32+(j-1)*width*.075,.008,.072,.032,lamp,.003);
 }
}
function fleetCab(g:THREE.Group,id:VehicleId,paint:THREE.Material){
 const {length:L,width:W}=VEHICLE_SPECS[id],cx=L/2-.76;
 box(g,0,.59,0,L*.92,.27,W*.70,dark,.06);
 box(g,cx,1.03,0,1.42,.83,W*.95,paint,.10);
 cabin(g,{rear:cx-.71,rearRoof:cx-.63,frontRoof:cx+.37,front:cx+.70,base:1.38,roof:2.34,width:W*.94},paint,id);
 box(g,cx-.1,2.37,0,1.13,.06,W*.77,paint,.04);
 for(const side of [-1,1]){
  box(g,cx-.45,1.26,side*W*.481,.25,.035,.035,alloy,.006);
  line(g,[[cx-.65,.73,side*W*.48],[cx-.65,1.35,side*W*.48]],seam,.008);
  rod(g,[cx+.36,1.70,side*W*.45],[cx+.31,1.70,side*(W/2+.18)],.023,alloy);
  box(g,cx+.31,1.72,side*(W/2+.18),.18,.29,.12,dark,.03);
  box(g,cx-.12,.62,side*(W/2-.04),.63,.075,.22,brake,.015);
 }
 const axles=id==='ambulance'?[-1.55,1.63]:[-1.82,-.68,1.84],radius=id==='ambulance'?.40:.44;
 for(const x of axles)for(const side of [-1,1]){
  wheel(g,x,side*(W/2-.13),radius);
  const arch=mesh(g,cached(`fleet-arch/${radius}`,()=>new THREE.TorusGeometry(radius+.045,.026,5,20,Math.PI)),dark,x,radius,side*(W/2+.005));
  arch.rotation.z=0;
 }
 box(g,L/2+.015,1.08,0,.035,.28,W*.55,dark,.025);
 for(let j=0;j<5;j++)box(g,L/2+.04,.97+j*.045,0,.014,.013,W*.49,alloy,.003);
}
function fleetVehicle(g:THREE.Group,id:VehicleId,paint:THREE.Material){
 const {width:W}=VEHICLE_SPECS[id];
 if(id==='police'){
  for(const x of [-1.395,1.395])for(const side of [-1,1])wheel(g,x,side*(W/2-.115),.38,'patrol');
  body(g,'car',paint,.38);cabin(g,{rear:-1.66,rearRoof:-.90,frontRoof:.42,front:1.26,base:.98,roof:1.545,width:W},roofBlack,id);
  mesh(g,cached('police-hood',()=>{
   const sections:Section[]=[];
   for(let j=0;j<=12;j++){
    const x=1.26+j*.87/12,t=(x+2.25)/4.5,top=interpolate([[.5,1.02],[1.665,.94],[2.25,.74]],x)+.009,half=W*.5*(.84+.16*Math.pow(Math.sin(Math.PI*t),.45));
    sections.push({x,ring:[[top,0],[top-.018,half*.66],[top-.065,half*.90],[top-.075,half*.90],[top-.01,0],[top-.075,-half*.90],[top-.065,-half*.90],[top-.018,-half*.66]]});
   }
   return loft(sections);
  }),roofBlack);
  const barX=-.13;
  box(g,barX,1.604,0,.24,.048,1.31,dark,.019);
  box(g,barX,1.671,0,.22,.034,1.28,brake,.012);
  for(const side of [-1,1]){
   box(g,barX,1.575,side*.42,.14,.05,.12,rubber,.01);
   for(let pod=0;pod<4;pod++)box(g,barX,1.64,side*(.10+pod*.149),.22,.062,.136,side<0?red:fleetBlue,.012);
   const flank=side*(W/2+.009);
   box(g,-.12,.79,flank,2.00,.25,.019,roofBlack,.02);
   box(g,-.12,.652,flank,2.00,.017,.018,fleetBlue,.005);
   fleetLabel(g,'POLICE',.32,.79,flank+side*.016,.92,.19,side);
   fleetLabel(g,'24',-.68,.79,flank+side*.016,.28,.15,side);
   for(const [topX,bottomX] of [[-1.12,-.94],[-.16,-.18],[1.03,.91]]){
    line(g,[[topX,.965,side*.884],[topX,.78,flank+side*.012],[bottomX,.49,side*.903]],seam,.007);
   }
   for(const x of [-.94,-.045])box(g,x,.92,flank,.155,.033,.028,dark,.008);
   rod(g,[.84,1.10,side*.85],[.84,1.12,side*1.02],.022,dark);box(g,.84,1.16,side*1.03,.24,.12,.13,dark,.025);
   box(g,2.298,.565,side*.29,.022,.041,.13,side<0?red:fleetBlue,.007);
  }
  box(g,-.75,1.554,0,.12,.032,.092,rubber,.009);
  rod(g,[-.75,1.56,0],[-.82,1.72,0],.010,dark);
  return;
 }
 if(id==='rickshaw'){
  const green=paintFinish(material(0x00ac68,.42,.26,.9)),canopy=material(0x202624,0,.89);
  canopy.userData.vehicleSurface='panel';
  for(const side of [-1,1])wheel(g,-.95,side*.64,.34);wheel(g,1.13,0,.32);
  box(g,-.36,.51,0,2.22,.20,1.19,dark,.06);
  box(g,-.93,.80,0,1.08,.55,1.43,green,.12);
  box(g,-.88,1.105,0,.61,.15,1.21,canopy,.07);
  box(g,-1.17,1.32,0,.15,.44,1.19,canopy,.06).rotation.z=.10;
  box(g,.30,.70,0,.32,.28,.38,dark,.04);
  box(g,.32,.86,0,.44,.13,.57,canopy,.055);
  box(g,.13,1.01,0,.10,.32,.51,canopy,.04);
  box(g,1.20,.99,0,.66,.68,1.06,paint,.15);
  // A single raked windshield leaves the driver and passenger entry open.
  const screen={rear:.86,rearRoof:.87,frontRoof:1.07,front:1.47,base:1.28,roof:2.015,width:1.23};
  g.userData.cabin=screen;
  const rake=Math.atan2(screen.front-screen.frontRoof,screen.roof-screen.base);
  const paneHeight=Math.hypot(screen.front-screen.frontRoof,screen.roof-screen.base);
  box(g,1.27,1.648,0,.024,paneHeight,1.17,glass,.012).rotation.z=rake;
  rod(g,[screen.front,screen.base,-.585],[screen.front,screen.base,.585],.028,dark);
  rod(g,[screen.frontRoof,screen.roof,-.585],[screen.frontRoof,screen.roof,.585],.025,dark);
  line(g,[[1.47,1.36,-.36],[1.43,1.45,-.16],[1.40,1.51,.24]],dark,.011);
  // Crown the cloth over its bows and roll the lower edge over the frame.
  mesh(g,cached('rickshaw-canvas',()=>loft([
    [-1.51,.61,2.045],[-1.40,.70,2.115],[-1.04,.73,2.15],[-.47,.73,2.135],
    [.03,.73,2.155],[.53,.72,2.14],[.96,.70,2.14],[1.16,.63,2.07]
  ].map(([x,w,y])=>({x,ring:[[y,0],[y-.015,w*.67],[y-.055,w*.94],[y-.15,w],
    [y-.16,w*.96],[y-.055,0],[y-.16,-w*.96],[y-.15,-w],[y-.055,-w*.94],[y-.015,-w*.67]]})))),canopy);
  mesh(g,cached('rickshaw-mudguard',()=>loft(Array.from({length:25},(_,i)=>{
    const a=Math.PI*(.10+.80*i/24),x=1.13-.38*Math.cos(a),y=.32+.38*Math.sin(a);
    return {x,ring:[[y+.025,0],[y+.014,.106],[y-.026,.14],[y-.045,.125],[y-.008,0],[y-.045,-.125],[y-.026,-.14],[y+.014,-.106]]};
  }))),green);
  for(const side of [-1,1]){
   for(const x of [-1.44,.58])rod(g,[x,.92,side*.64],[x,2.03,side*.64],.027,dark);
   rod(g,[-1.43,1.44,side*.67],[-.52,1.44,side*.67],.022,alloy);
   rod(g,[-.52,1.44,side*.67],[-.43,1.10,side*.67],.022,alloy);
   rod(g,[screen.front,screen.base,side*.585],[screen.frontRoof,screen.roof,side*.585],.032,paint);
   box(g,-.91,1.065,side*.705,1.0,.07,.025,paint,.01);
   box(g,-.05,.44,side*.655,.68,.065,.18,brake,.022);
   box(g,-1.49,.88,side*.47,.025,.15,.12,red,.016);
   rod(g,[1.13,.32,side*.13],[.96,.95,side*.13],.029,alloy);
   rod(g,[.83,1.55,side*.45],[.83,1.58,side*.86],.018,dark);box(g,.83,1.61,side*.86,.13,.16,.06,dark,.02);
  }
  rod(g,[.64,.81,0],[.89,1.40,0],.024,dark);rod(g,[.89,1.40,-.23],[.89,1.40,.23],.025,dark);
  const bezel=mesh(g,cached('rickshaw-headlight-rim',()=>new THREE.TorusGeometry(.129,.016,8,28)),alloy,1.556,1.13,0);
  bezel.rotation.y=Math.PI/2;
  const headlight=mesh(g,cached('rickshaw-headlight',()=>new THREE.SphereGeometry(1,24,12)),lamp,1.548,1.13,0);
  headlight.scale.set(.036,.122,.122);
  box(g,1.57,.73,0,.04,.11,.35,fleetWhite,.01);return;
 }
 fleetCab(g,id,paint);
 if(id==='ambulance'){
  box(g,-.68,1.73,0,3.76,1.68,W*.97,paint,.07);
  // The rounded module cap tapers down over the cab roof.
  mesh(g,cached('ambulance-roof-cap',()=>loft([
   [-2.56,2.51,.94],[-2.46,2.60,1.00],[.98,2.60,1.00],[1.18,2.57,.97],[1.53,2.40,.81]
  ].map(([x,y,w])=>({x,ring:[[y,0],[y-.008,w*.89],[y-.055,w],[y-.12,w],
   [y-.12,-w],[y-.055,-w],[y-.008,-w*.89]]})))),paint);
  box(g,-.74,2.617,0,.75,.035,.67,fleetWhite,.025);
  for(let slat=0;slat<6;slat++)box(g,-.98+slat*.091,2.637,0,.041,.008,.46,brake,.004);
  lightbar(g,1.83,2.43,1.38);
  for(const side of [-1,1]){
   const z=side*(W*.49+.015);
   // The skirt follows the rear tire, leaving a clear opening at full wheel height.
   const skirt=cached('ambulance-skirt',()=>{
    const outline=new THREE.Shape();
    outline.moveTo(-2.53,.94);outline.lineTo(-2.53,.57);
    outline.lineTo(-1.98,.57);outline.quadraticCurveTo(-1.55,1.19,-1.12,.57);
    outline.lineTo(1.16,.57);outline.lineTo(1.16,.94);outline.closePath();
    return new THREE.ExtrudeGeometry(outline,{depth:.065,bevelEnabled:false,curveSegments:14});
   });
   mesh(g,skirt,paint,0,0,side>0?W*.478-.065:-W*.478);
   box(g,-.68,1.24,z,3.73,.20,.025,orange,.003);box(g,-.68,1.08,z,3.73,.035,.028,reflective,.002);
   box(g,-.68,1.63,z,3.18,.29,.025,fleetBlue,.006);
   const windowX=side>0?.65:-1.44;
   box(g,windowX,2.12,z,.66,.47,.026,dark,.04);
   box(g,windowX,2.12,z+side*.018,.60,.41,.019,glass,.03);
   box(g,-.48,2.11,z,.63,.48,.030,fleetBlue,.025);
   box(g,-.48,2.11,z+side*.02,.33,.10,.012,fleetWhite,.004);box(g,-.48,2.11,z+side*.02,.10,.33,.012,fleetWhite,.004);
   if(side>0){
    for(const edge of [.24,1.06])rod(g,[edge,.75,z+.018],[edge,2.40,z+.018],.008,seam);
    rod(g,[.24,2.40,z+.018],[1.06,2.40,z+.018],.008,seam);
    box(g,.65,.59,z,.81,.065,.16,brake,.014);
    box(g,.37,1.40,z+.023,.13,.05,.021,dark,.01);
   }else{
    for(const x of [-.56,.36]){
     box(g,x,.91,z,.85,.27,.022,brake,.014);
     box(g,x,.91,z-.014,.82,.24,.014,paint,.01);
     box(g,x,.95,z-.024,.115,.035,.015,dark,.008);
    }
   }
   fleetLabel(g,'AMBULANCE',-.68,1.63,z+side*.02,2.70,.20,side);
   for(const x of [-2.19,.82])box(g,x,2.49,z,.18,.07,.03,fleetBlue,.012);
  }
  box(g,-2.56,1.68,0,.034,1.59,W*.82,dark,.03);
  for(const side of [-1,1]){
   const doorZ=side*.425;
   box(g,-2.582,1.68,doorZ,.022,1.55,.832,paint,.02);
   box(g,-2.60,2.09,doorZ,.022,.46,.64,dark,.025);
   box(g,-2.616,2.09,doorZ,.014,.40,.58,glass,.02);
   box(g,-2.60,1.24,doorZ,.022,.20,.83,orange,.008);
   for(const y of [1.17,1.94])box(g,-2.60,y,side*.812,.035,.095,.068,alloy,.01);
   box(g,-2.60,1.46,side*.095,.035,.17,.055,dark,.01);
   box(g,-2.57,2.48,side*.80,.038,.092,.29,side<0?red:fleetBlue,.02);
  }
  box(g,-2.54,.71,0,.20,.095,W*.83,brake,.018);
 }else if(id==='fireengine'){
  box(g,-.81,1.66,0,3.77,1.49,W*.96,paint,.06);lightbar(g,1.90,2.43,1.43);
  for(const side of [-1,1]){
   const z=side*(W*.49+.012);
   box(g,-.81,1.03,z,3.75,.12,.024,reflective,.006);
   for(const x of [-1.95,-.88,.18]){
    box(g,x,1.70,z,.94,.91,.027,brake,.02);
    for(let j=0;j<9;j++)box(g,x,1.32+j*.09,z+side*.02,.88,.012,.012,alloy,.002);
    box(g,x,1.31,z+side*.028,.29,.035,.018,dark,.005);
   }
   fleetLabel(g,'FIRE RESCUE',-.83,2.29,z+side*.01,2.75,.14,side);
   rod(g,[-2.6,2.51,side*.38],[.91,2.51,side*.38],.035,alloy);
   const hose=mesh(g,cached('hose-reel',()=>new THREE.TorusGeometry(.28,.07,8,24)),dark,-2.15,1.35,z+side*.04);hose.rotation.z=0;
  }
  for(let x=-2.55;x<.95;x+=.27)rod(g,[x,2.51,-.38],[x,2.51,.38],.022,alloy);
  box(g,-2.72,1.65,0,.08,1.16,1.16,brake,.02);
  for(const z of [-.30,0,.30]){const pump=mesh(g,cached('pump-outlet',()=>new THREE.CylinderGeometry(.10,.10,.07,16)),alloy,-2.78,1.69,z);pump.rotation.z=Math.PI/2;}
 }else if(id==='dumptruck'){
  const bed=material(0x777867,.65,.52),gravel=material(0x655f50,.05,.98);
  box(g,-.87,1.19,0,3.66,.20,W*.94,bed,.025);
  for(const side of [-1,1]){
   box(g,-.87,1.94,side*(W/2-.055),3.67,1.31,.11,paint,.035);
   for(let j=0;j<6;j++)box(g,-2.47+j*.61,1.92,side*(W/2+.017),.065,1.20,.045,bed,.009);
   box(g,-.87,1.39,side*(W/2+.04),3.55,.055,.026,reflective,.004);
  }
  box(g,-2.65,1.95,0,.11,1.30,W*.97,paint,.035);box(g,.92,1.97,0,.11,1.34,W*.97,paint,.025);
  box(g,-.85,2.28,0,3.32,.23,W*.86,gravel,.10);
  for(let j=0;j<12;j++){
   const rock=mesh(g,cached('gravel-rock',()=>new THREE.DodecahedronGeometry(.17,0)),gravel,-2.27+(j%6)*.55,2.45+((j*7)%3)*.018,j<6?-.44:.40);rock.rotation.set(j*.7,j*.6,j*.4);
  }
  for(const side of [-1,1]){rod(g,[-.7,.83,side*.48],[.44,1.19,side*.48],.045,alloy);box(g,-2.73,1.34,side*.69,.10,.17,.12,dark,.01);}
 }else if(id==='mixer'){
  for(const x of [-1.85,.12])box(g,x,1.03,0,.20,.50,1.54,dark,.025);
  const drum=mesh(g,cached('concrete-drum',()=>{
   const profile=[[0,-1.61],[.32,-1.61],[.38,-1.35],[.78,-.91],[.91,-.45],[.92,.27],[.78,.83],[.49,1.32],[0,1.32]];
   const geo=new THREE.LatheGeometry(profile.map(([r,x])=>new THREE.Vector2(r,x)),40);geo.rotateZ(-Math.PI/2);return geo;
  }),orange,-.84,1.86,0);drum.rotation.z=.035;
  const spiral:number[][]=[];
  for(let j=0;j<=72;j++){
   const x=-1.34+j*2.56/72,r=interpolate([[-1.34,.40],[-.91,.79],[-.45,.92],[.27,.93],[.83,.79],[1.22,.54]],x),a=j/72*Math.PI*6;
   spiral.push([-.84+x,1.86+Math.cos(a)*r+x*.035,Math.sin(a)*r]);
  }
  line(g,spiral,fleetWhite,.043);
  box(g,-2.54,2.03,0,.35,.31,.68,orange,.04);
  const chute=box(g,-2.66,1.29,0,.27,.95,.40,brake,.04);chute.rotation.z=-.16;
  for(const side of [-1,1])rod(g,[-2.61,.72,side*.58],[-2.61,2.14,side*.58],.022,alloy);
  for(let y=.84;y<2.12;y+=.23)rod(g,[-2.64,y,.47],[-2.64,y,.68],.023,alloy);
 }
}
type DamageZone={center:number[];halfSize:number[]};
function damageZones(id:VehicleId,c?:Cabin){
  const s=VEHICLE_SPECS[id];
  const windshield=c?(()=>{
    const dx=c.front-c.frontRoof,dy=c.roof-c.base-.06,length=Math.hypot(dx,dy*1.5),up=[-dx/length,dy*1.5/length,0],normal=[up[1],-up[0],0];
    const x=(c.frontRoof+c.front)/2,y=(c.roof-.035+c.base+.025)/2;
    return{center:[x+normal[0]*.013,y+normal[1]*.013,0],right:[0,0,-1],up,width:c.width*.73,height:Math.hypot(dx,dy)*.74,cabin:{...c}};
  })():{center:[s.length/2+.046,1.87,0],right:[0,0,-1],up:[0,1,0],width:s.width*.72,height:.75};
  let roof:DamageZone=c?{center:[(c.rearRoof+c.frontRoof)/2,c.roof-.015,0],halfSize:[(c.frontRoof-c.rearRoof)/2+.10,.24,c.width*.43]}:
    {center:[0,2.49,0],halfSize:[s.length*.46,.25,s.width*.47]};
  if(id==='tractor')roof={center:[-.96,2.23,0],halfSize:[.82,.24,.86]};
  if(id==='ambulance')roof={center:[-.68,2.57,0],halfSize:[1.90,.28,s.width*.49]};
  if(id==='fireengine')roof={center:[-.81,2.49,0],halfSize:[1.90,.30,s.width*.49]};
  if(id==='dumptruck')roof={center:[-.87,2.40,0],halfSize:[1.88,.35,s.width*.49]};
  if(id==='mixer')roof={center:[-.84,2.55,0],halfSize:[1.48,.58,.94]};
  if(id==='rickshaw')roof={center:[-.18,2.08,0],halfSize:[1.34,.20,.73]};
  if(id==='gold')roof={center:[-.30,1.28,0],halfSize:[1.18,.19,.72]};
  const doors=[-1,1].map(side=>({center:c?[(c.rear+c.front)/2,c.base-.24,side*c.width*.48]:[1.63,1.20,side*s.width*.50],halfSize:c?[(c.front-c.rear)*.39,.27,.13]:[.33,.64,.12],side}));
  if(id==='rickshaw')for(const panel of doors){panel.center=[-.95,1.02,panel.side*.72];panel.halfSize=[.54,.27,.10];}
  return{windshield,roof,doors};
}
const models=new Map<string,THREE.Group>();
let goldenVehicleLoad:Promise<void>|undefined;
export function prepareGoldenBonusVehicle(){
  if(models.has('goldundefined'))return Promise.resolve();
  if(!goldenVehicleLoad)goldenVehicleLoad=new GLTFLoader().loadAsync(goldenBonusUrl).then(gltf=>{
    const model=new THREE.Group();
    model.name='gold';
    model.userData={id:'gold',spec:VEHICLE_SPECS.gold,damageZones:goldenDamageZones};
    // The asset is already batched by finish. Bake the pack's -Z nose into the
    // game's +X coordinates so damage edits and collision zones use the same axes.
    const orient=new THREE.Matrix4().makeRotationY(-Math.PI/2);
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse(part=>{
      if(!(part instanceof THREE.Mesh))return;
      const surface=part.material as THREE.MeshStandardMaterial;
      const kind=surface.name.startsWith('Metallic body')?'paint':surface.name.startsWith('Windshield')?'glass':'trim';
      const geometry=part.geometry.applyMatrix4(orient.clone().multiply(part.matrixWorld));
      surface.userData.vehicleSurface=kind;
      if(kind==='paint'&&surface instanceof THREE.MeshPhysicalMaterial){
        paintFinish(surface);
        surface.color.setHex(0xffb92f);
        surface.roughness=.20;
      }
      const panel=new THREE.Mesh(geometry,surface);
      panel.userData.surface=kind;
      panel.castShadow=panel.receiveShadow=true;
      panel.matrixAutoUpdate=false;
      model.add(panel);
    });
    models.set('goldundefined',model);
  }).catch(error=>{goldenVehicleLoad=undefined;console.error('Golden Apex model could not be loaded; using the procedural backup.',error);});
  return goldenVehicleLoad;
}
export function createVehicle(id:VehicleId,color?:number){
  const key=id+String(color);if(models.has(key))return models.get(key)!.clone();
  const s=VEHICLE_SPECS[id],g=new THREE.Group(),paint=paintFinish(material(color??s.color,id==='gold'?.64:.42,.26,1)),L=s.length,W=s.width;
  for(const panel of [fleetWhite,orange,roofBlack])paintFinish(panel);
  headlightFinish();
  if(['ambulance','police','rickshaw','fireengine','dumptruck','mixer'].includes(id)){
    fleetVehicle(g,id,paint);
  }else if(id==='tractor'){
    for(const x of [-1.16,1.16])for(const side of [-1,1])wheel(g,x,side*(x<0?.83:.78),x<0?.67:.46,'tractor');
    box(g,0,.60,0,3.35,.30,1.25,dark,.08);
    mesh(g,cached('tractor-bonnet',()=>loft([
      [-.46,1.40,.53],[-.21,1.47,.60],[.45,1.45,.60],[1.32,1.35,.56],[1.82,1.27,.49],[1.87,1.22,.47]
    ].map(([x,y,w])=>({x,ring:[[y,0],[y-.025,w*.80],[y-.09,w],[.84,w],[.75,w*.83],
      [.75,-w*.83],[.84,-w],[y-.09,-w],[y-.025,-w*.80]]})))),paint);
    cabin(g,{rear:-1.7,rearRoof:-1.56,frontRoof:-.32,front:-.12,base:1.08,roof:2.19,width:1.7},paint,id);
    box(g,-.96,2.23,0,1.6,.08,1.7,paint,.07);
    for(const side of [-1,1]){
      const fender=cached('tractor-rear-fender',()=>{
        const arch=new THREE.Shape();
        arch.absarc(0,0,.746,.36,Math.PI-.36,false);
        arch.absarc(0,0,.704,Math.PI-.36,.36,true);
        arch.closePath();
        return new THREE.ExtrudeGeometry(arch,{depth:.40,curveSegments:16,bevelEnabled:false});
      });
      mesh(g,fender,paint,-1.16,.67,side*.83-.20);
      box(g,-1.60,1.28,side*.83,.14,.085,.20,red,.018);
      box(g,-.65,.69,side*.80,.70,.08,.35,brake,.01);
      box(g,-.65,.88,side*.72,.58,.08,.28,brake,.01);
      rod(g,[-.2,1.1,side*.64],[-.2,1.8,side*.64],.019,alloy);
      // Lower lift arms and their links meet behind the differential.
      rod(g,[-1.27,.54,side*.39],[-1.91,.39,side*.51],.045,brake);
      rod(g,[-1.39,.95,side*.44],[-1.72,.44,side*.47],.032,alloy);
      box(g,.65,1.12,side*.583,.76,.21,.032,dark,.025);
      for(let vent=0;vent<6;vent++)box(g,.36+vent*.104,1.12,side*.603,.028,.154,.018,brake,.005).rotation.z=-.22;
      box(g,-.96,2.20,side*.79,.24,.096,.095,dark,.02);
      rod(g,[-.34,1.84,side*.69],[-.25,1.87,side*.91],.023,dark);
      box(g,-.25,1.83,side*.92,.14,.19,.073,dark,.022);
    }
    rod(g,[-1.49,.94,0],[-1.85,.72,0],.038,brake);
    box(g,1.74,.62,0,.39,.27,.83,brake,.04);
    box(g,1.87,1.03,0,.045,.48,.94,dark,.035);
    for(let j=0;j<10;j++)box(g,1.896,1.03,-.40+j*.089,.012,.40,.015,alloy,.002);
    rod(g,[.22,1.35,.47],[.22,2.22,.47],.043,dark);
    rod(g,[.22,1.48,.47],[.22,1.96,.47],.066,brake);
    rod(g,[.22,2.20,.47],[.14,2.24,.47],.043,dark);
  }else{
    const wheelRadius=id==='suv'?.425:id==='bus'?.44:(id==='sports'||id==='gold')?.36:.38;
    for(const x of [-L*.31,L*.31])for(const side of [-1,1])wheel(g,x,side*(W*.5-.115),wheelRadius,'road',id==='sports'?5:7);
    body(g,id,paint,wheelRadius);
    if(id==='bus'){
      for(const side of [-1,1]){
        const z=side*W*.5;
        box(g,0,1.82,z,L-.14,.88,.035,dark,.035);
        // Match the two curbside entrances to gaps between the axles and overhangs.
        const bays=side===1?[[-1.83,1.55],[.13,.94],[1.24,1.16]]:[[-2.08,1.01],[-.99,1.06],[.13,1.06],[1.24,1.06],[2.26,.88]];
        for(const [x,width] of bays){
          box(g,x,1.82,z+side*.021,width,.79,.028,glass,.035);
          box(g,x,2.02,z+side*.038,width,.018,.014,dark,.004);
        }
        if(side===1)for(const [x,width] of [[-.70,.64],[2.49,.50]]){
          box(g,x,1.33,z+.021,width,1.79,.042,dark,.035);
          for(const offset of [-width/4,width/4]){
            box(g,x+offset,1.79,z+.051,width/2-.045,.78,.024,glass,.025);
            box(g,x+offset,1.06,z+.051,width/2-.045,.53,.024,glass,.025);
          }
          box(g,x,.46,z+.043,width-.02,.036,.08,alloy,.01);
        }
        fleetLabel(g,'CITY TRANSIT',.43,1.18,z+side*.025,.96,.16,side);
        rod(g,[2.54,2.14,z],[2.62,2.09,z+side*.12],.019,dark);
        box(g,2.62,1.98,z+side*.12,.105,.24,.075,dark,.025);
      }
      const nose=L/2;
      box(g,nose+.009,1.76,0,.044,1.04,W*.92,dark,.065);
      box(g,nose+.036,1.72,0,.025,.80,W*.87,glass,.045);
      for(const side of [-1,1]){
        rod(g,[nose+.064,1.35,side*.33],[nose+.065,1.49,side*.56],.011,dark);
        rod(g,[nose+.067,1.43,side*.39],[nose+.067,1.57,side*.81],.014,dark);
      }
      const sign=fleetLabel(g,'07   CENTRAL',nose+.035,2.19,0,1.38,.16,1);
      sign.rotation.y=Math.PI/2;
      (sign.material as THREE.MeshPhysicalMaterial).color.setHex(0xffbf50);
      box(g,-L/2-.022,1.85,0,.03,.70,W*.78,glass,.06);
      box(g,-L/2-.024,1.20,0,.034,.31,1.02,dark,.03);
      for(let row=0;row<5;row++)box(g,-L/2-.046,1.09+row*.055,0,.016,.018,.94,brake,.005);
      box(g,-.28,2.49,0,1.74,.086,1.12,fleetWhite,.042);
      for(const x of [-.64,.08]){
        const vent=mesh(g,cached('bus-roof-vent',()=>new THREE.CylinderGeometry(.226,.226,.014,28)),dark,x,2.536,0);
        for(let j=-2;j<=2;j++)box(g,x,vent.position.y+.01,j*.068,.42*Math.sqrt(1-(j*.3)**2),.009,.018,brake,.003);
      }
    }else{
      const c:Cabin=id==='truck'?{rear:-.45,rearRoof:-.36,frontRoof:.59,front:1.24,base:1.07,roof:1.765,width:W*.97}:
        id==='sports'?{rear:-1.83,rearRoof:-.92,frontRoof:.04,front:.88,base:.89,roof:1.275,width:W*.94}:
        id==='gold'?{rear:-1.49,rearRoof:-.74,frontRoof:.15,front:1.04,base:.87,roof:1.275,width:W}:
        id==='suv'?{rear:-2.08,rearRoof:-1.79,frontRoof:.47,front:1.22,base:1.13,roof:1.85,width:W*.96}:
        id==='car'?{rear:-1.76,rearRoof:-.94,frontRoof:.23,front:.98,base:.99,roof:1.535,width:W*.97}:
        {rear:-1.57,rearRoof:-.87,frontRoof:.48,front:1.30,base:.96,roof:1.535,width:W};
      cabin(g,c,paint,id);
      for(const side of [-1,1]){
        const sideZ=side*W*.501;
        if(id==='car'){
          // A single long door meets the fixed quarter window behind the B-pillar.
          line(g,[[-.77,.98,sideZ*.975],[-.71,.77,sideZ],[-.58,.47,sideZ*.98],[.75,.47,sideZ*.98],[.90,.74,sideZ],[.94,.97,sideZ*.97]],seam,.009);
          box(g,-.53,.91,sideZ,.19,.035,.038,alloy,.012);
          line(g,[[-1.74,.95,sideZ*.927],[-.77,.98,sideZ*.968],[.93,.97,sideZ*.968],[1.66,.91,sideZ*.928]],alloy,.009);
        }else if(id==='sports'){
          line(g,[[-.82,.87,side*.947],[-.76,.63,side*.953],[-.65,.42,side*.929],[.65,.42,side*.929],[.78,.59,side*.957],[.81,.87,side*.946]],seam,.008);
          box(g,-.62,.80,side*.956,.19,.026,.018,brake,.006);
        }else{
          for(const x of id==='truck'?[-.35,1.31]:[-1.40,-.15,1.25])line(g,[[x,.48,sideZ*.95],[x,.72,sideZ],[x,c.base-.02,sideZ*.97]],seam,.006);
          for(const x of id==='truck'?[.04]:[-.83,.50])box(g,x,c.base-.09,sideZ,.18,.025,.025,alloy,.008);
        }
        rod(g,[.83,c.base+.13,side*W*.46],[.82,c.base+.15,side*(W*.5+.11)],.025,dark);
        mesh(g,cached('mirror-housing',()=>new RoundedBoxGeometry(.25,.12,.15,1,.035)),paint,.82,c.base+.18,side*(W*.5+.12));
        box(g,.79,c.base+.18,side*(W*.5+.196),.16,.073,.008,glass,.015);
      }
      if(id==='truck'){
        const tail=-L/2;
        // Keep the load floor low between the wheel tubs and cap the exposed rails.
        box(g,-1.46,.813,0,1.87,.032,W*.91,dark,.015);
        for(let rib=-5;rib<=5;rib++)box(g,-1.46,.835,rib*.145,1.77,.018,.042,dark,.008);
        box(g,-.51,1.015,0,.09,.46,W*.94,paint,.025);
        box(g,tail+.065,1.005,0,.12,.49,W*.91,paint,.035);
        box(g,tail,1.14,0,.023,.075,.28,dark,.012);
        box(g,tail-.014,1.15,0,.018,.025,.19,alloy,.005);
        box(g,tail+.018,.475,0,.16,.12,W*.92,alloy,.028);
        box(g,tail+.013,.542,0,.15,.025,W*.63,rubber,.01);
        for(const side of [-1,1]){
          const railZ=side*W*.458;
          box(g,-1.46,.996,railZ,1.98,.50,.145,paint,.045);
          box(g,-1.46,1.247,railZ,1.96,.035,.15,dark,.017);
          box(g,-L*.31,.843,side*W*.388,.88,.22,.28,dark,.09);
          box(g,tail-.008,1.01,railZ,.035,.29,.13,red,.02);
          box(g,tail-.029,.96,railZ,.012,.049,.106,lamp,.007);
          box(g,.15,.355,side*W*.49,1.52,.065,.17,rubber,.026);
        }
      }
      if(id==='suv'){
        for(const side of [-1,1]){
          // Divide the cargo glass from the rear door and finish the window surround.
          rod(g,[-1.31,c.base,side*c.width*.478],[-1.43,c.roof-.045,side*c.width*.399],.043,paint);
          line(g,[[c.rear,c.base,side*c.width*.48],[c.rearRoof,c.roof-.048,side*c.width*.402]],dark,.025);
          const railZ=side*.68;
          for(const x of [-1.62,.31])box(g,x,1.875,railZ,.19,.09,.09,dark,.02);
          rod(g,[-1.68,1.917,railZ],[.37,1.917,railZ],.026,brake);
          box(g,-.03,.46,side*.985,1.77,.13,.09,dark,.03);
          box(g,-.03,.405,side*1.015,1.70,.047,.12,brake,.015);
          box(g,-L/2-.014,.865,side*.76,.043,.31,.145,red,.018);
          box(g,-L/2-.038,.82,side*.76,.012,.052,.12,lamp,.006);
        }
        box(g,-L/2-.018,.91,0,.05,.055,.28,dark,.016);
        box(g,L/2+.004,.367,0,.106,.104,W*.62,brake,.025);
      }
      if(id==='sports'){
        // The lip follows the deck edge; the hood seams follow its raised shoulders.
        box(g,-2.19,.79,0,.18,.055,W*.80,paint,.026);
        for(const side of [-1,1]){
          line(g,[[.88,.897,side*.51],[1.42,.905,side*.56],[1.98,.772,side*.59],[2.18,.67,side*.57]],seam,.007);
          line(g,[[-2.322,.696,side*.39],[-2.322,.704,side*.60],[-2.32,.716,side*.77]],red,.026);
        }
      }
      if(id==='gold'){
        // Carbon aero, vented bodywork and the multi-plane endurance-racer wing.
        box(g,-2.06,.79,0,1.30,.12,W*.98,carbonFiber,.035);
        box(g,2.12,.43,0,.48,.09,W*.96,carbonFiber,.025);
        box(g,2.35,.39,0,.11,.055,W*1.04,carbonFiber,.022);
        for(let fin=0;fin<7;fin++)box(g,2.08+Math.abs(fin-3)*.035,.36,-.78+fin*.26,.35,.22,.035,carbonFiber,.012);
        for(const axle of [-L*.31,L*.31])for(const side of [-1,1]){
          box(g,axle+.13,.40,side*(W*.5+.012),.13,.29,.06,goldEdge,.025);
          const arc:number[][]=[];for(let j=0;j<=18;j++){const a=j*Math.PI/18;arc.push([axle+Math.cos(a)*.425,.36+Math.sin(a)*.425,side*(W*.5+.018)]);}line(g,arc,goldEdge,.009);
        }
        for(const side of [-1,1]){
          box(g,-.05,.81,side*(W*.49),2.20,.16,.08,carbonFiber,.025);
          line(g,[[-1.16,.74,side*.88],[-.52,.72,side*1.04],[.42,.72,side*1.03],[1.19,.77,side*.89]],goldEdge,.018);
          line(g,[[.45,1.04,side*.10],[1.02,.91,side*.26],[1.67,.79,side*.42],[2.22,.65,side*.57]],goldEdge,.012);
          // Deep side-air curtain with inset vanes and a crisp rolled lip.
          const intake=[[-.60,.54],[.28,.53],[.77,.82],[.49,.98],[-.20,.94],[-.66,.76]];
          surfacePanel(g,intake,carbonFiber,side,W*.5+.023);
          line(g,[[-.60,.54,side*(W*.5+.031)],[.28,.53,side*(W*.5+.031)],[.77,.82,side*(W*.5+.031)],[.49,.98,side*(W*.5+.031)]],goldEdge,.010);
          for(let vane=0;vane<3;vane++){const x=-.40+vane*.20;line(g,[[x,.60,side*(W*.5+.039)],[x+.24,.72,side*(W*.5+.039)],[x+.37,.84,side*(W*.5+.039)]],alloy,.009);}
          // Side glass, handle, mirror foot and a stamped door shut line.
          line(g,[[-.72,.96,side*.84],[-.15,1.02,side*.89],[.43,.99,side*.91],[.94,.87,side*.88]],dark,.012);
          box(g,.45,.98,side*(W*.5+.019),.16,.025,.018,alloy,.006);
          rod(g,[.95,1.02,side*.79],[1.06,1.13,side*.98],.024,carbonFiber);
          mesh(g,cached('gold-mirror',()=>new RoundedBoxGeometry(.24,.11,.17,2,.04)),paint,1.08,1.14,side*1.005);
          box(g,1.08,1.14,side*1.095,.16,.068,.008,glass,.014);
          box(g,-2.19,1.39,side*.82,.34,.30,.10,paint,.035);
          rod(g,[-1.88,1.08,side*.59],[-1.97,1.53,side*.59],.047,dark);
          rod(g,[-1.88,1.08,side*.59],[-1.97,1.53,side*.59],.018,goldEdge);
          box(g,-1.94,1.55,side*.015,.48,.095,.045,carbonFiber,.025);
          box(g,-1.94,1.603,side*.015,.44,.012,.04,goldEdge,.006);
          box(g,.06,1.34,side*.15,.64,.12,.38,carbonFiber,.05);
          // Stacked side diffuser fin and satin-gold rocker molding.
          box(g,-.05,.63,side*(W*.5+.027),2.12,.085,.035,carbonFiber,.018);
          line(g,[[-2.20,.56,side*.71],[-1.65,.48,side*.82],[-.65,.46,side*.88],[.75,.49,side*.82],[2.03,.57,side*.68]],goldEdge,.015);
          // Triple louvre outlet over each front fender.
          for(let l=0;l<3;l++)line(g,[[1.55+l*.11,.98,side*.46],[1.80+l*.11,.94,side*.66],[2.02+l*.11,.86,side*.78]],carbonFiber,.018);
          line(g,[[1.54,.995,side*.46],[1.88,.965,side*.69],[2.12,.88,side*.80]],goldEdge,.009);
        }
        // Two-tier wing, curved-looking end plates and raised centre gurney.
        box(g,-2.00,1.57,0,1.15,.105,W*.94,carbonFiber,.04);
        box(g,-2.00,1.63,0,1.05,.018,W*.89,goldEdge,.008);
        box(g,-1.88,1.68,0,.48,.028,W*.72,carbonFiber,.012);
        for(const side of [-1,1]){
          box(g,-2.18,1.57,side*.96,.38,.31,.045,paint,.025);
          line(g,[[-2.35,1.45,side*.986],[-2.34,1.68,side*.986],[-2.07,1.73,side*.986]],goldEdge,.009);
          // Side skirts end in small upturned aero flicks.
          box(g,.94,.46,side*.88,.68,.10,.15,carbonFiber,.025);
          box(g,2.18,.58,side*.62,.26,.06,.19,carbonFiber,.018);
          box(g,-2.32,.48,side*.67,.16,.23,.055,carbonFiber,.018);
        }
        // Front light blades and mesh openings on the low nose.
        box(g,2.425,.50,0,.055,.20,W*.56,carbonFiber,.025);
        for(let fin=0;fin<9;fin++)box(g,2.458,.50,-.48+fin*.12,.035,.17,.018,alloy,.006);
        for(const side of [-1,1]){
          const eye=new THREE.Shape();eye.moveTo(-side*.90,.67);eye.lineTo(-side*.77,.82);eye.lineTo(-side*.43,.87);eye.lineTo(-side*.35,.80);eye.lineTo(-side*.54,.69);eye.lineTo(-side*.90,.65);eye.closePath();
          const head=mesh(g,new THREE.ShapeGeometry(eye,16),carbonFiber,2.422,0,0);head.rotation.y=Math.PI/2;
          line(g,[[2.441,.69,side*.90],[2.443,.81,side*.73],[2.441,.83,side*.48]],lamp,.020);
          for(let led=0;led<3;led++)box(g,2.442,.72+led*.035,side*(.53+led*.08),.014,.012,.045,lamp,.005);
          box(g,2.445,.61,side*.90,.025,.035,.10,orange,.01);
          box(g,-2.425,.68,side*.70,.025,.075,.35,red,.022);
          box(g,-2.442,.68,side*.70,.012,.024,.31,lamp,.01);
        }
        // Twin machined exhausts and layered rear diffuser fins.
        for(const side of [-1,1])for(const x of [-.20,.20]){
          const exhaust=mesh(g,cached('gold-exhaust',()=>new THREE.CylinderGeometry(.062,.075,.12,24)),alloy,-2.405,.48,side*.47+x);exhaust.rotation.z=Math.PI/2;
          const bore=mesh(g,cached('gold-exhaust-bore',()=>new THREE.CylinderGeometry(.044,.052,.125,20)),dark,-2.413,.48,side*.47+x);bore.rotation.z=Math.PI/2;
        }
      }
    }
  }
  // Recessed grille, separate light lenses, bumper trim and exhaust finish the silhouette.
  const front=id==='tractor'?1.86:L/2,lampY=['ambulance','fireengine','dumptruck','mixer'].includes(id)?1.03:id==='bus'?.91:id==='tractor'?1.18:(id==='sports'||id==='gold')?.55:id==='suv'?.72:.63;
  if(id!=='rickshaw')for(const side of [-1,1]){
    const width=id==='bus'?.29:id==='tractor'?.23:.36,centerZ=side*W*(id==='tractor'?.17:.34);
    if(id==='car'){
      for(const spacing of [-.092,.092]){
        const z=centerZ+spacing;
        const bezel=mesh(g,cached('coupe-lamp-ring',()=>new THREE.TorusGeometry(.082,.012,8,28)),alloy,front+.027,lampY,z);
        bezel.rotation.y=Math.PI/2;
        const lens=mesh(g,cached('coupe-lamp-lens',()=>new THREE.SphereGeometry(1,20,12)),lamp,front+.024,lampY,z);
        lens.scale.set(.025,.077,.077);
      }
    }else{
    box(g,front+.018,lampY,centerZ,.037,.115,width,dark,.025);
    box(g,front+.040,lampY+.035,centerZ,.012,.018,width*.88,lamp,.005);
    for(const offset of [-.23,.21]){
      const projector=mesh(g,cached('projector-lens',()=>new THREE.SphereGeometry(1,12,8)),lamp,
        front+.042,lampY-.014,centerZ+side*width*offset);
      projector.scale.set(.018,.023,.043);
    }
    }
    if(id!=='truck'&&id!=='suv'&&id!=='sports')box(g,-L/2-.025,id==='bus'?1.0:.73,side*W*.36,.025,id==='bus'?.30:.12,.22,red,.018);
  }
  if(id!=='tractor'&&id!=='rickshaw'){
    box(g,L/2+.02,.53,0,.035,.18,W*.52,dark,.035);
    for(let j=0;j<4;j++)box(g,L/2+.044,.47+j*.039,0,.008,.008,W*.47,alloy,.002);
    box(g,L/2+.024,.36,0,.04,.045,W*.84,dark,.009);
    box(g,-L/2-.025,.44,0,.04,.045,W*.84,dark,.009);
    box(g,-L/2-.036,.64,0,.008,.10,.28,lamp,.006);
    for(const side of [-1,1]){
      const tip=mesh(g,cached('exhaust-tip',()=>new THREE.CylinderGeometry(.043,.043,.15,12,1,true)),alloy,-L/2-.055,.34,side*W*.28);tip.rotation.z=Math.PI/2;
    }
  }
  g.updateMatrixWorld(true);const batches=new Map<THREE.Material,THREE.BufferGeometry[]>();
  g.traverse(child=>{
    if(child instanceof THREE.Mesh){const mat=child.material as THREE.Material;if(!batches.has(mat))batches.set(mat,[]);
      batches.get(mat)!.push((child.geometry.index?child.geometry.toNonIndexed():child.geometry.clone()).applyMatrix4(child.matrixWorld));
      if(child.userData.temporaryGeometry)child.geometry.dispose();
    }
  });
  const optimized=new THREE.Group();optimized.name=id;optimized.userData={id,spec:s,damageZones:damageZones(id,g.userData.cabin)};
  for(const [mat,parts] of batches){
    const merged=mergeGeometries(parts);parts.forEach(geo=>geo.dispose());
    if(merged){
      if(mat.userData.vehicleSurface==='paint'){
        (mat as THREE.MeshPhysicalMaterial).vertexColors=true;
        const position=merged.getAttribute('position'),colors=new Float32Array(position.count*3);
        for(let i=0;i<position.count;i++){
          const dust=1-THREE.MathUtils.smoothstep(position.getY(i),.40,.91);
          colors[i*3]=1-dust*.13;colors[i*3+1]=1-dust*.16;colors[i*3+2]=1-dust*.20;
        }
        merged.setAttribute('color',new THREE.BufferAttribute(colors,3));
      }
      const part=new THREE.Mesh(merged,mat);part.userData.surface=mat.userData.vehicleSurface||'trim';part.castShadow=true;part.receiveShadow=true;part.matrixAutoUpdate=false;optimized.add(part);
    }
  }
  models.set(key,optimized);return optimized.clone();
}
