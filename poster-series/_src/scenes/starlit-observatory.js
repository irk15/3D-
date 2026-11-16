/* ================= POSTER 08 — STARLIT OBSERVATORY ================= */
kitSetup({
  fog:[0x0a1530,0.0030],
  sky:{top:[0.010,0.018,0.085],mid:[0.025,0.055,0.19],hor:[0.10,0.17,0.38],sun:[0,0,-1],glowCol:[0.2,0.4,0.9],glowAmt:0.2,glowPow:3,band:0.1,
       stars:{n:1800,y0:0.02,op:1.0,size:1.5},
       extra:[
        ' vec3 mn=normalize(vec3(-0.35,0.40,0.08)); float mb=dot(normalize(vD),mn);',
        ' float mwc=exp(-mb*mb/0.0045); float mwb=exp(-mb*mb/0.03);',
        ' float dust=fbm(vec2(vD.x*9.0+2.0,vD.y*9.0+vD.z*2.0)); float cl=fbm(vec2(vD.x*70.0,vD.y*70.0));',
        ' float mw=(0.18*mwb+0.8*mwc)*(0.25+1.1*smoothstep(0.32,0.7,dust))*(0.35+0.9*cl);',
        ' vec3 mc=mix(vec3(0.42,0.55,1.0),vec3(0.95,0.85,0.8),mwc*smoothstep(0.5,0.9,cl));',
        ' c+=pow(mc,vec3(2.2))*mw*0.55;',
        ' c+=vec3(0.9,0.95,1.0)*smoothstep(0.78,0.88,fbm(vec2(vD.x*220.0,vD.y*220.0)))*mwb*0.5;'
       ].join('\n')},
  light:{hemi:[0x2a3a82,0x080c20,0.55],rim:[0x8aa0ff,0.40,-20,30,-80],fill:[0x4a62b8,0.30,-6,10,60]},
  water:{x0:-400,x1:400,z0:-3,z1:60,deep:[0.006,0.014,0.06],mid:[0.02,0.05,0.16],rip:0.12,rmin:0.32,gain:0.95},
  core:[0x0c1a20],leaf:{a:{h:[0.3,0.4],s:[0.3,0.5],l:[0.03,0.1],size:0.2}},
  env:{top:[0.04,0.07,0.26],hor:[0.12,0.20,0.42],k:0.65},
  exposure:1.0,bloom:[0.65,0.9,0.72],grade:{sh:[0.88,0.96,1.16],hi:[1.03,1.0,0.94],vig:0.42},
  cam:{fov:32,t:[1.2,6.0,-9],az:-0.03,el:-0.03,rad:46,lim:{r0:32,r1:70}}
});
const rockG=lam(0x1a2434,{roughness:1.0});
boxR(-300,300,-3,0.5,-80,-3,rockG);
const HX=9.5, HZ=-9.5, HRX=8.5, HRY=4.8, HRZ=5.2;
function hillY(x,z){ const a=1-((x-HX)/HRX)*((x-HX)/HRX)-((z-HZ)/HRZ)*((z-HZ)/HRZ); return a>0?HRY*Math.sqrt(a)-0.2:-1; }
(function(){
  const g=new THREE.SphereGeometry(1,40,20,0,Math.PI*2,0,Math.PI/2); const m=new THREE.Mesh(g,lam(0x202a3c,{roughness:1})); m.position.set(HX,-0.2,HZ); m.scale.set(HRX,HRY,HRZ); scene.add(m);
  const R=new Merger(); for(let i=0;i<110;i++){ const a=rng()*Math.PI*2, f=0.55+rng()*0.5, x=HX+Math.cos(a)*HRX*f, z=HZ+Math.sin(a)*HRZ*f; const hy=Math.max(0.1,hillY(x,z)); R.add(rockGeo(0.4+rng()*1.1),mtx(x,hy*(0.2+rng()*0.7),z,rng(),rng()*6,rng(),1.3,0.9,1.2),new THREE.Color().setHSL(0.62,0.2,0.06+rng()*0.1).getHex()); }
  for(let i=0;i<60;i++){ R.add(rockGeo(0.4+rng()*1.2),mtx(-40+rng()*80,0.1+rng()*0.3,-3.5-rng()*4,rng(),rng()*6,rng(),1.4,0.8,1.2),new THREE.Color().setHSL(0.62,0.2,0.05+rng()*0.08).getHex()); }
  R.mesh(new THREE.MeshStandardMaterial({vertexColors:true,roughness:0.9}));
})();
// observatory
(function(){
  const y0=hillY(9.0,-9.5)+0.1, white=lam(0xc4ccdc,{roughness:0.45,metalness:0.25});
  cyl(3.8,4.0,0.6,9.0,y0+0.2,-9.5,lam(0x3a4254),28);
  cyl(3.0,3.0,2.6,9.0,y0+1.8,-9.5,white,32);
  for(let i=0;i<24;i++){ const a=i/24*Math.PI*2; box(0.06,2.6,0.06,9.0+Math.cos(a)*3.02,y0+1.8,-9.5+Math.sin(a)*3.02,lam(0x8a92a4)); }
  const R=3.15, cy=y0+3.1;
  const dome=new THREE.Mesh(new THREE.SphereGeometry(R,40,20,Math.PI/2+0.2,Math.PI*2-0.4,0,Math.PI/2),new THREE.MeshStandardMaterial({color:C(0xd8deec),roughness:0.35,metalness:0.35,side:THREE.DoubleSide})); dome.position.set(9.0,cy,-9.5); scene.add(dome);
  const inner=new THREE.Mesh(new THREE.SphereGeometry(R*0.96,24,12,0,Math.PI*2,0,Math.PI/2),new THREE.MeshBasicMaterial({color:C(0x5a1810),side:THREE.BackSide,fog:false})); inner.position.set(9.0,cy,-9.5); scene.add(inner);
  // slit glow + telescope tube
  cyl(0.28,0.34,2.6,9.0,cy+1.5,-9.5+0.9,lam(0x20242c,{metalness:0.6,roughness:0.4}),12).rotation.x=0.55;
  glow(9.0,cy+R*0.7,-9.5+R*0.9,4.5,0xff7a48,0.3);
  // laser guide star
  const lz=new THREE.Mesh(new THREE.CylinderGeometry(0.035,0.05,90,6,1,true),new THREE.MeshBasicMaterial({color:new THREE.Color(0.3,1.6,0.7),transparent:true,opacity:0.8,blending:THREE.AdditiveBlending,depthWrite:false,fog:false})); lz.position.set(9.0,cy+R*0.8+45,-9.5+R*0.9); scene.add(lz);
  const lz2=new THREE.Mesh(new THREE.CylinderGeometry(0.2,0.3,90,10,1,true),new THREE.MeshBasicMaterial({color:new THREE.Color(0.05,0.35,0.15),transparent:true,opacity:0.35,blending:THREE.AdditiveBlending,depthWrite:false,fog:false})); lz2.position.copy(lz.position); scene.add(lz2);
  glow(9.0,cy+R*0.8,-9.5+R*0.9,3.5,0x60ffa0,0.8);
  // annex
  boxR(2.8,6.2,y0,y0+2.6,-11.6,-7.6,lam(0xb8c0d0,{roughness:0.8})); boxR(2.6,6.4,y0+2.6,y0+2.85,-11.8,-7.4,lam(0x4a5264));
  [[3.6],[5.4]].forEach(function(w){ glowWin(w[0],y0+1.5,-7.55,1.2,1.0,0,'#ffe8b0','#f4b050','rgba(40,20,8,0.95)',2,2,0.3); });
  box(0.9,1.8,0.1,4.5,y0+0.95,-7.55,lam(0x2a2030)); plight(4.5,y0+1.8,-6.5,0xffc070,1.6,10,1.5);
  box(0.9,0.05,3.0,6.6,y0+0.1,-7.2,lam(0x3a4254)); cyl(0.04,0.04,1.1,6.9,y0+0.7,-6.2,lam(0x20242c),6); box(0.2,0.25,0.2,6.9,y0+1.3,-6.2,bas(0xffd890)); glow(6.9,y0+1.3,-6.2,2.4,0xffc070,0.6);
  // path lights from the shore
  const P=[]; for(let i=0;i<12;i++){ const t=i/11; P.push([1.0+t*5.5-0.5*Math.sin(t*6),0.7+t*(y0-0.2),-2.5-t*5.5,0xffc878,1]); } glowPts(P,0.7,0.95);
})();
// camp on the shore: tent, fire, telescope, stargazers
(function(){
  const tg=new THREE.Shape(); tg.moveTo(-1.4,0); tg.lineTo(1.4,0); tg.lineTo(0,1.7); tg.closePath();
  const tent=new THREE.Mesh(new THREE.ExtrudeGeometry(tg,{depth:2.4,bevelEnabled:false}),new THREE.MeshStandardMaterial({color:C(0xe08a40),roughness:0.8,emissive:C(0xc86a20),emissiveIntensity:0.9})); tent.position.set(-7.0,0.5,-5.6); tent.rotation.y=0.25; scene.add(tent);
  glow(-7.0,1.3,-5.0,4.5,0xffa040,0.45); plight(-6.6,1.2,-4.0,0xffa040,1.6,10,1.5);
  const fx=-3.4, fz=-1.6; for(let i=0;i<6;i++){ const a=i/6*6.28; cyl(0.07,0.07,0.7,fx+Math.cos(a)*0.35,0.65,fz+Math.sin(a)*0.35,lam(0x2a1a10),5).rotation.z=0.5; }
  const fl=glow(fx,0.9,fz,1.7,0xff8a30,0.95), fl2=glow(fx,0.9,fz,3.8,0xff7a20,0.3), fp=plight(fx,1.0,fz+0.6,0xff8a30,1.8,12,1.4);
  tickers.push(function(t){ const k=0.85+0.15*Math.sin(t*13)+0.08*Math.sin(t*29); fl.material.opacity=0.9*k; fp.intensity=1.8*k; fl2.material.opacity=0.3*k; });
  for(let i=0;i<7;i++){ const a=i/7*6.28; sph(0.28,fx+Math.cos(a)*1.4,0.7,fz+Math.sin(a)*1.4,lam(0x1a2030,{roughness:1}),1,0.7,1); }
  function seated(x,z,ry){ const g=new THREE.Group(), cm=lam(0x14101c,{roughness:0.9}); const b=new THREE.Mesh(new THREE.CylinderGeometry(0.2,0.3,0.9,10),cm); b.position.y=0.95; g.add(b); sph(0.16,0,1.55,0,lam(0x2a2030),1,1,1,g); const l=new THREE.Mesh(new THREE.BoxGeometry(0.4,0.2,0.7),cm); l.position.set(0,0.55,0.35); g.add(l); g.position.set(x,0.0,z); g.rotation.y=ry; scene.add(g); }
  seated(-4.9,-0.2,-0.9); seated(-2.2,-0.4,0.9);
  // telescope on tripod
  const tm=lam(0x20242c,{metalness:0.6,roughness:0.4}); const tx=0.2, tz=0.2;
  [0,2.1,4.2].forEach(function(a){ const l=cyl(0.03,0.03,1.6,tx+Math.cos(a)*0.4,0.85,tz+Math.sin(a)*0.4,tm,5); l.rotation.z=Math.cos(a)*0.28; l.rotation.x=-Math.sin(a)*0.28; });
  const tube=cyl(0.13,0.15,1.7,tx,2.0,tz,lam(0xd8dce8,{roughness:0.4,metalness:0.3}),12); tube.rotation.z=0.75; tube.rotation.x=0.3;
})();
// peaks and forest
ridge(-95,-260,260,-4,6,7,0x0c1630,31,3.0); ridge(-150,-340,340,-6,12,12,0x121f40,17,2.4); ridge(-220,-480,480,-10,22,18,0x1a2c54,7,2.0);
(function(){ const L=[]; for(let i=0;i<90;i++){ const x=-90+rng()*60, z=-12-rng()*40; L.push([x,z,5+rng()*8,1.3+rng()*0.9,0x081a24,0.5]); } for(let i=0;i<30;i++){ L.push([-30-rng()*50,-6-rng()*30,5+rng()*8,1.3+rng()*0.9,0x081a24,0.5]); } forest(L); })();
mist(0,1.0,-4,150,3.5,0x4a68b0,0.14,0);
