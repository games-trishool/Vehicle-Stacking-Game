import {test,expect} from '@playwright/test';
const additions=['rickshaw','ambulance','police','fireengine','dumptruck','mixer'];
test('new fleet purchases persist, chosen vehicles appear alone, and rickshaw/mixer drops earn a landing',async({page})=>{
 test.setTimeout(360_000);await page.setViewportSize({width:390,height:844});
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.addInitScript(()=>{if(!localStorage.getItem('stackline.progress.v1'))localStorage.setItem('stackline.progress.v1',JSON.stringify({version:1,coins:6000,selectedWorld:'space',settings:{quality:'low',sound:false,music:false}}));});
 await page.goto('/');await page.waitForFunction(()=>!!(window as any).stackline);
 const snapshot=()=>page.evaluate(()=>(window as any).stackline.snapshot());
 let coins=6000;
 for(const id of additions){
  await page.getByRole('button',{name:'Change vehicle',exact:true}).click();
  await expect(page.locator('.vehicle-card')).toHaveCount(13);
  const card=page.locator(`.vehicle-card[data-id="${id}"]`);await card.scrollIntoViewIfNeeded();
  expect(await card.locator('img').evaluate((img:HTMLImageElement)=>img.complete&&img.naturalWidth>0)).toBe(true);
  await card.click();await expect(page.getByRole('button',{name:'Cancel',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Done',exact:true}).click();
  const price={rickshaw:200,ambulance:400,police:450,fireengine:500,dumptruck:550,mixer:600}[id]!;coins-=price;
  expect(await snapshot()).toMatchObject({vehicle:id,coins});
  await page.locator('.play-button').click();expect((await snapshot()).vehicleTypes).toEqual([id,id]);
  if(id==='rickshaw'||id==='mixer'){
   await page.waitForFunction(()=>{
    const s=(window as any).stackline.snapshot();
    if(s.held&&Math.abs(s.heldX-s.topX)<.12){document.dispatchEvent(new KeyboardEvent('keydown',{code:'Space',bubbles:true}));return true;}return false;
   },{},{timeout:65000,polling:'raf'});
   await page.waitForFunction(()=>{const s=(window as any).stackline.snapshot();return s.stacks>=1||s.mode==='ended';},{},{timeout:60000});
   expect(await snapshot()).toMatchObject({mode:'playing',stacks:1});
   const earned=(await snapshot()).coins;expect([1,3]).toContain(earned-coins);coins=earned;
  }
  await page.getByRole('button',{name:'Pause game'}).click();await page.getByRole('button',{name:'Back to home'}).click();
 }
 await page.reload();await page.waitForFunction(()=>!!(window as any).stackline);
 expect(await snapshot()).toMatchObject({vehicle:'mixer',coins});
 for(const id of additions)expect((await snapshot()).unlocked).toContain(id);
 await page.getByRole('button',{name:'Change vehicle',exact:true}).click();await expect(page.locator('.modal-meta')).toContainText('9 / 12 vehicles unlocked');
 await page.locator('[data-id="mixed"]').click();await page.getByRole('button',{name:'Done',exact:true}).click();await page.locator('.play-button').click();
 const mixed=await snapshot();for(const id of mixed.vehicleTypes)expect(mixed.unlocked).toContain(id);
 expect(errors).toEqual([]);
});
