// Original score source. Regenerate the bundled track with scripts/render-audio.mjs.
export async function composeMusic(){
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
