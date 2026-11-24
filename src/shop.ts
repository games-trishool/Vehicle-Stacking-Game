/// <reference path="../node_modules/cordova-plugin-purchase/www/store.d.ts" />
/// <reference types="vite/client" />
import {Capacitor} from '@capacitor/core';

import {allAccessPass,bundles,decodeBase64,verifyPlayBundle} from './play-receipt.mjs';
export {bundles,allAccessPass};
type Bundle=typeof bundles[number]|typeof allAccessPass;
const androidStore=Capacitor.getPlatform()==='android';
const licenseKey=import.meta.env.VITE_GOOGLE_PLAY_LICENSE_KEY?.trim();

export function createShop(deliver:(bundle:Bundle,quantity:number,token:string)=>void,changed:()=>void){
  let store:CdvPurchase.Store|undefined,ordering=false,ready=false;
  let key:CryptoKey|undefined;
  let message=androidStore?'Connecting to Google Play...':'Paid bundles are available in the Android app.';
  let claimed=false;
  const processing=new Set<string>();
  function status(text:string,rewardClaimed=false){message=text;claimed=rewardClaimed;changed();}
  async function fulfill(transaction:CdvPurchase.Transaction){
    const purchase=(transaction as CdvPurchase.GooglePlay.Transaction).nativePurchase;
    if(!purchase||transaction.isPending||transaction.isConsumed||!key||processing.has(purchase.purchaseToken))return;
    processing.add(purchase.purchaseToken);
    try{
      const {bundle,quantity,token}=await verifyPlayBundle(key,purchase);
      deliver(bundle,quantity,token);
      await transaction.finish();
      status('coins' in bundle?
        'Reward claimed! Your coins and diamonds have been added.':
        'Reward claimed! All vehicles and places are unlocked.',true);
    }catch{
      status('Purchase delivery is pending. Reopen the app to retry.');
    }finally{processing.delete(purchase.purchaseToken);}
  }
  async function connect(){
    if(!androidStore||store||typeof CdvPurchase==='undefined'||!CdvPurchase.store)return;
    store=CdvPurchase.store;
    try{
      if(!licenseKey){status('Paid bundles are not available in this build.');return;}
      key=await crypto.subtle.importKey('spki',decodeBase64(licenseKey),{name:'RSASSA-PKCS1-v1_5',hash:'SHA-1'},false,['verify']);
      store.register(bundles.map(b=>({id:b.id,type:CdvPurchase.ProductType.CONSUMABLE,platform:CdvPurchase.Platform.GOOGLE_PLAY})));
      store.register({id:allAccessPass.id,type:CdvPurchase.ProductType.NON_CONSUMABLE,platform:CdvPurchase.Platform.GOOGLE_PLAY});
      store.when().productUpdated(()=>changed()).approved(t=>void fulfill(t))
        .pending(()=>status('Payment pending. Your wallet will update after Google Play confirms it.'));
      const errors=await store.initialize([CdvPurchase.Platform.GOOGLE_PLAY]);
      ready=!errors.length;
      status(ready?'Prices are provided by Google Play.':'Google Play is unavailable. Reopen the app to retry.');
    }catch{status('Google Play checkout is unavailable.');}
  }
  const offer=(id:string)=>ready?store?.get(id,CdvPurchase.Platform.GOOGLE_PLAY)?.getOffer():undefined;
  return {
    start(){void connect();document.addEventListener('deviceready',()=>setTimeout(()=>void connect(),0),{once:true});},
    get notice(){return {message,claimed};},
    clearNotice(){claimed=false;message='';changed();},
    price(id:string){return offer(id)?.pricingPhases[0]?.price;},
    available(id:string){const selected=offer(id);return !ordering&&!!selected?.canPurchase&&!!selected.pricingPhases[0]?.price;},
    async buy(id:string){
      const selected=offer(id);
      if(ordering||!selected?.canPurchase||!selected.pricingPhases[0]?.price)return;
      ordering=true;status('Opening Google Play checkout...');
      try{
        const error=await selected.order();
        if(error)status(error.code===CdvPurchase.ErrorCode.PAYMENT_CANCELLED?'Purchase cancelled.':'Checkout unavailable. Try again.');
      }catch{status('Checkout unavailable. Try again.');}
      finally{ordering=false;changed();}
    }
  };
}
