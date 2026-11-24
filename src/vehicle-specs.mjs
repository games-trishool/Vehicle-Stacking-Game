// Nominal stacking dimensions and mass. Mirrors/trim can extend slightly.
export const SPECS={
 car:{length:4.5,width:1.85,height:1.58,color:0x0879ee,mass:8},
 suv:{length:4.5,width:2,height:1.95,color:0x00ac80,mass:8},
 truck:{length:4.9,width:2,height:1.82,color:0xff691c,mass:8},
 sports:{length:4.6,width:1.96,height:1.32,color:0xf61942,mass:8},
 bus:{length:5.6,width:2.14,height:2.55,color:0x00aac8,mass:14},
 tractor:{length:3.9,width:2.05,height:2.28,color:0x82c92a,mass:12},
 ambulance:{length:5.25,width:2.08,height:2.64,color:0xfffcf2,mass:12},
 police:{length:4.5,width:1.85,height:1.72,color:0xe5f2ff,mass:8.5},
 rickshaw:{length:3.2,width:1.52,height:2.16,color:0xffc51c,mass:5},
 fireengine:{length:5.65,width:2.18,height:2.64,color:0xf52924,mass:15},
 dumptruck:{length:5.5,width:2.22,height:2.6,color:0xffb517,mass:16},
 mixer:{length:5.65,width:2.2,height:2.8,color:0x167fc9,mass:17},
};
// Hidden recurring run reward: appears at each tenth successful stack and is
// deliberately excluded from the shop catalog and unlock state.
export const BONUS_SPECS={
 gold:{length:4.75,width:2.34,height:1.52,color:0xffb20c,mass:8.5},
};
export const VEHICLE_SPECS={...SPECS,...BONUS_SPECS};
