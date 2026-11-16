/* ================= POSTER 03 — LANTERN TEAHOUSE ================= */
kitSetup({
  fog:[0x4a4682,0.0036],
  sky:{top:[0.075,0.09,0.27],mid:[0.20,0.20,0.46],hor:[0.62,0.42,0.58],sun:[0.34,0.012,-1],glowCol:[1.0,0.50,0.34],glowAmt:0.9,glowPow:14,band:0.22,
       clouds:[[0.95,0.55,0.60],0.55,2.2],disc:{dir:[-0.12,0.2,-1],col:[1.9,1.75,1.3],size:3.0,glow:0xfff0c8,gop:0.2,gsize:30},stars:{n:130,y0:0.3,op:0.65}},
  light:{hemi:[0x5a5aa8,0x1c1636,0.55],rim:[0xbcc4ff,0.55,-12,20,-100],fill:[0x7a78c8,0.22,6,12,60]},
  water:{x0:-300,x1:300,z0:-3,z1:42,deep:[0.05,0.06,0.20],mid:[0.17,0.17,0.42],rip:1.0,rmin:0.05,gain:0.7},
  core:[0x4a1a1c,0x3a1620,0x4a2418],
  leaf:{maple:{h:[0.0,0.07],s:[0.7,0.95],l:[0.12,0.5],size:0.26,dens:190},pine:{h:[0.34,0.44],s:[0.3,0.5],l:[0.03,0.13],size:0.2,dens:150}},
  env:{top:[0.075,0.09,0.27],hor:[0.50,0.38,0.58],k:0.6},
  exposure:0.95,bloom:[0.55,0.9,0.72],grade:{sh:[0.95,0.93,1.12],hi:[1.07,0.99,0.90],vig:0.4},
  cam:{fov:32,t:[-0.3,3.9,-8],az:-0.03,el:-0.03,rad:45,lim:{r0:34,r1:74}}
});

/* ---- ground, bank, retaining wall ---- */
const moss=lam(0x16241f,{roughness:1.0});
boxR(-140,40,-3,0.55,-150,-3.0,moss);                       // main bank
boxR(1.0,2.7,-3,0.55,-3.0,1.2,moss); boxR(9.5,40,-3,0.55,-3.0,1.6,moss);   // bridge abutments / right shore
const wall=stoneMat(0x4c4c6c,1,1); wall.map.repeat.set(30,1);
box(61,3.55,0.5,-30,-1.22,-2.75,wall).material=stoneMat(0x4a4a6a,30,1);
const wall2=stoneMat(0x4a4a6a,3,1); box(1.2,3.55,4.4,1.85,-1.22,-0.9,wall2); box(1.2,3.55,4.4,9.9,-1.22,-0.7,wall2);
boxR(9.5,30,-3,0.5,1.6,1.9,stoneMat(0x4a4a6a,10,1));
// gravel court in front of the teahouse
const gravel=canvasTex(256,256,function(g,w,h){ g.fillStyle='#8a88b0'; g.fillRect(0,0,w,h); for(let i=0;i<40;i++){ g.fillStyle='rgba(30,28,70,0.55)'; g.fillRect(0,i*6.4,w,2.2); } for(let i=0;i<500;i++){ g.fillStyle='rgba(255,255,255,'+(0.05+rng()*0.1)+')'; g.fillRect(rng()*w,rng()*h,2,2); } });
gravel.wrapS=gravel.wrapT=THREE.RepeatWrapping; gravel.repeat.set(2,1);
const gv=new THREE.Mesh(new THREE.PlaneGeometry(13,4.2),new THREE.MeshStandardMaterial({map:gravel,roughness:1,color:C(0x7a78a0)})); gv.rotation.x=-Math.PI/2; gv.position.set(-2.5,0.57,-4.7); scene.add(gv);
// shore rocks
(function(){ const M=new Merger(); for(let i=0;i<46;i++){ const x=-60+i*1.9+rng()*1.2; if(x>0.9&&x<4.0)continue; if(x>10&&x<13.5) continue; const r=0.5+rng()*0.9; M.add(rockGeo(r),mtx(x,0.05+rng()*0.1,-2.3-rng()*0.8,rng(),rng()*6,rng(),1.5,0.8,1.1),new THREE.Color().setHSL(0.66,0.15,0.1+rng()*0.12).getHex()); }
  for(let i=0;i<14;i++){ M.add(rockGeo(0.5+rng()*0.9),mtx(13+i*1.4,0.1,1.9+rng()*0.6,rng(),rng()*6,rng(),1.4,0.8,1.1),0x181a30); }
  M.mesh(new THREE.MeshStandardMaterial({vertexColors:true,roughness:0.9})); })();

