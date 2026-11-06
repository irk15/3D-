import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { CARS, PAINTS, FINISHES, MOODS, UNDERGLOW } from './cars.js';
import { EngineAudio } from './audio.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const params = new URLSearchParams(location.search);
const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;
const ease = {
  inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  out: (t) => 1 - Math.pow(1 - t, 3),
  in: (t) => t * t * t
};

/* ───────────────────────── Renderer & scene ───────────────────────── */
const canvas = $('#scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.localClippingEnabled = true;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x04060b);
scene.fog = new THREE.Fog(0x04060b, 38, 170);

const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 400);
camera.position.set(5.4, 1.9, 5.8);

const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 0.75, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 3.2;
controls.maxDistance = 14;
controls.maxPolarAngle = Math.PI * 0.49;
controls.enablePan = false;

const composer = new EffectComposer(
  renderer,
  new THREE.WebGLRenderTarget(innerWidth, innerHeight, { samples: 4, type: THREE.HalfFloatType })
);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.2, 0.3, 2.4);
composer.addPass(bloom);
composer.addPass(new OutputPass());

/* ───────────────────────── Helpers ───────────────────────── */
function canvasTex(w, h, draw, opts = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = opts.linear ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (opts.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...opts.repeat); }
  return t;
}
const glowTex = canvasTex(128, 128, (g, w, h) => {
  const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.25, 'rgba(255,255,255,.55)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
});
const hdr = (hex, k) => new THREE.Color(hex).multiplyScalar(k);

// Simple tween system
const tweens = new Set();
function tween(duration, onUpdate, easing = ease.inOut) {
  return new Promise((resolve) => {
    tweens.add({ t: 0, d: Math.max(duration, 0.0001), onUpdate, easing, resolve });
  });
}
function stepTweens(dt) {
  for (const tw of tweens) {
    tw.t += dt;
    const k = clamp(tw.t / tw.d, 0, 1);
    tw.onUpdate(tw.easing(k));
    if (k >= 1) { tweens.delete(tw); tw.resolve(); }
  }
}
const wait = (s) => tween(s, () => {}, (t) => t);

/* ───────────────────────── Garage ───────────────────────── */
const W = 26, D = 32, H = 9; // room size
const accentA = new THREE.MeshBasicMaterial({ color: hdr('#00e5ff', 3) });
const accentB = new THREE.MeshBasicMaterial({ color: hdr('#ff2bd6', 3) });
const panelLight = new THREE.MeshBasicMaterial({ color: hdr('#ffffff', 3.5) });

const garage = new THREE.Group();
scene.add(garage);

// Floor: real-time reflection + polished concrete layer
const reflector = new Reflector(new THREE.PlaneGeometry(W, D), {
  clipBias: 0.003,
  textureWidth: Math.floor(innerWidth * 0.5),
  textureHeight: Math.floor(innerHeight * 0.5),
  color: 0x60646c
});
reflector.rotation.x = -Math.PI / 2;
garage.add(reflector);

const concrete = canvasTex(1024, 1024, (g, w, h) => {
  g.fillStyle = '#2a2d33'; g.fillRect(0, 0, w, h);
  const img = g.getImageData(0, 0, w, h);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 18;
    img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
  for (let i = 0; i < 40; i++) {
    g.fillStyle = `rgba(0,0,0,${Math.random() * 0.06})`;
    g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 20 + Math.random() * 120, 0, 7); g.fill();
  }
  g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineWidth = 3;
  for (let x = 0; x <= w; x += 256) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
  for (let y = 0; y <= h; y += 256) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
}, { repeat: [W / 8, D / 8] });
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(W, D),
  new THREE.MeshStandardMaterial({ map: concrete, roughness: 0.55, metalness: 0.1, transparent: true, opacity: 0.88 })
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = 0.004;
floor.receiveShadow = true;
garage.add(floor);

// Floor rings around the turntable
const ring1 = new THREE.Mesh(new THREE.RingGeometry(4.15, 4.2, 128), accentA);
ring1.rotation.x = -Math.PI / 2; ring1.position.y = 0.01; garage.add(ring1);
const hazard = canvasTex(1024, 32, (g, w, h) => {
  g.fillStyle = '#f5c400'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#111';
  for (let x = -h; x < w; x += 48) { g.beginPath(); g.moveTo(x, h); g.lineTo(x + h, 0); g.lineTo(x + h + 22, 0); g.lineTo(x + 22, h); g.fill(); }
}, { repeat: [6, 1] });
const hazardRing = new THREE.Mesh(new THREE.RingGeometry(4.45, 4.7, 128, 1), new THREE.MeshStandardMaterial({ map: hazard, roughness: 0.7, transparent: true, opacity: 0.8 }));
hazardRing.rotation.x = -Math.PI / 2; hazardRing.position.y = 0.008; hazardRing.receiveShadow = true;
// polar UVs so the stripes wrap around
{
  const pos = hazardRing.geometry.attributes.position, uv = hazardRing.geometry.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const a = Math.atan2(pos.getY(i), pos.getX(i));
    const r = Math.hypot(pos.getX(i), pos.getY(i));
    uv.setXY(i, (a + Math.PI) / (Math.PI * 2), (r - 4.45) / 0.25);
  }
}
garage.add(hazardRing);

// Walls
const wallMat = new THREE.MeshStandardMaterial({ color: 0x15171c, roughness: 0.75, metalness: 0.25 });
const ribMat = new THREE.MeshStandardMaterial({ color: 0x23262d, roughness: 0.35, metalness: 0.7 });
const box = (w, h, d, mat, x, y, z, parent = garage) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z); m.castShadow = false; m.receiveShadow = true;
  parent.add(m); return m;
};
const doorW = 9, doorH = 5.6;
// side walls
box(0.3, H, D, wallMat, -W / 2, H / 2, 0);
box(0.3, H, D, wallMat, W / 2, H / 2, 0);
// front wall (behind default camera)
box(W, H, 0.3, wallMat, 0, H / 2, D / 2);
// back wall with door opening
box((W - doorW) / 2, H, 0.3, wallMat, -(W + doorW) / 4, H / 2, -D / 2);
box((W - doorW) / 2, H, 0.3, wallMat, (W + doorW) / 4, H / 2, -D / 2);
box(doorW, H - doorH, 0.3, wallMat, 0, doorH + (H - doorH) / 2, -D / 2);
// ceiling
box(W, 0.3, D, new THREE.MeshStandardMaterial({ color: 0x0b0c10, roughness: 0.9 }), 0, H, 0);

// vertical ribs + neon strips on the side walls
for (let z = -D / 2 + 2; z <= D / 2 - 2; z += 2.4) {
  box(0.25, H, 0.35, ribMat, -W / 2 + 0.25, H / 2, z);
  box(0.25, H, 0.35, ribMat, W / 2 - 0.25, H / 2, z);
}
box(0.06, 0.06, D - 1, accentA, -W / 2 + 0.42, 0.9, 0);
box(0.06, 0.06, D - 1, accentA, -W / 2 + 0.42, 6.4, 0);
box(0.06, 0.06, D - 1, accentB, W / 2 - 0.42, 0.9, 0);
box(0.06, 0.06, D - 1, accentB, W / 2 - 0.42, 6.4, 0);
// door frame neon
box(0.08, doorH, 0.08, accentA, -doorW / 2 - 0.15, doorH / 2, -D / 2 + 0.2);
box(0.08, doorH, 0.08, accentB, doorW / 2 + 0.15, doorH / 2, -D / 2 + 0.2);
box(doorW + 0.38, 0.08, 0.08, panelLight, 0, doorH + 0.15, -D / 2 + 0.2);
// front wall ribs
for (let x = -W / 2 + 2; x <= W / 2 - 2; x += 2.4) box(0.35, H, 0.25, ribMat, x, H / 2, D / 2 - 0.2);
box(W - 1, 0.06, 0.06, accentA, 0, 0.9, D / 2 - 0.4);

