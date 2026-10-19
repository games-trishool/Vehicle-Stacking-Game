// Full-screen ads only belong at a completed-run boundary, never during play.
const COUNTER_KEY='stackline.ad-frequency.v1';
const MAX_CACHE_AGE=55*60*1000;
export interface InterstitialPort {
 initialize():Promise<void>;
 load():Promise<unknown>;
 // Resolves on dismissal, not when the native show request is accepted.
 show():Promise<void>;
}
type CounterStorage=Pick<Storage,'getItem'|'setItem'>;
export class Interstitials {
 private completed=0;
 private initialized=false;
 private loading?:Promise<void>;
 private readyAt?:number;
 busy=false;
 onBusyChange=(_busy:boolean)=>{};
 constructor(private port:InterstitialPort|undefined,private storage:CounterStorage,private now=Date.now){
  try{const count=Number(storage.getItem(COUNTER_KEY));if(Number.isInteger(count)&&count>=0&&count<3)this.completed=count;}catch{/* Ads must not require device storage. */}
 }
 get snapshot(){return{enabled:!!this.port,completedSinceBreak:this.completed,ready:this.readyAt!==undefined&&this.now()-this.readyAt<MAX_CACHE_AGE,busy:this.busy};}
 preload(){
  if(!this.port||this.loading||this.snapshot.ready||this.busy)return;
  this.readyAt=undefined;
  this.loading=(async()=>{
   try{
    if(!this.initialized){await this.port!.initialize();this.initialized=true;}
    await this.port!.load();this.readyAt=this.now();
   }catch(error){console.warn('Ad unavailable; gameplay continues.',error);}
   finally{this.loading=undefined;}
  })();
 }
 recordCompletedGame(){
  if(!this.port)return false;
  this.completed=(this.completed+1)%3;this.persist();return this.completed===0;
 }
 resetCounter(){this.completed=0;this.persist();}
 private persist(){try{this.storage.setItem(COUNTER_KEY,String(this.completed));}catch{/* Keep counting in memory if storage is unavailable. */}}
 async showAtBreak(due:boolean,canPresent:()=>boolean){
  // Never await loading here: a late ad must not interrupt the next run.
  if(!due||!this.port||this.busy||!this.snapshot.ready||!canPresent())return false;
  this.readyAt=undefined;this.busy=true;this.onBusyChange(true);
  try{await this.port.show();return true;}
  catch(error){console.warn('Ad could not be shown; gameplay continues.',error);return false;}
  finally{this.busy=false;this.onBusyChange(false);this.preload();}
 }
}

type Listener={remove():Promise<void>};
export interface NativeInterstitialAPI {
 initialize(options:{initializeForTesting:boolean}):Promise<void>;
 prepareInterstitial(options:{adId:string;isTesting:boolean;npa:boolean;immersiveMode:boolean}):Promise<unknown>;
 showInterstitial():Promise<void>;
 addListener(event:string,callback:()=>void):Promise<Listener>;
}
export class NativeInterstitialPort implements InterstitialPort {
 private finish?:{resolve:()=>void;reject:(reason:unknown)=>void};
 constructor(private sdk:NativeInterstitialAPI,private adId:string,private events:{dismissed:string;failed:string}){}
 async initialize(){
  const listeners:Listener[]=[];
  try{
   listeners.push(await this.sdk.addListener(this.events.dismissed,()=>{const pending=this.finish;this.finish=undefined;pending?.resolve();}));
   listeners.push(await this.sdk.addListener(this.events.failed,()=>{const pending=this.finish;this.finish=undefined;pending?.reject(new Error('Interstitial failed to present.'));}));
   await this.sdk.initialize({initializeForTesting:true});
  }catch(error){await Promise.allSettled(listeners.map(listener=>listener.remove()));throw error;}
 }
 load(){return this.sdk.prepareInterstitial({adId:this.adId,isTesting:true,npa:true,immersiveMode:true});}
 show(){
  if(this.finish)return Promise.reject(new Error('An interstitial is already open.'));
  return new Promise<void>((resolve,reject)=>{
   this.finish={resolve,reject};
   void this.sdk.showInterstitial().catch(error=>{const pending=this.finish;this.finish=undefined;pending?.reject(error);});
  });
 }
}
