import {test,expect,type Page} from '@playwright/test';
test.use({viewport:{width:390,height:844},deviceScaleFactor:2.625,hasTouch:true});
const snapshot=(page:Page)=>page.evaluate(()=>(window as any).stackline.snapshot());
async function ready(page:Page,world='space',quality='low'){
 await page.addInitScript(({world,quality})=>{
  Object.defineProperty(navigator,'hardwareConcurrency',{configurable:true,get:()=>8});
  localStorage.setItem('stackline.progress.v1',JSON.stringify({version:1,selectedWorld:world,settings:{quality,sound:false,music:false}}));
 },{world,quality});
 await page.goto('/');await page.waitForFunction(()=>!!(window as any).stackline);
 await expect.poll(async()=>(await snapshot(page)).renderFrames).toBeGreaterThan(0);
}
async function expectIdle(page:Page){
 await page.evaluate(()=>document.fonts.ready);
 await page.getByRole('dialog').evaluate(el=>Promise.all(el.getAnimations().map(animation=>animation.finished)));
 await expect.poll(async()=>(await snapshot(page)).renderPending).toBe(false);
 const before=await snapshot(page);await page.waitForTimeout(600);const after=await snapshot(page);
 expect(after.renderFrames).toBe(before.renderFrames);expect(after.heldX).toBe(before.heldX);
 return after;
}
test('menus and pauses stop WebGL frames; settings redraw once and resume the live preview',async({page})=>{
 test.setTimeout(180_000);await ready(page,'city','auto');
 expect(await snapshot(page)).toMatchObject({quality:'auto',pixelRatio:1.5,shadows:true,shadowSize:1024,pointLights:4,renderBudget:30});
 await page.getByRole('button',{name:'Settings',exact:true}).tap();
 const idle=await expectIdle(page);
 expect(idle.adaptiveQualityReduced).toBe(false);
 await page.locator('#quality').selectOption('high');
 await expect.poll(async()=>(await snapshot(page)).renderFrames).toBeGreaterThan(idle.renderFrames);
 expect(await snapshot(page)).toMatchObject({pixelRatio:1.5,shadows:true,shadowSize:2048,pointLights:8});
 await expectIdle(page);
 await page.locator('#quality').selectOption('low');
 expect(await snapshot(page)).toMatchObject({quality:'low',pixelRatio:1,shadows:false,pointLights:2});
 await expectIdle(page);
 await page.locator('[data-action="close"]').tap();const resumed=await snapshot(page);
 await expect.poll(async()=>(await snapshot(page)).renderFrames).toBeGreaterThan(resumed.renderFrames);
 await page.locator('.play-button').tap();expect((await snapshot(page)).renderBudget).toBe(60);
 await page.getByRole('button',{name:'Pause game'}).tap();await expectIdle(page);
 await page.getByRole('button',{name:'Keep climbing'}).tap();const playing=await snapshot(page);
 await expect.poll(async()=>(await snapshot(page)).renderFrames).toBeGreaterThan(playing.renderFrames);
 expect((await snapshot(page)).mode).toBe('playing');
});
test('visibility lifecycle pauses a live run and resumes only after player input',async({page})=>{
 await ready(page);await page.locator('.play-button').tap();
 // Simulate browser visibility events without changing physics state or clocks.
 const visibility=async(hidden:boolean)=>page.evaluate(hidden=>{
  Object.defineProperty(document,'hidden',{configurable:true,value:hidden});
  document.dispatchEvent(new Event('visibilitychange'));
 },hidden);
 await visibility(true);expect((await snapshot(page)).mode).toBe('paused');await expectIdle(page);
 await visibility(false);await expect(page.getByRole('dialog')).toBeVisible();
 const paused=await expectIdle(page);expect(paused.mode).toBe('paused');
 await page.getByRole('button',{name:'Keep climbing'}).tap();
 await expect.poll(async()=>Math.abs((await snapshot(page)).heldX-paused.heldX)).toBeGreaterThan(.02);
 expect(await snapshot(page)).toMatchObject({mode:'playing',score:0,stacks:0,sceneVehicles:2});
});