// Roll-up door
const door = new THREE.Group();
const slatMat = new THREE.MeshStandardMaterial({ color: 0x3a3e46, roughness: 0.45, metalness: 0.85 });
for (let i = 0; i < 14; i++) {
  const s = box(doorW + 0.2, doorH / 14 - 0.03, 0.08, slatMat, 0, (i + 0.5) * (doorH / 14), 0, door);
  s.castShadow = true;
}
door.position.z = -D / 2 - 0.28;
garage.add(door);

// Neon sign above the door
const signTex = canvasTex(1024, 256, (g, w, h) => {
  g.clearRect(0, 0, w, h);
  g.font = '900 120px Orbitron, Arial Black, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = '#fff'; g.shadowBlur = 12;
  g.fillStyle = '#ffffff';
  g.fillText('APEX', w * 0.3, h / 2);
  g.fillStyle = '#ffffff';
  g.fillText('//', w * 0.53, h / 2);
  g.fillText('GARAGE', w * 0.77, h / 2);
});
const signMat = new THREE.MeshBasicMaterial({ map: signTex, transparent: true, color: hdr('#ff2bd6', 3), depthWrite: false });
const sign = new THREE.Mesh(new THREE.PlaneGeometry(7, 1.75), signMat);
sign.position.set(0, 7.3, -D / 2 + 0.2);
garage.add(sign);

// Side wall graphics
const stripeTex = canvasTex(1024, 256, (g, w, h) => {
  g.fillStyle = 'rgba(255,255,255,.9)';
  g.font = '700 46px Orbitron, Arial, sans-serif';
  g.fillText('PERFORMANCE  ·  TUNING  ·  DETAILING', 20, 90);
  g.font = '500 26px Rajdhani, Arial, sans-serif';
  g.fillStyle = 'rgba(255,255,255,.45)';
  g.fillText('EST. 2026  —  BAY 07  —  AUTHORIZED PERSONNEL ONLY', 22, 150);
});
const wallText = new THREE.Mesh(new THREE.PlaneGeometry(12, 3), new THREE.MeshBasicMaterial({ map: stripeTex, transparent: true, color: hdr('#ffffff', 0.9), depthWrite: false }));
wallText.position.set(-W / 2 + 0.45, 3.3, 3); wallText.rotation.y = Math.PI / 2; garage.add(wallText);

// Ceiling: honeycomb light (the classic detailing studio look)
function buildHoneycomb(rings = 3, size = 1.05) {
  const edges = new Map();
  for (let q = -rings; q <= rings; q++) {
    for (let r = Math.max(-rings, -q - rings); r <= Math.min(rings, -q + rings); r++) {
      const cx = size * 1.5 * q, cz = size * Math.sqrt(3) * (r + q / 2);
      for (let i = 0; i < 6; i++) {
        const a1 = (Math.PI / 3) * i, a2 = (Math.PI / 3) * (i + 1);
        const x1 = cx + size * Math.cos(a1), z1 = cz + size * Math.sin(a1);
        const x2 = cx + size * Math.cos(a2), z2 = cz + size * Math.sin(a2);
        const mx = (x1 + x2) / 2, mz = (z1 + z2) / 2;
        edges.set(`${mx.toFixed(2)},${mz.toFixed(2)}`, { mx, mz, ang: Math.atan2(z2 - z1, x2 - x1) });
      }
    }
  }
  const geo = new THREE.BoxGeometry(size * 0.86, 0.05, 0.07);
  const mesh = new THREE.InstancedMesh(geo, panelLight, edges.size);
  const m = new THREE.Matrix4(), qn = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1);
  let i = 0;
  for (const e of edges.values()) {
    qn.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -e.ang);
    m.compose(new THREE.Vector3(e.mx, 0, e.mz), qn, s);
    mesh.setMatrixAt(i++, m);
  }
  return mesh;
}
const honey = buildHoneycomb();
honey.position.y = H - 0.6;
garage.add(honey);
const honeyFrame = new THREE.Mesh(new THREE.CylinderGeometry(7.6, 7.6, 0.25, 6, 1, true), new THREE.MeshStandardMaterial({ color: 0x0c0d11, metalness: 0.8, roughness: 0.4, side: THREE.DoubleSide }));
honeyFrame.position.y = H - 0.55; honeyFrame.rotation.y = Math.PI / 6; garage.add(honeyFrame);
// long panels near the walls
for (const x of [-9.5, 9.5]) for (const z of [-10, 0, 10]) box(0.5, 0.05, 6, panelLight, x, H - 0.2, z);

// Props: tool cabinets (right wall)
const cabMat = new THREE.MeshStandardMaterial({ color: 0xb3121f, roughness: 0.35, metalness: 0.55 });
const drawerTex = canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#b3121f'; g.fillRect(0, 0, w, h);
  for (let y = 20; y < h; y += 46) {
    g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(8, y + 34, w - 16, 3);
    g.fillStyle = '#d9d9d9'; g.fillRect(w * 0.3, y + 14, w * 0.4, 6);
  }
});
const cabFront = new THREE.MeshStandardMaterial({ map: drawerTex, roughness: 0.35, metalness: 0.5 });
for (const [z, h] of [[-8, 1.1], [-5.8, 1.1], [-3.6, 1.6]]) {
  const c = new THREE.Mesh(new THREE.BoxGeometry(0.75, h, 2.1), [cabFront, cabMat, cabMat, cabMat, cabMat, cabMat]);
  c.material = [cabMat, cabFront, cabMat, cabMat, cabMat, cabMat];
  c.position.set(W / 2 - 0.85, h / 2, z); c.castShadow = c.receiveShadow = true;
  garage.add(c);
}
// Workbench
box(0.9, 0.08, 5, new THREE.MeshStandardMaterial({ color: 0x5a3b22, roughness: 0.6 }), W / 2 - 0.9, 1.05, 4);
box(0.9, 1.0, 0.08, ribMat, W / 2 - 0.9, 0.5, 1.6);
box(0.9, 1.0, 0.08, ribMat, W / 2 - 0.9, 0.5, 6.4);
// Pegboard
const peg = canvasTex(512, 256, (g, w, h) => {
  g.fillStyle = '#1b1e24'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#0a0b0d';
  for (let x = 8; x < w; x += 16) for (let y = 8; y < h; y += 16) { g.beginPath(); g.arc(x, y, 2.2, 0, 7); g.fill(); }
  g.strokeStyle = '#9aa1ad'; g.lineWidth = 6; g.lineCap = 'round';
  [[60, 40, 60, 180], [110, 40, 110, 150], [160, 50, 180, 200], [240, 40, 240, 170], [300, 60, 330, 180], [400, 40, 400, 210], [450, 50, 450, 140]].forEach(([a, b, c, d]) => { g.beginPath(); g.moveTo(a, b); g.lineTo(c, d); g.stroke(); });
  g.fillStyle = '#c51d2a'; g.fillRect(200, 190, 90, 34);
});
const pegboard = new THREE.Mesh(new THREE.PlaneGeometry(5, 2.5), new THREE.MeshStandardMaterial({ map: peg, roughness: 0.8 }));
pegboard.position.set(W / 2 - 0.42, 2.6, 4); pegboard.rotation.y = -Math.PI / 2; garage.add(pegboard);

// Tire stacks (left wall)
const tireMat = new THREE.MeshStandardMaterial({ color: 0x0c0c0d, roughness: 0.92 });
const tireGeo = new THREE.TorusGeometry(0.34, 0.15, 16, 40);
for (const [x, z, n] of [[-W / 2 + 1, -9, 4], [-W / 2 + 1, -7.9, 3], [-W / 2 + 1.9, -8.5, 2], [-W / 2 + 1, 8, 4], [-W / 2 + 1, 9.1, 5]]) {
  for (let i = 0; i < n; i++) {
    const t = new THREE.Mesh(tireGeo, tireMat);
    t.rotation.x = Math.PI / 2; t.rotation.z = Math.random();
    t.position.set(x, 0.15 + i * 0.3, z); t.castShadow = t.receiveShadow = true;
    garage.add(t);
  }
}

