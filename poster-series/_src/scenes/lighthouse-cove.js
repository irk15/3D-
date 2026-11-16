/* ================= POSTER 06 — LIGHTHOUSE COVE ================= */
kitSetup({
  fog:[0x2a4560,0.0036],
  sky:{top:[0.035,0.06,0.19],mid:[0.10,0.20,0.34],hor:[0.80,0.40,0.22],sun:[-0.45,0.0,-1],glowCol:[1.0,0.5,0.22],glowAmt:0.9,glowPow:40,halo:0.08,band:0.5,
       clouds:[[0.85,0.42,0.38],0.3,2.0],stars:{n:260,y0:0.3,op:0.8}},
  light:{hemi:[0x4a78a0,0x0a1420,0.5],rim:[0xffa468,0.9,-60,6,-100],fill:[0x6a98c8,0.28,8,12,60]},
  water:{x0:-400,x1:400,z0:-2,z1:60,deep:[0.015,0.06,0.11],mid:[0.05,0.15,0.24],rip:2.2,rmin:0.04,gain:0.85},
  core:[0x0c1a20],leaf:{a:{h:[0.3,0.4],s:[0.3,0.5],l:[0.03,0.1],size:0.2}},
  env:{top:[0.06,0.12,0.30],hor:[0.7,0.42,0.38],k:0.6},
  exposure:0.92,bloom:[0.62,0.9,0.7],grade:{sh:[0.9,1.0,1.1],hi:[1.08,0.99,0.88],vig:0.42},
  cam:{fov:32,t:[4.0,6.6,-9],az:-0.035,el:-0.03,rad:50,lim:{r0:34,r1:74}}
});
const HX=10, HZ=-8, HRX=9, HRY=5.2, HRZ=5.5;
function hillY(x,z){ const a=1-((x-HX)/HRX)*((x-HX)/HRX)-((z-HZ)/HRZ)*((z-HZ)/HRZ); return a>0?HRY*Math.sqrt(a):-1; }
// headland: smooth grassy ellipsoid + rock skirt
(function(){
  const g=new THREE.SphereGeometry(1,48,24,0,Math.PI*2,0,Math.PI/2); const p=g.attributes.position;
  for(let i=0;i<p.count;i++){ const x=p.getX(i),y=p.getY(i),z=p.getZ(i), n=Math.sin(x*7.1)*Math.cos(z*6.3)*0.03+Math.sin(x*17.0+z*9.0)*0.015; p.setXYZ(i,x*(1+n),y*(1+n*0.6),z*(1+n)); }
  g.computeVertexNormals(); const m=new THREE.Mesh(g,lam(0x1c3226,{roughness:1})); m.position.set(HX,-0.2,HZ); m.scale.set(HRX,HRY,HRZ); scene.add(m);
  const R=new Merger();
  for(let i=0;i<70;i++){ const a=rng()*Math.PI*2, f=0.8+rng()*0.25; const x=HX+Math.cos(a)*HRX*f, z=HZ+Math.sin(a)*HRZ*f; if(z<HZ-1) continue; const hy=Math.max(0.2,hillY(x,z)*0.85); const r=0.5+rng()*1.0;
    R.add(rockGeo(r),mtx(x,Math.max(0.1,hy*rng()*0.8),z,rng(),rng()*6,rng(),1.3,0.9,1.2),new THREE.Color().setHSL(0.6,0.18,0.07+rng()*0.1).getHex()); }
  for(let i=0;i<30;i++){ const x=0+rng()*22, z=-3.2+rng()*3.0; R.add(rockGeo(0.4+rng()*0.9),mtx(x,0.1,z,rng(),rng()*6,rng(),1.4,0.8,1.2),new THREE.Color().setHSL(0.6,0.15,0.05+rng()*0.08).getHex()); }
  for(let i=0;i<9;i++){ R.add(rockGeo(0.8+rng()*1.6),mtx(-10-rng()*30,0.2,-6-rng()*14,rng(),rng()*6,rng(),1.3,1.0,1.1),0x121a24); }
  R.mesh(new THREE.MeshStandardMaterial({vertexColors:true,roughness:0.85}));
  const T=new Merger(); for(let i=0;i<420;i++){ const a=rng()*Math.PI*2, f=Math.sqrt(rng())*0.97, x=HX+Math.cos(a)*HRX*f, z=HZ+Math.sin(a)*HRZ*f, y=hillY(x,z); if(y<0.5) continue; T.add(new THREE.ConeGeometry(0.07,0.5+rng()*0.7,4),mtx(x,y-0.05+0.2,z,(rng()-0.5)*0.6,0,(rng()-0.5)*0.6),new THREE.Color().setHSL(0.30,0.4,0.08+rng()*0.1).getHex()); }
  T.mesh();
})();
// foam around the base
[[-6,-2.6,9],[1,-2.2,11],[8,-1.8,9],[15,-2.4,8],[20,-4,7],[-14,-5,9]].forEach(function(f){ glowPlane(f[0],0.06,f[1],f[2]*1.6,3.2,0xcfe8f0,0.45); });

