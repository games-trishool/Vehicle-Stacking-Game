import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {verifyPlayBundle,decodeBase64} from '../src/play-receipt.mjs';
import {creditWallet,initialState,loadState,resetState,grantAllAccess,VEHICLES,WORLD_IDS} from '../src/store.mjs';

test('Play deliveries require a signed, completed purchase for the matching game and token',async()=>{
 const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
 const key=await crypto.subtle.importKey('spki',decodeBase64(publicKey.export({type:'spki',format:'der'}).toString('base64')),
   {name:'RSASSA-PKCS1-v1_5',hash:'SHA-1'},false,['verify']);
 function purchase(fields={}){
   const receipt=JSON.stringify({packageName:'com.trishool.stackline',productId:'stackline_coins_100',
     purchaseToken:'order-token',purchaseState:0,quantity:2,...fields});
   return {purchaseToken:'order-token',receipt,signature:sign('RSA-SHA1',Buffer.from(receipt),privateKey).toString('base64')};
 }
 const result=await verifyPlayBundle(key,purchase());
 assert.equal(result.bundle.coins*result.quantity,200);
 for(const fields of [{purchaseState:2},{productId:'unknown'},{packageName:'other'},{quantity:0},{purchaseToken:'different'}]){
   await assert.rejects(verifyPlayBundle(key,purchase(fields)));
 }
 const pass=await verifyPlayBundle(key,purchase({productId:'stackline_all_access',quantity:1}));
 assert.equal(pass.bundle.id,'stackline_all_access');
 await assert.rejects(verifyPlayBundle(key,purchase({productId:'stackline_all_access',quantity:2})));
 const altered=purchase();altered.receipt=altered.receipt.replace('coins_100','coins_1000');
 await assert.rejects(verifyPlayBundle(key,altered));
});

test('wallet delivery is atomic and a replay after reload or reset cannot credit twice',()=>{
 const state=initialState();
 assert.throws(()=>creditWallet({setItem(){throw Error();}},state,100,5,'t'));
 assert.equal(state.coins,0);assert.equal(state.paidTokens.length,0);
 let saved;
 const storage={setItem:(_,value)=>{saved=value;},getItem:()=>saved};
 creditWallet(storage,state,100,5,'t');
 const restored=loadState(storage);
 creditWallet(storage,restored,100,5,'t');
 assert.equal(restored.coins,100);assert.equal(restored.rubies,5);
 resetState(storage,restored);creditWallet(storage,restored,100,5,'t');
 assert.equal(restored.coins,0);assert.equal(restored.rubies,0);
});

test('one-time pass unlocks the full catalog and survives replay, reload and game reset',()=>{
 let saved;
 const storage={setItem:(_,value)=>{saved=value;},getItem:()=>saved};
 const state=initialState();state.coins=71;
 assert.throws(()=>grantAllAccess({setItem(){throw Error();}},state));assert.equal(state.allAccess,false);
 grantAllAccess(storage,state);grantAllAccess(storage,state);
 assert.equal(state.coins,71);assert.equal(state.rubies,0);
 const restored=loadState(storage);
 assert.equal(restored.allAccess,true);assert.deepEqual(restored.unlocked,VEHICLES.map(v=>v.id));
 assert.deepEqual(restored.unlockedWorlds,WORLD_IDS);
 resetState(storage,restored);
 assert.equal(restored.coins,0);assert.equal(loadState(storage).allAccess,true);
 assert.deepEqual(loadState(storage).unlockedWorlds,WORLD_IDS);
});
