// Optional asset authoring tool: Chromium and ffmpeg are needed only to change the score.
import {chromium} from '@playwright/test';
import {spawn,execFileSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const temporary=mkdtempSync(join(tmpdir(),'stack-vechiles-audio-'));
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5174','--strictPort'],{stdio:'ignore'});
let browser;
try{
 for(let attempt=0;attempt<100;attempt++){
  try{if((await fetch('http://127.0.0.1:5174/src/music-score.ts')).ok)break;}catch{}
  if(server.exitCode!==null)throw Error('Audio authoring server could not start');
  await new Promise(resolve=>setTimeout(resolve,100));
 }
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 const page=await browser.newPage();await page.route('**/audio-authoring',route=>route.fulfill({contentType:'text/html',body:'<!doctype html>'}));await page.goto('http://127.0.0.1:5174/audio-authoring');
 const encoded=await page.evaluate(async()=>{
  const {composeMusic}=await import('/src/music-score.ts');const buffer=await composeMusic();
  const channels=buffer.numberOfChannels,bytes=new Uint8Array(44+buffer.length*channels*2),view=new DataView(bytes.buffer);
  const word=(offset,value)=>[...value].forEach((letter,i)=>view.setUint8(offset+i,letter.charCodeAt(0)));
  word(0,'RIFF');view.setUint32(4,bytes.length-8,true);word(8,'WAVE');word(12,'fmt ');view.setUint32(16,16,true);
  view.setUint16(20,1,true);view.setUint16(22,channels,true);view.setUint32(24,buffer.sampleRate,true);view.setUint32(28,buffer.sampleRate*channels*2,true);
  view.setUint16(32,channels*2,true);view.setUint16(34,16,true);word(36,'data');view.setUint32(40,bytes.length-44,true);
  const data=Array.from({length:channels},(_,i)=>buffer.getChannelData(i));let offset=44;
  for(let i=0;i<buffer.length;i++)for(let c=0;c<channels;c++){view.setInt16(offset,Math.round(Math.max(-1,Math.min(1,data[c][i]))*32767),true);offset+=2;}
  let binary='';for(let i=0;i<bytes.length;i+=16384)binary+=String.fromCharCode(...bytes.subarray(i,i+16384));return btoa(binary);
 });
 const wav=join(temporary,'score.wav');writeFileSync(wav,Buffer.from(encoded,'base64'));mkdirSync('public/audio',{recursive:true});
 execFileSync('ffmpeg',['-y','-loglevel','error','-i',wav,'-c:a','libvorbis','-q:a','5','public/audio/arcade-loop.ogg']);
 console.log('Original score rendered to public/audio/arcade-loop.ogg');
}finally{await browser?.close();server.kill();rmSync(temporary,{recursive:true,force:true});}
