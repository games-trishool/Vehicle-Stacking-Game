import { Capacitor } from '@capacitor/core';
import { AdMob,InterstitialAdPluginEvents,BannerAdPosition,BannerAdSize } from '@capacitor-community/admob';
import { Interstitials,NativeInterstitialPort,type NativeInterstitialAPI } from './interstitials';

// Google's Android demo interstitial: always test ads, never revenue ads.
// Its matching demo application ID is declared in Android's strings.xml.
const TEST_INTERSTITIAL='ca-app-pub-3940256099942544/1033173712';
const TEST_BANNER='ca-app-pub-3940256099942544/6300978111';
let bannerVisible=false;
export function createInterstitials(storage:Pick<Storage,'getItem'|'setItem'>){
 const native=Capacitor.getPlatform()==='android'&&Capacitor.isPluginAvailable('AdMob');
 const port=native?new NativeInterstitialPort(AdMob as NativeInterstitialAPI,TEST_INTERSTITIAL,{
  dismissed:InterstitialAdPluginEvents.Dismissed,failed:InterstitialAdPluginEvents.FailedToShow,
 }):undefined;
 return new Interstitials(port,storage);
}
/** Show a Google demo banner only in the native Android app. */
export async function showHomeBanner(){
 if(Capacitor.getPlatform()!=='android'||!Capacitor.isPluginAvailable('AdMob'))return false;
 try{
  await AdMob.initialize({initializeForTesting:true});
  await AdMob.showBanner({adId:TEST_BANNER,isTesting:true,npa:true,adSize:BannerAdSize.ADAPTIVE_BANNER,position:BannerAdPosition.BOTTOM_CENTER});
  bannerVisible=true;return true;
 }catch(error){console.warn('Banner ad unavailable; gameplay continues.',error);return false;}
}
export async function hideHomeBanner(){
 if(!bannerVisible)return;
 try{await AdMob.hideBanner();}catch(error){console.warn('Banner ad could not be hidden.',error);}finally{bannerVisible=false;}
}

