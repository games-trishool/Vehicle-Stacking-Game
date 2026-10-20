import * as CANNON from 'cannon-es';
import {SPECS} from './vehicle-specs.mjs';

/** Collision bodies used in play, including all three rickshaw wheels. */
export function createVehicleBody(id,x,bottom){
 const s=SPECS[id];if(!s)throw new Error(`Unknown vehicle: ${id}`);
 const body=new CANNON.Body({mass:s.mass,position:new CANNON.Vec3(x,bottom+s.height/2,0),linearDamping:.25,angularDamping:.7,sleepSpeedLimit:.18,sleepTimeLimit:.7});
 const box=(cx,cy,cz,hx,hy,hz)=>body.addShape(new CANNON.Box(new CANNON.Vec3(hx,hy,hz)),new CANNON.Vec3(cx,cy-s.height/2,cz));
 const wheel=(wx,wz,r)=>body.addShape(new CANNON.Sphere(r),new CANNON.Vec3(wx,r-s.height/2,wz));
 if(id==='rickshaw'){
  box(-.1,.68,0,1.35,.20,.63);box(-.28,2.08,0,1.12,.08,.70);
  box(1.0,1.42,0,.15,.58,.55);
  wheel(1.13,0,.32);for(const side of [-1,1])wheel(-.95,side*.64,.34);
 }else if(['ambulance','fireengine','dumptruck','mixer'].includes(id)){
  box(0,.66,0,s.length*.47,.23,s.width*.42);
  const radius=id==='ambulance'?.40:.44;
  const axles=id==='ambulance'?[-1.55,1.63]:[-1.82,-.68,1.84];
  for(const axle of axles)for(const side of [-1,1])wheel(axle,side*(s.width/2-.13),radius);
  box(s.length/2-.77,1.67,0,.71,.72,s.width*.43);
  if(id==='ambulance')box(-.68,1.73,0,1.88,.87,s.width*.47);
  else if(id==='fireengine')box(-.80,1.72,0,1.87,.90,s.width*.46);
  else if(id==='dumptruck')box(-.88,1.72,0,1.78,.85,s.width*.47);
  else {
   // Three tapered hulls follow the mixer drum instead of an invisible box roof.
   const rotation=new CANNON.Quaternion().setFromEuler(0,0,-Math.PI/2+.035);
   for(const [from,to,rearRadius,frontRadius] of [[-1.61,-.91,.32,.78],[-.91,.27,.78,.92],[.27,1.32,.92,.49]]){
    const mid=(from+to)/2;
    body.addShape(new CANNON.Cylinder(frontRadius,rearRadius,to-from,12),new CANNON.Vec3(-.84+mid*Math.cos(.035),1.86+mid*Math.sin(.035)-s.height/2,0),rotation);
   }
   box(-2.57,1.08,0,.17,.38,.64);
  }
 }else{
  // Preserve the original six vehicles' established collision shapes.
  const cabHeight=s.height-.91;
  box(0,.66,0,s.length*.47,.25,s.width*.45);
  box(id==='tractor'?-.8:0,.91+Math.max(.32,cabHeight)/2,0,id==='bus'?s.length*.48:id==='tractor'?.7:1.07,Math.max(.16,cabHeight/2),s.width*.43);
  for(const wx of [-s.length*.3,s.length*.3])for(const wz of [-s.width*.44,s.width*.44])body.addShape(new CANNON.Sphere(.36),new CANNON.Vec3(wx,.38-s.height/2,wz));
 }
 return body;
}
