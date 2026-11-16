/* ================= POSTER 04 — AURORA CABIN ================= */
kitSetup({
  fog:[0x10264a,0.0034],
  sky:{top:[0.015,0.03,0.13],mid:[0.03,0.09,0.24],hor:[0.09,0.22,0.42],sun:[0,0.0,-1],glowCol:[0.2,0.8,0.7],glowAmt:0.25,glowPow:3,band:0.12,
       stars:{n:700,y0:0.06,op:1.0,size:1.6},
       extra:[
        ' float aaz=atan(vD.x,-vD.z);',
        ' float wob=sin(aaz*7.0+time*0.12)*0.045+sin(aaz*17.0-time*0.2)*0.018+sin(aaz*3.0+1.0)*0.05;',
        ' float hh2=h-wob;',
        ' float rays=fbm(vec2(aaz*60.0+time*0.03,time*0.05)); rays=rays*rays*2.2;',
        ' float body=smoothstep(0.03,0.085,hh2)*exp(-max(hh2-0.085,0.0)*11.0);',
        ' float pat=0.45+0.75*fbm(vec2(aaz*4.0,hh2*2.0+time*0.02));',
        ' vec3 ac=mix(vec3(0.10,1.0,0.45),vec3(0.60,0.18,0.95),smoothstep(0.10,0.30,hh2));',
        ' c+=pow(ac,vec3(2.2))*body*rays*pat*(1.1+0.4*sin(time*0.3+aaz*4.0));',
        ' float body2=smoothstep(0.02,0.07,h-wob*0.6-0.04)*exp(-max(h-wob*0.6-0.09,0.0)*9.0);',
        ' c+=vec3(0.02,0.22,0.20)*body2*(0.4+0.6*fbm(vec2(aaz*30.0-time*0.04,2.0)));'
       ].join('\n')},
  light:{hemi:[0x2e7a86,0x10183a,0.62],rim:[0x58ffc0,0.35,0,30,-90],fill:[0x5a78d0,0.28,-8,10,60]},
  water:{x0:-300,x1:300,z0:-3,z1:60,deep:[0.01,0.035,0.10],mid:[0.04,0.12,0.26],rip:0.12,rmin:0.30,gain:0.95},
  core:[0x0a1a24],
  leaf:{a:{h:[0.4,0.5],s:[0.2,0.4],l:[0.03,0.1],size:0.2}},
  env:{top:[0.04,0.14,0.30],hor:[0.12,0.34,0.46],k:0.7},
  exposure:0.95,bloom:[0.6,0.9,0.7],grade:{sh:[0.88,1.0,1.14],hi:[1.02,1.05,0.95],vig:0.42},
  cam:{fov:32,t:[0,3.4,-9],az:-0.02,el:-0.03,rad:41,lim:{r0:32,r1:70}}
});
const snow=lam(0xb4c4ea,{roughness:0.92});
boxR(-200,200,-3,0.5,-220,-3,snow);
// drifts along the shore
(function(){ const M=new Merger(); for(let i=0;i<70;i++){ const x=-50+i*1.5+rng()*1.2; M.add(new THREE.IcosahedronGeometry(1,1),mtx(x,0.35,-3.0+rng()*1.4,0,rng()*3,0,1.4+rng()*1.8,0.45+rng()*0.3,1.0+rng()*0.8),0xc8d6f4); }
  for(let i=0;i<40;i++){ M.add(new THREE.IcosahedronGeometry(1,1),mtx(-40+rng()*80,0.28,-4-rng()*30,0,rng()*3,0,2+rng()*3,0.5+rng()*0.4,2+rng()*3),0xb8c8ee); }
  M.mesh(new THREE.MeshStandardMaterial({vertexColors:true,roughness:0.9})); })();

