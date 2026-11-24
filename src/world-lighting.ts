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
  const sun=c.createRadialGradient(400,112,2,400,112,82);sun.addColorStop(0,id==='city'?'rgba(168,193,225,.38)':'rgba(255,248,220,.95)');sun.addColorStop(.13,'rgba(255,246,224,.34)');sun.addColorStop(1,'rgba(255,255,255,0)');c.fillStyle=sun;c.fillRect(0,0,1024,260);
 }
 // Broad, soft reflection panels add the clean moving highlights of a vehicle
 // studio to the PBR paint, glass and alloy across every environment.
 c.save();c.globalCompositeOperation='screen';
 for(const [x,y,w,h,color] of [[130,95,95,150,'rgba(255,244,221,.46)'],[660,75,130,180,'rgba(218,234,255,.50)'],[920,120,70,130,'rgba(255,255,255,.30)']] as [number,number,number,number,string][]){
  const glow=c.createRadialGradient(x+w/2,y+h/2,2,x+w/2,y+h/2,Math.max(w,h)*.72);glow.addColorStop(0,color);glow.addColorStop(1,'rgba(255,255,255,0)');c.fillStyle=glow;c.fillRect(x-w,y-h,w*3,h*3);
 }
 c.restore();
 // Long breaks in the reflected horizon trace the curvature of doors and glass.
 const horizons:Record<WorldId,[string,string]>={
  forest:['#293d31','#efc782'], snow:['#657c91','#fff6e1'],
  city:['#131b30','#88c5f0'], space:['#121628','#b9caff'],
  desert:['#906346','#ffdb9e'], beach:['#508889','#fff1c2'],
 };
 const [shadow,highlight]=horizons[id];
 c.fillStyle=shadow;c.beginPath();c.moveTo(0,280);
 for(let x=0;x<=1024;x+=4){
  const angle=x*Math.PI/512;
  c.lineTo(x,254+10*Math.sin(angle*3)+5*Math.cos(angle*7));
 }
 c.lineTo(1024,285);c.closePath();c.fill();
 c.fillStyle=highlight;
 for(const x of [65,545,785]){
  c.beginPath();c.moveTo(x,155);c.quadraticCurveTo(x+75,138,x+143,150);
  c.lineTo(x+135,159);c.quadraticCurveTo(x+60,148,x,162);c.fill();
 }
 if(id==='forest'){
  c.fillStyle='#354c3c';for(let j=0;j<72;j++){const x=j*14.8,h=16+(Math.sin(j*27.7)*.5+.5)*42;c.beginPath();c.moveTo(x,291);c.lineTo(x+7,263-h);c.lineTo(x+16,291);c.fill();}
 }
 if(id==='city')for(let j=0;j<35;j++){
  const x=j*30,h=25+(Math.sin(j*17)*.5+.5)*73;c.fillStyle='#192431';c.fillRect(x,278-h,26,h);
  for(let y=282-h;y<275;y+=10){c.fillStyle=j%3?'#bcb295':'#8699b5';c.fillRect(x+5,y,4,3);c.fillRect(x+16,y,4,3);}
 }
 // Store radiance above display white so chrome and clearcoat catch a bright
 // sky reflection even after the environment is filtered for rough surfaces.
 const pixels=c.getImageData(0,0,canvas.width,canvas.height).data;
 const radiance=new Uint16Array(pixels.length);
 const linear=Float32Array.from({length:256},(_,i)=>THREE.ColorManagement.toWorkingColorSpace(new THREE.Color(i/255,0,0),THREE.SRGBColorSpace).r);
 const half=THREE.DataUtils.toHalfFloat;
 const one=half(1);
 for(let i=0;i<pixels.length;i+=4){
  const r=linear[pixels[i]],g=linear[pixels[i+1]],b=linear[pixels[i+2]];
  const gain=1+2.4*Math.pow(Math.max(r,g,b),6);
  radiance[i]=half(r*gain);radiance[i+1]=half(g*gain);radiance[i+2]=half(b*gain);radiance[i+3]=one;
 }
 const panorama=new THREE.DataTexture(radiance,canvas.width,canvas.height,THREE.RGBAFormat,THREE.HalfFloatType);
 panorama.flipY=true;panorama.minFilter=panorama.magFilter=THREE.LinearFilter;
 panorama.mapping=THREE.EquirectangularReflectionMapping;panorama.needsUpdate=true;
 const generator=new THREE.PMREMGenerator(renderer),target=generator.fromEquirectangular(panorama);panorama.dispose();generator.dispose();return target;
}
