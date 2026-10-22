/** Damage has a per-pair gate, independent of the global audio voice cooldown. */
export class DamageGate {
 pairs=new Map();
 accept(a,b,speed,time){
  if(!Number.isFinite(speed)||!Number.isFinite(time)||speed<1.6)return 0;
  const key=a<b?`${a}:${b}`:`${b}:${a}`;
  if(time-(this.pairs.get(key)??-Infinity)<.65)return 0;
  this.pairs.set(key,time);
  if(this.pairs.size>96)for(const [pair,when] of this.pairs)if(time-when>3)this.pairs.delete(pair);
  return Math.min(1,.18+(speed-1.6)/10);
 }
 reset(){this.pairs.clear();}
}

/** Contact offsets are world-oriented; mesh transforms are stale during world.step. */
export function contactInModel(body,contact,height){
 const offset=contact.bi===body?contact.ri:contact.rj;
 const world=body.position.vadd(offset),point=body.pointToLocalFrame(world);
 point.y+=height/2;return point;
}
