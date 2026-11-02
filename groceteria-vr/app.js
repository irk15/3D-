import * as THREE from 'three';
import {DRACOLoader} from './vendor/DRACOLoader.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';
import {OrbitControls} from './vendor/OrbitControls.js';
const status=document.querySelector('#status'),vr=document.querySelector('#vr');
const scene=new THREE.Scene();scene.background=new THREE.Color('#c8d7dc');scene.fog=new THREE.Fog('#c8d7dc',100,300);
const renderer=new THREE.WebGLRenderer({antialias:false,powerPreference:'high-performance'});renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(1);renderer.xr.enabled=true;renderer.xr.setFramebufferScaleFactor(0.65);renderer.xr.setFoveation(1);renderer.xr.setReferenceSpaceType('local-floor');renderer.shadowMap.enabled=false;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;document.body.prepend(renderer.domElement);
const camera=new THREE.PerspectiveCamera(65,innerWidth/innerHeight,.05,250),rig=new THREE.Group();scene.add(rig);rig.add(camera);
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.maxPolarAngle=Math.PI/2-.015;controls.minDistance=2;controls.maxDistance=60;
scene.add(new THREE.HemisphereLight('#e8f6ff','#8b8573',2.5));const sun=new THREE.DirectionalLight('#fff2d6',3.2);sun.position.set(-12,22,15);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-22,right:22,top:22,bottom:-22,near:.5,far:70});sun.shadow.bias=-.0004;scene.add(sun);
const ground=new THREE.Mesh(new THREE.PlaneGeometry(300,300),new THREE.MeshStandardMaterial({color:'#aab6a2',roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-.015;ground.receiveShadow=true;scene.add(ground);
const platform=new THREE.Mesh(new THREE.CylinderGeometry(17,17,0.06,96),new THREE.MeshStandardMaterial({color:'#c6c6bb',roughness:1}));platform.position.y=-.055;platform.receiveShadow=true;platform.visible=false;scene.add(platform);
let home=new THREE.Vector3(0,0,15),loaded=false,box;const modelRoot=new THREE.Group();scene.add(modelRoot);
const draco=new DRACOLoader().setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');draco.setWorkerLimit(1);const loader=new GLTFLoader().setDRACOLoader(draco);
loadScene().then(g=>{modelRoot.add(g.scene);freezeScene(g.scene);box=new THREE.Box3().setFromObject(modelRoot);modelRoot.position.set(0,0,0);g.scene.traverse(o=>{if(o.name.startsWith('cs_'))o.visible=false;});box.setFromObject(modelRoot);g.scene.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;for(const m of Array.isArray(o.material)?o.material:[o.material]){if(m.map)m.map.anisotropy=1;}}});home.set(0,0.2,8);loaded=true;reset();status.textContent='Quest performance mode · Ready to explore';checkVR();}).catch(e=>{console.error(e);status.textContent='Scene could not load. Refresh to retry.';});
async function loadScene(){const manifest=await fetch('./quest/manifest.json').then(r=>r.json());const parts=[];let bytes=0;for(const name of manifest.parts){const response=await fetch('./quest/'+name);if(!response.ok)throw Error('Scene download failed');const data=await response.arrayBuffer();parts.push(data);bytes+=data.byteLength;status.textContent='Loading jungle · '+Math.round(bytes/manifest.bytes*100)+'%';}const data=await new Blob(parts).arrayBuffer();status.textContent='Preparing jungle…';return loader.parseAsync(data,'./');}