// Outside: night street visible through the door
const outside = new THREE.Group();
scene.add(outside);
const asphalt = canvasTex(256, 1024, (g, w, h) => {
  g.fillStyle = '#121418'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
  g.fillStyle = 'rgba(255,255,255,.75)';
  for (let y = 0; y < h; y += 128) g.fillRect(w / 2 - 3, y, 6, 64);
  g.fillStyle = 'rgba(255,210,0,.7)'; g.fillRect(14, 0, 5, h); g.fillRect(w - 19, 0, 5, h);
}, { repeat: [1, 14] });
const road = new THREE.Mesh(new THREE.PlaneGeometry(14, 260), new THREE.MeshStandardMaterial({ map: asphalt, roughness: 0.6, metalness: 0.1 }));
road.rotation.x = -Math.PI / 2; road.position.set(0, 0.002, -D / 2 - 130); road.receiveShadow = true; outside.add(road);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 300), new THREE.MeshStandardMaterial({ color: 0x07080b, roughness: 1 }));
ground.rotation.x = -Math.PI / 2; ground.position.set(0, -0.01, -D / 2 - 150); outside.add(ground);
const lampMat = new THREE.MeshStandardMaterial({ color: 0x1a1c20, metalness: 0.8, roughness: 0.4 });
const lampHead = new THREE.MeshBasicMaterial({ color: hdr('#ffd9a0', 6) });
for (let z = -D / 2 - 10; z > -260; z -= 22) {
  for (const s of [-1, 1]) {
    box(0.15, 6, 0.15, lampMat, s * 8, 3, z, outside);
    box(1.6, 0.1, 0.15, lampMat, s * 7.3, 6, z, outside);
    box(0.7, 0.08, 0.3, lampHead, s * 6.8, 5.94, z, outside);
    const pool = new THREE.Mesh(new THREE.CircleGeometry(4.5, 32), new THREE.MeshBasicMaterial({ map: glowTex, color: hdr('#ffb565', 0.35), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    pool.rotation.x = -Math.PI / 2; pool.position.set(s * 6, 0.02, z); outside.add(pool);
  }
}
const skyline = canvasTex(2048, 512, (g, w, h) => {
  const gr = g.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, '#04060b'); gr.addColorStop(0.7, '#1a0f2e'); gr.addColorStop(1, '#3a1640');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  let x = 0;
  while (x < w) {
    const bw = 40 + Math.random() * 110, bh = 80 + Math.random() * 330;
    g.fillStyle = '#05060a'; g.fillRect(x, h - bh, bw, bh);
    for (let wy = h - bh + 10; wy < h - 6; wy += 12) for (let wx = x + 6; wx < x + bw - 6; wx += 10) {
      if (Math.random() < 0.28) { g.fillStyle = Math.random() < 0.8 ? 'rgba(255,214,150,.85)' : 'rgba(120,220,255,.85)'; g.fillRect(wx, wy, 4, 6); }
    }
    x += bw + Math.random() * 12;
  }
});
const sky = new THREE.Mesh(new THREE.PlaneGeometry(420, 105), new THREE.MeshBasicMaterial({ map: skyline, fog: false, color: hdr('#ffffff', 1.4) }));
sky.position.set(0, 40, -300); outside.add(sky);

// Dust in the light
const dust = (() => {
  const n = 500, g = new THREE.BufferGeometry(), p = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { p[i * 3] = (Math.random() - 0.5) * 16; p[i * 3 + 1] = Math.random() * 8; p[i * 3 + 2] = (Math.random() - 0.5) * 16; }
  g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  const pts = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.035, map: glowTex, color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(pts);
  return pts;
})();

/* ───────────────────────── Lights ───────────────────────── */
const hemi = new THREE.HemisphereLight(0x9fb4ff, 0x0a0a10, 0.35);
scene.add(hemi);
const key = new THREE.SpotLight(0xffffff, 170, 30, 0.62, 0.65, 1.6);
key.position.set(0, H - 0.4, 0.6);
key.target.position.set(0, 0, 0);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.bias = -0.0004;
key.shadow.normalBias = 0.02;
key.shadow.camera.near = 2; key.shadow.camera.far = 14;
scene.add(key, key.target);
const rimA = new THREE.SpotLight(0x00e5ff, 60, 30, 0.38, 0.8, 1.6);
rimA.position.set(-9, 5, -5); rimA.target.position.set(0, 0.6, 0);
const rimB = new THREE.SpotLight(0xff2bd6, 60, 30, 0.38, 0.8, 1.6);
rimB.position.set(9, 5, 5); rimB.target.position.set(0, 0.6, 0);
const fill = new THREE.PointLight(0xffffff, 8, 20, 1.6);
fill.position.set(0, 3, 9);
scene.add(rimA, rimA.target, rimB, rimB.target, fill);

/* ───────────────────────── Environment (reflections) ───────────────────────── */
const pmrem = new THREE.PMREMGenerator(renderer);
let envRT = null;
function buildEnvironment(mood) {
  const env = new THREE.Scene();
  env.background = new THREE.Color(0x020203);
  const room = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), new THREE.MeshBasicMaterial({ color: 0x07080a, side: THREE.BackSide }));
  room.position.y = H / 2 - 1; env.add(room);
  const hc = buildHoneycomb();
  hc.material = new THREE.MeshBasicMaterial({ color: hdr('#ffffff', 6 * mood.ceiling) });
  hc.position.y = H - 1.6; env.add(hc);
  const add = (w, h, d, color, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ color })); m.position.set(x, y, z); env.add(m); };
  // big soft boxes for clean body reflections
  add(0.2, 2.2, 10, hdr('#ffffff', 2.2 * mood.ceiling), -W / 2 + 1, 2.5, 0);
  add(0.2, 2.2, 10, hdr('#ffffff', 2.2 * mood.ceiling), W / 2 - 1, 2.5, 0);
  add(10, 2.2, 0.2, hdr('#ffffff', 1.6 * mood.ceiling), 0, 2.5, D / 2 - 1);
  add(0.2, 0.2, D - 2, hdr(mood.a, 5), -W / 2 + 0.6, 0, 0);
  add(0.2, 0.2, D - 2, hdr(mood.a, 5), -W / 2 + 0.6, 5.4, 0);
  add(0.2, 0.2, D - 2, hdr(mood.b, 5), W / 2 - 0.6, 0, 0);
  add(0.2, 0.2, D - 2, hdr(mood.b, 5), W / 2 - 0.6, 5.4, 0);
  const floorE = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshBasicMaterial({ color: 0x15161a }));
  floorE.rotation.x = -Math.PI / 2; floorE.position.y = -1; env.add(floorE);
  if (envRT) envRT.dispose();
  envRT = pmrem.fromScene(env, 0.03);
  scene.environment = envRT.texture;
  env.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
}

