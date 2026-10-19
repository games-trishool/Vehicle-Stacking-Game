import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {transformWithEsbuild} from 'vite';
// Exercise the real audio controller with a suspended-device boundary, without a speaker.
const input=(await readFile(new URL('../src/audio.ts',import.meta.url),'utf8')).replace("'./impacts.mjs'",JSON.stringify(new URL('../src/impacts.mjs',import.meta.url).href));
const {code}=await transformWithEsbuild(input,'audio.ts',{loader:'ts',target:'es2022'});
const {GameAudio}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
function device(){
 const started=[],param=()=>({value:1,setValueAtTime(){},linearRampToValueAtTime(){},cancelScheduledValues(){}});
 class Context{
  state='suspended';sampleRate=32000;currentTime=0;destination={};resumes=0;
  createGain(){return{gain:param(),connect(){},disconnect(){}};}
  createAnalyser(){return{fftSize:256,connect(){},getFloatTimeDomainData(data){data.fill(0);}};}
  createBuffer(channels,frames,rate){return{duration:frames/rate,copyToChannel(){}};}
  createBufferSource(){const source={buffer:null,playbackRate:{value:1},connect(){},disconnect(){},start(){started.push(source);},stop(){}};return source;}
  // Some devices accept resume before changing state. Scheduled sources must be retained.
  resume(){this.resumes++;return Promise.resolve();}
  close(){this.state='closed';return Promise.resolve();}
  decodeAudioData(){return Promise.resolve({duration:15.238});}
 }
 return{Context,started};
}
test('the very first crash is scheduled even while the audio device is still suspended',()=>{
 const original=globalThis.AudioContext,{Context,started}=device();globalThis.AudioContext=Context;
 try{
  const audio=new GameAudio();audio.musicEnabled=false;audio.init();assert.equal(audio.context.state,'suspended');
  audio.crash(.7);assert.equal(started.length,1);assert.equal(audio.crashPlays,1);assert.ok(audio.context.resumes>=1);
  audio.setEnabled(false);audio.crash(.7);assert.equal(started.length,1);audio.dispose();
 }finally{globalThis.AudioContext=original;}
});
test('prepared music schedules in the Play call without awaiting rendering, fetching, or decoding',async()=>{
 const original=globalThis.AudioContext,originalFetch=globalThis.fetch,{Context,started}=device();globalThis.AudioContext=Context;
 let requests=0;globalThis.fetch=async()=>{requests++;return{ok:true,arrayBuffer:async()=>new ArrayBuffer(4)};};
 try{
  const audio=new GameAudio();await audio.prepare();assert.equal(audio.musicReady,true);assert.equal(started.length,0);assert.equal(requests,1);
  audio.startMusic(true);assert.equal(started.length,1,'source must start before returning from Play');assert.equal(requests,1,'Play must use already decoded music');
  audio.pauseMusic();audio.startMusic();assert.equal(started.length,2);assert.equal(requests,1);audio.dispose();
 }finally{globalThis.AudioContext=original;globalThis.fetch=originalFetch;}
});
