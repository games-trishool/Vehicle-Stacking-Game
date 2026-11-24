import { writeFile, readFile } from 'node:fs/promises';
import * as T from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Build in the game's coordinates (nose +X), then export in the pack's -Z convention.
const parts = new Map();
function finish(name, color, metalness, roughness, extra = {}) {
  const mat = new T.MeshPhysicalMaterial({ color, metalness, roughness, ...extra });
  mat.name = name;
  return mat;
}
const gold = finish('Metallic body – honey gold', 0xe9a539, .64, .22, {clearcoat: 1, clearcoatRoughness: .09});
const glass = finish('Windshield smoked glass', 0x243841, .08, .10, {clearcoat: 1, clearcoatRoughness: .055, transparent: true, opacity: .94});
const carbon = finish('Graphite aero composite', 0x292c30, .34, .38, {clearcoat: .28});
const black = finish('Intake shadow and seals', 0x131619, .08, .71);
const rubber = finish('Performance tire rubber', 0x27282a, .02, .84);
const alloy = finish('Diamond-cut forged alloy', 0xb7bbc0, .92, .24);
const rotor = finish('Carbon ceramic rotor', 0x686668, .64, .51);
const orange = finish('Vermilion brake enamel', 0xba3517, .4, .28);
const led = finish('Daylight LED guide', 0xe5f3ff, .15, .18, {emissive: 0xc5deff, emissiveIntensity: 1.2});
const red = finish('Ruby rear light guide', 0x9d0b16, .1, .22, {emissive: 0xff1521, emissiveIntensity: .85});
const lerp = T.MathUtils.lerp;
const sq = x => x*x;
function add(mat, geo) {
  if (!parts.has(mat)) parts.set(mat, []);
  geo.clearGroups();
  parts.get(mat).push(geo);
}
// A grid provides continuous normals across each stamped panel. Reverse mirrored patches.
function patch(mat, cols, rows, point, reverse = false) {
  const pos = [], uv = [], index = [];
  for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) {
    const u = i/cols, v = j/rows;
    pos.push(...point(u, v)); uv.push(u, v);
    if (i < cols && j < rows) {
      const a = j*(cols+1)+i, b = a+1, c = a+cols+1, d = c+1;
      index.push(...(reverse ? [a,c,b,b,c,d] : [a,b,c,b,d,c]));
    }
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos,3));
  g.setAttribute('uv', new T.Float32BufferAttribute(uv,2));
  g.setIndex(index); g.computeVertexNormals(); add(mat,g);
}
function tube(mat, points, radius, segments = 24) {
  const curve = new T.CatmullRomCurve3(points.map(p => new T.Vector3(...p)));
  add(mat,new T.TubeGeometry(curve,segments,radius,6,false));
}
function oval(mat, center, scale) {
  add(mat,new T.SphereGeometry(1,24,12).scale(...scale).translate(...center));
}
const front = 1.44, rear = -1.40, length = 2.32;
function fender(x) {
  return Math.max(Math.exp(-sq((x-front)/.53)), Math.exp(-sq((x-rear)/.64)));
}
function width(x) {
  return .98 + .103*fender(x) - .17*Math.pow(Math.abs(x/length),5);
}
function deck(x,t) {
  const end = Math.abs(x/length);
  const spine = .874 - .247*Math.pow(end,2.7) - .035*x/length;
  const shoulder = .067 + .145*fender(x);
  return spine + shoulder*Math.exp(-sq((t-.78)/.245)) - .045*t*t;
}
// The center of each bumper leads the outer corners in plan view.
function planX(x,t) { return x - Math.sign(x)*.23*Math.pow(Math.abs(x/length),6)*t*t; }
function crown(x,t,side, lift = 0) {
  // Roll the outer shoulder into the flank and round the nose into the fascia.
  const roll = .052*Math.pow(t,9);
  return [planX(x,t)-.025*Math.pow(Math.abs(x/length),16)*Math.sign(x),
    deck(x,t)-roll+lift,side*(width(x)*t-.034*Math.pow(t,10))];
}
function archFloor(x) {
  const dx = Math.min(Math.abs(x-front),Math.abs(x-rear));
  const r = .466;
  return dx >= r ? .30 : .30 + Math.sqrt(r*r-dx*dx) + .12*Math.min(1,(r-dx)/.032);
}
function flank(x,v,side,offset = 0) {
  const tuck = .04*v + .073*Math.sin(Math.PI*v)*Math.exp(-sq((x+.32)/.82));
  const p=crown(x,1,side);
  return [p[0],lerp(p[1],archFloor(x),v),side*(width(x)-.034*Math.exp(-10*v)-tuck+offset)];
}
for (const side of [-1,1]) {
  patch(gold,100,20,(u,v)=>crown(lerp(-length,length,u),v,side),side>0);
  patch(gold,160,8,(u,v)=>flank(lerp(-length,length,u),v,side),side>0);
  // Fold the arch lips inward so the cutouts have visible thickness.
  patch(carbon,160,2,(u,v)=>{
    const p = flank(lerp(-length,length,u),1,side); p[2] -= side*.19*v; return p;
  },side>0);
  // Side air scoop widens towards the rear wheel, with a raised lower sill.
  patch(black,25,5,(u,v)=>{
    const x = lerp(-.91+.11*v,.40-.52*v,u);
    return flank(x,lerp(.22+.51*u,.84,v),side,.006);
  },side>0);
  tube(carbon,[-.91,-.65,0,.65,.94].map(x=>flank(x,.98,side,.012)),.027);
  tube(black,[[.78,.03],[.69,.18],[.58,.68],[.40,.78],[-.46,.81],[-.65,.70]].map(([x,v])=>flank(x,v,side,.008)),.007);
  tube(carbon,[flank(-.46,.13,side,.013),flank(-.29,.13,side,.013)],.013,8);
  // Dark recessed headlamp pockets follow the fender curvature. Two light pipes
  // wrap down toward the nose, leaving gold visible between the light and grille.
  const light = (u,v,h) => crown(lerp(2.15,1.85,u)+(.064+.13*Math.sin(Math.PI*u))*v,lerp(.46,.90,u),side,h);
  patch(carbon,24,5,(u,v)=>light(u,v,.011),side<0);
  tube(led,[0,.22,.52,.78,1].map(u=>light(u,.84,.025)),.012);
  for(const u of [.36,.54,.72]) oval(led,light(u,.31,.019),[.025,.012,.021]);
  for (let i=0;i<3;i++) {
    const x = 1.33+i*.12;
    patch(carbon,10,2,(u,v)=>crown(x+.075*u+.035*v,lerp(.66,.88,u),side,.006),side>0);
  }
}
// Wrap the front and tail around the main shell; inset the cooling openings and
// expose the gold bumper above and between them.
function face(end,t,v,offset=0) {
  const p=crown(end*length,Math.abs(t),Math.sign(t));
  return [p[0]+end*(offset+(1-t*t)*(.037*(1-Math.exp(-12*v))-.043*v)),lerp(p[1],.30,v),
    p[2]+t*(.034*(1-Math.exp(-10*v))-.04*v)];
}
for (const end of [-1,1]) {
  patch(gold,56,8,(u,v)=>face(end,2*u-1,v),end<0);
  for(const side of [-1,1]){
    const aperture = (u,v,off)=>face(end,side*lerp(.084+.055*v,.91-.08*v,u),lerp(.30+.22*(1-u),.89,v),off);
    patch(black,24,5,(u,v)=>aperture(u,v,.008),end*side<0);
    for(let j=0;j<3;j++) tube(carbon,[0,.25,.5,.75,1].map(u=>aperture(u,(j+1)/4,.014)),.009);
    if(end<0) tube(red,[0,.3,.7,1].map(u=>face(-1,side*lerp(.04,.93,u),.20-.08*u,.016)),.019);
  }
  patch(carbon,48,3,(u,v)=>{
    const p=face(end,2*u-1,1,.047); p[0]-=end*.28*v; p[1]-=.028*v; return p;
  },end>0);
}
// One swept teardrop canopy. The roof and pillars follow the exact glass curvature.
function canopy(u,t,side,offset=0) {
  const arch = Math.pow(Math.max(0,Math.sin(Math.PI*u)),.85);
  const x = lerp(-1.57,1.23,u);
  return [x, .836 + .50*arch*(1-.89*Math.pow(t,3)) + offset,
    side*t*(.73+.105*arch-.11*Math.pow(1-u,3))];
}
for(const side of [-1,1]){
  patch(glass,48,16,(u,v)=>canopy(u,v,side),side>0);
  const roof = (u,v,h) => canopy(lerp(.32+.035*v,.634-.025*v,u),v*.735,side,h);
  patch(gold,32,12,(u,v)=>roof(u,v,.010),side>0);
  for(const [u0,u1] of [[.355,.018],[.609,.977]]){
    const pillar = [0,.25,.5,.75,1].map(v=>canopy(lerp(u0,u1,v),lerp(.735,.998,v),side,.008));
    tube(gold,pillar,.025);
  }
  tube(carbon,[0,.2,.5,.8,1].map(u=>canopy(u,1,side,.003)),.013);
  tube(carbon,[[.62,.93,.80*side],[.65,.96,.93*side],[.68,1.01,1.04*side]],.021);
  oval(gold,[.68,1.025,1.068*side],[.127,.056,.091]);
  oval(alloy,[.588,1.027,1.068*side],[.038,.039,.070]);
  oval(carbon,[-.37,.97,.36*side],[.16,.20,.20]);
  oval(black,[-.43,1.11,.36*side],[.083,.10,.112]);
}
oval(carbon,[.54,.92,0],[.28,.07,.68]);
patch(carbon,40,8,(u,v)=>{
  const x=lerp(-length,length,u), t=2*v-1;
  return [crown(x,Math.abs(t),Math.sign(t))[0],.30-.045*(1-t*t)*Math.sin(Math.PI*u),
    t*(width(x)-.04-.17*fender(x))];
});
// Rear deck vents and a thin, cambered carbon wing on swept uprights.
for(let j=0;j<5;j++) for(const side of [-1,1]){
  const x=-1.64-.085*j;
  patch(carbon,14,3,(u,v)=>crown(x+.045*v+.07*u,lerp(.08,.56,u),side,.008),side<0);
}
for(const side of [-1,1]) tube(carbon,[[-1.86,.83,side*.56],[-1.97,.96,side*.56],[-2.04,1.034,side*.56]],.031);
patch(carbon,40,12,(u,v)=>[lerp(-2.23,-1.89,v)+.09*sq(2*u-1),1.04+.032*Math.sin(Math.PI*v)+.038*sq(2*u-1),(2*u-1)*.93]);
for(const side of [-1,1]) oval(carbon,[-1.98,1.075,side*.93],[.19,.067,.016]);