/* ───────────────────────── Turntable & lift ───────────────────────── */
const TABLE_TOP = 0.13;
const table = new THREE.Group();
scene.add(table);
const grooves = canvasTex(1024, 1024, (g, w, h) => {
  g.fillStyle = '#1d2026'; g.fillRect(0, 0, w, h);
  for (let r = 40; r < w / 2; r += 18) { g.strokeStyle = r % 72 === 4 ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.5)'; g.lineWidth = 2; g.beginPath(); g.arc(w / 2, h / 2, r, 0, 7); g.stroke(); }
  g.save(); g.translate(w / 2, h / 2);
  for (let i = 0; i < 48; i++) { g.rotate(Math.PI / 24); g.fillStyle = 'rgba(255,255,255,.04)'; g.fillRect(60, -1, w / 2 - 70, 2); }
  g.restore();
});
const tableMat = new THREE.MeshStandardMaterial({ map: grooves, metalness: 0.85, roughness: 0.32 });
const disc = new THREE.Mesh(new THREE.CylinderGeometry(3.3, 3.38, TABLE_TOP, 96), [new THREE.MeshStandardMaterial({ color: 0x2a2d33, metalness: 0.9, roughness: 0.3 }), tableMat, tableMat]);
disc.position.y = TABLE_TOP / 2; disc.receiveShadow = true; disc.castShadow = true;
table.add(disc);
const tableRing = new THREE.Mesh(new THREE.TorusGeometry(3.34, 0.025, 8, 160), accentA);
tableRing.rotation.x = Math.PI / 2; tableRing.position.y = TABLE_TOP - 0.01; table.add(tableRing);
const piston = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 1, 32), new THREE.MeshStandardMaterial({ color: 0xc8ccd4, metalness: 1, roughness: 0.15 }));
piston.scale.y = 0.001; piston.visible = false; scene.add(piston);
const pit = new THREE.Mesh(new THREE.CircleGeometry(3.4, 96), new THREE.MeshBasicMaterial({ color: 0x000000 }));
pit.rotation.x = -Math.PI / 2; pit.position.y = 0.006; pit.visible = false; scene.add(pit);

/* ───────────────────────── Car root & effects ───────────────────────── */
const carRoot = new THREE.Group();
scene.add(carRoot);
const clipPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 100);

// contact shadow
const contactTex = canvasTex(256, 256, (g, w, h) => {
  const gr = g.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w / 2);
  gr.addColorStop(0, 'rgba(0,0,0,.9)'); gr.addColorStop(0.6, 'rgba(0,0,0,.45)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
});
const contact = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: contactTex, transparent: true, depthWrite: false }));
contact.rotation.x = -Math.PI / 2; contact.position.y = 0.006; carRoot.add(contact);

// underglow
const glowMat = new THREE.MeshBasicMaterial({ map: glowTex, color: hdr('#00e5ff', 2.5), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
const glowPlane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), glowMat);
glowPlane.rotation.x = -Math.PI / 2; glowPlane.position.y = 0.012; carRoot.add(glowPlane);
const glowLight = new THREE.PointLight(0x00e5ff, 0, 6, 1.5);
glowLight.position.y = 0.2; carRoot.add(glowLight);

// headlights
const headGroup = new THREE.Group();
carRoot.add(headGroup);
const headSprites = [];
const headSpots = [];
for (const s of [-1, 1]) {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: hdr('#dfeaff', 3), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
  sp.scale.set(0.7, 0.7, 1); headGroup.add(sp); headSprites.push(sp);
  const spot = new THREE.SpotLight(0xe9f0ff, 0, 30, 0.42, 0.55, 1.4);
  spot.userData.side = s;
  headGroup.add(spot, spot.target); headSpots.push(spot);
}

// scan ring (car materialise effect)
const scanTex = canvasTex(512, 256, (g, w, h) => {
  g.strokeStyle = '#fff'; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6);
  g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 1;
  for (let x = 0; x < w; x += 16) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
  for (let y = 0; y < h; y += 16) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
});
const scanMat = new THREE.MeshBasicMaterial({ map: scanTex, color: hdr('#00e5ff', 3), transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, opacity: 0 });
const scan = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), scanMat);
scan.rotation.x = -Math.PI / 2; carRoot.add(scan);

/* ───────────────────────── State ───────────────────────── */
const state = {
  index: 0,
  mood: 'neon',
  spin: true,
  lift: 0, liftTarget: 0,
  angle: 0.55,
  glowOn: false, glowColor: UNDERGLOW[0],
  lights: false,
  rpm: 0, revving: false, engineOn: false,
  launching: false, speed: 0, gear: 'N',
  cam: 'orbit',
  busy: false,
  loaded: {},
  current: null, // { cfg, group, paint, size }
  custom: {}
};
try { state.custom = JSON.parse(localStorage.getItem('apex-garage') || '{}'); } catch { state.custom = {}; }
const save = () => { try { localStorage.setItem('apex-garage', JSON.stringify(state.custom)); } catch { /* storage unavailable */ } };
const custom = (cfg) => (state.custom[cfg.id] ||= { color: cfg.color, finish: cfg.finish, tune: { engine: 0, turbo: 0, weight: 0, tires: 0 } });

const audio = new EngineAudio();

/* ───────────────────────── Loading cars ───────────────────────── */
const manager = new THREE.LoadingManager();
const draco = new DRACOLoader(manager).setDecoderPath('vendor/three/addons/libs/draco/gltf/');
const loader = new GLTFLoader(manager).setDRACOLoader(draco).setMeshoptDecoder(MeshoptDecoder);

function enhanceMaterial(mat, cfg) {
  const n = (mat.name || '').toLowerCase();
  mat.envMapIntensity = 1;
  // transmission forces an extra full-scene render pass; fake it with alpha instead
  if (mat.transmission > 0) { mat.transmission = 0; mat.transparent = true; mat.opacity = Math.min(mat.opacity, 0.3); mat.roughness = 0.05; mat.depthWrite = false; }
  if (cfg.id === 'ferrari') {
    if (/glass/.test(n)) { mat.transparent = true; mat.opacity = n.includes('taillight') ? 0.7 : 0.35; mat.roughness = 0; mat.metalness = 0.2; mat.depthWrite = false; }
    else if (/chrome/.test(n)) { mat.metalness = 1; mat.roughness = 0.08; }
    else if (/metal/.test(n)) { mat.metalness = 1; mat.roughness = 0.35; }
    else if (/carbon/.test(n)) { mat.color.set(0x18191c); mat.metalness = 0.4; mat.roughness = 0.35; }
    else if (/tire/.test(n)) { mat.roughness = 0.9; mat.metalness = 0; }
    else if (/leather|interior|carpet/.test(n)) { mat.roughness = 0.75; mat.metalness = 0; }
    else if (/led|signal/.test(n)) { mat.emissive = mat.color.clone(); mat.emissiveIntensity = 0.6; }
    else { mat.roughness = 0.45; }
  }
}

function makePaint(cfg) {
  return new THREE.MeshPhysicalMaterial({
    name: 'apex-paint',
    color: cfg.color,
    clearcoat: 1,
    clearcoatRoughness: 0.03,
    iridescenceIOR: 1.3,
    iridescenceThicknessMinimum: 180,
    iridescenceThicknessMaximum: 600,
    envMapIntensity: 1.25
  });
}

function loadCar(i, onProgress) {
  const cfg = CARS[i];
  if (state.loaded[cfg.id]) return Promise.resolve(state.loaded[cfg.id]);
  return new Promise((resolve, reject) => {
    loader.load(cfg.file, (gltf) => {
      const model = gltf.scene;
      const fit = new THREE.Group();
      fit.add(model);
      fit.rotation.y = cfg.rotY;
      fit.updateMatrixWorld(true);
      let b = new THREE.Box3().setFromObject(fit);
      const sz = b.getSize(new THREE.Vector3());
      const s = cfg.length / Math.max(sz.z, sz.x);
      fit.scale.setScalar(s);
      fit.updateMatrixWorld(true);
      b = new THREE.Box3().setFromObject(fit);
      const c = b.getCenter(new THREE.Vector3());
      fit.position.set(-c.x, -b.min.y, -c.z);
      const holder = new THREE.Group();
      holder.add(fit);
      const size = b.getSize(new THREE.Vector3());

      const paint = makePaint(cfg);
      const mats = new Set([paint]);
      model.traverse((o) => {
        if (!o.isMesh) return;
        o.castShadow = true;
        o.receiveShadow = true;
        const list = Array.isArray(o.material) ? o.material : [o.material];
        const out = list.map((m) => {
          if (cfg.paint.includes(m.name)) return paint;
          enhanceMaterial(m, cfg);
          mats.add(m);
          return m;
        });
        o.material = Array.isArray(o.material) ? out : out[0];
      });
      for (const m of mats) { m.clippingPlanes = [clipPlane]; m.clipShadows = true; }

      const entry = { cfg, group: holder, paint, size, mats };
      state.loaded[cfg.id] = entry;
      resolve(entry);
    }, (e) => { if (onProgress && e.total) onProgress(e.loaded / e.total); }, reject);
  });
}

