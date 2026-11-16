/* ================= POSTER 10 — REDWOOD TREEHOUSE ================= */
kitSetup({
  fog:[0x9a7ea0,0.0066],
  sky:{top:[0.16,0.20,0.40],mid:[0.52,0.42,0.60],hor:[1.0,0.74,0.58],sun:[0.12,0.16,-1],glowCol:[1.0,0.72,0.45],glowAmt:1.0,glowPow:24,halo:0.25,band:0.4,
       disc:{dir:[0.12,0.16,-1],col:[3.2,2.3,1.4],size:6.0,glow:0xffc890,gop:0.5,gsize:70}},
  light:{hemi:[0x9ab0b8,0x30242c,0.5],rim:[0xffb890,1.2,12,16,-60],fill:[0x8aa8c0,0.30,-6,10,60]},
  water:{x0:-300,x1:300,z0:-4.2,z1:60,deep:[0.05,0.09,0.12],mid:[0.12,0.18,0.24],rip:0.4,rmin:0.22,gain:0.85},
  core:[0x1c3c2a,0x264c32,0x183a30],
  leaf:{canopy:{h:[0.28,0.38],s:[0.3,0.5],l:[0.05,0.2],size:0.5,dens:40,cap:300},fern:{h:[0.25,0.35],s:[0.4,0.6],l:[0.07,0.26],size:0.24,dens:150,cap:300}},
  env:{top:[0.30,0.36,0.50],hor:[0.95,0.70,0.60],k:0.55},
  exposure:0.95,bloom:[0.7,0.9,0.7],grade:{sh:[0.9,1.0,1.08],hi:[1.10,0.98,0.88],vig:0.4},
  cam:{fov:32,t:[0,11.2,-9],az:-0.03,el:-0.17,rad:46,lim:{r0:32,r1:70,e0:-0.26,e1:0.1}}
});
// ground
boxR(-300,300,-3,0.45,-200,-4.0,lam(0x2a3a2c,{roughness:1}));
(function(){ const M=new Merger(); for(let i=0;i<70;i++){ M.add(rockGeo(0.4+rng()*1.0),mtx(-30+rng()*60,0.25,-4.4-rng()*3,rng(),rng()*6,rng(),1.4,0.8,1.2),new THREE.Color().setHSL(0.25,0.2,0.07+rng()*0.1).getHex()); } M.mesh(new THREE.MeshStandardMaterial({vertexColors:true,roughness:0.95})); })();
for(let i=0;i<40;i++) blob(-22+rng()*44,0.55,-5.0-rng()*7,0.8+rng()*1.1,0.3+rng()*0.3,0.7+rng()*0.8,'fern');
// redwood trunks
const bark=barkMat(0x7a4636); bark.map.repeat.set(3,14);
function trunk(x,z,r,H,mat){ const g=new THREE.CylinderGeometry(r*0.55,r*1.05,H,16,6,true); const m=new THREE.Mesh(g,mat||bark); m.position.set(x,H/2-0.5,z); scene.add(m);
  const f=new THREE.Mesh(new THREE.CylinderGeometry(r*1.05,r*1.6,1.8,16,1,true),mat||bark); f.position.set(x,0.5,z); scene.add(f); return m; }
