import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

import {SPECS} from './vehicle-specs.mjs';
export {SPECS};
export type VehicleId=keyof typeof SPECS;
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
glass.userData.vehicleSurface='glass';glass.envMapIntensity=1.18;
// Tinted laminated glazing keeps reflections while revealing subdued cabin silhouettes.
glass.transparent=true;glass.opacity=.93;glass.depthWrite=true;
lamp.emissive.setHex(0xc1d4e4);lamp.emissiveIntensity=.13;
red.emissive.setHex(0x5a0007);red.emissiveIntensity=.10;
let finishGrain:THREE.CanvasTexture|undefined,lensGrain:THREE.CanvasTexture|undefined;
function paintFinish(mat:THREE.MeshPhysicalMaterial){
  mat.userData.vehicleSurface='paint';mat.vertexColors=true;
  if(!finishGrain){
    const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const c=canvas.getContext('2d')!,pixels=c.createImageData(128,128);let seed=7391;
    for(let i=0;i<pixels.data.length;i+=4){seed=(Math.imul(seed,1664525)+1013904223)|0;const n=205+(seed>>>24)%40;pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=n;pixels.data[i+3]=255;}
    c.putImageData(pixels,0,0);finishGrain=new THREE.CanvasTexture(canvas);finishGrain.wrapS=finishGrain.wrapT=THREE.RepeatWrapping;finishGrain.repeat.set(5,5);finishGrain.anisotropy=4;
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
function wheel(g:THREE.Group,x:number,z:number,r:number,tractor=false){
  if(!rubber.bumpMap){rubber.bumpMap=treadTexture();rubber.bumpScale=.014;}
  const w=new THREE.Group();w.position.set(x,r,z);g.add(w);
  const width=tractor?(r>.6?.35:.27):r>.4?.25:.23;
  const tire=cached(`tire/${r}/${width}`,()=>{
    const profile=[[.64,-.44],[.82,-.5],[.94,-.46],[.99,-.34],[1,-.22],[1,.22],[.99,.34],[.94,.46],[.82,.5],[.64,.44]];
    const geo=new THREE.LatheGeometry(profile.map(([radius,depth])=>new THREE.Vector2(radius*r,depth*width)),32);geo.rotateX(Math.PI/2);return geo;
  });mesh(w,tire,rubber);
  const cylinder=(radius:number,depth:number,mat:THREE.Material,z:number)=>{const m=mesh(w,cached(`cylinder/${radius}/${depth}`,()=>new THREE.CylinderGeometry(radius,radius,depth,24)),mat,0,0,z);m.rotation.x=Math.PI/2;};
  cylinder(r*.63,width*.86,dark,0);
  for(const side of [-1,1]){
    const face=side*(width*.49);
    cylinder(r*.51,.015,brake,face);
    const rim=mesh(w,cached(`lip/${r}`,()=>new THREE.TorusGeometry(r*.635,.016,6,32)),alloy,0,0,face+side*.016);
    rim.rotation.z=Math.PI/10;
    for(let j=0;j<5;j++){
      const a=j*Math.PI*2/5;
      for(const split of [-1,1]){const angle=a+split*.095;const spoke=box(w,Math.sin(angle)*r*.345,Math.cos(angle)*r*.345,face+side*.027,.026,r*.57,.022,alloy,.006);spoke.rotation.z=-angle;}
      cylinder(r*.025,.024,alloy,face+side*.045);
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
function body(g:THREE.Group,id:VehicleId,paint:THREE.Material){
  const s=SPECS[id],L=s.length,W=s.width,sport=id==='sports',bus=id==='bus';
  const stations=bus?[[-L/2,2.28],[-L*.44,2.47],[L*.42,2.47],[L/2,2.27]]:
    sport?[[-L/2,.72],[-L*.35,.93],[.45,.88],[L*.36,.82],[L/2,.63]]:
    id==='suv'?[[-L/2,.94],[-L*.35,1.12],[.65,1.12],[L*.39,1.03],[L/2,.85]]:
    [[-L/2,.78],[-L*.37,1.01],[.5,1.02],[L*.37,.94],[L/2,.74]];
  mesh(g,cached(`body/${id}`,()=>{
    const sections:Section[]=[];
    for(let i=0;i<=88;i++){
      const t=i/88,x=(t-.5)*L,top=interpolate(stations,x),half=W*.5*(.84+.16*Math.pow(Math.sin(Math.PI*t),.45));
      const radius=bus?.44:sport?.36:.38;let edge=sport?.34:.43;
      for(const axle of [-L*.31,L*.31]){const dx=x-axle;if(Math.abs(dx)<radius+.055)edge=Math.max(edge,radius+Math.sqrt((radius+.055)**2-dx*dx));}
      edge=Math.min(edge,top-.045);
      const halfRing=[[top,0],[top-.018,half*.66],[top-.065,half*.92],[top-.14,half],[edge+.018,half],[edge,half*.91],[sport?.29:.34,half*.67],[sport?.29:.34,0]];
      sections.push({x,ring:[...halfRing,...halfRing.slice(1,-1).reverse().map(([y,z])=>[y,-z])]});
    }return loft(sections);
  }),paint);
  box(g,0,.34,0,L*.88,.13,W*.62,dark,.045);
  for(const side of [-1,1]){
    line(g,[[-L*.42,.43,side*W*.463],[0,.40,side*W*.495],[L*.42,.43,side*W*.463]],dark,.035);
    for(const axle of [-L*.31,L*.31]){
      const arch=mesh(g,cached(`arch/${id}`,()=>new THREE.TorusGeometry((bus?.44:sport?.36:.38)+.057,.016,5,20,Math.PI)),id==='suv'?dark:paint,axle,bus?.44:sport?.36:.38,side*(W*.5+.003));
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
    const sections:Section[]=[];for(let i=0;i<=24;i++){
      const x=THREE.MathUtils.lerp(rear,front,i/24),top=heightAt(x),hw=width*.475;
      sections.push({x,ring:[[top,0],[top-.012,hw*.6],[Math.max(base+.015,top-.055),hw*.82],[base,hw],[base-.01,0],[base,-hw],[Math.max(base+.015,top-.055),-hw*.82],[top-.012,-hw*.6]]});
    }return loft(sections);
  }),glass);
  mesh(g,cached(`roof/${key}`,()=>{
    const sections:Section[]=[];for(let i=0;i<=12;i++){
      const x=THREE.MathUtils.lerp(rearRoof-.035,frontRoof+.025,i/12),top=heightAt(x)+.012,w=width*.398;
      sections.push({x,ring:[[top+.018,0],[top,w*.8],[top-.02,w],[top-.055,w],[top-.045,0],[top-.055,-w],[top-.02,-w],[top,-w*.8]]});
    }return loft(sections);
  }),paint);
  for(const side of [-1,1]){
    rod(g,[front,base,side*width*.479],[frontRoof,roof-.04,side*width*.397],.035,paint);
    rod(g,[rear,base,side*width*.479],[rearRoof,roof-.04,side*width*.397],.055,paint);
    const pillar=THREE.MathUtils.lerp(rearRoof,frontRoof,.56);
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
const fleetWhite=material(0xe1e5e1,.12,.42,.45),fleetBlue=material(0x075b95,.18,.30,.45),
 reflective=material(0xd6cc78,.15,.41),orange=material(0xb96729,.26,.42,.45),roofBlack=material(0x161a1b,.18,.38,.65);
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
}
function lightbar(g:THREE.Group,x:number,y:number,width:number){
 box(g,x,y,0,.28,.07,width,dark,.025);
 for(const side of [-1,1]){
  box(g,x,y+.08,side*width*.32,.26,.13,width*.30,side<0?red:fleetBlue,.04);
  for(let j=0;j<3;j++)box(g,x+.14,y+.08,side*width*.32+(j-1)*width*.075,.008,.072,.032,lamp,.003);
 }
}
function fleetCab(g:THREE.Group,id:VehicleId,paint:THREE.Material){
 const {length:L,width:W}=SPECS[id],cx=L/2-.76;
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
 const {width:W}=SPECS[id];
 if(id==='police'){
  for(const x of [-1.395,1.395])for(const side of [-1,1])wheel(g,x,side*(W/2-.115),.38);
  body(g,'car',paint);cabin(g,{rear:-1.57,rearRoof:-.87,frontRoof:.48,front:1.30,base:.96,roof:1.535,width:W},roofBlack,id);
  mesh(g,cached('police-hood',()=>{
   const sections:Section[]=[];
   for(let j=0;j<=12;j++){
    const x=1.26+j*.87/12,t=(x+2.25)/4.5,top=interpolate([[.5,1.02],[1.665,.94],[2.25,.74]],x)+.009,half=W*.5*(.84+.16*Math.pow(Math.sin(Math.PI*t),.45));
    sections.push({x,ring:[[top,0],[top-.018,half*.66],[top-.065,half*.90],[top-.075,half*.90],[top-.01,0],[top-.075,-half*.90],[top-.065,-half*.90],[top-.018,-half*.66]]});
   }
   return loft(sections);
  }),dark);lightbar(g,-.18,1.60,1.16);
  for(const side of [-1,1]){
   box(g,-.18,.81,side*(W/2+.005),2.08,.29,.022,dark,.01);fleetLabel(g,'POLICE',-.18,.82,side*(W/2+.02),1.30,.19,side);
   box(g,-.25,1.03,side*(W/2+.015),.19,.025,.03,alloy,.007);
   rod(g,[.84,1.10,side*.85],[.84,1.12,side*1.02],.022,dark);box(g,.84,1.16,side*1.03,.24,.12,.13,dark,.025);
  }
  rod(g,[-.87,1.55,.18],[-.87,1.98,.18],.008,dark);
  return;
 }
 if(id==='rickshaw'){
  const green=material(0x1d654c,.45,.38,.4),canopy=material(0x202624,0,.89);
  canopy.userData.vehicleSurface='panel';
  for(const side of [-1,1])wheel(g,-.95,side*.64,.34);wheel(g,1.13,0,.32);
  box(g,-.1,.51,0,2.69,.22,1.19,dark,.06);box(g,-.93,.92,0,1.08,.72,1.43,green,.12);
  box(g,-.70,1.06,0,.51,.16,1.11,canopy,.07);box(g,-1.02,1.31,0,.12,.47,1.11,canopy,.05);
  box(g,.36,.74,0,.38,.21,.62,canopy,.04);box(g,1.24,1.01,0,.57,.75,.99,paint,.15);
  cabin(g,{rear:.86,rearRoof:.87,frontRoof:1.08,front:1.49,base:1.18,roof:1.98,width:1.23},paint,id);
  box(g,-.18,2.08,0,2.65,.16,1.43,canopy,.075);
  for(const side of [-1,1]){
   for(const x of [-1.44,.58])rod(g,[x,.92,side*.64],[x,2.03,side*.64],.027,dark);
   rod(g,[-1.43,1.45,side*.67],[.30,1.45,side*.67],.022,alloy);
   box(g,-.91,1.26,side*.72,1.0,.15,.015,paint,.01);
   box(g,-1.49,.88,side*.47,.025,.15,.12,red,.016);
   rod(g,[.97,.34,side*.1],[1.24,1.14,side*.1],.023,alloy);
   rod(g,[.83,1.55,side*.45],[.83,1.58,side*.86],.018,dark);box(g,.83,1.61,side*.86,.13,.16,.06,dark,.02);
  }
  rod(g,[.64,.81,0],[.89,1.40,0],.024,dark);rod(g,[.89,1.40,-.23],[.89,1.40,.23],.025,dark);
  const headlight=mesh(g,cached('rickshaw-headlight',()=>new THREE.CylinderGeometry(.13,.13,.07,24)),lamp,1.55,1.13,0);headlight.rotation.z=Math.PI/2;
  box(g,1.57,.73,0,.04,.11,.35,fleetWhite,.01);return;
 }
 fleetCab(g,id,paint);
 if(id==='ambulance'){
  box(g,-.68,1.73,0,3.76,1.68,W*.97,paint,.07);box(g,-.68,2.58,0,3.70,.06,W*.94,fleetWhite,.025);
  lightbar(g,1.83,2.43,1.38);
  for(const side of [-1,1]){
   const z=side*(W*.49+.015);
   box(g,-.68,1.24,z,3.73,.20,.025,orange,.003);box(g,-.68,1.08,z,3.73,.035,.028,reflective,.002);
   box(g,-.68,1.63,z,3.18,.29,.025,fleetBlue,.006);
   box(g,-1.44,2.13,z,.78,.45,.028,glass,.03);box(g,-.05,2.11,z,1.12,.48,.030,fleetBlue,.025);
   box(g,-.05,2.11,z+side*.02,.36,.10,.012,fleetWhite,.004);box(g,-.05,2.11,z+side*.02,.10,.35,.012,fleetWhite,.004);
   fleetLabel(g,'AMBULANCE',-.68,1.63,z+side*.02,2.70,.20,side);
   for(const x of [-2.19,.82])box(g,x,2.49,z,.18,.07,.03,fleetBlue,.012);
  }
  box(g,-2.58,1.70,0,.032,1.58,W*.89,paint,.03);
  for(const side of [-1,1]){box(g,-2.603,2.12,side*.48,.018,.41,.61,glass,.03);box(g,-2.61,1.46,side*.10,.025,.20,.025,alloy,.006);}
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
  const s=SPECS[id];
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
  const doors=[-1,1].map(side=>({center:c?[(c.rear+c.front)/2,c.base-.24,side*c.width*.48]:[1.63,1.20,side*s.width*.50],halfSize:c?[(c.front-c.rear)*.39,.27,.13]:[.33,.64,.12],side}));
  if(id==='rickshaw')for(const panel of doors){panel.center=[-.95,1.02,panel.side*.72];panel.halfSize=[.54,.27,.10];}
  return{windshield,roof,doors};
}
const models=new Map<string,THREE.Group>();
export function createVehicle(id:VehicleId,color?:number){
  const key=id+String(color);if(models.has(key))return models.get(key)!.clone();
  const s=SPECS[id],g=new THREE.Group(),paint=paintFinish(material(color??s.color,.28,.36,.72)),L=s.length,W=s.width;
  for(const panel of [fleetWhite,orange,roofBlack])paintFinish(panel);
  headlightFinish();
  if(['ambulance','police','rickshaw','fireengine','dumptruck','mixer'].includes(id)){
    fleetVehicle(g,id,paint);
  }else if(id==='tractor'){
    for(const x of [-1.16,1.16])for(const side of [-1,1])wheel(g,x,side*(x<0?.83:.78),x<0?.67:.46,true);
    box(g,0,.60,0,3.35,.30,1.25,dark,.08);
    box(g,.65,1.04,0,2.43,.76,1.2,paint,.16);
    cabin(g,{rear:-1.7,rearRoof:-1.56,frontRoof:-.32,front:-.12,base:1.08,roof:2.19,width:1.7},paint,id);
    box(g,-.96,2.23,0,1.6,.08,1.7,paint,.07);
    for(const side of [-1,1]){
      box(g,-1.16,1.38,side*.83,1.54,.10,.52,paint,.06);
      box(g,-.65,.69,side*.80,.70,.08,.35,brake,.01);
      box(g,-.65,.88,side*.72,.58,.08,.28,brake,.01);
      rod(g,[-.2,1.1,side*.64],[-.2,1.8,side*.64],.019,alloy);
    }
    box(g,1.87,1.03,0,.045,.48,.94,dark,.035);
    for(let j=0;j<10;j++)box(g,1.896,1.03,-.40+j*.089,.012,.40,.015,alloy,.002);
    rod(g,[.22,1.35,.47],[.22,2.22,.47],.043,dark);
    box(g,.22,2.20,.47,.16,.05,.13,dark);
  }else{
    for(const x of [-L*.31,L*.31])for(const side of [-1,1])wheel(g,x,side*(W*.5-.115),id==='bus'?.44:id==='sports'?.36:.38);
    body(g,id,paint);
    if(id==='bus'){
      for(const side of [-1,1]){
        for(let j=0;j<6;j++)box(g,-2.10+j*.77,1.87,side*(W*.5+.015),.685,.75,.022,glass,.04);
        box(g,0,1.34,side*W*.501,L*.90,.035,.018,alloy,.004);
        for(const x of [-1.54,1.63]){
          box(g,x,1.27,side*W*.505,.64,1.50,.022,dark,.012);
          for(const dx of [-.16,.16])box(g,x+dx,1.65,side*W*.517,.27,.67,.012,glass,.015);
          line(g,[[x,.56,side*W*.522],[x,1.92,side*W*.522]],alloy,.007);
        }
      }
      box(g,L/2+.022,1.87,0,.03,.83,W*.78,glass,.07);
      box(g,-L/2-.022,1.85,0,.03,.70,W*.78,glass,.06);
      box(g,0,2.51,0,1.75,.08,1.15,dark,.05);
      box(g,L/2+.019,2.18,0,.025,.16,.92,dark,.025);
    }else{
      const c:Cabin=id==='truck'?{rear:-.43,rearRoof:-.33,frontRoof:.67,front:1.38,base:1.04,roof:1.765,width:W}:
        id==='sports'?{rear:-1.49,rearRoof:-.74,frontRoof:.15,front:1.04,base:.87,roof:1.275,width:W}:
        id==='suv'?{rear:-1.86,rearRoof:-1.46,frontRoof:.43,front:1.30,base:1.04,roof:1.89,width:W}:
        {rear:-1.57,rearRoof:-.87,frontRoof:.48,front:1.30,base:.96,roof:1.535,width:W};
      cabin(g,c,paint,id);
      for(const side of [-1,1]){
        const sideZ=side*W*.501;
        for(const x of id==='truck'?[-.35,1.31]:[-1.40,-.15,1.25])line(g,[[x,.48,sideZ*.95],[x,.72,sideZ],[x,c.base-.02,sideZ*.97]],seam,.006);
        for(const x of id==='truck'?[.04]:[-.83,.50])box(g,x,c.base-.09,sideZ,.18,.025,.025,alloy,.008);
        rod(g,[.83,c.base+.13,side*W*.46],[.82,c.base+.15,side*(W*.5+.11)],.025,dark);
        mesh(g,cached('mirror-housing',()=>new RoundedBoxGeometry(.25,.12,.15,1,.035)),paint,.82,c.base+.18,side*(W*.5+.12));
        box(g,.79,c.base+.18,side*(W*.5+.196),.16,.073,.008,glass,.015);
      }
      if(id==='truck'){
        box(g,-1.41,1.015,0,1.73,.045,W*.80,dark,.025);
        for(const side of [-1,1])box(g,-1.42,1.15,side*(W*.5-.055),1.87,.30,.10,paint,.035);
        box(g,-L/2+.07,1.15,0,.10,.30,W*.95,paint,.035);
        for(let j=0;j<7;j++)box(g,-1.40,1.045,-.65+j*.217,1.65,.012,.022,brake,.003);
        box(g,-L/2-.007,1.12,0,.014,.035,.25,alloy,.005);
      }
      if(id==='suv')for(const side of [-1,1])rod(g,[-1.33,1.94,side*.69],[.37,1.94,side*.69],.024,alloy);
      if(id==='sports'){
        box(g,-1.78,.97,0,.33,.043,W*.90,paint,.02);
        for(const side of [-1,1])box(g,-1.8,.89,side*.65,.043,.16,.033,dark,.009);
        for(const side of [-1,1])line(g,[[1.0,.90,side*.48],[1.48,.86,side*.51],[1.97,.77,side*.55]],seam,.008);
      }
    }
  }
  // Recessed grille, separate light lenses, bumper trim and exhaust finish the silhouette.
  const front=id==='tractor'?1.86:L/2,lampY=['ambulance','fireengine','dumptruck','mixer'].includes(id)?1.03:id==='bus'?.91:id==='tractor'?1.18:id==='sports'?.55:id==='suv'?.72:.63;
  if(id!=='rickshaw')for(const side of [-1,1]){
    box(g,front+.018,lampY,side*W*.34,.037,.115,id==='bus'?.29:.36,dark,.025);
    box(g,front+.040,lampY+.014,side*W*.34,.012,.052,id==='bus'?.24:.30,lamp,.012);
    box(g,-L/2-.025,id==='bus'?1.0:.73,side*W*.36,.025,id==='bus'?.30:.12,.22,red,.018);
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
