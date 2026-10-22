// Start the Vite dev server first. The isolated review page never boots the main game.
// This measures geometry/batching and captures real renderings, not device FPS.
import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';

const baseURL=process.env.STACKLINE_URL||'http://127.0.0.1:5173';
const reviewURL=new URL('/__capture_realism__',baseURL).href;
const output=resolve(process.argv[2]||'docs');
const browser=await chromium.launch({
 executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',
 args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'],
});
try{
 await mkdir(output,{recursive:true});
 const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});
 page.setDefaultTimeout(180_000);
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.route(reviewURL,route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><head><meta charset="utf-8"><title>Stack Vechiles — model review</title></head><body></body></html>'}));
 await page.goto(reviewURL,{waitUntil:'domcontentloaded'});
 const vehicles=await page.evaluate(async()=>{
  const THREE=await import('/node_modules/three/build/three.module.js');
  const {RoomEnvironment}=await import('/node_modules/three/examples/jsm/environments/RoomEnvironment.js');
  const {createVehicle,SPECS}=await import('/src/vehicles.ts');
  const {VehicleDamage}=await import('/src/vehicle-damage.ts');
  const {VEHICLES}=await import('/src/store.mjs');
  const selected=new Set(['car','suv','ambulance','rickshaw','mixer']);
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});
  renderer.setSize(720,440);renderer.setPixelRatio(1.25);
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.02;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  const scene=new THREE.Scene();scene.background=new THREE.Color('#e8ece5');
  const room=new RoomEnvironment(),pmrem=new THREE.PMREMGenerator(renderer),environment=pmrem.fromScene(room,.035);scene.environment=environment.texture;
  scene.add(new THREE.HemisphereLight(0xf2f6ff,0x807764,1.25));
  const sun=new THREE.DirectionalLight(0xfff2d9,3.2);sun.position.set(-4,9,6);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-7;sun.shadow.camera.right=7;sun.shadow.camera.top=7;sun.shadow.camera.bottom=-7;sun.shadow.normalBias=.018;scene.add(sun);
  const fill=new THREE.DirectionalLight(0xc7dbef,1.0);fill.position.set(6,4,-5);scene.add(fill);
  const floorGeometry=new THREE.PlaneGeometry(200,200),floorMaterial=new THREE.MeshStandardMaterial({color:0xc6ccc2,roughness:.96});
  const floor=new THREE.Mesh(floorGeometry,floorMaterial);floor.rotation.x=-Math.PI/2;floor.position.y=-.012;floor.receiveShadow=true;scene.add(floor);
  const camera=new THREE.PerspectiveCamera(33,720/440,.1,100),direction=new THREE.Vector3(8,5,7).normalize();
  function fit(model){
   const bounds=new THREE.Box3().setFromObject(model),center=bounds.getCenter(new THREE.Vector3());
   camera.position.copy(center).addScaledVector(direction,10);camera.lookAt(center);camera.updateMatrixWorld();
   const inverse=camera.matrixWorldInverse.clone(),tan=Math.tan(THREE.MathUtils.degToRad(camera.fov/2));let distance=0;
   for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){
    const p=new THREE.Vector3(x,y,z).applyMatrix4(inverse);
    distance=Math.max(distance,10+p.z+Math.abs(p.y)*1.09/tan,10+p.z+Math.abs(p.x)*1.09/(tan*camera.aspect));
   }
   camera.position.copy(center).addScaledVector(direction,distance);camera.lookAt(center);camera.updateMatrixWorld();return bounds;
  }
  function metrics(model){
   let triangles=0,meshBatches=0,lineBatches=0;
   model.traverse(child=>{
    if(child.isMesh){meshBatches++;triangles+=(child.geometry.index?.count||child.geometry.attributes.position.count)/3;}
    if(child.isLine)lineBatches++;
    if(child.geometry)for(const name of ['position','normal','color']){
     const data=child.geometry.attributes[name]?.array;
     if(data&&!data.every(Number.isFinite))throw Error(`${model.name}: non-finite ${name}`);
    }
   });
   return{triangles,meshBatches,lineBatches};
  }
  function render(model){scene.add(model);renderer.render(scene,camera);const image=renderer.domElement.toDataURL('image/png');scene.remove(model);return image;}
  const snapshots=[],pictures=[];
  try{
   for(const id of Object.keys(SPECS)){
    const pristine=createVehicle(id),damaged=createVehicle(id),name=VEHICLES.find(vehicle=>vehicle.id===id)?.name||id;
    if(!damaged.userData.damageZones)throw Error(`${id}: missing damage metadata`);
    const bounds=fit(pristine),cleanMetrics=metrics(pristine),cleanImage=render(pristine);
    const original=pristine.children.filter(child=>child.isMesh).map(mesh=>({mesh,geometry:mesh.geometry,positions:new Float32Array(mesh.geometry.attributes.position.array)}));
    const damage=new VehicleDamage(damaged),roof=damaged.userData.damageZones.roof;
    const point=new THREE.Vector3(roof.center[0],roof.center[1],roof.halfSize[2]*.12);
    try{
     damage.impact(point,.9,true);damage.impact(point,.9,true);
     const damagedMetrics=metrics(damaged),snapshot=damage.snapshot;
     const sharedTemplateUnchanged=original.every(({mesh,geometry,positions})=>mesh.geometry===geometry&&positions.every((value,index)=>value===geometry.attributes.position.array[index]));
     if(!sharedTemplateUnchanged)throw Error(`${id}: damage changed a shared pristine template`);
     if(snapshot.glass!=='shattered'||snapshot.roofDent<=0||snapshot.doorDent<=0||snapshot.glassRemovedTriangles<=0)throw Error(`${id}: incomplete damage response ${JSON.stringify(snapshot)}`);
     const damagedImage=selected.has(id)?render(damaged):undefined;
     snapshots.push({id,name,pristine:cleanMetrics,damaged:damagedMetrics,damage:snapshot,sharedTemplateUnchanged,geometryFinite:true,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},nominal:SPECS[id]});
     pictures.push({id,name,cleanImage,damagedImage,damage:snapshot});
    }finally{damage.dispose();}
   }
  }finally{
   floorGeometry.dispose();floorMaterial.dispose();environment.dispose();room.dispose();pmrem.dispose();renderer.dispose();renderer.forceContextLoss();
  }
  document.head.insertAdjacentHTML('beforeend',`<style>
   *{box-sizing:border-box}body{margin:0;padding:26px;background:#f4f5ef;color:#243c30;font-family:Arial,sans-serif}h1{font-size:30px;letter-spacing:-.8px;margin:0 0 8px}header p{font-size:14px;line-height:1.5;color:#687969;margin:0 0 24px}.gallery{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}.card{margin:0;overflow:hidden;background:#e8ece5;border:1px solid #d5ded0;border-radius:16px}.card img{display:block;width:100%;height:auto}.card figcaption{font-size:18px;font-weight:bold;padding:0 18px 14px}.card figcaption small{display:block;font-size:12px;line-height:1.4;font-weight:normal;color:#687969;margin-top:5px}.damage-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}.row-title{grid-column:1/-1;margin:10px 0 -6px;font-size:21px}.badge{display:inline-block;border-radius:4px;padding:4px 8px;background:#d8e2d0;font-size:11px;letter-spacing:.5px;margin-right:8px}
  </style>`);
  const pristineSection=document.createElement('section');pristineSection.id='pristine-sheet';
  pristineSection.innerHTML='<header><h1>Stack Vechiles · the complete fleet</h1><p>Actual game models with calibrated paint, tinted glazing, fine lens detail, wipers, and subtle road wear.</p></header><div class="gallery"></div>';
  for(const picture of pictures){const card=document.createElement('figure');card.className='card';card.innerHTML=`<img src="${picture.cleanImage}" alt="${picture.name}, pristine"><figcaption>${picture.name}</figcaption>`;pristineSection.querySelector('.gallery').append(card);}
  const damagedSection=document.createElement('section');damagedSection.id='damage-sheet';damagedSection.hidden=true;
  damagedSection.innerHTML='<header><h1>Impact damage · before and after</h1><p>Isolated visual review: two roof impacts at strength 0.9 on each model. Windshield fractures, missing glass, roof compression, and side-panel dents are rendered from the real damage module. These are cosmetic mesh effects; gameplay collision hulls remain stable.</p></header><div class="damage-grid"></div>';
  for(const picture of pictures.filter(picture=>picture.damagedImage)){
   const grid=damagedSection.querySelector('.damage-grid'),heading=document.createElement('h2');heading.className='row-title';heading.textContent=picture.name;grid.append(heading);
   for(const [label,image,copy] of [['PRISTINE',picture.cleanImage,'Original cached model'],['AFTER IMPACT',picture.damagedImage,`Shattered windshield · roof dent ${(picture.damage.roofDent*100).toFixed(0)} cm · side-panel dent ${(picture.damage.doorDent*100).toFixed(0)} cm`]]){
    const card=document.createElement('figure');card.className='card';card.innerHTML=`<img src="${image}" alt="${picture.name}, ${label.toLowerCase()}"><figcaption><span class="badge">${label}</span><small>${copy}</small></figcaption>`;grid.append(card);
   }
  }
  document.body.replaceChildren(pristineSection,damagedSection);
  await Promise.all([...document.images].map(image=>image.decode()));
  return snapshots;
 });
 if(errors.length)throw Error(errors.join('\n'));
 await page.locator('#pristine-sheet').screenshot({path:resolve(output,'vehicles-1.5.0.png'),animations:'disabled'});
 await page.evaluate(()=>{document.querySelector('#pristine-sheet').hidden=true;document.querySelector('#damage-sheet').hidden=false;});
 await page.locator('#damage-sheet').screenshot({path:resolve(output,'vehicle-damage-1.5.0.png'),animations:'disabled'});
 const report={source:execFileSync('git',['describe','--always','--dirty'],{encoding:'utf8'}).trim(),renderer:'Chromium SwiftShader; isolated model geometry and damage checks, not device FPS',impact:{strength:.9,count:2,fromAbove:true},vehicles};
 await writeFile(resolve(output,'vehicle-metrics-1.5.0.json'),JSON.stringify(report,null,2)+'\n');
 for(const vehicle of vehicles)console.log(`${vehicle.id}: ${vehicle.pristine.triangles} → ${vehicle.damaged.triangles} triangles; ${vehicle.damage.ownedGeometryCount} owned damage geometries; ${vehicle.damage.glassRemovedTriangles} removed glass triangles`);
 console.log(`Saved pristine fleet, before/after damage sheet, and metrics to ${output}`);
}finally{await browser.close();}
