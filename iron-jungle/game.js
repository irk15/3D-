import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { loadSoldier, soldier, pose, startDeath, die, revive } from './characters.js?v=3';
import * as ENV from './environment.js';

const $ = id => document.getElementById(id);
let seed = 7;
const rnd = (a = 0, b = 1) => { seed = (seed * 16807) % 2147483647; return a + (seed / 2147483647) * (b - a); };
const clamp = THREE.MathUtils.clamp;
const END = 232, BOSSX = 220;

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x7a5560, 0.0165);
const wind = { value: 0 };
const manager = new THREE.LoadingManager();
manager.onProgress = (_, n, total) => { $('go').textContent = `Loading ${Math.round(n / total * 100)}%`; };
const texLoader = new THREE.TextureLoader(manager);
function tex(file, rx = 1, ry = 1, color = true) {
  const t = texLoader.load('assets/' + file); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.anisotropy = 8; if (color) t.colorSpace = THREE.SRGBColorSpace; return t;
}
const camera = new THREE.PerspectiveCamera(36, 1, 0.5, 600);

// sky
const sky = new THREE.Mesh(new THREE.SphereGeometry(400, 48, 24), ENV.skyMaterial(wind));
scene.add(sky);
const envReady = new HDRLoader(manager).loadAsync('assets/sunrise.hdr').then(hdr => {
  hdr.mapping = THREE.EquirectangularReflectionMapping;
  const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromEquirectangular(hdr).texture; scene.environmentIntensity = .55; hdr.dispose(); pm.dispose();
});

scene.add(new THREE.HemisphereLight(0x8fa6d8, 0x2a2014, .55));
const sun = new THREE.DirectionalLight(0xffa860, 3.9);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 20, bottom: -14, far: 90 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);
const rim = new THREE.DirectionalLight(0x5a8cff, 1.3); rim.position.set(-8, 6, -12); scene.add(rim);

const std = (color, roughness = .75, metalness = .05, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
const glow = (color, k = 3) => new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), fog: false });

function mesh(geo, mat, x = 0, y = 0, z = 0, parent = scene, shadow = true) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = shadow; m.receiveShadow = true; parent.add(m); return m;
}
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cap = (r, l) => new THREE.CapsuleGeometry(r, l, 4, 10);
const cyl = (a, b, h, s = 12) => new THREE.CylinderGeometry(a, b, h, s);
const ball = r => new THREE.SphereGeometry(r, 14, 10);

// ---------- level ----------
const solids = [];
const rockMap = tex('rock.jpg'), rockNormal = tex('rock-n.jpg', 1, 1, false);
const rockMat = std(0x77685f, .95, 0, { map: rockMap, normalMap: rockNormal, normalScale: new THREE.Vector2(1.6, 1.6) });
const grassMap = tex('grass.jpg');
function ground(x1, x2) {
  const w = x2 - x1, cx = (x1 + x2) / 2;
  mesh(box(w, 6, 7), rockMat, cx, -3.2, -.5);
  const top = grassMap.clone(); top.repeat.set(w / 5, 1.45);
  mesh(box(w + .15, .25, 7.2), std(0xa8a878, .92, 0, { map: top }), cx, -.125, -.5);
  ENV.cliff(scene, rockMat, rnd, x1, x2);
  for (let x = x1 + .5; x < x2 - .4; x += rnd(.9, 2.4)) { const r = mesh(new THREE.IcosahedronGeometry(rnd(.2, .5), 1), rockMat, x, rnd(-3.3, -.9), 3.2); r.rotation.set(rnd(0, 3), rnd(0, 3), 0); r.scale.y = rnd(.5, .8); }
  solids.push({ x1, x2, y: 0, ground: true });
}
const gaps = [[48, 51.2], [96, 99.4], [152, 155.6]];
ground(-20, 48); ground(51.2, 96); ground(99.4, 152); ground(155.6, END + 30);
const steel = std(0x777b7e, .42, .8, { normalMap: rockNormal, normalScale: new THREE.Vector2(.15, .15) }), rust = std(0xa05a30, .68, .55, { map: rockMap });
ENV.grassField(scene, wind, rnd, solids.map(s => [s.x1, s.x2]));
function platform(x, y, w) {
  mesh(box(w, .28, 2.4), steel, x, y - .14, 0);
  mesh(box(w, .07, .08), rust, x, y - .02, 1.22);
  for (const s of [-1, 1]) mesh(cyl(.09, .12, y, 8), rust, x + s * (w / 2 - .3), y / 2, -.9);
  solids.push({ x1: x - w / 2, x2: x + w / 2, y });
}
[[18, 2.6, 6], [34, 2.8, 5], [41, 5, 4], [62, 2.6, 7], [78, 2.8, 5], [85, 5.2, 5], [110, 2.7, 6], [120, 5, 6], [136, 2.7, 8], [165, 2.8, 5], [173, 5.1, 5], [190, 2.7, 6]].forEach(p => platform(...p));

const water = ENV.water(scene, tex('water-n.jpg', 1, 1, false), END + 80, END / 2);
const air = ENV.atmosphere(scene, rnd, END);