/* ───────────────────────── Customisation ───────────────────────── */
function applyPaint(entry) {
  const cu = custom(entry.cfg);
  const f = FINISHES[cu.finish] || FINISHES.gloss;
  const p = entry.paint;
  p.color.set(cu.color);
  p.metalness = f.metalness;
  p.roughness = f.roughness;
  p.clearcoat = f.clearcoat;
  p.clearcoatRoughness = f.clearcoatRoughness;
  p.iridescence = f.iridescence;
  if (cu.finish === 'chrome') p.color.lerp(new THREE.Color('#ffffff'), 0.35);
  p.needsUpdate = true;
}

function setColor(hex) {
  const e = state.current; if (!e) return;
  custom(e.cfg).color = hex; save();
  const from = e.paint.color.clone(), to = new THREE.Color(hex);
  tween(0.5, (k) => { e.paint.color.copy(from).lerp(to, k); }).then(() => applyPaint(e));
  syncPanel();
}
function setFinish(f) {
  const e = state.current; if (!e) return;
  custom(e.cfg).finish = f; save();
  applyPaint(e); syncPanel();
  toast(`${FINISHES[f].label} finish`);
}

function computeStats(cfg) {
  const b = cfg.stats, t = custom(cfg).tune;
  const hp = Math.round(b.hp * (1 + 0.07 * t.engine + 0.09 * t.turbo));
  const tq = Math.round(b.torque * (1 + 0.06 * t.engine + 0.1 * t.turbo));
  const weight = Math.round(b.weight * (1 - 0.035 * t.weight));
  const grip = 1 + 0.06 * t.tires;
  const zero = Math.max(1.9, b.zero100 * Math.pow(b.hp / hp, 0.55) * Math.pow(weight / b.weight, 0.5) / Math.pow(grip, 0.35));
  const top = Math.round(b.top * (1 + 0.02 * t.engine + 0.025 * t.turbo));
  const speed = clamp((top - 200) / 200, 0, 1);
  const accel = clamp((6 - zero) / 4.2, 0, 1);
  const handling = clamp(b.handling + 0.02 * t.weight + 0.025 * t.tires, 0, 1);
  const nitro = clamp(0.3 + 0.18 * t.turbo + 0.05 * t.engine, 0, 1);
  const pi = Math.round(500 + (speed + accel + handling + nitro) / 4 * 499);
  const cls = pi >= 900 ? 'S+' : pi >= 800 ? 'S' : pi >= 700 ? 'A' : pi >= 600 ? 'B' : 'C';
  return { hp, tq, weight, zero, top, speed, accel, handling, nitro, pi, cls };
}

let shown = { hp: 0, tq: 0, zero: 0, top: 0, pi: 0 };
function syncStats() {
  const e = state.current; if (!e) return;
  const s = computeStats(e.cfg);
  $('#barSpeed').style.width = `${s.speed * 100}%`;
  $('#barAccel').style.width = `${s.accel * 100}%`;
  $('#barHandle').style.width = `${s.handling * 100}%`;
  $('#barNitro').style.width = `${s.nitro * 100}%`;
  $('#piClass').textContent = s.cls;
  const from = { ...shown };
  tween(0.8, (k) => {
    $('#numHp').textContent = Math.round(lerp(from.hp, s.hp, k));
    $('#numTq').textContent = Math.round(lerp(from.tq, s.tq, k));
    $('#num0').textContent = lerp(from.zero, s.zero, k).toFixed(1);
    $('#numTop').textContent = Math.round(lerp(from.top, s.top, k));
    $('#piVal').textContent = Math.round(lerp(from.pi, s.pi, k));
  }, ease.out);
  shown = { hp: s.hp, tq: s.tq, zero: s.zero, top: s.top, pi: s.pi };
  $$('.carCard').forEach((c, i) => { c.querySelector('.cls').textContent = computeStats(CARS[i]).cls; });
}

function setGlow(on, color) {
  if (color) state.glowColor = color;
  state.glowOn = on;
  glowMat.color.copy(hdr(state.glowColor, 2.5));
  glowLight.color.set(state.glowColor);
  $('#tglGlow').classList.toggle('on', on); $('#tglGlow').textContent = on ? 'ON' : 'OFF';
  $$('#glowColors .dot').forEach((d) => d.classList.toggle('active', d.dataset.c === state.glowColor));
}
function setLights(on) {
  state.lights = on;
  $('#tglLights').classList.toggle('on', on); $('#tglLights').textContent = on ? 'ON' : 'OFF';
}

function setMood(id) {
  const m = MOODS[id]; state.mood = id;
  accentA.color.copy(hdr(m.a, 3));
  accentB.color.copy(hdr(m.b, 3));
  signMat.color.copy(hdr(m.b, 3));
  scanMat.color.copy(hdr(m.a, 3));
  panelLight.color.copy(hdr('#ffffff', 3.5 * m.ceiling));
  rimA.color.set(m.a); rimB.color.set(m.b);
  key.intensity = 170 * m.key;
  key.color.set(id === 'sunset' ? '#ffd2a1' : '#ffffff');
  hemi.intensity = id === 'showroom' ? 0.45 : 0.18;
  renderer.toneMappingExposure = m.exposure;
  scene.environmentIntensity = m.env;
  document.documentElement.style.setProperty('--acc', m.a === '#e8eefc' ? '#7fd8ff' : m.a);
  document.documentElement.style.setProperty('--acc2', m.b === '#e8eefc' ? '#b5a8ff' : m.b);
  buildEnvironment(m);
  $$('#moods button').forEach((b) => b.classList.toggle('active', b.dataset.m === id));
}

/* ───────────────────────── Showing a car ───────────────────────── */
function placeCar(entry) {
  const { size } = entry;
  carRoot.add(entry.group);
  contact.scale.set(size.x * 1.35, size.z * 1.18, 1);
  glowPlane.scale.set(size.x * 1.9, size.z * 1.35, 1);
  scan.scale.set(size.x + 0.5, size.z + 0.5, 1);
  headSprites.forEach((sp, i) => sp.position.set((i ? 1 : -1) * size.x * 0.34, size.y * 0.42, size.z * 0.47));
  headSpots.forEach((sp) => {
    sp.position.set(sp.userData.side * size.x * 0.34, size.y * 0.42, size.z * 0.45);
    sp.target.position.set(sp.userData.side * size.x * 0.4, 0, size.z * 0.5 + 12);
  });
  hotspots.forEach((h) => h.local.copy(h.at(size)));
}

async function materialise(entry, show) {
  const h = entry.size.y + 0.05;
  const base = carRoot.position.y;
  scanMat.opacity = 1;
  await tween(show ? 1.1 : 0.6, (k) => {
    const y = show ? lerp(0, h, k) : lerp(h, 0, k);
    clipPlane.constant = base + y;
    scan.position.y = y;
  }, show ? ease.out : ease.in);
  scanMat.opacity = 0;
  clipPlane.constant = show ? 100 : base;
}

async function selectCar(i, first = false) {
  if (state.busy || state.launching) return;
  if (!first && i === state.index && state.current) return;
  state.busy = true;
  state.index = i;
  const cfg = CARS[i];
  $$('.carCard').forEach((c, j) => c.classList.toggle('active', j === i));
  const card = $$('.carCard')[i];
  card.classList.add('loading');
  const loading = loadCar(i);
  if (state.current) await materialise(state.current, false);
  let entry;
  try { entry = await loading; } catch (err) { console.error(err); toast('Could not load model'); state.busy = false; card.classList.remove('loading'); return; }
  card.classList.remove('loading');
  if (state.current) carRoot.remove(state.current.group);
  state.current = entry;
  applyPaint(entry);
  placeCar(entry);
  audio.setCar(cfg.engine);
  state.rpm = state.engineOn ? cfg.engine.idle : 0;
  const t = $('.carTitle');
  $('#carMake').textContent = cfg.make;
  $('#carName').textContent = cfg.name;
  $('#carTag').textContent = cfg.tag;
  t.classList.remove('swap'); void t.offsetWidth; t.classList.add('swap');
  syncPanel(); syncStats();
  await materialise(entry, true);
  state.busy = false;
  // warm the next model in the background
  const next = (i + 1) % CARS.length;
  if (!state.loaded[CARS[next].id]) loadCar(next).catch(() => {});
}

