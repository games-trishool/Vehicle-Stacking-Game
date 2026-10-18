export class GameAudio {
  context?:AudioContext; master?:GainNode; enabled=true;
  init(){
    if(!this.enabled)return;
    try{if(!this.context){this.context=new AudioContext();this.master=this.context.createGain();this.master.gain.value=.24;this.master.connect(this.context.destination);}void this.context.resume().catch(()=>{});}catch{/* Audio is optional on devices without an audio context. */}
  }
  setEnabled(value:boolean){this.enabled=value;if(this.master)this.master.gain.value=value?.24:0;}
  tone(frequency:number,duration:number,delay=0,type:OscillatorType='sine',volume=.6){if(!this.enabled||!this.context||!this.master)return;const t=this.context.currentTime+delay,o=this.context.createOscillator(),g=this.context.createGain();o.type=type;o.frequency.setValueAtTime(frequency,t);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(volume,t+.008);g.gain.exponentialRampToValueAtTime(.001,t+duration);o.connect(g);g.connect(this.master);o.start(t);o.stop(t+duration+.02);o.onended=()=>{o.disconnect();g.disconnect();};}
  drop(){this.tone(150,.1,0,'triangle',.25);}
  landing(perfect:boolean,combo:number){
    if(perfect){[440,554.37,659.25,880].forEach((f,i)=>this.tone(f*(1+Math.min(combo,5)*.025),.3,i*.055,'sine',.3));}
    else{this.tone(72,.23,0,'triangle',.9);this.tone(140,.1,0,'sine',.4);}
  }
  fail(){[220,174,130].forEach((f,i)=>this.tone(f,.3,i*.11,'triangle',.4));}
  click(){this.tone(650,.065,0,'sine',.2);}
}