// lighthouse
const LX=HX+0.5, LZ=HZ+0.2, LY0=hillY(LX,LZ)-0.3;
(function(){
  const stripe=canvasTex(8,256,function(g,w,h){ for(let i=0;i<4;i++){ g.fillStyle=(i%2)?'#b32a22':'#e8e8f0'; g.fillRect(0,i*64,w,64); } const gr=g.createLinearGradient(0,0,w,0); gr.addColorStop(0,'rgba(0,0,0,0.45)'); gr.addColorStop(0.45,'rgba(255,255,255,0.15)'); gr.addColorStop(1,'rgba(0,0,0,0.6)'); g.fillStyle=gr; g.fillRect(0,0,w,h); });
  const tm=new THREE.MeshStandardMaterial({map:stripe,roughness:0.7});
  const TH=10.2; const tw=new THREE.Mesh(new THREE.CylinderGeometry(1.15,1.75,TH,28,1,true),tm); tw.position.set(LX,LY0+TH/2,LZ); scene.add(tw);
  cyl(1.9,1.9,0.5,LX,LY0+0.2,LZ,lam(0x2a2a34),20);
  const gy=LY0+TH; cyl(1.9,1.4,0.5,LX,gy+0.1,LZ,lam(0x222230,{metalness:0.4,roughness:0.5}),24); cyl(1.9,1.9,0.12,LX,gy+0.38,LZ,lam(0x222230),24);
  for(let i=0;i<20;i++){ const a=i/20*Math.PI*2; cyl(0.04,0.04,0.7,LX+Math.cos(a)*1.85,gy+0.75,LZ+Math.sin(a)*1.85,lam(0x222230),4); }
  cyl(1.87,1.87,0.06,LX,gy+1.1,LZ,lam(0x222230),24);
  const lan=new THREE.Mesh(new THREE.CylinderGeometry(1.0,1.0,1.9,20),new THREE.MeshBasicMaterial({color:new THREE.Color(3.2,2.5,1.4),fog:false})); lan.position.set(LX,gy+1.35,LZ); scene.add(lan);
  for(let i=0;i<12;i++){ const a=i/12*Math.PI*2; cyl(0.045,0.045,1.95,LX+Math.cos(a)*1.02,gy+1.35,LZ+Math.sin(a)*1.02,lam(0x1a1a24),4); }
  cyl(1.2,1.2,0.15,LX,gy+2.35,LZ,lam(0x1a1a24),20); const rf=new THREE.Mesh(new THREE.ConeGeometry(1.35,1.2,20),lam(0x9a2a22,{roughness:0.4,metalness:0.2})); rf.position.set(LX,gy+3.0,LZ); scene.add(rf); sph(0.16,LX,gy+3.75,LZ,lam(0xd4a03a,{metalness:0.6,roughness:0.3}));
  glow(LX,gy+1.35,LZ,18,0xffdc90,0.8); glow(LX,gy+1.35,LZ,44,0xffc070,0.22);
  [[0.25,0.18],[0.5,-0.4],[0.74,0.3]].forEach(function(w){ const y=LY0+TH*w[0]; glowWin(LX+Math.sin(w[1])*1.45,y,LZ+Math.cos(w[1])*1.45,0.4,0.7,w[1],'#ffe8a8','#f4aa44','rgba(40,18,6,0.9)',1,2,0.2); });
  glowWin(LX+0.0,LY0+1.2,LZ+1.78,0.9,1.5,0,'#ffe8a8','#f4aa44','rgba(40,18,6,0.9)',1,1,0.2);
  // rotating beams
  const bg=new THREE.ConeGeometry(5.5,150,24,1,true); bg.translate(0,-75,0); bg.rotateZ(Math.PI/2);
  const bp=bg.attributes.position, bc=[]; for(let i=0;i<bp.count;i++){ const t=Math.min(1,Math.max(0,bp.getX(i)/150)); const k=Math.pow(1-t,1.4); bc.push(1.0*k,0.82*k,0.5*k); }
  bg.setAttribute('color',new THREE.Float32BufferAttribute(bc,3));
  const bm=new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,fog:false,opacity:0.22});
  const beams=new THREE.Group(); beams.position.set(LX,gy+1.35,LZ); [0,Math.PI].forEach(function(r){ const m=new THREE.Mesh(bg,bm); m.rotation.y=r; m.renderOrder=6; beams.add(m); }); scene.add(beams);
  tickers.push(function(t){ beams.rotation.y=2.55+t*0.10; });
  plight(LX,gy+1.0,LZ+2,0xffd490,1.2,16,1.6);
})();
// keeper's cottage
(function(){
  const cx=4.8, cz=-5.8, cy=hillY(cx,cz)-0.2;
  boxR(cx-2.6,cx+2.6,cy,cy+2.6,cz-1.8,cz+1.8,lam(0xd4d8e4,{roughness:0.9}));
  const r=new THREE.Mesh(gableGeo(4.4,6.2,1.9),lam(0x6a2a24,{roughness:0.6})); r.rotation.y=Math.PI/2; r.position.set(cx,cy+2.6,cz); scene.add(r);
  boxR(cx+1.2,cx+1.8,cy+3.6,cy+5.0,cz-0.6,cz,lam(0x8a8a98));
  [[-1.4,1.55],[1.4,1.55]].forEach(function(w){ glowWin(cx+w[0],cy+1.5,cz+1.85,0.95,1.05,0,'#ffe6a4','#f2a440','rgba(60,30,12,0.95)',2,2,0.28); });
  box(0.9,1.8,0.1,cx,cy+0.9,cz+1.84,lam(0x3a2418)); glow(cx,cy+2.3,cz+2.2,2.6,0xffb860,0.5); plight(cx,cy+1.4,cz+3,0xffb458,1.4,10,1.5);
  // fence
  for(let i=0;i<9;i++) box(0.08,0.8,0.08,cx-4.4+i*1.1,cy+0.4,cz+3.6,lam(0xd4d8e4)); box(9.0,0.07,0.07,cx,cy+0.7,cz+3.6,lam(0xd4d8e4));
})();
// fishing boat
(function(){
  const s=new THREE.Shape(); s.moveTo(-2.6,1.0); s.lineTo(-2.1,0.0); s.lineTo(1.9,0.0); s.lineTo(2.8,1.0); s.lineTo(-2.6,1.0);
  const hull=new THREE.Mesh(new THREE.ExtrudeGeometry(s,{depth:1.5,bevelEnabled:false}),lam(0x20324a,{roughness:0.6})); hull.position.set(0,-0.15,-0.75);
  const g=new THREE.Group(); g.add(hull); const cab=box(1.3,0.9,1.1,-0.7,1.35,0,lam(0xe4e4ec,{roughness:0.7}),g); box(1.5,0.12,1.3,-0.7,1.85,0,lam(0x9a2a22),g);
  cyl(0.05,0.05,3.2,0.7,2.4,0,lam(0x1a1a24),6,g); box(0.3,0.3,0.3,0.7,3.9,0,bas(0xffe0a0),g); box(0.12,0.12,0.12,-1.8,1.1,0.8,bas(0x40ff70),g); box(0.12,0.12,0.12,-1.8,1.1,-0.8,bas(0xff4040),g);
  glowWin(-0.7,1.4,0.57,0.7,0.5,0,'#ffe6a4','#f2a440',null,1,1,0.3);
  g.position.set(-0.5,0,7); g.rotation.y=-0.25; scene.add(g);
  glow(-0.5+0.7,3.9,7,1.8,0xffd890,0.6); glow(-0.5-0.9,1.3,7.4,1.2,0xffd890,0.4);
  tickers.push(function(t){ g.position.y=Math.sin(t*0.8)*0.06; g.rotation.z=Math.sin(t*0.6)*0.03; });
})();
// far coast with town lights
ridge(-150,-320,320,-4,3,3,0x1a2c44,5,1.2); ridge(-230,-420,420,-6,6,5,0x213750,12,1.0); ridge(-320,-560,560,-8,10,8,0x2b4560,2,0.8);
(function(){ const L=[]; for(let i=0;i<120;i++){ const x=-130+rng()*90, y=0.6+rng()*2.6; L.push([x,y,-148,[0xffc880,0xffe0a0,0xffb060][i%3],0.6+rng()]); } glowPts(L,1.1,0.9); })();
(function(){ const L=[]; for(let i=0;i<4;i++) L.push([-60-i*35,1.4,-150,0xff5040,1.2]); glowPts(L,2.4,0.9); })();
// splashes
(function(){ const sp=[]; for(let i=0;i<7;i++){ const m=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,color:C(0xdff2ff),transparent:true,opacity:0.5,depthWrite:false,fog:false})); m.renderOrder=7; scene.add(m); sp.push({m:m,x:-5+i*3.6+rng()*2,z:-2.5+rng()*2,ph:rng()*6}); }
  tickers.push(function(t){ sp.forEach(function(o){ const u=(Math.sin(t*0.7+o.ph)+1)/2; o.m.position.set(o.x,0.4+u*1.2,o.z); o.m.scale.set(0.9+u*1.4,0.7+u*1.5,1); o.m.material.opacity=0.06+0.2*u; }); }); })();
mist(5,1.0,-3,120,3.5,0x6a8aa8,0.14,0);
