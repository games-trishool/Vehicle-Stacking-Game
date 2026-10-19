import { createCrashSamples } from './impacts.mjs';
export class GameAudio {
  context?:AudioContext; master?:GainNode; enabled=true;musicEnabled=true;
  crashPlays=0;private crashBuffers:AudioBuffer[]=[];private effectsAnalyser?:AnalyserNode;private effectsSamples=new Float32Array(512);
  private musicGain?:GainNode;private musicAnalyser?:AnalyserNode;private musicSamples=new Float32Array(256);
  private musicSource?:AudioBufferSourceNode;private musicVoice?:GainNode;
  private musicBuffer?:AudioBuffer;private preparing?:Promise<void>;musicStartDelayMs=0;
  private musicRequested=false;private musicOffset=0;private musicStartedAt=0;private musicGeneration=0;
  private ensureContext(){
    try{
      if(!this.context){
        this.context=new AudioContext();this.master=this.context.createGain();this.master.gain.value=this.enabled?.24:0;this.effectsAnalyser=this.context.createAnalyser();this.effectsAnalyser.fftSize=512;this.master.connect(this.effectsAnalyser);this.effectsAnalyser.connect(this.context.destination);
        this.musicGain=this.context.createGain();this.musicGain.gain.value=.9;
        this.musicAnalyser=this.context.createAnalyser();this.musicAnalyser.fftSize=256;
        this.musicGain.connect(this.musicAnalyser);this.musicAnalyser.connect(this.context.destination);
      }
      this.prepareCrashBuffers();
    }catch{/* Audio is optional on devices without an audio context. */}
  }
  prepare(){
    if(this.preparing)return this.preparing;
    this.ensureContext();
    this.preparing=(async()=>{
      if(!this.context)return;
      const response=await fetch('/audio/arcade-loop.ogg');
      if(!response.ok)throw new Error('Soundtrack could not be loaded');
      this.musicBuffer=await this.context.decodeAudioData(await response.arrayBuffer());
    })().catch(()=>{this.preparing=undefined;});
    return this.preparing;
  }
  get musicReady(){return !!this.musicBuffer;}
  init(){
    if(!this.enabled&&!this.musicEnabled)return;
    this.ensureContext();
    // Buffer sources may be scheduled while suspended; resume unlocks them on the first tap.
    void this.context?.resume().catch(()=>{});
  }
  setEnabled(value:boolean){this.enabled=value;if(this.master)this.master.gain.value=value?.24:0;}
  setMusicEnabled(value:boolean){
    if(this.musicEnabled===value)return;
    this.musicEnabled=value;
    if(!value)this.stopMusicVoice();else if(this.musicRequested)this.startMusic();
  }
  get effectsLevel(){
    if(!this.effectsAnalyser||this.context?.state!=='running')return 0;
    this.effectsAnalyser.getFloatTimeDomainData(this.effectsSamples);
    return Math.sqrt(this.effectsSamples.reduce((sum,sample)=>sum+sample*sample,0)/this.effectsSamples.length);
  }
  crash(strength:number){
    if(!this.enabled)return;
    this.init();
    if(!this.context||!this.master)return;
    this.prepareCrashBuffers();
    const t=this.context.currentTime,source=this.context.createBufferSource(),gain=this.context.createGain();
    source.buffer=this.crashBuffers[this.crashPlays%3];source.playbackRate.value=1.12-Math.max(0,Math.min(1,strength))*.28;
    gain.gain.value=.8+Math.max(0,Math.min(1,strength))*2.5;
    source.connect(gain);gain.connect(this.master);source.start(t);this.crashPlays++;
    source.onended=()=>{source.disconnect();gain.disconnect();};
    // Briefly leave room for the impact without lowering the saved music volume.
    if(this.musicPlaying&&this.musicGain){
      const volume=this.musicGain.gain;volume.cancelScheduledValues(t);volume.setValueAtTime(volume.value,t);
      volume.linearRampToValueAtTime(.38,t+.012);volume.setValueAtTime(.38,t+.075);volume.linearRampToValueAtTime(.9,t+.30);
    }
  }
  private prepareCrashBuffers(){
    if(!this.context)return;
    if(!this.crashBuffers.length)for(let variant=0;variant<3;variant++){
      const samples=createCrashSamples(this.context.sampleRate,variant),buffer=this.context.createBuffer(1,samples.length,this.context.sampleRate);
      buffer.copyToChannel(samples,0);this.crashBuffers.push(buffer);
    }
  }
  get musicPlaying(){return !!this.musicSource&&this.context?.state==='running';}
  get musicLevel(){
    if(!this.musicAnalyser||this.context?.state!=='running')return 0;
    this.musicAnalyser.getFloatTimeDomainData(this.musicSamples);
    return Math.sqrt(this.musicSamples.reduce((sum,sample)=>sum+sample*sample,0)/this.musicSamples.length);
  }
  startMusic(restart=false){
    if(restart)this.stopMusic();
    const requestedAt=performance.now();this.musicRequested=true;this.init();
    if(!this.musicEnabled||!this.context||this.musicSource)return;
    const generation=++this.musicGeneration;
    const play=()=>{
      if(generation!==this.musicGeneration||!this.musicRequested||!this.musicEnabled||!this.context||!this.musicGain||!this.musicBuffer)return;
      const buffer=this.musicBuffer,source=this.context.createBufferSource(),voice=this.context.createGain(),time=this.context.currentTime;
      source.buffer=buffer;source.loop=true;source.connect(voice);voice.connect(this.musicGain);
      voice.gain.setValueAtTime(1,time);source.start(time,this.musicOffset%buffer.duration);
      this.musicStartDelayMs=performance.now()-requestedAt;this.musicStartedAt=time-this.musicOffset;
      this.musicSource=source;this.musicVoice=voice;
      source.onended=()=>{source.disconnect();voice.disconnect();};
    };
    if(this.musicBuffer)play();else void this.prepare().then(play);
  }

