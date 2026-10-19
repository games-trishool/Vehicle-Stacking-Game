/** Ignore solver chatter and duplicate events from the two bodies in a collision. */
export class ImpactGate {
  pairs=new Map();last=-Infinity;
  accept(a,b,speed,time){
    if(!Number.isFinite(speed)||!Number.isFinite(time)||speed<1.15)return 0;
    const key=a<b?`${a}:${b}`:`${b}:${a}`;
    if(time-this.last<.085||time-(this.pairs.get(key)??-Infinity)<.20)return 0;
    this.last=time;this.pairs.set(key,time);
    if(this.pairs.size>64)for(const [pair,when] of this.pairs)if(time-when>2)this.pairs.delete(pair);
    return Math.min(1,.16+(speed-1.15)/10);
  }
  reset(){this.pairs.clear();this.last=-Infinity;}
}

/** Original deterministic broadband foley: chassis thud, crumple, panel ring and rattle. */
export function createCrashSamples(sampleRate,variant=0){
  const frames=Math.ceil(sampleRate*.62),samples=new Float32Array(frames);
  let seed=7349+variant*7919,low=0,previous=0;
  const noise=()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return (seed>>>0)/2147483648-1;};
  for(let i=0;i<frames;i++){
    const t=i/sampleRate,n=noise();low+=.12*(n-low);
    const attack=Math.min(1,t/.0015),decay=Math.exp(-t*15);
    const crunch=(n-previous*.55)*(.65+.35*Math.sin(t*211)**2)*Math.exp(-t*19);
    previous=n;
    const thud=Math.sin(2*Math.PI*(76*t-27*t*t))*.68*Math.exp(-t*22)+low*.8*decay;
    let metal=0;
    for(const [j,f] of [317,483,718,1170].entries())metal+=Math.sin(2*Math.PI*(f+variant*13)*t+j)*.075*Math.exp(-t*(8+j*3));
    let rattle=0;
    for(const hit of [.065,.117,.193,.281])if(t>hit)rattle+=n*.15*Math.exp(-(t-hit)*74);
    samples[i]=.92*Math.tanh(attack*(crunch*.85+thud+metal+rattle)*1.5);
  }
  return samples;
}
