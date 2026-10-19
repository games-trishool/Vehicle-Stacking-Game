import { createCrashSamples } from './impacts.mjs';
export class GameAudio {
  context?:AudioContext; master?:GainNode; enabled=true;musicEnabled=true;
  crashPlays=0;private crashBuffers:AudioBuffer[]=[];private effectsAnalyser?:AnalyserNode;private effectsSamples=new Float32Array(512);
  private musicGain?:GainNode;private musicAnalyser?:AnalyserNode;private musicSamples=new Float32Array(256);
  private musicSource?:AudioBufferSourceNode;private musicVoice?:GainNode;
  private musicBuffer?:AudioBuffer;private musicRendering?:Promise<AudioBuffer>;
  private musicRequested=false;private musicOffset=0;private musicStartedAt=0;private musicGeneration=0;
  init(){
    if(!this.enabled&&!this.musicEnabled)return;
    try{
      if(!this.context){
        this.context=new AudioContext();this.master=this.context.createGain();this.master.gain.value=this.enabled?.24:0;this.effectsAnalyser=this.context.createAnalyser();this.effectsAnalyser.fftSize=512;this.master.connect(this.effectsAnalyser);this.effectsAnalyser.connect(this.context.destination);
        this.musicGain=this.context.createGain();this.musicGain.gain.value=.9;
        this.musicAnalyser=this.context.createAnalyser();this.musicAnalyser.fftSize=256;
        this.musicGain.connect(this.musicAnalyser);this.musicAnalyser.connect(this.context.destination);
      }
      if(this.enabled)this.prepareCrashBuffers();
      void this.context.resume().catch(()=>{});
    }catch{/* Audio is optional on devices without an audio context. */}
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
    if(!this.enabled||!this.context||!this.master||this.context.state!=='running')return;
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
    this.musicRequested=true;this.init();
    if(!this.musicEnabled||!this.context||this.musicSource)return;
    const generation=++this.musicGeneration;
    void this.renderMusic().then(buffer=>{
      if(generation!==this.musicGeneration||!this.musicRequested||!this.musicEnabled||!this.context||!this.musicGain)return;
      const source=this.context.createBufferSource(),voice=this.context.createGain(),time=this.context.currentTime;
      source.buffer=buffer;source.loop=true;source.connect(voice);voice.connect(this.musicGain);
      voice.gain.setValueAtTime(0,time);voice.gain.linearRampToValueAtTime(1,time+.35);
      source.start(time,this.musicOffset%buffer.duration);this.musicStartedAt=time-this.musicOffset;
      this.musicSource=source;this.musicVoice=voice;
      source.onended=()=>{source.disconnect();voice.disconnect();};
    }).catch(()=>{/* A device without offline audio rendering can still play effects. */});
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
  private renderMusic(){
    if(this.musicBuffer)return Promise.resolve(this.musicBuffer);
    if(this.musicRendering)return this.musicRendering;
    this.musicRendering=this.composeMusic().then(buffer=>this.musicBuffer=buffer).catch(error=>{this.musicRendering=undefined;throw error;});
    return this.musicRendering;
  }
  private async composeMusic(){
    // A bright 126 BPM arcade score, rendered once for inexpensive mobile playback.
    // Reverb-free instrument tails wrap into the start for a continuous beat.
    const sampleRate=32000,beat=60/126,bar=beat*4,frames=Math.round(bar*8*sampleRate);
    const offline=new OfflineAudioContext(2,frames+sampleRate*4,sampleRate);
    const chords=[[48,52,55],[45,48,52],[41,45,48],[43,47,50]];
    const melodies=[[72,76,79,76,81,79,76,74],[69,72,76,79,76,72,71,67],[69,72,77,76,72,69,72,76],[67,71,74,79,77,74,71,74]];
    const note=(midi:number,time:number,duration:number,volume:number,type:OscillatorType,pan=0)=>{
      const oscillator=offline.createOscillator(),gain=offline.createGain(),stereo=offline.createStereoPanner(),filter=offline.createBiquadFilter();
      oscillator.type=type;oscillator.frequency.value=440*2**((midi-69)/12);stereo.pan.value=pan;
      filter.type='lowpass';filter.frequency.value=type==='square'?2600:4200;filter.Q.value=.6;
      gain.gain.setValueAtTime(0,time);gain.gain.linearRampToValueAtTime(volume,time+.006);
      gain.gain.setValueAtTime(volume*.7,time+duration*.55);
      gain.gain.exponentialRampToValueAtTime(.0001,time+duration);
      oscillator.connect(filter);filter.connect(gain);gain.connect(stereo);stereo.connect(offline.destination);
      oscillator.start(time);oscillator.stop(time+duration+.01);
    };
    const noise=offline.createBuffer(1,Math.ceil(sampleRate*.22),sampleRate),noiseData=noise.getChannelData(0);
    let seed=47;
    for(let i=0;i<noiseData.length;i++){seed=(Math.imul(seed,1664525)+1013904223)|0;noiseData[i]=(seed>>>0)/2147483648-1;}
    const percussion=(time:number,hat:boolean)=>{
      const source=offline.createBufferSource(),gain=offline.createGain(),filter=offline.createBiquadFilter();
      source.buffer=noise;filter.type='highpass';filter.frequency.value=hat?6500:1300;
      const duration=hat?.055:.16;gain.gain.setValueAtTime(hat?.065:.21,time);gain.gain.exponentialRampToValueAtTime(.0001,time+duration);
      source.connect(filter);filter.connect(gain);gain.connect(offline.destination);source.start(time);source.stop(time+duration);
    };
    const kick=(time:number)=>{
      const oscillator=offline.createOscillator(),gain=offline.createGain();oscillator.frequency.setValueAtTime(155,time);
      oscillator.frequency.exponentialRampToValueAtTime(48,time+.13);
      gain.gain.setValueAtTime(.4,time);gain.gain.exponentialRampToValueAtTime(.2,time+.07);gain.gain.exponentialRampToValueAtTime(.0001,time+.24);
      oscillator.connect(gain);gain.connect(offline.destination);oscillator.start(time);oscillator.stop(time+.25);
    };
    for(let i=0;i<8;i++){
      const chord=chords[i%4],time=i*bar;
      for(let j=0;j<4;j++){
        const t=time+j*beat;kick(t);
        note(chord[0],t,beat*.72,.15,'triangle');note(chord[0]+12,t+beat*.5,beat*.36,.08,'triangle');
        chord.forEach((midi,k)=>note(midi+12,t+beat*.5,beat*.42,.055,'triangle',(k-1)*.3));
        if(j%2===1){percussion(t,false);note(50,t,.12,.08,'triangle');}
        percussion(t,true);percussion(t+beat*.5,true);
      }
      melodies[i%4].forEach((midi,j)=>note(midi+(i===7&&j>5?12:0),time+j*beat*.5,beat*.68,.11,'square',j%2?.12:-.12));
    }
    const rendered=await offline.startRendering(),buffer=offline.createBuffer(2,frames,sampleRate);
    for(let channel=0;channel<2;channel++){
      const source=rendered.getChannelData(channel),target=buffer.getChannelData(channel);
      target.set(source.subarray(0,frames));
      for(let i=frames;i<source.length;i++)target[i-frames]+=source[i];
    }
    // Raise average loudness for phone speakers, retaining headroom for effects.
    let energy=0;
    for(let channel=0;channel<2;channel++)for(const value of buffer.getChannelData(channel))energy+=value*value;
    let gain=.34/Math.max(.001,Math.sqrt(energy/(frames*2)));
    for(let pass=0;pass<3;pass++){
      let outputEnergy=0;
      for(let channel=0;channel<2;channel++)for(const value of buffer.getChannelData(channel)){const sample=.92*Math.tanh(value*gain);outputEnergy+=sample*sample;}
      gain*=.3/Math.max(.001,Math.sqrt(outputEnergy/(frames*2)));
    }
    for(let channel=0;channel<2;channel++){
      const samples=buffer.getChannelData(channel);
      for(let i=0;i<samples.length;i++)samples[i]=.92*Math.tanh(samples[i]*gain);
    }
    return buffer;
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