  pauseMusic(){this.musicRequested=false;this.stopMusicVoice();}
  stopMusic(){this.pauseMusic();this.musicOffset=0;}
  private stopMusicVoice(){
    this.musicGeneration++;
    if(this.musicSource&&this.musicVoice&&this.context){
      const time=this.context.currentTime;
      this.musicOffset=(time-this.musicStartedAt)%(this.musicBuffer?.duration||1);
      const volume=this.musicVoice.gain.value;
      this.musicVoice.gain.cancelScheduledValues(time);this.musicVoice.gain.setValueAtTime(volume,time);
      this.musicVoice.gain.linearRampToValueAtTime(0,time+.12);this.musicSource.stop(time+.13);
    }
    this.musicSource=undefined;this.musicVoice=undefined;
  }

  dispose(){this.stopMusic();void this.context?.close().catch(()=>{});this.musicBuffer=undefined;this.crashBuffers=[];}
  tone(frequency:number,duration:number,delay=0,type:OscillatorType='sine',volume=.6){if(!this.enabled||!this.context||!this.master)return;const t=this.context.currentTime+delay,o=this.context.createOscillator(),g=this.context.createGain();o.type=type;o.frequency.setValueAtTime(frequency,t);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(volume,t+.008);g.gain.exponentialRampToValueAtTime(.001,t+duration);o.connect(g);g.connect(this.master);o.start(t);o.stop(t+duration+.02);o.onended=()=>{o.disconnect();g.disconnect();};}
  drop(){this.tone(150,.1,0,'triangle',.25);}
  landing(perfect:boolean,combo:number){
    if(perfect){[440,554.37,659.25,880].forEach((f,i)=>this.tone(f*(1+Math.min(combo,5)*.025),.3,i*.055,'sine',.3));}
    else{this.tone(72,.23,0,'triangle',.9);this.tone(140,.1,0,'sine',.4);}
  }
  fail(){[220,174,130].forEach((f,i)=>this.tone(f,.3,i*.11,'triangle',.4));}
  click(){this.tone(650,.065,0,'sine',.2);}
}
