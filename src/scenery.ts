import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
export type WorldId='forest'|'city'|'space'|'snow'|'desert'|'beach';
const COLORS:Record<WorldId,{sky:number;fog:number;ground:number;sun:number;ambient:number}>={
 forest:{sky:0xa9c9dc,fog:0xb7c6bd,ground:0x728064,sun:0xffe4bc,ambient:0xdce9ed},
 city:{sky:0x111a29,fog:0x29313c,ground:0x282d32,sun:0xb9ceea,ambient:0x8eacca},
 space:{sky:0x070f24,fog:0x0b1429,ground:0x464c68,sun:0xa9c9ff,ambient:0x727dc2},
 snow:{sky:0xcbdde5,fog:0xdce5e9,ground:0xe0e7e8,sun:0xfff0d8,ambient:0xdbecff},
 desert:{sky:0xe3cda7,fog:0xddbb8a,ground:0xc7a073,sun:0xffdc9d,ambient:0xf1dec5},
 beach:{sky:0xb9dce0,fog:0xc9e3dc,ground:0xe1cda4,sun:0xfff1d2,ambient:0xe5f7f0},
};
function random(seed:number){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function mat(color:number,roughness=.85){return new THREE.MeshStandardMaterial({color,roughness});}
type InstanceTransform={position:THREE.Vector3;scale:THREE.Vector3;rotation?:THREE.Euler;color?:number};
function add(g:THREE.Group,geo:THREE.BufferGeometry,m:THREE.Material|THREE.Material[],x=0,y=0,z=0){const mesh=new THREE.Mesh(geo,m);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;g.add(mesh);return mesh;}
function batch(g:THREE.Group,geo:THREE.BufferGeometry,m:THREE.Material,transforms:InstanceTransform[],shadows=true){const mesh=new THREE.InstancedMesh(geo,m,transforms.length);const dummy=new THREE.Object3D();transforms.forEach((v,i)=>{dummy.position.copy(v.position);dummy.scale.copy(v.scale);dummy.rotation.copy(v.rotation||new THREE.Euler());dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);if(v.color!==undefined)mesh.setColorAt(i,new THREE.Color(v.color));});mesh.castShadow=shadows;mesh.receiveShadow=true;g.add(mesh);return mesh;}
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
// Deterministic value noise supplies original surface variation without asset downloads.
function noise(x:number,y:number){
 const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,sx=fx*fx*(3-2*fx),sy=fy*fy*(3-2*fy);
 const hash=(a:number,b:number)=>{let n=Math.imul(a,374761393)+Math.imul(b,668265263);n=Math.imul(n^(n>>>13),1274126177);return((n^(n>>>16))>>>0)/4294967295;};
 return THREE.MathUtils.lerp(THREE.MathUtils.lerp(hash(ix,iy),hash(ix+1,iy),sx),THREE.MathUtils.lerp(hash(ix,iy+1),hash(ix+1,iy+1),sx),sy);
}
function texture(canvas:HTMLCanvasElement,repeat=1){const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(repeat,repeat);t.anisotropy=4;return t;}
function surfaceTexture(kind:WorldId|'bark'|'rock',size=512){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=size;const ctx=canvas.getContext('2d')!,image=ctx.createImageData(size,size),data=image.data;
 const palette:Record<string,number[][]>={forest:[[63,64,43],[111,119,74],[149,137,100]],snow:[[176,193,201],[218,229,233],[241,242,235]],desert:[[153,112,69],[201,164,111],[229,197,145]],beach:[[149,133,103],[204,190,153],[232,218,178]],city:[[35,38,42],[55,58,60],[79,78,73]],space:[[64,68,77],[99,102,108],[137,139,140]],bark:[[45,44,36],[83,76,57],[119,108,77]],rock:[[88,92,87],[139,145,139],[186,190,180]]};
 const c=palette[kind],rand=random(4821+kind.length*19);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const n=noise(x/75,y/75)*.50+noise(x/23+11,y/23+4)*.30+noise(x/5,y/5)*.20;
  const n2=kind==='bark'?(noise(x/5,y/80)*.68+noise(x/18,y/35)*.32):kind==='desert'?(n*.78+Math.sin(y*.22+noise(x/65,y/90)*6)*.11+.11):n;
  const mix=Math.max(0,Math.min(.999,n2))*2,j=Math.floor(mix),f=mix-j,grain=(rand()-.5)*(kind==='snow'?9:21),index=(y*size+x)*4;
  for(let k=0;k<3;k++)data[index+k]=THREE.MathUtils.lerp(c[j][k],c[j+1][k],f)+grain;
  data[index+3]=255;
 }
 ctx.putImageData(image,0,0);
 if(kind==='forest'){
  for(let j=0;j<900;j++){const x=rand()*size,y=rand()*size;ctx.strokeStyle=rand()>.5?'#6d7845':'#96916b';ctx.lineWidth=.55+rand();ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+rand()*5-2.5,y-2-rand()*5);ctx.stroke();}
 }
 return texture(canvas);
}
function branchTexture(snow:boolean){
 const canvas=document.createElement('canvas');canvas.width=512;canvas.height=256;const c=canvas.getContext('2d')!,rand=random(6382);
 c.lineCap='round';c.strokeStyle='#665a43';c.lineWidth=3;c.beginPath();c.moveTo(12,130);c.bezierCurveTo(170,126,310,148,494,121);c.stroke();
 const greens=['#263d2a','#375238','#496647','#5c7653','#778866'];
 for(let j=0;j<115;j++){
  const x=12+j*4.12,center=130+Math.sin(j*.055)*8,reach=(17+Math.sin(j/115*Math.PI)*82)*(.64+rand()*.36);
  for(const side of [-1,1]){
   const ex=x+28+rand()*14,ey=center+side*reach;
   c.strokeStyle=greens[j%greens.length];c.lineWidth=1.2;c.beginPath();c.moveTo(x,center);c.lineTo(ex,ey);c.stroke();
   for(let k=0;k<11;k++){
    const t=k/11,xx=THREE.MathUtils.lerp(x,ex,t),yy=THREE.MathUtils.lerp(center,ey,t);
    c.strokeStyle=snow&&side<0&&rand()>.25?['#d7e2e1','#edf0e9','#b6c8c7'][k%3]:greens[Math.floor(rand()*greens.length)];c.lineWidth=1.6+rand()*1.3;
    c.beginPath();c.moveTo(xx,yy);c.lineTo(xx+7+rand()*10,yy+side*(5+rand()*12));c.stroke();
   }
  }
 }
 const map=texture(canvas);map.wrapS=map.wrapT=THREE.ClampToEdgeWrapping;return map;
}
function branchCrown(){
 const positions:number[]=[],uv:number[]=[],indices:number[]=[],rand=random(1298);
 const quad=(points:number[][])=>{const offset=positions.length/3;points.forEach(p=>positions.push(...p));uv.push(0,0,0,1,1,0,1,1);indices.push(offset,offset+2,offset+1,offset+1,offset+2,offset+3);};
 // Individual radial branches form a genuinely three-dimensional crown, not a tree billboard.
 for(let level=0;level<12;level++){
  const y=.18+level*.071,r=(1-y)*.32+.014,w=(1-y)*.12+.008;
  for(let arm=0;arm<7;arm++){
   const a=arm*Math.PI*2/7+level*.67+rand()*.15,dx=Math.cos(a),dz=Math.sin(a),tx=-dz,tz=dx,drop=.025+(1-y)*.018;
   const inner=.012,outer=r*(.83+rand()*.30);
   quad([[dx*inner-tx*w*.13,y,dz*inner-tz*w*.13],[dx*inner+tx*w*.13,y,dz*inner+tz*w*.13],[dx*outer-tx*w,y-drop,dz*outer-tz*w],[dx*outer+tx*w,y-drop,dz*outer+tz*w]]);
   quad([[dx*inner,y-w*.24,dz*inner],[dx*inner,y+w*.24,dz*inner],[dx*outer,y-drop-w*.76,dz*outer],[dx*outer,y-drop+w*.76,dz*outer]]);
  }
 }
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(indices);geo.computeVertexNormals();return geo;
}
function broadleafTexture(){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=512;const c=canvas.getContext('2d')!,rand=random(6842);
 // Small overlapping leaf silhouettes retain air gaps and soft, irregular crown edges.
 for(let branch=0;branch<10;branch++){
  const a=branch*Math.PI*2/10,x=256+Math.cos(a)*140,y=270+Math.sin(a)*130;c.strokeStyle='#5c5b42';c.lineWidth=2.2;c.beginPath();c.moveTo(256,310);c.quadraticCurveTo(256,255,x,y);c.stroke();
 }
 for(let j=0;j<670;j++){
  const a=rand()*Math.PI*2,r=Math.sqrt(rand())*(176+Math.sin(a*7)*17),x=256+Math.cos(a)*r,y=252+Math.sin(a)*r*.89;
  const tone=124+Math.floor(rand()*104);c.fillStyle=`rgb(${tone},${tone+Math.floor(rand()*9)},${tone-12})`;c.save();c.translate(x,y);c.rotate(a+rand()*2);c.beginPath();c.ellipse(0,0,3.5+rand()*4.5,7+rand()*7,0,0,Math.PI*2);c.fill();c.strokeStyle='rgba(72,80,53,.22)';c.lineWidth=.65;c.beginPath();c.moveTo(0,-7);c.lineTo(0,7);c.stroke();c.restore();
 }
 const map=texture(canvas);map.wrapS=map.wrapT=THREE.ClampToEdgeWrapping;return map;
}
function cloudTexture(){
 const canvas=document.createElement('canvas');canvas.width=512;canvas.height=256;const c=canvas.getContext('2d')!,rand=random(5192);
 for(let i=0;i<85;i++){
  const x=45+rand()*422,y=111+Math.sin(x*.014)*24+(rand()-.5)*54,r=18+rand()*52,g=c.createRadialGradient(x,y-r*.15,r*.12,x,y,r);
  g.addColorStop(0,'rgba(255,253,245,.21)');g.addColorStop(.5,'rgba(224,232,230,.13)');g.addColorStop(1,'rgba(211,221,225,0)');c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);
 }
 const t=texture(canvas);t.wrapS=t.wrapT=THREE.ClampToEdgeWrapping;return t;
}
function skyTexture(id:WorldId){
 const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=512;const c=canvas.getContext('2d')!,g=c.createLinearGradient(0,0,0,512);
 const colors:Record<WorldId,string[]>={forest:['#5386ab','#9fc0d0','#d6d8bf','#c6c4a2'],snow:['#5188b1','#b1cddd','#e3e8e7','#c8d5d9'],desert:['#719eb9','#bdd0ce','#e8d1aa','#d1a875'],beach:['#3e8dae','#9dcbd7','#d8e3d8','#cfdbc8'],city:['#060c18','#111d30','#364250','#23313d'],space:['#02050d','#070f23','#182638','#111823']};
 const palette=colors[id];g.addColorStop(0,palette[0]);g.addColorStop(.42,palette[1]);g.addColorStop(.56,palette[2]);g.addColorStop(1,palette[3]);c.fillStyle=g;c.fillRect(0,0,1024,512);
 if(id!=='space'){
  const x=335,y=id==='city'?161:190,r=id==='city'?34:91,glow=c.createRadialGradient(x,y,1,x,y,r);
  glow.addColorStop(0,id==='city'?'rgba(222,232,243,.70)':'rgba(255,246,212,.86)');glow.addColorStop(.08,id==='city'?'rgba(221,232,244,.54)':'rgba(255,243,205,.52)');glow.addColorStop(.27,'rgba(255,235,190,.14)');glow.addColorStop(1,'rgba(255,225,180,0)');c.fillStyle=glow;c.fillRect(x-r,y-r,r*2,r*2);
 }
 const t=texture(canvas);t.mapping=THREE.EquirectangularReflectionMapping;return t;
}
function terrainHeight(x:number,z:number,id:WorldId){
 const r=Math.hypot(x,z);if(r<11)return-.13;
 if(id==='beach')return THREE.MathUtils.lerp(-.1,.22-THREE.MathUtils.smoothstep(-z,4,17)*1.45+Math.sin(x*.06)*.07,THREE.MathUtils.smoothstep(r,11,16));
 if(id==='city')return-.1;
 const weight=Math.min(1,(r-11)/16),relief=id==='desert'?1.2:id==='space'?.8:2.2;
 return-.1+((noise(x*.033+39,z*.033+54)-.5)*relief+Math.sin(x*.10)*Math.cos(z*.09)*.50)*weight;
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
 private waterTime=0;private backgroundTexture?:THREE.Texture;private waterNormal?:THREE.Texture;
 constructor(public scene:THREE.Scene,public id:WorldId){
   const c=COLORS[id];this.backgroundTexture=skyTexture(id);scene.background=this.backgroundTexture;scene.fog=new THREE.Fog(c.fog,id==='city'?22:34,id==='space'?190:id==='city'?115:142);
   this.sun=new THREE.DirectionalLight(c.sun,id==='city'?1.65:id==='space'?2.1:3.0);this.sun.position.set(-16,29,13);this.sun.castShadow=true;this.sun.shadow.mapSize.set(2048,2048);this.sun.shadow.camera.left=-18;this.sun.shadow.camera.right=18;this.sun.shadow.camera.top=20;this.sun.shadow.camera.bottom=-20;this.sun.shadow.camera.far=75;this.sun.shadow.bias=-.00025;this.sun.shadow.normalBias=.035;this.group.add(this.sun,this.sun.target);
   this.sky=new THREE.HemisphereLight(c.ambient,id==='space'?0x192031:id==='city'?0x161a22:0x575849,id==='city'?.70:.90);this.group.add(this.sky);scene.add(this.group);
   const rand=random(3924),terrain=new THREE.PlaneGeometry(220,220,74,74);terrain.rotateX(-Math.PI/2);const pos=terrain.attributes.position;
   for(let i=0;i<pos.count;i++)pos.setY(i,terrainHeight(pos.getX(i),pos.getZ(i),id));
   terrain.computeVertexNormals();const groundMat=mat(0xffffff);groundMat.map=surfaceTexture(id);groundMat.map.repeat.set(id==='city'?48:34,id==='city'?48:34);groundMat.bumpMap=groundMat.map;groundMat.bumpScale=id==='snow'?.018:id==='city'?.015:.065;add(this.group,terrain,groundMat);
   this.platform();
   if(id==='forest'||id==='snow')this.forest(rand,id==='snow');
   if(id==='city')this.city(rand);
   if(id==='space')this.space(rand);
   if(id==='desert')this.desert(rand);
   if(id==='beach')this.beach(rand);
   if(id!=='city'&&id!=='space'){
     this.mountains(rand,id==='snow',id==='desert');
     const cloudGeometry=new THREE.PlaneGeometry(30,11),cloudMaterial=new THREE.MeshBasicMaterial({map:cloudTexture(),transparent:true,opacity:.72,depthWrite:false,fog:false,color:0xffffff});
     for(let i=0;i<10;i++){
      const cloud=new THREE.Group(),puff=add(cloud,cloudGeometry,cloudMaterial);puff.rotation.y=.68;puff.rotation.z=(rand()-.5)*.06;puff.castShadow=false;puff.receiveShadow=false;
      cloud.position.set((rand()-.5)*150,30+rand()*24,-47-rand()*45);cloud.scale.set(1+rand()*1.6,.65+rand()*.55,1);this.clouds.push(cloud);this.group.add(cloud);
     }
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
   const trunks:InstanceTransform[]=[],pineCrowns:InstanceTransform[]=[],broadCrowns:InstanceTransform[]=[],branches:InstanceTransform[]=[],grass:InstanceTransform[]=[],rocks:InstanceTransform[]=[];
   const greens=[0xc6d3b9,0xd8decd,0xb4c5a9,0xd5dbbb],crownColors=[0x7c9863,0x8fa574,0x637e53];
   for(let i=0;i<112;i++){
     const a=rand()*Math.PI*2,r=15+rand()*78,x=Math.cos(a)*r,z=Math.sin(a)*r;
     if(x*.62+z*.77>0&&Math.abs(x*.77-z*.62)<13)continue;
     const h=9+rand()*13,y=terrainHeight(x,z,this.id),radius=.24+rand()*.22;
     trunks.push({position:new THREE.Vector3(x,y+h*.49,z),scale:new THREE.Vector3(radius,h*.98,radius),rotation:new THREE.Euler(0,rand()*Math.PI,rand()*.025),color:snow?0xc8cdc5:0xffffff});
     pineCrowns.push({position:new THREE.Vector3(x,y,z),scale:new THREE.Vector3(h*(.85+rand()*.25),h,h*(.85+rand()*.25)),rotation:new THREE.Euler(0,rand()*Math.PI*2,0),color:snow?0xffffff:greens[i%greens.length]});
   }
   const bark=mat(0xffffff);bark.map=surfaceTexture('bark',256);bark.map.repeat.set(1,3);bark.bumpMap=bark.map;bark.bumpScale=.045;
   batch(this.group,new THREE.CylinderGeometry(.58,1,1,9),bark,trunks);
   const pineMaterial=new THREE.MeshStandardMaterial({map:branchTexture(snow),alphaTest:.42,side:THREE.DoubleSide,roughness:1});
   batch(this.group,branchCrown(),pineMaterial,pineCrowns);
   if(!snow){
     for(let i=0;i<16;i++){
      const a=rand()*Math.PI*2,r=16+rand()*40,x=Math.cos(a)*r,z=Math.sin(a)*r;if(x*.62+z*.77>0&&Math.abs(x*.77-z*.62)<13)continue;
      const y=terrainHeight(x,z,this.id),h=7+rand()*6;
      branches.push({position:new THREE.Vector3(x,y+h*.38,z),scale:new THREE.Vector3(.25,h*.76,.25)});
      for(let j=0;j<7;j++){
       const angle=j*Math.PI*2/7,rr=j===0?0:1.0+rand()*1.5;
       broadCrowns.push({position:new THREE.Vector3(x+Math.cos(angle)*rr,y+h*(.66+rand()*.24),z+Math.sin(angle)*rr),scale:new THREE.Vector3(1.4+rand()*.7,1.15+rand()*.9,1.35+rand()*.9),rotation:new THREE.Euler(rand()*.6,rand()*6.28,rand()*.6),color:crownColors[(i+j)%3]});
      }
     }
     batch(this.group,new THREE.CylinderGeometry(.5,1,1,8),bark,branches);
     const cards=[0,Math.PI/3,Math.PI*2/3].map(angle=>{const geo=new THREE.PlaneGeometry(2,2);geo.rotateY(angle);return geo;});
     const horizontal=new THREE.PlaneGeometry(2,2);horizontal.rotateX(-Math.PI/2);cards.push(horizontal);
     const crownGeometry=mergeGeometries(cards)!;cards.forEach(card=>card.dispose());
     const leafMat=new THREE.MeshStandardMaterial({map:broadleafTexture(),alphaTest:.45,side:THREE.DoubleSide,roughness:1});
     batch(this.group,crownGeometry,leafMat,broadCrowns);
     const blade=new THREE.BufferGeometry(),positions:number[]=[],indices:number[]=[],blades=random(822);
     for(let j=0;j<7;j++){
      const a=j*Math.PI*2/7,x=Math.cos(a)*.13,z=Math.sin(a)*.13,height=.5+blades()*.5,width=.025+blades()*.025,offset=positions.length/3;
      positions.push(x-width,0,z,x+width,0,z,x-width*.5,height*.57,z+.06,x+width*.5,height*.57,z+.06,x,height,z+.17);indices.push(offset,offset+2,offset+1,offset+1,offset+2,offset+3,offset+2,offset+4,offset+3);
     }
     blade.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));blade.setIndex(indices);blade.computeVertexNormals();
     for(let i=0;i<1150;i++){const a=rand()*Math.PI*2,r=4.8+rand()*39,x=Math.cos(a)*r,z=Math.sin(a)*r;grass.push({position:new THREE.Vector3(x,terrainHeight(x,z,this.id),z),scale:new THREE.Vector3(.65+rand()*.7,.22+rand()*.45,.65+rand()*.7),rotation:new THREE.Euler(0,rand()*Math.PI*2,0),color:[0x73834b,0x87915e,0x596e41,0x9c9c65][i%4]});}
     const grassMat=mat(0xffffff);grassMat.side=THREE.DoubleSide;batch(this.group,blade,grassMat,grass,false);
   }
   for(let i=0;i<52;i++){const a=rand()*6.28,r=5+rand()*38,x=Math.cos(a)*r,z=Math.sin(a)*r;rocks.push({position:new THREE.Vector3(x,terrainHeight(x,z,this.id)+.13,z),scale:new THREE.Vector3(.3+rand()*.9,.22+rand()*.5,.3+rand()*.8),rotation:new THREE.Euler(rand(),rand(),rand()),color:snow?0xd6dedf:0xc1c4b4});}
   const rock=mat(0xffffff);rock.map=surfaceTexture('rock',256);rock.bumpMap=rock.map;rock.bumpScale=.06;batch(this.group,new THREE.DodecahedronGeometry(1,1),rock,rocks);
 }
 mountains(rand:()=>number,snow:boolean,desert:boolean){
   // One continuous eroded ridge field replaces isolated, visibly geometric cone peaks.
   const geo=new THREE.PlaneGeometry(270,270,80,80);geo.rotateX(-Math.PI/2);const p=geo.attributes.position,colors:number[]=[];
   for(let j=0;j<p.count;j++){
    const x=p.getX(j),z=p.getZ(j),r=Math.hypot(x,z),angle=Math.atan2(z,x),weight=THREE.MathUtils.smoothstep(r,56,97);
    const ridge=Math.pow(.5+.5*Math.sin(angle*5.3+noise(x*.027,z*.027)*3),1.4),fine=noise(x*.08+10,z*.08+19);
    const h=-.65+weight*((desert?5:10)+ridge*(desert?13:30)+fine*(desert?4:9));p.setY(j,h);
   }
   geo.computeVertexNormals();const normal=geo.attributes.normal;
   for(let j=0;j<p.count;j++){
    const h=p.getY(j),variation=noise(p.getX(j)*.075+6,p.getZ(j)*.075+3),rock=new THREE.Color(desert?0xb49a76:snow?0x8a999f:0x73877d);
    rock.multiplyScalar(.76+variation*.36);
    if(snow){const snowline=THREE.MathUtils.smoothstep(h+variation*5,15,24)*THREE.MathUtils.smoothstep(normal.getY(j),.35,.8);rock.lerp(new THREE.Color(0xe8eeeb),snowline);}
    else if(!desert&&normal.getY(j)<.62)rock.lerp(new THREE.Color(0x8a9189),.52);
    colors.push(rock.r,rock.g,rock.b);
   }
   geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));const m=mat(0xffffff);m.vertexColors=true;m.map=surfaceTexture('rock',256);m.map.repeat.set(22,22);m.bumpMap=m.map;m.bumpScale=.11;
   const mountain=add(this.group,geo,m);mountain.castShadow=false;mountain.name='natural-mountain-ridges';
 }
 city(rand:()=>number){
   const facade=(variant:number)=>{
    const canvas=document.createElement('canvas'),glow=document.createElement('canvas');canvas.width=glow.width=256;canvas.height=glow.height=512;
    const c=canvas.getContext('2d')!,e=glow.getContext('2d')!,r=random(592+variant*29);c.fillStyle=variant?'#3d4145':'#303a43';c.fillRect(0,0,256,512);e.fillStyle='#000';e.fillRect(0,0,256,512);
    for(let row=0;row<24;row++)for(let col=0;col<7;col++){
     const x=col*36+7,y=row*21+5,lit=r()>.47;c.fillStyle=lit?['#b5b7a4','#b5c1c1','#c2b092'][Math.floor(r()*3)]:['#1e2930','#27343b','#344249'][Math.floor(r()*3)];c.fillRect(x,y,22,13);
     c.fillStyle='#69716e';c.fillRect(x-1,y,1,14);c.fillRect(x,y+14,23,1);
     if(lit){e.fillStyle=['#ffd8a1','#b7d2dc','#e8d8b7'][Math.floor(r()*3)];e.fillRect(x,y,22,13);if(r()>.65){e.fillStyle='#686156';e.fillRect(x+9,y,3,13);}}
    }
    const m=new THREE.MeshStandardMaterial({map:texture(canvas),emissiveMap:texture(glow),emissive:0xffffff,emissiveIntensity:.60,metalness:.15,roughness:.48});return m;
   };
   const buildings:[InstanceTransform[],InstanceTransform[]]=[[],[]],roofs:InstanceTransform[]=[],setbacks:InstanceTransform[]=[];
   for(let i=0;i<74;i++){
    const a=rand()*6.28,r=19+rand()*65,x=Math.cos(a)*r,z=Math.sin(a)*r,h=8+rand()*29,w=3.1+rand()*4.3,d=3+rand()*5;
    if(x*.62+z*.77>0&&Math.abs(x*.77-z*.62)<13)continue;
    buildings[i%2].push({position:new THREE.Vector3(x,h/2-.1,z),scale:new THREE.Vector3(w,h,d)});
    roofs.push({position:new THREE.Vector3(x,h+.10,z),scale:new THREE.Vector3(w+.12,.23,d+.12)});
    if(i%3===0)setbacks.push({position:new THREE.Vector3(x,h+1.0,z),scale:new THREE.Vector3(w*.52,1.8,d*.55)});
   }
   buildings.forEach((set,i)=>batch(this.group,new THREE.BoxGeometry(1,1,1),facade(i),set));batch(this.group,new THREE.BoxGeometry(1,1,1),mat(0x4c5356,.72),roofs);batch(this.group,new THREE.BoxGeometry(1,1,1),mat(0x465056,.65),setbacks);
   const road=add(this.group,new THREE.RingGeometry(6.2,16.5,80),mat(0x34393b,.80),0,-.075,0);road.rotation.x=-Math.PI/2;road.castShadow=false;
   const markings:InstanceTransform[]=[];for(let i=0;i<34;i++){const a=i*Math.PI/17;markings.push({position:new THREE.Vector3(Math.cos(a)*11.4,-.067,Math.sin(a)*11.4),scale:new THREE.Vector3(.09,.01,.95),rotation:new THREE.Euler(0,-a,0)});}batch(this.group,new THREE.BoxGeometry(1,1,1),mat(0xc0c1ae),markings,false);
   const poles:InstanceTransform[]=[],heads:InstanceTransform[]=[];
   for(let i=0;i<8;i++){
    const a=i*Math.PI/4,x=Math.cos(a)*13.5,z=Math.sin(a)*13.5,col=i%2?0xffd6a0:0xc0dbf2;
    const light=new THREE.PointLight(col,9,18);light.position.set(x,4.55,z);this.localLights.push(light);this.group.add(light);
    poles.push({position:new THREE.Vector3(x,2.15,z),scale:new THREE.Vector3(.07,4.45,.07)});heads.push({position:new THREE.Vector3(x,4.47,z),scale:new THREE.Vector3(.34,.07,.58),rotation:new THREE.Euler(0,-a,0),color:col});
   }
   batch(this.group,new THREE.CylinderGeometry(.65,1,1,8),mat(0x30383e,.52),poles);batch(this.group,new THREE.BoxGeometry(1,1,1),new THREE.MeshBasicMaterial({color:0xffffff}),heads,false);
 }
 space(rand:()=>number){
   const vertices:number[]=[],colors:number[]=[];
   for(let i=0;i<2100;i++){const a=rand()*6.28,b=rand()*Math.PI;vertices.push(Math.cos(a)*Math.sin(b)*145,Math.abs(Math.cos(b))*145+10,Math.sin(a)*Math.sin(b)*145);const color=new THREE.Color([0xcbdcf4,0xf1ebd7,0xadc9e9,0xe6e9f0][i%4]);color.multiplyScalar(.45+rand()*.55);colors.push(color.r,color.g,color.b);}
   const stars=new THREE.Points(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(vertices,3)).setAttribute('color',new THREE.Float32BufferAttribute(colors,3)),new THREE.PointsMaterial({vertexColors:true,size:.23,sizeAttenuation:true}));this.group.add(stars);this.animated.push(stars);
   const canvas=document.createElement('canvas');canvas.width=512;canvas.height=256;const ctx=canvas.getContext('2d')!,image=ctx.createImageData(512,256);
   for(let y=0;y<256;y++)for(let x=0;x<512;x++){
    const turbulence=noise(x*.035,y*.055)*17,n=.5+.5*Math.sin(y*.21+turbulence*.23),c=new THREE.Color(0x687b8c).lerp(new THREE.Color(0xc6bca3),n*.70+noise(x*.11,y*.06)*.20),index=(y*512+x)*4;
    c.convertLinearToSRGB();image.data[index]=c.r*255;image.data[index+1]=c.g*255;image.data[index+2]=c.b*255;image.data[index+3]=255;
   }
   ctx.putImageData(image,0,0);const planetMat=new THREE.MeshStandardMaterial({map:texture(canvas),roughness:.96});
   const planet=add(this.group,new THREE.SphereGeometry(14,48,28),planetMat,-37,35,-72);planet.rotation.z=.23;planet.castShadow=false;
   const ringCanvas=document.createElement('canvas');ringCanvas.width=ringCanvas.height=256;const rc=ringCanvas.getContext('2d')!;
   for(let radius=87;radius<123;radius++){rc.strokeStyle=`rgba(193,185,162,${.13+noise(radius*.7,0)*.30})`;rc.lineWidth=1;rc.beginPath();rc.arc(128,128,radius,0,Math.PI*2);rc.stroke();}
   const ring=add(this.group,new THREE.PlaneGeometry(51,51),new THREE.MeshBasicMaterial({map:texture(ringCanvas),side:THREE.DoubleSide,transparent:true,depthWrite:false,opacity:.75}),-37,35,-72);ring.rotation.set(1.15,.15,.23);ring.castShadow=false;
   const moonMat=mat(0xb3b8b7);moonMat.map=surfaceTexture('space',256);moonMat.bumpMap=moonMat.map;moonMat.bumpScale=.17;const moon=add(this.group,new THREE.SphereGeometry(4.6,24,16),moonMat,24,21,-56);moon.castShadow=false;
   const asteroids=Array.from({length:32},()=>{const a=rand()*6.28,r=12+rand()*45,x=Math.cos(a)*r,z=Math.sin(a)*r,size=.55+rand()*1.8;return{position:new THREE.Vector3(x,terrainHeight(x,z,this.id)+size*.25,z),scale:new THREE.Vector3(size,size*.65,size*.85),rotation:new THREE.Euler(rand(),rand(),rand()),color:0xadb3b9};});
   const asteroidMat=mat(0xffffff);asteroidMat.map=surfaceTexture('rock',256);asteroidMat.bumpMap=asteroidMat.map;asteroidMat.bumpScale=.12;batchSpatial(this.group,new THREE.DodecahedronGeometry(1,1),asteroidMat,asteroids);
 }
 desert(rand:()=>number){
   const dunes:[InstanceTransform[],InstanceTransform[]]=[[],[]];
   for(let i=0;i<18;i++){const a=rand()*6.28,rx=12+rand()*10,rz=12+rand()*15,r=Math.max(19+rand()*55,Math.max(rx,rz)+10);dunes[i%2].push({position:new THREE.Vector3(Math.cos(a)*r,-2,Math.sin(a)*r),scale:new THREE.Vector3(rx,4+rand()*3,rz)});}
   const duneMap=surfaceTexture('desert',256);duneMap.repeat.set(8,5);dunes.forEach((transforms,index)=>{const sand=mat(index?0xe1c49b:0xd9b68b);sand.map=duneMap;sand.bumpMap=duneMap;sand.bumpScale=.045;batchSpatial(this.group,new THREE.SphereGeometry(1,32,16),sand,transforms);});
   const cactusMat=mat(0x768166),cacti=new Map<string,THREE.Group>();cactusMat.bumpMap=surfaceTexture('bark',128);cactusMat.bumpMap.repeat.set(3,2);cactusMat.bumpScale=.04;
   for(let i=0;i<35;i++){const a=rand()*6.28,r=9+rand()*40,x=Math.cos(a)*r,z=Math.sin(a)*r,h=1+rand()*2,key=`${Math.floor(x/16)},${Math.floor(z/16)}`;if(!cacti.has(key)){const group=new THREE.Group();cacti.set(key,group);this.group.add(group);}const group=cacti.get(key)!,y=terrainHeight(x,z,this.id);add(group,new THREE.CapsuleGeometry(.19,h,4,8),cactusMat,x,y+h/2+.3,z);const arm=add(group,new THREE.CapsuleGeometry(.11,.8,4,8),cactusMat,x+.4,y+h*.6,z);arm.rotation.z=Math.PI/2;add(group,new THREE.CapsuleGeometry(.12,.45,4,8),cactusMat,x+.8,y+h*.6+.3,z);}
   cacti.forEach(group=>mergeStatic(group,cactusMat));
 }
 beach(rand:()=>number){
   const normalCanvas=document.createElement('canvas');normalCanvas.width=normalCanvas.height=256;const ctx=normalCanvas.getContext('2d')!,image=ctx.createImageData(256,256);
   for(let y=0;y<256;y++)for(let x=0;x<256;x++){
    const phase=x*.19+y*.08+noise(x*.035,y*.035)*2,dx=Math.cos(phase)*.27+Math.sin(x*.07-y*.14)*.11,dy=Math.sin(y*.22+x*.05)*.22,index=(y*256+x)*4;
    image.data[index]=128+dx*90;image.data[index+1]=128+dy*90;image.data[index+2]=248;image.data[index+3]=255;
   }
   ctx.putImageData(image,0,0);this.waterNormal=texture(normalCanvas);this.waterNormal.colorSpace=THREE.NoColorSpace;this.waterNormal.repeat.set(11,11);
   const waterMaterial=new THREE.MeshPhysicalMaterial({color:0x2f7887,metalness:.08,roughness:.22,clearcoat:.85,clearcoatRoughness:.16,normalMap:this.waterNormal,normalScale:new THREE.Vector2(.42,.42),ior:1.333,reflectivity:.75});
   this.water=add(this.group,new THREE.PlaneGeometry(200,118,38,26),waterMaterial,0,-.19,-59);this.water.rotation.x=-Math.PI/2;this.water.castShadow=false;
   const foamCanvas=document.createElement('canvas');foamCanvas.width=512;foamCanvas.height=128;const fc=foamCanvas.getContext('2d')!,fr=random(824);
   for(let i=0;i<2100;i++){const x=fr()*512,y=fr()*128,alpha=(1-Math.abs(y-35)/100)*(.12+fr()*.45);fc.strokeStyle=`rgba(239,244,230,${Math.max(0,alpha)})`;fc.lineWidth=.7+fr()*1.2;fc.beginPath();fc.ellipse(x,y,1+fr()*4,.5+fr()*1.5,0,0,Math.PI*2);fc.stroke();}
   const foamGeo=new THREE.BufferGeometry(),fp:number[]=[],uv:number[]=[],indices:number[]=[];
   for(let i=0;i<=64;i++){
    const x=(i/64-.5)*200;let lo=-18,hi=-3;for(let n=0;n<15;n++){const mid=(lo+hi)/2;if(terrainHeight(x,mid,'beach')<-.19)lo=mid;else hi=mid;}const shore=(lo+hi)/2;
    fp.push(x,-.162,shore+.10,x,-.162,shore-1.3);uv.push(i/64*24,0,i/64*24,1);if(i<64){const j=i*2;indices.push(j,j+1,j+2,j+1,j+3,j+2);}
   }
   foamGeo.setAttribute('position',new THREE.Float32BufferAttribute(fp,3));foamGeo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));foamGeo.setIndex(indices);foamGeo.computeVertexNormals();const foam=add(this.group,foamGeo,new THREE.MeshBasicMaterial({map:texture(foamCanvas),transparent:true,opacity:.58,depthWrite:false,side:THREE.DoubleSide}));foam.castShadow=false;foam.receiveShadow=false;
   const trunks:InstanceTransform[]=[],leaves:InstanceTransform[]=[],driftwood:InstanceTransform[]=[];
   for(let i=0;i<23;i++){
    const a=rand()*Math.PI,r=13+rand()*40,framing=[[-12,-1,7.6],[5,-8,6.2],[-18,-4,8.8]],x=i<3?framing[i][0]:Math.cos(a)*r,z=i<3?framing[i][1]:Math.sin(a)*r,h=i<3?framing[i][2]:6+rand()*4;
    if(i>=3&&x*.62+z*.77>0&&Math.abs(x*.77-z*.62)<11)continue;
    const y=terrainHeight(x,z,this.id),lean=(rand()-.5)*.19,cx=x+.118*Math.cos(lean)-h*Math.sin(lean),cy=y+.118*Math.sin(lean)+h*Math.cos(lean);
    trunks.push({position:new THREE.Vector3(x-h*.5*Math.sin(lean),y+h*.5*Math.cos(lean),z),scale:new THREE.Vector3(1,h,1),rotation:new THREE.Euler(0,0,lean)});
    for(let j=0;j<9;j++){const length=2.45+rand()*.7;leaves.push({position:new THREE.Vector3(cx,cy,z),scale:new THREE.Vector3(length,length,length),rotation:new THREE.Euler((rand()-.5)*.14,j*Math.PI*2/9+rand()*.18,0),color:[0x607b48,0x7d9055,0x87975e][j%3]});}
   }
   const trunkGeo=new THREE.CylinderGeometry(.14,.28,1,9,7),tp=trunkGeo.attributes.position;
   for(let i=0;i<tp.count;i++)tp.setX(i,tp.getX(i)+Math.sin((tp.getY(i)+.5)*1.4)*.12);trunkGeo.computeVertexNormals();
   const bark=mat(0xb6a889);bark.map=surfaceTexture('bark',256);bark.map.repeat.set(1,5);bark.bumpMap=bark.map;bark.bumpScale=.025;batchSpatial(this.group,trunkGeo,bark,trunks,20);
   const positions:number[]=[],leafIndices:number[]=[];
   const quad=(points:number[][])=>{const base=positions.length/3;points.forEach(p=>positions.push(...p));leafIndices.push(base,base+1,base+2,base+1,base+3,base+2);};
   const curve=(t:number)=>Math.sin(t*Math.PI)*.12-t*t*.36;
   for(let j=0;j<17;j++){
    const t=.04+j*.052,w=Math.pow(Math.sin(t*Math.PI),.7)*.19;
    for(const side of [-1,1])quad([[side*.007,curve(t),t],[side*.01,curve(t+.025),t+.025],[side*w,curve(t)-.035,t+.11],[side*w*.89,curve(t)-.038,t+.14]]);
    quad([[-.008,curve(t),t],[.008,curve(t),t],[-.007,curve(t+.065),t+.065],[.007,curve(t+.065),t+.065]]);
   }
   const leafGeo=new THREE.BufferGeometry();leafGeo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));leafGeo.setIndex(leafIndices);leafGeo.computeVertexNormals();const leafMat=mat(0xffffff);leafMat.side=THREE.DoubleSide;batchSpatial(this.group,leafGeo,leafMat,leaves,20);
   for(let i=0;i<9;i++){const x=(rand()-.5)*50,z=4+rand()*8;driftwood.push({position:new THREE.Vector3(x,terrainHeight(x,z,this.id)+.10,z),scale:new THREE.Vector3(.10,1.1+rand()*1.8,.12),rotation:new THREE.Euler(Math.PI/2,rand()*6.28,rand()*.25)});}batch(this.group,new THREE.CylinderGeometry(.6,1,1,8),bark,driftwood);
 }
 setLightBudget(count:number){const order=[0,1,4,5,2,3,6,7];this.localLights.forEach((light,index)=>light.visible=order.indexOf(index)<count);}
 update(dt:number,height:number){
   for(const c of this.clouds){c.position.x+=dt*.28;if(c.position.x>85)c.position.x=-85;}
   this.sun.target.position.y=height*.65;this.sun.position.y=29+height*.65;
   if(this.water&&dt>0){this.waterTime+=dt;const p=this.water.geometry.attributes.position;for(let i=0;i<p.count;i++)p.setZ(i,Math.sin(p.getX(i)*.20+this.waterTime*.72)*.035+Math.sin(p.getY(i)*.31-this.waterTime*.46)*.022);p.needsUpdate=true;if(this.waterNormal){this.waterNormal.offset.set(this.waterTime*.004,this.waterTime*.002);}}
   for(const o of this.animated)o.rotation.y+=dt*.006;
 }
 dispose(){
   this.scene.remove(this.group);const geos=new Set<THREE.BufferGeometry>(),mats=new Set<THREE.Material>(),textures=new Set<THREE.Texture>();
   if(this.backgroundTexture){textures.add(this.backgroundTexture);if(this.scene.background===this.backgroundTexture)this.scene.background=null;}
   this.group.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.Points){geos.add(o.geometry);(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>mats.add(m));}if(o instanceof THREE.InstancedMesh)o.dispose();if(o instanceof THREE.Light)o.dispose();});
   geos.forEach(g=>g.dispose());mats.forEach(m=>{for(const value of Object.values(m))if(value instanceof THREE.Texture)textures.add(value);m.dispose();});textures.forEach(t=>t.dispose());
 }
}
