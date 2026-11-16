/* ================= POSTER 05 — DESERT RIAD ================= */
kitSetup({
  fog:[0x6a3556,0.0030],
  sky:{top:[0.07,0.06,0.25],mid:[0.40,0.16,0.42],hor:[0.95,0.48,0.26],sun:[0.17,0.09,-1],glowCol:[1.0,0.5,0.2],glowAmt:0.7,glowPow:40,band:0.25,
       clouds:[[0.95,0.45,0.35],0.55,2.6],
       disc:{dir:[0.17,0.095,-1],col:[3.2,2.0,1.0],size:5.0,glow:0xffa050,gop:0.55,gsize:60},stars:{n:60,y0:0.5,op:0.4}},
  light:{hemi:[0xc86a68,0x2a1230,0.42],rim:[0xffa868,1.5,17,9.6,-100],fill:[0xff9a7a,0.30,-10,12,60]},
  water:{x0:-60,x1:60,z0:-2,z1:44,deep:[0.16,0.10,0.28],mid:[0.40,0.24,0.46],rip:0.9,rmin:0.05,gain:0.8},
  core:[0x1a1030],leaf:{a:{h:[0.1,0.2],s:[0.4,0.6],l:[0.03,0.1],size:0.2}},
  env:{top:[0.14,0.10,0.34],hor:[0.9,0.5,0.4],k:0.42},
  exposure:0.85,bloom:[0.5,0.9,0.78],grade:{sh:[1.0,0.92,1.1],hi:[1.08,1.0,0.88],vig:0.4},
  cam:{fov:32,t:[0,5.2,-9],az:0.0,el:-0.03,rad:44,lim:{r0:30,r1:68}}
});
const clay=lam(0xa4583c,{roughness:0.95});
// courtyard floor & pool coping
const floorTex=canvasTex(256,256,function(g,w,h){ g.fillStyle='#d8b48a'; g.fillRect(0,0,w,h); for(let y=0;y<4;y++)for(let x=0;x<4;x++){ g.fillStyle=((x+y)%2)?'#c99c70':'#e2c298'; g.fillRect(x*64+3,y*64+3,58,58); } for(let i=0;i<300;i++){ g.fillStyle='rgba(80,40,20,0.08)'; g.fillRect(rng()*w,rng()*h,2,2); } });
floorTex.wrapS=floorTex.wrapT=THREE.RepeatWrapping; floorTex.repeat.set(24,3);
boxR(-60,60,-3,0.32,-14,-2.0,new THREE.MeshStandardMaterial({map:floorTex,color:C(0xd0a888),roughness:0.7}));
const zel=canvasTex(128,32,function(g,w,h){ g.fillStyle='#f0e2c0'; g.fillRect(0,0,w,h); for(let i=0;i<8;i++){ const x=i*16+8; g.fillStyle=i%2?'#1c6a8a':'#b8402a'; g.beginPath(); g.moveTo(x,4); g.lineTo(x+7,16); g.lineTo(x,28); g.lineTo(x-7,16); g.closePath(); g.fill(); g.fillStyle='#f0e2c0'; g.beginPath(); g.arc(x,16,2.2,0,6.3); g.fill(); } });
zel.wrapS=zel.wrapT=THREE.RepeatWrapping; zel.repeat.set(14,1);
const zm=new THREE.MeshStandardMaterial({map:zel,roughness:0.35,metalness:0.0});
boxR(-60,60,0.0,0.34,-2.0,-1.35,zm); boxR(-60,60,-2.6,0.0,-2.0,-1.9,lam(0x3a3a6a));
boxR(-60,-24,-3,0.32,-2,60,clay); boxR(24,60,-3,0.32,-2,60,clay);

