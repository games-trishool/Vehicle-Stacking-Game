import * as THREE from 'three';
import type {WorldId} from './scenery';

/** A small original outdoor panorama supplies world-matched PBR reflections. */
export function worldEnvironment(renderer:THREE.WebGLRenderer,id:WorldId){
 const palettes:Record<WorldId,string[]>={
  forest:['#528ab7','#bed5df','#e6e6ce','#4c6044','#26372d'],
  city:['#060d1b','#25364d','#647083','#263039','#111a20'],
  space:['#030619','#111c37','#546481','#3c424e','#141823'],
  snow:['#719cb9','#d1e0e5','#edf0eb','#b7c7cf','#6d8090'],
  desert:['#819daa','#e0cba6','#efdbac','#b18a5b','#73583c'],
  beach:['#4f9cbf','#b2dce3','#ece9ce','#c4b38a','#7a8c78'],
 };
 const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=512;const c=canvas.getContext('2d')!,p=palettes[id],gradient=c.createLinearGradient(0,0,0,512);
 for(const [i,at] of [0,.30,.51,.63,1].entries())gradient.addColorStop(at,p[i]);c.fillStyle=gradient;c.fillRect(0,0,1024,512);
 if(id!=='space'){
  const sun=c.createRadialGradient(400,112,2,400,112,82);sun.addColorStop(0,id==='city'?'rgba(168,193,225,.35)':'rgba(255,248,220,.93)');sun.addColorStop(.13,'rgba(255,246,224,.34)');sun.addColorStop(1,'rgba(255,255,255,0)');c.fillStyle=sun;c.fillRect(0,0,1024,260);
 }
 if(id==='forest'){
  c.fillStyle='#354c3c';for(let j=0;j<72;j++){const x=j*14.8,h=16+(Math.sin(j*27.7)*.5+.5)*42;c.beginPath();c.moveTo(x,291);c.lineTo(x+7,263-h);c.lineTo(x+16,291);c.fill();}
 }
 if(id==='city')for(let j=0;j<35;j++){
  const x=j*30,h=25+(Math.sin(j*17)*.5+.5)*73;c.fillStyle='#192431';c.fillRect(x,278-h,26,h);
  for(let y=282-h;y<275;y+=10){c.fillStyle=j%3?'#bcb295':'#8699b5';c.fillRect(x+5,y,4,3);c.fillRect(x+16,y,4,3);}
 }
 const panorama=new THREE.CanvasTexture(canvas);panorama.colorSpace=THREE.SRGBColorSpace;panorama.mapping=THREE.EquirectangularReflectionMapping;
 const generator=new THREE.PMREMGenerator(renderer),target=generator.fromEquirectangular(panorama);panorama.dispose();generator.dispose();return target;
}
