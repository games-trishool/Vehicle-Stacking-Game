import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createVehicle,type VehicleId } from './vehicles';
export function vehicleThumbnails(){
 const result:Record<string,string>={},renderer=new THREE.WebGLRenderer({alpha:true,antialias:true});renderer.setSize(340,190);renderer.setPixelRatio(1);renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;renderer.outputColorSpace=THREE.SRGBColorSpace;
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(33,340/190,.1,100);camera.position.set(7,4.2,7);camera.lookAt(0,1,0);
 const room=new RoomEnvironment(),pmrem=new THREE.PMREMGenerator(renderer),target=pmrem.fromScene(room,.04);scene.environment=target.texture;
 scene.add(new THREE.HemisphereLight(0xfff5dd,0x69796b,3));const sun=new THREE.DirectionalLight(0xfff6e6,3);sun.position.set(-5,9,7);scene.add(sun);
 for(const id of ['car','suv','truck','sports','bus','tractor'] as VehicleId[]){const model=createVehicle(id);scene.add(model);renderer.render(scene,camera);result[id]=renderer.domElement.toDataURL('image/webp');scene.remove(model);}
 result.mixed=result.suv;target.dispose();room.dispose();pmrem.dispose();renderer.dispose();renderer.forceContextLoss();return result;
}
export function worldArt(id:string){
 const palettes:Record<string,string[]>={forest:['#d4ddc5','#9cad85','#728761','#486c49'],city:['#202b43','#595377','#8585a8','#eaca92'],space:['#111b3f','#3d4f83','#6774aa','#beafd3'],snow:['#cfe1e6','#edf2ec','#9dafb7','#718892'],desert:['#eee0bc','#dfb584','#c59160','#a6764d'],beach:['#cce6df','#5bafae','#e3d4aa','#5e8060']};
 const c=palettes[id]||palettes.forest;
 let foreground='';
 if(id==='forest'||id==='snow')for(let i=0;i<13;i++){const x=i*31-8,h=55+(i%4)*11;foreground+=`<path d="M${x} 146v-30" stroke="${c[3]}" stroke-width="4"/><path d="m${x} ${150-h} -18 ${h*.58}h10l-17 ${h*.36}h50l-17-${h*.36}h10z" fill="${c[3]}" opacity="${.6+(i%3)*.15}"/>`;}
 if(id==='city')for(let i=0;i<13;i++){const x=i*30,h=40+(i%4)*18;foreground+=`<rect x="${x}" y="${150-h}" width="24" height="${h}" fill="${c[2]}"/>`;for(let j=0;j<4;j++)foreground+=`<path d="M${x+5} ${157-h+j*13}h3m5 0h3" stroke="${c[3]}" stroke-width="4"/>`;}
 if(id==='space')foreground='<circle cx="278" cy="58" r="31" fill="#8888af"/><ellipse cx="278" cy="58" rx="50" ry="9" fill="none" stroke="#cebad6" stroke-width="5" transform="rotate(-25 278 58)"/>';
 if(id==='beach')foreground='<path d="M0 115h400v45H0" fill="#58a6a6"/><path d="M0 130q80-15 150 9t250-6v27H0" fill="#e9d5ac"/><path d="M47 160 60 62" stroke="#a39070" stroke-width="8"/><path d="M60 62q-32-25-49 6 33-12 49-6 22-35 50-10-35-6-50 10 16-6 33 15-25-9-33-15" fill="#53785d"/>';
 return `<svg viewBox="0 0 400 160" xmlns="http://www.w3.org/2000/svg"><rect width="400" height="160" fill="${c[0]}"/><circle cx="312" cy="40" r="20" fill="${id==='city'||id==='space'?'#e6e2d0':'#faf0cf'}"/><path d="m-30 135 100-87 55 47 80-72 89 100 80-75 76 97" fill="${c[1]}"/><path d="M-20 140q70-65 149-5t160-11 140 9v50H-20" fill="${c[2]}"/>${foreground}</svg>`;
}