/* ---- the teahouse ---- */
const woodD=lam(0x3a2418,{roughness:0.8}), woodM=lam(0x5a3a24,{roughness:0.75}), plaster=lam(0xb8a89c,{roughness:0.95});
const CX=-2.5, ZF=-5.6, ZB=-12;
boxR(-7.8,2.8,0.55,1.15,-12.6,-4.8,woodM);                                   // engawa deck
for(let i=0;i<20;i++) boxR(-7.8,2.8,1.15,1.17,-12.6+i*0.39,-12.6+i*0.39+0.02,lam(0x2a160c));    // board lines
for(let i=0;i<8;i++) cyl(0.12,0.12,0.7,-7.2+i*1.4,0.55,-4.95,lam(0x2a1a12),8);                 // posts under the deck edge
for(let i=0;i<4;i++){ boxR(-3.2+i*1.1,-2.3+i*1.1,0.55,0.75-i*0.0,-4.9-i*0.0,-4.3,stoneMat(0x7a7aa0,1,1)); } // step stones
for(let i=0;i<5;i++) boxR(-7+i*2.25-0.11,-7+i*2.25+0.11,1.15,4.6,-6.2,-6.0,woodD);             // front posts
for(let i=0;i<5;i++) boxR(-7+i*2.25-0.11,-7+i*2.25+0.11,1.15,4.6,-12.0,-11.8,woodD);           // back posts
boxR(-7.3,2.3,1.15,1.35,-6.3,-5.95,woodD);                                  // sill
boxR(-7.3,2.3,4.2,4.6,-6.3,-5.95,woodD);                                    // lintel
for(let i=0;i<4;i++){ const x=-5.875+i*2.25; glowWin(x,2.78,-6.1,2.0,2.85,0,'#ffe6a4','#f4b04a','rgba(70,34,14,0.95)',3,4,0.18); }
boxR(-7.3,2.3,1.15,4.6,-12.0,-11.9,plaster);                                // back wall
boxR(-7.3,-7.2,1.15,4.6,-12,-6.2,plaster); boxR(2.2,2.3,1.15,4.6,-12,-6.2,plaster);   // side walls
boxR(-7.3,2.3,1.15,1.2,-12,-6.2,woodD); boxR(-7.3,2.3,4.55,4.6,-12,-6.2,woodD);
boxR(-7.3,2.3,4.58,4.62,-12,-6.2,bas(0xffc878));                            // warm ceiling glow
// hip roof with tile ribs
const tileTex=canvasTex(128,64,function(g,w,h){ g.fillStyle='#8a8aa8'; g.fillRect(0,0,w,h); for(let x=0;x<w;x+=8){ g.fillStyle='rgba(20,20,50,0.85)'; g.fillRect(x,0,3,h); g.fillStyle='rgba(255,255,255,0.14)'; g.fillRect(x+3,0,1,h); } for(let y=0;y<h;y+=16){ g.fillStyle='rgba(10,10,40,0.35)'; g.fillRect(0,y,w,2); } });
tileTex.wrapS=tileTex.wrapT=THREE.RepeatWrapping; tileTex.repeat.set(5,2);
const roofM=new THREE.MeshStandardMaterial({color:C(0x4e4e78),map:tileTex,roughness:0.45,metalness:0.1,side:THREE.DoubleSide});
const roof=new THREE.Mesh(pyramidGeo(13.8,10.8,3.6),roofM); roof.position.set(CX,4.6,-8.8); scene.add(roof);
const roof2=new THREE.Mesh(pyramidGeo(4.6,4.0,1.9),roofM); roof2.position.set(CX,7.5,-8.8); scene.add(roof2);
boxR(-9.4,4.4,4.45,4.62,-14.2,-3.4,woodD);                                  // eave fascia
box(0.14,1.1,0.14,CX,9.5,-8.8,lam(0x2a2030)); sph(0.16,CX,10.1,-8.8,lam(0x8a8ab0,{metalness:0.6,roughness:0.3}));
// interior silhouettes: low table + seated figure + hanging scroll
(function(){ const sil=bas(0x2a140a); box(1.6,0.22,0.9,-3.2,1.55,-8.8,sil); const f=new THREE.Mesh(new THREE.CylinderGeometry(0.22,0.38,1.0,10),sil); f.position.set(-1.7,1.95,-8.8); scene.add(f); sph(0.22,-1.7,2.7,-8.8,sil); box(0.7,1.5,0.05,-5.2,3.1,-11.8,bas(0xe8d6a0)); })();
plight(CX,2.6,-6.6,0xffb458,2.4,17,1.5);
// lanterns under the eaves
for(let i=0;i<7;i++) paperLantern(-8.2+i*1.9,3.95,-3.9,0.3,0xffffff,1.3);
for(let i=0;i<4;i++) paperLantern(-8.0+i*2.6,3.95,-13.9+0.0,0.0001,0xffffff,1);
paperLantern(-8.8,2.3,-5.0,0.36,0xffffff,1.3); paperLantern(3.4,2.3,-5.0,0.36,0xffffff,1.3);
// string of lanterns from eave to maple (right)
(function(){ const a=new THREE.Vector3(3.8,4.1,-4.2), b=new THREE.Vector3(11.5,6.0,-6.5); for(let i=0;i<=9;i++){ const t=i/9, sag=-Math.sin(t*Math.PI)*1.1; paperLantern(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t+sag,a.z+(b.z-a.z)*t,0.18,i%2?0xffd08a:0xffb468,1.2); } })();
toro(-9.4,0.55,-4.3,1.15); toro(4.4,0.55,-4.2,1.0); toro(11.0,0.55,0.9,0.9);
plight(4.4,2.4,-3.6,0xffa848,0.9,9,1.6);

