import {test,expect} from '@playwright/test';

test('Android bridge presents an interstitial only after the third actual loss, then restores replay',async({page})=>{
 test.setTimeout(300_000);await page.setViewportSize({width:390,height:844});
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 // Emulate only the native SDK boundary. Physics, run counting, input and UI are real.
 await page.addInitScript(()=>{
  localStorage.setItem('stackline.progress.v1',JSON.stringify({version:1,selectedVehicle:'car',selectedWorld:'space',settings:{quality:'low',sound:false,music:true}}));
  const listeners=new Map<string,()=>void>(),calls:{plugin:string;method:string;options:unknown}[]=[];
  const w=window as any;
  w.androidBridge={};
  w.Capacitor={
   PluginHeaders:['AdMob','App'].map(name=>({name,methods:[
    ...['initialize','prepareInterstitial','showInterstitial','removeListener','exitApp'].map(name=>({name,rtype:'promise'})),
    {name:'addListener',rtype:'callback'},
   ]})),
   nativePromise:async(plugin:string,method:string,options:unknown)=>{calls.push({plugin,method,options});return{};},
   nativeCallback:(plugin:string,_method:string,options:{eventName:string},callback:()=>void)=>{listeners.set(plugin+':'+options.eventName,callback);return'callback-id';},
  };
  w.adTest={calls,dismiss:()=>listeners.get('AdMob:interstitialAdDismissed')?.()};
 });
 await page.goto('/');await page.waitForFunction(()=>!!(window as any).stackline);
 const snapshot=()=>page.evaluate(()=>(window as any).stackline.snapshot());
 const showCount=()=>page.evaluate(()=>(window as any).adTest.calls.filter((call:any)=>call.method==='showInterstitial').length);
 await expect.poll(async()=>(await snapshot()).ads.ready).toBe(true);expect(await showCount()).toBe(0);
 // Leaving an unfinished run does not count as one of the three games.
 await page.locator('.play-button').click();await page.getByRole('button',{name:'Pause game'}).click();
 await page.getByRole('button',{name:'Back to home'}).click();expect((await snapshot()).ads.completedSinceBreak).toBe(0);
 for(let run=1;run<=3;run++){
  if(run===1)await page.locator('.play-button').click();else await page.getByRole('button',{name:'One more climb'}).click();
  await page.waitForFunction(()=>{
   const s=(window as any).stackline.snapshot();
   if(s.held&&Math.abs(s.heldX-s.topX)>3.1){document.dispatchEvent(new KeyboardEvent('keydown',{code:'Space',bubbles:true}));return true;}
   return false;
  },{},{timeout:65000,polling:'raf'});
  await page.waitForFunction(()=>(window as any).stackline.snapshot().mode==='ended',{},{timeout:60000});
  if(run<3){await expect(page.locator('.result-score')).toBeVisible();expect(await showCount()).toBe(0);}
 }
 await expect.poll(showCount).toBe(1);
 expect(await snapshot()).toMatchObject({mode:'ended',musicPlaying:false,ads:{busy:true,completedSinceBreak:0}});
 await expect.poll(async()=>(await snapshot()).audioState).toBe('suspended');
 expect(await page.locator('#app').evaluate(el=>(el as HTMLElement).inert)).toBe(true);
 await expect(page.getByRole('dialog')).not.toBeVisible();
 // The native show promise already resolved; the UI must still await dismissal.
 await page.keyboard.press('Space');expect((await snapshot()).mode).toBe('ended');
 await page.evaluate(()=>(window as any).adTest.dismiss());
 await expect(page.locator('.result-score')).toBeVisible();expect((await snapshot()).ads.busy).toBe(false);
 await page.getByRole('button',{name:'One more climb'}).click();
 await expect.poll(async()=>(await snapshot()).musicPlaying).toBe(true);
 expect(await snapshot()).toMatchObject({mode:'playing',score:0,stacks:0});expect(await showCount()).toBe(1);
 const loads=await page.evaluate(()=>(window as any).adTest.calls.filter((call:any)=>call.method==='prepareInterstitial'));
 expect(loads.length).toBeGreaterThanOrEqual(2);
 expect(loads[0].options).toMatchObject({adId:'ca-app-pub-3940256099942544/1033173712',isTesting:true,npa:true});
 expect(errors).toEqual([]);
});
