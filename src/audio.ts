export class GameAudio {
  context?:AudioContext; master?:GainNode; enabled=true;musicEnabled=true;
  private musicGain?:GainNode;private musicAnalyser?:AnalyserNode;private musicSamples=new Float32Array(256);
  private musicSource?:AudioBufferSourceNode;private musicVoice?:GainNode;
  private musicBuffer?:AudioBuffer;private musicRendering?:Promise<AudioBuffer>;
  private musicRequested=false;private musicOffset=0;private musicStartedAt=0;private musicGeneration=0;
  init(){
    if(!this.enabled&&!this.musicEnabled)return;
    try{
      if(!this.context){
        this.context=new AudioContext();this.master=this.context.createGain();this.master.gain.value=this.enabled?.24:0;this.master.connect(this.context.destination);
        this.musicGain=this.context.createGain();this.musicGain.gain.value=.38;
        this.musicAnalyser=this.context.createAnalyser();this.musicAnalyser.fftSize=256;
        this.musicGain.connect(this.musicAnalyser);this.musicAnalyser.connect(this.context.destination);
      }
      void this.context.resume().catch(()=>{});
    }catch{/* Audio is optional on devices without an audio context. */}
  }
  setEnabled(value:boolean){this.enabled=value;if(this.master)this.master.gain.value=value?.24:0;}
  setMusicEnabled(value:boolean){
    if(this.musicEnabled===value)return;
    this.musicEnabled=value;
    if(!value)this.stopMusicVoice();else if(this.musicRequested)this.startMusic();
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
    // Render an original eight-bar ambient piece once, then loop one audio buffer.
    // Chord tails wrap into the beginning so the loop has no silent seam.
    const sampleRate=32000,beat=60/84,bar=beat*4,frames=Math.round(bar*8*sampleRate);
    const offline=new OfflineAudioContext(2,frames+sampleRate*4,sampleRate);
    const chords=[[48,52,55,59],[45,48,52,55],[41,45,48,52],[43,48,50,55]];
    const note=(midi:number,time:number,duration:number,volume:number,type:OscillatorType,pan=0)=>{
      const oscillator=offline.createOscillator(),gain=offline.createGain(),stereo=offline.createStereoPanner();
      oscillator.type=type;oscillator.frequency.value=440*2**((midi-69)/12);stereo.pan.value=pan;
      gain.gain.setValueAtTime(0,time);gain.gain.linearRampToValueAtTime(volume,time+.025);
      gain.gain.exponentialRampToValueAtTime(.0001,time+duration);
      oscillator.connect(gain);gain.connect(stereo);stereo.connect(offline.destination);
      oscillator.start(time);oscillator.stop(time+duration+.01);
    };
    for(let i=0;i<8;i++){
      const chord=chords[i%4],time=i*bar;
      chord.forEach((midi,j)=>note(midi,time,bar*1.15,.028,'triangle',(j-1.5)*.25));
      note(chord[0]-12,time,beat*2,.095,'sine');note(chord[0]-12,time+beat*2,beat*1.8,.07,'sine');
      [0,2,1,3,2,1,3,1].forEach((index,j)=>note(chord[index]+12,time+j*beat/2,beat*1.35,j%2?.075:.105,'sine',Math.sin(j)*.35));
      if(i%2===1)note(chord[3]+24,time+beat*3,beat*1.7,.035,'sine',.25);
    }
    const rendered=await offline.startRendering(),buffer=offline.createBuffer(2,frames,sampleRate);
    for(let channel=0;channel<2;channel++){
      const source=rendered.getChannelData(channel),target=buffer.getChannelData(channel);
      target.set(source.subarray(0,frames));
      for(let i=frames;i<source.length;i++)target[i-frames]+=source[i];
    }
    return buffer;
  }
  dispose(){this.stopMusic();void this.context?.close().catch(()=>{});this.musicBuffer=undefined;}
  tone(frequency:number,duration:number,delay=0,type:OscillatorType='sine',volume=.6){if(!this.enabled||!this.context||!this.master)return;const t=this.context.currentTime+delay,o=this.context.createOscillator(),g=this.context.createGain();o.type=type;o.frequency.setValueAtTime(frequency,t);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(volume,t+.008);g.gain.exponentialRampToValueAtTime(.001,t+duration);o.connect(g);g.connect(this.master);o.start(t);o.stop(t+duration+.02);o.onended=()=>{o.disconnect();g.disconnect();};}
  drop(){this.tone(150,.1,0,'triangle',.25);}
  landing(perfect:boolean,combo:number){
    if(perfect){[440,554.37,659.25,880].forEach((f,i)=>this.tone(f*(1+Math.min(combo,5)*.025),.3,i*.055,'sine',.3));}
    else{this.tone(72,.23,0,'triangle',.9);this.tone(140,.1,0,'sine',.4);}
  }
  fail(){[220,174,130].forEach((f,i)=>this.tone(f,.3,i*.11,'triangle',.4));}
  click(){this.tone(650,.065,0,'sine',.2);}
}
