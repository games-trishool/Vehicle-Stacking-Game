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
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { StackingGame,type Landing } from './game';
import { icon } from './icons';
import { VEHICLES,WORLDS,ACHIEVEMENTS,loadState,saveState,unlockVehicle,recordRun } from './store.mjs';
import { vehicleThumbnails,worldArt } from './thumbnails';
import type { WorldId } from './scenery';

let storage:Storage;
try{storage=window.localStorage;}catch{storage={getItem:()=>null,setItem:()=>{throw new Error("Storage unavailable");},removeItem:()=>{},clear:()=>{},key:()=>null,length:0};}
const state=loadState(storage);let game:StackingGame|undefined,thumbs:Record<string,string>={},dialogKind='',dialogPage=0,runPreviousBest=state.best,sessionBestCombo=0,runRecorded=false,persistWarned=false;
const app=document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML=`
 <div class="home-shell" id="home-shell">
  <header class="header">
    <button class="brand" data-action="home" aria-label="Stack Vechiles home"><span class="brand-mark"><img src="/icons/icon-192.png" alt="" /></span><span class="brand-name">Stack <span>Vechiles</span></span></button>
    <nav class="navigation" aria-label="Main navigation"><button class="nav-link active" data-action="home">The game</button><button class="nav-link" data-action="worlds">Explore worlds</button><button class="nav-link" data-action="garage">Garage</button><button class="nav-link" data-action="leaderboard">Leaderboard</button></nav>
    <div class="header-actions"><button class="coin-balance" data-action="garage" aria-label="Coins and garage">${icon('coin')}<span id="coin-balance">${state.coins}</span></button><span class="header-divider"></span><button class="icon-button header-help" data-action="howto" aria-label="How to play">${icon('info')}</button><button class="icon-button" data-action="settings" aria-label="Settings">${icon('settings')}</button></div>
  </header>
  <main class="home-main">
    <div class="hero" id="hero">
      <section class="intro" id="intro">
        <div class="home-actions">
        <button class="play-button" data-action="play" aria-label="Let’s play">${icon('play')}<span>Let’s play</span><span class="key-hint">SPACE</span>${icon('arrow')}</button>
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
        <div class="loading" id="loading"><span class="spinner"></span>Finding our balance…</div>
        <div class="game-hud" id="game-hud" hidden>
          <div class="hud-top"><button class="hud-button" data-action="pause" aria-label="Pause game">${icon('pause')}</button><div class="hud-score"><small>SCORE</small><strong id="score">0</strong></div><div class="hud-coins">${icon('coin')}<span id="run-coins">0</span></div></div>
          <div class="hud-height"><span id="height">0.0</span><small>METERS UP</small></div>
          <div class="landing-feedback" id="landing-feedback" aria-live="polite"></div>
          <div class="stability"><div><span>TOWER BALANCE</span><span id="stability-value">100%</span></div><div class="stability-track"><i id="stability-fill"></i></div></div>
          <div class="drop-instruction" id="drop-instruction"><span class="tap-ring"></span><strong>Tap to drop</strong><small>or press space · aim for the center</small></div>
          <button class="drop-button" data-action="drop">${icon('down')} DROP VEHICLE <span>SPACE</span></button>
        </div>
      </section>
    </div>
    <section class="progress-section" id="progress-section" aria-label="Your progress">
      <div class="progress-heading"><span>EVERY CLIMB COUNTS.</span><span>Your journey, so far ${icon('arrow')}</span></div>
      <div class="progress-cards">
        <button class="progress-card record-card" data-action="leaderboard"><span class="card-icon">${icon('trophy')}</span><div><small>PERSONAL BEST</small><strong id="best-score">0<span> pts</span></strong><p>There’s always a little higher.</p></div><span class="card-arrow">${icon('arrow')}</span></button>
        <button class="progress-card" data-action="achievements" aria-label="Achievements"><span class="card-icon">${icon('flag')}</span><div><small>ACHIEVEMENTS</small><strong id="achievement-count">0 <span>/ 6</span></strong><p>Your next milestone is waiting.</p></div><span class="card-arrow">${icon('arrow')}</span></button>
        <button class="progress-card garage-card" data-action="garage" aria-label="Garage"><div class="garage-preview" id="garage-preview"></div><div><small>GARAGE</small><strong id="next-vehicle">Sport GT</strong><p id="unlock-progress">120 / 150 coins</p><div class="unlock-track"><i id="unlock-fill"></i></div></div><span class="card-arrow">${icon('arrow')}</span></button>
      </div>
    </section>
    <footer class="footer"><span class="footer-brand">Stack Vechiles <span>Built for the climb.</span></span><span>A moment of focus. A world of fun.</span><button data-action="howto">How to play ${icon('info')}</button></footer>
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
function renderState(){
 const v=VEHICLES.find(v=>v.id===state.selectedVehicle)!,w=WORLDS.find(w=>w.id===state.selectedWorld)!;
 $('coin-balance').textContent=String(state.coins);$('selected-vehicle-name').textContent=v.name;$('selected-world-name').textContent=w.name;
 if(thumbs[v.id])$('selection-vehicle-image').innerHTML=`<img src="${thumbs[v.id]}" alt="" />`;
 $('selection-world-image').innerHTML=worldArt(w.id);
 $('best-score').innerHTML=`${state.best.toLocaleString()}<span> pts</span>`;$('achievement-count').innerHTML=`${state.achievements.length} <span>/ ${ACHIEVEMENTS.length}</span>`;
 const next=VEHICLES.find(v=>!state.unlocked.includes(v.id));$('next-vehicle').textContent=next?.name||'Collection complete';$('unlock-progress').textContent=next?`${state.coins} / ${next.cost} coins`:'Every road is yours.';
 $('unlock-fill').style.width=next?`${Math.min(100,state.coins/next.cost*100)}%`:'100%';
 if(thumbs[next?.id||'sports'])$('garage-preview').innerHTML=`<img src="${thumbs[next?.id||'sports']}" alt="" />`;
 const copy=worldNames[w.id];$('scene-kicker').textContent=copy[0];$('scene-world-title').textContent=copy[1];$('scene-world-copy').textContent=copy[2];$('scene-weather').innerHTML=`${icon(w.id==='forest'||w.id==='desert'||w.id==='beach'?'sun':'mountain')} ${w.tag}`;
}
function earn(id:string){if(state.achievements.includes(id))return;state.achievements.push(id);const a=ACHIEVEMENTS.find(a=>a.id===id)!;
 $('achievement-toast').innerHTML=`<span>${icon(a.icon)}</span><div><small>ACHIEVEMENT UNLOCKED</small><strong>${a.name}</strong></div>`;$('achievement-toast').classList.add('visible');clearTimeout(achievementTimer);achievementTimer=window.setTimeout(()=>$('achievement-toast').classList.remove('visible'),4200);persist();
}
function haptic(perfect=false){if(state.settings.haptics&&navigator.vibrate)navigator.vibrate(perfect?[18,30,18]:15);}
function start(){
 if(!game)return;closeDialog(false);document.body.classList.add('in-game');$('game-hud').hidden=false;
 $('score').textContent='0';$('run-coins').textContent='0';$('height').textContent='0.0';$('landing-feedback').classList.remove('show');$('drop-instruction').classList.remove('hidden');$('stability-value').textContent='100%';$('stability-fill').style.width='100%';
 runPreviousBest=state.best;sessionBestCombo=0;runRecorded=false;game.start();game.resize();
}
function home(){closeDialog(false);document.body.classList.remove('in-game');$('game-hud').hidden=true;game?.showHome();game?.resize();renderState();}
function modalHeader(eyebrow:string,title:string,copy:string){return `<div class="modal-heading"><div><span class="eyebrow">${eyebrow}</span><h2>${title}</h2><p>${copy}</p></div><button class="icon-button close-modal" data-action="close" aria-label="Close dialog">${icon('close')}</button></div>`;}
function openDialog(kind:string){
 game?.setOverlayOpen(true);
 const page=kind===dialogKind?dialogPage:0;
 const scrollTop=kind===dialogKind?($('modal-content').querySelector('.selection-scroll')?.scrollTop||0):0;
 dialogKind=kind;let content='';
 if(kind==='vehicles'||kind==='garage'){
   const isGarage=kind==='garage';content=modalHeader(isGarage?'GOOD THINGS COME WITH WHEELS':'YOUR TOWER. YOUR WAY.',isGarage?'The garage.':'Pick your ride.',isGarage?'Earn coins with every landing. Find your next favorite.':'Stick with a favorite, or keep the climb surprising.');
   content+=`<div class="modal-meta"><span>${state.unlocked.length-1} / 6 vehicles unlocked</span><span class="coin-balance">${icon('coin')} ${state.coins} coins</span></div><div class="vehicle-grid">`;
   for(const v of VEHICLES){const owned=state.unlocked.includes(v.id),selected=state.selectedVehicle===v.id;content+=`<button class="vehicle-card ${selected?'selected':''} ${!owned?'locked':''} ${v.id==='mixed'?'mixed-card':''}" data-action="select-vehicle" data-id="${v.id}" aria-pressed="${selected}"><div class="vehicle-card-top"><span>${v.label}</span>${selected?`<span class="selected-check">${icon('check')}</span>`:!owned?icon('lock'):''}</div><div class="vehicle-render">${v.id==='mixed'?'<span class="mixed-spark spark-one">✦</span><span class="mixed-spark spark-two">✦</span>':''}<img src="${thumbs[v.id]||''}" alt="${v.name} 3D model" /></div><div class="vehicle-details"><h3>${v.name}</h3><p>${v.subtitle}</p><span class="vehicle-status">${selected?'SELECTED':owned?'READY TO STACK':`${icon('coin')} ${v.cost} · UNLOCK`}</span></div></button>`;}
   content+='</div><p class="modal-footnote">Swipe up to explore every vehicle. Mixed mode chooses from your unlocked vehicles. Your choice is saved automatically.</p>';
 }
 if(kind==='worlds'){
   content=modalHeader('A CHANGE OF SCENERY','Find your happy place.','Six worlds to get lost in. One tower to get right.');content+='<div class="world-grid">';
   for(const w of WORLDS){const selected=state.selectedWorld===w.id;content+=`<button class="world-card ${selected?'selected':''}" data-action="select-world" data-id="${w.id}" aria-pressed="${selected}"><div class="world-art">${worldArt(w.id)}<span>${w.tag}</span>${selected?`<i>${icon('check')}</i>`:''}</div><div><h3>${w.name}</h3><p>${w.subtitle}</p></div></button>`;}content+='</div><p class="modal-footnote">Swipe up to explore all six places. Your selected background is saved for your next climb.</p>';
 }
 if(kind==='settings'){
   content=modalHeader('MAKE YOURSELF AT HOME','Your kind of play.','The little things that make every climb feel right.');
   content+=`<div class="settings-list">${settingToggle('music','Background music','An upbeat arcade soundtrack for every climb.','music')}${settingToggle('sound','Sound effects','A satisfying sound for every landing.','sound')}${settingToggle('haptics','Touch feedback','Feel your timing with gentle vibrations.','target')}${settingToggle('reduceMotion','Reduce motion','Turn off camera shake and slow motion.','layers')}<div class="setting-row"><span class="setting-icon">${icon('sun')}</span><div><strong>Graphics quality</strong><p>Auto adapts to your device. Battery saver reduces shadows.</p></div><select id="quality" aria-label="Graphics quality"><option value="auto" ${state.settings.quality==='auto'?'selected':''}>Auto</option><option value="high" ${state.settings.quality==='high'?'selected':''}>High</option><option value="low" ${state.settings.quality==='low'?'selected':''}>Battery saver</option></select></div></div><div class="settings-note">${icon('info')} Progress is saved on this device. No account needed.</div>`;
 }
 if(kind==='leaderboard'){
   content=modalHeader('A LITTLE FRIENDLY COMPETITION','Your best climbs.','Every personal best starts with one good drop.');
   content+=`<div class="leaderboard-summary"><div><small>BEST SCORE</small><strong>${state.best.toLocaleString()}</strong></div><div><small>HIGHEST TOWER</small><strong>${state.bestHeight.toFixed(1)}<span> m</span></strong></div><div><small>TOTAL STACKED</small><strong>${state.totalStacks}</strong></div></div><div class="table-label"><span>ON THIS DEVICE</span><span>Top ${Math.min(state.runs.length,10)} runs</span></div>`;
   if(!state.runs.length)content+=`<div class="empty-state">${icon('trophy')}<h3>Your name belongs up here.</h3><p>Play your first run to start your personal leaderboard.</p><button class="primary-button" data-action="play">Let’s play ${icon('arrow')}</button></div>`;
   else content+=`<div class="ranking-table"><div class="ranking-heading"><span>RANK / WORLD</span><span>STACKS</span><span>SCORE</span></div>${state.runs.slice(0,10).map((r,i)=>`<div class="ranking-row"><span><b>${String(i+1).padStart(2,'0')}</b><span><strong>${WORLDS.find(w=>w.id===r.world)?.name||'Forest'}</strong><small>${new Date(r.date).toLocaleDateString(undefined,{month:'short',day:'numeric'})} · ${r.height.toFixed(1)} m</small></span></span><span>${r.stacks}</span><strong>${r.score.toLocaleString()}</strong></div>`).join('')}</div>`;
   content+='<p class="modal-footnote">Personal rankings are stored locally. Online rankings are not connected.</p>';
 }
 if(kind==='achievements'){
   content=modalHeader('CELEBRATE THE LITTLE THINGS','Milestones worth the climb.',`${state.achievements.length} of ${ACHIEVEMENTS.length} achievements discovered.`);content+='<div class="achievements-grid">';
   for(const a of ACHIEVEMENTS){const earned=state.achievements.includes(a.id);content+=`<div class="achievement-card ${earned?'earned':''}"><span class="achievement-icon">${icon(a.icon)}</span><div><h3>${a.name}</h3><p>${a.description}</p><small>${earned?'UNLOCKED':'KEEP CLIMBING'}</small></div>${earned?icon('check'):icon('lock')}</div>`;}content+='</div>';
 }
 if(kind==='howto')content=modalHeader('SIMPLE TO LEARN. SATISFYING TO MASTER.','Find your rhythm.','The best towers are built one moment at a time.')+`<div class="howto-steps"><div><b>01</b><h3>Watch the ride.</h3><p>Your next vehicle moves above the tower. Wait until it lines up with the vehicle below.</p></div><div><b>02</b><h3>Make the drop.</h3><p>Tap the scene, use the Drop button, or press Space. Gravity takes it from there.</p></div><div><b>03</b><h3>Keep your balance.</h3><p>Land near the center for a perfect drop. Chain perfects for up to 5× points and extra coins. An off-center tower can topple.</p></div></div><button class="primary-button wide" data-action="play">Ready when you are ${icon('arrow')}</button>`;
 if(kind==='pause'){
   game?.pause();content=modalHeader('TAKE A BREATH','The view can wait.','Your tower will be right here when you’re ready.')+`<div class="pause-actions"><button class="primary-button wide" data-action="resume">${icon('play')} Keep climbing</button><button class="secondary-button wide" data-action="restart">${icon('refresh')} Start a new run</button><button class="text-button home-button" data-action="end-home">${icon('home')} Back to home</button></div>`;
 }
 if(kind==='result')content=resultContent();
 $('modal-content').innerHTML=content;modal.className=`modal ${kind==='pause'||kind==='result'?'compact-modal':''}`;modal.dataset.screen=kind;layoutDialog(page);if(!modal.open)modal.showModal();
 const list=$('modal-content').querySelector('.selection-scroll');if(list)list.scrollTop=scrollTop;
}
function layoutDialog(page=0){
 const focusAction=(document.activeElement as HTMLElement|null)?.dataset.action;
 const content=$('modal-content');content.querySelector('.dialog-pager')?.remove();
 const grid=content.querySelector<HTMLElement>('.vehicle-grid,.world-grid,.achievements-grid,.ranking-table');
 if(!grid)return;
 const cards=Array.from(grid.querySelectorAll<HTMLElement>('.vehicle-card,.world-card,.achievement-card,.ranking-row'));
 if(grid.matches('.vehicle-grid,.world-grid')){
   grid.classList.add('selection-scroll');grid.style.removeProperty('grid-template-rows');
   grid.tabIndex=0;grid.setAttribute('role','region');grid.setAttribute('aria-label',grid.classList.contains('vehicle-grid')?'Vehicles':'Places');
   cards.forEach(card=>card.hidden=false);return;
 }
 const short=innerHeight<650,columns=innerWidth<=760?2:3;
 const achievements=grid.classList.contains('achievements-grid'),ranking=grid.classList.contains('ranking-table');
 const count=ranking?(short?2:5):achievements?(short?2:innerWidth<=760?3:6):columns*(short?1:2);
 const pages=Math.max(1,Math.ceil(cards.length/count));dialogPage=Math.max(0,Math.min(page,pages-1));
 cards.forEach((card,index)=>card.hidden=index<dialogPage*count||index>=(dialogPage+1)*count);
 if(!ranking){
   const cols=achievements?(innerWidth<=760?1:2):columns;
   grid.style.gridTemplateRows=`repeat(${Math.max(1,Math.ceil(Math.min(count,cards.length-dialogPage*count)/cols))},minmax(0,1fr))`;
 }
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
function resultContent(){const isBest=game&&game.score>0&&game.score>runPreviousBest;return modalHeader(isBest?'A NEW PERSONAL BEST':'EVERY DROP IS A NEW BEGINNING',isBest?'That’s a new high.':'What a climb.',isBest?'Take a moment. You’ve earned the view.':'A little higher next time? You’ve got this.')+`<div class="result-trophy">${icon(isBest?'trophy':'layers')}</div><div class="result-score"><small>YOUR SCORE</small><strong>${game?.score.toLocaleString()||0}</strong></div><div class="result-stats"><div><strong>${game?.stacks||0}</strong><span>VEHICLES</span></div><div><strong>${(game?.top||0).toFixed(1)} m</strong><span>HEIGHT</span></div><div><strong>+${game?.coins||0}</strong><span>COINS EARNED</span></div></div><div class="result-actions"><button class="primary-button wide" data-action="play">${icon('refresh')} One more climb ${icon('arrow')}</button><button class="text-button home-button" data-action="home">${icon('home')} Back to home</button></div>`;}
function closeDialog(resume=true){if(modal.open)modal.close();game?.setOverlayOpen(false);if(resume&&dialogKind==='pause')game?.resume();dialogKind='';dialogPage=0;}
function saveRun(){if(runRecorded||!game)return;recordRun(state,{score:game.score,stacks:game.stacks,height:game.stacks?game.top:0,world:state.selectedWorld,combo:sessionBestCombo});runRecorded=true;persist();renderState();}
function handleAction(action:string,id?:string){
 game?.audio.init();game?.audio.click();
 if(action==='play'||action==='restart'){if(document.body.classList.contains('in-game'))saveRun();start();}
 else if(action==='page-prev'||action==='page-next')layoutDialog(dialogPage+(action==='page-next'?1:-1));
 else if(action==='home')home();
 else if(['vehicles','worlds','garage','leaderboard','settings','achievements','howto','pause'].includes(action))openDialog(action);
 else if(action==='close'){if(dialogKind==='result')home();else closeDialog();}
 else if(action==='resume')closeDialog();
 else if(action==='end-home'){saveRun();home();}
 else if(action==='drop'){if(game?.drop()){$('drop-instruction').classList.add('hidden');haptic();}}
 else if(action==='select-vehicle'&&id){
   if(!state.unlocked.includes(id)){
     const v=VEHICLES.find(v=>v.id===id)!;
     if(!unlockVehicle(state,id)){toast(`Just ${v.cost-state.coins} more coins to unlock ${v.name}. Keep climbing!`);return;}
     toast(`${v.name} unlocked. Your next adventure starts here.`);
   }
   state.selectedVehicle=id;persist();game?.setVehicles(id,state.unlocked);renderState();openDialog(dialogKind);toast(`${VEHICLES.find(v=>v.id===id)!.name} selected`);
 }
 else if(action==='select-world'&&id){state.selectedWorld=id;persist();game?.changeWorld(id as WorldId);renderState();openDialog('worlds');toast(`${WORLDS.find(w=>w.id===id)!.name} selected`);}
 else if(action==='toggle'&&(id==='sound'||id==='music'||id==='haptics'||id==='reduceMotion')){state.settings[id]=!state.settings[id];persist();game?.configure(state.settings);openDialog('settings');}
}
app.addEventListener('click',e=>{const el=(e.target as Element).closest<HTMLButtonElement>('[data-action]');if(el)handleAction(el.dataset.action!,el.dataset.id);});
$('scene-panel').addEventListener('pointerdown',e=>{if((e.target as Element).closest('button')||modal.open)return;if(game?.mode==='playing')handleAction('drop');});
modal.addEventListener('click',e=>{if(e.target===modal){const r=modal.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom){if(dialogKind==='result')home();else closeDialog();}}});
modal.addEventListener('cancel',e=>{e.preventDefault();if(dialogKind==='result')home();else closeDialog();});
modal.addEventListener('change',e=>{const el=e.target as HTMLSelectElement;if(el.id==='quality'){state.settings.quality=el.value;persist();game?.configure(state.settings);toast('Graphics preference saved');}});
document.addEventListener('keydown',e=>{
 if(e.code==='Space'&&!e.repeat&&!modal.open&&!(e.target instanceof HTMLSelectElement)&&!(e.target instanceof HTMLButtonElement)){e.preventDefault();if(game?.mode==='home')start();else handleAction('drop');}
 if(e.code==='Escape'&&!modal.open&&game?.mode==='playing'){e.preventDefault();openDialog('pause');}
});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&game?.mode==='playing')openDialog('pause');});
renderState();
// Yield once so the loading screen is visible before initializing WebGL.
requestAnimationFrame(()=>setTimeout(()=>{
 try{
   game=new StackingGame($('game-canvas'));game.configure(state.settings);game.changeWorld(state.selectedWorld as WorldId);game.setVehicles(state.selectedVehicle,state.unlocked);
   game.onLanding=(r:Landing)=>{
     state.coins+=r.coins;state.totalStacks++;state.best=Math.max(state.best,r.score);state.bestHeight=Math.max(state.bestHeight,r.height);sessionBestCombo=Math.max(sessionBestCombo,r.combo);if(r.stacks===1)earn('first');if(r.perfect)earn('perfect');if(r.stacks>=10)earn('ten');if(r.combo>=5)earn('combo');if(r.stacks>=20)earn('twenty');persist();
     $('score').textContent=r.score.toLocaleString();$('run-coins').textContent=String(game!.coins);$('height').textContent=r.height.toFixed(1);
     $('landing-feedback').innerHTML=r.perfect?`<strong>PERFECT.</strong><span>${r.combo>1?`${Math.min(r.combo,5)}× COMBO · `:''}+${r.coins} COINS</span>`:`<strong>NICE LANDING.</strong><span>+40 POINTS · +${r.coins} COINS</span>`;
     $('landing-feedback').className=`landing-feedback show ${r.perfect?'perfect':''}`;clearTimeout(feedbackTimer);feedbackTimer=window.setTimeout(()=>$('landing-feedback').classList.remove('show'),1200);haptic(r.perfect);
   };
   game.onStability=value=>{$('stability-value').textContent=`${value}%`;$('stability-fill').style.width=`${value}%`;$('stability-fill').style.background=value<40?'#d9a36a':'#dbea9f';};
   game.onEnd=()=>{saveRun();window.setTimeout(()=>{if(game?.mode==='ended')openDialog('result');},900);};
   $('loading').remove();thumbs=vehicleThumbnails();renderState();
   if(Capacitor.isNativePlatform()){
     void App.addListener('backButton',()=>{if(modal.open){if(dialogKind==='result')home();else closeDialog();}else if(game?.mode==='playing')openDialog('pause');else if(game?.mode==='ended')home();else void App.exitApp();});
     void App.addListener('appStateChange',({isActive})=>{if(!isActive){if(game?.mode==='playing')openDialog('pause');void game?.audio.context?.suspend();}game?.setAppActive(isActive);});
   }
   // Expose only a read-only diagnostic snapshot for smoke tests and performance inspection.
   Object.defineProperty(window,'stackline',{value:{snapshot:()=>({mode:game?.mode,score:game?.score,stacks:game?.stacks,height:game?.top,heldX:game?.held?.position.x,held:!!game?.held,falling:!!game?.falling,sceneVehicles:game?.vehicleCount,topX:game?.items.at(-1)?.body.position.x,stability:game?.stability,groundContact:game?.groundContact,drawCalls:game?.renderer.info.render.calls,triangles:game?.renderer.info.render.triangles,renderFrames:game?.renderFrames,renderPending:game?.renderPending,renderBudget:game?.renderBudget,pixelRatio:game?.renderer.getPixelRatio(),shadows:game?.renderer.shadowMap.enabled,shadowSize:game?.scenery.sun.shadow.mapSize.x,pointLights:game?.scenery.localLights.filter(light=>light.visible).length,adaptiveQualityReduced:game?.adaptiveQualityReduced,vehicle:state.selectedVehicle,world:state.selectedWorld,coins:state.coins,quality:state.settings.quality,musicEnabled:game?.audio.musicEnabled,musicPlaying:game?.audio.musicPlaying,musicLevel:game?.audio.musicLevel,fps:game?.averageFps,cameraY:game?.camera.position.y,storageKey:'stackline.progress.v1'})},writable:false});
 }catch(error){console.error(error);$('loading').innerHTML=`<div class="webgl-error">${icon('info')}<h3>Your graphics engine needs a hand.</h3><p>Enable WebGL or hardware acceleration in your browser, then reload to play.</p><button class="primary-button" id="reload">Try again</button></div>`;document.getElementById('reload')?.addEventListener('click',()=>location.reload());}
},0));