/* ---- the cabin ---- */
const logTex=canvasTex(128,128,function(g,w,h){ for(let y=0;y<h;y+=16){ const k=80+rng()*40|0; const gr=g.createLinearGradient(0,y,0,y+16); gr.addColorStop(0,'rgb('+(k+50)+','+(k+22)+','+(k-10)+')'); gr.addColorStop(0.5,'rgb('+(k+20)+','+(k+4)+','+(k-30)+')'); gr.addColorStop(1,'rgb('+(k-20)+','+(k-30)+','+(k-50)+')'); g.fillStyle=gr; g.fillRect(0,y,w,16); g.fillStyle='rgba(0,0,0,0.5)'; g.fillRect(0,y+14,w,2); for(let i=0;i<6;i++){ g.fillStyle='rgba(0,0,0,0.18)'; g.fillRect(rng()*w,y+2+rng()*10,10+rng()*30,1); } } });
logTex.wrapS=logTex.wrapT=THREE.RepeatWrapping;
function logWall(w,h,rx){ const t=logTex.clone(); t.needsUpdate=true; t.repeat.set(rx,h/1.0); return new THREE.MeshStandardMaterial({map:t,color:C(0xcaa078),roughness:0.85}); }
const CAB={x0:-6.8,x1:1.4,zf:-8,zb:-14,y0:0.5,hh:3.3};
boxR(CAB.x0,CAB.x1,CAB.y0,CAB.y0+CAB.hh,CAB.zb,CAB.zf,logWall(8.2,CAB.hh,4));
[[CAB.x0,CAB.zf],[CAB.x1,CAB.zf],[CAB.x0,CAB.zb],[CAB.x1,CAB.zb]].forEach(function(c){ for(let i=0;i<7;i++){ const m=cyl(0.2,0.2,0.0,0,0,0,lam(0x6a4426,{roughness:0.9}),10); m.geometry=new THREE.CylinderGeometry(0.2,0.2,1.0,10); m.rotation.z=Math.PI/2*(i%2); m.rotation.x=Math.PI/2*((i+1)%2); m.position.set(c[0],CAB.y0+0.22+i*0.46,c[1]); } });
// front: porch, door, windows
boxR(CAB.x0-0.2,CAB.x1+0.2,CAB.y0,CAB.y0+0.22,CAB.zf,CAB.zf+1.5,lam(0x4a3220,{roughness:0.8}));
for(let i=0;i<9;i++) cyl(0.08,0.08,1.5,CAB.x0+0.3+i*1.0,CAB.y0+0.9,CAB.zf+1.4,lam(0x3a2616),6);
boxR(CAB.x0,CAB.x1,CAB.y0+1.6,CAB.y0+1.7,CAB.zf+1.35,CAB.zf+1.45,lam(0x3a2616));
box(1.1,2.3,0.12,-2.7,CAB.y0+1.35,CAB.zf+0.02,lam(0x3a1e10,{roughness:0.7}));
glowWin(-2.7,CAB.y0+1.9,CAB.zf+0.1,0.6,0.6,0,'#ffe6a0','#f2a840','rgba(40,18,6,0.95)',2,2,0.2);
[-5.0,-0.4].forEach(function(x){ boxR(x-0.85,x+0.85,CAB.y0+1.0,CAB.y0+2.4,CAB.zf+0.0,CAB.zf+0.08,lam(0x2a1a10)); glowWin(x,CAB.y0+1.7,CAB.zf+0.1,1.5,1.2,0,'#ffe9a8','#f4aa44','rgba(40,18,6,0.95)',2,2,0.3); box(1.8,0.12,0.25,x,CAB.y0+0.95,CAB.zf+0.12,lam(0x2a1a10)); box(1.8,0.12,0.25,x,CAB.y0+2.45,CAB.zf+0.12,lam(0x2a1a10)); });
// side window on the right wall
glowWin(CAB.x1+0.02,CAB.y0+1.7,-11,1.2,1.1,Math.PI/2,'#ffe9a8','#f4aa44','rgba(40,18,6,0.95)',2,2,0.2);
// gable roof (ridge along x) + snow
(function(){
  const rm=lam(0x2a1e1a,{roughness:0.8}), sm=lam(0xdde8ff,{roughness:0.95});
  const L=CAB.x1-CAB.x0+1.8, D=CAB.zf-CAB.zb+1.6, H=2.6, cx=(CAB.x0+CAB.x1)/2, cz=(CAB.zf+CAB.zb)/2, y=CAB.y0+CAB.hh;
  const g=gableGeo(D,L,H); const a=new THREE.Mesh(g,rm); a.rotation.y=Math.PI/2; a.position.set(cx,y,cz); scene.add(a);
  const g2=gableGeo(D+0.5,L+0.3,H+0.28); const b=new THREE.Mesh(g2,sm); b.rotation.y=Math.PI/2; b.position.set(cx,y+0.2,cz); scene.add(b);
  // gable end beams
  for(let i=0;i<2;i++){ const bx=i?CAB.x1+0.8:CAB.x0-0.8; boxR(bx-0.05,bx+0.05,y-0.1,y+0.1,CAB.zb-0.8,CAB.zf+0.8,lam(0x2a1a10)); }
  // chimney
  boxR(-5.3,-4.2,y+0.6,y+4.0,-13.0,-11.9,stoneMat(0x4a4a5a,1,2)); boxR(-5.45,-4.05,y+4.0,y+4.2,-13.15,-11.75,snow);
  const sm2=[]; for(let i=0;i<14;i++){ const m=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,color:C(0x8aa4c8),transparent:true,opacity:0,depthWrite:false,fog:false})); m.renderOrder=6; scene.add(m); sm2.push({m:m,ph:i/14}); }
  tickers.push(function(t){ sm2.forEach(function(s){ const u=(t*0.06+s.ph)%1; s.m.position.set(-4.75+u*4.5+Math.sin(u*8+s.ph*9)*0.4,y+4.3+u*8.5,-12.45); const sc=1.0+u*5.5; s.m.scale.set(sc,sc,1); s.m.material.opacity=0.55*Math.sin(Math.PI*Math.min(1,u*1.15))*(1-u); }); });
})();
plight(-2.7,CAB.y0+1.6,CAB.zf+1.2,0xffb058,2.2,13,1.5); plight(-4.2,2.2,-6.0,0xffa848,0.8,9,1.6);
paperLantern(-2.7,CAB.y0+2.9,CAB.zf+1.4,0.0001,0xffffff,1); glow(-2.7,CAB.y0+2.9,CAB.zf+1.45,2.2,0xffa850,0.7); box(0.22,0.3,0.22,-2.7,CAB.y0+2.9,CAB.zf+1.45,bas(0xffd890));
// firewood stack + sled + lantern post
(function(){ const M=new Merger(); for(let r=0;r<5;r++) for(let c=0;c<7-r%2;c++){ M.add(new THREE.CylinderGeometry(0.16,0.16,1.0,7),mtx(2.6+c*0.34+(r%2)*0.17,CAB.y0+0.17+r*0.3,-9.6,Math.PI/2,0,0),new THREE.Color().setHSL(0.07,0.5,0.14+rng()*0.1).getHex()); } M.mesh(); boxR(2.5,5.2,CAB.y0+1.7,CAB.y0+1.78,-10.1,-9.1,lam(0xdde8ff,{roughness:0.95})); })();

