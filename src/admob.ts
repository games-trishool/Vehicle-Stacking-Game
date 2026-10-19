import { Capacitor } from '@capacitor/core';
import { AdMob,InterstitialAdPluginEvents } from '@capacitor-community/admob';
import { Interstitials,NativeInterstitialPort,type NativeInterstitialAPI } from './interstitials';

// Google's Android demo interstitial: always test ads, never revenue ads.
// Its matching demo application ID is declared in Android's strings.xml.
const TEST_INTERSTITIAL='ca-app-pub-3940256099942544/1033173712';
export function createInterstitials(storage:Pick<Storage,'getItem'|'setItem'>){
 const native=Capacitor.getPlatform()==='android'&&Capacitor.isPluginAvailable('AdMob');
 const port=native?new NativeInterstitialPort(AdMob as NativeInterstitialAPI,TEST_INTERSTITIAL,{
  dismissed:InterstitialAdPluginEvents.Dismissed,failed:InterstitialAdPluginEvents.FailedToShow,
 }):undefined;
 return new Interstitials(port,storage);
}