/* ───────────────────────── Camera presets ───────────────────────── */
const CAMS = {
  orbit: () => ({ p: new THREE.Vector3(5.4, 1.9, 5.8), t: new THREE.Vector3(0, 0.75, 0) }),
  front: (s) => ({ p: new THREE.Vector3(0.6, 1.25, s.z * 0.5 + 4.2), t: new THREE.Vector3(0, 0.6, 0) }),
  side: (s) => ({ p: new THREE.Vector3(8.2, 1.2, 0.2), t: new THREE.Vector3(0, 0.6, 0) }),
  rear: (s) => ({ p: new THREE.Vector3(-1.4, 1.5, -(s.z * 0.5 + 4.6)), t: new THREE.Vector3(0, 0.65, 0) }),
  wheel: (s) => ({ p: new THREE.Vector3(s.x * 0.5 + 1.6, 0.55, s.z * 0.32 + 1.6), t: new THREE.Vector3(s.x * 0.5, 0.35, s.z * 0.3) }),
  top: () => ({ p: new THREE.Vector3(0.01, 11.5, 0.6), t: new THREE.Vector3(0, 0, 0) }),
  cine: () => ({ p: new THREE.Vector3(5.5, 0.6, 5.5), t: new THREE.Vector3(0, 0.8, 0) })
};
let camAnim = null;
async function setCam(name, { carLocal = true } = {}) {
  state.cam = name;
  $$('#cams button').forEach((b) => b.classList.toggle('active', b.dataset.cam === name));
  const size = state.current ? state.current.size : new THREE.Vector3(2, 1.2, 4.6);
  const { p, t } = CAMS[name](size);
  // wheel/front/rear/side follow the car's current heading
  if (carLocal && !['orbit', 'top', 'cine'].includes(name)) {
    const rot = new THREE.Matrix4().makeRotationY(carRoot.rotation.y);
    p.applyMatrix4(rot); t.applyMatrix4(rot);
    p.y += carRoot.position.y; t.y += carRoot.position.y;
  }
  if (name === 'orbit' || name === 'cine') { p.y += state.lift; t.y += state.lift; }
  const p0 = camera.position.clone(), t0 = controls.target.clone();
  const id = (camAnim = Symbol());
  state.camMoving = true;
  // lift the arc over the car so the camera never cuts through it
  await tween(1.4, (k) => {
    if (camAnim !== id) return;
    camera.position.lerpVectors(p0, p, k);
    camera.position.y += Math.sin(k * Math.PI) * 1.2;
    controls.target.lerpVectors(t0, t, k);
  });
  if (camAnim === id) state.camMoving = false;
  if (name !== 'orbit' && name !== 'cine' && state.spin && camAnim === id) toggleSpin(false);
}

/* ───────────────────────── Launch sequence ───────────────────────── */
async function launch() {
  if (state.launching || state.busy || !state.current) return;
  state.launching = true;
  document.body.classList.add('launching');
  const cfg = state.current.cfg;
  const stats = computeStats(cfg);
  if (!state.engineOn) await startEngine();
  if (state.liftTarget > 0) { state.liftTarget = 0; $('#btnLift').classList.remove('on'); await wait(1.3); }
  toggleSpin(false, true);
  setLights(true);

  // turn the car toward the door (nose to -Z)
  const a0 = carRoot.rotation.y;
  let a1 = Math.PI;
  while (a1 - a0 > Math.PI) a1 -= Math.PI * 2;
  while (a1 - a0 < -Math.PI) a1 += Math.PI * 2;
  const doorY = door.position.y;
  camAnim = Symbol();
  const p0 = camera.position.clone(), t0 = controls.target.clone();
  const camP = new THREE.Vector3(2.4, 1.55, 6.8), camT = new THREE.Vector3(0, 0.9, -6);
  controls.enabled = false;
  toast('Opening bay door');
  await tween(2.2, (k) => {
    carRoot.rotation.y = lerp(a0, a1, k);
    state.angle = carRoot.rotation.y;
    door.position.y = lerp(doorY, doorH - 0.15, k);
    camera.position.lerpVectors(p0, camP, k);
    controls.target.lerpVectors(t0, camT, k);
  });
  // rev up
  state.revving = true;
  toast('3 · 2 · 1 · GO');
  await wait(1.4);
  state.revving = false;
  $('#fade').classList.add('flash', 'on');
  setTimeout(() => $('#fade').classList.remove('on'), 60);
  setTimeout(() => $('#fade').classList.remove('flash'), 400);

  // drive
  const accel = (100 / 3.6) / stats.zero; // m/s²
  const vmax = stats.top / 3.6;
  let v = 0, gearTop = 0, gear = 1;
  const gearSpeeds = [0, 60, 105, 150, 200, 250, 400].map((x) => x / 3.6);
  state.speed = 0;
  await new Promise((resolve) => {
    launchStep = (dt) => {
      const a = accel * (1 - Math.pow(v / vmax, 2)) * (v < 8 ? 1.15 : 1);
      v = Math.min(vmax, v + a * dt);
      carRoot.position.z -= v * dt;
      while (gear < 6 && v > gearSpeeds[gear]) gear++;
      const lo = gearSpeeds[gear - 1], hi = gearSpeeds[gear];
      state.rpm = lerp(cfg.engine.idle * 2.2, cfg.engine.redline, clamp((v - lo) / (hi - lo), 0, 1));
      state.speed = v * 3.6; state.gear = String(gear);
      carRoot.rotation.x = -0.012 * clamp(a / 10, 0, 1);
      // chase cam
      const z = carRoot.position.z;
      camera.position.lerp(new THREE.Vector3(1.2, 1.75, z + 7.6 + v * 0.05), 1 - Math.pow(0.0005, dt));
      controls.target.set(0, 0.7, z - 6);
      camera.fov = lerp(42, 66, clamp(v / 50, 0, 1));
      camera.updateProjectionMatrix();
      $('#speedlines').style.opacity = clamp((v - 10) / 40, 0, 0.9);
      gearTop = Math.max(gearTop, gear);
      if (z < -95) { launchStep = null; resolve(); }
    };
  });
  $('#fade').classList.add('on');
  await wait(0.8);
  // reset
  carRoot.position.set(0, TABLE_TOP + state.lift, 0);
  carRoot.rotation.set(0, 0.55, 0); state.angle = 0.55;
  door.position.y = 0;
  camera.fov = 42; camera.updateProjectionMatrix();
  $('#speedlines').style.opacity = 0;
  state.speed = 0; state.gear = 'N'; state.rpm = cfg.engine.idle;
  const o = CAMS.orbit();
  camera.position.copy(o.p); controls.target.copy(o.t);
  controls.enabled = true;
  setLights(false);
  clipPlane.constant = TABLE_TOP;
  $('#fade').classList.remove('on');
  document.body.classList.remove('launching');
  state.cam = 'orbit';
  $$('#cams button').forEach((b) => b.classList.toggle('active', b.dataset.cam === 'orbit'));
  await materialise(state.current, true);
  state.launching = false;
  toggleSpin(true);
}
let launchStep = null;

/* ───────────────────────── Engine ───────────────────────── */
async function startEngine() {
  if (!state.current) return;
  await audio.start(state.current.cfg.engine);
  state.engineOn = true;
  state.rpm = state.current.cfg.engine.redline * 0.35;
}

