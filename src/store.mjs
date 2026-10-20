export const VEHICLES = [
  {id:'mixed', name:'Mixed vehicles', subtitle:'A little of everything', cost:0, color:'#809271', label:'SURPRISE ME'},
  {id:'car', name:'Classic coupe', subtitle:'Every great tower starts here', cost:0, color:'#d8ad54', label:'THE ORIGINAL'},
  {id:'suv', name:'Trail SUV', subtitle:'Built for the great outdoors', cost:0, color:'#758b6f', label:'ADVENTURE READY'},
  {id:'truck', name:'Pickup truck', subtitle:'A little more muscle', cost:0, color:'#c57854', label:'HEAVY DUTY'},
  {id:'sports', name:'Sport GT', subtitle:'Low, fast, perfectly balanced', cost:150, color:'#c95049', label:'PRECISION'},
  {id:'rickshaw', name:'Auto rickshaw', subtitle:'Three wheels. Endless character.', cost:200, color:'#d8af28', label:'CITY FAVORITE'},
  {id:'bus', name:'City bus', subtitle:'Make room for big ambitions', cost:250, color:'#dbc062', label:'BIG ENERGY'},
  {id:'tractor', name:'Field tractor', subtitle:'A whole new kind of horsepower', cost:350, color:'#64997e', label:'COUNTRY CLASSIC'},
  {id:'ambulance', name:'Ambulance', subtitle:'A lifesaver for your next climb', cost:400, color:'#e9ece9', label:'FIRST RESPONSE'},
  {id:'police', name:'Police car', subtitle:'Keep your tower under control', cost:450, color:'#e3e7e9', label:'ON PATROL'},
  {id:'fireengine', name:'Fire engine', subtitle:'Big rescue. Bigger ambitions.', cost:500, color:'#b51d25', label:'RESCUE CREW'},
  {id:'dumptruck', name:'Dump truck', subtitle:'Build a tower with serious muscle', cost:550, color:'#d5a52e', label:'HEAVY HAULER'},
  {id:'mixer', name:'Cement mixer', subtitle:'Mix things up on the way to the top', cost:600, color:'#c16c27', label:'SOLID FOUNDATIONS'},
];
export const WORLDS = [
  {id:'forest',cost:0,name:'Realistic Forest',subtitle:'Golden light. Endless possibilities.',tone:'#718b5b',tag:'GOLDEN HOUR'},
  {id:'city',cost:0,name:'Night City',subtitle:'Find your rhythm under neon lights.',tone:'#6d608e',tag:'AFTER HOURS'},
  {id:'space',cost:0,name:'Outer Space',subtitle:'Take your ambition out of this world.',tone:'#5262a2',tag:'ZERO LIMITS'},
  {id:'snow',cost:150,name:'Snow Mountains',subtitle:'Fresh air. A higher perspective.',tone:'#8eaeb8',tag:'ALPINE ESCAPE'},
  {id:'desert',cost:250,name:'Desert',subtitle:'Chase the sun beyond the dunes.',tone:'#cd9c65',tag:'DESERT DREAMING'},
  {id:'beach',cost:350,name:'Beach',subtitle:'Good tides. Great heights.',tone:'#67aba7',tag:'COASTAL CALM'},
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
/** @typedef {{version:number,coins:number,best:number,bestHeight:number,selectedVehicle:string,selectedWorld:string,unlocked:string[],unlockedWorlds:string[],achievements:string[],runs:Run[],totalStacks:number,settings:{sound:boolean,music:boolean,haptics:boolean,quality:string,reduceMotion:boolean}}} State */
/** @returns {State} */
export function initialState(){return {version:1,coins:0,best:0,bestHeight:0,selectedVehicle:'mixed',selectedWorld:'forest',unlocked:['mixed','car','suv','truck'],unlockedWorlds:['forest','city','space'],achievements:[],runs:[],totalStacks:0,settings:{sound:true,music:true,haptics:true,quality:'auto',reduceMotion:false}};}
export function loadState(storage){
  const base=initialState();
  try {
    const raw=JSON.parse(storage.getItem(STORAGE_KEY)||'null');
    if(!raw||raw.version!==1) return base;
    for(const k of ['coins','best','bestHeight','totalStacks']) if(Number.isFinite(raw[k])&&raw[k]>=0) base[k]=raw[k];
    base.unlocked=[...new Set([...base.unlocked,...(Array.isArray(raw.unlocked)?raw.unlocked.filter(id=>VEHICLES.some(v=>v.id===id)):[])])];
    if(base.unlocked.includes(raw.selectedVehicle)) base.selectedVehicle=raw.selectedVehicle;
    base.unlockedWorlds=[...new Set([...base.unlockedWorlds,...(Array.isArray(raw.unlockedWorlds)?raw.unlockedWorlds.filter(id=>WORLDS.some(w=>w.id===id)):[])])];
    if(base.unlockedWorlds.includes(raw.selectedWorld))base.selectedWorld=raw.selectedWorld;
    base.achievements=Array.isArray(raw.achievements)?raw.achievements.filter(id=>ACHIEVEMENTS.some(a=>a.id===id)):[];
    base.runs=Array.isArray(raw.runs)?raw.runs.filter(r=>Number.isFinite(r.score)&&r.score>=0&&Number.isFinite(r.stacks)&&r.stacks>=0&&Number.isFinite(r.height)&&typeof r.date==='string').slice(0,20):[];
    if(raw.settings){for(const k of ['sound','music','haptics','reduceMotion']) if(typeof raw.settings[k]==='boolean') base.settings[k]=raw.settings[k];if(['auto','high','low'].includes(raw.settings.quality)) base.settings.quality=raw.settings.quality;}
  } catch { /* Storage can be unavailable or contain an older save. */ }
  return base;
}
export function saveState(storage,state){try{storage.setItem(STORAGE_KEY,JSON.stringify(state));return true;}catch{return false;}}
export function landingReward(perfect,combo){return {points:perfect?100*Math.min(combo,5):40,coins:perfect?3:1};}
export function unlockVehicle(state,id){const v=VEHICLES.find(v=>v.id===id);if(!v)return false;if(state.unlocked.includes(id))return true;if(state.coins<v.cost)return false;state.coins-=v.cost;state.unlocked.push(id);if(VEHICLES.every(v=>state.unlocked.includes(v.id))&&!state.achievements.includes('collector'))state.achievements.push('collector');return true;}
export function recordRun(state,run){state.best=Math.max(state.best,run.score);state.bestHeight=Math.max(state.bestHeight,run.height);state.runs=[{...run,date:new Date().toISOString()},...state.runs].sort((a,b)=>b.score-a.score).slice(0,20);}

export function unlockWorld(state,id){const world=WORLDS.find(w=>w.id===id);if(!world)return false;if(state.unlockedWorlds.includes(id))return true;if(state.coins<world.cost)return false;state.coins-=world.cost;state.unlockedWorlds.push(id);return true;}
/** Reset only this game's progress; preserve unrelated browser/app storage. */
export function resetState(storage,state){Object.assign(state,initialState());return saveState(storage,state);}
