/* ================= POSTER 07 — RAINY RAMEN STREET ================= */
kitSetup({
  fog:[0x1e1238,0.0042],
  sky:{top:[0.018,0.010,0.07],mid:[0.07,0.035,0.15],hor:[0.26,0.10,0.26],sun:[0,0.0,-1],glowCol:[0.8,0.3,0.6],glowAmt:0.15,glowPow:3,halo:0.2,band:0.12,clouds:[[0.5,0.2,0.45],0.3,2.0]},
  light:{hemi:[0x5a3a8a,0x14082a,0.5],rim:[0x8a9cff,0.25,10,25,-60],fill:[0xff5aa0,0.30,-6,8,50]},
  water:{x0:-200,x1:200,z0:-6.6,z1:70,deep:[0.02,0.015,0.05],mid:[0.05,0.035,0.10],rip:0.45,rmin:0.35,gain:0.95},
  core:[0x0c1a20],leaf:{a:{h:[0.3,0.4],s:[0.3,0.5],l:[0.03,0.1],size:0.2}},
  env:{top:[0.10,0.06,0.24],hor:[0.40,0.20,0.40],k:0.5},
  exposure:0.88,bloom:[0.8,0.85,0.66],grade:{sh:[0.9,0.94,1.16],hi:[1.10,0.95,0.92],vig:0.44},
  cam:{fov:32,t:[1.0,5.8,-8],az:-0.02,el:-0.02,rad:46,lim:{r0:32,r1:70}}
});
const ZF=-9.45;
boxR(-80,80,-3,0.22,-16,-6.6,lam(0x2a2638,{roughness:0.6}));                 // sidewalk
boxR(-80,80,-3,0.0,-6.9,-6.6,lam(0x3a3650,{roughness:0.5}));
function neonSign(x,y,z,w,h,txt,col,o){
  o=o||{}; const S=64, cw=Math.round(w*S), ch=Math.round(h*S);
  const t=canvasTex(cw,ch,function(g){ g.fillStyle=o.bg||'#14081c'; g.fillRect(0,0,cw,ch); g.strokeStyle=col; g.lineWidth=5; g.shadowColor=col; g.shadowBlur=14; g.strokeRect(5,5,cw-10,ch-10);
    g.fillStyle=col; g.textAlign='center'; g.textBaseline='middle';
    if(o.vert){ const n=txt.length, fs=Math.min(cw*0.8,(ch-14)/n); g.font='bold '+Math.round(fs)+'px Arial Black, Impact, sans-serif'; for(let i=0;i<n;i++){ g.shadowBlur=16; g.fillText(txt[i],cw/2,ch*(i+0.5)/n); g.shadowBlur=0; g.fillStyle='#fff'; g.globalAlpha=0.55; g.fillText(txt[i],cw/2,ch*(i+0.5)/n); g.globalAlpha=1; g.fillStyle=col; } }
    else { const fs=Math.min(ch*0.62,cw/(txt.length*0.68)); g.font='bold '+Math.round(fs)+'px Arial Black, Impact, sans-serif'; g.shadowBlur=18; g.fillText(txt,cw/2,ch/2); g.shadowBlur=0; g.fillStyle='#fff'; g.globalAlpha=0.6; g.fillText(txt,cw/2,ch/2); g.globalAlpha=1; } });
  const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:t,color:new THREE.Color(o.k||1.35,o.k||1.35,o.k||1.35),fog:false})); m.position.set(x,y,z); scene.add(m);
  glow(x,y,z+0.3,Math.max(w,h)*2.4,col,0.42); return m;
}
function windowsGrid(x0,x1,y0,y1,z,cols,rows,seed){
  const r=mulberry32(seed), cw=cols*40, ch=rows*52;
  const t=canvasTex(cw,ch,function(g){ g.fillStyle='rgba(0,0,0,0)'; g.clearRect(0,0,cw,ch); for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){ const lit=r()<0.55, x=i*40+7, y=j*52+9; if(lit){ const c=[ '#ffd890','#ffc070','#bfe8ff','#ffe8c0','#ff9ac8' ][(r()*5)|0]; const gr=g.createLinearGradient(0,y,0,y+34); gr.addColorStop(0,c); gr.addColorStop(1,'#d88a40'); g.fillStyle=gr; } else g.fillStyle='#120e1e'; g.fillRect(x,y,26,34); if(lit){ g.fillStyle='rgba(40,20,10,0.7)'; g.fillRect(x+12,y,2,34); g.fillRect(x,y+16,26,2); } g.fillStyle='rgba(20,16,32,0.9)'; g.fillRect(x-2,y+36,30,4); } });
  const m=new THREE.Mesh(new THREE.PlaneGeometry(x1-x0,y1-y0),new THREE.MeshBasicMaterial({map:t,transparent:true,fog:false})); m.position.set((x0+x1)/2,(y0+y1)/2,z); scene.add(m); return m;
}
function bld(x0,x1,h,col,seed,rows){
  boxR(x0,x1,0.22,h,-18,-9.5,lam(col,{roughness:0.85}));
  const cols=Math.max(2,Math.round((x1-x0)/1.5)); windowsGrid(x0+0.2,x1-0.2,3.4,h-0.5,ZF+0.02,cols,rows||Math.round((h-3.9)/1.5),seed);
  boxR(x0-0.1,x1+0.1,h,h+0.35,-18,-9.3,lam(0x3a3450)); // parapet cap
  const r=mulberry32(seed+3); for(let i=0;i<Math.floor((x1-x0)/2.2);i++){ box(0.9,0.55,0.45,x0+0.9+i*2.1+r(),3.3+r()*(h-5),ZF+0.28,lam(0x6a6a7a,{roughness:0.5})); } // AC units
  for(let k=0;k<2;k++){ box(0.7,1.2,0.7,x0+1+r()*(x1-x0-2),h+0.9,-12+r()*2,lam(0x4a4660)); }
  return col;
}
bld(-13,-5.6,10.5,0x2a2440,11); bld(-5.6,-1.4,7.2,0x34283e,13); bld(0.5,5.8,7.6,0x2a2a44,17); bld(5.8,12,12.5,0x302646,19); bld(-24,-13,13.5,0x241e3a,23); bld(12,24,9.5,0x2c2842,29);
// storefronts (ground floor): bar (left), izakaya, ramen shop, karaoke hotel
neonSign(-9.2,5.6,ZF+0.1,3.0,1.0,'BAR','#ff3a9a'); neonSign(-12.0,7.8,ZF+0.1,1.0,4.6,'COCKTAIL','#38e8ff',{vert:true}); neonSign(-6.4,8.2,ZF+0.1,1.0,3.4,'KARAOKE','#ffe83a',{vert:true});
boxR(-12.8,-6.0,0.22,3.1,ZF,ZF+0.15,lam(0x1a1226)); glowWin(-9.4,1.7,ZF+0.2,2.6,2.2,0,'#ff9ac8','#a8306a','rgba(20,8,20,0.95)',2,1,0.4);
// izakaya: warm window + noren + lantern row
glowWin(-3.5,1.9,ZF+0.2,3.2,2.1,0,'#ffd890','#e88a30','rgba(40,18,8,0.95)',4,1,0.35); boxR(-5.6,-1.4,3.1,3.5,ZF,ZF+0.5,lam(0x1a1226));
for(let i=0;i<8;i++) paperLantern(-5.2+i*0.52,3.35,ZF+0.8,0.24,0xff4030,1.35);
neonSign(-3.5,6.3,ZF+0.1,2.9,0.9,'IZAKAYA','#ff7a3a');
// ramen shop
(function(){
  const x=3.15;
  const inter=canvasTex(256,160,function(g,w,h){ const gr=g.createLinearGradient(0,0,0,h); gr.addColorStop(0,'#ffd890'); gr.addColorStop(1,'#d8782a'); g.fillStyle=gr; g.fillRect(0,0,w,h);
    const rg=g.createRadialGradient(w/2,h*0.35,4,w/2,h*0.35,w*0.7); rg.addColorStop(0,'rgba(255,248,210,0.8)'); rg.addColorStop(1,'rgba(255,200,100,0)'); g.fillStyle=rg; g.fillRect(0,0,w,h);
    g.fillStyle='#3a1c0e'; g.fillRect(0,h*0.62,w,h*0.38); g.fillStyle='#5a2e18'; g.fillRect(0,h*0.58,w,8);
    for(let i=0;i<5;i++){ const sx=24+i*50; g.fillStyle='#1c0e08'; g.beginPath(); g.ellipse(sx,h*0.9,12,6,0,0,6.3); g.fill(); g.fillRect(sx-2,h*0.62,4,h*0.28); g.fillStyle='#f6ecd6'; g.beginPath(); g.ellipse(sx+22,h*0.57,11,5,0,0,6.3); g.fill(); }
    g.fillStyle='#1c0e08'; g.beginPath(); g.arc(60,h*0.33,13,0,6.3); g.fill(); g.fillRect(44,h*0.33+8,32,h*0.2); g.fillStyle='#f6ecd6'; g.fillRect(48,h*0.33-16,24,7);
    for(let i=0;i<3;i++){ g.fillStyle='rgba(255,250,220,1)'; g.beginPath(); g.arc(90+i*60,h*0.12,6,0,6.3); g.fill(); } });
  const m=new THREE.Mesh(new THREE.PlaneGeometry(4.4,2.7),new THREE.MeshBasicMaterial({map:inter,fog:false})); m.position.set(x,1.85,ZF+0.15); scene.add(m);
  boxR(x-2.4,x-2.2,0.22,3.4,ZF,ZF+0.5,lam(0x2a1a14)); boxR(x+2.2,x+2.4,0.22,3.4,ZF,ZF+0.5,lam(0x2a1a14)); boxR(x-2.4,x+2.4,3.2,3.5,ZF,ZF+0.5,lam(0x2a1a14));
  glow(x,1.8,ZF+0.6,9,0xffa850,0.5); glowPlane(x,0.06,-5.0,9,7,0xff9a40,0.5);
  const noren=canvasTex(256,96,function(g,w,h){ g.fillStyle='#1c2a6a'; g.fillRect(0,0,w,h); for(let i=1;i<4;i++){ g.fillStyle='rgba(0,0,0,0.5)'; g.fillRect(i*w/4-1,h*0.3,2,h*0.7); } g.fillStyle='#f4f0e0'; g.font='bold 54px Arial Black, Impact, sans-serif'; g.textAlign='center'; g.textBaseline='middle'; g.fillText('RAMEN',w/2,h*0.42); g.fillStyle='rgba(0,0,0,0.25)'; g.fillRect(0,h-6,w,6); });
  const nm=new THREE.Mesh(new THREE.PlaneGeometry(4.0,1.0),new THREE.MeshStandardMaterial({map:noren,roughness:0.9,emissive:C(0x101030),emissiveIntensity:0.6})); nm.position.set(x,3.1-0.0,ZF+0.35); scene.add(nm);
  paperLantern(x-2.9,1.6,ZF+0.9,0.5,0xff3a28,1.35); paperLantern(x+2.9,1.6,ZF+0.9,0.5,0xff3a28,1.35);
  neonSign(x,6.2,ZF+0.1,4.4,1.2,'NOODLE','#ff3a3a'); neonSign(x+3.3,7.0,ZF+0.1,0.9,3.2,'OPEN24H','#38ffb0',{vert:true});
  plight(x,2.2,-6.0,0xffa850,2.6,15,1.5);
  const st=[]; for(let i=0;i<12;i++){ const s=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,color:C(0xe8dcd0),transparent:true,opacity:0,depthWrite:false,fog:false})); s.renderOrder=6; scene.add(s); st.push({s:s,ph:i/12}); }
  tickers.push(function(t){ st.forEach(function(o){ const u=(t*0.1+o.ph)%1; o.s.position.set(x-1.2+u*1.6+Math.sin(u*9+o.ph*7)*0.2,3.8+u*3.4,ZF+0.6); const sc=0.8+u*2.6; o.s.scale.set(sc,sc,1); o.s.material.opacity=0.22*Math.sin(Math.PI*Math.min(1,u*1.1))*(1-u); }); });
})();
// karaoke hotel: stacked vertical signs
neonSign(7.6,7.5,ZF+0.1,1.1,5.0,'KARAOKE','#ff2aa0',{vert:true}); neonSign(9.4,8.6,ZF+0.1,1.1,4.2,'HOTEL','#38e8ff',{vert:true}); neonSign(11.1,6.2,ZF+0.1,1.0,3.4,'SAKE','#ffe83a',{vert:true});
boxR(6.2,11.8,0.22,3.1,ZF,ZF+0.15,lam(0x1a1226)); glowWin(8.9,1.7,ZF+0.2,4.2,2.2,0,'#a8f0ff','#2a8ab0','rgba(10,20,30,0.95)',3,1,0.4);
// vending machines in the alley mouth
[-0.35,0.2].forEach(function(dx,i){ box(0.75,1.9,0.7,-0.5+dx*1.3,1.17,ZF+0.5,lam(0x1a1a2a,{roughness:0.4})); const f=new THREE.Mesh(new THREE.PlaneGeometry(0.62,1.55),new THREE.MeshBasicMaterial({map:warmWindowTex(i?'#aef0ff':'#ffd0e8',i?'#3a9ac0':'#c04a8a','rgba(20,20,40,0.8)',4,8),fog:false})); f.position.set(-0.5+dx*1.3,1.3,ZF+0.86); scene.add(f); glow(-0.5+dx*1.3,1.3,ZF+1.0,3.0,i?0x58d8ff:0xff7ac8,0.5); });
glowPlane(-0.3,0.06,-6.3,4,3.5,0x58d8ff,0.35);
// alley depth: strings of lanterns & distant red glow
(function(){ for(let i=0;i<9;i++) paperLantern(-0.9+Math.sin(i)*0.2,4.0+i*0.0,ZF-0.5-i*1.0,0.2,0xff5a30,1.3); const L=[]; for(let i=0;i<14;i++) L.push([-0.6+rng()*1.2,0.6+rng()*5.5,ZF-1.5-rng()*7,[0xff6a3a,0xffc060,0x58d8ff][i%3],1]); glowPts(L,0.9,0.9); })();
// utility pole, wires, bicycle, pedestrians
(function(){
  const pm=lam(0x1a1622,{roughness:0.8}); cyl(0.14,0.18,12.5,-1.5,6.2,-5.2,pm,8); box(2.6,0.12,0.12,-1.5,11.2,-5.2,pm); box(2.0,0.12,0.12,-1.5,10.2,-5.2,pm); cyl(0.3,0.3,0.9,-0.4,9.4,-5.2,lam(0x3a3a48,{metalness:0.5}),10);
  const wm=new THREE.LineBasicMaterial({color:C(0x0a0812)});
  function wire(a,b,sag){ const pts=[]; for(let i=0;i<=20;i++){ const t=i/20; pts.push(new THREE.Vector3(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t-Math.sin(t*Math.PI)*sag,a[2]+(b[2]-a[2])*t)); } scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),wm)); }
  [[-2.7,11.2],[-0.3,11.2],[-2.3,10.2],[-0.7,10.2]].forEach(function(p,i){ wire([p[0],p[1],-5.2],[-13+i*0.3,9.5-i*0.5,-9.3],1.2); wire([p[0],p[1],-5.2],[12.5-i*0.4,10.4-i*0.4,-9.3],1.4); wire([p[0],p[1],-5.2],[p[0]+8-i,p[1]-0.5,-24],0.8); });
  // bicycle
  const bm=lam(0x2a2a3a,{metalness:0.5,roughness:0.5}); [[-0.45,0],[0.45,0]].forEach(function(w){ const t=new THREE.Mesh(new THREE.TorusGeometry(0.42,0.03,6,20),bm); t.position.set(-4.0+w[0],0.66,-7.4); scene.add(t); });
  box(0.9,0.04,0.04,-4.0,0.95,-7.4,bm); box(0.04,0.5,0.04,-3.6,1.15,-7.4,bm); box(0.3,0.05,0.12,-4.3,1.3,-7.4,bm);
  // pedestrians with umbrellas
  function person(x,z,umbCol,s){ const g=new THREE.Group(); const coat=lam(0x16121e,{roughness:0.9}); const body=new THREE.Mesh(new THREE.CylinderGeometry(0.22,0.3,1.4,10),coat); body.position.y=0.95; g.add(body); sph(0.17,0,1.85,0,lam(0x2a2030),1,1,1,g);
    const legs=new THREE.Mesh(new THREE.CylinderGeometry(0.16,0.14,0.5,8),coat); legs.position.y=0.26; g.add(legs);
    const um=new THREE.Mesh(new THREE.SphereGeometry(0.95,20,8,0,Math.PI*2,0,Math.PI/2),new THREE.MeshStandardMaterial({color:C(umbCol),roughness:0.5,side:THREE.DoubleSide,emissive:C(umbCol),emissiveIntensity:0.18})); um.position.y=2.35; g.add(um); cyl(0.015,0.015,1.4,0,1.7,0,lam(0x111111),4,g);
    g.position.set(x,0.0,z); g.scale.set(s,s,s); scene.add(g); return g; }
  person(2.0,-3.0,0xd02a40,1.0); person(-6.4,-4.6,0x2a6ad0,0.95); person(6.4,-5.2,0x16121e,1.0);
})();
// far skyline: towers, red lattice tower, lit windows
(function(){
  [[-60,-130,22,16,0x1a1230],[-30,-150,34,14,0x1c1434],[10,-160,28,18,0x1a1230],[40,-140,40,12,0x1e1638],[75,-170,30,22,0x1a1230],[-95,-150,26,20,0x1c1434],[110,-160,36,16,0x1a1230]].forEach(function(b){ const m=new THREE.Mesh(new THREE.BoxGeometry(b[3],b[2],b[3]),new THREE.MeshBasicMaterial({color:C(b[4]),fog:true})); m.position.set(b[0],b[2]/2,b[1]); scene.add(m);
    const L=[]; for(let i=0;i<46;i++) L.push([b[0]-b[3]/2+rng()*b[3],1+rng()*(b[2]-2),b[1]+b[3]/2+0.5,[0xffd890,0xbfe8ff,0xffa8d0][i%3],0.7+rng()*0.6]); glowPts(L,1.3,0.75); });
})();
mist(0,1.2,-6.5,100,3.0,0x9a6ac0,0.10,0);
boxR(-1.6,0.7,0.22,9,-27,-26.5,lam(0x1a1428)); (function(){ const L=[]; for(let i=0;i<30;i++) L.push([-1.4+rng()*2.0,0.8+rng()*6.5,-26.2,[0xffc070,0xff6a3a,0x58d8ff][i%3],1]); glowPts(L,0.8,0.9); })();
// rain
(function(){
  const N=900, pos=new Float32Array(N*6), base=[]; for(let i=0;i<N;i++){ base.push([-16+rng()*32,rng()*26,-12+rng()*46,0.7+rng()*0.5]); }
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.BufferAttribute(pos,3));
  const m=new THREE.LineSegments(g,new THREE.LineBasicMaterial({color:new THREE.Color(0.55,0.6,0.85),transparent:true,opacity:0.15,fog:false,depthWrite:false,blending:THREE.AdditiveBlending})); m.frustumCulled=false; m.renderOrder=9; scene.add(m);
  tickers.push(function(t){ for(let i=0;i<N;i++){ const b=base[i]; let y=(b[1]-t*24*b[3])%26; if(y<0)y+=26; const o=i*6; pos[o]=b[0]+y*0.05; pos[o+1]=y; pos[o+2]=b[2]; pos[o+3]=b[0]+y*0.05+0.05; pos[o+4]=y+0.6*b[3]; pos[o+5]=b[2]; } g.attributes.position.needsUpdate=true; });
})();