/* ───────────────────────── Hotspots ───────────────────────── */
const hotspots = [
  { label: 'Paint shop', at: (s) => new THREE.Vector3(0, s.y * 0.92, -s.z * 0.05), go: () => { openTab('paint'); setCam('side'); } },
  { label: 'Wheels', at: (s) => new THREE.Vector3(s.x * 0.5, s.y * 0.3, s.z * 0.3), go: () => setCam('wheel') },
  { label: 'Engine · rev', at: (s) => new THREE.Vector3(0, s.y * 0.72, s.z * 0.36), go: () => { setCam('front'); revBurst(); } },
  { label: 'Exhaust', at: (s) => new THREE.Vector3(0, s.y * 0.35, -s.z * 0.5), go: () => { setCam('rear'); revBurst(); } }
].map((h) => {
  const el = document.createElement('button');
  el.className = 'hs'; el.innerHTML = `<i></i><span>${h.label}</span>`;
  el.addEventListener('click', h.go);
  $('#hotspots').appendChild(el);
  return { ...h, el, local: new THREE.Vector3() };
});
const tmpV = new THREE.Vector3(), camDir = new THREE.Vector3();
function updateHotspots() {
  camera.getWorldDirection(camDir);
  for (const h of hotspots) {
    tmpV.copy(h.local); carRoot.localToWorld(tmpV);
    const toP = tmpV.clone().sub(camera.position);
    const facing = toP.dot(camDir) > 0;
    // hide when the point is on the far side of the car
    const center = carRoot.position.clone(); center.y += 0.6;
    const away = tmpV.clone().sub(center).normalize().dot(camera.position.clone().sub(center).normalize());
    tmpV.project(camera);
    const vis = facing && away > -0.15 && !state.busy && !state.launching;
    h.el.classList.toggle('hidden', !vis);
    h.el.style.left = `${(tmpV.x * 0.5 + 0.5) * innerWidth}px`;
    h.el.style.top = `${(-tmpV.y * 0.5 + 0.5) * innerHeight}px`;
  }
}
async function revBurst() {
  if (!state.engineOn) await startEngine();
  state.revving = true;
  setTimeout(() => { state.revving = false; }, 650);
  setTimeout(() => { state.revving = true; setTimeout(() => (state.revving = false), 450); }, 1100);
}

/* ───────────────────────── UI wiring ───────────────────────── */
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 1600);
}
function openTab(name) {
  $$('.tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
  $$('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === name));
}
function syncPanel() {
  const e = state.current; if (!e) return;
  const cu = custom(e.cfg);
  $$('.sw').forEach((s) => s.classList.toggle('active', s.dataset.hex.toLowerCase() === cu.color.toLowerCase()));
  $('#customColor').value = cu.color;
  $$('#finishes button').forEach((b) => b.classList.toggle('active', b.dataset.f === cu.finish));
  $$('.tuneRow').forEach((r) => {
    const lv = cu.tune[r.dataset.k];
    r.querySelectorAll('button').forEach((b, i) => b.classList.toggle('active', i <= lv));
  });
}
function toggleSpin(on = !state.spin, silent = false) {
  state.spin = on;
  $('#btnRotate').classList.toggle('on', on);
  if (!silent) toast(on ? 'Turntable on' : 'Turntable off');
}
function toggleLift() {
  if (state.launching) return;
  state.liftTarget = state.liftTarget > 0 ? 0 : 1.5;
  $('#btnLift').classList.toggle('on', state.liftTarget > 0);
  toast(state.liftTarget > 0 ? 'Raising lift' : 'Lowering lift');
  if (state.liftTarget > 0 && !['orbit', 'cine'].includes(state.cam)) setCam('orbit');
}

function buildUI() {
  const list = $('#carList');
  CARS.forEach((c, i) => {
    const b = document.createElement('button');
    b.className = 'carCard';
    b.innerHTML = `<div class="n">0${i + 1}</div><div class="t">${c.make} ${c.name}</div><div class="s">${c.stats.hp} HP · ${c.stats.top} KM/H</div><b class="cls">S</b>`;
    b.addEventListener('click', () => selectCar(i));
    list.appendChild(b);
  });
  PAINTS.forEach((p) => {
    const s = document.createElement('button');
    s.className = 'sw'; s.title = p.name; s.dataset.hex = p.hex; s.style.background = p.hex;
    s.addEventListener('click', () => { setColor(p.hex); toast(p.name); });
    $('#swatches').appendChild(s);
  });
  $('#customColor').addEventListener('input', (e) => setColor(e.target.value));
  Object.entries(FINISHES).forEach(([k, f]) => {
    const b = document.createElement('button'); b.textContent = f.label; b.dataset.f = k;
    b.addEventListener('click', () => setFinish(k));
    $('#finishes').appendChild(b);
  });
  UNDERGLOW.forEach((c) => {
    const d = document.createElement('button');
    d.className = 'dot'; d.dataset.c = c; d.style.background = c; d.style.color = c;
    d.addEventListener('click', () => setGlow(true, c));
    $('#glowColors').appendChild(d);
  });
  $('#tglGlow').addEventListener('click', () => setGlow(!state.glowOn));
  $('#tglLights').addEventListener('click', () => setLights(!state.lights));
  Object.entries(MOODS).forEach(([k, m]) => {
    const b = document.createElement('button'); b.textContent = m.label; b.dataset.m = k;
    b.addEventListener('click', () => { setMood(k); toast(m.label); });
    $('#moods').appendChild(b);
  });
  $$('.tuneRow').forEach((r) => {
    const lv = r.querySelector('.levels');
    ['STOCK', 'STG 1', 'STG 2', 'STG 3'].forEach((l, i) => {
      const b = document.createElement('button'); b.textContent = l;
      b.addEventListener('click', () => {
        const e = state.current; if (!e) return;
        custom(e.cfg).tune[r.dataset.k] = i; save();
        syncPanel(); syncStats();
        if (i > 0) { toast(`${r.querySelector('span').textContent} · stage ${i}`); revBurst(); }
      });
      lv.appendChild(b);
    });
  });
  $$('.tabs button').forEach((b) => b.addEventListener('click', () => openTab(b.dataset.tab)));
  $$('#cams button').forEach((b) => b.addEventListener('click', () => setCam(b.dataset.cam)));
  $('#btnRotate').addEventListener('click', () => toggleSpin());
  $('#btnLift').addEventListener('click', toggleLift);
  $('#btnLaunch').addEventListener('click', launch);
  const rev = $('#btnRev');
  const revOn = async (e) => { e.preventDefault(); if (!state.engineOn) await startEngine(); state.revving = true; rev.classList.add('held'); };
  const revOff = () => { state.revving = false; rev.classList.remove('held'); };
  rev.addEventListener('pointerdown', revOn);
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => rev.addEventListener(ev, revOff));
  $('#btnSound').addEventListener('click', toggleMute);
  $('#btnPhoto').addEventListener('click', togglePhoto);
  $('#btnPhotoExit').addEventListener('click', togglePhoto);
  $('#btnSnap').addEventListener('click', snapshot);
  $('#btnFull').addEventListener('click', () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.()));
  $('#btnInfo').addEventListener('click', () => $('#info').showModal());
  $('#credits').innerHTML = CARS.map((c) => `<li><b>${c.credit.title}</b> by ${c.credit.author}: <a href="${c.credit.url}" target="_blank" rel="noopener">source</a> · ${c.credit.license}</li>`).join('');

  addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || $('#info').open) return;
    const k = e.key.toLowerCase();
    if (k === 'arrowright' || k === 'e') selectCar((state.index + 1) % CARS.length);
    else if (k === 'arrowleft' || k === 'q') selectCar((state.index + CARS.length - 1) % CARS.length);
    else if (k === ' ') { e.preventDefault(); if (!e.repeat) revOn(e); }
    else if (k === 'n') launch();
    else if (k === 'r') toggleSpin();
    else if (k === 'l') toggleLift();
    else if (k === 'h') setLights(!state.lights);
    else if (k === 'g') setGlow(!state.glowOn);
    else if (k === 'p') togglePhoto();
    else if (k === 'm') toggleMute();
    else if (k === 'f') $('#btnFull').click();
    else if (k === 'i') $('#info').showModal();
    else if (k === 's' && document.body.classList.contains('photo')) snapshot();
    else if (/^[1-7]$/.test(k)) setCam(Object.keys(CAMS)[+k - 1]);
  });
  addEventListener('keyup', (e) => { if (e.key === ' ') revOff(); });
}
function toggleMute() {
  audio.setMuted(!audio.muted);
  $('#btnSound').textContent = audio.muted ? '🔇' : '🔊';
  toast(audio.muted ? 'Sound off' : 'Sound on');
}
function togglePhoto() {
  if (state.launching) return;
  document.body.classList.toggle('photo');
}
function snapshot() {
  composer.render();
  const a = document.createElement('a');
  a.download = `apex-garage-${state.current.cfg.id}.png`;
  a.href = renderer.domElement.toDataURL('image/png');
  a.click();
  toast('Photo saved');
}

