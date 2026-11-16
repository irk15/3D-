/* ================= POSTER 09 — AEGEAN HARBOUR ================= */
kitSetup({
  fog:[0x6a4a78,0.0030],
  sky:{top:[0.06,0.08,0.28],mid:[0.38,0.26,0.54],hor:[0.98,0.60,0.50],sun:[-0.22,0.01,-1],glowCol:[1.0,0.55,0.35],glowAmt:0.8,glowPow:30,band:0.3,
       clouds:[[1.0,0.55,0.5],0.5,2.4],disc:{dir:[0.13,0.23,-1],col:[1.6,1.55,1.4],size:2.6,glow:0xfff0d8,gop:0.2,gsize:26},stars:{n:90,y0:0.4,op:0.5}},
  light:{hemi:[0x8a6aa8,0x28183a,0.3],rim:[0xffa070,1.0,-30,8,-100],fill:[0xffb090,0.22,6,12,60]},
  water:{x0:-300,x1:300,z0:-6.2,z1:50,deep:[0.04,0.07,0.20],mid:[0.10,0.17,0.38],rip:0.8,rmin:0.05,gain:0.8},
  core:[0x0c1a20],leaf:{bou:{h:[0.87,0.95],s:[0.75,0.95],l:[0.22,0.56],size:0.2,dens:130,cap:260},olive:{h:[0.25,0.34],s:[0.25,0.45],l:[0.04,0.14],size:0.2,dens:130,cap:260}},
  env:{top:[0.14,0.14,0.40],hor:[0.9,0.55,0.55],k:0.32},
  exposure:0.82,bloom:[0.55,0.9,0.76],grade:{sh:[0.96,0.93,1.12],hi:[1.08,0.99,0.90],vig:0.4},
  cam:{fov:32,t:[0,6.8,-16],az:-0.03,el:-0.03,rad:46,lim:{r0:32,r1:70}}
});
// quay
boxR(-80,80,-3,0.9,-9.2,-6.2,stoneMat(0x8a7a90,26,1)); boxR(-80,80,0.9,1.0,-9.2,-6.0,lam(0xb8aab8,{roughness:0.7}));
// terraces
const RW=12, houses=new Merger(), wins=new Merger(), lit=[], dome=new Merger(), lamp=[];
const wallC=[0xdcd0e4,0xeee0e8,0xcfc4dc,0xe6d8e0];
for(let r=0;r<RW;r++){
  const zr=-10.6-2.4*r, yr=1.0+1.5*r, Wd=25-r*2.0, rr=mulberry32(900+r);
  boxR(-Wd,Wd,-3,yr,zr-1.3,zr+1.2,lam(r%2?0xcfc4d6:0xd8cedc,{roughness:0.95}));
  let x=-Wd+0.6;
  while(x<Wd-1.5){
    const w=1.2+rr()*1.5, h=1.0+rr()*1.0, d=1.8;
    if(rr()<0.12){ x+=1.2; continue; }                             // gap / stair
    houses.add(new THREE.BoxGeometry(w,h,d),mtx(x+w/2,yr+h/2,zr),wallC[(rr()*4)|0]);
    if(rr()<0.45) houses.add(new THREE.BoxGeometry(w*0.7,h*0.7,d*0.8),mtx(x+w/2+(rr()-0.5)*0.6,yr+h+h*0.35,zr-0.1),wallC[(rr()*4)|0]);
    houses.add(new THREE.BoxGeometry(w+0.1,0.1,d+0.1),mtx(x+w/2,yr+h+0.02,zr),0xc8c0d8);
    const nw=Math.max(1,Math.round(w/1.0));
    for(let k=0;k<nw;k++){ const wx=x+(k+0.5)*w/nw, isLit=rr()<0.62; const g=new THREE.PlaneGeometry(0.34,0.5);
      wins.add(g,mtx(wx,yr+h*0.55,zr+d/2+0.02),isLit?0xffd890:0x1f2c6a); if(isLit) lit.push([wx,yr+h*0.55,zr+d/2+0.1,0xffb860,1]);
      wins.add(new THREE.PlaneGeometry(0.12,0.54),mtx(wx-0.24,yr+h*0.55,zr+d/2+0.025),0x2a58b0); wins.add(new THREE.PlaneGeometry(0.12,0.54),mtx(wx+0.24,yr+h*0.55,zr+d/2+0.025),0x2a58b0); }
    if(rr()<0.22){ const dr=0.55+rr()*0.35; houses.add(new THREE.CylinderGeometry(dr,dr,0.45,14),mtx(x+w/2,yr+h+0.25,zr),0xf0e8f4); const dg=new THREE.SphereGeometry(dr*1.02,18,8,0,Math.PI*2,0,Math.PI/2); dome.add(dg,mtx(x+w/2,yr+h+0.47,zr),0x2a58b0); }
    
    if(rr()<0.12){ lamp.push([x+w/2,yr+h+0.5,zr+d/2+0.3,0xffc878,1.2]); }
    x+=w+0.1+rr()*0.5;
  }
  // front terrace greenery
  for(let i=0;i<9;i++){ const gx=-Wd+rr()*2*Wd; blob(gx,yr+0.25,zr+1.1,0.45+rr()*0.5,0.3+rr()*0.15,0.3,rr()<0.65?'bou':'olive'); }
}
houses.mesh(new THREE.MeshStandardMaterial({vertexColors:true,roughness:0.85}));
wins.mesh(new THREE.MeshBasicMaterial({vertexColors:true,fog:true,side:THREE.DoubleSide}));
dome.mesh(new THREE.MeshStandardMaterial({vertexColors:true,roughness:0.3,metalness:0.15}));
glowPts(lit,1.7,0.55); glowPts(lamp,1.2,0.9);
// bell tower on the summit
(function(){ const zr=-10.6-2.4*11, yr=1.0+1.5*11+1.2; const wm=lam(0xf0e8f4,{roughness:0.8}); box(1.7,4.4,1.7,0,yr+1.4,zr,wm); box(1.9,0.2,1.9,0,yr+3.7,zr,lam(0xc8c0d8));
  glowWin(0,yr+2.8,zr+0.88,0.7,1.0,0,'#ffd890','#e89a40','rgba(30,16,8,0.9)',1,1,0.3);
  const d=new THREE.Mesh(new THREE.SphereGeometry(1.0,20,10,0,Math.PI*2,0,Math.PI/2),lam(0x2a58b0,{roughness:0.3,metalness:0.15})); d.position.set(0,yr+3.8,zr); scene.add(d); cyl(0.03,0.03,0.9,0,yr+5.1,zr,lam(0xe8e0f0),5); box(0.4,0.04,0.04,0,yr+5.2,zr,lam(0xe8e0f0)); glow(0,yr+2.8,zr+1.0,5,0xffb860,0.4); })();