/* ---- arched red bridge ---- */
(function(){
  const red=lam(0xa82a24,{roughness:0.35,metalness:0.05}), wd=lam(0x4a2e22,{roughness:0.8});
  const x0=2.7, x1=9.5, xc=6.1, hw=3.4, BZ=-0.9, N=26;
  const Y=function(x){ const u=(x-xc)/hw; return 0.62+2.5*(1-u*u); };
  for(let i=0;i<N;i++){ const xa=x0+(x1-x0)*i/N, xb=x0+(x1-x0)*(i+1)/N, ya=Y(xa), yb=Y(xb), L=Math.hypot(xb-xa,yb-ya);
    const m=box(L+0.02,0.16,1.9,(xa+xb)/2,(ya+yb)/2,BZ,wd); m.rotation.z=Math.atan2(yb-ya,xb-xa);
    const rl=box(L+0.02,0.1,0.12,(xa+xb)/2,(ya+yb)/2+0.95,BZ-0.92,red); rl.rotation.z=Math.atan2(yb-ya,xb-xa);
    const rl2=box(L+0.02,0.1,0.12,(xa+xb)/2,(ya+yb)/2+0.95,BZ+0.92,red); rl2.rotation.z=Math.atan2(yb-ya,xb-xa);
    const rl3=box(L+0.02,0.06,0.08,(xa+xb)/2,(ya+yb)/2+0.5,BZ-0.92,red); rl3.rotation.z=Math.atan2(yb-ya,xb-xa);
    const rl4=box(L+0.02,0.06,0.08,(xa+xb)/2,(ya+yb)/2+0.5,BZ+0.92,red); rl4.rotation.z=Math.atan2(yb-ya,xb-xa);
    const bm=box(L+0.02,0.2,0.14,(xa+xb)/2,(ya+yb)/2-0.17,BZ-0.7,red); bm.rotation.z=Math.atan2(yb-ya,xb-xa);
    const bm2=box(L+0.02,0.2,0.14,(xa+xb)/2,(ya+yb)/2-0.17,BZ+0.7,red); bm2.rotation.z=Math.atan2(yb-ya,xb-xa);
    if(i%2===0){ [-0.92,0.92].forEach(function(dz){ box(0.1,0.95,0.1,xa,ya+0.5,BZ+dz,red); }); }
  }
  [-0.92,0.92].forEach(function(dz){ [x0,x1].forEach(function(xx){ sph(0.12,xx,Y(xx)+1.05,BZ+dz,lam(0xd4a03a,{metalness:0.6,roughness:0.3})); }); });
  paperLantern(xc,Y(xc)+1.6,BZ-0.92,0.26,0xffd08a,1.3); paperLantern(xc,Y(xc)+1.6,BZ+0.92,0.26,0xffd08a,1.3);
  plight(xc,Y(xc)+1.8,BZ,0xffa848,0.9,8,1.6);
})();

