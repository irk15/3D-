import { EffectComposer } from './vendor/addons/postprocessing/EffectComposer.js';
import { RenderPass } from './vendor/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from './vendor/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from './vendor/addons/postprocessing/OutputPass.js';
import { ShaderPass } from './vendor/addons/postprocessing/ShaderPass.js';
import { RoomEnvironment } from './vendor/addons/environments/RoomEnvironment.js';
import { Water } from './vendor/addons/objects/Water.js';
export function enhance({THREE,renderer,scene,camera,world,water,M,box,cyl,ball,rod,mesh,boat}){
const mobile=innerWidth<800;
const pmrem=new THREE.PMREMGenerator(renderer);const room=new RoomEnvironment();const env=pmrem.fromScene(room,.06);scene.environment=env.texture;scene.environmentIntensity=.32;room.dispose();pmrem.dispose();
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
M.metal.roughness=.26;M.metal.metalness=.8;M.roof.roughness=.7;M.teal.roughness=.38;
M.glass.emissive=new THREE.Color('#ffbf70');M.glass.emissiveIntensity=.5;
// Periodic, multi-scale normals: no externally loaded texture assets.
const size=256,data=new Uint8Array(size*size*4);const wave=(x,y)=>Math.sin(x*3+y*2)*.7+Math.sin(x*7-y*5)*.3+Math.sin(x*17+y*13)*.11+Math.cos(x*31-y*23)*.04;
for(let y=0;y<size;y++)for(let x=0;x<size;x++){const u=x/size*Math.PI*2,v=y/size*Math.PI*2;const dx=(wave(u+.01,v)-wave(u-.01,v))*2,dy=(wave(u,v+.01)-wave(u,v-.01)) *2;const n=new THREE.Vector3(-dx,-dy,1).normalize(),i=(y*size+x)*4;data[i]=(n.x*.5+.5)*255;data[i+1]=(n.y*.5+.5)*255;data[i+2]=(n.z*.5+.5)*255;data[i+3]=255;}
const normals=new THREE.DataTexture(data,size,size);normals.wrapS=normals.wrapT=THREE.RepeatWrapping;normals.needsUpdate=true;normals.magFilter=THREE.LinearFilter;normals.minFilter=THREE.LinearFilter;
world.remove(water);
const sea=new Water(new THREE.PlaneGeometry(18.9,14.9,64,64),{textureWidth:mobile?512:1024,textureHeight:mobile?512:1024,waterNormals:normals,sunDirection:new THREE.Vector3(-.5,.7,.5).normalize(),sunColor:0xffd8a1,waterColor:0x227d87,distortionScale:1.1,alpha:1});sea.rotation.x=-Math.PI/2;sea.position.y=-.12;world.add(sea);sea.material.uniforms.size.value=2.2;
// Stone foundations and weathered rocks around the lighthouse peninsula.
let seed=731;function rand(){seed=(seed*16807)%2147483647;return(seed-1)/2147483646;}
const rockmat=new THREE.MeshStandardMaterial({color:'#80918b',roughness:.92});const rg=new THREE.DodecahedronGeometry(1,1);
for(let i=0;i<45;i++){const a=i/45*Math.PI*1.48;const x=-6.6+Math.cos(a)*2.55,z=-.9+Math.sin(a)*2.45;if(x<-9.1||z<-2.5)continue;const r=mesh(rg,rockmat,x,-.02,z);r.scale.set(.17+rand()*.25,.13+rand()*.2,.19+rand()*.26);r.rotation.set(rand(),rand(),rand());}
// Warm strings of individual bulbs over the café terrace.
const emissive=new THREE.MeshStandardMaterial({color:'#ffe9bc',emissive:'#ffb74c',emissiveIntensity:4});
for(const x of [-4.5,-1.8])cyl(.025,.035,1.9,M.dark,x,1.25,-3.75);
let prev=null;const bulbs=[];for(let i=0;i<=20;i++){const t=i/20,p=[-4.5+t*2.7,2.22-Math.sin(t*Math.PI)*.3,-3.75];if(prev)rod(prev,p,.012,M.dark);if(i%2===0)bulbs.push(ball(.035,emissive,...p));prev=p;}
const cafeLight=new THREE.PointLight('#ffc17c',5,5,2);cafeLight.position.set(-3.2,1.6,-3.8);world.add(cafeLight);
// Dock lights and physically lit rail fittings.
for(const x of [-3.2,3.5])for(let z=-1.7;z<2.3;z+=.85){cyl(.055,.055,.16,M.dark,x+.5,.35,z);ball(.037,emissive,x+.5,.45,z);}
// A graceful sailboat adds a contrasting silhouette.
const sail=new THREE.Group();world.add(sail);sail.position.set(6.4,.03,4.5);sail.rotation.y=-.5;
const hull=mesh(new THREE.SphereGeometry(1,24,12),M.cream,0,.05,0,sail);hull.scale.set(.34,.21,1.05);box(.5,.06,1.3,M.wood,0,.22,0,sail);rod([0,.2,0],[0,2.6,0],.024,M.dark,sail);rod([0,.55,0],[0,.55,-.85],.018,M.dark,sail);
const sg=new THREE.BufferGeometry();sg.setAttribute('position',new THREE.Float32BufferAttribute([0,2.5,0,.13,.68,-.9,0,.57,0,0,2.5,0,0,.57,0,-.07,.65,.7],3));sg.computeVertexNormals();const sailmat=new THREE.MeshStandardMaterial({color:'#f8dfba',side:THREE.DoubleSide,roughness:.85});mesh(sg,sailmat,0,0,0,sail);
// Soft animated smoke, created as depth-tested transparent sprites.
const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const ctx=canvas.getContext('2d');const gradient=ctx.createRadialGradient(64,64,0,64,64,64);gradient.addColorStop(0,'rgba(210,225,227,.30)');gradient.addColorStop(.3,'rgba(210,225,227,.16)');gradient.addColorStop(1,'rgba(210,225,227,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,128,128);const smokeTex=new THREE.CanvasTexture(canvas);const smoke=[];
for(let i=0;i<20;i++){const m=new THREE.SpriteMaterial({map:smokeTex,transparent:true,opacity:.5,depthWrite:false,color:'#cad9dd'});const sp=new THREE.Sprite(m);world.add(sp);smoke.push(sp);}
// Airborne sea spray and amber motes catch the harbour lights.
const count=180,positions=new Float32Array(count*3),origin=[];for(let i=0;i<count;i++){origin.push([rand()*18-9,rand()*5+.3,rand()*13-6]);positions.set(origin[i],i*3);}const pg=new THREE.BufferGeometry();pg.setAttribute('position',new THREE.BufferAttribute(positions,3));const points=new THREE.Points(pg,new THREE.PointsMaterial({color:'#e4bc80',size:.025,transparent:true,opacity:.45,depthWrite:false,blending:THREE.AdditiveBlending}));world.add(points);
// Contact shading beneath buildings anchors them to the ground.
const shadowCanvas=document.createElement('canvas');shadowCanvas.width=shadowCanvas.height=128;const sc=shadowCanvas.getContext('2d');const grad=sc.createRadialGradient(64,64,8,64,64,64);grad.addColorStop(0,'rgba(8,21,26,.55)');grad.addColorStop(1,'rgba(8,21,26,0)');sc.fillStyle=grad;sc.fillRect(0,0,128,128);const shadowTexture=new THREE.CanvasTexture(shadowCanvas);for(const [x,z,w,d] of [[.1,-5.65,5,4],[3.4,-5.8,4,4],[-3.2,-5.9,4,4],[-6.4,-.8,3,3],[5.6,.3,2,2]]){const s=mesh(new THREE.PlaneGeometry(w,d),new THREE.MeshBasicMaterial({map:shadowTexture,transparent:true,depthWrite:false}),x,.302,z);s.rotation.x=-Math.PI/2;s.castShadow=false;}
const composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));const bloom=new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),.4,.65,1.05);composer.addPass(bloom);composer.addPass(new OutputPass());
const finish=new ShaderPass({uniforms:{tDiffuse:{value:null},uTime:{value:0},uNight:{value:1},uResolution:{value:new THREE.Vector2(innerWidth,innerHeight)}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`uniform sampler2D tDiffuse;uniform float uTime;uniform float uNight;uniform vec2 uResolution;varying vec2 vUv;void main(){vec2 p=vUv-.5;vec3 c=texture2D(tDiffuse,vUv).rgb;float vig=1.-smoothstep(.22,.75,length(p))*.28;c*=vig;float grain=fract(sin(dot(vUv*uResolution+uTime,vec2(12.9898,78.233)))*43758.5453)-.5;c+=grain*.009;c=mix(c,vec3(c.r*1.025,c.g,c.b*.98),.35);gl_FragColor=vec4(c,1.);}`});composer.addPass(finish);
let mode='wide',mix=0,ultra=true,tourT=0;const targetPos=new THREE.Vector3(),targetLook=new THREE.Vector3();const choose=(m)=>{mode=m;mix=0;for(const id of ['wide','detail','cinema'])document.getElementById(id).classList.toggle('selected',id===m);};for(const id of ['wide','detail','cinema'])document.getElementById(id).onclick=()=>choose(id);renderer.domElement.addEventListener('pointerdown',()=>choose('wide'));document.getElementById('reset').addEventListener('click',()=>choose('wide'));document.getElementById('orbit').addEventListener('click',()=>choose('wide'));
document.getElementById('quality').onclick=()=>{ultra=!ultra;renderer.setPixelRatio(Math.min(devicePixelRatio,ultra?2:1));composer.setPixelRatio(renderer.getPixelRatio());bloom.enabled=ultra;document.getElementById('quality').textContent='Quality: '+(ultra?'Ultra':'Balanced');};
function resize(){composer.setSize(innerWidth,innerHeight);finish.uniforms.uResolution.value.set(innerWidth,innerHeight);}
function render(time,night,dt,paused,center){if(!paused)tourT+=dt;mix=Math.min(1,mix+dt*.45);const smooth=mix*mix*(3-2*mix);if(mode==='detail'){targetPos.set(-15,10,14);targetLook.set(-5.3,2,-.7);camera.position.lerp(targetPos,smooth);camera.lookAt(center.clone().lerp(targetLook,smooth));camera.zoom=1+smooth*.45;camera.updateProjectionMatrix();}else if(mode==='cinema'){const a=.5+tourT*.065,d=innerWidth<800?56:26;targetPos.set(Math.sin(a)*d,12+Math.sin(tourT*.15)*3,Math.cos(a)*d);targetLook.set(-1,1.3,-.5);camera.position.lerp(targetPos,smooth);camera.lookAt(center.clone().lerp(targetLook,smooth));camera.zoom=1+Math.sin(tourT*.12)*.08;camera.updateProjectionMatrix();}
sea.material.uniforms.time.value=time*.35;sea.material.uniforms.waterColor.value.set('#227d87').lerp(new THREE.Color('#073b4c'),night);sea.material.uniforms.sunColor.value.set('#ffe3ac').lerp(new THREE.Color('#91bbe5'),night);scene.environmentIntensity=.32-night*.17;M.glass.emissiveIntensity=.07+night*1.2;emissive.emissiveIntensity=.25+night*4;cafeLight.intensity=.2+night*6;bloom.strength=.18+night*.32;sail.position.y=.03+Math.sin(time*1.4)*.04;sail.rotation.z=Math.sin(time*.9)*.035;
smoke.forEach((sp,i)=>{const t=(time*.15+i/20)%1;sp.position.set(.8+t*.9,.3+2.7+t*2.3,-6.25+Math.sin(t*5)*.2);sp.scale.setScalar(.23+t*.9);sp.material.opacity=Math.sin(t*Math.PI)*.36;});for(let i=0;i<count;i++){positions[i*3]=origin[i][0]+Math.sin(time*.1+i)*.2;positions[i*3+1]=origin[i][1]+Math.sin(time*.25+i)*.15;}pg.attributes.position.needsUpdate=true;points.material.opacity=.12+night*.3;finish.uniforms.uTime.value=time;composer.render();}
return{resize,render};}
