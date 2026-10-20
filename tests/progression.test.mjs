import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialState,loadState,saveState,unlockVehicle,unlockWorld,resetState,landingReward,recordRun,STORAGE_KEY,VEHICLES } from '../src/store.mjs';
const memory=()=>{const data=new Map();return{getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};};
test('perfect chains reward skill and cap the multiplier at 5',()=>{
 assert.deepEqual(landingReward(false,0),{points:40,coins:1});
 assert.deepEqual(landingReward(true,1),{points:100,coins:3});
 assert.deepEqual(landingReward(true,20),{points:500,coins:3});
});
test('unlocking spends coins once and rejects unaffordable purchases',()=>{
 const state=initialState();assert.equal(unlockVehicle(state,'sports'),false);assert.equal(state.coins,0);
 state.coins=200;assert.equal(unlockVehicle(state,'sports'),true);assert.equal(state.coins,50);assert.equal(unlockVehicle(state,'sports'),true);assert.equal(state.coins,50);assert.equal(unlockVehicle(state,'invalid'),false);
});
test('the expanded fleet unlocks individually, persists, and requires all twelve for the collector achievement',()=>{
 const state=initialState(),s=memory();state.coins=5000;
 for(const id of ['sports','bus','tractor'])assert.equal(unlockVehicle(state,id),true);
 assert.equal(state.achievements.includes('collector'),false);
 for(const id of ['rickshaw','ambulance','police','fireengine','dumptruck','mixer']){
  const cost=VEHICLES.find(v=>v.id===id).cost,before=state.coins;
  assert.ok(cost>0);assert.equal(unlockVehicle(state,id),true);assert.equal(state.coins,before-cost);
  assert.equal(unlockVehicle(state,id),true);assert.equal(state.coins,before-cost);
  state.selectedVehicle=id;saveState(s,state);assert.deepEqual(loadState(s),state);
 }
 assert.equal(state.unlocked.length,13);assert.deepEqual(state.achievements,['collector']);
});
test('vehicle, world, settings and progress survive a storage round trip',()=>{
 const s=memory(),state=initialState();state.selectedVehicle='truck';state.selectedWorld='space';state.settings.sound=false;state.settings.music=false;state.achievements.push('perfect');state.coins=984;
 assert.equal(saveState(s,state),true);assert.deepEqual(loadState(s),state);
});
test('music defaults on for existing saves and its preference is independent of effects',()=>{
 const s=memory();s.setItem(STORAGE_KEY,JSON.stringify({version:1,coins:240,settings:{sound:false}}));
 const state=loadState(s);assert.equal(state.settings.music,true);assert.equal(state.settings.sound,false);assert.equal(state.coins,240);
 state.settings.music=false;state.settings.sound=true;saveState(s,state);
 const restored=loadState(s);assert.equal(restored.settings.music,false);assert.equal(restored.settings.sound,true);
 s.setItem(STORAGE_KEY,JSON.stringify({version:1,settings:{music:'false'}}));assert.equal(loadState(s).settings.music,true);
});
test('corrupt or unavailable storage starts a usable game',()=>{
 const s=memory();s.setItem(STORAGE_KEY,'{broken');assert.deepEqual(loadState(s),initialState());assert.deepEqual(loadState({getItem:()=>{throw Error('blocked');}}),initialState());assert.equal(saveState({setItem:()=>{throw Error('quota');}},initialState()),false);
});
test('unsupported selections, negative balances and invalid rankings are filtered',()=>{
 const s=memory();s.setItem(STORAGE_KEY,JSON.stringify({...initialState(),coins:-9,selectedWorld:'missing',selectedVehicle:'bus',unlocked:['invalid'],achievements:['perfect','invalid'],runs:[{score:'bad'}]}));
 const result=loadState(s);assert.equal(result.coins,0);assert.equal(result.selectedVehicle,'mixed');assert.equal(result.selectedWorld,'forest');assert.deepEqual(result.achievements,['perfect']);assert.equal(result.runs.length,0);
});
test('rankings retain the best 20 real runs and heights never decrease',()=>{
 const state=initialState();for(let i=0;i<25;i++)recordRun(state,{score:i*40,stacks:i,height:i*1.2,world:'forest',combo:0});recordRun(state,{score:0,stacks:0,height:0,world:'city',combo:0});assert.equal(state.runs.length,20);assert.equal(state.best,960);assert.equal(state.bestHeight,28.799999999999997);assert.equal(state.runs[0].score,960);assert.equal(state.runs.at(-1).score,200);
});
test('exactly three vehicles and three places are free, with mixed mode available',()=>{
 const state=initialState();assert.equal(state.coins,0);
 assert.deepEqual(state.unlocked,['mixed','car','suv','truck']);assert.deepEqual(state.unlockedWorlds,['forest','city','space']);
 assert.equal(unlockWorld(state,'snow'),false);assert.equal(state.coins,0);
 state.coins=150;assert.equal(unlockWorld(state,'snow'),true);assert.equal(state.coins,0);
 assert.equal(unlockWorld(state,'snow'),true);assert.equal(state.coins,0);assert.equal(unlockWorld(state,'invalid'),false);
});
test('purchased places persist and a locked selection cannot bypass ownership',()=>{
 const s=memory(),state=initialState();state.coins=350;assert.equal(unlockWorld(state,'beach'),true);state.selectedWorld='beach';saveState(s,state);
 assert.equal(loadState(s).selectedWorld,'beach');assert.ok(loadState(s).unlockedWorlds.includes('beach'));
 state.selectedWorld='desert';saveState(s,state);assert.equal(loadState(s).selectedWorld,'forest');
});
test('legacy saves keep balances and vehicle purchases while paid places require unlocking',()=>{
 const s=memory();s.setItem(STORAGE_KEY,JSON.stringify({version:1,coins:95,selectedWorld:'beach',selectedVehicle:'sports',unlocked:['sports']}));
 const state=loadState(s);assert.equal(state.coins,95);assert.equal(state.selectedWorld,'forest');assert.equal(state.selectedVehicle,'sports');
 assert.deepEqual(state.unlockedWorlds,['forest','city','space']);assert.equal(state.unlockedWorlds.includes('beach'),false);
});
test('reset clears every progress category and setting, persists, and leaves unrelated storage intact',()=>{
 const s=memory(),state=initialState();s.setItem('another-app','keep');Object.assign(state,{coins:900,best:1800,bestHeight:22,totalStacks:60,selectedVehicle:'sports',selectedWorld:'beach',unlocked:['mixed','car','suv','truck','sports'],unlockedWorlds:['forest','city','space','beach'],achievements:['first'],runs:[{score:1800,stacks:12,height:22,world:'beach',date:'2026-10-19'}]});state.settings.music=false;state.settings.sound=false;state.settings.quality='low';
 assert.equal(resetState(s,state),true);assert.deepEqual(state,initialState());assert.deepEqual(loadState(s),initialState());assert.equal(s.getItem('another-app'),'keep');
});
