import {createLife,activityLabels} from './life.js?v=3';
import * as T from 'three';
import {RoundedBoxGeometry} from './vendor/RoundedBoxGeometry.js';
import {OrbitControls} from './vendor/OrbitControls.js';
const scene=new T.Scene();scene.background=new T.Color('#e8ddc9');scene.fog=new T.Fog('#e8ddc9',24,65);
let renderer;try{renderer=new T.WebGLRenderer({antialias:true,powerPreference:'high-performance'});}catch(e){document.querySelector('#loading').textContent='This scene needs a browser with WebGL enabled.';throw e}renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;document.body.prepend(renderer.domElement);
const camera=new T.PerspectiveCamera(35,innerWidth/innerHeight,.1,100);camera.position.set(15,12,18);const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,3,0);controls.enableDamping=true;controls.minDistance=7;controls.maxDistance=32;controls.maxPolarAngle=Math.PI*.48;controls.autoRotate=true;controls.autoRotateSpeed=.32;
const hemi=new T.HemisphereLight(0xffe7ba,0x8b7768,2.7);scene.add(hemi);const sun=new T.DirectionalLight(0xffdfac,4.2);sun.position.set(-7,14,9);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-14,right:14,top:14,bottom:-14});sun.shadow.normalBias=.035;sun.shadow.bias=-.0002;sun.shadow.radius=4;scene.add(sun);
const M={};function mat(c,extra={}){let key=c+JSON.stringify(extra);return M[key]??=new T.MeshStandardMaterial({color:c,roughness:.72,...extra})}const red=mat('#b33127'),gold=mat('#cda965'),cream=mat('#edcd95'),wood=mat('#a66f3d'),dark=mat('#38382e');
const shapeCache=new Map();function rounded(w,h,d){let key=[w,h,d].join();if(!shapeCache.has(key))shapeCache.set(key,new RoundedBoxGeometry(w,h,d,2,Math.min(w,h,d)*.12));return shapeCache.get(key)}
function box(w,h,d,m,x=0,y=0,z=0,p=scene){const o=new T.Mesh(rounded(w,h,d),m);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;p.add(o);return o}function sphere(r,m,x,y,z,p=scene,sx=1,sy=1,sz=1){const o=new T.Mesh(new T.SphereGeometry(r,20,16),m);o.position.set(x,y,z);o.scale.set(sx,sy,sz);o.castShadow=true;p.add(o);return o}function cyl(r1,r2,h,m,x,y,z,p=scene){const o=new T.Mesh(new T.CylinderGeometry(r1,r2,h,16),m);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;p.add(o);return o}
function text(t,w,h,x,y,z,color='#ffe2a7',bg=null,p=scene){const c=document.createElement('canvas');c.width=1024;c.height=256;let a=c.getContext('2d');if(bg){a.fillStyle=bg;a.fillRect(0,0,1024,256)}a.fillStyle=color;a.textAlign='center';a.textBaseline='middle';a.font='bold 155px Arial';a.fillText(t,512,135,980);const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;const o=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({map:tex,transparent:true,side:T.DoubleSide}));o.position.set(x,y,z);p.add(o);return o}
let seed=12;function rnd(){seed=(seed*16807)%2147483647;return(seed-1)/2147483646}
box(12,.5,11,mat('#ad9a7e'),0,-.25,0);box(11.8,.13,10.8,mat('#c6b697'),0,.065,0);box(200,.1,200,mat('#dfd2bb'),0,-.6,0);
const cobbleGeo=new T.BoxGeometry(.34,.075,.23);const cobble=new T.InstancedMesh(cobbleGeo,mat('#bcb1a0'),1600);let n=0;const dummy=new T.Object3D();for(let x=-5.7;x<5.8;x+=.38)for(let z=-5.2;z<5.3;z+=.27){if(Math.abs(x)<2.8&&Math.abs(z)<2.5)continue;dummy.position.set(x+((Math.round(z/.27)%2)*.14),.16,z);dummy.rotation.y=(rnd()-.5)*.07;dummy.scale.set(1,.8+rnd()*.3,1);dummy.updateMatrix();cobble.setMatrixAt(n,dummy.matrix);cobble.setColorAt(n++,new T.Color().setHSL(.10,.09,.48+rnd()*.18));}cobble.count=n;cobble.receiveShadow=true;scene.add(cobble);
// Two open, richly furnished floors.
const building=new T.Group();scene.add(building);box(5.6,.3,4.8,gold,0,.4,0,building);for(let f=0;f<2;f++){const y=.55+f*2.65;box(5.2,.12,4.4,wood,0,y,0,building);for(let k=0;k<22;k++)box(5.15,.012,.012,mat('#79512f'),0,y+.065,-2.1+k*.2,building);box(5.35,2.45,.15,cream,0,y+1.2,-2.2,building);box(.16,2.45,4.5,cream,-2.65,y+1.2,0,building);for(const x of [-2.65,2.65])for(const z of [-2.2,2.2])box(.22,2.5,.22,f?red:gold,x,y+1.2,z,building);box(5.7,.32,4.85,f?red:gold,0,y+2.5,0,building);
for(const x of [-1.65,0,1.65])box(.045,2.4,.045,gold,x,y+1.2,2.2,building);box(.045,2.4,.045,gold,2.65,y+1.2,0,building);box(5.2,.045,.045,gold,0,y+.16,2.22,building);
const glass=mat('#d7eddd',{transparent:true,opacity:.075,roughness:.1,metalness:.15,depthWrite:false});box(5.05,2.25,.015,glass,0,y+1.2,2.21,building);box(.015,2.25,4.2,glass,2.66,y+1.2,0,building);
for(let shelf=0;shelf<3;shelf++){let sy=y+.45+shelf*.55;box(3.8,.08,.5,wood,-.3,sy,-1.8,building);for(let j=0;j<8;j++){let x=-1.9+j*.47;box(.3,.27,.22,mat(['#b62c21','#343231','#d6b582'][j%3]),x,sy+.18,-1.8,building);if(j%2===0)text('N',.16,.18,x,sy+.18,-1.68,'#f3cb83',null,building)}}
box(2.5,.8,.65,cream,.45,y+.46,.6,building);box(2.65,.08,.78,gold,.45,y+.9,.6,building);box(.4,.3,.06,dark,1.25,y+1.12,.55,building).rotation.x=-.2;box(.06,.2,.1,dark,1.25,y+.96,.54,building);for(let j=0;j<4;j++){box(.22,.26,.12,mat(j%2?'#b52f21':'#534339'),-.45+j*.32,y+1.08,.8,building);text('N',.12,.16,-.45+j*.32,y+1.1,.865,'#f1d39b',null,building)}
text('NETFLIX',2,.48,.1,y+1.9,-2.1,'#bf3127',null,building);const light=new T.PointLight(0xffb44f,19,7,2);light.position.set(0,y+2,0);scene.add(light);
box(3.6,.025,.12,mat('#ffdf95',{emissive:'#ffba44',emissiveIntensity:2}),0,y+2.31,-1.7,building);
}
box(5.8,.24,4.9,red,0,5.9,0,building);for(const z of [-2.4,2.4])box(5.8,.25,.13,red,0,6.12,z,building);for(const x of [-2.84,2.84])box(.13,.25,4.8,red,x,6.12,0,building);box(1,.15,.9,mat('#88887b'),.6,6.13,-.7,building);cyl(.3,.3,.04,dark,.6,6.23,-.7,building);
box(4.1,.8,.14,red,-.3,6.65,1.85,building);text('NETFLIX',3.8,.8,-.3,6.66,1.94,'#f0c875',null,building);text('NETFLIX',1.5,.38,-1.2,2.52,2.34,'#b52f25',null,building);
// Plants, lamps and hand-built street furniture.
function plant(x,z,s=1,y=.2,p=scene){cyl(.19*s,.13*s,.3*s,mat('#b36e44'),x,y+.15*s,z,p);cyl(.16*s,.16*s,.015,mat('#4b4230'),x,y+.31*s,z,p);for(let i=0;i<9;i++){const a=i*2.4;let leaf=sphere(.15*s,mat(i%2?'#69783c':'#8d984f'),x+Math.cos(a)*.13*s,y+.36*s+i*.035*s,z+Math.sin(a)*.13*s,p,.5,1.6,.65);leaf.rotation.z=Math.cos(a)*.8;}}for(const [x,z,s]of[[-3,2.7,1.5],[2.9,2.6,1.3],[-3.2,-1,1.6],[2.9,-2.5,1.8],[-1,4,1],[1.9,3.1,1]])plant(x,z,s);
function bench(x,z,angle=0){const g=new T.Group();g.position.set(x,.22,z);g.rotation.y=angle;scene.add(g);for(let i=0;i<4;i++)box(1.4,.06,.12,wood,0,.43,-.2+i*.14,g);for(let i=0;i<3;i++)box(1.4,.12,.06,wood,0,.65+i*.15,-.28,g);for(const a of[-.5,.5]){box(.08,.45,.48,dark,a,.22,0,g);box(.06,.7,.07,dark,a,.65,-.3,g)}}bench(-3.8,2.4,.2);bench(.4,4.3,0);
const lampBulbs=[];function lamp(x,z){cyl(.21,.25,.1,dark,x,.24,z);cyl(.07,.11,2.2,dark,x,1.4,z);box(.4,.08,.4,dark,x,2.59,z);const bulb=box(.28,.4,.28,mat('#ffdf8d',{emissive:'#ffc156',emissiveIntensity:2.5}),x,2.83,z);lampBulbs.push(bulb);const cap=new T.Mesh(new T.ConeGeometry(.35,.22,4),dark);cap.position.set(x,3.14,z);cap.rotation.y=Math.PI/4;scene.add(cap);cyl(.035,.035,.15,dark,x,3.3,z);const l=new T.PointLight(0xffbb57,6,4);l.position.set(x,2.7,z);scene.add(l)}lamp(-4.7,3.8);lamp(2.2,4);lamp(4.7,-1.8);
for(const x of [-3.2,3.3]){box(.43,.75,.4,red,x,.65,3.4);sphere(.22,red,x,1.02,3.4,scene,1,1,.9);box(.23,.065,.02,dark,x,.94,3.61);text('POST',.26,.12,x,.75,3.61)}
// Chibi residents with separate animated limbs.
const residents=[];
function person(x,z,color,y=.22,walk=true,scale=1){
 const g=new T.Group(), body=new T.Group();g.position.set(x,y,z);g.scale.setScalar(scale);scene.add(g);g.add(body);
 const skin=mat('#e7b982'),hair=mat(['#473124','#6d442b','#302d26'][Math.floor(rnd()*3)]),cloth=mat(color),pants=mat('#49474b');
 sphere(.23,cloth,0,.53,0,body,1,1.3,.83);cyl(.105,.105,.10,skin,0,.8,0,body);
 const legs=[],arms=[];
 for(const a of[-1,1]){const leg=new T.Group();leg.position.set(a*.115,.35,0);body.add(leg);box(.145,.23,.17,pants,0,-.11,0,leg);box(.17,.10,.25,mat('#f0dec3'),0,-.25,.035,leg);box(.175,.025,.26,mat('#b9a78d'),0,-.29,.035,leg);legs.push(leg);
 const arm=new T.Group();arm.position.set(a*.23,.68,0);body.add(arm);sphere(.09,cloth,0,-.075,0,arm,1,1.5,1);sphere(.074,skin,0,-.225,0,arm,1,1.1,1);arms.push(arm);}
 const head=new T.Group();head.position.y=.98;body.add(head);sphere(.33,skin,0,0,0,head,1,.98,.92);sphere(.345,hair,0,.11,-.06,head,1,.76,.91);
 for(let i=0;i<5;i++){let tuft=sphere(.105,hair,-.23+i*.11,.16,.19,head,.8,1.3,.7);tuft.rotation.z=-.3;}
 for(const a of[-1,1]){sphere(.06,skin,a*.315,-.01,0,head,.6,1,1);sphere(.032,mat('#37291f'),a*.107,-.015,.289,head,.7,1,1);sphere(.009,mat('#fff4df'),a*.107-.007,-.004,.315,head);sphere(.045,mat('#d9957d'),a*.195,-.09,.247,head,1,.45,.2);box(.065,.012,.018,hair,a*.105,.065,.292,head);}
 sphere(.035,skin,0,-.06,.31,head,.7,.7,1);sphere(.025,mat('#9c6444'),0,-.13,.29,head,1,.25,.3);
 if(residents.length%3===0){sphere(.35,cloth,0,.21,-.025,head,1,.42,1);box(.38,.04,.25,cloth,0,.19,.28,head);}
 if(residents.length%3===1){box(.19,.25,.12,mat('#c99c64'),.32,.34,.05,body);}
 if(color==='#b92d27')text('N',.15,.16,0,.55,.19,'#ead2ad',null,body);
 residents.push({g,body,head,arms,legs,x,z,y,phase:rnd()*6.28,scale});return g;
}
person(-1.65,.5,'#b92d27',.67,true,.82);person(.8,-.45,'#292e27',3.32,true,.82);person(-1.5,.7,'#b92d27',3.32,true,.82);
person(-3.8,3.6,'#bac2b4');person(0,3.4,'#b92d27');person(3.4,1.8,'#414239');person(-4.6,-1,'#b8b5a0');person(-1.9,4.7,'#4f6870',.22,true,.85);
person(2,-3,'#bd864f',.22,true,.9);person(-4,-2,'#9e7481',.22,true,.92);person(4,-3,'#668e89',.22,true,.88);person(-2,3,'#b55239',.22,true,.75);
const life=createLife();
const names=['Milo','Ava','Noah','Lily','Leo','Isla','Theo','Mia','Finn','Ruby','Kai','Ella'];
residents.forEach((r,i)=>{
 r.name=names[i];r.sitBlend=0;r.actionBlend=0;r.pose={};
 const hand=r.arms[1];
 r.phone=box(.09,.15,.02,mat('#303b42'),0,-.24,.055,hand);box(.07,.11,.005,mat('#90b6bc',{emissive:'#799fa8',emissiveIntensity:.15}),0,0,.013,r.phone);
 r.cup=new T.Group();hand.add(r.cup);r.cup.position.set(0,-.26,.06);cyl(.055,.043,.12,mat('#f3dbc1'),0,0,0,r.cup);cyl(.057,.057,.016,mat('#6a4431'),0,.066,0,r.cup);
 r.snack=new T.Group();hand.add(r.snack);r.snack.position.set(0,-.24,.07);sphere(.065,mat('#c98b45'),0,0,0,r.snack,1,.55,1);box(.12,.018,.10,mat('#7f963d'),0,-.015,0,r.snack);sphere(.065,mat('#e5b568'),0,.045,0,r.snack,1,.65,1);
 r.cameraProp=box(.12,.09,.07,mat('#3f4241'),0,-.25,.08,hand);
 [r.phone,r.cup,r.snack,r.cameraProp].forEach(o=>o.visible=false);
 const p=life.people[i];r.g.position.set(p.x,r.y,p.z);r.g.rotation.y=p.angle;
});
function updateResidents(dt,time){
 life.update(dt);
 residents.forEach((r,i)=>{const p=life.people[i],active=p.state==='act',w=p.walkBlend,a=p.activity,t=p.actionAge,smooth=1-Math.exp(-dt*7);
 r.g.position.x=p.x;r.g.position.z=p.z;r.g.rotation.y=p.angle;
 r.sitBlend+=((active&&a==='sit'?1:0)-r.sitBlend)*(1-Math.exp(-dt*3));
 r.actionBlend+=((active?1:0)-r.actionBlend)*smooth;
 const seated=r.sitBlend,act=r.actionBlend;
 r.body.position.y=Math.abs(Math.sin(p.stride))*.021*w+seated*.28;
 r.body.position.z=-seated*.56;
 r.body.rotation.z=Math.sin(p.stride)*.025*w;
 let tilt=0,headX=0,headY=Math.sin(time*.31+r.phase)*.11,left=0,right=0,armZ=0;
 if(active){
 if(a==='phone'){left=-.5;right=-1.12;headX=.25;tilt=.025;}
 if(a==='photo'){left=-1.15;right=-1.35;headX=.04;headY=Math.sin(t*.2)*.1;}
 if(a==='coffee'||a==='eat'){const sip=Math.pow(Math.max(0,Math.sin(t*.75+r.phase)),4);right=-.55-sip*1.05;headX=-sip*.07;}
 if(a==='shop'||a==='browse'){headY=Math.sin(t*.45+r.phase)*.28;headX=Math.sin(t*.3)*.08;right=a==='shop'?-.35-Math.max(0,Math.sin(t*.8))*.5:0;}
 if(a==='serve'){left=-.9;right=-.9-Math.sin(t*1.4)*.25;tilt=.08;headX=.15;}
 if(a==='chat'){if(p.talking){right=-.45-Math.sin(t*1.2+r.phase)*.3;armZ=.18;headX=Math.sin(t*1.9+r.phase)*.06;headY=.04*Math.sin(t);}else{headY=Math.sin(t*.65+r.phase)*.4;}}
 if(a==='queue'){headY=Math.sin(t*.35)*.2;right=-.15;tilt=.015*Math.sin(t);}
 if(a==='sit'){left=-.65;right=-.65;headY=Math.sin(t*.2+r.phase)*.22;}
 }
 r.body.rotation.x+=(tilt-r.body.rotation.x)*smooth;
 r.head.rotation.x+=(headX-r.head.rotation.x)*smooth;r.head.rotation.y+=(headY-r.head.rotation.y)*smooth;
 r.legs.forEach((l,j)=>{const target=Math.sin(p.stride+j*Math.PI)*.36*w-seated*1.25;l.rotation.x+=(target-l.rotation.x)*smooth;});
 r.arms.forEach((arm,j)=>{const target=-Math.sin(p.stride+j*Math.PI)*.3*w+(j?right:left)*act;arm.rotation.x+=(target-arm.rotation.x)*smooth;arm.rotation.z+=((j?armZ:-armZ)*act-arm.rotation.z)*smooth;});
 r.phone.visible=active&&a==='phone';r.cup.visible=active&&a==='coffee';r.snack.visible=active&&a==='eat';r.cameraProp.visible=active&&a==='photo';
 });
}
// Cream food truck.
const truck=new T.Group();truck.position.set(4,.25,-.1);truck.rotation.y=-.15;scene.add(truck);box(1.35,1.4,2.3,mat('#e8d7ad'),0,1,0,truck);box(1.35,.65,.7,mat('#d18d50'),0,.63,1.35,truck);box(1.25,.65,.65,mat('#e8d7ad'),0,1.28,1.3,truck);box(1.08,.43,.015,mat('#576f70'),0,1.35,1.635,truck);box(.015,.58,1.1,mat('#68523a'),.68,1.2,-.2,truck);box(.3,.05,1.25,wood,.8,.88,-.2,truck);for(let i=0;i<8;i++)box(.35,.08,.18,mat(i%2?'#c13d2f':'#fff0c9'),.8,1.63,-.8+i*.18,truck);for(const x of[-.7,.7])for(const z of[-.7,1]){let wheel=cyl(.24,.24,.16,dark,x,.3,z,truck);wheel.rotation.z=Math.PI/2;let hub=cyl(.1,.1,.17,gold,x,.3,z,truck);hub.rotation.z=Math.PI/2}for(const x of[-.45,.45])box(.21,.17,.03,mat('#ffe3a3',{emissive:'#ffcb73',emissiveIntensity:.8}),x,.74,1.715,truck);box(.6,.18,.03,dark,0,.45,1.72,truck);box(1.15,.35,.08,red,0,1.93,.6,truck);text('CHIBI BITES',1.05,.22,0,1.95,.65,'#fff0c2',null,truck);
// Neighbouring buildings create depth without obscuring the miniature.
for(let i=0;i<9;i++){let x=(i%5-2)*5.1,z=i<5?-9:-14,h=3+rnd()*4;let col=mat(['#c7b99e','#a9a58e','#c8b9aa','#b3afa0'][i%4]);box(3.7,h,3.4,col,x,h/2-.35,z);const roof=new T.Mesh(new T.ConeGeometry(3,1.8,4),mat('#8f8a7a'));roof.rotation.y=Math.PI/4;roof.position.set(x,h+.25,z);scene.add(roof);for(let fy=1;fy<h-.4;fy+=1.3)for(const fx of[-1,0,1])box(.48,.72,.03,mat('#f4d69a',{emissive:'#f6bb57',emissiveIntensity:.4}),x+fx,fy,z+1.72);}
function tree(x,z,s=1){cyl(.12,.19,1.8*s,wood,x,.9*s,z);for(let i=0;i<5;i++)sphere(.7*s,mat(i%2?'#808354':'#979660'),x+(rnd()-.5)*.7*s,2*s+rnd()*s,z+(rnd()-.5)*.7*s,scene,1,1.1,1)}tree(-6,-4,1.25);tree(6,-5,1.3);tree(-8,-8,1.5);tree(8,-11,1.8);

