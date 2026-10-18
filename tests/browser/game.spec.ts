import {test,expect,type Page} from '@playwright/test';
async function ready(page:Page){
 await page.addInitScript(()=>{const key='stackline.progress.v1';if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify({version:1,settings:{quality:'low',sound:false}}));});
 await page.goto('/');await page.waitForFunction(()=>!!(window as any).stackline);await expect(page.locator('#loading')).toHaveCount(0);
}
const snapshot=(page:Page)=>page.evaluate(()=>(window as any).stackline.snapshot());
async function choose(page:Page,id:string){
 const card=page.locator(`#modal [data-id="${id}"]`),previous=page.getByRole('button',{name:'Previous page',exact:true});
 while(await previous.count()&&await previous.isEnabled())await previous.click();
 for(let attempt=0;attempt<5&&!await card.isVisible();attempt++)await page.getByRole('button',{name:'Next page',exact:true}).click();
 await card.click();
}
async function expectFits(page:Page,selector:string){
 await page.locator(selector).evaluate(el=>Promise.all(el.getAnimations().map(animation=>animation.finished)));
 const problems=await page.evaluate((selector)=>{
  const root=document.querySelector<HTMLElement>(selector)!,bounds=root.getBoundingClientRect(),issues:string[]=[];
  for(const el of [document.documentElement,document.body,root,...root.querySelectorAll<HTMLElement>('#modal-content')]){
   if(el.scrollHeight>el.clientHeight+2||el.scrollWidth>el.clientWidth+2)issues.push(`${el.id||el.tagName} overflows: ${el.scrollWidth}×${el.scrollHeight} / ${el.clientWidth}×${el.clientHeight}`);
  }
  for(const el of root.querySelectorAll<HTMLElement>('button,select,h1,h2,h3,p,strong,small')){
   const r=el.getBoundingClientRect();if(!el.getClientRects().length||!r.width||!r.height)continue;
   if(r.left<Math.max(0,bounds.left)-1||r.right>Math.min(innerWidth,bounds.right)+1||r.top<Math.max(0,bounds.top)-1||r.bottom>Math.min(innerHeight,bounds.bottom)+1)issues.push(`${el.tagName} ${el.textContent?.trim().slice(0,35)} is clipped`);
  }
  return issues;
 },selector);
 expect(problems).toEqual([]);
}
test('home, selectors, six live worlds and preferences persist without rendering errors',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await ready(page);await expect(page.locator('h1')).toContainText('ONE HIGHER.');
 await page.locator('[data-action="vehicles"]').click();await choose(page,'truck');await expect(page.locator('[data-id="truck"]')).toHaveAttribute('aria-pressed','true');await page.locator('[data-action="close"]').click();
 await page.locator('.selection-row[data-action="worlds"]').click();
 for(const world of ['city','space','snow','desert','beach','forest']){
  await choose(page,world);expect((await snapshot(page)).world).toBe(world);await page.waitForTimeout(150);
 }
 await choose(page,'beach');await page.locator('[data-action="close"]').click();await page.reload();await page.waitForFunction(()=>!!(window as any).stackline);
 expect((await snapshot(page)).vehicle).toBe('truck');expect((await snapshot(page)).world).toBe('beach');
 await page.locator('[data-action="settings"]').click();await page.locator('[data-id="reduceMotion"]').click();await expect(page.locator('[data-id="reduceMotion"]')).toHaveAttribute('aria-checked','true');
 await page.locator('#quality').selectOption('low');await page.locator('[data-action="close"]').click();
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(200);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:'test-results/mobile-home.png',fullPage:true});expect(errors).toEqual([]);
});
test('actual physics rewards centered drops, records a failed run and replays cleanly',async({page})=>{
 test.setTimeout(300_000);await page.setViewportSize({width:480,height:640});
 await ready(page);await page.locator('[data-action="vehicles"]').click();await choose(page,'car');await page.locator('[data-action="close"]').click();await page.locator('.selection-row[data-action="worlds"]').click();await choose(page,'space');await page.locator('[data-action="close"]').click();await page.locator('.play-button').click();
 for(let i=1;i<=3;i++){
   // Read positions and dispatch the normal keyboard input in the same frame.
   // The test never edits physics state, scores, vehicle positions, or time.
   await page.waitForFunction(()=>{const s=(window as any).stackline.snapshot();if(s.mode!=='playing')throw Error('Tower collapsed before aligned drop');if(s.held&&Math.abs(s.heldX-s.topX)<.12){document.dispatchEvent(new KeyboardEvent('keydown',{code:'Space',bubbles:true}));return true;}return false;},{},{timeout:65000,polling:'raf'});
   await page.waitForFunction((target:number)=>{const s=(window as any).stackline.snapshot();return s.stacks>=target||s.mode==='ended';},i,{timeout:60000});
   expect((await snapshot(page)).mode).toBe('playing');expect((await snapshot(page)).stacks).toBe(i);
 }
 const landed=await snapshot(page);expect(landed.score).toBeGreaterThanOrEqual(300);expect(landed.coins).toBeGreaterThan(120);expect(landed.height).toBeGreaterThan(3);
 await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toBeVisible();expect((await snapshot(page)).mode).toBe('paused');
 const before=await snapshot(page);await page.waitForTimeout(350);const after=await snapshot(page);expect(after.heldX).toBe(before.heldX);
 await page.locator('[data-action="resume"]').click();await expect(page.getByRole('dialog')).not.toBeVisible();
 await page.waitForFunction(()=>{const s=(window as any).stackline.snapshot();if(s.held&&Math.abs(s.heldX-s.topX)>3.1){document.dispatchEvent(new KeyboardEvent('keydown',{code:'Space',bubbles:true}));return true;}return false;},{},{timeout:65000,polling:'raf'});
 await page.waitForFunction(()=>(window as any).stackline.snapshot().mode==='ended',{},{timeout:60000});await expect(page.locator('.result-score')).toBeVisible();
 expect((await snapshot(page)).falling).toBe(true);
 await page.getByRole('button',{name:'One more climb'}).click();
 expect(await snapshot(page)).toMatchObject({mode:'playing',score:0,stacks:0,stability:100,held:true,falling:false,sceneVehicles:2});
 await expect(page.locator('#run-coins')).toHaveText('0');
 await page.keyboard.press('Escape');await page.getByRole('button',{name:'Back to home'}).click();
 expect(await snapshot(page)).toMatchObject({mode:'home',held:false,falling:false,sceneVehicles:4});
 await page.locator('.record-card').click();await expect(page.locator('.ranking-row')).toHaveCount(2);await expect(page.locator('.ranking-row').first()).toContainText('3');
 await page.screenshot({path:'test-results/leaderboard.png'});
});
test('garage purchases use real saved coins and reject insufficient balance',async({page})=>{
 await ready(page);await page.locator('.garage-card').click();
 await choose(page,'sports');await expect(page.locator('#toast')).toContainText('30 more coins');expect((await snapshot(page)).coins).toBe(120);
 await page.locator('[data-action="close"]').click();
 await page.evaluate(()=>{const key='stackline.progress.v1',s=JSON.parse(localStorage.getItem(key)!);s.coins=200;localStorage.setItem(key,JSON.stringify(s));});
 await page.reload();await page.waitForFunction(()=>!!(window as any).stackline);await page.locator('.garage-card').click();await choose(page,'sports');
 expect((await snapshot(page)).coins).toBe(50);expect((await snapshot(page)).vehicle).toBe('sports');await page.reload();await page.waitForFunction(()=>!!(window as any).stackline);expect((await snapshot(page)).vehicle).toBe('sports');expect((await snapshot(page)).coins).toBe(50);
});
test('pause restart and home remove a vehicle still falling in the previous run',async({page})=>{
 await page.setViewportSize({width:480,height:640});
 await page.addInitScript(()=>localStorage.setItem('stackline.progress.v1',JSON.stringify({version:1,selectedVehicle:'car',selectedWorld:'space',settings:{quality:'low',sound:false}})));
 await ready(page);expect((await snapshot(page)).sceneVehicles).toBe(4);
 await page.locator('.play-button').click();
 const expectFreshRun=async()=>{
  expect(await snapshot(page)).toMatchObject({mode:'playing',score:0,stacks:0,stability:100,held:true,falling:false,sceneVehicles:2});
  await expect(page.locator('#run-coins')).toHaveText('0');
 };
 await expectFreshRun();
 // Restart and return home while a vehicle is still falling, using the pause menu.
 await page.locator('.drop-button').click();expect((await snapshot(page)).falling).toBe(true);
 await page.keyboard.press('Escape');await page.getByRole('button',{name:'Start a new run'}).click();await expectFreshRun();
 await page.locator('.drop-button').click();await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'Back to home'}).click();
 expect(await snapshot(page)).toMatchObject({mode:'home',held:false,falling:false,sceneVehicles:4});
 await page.screenshot({path:'test-results/clean-home-after-restart.png'});
 await page.locator('.play-button').click();await expectFreshRun();
});
test('keyboard focus activates menu and gameplay buttons correctly',async({page})=>{
 await page.setViewportSize({width:480,height:640});await ready(page);
 await page.locator('[data-action="settings"]').focus();await page.keyboard.press('Space');await expect(page.locator('.modal-heading h2')).toHaveText('Your kind of play.');
 await page.locator('[data-action="close"]').focus();await page.keyboard.press('Space');await expect(page.getByRole('dialog')).not.toBeVisible();
 await page.locator('.play-button').focus();await page.keyboard.press('Space');expect((await snapshot(page)).mode).toBe('playing');
 await page.locator('.drop-button').focus();await page.keyboard.press('Space');const s=await snapshot(page);expect(s.held).toBe(false);expect(s.falling).toBe(true);
});
test.describe('touch layouts',()=>{
test.use({hasTouch:true});
test('mobile screens fit without scrolling and every collection is reachable by page buttons',async({page})=>{
 test.setTimeout(300_000);
 await page.addInitScript(()=>localStorage.setItem('stackline.progress.v1',JSON.stringify({version:1,selectedWorld:'space',settings:{quality:'low',sound:false},runs:Array.from({length:10},(_,i)=>({score:1000-i*10,stacks:10-i,height:20-i,world:'forest',date:'2026-10-18T00:00:00Z'}))})));
 await ready(page);
 for(const size of [{width:320,height:480},{width:320,height:568},{width:360,height:640},{width:390,height:844},{width:412,height:915},{width:844,height:390},{width:1366,height:768}]){
  await page.setViewportSize(size);await page.evaluate(()=>new Promise(requestAnimationFrame));await expectFits(page,'.home-shell');
  const controls=await page.locator('.home-actions button').evaluateAll(buttons=>buttons.map(button=>{const r=button.getBoundingClientRect();return{width:r.width,height:r.height,bottom:r.bottom};}));
  for(const r of controls){expect(r.height).toBeGreaterThanOrEqual(44);expect(r.width).toBeGreaterThan(180);expect(r.bottom).toBeLessThanOrEqual(size.height);}
  const preview=await page.locator('.scene-panel').boundingBox();expect(preview!.height).toBeGreaterThan(80);
  await page.mouse.wheel(0,500);expect(await page.evaluate(()=>scrollY)).toBe(0);
  if([320,390,844,1366].includes(size.width))await page.screenshot({path:`test-results/home-${size.width}x${size.height}.png`});
 }
 for(const size of [{width:320,height:480},{width:320,height:568},{width:390,height:844},{width:844,height:390}]){
  await page.setViewportSize(size);
  for(const [action,cardSelector,total] of [['vehicles','.vehicle-card',7],['worlds','.world-card',6],['garage','.vehicle-card',7],['achievements','.achievement-card',6],['leaderboard','.ranking-row',10],['settings','',0],['howto','',0]] as const){
   const opener=action==='vehicles'?'[aria-label="Change vehicle"]':action==='worlds'?'[aria-label="Change place"]':action==='garage'?'.garage-card':action==='leaderboard'?'.record-card':`[data-action="${action}"]:visible`;
   await page.locator(opener).first().tap();await expectFits(page,'#modal');
   if(action==='vehicles'&&size.width===390)await page.screenshot({path:'test-results/mobile-vehicle-pages.png'});
   if(action==='garage'&&size.width===390)await page.screenshot({path:'test-results/mobile-garage.png'});
   if(cardSelector){
    let seen=0;
    for(let n=0;n<5;n++){
     await expectFits(page,'#modal');seen+=await page.locator(`#modal ${cardSelector}:visible`).count();
     const next=page.getByRole('button',{name:'Next page',exact:true});
     if(!await next.count()||!await next.isEnabled())break;
     const touch=await next.boundingBox();expect(touch!.height).toBeGreaterThanOrEqual(44);await next.tap();
    }
    expect(seen).toBe(total);
   }
   await page.locator('[data-action="close"]').tap();
  }
  await page.getByRole('button',{name:'Let’s play',exact:true}).tap();await expectFits(page,'.scene-panel');
  await page.getByRole('button',{name:'Pause game'}).tap();await expectFits(page,'#modal');
  await page.getByRole('button',{name:'Back to home'}).tap();await expectFits(page,'.home-shell');
 }
});
});
