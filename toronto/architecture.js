import * as T from 'three';
import {RoundedBoxGeometry} from './vendor/addons/geometries/RoundedBoxGeometry.js';
// Physical-scale curtain walls. One scene unit is approximately 25 metres.
export function facadeMaterial(color,metal,night){
const masonry=metal<.18;
const m=new T.MeshPhysicalMaterial({color,metalness:masonry?.04:Math.min(.65,metal+.07),roughness:masonry?.77:.22,clearcoat:masonry?0:.85,clearcoatRoughness:.13,ior:1.52,envMapIntensity:masonry?.35:1.25});
m.onBeforeCompile=s=>{s.uniforms.uNight=night;s.uniforms.uMasonry={value:masonry?1:0};s.vertexShader='varying vec3 vCity;varying vec3 vFace;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
vec4 cityP=vec4(transformed,1.);
#ifdef USE_INSTANCING
 cityP=instanceMatrix*cityP;
#endif
vCity=(modelMatrix*cityP).xyz;vFace=normalize(mat3(modelMatrix)*normal);`);
s.fragmentShader=`varying vec3 vCity;varying vec3 vFace;uniform float uNight;uniform float uMasonry;
float whash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
`+s.fragmentShader;
s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
float side=step(.5,abs(vFace.x));float horizontal=mix(vCity.x,vCity.z,side);
vec2 grid=vec2(horizontal*6.0,(vCity.y-.16)*6.0);vec2 cell=fract(grid);vec2 id=floor(grid);vec2 aa=max(fwidth(grid),vec2(.001));
float border=mix(.045,.18,uMasonry);vec2 pane=smoothstep(vec2(border)-aa,vec2(border)+aa,cell)*(1.-smoothstep(vec2(1.-border)-aa,vec2(1.-border)+aa,cell));
float windowMask=pane.x*pane.y*(1.-step(.5,abs(vFace.y)));float roomRandom=whash(id+floor(vCity.xz*.19));float cluster=whash(floor(id/vec2(3.,2.))+floor(vCity.xz*.11));
vec3 viewWorld=normalize(cameraPosition-vCity);float faceDot=max(.22,abs(dot(viewWorld,normalize(vFace))));vec2 viewSlant=vec2(mix(viewWorld.x,viewWorld.z,side),viewWorld.y)/faceDot;
vec2 roomUV=cell-.18*viewSlant;
float roomInterior=step(.09,roomUV.x)*step(roomUV.x,.91)*step(.09,roomUV.y)*step(roomUV.y,.91);
float blind=step(.74,roomRandom)*step(.62,cell.y);float blindStripe=.55+.25*sin(cell.y*100.);
float ceiling=1.-smoothstep(.7,.93,roomUV.y);float furniture=1.-step(.18,roomUV.y)*step(roomUV.y,.32)*step(.2,roomUV.x)*step(roomUV.x,.72)*.55;
float recess=mix(.40,1.0,smoothstep(.05,.17,min(min(cell.x,1.-cell.x),min(cell.y,1.-cell.y))));
vec3 glassTint=mix(vec3(.37,.48,.54),vec3(.76,.84,.86),roomRandom);diffuseColor.rgb*=mix(mix(.65,1.,uMasonry),glassTint*recess,windowMask);
float grain=whash(floor(vCity.xy*800.));diffuseColor.rgb*=1.+(grain-.5)*.035;
`);
s.fragmentShader=s.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
roughnessFactor=mix(mix(.45,.81,uMasonry),.13+roomRandom*.13,windowMask);`);
s.fragmentShader=s.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
float occupied=step(.44,cluster)*step(.12,roomRandom);vec3 interiorLight=mix(vec3(.55,.72,.87),vec3(1.,.68,.37),step(.14,roomRandom));float interiorDepth=mix(.35,1.,roomInterior)*mix(.63,1.,ceiling)*furniture;float blinds=mix(1.,blindStripe,blind);
totalEmissiveRadiance+=interiorLight*windowMask*occupied*interiorDepth*blinds*uNight*(.25+roomRandom*.54);
`);};
m.customProgramCacheKey=()=>`architecture-facade-v4-${masonry}`;return m;
}
export function architecturalDetails({world,entries,night,renderer,sky,scene}){
let seed=2026;const rand=()=>{seed=(seed*16807)%2147483647;return(seed-1)/2147483646;};
const lists={frame:[],slab:[],glass:[],dark:[],stone:[],roof:[],wood:[],green:[],lobby:[],fan:[],vent:[],warm:[]};
const materials={frame:new T.MeshStandardMaterial({color:'#66757d',metalness:.8,roughness:.3}),slab:new T.MeshStandardMaterial({color:'#a2a8a8',roughness:.78}),glass:new T.MeshPhysicalMaterial({color:'#577e8e',metalness:.45,roughness:.15,clearcoat:1,transparent:true,opacity:.52,depthWrite:false}),dark:new T.MeshStandardMaterial({color:'#26333a',roughness:.6}),stone:new T.MeshStandardMaterial({color:'#9b9587',roughness:.9}),roof:new T.MeshStandardMaterial({color:'#51565a',roughness:.95}),wood:new T.MeshStandardMaterial({color:'#8d7760',roughness:.75}),green:new T.MeshStandardMaterial({color:'#3d5746',roughness:.9}),lobby:new T.MeshPhysicalMaterial({color:'#354e5d',metalness:.25,roughness:.12,clearcoat:1}),fan:new T.MeshStandardMaterial({color:'#313e44',metalness:.65,roughness:.4}),vent:new T.MeshStandardMaterial({color:'#7e898b',metalness:.4,roughness:.5}),warm:new T.MeshStandardMaterial({color:'#e9d0ac',emissive:'#ffc891',emissiveIntensity:.3})};
function add(kind,x,y,z,w,h,d){lists[kind].push([x,y,z,w,h,d]);}
const full=entries.filter(e=>Math.abs(e.x)<44&&e.z>-48&&e.h>1.3);
for(const e of full){const {x,z,w,d,h}=e,b=.16,top=b+h;const condo=e.kind==='condo';const office=!condo;const hx=w/2,hz=d/2;
// Shadow-casting mullions sit proud of the recessed glazing.
const step=office?.33:.5;for(let xx=-hx;xx<=hx+.001;xx+=step){for(const dz of [-hz,hz])add('frame',x+xx,b+h/2,z+dz,.014,h,.028);}
for(let zz=-hz;zz<=hz+.001;zz+=step){for(const dx of [-hx,hx])add('frame',x+dx,b+h/2,z+zz,.028,h,.014);}
for(let yy=b+.1667;yy<top-.08;yy+=.1667){
 for(const dz of [-hz,hz])add(condo?'slab':'frame',x,yy,z+dz,w+.025,condo?.022:.009,.033);
 for(const dx of [-hx,hx])add(condo?'slab':'frame',x+dx,yy,z,.033,condo?.022:.009,d+.025);
 if(condo&&yy>b+.5){const extension=.10;for(const sign of [-1,1]){const zz=z+sign*(hz+extension/2);add('slab',x,yy,zz,w+.05,.025,extension+.06);add('glass',x,yy+.055,z+sign*(hz+extension),w+.04,.09,.009);add('frame',x,yy+.102,z+sign*(hz+extension),w+.05,.009,.009);for(let xx=-hx;xx<hx;xx+=.5)add('slab',x+xx,yy+.05,zz,.012,.1,.11);}}
}
// Finely bevelled corners, roof membrane and continuous parapets.
for(const dx of [-hx,hx])for(const dz of [-hz,hz])add('frame',x+dx,b+h/2,z+dz,.035,h,.035);
add('roof',x,top+.008,z,w-.04,.012,d-.04);
for(const dz of [-hz+.025,hz-.025])add('slab',x,top+.045,z+dz,w,.09,.045);for(const dx of [-hx+.025,hx-.025])add('slab',x+dx,top+.045,z,.045,.09,d);
// Mechanical penthouses, rooftop air handlers, vents and fan housings.
const mechW=Math.min(.45,w*.35),mechD=Math.min(.5,d*.3);add('vent',x,top+.11,z,mechW,.2,mechD);
for(let i=0;i<3;i++){const xx=x-w*.25+i*w*.2,zz=z+d*.23;add('vent',xx,top+.08,zz,.13,.13,.18);add('fan',xx,top+.15,zz,.08,.015,.08);for(let j=0;j<4;j++)add('dark',xx-.045+j*.03,top+.13,zz+.092,.008,.07,.004);}
for(let i=0;i<4;i++)add('dark',x,top+.025,z-d*.3+i*.035,w*.4,.012,.008);
// Real entrances, canopies and a lit double-height lobby on hero buildings.
if(e.hero){const lobbyH=Math.min(.62,h*.17);add('lobby',x,b+lobbyH/2,z+hz+.018,w*.76,lobbyH,.025);add('warm',x,b+lobbyH*.8,z+hz+.023,w*.68,.015,.02);add('slab',x,b+lobbyH+.035,z+hz+.12,w*.9,.045,.32);for(let xx=-w*.33;xx<w*.34;xx+=.22)add('frame',x+xx,b+lobbyH/2,z+hz+.035,.016,lobbyH,.022);for(const dx of [-w*.4,w*.4])add('stone',x+dx,b+lobbyH/2,z+hz+.1,.055,lobbyH,.06);}
// Small roof terraces, planters and screened service areas.
if(condo||e.terrace){add('wood',x-w*.2,top+.025,z-d*.2,w*.35,.025,d*.32);for(let i=0;i<3;i++){add('stone',x-w*.33+i*w*.18,top+.07,z-d*.35,.15,.11,.13);add('green',x-w*.33+i*w*.18,top+.145,z-d*.35,.13,.1,.11);}}
}
// Low-rise architecture: cornices and masonry window reveals, with less density inland.
for(const e of entries.filter(e=>e.h<=1.3&&Math.abs(e.x)<50&&e.z>-65)){const {x,z,w,d,h}=e;add('stone',x,h+.18,z,w+.07,.055,d+.07);add('roof',x,h+.215,z,w-.06,.02,d-.06);for(let yy=.35;yy<h+.1;yy+=.2)for(let xx=-w*.4;xx<w*.4;xx+=.22){add('stone',x+xx,yy,z+d/2+.015,.14,.022,.05);add('dark',x+xx,yy+.075,z+d/2+.009,.1,.12,.012);}}
const objects=[];const unit=new T.BoxGeometry(1,1,1),bevel=new RoundedBoxGeometry(1,1,1,1,.04),fanGeo=new T.CylinderGeometry(.5,.5,1,12),dummy=new T.Object3D();
for(const [key,data] of Object.entries(lists)){if(!data.length)continue;const geo=key==='fan'?fanGeo:(key==='vent'?bevel:unit);const batch=new T.InstancedMesh(geo,materials[key],data.length);data.forEach((v,i)=>{dummy.position.set(v[0],v[1],v[2]);dummy.scale.set(v[3],v[4],v[5]);dummy.rotation.set(0,0,0);dummy.updateMatrix();batch.setMatrixAt(i,dummy.matrix);});batch.castShadow=!['glass','warm','fan','dark'].includes(key);batch.receiveShadow=true;world.add(batch);objects.push(batch);}
// An environment made from the actual city massing provides skyline reflections.
const envScene=new T.Scene(),skyClone=sky.clone();skyClone.material=sky.material.clone();skyClone.material.uniforms={uNight:{value:.35},uTime:{value:0}};skyClone.position.set(0,0,0);envScene.add(skyClone);
const envGeo=new T.BoxGeometry(1,1,1),envMat=new T.MeshBasicMaterial({color:'#566774'});const envBuildings=new T.InstancedMesh(envGeo,envMat,entries.length);entries.forEach((e,i)=>{dummy.position.set(e.x,e.h/2-5.84,e.z+15);dummy.scale.set(e.w,e.h,e.d);dummy.updateMatrix();envBuildings.setMatrixAt(i,dummy.matrix);});envScene.add(envBuildings);
const envGround=new T.Mesh(new T.PlaneGeometry(1000,1000),new T.MeshBasicMaterial({color:'#303a43'}));envGround.rotation.x=-Math.PI/2;envGround.position.y=-6;envScene.add(envGround);
const gen=new T.PMREMGenerator(renderer);const dayEnv=gen.fromScene(envScene,.035,.1,800);skyClone.material.uniforms.uNight.value=.9;envMat.color.set('#182738');const nightEnv=gen.fromScene(envScene,.035,.1,800);gen.dispose();envGeo.dispose();envMat.dispose();skyClone.material.dispose();envGround.geometry.dispose();envGround.material.dispose();
let last=-1;return{count:Object.values(lists).reduce((n,v)=>n+v.length,0),update(n){const which=n>.55?1:0;if(which!==last){scene.environment=which?nightEnv.texture:dayEnv.texture;last=which;}materials.warm.emissiveIntensity=.1+n*.7;},setQuality(high){objects.forEach(o=>{o.castShadow=high&&!['glass','warm','fan','dark'].some(k=>o.material===materials[k]);});}};
}