trunk(-5.7,-9.0,1.9,90); trunk(5.8,-9.0,2.1,90);
trunk(-10.8,-6.5,2.3,90); trunk(11.2,-7.5,2.0,90); trunk(-15,-11,2.0,90); trunk(15.5,-13,2.2,90);
(function(){ for(let i=0;i<60;i++){ const x=-60+rng()*120, z=-17-rng()*80; if(Math.abs(x)<4&&z>-26) continue; trunk(x,z,1.0+rng()*1.5,90); } })();
// canopy masses far up
for(let i=0;i<36;i++){ blob(-50+rng()*100,27+rng()*10,-16-rng()*70,5+rng()*5,2.2+rng()*1.5,5+rng()*5,'canopy'); }
// ---- treehouse ----
(function(){
  const Y0=8.2, wood=lam(0x6a4430,{roughness:0.85}), woodD=lam(0x3a261a,{roughness:0.9}), plank=canvasTex(128,128,function(g,w,h){ for(let x=0;x<w;x+=16){ const k=80+rng()*50|0; g.fillStyle='rgb('+(k+60)+','+(k+30)+','+(k-5)+')'; g.fillRect(x,0,16,h); g.fillStyle='rgba(0,0,0,0.5)'; g.fillRect(x+14,0,2,h); for(let i=0;i<4;i++){ g.fillStyle='rgba(0,0,0,0.15)'; g.fillRect(x+rng()*10,rng()*h,2,10+rng()*30); } } });
  plank.wrapS=plank.wrapT=THREE.RepeatWrapping; plank.repeat.set(4,1);
  const wall=new THREE.MeshStandardMaterial({map:plank,color:C(0xd8b08a),roughness:0.85});
  // deck
  boxR(-8.0,8.0,Y0-0.35,Y0,-11.4,-6.4,woodD); for(let i=0;i<24;i++) boxR(-8.0,8.0,Y0,Y0+0.04,-11.4+i*0.21,-11.4+i*0.21+0.02,lam(0x2a1a10));
  [[-6.8,-7],[-3.0,-7],[3.0,-7],[6.8,-7],[-6.8,-10.8],[6.8,-10.8]].forEach(function(p){ const c=cyl(0.1,0.1,3.4,p[0]*1.0,Y0-1.9,p[1],woodD,6); c.rotation.z=(p[0]>0?1:-1)*0.5; c.position.x=p[0]*(Math.abs(p[0])>4?0.78:1.0); });
  // house
  boxR(-3.6,3.6,Y0,Y0+3.0,-11.0,-7.6,wall);
  boxR(-3.8,3.8,Y0+3.0,Y0+3.14,-11.2,-7.4,woodD);
  const rm=new THREE.MeshStandardMaterial({color:C(0x4a3a2e),roughness:0.9}); const roof=new THREE.Mesh(gableGeo(5.0,8.8,2.3),rm); roof.rotation.y=Math.PI/2; roof.position.set(0,Y0+3.1,-9.3); scene.add(roof);
  const moss=new THREE.Mesh(gableGeo(5.1,8.9,2.35),new THREE.MeshStandardMaterial({color:C(0x2a4a2a),roughness:1,transparent:true,opacity:0.55})); moss.rotation.y=Math.PI/2; moss.position.set(0,Y0+3.16,-9.3); scene.add(moss);
  [[-2.3],[2.3]].forEach(function(w){ boxR(w[0]-1.0,w[0]+1.0,Y0+0.9,Y0+2.5,-7.62,-7.52,woodD); glowWin(w[0],Y0+1.7,-7.5,1.7,1.5,0,'#ffe9a8','#f4aa44','rgba(40,18,6,0.95)',3,2,0.35); });
  box(1.1,2.1,0.1,0,Y0+1.05,-7.55,lam(0x2a1810)); glowWin(0,Y0+1.6,-7.48,0.5,0.5,0,'#ffe9a8','#f4aa44','rgba(40,18,6,0.95)',1,1,0.2);
  // round attic window
  const rw=new THREE.Mesh(new THREE.CircleGeometry(0.55,24),new THREE.MeshBasicMaterial({color:new THREE.Color(1.6,1.2,0.65),fog:false})); rw.position.set(0,Y0+4.2,-8.1); scene.add(rw); glow(0,Y0+4.2,-8.0,3.2,0xffb860,0.5);
  // railing
  const R=new Merger(); for(let i=0;i<30;i++) R.add(new THREE.BoxGeometry(0.08,1.0,0.08),mtx(-7.9+i*0.55,Y0+0.5,-6.5),0x2a1a10); R.add(new THREE.BoxGeometry(16,0.08,0.1),mtx(0,Y0+1.02,-6.5),0x3a261a); R.add(new THREE.BoxGeometry(16,0.05,0.06),mtx(0,Y0+0.55,-6.5),0x3a261a); R.mesh();
  // lanterns
  for(let i=0;i<7;i++) paperLantern(-6.6+i*2.2,Y0+2.6+(i%2)*0.3,-6.6,0.26,0xffffff,1.3);
  paperLantern(-4.2,Y0+3.8,-7.4,0.3,0xffd08a,1.3); paperLantern(4.2,Y0+3.8,-7.4,0.3,0xffd08a,1.3);
  // string lights to the trunks
  (function(){ const L=[]; [[-3.7,Y0+3.2,-7.4,-5.7,Y0+5.6,-7.4],[3.7,Y0+3.2,-7.4,5.8,Y0+6.2,-7.4],[-3.7,Y0+3.2,-7.4,3.7,Y0+3.2,-7.4]].forEach(function(s){ for(let i=0;i<=16;i++){ const t=i/16; L.push([s[0]+(s[3]-s[0])*t,s[1]+(s[4]-s[1])*t-Math.sin(t*Math.PI)*0.8,s[2]+(s[5]-s[2])*t,0xffd890,1.2]); } }); glowPts(L,0.5,0.95); })();
  plight(0,Y0+2.2,-6.0,0xffb458,2.4,16,1.5); plight(-6,Y0+2.4,-6.2,0xffa848,1.0,10,1.6); plight(6,Y0+2.4,-6.2,0xffa848,1.0,10,1.6);
  // spiral stair around the left trunk
  (function(){ const S=new Merger(); const n=44; for(let i=0;i<n;i++){ const t=i/(n-1), a=0.35*Math.PI+t*Math.PI*3.2, rr=3.1, y=0.7+t*(Y0-0.5); S.add(new THREE.BoxGeometry(1.1,0.12,0.5),mtx(-5.7+Math.cos(a)*rr,y,-9.0+Math.sin(a)*rr,0,-a,0),0x4a3020); S.add(new THREE.CylinderGeometry(0.03,0.03,1.0,4),mtx(-5.7+Math.cos(a)*(rr+0.55),y+0.5,-9.0+Math.sin(a)*(rr+0.55)),0x2a1a10); } S.mesh(); })();
  // rope bridge to the pod on the right
  (function(){ const a=new THREE.Vector3(8.0,Y0+0.0,-8.9), b=new THREE.Vector3(12.8,Y0+2.6,-9.4); const P=new Merger(), pts1=[], pts2=[]; const N=16;
    for(let i=0;i<=N;i++){ const t=i/N, x=a.x+(b.x-a.x)*t, y=a.y+(b.y-a.y)*t-Math.sin(t*Math.PI)*0.6, z=a.z+(b.z-a.z)*t; if(i<N) P.add(new THREE.BoxGeometry(0.38,0.07,1.3),mtx(x,y,z,0,0,Math.atan2(b.y-a.y,b.x-a.x)),0x4a3020); pts1.push(new THREE.Vector3(x,y+1.0,z-0.65)); pts2.push(new THREE.Vector3(x,y+1.0,z+0.65)); if(i%2===0){ P.add(new THREE.CylinderGeometry(0.02,0.02,1.0,4),mtx(x,y+0.5,z-0.65),0x2a1a10); P.add(new THREE.CylinderGeometry(0.02,0.02,1.0,4),mtx(x,y+0.5,z+0.65),0x2a1a10); } }
    P.mesh(); const lm=new THREE.LineBasicMaterial({color:C(0x2a1a10)}); scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts1),lm)); scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts2),lm));
    boxR(11.8,15.4,b.y-0.3,b.y,-11.0,-7.8,woodD); boxR(12.2,14.8,b.y,b.y+2.1,-10.6,-8.4,wall); const r2=new THREE.Mesh(pyramidGeo(3.5,3.0,1.5),rm); r2.position.set(13.5,b.y+2.1,-9.5); scene.add(r2); glowWin(13.5,b.y+1.1,-8.38,1.0,0.9,0,'#ffe9a8','#f4aa44','rgba(40,18,6,0.95)',2,2,0.3); plight(13.5,b.y+1.2,-7.8,0xffb458,1.2,9,1.6); })();
})();
// light shafts, mist, motes
(function(){ const t=canvasTex(64,256,function(g,w,h){ const gr=g.createLinearGradient(0,0,0,h); gr.addColorStop(0,'rgba(255,255,255,0)'); gr.addColorStop(0.25,'rgba(255,255,255,0.8)'); gr.addColorStop(1,'rgba(255,255,255,0)'); g.fillStyle=gr; g.fillRect(0,0,w,h); const gh=g.createLinearGradient(0,0,w,0); gh.addColorStop(0,'rgba(0,0,0,1)'); gh.addColorStop(0.5,'rgba(0,0,0,0)'); gh.addColorStop(1,'rgba(0,0,0,1)'); g.globalCompositeOperation='destination-out'; g.fillStyle=gh; g.fillRect(0,0,w,h); });
  [[-14,-22,4],[-7,-26,6],[-1,-30,3],[5,-24,5],[10,-28,4],[16,-22,6]].forEach(function(s,i){ const m=new THREE.Mesh(new THREE.PlaneGeometry(s[2],46),new THREE.MeshBasicMaterial({map:t,color:C(0xffc890),transparent:true,opacity:0.22,blending:THREE.AdditiveBlending,depthWrite:false,fog:false,side:THREE.DoubleSide})); m.position.set(s[0],14,s[1]); m.rotation.z=-0.3; m.renderOrder=3; scene.add(m); tickers.push(function(tm){ m.material.opacity=0.2+0.06*Math.sin(tm*0.3+i*1.7); }); }); })();
mist(0,2.0,-12,160,12,0xd8b0b8,0.22,0); mist(0,3.0,-30,200,16,0xc8a8c0,0.22,0); mist(0,1.0,-6,120,4,0xc8b8c8,0.16,0); mist(0,5.0,-55,260,20,0xd0a8b8,0.2,0);
fireflies(60,-14,14,3,16,-12,-3,0xfff0c0,0.3);
