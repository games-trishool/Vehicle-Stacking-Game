export const VEHICLES = [
  {id:'mixed', name:'Mixed vehicles', subtitle:'A little of everything', cost:0, color:'#809271', label:'SURPRISE ME'},
  {id:'car', name:'Classic coupe', subtitle:'Every great tower starts here', cost:0, color:'#d8ad54', label:'THE ORIGINAL'},
  {id:'suv', name:'Trail SUV', subtitle:'Built for the great outdoors', cost:0, color:'#758b6f', label:'ADVENTURE READY'},
  {id:'truck', name:'Pickup truck', subtitle:'A little more muscle', cost:0, color:'#c57854', label:'HEAVY DUTY'},
  {id:'sports', name:'Sport GT', subtitle:'Low, fast, perfectly balanced', cost:150, color:'#c95049', label:'PRECISION'},
  {id:'bus', name:'City bus', subtitle:'Make room for big ambitions', cost:250, color:'#dbc062', label:'BIG ENERGY'},
  {id:'tractor', name:'Field tractor', subtitle:'A whole new kind of horsepower', cost:350, color:'#64997e', label:'COUNTRY CLASSIC'},
];
export const WORLDS = [
  {id:'forest',name:'Realistic Forest',subtitle:'Golden light. Endless possibilities.',tone:'#718b5b',tag:'GOLDEN HOUR'},
  {id:'city',name:'Night City',subtitle:'Find your rhythm under neon lights.',tone:'#6d608e',tag:'AFTER HOURS'},
  {id:'space',name:'Outer Space',subtitle:'Take your ambition out of this world.',tone:'#5262a2',tag:'ZERO LIMITS'},
  {id:'snow',name:'Snow Mountains',subtitle:'Fresh air. A higher perspective.',tone:'#8eaeb8',tag:'ALPINE ESCAPE'},
  {id:'desert',name:'Desert',subtitle:'Chase the sun beyond the dunes.',tone:'#cd9c65',tag:'DESERT DREAMING'},
  {id:'beach',name:'Beach',subtitle:'Good tides. Great heights.',tone:'#67aba7',tag:'COASTAL CALM'},
];
export const ACHIEVEMENTS = [
  {id:'first',name:'First ascent',description:'Stack your first vehicle.',icon:'flag'},
  {id:'perfect',name:'Right on the mark',description:'Make a perfect landing.',icon:'target'},
  {id:'ten',name:'Into the canopy',description:'Stack 10 vehicles in one run.',icon:'tree'},
  {id:'combo',name:'In the flow',description:'Land 5 perfect drops in a row.',icon:'zap'},
  {id:'twenty',name:'Sky is the limit',description:'Stack 20 vehicles in one run.',icon:'mountain'},
  {id:'collector',name:'Keys to the kingdom',description:'Unlock every vehicle.',icon:'key'},
];
export const STORAGE_KEY = 'stackline.progress.v1';
/** @typedef {{score:number,stacks:number,height:number,world:string,combo:number,date:string}} Run */
/** @typedef {{version:number,coins:number,best:number,bestHeight:number,selectedVehicle:string,selectedWorld:string,unlocked:string[],achievements:string[],runs:Run[],totalStacks:number,settings:{sound:boolean,music:boolean,haptics:boolean,quality:string,reduceMotion:boolean}}} State */
/** @returns {State} */
export function initialState(){return {version:1,coins:120,best:0,bestHeight:0,selectedVehicle:'mixed',selectedWorld:'forest',unlocked:['mixed','car','suv','truck'],achievements:[],runs:[],totalStacks:0,settings:{sound:true,music:true,haptics:true,quality:'auto',reduceMotion:false}};}
export function loadState(storage){
  const base=initialState();
  try {
    const raw=JSON.parse(storage.getItem(STORAGE_KEY)||'null');
    if(!raw||raw.version!==1) return base;
    for(const k of ['coins','best','bestHeight','totalStacks']) if(Number.isFinite(raw[k])&&raw[k]>=0) base[k]=raw[k];
    base.unlocked=[...new Set([...base.unlocked,...(Array.isArray(raw.unlocked)?raw.unlocked.filter(id=>VEHICLES.some(v=>v.id===id)):[])])];
    if(base.unlocked.includes(raw.selectedVehicle)) base.selectedVehicle=raw.selectedVehicle;
    if(WORLDS.some(w=>w.id===raw.selectedWorld)) base.selectedWorld=raw.selectedWorld;
    base.achievements=Array.isArray(raw.achievements)?raw.achievements.filter(id=>ACHIEVEMENTS.some(a=>a.id===id)):[];
    base.runs=Array.isArray(raw.runs)?raw.runs.filter(r=>Number.isFinite(r.score)&&r.score>=0&&Number.isFinite(r.stacks)&&r.stacks>=0&&Number.isFinite(r.height)&&typeof r.date==='string').slice(0,20):[];
    if(raw.settings){for(const k of ['sound','music','haptics','reduceMotion']) if(typeof raw.settings[k]==='boolean') base.settings[k]=raw.settings[k];if(['auto','high','low'].includes(raw.settings.quality)) base.settings.quality=raw.settings.quality;}
  } catch { /* Storage can be unavailable or contain an older save. */ }
  return base;
}
export function saveState(storage,state){try{storage.setItem(STORAGE_KEY,JSON.stringify(state));return true;}catch{return false;}}
export function landingReward(perfect,combo){return {points:perfect?100*Math.min(combo,5):40,coins:perfect?5+Math.min(combo,5):2};}
export function unlockVehicle(state,id){const v=VEHICLES.find(v=>v.id===id);if(!v)return false;if(state.unlocked.includes(id))return true;if(state.coins<v.cost)return false;state.coins-=v.cost;state.unlocked.push(id);if(VEHICLES.every(v=>state.unlocked.includes(v.id))&&!state.achievements.includes('collector'))state.achievements.push('collector');return true;}
export function recordRun(state,run){state.best=Math.max(state.best,run.score);state.bestHeight=Math.max(state.bestHeight,run.height);state.runs=[{...run,date:new Date().toISOString()},...state.runs].sort((a,b)=>b.score-a.score).slice(0,20);}
