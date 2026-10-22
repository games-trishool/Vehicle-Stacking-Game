// Start the Vite dev server before capture:
//   npm run dev -- --port 5173 --strictPort
//   node scripts/capture-worlds.mjs
// Optional: STACKLINE_URL=http://127.0.0.1:5173 CHROMIUM_PATH=/usr/bin/chromium
// Uses isolated review HTML: the game, audio, physics and ad controller never boot.
// Single-frame SwiftShader submission counts are not physical-device FPS measurements.
import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const url=new URL('/__stack_world_review__.html',process.env.STACKLINE_URL||'http://127.0.0.1:5173');
const browser=await chromium.launch({
 executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',
 args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'],
});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1060},deviceScaleFactor:1});
 page.setDefaultTimeout(180_000);
 const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
 await page.route(url.href,route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><head><meta charset="utf-8"><link rel="icon" href="data:,"><title>World rendering review</title></head><body></body></html>'}));
 await page.goto(url.href);
 const results=await page.evaluate(async()=>{
  // Reuse Vite's exact Three module instance, including its optimized URL.
  const source=await(await fetch('/src/scenery.ts')).text();
  const module=source.match(/import\s+\*\s+as\s+THREE\s+from\s+['"]([^'"]+)['"]/);
  if(!module)throw Error('Could not resolve the scenery Three module from the Vite dev server.');
  const THREE=await import(module[1]);
  const {Scenery}=await import('/src/scenery.ts');
  const {createVehicle,SPECS}=await import('/src/vehicles.ts');
  const {worldEnvironment}=await import('/src/world-lighting.ts');
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:true,powerPreference:'high-performance'});
  renderer.setSize(960,640);renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.04;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  const context=renderer.getContext(),states=[];
  renderer.domElement.addEventListener('webglcontextlost',()=>{throw Error('WebGL context lost during world capture.');});
  const assertGL=label=>{const code=context.getError();if(code!==context.NO_ERROR)throw Error(`${label}: WebGL error ${code}`);};
  const assertFinite=scene=>scene.traverse(object=>{
   if(object.geometry)for(const [name,attribute] of Object.entries(object.geometry.attributes)){
    if(!attribute.array.every(Number.isFinite))throw Error(`Non-finite ${name} attribute in ${object.name||object.type}.`);
   }
   if(object.isInstancedMesh&&!object.instanceMatrix.array.every(Number.isFinite))throw Error('Non-finite scenery instance matrix.');
  });
  const worlds=[['forest','Realistic Forest'],['city','Night City'],['space','Outer Space'],['snow','Snow Mountains'],['desert','Desert'],['beach','Beach']];
  try{
   for(const [id,name] of worlds){
    const scene=new THREE.Scene(),scenery=new Scenery(scene,id),environment=worldEnvironment(renderer,id),tower=[];
    scene.environment=environment.texture;
    let y=.49;
    for(const [index,type] of ['suv','truck','car','sports'].entries()){
     const vehicle=createVehicle(type);vehicle.position.set([0,-.2,.12,-.16][index],y,0);vehicle.rotation.y=[-.06,.045,-.045,.03][index];
     scene.add(vehicle);tower.push(vehicle);y+=SPECS[type].height-.32;
    }
    const camera=new THREE.PerspectiveCamera(39,960/640,.1,250);
    camera.position.set(16*.62,3.8+3.4,16*.77);camera.lookAt(0,3.8,0);camera.updateMatrixWorld();
    assertFinite(scene);scenery.update(0,0);
    renderer.shadowMap.enabled=true;scenery.sun.shadow.mapSize.set(2048,2048);scenery.setLightBudget(8);
    renderer.info.reset();renderer.render(scene,camera);assertGL(`${id} High`);
    const high={drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,shadowMap:2048,cityLightBudget:8};
    const image=renderer.domElement.toDataURL('image/png');
    renderer.shadowMap.enabled=false;scenery.setLightBudget(2);renderer.info.reset();renderer.render(scene,camera);assertGL(`${id} Battery saver`);
    const low={drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,shadows:false,cityLightBudget:2};
    states.push({id,name,image,high,low});
    for(const vehicle of tower)scene.remove(vehicle);
    scene.environment=null;environment.dispose();scenery.dispose();
   }
  }finally{renderer.dispose();}
  document.body.innerHTML='<main id="worlds"></main>';
  document.head.insertAdjacentHTML('beforeend','<style>html,body{margin:0;background:#f2f2ec;color:#233e30;font-family:Arial,sans-serif}body{padding:22px}#worlds{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}.world{margin:0;background:#e5e9df;border-radius:16px;overflow:hidden;border:1px solid #d4ddce}.world img{display:block;width:100%;aspect-ratio:1.5;object-fit:cover}.world figcaption{padding:13px 16px 15px;font-size:19px;font-weight:600}</style>');
  for(const state of states){const card=document.createElement('figure');card.className='world';card.dataset.world=state.id;card.innerHTML=`<img alt="${state.name}: actual game scenery and four-vehicle tower" src="${state.image}"><figcaption>${state.name}</figcaption>`;document.querySelector('#worlds').append(card);}
  await Promise.all([...document.images].map(image=>image.decode()));
  return states;
 });
 if(errors.length)throw Error(errors.join('\n'));
 await mkdir(new URL('../docs/',import.meta.url),{recursive:true});
 await writeFile(new URL('../docs/forest-1.5.0.png',import.meta.url),Buffer.from(results.find(world=>world.id==='forest').image.split(',')[1],'base64'));
 const height=await page.locator('#worlds').evaluate(element=>Math.ceil(element.getBoundingClientRect().bottom+22));
 await page.setViewportSize({width:1440,height});
 await page.screenshot({path:fileURLToPath(new URL('../docs/worlds-1.5.0.png',import.meta.url)),fullPage:true,animations:'disabled'});
 if(errors.length)throw Error(errors.join('\n'));
 const report={
  source:execFileSync('git',['describe','--always','--dirty'],{cwd:root,encoding:'utf8'}).trim(),
  renderer:'Chromium SwiftShader',viewport:'960x640',pixelRatio:1,
  scenario:'Identical original four-vehicle mixed tower; one submitted High frame and one Battery-saver frame per world.',
  limitations:'Submission/triangle counts only. No physical-device FPS, frame-time, thermal, or battery measurements.',
  worlds:results.map(({id,name,high,low})=>({id,name,high,low})),
 };
 await writeFile(new URL('../docs/performance-1.5.0.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
 for(const world of report.worlds)console.log(`${world.name}: High ${world.high.drawCalls} calls / ${world.high.triangles} triangles; Battery saver ${world.low.drawCalls} calls / ${world.low.triangles} triangles`);
 console.log('Saved docs/worlds-1.5.0.png, docs/forest-1.5.0.png, and docs/performance-1.5.0.json.');
}finally{await browser.close();}
