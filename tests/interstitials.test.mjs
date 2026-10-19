import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {transformWithEsbuild} from 'vite';
const source=await readFile(new URL('../src/interstitials.ts',import.meta.url),'utf8');
const {code}=await transformWithEsbuild(source,'interstitials.ts',{loader:'ts',target:'es2022'});
const {Interstitials,NativeInterstitialPort}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const tick=()=>new Promise(setImmediate);
const storage=()=>{const data=new Map();return{getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)};};
function device(){
 const events=new Map(),calls=[];
 const sdk={
  async initialize(options){calls.push(['initialize',options]);},
  async prepareInterstitial(options){calls.push(['load',options]);},
  async showInterstitial(){calls.push(['show']);},
  async addListener(name,callback){events.set(name,callback);return{async remove(){events.delete(name);}};},
 };
 const port=new NativeInterstitialPort(sdk,'google-test-unit',{dismissed:'dismiss',failed:'failure'});
 return{sdk,port,calls,events};
}
test('native interstitials occur on completed games 3 and 6, and remain busy until dismissal',async()=>{
 const {port,calls,events}=device(),ads=new Interstitials(port,storage()),busy=[];
 ads.onBusyChange=value=>busy.push(value);ads.preload();await tick();
 for(let run=1;run<=6;run++){
  const due=ads.recordCompletedGame();assert.equal(due,run%3===0);
  const shown=ads.showAtBreak(due,()=>true);await tick();
  if(due){
   assert.equal(ads.busy,true,'accepting the native show call must not unlock the game');
   assert.equal(await ads.showAtBreak(true,()=>true),false,'ignore concurrent presentation');
   events.get('dismiss')();assert.equal(await shown,true);await tick();
  }else assert.equal(await shown,false);
 }
 assert.equal(calls.filter(([name])=>name==='show').length,2);
 assert.deepEqual(busy,[true,false,true,false]);
 assert.deepEqual(calls.find(([name])=>name==='load')[1],{adId:'google-test-unit',isTesting:true,npa:true,immersiveMode:true});
});
test('completed-game spacing survives reopening and Reset game clears the ad counter',()=>{
 const saved=storage(),port=device().port,first=new Interstitials(port,saved);
 assert.equal(first.recordCompletedGame(),false);assert.equal(first.recordCompletedGame(),false);
 const reopened=new Interstitials(port,saved);assert.equal(reopened.recordCompletedGame(),true);
 reopened.recordCompletedGame();reopened.resetCounter();
 const reset=new Interstitials(port,saved);assert.equal(reset.recordCompletedGame(),false);assert.equal(reset.snapshot.completedSinceBreak,1);
});
test('web mode never initializes an ad or changes the completed-game counter',async()=>{
 const saved=storage(),ads=new Interstitials(undefined,saved);ads.preload();
 for(let n=0;n<9;n++)assert.equal(ads.recordCompletedGame(),false);
 assert.equal(await ads.showAtBreak(true,()=>true),false);
 assert.deepEqual(ads.snapshot,{enabled:false,completedSinceBreak:0,ready:false,busy:false});
});
test('a slow or unavailable ad is skipped without delaying the results or appearing later',async()=>{
 let loaded;const {port,sdk,calls}=device();sdk.prepareInterstitial=()=>new Promise(resolve=>{loaded=resolve;});
 const ads=new Interstitials(port,storage());ads.preload();await tick();
 assert.equal(await ads.showAtBreak(true,()=>true),false);assert.equal(ads.busy,false);
 loaded();await tick();assert.equal(calls.filter(([name])=>name==='show').length,0);
 assert.equal(await ads.showAtBreak(true,()=>false),false,'never show in background or during another run');
});
test('load failures retry on a later preload and show failures release the game',async t=>{
 const warnings=[];t.mock.method(console,'warn',(...args)=>warnings.push(args[0]));
 const {port,sdk,events}=device(),ads=new Interstitials(port,storage()),original=sdk.prepareInterstitial;
 sdk.prepareInterstitial=async()=>{throw Error('offline');};ads.preload();await tick();assert.equal(ads.snapshot.ready,false);
 sdk.prepareInterstitial=original;ads.preload();await tick();assert.equal(ads.snapshot.ready,true);
 const shown=ads.showAtBreak(true,()=>true);await tick();events.get('failure')();
 assert.equal(await shown,false);assert.equal(ads.busy,false);await tick();assert.equal(ads.snapshot.ready,true);
 sdk.showInterstitial=async()=>{throw Error('native presentation unavailable');};
 assert.equal(await ads.showAtBreak(true,()=>true),false);assert.equal(ads.busy,false);
 assert.equal(warnings.length,3);
});
test('cached interstitials expire before the SDK one-hour limit',async()=>{
 let now=1000;const {port,calls}=device(),ads=new Interstitials(port,storage(),()=>now);
 ads.preload();await tick();now+=56*60*1000;
 assert.equal(await ads.showAtBreak(true,()=>true),false);ads.preload();await tick();
 assert.equal(calls.filter(([name])=>name==='load').length,2);assert.equal(ads.snapshot.ready,true);
});
test('unavailable or corrupt counter storage does not block play or ads',()=>{
 const bad={getItem:()=>{throw Error('blocked');},setItem:()=>{throw Error('blocked');}};
 const ads=new Interstitials(device().port,bad);assert.equal(ads.recordCompletedGame(),false);assert.equal(ads.recordCompletedGame(),false);assert.equal(ads.recordCompletedGame(),true);
 for(const invalid of ['NaN','-1','3','9999','1.5']){
  const corrupt=new Interstitials(device().port,{getItem:()=>invalid,setItem:()=>{}});
  assert.equal(corrupt.snapshot.completedSinceBreak,0);
 }
});
