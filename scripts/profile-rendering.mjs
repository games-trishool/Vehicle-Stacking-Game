// Start `npm run preview -- --port 4173 --strictPort` before running this script.
// Counts actual WebGL draw submissions; software-renderer FPS is not a device benchmark.
import {chromium} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const results=[];
try{
 for(const world of ['forest','city','space','snow','desert','beach']){
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1});
  await context.addInitScript(world=>localStorage.setItem('stackline.progress.v1',JSON.stringify({version:1,selectedWorld:world,settings:{quality:'low',sound:false,music:false}})),world);
  const page=await context.newPage();page.setDefaultTimeout(120_000);
  await page.goto(process.env.STACKLINE_URL||'http://127.0.0.1:4173');
  await page.waitForFunction(()=>!!window.stackline);
  const samples=await page.evaluate(async()=>{
   for(let i=0;i<4;i++)await new Promise(requestAnimationFrame);
   const samples=[];
   for(let i=0;i<5;i++){await new Promise(requestAnimationFrame);const s=window.stackline.snapshot();samples.push({drawCalls:s.drawCalls,triangles:s.triangles});}
   return samples;
  });
  const median=key=>samples.map(s=>s[key]).sort((a,b)=>a-b)[2];
  results.push({world,drawCalls:median('drawCalls'),triangles:median('triangles')});
  console.log(`${world}: ${median('drawCalls')} draw calls, ${median('triangles')} triangles`);
  await context.close();
 }
 const report={source:execFileSync('git',['describe','--always','--dirty'],{encoding:'utf8'}).trim(),viewport:'390x844',quality:'low',renderer:'Chromium SwiftShader',results};
 writeFileSync(process.argv[2]||'/tmp/stackline-rendering.json',JSON.stringify(report,null,2)+'\n');
}finally{await browser.close();}