/* ---- trees ---- */
tree(13.5,-8,6.5,4.6,'maple',0x2a1a16); tree(7.5,-16,7.5,5.2,'maple',0x2a1a16); tree(-15,-15,7.5,5.0,'maple',0x2a1a16); tree(19,-3,6.5,4.0,'maple',0x2a1a16); tree(-24,-9,7,4.2,'maple',0x2a1a16); tree(-9,-21,6.5,4.6,'maple',0x2a1a16); tree(21,-14,8,5,'maple',0x2a1a16);
// black pine leaning over the water (left)
(function(){
  limb([[-14.5,0.3,-6],[-13.8,2.6,-5.8],[-12.0,5.4,-5.4],[-9.6,6.6,-4.8]],0.34,0.14,24,barkMat(0x2a2030));
  limb([[-13.4,4.0,-5.7],[-14.8,5.6,-5.9],[-16.2,6.2,-6.2]],0.14,0.06,10,barkMat(0x2a2030));
  const pads=[[-9.2,6.9,-4.6,2.2],[-11.6,5.9,-5.2,2.0],[-13.4,7.0,-5.6,1.8],[-16.0,6.6,-6.1,1.9],[-14.4,8.8,-6.0,1.7],[-10.6,8.4,-5.0,1.6]];
  pads.forEach(function(p){ blob(p[0],p[1],p[2],p[3],0.72,p[3]*0.8,'pine'); blob(p[0]+0.5,p[1]+0.55,p[2],p[3]*0.6,0.5,p[3]*0.55,'pine'); });
})();
// dark pine forest + ridges + a far pagoda
(function(){ const L=[]; for(let i=0;i<110;i++){ const x=-100+rng()*140, z=-24-rng()*60; L.push([x,z,4.5+rng()*6,1.4+rng()*0.9,0x0d1a26,0.55]); } forest(L); })();
ridge(-130,-240,240,-4,14,9,0x2a2858,11,1.2); ridge(-190,-300,300,-6,26,14,0x34306a,23,1.0); ridge(-270,-420,420,-10,44,20,0x433f7c,5,0.9);
(function(){ const d=bas(0x1d1a40); for(let k=0;k<4;k++){ const w=3.4-k*0.55; box(w*0.5,1.2,w*0.5,-44,12+k*1.8,-100,d); const r=new THREE.Mesh(pyramidGeo(w,w,0.9),d); r.position.set(-44,12.7+k*1.8,-100); scene.add(r);} })();
mist(-2,1.0,-3.5,70,4.5,0x8a82c0,0.20,0); mist(20,1.0,-5,50,4,0x9a8ac8,0.16,0); mist(-30,1.4,-14,90,6,0x8078b8,0.18,0);

/* ---- floating lanterns & lily pads on the pond ---- */
(function(){
  const pads=new Merger(); for(let i=0;i<46;i++){ const x=-9+rng()*20, z=6+rng()*26; const g=new THREE.CircleGeometry(0.25+rng()*0.3,10); g.rotateX(-Math.PI/2); pads.add(g,mtx(x,0.04,z),new THREE.Color().setHSL(0.36,0.45,0.05+rng()*0.05).getHex()); }
  pads.mesh(new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide}));
  const fl=[]; const px=[[-5,6],[-1,8.5],[3,7],[7,10],[-7,11],[1,13],[5,16],[-3,17],[8,19],[-6,21],[2,23],[-9,15],[10,13],[-2,26],[6,28]];
  px.forEach(function(p,i){
    const g=new THREE.Group(); const body=new THREE.Mesh(new THREE.BoxGeometry(0.44,0.3,0.44),new THREE.MeshBasicMaterial({map:paperTex,color:C(0xffffff),fog:false})); body.position.y=0.2; g.add(body);
    const base=new THREE.Mesh(new THREE.BoxGeometry(0.56,0.07,0.56),lam(0x3a2418)); base.position.y=0.04; g.add(base);
    const top=new THREE.Mesh(pyramidGeo(0.5,0.5,0.16),lam(0x3a2418)); top.position.y=0.35; g.add(top);
    g.position.set(p[0],0.0,p[1]); scene.add(g);
    const gl=glow(p[0],0.3,p[1],1.8,0xffb050,0.6); fl.push({g:g,gl:gl,x:p[0],z:p[1],ph:i*1.3});
  });
  tickers.push(function(t){ fl.forEach(function(o){ o.g.position.y=Math.sin(t*0.9+o.ph)*0.025; o.g.rotation.y=Math.sin(t*0.3+o.ph)*0.25; o.g.position.x=o.x+Math.sin(t*0.2+o.ph)*0.3; o.gl.position.set(o.g.position.x,0.3+o.g.position.y,o.z); }); });
})();
fireflies(26,-14,12,1.5,5,-9,-2,0xffe08a,0.35);
