import '@fontsource/dm-sans/latin-400.css';
import '@fontsource/dm-sans/latin-500.css';
import '@fontsource/dm-sans/latin-600.css';
import '@fontsource/dm-sans/latin-700.css';
import '@fontsource/outfit/latin-500.css';
import '@fontsource/outfit/latin-600.css';
import '@fontsource/outfit/latin-700.css';
import '@fontsource/outfit/latin-800.css';
import './style.css';
import './layout.css';
import privacyDocument from '../public/privacy.html?raw';
import { Capacitor } from '@capacitor/core';
import { allAccessPass,bundles,createShop } from './shop';
import { App } from '@capacitor/app';
import { createInterstitials,nativeRewardAds,watchRewardAd } from './admob';
import { StackingGame,type Landing } from './game';
import { icon } from './icons';
import { showHomeBanner,hideHomeBanner } from './admob';
import { VEHICLES,WORLDS,ACHIEVEMENTS,loadState,saveState,unlockVehicle,unlockWorld,resetState,recordRun,creditWallet,grantAllAccess } from './store.mjs';
import { vehicleThumbnails,worldArt } from './thumbnails';
import type { WorldId } from './scenery';

let storage:Storage;
try{storage=window.localStorage;}catch{storage={getItem:()=>null,setItem:()=>{throw new Error("Storage unavailable");},removeItem:()=>{},clear:()=>{},key:()=>null,length:0};}
const state=loadState(storage);let selectionUpdatePending=false;
// Temporary catalog access is held in memory, separate from persisted ownership.
state.unlocked=[...new Set([...state.unlocked,...VEHICLES.map(vehicle=>vehicle.id)])];
state.unlockedWorlds=[...new Set([...state.unlockedWorlds,...WORLDS.map(world=>world.id)])];
// Apply the new Ultra default once to existing saves that were still on Auto;
// players can choose another preset afterward and that preference will stick.
try{if(storage.getItem('stackline.ultra-visual-upgrade.v1')!=='1'){if(state.settings.quality==='auto'){state.settings.quality='ultra';saveState(storage,state);}storage.setItem('stackline.ultra-visual-upgrade.v1','1');}}catch{/* Graphics remain available when storage is unavailable. */}
let game:StackingGame|undefined,thumbs:Record<string,string>={},dialogKind='',dialogPage=0,runPreviousBest=state.best,sessionBestCombo=0,runRecorded=false,persistWarned=false,bootReady=false,pendingVehicle=state.selectedVehicle,pendingWorld=state.selectedWorld;
const app=document.querySelector<HTMLDivElement>('#app')!;
const interstitials=createInterstitials(storage);
const localDemoAds=!Capacitor.isNativePlatform()&&['localhost','127.0.0.1','[::1]'].includes(location.hostname);
const maxRevives=3;
let revivesUsed=0,adsWatched=0,watchingReward=false,runId='',reviveStatus='';
interstitials.onBusyChange=busy=>{
 app.inert=busy;game?.setOverlayOpen(busy||modal.open);
 if(busy)void game?.audio.context?.suspend().catch(()=>{});
};
app.innerHTML=`
 <div class="home-shell" id="home-shell">
  <header class="header">
    <button class="brand" data-action="home" aria-label="Stack Vehicles home"><span class="brand-mark"><img src="/icons/icon-192.png" alt="" /></span><span class="brand-name">Stack <span>Vehicles</span></span></button>
    <nav class="navigation" aria-label="Main navigation"><button class="nav-link active" data-action="home">The game</button><button class="nav-link" data-action="worlds">Explore worlds</button><button class="nav-link" data-action="garage">Garage</button><button class="nav-link" data-action="leaderboard">Leaderboard</button></nav>
    <div class="header-actions"><div class="currency-balances"><span class="ruby-balance" aria-label="${state.rubies} diamonds">${icon('ruby')}<span id="ruby-balance">${state.rubies}</span></span><button class="coin-balance" data-action="garage" aria-label="${state.coins} coins, open garage">${icon('coin')}<span id="coin-balance">${state.coins}</span></button></div><span class="header-divider"></span><button class="icon-button" data-action="settings" aria-label="Settings">${icon('settings')}</button></div>
  </header>
  <main class="home-main">
    <div class="hero" id="hero">
      <section class="intro" id="intro">
        <div class="home-actions">
        <button class="play-button" data-action="play" disabled aria-label="Let’s play">${icon('play')}<span class="play-label">Let’s play</span><span class="key-hint">SPACE</span>${icon('arrow')}</button>
        <div class="selection-list">
          <button class="selection-row" data-action="vehicles" aria-label="Change vehicle"><span class="selection-icon vehicle-icon" id="selection-vehicle-image">${icon('car')}</span><span class="selection-text"><strong>Change vehicle</strong><small id="selected-vehicle-name">Mixed vehicles</small></span>${icon('arrow')}</button>
          <button class="selection-row" data-action="worlds" aria-label="Change place"><span class="selection-icon world-icon" id="selection-world-image">${icon('tree')}</span><span class="selection-text"><strong>Change place</strong><small id="selected-world-name">Realistic Forest</small></span>${icon('arrow')}</button>
        </div>
        </div>
        <div class="intro-note">${icon('heart')} Easy to play. Hard to put down.</div>
      </section>
      <section class="scene-panel" id="scene-panel" aria-label="Interactive 3D game">
        <div id="game-canvas"></div>
        <div class="scene-vignette"></div>
        <div class="scene-top home-only"><span class="scene-badge"><i></i> LIVE IN 3D</span><span class="scene-weather" id="scene-weather">${icon('sun')} GOLDEN HOUR</span></div>
        <div class="scene-height home-only"><span class="height-icon">${icon('mountain')}</span><span><small>THE ONLY WAY</small><strong>is up.</strong></span></div>
        <div class="scene-caption home-only"><div><span class="scene-kicker" id="scene-kicker">01 / THE GREAT OUTDOORS</span><h2 id="scene-world-title">Into the forest.</h2><p id="scene-world-copy">Find your balance. Reach new heights.</p></div><button class="scene-explore" data-action="worlds" aria-label="Explore environments">${icon('arrow')}</button></div>
        <div class="scene-foot home-only"><span><i></i> SIX WORLDS. LIMITLESS HEIGHTS.</span><span>DRAG YOUR AMBITION UPWARD ${icon('layers')}</span></div>
        <div class="game-hud" id="game-hud" hidden>
          <div class="hud-top"><div class="hud-controls"><button class="hud-button" data-action="pause" aria-label="Pause game">${icon('pause')}</button><div class="stability"><div><span>TOWER BALANCE</span><span id="stability-value">100%</span></div><div class="stability-track"><i id="stability-fill"></i></div></div></div><div class="hud-score"><small>SCORE</small><strong id="score">0</strong></div><div class="hud-currencies"><div class="hud-coins">${icon('coin')}<span id="run-coins">0</span></div><div class="hud-rubies">${icon('ruby')}<span id="game-rubies">${state.rubies}</span></div></div></div>
          <div class="hud-height"><div><span id="height">0.0</span> m</div><small>METERS UP</small></div>
          <div class="landing-feedback" id="landing-feedback" aria-live="polite"></div>
          <div class="drop-instruction" id="drop-instruction"><span class="tap-ring"></span><strong>Tap to drop</strong></div>
        </div>
      </section>
    </div>
    <section class="progress-section" id="progress-section" aria-label="Your progress">
      <div class="progress-heading"><span>EVERY CLIMB COUNTS.</span><span>Your journey, so far ${icon('arrow')}</span></div>
      <div class="progress-cards">
        <button class="progress-card record-card" data-action="leaderboard"><span class="card-icon">${icon('trophy')}</span><div><small>PERSONAL BEST</small><strong id="best-score">0<span> pts</span></strong><p>There’s always a little higher.</p></div><span class="card-arrow">${icon('arrow')}</span></button>
        <button class="progress-card" data-action="achievements" aria-label="Achievements"><span class="card-icon">${icon('flag')}</span><div><small>ACHIEVEMENTS</small><strong id="achievement-count">0 <span>/ 12</span></strong><p>Your next milestone is waiting.</p></div><span class="card-arrow">${icon('arrow')}</span></button>
        <button class="progress-card shop-card" data-action="shop" aria-label="Open currency shop"><span class="card-icon">${icon('coin')}</span><div><small>COINS &amp; DIAMONDS</small><strong>Shop bundles</strong></div><span class="card-arrow">${icon('arrow')}</span></button>
      </div>
      <aside class="ad-banner-slot" id="ad-banner-preview" aria-label="Test banner advertisement preview">
        <span class="ad-preview-label">TEST AD</span><span class="ad-preview-mark">AD</span>
        <span class="ad-preview-copy"><strong>Banner ad preview</strong><small>Demo placement · Android test banner appears here</small></span>
        <span class="ad-preview-action">DEMO</span>
      </aside>
    </section>
  </main>
 </div>
 <dialog id="modal" class="modal"><div id="modal-content"></div></dialog>
 <div class="toast" id="toast" role="status" aria-live="polite"></div>
 <div class="achievement-toast" id="achievement-toast" role="status" aria-live="polite"></div>
`;
const $=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id)! as T;
const modal=$<HTMLDialogElement>('modal');
const worldNames:Record<string,string[]>={forest:['01 / THE GREAT OUTDOORS','Into the forest.','Find your balance. Reach new heights.'],city:['02 / AFTER HOURS','Above the city.','Neon nights. A whole new perspective.'],space:['03 / BEYOND THE ORDINARY','Out of this world.','One small drop. One giant climb.'],snow:['04 / ALPINE ESCAPE','A breath of fresh air.','The summit is only the beginning.'],desert:['05 / CHASING THE SUN','Stay golden.','Big skies. Even bigger ambitions.'],beach:['06 / THE SLOW LIFE','Good tides. High towers.','A little seaside state of mind.']};
function persist(){if(!saveState(storage,state)&&!persistWarned){persistWarned=true;toast('Storage is full or unavailable. Progress stays in memory this session.');}}
function toast(message:string){$('toast').textContent=message;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=window.setTimeout(()=>$('toast').classList.remove('visible'),3300);}
let toastTimer=0,achievementTimer=0,feedbackTimer=0;
function showHomeAd(){
 if(Capacitor.getPlatform()==='android'&&Capacitor.isPluginAvailable('AdMob'))document.body.classList.add('native-ad-supported');
 void showHomeBanner().then(shown=>{if(document.body.classList.contains('in-game')){if(shown)void hideHomeBanner();document.body.classList.remove('has-home-banner');return;}document.body.classList.toggle('has-home-banner',shown);});
}
function renderState(){
 const v=VEHICLES.find(v=>v.id===state.selectedVehicle)!,w=WORLDS.find(w=>w.id===state.selectedWorld)!;
 $('coin-balance').textContent=String(state.coins);$('ruby-balance').textContent=String(state.rubies);$('game-rubies').textContent=String(state.rubies);$('selected-vehicle-name').textContent=v.name;$('selected-world-name').textContent=w.name;
 $('ruby-balance').parentElement!.setAttribute('aria-label',`${state.rubies} diamonds`);
 $('coin-balance').parentElement!.setAttribute('aria-label',`${state.coins} coins, open garage`);
 if(thumbs[v.id])$('selection-vehicle-image').innerHTML=`<img src="${thumbs[v.id]}" alt="" />`;
 $('selection-world-image').innerHTML=worldArt(w.id);
 $('best-score').innerHTML=`${state.best.toLocaleString()}<span> pts</span>`;$('achievement-count').innerHTML=`${state.achievements.length} <span>/ ${ACHIEVEMENTS.length}</span>`;
 const copy=worldNames[w.id];$('scene-kicker').textContent=copy[0];$('scene-world-title').textContent=copy[1];$('scene-world-copy').textContent=copy[2];$('scene-weather').innerHTML=`${icon(w.id==='forest'||w.id==='desert'||w.id==='beach'?'sun':'mountain')} ${w.tag}`;
}
function earn(id:string){if(state.achievements.includes(id))return;state.achievements.push(id);const a=ACHIEVEMENTS.find(a=>a.id===id)!;
 $('achievement-toast').innerHTML=`<span>${icon(a.icon)}</span><div><small>ACHIEVEMENT UNLOCKED</small><strong>${a.name}</strong></div>`;$('achievement-toast').classList.add('visible');clearTimeout(achievementTimer);achievementTimer=window.setTimeout(()=>$('achievement-toast').classList.remove('visible'),4200);persist();
}
function haptic(perfect=false){if(state.settings.haptics&&navigator.vibrate)navigator.vibrate(perfect?[18,30,18]:15);}
function start(){
 if(!game||!bootReady||interstitials.busy)return;void hideHomeBanner().then(()=>document.body.classList.remove('has-home-banner'));interstitials.preload();closeDialog(false);document.body.classList.add('in-game');$('game-hud').hidden=false;
 $('score').textContent='0';$('run-coins').textContent='0';$('height').textContent='0.0';$('landing-feedback').classList.remove('show');$('drop-instruction').classList.remove('hidden');$('stability-value').textContent='100%';$('stability-fill').style.width='100%';
 runPreviousBest=state.best;sessionBestCombo=0;runRecorded=false;
 revivesUsed=0;adsWatched=0;reviveStatus='';runId=Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
 game.start();game.resize();
}
function home(reset=false){if(interstitials.busy||watchingReward)return;closeDialog(false);document.body.classList.remove('in-game');$('game-hud').hidden=true;if(reset)game?.reset();else game?.showHome();game?.resize();renderState();showHomeAd();}
function modalHeader(eyebrow:string,title:string,copy:string,showClose=true){return `<div class="modal-heading"><div><span class="eyebrow">${eyebrow}</span><h2>${title}</h2><p>${copy}</p></div>${showClose?`<button class="icon-button close-modal" data-action="close" aria-label="Close dialog">${icon('close')}</button>`:''}</div>`;}
const shop=createShop((bundle,quantity,token)=>{
 if('coins' in bundle)creditWallet(storage,state,bundle.coins*quantity,bundle.diamonds*quantity,token);
 else{
   grantAllAccess(storage,state);
   game?.setVehicles(state.selectedVehicle,state.unlocked);
 }

 renderState();
 window.setTimeout(()=>{shop.clearNotice();if(dialogKind==='shop')openDialog('shop');},2000);
},()=>{if(dialogKind==='shop'&&!watchingReward)openDialog('shop');});
let shopAdStatus:{message:string;claimed:boolean}|undefined;
function shopContent(){
 const rewardButton=(id:string,label:string,enabled:boolean)=>`<button class="shop-buy" data-action="shop-buy" data-id="${id}" ${enabled?'':'disabled'}>${label}</button>`;
 const row=(coins:number,diamonds:number,button:string)=>`<div class="shop-row"><div><strong>${icon('coin')} ${coins.toLocaleString()} coins</strong><span>${icon('ruby')} ${diamonds} ${diamonds===1?'diamond':'diamonds'}</span></div>${button}</div>`;
 const passPrice=shop.price(allAccessPass.id)??`&#8377;${allAccessPass.inr}`;
 const pass=`<section class="all-access" aria-labelledby="pass-title">
   <div class="pass-scene" aria-hidden="true">${worldArt('desert')}${thumbs.sports?`<img src="${thumbs.sports}" alt="">`:''}</div>
   <div class="pass-copy"><h3 id="pass-title">All Access Pass</h3>
     <p>Drive all ${VEHICLES.length-1} vehicles across ${WORLDS.length} places.</p>
     <button class="pass-buy" data-action="shop-buy" data-id="${allAccessPass.id}" ${state.allAccess||!shop.available(allAccessPass.id)?'disabled':''}>
       ${state.allAccess?icon('check')+' Pass owned':`Unlock pass &middot; ${passPrice}`}</button>
     ${state.allAccess?'':'<small>One-time purchase</small>'}
   </div></section>`;
 return modalHeader('GAME SHOP','Bundles & passes',`Wallet: ${state.coins.toLocaleString()} ${state.coins===1?'coin':'coins'} and ${state.rubies.toLocaleString()} ${state.rubies===1?'diamond':'diamonds'}.`)+
   '<div class="shop-list" tabindex="0" aria-label="Shop offers">'+row(25,1,rewardButton('ad','Watch ad',nativeRewardAds||localDemoAds))+
   bundles.map(b=>row(b.coins,b.diamonds,rewardButton(b.id,shop.price(b.id)??`&#8377;${b.inr}`,shop.available(b.id)))).join('')+
   pass+'</div><p class="shop-note" role="status"></p>';
}
async function shopBuy(id:string){
 if(dialogKind!=='shop')return;
 shopAdStatus=undefined;
 if(id!=='ad'){await shop.buy(id);return;}
 if(watchingReward||(!nativeRewardAds&&!localDemoAds))return;
 watchingReward=true;
 try{
   $('modal-content').innerHTML='<p role="status">Loading rewarded ad...</p>';
   if(nativeRewardAds?await watchRewardAd():await watchLocalDemo('WALLET REWARD')){
     creditWallet(storage,state,25,1,undefined);renderState();
     shopAdStatus={message:'Reward claimed! Added 25 coins and 1 diamond.',claimed:true};
   }else shopAdStatus={message:'Finish the ad to collect your bundle.',claimed:false};
 }catch{shopAdStatus={message:'Reward unavailable. Please try again.',claimed:false};}
 finally{
   watchingReward=false;openDialog('shop');
   if(shopAdStatus?.claimed)window.setTimeout(()=>{shopAdStatus=undefined;if(dialogKind==='shop')openDialog('shop');},2000);
 }
}
function openDialog(kind:string){
 if(interstitials.busy)return;
 if(kind!==dialogKind){pendingVehicle=state.selectedVehicle;pendingWorld=state.selectedWorld;}
 game?.setOverlayOpen(true);
 const page=kind===dialogKind?dialogPage:0;
 const scrollTop=kind===dialogKind?($('modal-content').querySelector('.selection-scroll')?.scrollTop||0):0;
 dialogKind=kind;let content='';
 if(kind==='vehicles'||kind==='garage'){
   const isGarage=kind==='garage';content=modalHeader(isGarage?'GOOD THINGS COME WITH WHEELS':'YOUR TOWER. YOUR WAY.',isGarage?'The garage.':'Pick your ride.',isGarage?'Earn coins with every landing. Find your next favorite.':'Stick with a favorite, or keep the climb surprising.',false);
   content+=`<div class="modal-meta"><span>${state.unlocked.length-1} / ${VEHICLES.length-1} vehicles unlocked</span><span class="coin-balance">${icon('coin')} ${state.coins} coins</span></div><div class="vehicle-grid">`;
   for(const v of VEHICLES){const owned=state.unlocked.includes(v.id),pending=pendingVehicle===v.id,selected=owned&&pending,affordable=!owned&&state.coins>=v.cost&&state.rubies>=(v.diamonds||0);content+=`<button class="vehicle-card ${selected?'selected':''} ${!owned?'locked':''} ${affordable?'affordable':''} ${!owned&&pending?'locked-selected':''} ${v.id==='mixed'?'mixed-card':''}" data-action="select-vehicle" data-id="${v.id}" aria-pressed="${selected}"><div class="vehicle-card-top"><span>${v.label}</span>${selected?`<span class="selected-check">${icon('check')}</span>`:''}</div><div class="vehicle-render">${v.id==='mixed'?'<span class="mixed-spark spark-one">✦</span><span class="mixed-spark spark-two">✦</span>':''}<img src="${thumbs[v.id]||''}" alt="${v.name} 3D model" /></div><div class="vehicle-details"><h3>${v.name}</h3><p>${v.subtitle}</p><span class="vehicle-status">${selected?'SELECTED':'PREVIEW ? ' + `${icon('coin')} ${v.cost.toLocaleString()} + ${icon('ruby')} ${v.diamonds||0} · UNLOCK`}</span></div></button>`;}
   content+='</div>'+selectionFooter('vehicles');
 }
 if(kind==='worlds'){
   content=modalHeader('A CHANGE OF SCENERY','Find your happy place.','Choose a place, then tap Done to save.',false);
   content+=`<div class="modal-meta"><span>${state.unlockedWorlds.length} / 6 places unlocked</span><span class="coin-balance">${icon('coin')} ${state.coins} coins</span></div><div class="world-grid">`;
   for(const w of WORLDS){const owned=state.unlockedWorlds.includes(w.id),pending=pendingWorld===w.id,selected=owned&&pending,affordable=!owned&&state.coins>=w.cost&&state.rubies>=(w.diamonds||0);content+=`<button class="world-card ${selected?'selected':''} ${!owned?'locked':''} ${affordable?'affordable':''} ${!owned&&pending?'locked-selected':''}" data-action="select-world" data-id="${w.id}" aria-pressed="${selected}"><div class="world-art">${worldArt(w.id)}<span>${w.tag}</span>${selected?`<i>${icon('check')}</i>`:!owned?`<i>${icon('lock')}</i>`:''}</div><div><h3>${w.name}</h3><p>${w.subtitle}</p><span class="vehicle-status">${selected?'SELECTED':'PREVIEW ? ' + `${icon('coin')} ${w.cost.toLocaleString()} + ${icon('ruby')} ${w.diamonds||0} · UNLOCK`}</span></div></button>`;}
   content+='</div>'+selectionFooter('worlds');
 }
 if(kind==='settings'){
   content=modalHeader('MAKE YOURSELF AT HOME','Your kind of play.','The little things that make every climb feel right.');
   content+=`<div class="settings-list">${settingToggle('music','Background music','An upbeat arcade soundtrack for every climb.','music')}${settingToggle('sound','Sound effects','Hear every crash and landing.','sound')}${settingToggle('haptics','Touch feedback','Feel your timing with gentle vibrations.','target')}${settingToggle('reduceMotion','Reduce motion','Turn off camera shake and slow motion.','layers')}<div class="setting-row"><span class="setting-icon">${icon('sun')}</span><div><strong>Graphics quality</strong><p>Ultra uses sharper shadows and high resolution. Best on powerful devices.</p></div><select id="quality" aria-label="Graphics quality"><option value="auto" ${state.settings.quality==='auto'?'selected':''}>Auto</option><option value="high" ${state.settings.quality==='high'?'selected':''}>High</option><option value="ultra" ${state.settings.quality==='ultra'?'selected':''}>Ultra</option><option value="low" ${state.settings.quality==='low'?'selected':''}>Battery saver</option></select></div></div><div class="settings-note">${icon('info')} Progress is saved on this device.</div><button class="settings-howto-button" data-action="howto">${icon('info')}<span><strong>How to play</strong><small>Learn the controls and stacking basics.</small></span>${icon('arrow')}</button><button class="privacy-link" data-action="privacy">Privacy policy</button><button class="reset-game-button" data-action="reset-game">${icon('refresh')} Reset game</button>`;
 }
 if(kind==='leaderboard'){
   content=modalHeader('A LITTLE FRIENDLY COMPETITION','Your best climbs.','Every personal best starts with one good drop.');
   content+=`<div class="leaderboard-summary"><div><small>BEST SCORE</small><strong>${state.best.toLocaleString()}</strong></div><div><small>HIGHEST TOWER</small><strong>${state.bestHeight.toFixed(1)}<span> m</span></strong></div><div><small>TOTAL STACKED</small><strong>${state.totalStacks}</strong></div></div><div class="table-label"><span>ON THIS DEVICE</span><span>Top ${Math.min(state.runs.length,10)} runs</span></div>`;
   if(!state.runs.length)content+=`<div class="empty-state">${icon('trophy')}<h3>Your name belongs up here.</h3><p>Play your first run to start your personal leaderboard.</p><button class="primary-button" data-action="play">Let’s play ${icon('arrow')}</button></div>`;
   else content+=`<div class="ranking-table"><div class="ranking-heading"><span>RANK / WORLD</span><span>STACKS</span><span>SCORE</span></div>${state.runs.slice(0,10).map((r,i)=>`<div class="ranking-row"><span><b>${String(i+1).padStart(2,'0')}</b><span><strong>${WORLDS.find(w=>w.id===r.world)?.name||'Forest'}</strong><small>${new Date(r.date).toLocaleDateString(undefined,{month:'short',day:'numeric'})} · ${r.height.toFixed(1)} m</small></span></span><span>${r.stacks}</span><strong>${r.score.toLocaleString()}</strong></div>`).join('')}</div>`;
   content+='<p class="modal-footnote">Personal rankings are stored locally. Online rankings are not connected.</p>';
 }
 if(kind==='shop')content=shopContent();
 if(kind==='achievements'){
   content=modalHeader('CELEBRATE THE LITTLE THINGS','Milestones worth the climb.',`${state.achievements.length} of ${ACHIEVEMENTS.length} achievements discovered.`);content+='<div class="achievements-grid">';
   for(const a of ACHIEVEMENTS){const earned=state.achievements.includes(a.id);content+=`<div class="achievement-card ${earned?'earned':''}"><span class="achievement-icon">${icon(a.icon)}</span><div><h3>${a.name}</h3><p>${a.description}</p><small>${earned?'UNLOCKED':'KEEP CLIMBING'}</small></div>${earned?icon('check'):icon('lock')}</div>`;}content+='</div>';
 }
 if(kind==='howto'){
   content=modalHeader('STACK VEHICLES','How to play','Build the tallest tower you can. A missed drop or a toppled stack ends the run.')+`
     <div class="howto-steps">
       <div><b>01</b><h3>Line up the arrows.</h3><p>Watch the gold arrows under the moving vehicle. Aim for the middle of the roof directly below.</p></div>
       <div><b>02</b><h3>Tap to drop.</h3><p>Tap the play area or press Space to release the vehicle. Centered landings keep the tower steady.</p></div>
       <div><b>03</b><h3>Chain perfect landings.</h3><p>A perfect drop earns 3 coins. Consecutive perfects multiply your points up to 5×. Every third vehicle is gold: land it for a diamond.</p></div>
     </div>
     <button class="primary-button wide" data-action="play">Let’s play ${icon('arrow')}</button>`;
 }
 if(kind==='pause'){
   game?.pause();content=modalHeader('TAKE A BREATH','The view can wait.','Your tower will be right here when you’re ready.')+`<div class="pause-actions"><button class="primary-button wide" data-action="resume">${icon('play')} Keep climbing</button><button class="secondary-button wide" data-action="restart">${icon('refresh')} Start a new run</button><button class="text-button home-button" data-action="end-home">${icon('home')} Back to home</button></div>`;
 }
 if(kind==='privacy'){
   const policy=new DOMParser().parseFromString(privacyDocument,'text/html');
   const article=policy.querySelector('main')!;
   const updated=article.querySelector('small')!.textContent || '';
   article.querySelector('header')?.remove();
   article.querySelectorAll('a').forEach(link=>{link.target='_blank';link.rel='noopener noreferrer';});
   content=modalHeader('SETTINGS','Privacy policy',updated)+
     `<article class="privacy-content" tabindex="0" aria-label="Privacy policy details">${article.innerHTML}</article>`;
 }
 if(kind==='result')content=resultContent();
 $('modal-content').innerHTML=content;modal.className=`modal ${kind==='pause'||kind==='result'?'compact-modal':''}`;modal.dataset.screen=kind;layoutDialog(page);if(!modal.open)modal.showModal();
 if(kind==='shop'){
   const notice=shopAdStatus??shop.notice;
   const note=$('modal-content').querySelector('.shop-note')!;
   note.textContent=notice.message;
   note.classList.toggle('reward-claimed',notice.claimed);
   if(notice.claimed){
     const offers=$('modal-content').querySelector('.shop-list')!;
     offers.scrollTop=offers.scrollHeight;
   }
 }
 const list=$('modal-content').querySelector('.selection-scroll');if(list)list.scrollTop=scrollTop;
}
function selectionFooter(kind:'vehicles'|'worlds'){
 const world=kind==='worlds',choice=world?WORLDS.find(w=>w.id===pendingWorld)!:VEHICLES.find(v=>v.id===pendingVehicle)!;
 const owned=world?state.unlockedWorlds.includes(choice.id):state.unlocked.includes(choice.id);
 const coinShortfall=Math.max(0,choice.cost-state.coins),diamondShortfall=Math.max(0,(choice.diamonds||0)-state.rubies);
 const canUnlock=owned||(coinShortfall===0&&diamondShortfall===0);
 const requirement=[coinShortfall? `${coinShortfall.toLocaleString()} more coins`:'',diamondShortfall?`${diamondShortfall} more diamonds`:''].filter(Boolean).join(' and ');
 return `<div class="selection-footer"><p id="selection-hint" class="${!owned&&!canUnlock?'selection-error':''}" ${!owned&&!canUnlock?'':'hidden'}>${requirement}</p><div class="selection-actions"><button class="selection-cancel" data-action="close">Cancel</button><button class="primary-button selection-done" data-action="selection-done" ${canUnlock?'':'disabled'}>${owned?'Done':'Unlock'}</button></div></div>`;
}
function layoutDialog(page=0){
 const focusAction=(document.activeElement as HTMLElement|null)?.dataset.action;
 const content=$('modal-content');content.querySelector('.dialog-pager')?.remove();
 const grid=content.querySelector<HTMLElement>('.vehicle-grid,.world-grid,.achievements-grid,.ranking-table');
 if(!grid)return;
 const cards=Array.from(grid.querySelectorAll<HTMLElement>('.vehicle-card,.world-card,.achievement-card,.ranking-row'));
 if(grid.matches('.vehicle-grid,.world-grid,.achievements-grid')){
   grid.classList.add('selection-scroll');grid.style.removeProperty('grid-template-rows');
   grid.tabIndex=0;grid.setAttribute('role','region');grid.setAttribute('aria-label',grid.classList.contains('vehicle-grid')?'Vehicles':grid.classList.contains('world-grid')?'Places':'Achievements');
   cards.forEach(card=>card.hidden=false);return;
 }
 const count=innerHeight<650?2:5;
 const pages=Math.max(1,Math.ceil(cards.length/count));dialogPage=Math.max(0,Math.min(page,pages-1));
 cards.forEach((card,index)=>card.hidden=index<dialogPage*count||index>=(dialogPage+1)*count);
 if(pages>1){
   const pager=document.createElement('nav');pager.className='dialog-pager';pager.setAttribute('aria-label','Selection pages');
   pager.innerHTML=`<button data-action="page-prev" aria-label="Previous page" ${dialogPage===0?'disabled':''}>${icon('arrow')}<span>Previous</span></button><span aria-live="polite">${dialogPage+1} / ${pages}</span><button data-action="page-next" aria-label="Next page" ${dialogPage===pages-1?'disabled':''}><span>Next</span>${icon('arrow')}</button>`;
   grid.after(pager);
   if(focusAction==='page-prev'||focusAction==='page-next'){
     const button=pager.querySelector<HTMLButtonElement>(`[data-action="${focusAction}"]:not(:disabled)`)
       ||pager.querySelector<HTMLButtonElement>('button:not(:disabled)');
     button?.focus({preventScroll:true});
   }
 }
}
let dialogResizeFrame=0;
window.addEventListener('resize',()=>{cancelAnimationFrame(dialogResizeFrame);dialogResizeFrame=requestAnimationFrame(()=>{if(modal.open)layoutDialog(dialogPage);});});
function settingToggle(key:'sound'|'music'|'haptics'|'reduceMotion',title:string,copy:string,i:string){return `<div class="setting-row"><span class="setting-icon">${icon(i)}</span><div><strong>${title}</strong><p>${copy}</p></div><button class="toggle ${state.settings[key]?'on':''}" data-action="toggle" data-id="${key}" role="switch" aria-checked="${state.settings[key]}" aria-label="${title}"><i></i></button></div>`;}
function reviveButton(){
 const remaining=revivesUsed+1-adsWatched;
 const exhausted=revivesUsed>=maxRevives,available=nativeRewardAds||localDemoAds;
 const label=exhausted?'All 3 revives used':!available?'Ads available on Android':
   remaining===1?'Watch ad':`Watch ${remaining} ads`;
 return `<button class="primary-button wide revive-button" data-action="revive" ${exhausted||!available?'disabled':''}>${icon('play')} Revive <small>${label}</small></button>${reviveStatus?`<p class="revive-status" role="status">${reviveStatus}</p>`:''}`;
}