// foliage (instanced)
const leaf = ENV.frondGeometry(), dummy = new THREE.Object3D(), col = new THREE.Color();
const leafMaterial = ENV.frondMaterial(ENV.frondTexture(rnd), wind);
function fronds(list) {
  const chunks = new Map(); for (const l of list) { const k = Math.floor(l[0] / 24); if (!chunks.has(k)) chunks.set(k, []); chunks.get(k).push(l); }
  for (const part of chunks.values()) {
    const im = new THREE.InstancedMesh(leaf, leafMaterial, part.length);
    part.forEach((l, i) => { dummy.position.set(l[0], l[1], l[2]); dummy.rotation.set(l[4], l[5], l[6], 'YXZ'); dummy.scale.setScalar(l[3]); dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix); im.setColorAt(i, col.setHSL(rnd(.2, .32), rnd(.45, .7), rnd(.16, .34))); });
    im.receiveShadow = true; im.computeBoundingSphere(); scene.add(im);
  }
}
const bush = [], crown = [];
for (let x = -20; x < END + 30; x += .55) {
  if (gaps.some(g => x > g[0] - .6 && x < g[1] + .6)) continue;
  const z = rnd(-3.8, -2.2);
  for (let i = 0; i < 4; i++) bush.push([x, 0, z, rnd(.3, .75), rnd(.2, 1), rnd(0, 6.3), rnd(-.4, .4)]);
}
fronds(bush);
const bark = std(0x6a4a34, 1, 0, { map: rockMap, normalMap: rockNormal });
for (let x = -24; x < END + 40; x += rnd(1.8, 3.8)) {
  const z = rnd(-22, -6), h = rnd(5, 11);
  const tg = new THREE.CylinderGeometry(.13, .3, h + 3, 9, 14), tp = tg.attributes.position;
  for (let i = 0; i < tp.count; i++) { const ring = 1 + (Math.round((tp.getY(i) / (h + 3) + .5) * 14) % 2) * .13; tp.setX(i, tp.getX(i) * ring); tp.setZ(i, tp.getZ(i) * ring); }
  const t = mesh(tg, bark, x, h / 2 - 1.5, z, scene, false); t.rotation.z = rnd(-.09, .09);
  const tx = x - Math.sin(t.rotation.z) * h / 2;
  for (let i = 0; i < 11; i++) crown.push([tx, h, z, rnd(.9, 1.7), rnd(.9, 1.6), i * .58 + rnd(0, .4), 0]);
  for (let i = 0; i < 5; i++) crown.push([x + rnd(-1.5, 1.5), -.4, z + rnd(-1, 1), rnd(.8, 1.5), rnd(.2, .9), rnd(0, 6.3), 0]);
}
fronds(crown);
mesh(box(END + 100, 1, 30), std(0x101a0c, 1), END / 2, -4.2, -19, scene, false);
for (let layer = 0; layer < 3; layer++) {
  const s = new THREE.Shape(); s.moveTo(-120, -20);
  let h = 9;
  for (let x = -120; x <= END + 140; x += 1.6) { h = clamp(h + rnd(-1.1, 1.1), 4, 14); s.lineTo(x, h + layer * 7 + Math.sin(x * .09 + layer * 2) * 3 + rnd(-.25, .25)); }
  s.lineTo(END + 140, -20);
  mesh(new THREE.ShapeGeometry(s), new THREE.MeshBasicMaterial({ color: [0x14201c, 0x30242f, 0x5a3640][layer] }), 0, 0, -34 - layer * 28, scene, false);
}
// props
const crateMat = std(0x78845a, .7, .25, { map: rockMap, normalMap: rockNormal });
for (let x = 7; x < 205; x += rnd(11, 22)) {
  if (gaps.some(g => x > g[0] - 2 && x < g[1] + 2)) continue;
  for (let i = 0; i < 9; i++) { const bag = mesh(cap(.17, .45), std(0x8a7552, 1, 0, { normalMap: rockNormal }), x + (i % 5) * .66 + (i > 4 ? .33 : 0), i > 4 ? .43 : .15, -2.75); bag.rotation.z = Math.PI / 2; bag.scale.set(1, 1, 1.25); }
}
for (let x = 9; x < 205; x += rnd(9, 17)) {
  if (gaps.some(g => x > g[0] - 2 && x < g[1] + 2)) continue;
  if (rnd() > .5) { const c = mesh(box(1.1, .9, 1), crateMat, x, .45, -1.9); c.rotation.y = rnd(-.4, .4); }
  else for (let i = 0; i < 2; i++) mesh(cyl(.42, .42, 1.15, 16), rust, x + i * .9, .57, -1.9);
}
// torches
const flames = [];
for (let x = 4; x < 215; x += 21) {
  mesh(cyl(.06, .08, 2, 6), bark, x, 1, -2.4);
  const f = mesh(ball(.17), glow(0xff7a22, 4), x, 2.15, -2.4, scene, false); flames.push(f);
}
// fireflies / embers
const dustGeo = new THREE.BufferGeometry();
const dp = new Float32Array(600 * 3);
for (let i = 0; i < 600; i++) dp.set([rnd(-20, END), rnd(0, 10), rnd(-9, 5)], i * 3);
dustGeo.setAttribute('position', new THREE.BufferAttribute(dp, 3));
const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: new THREE.Color(0xffb46a).multiplyScalar(2), size: .06, transparent: true, opacity: .7 }));
scene.add(dust);

