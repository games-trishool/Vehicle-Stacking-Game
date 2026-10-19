import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
export type WorldId='forest'|'city'|'space'|'snow'|'desert'|'beach';
const COLORS:Record<WorldId,{sky:number;fog:number;ground:number;sun:number;ambient:number}>={
 forest:{sky:0xcbd9cf,fog:0xcbd9ba,ground:0x718358,sun:0xffe6b4,ambient:0xdfeacb},
 city:{sky:0x111b32,fog:0x22263d,ground:0x303943,sun:0x89a3ff,ambient:0x777cc9},
 space:{sky:0x070f24,fog:0x0b1429,ground:0x464c68,sun:0xa9c9ff,ambient:0x727dc2},
 snow:{sky:0xcbdde5,fog:0xdce5e9,ground:0xe0e7e8,sun:0xfff0d8,ambient:0xdbecff},
 desert:{sky:0xe3cda7,fog:0xddbb8a,ground:0xc7a073,sun:0xffdc9d,ambient:0xf1dec5},
 beach:{sky:0xb9dce0,fog:0xc9e3dc,ground:0xe1cda4,sun:0xfff1d2,ambient:0xe5f7f0},
};
function random(seed:number){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function mat(color:number,roughness=.85){return new THREE.MeshStandardMaterial({color,roughness});}
type InstanceTransform={position:THREE.Vector3;scale:THREE.Vector3;rotation?:THREE.Euler};
function add(g:THREE.Group,geo:THREE.BufferGeometry,m:THREE.Material|THREE.Material[],x=0,y=0,z=0){const mesh=new THREE.Mesh(geo,m);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;g.add(mesh);return mesh;}
function batch(g:THREE.Group,geo:THREE.BufferGeometry,m:THREE.Material,transforms:InstanceTransform[],shadows=true){const mesh=new THREE.InstancedMesh(geo,m,transforms.length);const dummy=new THREE.Object3D();transforms.forEach((v,i)=>{dummy.position.copy(v.position);dummy.scale.copy(v.scale);dummy.rotation.copy(v.rotation||new THREE.Euler());dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});mesh.castShadow=shadows;mesh.receiveShadow=true;g.add(mesh);return mesh;}
function batchSpatial(g:THREE.Group,geo:THREE.BufferGeometry,m:THREE.Material,transforms:InstanceTransform[],cellSize=16){
 const cells=new Map<string,InstanceTransform[]>();
 for(const transform of transforms){const key=`${Math.floor(transform.position.x/cellSize)},${Math.floor(transform.position.z/cellSize)}`;if(!cells.has(key))cells.set(key,[]);cells.get(key)!.push(transform);}
 for(const cell of cells.values())batch(g,geo,m,cell);
}
function mergeStatic(group:THREE.Group,material:THREE.Material){
 const parts:THREE.BufferGeometry[]=[];
 for(const mesh of [...group.children])if(mesh instanceof THREE.Mesh){mesh.updateMatrix();parts.push(mesh.geometry.clone().applyMatrix4(mesh.matrix));mesh.geometry.dispose();group.remove(mesh);}
 if(!parts.length)return;
 const geometry=mergeGeometries(parts);parts.forEach(part=>part.dispose());
 if(geometry)add(group,geometry,material);
}
function pineTexture(snow:boolean){
 const canvas=document.createElement('canvas');canvas.width=512;canvas.height=1024;const ctx=canvas.getContext('2d')!,rand=random(1192);
 ctx.lineCap='round';ctx.strokeStyle='#5b5643';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(256,1000);ctx.lineTo(256,18);ctx.stroke();
 for(let row=0;row<24;row++){
  const y=52+row*37,width=12+row*8.4;
  for(const side of [-1,1]){
   ctx.strokeStyle='#4b5940';ctx.lineWidth=2.5;ctx.beginPath();ctx.moveTo(256,y);ctx.quadraticCurveTo(256+side*width*.5,y+8,256+side*width,y+23);ctx.stroke();
   for(let j=0;j<32;j++){
    const t=j/32,x=256+side*width*t,yy=y+23*t;
    for(let k=0;k<3;k++){
      const n=12+rand()*22,xx=x+side*(5+rand()*11),endY=yy-13-rand()*n;
      ctx.strokeStyle=snow?(rand()>.25?'#e2e9de':'#6d8370'):['#354f32','#496439','#5b7442','#68834d','#7c9358'][Math.floor(rand()*5)];ctx.lineWidth=1.5+rand()*1.7;
      ctx.beginPath();ctx.moveTo(x,yy);ctx.lineTo(xx,endY);ctx.stroke();
    }
   }
  }
 }
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;return texture;
}
function groundTexture(){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=512;const ctx=canvas.getContext('2d')!,rand=random(684);ctx.fillStyle='#b6b6a5';ctx.fillRect(0,0,512,512);
 for(let i=0;i<24000;i++){const value=95+Math.floor(rand()*100);ctx.fillStyle=`rgba(${value},${value},${value-10},${.1+rand()*.4})`;const x=rand()*512,y=rand()*512,r=1+rand()*6;ctx.fillRect(x,y,r,r*.4);}
 for(let i=0;i<1800;i++){ctx.strokeStyle=rand()>.5?'#adb39b':'#78896a';ctx.lineWidth=.5;const x=rand()*512,y=rand()*512;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+rand()*8-4,y-2-rand()*9);ctx.stroke();}
 const texture=new THREE.CanvasTexture(canvas);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=8;return texture;
}
function woodTexture(){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=512;
 const ctx=canvas.getContext('2d')!,rand=random(812),colors=['#b88150','#bc8958','#ae7949','#c18b57','#b37c4a','#ba8452','#ad7747','#bd8856'];
 for(let board=0;board<8;board++){
   const left=board*64;ctx.fillStyle=colors[board];ctx.fillRect(left,0,64,512);
   ctx.save();ctx.beginPath();ctx.rect(left+1,0,62,512);ctx.clip();
   for(let line=0;line<130;line++){
     const x=left+rand()*64,phase=rand()*Math.PI*2;
     ctx.strokeStyle=rand()>.35?`rgba(78,42,21,${.04+rand()*.14})`:`rgba(255,221,167,${.07+rand()*.13})`;
     ctx.lineWidth=.35+rand()*.85;ctx.beginPath();
     for(let y=0;y<=512;y+=8){const xx=x+Math.sin(y*.022+phase)*1.7+Math.sin(y*.071+phase)*.5;if(y===0)ctx.moveTo(xx,y);else ctx.lineTo(xx,y);}
     ctx.stroke();
   }
   if(board%3===1){
     const x=left+23+rand()*18,y=90+rand()*300;
     for(let ring=0;ring<6;ring++){ctx.strokeStyle=`rgba(90,49,25,${.2-ring*.022})`;ctx.lineWidth=.8;ctx.beginPath();ctx.ellipse(x,y,1.2+ring*1.3,4+ring*3,.04,0,Math.PI*2);ctx.stroke();}
   }
   ctx.restore();ctx.fillStyle='#795233';ctx.fillRect(left,0,1.1,512);ctx.fillStyle='#e1b880';ctx.fillRect(left+1.2,0,.6,512);
 }
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.anisotropy=8;return texture;
}
export class Scenery {
 group=new THREE.Group(); clouds:THREE.Group[]=[]; animated:THREE.Object3D[]=[]; localLights:THREE.PointLight[]=[];water?:THREE.Mesh;sun:THREE.DirectionalLight;sky:THREE.HemisphereLight;
 private waterTime=0;
 constructor(public scene:THREE.Scene,public id:WorldId){
   const c=COLORS[id];scene.background=new THREE.Color(c.sky);scene.fog=new THREE.Fog(c.fog,28,id==='space'?180:105);
   this.sun=new THREE.DirectionalLight(c.sun,id==='city'?2:3.1);this.sun.position.set(-16,29,13);this.sun.castShadow=true;this.sun.shadow.mapSize.set(2048,2048);this.sun.shadow.camera.left=-18;this.sun.shadow.camera.right=18;this.sun.shadow.camera.top=20;this.sun.shadow.camera.bottom=-20;this.sun.shadow.camera.far=75;this.sun.shadow.bias=-.00025;this.sun.shadow.normalBias=.035;this.group.add(this.sun,this.sun.target);
   this.sky=new THREE.HemisphereLight(c.ambient,id==='space'?0x192031:0x5c614a,.95);this.group.add(this.sky);scene.add(this.group);
   const rand=random(3924);
   const terrain=new THREE.PlaneGeometry(180,180,70,70);terrain.rotateX(-Math.PI/2);const pos=terrain.attributes.position;
   for(let i=0;i<pos.count;i++){const x=pos.getX(i),z=pos.getZ(i);const dist=Math.hypot(x,z);pos.setY(i,dist<10?-.1:Math.sin(x*.12)*Math.cos(z*.14)*Math.min(3,(dist-10)*.1)-.1);}
   terrain.computeVertexNormals();const groundMat=mat(c.ground);if(id!=='space'&&id!=='city'){groundMat.map=groundTexture();groundMat.map.repeat.set(45,45);}add(this.group,terrain,groundMat);
   this.platform();
   if(id==='forest'||id==='snow')this.forest(rand,id==='snow');
   if(id==='city')this.city(rand);
   if(id==='space')this.space(rand);
   if(id==='desert')this.desert(rand);
   if(id==='beach')this.beach(rand);
   if(id!=='city'&&id!=='space'){
     this.mountains(rand,id==='snow',id==='desert');
     const puffs=Array.from({length:5},(_,j)=>new THREE.SphereGeometry(1,12,8).scale(3,1,1.5).translate(j*2-4,(j%2)*.45,0));
     const cloudGeometry=mergeGeometries(puffs)!;puffs.forEach(puff=>puff.dispose());
     const cloudMaterial=new THREE.MeshBasicMaterial({color:0xf9f7e9,transparent:true,opacity:.42,depthWrite:false});
     for(let i=0;i<12;i++){const cloud=new THREE.Group();const puff=add(cloud,cloudGeometry,cloudMaterial);puff.castShadow=false;puff.receiveShadow=false;cloud.position.set((rand()-.5)*130,24+rand()*17,-40-rand()*30);cloud.scale.setScalar(1+rand()*1.8);this.clouds.push(cloud);this.group.add(cloud);}
   }
   const moving=new Set<THREE.Object3D>([this.sun,this.sun.target,...this.clouds,...this.animated]);
   this.group.traverse(object=>{if(!moving.has(object)){object.updateMatrix();object.matrixAutoUpdate=false;}});
 }
 platform(){
   const grain=woodTexture(),rimGrain=grain.clone();rimGrain.rotation=Math.PI/2;rimGrain.repeat.set(3,.25);
   const rim=new THREE.MeshStandardMaterial({map:rimGrain,color:0x9d724e,roughness:.48});
   add(this.group,new THREE.CylinderGeometry(4.15,4.35,.55,80),rim,0,.16,0);
   const deck=new THREE.MeshPhysicalMaterial({map:grain,bumpMap:grain,bumpScale:.016,roughness:.46,clearcoat:.24,clearcoatRoughness:.42});
   const surface=add(this.group,new THREE.CylinderGeometry(4.17,4.17,.045,80),[rim,deck,rim],0,.455,0);surface.name='wooden-platform';
   const brass=new THREE.MeshStandardMaterial({color:0xc49a57,metalness:.62,roughness:.34});
   const ring=add(this.group,new THREE.TorusGeometry(4.04,.022,6,80),brass,0,.485,0);ring.rotation.x=Math.PI/2;
   const studs=Array.from({length:12},(_,i)=>({position:new THREE.Vector3(Math.cos(i*Math.PI/6)*3.81,.486,Math.sin(i*Math.PI/6)*3.81),scale:new THREE.Vector3(1,1,1)}));
   batch(this.group,new THREE.CylinderGeometry(.035,.035,.009,12),brass,studs);
 }
 forest(rand:()=>number,snow:boolean){
   const trunks: any[]=[],foliage:any[]=[],tips:any[]=[],grass:any[]=[],rocks:any[]=[];
   for(let i=0;i<120;i++){
     const angle=rand()*Math.PI*2,dist=18+rand()*65;const x=Math.cos(angle)*dist,z=Math.sin(angle)*dist; if(x*.62+z*.77>0&&Math.abs(x*.77-z*.62)<12)continue;const h=5+rand()*10;
     const y=Math.sin(x*.12)*Math.cos(z*.14)*Math.min(3,(dist-10)*.1);
     trunks.push({position:new THREE.Vector3(x,y+h*.35,z),scale:new THREE.Vector3(.3+rand()*.25,h*.7,.3+rand()*.25)});
     for(let j=0;j<3;j++)foliage.push({position:new THREE.Vector3(x,y+h*.58,z),scale:new THREE.Vector3(h*.32,h*.97,h*.32),rotation:new THREE.Euler(0,j*Math.PI/3+rand()*.2,0)});
     if(snow)for(let j=0;j<2;j++)tips.push({position:new THREE.Vector3(x,y+h*(.5+j*.21),z),scale:new THREE.Vector3(h*(.21-j*.052),h*.35,h*(.21-j*.052))});
   }
   batch(this.group,new THREE.CylinderGeometry(.65,1,1,8),mat(snow?0x656c63:0x655d42),trunks);
   const pineMaterial=new THREE.MeshStandardMaterial({map:pineTexture(snow),color:snow?0xffffff:0x92a680,alphaTest:.48,side:THREE.DoubleSide,roughness:.95});batch(this.group,new THREE.PlaneGeometry(2,1),pineMaterial,foliage);
   
   if(!snow){
     const canopy:any[]=[];for(let i=0;i<25;i++){const a=rand()*Math.PI*2,r=19+rand()*30;const x=Math.cos(a)*r,z=Math.sin(a)*r;if(x*.62+z*.77>0&&Math.abs(x*.77-z*.62)<12)continue;canopy.push({position:new THREE.Vector3(x,.5+rand()*.4,z),scale:new THREE.Vector3(1+rand(),.5+rand()*.4,1+rand())});}
     batch(this.group,new THREE.IcosahedronGeometry(1,3),mat(0x5c7347),canopy);
     for(let i=0;i<1800;i++){const a=rand()*Math.PI*2,r=5+rand()*34;const x=Math.cos(a)*r,z=Math.sin(a)*r;grass.push({position:new THREE.Vector3(x,Math.sin(x*.12)*Math.cos(z*.14)*Math.min(3,Math.max(0,r-10)*.1)+.16,z),scale:new THREE.Vector3(.1,.25+rand()*.4,.1),rotation:new THREE.Euler(0,rand()*Math.PI,rand()*.2)});}
     batch(this.group,new THREE.ConeGeometry(1,1,3),mat(0x80915a),grass,false);
   }
   for(let i=0;i<45;i++){const a=rand()*6.28,r=5+rand()*32;rocks.push({position:new THREE.Vector3(Math.cos(a)*r,.15,Math.sin(a)*r),scale:new THREE.Vector3(.4+rand(),.25+rand()*.5,.4+rand()),rotation:new THREE.Euler(rand(),rand(),rand())});}
   batch(this.group,new THREE.DodecahedronGeometry(1,1),mat(snow?0xabb9ba:0x8b8a75),rocks);
 }
 mountains(rand:()=>number,snow:boolean,desert:boolean){
   for(let i=0;i<15;i++){
     const h=(desert?8:18)+rand()*25, radius=12+rand()*17;
     const geo=new THREE.ConeGeometry(radius,h,9,5);const p=geo.attributes.position;
     for(let j=0;j<p.count;j++){const y=p.getY(j);if(y<h*.4){p.setX(j,p.getX(j)*(1+rand()*.3));p.setZ(j,p.getZ(j)*(1+rand()*.3));}}geo.computeVertexNormals();
     const a=i/15*Math.PI*2;const x=Math.cos(a)*(80+rand()*18),z=Math.sin(a)*(80+rand()*18);
     add(this.group,geo,mat(desert?0xba875f:snow?0x879eaa:0x829388),x,h/2-3,z);
     if(snow)add(this.group,new THREE.ConeGeometry(radius*.27,h*.3,9),mat(0xebeeea),x,h*.86-3,z);
   }
 }
 city(rand:()=>number){
   const buildings:any[]=[],windows:any[]=[];
   for(let i=0;i<85;i++){const a=rand()*6.28,r=18+rand()*58,x=Math.cos(a)*r,z=Math.sin(a)*r,h=5+rand()*25,w=3+rand()*4;if(x*.62+z*.77>0&&Math.abs(x*.77-z*.62)<13)continue;buildings.push({position:new THREE.Vector3(x,h/2,z),scale:new THREE.Vector3(w,h,w)});
     for(let y=2;y<h-1;y+=1.3)for(let k=0;k<3;k++)if(rand()>.25)windows.push({position:new THREE.Vector3(x-w*.35+k*w*.35,y,z+w/2+.02),scale:new THREE.Vector3(.48,.6,.03)});
   }
   batch(this.group,new THREE.BoxGeometry(1,1,1),mat(0x30384b),buildings);
   batch(this.group,new THREE.BoxGeometry(1,1,1),new THREE.MeshBasicMaterial({color:0xf3ce8f}),windows,false);
   for(let i=0;i<8;i++){const a=i*Math.PI/4;const light=new THREE.PointLight(i%2?0xf775b3:0x65bdce,12,15);light.position.set(Math.cos(a)*11,3,Math.sin(a)*11);this.localLights.push(light);this.group.add(light);const lamp=add(this.group,new THREE.SphereGeometry(.15,8,8),new THREE.MeshBasicMaterial({color:i%2?0xf775b3:0x65bdce}),light.position.x,4.5,light.position.z);add(this.group,new THREE.CylinderGeometry(.04,.08,4.5,8),mat(0x262d38),lamp.position.x,2.2,lamp.position.z);}
 }
 space(rand:()=>number){
   const vertices=[];for(let i=0;i<1800;i++){const a=rand()*6.28,b=rand()*Math.PI;vertices.push(Math.cos(a)*Math.sin(b)*140,Math.abs(Math.cos(b))*140+10,Math.sin(a)*Math.sin(b)*140);}
   const stars=new THREE.Points(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(vertices,3)),new THREE.PointsMaterial({color:0xd6e4ff,size:.3,sizeAttenuation:true}));this.group.add(stars);this.animated.push(stars);
   const planet=add(this.group,new THREE.SphereGeometry(13,40,24),mat(0x7973b0),-36,32,-65);planet.castShadow=false;
   const ring=add(this.group,new THREE.RingGeometry(18,24,64),new THREE.MeshBasicMaterial({color:0xb3a1d0,side:THREE.DoubleSide,transparent:true,opacity:.55}),-36,32,-65);ring.rotation.set(1.1,.2,.3);
   const asteroids=Array.from({length:35},()=>{const a=rand()*6.28,r=12+rand()*42,size=.7+rand()*2;return{position:new THREE.Vector3(Math.cos(a)*r,.4,Math.sin(a)*r),scale:new THREE.Vector3(size,size,size)};});
   batchSpatial(this.group,new THREE.DodecahedronGeometry(1),mat(0x5b6176),asteroids);
 }
 desert(rand:()=>number){
   const dunes:[InstanceTransform[],InstanceTransform[]]=[[],[]];
   for(let i=0;i<18;i++){const a=rand()*6.28,r=19+rand()*55;dunes[i%2].push({position:new THREE.Vector3(Math.cos(a)*r,-2,Math.sin(a)*r),scale:new THREE.Vector3(12+rand()*10,4+rand()*3,12+rand()*15)});}
   dunes.forEach((transforms,index)=>batchSpatial(this.group,new THREE.SphereGeometry(1,32,16),mat(index?0xd2aa76:0xc19462),transforms));
   const cactusMat=mat(0x6d8461),cacti=new Map<string,THREE.Group>();
   for(let i=0;i<35;i++){const a=rand()*6.28,r=9+rand()*40,x=Math.cos(a)*r,z=Math.sin(a)*r,h=1+rand()*2,key=`${Math.floor(x/16)},${Math.floor(z/16)}`;if(!cacti.has(key)){const group=new THREE.Group();cacti.set(key,group);this.group.add(group);}const group=cacti.get(key)!;add(group,new THREE.CapsuleGeometry(.19,h,4,8),cactusMat,x,h/2+.3,z);const arm=add(group,new THREE.CapsuleGeometry(.11,.8,4,8),cactusMat,x+.4,h*.6,z);arm.rotation.z=Math.PI/2;add(group,new THREE.CapsuleGeometry(.12,.45,4,8),cactusMat,x+.8,h*.6+.3,z);}
   cacti.forEach(group=>mergeStatic(group,cactusMat));
 }
 beach(rand:()=>number){
   this.water=add(this.group,new THREE.PlaneGeometry(180,85,30,20),new THREE.MeshStandardMaterial({color:0x4faba9,metalness:.6,roughness:.22}),0,.025,-54);this.water.rotation.x=-Math.PI/2;this.water.castShadow=false;
   const trunks:InstanceTransform[]=[],leaves:InstanceTransform[]=[];
   for(let i=0;i<24;i++){const a=rand()*Math.PI,r=13+rand()*36,x=Math.cos(a)*r,z=Math.sin(a)*r,h=5+rand()*4;if(x*.62+z*.77>0&&Math.abs(x*.77-z*.62)<10)continue;trunks.push({position:new THREE.Vector3(x,h/2,z),scale:new THREE.Vector3(1,h,1),rotation:new THREE.Euler(0,0,.12)});
     for(let j=0;j<8;j++)leaves.push({position:new THREE.Vector3(x+Math.cos(j*Math.PI/4)*1.8,h-.3,z+Math.sin(j*Math.PI/4)*1.8),scale:new THREE.Vector3(.45,.12,2.6),rotation:new THREE.Euler(.27,j*Math.PI/4,0)});
   }
   batchSpatial(this.group,new THREE.CylinderGeometry(.13,.3,1,9),mat(0x97806a),trunks,12);
   batchSpatial(this.group,new THREE.SphereGeometry(1,12,6),mat(0x638368),leaves,12);
 }
 setLightBudget(count:number){const order=[0,1,4,5,2,3,6,7];this.localLights.forEach((light,index)=>light.visible=order.indexOf(index)<count);}
 update(dt:number,height:number){
   for(const c of this.clouds){c.position.x+=dt*.28;if(c.position.x>85)c.position.x=-85;}
   this.sun.target.position.y=height*.65;this.sun.position.y=29+height*.65;
   if(this.water&&dt>0){this.waterTime+=dt;const p=this.water.geometry.attributes.position;for(let i=0;i<p.count;i++)p.setZ(i,Math.sin(p.getX(i)*.2+this.waterTime*.7)*.1);p.needsUpdate=true;}
   for(const o of this.animated)o.rotation.y+=dt*.006;
 }
 dispose(){this.scene.remove(this.group);const geos=new Set<THREE.BufferGeometry>(),mats=new Set<THREE.Material>();this.group.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.Points){geos.add(o.geometry);(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>mats.add(m));}if(o instanceof THREE.InstancedMesh)o.dispose();if(o instanceof THREE.Light)o.dispose();});geos.forEach(g=>g.dispose());mats.forEach(m=>{if(m instanceof THREE.MeshStandardMaterial)m.map?.dispose();m.dispose();});}
}