/* ---- facade (canvas with arch cut-outs) ---- */
function facadeTex(pw,ph,arches,band){
  const S=96, W=Math.round(pw*S), H=Math.round(ph*S);
  return canvasTex(W,H,function(g){
    g.fillStyle='#b8663e'; g.fillRect(0,0,W,H);
    for(let i=0;i<900;i++){ g.fillStyle='rgba('+(i%2?'255,210,150':'90,30,10')+',0.05)'; g.fillRect(rng()*W,rng()*H,6+rng()*30,3+rng()*10); }
    // merlons
    g.clearRect(0,0,W,0.35*S); const mw=0.5*S; for(let x=0.15*S;x<W;x+=mw*2){ g.fillStyle='#c0704a'; g.fillRect(x,0,mw,0.4*S); }
    g.fillStyle='#c0704a'; g.fillRect(0,0.35*S,W,H);
    if(band){ g.fillStyle='#efe0bc'; g.fillRect(0,0.45*S,W,0.5*S); for(let x=0.25*S;x<W;x+=0.5*S){ g.fillStyle=(Math.round(x/(0.5*S))%2)?'#1f6a88':'#b8402a'; g.beginPath(); g.moveTo(x,0.5*S); g.lineTo(x+0.2*S,0.7*S); g.lineTo(x,0.9*S); g.lineTo(x-0.2*S,0.7*S); g.fill(); } g.fillStyle='rgba(60,20,10,0.5)'; g.fillRect(0,0.95*S,W,3); }
    arches.forEach(function(a){ const cx=a[0]*S, by=H-a[1]*S, w=a[2]*S, h=a[3]*S;
      const path=function(pad){ g.beginPath(); g.moveTo(cx-w/2-pad,by+4); g.lineTo(cx-w/2-pad,by-h+w/2); g.bezierCurveTo(cx-w/2-pad,by-h+w/2-w*0.62-pad,cx+w/2+pad,by-h+w/2-w*0.62-pad,cx+w/2+pad,by-h+w/2); g.lineTo(cx+w/2+pad,by+4); g.closePath(); };
      g.fillStyle='#efe0bc'; path(0.16*S); g.fill(); g.fillStyle='#8a3a22'; path(0.08*S); g.fill();
      g.globalCompositeOperation='destination-out'; g.fillStyle='#000'; path(0); g.fill(); g.globalCompositeOperation='source-over'; });
  });
}
function wallPlane(pw,ph,x,y,z,arches,band,body){
  const t=facadeTex(pw,ph,arches,band);
  const m=new THREE.Mesh(new THREE.PlaneGeometry(pw,ph),new THREE.MeshStandardMaterial({map:t,alphaTest:0.5,side:THREE.DoubleSide,roughness:0.9}));
  m.position.set(x,y+ph/2,z); scene.add(m);
  return m;
}
function interior(pw,ph,x,y,z,hot){ const t=canvasTex(128,128,function(g,w,h){ const gr=g.createLinearGradient(0,0,0,h); gr.addColorStop(0,hot||'#ffcc78'); gr.addColorStop(0.7,'#f09038'); gr.addColorStop(1,'#a84818'); g.fillStyle=gr; g.fillRect(0,0,w,h); const rg=g.createRadialGradient(w/2,h*0.5,2,w/2,h*0.5,w*0.7); rg.addColorStop(0,'rgba(255,250,210,0.7)'); rg.addColorStop(1,'rgba(255,200,100,0)'); g.fillStyle=rg; g.fillRect(0,0,w,h); }); const m=new THREE.Mesh(new THREE.PlaneGeometry(pw,ph),new THREE.MeshBasicMaterial({map:t,fog:false})); m.position.set(x,y+ph/2,z); scene.add(m); return m; }
// wings
[-1,1].forEach(function(s){
  const cx=s*5.0, ar=[[2.6-1.3+1.3-1.3+0,0,0,0]];
  const arches=[[2.6-1.3,0,1.9,3.7],[2.6+1.3,0,1.9,3.7],[2.6-1.3,4.6,0.95,1.4],[2.6+1.3,4.6,0.95,1.4]];
  wallPlane(5.2,6.6,cx,0.32,-9.0,arches,true);
  interior(5.2,6.6,cx,0.32,-9.55); box(5.2,6.6,1.0,cx,3.62,-10.4,clay);
  for(let i=0;i<2;i++){ const ax=cx+(i?1.3:-1.3)*1; glow(ax,2.0,-9.3,5.5,0xffa050,0.35); }
  // hanging brass lanterns inside arches
  [-1.3,1.3].forEach(function(dx){ box(0.22,0.34,0.22,cx+dx,3.0,-9.35,bas(0xffe0a0)); glow(cx+dx,3.0,-9.3,1.6,0xffc060,0.9); });
  boxR(cx-2.7,cx+2.7,6.9,7.0,-9.3,-8.8,lam(0x7a3a28));
});
// central tower
(function(){
  const arches=[[2.4,0,2.7,4.8],[1.0,6.6,0.9,1.9],[2.4,6.6,0.9,1.9],[3.8,6.6,0.9,1.9],[2.4,9.6,0.8,1.4]];
  wallPlane(4.8,11.6,0,0.32,-8.2,arches,true);
  interior(4.8,11.6,0,0.32,-8.75,'#ffe090'); box(4.8,11.6,2.0,0,6.1,-9.8,clay);
  box(0.28,0.5,0.28,0,3.4,-8.5,bas(0xffe6a8)); glow(0,3.4,-8.4,5,0xffb860,0.8); glow(0,2.0,-8.4,6,0xffa040,0.5);
  boxR(-2.7,2.7,5.6,5.75,-8.4,-7.6,lam(0x7a3a28));
  const roof=new THREE.Mesh(pyramidGeo(5.6,5.6,2.4),lam(0x2a7a62,{roughness:0.3,metalness:0.1})); roof.position.set(0,11.92,-9.2); scene.add(roof);
  cyl(0.06,0.06,1.0,0,14.8,-9.2,lam(0xd4a03a,{metalness:0.6,roughness:0.3}),6); sph(0.2,0,14.4,-9.2,lam(0xd4a03a,{metalness:0.6,roughness:0.3}));
  plight(0,3.0,-6.5,0xffb060,2.4,14,1.5);
})();
plight(-6,3.0,-6.5,0xffa050,1.4,11,1.5); plight(6,3.0,-6.5,0xffa050,1.4,11,1.5);
// roof-terrace trees & palms
tree(-8,-12.5,4.0,2.6,'a',0x2a1a14,6.9); tree(9,-12.5,4.0,2.6,'a',0x2a1a14,6.9);
palm(-9.8,-8.0,13.5,0.6,0.3,1.2,0x2a1a18,palmDark,0.3); palm(9.6,-7.5,12,-0.8,0.2,1.15,0x2a1a18,palmDark,0.3);
palm(-4.0,-12.5,15.5,-0.7,0.3,1.1,0x2a1a18,palmDark,0.3); palm(5.0,-12.5,17,0.9,0.3,1.2,0x2a1a18,palmDark,0.3); palm(-14,-10,11,0.7,0,1.1,0x2a1a18,palmDark,0.3); palm(15,-9,12.5,-0.6,0,1.2,0x2a1a18,palmDark,0.3);
palmDark.color.set(C(0x2a1830));
// potted orange trees + daybed + floor lanterns
(function(){
  const pot=lam(0xb85a30,{roughness:0.6}); [-8.4,8.4,-3.4,3.4].forEach(function(x){ cyl(0.5,0.38,0.7,x,0.65,-5.0,pot,10); sph(0.8,x,1.9,-5.0,lam(0x16301e,{roughness:1}),1,1.1,1); for(let i=0;i<7;i++) sph(0.09,x+(rng()-0.5)*1.2,1.5+rng()*1.0,-5.0+(rng()-0.5)*1.0+0.5,bas(0xff9a20)); });
  boxR(-8.8,-4.2,0.32,0.9,-7.6,-6.2,lam(0x4a2030)); [0x1f7a8a,0xe0a030,0xb83a2a,0x1f7a8a].forEach(function(c,i){ box(0.9,0.5,0.5,-8.2+i*1.1,1.25,-6.8,lam(c,{roughness:0.8})); });
  const fl=[-9,-6.5,-1.2,1.2,6.5,9]; fl.forEach(function(x){ box(0.34,0.5,0.34,x,0.62,-1.0,bas(0xffd890)); glow(x,0.7,-1.0,3.2,0xffa850,0.85); });
})();
// floating petals & candles on the pool
(function(){ const P=new Merger(); for(let i=0;i<110;i++){ const a=rng()*6.28, r=Math.sqrt(rng())*4.5, g=new THREE.CircleGeometry(0.12+rng()*0.08,6); g.rotateX(-Math.PI/2); P.add(g,mtx(-1.5+Math.cos(a)*r*1.5,0.04,9+Math.sin(a)*r,0,rng()*6,0),[0xff8a30,0xff5a70,0xffb040][i%3]); }
  P.mesh(new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide}));
  [[-3,7],[0.5,10],[3.5,8],[-1,13],[2.5,15]].forEach(function(p){ cyl(0.22,0.18,0.1,p[0],0.06,p[1],bas(0xe0b890),12); box(0.06,0.14,0.06,p[0],0.18,p[1],bas(0xfff0c0)); glow(p[0],0.25,p[1],1.8,0xffb050,0.9); }); })();
// dunes & distant minaret
ridge(-80,-200,200,-3,9,5,0x7a3248,4,1.3); ridge(-140,-260,260,-5,16,9,0x8c3e54,17,1.0); ridge(-230,-400,400,-8,26,14,0xa04e5e,8,0.8);
(function(){ const d=bas(0x4a2440); box(1.6,12,1.6,-34,5,-90,d); box(2.2,0.6,2.2,-34,11.2,-90,d); const r=new THREE.Mesh(pyramidGeo(1.8,1.8,2.2),d); r.position.set(-34,11.5,-90); scene.add(r); })();
mist(0,1.2,-3,110,4.5,0xe8a090,0.10,0);