function watchLocalDemo(label=`${adsWatched+1} OF ${revivesUsed+1}`){
 const content=$('modal-content');
 content.innerHTML=`<div class="revive-demo"><span class="eyebrow">DEMO AD &middot; ${label}</span><img src="/icons/icon-192.png" alt=""><h2>Stack Vehicles</h2><p>Build your tower. Beat your best.</p><button class="secondary-button wide" id="skip-demo">Skip ad</button><small id="demo-time"></small></div>`;
 return new Promise<boolean>(resolve=>{
   let remaining=4000,last=performance.now();
   const clock=$('demo-time');
   const tick=()=>{
     const now=performance.now();
     if(!document.hidden)remaining-=Math.min(now-last,250);
     last=now;clock.textContent=`Reward in ${Math.max(0,Math.ceil(remaining/1000))}s`;
     if(remaining<=0){clearInterval(timer);resolve(true);}
   };
   const timer=window.setInterval(tick,100);tick();
   $('skip-demo').onclick=()=>{clearInterval(timer);resolve(false);};
 });
}

async function attemptRevive(){
 if(watchingReward||dialogKind!=='result'||game?.mode!=='ended'||revivesUsed>=maxRevives||(!nativeRewardAds&&!localDemoAds))return;
 watchingReward=true;
 try{
   $('modal-content').innerHTML='<p role="status" class="revive-status">Loading rewarded ad...</p>';
   const earned=nativeRewardAds?await watchRewardAd():await watchLocalDemo();
   if(earned)adsWatched++;
   if(adsWatched===revivesUsed+1&&game.revive()){
     revivesUsed++;adsWatched=0;reviveStatus='';runRecorded=false;
     $('height').textContent=game.top.toFixed(1);$('landing-feedback').classList.remove('show');
     watchingReward=false;
     closeDialog(false);
     toast('Reward granted! Stack restored.');
     return;
   }
   reviveStatus=earned?`Reward granted! ${adsWatched} of ${revivesUsed+1} ads complete. Watch the next ad to continue.`:'Finish the ad to earn revive credit.';
 }catch{
   reviveStatus='Ad unavailable. Try again in a moment.';
 }finally{
   watchingReward=false;
   if(dialogKind==='result')openDialog('result');
 }
}
function resultContent(){const isBest=game&&game.score>0&&game.score>runPreviousBest;return modalHeader(isBest?'A NEW PERSONAL BEST':'EVERY DROP IS A NEW BEGINNING',isBest?'That’s a new high.':'What a climb.',isBest?'Take a moment. You’ve earned the view.':'A little higher next time? You’ve got this.')+`<div class="result-trophy">${icon(isBest?'trophy':'layers')}</div><div class="result-score"><small>YOUR SCORE</small><strong>${game?.score.toLocaleString()||0}</strong></div><div class="result-stats"><div><strong>${game?.stacks||0}</strong><span>VEHICLES</span></div><div><strong>${(game?.top||0).toFixed(1)} m</strong><span>HEIGHT</span></div><div><strong>+${game?.coins||0}</strong><span>COINS EARNED</span></div></div><div class="result-actions">${reviveButton()}<button class="secondary-button wide" data-action="play">${icon('refresh')} One more climb ${icon('arrow')}</button><button class="text-button home-button" data-action="home">${icon('home')} Back to home</button></div>`;}
function closeDialog(resume=true){if(watchingReward)return;if(dialogKind==='privacy'&&resume){openDialog('settings');modal.querySelector<HTMLButtonElement>('.privacy-link')?.focus();return;}if(modal.open)modal.close();game?.setOverlayOpen(false);if(resume&&dialogKind==='pause')game?.resume();dialogKind='';dialogPage=0;}
function saveRun(){if(runRecorded||!game)return;recordRun(state,{runId,score:game.score,stacks:game.stacks,height:game.stacks?game.top:0,world:state.selectedWorld,combo:sessionBestCombo});runRecorded=true;persist();renderState();}
function handleAction(action:string,id?:string){
 if(!bootReady||watchingReward||interstitials.busy||selectionUpdatePending)return;
 game?.audio.init();game?.audio.click();
 if(action==='play'||action==='restart'){if(document.body.classList.contains('in-game'))saveRun();start();}
 else if(action==='shop'){shopAdStatus=undefined;openDialog('shop');}
 else if(action==='shop-buy'&&id)void shopBuy(id);
 else if(action==='revive')void attemptRevive();
 else if(action==='page-prev'||action==='page-next')layoutDialog(dialogPage+(action==='page-next'?1:-1));
 else if(action==='home')home();
 else if(['vehicles','worlds','garage','leaderboard','settings','privacy','achievements','howto','pause'].includes(action))openDialog(action);
 else if(action==='close'){if(dialogKind==='result')home();else closeDialog();}
 else if(action==='resume')closeDialog();
 else if(action==='end-home'){saveRun();home();}
 else if(action==='drop'){if(game?.drop()){$('drop-instruction').classList.add('hidden');haptic();}}
 else if(action==='select-vehicle'&&id){pendingVehicle=id;openDialog(dialogKind);}
 else if(action==='select-world'&&id){pendingWorld=id;openDialog('worlds');}
 else if(action==='selection-done'){
   if(dialogKind==='worlds'){
     const choice=WORLDS.find(w=>w.id===pendingWorld)!;
     if(!state.unlockedWorlds.includes(choice.id)&&!unlockWorld(state,choice.id))return;
     state.selectedWorld=choice.id;persist();renderState();closeDialog();
     selectionUpdatePending=true;window.setTimeout(()=>{game?.changeWorld(choice.id as WorldId);selectionUpdatePending=false;},32);return;
   }else{
     const choice=VEHICLES.find(v=>v.id===pendingVehicle)!;
     if(!state.unlocked.includes(choice.id)&&!unlockVehicle(state,choice.id))return;
     state.selectedVehicle=choice.id;persist();renderState();closeDialog();
     selectionUpdatePending=true;window.setTimeout(()=>{game?.setVehicles(choice.id,state.unlocked);selectionUpdatePending=false;},32);return;
   }
   persist();renderState();closeDialog();
 }
 else if(action==='reset-game'){
   if(!window.confirm('Reset the entire game? This clears all coins, purchases, scores, achievements, selected vehicles and places, and settings. This cannot be undone.'))return;
   clearTimeout(toastTimer);clearTimeout(achievementTimer);clearTimeout(feedbackTimer);
   $('toast').classList.remove('visible');$('achievement-toast').classList.remove('visible');
   const saved=resetState(storage,state);interstitials.resetCounter();runRecorded=true;runPreviousBest=0;sessionBestCombo=0;
   game?.configure(state.settings);game?.setVehicles(state.selectedVehicle,state.unlocked);game?.changeWorld(state.selectedWorld as WorldId);
   home(true);toast(saved?'Game reset. A fresh climb awaits.':'Game reset for this session. Device storage is unavailable.');
 }
 else if(action==='toggle'&&(id==='sound'||id==='music'||id==='haptics'||id==='reduceMotion')){state.settings[id]=!state.settings[id];persist();game?.configure(state.settings);openDialog('settings');}
}
app.addEventListener('click',e=>{const el=(e.target as Element).closest<HTMLButtonElement>('[data-action]');if(el)handleAction(el.dataset.action!,el.dataset.id);});
$('scene-panel').addEventListener('pointerdown',e=>{if((e.target as Element).closest('button')||modal.open)return;if(game?.mode==='playing')handleAction('drop');});
modal.addEventListener('click',e=>{if(e.target===modal){const r=modal.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom){if(dialogKind==='result')home();else closeDialog();}}});
modal.addEventListener('cancel',e=>{e.preventDefault();if(dialogKind==='result')home();else closeDialog();});
modal.addEventListener('change',e=>{const el=e.target as HTMLSelectElement;if(el.id==='quality'){state.settings.quality=el.value;persist();game?.configure(state.settings);toast('Graphics preference saved');}});
document.addEventListener('keydown',e=>{
 if(interstitials.busy)return;
 if(e.code==='Space'&&!e.repeat&&!modal.open&&!(e.target instanceof HTMLSelectElement)&&!(e.target instanceof HTMLButtonElement)){e.preventDefault();if(game?.mode==='home')start();else handleAction('drop');}
 if(e.code==='Escape'&&!modal.open&&game?.mode==='playing'){e.preventDefault();openDialog('pause');}
});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&game?.mode==='playing')openDialog('pause');});
renderState();
function bootProgress(value:number,message:string){
 const progress=Math.max(4,Math.min(100,Math.round(value))),bar=$<HTMLElement>('loading-progress'),track=bar.parentElement!;
 bar.style.width=`${progress}%`;track.setAttribute('aria-valuenow',String(progress));$('loading-percent').textContent=`${progress}%`;$('loading-status').textContent=message;
}
// Yield once so the loading screen is visible before initializing WebGL.
requestAnimationFrame(()=>setTimeout(async()=>{
 try{
   game=new StackingGame($('game-canvas'));game.configure(state.settings);game.changeWorld(state.selectedWorld as WorldId);game.setVehicles(state.selectedVehicle,state.unlocked);
   bootProgress(27,'Building the 3D world');
   const audioReady=game.audio.prepare();
   game.onLanding=(r:Landing)=>{
     state.coins+=r.coins;if(r.bonusRuby)state.rubies++;state.totalStacks++;state.best=Math.max(state.best,r.score);state.bestHeight=Math.max(state.bestHeight,r.height);sessionBestCombo=Math.max(sessionBestCombo,r.combo);
     if(r.stacks===1)earn('first');if(r.perfect)earn('perfect');if(r.stacks>=10)earn('ten');if(r.combo>=5)earn('combo');if(r.stacks>=20)earn('twenty');
     if(r.combo>=10)earn('tenCombo');if(r.stacks>=30)earn('thirty');if(r.score>=5000)earn('score5000');if(r.height>=25)earn('height25');if(state.totalStacks>=500)earn('lifetime500');
     if(r.stacks>=10&&!state.worldTen.includes(state.selectedWorld)){state.worldTen.push(state.selectedWorld);if(state.worldTen.length===6)earn('worldTour');}
     persist();
     $('score').textContent=r.score.toLocaleString();$('run-coins').textContent=String(game!.coins);$('ruby-balance').textContent=String(state.rubies);$('game-rubies').textContent=String(state.rubies);$('height').textContent=r.height.toFixed(1);
     $('landing-feedback').innerHTML=r.bonusRuby?`<strong>GOLDEN BONUS!</strong><span>+${r.coins} COINS · +1 DIAMOND</span>`:r.perfect?`<strong>PERFECT.</strong><span>${r.combo>1?`${Math.min(r.combo,5)}× COMBO · `:''}+${r.coins} ${r.coins===1?'COIN':'COINS'}</span>`:`<strong>NICE LANDING.</strong><span>+40 POINTS · +${r.coins} ${r.coins===1?'COIN':'COINS'}</span>`;
     $('landing-feedback').className=`landing-feedback show ${r.perfect?'perfect':''}`;clearTimeout(feedbackTimer);feedbackTimer=window.setTimeout(()=>$('landing-feedback').classList.remove('show'),1200);haptic(r.perfect);
   };
   game.onStability=value=>{$('stability-value').textContent=`${value}%`;$('stability-fill').style.width=`${value}%`;$('stability-fill').classList.toggle('is-danger',value<40);};
   game.onEnd=()=>{
    saveRun();const adDue=revivesUsed===0&&interstitials.recordCompletedGame();
    window.setTimeout(async()=>{
     if(game?.mode!=='ended'||modal.open)return;
     await interstitials.showAtBreak(adDue,()=>game?.mode==='ended'&&!modal.open&&!document.hidden);
     if(game?.mode==='ended'&&!modal.open)openDialog('result');
    },900);
   };
   thumbs=vehicleThumbnails();bootProgress(61,'Polishing vehicles and reflections');
   await Promise.all([audioReady,game.prepareGraphics()]);bootProgress(84,'Rendering your first scene');
   await new Promise<void>(resolve=>{const waitForFrame=()=>game?.sceneFrames?resolve():requestAnimationFrame(waitForFrame);waitForFrame();});
   shop.start();renderState();bootReady=true;$('intro').querySelector<HTMLButtonElement>('.play-button')!.disabled=false;bootProgress(100,'Ready to play');$('loading').classList.add('loading-complete');window.setTimeout(()=>$('loading')?.remove(),420);
   if(Capacitor.isNativePlatform()){
     void App.addListener('backButton',()=>{if(interstitials.busy)return;if(modal.open){if(dialogKind==='result')home();else closeDialog();}else if(game?.mode==='playing')openDialog('pause');else if(game?.mode==='ended')home();else void App.exitApp();});
     void App.addListener('appStateChange',({isActive})=>{if(!isActive){if(game?.mode==='playing')openDialog('pause');void game?.audio.context?.suspend();}game?.setAppActive(isActive);});
   }
   interstitials.preload();showHomeAd();
   // Expose only a read-only diagnostic snapshot for smoke tests and performance inspection.
   Object.defineProperty(window,'stackline',{value:{snapshot:()=>({ads:interstitials.snapshot,mode:game?.mode,score:game?.score,stacks:game?.stacks,height:game?.top,heldX:game?.held?.position.x,held:!!game?.held,falling:!!game?.falling,sceneVehicles:game?.vehicleCount,vehicleTypes:game?.vehicleTypes,damage:game?.damageSnapshot,glassChips:game?.glassChipCount,topX:game?.items.at(-1)?.body.position.x,stability:game?.stability,groundContact:game?.groundContact,drawCalls:game?.renderer.info.render.calls,triangles:game?.renderer.info.render.triangles,renderFrames:game?.renderFrames,renderPending:game?.renderPending,renderBudget:game?.renderBudget,pixelRatio:game?.renderer.getPixelRatio(),shadows:game?.renderer.shadowMap.enabled,shadowSize:game?.scenery.sun.shadow.mapSize.x,pointLights:game?.scenery.localLights.filter(light=>light.visible).length,adaptiveQualityReduced:game?.adaptiveQualityReduced,vehicle:state.selectedVehicle,world:state.selectedWorld,coins:state.coins,quality:state.settings.quality,musicEnabled:game?.audio.musicEnabled,musicPlaying:game?.audio.musicPlaying,musicLevel:game?.audio.musicLevel,crashPlays:game?.audio.crashPlays,musicReady:game?.audio.musicReady,musicStartDelayMs:game?.audio.musicStartDelayMs,audioState:game?.audio.context?.state,unlocked:[...state.unlocked],unlockedWorlds:[...state.unlockedWorlds],effectsLevel:game?.audio.effectsLevel,lastImpactSpeed:game?.lastImpactSpeed,fps:game?.averageFps,cameraY:game?.camera.position.y,storageKey:'stackline.progress.v1'})},writable:false});
 }catch(error){console.error(error);$('loading').innerHTML=`<div class="webgl-error">${icon('info')}<h3>Your graphics engine needs a hand.</h3><p>Enable WebGL or hardware acceleration in your browser, then reload to play.</p><button class="primary-button" id="reload">Try again</button></div>`;document.getElementById('reload')?.addEventListener('click',()=>location.reload());}
},0));
