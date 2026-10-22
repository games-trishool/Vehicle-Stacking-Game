import {test,expect} from '@playwright/test';
test('real landings crack both vehicles, repeated hits shatter glass, and restart clears all damage',async({page})=>{
 test.setTimeout(300_000);await page.setViewportSize({width:480,height:720});
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.addInitScript(()=>localStorage.setItem('stackline.progress.v1',JSON.stringify({version:1,selectedVehicle:'car',selectedWorld:'forest',settings:{quality:'low',sound:false,music:false}})));
 await page.goto('/');await page.waitForFunction(()=>!!(window as any).stackline);
 const snapshot=()=>page.evaluate(()=>(window as any).stackline.snapshot());
 await page.locator('.play-button').click();expect((await snapshot()).damage.every((d:any)=>d.glass==='intact'&&d.hits===0)).toBe(true);
 for(let run=1;run<=2;run++){
  await page.waitForFunction(()=>{
   const s=(window as any).stackline.snapshot();if(s.held&&Math.abs(s.heldX-s.topX)<.12){document.dispatchEvent(new KeyboardEvent('keydown',{code:'Space',bubbles:true}));return true;}return false;
  },{},{timeout:65000,polling:'raf'});
  await page.waitForFunction((count:number)=>{const s=(window as any).stackline.snapshot();return s.stacks>=count||s.mode==='ended';},run,{timeout:60000});
  const landed=await snapshot();expect(landed.mode).toBe('playing');expect(landed.stacks).toBe(run);
  expect(landed.damage).toHaveLength(run+1);expect(landed.damage.every((d:any)=>d.hits>0&&d.glass!=='intact')).toBe(true);
  expect(landed.damage.some((d:any)=>d.roofDent>0)).toBe(true);expect(landed.damage.some((d:any)=>d.doorDent>0)).toBe(true);
 }
 const landed=await snapshot();expect(landed.damage.some((d:any)=>d.glass==='shattered'&&d.glassRemovedTriangles>0)).toBe(true);
 await page.getByRole('button',{name:'Pause game'}).click();
 await expect.poll(async()=>(await snapshot()).renderPending).toBe(false);const paused=await snapshot();
 await page.waitForTimeout(500);expect((await snapshot()).damage).toEqual(paused.damage);expect((await snapshot()).glassChips).toBe(paused.glassChips);
 await page.screenshot({path:'test-results/damaged-stack.png'});
 await page.getByRole('button',{name:'Start a new run',exact:true}).click();
 const fresh=await snapshot();expect(fresh.mode).toBe('playing');expect(fresh.glassChips).toBe(0);expect(fresh.damage).toHaveLength(1);
 expect(fresh.damage[0]).toMatchObject({hits:0,glass:'intact',roofDent:0,doorDent:0,ownedGeometryCount:0});
 await page.getByRole('button',{name:'Pause game'}).click();await page.getByRole('button',{name:'Back to home'}).click();
 expect((await snapshot()).damage).toEqual([]);expect((await snapshot()).glassChips).toBe(0);expect(errors).toEqual([]);
});
