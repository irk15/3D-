import * as THREE from 'three';
import { CFG } from './config.js';
import { lon2x, lat2z } from './proj.js';
import { TileManager } from './tiles.js';
import { Atmosphere, liveWeather, U as AU } from '../../lib/atmosphere.js';
import { WaterMirror, MIRROR_LAYER } from '../../lib/mirror.js';
import { Transit } from './transit.js';
import { Controls } from './controls.js';
import { cnTower } from './landmarks.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const $ = (id) => document.getElementById(id);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', logarithmicDepthBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 2, 20000);
camera.position.set(lon2x(CFG.START.lon) + 250, 380, lat2z(CFG.START.lat) + 650);
const controls = new Controls(camera, renderer.domElement); controls.yaw = -0.1; controls.pitch = -0.3;

const tzOff = () => { try { const p = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Toronto', timeZoneName: 'shortOffset' }).formatToParts(new Date()).find((x) => x.type === 'timeZoneName').value; const mm = /GMT([+-]\d+)/.exec(p); return mm ? +mm[1] : -5; } catch (e) { return -5; } };
const atm = new Atmosphere(renderer, scene, { lat: 43.6532, lon: -79.3832, tz: tzOff() }); atm.setDate(new Date());
for (const o of [atm.sky, atm.sun, atm.hemi]) o.layers.enable(MIRROR_LAYER);
const mirror = new WaterMirror(renderer, scene); mirror.setSize(innerWidth * renderer.getPixelRatio(), innerHeight * renderer.getPixelRatio());
const tiles = new TileManager(scene, renderer); tiles.mirrorU = mirror.u;
const cn = cnTower(scene);
scene.environmentIntensity = 1.0;
// cinematic pipeline: HDR render target (4x MSAA) + bloom for night lights, sun shadows
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 }));
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.3, 0.65, 0.9); composer.addPass(bloom); composer.addPass(new OutputPass());
composer.setSize(innerWidth, innerHeight);
let cine = true;
function setCine(v) { cine = v; atm.shadowOn = v; tiles.setShadows(v); $('cine').textContent = v ? 'Cinematic: ON (G)' : 'Cinematic: OFF (G)'; }
const transit = new Transit(scene);
const FOG_FAR = tiles.tileSize() * (CFG.RADIUS + 0.4);
cn.mesh.traverse((o) => o.layers.enable(MIRROR_LAYER));

// ---- time of day (default: live Toronto time)
let live = true, hour = 12;
const torontoHour = () => { const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', hour: 'numeric', minute: 'numeric', hour12: false }).formatToParts(new Date()); return +p.find((x) => x.type === 'hour').value % 24 + +p.find((x) => x.type === 'minute').value / 60; };
$('live').onchange = (e) => { live = e.target.checked; };
$('hour').oninput = (e) => { hour = +e.target.value; live = false; $('live').checked = false; };

// ---- follow a vehicle
function toggleFollow(wantCar) {
  if (controls.follow) { controls.follow = null; const e = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ'); controls.yaw = e.y; controls.pitch = e.x; return; }
  controls.follow = transit.nearest(camera.position, wantCar) || transit.nearest(camera.position, !wantCar);
}
addEventListener('keydown', (e) => { if (e.code === 'KeyF') toggleFollow(true); if (e.code === 'KeyB') toggleFollow(false); if (e.code === 'KeyG') setCine(!cine); });
$('cine').onclick = () => setCine(!cine);
$('season').onchange = (e) => { atm.season = e.target.value; };
$('weather').onchange = (e) => { atm.weather = e.target.value; };
let liveW = null;
async function pollWeather() { try { liveW = await liveWeather(43.6532, -79.3832); atm.liveWeather = liveW.weather; } catch (e) { /* offline: stay clear */ } }
pollWeather(); setInterval(pollWeather, 600000);
let mirrorOn = true; const setMirror = (v) => { mirrorOn = v; mirror.enabled = v; tiles.waterMat.envMapIntensity = v ? 0.45 : 1.6; $('mirror').textContent = v ? 'Lake mirror: ON (M)' : 'Lake mirror: OFF (M)'; };
$('mirror').onclick = () => setMirror(!mirrorOn); addEventListener('keydown', (e) => { if (e.code === 'KeyM') setMirror(!mirrorOn); });
$('follow').onclick = () => toggleFollow(true);

tiles.init().catch((e) => { $('stat').textContent = tiles.status; });

addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); mirror.setSize(innerWidth * renderer.getPixelRatio(), innerHeight * renderer.getPixelRatio()); composer.setSize(innerWidth, innerHeight); bloom.setSize(innerWidth, innerHeight); });

let last = performance.now(), fpsT = 0, frames = 0, fps = 0; const fwd = new THREE.Vector3(), focus = new THREE.Vector3();
renderer.setAnimationLoop(() => {
  const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (live) { hour = torontoHour(); $('hour').value = hour; }
  controls.update(dt);
  camera.getWorldDirection(fwd); { const hz = Math.hypot(fwd.x, fwd.z) || 1, gd = fwd.y < -0.02 ? (camera.position.y / -fwd.y) * hz : 1e5, d = Math.min(gd, 380); focus.set(camera.position.x + (fwd.x / hz) * d, 0, camera.position.z + (fwd.z / hz) * d); }
  AU.uTime.value = now / 1000; atm.hour = hour; atm.camPos = camera.position;
  const { night } = atm.update(dt, focus);
  scene.fog.far = FOG_FAR * atm.fogScale; scene.fog.near = scene.fog.far * 0.22; tiles.waterU.value = now / 1000;
  tiles.setNight(night); transit.setNight(night); cn.setNight(night);
  bloom.strength = cine ? 0.12 + night * 0.55 : 0;
  cn.beacon.visible = Math.floor(now / 900) % 2 === 0;
  tiles.update(camera.position);
  transit.update(dt, camera.position, scene.fog.far * 1.05);
  mirror.update(camera);
  if (cine) composer.render(dt); else renderer.render(scene, camera);
  frames++; fpsT += dt;
  if (fpsT > 0.5) { fps = Math.round(frames / fpsT); frames = 0; fpsT = 0;
    const h = Math.floor(hour), m = Math.floor((hour % 1) * 60);
    $('stat').textContent = `${fps} fps · ${tiles.loaded}/${tiles.total} tiles · ${h}:${String(m).padStart(2, '0')} · ${atm.effSeason}, ${atm.effWeather}${liveW && atm.weather === 'auto' ? ' (live ' + Math.round(liveW.temp) + '°C)' : ''}\n${transit.status}${transit.nCar != null ? ` (${transit.nCar} streetcars, ${transit.nBus} buses in view)` : ''}${controls.follow ? `\nriding route ${controls.follow.route}` : ''}${tiles.status.startsWith('TILE') || tiles.status.startsWith('tile error') ? '\n' + tiles.status : ''}`;
    $('follow').textContent = controls.follow ? 'Stop riding (F)' : 'Ride nearest streetcar (F)';
  }
});
window.__tc = { scene, camera, tiles, transit, controls, atm, mirror }; // handy for debugging in the console
