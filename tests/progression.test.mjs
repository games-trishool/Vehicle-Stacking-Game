import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialState,loadState,saveState,unlockVehicle,landingReward,recordRun,STORAGE_KEY } from '../src/store.mjs';
const memory=()=>{const data=new Map();return{getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};};
test('perfect chains reward skill and cap the multiplier at 5',()=>{
 assert.deepEqual(landingReward(false,0),{points:40,coins:2});
 assert.deepEqual(landingReward(true,1),{points:100,coins:6});
 assert.deepEqual(landingReward(true,20),{points:500,coins:10});
});
test('unlocking spends coins once and rejects unaffordable purchases',()=>{
 const state=initialState();assert.equal(unlockVehicle(state,'sports'),false);assert.equal(state.coins,120);
 state.coins=200;assert.equal(unlockVehicle(state,'sports'),true);assert.equal(state.coins,50);assert.equal(unlockVehicle(state,'sports'),true);assert.equal(state.coins,50);assert.equal(unlockVehicle(state,'invalid'),false);
});
test('vehicle, world, settings and progress survive a storage round trip',()=>{
 const s=memory(),state=initialState();state.selectedVehicle='truck';state.selectedWorld='space';state.settings.sound=false;state.achievements.push('perfect');state.coins=984;
 assert.equal(saveState(s,state),true);assert.deepEqual(loadState(s),state);
});
test('corrupt or unavailable storage starts a usable game',()=>{
 const s=memory();s.setItem(STORAGE_KEY,'{broken');assert.deepEqual(loadState(s),initialState());assert.deepEqual(loadState({getItem:()=>{throw Error('blocked');}}),initialState());assert.equal(saveState({setItem:()=>{throw Error('quota');}},initialState()),false);
});
test('unsupported selections, negative balances and invalid rankings are filtered',()=>{
 const s=memory();s.setItem(STORAGE_KEY,JSON.stringify({...initialState(),coins:-9,selectedWorld:'missing',selectedVehicle:'bus',unlocked:['invalid'],achievements:['perfect','invalid'],runs:[{score:'bad'}]}));
 const result=loadState(s);assert.equal(result.coins,120);assert.equal(result.selectedVehicle,'mixed');assert.equal(result.selectedWorld,'forest');assert.deepEqual(result.achievements,['perfect']);assert.equal(result.runs.length,0);
});
test('rankings retain the best 20 real runs and heights never decrease',()=>{
 const state=initialState();for(let i=0;i<25;i++)recordRun(state,{score:i*40,stacks:i,height:i*1.2,world:'forest',combo:0});recordRun(state,{score:0,stacks:0,height:0,world:'city',combo:0});assert.equal(state.runs.length,20);assert.equal(state.best,960);assert.equal(state.bestHeight,28.799999999999997);assert.equal(state.runs[0].score,960);assert.equal(state.runs.at(-1).score,200);
});