// Fine surface variation: matte painted walls and wood, rather than flat colours.
const grainCanvas=document.createElement('canvas');grainCanvas.width=grainCanvas.height=256;const gc=grainCanvas.getContext('2d');const pixels=gc.createImageData(256,256);for(let i=0;i<pixels.data.length;i+=4){const v=115+rnd()*35;pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=v;pixels.data[i+3]=255;}gc.putImageData(pixels,0,0);const grain=new T.CanvasTexture(grainCanvas);grain.wrapS=grain.wrapT=T.RepeatWrapping;grain.repeat.set(5,5);for(const m of[red,gold,cream,wood]){m.bumpMap=grain;m.bumpScale=.028;m.roughness=.77;m.needsUpdate=true;}
// Pane borders, skirting, awning, hanging lights, entrance and tiny merchandise.
for(let f=0;f<2;f++){let y=.55+f*2.65;box(5.1,.11,.09,gold,0,y+.1,-2.08,building);for(let j=0;j<3;j++){cyl(.015,.015,.3,dark,-1.6+j*1.6,y+2.13,.9,building);const shade=new T.Mesh(new T.ConeGeometry(.18,.16,24),gold);shade.position.set(-1.6+j*1.6,y+1.94,.9);building.add(shade);sphere(.07,mat('#ffe2a4',{emissive:'#ffca6a',emissiveIntensity:2}),-1.6+j*1.6,y+1.85,.9,building);}
 for(let j=0;j<4;j++){box(.08,.035,.22,mat('#dfb76e'),-.4+j*.32,y+.94,.8,building);}
 plant(-2.12,-.8,.7,y+.08,building);
}
for(let i=0;i<18;i++){const awning=box(.29,.07,.65,mat(i%2?'#f1d5a3':'#b73328'),-2.47+i*.29,2.88,2.48,building);awning.rotation.x=.12;box(.29,.14,.06,mat(i%2?'#f1d5a3':'#b73328'),-2.47+i*.29,2.78,2.80,building);}
box(.72,.06,.5,gold,-1.65,.36,2.56,building);box(.07,1.9,.07,gold,-1.98,1.6,2.24,building);box(.07,1.9,.07,gold,-1.28,1.6,2.24,building);cyl(.02,.02,.19,gold,-1.4,1.5,2.3,building);text('OPEN',.4,.15,-1.62,1.97,2.29,'#ffeecc','#94382d',building);
for(const x of[-1.7,1.2]){box(.9,.25,.4,wood,x,.4,2.78);for(let j=0;j<5;j++){plant(x-.32+j*.16,2.78,.55,.54);sphere(.035,mat(j%2?'#d9915f':'#f3c676'),x-.32+j*.16,.95,2.8);}}
// Chalkboard outside the entrance.
const board=new T.Group();board.position.set(3.1,.23,2.5);board.rotation.y=-.25;scene.add(board);for(const x of[-.24,.24]){const leg=box(.055,.8,.055,wood,x,.4,0,board);leg.rotation.x=-.15;}box(.55,.65,.08,wood,0,.52,.01,board);box(.47,.55,.015,mat('#343b32'),0,.54,.06,board);text('NOW SHOWING',.42,.1,0,.69,.075,'#e5d4aa',null,board);text('A LITTLE',.37,.09,0,.53,.075,'#e5d4aa',null,board);text('MAGIC',.33,.11,0,.39,.075,'#e5d4aa',null,board);
// Fairy lights over the side street.
const wirePoints=[];for(let i=0;i<=30;i++){const u=i/30;wirePoints.push(new T.Vector3(-5+10*u,4.4-Math.sin(u*Math.PI)*.8,-3.7));}const wire=new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(wirePoints),40,.012,5,false),dark);scene.add(wire);for(let i=0;i<15;i++){let u=i/14;sphere(.045,mat('#ffda91',{emissive:'#ffb858',emissiveIntensity:3}),-5+10*u,4.32-Math.sin(u*Math.PI)*.8,-3.7);}for(const x of[-5,5])cyl(.035,.045,4.3,dark,x,2.3,-3.7);
// Soft contact shadows underneath each resident.
const contactCanvas=document.createElement('canvas');contactCanvas.width=contactCanvas.height=64;const cc=contactCanvas.getContext('2d'),gradient=cc.createRadialGradient(32,32,2,32,32,31);gradient.addColorStop(0,'rgba(50,32,15,.3)');gradient.addColorStop(1,'rgba(50,32,15,0)');cc.fillStyle=gradient;cc.fillRect(0,0,64,64);const contactMap=new T.CanvasTexture(contactCanvas);residents.forEach(r=>{const shadow=new T.Mesh(new T.PlaneGeometry(.85,.65),new T.MeshBasicMaterial({map:contactMap,transparent:true,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.position.y=.008;r.g.add(shadow)});
let night=false,paused=false,inside=false;const $=s=>document.querySelector(s);function toast(t){$('#toast').textContent=t;$('#toast').style.opacity=1;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').style.opacity=0,4000)}$('#orbit').onclick=()=>{controls.autoRotate=!controls.autoRotate;$('#orbit').classList.toggle('active',controls.autoRotate)};$('#night').onclick=()=>{night=!night;document.body.classList.toggle('night',night);$('#night').classList.toggle('active',night);$('#night').textContent=night?'☀ Golden hour':'☾ Nightfall';};$('#pause').onclick=()=>{paused=!paused;$('#pause').textContent=paused?'▶ Resume life':'Ⅱ Pause life';$('#pause').classList.toggle('active',paused)};
let targetCam=null,targetLook=null;function view(pos,look){controls.autoRotate=false;$('#orbit').classList.remove('active');targetCam=new T.Vector3(...pos);targetLook=new T.Vector3(...look)}$('#inside').onclick=()=>{inside=!inside;$('#inside').classList.toggle('active',inside);view(inside?[7,5.7,8]:[15,12,18],inside?[0,3.9,0]:[0,3,0]);toast(inside?'Upstairs at the little shop. Drag to look around.':'Back to the neighbourhood.');};$('#reset').onclick=()=>{inside=false;$('#inside').classList.remove('active');view([15,12,18],[0,3,0]);};controls.addEventListener('start',()=>{targetCam=null;targetLook=null});let pointerStart;renderer.domElement.addEventListener('pointerdown',e=>pointerStart=[e.clientX,e.clientY]);renderer.domElement.addEventListener('pointerup',e=>{if(!pointerStart||Math.hypot(e.clientX-pointerStart[0],e.clientY-pointerStart[1])>5)return;let ray=new T.Raycaster();ray.setFromCamera(new T.Vector2(e.clientX/innerWidth*2-1,-e.clientY/innerHeight*2+1),camera);const hits=ray.intersectObjects(residents.map(r=>r.g),true);if(hits.length){let o=hits[0].object;while(o&&!residents.some(r=>r.g===o))o=o.parent;const i=residents.findIndex(r=>r.g===o);if(i>=0){const p=life.people[i];toast(residents[i].name+' · '+(p.state==='walk'?'On the way to '+(activityLabels[p.indoor?['shop','browse','serve','shop','phone'][p.spot]:['sit','sit','phone','browse','photo','queue','eat','coffee','phone','look','photo','chat','chat','look','coffee'][p.spot]]||'a new activity').toLowerCase():p.activity==='chat'&&!p.talking?'Waiting for a neighbour':activityLabels[p.activity]||'Looking around'));return;}}if(ray.intersectObject(building,true).length)$('#inside').click()});
// Filmic finish, with subtle lens blur on the distant neighbourhood.
const renderSize=new T.Vector2();renderer.getDrawingBufferSize(renderSize);
const target=new T.WebGLRenderTarget(renderSize.x,renderSize.y,{type:T.HalfFloatType,depthBuffer:true});target.depthTexture=new T.DepthTexture(renderSize.x,renderSize.y);target.samples=Math.min(4,renderer.capabilities.maxSamples);
const finishScene=new T.Scene(),finishCamera=new T.OrthographicCamera(-1,1,1,-1,0,1);
const finishMaterial=new T.ShaderMaterial({uniforms:{tScene:{value:target.texture},tDepth:{value:target.depthTexture},resolution:{value:renderSize},focus:{value:22},near:{value:.1},far:{value:100}},vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}`,fragmentShader:`
 varying vec2 vUv;uniform sampler2D tScene;uniform sampler2D tDepth;uniform vec2 resolution;uniform float focus;uniform float near;uniform float far;
 #include <packing>
 void main(){
 float depth=-perspectiveDepthToViewZ(texture2D(tDepth,vUv).x,near,far);
 float blur=smoothstep(4.0,14.0,depth-focus)*4.5;
 vec3 base=texture2D(tScene,vUv).rgb;vec3 colour=base;vec3 glow=vec3(0.);float weight=1.;
 for(int i=0;i<12;i++){float a=float(i)*2.399963;vec2 direction=vec2(cos(a),sin(a));vec2 offset=direction*sqrt((float(i)+.5)/12.0);vec3 sampleColour=texture2D(tScene,vUv+offset*blur/resolution).rgb;colour+=sampleColour;weight+=1.;vec3 light=texture2D(tScene,vUv+direction*7.0/resolution).rgb;glow+=max(light-vec3(1.15),vec3(0.));}
 colour=colour/weight+glow*.012;float vignette=1.-.14*smoothstep(.22,.78,length((vUv-.5)*vec2(1.,.85)));colour*=vignette;gl_FragColor=vec4(colour,1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 }`,depthTest:false,depthWrite:false});finishScene.add(new T.Mesh(new T.PlaneGeometry(2,2),finishMaterial));
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.getDrawingBufferSize(renderSize);target.setSize(renderSize.x,renderSize.y)});const clock=new T.Clock();let time=0;const dayColor=new T.Color('#e8ddc9'),nightColor=new T.Color('#202b3d');function animate(){requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.05);if(!paused)time+=dt;if(!paused)updateResidents(dt,time);scene.background.lerp(night?nightColor:dayColor,1-Math.exp(-dt*2.2));scene.fog.color.copy(scene.background);hemi.intensity=T.MathUtils.lerp(hemi.intensity,night?.5:2.7,1-Math.exp(-dt*2.2));sun.intensity=T.MathUtils.lerp(sun.intensity,night?.25:4.2,1-Math.exp(-dt*2.2));renderer.toneMappingExposure=T.MathUtils.lerp(renderer.toneMappingExposure,night?1:1.25,1-Math.exp(-dt*2.2));if(targetCam){camera.position.lerp(targetCam,1-Math.exp(-dt*3.4));controls.target.lerp(targetLook,1-Math.exp(-dt*3.4));if(camera.position.distanceTo(targetCam)<.02)targetCam=null}controls.update(dt);finishMaterial.uniforms.focus.value=camera.position.distanceTo(controls.target);renderer.setRenderTarget(target);renderer.render(scene,camera);renderer.setRenderTarget(null);renderer.render(finishScene,finishCamera)}animate();$('#loading').remove();
