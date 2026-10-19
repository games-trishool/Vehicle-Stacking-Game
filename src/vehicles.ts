import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export type VehicleId = 'car'|'suv'|'truck'|'sports'|'bus'|'tractor';
export const SPECS: Record<VehicleId,{length:number;width:number;height:number;color:number}> = {
  car:{length:4.5,width:1.85,height:1.58,color:0x8999a6},
  suv:{length:4.5,width:2,height:1.95,color:0x424e48},
  truck:{length:4.9,width:2,height:1.82,color:0x8b7861},
  sports:{length:4.6,width:1.96,height:1.32,color:0x981f2d},
  bus:{length:5.6,width:2.14,height:2.55,color:0xb9bcb7},
  tractor:{length:3.9,width:2.05,height:2.28,color:0x356448},
};
// All shapes and textures are original, generated once, then shared by every clone.
const geometries=new Map<string,THREE.BufferGeometry>();
function cached(key:string,build:()=>THREE.BufferGeometry){if(!geometries.has(key))geometries.set(key,build());return geometries.get(key)!;}
const materials=new Map<string,THREE.MeshPhysicalMaterial>();
function material(color:number,metalness=.0,roughness=.55,clearcoat=0){
  const key=`${color}/${metalness}/${roughness}/${clearcoat}`;
  if(!materials.has(key))materials.set(key,new THREE.MeshPhysicalMaterial({color,metalness,roughness,clearcoat,clearcoatRoughness:.16}));
  return materials.get(key)!;
}
const rubber=material(0x18191a,0,.92),alloy=material(0xb8bec4,.92,.24),dark=material(0x1b2024,.3,.46),
  glass=material(0x12232d,.05,.14,.65),lamp=material(0xe5eff4,.45,.16,.5),red=material(0x970d19,.25,.22,.6),
  brake=material(0x4f5459,.82,.54),seam=material(0x15191b,.1,.6);
lamp.emissive.setHex(0xc1d4e4);lamp.emissiveIntensity=.22;
red.emissive.setHex(0x5a0007);red.emissiveIntensity=.15;
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
}
const models=new Map<string,THREE.Group>();
export function createVehicle(id:VehicleId,color?:number){
  const key=id+String(color);if(models.has(key))return models.get(key)!.clone();
  const s=SPECS[id],g=new THREE.Group(),paint=material(color??s.color,.62,.27,.82),L=s.length,W=s.width;
  if(id==='tractor'){
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
  const front=id==='tractor'?1.86:L/2,lampY=id==='bus'?.91:id==='tractor'?1.18:id==='sports'?.55:id==='suv'?.72:.63;
  for(const side of [-1,1]){
    box(g,front+.018,lampY,side*W*.34,.037,.115,id==='bus'?.29:.36,dark,.025);
    box(g,front+.040,lampY+.014,side*W*.34,.012,.052,id==='bus'?.24:.30,lamp,.012);
    box(g,-L/2-.025,id==='bus'?1.0:.73,side*W*.36,.025,id==='bus'?.30:.12,.22,red,.018);
  }
  if(id!=='tractor'){
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
  const optimized=new THREE.Group();optimized.name=id;optimized.userData={id,spec:s};
  for(const [mat,parts] of batches){const merged=mergeGeometries(parts);parts.forEach(geo=>geo.dispose());if(merged){const part=new THREE.Mesh(merged,mat);part.castShadow=true;part.receiveShadow=true;part.matrixAutoUpdate=false;optimized.add(part);}}
  models.set(key,optimized);return optimized.clone();
}