function reset(){if(renderer.xr.isPresenting){rig.position.copy(home);rig.rotation.set(0,0,0);}else{rig.position.set(0,0,0);rig.rotation.set(0,0,0);camera.position.set(0,1.8,8);controls.target.set(0,1.6,3);controls.update();}}
document.querySelector('#reset').onclick=reset;
async function checkVR(){try{const supported=navigator.xr&&await navigator.xr.isSessionSupported('immersive-vr');vr.disabled=!loaded||!supported;vr.textContent=supported?'Enter VR':'Open on Quest for VR';}catch{vr.textContent='VR unavailable';}}
checkVR();vr.onclick=async()=>{try{const session=await navigator.xr.requestSession('immersive-vr',{optionalFeatures:['local-floor','bounded-floor']});controls.enabled=false;camera.position.set(0,0,0);camera.rotation.set(0,0,0);rig.position.copy(home);await renderer.xr.setSession(session);renderer.xr.setFoveation(1);document.body.classList.add('xr');}catch(e){status.textContent='Could not enter VR: '+e.message;}};
renderer.xr.addEventListener('sessionend',()=>{document.body.classList.remove('xr');controls.enabled=true;reset();});
const ray=new THREE.Raycaster(),temp=new THREE.Matrix4(),controllers=[];const marker=new THREE.Mesh(new THREE.RingGeometry(.22,.3,40),new THREE.MeshBasicMaterial({color:'#0d766e',side:THREE.DoubleSide}));marker.rotation.x=-Math.PI/2;marker.visible=false;scene.add(marker);
function targetFor(controller){temp.identity().extractRotation(controller.matrixWorld);ray.ray.origin.setFromMatrixPosition(controller.matrixWorld);ray.ray.direction.set(0,0,-1).applyMatrix4(temp);const hit=ray.intersectObject(ground)[0];if(!hit||hit.distance>25)return null;const p=hit.point;return p;}
for(let i=0;i<2;i++){const controller=renderer.xr.getController(i);rig.add(controller);const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3(0,0,-1)]),new THREE.LineBasicMaterial({color:0x46a99b}));line.scale.z=8;controller.add(line);controller.addEventListener('selectstart',()=>{const p=targetFor(controller);if(p){const head=renderer.xr.getCamera().getWorldPosition(new THREE.Vector3());rig.position.x+=p.x-head.x;rig.position.z+=p.z-head.z;}});controllers.push(controller);}
let last=0,snapReady=true;const direction=new THREE.Vector3(),right=new THREE.Vector3(),up=new THREE.Vector3(0,1,0),head=new THREE.Vector3();
renderer.setAnimationLoop(t=>{const dt=Math.min((t-last)/1000,.04);last=t;marker.visible=false;if(renderer.xr.isPresenting){for(const c of controllers){const p=targetFor(c);if(p){marker.position.copy(p);marker.position.y=.01;marker.visible=true;break;}}const session=renderer.xr.getSession();for(const source of session.inputSources){const gp=source.gamepad;if(!gp)continue;const x=gp.axes[2]??gp.axes[0]??0,y=gp.axes[3]??gp.axes[1]??0;if(source.handedness==='right'){if(Math.abs(x)<.25)snapReady=true;if(Math.abs(x)>.7&&snapReady){renderer.xr.getCamera().getWorldPosition(head);rig.rotateY(-Math.sign(x)*Math.PI/6);rig.updateMatrixWorld(true);const after=renderer.xr.getCamera().getWorldPosition(new THREE.Vector3());rig.position.x+=head.x-after.x;rig.position.z+=head.z-after.z;snapReady=false;}}if(source.handedness==='left'&&document.querySelector('#movement').value==='on'){renderer.xr.getCamera().getWorldDirection(direction);direction.y=0;direction.normalize();right.crossVectors(direction,up);const movement=direction.clone().multiplyScalar(Math.abs(y)>.15?-y*dt*1.8:0).addScaledVector(right,Math.abs(x)>.15?x*dt*1.8:0);renderer.xr.getCamera().getWorldPosition(head);head.add(movement);rig.position.add(movement);}}}else controls.update();renderer.render(scene,camera);});
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});

function freezeScene(root){
 root.updateMatrixWorld(true);
 const skinned=[];root.traverse(o=>{if(o.isSkinnedMesh)skinned.push(o);});
 for(const o of skinned){
  o.skeleton.update();const geometry=o.geometry.clone(),positions=geometry.attributes.position,v=new THREE.Vector3();
  for(let i=0;i<positions.count;i++){o.getVertexPosition(i,v);positions.setXYZ(i,v.x,v.y,v.z);}
  geometry.deleteAttribute('skinIndex');geometry.deleteAttribute('skinWeight');geometry.morphAttributes={};geometry.computeVertexNormals();geometry.computeBoundingSphere();
  const mesh=new THREE.Mesh(geometry,o.material);mesh.name=o.name;mesh.position.copy(o.position);mesh.quaternion.copy(o.quaternion);mesh.scale.copy(o.scale);o.parent.add(mesh);o.removeFromParent();
 }
 root.traverse(o=>{if(o.isMesh){for(const m of Array.isArray(o.material)?o.material:[o.material]){m.normalMap=null;m.roughnessMap=null;m.metalnessMap=null;m.aoMap=null;m.needsUpdate=true;}}o.updateMatrix();o.matrixAutoUpdate=false;});
 root.updateMatrixWorld(true);
}