// Revolved tire shoulders and separate brake hardware leave daylight through the spokes.
for(const axle of [front,rear]) for(const side of [-1,1]){
  const y=.416, z=.925*side;
  const turn = (g,depth=0)=>g.rotateX(side*Math.PI/2).translate(axle,y,z+depth*side);
  // A recessed wheel-well liner closes the view through the opposite arch.
  const liner=new T.CircleGeometry(.476,48,0,Math.PI);
  if(side<0)liner.rotateY(Math.PI);
  add(black,liner.translate(axle,y,z-side*.158));
  function lathe(mat,profile) {
    add(mat,turn(new T.LatheGeometry(profile.map(([r,d])=>new T.Vector2(r,d)),64)));
  }
  lathe(rubber,[[.295,-.13],[.353,-.132],[.391,-.11],[.408,-.084],[.412,-.06],[.412,.06],[.408,.084],[.392,.112],[.358,.133],[.316,.136],[.295,.12]]);
  lathe(alloy,[[.292,-.10],[.303,-.10],[.312,.115],[.31,.134],[.294,.134],[.289,.115],[.292,-.10]]);
  add(rotor,turn(new T.CylinderGeometry(.254,.254,.024,48),.075));
  oval(orange,[axle-.17,y+.055,z+side*.093],[.065,.128,.025]);
  for(let i=0;i<10;i++) {
    const angle=i*Math.PI/5;
    for(const fork of [-1,1]){
      const spoke=(u,v)=>{
        const radius=lerp(.058,.30,u);
        const a=angle+.16*u+fork*.095*u*u+(v-.5)*lerp(.024,.017,u)/radius;
        return [axle+radius*Math.cos(a),y+radius*Math.sin(a),z+side*(.15-.037*Math.sin(Math.PI*u))];
      };
      patch(alloy,10,2,spoke,side<0);
    }
    for(const r of [.201,.227]){
      const a=angle+(r-.2)*5;
      add(black,turn(new T.CylinderGeometry(.007,.007,.002,8),.088).translate(r*Math.cos(a),r*Math.sin(a),0));
    }
  }
  add(carbon,turn(new T.CylinderGeometry(.071,.072,.038,32),.137));
  add(gold,turn(new T.CylinderGeometry(.033,.039,.012,28),.158));
}
const scene=new T.Scene();
let triangles=0;
for(const [mat,geoms] of parts){
  const g=mergeGeometries(geoms);
  g.rotateY(Math.PI/2);
  const mesh=new T.Mesh(g,mat); mesh.name=mat.name;
  scene.add(mesh); triangles+=g.index.count/3;
}
// GLTFExporter uses the browser FileReader interface for binary output.
globalThis.FileReader=class {
  async readAsArrayBuffer(blob){this.result=await blob.arrayBuffer(); this.onloadend();}
};
const filename='05_rare_golden_bonus_hypercar.glb';
const asset=new URL('../'+filename,import.meta.url);
const data=await new GLTFExporter().parseAsync(scene,{binary:true});
await writeFile(asset,new Uint8Array(data));
const manifestFile=new URL('../asset_manifest.json',import.meta.url);
const manifest=JSON.parse(await readFile(manifestFile,'utf8'));
const size=new T.Box3().setFromObject(scene).getSize(new T.Vector3());
Object.assign(manifest.find(entry=>entry.file===filename),{
  triangles,size_kb:Math.round(data.byteLength/1024),parts:scene.children.length,
  bounding_box_meters:size.toArray().map(n=>Number(n.toFixed(3)))
});
await writeFile(manifestFile,JSON.stringify(manifest,null,2)+'\n');
