import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createVehicle, SPECS, type VehicleId } from './vehicles';
import { Scenery, type WorldId } from './scenery';
import { landingReward } from './store.mjs';
import { GameAudio } from './audio';
import { watchSurfaceContacts } from './physics.mjs';
import { ImpactGate } from './impacts.mjs';
import { createVehicleBody } from './vehicle-physics.mjs';

export interface Landing {perfect:boolean;combo:number;score:number;stacks:number;height:number;coins:number;stability:number;}
type Item={mesh:THREE.Group;body:CANNON.Body;id:VehicleId;height:number;landedY:number};
type Mode='home'|'playing'|'paused'|'ended';
export class StackingGame {
  scene=new THREE.Scene(); camera=new THREE.PerspectiveCamera(39,1,.1,250);renderer:THREE.WebGLRenderer;
  scenery:Scenery; audio=new GameAudio();mode:Mode='home';selectedVehicle='mixed';unlocked:VehicleId[]=['car','suv','truck'];worldId:WorldId='forest';
  items:Item[]=[];display=new THREE.Group();world?:CANNON.World;held?:THREE.Group;heldId:VehicleId='car';falling?:Item;guide?:THREE.Line;
  score=0;stacks=0;combo=0;coins=0;top=.49;stability=100;phase=0;elapsed=0;settled=0;contact=false;spawnTimer=0;slow=0;shake=0;lookY=4.2;quality='auto';reduceMotion=false;
  groundContact=false;lastImpactSpeed=0;private impactGate=new ImpactGate();
  onLanding:(landing:Landing)=>void=()=>{};onEnd:(result:Landing)=>void=()=>{};onStability:(value:number)=>void=()=>{};
  private last=performance.now();private raf=0;private observer:ResizeObserver;private particles:{mesh:THREE.InstancedMesh;v:THREE.Vector3[];p:THREE.Vector3[];age:number}[]=[];
  private environmentTarget:THREE.WebGLRenderTarget;private targetLook=new THREE.Vector3();private cameraPosition=new THREE.Vector3();private particleDummy=new THREE.Object3D();
  private frames=0;private frameTime=0;private renders=0;private dirty=true;private overlayOpen=false;private appActive=true;private disposed=false;
  private performanceFrames=0;private performanceTime=0;private adaptiveLow=false;
  private mobileQuery=matchMedia('(max-width: 760px), (pointer: coarse)');
  private visibilityChanged=()=>{if(document.hidden)this.stopFrames();else{this.last=performance.now();this.invalidate();}};
  constructor(public container:HTMLElement){
    this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,this.mobileQuery.matches?1.5:1.75));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.04;container.append(this.renderer.domElement);
    this.renderer.domElement.setAttribute('aria-label','Live 3D vehicle tower');this.renderer.domElement.setAttribute('role','img');
    const pmrem=new THREE.PMREMGenerator(this.renderer),room=new RoomEnvironment();this.environmentTarget=pmrem.fromScene(room,.04);this.scene.environment=this.environmentTarget.texture;room.dispose();pmrem.dispose();
    this.scenery=new Scenery(this.scene,'forest');this.scene.add(this.display);this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(container);document.addEventListener('visibilitychange',this.visibilityChanged);this.resize();this.showHome();
  }
  get averageFps(){return Math.round(this.frames/Math.max(this.frameTime,.001));}
  get renderFrames(){return this.renders;}
  get renderPending(){return this.raf!==0;}
  get renderBudget(){return this.mode==='home'?30:60;}
  get adaptiveQualityReduced(){return this.adaptiveLow;}
  get vehicleCount(){let count=0;this.scene.traverse(object=>{if(object.userData.spec&&object.userData.id)count++;});return count;}
  get vehicleTypes(){const ids:VehicleId[]=[];this.scene.traverse(object=>{if(object.userData.spec&&object.userData.id)ids.push(object.userData.id);});return ids;}
  resize(){const {width,height}=this.container.getBoundingClientRect();if(width<1||height<1)return;const current=this.renderer.getSize(this.renderSize);if(current.x!==width||current.y!==height)this.renderer.setSize(width,height);this.camera.aspect=width/height;this.camera.updateProjectionMatrix();this.invalidate();}
  private renderSize=new THREE.Vector2();
  configure(settings:{quality:string;reduceMotion:boolean;sound:boolean;music:boolean}){
    if(this.quality!==settings.quality)this.adaptiveLow=false;
    this.quality=settings.quality;this.reduceMotion=settings.reduceMotion;this.audio.setEnabled(settings.sound);this.audio.setMusicEnabled(settings.music);
    this.performanceFrames=0;this.performanceTime=0;this.applyQuality();
  }
  private applyQuality(){
    const mobile=this.mobileQuery.matches,low=this.quality==='low'||(this.quality==='auto'&&(this.adaptiveLow||(navigator.hardwareConcurrency||8)<=4));
    const ratio=Math.min(devicePixelRatio,low?1:mobile?1.5:1.75);
    if(this.renderer.getPixelRatio()!==ratio)this.renderer.setPixelRatio(ratio);
    this.renderer.shadowMap.enabled=!low;
    this.scenery.setLightBudget(low?2:this.quality==='auto'&&mobile?4:8);
    const shadowSize=mobile&&this.quality!=='high'?1024:2048;
    if(this.scenery.sun.shadow.mapSize.x!==shadowSize){this.scenery.sun.shadow.map?.dispose();this.scenery.sun.shadow.map=null;this.scenery.sun.shadow.mapSize.set(shadowSize,shadowSize);}
    this.resize();
  }
  setOverlayOpen(open:boolean){if(open===this.overlayOpen)return;this.overlayOpen=open;this.last=performance.now();this.invalidate();}
  setAppActive(active:boolean){this.appActive=active;if(!active)this.stopFrames();else{this.last=performance.now();this.invalidate();}}
  private stopFrames(){cancelAnimationFrame(this.raf);this.raf=0;}
  private queueFrame(){if(!this.raf&&!this.disposed&&this.appActive&&!document.hidden)this.raf=requestAnimationFrame(this.animate);}
  private invalidate(){this.dirty=true;this.queueFrame();}
  changeWorld(id:WorldId){if(id===this.worldId)return;this.scenery.dispose();this.worldId=id;this.scenery=new Scenery(this.scene,id);this.configure({quality:this.quality,reduceMotion:this.reduceMotion,sound:this.audio.enabled,music:this.audio.musicEnabled});}
  setVehicles(selected:string,unlocked:string[]){this.selectedVehicle=selected;this.unlocked=unlocked.filter(id=>id!=='mixed') as VehicleId[];if(this.mode==='home')this.showHome();}
  private pick():VehicleId{if(this.selectedVehicle!=='mixed')return this.selectedVehicle as VehicleId;return this.unlocked[Math.floor(Math.random()*this.unlocked.length)]||'car';}
  private clear(){
    this.audio.stopMusic();this.impactGate.reset();this.lastImpactSpeed=0;
    for(const item of this.items)this.scene.remove(item.mesh);
    // A missed drop stays outside items so its fall can animate after game over.
    // Remove it before discarding the reference when starting another run or home.
    if(this.falling)this.scene.remove(this.falling.mesh);
    if(this.held)this.scene.remove(this.held);
    this.items=[];this.falling=undefined;this.held=undefined;this.display.clear();
    if(this.guide){this.scene.remove(this.guide);this.guide.geometry.dispose();(this.guide.material as THREE.Material).dispose();}
    this.guide=undefined;
    for(const p of this.particles){this.scene.remove(p.mesh);p.mesh.dispose();p.mesh.geometry.dispose();(p.mesh.material as THREE.Material).dispose();}
    this.particles=[];this.world=undefined;this.spawnTimer=0;this.slow=0;this.shake=0;this.groundContact=false;
  }
  reset(){this.score=0;this.stacks=0;this.combo=0;this.coins=0;this.stability=100;this.showHome();}
  showHome(){
    this.clear();this.mode='home';let y=.49;
    const ids:VehicleId[]=this.selectedVehicle==='mixed'?['suv','truck','car','sports']:Array(4).fill(this.selectedVehicle);
    for(let i=0;i<4;i++){const id=ids[i],car=createVehicle(id);car.position.set([0,-.2,.12,-.16][i],y,0);car.rotation.y=[-.06,.045,-.045,.03][i];this.display.add(car);y+=SPECS[id].height-.32;}
    this.top=y;this.lookY=y*.49;this.phase=0;this.last=performance.now();this.invalidate();
  }
  start(){
    this.clear();this.mode='playing';this.score=0;this.stacks=0;this.combo=0;this.coins=0;this.top=.49;this.stability=100;this.phase=0;this.lookY=2.2;this.audio.startMusic(true);
    this.world=new CANNON.World({gravity:new CANNON.Vec3(0,-12,0)});this.world.broadphase=new CANNON.SAPBroadphase(this.world);this.world.allowSleep=true;
    (this.world.solver as CANNON.GSSolver).iterations=16;this.world.defaultContactMaterial.friction=.65;this.world.defaultContactMaterial.restitution=.045;
    const floor=new CANNON.Body({mass:0,shape:new CANNON.Box(new CANNON.Vec3(4.1,.3,4.1)),position:new CANNON.Vec3(0,.19,0)});this.world.addBody(floor);
    const ground=new CANNON.Body({mass:0,shape:new CANNON.Plane()});ground.quaternion.setFromEuler(-Math.PI/2,0,0);ground.position.y=-.13;this.world.addBody(ground);
    watchSurfaceContacts(this.world,[floor,ground],()=>{
      if(this.mode==='playing'){this.groundContact=true;this.end();}
    });
    // A base vehicle gives every run an approachable first landing.
    const base=this.makeItem(this.pick(),0,.49);base.body.type=CANNON.Body.STATIC;base.body.mass=0;base.body.updateMassProperties();this.world.addBody(base.body);this.items.push(base);this.scene.add(base.mesh);this.top=.49+base.height;this.spawn();this.onStability(100);this.last=performance.now();this.performanceFrames=0;this.performanceTime=0;this.invalidate();
  }
  private makeItem(id:VehicleId,x:number,bottom:number):Item{
    const spec=SPECS[id],body=createVehicleBody(id,x,bottom);
    body.addEventListener('collide',(event:{body:CANNON.Body;contact:CANNON.ContactEquation})=>{
      if(body.type!==CANNON.Body.DYNAMIC||(this.mode!=='playing'&&this.mode!=='ended'))return;
      const speed=Math.abs(event.contact.getImpactVelocityAlongNormal());
      const strength=this.impactGate.accept(body.id,event.body.id,speed,performance.now()/1000);
      if(strength){this.lastImpactSpeed=speed;this.audio.crash(strength);}
    });
    const mesh=createVehicle(id);mesh.position.set(x,bottom,0);return{mesh,body,id,height:spec.height,landedY:bottom};
  }
  private spawn(){if(this.mode!=='playing')return;this.heldId=this.pick();this.held=createVehicle(this.heldId);this.held.position.set(-3,this.top+3.1,0);this.scene.add(this.held);this.phase=-Math.PI/2;this.elapsed=0;this.settled=0;this.contact=false;
    this.guide=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3(0,-3,0)]),new THREE.LineDashedMaterial({color:0xf1e5ad,transparent:true,opacity:.55,dashSize:.12,gapSize:.13}));this.guide.computeLineDistances();this.scene.add(this.guide);
  }
  drop(){
    if(this.mode!=='playing'||!this.held||!this.world)return false;
    const item=this.makeItem(this.heldId,this.held.position.x,this.held.position.y);this.scene.remove(this.held);this.held=undefined;
    if(this.guide){this.scene.remove(this.guide);this.guide.geometry.dispose();(this.guide.material as THREE.Material).dispose();this.guide=undefined;}
    this.scene.add(item.mesh);this.world.addBody(item.body);this.falling=item;this.elapsed=0;this.settled=0;this.audio.drop();
    item.body.addEventListener('collide',(e:{body:CANNON.Body})=>{if(this.items.some(i=>i.body===e.body)){this.contact=true;if(this.shake<.04&&!this.reduceMotion)this.shake=.08;}});return true;
  }
  pause(){if(this.mode==='playing'){this.mode='paused';this.audio.pauseMusic();this.invalidate();}}
  resume(){if(this.mode==='paused'){this.mode='playing';this.last=performance.now();this.audio.startMusic();this.invalidate();}}
  private land(){
    if(!this.falling)return;
    const item=this.falling,previous=this.items.at(-1)!;const error=Math.abs(item.body.position.x-previous.body.position.x);const perfect=error<.24&&Math.abs(item.body.quaternion.z)<.14;
    this.combo=perfect?this.combo+1:0;this.stacks++;const reward=landingReward(perfect,this.combo);this.score+=reward.points;this.coins+=reward.coins;
    item.landedY=item.body.position.y-item.height/2;this.items.push(item);this.falling=undefined;this.top=item.body.position.y+item.height/2;
    if(perfect){item.body.angularVelocity.scale(.25,item.body.angularVelocity);if(!this.reduceMotion)this.slow=.52;}
    this.audio.landing(perfect,this.combo);if(!this.reduceMotion)this.shake=perfect?.07:.12;
    this.burst(new THREE.Vector3(item.body.position.x,item.landedY+.5,0),perfect);
    this.onLanding({perfect,combo:this.combo,score:this.score,stacks:this.stacks,height:this.top,coins:reward.coins,stability:this.stability});this.spawnTimer=.62;
  }
  private end(){if(this.mode!=='playing')return;this.mode='ended';this.audio.stopMusic();this.audio.fail();if(this.held){this.scene.remove(this.held);this.held=undefined;}if(this.guide)this.guide.visible=false;this.onEnd({perfect:false,combo:this.combo,score:this.score,stacks:this.stacks,height:this.top,coins:this.coins,stability:this.stability});}
  private burst(position:THREE.Vector3,perfect:boolean){
    const n=perfect?45:22,geo=new THREE.SphereGeometry(perfect?.035:.07,5,4),material=new THREE.MeshBasicMaterial({color:perfect?0xffd571:0xa4a58a,transparent:true});const mesh=new THREE.InstancedMesh(geo,material,n);const p=[],v=[];
    for(let i=0;i<n;i++){p.push(position.clone().add(new THREE.Vector3((Math.random()-.5)*3,.1,(Math.random()-.5)*2)));v.push(new THREE.Vector3((Math.random()-.5)*4,1+Math.random()*3,(Math.random()-.5)*4));}this.scene.add(mesh);this.particles.push({mesh,p,v,age:0});
  }
  private update(dt:number){
    const visualDt=dt;
    if(this.mode==='home'){
      this.phase+=dt*.25;this.display.rotation.y=Math.sin(this.phase)*.1;
    }
    if(this.mode==='playing'||this.mode==='ended'){
      if(this.slow>0){this.slow-=dt;dt*=.38;}
      if(this.held&&this.mode==='playing'){
        this.phase+=dt*(1.1+Math.min(this.stacks,35)*.035);const center=this.items.at(-1)?.body.position.x||0;
        this.held.position.x=center+Math.sin(this.phase)*3.4;this.held.position.y=this.top+3.1+(this.reduceMotion?0:Math.sin(this.phase*2)*.045);
        if(this.guide)this.guide.position.set(this.held.position.x,this.held.position.y,0);
      }
      this.world?.step(1/60,dt,3);
      for(const item of this.items)this.syncItem(item);
      if(this.falling)this.syncItem(this.falling);
      if(this.mode==='playing'){
        if(this.spawnTimer>0){this.spawnTimer-=dt;if(this.spawnTimer<=0)this.spawn();}
        if(this.falling){
          this.elapsed+=dt;const b=this.falling.body;
          if(this.contact&&b.velocity.length()<1.3&&b.angularVelocity.length()<1)this.settled+=dt;else this.settled=0;
          if(this.settled>.23&&this.elapsed>.5)this.land();
          else if(b.position.y<this.top-2.3||Math.abs(b.quaternion.z)>.72||Math.abs(b.position.z)>2.5||this.elapsed>6)this.end();
        }
        let risk=0;for(let i=1;i<this.items.length;i++){const item=this.items[i],support=this.items[i-1];risk=Math.max(risk,Math.abs(item.body.position.x-support.body.position.x)/1.9,Math.abs(item.body.quaternion.z)*1.5);if(item.body.position.y<item.landedY+item.height/2-1||Math.abs(item.body.quaternion.z)>.68)this.end();}
        const value=Math.round(Math.max(0,Math.min(100,100-risk*68)));if(value!==this.stability){this.stability=value;this.onStability(value);}
      }
    }
    // Camera climbs with the tower; the world stays anchored below it.
    const playing=this.mode!=='home',desiredY=playing?Math.max(3.4,this.top+1):this.top*.49;
    this.lookY=THREE.MathUtils.lerp(this.lookY,desiredY,1-Math.exp(-visualDt*(this.reduceMotion?12:2.8)));
    const center=playing?(this.items.at(-1)?.body.position.x||0)*.38:0;
    this.targetLook.set(center,this.lookY,0);
    const narrow=this.camera.aspect<.85;const distance=narrow?18:16;
    const position=this.cameraPosition.set(center+distance*.62,this.lookY+(playing?5:3.4),distance*.77);
    if(this.shake>0){this.shake=Math.max(0,this.shake-visualDt*.32);position.x+=(Math.random()-.5)*this.shake;position.y+=(Math.random()-.5)*this.shake;}
    this.camera.position.copy(position);this.camera.lookAt(this.targetLook);
    this.scenery.update(visualDt,playing?this.lookY:0);
    const dummy=this.particleDummy;for(let j=this.particles.length-1;j>=0;j--){const p=this.particles[j];if(this.mode==='paused')continue;p.age+=visualDt;for(let i=0;i<p.p.length;i++){p.v[i].y-=visualDt*4;p.p[i].addScaledVector(p.v[i],visualDt);dummy.position.copy(p.p[i]);dummy.scale.setScalar(Math.max(.01,1-p.age/1.4));dummy.updateMatrix();p.mesh.setMatrixAt(i,dummy.matrix);}p.mesh.instanceMatrix.needsUpdate=true;(p.mesh.material as THREE.MeshBasicMaterial).opacity=Math.max(0,1-p.age/1.4);if(p.age>1.4){this.scene.remove(p.mesh);p.mesh.dispose();p.mesh.geometry.dispose();(p.mesh.material as THREE.Material).dispose();this.particles.splice(j,1);}}
  }
  private syncItem(item:Item){item.mesh.position.set(item.body.position.x,item.body.position.y,item.body.position.z);item.mesh.quaternion.set(item.body.quaternion.x,item.body.quaternion.y,item.body.quaternion.z,item.body.quaternion.w);item.mesh.translateY(-item.height/2);}
  private animate=(now:number)=>{
    this.raf=0;if(this.disposed||!this.appActive||document.hidden)return;
    const frozen=this.mode==='paused'||this.overlayOpen,raw=Math.max(0,(now-this.last)/1000);
    if(frozen&&!this.dirty)return;
    if(!this.dirty&&raw<1/this.renderBudget-.001){this.queueFrame();return;}
    this.last=now;this.dirty=false;
    if(!frozen){this.frameTime+=raw;this.frames++;}
    this.update(frozen?0:Math.min(raw,.05));this.renderer.render(this.scene,this.camera);this.renders++;
    // Judge sustained gameplay only; menu idle time and the 30 FPS preview are excluded.
    if(!frozen&&this.mode==='playing'&&this.quality==='auto'&&!this.adaptiveLow){
      this.performanceFrames++;this.performanceTime+=raw;
      if(this.performanceTime>=4&&this.performanceFrames>=45){
        if(this.performanceTime/this.performanceFrames>.038){this.adaptiveLow=true;this.applyQuality();}
        this.performanceFrames=0;this.performanceTime=0;
      }
    }
    if(!frozen)this.queueFrame();
  };
  dispose(){this.disposed=true;this.stopFrames();document.removeEventListener('visibilitychange',this.visibilityChanged);this.observer.disconnect();this.clear();this.audio.dispose();this.scenery.dispose();this.environmentTarget.dispose();this.renderer.dispose();}
}