// windmill
(function(){ const wx=-8.6, zr=-10.6-2.4*6, yr=1.0+1.5*6+0.6, wm=lam(0xeee8f4,{roughness:0.85}); cyl(0.9,1.4,4.4,wx,yr+2.2,zr,wm,16); const c=new THREE.Mesh(new THREE.ConeGeometry(1.35,1.7,16),lam(0x4a3a34,{roughness:0.95})); c.position.set(wx,yr+5.2,zr); scene.add(c);
  glowWin(wx,yr+1.6,zr+1.28,0.5,0.8,0,'#ffd890','#e89a40','rgba(30,16,8,0.9)',1,1,0.25);
  const bl=new THREE.Group(); for(let i=0;i<4;i++){ const b=new THREE.Group(); box(0.12,3.6,0.05,0,2.0,0,lam(0x3a2a22),b); box(0.7,3.0,0.02,0.4,2.2,0,lam(0xeee0c8,{side:THREE.DoubleSide}),b); b.rotation.z=i*Math.PI/2; bl.add(b); } bl.position.set(wx,yr+4.6,zr+1.1); scene.add(bl); tickers.push(function(t){ bl.rotation.z=t*0.25; }); })();
// quay lamps
(function(){ const L=[], pm=lam(0x2a2630,{roughness:0.5,metalness:0.4}); for(let i=0;i<13;i++){ const x=-24+i*4; cyl(0.05,0.07,2.3,x,2.15,-6.6,pm,6); box(0.24,0.3,0.24,x,3.4,-6.6,bas(0xffe0a0)); L.push([x,3.4,-6.5,0xffc070,1.6]); } glowPts(L,3.0,0.85); for(let i=0;i<4;i++) plight(-12+i*8,3.3,-5.8,0xffb860,0.9,9,1.6); })();
// boats
function boat(x,z,ry,col,len,sail){
  const s=new THREE.Shape(); const L=len/2; s.moveTo(-L,1.0); s.lineTo(-L+0.5,0.0); s.lineTo(L-0.9,0.0); s.lineTo(L,1.15); s.lineTo(-L,1.0);
  const g=new THREE.Group(); const hull=new THREE.Mesh(new THREE.ExtrudeGeometry(s,{depth:len*0.3,bevelEnabled:false}),lam(col,{roughness:0.55})); hull.position.set(0,-0.15,-len*0.15); g.add(hull);
  box(len*0.9,0.1,len*0.3+0.04,0,0.88,0,lam(0xe8e0d0),g); box(len*0.34,0.8,len*0.22,-len*0.12,1.45,0,lam(0xeee8f0),g); box(len*0.38,0.1,len*0.26,-len*0.12,1.9,0,lam(0xb83a2a),g);
  cyl(0.04,0.04,len*0.8,len*0.18,1.9+len*0.2,0,lam(0x2a2630),5,g); box(0.18,0.2,0.18,len*0.18,2.2+len*0.4,0,bas(0xffe0a0),g);
  glow(len*0.18,2.2+len*0.4,0,1.1,0xffd890,0.7); glowWin(-len*0.12,1.45,len*0.11+0.02,0.5,0.4,0,'#ffe6a4','#f2a440',null,1,1,0);
  g.position.set(x,0,z); g.rotation.y=ry; scene.add(g); const ph=rng()*6; tickers.push(function(t){ g.position.y=Math.sin(t*0.8+ph)*0.05; g.rotation.z=Math.sin(t*0.6+ph)*0.025; });
}
boat(-8,-3.9,0.05,0x2a58b0,3.6); boat(-2.6,-4.5,-0.08,0xc0382a,3.2); boat(3.2,-3.8,0.1,0xf0e8d8,3.5); boat(8.6,-4.5,-0.05,0x2a58b0,3.7); boat(-12.5,-4.4,0.0,0x20a0a8,3.2); boat(13,-4.0,0.04,0xc0382a,3.4);
boat(-4,3.5,0.35,0x2a58b0,4.4); boat(5.5,5.2,-0.3,0xc0382a,4.6);
ridge(-170,-320,320,-4,4,4,0x6a4a7a,14,1.3);
mist(0,1.0,-6.5,120,3.0,0xe0a8b0,0.10,0);