// ---------- fx ----------
const fx = [], sparkGeo = new THREE.BoxGeometry(.16, .035, .035), debrisGeo = new THREE.IcosahedronGeometry(.09, 0), casingGeo = cyl(.025, .025, .11, 6);
const sparkMats = { fire: glow(0xff8a20, 4), hit: glow(0xffe2a0, 3), blood: glow(0x8a0808, 1) };
const brass = std(0xd8a540, .3, .9), softTex = ENV.softTexture(), smokeTex = ENV.softTexture('rgba(255,255,255,1)', 128, 16);
function puff(x, y, z, o) {
  const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: o.map || smokeTex, color: new THREE.Color(o.color).multiplyScalar(o.k || 1), transparent: true, depthWrite: false, blending: o.add ? THREE.AdditiveBlending : THREE.NormalBlending, rotation: rnd(0, 6.3) }));
  m.position.set(x, y, z); scene.add(m);
  fx.push({ m, sprite: true, vx: o.vx || 0, vy: o.vy || 0, vz: 0, life: o.life, max: o.life, s: o.size, grow: o.grow || 0, a: o.alpha ?? 1, g: o.g || 0 });
}
function burst(x, y, n, kind, power = 6, size = 1) {
  for (let i = 0; i < n; i++) {
    const m = mesh(sparkGeo, sparkMats[kind], x, y, rnd(-.3, .5), scene, false);
    const a = rnd(0, 6.3), s = rnd(.2, 1) * power, life = rnd(.15, .55);
    fx.push({ m, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: rnd(-2, 2), life, max: life, s: size * rnd(.5, 1.4), g: 16, streak: true });
  }
}
function casing(x, y, face) {
  const m = mesh(casingGeo, brass, x, y, .25, scene, false);
  fx.push({ m, vx: -face * rnd(1, 2.5), vy: rnd(2.5, 4.5), vz: rnd(.5, 1.5), life: .9, max: .9, s: 1, g: 18, bounce: true });
}
const scorchMat = new THREE.MeshBasicMaterial({ map: softTex, color: 0x000000, transparent: true, opacity: .7, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
const scorches = [];
const boomLight = new THREE.PointLight(0xff8830, 0, 18, 1.8); scene.add(boomLight);
const muzzle = new THREE.PointLight(0xffc070, 0, 9, 2); scene.add(muzzle);
let shake = 0;
function explode(x, y, big = 1) {
  puff(x, y, .6, { map: softTex, color: 0xffe0a0, k: 5, add: true, life: .16, size: 2.5 * big, grow: 14 * big });
  for (let i = 0; i < 12 * big; i++) puff(x + rnd(-.5, .5) * big, y + rnd(-.4, .6) * big, rnd(-.2, .8), { color: i % 2 ? 0xff7a18 : 0xffb030, k: 2.6, add: true, life: rnd(.25, .6), size: rnd(.7, 1.5) * big, grow: 2.6, vx: rnd(-2.5, 2.5) * big, vy: rnd(-1, 3) * big });
  for (let i = 0; i < 9 * big; i++) puff(x + rnd(-.6, .6) * big, y + rnd(-.2, .8) * big, rnd(-.6, .3), { color: 0x2a2220, alpha: .6, life: rnd(.9, 1.9), size: rnd(.9, 1.6) * big, grow: 1.4, vx: rnd(-1.2, 1.2), vy: rnd(.6, 2.2) });
  for (let i = 0; i < 12 * big; i++) { const m = mesh(debrisGeo, rockMat, x, y, rnd(-.3, .6), scene, false); fx.push({ m, vx: rnd(-8, 8), vy: rnd(2, 11), vz: rnd(-2, 3), life: rnd(.7, 1.3), max: 1.3, s: rnd(.5, 1.5), g: 24, bounce: true }); }
  burst(x, y, 22 * big, 'fire', 14 * big, 1.5 * big);
  if (y < 2 && !gaps.some(g => x > g[0] && x < g[1])) {
    const d = mesh(new THREE.PlaneGeometry(3 * big, 2.4 * big), scorchMat, x, .012 + scorches.length % 8 * .001, 0, scene, false); d.rotation.x = -Math.PI / 2; scorches.push(d); if (scorches.length > 14) scene.remove(scorches.shift());
  }
  boomLight.position.set(x, y, 1.5); boomLight.intensity = 130 * big; shake = Math.max(shake, .3 * big); sfx('boom');
}
const corpses = [];
function dust2(x, y) { for (let i = 0; i < 9; i++) puff(x + rnd(-.9, .9), y + .12, rnd(-.2, .8), { color: 0x8a755c, alpha: .45, life: rnd(.5, 1.1), size: rnd(.35, .7), grow: 1.1, vx: rnd(-1.4, 1.4), vy: rnd(.1, .6) }); }
function wound(x, y, dir) { burst(x, y, 7, 'blood', 4); for (let i = 0; i < 3; i++) puff(x + dir * i * .15, y, .4, { color: 0x6a0606, alpha: .55, life: .35, size: .25, grow: 1.3, vx: dir * rnd(.5, 1.5) }); }
// dir is the direction the hit travels
function fall(e, dir) {
  const front = dir !== e.face; startDeath(e.o, front); wound(e.x, e.y + 1.35, dir);
  corpses.push({ o: e.o, t: 0, vx: dir * 2.6, vy: e.on ? 1.6 : 2.5, y: e.y, floor: e.on ? e.y : 0 });
}
function updateCorpses(dt) {
  for (let i = corpses.length - 1; i >= 0; i--) {
    const c = corpses[i], o = c.o; c.t += dt; c.vy -= 24 * dt; c.y += c.vy * dt;
    const over = gaps.some(g => o.position.x > g[0] && o.position.x < g[1]);
    let grounded = false;
    if (c.y <= c.floor && !over) { c.y = c.floor; c.vy = 0; grounded = true; c.vx *= Math.exp(-dt * 4.5); }
    o.position.x += c.vx * dt; o.position.y = c.y - Math.max(0, c.t - 3.2) * .45;
    if (die(o, dt, grounded)) dust2(o.position.x - Math.sign(c.vx) * .2, c.floor);
    if (c.t > 4.4 || c.y < -8) { scene.remove(o); corpses.splice(i, 1); }
  }
}

// ---------- audio ----------
let ac, muted = false, noiseBuf;
function sfx(k) {
  if (!ac || muted) return;
  const t = ac.currentTime, g = ac.createGain(); g.connect(ac.destination);
  if (k === 'shot' || k === 'boom' || k === 'eshot') {
    const s = ac.createBufferSource(); s.buffer = noiseBuf;
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; const d = k === 'boom' ? .55 : .09;
    f.frequency.setValueAtTime(k === 'boom' ? 900 : k === 'shot' ? 3200 : 1400, t); f.frequency.exponentialRampToValueAtTime(100, t + d);
    g.gain.setValueAtTime(k === 'boom' ? .45 : k === 'shot' ? .16 : .08, t); g.gain.exponentialRampToValueAtTime(.001, t + d);
    s.connect(f).connect(g); s.start(t); s.stop(t + d);
  } else {
    const o = ac.createOscillator(); o.type = 'square';
    const [a, b, d] = { jump: [220, 440, .12], power: [440, 1320, .3], hurt: [300, 60, .4] }[k];
    o.frequency.setValueAtTime(a, t); o.frequency.exponentialRampToValueAtTime(b, t + d);
    g.gain.setValueAtTime(.08, t); g.gain.exponentialRampToValueAtTime(.001, t + d); o.connect(g); o.start(t); o.stop(t + d);
  }
}
function initAudio() {
  if (ac) { ac.resume(); return; }
  try {
    ac = new AudioContext(); noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  } catch { ac = null; }
}

// ---------- entities ----------
let hero, ready = false;
function makeHero() {
  hero = soldier({ tint: 0x86a8d4, visor: 0x2fb8ff, band: 0xff2214 }); scene.add(hero);
  const l = new THREE.PointLight(0xbfd8ff, 8, 5, 2); l.position.set(0, 1.8, 1.8); hero.add(l);
}
let P, enemies = [], bullets = [], pickups = [], score = 0, lives, state = 'title', camX = 0, boss, checkpoint = 2, time = 0;
const bGeo = cap(.035, .5); bGeo.rotateZ(Math.PI / 2);
const bMat = glow(0xffc060, 2.2), bSpread = glow(0xff6030, 2.6), eMat = glow(0xff2858, 4), eGeo = ball(.15);
const halo = c => new THREE.SpriteMaterial({ map: softTex, color: c, transparent: true, opacity: .55, blending: THREE.AdditiveBlending, depthWrite: false });
const eHalo = halo(0xff2050), bHalo = halo(0xff9a30);
function shoot(x, y, a, speed, enemy, mat) {
  const m = mesh(enemy ? eGeo : bGeo, mat || (enemy ? eMat : bMat), x, y, 0, scene, false); m.rotation.z = a;
  const halo = new THREE.Sprite(enemy ? eHalo : bHalo); halo.scale.set(enemy ? .9 : .55, enemy ? .9 : .55, 1); m.add(halo);
  bullets.push({ m, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, enemy, life: enemy ? 3.2 : 1.1 });
}
function addEnemy(type, x, y = 0) {
  let o, e = { type, x, y, vx: 0, vy: 0, on: true, cd: rnd(.6, 1.8), flash: 0 };
  if (type === 'run' || type === 'gun') {
    o = soldier(type === 'gun' ? { tint: 0xe08a70, visor: 0xff2a10 } : { tint: 0xc8b078, visor: 0xff6a10 }); e.hp = type === 'gun' ? 3 : 1; e.face = -1; o.rotation.y = Math.PI; e.h = 1.8; e.w = .45;
  } else if (type === 'turret') {
    o = new THREE.Group(); mesh(cyl(.7, .95, .7), steel, 0, .35, 0, o); mesh(ball(.55), rust, 0, .8, 0, o);
    const piv = new THREE.Group(); piv.position.y = .85; o.add(piv); mesh(box(1.2, .22, .22), steel, .65, 0, 0, piv); mesh(ball(.13), glow(0xff3020), 0, .15, .52, piv, false);
    o.userData.piv = piv; e.hp = 8; e.h = 1.35; e.w = .8;
  } else if (type === 'drone') {
    o = new THREE.Group(); mesh(ball(.42), steel, 0, 0, 0, o).scale.y = .65; mesh(ball(.14), glow(0xff3020, 4), -.3, -.03, .3, o, false);
    o.userData.rot = [-.75, .75].map(s => mesh(box(.8, .04, .12), rust, s, .24, 0, o)); e.hp = 2; e.h = .6; e.w = .6; e.base = y;
  }
  o.position.set(x, y, 0); scene.add(o); e.o = o; enemies.push(e); return e;
}
function makeBoss() {
  const o = new THREE.Group(), armor = std(0x3b4148, .4, .85);
  mesh(box(5, 8, 4), armor, 1.4, 4, -.4, o); mesh(box(5.6, .6, 4.6), rust, 1.4, 8.2, -.4, o);
  for (let y = 1; y < 8; y += 1.6) mesh(box(.2, .2, 4.2), steel, -1.15, y, -.4, o);
  const core = mesh(ball(.75), glow(0xff3a18, 2.5), -1.15, 2.2, 0, o, false);
  const guns = [4.6, 6.6].map(y => { const p = new THREE.Group(); p.position.set(-1.3, y, .5); o.add(p); mesh(ball(.5), steel, 0, 0, 0, p); mesh(box(1.5, .3, .3), armor, -.8, 0, 0, p); return p; });
  o.position.set(BOSSX + 6, 0, 0); scene.add(o);
  boss = { type: 'boss', o, core, guns, x: BOSSX + 4.85, y: 1.2, w: .9, h: 2.1, hp: 90, max: 90, cd: 2, flash: 0, n: 0 };
  enemies.push(boss);
}
function addPickup(x, y) {
  const o = new THREE.Group(); mesh(new THREE.OctahedronGeometry(.38), glow(0x38e0ff, 2.4), 0, 0, 0, o, false);
  const r = mesh(new THREE.TorusGeometry(.6, .05, 8, 32), glow(0x38e0ff, 1.5), 0, 0, 0, o, false); o.position.set(x, y, 0); scene.add(o); pickups.push({ o, r, x, y });
}
let spawns = [];
function reset() {
  [...enemies, ...pickups, ...corpses].forEach(e => scene.remove(e.o)); corpses.length = 0; scorches.splice(0).forEach(d => scene.remove(d)); bullets.forEach(b => scene.remove(b.m));
  enemies = []; bullets = []; pickups = []; boss = null; score = 0; lives = 5; checkpoint = 2; camX = 2; time = 0;
  P = { x: 2, y: 0, vx: 0, vy: 0, on: true, face: 1, aim: 0, cd: 0, inv: 2, spread: false, dead: 0, drop: 0, slow: 0 };
  revive(hero); hero.rotation.y = 0; hero.visible = true;
  spawns = [[16, 'run'], [18, 'gun', 2.6], [24, 'run'], [30, 'turret'], [34, 'gun', 2.8], [40, 'drone', 4.5], [43, 'run'], [56, 'run'], [58, 'run'], [63, 'gun', 2.6], [70, 'turret'], [75, 'drone', 5], [85, 'gun', 5.2], [90, 'run'], [104, 'turret'], [110, 'gun', 2.7], [114, 'run'], [116, 'drone', 4], [120, 'turret', 5], [128, 'run'], [132, 'run'], [136, 'gun', 2.7], [145, 'drone', 5], [148, 'drone', 3.6], [162, 'turret'], [165, 'gun', 2.8], [173, 'gun', 5.1], [180, 'run'], [182, 'run'], [185, 'drone', 4.5], [190, 'turret', 2.7], [196, 'gun'], [200, 'run'], [203, 'turret']];
  addPickup(41, 6); addPickup(120, 7); addPickup(173, 6.2);
}

// ---------- input ----------
const keys = {}, touch = {};
const map = { ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r', ArrowUp: 'u', KeyW: 'u', ArrowDown: 'd', KeyS: 'd', Space: 'j', KeyK: 'j', KeyJ: 'f', KeyX: 'f', KeyZ: 'j' };
addEventListener('keydown', e => {
  if (map[e.code]) { keys[map[e.code]] = true; e.preventDefault(); }
  if (e.code === 'Enter' && state !== 'play') start();
  if (e.code === 'KeyP' && (state === 'play' || state === 'pause')) togglePause();
  if (e.code === 'KeyM') toggleMute();
});
addEventListener('keyup', e => { if (map[e.code]) keys[map[e.code]] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; if (state === 'play') togglePause(); });
const pad = $('pad'), pointers = new Map();
function dirFrom(ev) {
  const r = pad.getBoundingClientRect(), dx = (ev.clientX - r.left) / r.width - .5, dy = (ev.clientY - r.top) / r.height - .5;
  const dead = .1; touch.l = dx < -dead; touch.r = dx > dead; touch.u = dy < -.17; touch.d = dy > .17;
  $('knob').style.transform = `translate(${clamp(dx, -.35, .35) * r.width}px,${clamp(dy, -.35, .35) * r.height}px)`;
}
pad.addEventListener('pointerdown', e => { pad.setPointerCapture(e.pointerId); pointers.set(e.pointerId, 1); dirFrom(e); });
pad.addEventListener('pointermove', e => { if (pointers.has(e.pointerId)) dirFrom(e); });
for (const n of ['pointerup', 'pointercancel']) pad.addEventListener(n, e => { pointers.delete(e.pointerId); touch.l = touch.r = touch.u = touch.d = false; $('knob').style.transform = ''; });
for (const [id, k] of [['bj', 'j'], ['bf', 'f']]) {
  const b = $(id); b.addEventListener('pointerdown', e => { b.setPointerCapture(e.pointerId); touch[k] = true; });
  for (const n of ['pointerup', 'pointercancel']) b.addEventListener(n, () => touch[k] = false);
}
addEventListener('contextmenu', e => e.preventDefault());
const down = k => keys[k] || touch[k];
function togglePause() { state = state === 'play' ? 'pause' : 'play'; if (state === 'pause') show('PAUSED', 'Take a breath, soldier.', 'Resume'); else $('menu').hidden = true; }
function toggleMute() { muted = !muted; $('mute').textContent = muted ? 'Sound off' : 'Sound on'; }
$('mute').onclick = toggleMute; $('pause').onclick = () => { if (state === 'play' || state === 'pause') togglePause(); };
function show(t, s, b) { $('title').textContent = t; $('sub').textContent = s; $('go').textContent = b; $('menu').hidden = false; }
function start() {
  if (!ready) return;
  initAudio();
  if (state === 'pause') { togglePause(); return; }
  reset(); state = 'play'; $('menu').hidden = true;
}
$('go').onclick = start;

// ---------- update ----------
function physics(e, dt) {
  const oy = e.y; e.vy -= 34 * dt; e.x += e.vx * dt; e.y += e.vy * dt; e.on = false;
  if (e.vy <= 0) for (const s of solids) {
    if (e.x > s.x1 - .2 && e.x < s.x2 + .2 && oy >= s.y - .02 && e.y <= s.y && !(e.drop > 0 && !s.ground)) { e.y = s.y; e.vy = 0; e.on = true; e.ground = s.ground; }
  }
}
function hurt(dir = -P.face) {
  if (P.inv > 0 || P.dead > 0) return;
  P.dead = 3; P.slow = .45; scene.userData.hurt = .8; lives--; P.spread = false; hero.visible = true; hero.userData.flash.visible = false;
  P.vx = dir * 3; P.vy = Math.max(P.vy * .3, 0) + (P.on ? 2 : 3); P.prone = false;
  startDeath(hero, dir !== P.face); if (P.y > -1) wound(P.x, P.y + 1.35, dir); shake = Math.max(shake, .22); sfx('hurt');
}
function respawn() {
  if (lives <= 0) { state = 'over'; show('MISSION FAILED', `Score ${score}`, 'Try again'); return; }
  let x = Math.max(checkpoint, camX - Math.min(4, viewHalf - 1.5));
  for (const g of gaps) if (x > g[0] - 4 && x < g[1] + 1.5) x = g[0] - 4;
  camX = Math.min(camX, x + viewHalf - 1.5);
  revive(hero);
  Object.assign(P, { x, y: 2.5, vx: 0, vy: 0, inv: 2.5, dead: 0 }); hero.visible = true;
  bullets.filter(b => b.enemy).forEach(b => b.life = 0);
}
function updatePlayer(dt) {
  if (P.dead > 0) {
    P.dead -= dt; P.drop = 0; physics(P, dt); if (P.on) P.vx *= Math.exp(-dt * 4.5);
    hero.position.set(P.x, P.y, 0); if (die(hero, dt, P.on)) { dust2(P.x, P.y); shake = Math.max(shake, .12); }
    if (P.dead <= 0) respawn(); return;
  }
  const h = (down('r') ? 1 : 0) - (down('l') ? 1 : 0), u = down('u'), d = down('d');
  if (h) P.face = h;
  P.prone = d && !h && P.on;
  P.vx = P.prone ? 0 : h * 7.2;
  P.aim = u ? (h ? .75 : 1.45) : d && h ? -.7 : d && !P.on ? -1.45 : 0;
  if (down('j') && !P.jHeld && P.on) { if (d && !P.ground) { P.drop = .25; } else { P.vy = 14.2; sfx('jump'); } }
  P.jHeld = down('j'); P.drop -= dt;
  physics(P, dt);
  const minX = camX - viewHalf + 1;
  P.x = clamp(P.x, Math.max(0, minX), boss ? BOSSX + 2.6 : END);
  if (P.y < -3) { P.inv = 0; hurt(); P.dead = 1.1; }
  if (P.on && P.ground && !gaps.some(g => P.x > g[0] - 2 && P.x < g[1] + 2)) checkpoint = Math.max(checkpoint, P.x - 3);
  P.cd -= dt; P.inv -= dt;
  hero.userData.flash.visible = false;
  if (down('f') && P.cd <= 0) {
    P.cd = P.spread ? .17 : .12;
    const a = P.face > 0 ? P.aim : Math.PI - P.aim;
    const sx = P.x + Math.cos(a) * 1.1, sy = P.y + (P.prone ? .55 : 1.55) + Math.sin(a) * 1.1;
    for (const off of P.spread ? [-.28, -.14, 0, .14, .28] : [0]) shoot(sx, sy, a + off, 26, false, P.spread ? bSpread : bMat);
    muzzle.position.set(sx, sy, .8); muzzle.intensity = 24; P.flashT = .045; sfx('shot');
    puff(sx, sy, .4, { map: softTex, color: 0xffa040, k: 2.5, add: true, life: .06, size: .9, alpha: .8 });
    casing(P.x + P.face * .3, sy - .05, P.face);
  }
  P.flashT -= dt; hero.userData.flash.visible = P.flashT > 0; hero.userData.flash.rotation.x = time * 90;
  hero.position.set(P.x, P.y, 0); pose(hero, P, dt);
  hero.visible = P.inv <= 0 || Math.floor(P.inv * 14) % 2 === 0;
  for (const p of pickups) if (!p.got && Math.abs(P.x - p.x) < .9 && Math.abs(P.y + 1 - p.y) < 1.3) { p.got = true; scene.remove(p.o); P.spread = true; score += 500; sfx('power'); toast('SPREAD GUN'); }
}
let toastT = 0;
function toast(t) { $('toast').textContent = t; toastT = 1.8; }
function updateEnemies(dt) {
  while (spawns.length && spawns[0][0] < camX + viewHalf + 3) { const [x, t, y] = spawns.shift(); addEnemy(t, t === 'run' ? Math.max(x, camX + viewHalf + 1) : x, y || 0); }
  if (!boss && P.x > BOSSX - 14) { makeBoss(); toast('WARNING: IRON BASTION'); }
  for (const e of enemies) {
    const dx = P.x - e.x, ty = P.y + (P.prone ? .35 : 1.1), alive = P.dead <= 0;
    const seen = Math.abs(e.x - camX) < viewHalf + 1;
    e.cd -= dt;
    if (e.type === 'run') {
      if (!e.dir) e.dir = dx < 0 ? -1 : 1;
      e.face = e.dir; e.vx = e.dir * 4.6;
      if (e.on && e.ground && gaps.some(g => e.dir < 0 ? e.x - g[1] < .8 && e.x - g[1] > 0 : g[0] - e.x < .8 && g[0] - e.x > 0)) e.vy = 13;
      physics(e, dt);
    } else if (e.type === 'gun') {
      e.face = dx < 0 ? -1 : 1; const a = Math.atan2(ty - (e.y + 1.5), Math.abs(dx));
      e.aim = clamp(a, -.8, 1.1); physics(e, dt);
      if (e.cd <= 0 && seen && alive) { e.cd = rnd(1.4, 2.3); const sa = e.face > 0 ? e.aim : Math.PI - e.aim; shoot(e.x + Math.cos(sa) * 1.1, e.y + 1.5 + Math.sin(sa), sa, 9.5, true); sfx('eshot'); }
    } else if (e.type === 'turret') {
      const a = Math.atan2(ty - (e.y + .95), dx); e.o.userData.piv.rotation.z = a;
      if (e.cd <= 0 && seen && alive) { e.cd = 1.7; shoot(e.x + Math.cos(a) * 1.3, e.y + .95 + Math.sin(a) * 1.3, a, 9, true); sfx('eshot'); }
    } else if (e.type === 'drone') {
      e.x += clamp(dx, -1, 1) * 2.2 * dt; e.y = e.base + Math.sin(time * 3 + e.base) * .6; e.o.userData.rot.forEach(r => r.rotation.y += dt * 40); e.o.rotation.z = -clamp(dx * .04, -.3, .3);
      if (e.cd <= 0 && seen && alive) { e.cd = 2.1; shoot(e.x, e.y - .3, Math.atan2(ty - e.y, dx), 8, true); sfx('eshot'); }
    } else if (e.type === 'boss') {
      e.core.scale.setScalar(1 + Math.sin(time * 6) * .08);
      for (const g of e.guns) g.rotation.z = Math.atan2(ty - g.position.y, P.x - (e.o.position.x + g.position.x)) - Math.PI;
      if (e.cd <= 0 && alive) {
        e.n++; const rage = e.hp < e.max / 2;
        const g = e.guns[e.n % 2], gx = e.o.position.x + g.position.x - 1.2, gy = g.position.y, a = Math.atan2(ty - gy, P.x - gx);
        if (e.n % 4 === 0) { for (let i = 0; i < 4; i++) shoot(e.x - 1.3, .6, Math.PI - i * .22, 8, true); }
        else for (const off of rage ? [-.2, 0, .2] : [0]) shoot(gx, gy, a + off, 9.5, true);
        e.cd = rage ? .75 : 1.05; sfx('eshot');
      }
    }
    e.o.position.set(e.type === 'boss' ? e.o.position.x : e.x, e.type === 'boss' ? 0 : e.y, 0);
    if (e.type === 'run' || e.type === 'gun') pose(e.o, e, dt);
    const cy = e.type === 'drone' ? e.y : e.y + e.h / 2;
    if (alive && Math.abs(dx) < e.w + .25 && Math.abs(P.y + (P.prone ? .3 : .9) - cy) < e.h / 2 + (P.prone ? .2 : .6)) hurt(dx > 0 ? 1 : -1);
    if (e.y < -5 || (e.type !== 'boss' && e.x < camX - viewHalf - 8)) e.gone = true;
  }
}
function updateBullets(dt) {
  for (const b of bullets) {
    b.life -= dt; const p = b.m.position; p.x += b.vx * dt; p.y += b.vy * dt;
    if (p.y < .02 && !gaps.some(g => p.x > g[0] && p.x < g[1])) { b.life = 0; burst(p.x, .1, 3, 'hit', 3); }
    if (b.enemy) {
      if (b.life > 0 && P.dead <= 0 && Math.abs(p.x - P.x) < (P.prone ? .8 : .36) && p.y > P.y + .05 && p.y < P.y + (P.prone ? .6 : 1.85)) { b.life = 0; hurt(Math.sign(b.vx) || -P.face); }
    } else if (b.life > 0) for (const e of enemies) {
      if (e.gone || Math.abs(e.x - camX) > viewHalf + 2) continue;
      const low = e.type === 'drone' ? e.y - .5 : e.y - .1;
      if (Math.abs(p.x - e.x) < e.w && p.y > low && p.y < low + e.h + .2) {
        b.life = 0; e.hp--; burst(p.x, p.y, 5, e.type === 'run' || e.type === 'gun' ? 'blood' : 'hit', 5);
        if (e.type === 'boss') { e.core.material.color.setRGB(5, 4, 3); e.flash = .05; }
        if (e.hp <= 0) {
          e.gone = true; score += { run: 100, gun: 200, drone: 250, turret: 400, boss: 5000 }[e.type];
          if (e.type === 'boss') { for (let i = 0; i < 6; i++) explode(e.x + rnd(-1, 3), rnd(1, 7), 1.5); bullets.forEach(q => q.life = 0); state = 'won'; setTimeout(() => state === 'won' && show('MISSION COMPLETE', `Score ${score + lives * 1000}`, 'Play again'), 1800); }
          else if (e.type === 'run' || e.type === 'gun') { e.kept = true; fall(e, Math.sign(b.vx) || -e.face); sfx('hurt'); }
          else explode(e.x, e.type === 'drone' ? e.y : e.y + 1, e.type === 'turret' ? 1 : .6);
        }
        break;
      }
    }
  }
  bullets = bullets.filter(b => { if (b.life > 0) return true; scene.remove(b.m); return false; });
  enemies = enemies.filter(e => { if (!e.gone) return true; if (!e.kept) scene.remove(e.o); return false; });
}

// ---------- loop ----------
const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
const composer = new EffectComposer(renderer, target);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), .5, .5, .94); composer.addPass(bloom);
composer.addPass(new OutputPass());
const grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, t: wind, hit: { value: 0 } },
  vertexShader: 'varying vec2 v;void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader: `uniform sampler2D tDiffuse;uniform float t,hit;varying vec2 v;void main(){vec2 d=v-.5;float r=dot(d,d);
  vec2 o=d*r*.006;vec3 c=vec3(texture2D(tDiffuse,v-o).r,texture2D(tDiffuse,v).g,texture2D(tDiffuse,v+o).b);
  float l=dot(c,vec3(.299,.587,.114));c=mix(vec3(l),c,1.12);c=mix(c,c*c*(3.-2.*c),.28);
  c+=mix(vec3(-.012,.004,.03),vec3(.025,.008,-.02),smoothstep(.15,.8,l));
  c*=1.-smoothstep(.18,.75,r)*.65;c=mix(c,vec3(.55,0.,0.),hit*smoothstep(.05,.5,r));
  c+=(fract(sin(dot(v*vec2(913.,517.)+fract(t),vec2(12.9898,78.233)))*43758.5453)-.5)*.028;gl_FragColor=vec4(c,1.);}`
});
composer.addPass(grade);
let quality = 2, slow = 0, frames = 0;
function setQuality(q) {
  quality = q; const pr = Math.min(devicePixelRatio, [1, 1.3, 1.7][q]);
  renderer.setPixelRatio(pr); composer.setPixelRatio(pr); target.samples = q === 2 ? 4 : 0; composer.renderTarget1.samples = composer.renderTarget2.samples = target.samples; composer.renderTarget1.dispose(); composer.renderTarget2.dispose();
  if (q === 0) { sun.shadow.mapSize.set(1024, 1024); sun.shadow.map?.dispose(); sun.shadow.map = null; air.mist.forEach(m => m.visible = false); }
  resize();
}
function watchSpeed(raw) {
  if (state !== 'play' || quality === 0 || document.hidden) return;
  frames++; slow += raw;
  if (frames >= 90) { if (slow / frames > 1 / 40) setQuality(quality - 1); frames = 0; slow = 0; }
}
let viewHalf = 12, dist = 20, portrait = false;
function resize() {
  const w = innerWidth, h = innerHeight; if (!w || !h) return;
  portrait = h > w; renderer.setSize(w, h); composer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
  const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  dist = Math.max(19, (portrait ? 7.5 : 11) / (t * camera.aspect));
  viewHalf = dist * t * camera.aspect;
}
addEventListener('resize', resize); setQuality(matchMedia('(pointer:coarse)').matches ? 1 : 2);
const clock = new THREE.Timer();
function step(dt) {
  if (state === 'pause') return;
  if (P && P.slow > 0) { P.slow -= dt; dt *= .45; }
  time += dt; wind.value = time;
  if (state === 'play') { updatePlayer(dt); updateEnemies(dt); updateBullets(dt); }
  for (const p of pickups) if (!p.got) { p.o.position.y = p.y + Math.sin(time * 3) * .2; p.o.rotation.y += dt * 2; p.r.rotation.x += dt; }
  for (let i = fx.length - 1; i >= 0; i--) {
    const f = fx[i], p = f.m.position; f.life -= dt; f.vy -= f.g * dt; p.x += f.vx * dt; p.y += f.vy * dt; p.z += f.vz * dt;
    const k = Math.max(0, f.life / f.max);
    if (f.sprite) { const sz = f.s + f.grow * (f.max - f.life); f.m.scale.set(sz, sz, 1); f.m.material.opacity = f.a * Math.min(1, k * 1.6); f.vx *= Math.exp(-dt * 2); f.vy *= Math.exp(-dt * 1.5); }
    else if (f.streak) { f.m.rotation.z = Math.atan2(f.vy, f.vx); f.m.scale.set(f.s * (1 + Math.hypot(f.vx, f.vy) * .12) * k, f.s * k + .01, 1); }
    else { f.m.scale.setScalar(f.s * Math.min(1, k * 3) + .01); f.m.rotation.x += dt * 12; f.m.rotation.z += dt * 7; if (f.bounce && p.y < .05 && p.y > -.4 && !gaps.some(g => p.x > g[0] && p.x < g[1])) { p.y = .05; f.vy *= -.35; f.vx *= .6; f.vz *= .6; } }
    if (f.life <= 0) { scene.remove(f.m); if (f.sprite) f.m.material.dispose(); fx.splice(i, 1); }
  }
  updateCorpses(dt);
  water.material.normalMap.offset.set(time * .025, time * .04);
  if (scene.userData.hurt > 0) scene.userData.hurt -= dt * 1.4; grade.uniforms.hit.value = Math.max(0, scene.userData.hurt || 0);
  boomLight.intensity *= Math.exp(-dt * 7); muzzle.intensity *= Math.exp(-dt * 22);
  flames.forEach((f, i) => { f.scale.set(1, 1.3 + Math.sin(time * 17 + i * 3) * .3, 1); if (Math.abs(f.position.x - camX) < viewHalf + 2 && Math.random() < dt * 9) puff(f.position.x, 2.3, f.position.z, { map: softTex, color: 0xff6a18, k: 2, add: true, life: .5, size: .35, grow: -.4, vy: 1.1, vx: rnd(-.2, .2) }); });
  dust.position.y = Math.sin(time * .5) * .3;
  if (state === 'play') { const target = boss ? BOSSX - Math.max(0, viewHalf - 8) : P.x + viewHalf * .28; camX = boss ? camX + (target - camX) * Math.min(1, dt * 2) : Math.max(camX, camX + (target - camX) * Math.min(1, dt * 6)); }
  if (state === 'title') camX = 12 + Math.sin(time * .15) * 8;
  shake *= Math.exp(-dt * 6);
  const lookY = portrait ? .5 : clamp(P.y * .45, 0, 3) + 3.2;
  camera.position.set(camX + (Math.random() - .5) * shake, lookY + 1.8 + (Math.random() - .5) * shake, dist);
  camera.lookAt(camX, lookY, 0);
  sky.position.copy(camera.position); water.position.y = -3.4 + Math.sin(time) * .06;
  sun.position.set(camX + 14, 16, 12); sun.target.position.set(camX, 0, 0);
  toastT -= dt; $('toast').style.opacity = clamp(toastT, 0, 1);
  $('score').textContent = String(score).padStart(6, '0');
  $('lives').textContent = '♥'.repeat(Math.max(0, lives));
  $('weapon').textContent = P.spread ? 'SPREAD' : 'RIFLE';
  $('bossbar').hidden = !(boss && boss.hp > 0);
  if (boss) { $('bossfill').style.width = Math.max(0, boss.hp / boss.max * 100) + '%'; if (boss.flash > 0) { boss.flash -= dt; if (boss.flash <= 0) boss.core.material.color.set(0xff3a18).multiplyScalar(2.5); } }
}
Promise.all([loadSoldier(manager), envReady]).then(() => {
  makeHero(); reset(); hero.position.set(P.x, P.y, 0); P.x = 12; hero.position.x = 12; pose(hero, P, .016);
  ready = true; $('go').textContent = 'Start mission'; $('go').disabled = false;
  renderer.setAnimationLoop(() => { clock.update(); const raw = clock.getDelta(); watchSpeed(raw); step(Math.min(raw, 1 / 30)); composer.render(); });
}).catch(err => { console.error(err); $('go').textContent = 'Could not load. Refresh to retry'; });
window.__game = { hurt, get ready() { return ready; }, start, step, keys, get P() { return P; }, get boss() { return boss; }, get state() { return state; }, get enemies() { return enemies; }, get lives() { return lives; }, set lives(v) { lives = v; }, render: () => composer.render(), halt: () => renderer.setAnimationLoop(null) };
