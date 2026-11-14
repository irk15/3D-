import * as THREE from 'three';
import { CFG } from './config.js';
import { lon2x, lat2z } from './proj.js';
import { TileManager } from './tiles.js';
import { Sky } from './sky.js';
import { Transit } from './transit.js';
import { Controls } from './controls.js';
import { cnTower } from './landmarks.js';

const $ = (id) => document.getElementById(id);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', logarithmicDepthBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 2, 20000);
camera.position.set(lon2x(CFG.START.lon) + 250, 380, lat2z(CFG.START.lat) + 650);
const controls = new Controls(camera, renderer.domElement); controls.yaw = -0.1; controls.pitch = -0.3;

const sky = new Sky(scene, renderer);
const tiles = new TileManager(scene, renderer);
const cn = cnTower(scene);
const transit = new Transit(scene);
scene.fog.far = tiles.tileSize() * (CFG.RADIUS + 0.4); scene.fog.near = scene.fog.far * 0.25;

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
addEventListener('keydown', (e) => { if (e.code === 'KeyF') toggleFollow(true); if (e.code === 'KeyB') toggleFollow(false); });
$('follow').onclick = () => toggleFollow(true);

tiles.init().catch((e) => { $('stat').textContent = tiles.status; });

addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

let last = performance.now(), fpsT = 0, frames = 0, fps = 0;
renderer.setAnimationLoop(() => {
  const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (live) { hour = torontoHour(); $('hour').value = hour; }
  controls.update(dt);
  const night = sky.update(hour, camera.position);
  tiles.setNight(night); transit.setNight(night);
  cn.beacon.visible = Math.floor(now / 900) % 2 === 0;
  tiles.update(camera.position);
  transit.update(dt, camera.position, scene.fog.far * 1.05);
  renderer.render(scene, camera);
  frames++; fpsT += dt;
  if (fpsT > 0.5) { fps = Math.round(frames / fpsT); frames = 0; fpsT = 0;
    const h = Math.floor(hour), m = Math.floor((hour % 1) * 60);
    $('stat').textContent = `${fps} fps · ${tiles.loaded}/${tiles.total} tiles · ${h}:${String(m).padStart(2, '0')}\n${transit.status}${transit.nCar != null ? ` (${transit.nCar} streetcars, ${transit.nBus} buses in view)` : ''}${controls.follow ? `\nriding route ${controls.follow.route}` : ''}${tiles.status.startsWith('TILE') || tiles.status.startsWith('tile error') ? '\n' + tiles.status : ''}`;
    $('follow').textContent = controls.follow ? 'Stop riding (F)' : 'Ride nearest streetcar (F)';
  }
});
window.__tc = { scene, camera, tiles, transit, controls }; // handy for debugging in the console