/* ---- the dock ---- */
(function(){
  const M=new Merger(), DX=5.2;
  for(let i=0;i<40;i++){ M.add(new THREE.BoxGeometry(1.7,0.08,0.34),mtx(DX,0.52,-3.2+i*0.4+0.0),new THREE.Color().setHSL(0.07,0.3,0.09+rng()*0.06).getHex()); }
  M.add(new THREE.BoxGeometry(0.14,0.14,16.4),mtx(DX-0.7,0.44,5.0),0x2a1c12); M.add(new THREE.BoxGeometry(0.14,0.14,16.4),mtx(DX+0.7,0.44,5.0),0x2a1c12);
  for(let i=0;i<6;i++){ [-0.85,0.85].forEach(function(dx){ M.add(new THREE.CylinderGeometry(0.1,0.1,1.7,7),mtx(DX+dx,0.0,-2.4+i*3.1),0x2a1c12); M.add(new THREE.CylinderGeometry(0.14,0.14,0.1,7),mtx(DX+dx,0.9,-2.4+i*3.1),0xdde8ff); }); }
  M.mesh();
  paperLantern(DX+0.85,1.55,13.2,0.001,0xffffff,1); box(0.26,0.36,0.26,DX+0.85,1.5,13.2,bas(0xffd890)); glow(DX+0.85,1.5,13.2,3.0,0xffa850,0.8); plight(DX+0.85,1.7,13.2,0xffa848,1.2,12,1.5);
  box(0.12,1.3,0.12,DX+0.85,0.9,13.2,lam(0x2a1c12));
})();

/* ---- forest, ridges, falling snow ---- */
(function(){ const L=[]; for(let i=0;i<150;i++){ const side=rng()<0.5?-1:1, x=side*(10+rng()*90)+(rng()-0.5)*6, z=-9-rng()*70; if(Math.abs(x)<10&&z>-20) continue; L.push([x,z,6+rng()*9,1.5+rng()*1.2,0x0a1e28,0.5,0.5,0xaab8da]); }
  for(let i=0;i<46;i++){ L.push([-14+rng()*28,-30-rng()*40,5+rng()*8,1.4+rng()*1.0,0x0a1e28,0.5,0.5,0xaab8da]); } forest(L); })();
// two big foreground pines framing the cabin
forest([[-13,-7,15,3.0,0x0a2430,0.5,0.55,0xb8c6e6],[11.5,-6,13,2.7,0x0a2430,0.5,0.55,0xb8c6e6],[15.5,-10,17,3.2,0x0a2430,0.5,0.55,0xb8c6e6],[-18,-12,17,3.4,0x0a2430,0.5,0.55,0xb8c6e6]]);
ridge(-120,-240,240,-4,9,6,0x1d3158,3,1.1); ridge(-180,-320,320,-6,34,16,0x273f72,9,0.9); ridge(-260,-440,440,-10,56,24,0x34508a,15,0.8);
fireflies(0,0,1,0,1,0,1);
(function(){ const n=260, pts=[]; for(let i=0;i<n;i++) pts.push([-18+rng()*36,rng()*14,-14+rng()*34,0xdde8ff,1]); const pm=glowPts(pts,0.16,0.7); const a=pm.geometry.attributes.position, base=pts.map(function(p){return [p[0],p[1],p[2],rng()*6];});
  tickers.push(function(t){ for(let i=0;i<n;i++){ const b=base[i]; let y=(b[1]-t*0.35-((i*7)%5)*0.05)%14; if(y<0) y+=14; a.setXYZ(i,b[0]+Math.sin(t*0.4+b[3])*0.5,y,b[2]); } a.needsUpdate=true; }); })();
mist(0,0.9,-4,90,3.5,0x6a8ac0,0.16,0);