/* ───────────────────────── Tachometer ───────────────────────── */
const tach = $('#tach').getContext('2d');
function drawTach() {
  const c = tach, w = 220, cx = 110, cy = 110, r = 92;
  const red = state.current ? state.current.cfg.engine.redline : 8000;
  const maxR = Math.ceil(red / 1000) * 1000 + 1000;
  const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;
  c.clearRect(0, 0, w, w);
  c.lineCap = 'butt';
  c.lineWidth = 10; c.strokeStyle = 'rgba(255,255,255,.08)';
  c.beginPath(); c.arc(cx, cy, r, a0, a1); c.stroke();
  const redA = a0 + (red / maxR) * (a1 - a0);
  c.strokeStyle = 'rgba(255,40,60,.5)'; c.beginPath(); c.arc(cx, cy, r, redA, a1); c.stroke();
  const k = clamp(state.rpm / maxR, 0, 1);
  const acc = getComputedStyle(document.documentElement).getPropertyValue('--acc').trim() || '#00e5ff';
  c.strokeStyle = state.rpm > red * 0.92 ? '#ff2a3d' : acc;
  c.shadowColor = c.strokeStyle; c.shadowBlur = 14;
  c.beginPath(); c.arc(cx, cy, r, a0, a0 + k * (a1 - a0)); c.stroke();
  c.shadowBlur = 0;
  c.fillStyle = 'rgba(255,255,255,.55)'; c.font = '600 11px Rajdhani, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
  for (let i = 0; i <= maxR / 1000; i++) {
    const a = a0 + (i * 1000 / maxR) * (a1 - a0);
    c.fillText(i, cx + Math.cos(a) * (r - 18), cy + Math.sin(a) * (r - 18));
  }
  c.fillStyle = 'rgba(255,255,255,.4)'; c.fillText('x1000 RPM', cx, cy + 58);
  $('#tachSpeed').textContent = Math.round(state.speed);
  $('#tachGear').textContent = state.engineOn ? state.gear : 'OFF';
}

/* ───────────────────────── Loop ───────────────────────── */
const clock = new THREE.Timer();
let frame = 0;
function loop() {
  clock.update();
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.getElapsed();
  stepTweens(dt);

  // turntable
  if (!state.launching && state.spin && !state.busy) state.angle += dt * 0.22;
  if (!state.launching) carRoot.rotation.y = state.angle;
  table.rotation.y = state.launching ? table.rotation.y : state.angle;

  // lift
  state.lift += (state.liftTarget - state.lift) * (1 - Math.pow(0.12, dt));
  table.position.y = state.lift;
  if (!state.launching) carRoot.position.y = TABLE_TOP + state.lift;
  piston.visible = pit.visible = state.lift > 0.01;
  piston.scale.y = Math.max(state.lift, 0.001); piston.position.y = state.lift / 2;

  // engine
  const cfg = state.current?.cfg;
  if (cfg && !state.launching) {
    const target = state.engineOn ? (state.revving ? cfg.engine.redline : cfg.engine.idle) : 0;
    const rate = state.revving ? 3.2 : 1.6;
    state.rpm += (target - state.rpm) * (1 - Math.exp(-rate * dt));
  }
  if (launchStep) launchStep(dt);
  if (cfg) {
    const load = state.revving || state.launching ? 1 : 0;
    audio.update(state.rpm, load);
    // engine shake
    const shake = state.engineOn ? (state.rpm / cfg.engine.redline) * 0.004 : 0;
    if (state.current) state.current.group.position.y = Math.sin(t * 90) * shake * 0.3;
    if (!state.launching) carRoot.rotation.z = Math.sin(t * 61) * shake;
  }

  // lights fade
  glowMat.opacity += ((state.glowOn ? 1 : 0) - glowMat.opacity) * Math.min(1, dt * 6);
  glowLight.intensity = glowMat.opacity * 14;
  const hl = state.lights ? 1 : 0;
  headSprites.forEach((s) => (s.material.opacity += (hl - s.material.opacity) * Math.min(1, dt * 8)));
  headSpots.forEach((s) => (s.intensity = headSprites[0].material.opacity * 160));

  // cinematic camera
  if (state.cam === 'cine' && !state.launching && !state.camMoving) {
    const a = t * 0.12;
    camera.position.set(Math.cos(a) * 6.5, 0.7 + Math.sin(t * 0.3) * 0.5 + state.lift, Math.sin(a) * 6.5);
    controls.target.set(0, 0.7 + state.lift, 0);
  }

  // dust drift
  dust.rotation.y = t * 0.01;
  dust.position.y = Math.sin(t * 0.2) * 0.1;

  controls.update();
  composer.render();
  if (frame++ % 2 === 0) { drawTach(); }
  updateHotspots();
  requestAnimationFrame(loop);
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
  reflector.getRenderTarget().setSize(Math.floor(innerWidth * 0.5), Math.floor(innerHeight * 0.5));
});
controls.addEventListener('start', () => {
  camAnim = Symbol();
  state.camMoving = false;
  if (state.cam === 'cine') { state.cam = 'orbit'; $$('#cams button').forEach((b) => b.classList.toggle('active', b.dataset.cam === 'orbit')); }
});

/* ───────────────────────── Boot ───────────────────────── */
async function boot() {
  buildUI();
  setMood('neon');
  setGlow(false);
  const fill = $('#loadFill'), pct = $('#loadPct');
  const first = clamp(parseInt(params.get('car') || '1', 10) - 1, 0, CARS.length - 1);
  state.index = first;
  const show = (p) => { fill.style.width = `${p * 100}%`; pct.textContent = `${Math.round(p * 100)}%`; };
  $('#loadText').textContent = `Loading ${CARS[first].make} ${CARS[first].name}`;
  try {
    await loadCar(first, (p) => show(p * 0.95));
  } catch (err) {
    console.error(err);
    $('#loadText').textContent = 'Failed to load the 3D model. Check your connection and refresh.';
    return;
  }
  show(1);
  // compile shaders before revealing
  state.current = null;
  clipPlane.constant = 0;
  requestAnimationFrame(loop);
  await selectCar(first, true);
  $('#loadText').textContent = 'Garage ready';
  const enter = $('#enterBtn');
  enter.hidden = false;
  const go = () => { $('#loader').classList.add('done'); };
  enter.addEventListener('click', () => { go(); startEngine().then(() => toast('Engine started · hold Space to rev')); });
  if (params.has('auto')) go();
  // load the rest in the background
  for (let i = 0; i < CARS.length; i++) if (i !== first) await loadCar(i).catch(() => {});
}
boot();

// expose for debugging
window.__garage = { state, camera, controls, setCam, selectCar, setMood, setGlow, setLights, launch, toggleLift, setColor, setFinish };
