import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { createVehicle, prepareGoldenBonusVehicle, type VehicleId } from './vehicles';
import { VEHICLE_SPECS } from './vehicle-specs.mjs';
import { Scenery, disposeSurfaceTextureCache, type WorldId } from './scenery';
import { landingReward } from './store.mjs';
import { GameAudio } from './audio';
import { watchSurfaceContacts } from './physics.mjs';
import { ImpactGate } from './impacts.mjs';
import { createVehicleBody } from './vehicle-physics.mjs';
import {DamageGate,contactInModel} from './damage-rules.mjs';
import {VehicleDamage,GlassFragments,prepareDamageGeometry} from './vehicle-damage';
import {worldEnvironment} from './world-lighting';

export interface Landing {perfect:boolean;combo:number;score:number;stacks:number;height:number;coins:number;stability:number;bonusRuby?:boolean;}
type Item={mesh:THREE.Group;body:CANNON.Body;id:VehicleId;height:number;landedY:number;damage:VehicleDamage};
type Mode='home'|'playing'|'paused'|'ended';
export class StackingGame {
  scene=new THREE.Scene(); camera=new THREE.PerspectiveCamera(39,1,.1,250);renderer:THREE.WebGLRenderer;
  scenery:Scenery; audio=new GameAudio();mode:Mode='home';selectedVehicle='mixed';unlocked:VehicleId[]=['car','suv','truck'];worldId:WorldId='forest';
  items:Item[]=[];display=new THREE.Group();world?:CANNON.World;held?:THREE.Group;heldId:VehicleId='car';falling?:Item;guide?:THREE.Line;
  score=0;stacks=0;combo=0;coins=0;top=.49;stability=100;phase=0;elapsed=0;settled=0;contact=false;spawnTimer=0;slow=0;shake=0;lookY=4.2;quality='auto';reduceMotion=false;
  groundContact=false;lastImpactSpeed=0;private impactGate=new ImpactGate();
  private damageGate=new DamageGate();private glassFragments=new GlassFragments(this.scene);
  private pendingDamage:{item:Item;point:THREE.Vector3;strength:number;fromAbove:boolean}[]=[];
  onLanding:(landing:Landing)=>void=()=>{};onEnd:(result:Landing)=>void=()=>{};onStability:(value:number)=>void=()=>{};
  private last=performance.now();private raf=0;private observer:ResizeObserver;private particles:{mesh:THREE.InstancedMesh;v:THREE.Vector3[];p:THREE.Vector3[];age:number}[]=[];
  private confetti:{mesh:THREE.InstancedMesh;p:THREE.Vector3[];v:THREE.Vector3[];spin:THREE.Vector3[];rotation:THREE.Vector3[];scale:THREE.Vector3[];age:number;life:number}[]=[];
  private environmentTarget:THREE.WebGLRenderTarget;private environmentTargets=new Map<WorldId,THREE.WebGLRenderTarget>();private sceneries=new Map<WorldId,Scenery>();private targetLook=new THREE.Vector3();private cameraPosition=new THREE.Vector3();private particleDummy=new THREE.Object3D();
  private frames=0;private frameTime=0;private renders=0;private dirty=true;private overlayOpen=false;private appActive=true;private disposed=false;
  private performanceFrames=0;private performanceTime=0;private adaptiveLow=false;
  private graphicsPrepared=false;private effectsPreparing=0;private homeStacks=new Map<string,THREE.Group>();private activeHomeStack?:THREE.Group;
  private readonly confettiGeometry=new THREE.BoxGeometry(1,1,.08);
  private readonly confettiMaterial=new THREE.MeshStandardMaterial({color:0xffffff,metalness:.58,roughness:.27,envMapIntensity:1.6,emissive:0x613500,emissiveIntensity:.12,side:THREE.DoubleSide});
  private showroomLights:THREE.PointLight[]=[];
  private bonusAura?:THREE.Group;
  private mobileQuery=matchMedia('(max-width: 760px), (pointer: coarse)');
  private visibilityChanged=()=>{if(document.hidden)this.stopFrames();else{this.last=performance.now();this.invalidate();}};
  constructor(public container:HTMLElement){
    this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,this.mobileQuery.matches?1.5:1.75));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.04;container.append(this.renderer.domElement);
    this.renderer.domElement.setAttribute('aria-label','Live 3D vehicle tower');this.renderer.domElement.setAttribute('role','img');
    this.environmentTarget=worldEnvironment(this.renderer,this.worldId);this.environmentTargets.set(this.worldId,this.environmentTarget);this.scene.environment=this.environmentTarget.texture;
    this.scenery=new Scenery(this.scene,'forest');this.sceneries.set('forest',this.scenery);this.scene.add(this.display);
    // Soft, shadowless studio fills make the home showcase paint and glass read
    // clearly against every world without adding work during active gameplay.
    this.showroomLights=[new THREE.PointLight(0xffdfbd,18,24,2),new THREE.PointLight(0xc5dcff,12,22,2)];
    this.showroomLights[0].position.set(-7,11,9);this.showroomLights[1].position.set(8,6,7);
    this.showroomLights.forEach(light=>this.scene.add(light));
    this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(container);document.addEventListener('visibilitychange',this.visibilityChanged);this.resize();this.showHome();
  }
  get averageFps(){return Math.round(this.frames/Math.max(this.frameTime,.001));}
  get sceneFrames(){return this.frames;}
  get renderFrames(){return this.renders;}
  get renderPending(){return this.raf!==0||this.effectsPreparing>0;}
  get renderBudget(){return this.mode==='home'?30:60;}
  get adaptiveQualityReduced(){return this.adaptiveLow;}
  get vehicleCount(){let count=0;this.scene.traverse(object=>{if(object.userData.spec&&object.userData.id)count++;});return count;}
  get vehicleTypes(){const ids:VehicleId[]=[];this.scene.traverse(object=>{if(object.userData.spec&&object.userData.id)ids.push(object.userData.id);});return ids;}
  get damageSnapshot(){return [...this.items,...(this.falling?[this.falling]:[])].map(item=>({bodyId:item.body.id,id:item.id,...item.damage.snapshot}));}
  get glassChipCount(){return this.glassFragments.count;}
  private async prepareConfetti(){
    const warmScene=new THREE.Scene(),mesh=new THREE.InstancedMesh(this.confettiGeometry,this.confettiMaterial,1);
    warmScene.environment=this.scene.environment;warmScene.add(new THREE.AmbientLight(0xffffff,1));mesh.setColorAt(0,new THREE.Color(0xffcf45));warmScene.add(mesh);
    try{await this.renderer.compileAsync(warmScene,this.camera);}catch{/* Confetti can still compile on first render if shader warmup is unavailable. */}
    mesh.dispose();warmScene.clear();
  }
  async prepareGraphics(){
    await prepareGoldenBonusVehicle();
    await this.prepareConfetti();
    for(const id of Object.keys(VEHICLE_SPECS) as VehicleId[])prepareDamageGeometry(createVehicle(id));
    this.graphicsPrepared=true;return this.prepareEffects();
  }
  private effectsKey(){return `${this.worldId}/${this.renderer.shadowMap.enabled}/${this.scenery.localLights.filter(light=>light.visible).length}`;}
  private prepareEffects(){
    const key=this.effectsKey();this.effectsPreparing++;
    return this.glassFragments.prepare(this.renderer,this.scene,this.camera,key,()=>this.effectsKey()===key,()=>this.renders++).finally(()=>{this.effectsPreparing--;});
  }
  resize(){const {width,height}=this.container.getBoundingClientRect();if(width<1||height<1)return;const current=this.renderer.getSize(this.renderSize);if(current.x!==width||current.y!==height)this.renderer.setSize(width,height);this.camera.aspect=width/height;this.camera.updateProjectionMatrix();this.invalidate();}
  private renderSize=new THREE.Vector2();
  configure(settings:{quality:string;reduceMotion:boolean;sound:boolean;music:boolean}){
    if(this.quality!==settings.quality)this.adaptiveLow=false;
    this.quality=settings.quality;this.reduceMotion=settings.reduceMotion;this.audio.setEnabled(settings.sound);this.audio.setMusicEnabled(settings.music);
    this.performanceFrames=0;this.performanceTime=0;this.applyQuality();
  }
  private applyQuality(prepareEffects=true){
    const mobile=this.mobileQuery.matches,ultra=this.quality==='ultra',low=this.quality==='low';
    const autoReduced=(this.quality==='auto'&&(this.adaptiveLow||(navigator.hardwareConcurrency||8)<=4))||((this.quality==='high'||ultra)&&this.adaptiveLow);
    // Keep automatic rendering lean enough for sustained gameplay. Ultra is
    // still sharper, while avoiding extreme pixel counts on high-DPI screens.
    const ratio=Math.min(devicePixelRatio,ultra&&!this.adaptiveLow?(mobile?1.5:1.85):low?1:autoReduced?1.25:mobile?1.5:1.75);
    if(this.renderer.getPixelRatio()!==ratio)this.renderer.setPixelRatio(ratio);
    this.renderer.shadowMap.enabled=!low;
    this.scenery.setLightBudget(low?2:autoReduced||this.quality==='auto'&&mobile?4:8);
    const shadowSize=(low||autoReduced||mobile&&this.quality==='auto')?1024:ultra&&mobile?1536:2048;
    if(this.scenery.sun.shadow.mapSize.x!==shadowSize){this.scenery.sun.shadow.map?.dispose();this.scenery.sun.shadow.map=null;this.scenery.sun.shadow.mapSize.set(shadowSize,shadowSize);}
    const anisotropy=Math.min(this.renderer.capabilities.getMaxAnisotropy(),ultra&&!this.adaptiveLow?16:low?2:autoReduced||mobile?4:12);
    this.scene.traverseVisible(object=>{
      if(!(object instanceof THREE.Mesh))return;
      for(const material of Array.isArray(object.material)?object.material:[object.material]){
        for(const value of Object.values(material))if(value instanceof THREE.Texture&&value.anisotropy!==anisotropy)value.anisotropy=anisotropy;
      }
    });
    this.resize();
    if(prepareEffects&&this.graphicsPrepared)void this.prepareEffects();
  }
  setOverlayOpen(open:boolean){if(open===this.overlayOpen)return;this.overlayOpen=open;this.last=performance.now();this.invalidate();}
  setAppActive(active:boolean){this.appActive=active;if(!active)this.stopFrames();else{this.last=performance.now();this.invalidate();}}
  private stopFrames(){cancelAnimationFrame(this.raf);this.raf=0;}
  private queueFrame(){if(!this.raf&&!this.disposed&&this.appActive&&!document.hidden)this.raf=requestAnimationFrame(this.animate);}
  private invalidate(){this.dirty=true;this.queueFrame();}
  changeWorld(id:WorldId){
    if(id===this.worldId)return;
    this.scenery.deactivate();this.worldId=id;
    const cachedScene=this.sceneries.get(id);
    if(cachedScene){this.sceneries.delete(id);this.scenery=cachedScene;this.scenery.activate();}
    else{this.scenery=new Scenery(this.scene,id);this.sceneries.set(id,this.scenery);}
    this.environmentTarget=this.environmentTargets.get(id)||worldEnvironment(this.renderer,id);
    this.environmentTargets.delete(id);this.environmentTargets.set(id,this.environmentTarget);this.scene.environment=this.environmentTarget.texture;
    // Retain only the current and most recent world to keep mobile memory bounded.
    while(this.sceneries.size>2){const oldest=this.sceneries.keys().next().value as WorldId;if(oldest===id)break;this.sceneries.get(oldest)?.dispose();this.sceneries.delete(oldest);}
    while(this.environmentTargets.size>2){const oldest=this.environmentTargets.keys().next().value as WorldId;if(oldest===id)break;this.environmentTargets.get(oldest)?.dispose();this.environmentTargets.delete(oldest);}
    // Reapply only renderer and light settings here. Reconfiguring audio and
    // compiling the shatter effect in the button event made world selection stall.
    this.applyQuality(false);
    if(this.graphicsPrepared)requestAnimationFrame(()=>{if(!this.disposed&&this.worldId===id)void this.prepareEffects();});
  }
  setVehicles(selected:string,unlocked:string[]){this.selectedVehicle=selected;this.unlocked=unlocked.filter(id=>id!=='mixed') as VehicleId[];if(this.mode==='home')this.showHome();}
  private pick():VehicleId{if(this.selectedVehicle!=='mixed')return this.selectedVehicle as VehicleId;return this.unlocked[Math.floor(Math.random()*this.unlocked.length)]||'car';}
  private clear(){
    this.audio.stopMusic();this.impactGate.reset();this.damageGate.reset();this.pendingDamage=[];this.glassFragments.clear();this.lastImpactSpeed=0;
    for(const item of this.items){item.damage.dispose();this.scene.remove(item.mesh);}
    // A missed drop stays outside items so its fall can animate after game over.
    // Remove it before discarding the reference when starting another run or home.
    if(this.falling){this.falling.damage.dispose();this.scene.remove(this.falling.mesh);}
    this.clearBonusAura();if(this.held)this.scene.remove(this.held);
    this.items=[];this.falling=undefined;this.held=undefined;if(this.activeHomeStack)this.display.remove(this.activeHomeStack);this.activeHomeStack=undefined;this.display.clear();
    if(this.guide){this.scene.remove(this.guide);this.guide.geometry.dispose();(this.guide.material as THREE.Material).dispose();}
    this.guide=undefined;
    for(const p of this.particles){this.scene.remove(p.mesh);p.mesh.dispose();p.mesh.geometry.dispose();(p.mesh.material as THREE.Material).dispose();}
    for(const p of this.confetti){this.scene.remove(p.mesh);p.mesh.dispose();}
    this.particles=[];this.confetti=[];this.world=undefined;this.spawnTimer=0;this.slow=0;this.shake=0;this.groundContact=false;
  }
  reset(){this.score=0;this.stacks=0;this.combo=0;this.coins=0;this.stability=100;this.showHome();}
  showHome(){
    this.clear();this.mode='home';this.showroomLights.forEach(light=>light.visible=true);
    const key=this.selectedVehicle;let stack=this.homeStacks.get(key);
    if(!stack){stack=this.buildHomeStack(key);this.homeStacks.set(key,stack);}
    else{this.homeStacks.delete(key);this.homeStacks.set(key,stack);}
    this.activeHomeStack=stack;this.display.add(stack);this.top=stack.userData.top;this.lookY=this.top*.49;this.phase=0;this.last=performance.now();this.invalidate();
  }
  private buildHomeStack(selected:string){
    const stack=new THREE.Group();let y=.49;
    const ids:VehicleId[]=selected==='mixed'?['suv','truck','car','sports']:Array(4).fill(selected) as VehicleId[];
    for(let i=0;i<4;i++){const id=ids[i],car=createVehicle(id);car.position.set([0,-.2,.12,-.16][i],y,0);car.rotation.y=[-.06,.045,-.045,.03][i];stack.add(car);y+=VEHICLE_SPECS[id].height-.32;}
    stack.userData.top=y;return stack;
  }
  start(){
    this.clear();this.mode='playing';this.showroomLights.forEach(light=>light.visible=false);this.score=0;this.stacks=0;this.combo=0;this.coins=0;this.top=.49;this.stability=100;this.phase=0;this.lookY=2.2;this.audio.startMusic(true);
    this.buildTower([this.pick()]);
  }
  revive(){
    if(this.mode!=='ended')return false;
    const landed=this.items.map(item=>item.id);
    this.clear();
    this.mode='playing';this.stability=100;this.combo=0;
    this.buildTower(landed);
    this.audio.startMusic();
    return true;
  }
  private buildTower(vehicles:VehicleId[]){
    this.world=new CANNON.World({gravity:new CANNON.Vec3(0,-12,0)});this.world.broadphase=new CANNON.SAPBroadphase(this.world);this.world.allowSleep=true;
    (this.world.solver as CANNON.GSSolver).iterations=12;this.world.defaultContactMaterial.friction=.65;this.world.defaultContactMaterial.restitution=.045;
    const floor=new CANNON.Body({mass:0,shape:new CANNON.Box(new CANNON.Vec3(4.1,.3,4.1)),position:new CANNON.Vec3(0,.19,0)});this.world.addBody(floor);
    const ground=new CANNON.Body({mass:0,shape:new CANNON.Plane()});ground.quaternion.setFromEuler(-Math.PI/2,0,0);ground.position.y=-.13;this.world.addBody(ground);
    watchSurfaceContacts(this.world,[floor,ground],()=>{
      if(this.mode==='playing'){this.groundContact=true;this.end();}
    });
    this.top=.49;
    for(const [index,id] of vehicles.entries()){
      const item=this.makeItem(id,0,this.top);
      if(index===0){
        item.body.type=CANNON.Body.STATIC;item.body.mass=0;item.body.updateMassProperties();
      }else{
        item.body.sleep();
      }
      this.world.addBody(item.body);this.scene.add(item.mesh);this.items.push(item);
      this.top+=item.height;
    }
    this.spawn();this.onStability(100);this.last=performance.now();this.performanceFrames=0;this.performanceTime=0;this.invalidate();
  }
  private makeItem(id:VehicleId,x:number,bottom:number):Item{
    const spec=VEHICLE_SPECS[id],body=createVehicleBody(id,x,bottom);
    const mesh=createVehicle(id);mesh.position.set(x,bottom,0);
    const item:Item={mesh,body,id,height:spec.height,landedY:bottom,damage:new VehicleDamage(mesh)};
    body.addEventListener('collide',(event:{body:CANNON.Body;contact:CANNON.ContactEquation})=>{
      if(body.type!==CANNON.Body.DYNAMIC||(this.mode!=='playing'&&this.mode!=='ended'))return;
      const speed=Math.abs(event.contact.getImpactVelocityAlongNormal());
      const strength=this.impactGate.accept(body.id,event.body.id,speed,performance.now()/1000);
      if(strength){this.lastImpactSpeed=speed;this.audio.crash(strength);}
      const crush=this.damageGate.accept(body.id,event.body.id,speed,performance.now()/1000);
      if(crush){
        const other=this.items.find(candidate=>candidate.body===event.body)||(this.falling?.body===event.body?this.falling:undefined);
        for(const target of other?[item,other]:[item]){
          if(this.pendingDamage.length>=12)break;
          const local=contactInModel(target.body,event.contact,target.height),opposite=target===item?event.body:body;
          const relative=target.body.pointToLocalFrame(opposite.position);
          this.pendingDamage.push({item:target,point:new THREE.Vector3(local.x,local.y,local.z),strength:crush,fromAbove:relative.y>0});
        }
      }
    });
    return item;
  }
  private applyImpacts(){
    // Apply at most one cosmetic dent per frame. Several simultaneous contacts
    // can otherwise trigger repeated geometry edits and raycasts in one frame.
    for(const event of this.pendingDamage.splice(0,1)){
      const result=event.item.damage.impact(event.point,event.strength,event.fromAbove);
      if(result){
        const point=event.item.mesh.localToWorld(result.glassPoint),normal=result.normal.transformDirection(event.item.mesh.matrixWorld);
        this.glassFragments.emit(point,normal,this.quality==='low'?Math.min(5,result.chips):result.chips);
      }
    }
  }
  private spawn(){if(this.mode!=='playing')return;const stackNumber=this.stacks+1,bonus=stackNumber>=3&&stackNumber%3===0;this.heldId=bonus?'gold':this.pick();this.held=createVehicle(this.heldId);this.held.position.set(-3,this.top+3.1,0);this.scene.add(this.held);this.phase=-Math.PI/2;this.elapsed=0;this.settled=0;this.contact=false;
    if(bonus){this.addBonusAura();this.burstConfetti(this.held.position);}
    this.guide=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3(0,-3,0)]),new THREE.LineDashedMaterial({color:0xf1e5ad,transparent:true,opacity:.55,dashSize:.12,gapSize:.13}));this.guide.computeLineDistances();this.scene.add(this.guide);
  }
  private addBonusAura(){
    if(!this.held)return;
    const aura=new THREE.Group();
    const light=new THREE.PointLight(0xffb934,22,7,2);light.position.y=.9;aura.add(light);
    this.held.add(aura);this.bonusAura=aura;
  }
  private clearBonusAura(){
    if(!this.bonusAura)return;this.bonusAura.parent?.remove(this.bonusAura);
    this.bonusAura.traverse(object=>{if(object instanceof THREE.Mesh){object.geometry.dispose();const materials=Array.isArray(object.material)?object.material:[object.material];materials.forEach(material=>material.dispose());}});
    this.bonusAura=undefined;
  }
  private burstConfetti(origin:THREE.Vector3){
    const count=40,life=2.7,mesh=new THREE.InstancedMesh(this.confettiGeometry,this.confettiMaterial,count),p:THREE.Vector3[]=[],v:THREE.Vector3[]=[],spin:THREE.Vector3[]=[],rotation:THREE.Vector3[]=[],scale:THREE.Vector3[]=[],dummy=this.particleDummy;
    const palette=[0xffcf45,0xffe88a,0xd98a12,0xffb91f,0xfff0bb];
    for(let i=0;i<count;i++){
      p.push(origin.clone().add(new THREE.Vector3((Math.random()-.5)*2.7,2+Math.random()*.6,(Math.random()-.5)*1.8)));
      v.push(new THREE.Vector3((Math.random()-.5)*5,.5+Math.random()*1.9,(Math.random()-.5)*3));
      spin.push(new THREE.Vector3((Math.random()-.5)*13,(Math.random()-.5)*13,(Math.random()-.5)*9));
      rotation.push(new THREE.Vector3(Math.random()*Math.PI,Math.random()*Math.PI,Math.random()*Math.PI));
      scale.push(new THREE.Vector3(.055+Math.random()*.075,.018+Math.random()*.028,1));
      dummy.position.copy(p[i]);dummy.rotation.set(rotation[i].x,rotation[i].y,rotation[i].z);dummy.scale.copy(scale[i]);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);mesh.setColorAt(i,new THREE.Color(palette[i%palette.length]));
    }
    mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;this.scene.add(mesh);this.confetti.push({mesh,p,v,spin,rotation,scale,age:0,life});
  }
  drop(){
    if(this.mode!=='playing'||!this.held||!this.world)return false;
    const item=this.makeItem(this.heldId,this.held.position.x,this.held.position.y);this.clearBonusAura();this.scene.remove(this.held);this.held=undefined;
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
    this.burst(new THREE.Vector3(item.body.position.x,item.landedY+.5,0),perfect,item.id==='gold');
    this.onLanding({perfect,combo:this.combo,score:this.score,stacks:this.stacks,height:this.top,coins:reward.coins,stability:this.stability,bonusRuby:item.id==='gold'});this.spawnTimer=.62;
  }
  private end(){if(this.mode!=='playing')return;this.mode='ended';this.audio.stopMusic();this.audio.fail();this.clearBonusAura();if(this.held){this.scene.remove(this.held);this.held=undefined;}if(this.guide)this.guide.visible=false;this.onEnd({perfect:false,combo:this.combo,score:this.score,stacks:this.stacks,height:this.top,coins:this.coins,stability:this.stability});}
  private burst(position:THREE.Vector3,perfect:boolean,bonus=false){
    const n=bonus?72:perfect?45:22,geo=new THREE.SphereGeometry(perfect?.035:.07,5,4),material=new THREE.MeshBasicMaterial({color:bonus?0xffbf3f:perfect?0xffd571:0xa4a58a,transparent:true});const mesh=new THREE.InstancedMesh(geo,material,n);const p=[],v=[];
    for(let i=0;i<n;i++){p.push(position.clone().add(new THREE.Vector3((Math.random()-.5)*3,.1,(Math.random()-.5)*2)));v.push(new THREE.Vector3((Math.random()-.5)*4,1+Math.random()*3,(Math.random()-.5)*4));}this.scene.add(mesh);this.particles.push({mesh,p,v,age:0});
  }
  private update(dt:number){
    const visualDt=dt;
    if(this.mode==='home'){
      this.phase+=dt*.20;this.display.rotation.y=Math.sin(this.phase)*.17;
    }
    if(this.mode==='playing'||this.mode==='ended'){
      if(this.slow>0){this.slow-=dt;dt*=.38;}
      if(this.held&&this.mode==='playing'){
        this.phase+=dt*(1.1+Math.min(this.stacks,35)*.035);const center=this.items.at(-1)?.body.position.x||0;
        this.held.position.x=center+Math.sin(this.phase)*3.4;this.held.position.y=this.top+3.1+(this.reduceMotion?0:Math.sin(this.phase*2)*(this.heldId==='gold'?.085:.045));
        if(this.heldId==='gold'){const motion=this.reduceMotion?.18:1;this.held.rotation.y=Math.sin(this.phase*.75)*.10*motion;this.held.rotation.z=Math.sin(this.phase*1.25)*.025*motion;if(this.bonusAura){this.bonusAura.rotation.y+=dt*(this.reduceMotion?.35:1.5);this.bonusAura.scale.setScalar(.98+Math.sin(this.phase*3)*.035*motion);}}
        if(this.guide)this.guide.position.set(this.held.position.x,this.held.position.y,0);
      }
      this.world?.step(1/60,dt,3);
      for(const item of this.items)this.syncItem(item);
      if(this.falling)this.syncItem(this.falling);
      if(dt>0)this.applyImpacts();
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
    const narrow=this.camera.aspect<.85;
    // Bring the home vehicle showcase closer so its paint, glazing and wheel
    // detailing remain legible in the tall mobile card. Keep gameplay framing.
    const distance=playing?(narrow?18:16):(narrow?15:13.2);
    const position=this.cameraPosition.set(center+distance*.62,this.lookY+(playing?5:3.4),distance*.77);
    if(this.shake>0){this.shake=Math.max(0,this.shake-visualDt*.32);position.x+=(Math.random()-.5)*this.shake;position.y+=(Math.random()-.5)*this.shake;}
    this.camera.position.copy(position);this.camera.lookAt(this.targetLook);
    this.scenery.update(visualDt,playing?this.lookY:0);
    this.glassFragments.update(visualDt);
    const dummy=this.particleDummy;for(let j=this.particles.length-1;j>=0;j--){const p=this.particles[j];if(this.mode==='paused')continue;p.age+=visualDt;for(let i=0;i<p.p.length;i++){p.v[i].y-=visualDt*4;p.p[i].addScaledVector(p.v[i],visualDt);dummy.position.copy(p.p[i]);dummy.scale.setScalar(Math.max(.01,1-p.age/1.4));dummy.updateMatrix();p.mesh.setMatrixAt(i,dummy.matrix);}p.mesh.instanceMatrix.needsUpdate=true;(p.mesh.material as THREE.MeshBasicMaterial).opacity=Math.max(0,1-p.age/1.4);if(p.age>1.4){this.scene.remove(p.mesh);p.mesh.dispose();p.mesh.geometry.dispose();(p.mesh.material as THREE.Material).dispose();this.particles.splice(j,1);}}
    for(let j=this.confetti.length-1;j>=0;j--){const burst=this.confetti[j];if(this.mode==='paused')continue;burst.age+=visualDt;const fade=Math.min(1,Math.max(.01,(burst.life-burst.age)/.65));for(let i=0;i<burst.p.length;i++){const pos=burst.p[i],velocity=burst.v[i],spin=burst.spin[i],rotation=burst.rotation[i];velocity.y-=visualDt*3.8;velocity.x*=1-visualDt*.22;pos.addScaledVector(velocity,visualDt);rotation.addScaledVector(spin,visualDt);dummy.position.copy(pos);dummy.rotation.set(rotation.x,rotation.y,rotation.z);dummy.scale.copy(burst.scale[i]).multiplyScalar(fade);dummy.updateMatrix();burst.mesh.setMatrixAt(i,dummy.matrix);}burst.mesh.instanceMatrix.needsUpdate=true;if(burst.age>=burst.life){this.scene.remove(burst.mesh);burst.mesh.dispose();this.confetti.splice(j,1);}}
  }
  private syncItem(item:Item){
    // Static bases and settled bodies keep the exact same render transform.
    // Avoid rewriting every mesh transform as a tower grows; Cannon wakes a
    // sleeping body before it moves again, so moving pieces resume syncing.
    if(item.body.type===CANNON.Body.STATIC||item.body.sleepState===CANNON.Body.SLEEPING)return;
    item.mesh.position.set(item.body.position.x,item.body.position.y,item.body.position.z);item.mesh.quaternion.set(item.body.quaternion.x,item.body.quaternion.y,item.body.quaternion.z,item.body.quaternion.w);item.mesh.translateY(-item.height/2);
  }
  private animate=(now:number)=>{
    this.raf=0;if(this.disposed||!this.appActive||document.hidden)return;
    const frozen=this.mode==='paused'||this.overlayOpen,raw=Math.max(0,(now-this.last)/1000);
    if(frozen&&!this.dirty)return;
    if(!this.dirty&&raw<1/this.renderBudget-.001){this.queueFrame();return;}
    this.last=now;this.dirty=false;
    if(!frozen){this.frameTime+=raw;this.frames++;}
    this.update(frozen?0:Math.min(raw,.05));this.renderer.render(this.scene,this.camera);this.renders++;
    // Judge sustained gameplay only; menu idle time and the 30 FPS preview are excluded.
    if(!frozen&&this.mode==='playing'&&this.quality!=='low'&&!this.adaptiveLow){
      this.performanceFrames++;this.performanceTime+=raw;
      if(this.performanceTime>=2.5&&this.performanceFrames>=60){
        if(this.performanceTime/this.performanceFrames>.023){
          this.adaptiveLow=true;
          // Reduce fill cost without changing lights or shadow variants while
          // the run is live; those changes can force shader compilation.
          const ratio=Math.min(devicePixelRatio,1.25);
          if(this.renderer.getPixelRatio()!==ratio)this.renderer.setPixelRatio(ratio);
        }
        this.performanceFrames=0;this.performanceTime=0;
      }
    }
    if(!frozen)this.queueFrame();
  };
  dispose(){this.disposed=true;this.stopFrames();document.removeEventListener('visibilitychange',this.visibilityChanged);this.observer.disconnect();this.clear();this.confettiGeometry.dispose();this.confettiMaterial.dispose();this.homeStacks.clear();this.showroomLights.forEach(light=>{this.scene.remove(light);light.dispose();});this.glassFragments.dispose();this.audio.dispose();this.sceneries.forEach(scenery=>scenery.dispose());this.sceneries.clear();this.environmentTargets.forEach(target=>target.dispose());this.environmentTargets.clear();disposeSurfaceTextureCache();this.renderer.dispose();}
}
