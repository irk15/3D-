import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { loadSoldier, soldier, pose, startDeath, die, revive } from './characters.js?v=5';
import * as ENV from './environment.js?v=5';
import { buildProps } from './props.js?v=5';
import { createWeather, createMusic } from './weather.js?v=5';
import { createCoop, COLORS } from './coop.js?v=5';

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

const hemi = new THREE.HemisphereLight(0x8fa6d8, 0x2a2014, .55); scene.add(hemi);
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
ENV.grassField(scene, wind, rnd, solids.filter(s => s.ground).map(s => [s.x1, s.x2]));
function platform(x, y, w) {
  mesh(box(w, .28, 2.4), steel, x, y - .14, 0);
  mesh(box(w, .07, .08), rust, x, y - .02, 1.22);
  for (const s of [-1, 1]) mesh(cyl(.09, .12, y, 8), rust, x + s * (w / 2 - .3), y / 2, -1.14);
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
const blocks = buildProps(scene, rnd, { rock: rockMat, rockNormal, steel, rust, bark, grass: grassMap }, gaps, END);
for (const b of blocks) solids.push({ x1: b.x1 - .3, x2: b.x2 + .3, y: b.top, ground: true, block: true });
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
    const body = { x: o.position.x + c.vx * dt, y: c.y }; collide(body, .9, o.position.x); o.position.x = body.x; o.position.y = c.y - Math.max(0, c.t - 3.2) * .45;
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
    const [a, b, d] = { jump: [220, 440, .12], power: [440, 1320, .3], hurt: [300, 60, .4], laser: [1500, 250, .14], rocket: [180, 70, .25], nade: [500, 200, .12] }[k];
    o.frequency.setValueAtTime(a, t); o.frequency.exponentialRampToValueAtTime(b, t + d);
    g.gain.setValueAtTime(.08, t); g.gain.exponentialRampToValueAtTime(.001, t + d); o.connect(g); o.start(t); o.stop(t + d);
  }
}
let music;
function initAudio() {
  if (ac) { ac.resume(); return; }
  try {
    ac = new AudioContext(); noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    music = createMusic(ac, noiseBuf);
  } catch { ac = null; }
}

// ---------- difficulty ----------
// hp: hits per life · wait: pause before an enemy's first shot · aim: how far their shots stray (radians)
// max: enemy bullets in the air at once · safe/guard: protection after respawning / after a hit · heal: seconds to regain one hit
const LEVELS = {
  easy: { name: 'Recruit', lives: 7, hp: 6, speed: .55, rate: 2.4, wait: 2.2, aim: .2, max: 3, safe: 5, guard: 2, heal: 5, boss: 45, run: .7, extra: false, score: 1, note: '7 lives · 6 hits each · health refills · slow enemy fire' },
  normal: { name: 'Soldier', lives: 5, hp: 4, speed: .72, rate: 1.65, wait: 1.5, aim: .11, max: 4, safe: 4, guard: 1.5, heal: 8, boss: 75, run: .85, extra: false, score: 1.5, note: '5 lives · 4 hits each · a fair fight' },
  hard: { name: 'Commando', lives: 3, hp: 2, speed: 1.05, rate: 1, wait: .8, aim: .04, max: 8, safe: 3, guard: 1, heal: 0, boss: 130, run: 1.1, extra: true, score: 2, note: '3 lives · 2 hits each · more enemies · double score' }
};
let level = 'normal';
try { if (LEVELS[localStorage.ironLevel]) level = localStorage.ironLevel; } catch { /* storage unavailable */ }
const diff = () => LEVELS[level];
function setLevel(l) {
  level = l; try { localStorage.ironLevel = l; } catch { /* storage unavailable */ }
  document.querySelectorAll('[data-level]').forEach(b => b.setAttribute('aria-pressed', b.dataset.level === l));
  $('levelnote').textContent = diff().note;
}
document.querySelectorAll('[data-level]').forEach(b => b.onclick = () => setLevel(b.dataset.level));
setLevel(level);

// ---------- entities ----------
let hero, ready = false;
function makeSoldierFor(slot) {
  const c = COLORS[slot], o = soldier(c); scene.add(o);
  const l = new THREE.PointLight(c.visor, 6, 5, 2); l.position.set(0, 1.8, 1.8); o.add(l); return o;
}
let heroSlot = -1;
function makeHero(slot = 0) {
  if (slot === heroSlot) return;
  if (hero) scene.remove(hero);
  hero = makeSoldierFor(slot); heroSlot = slot;
}
const remotes = new Map();
let P, enemies = [], bullets = [], pickups = [], score = 0, lives, state = 'title', camX = 0, boss, checkpoint = 2, time = 0;
const bGeo = cap(.035, .5); bGeo.rotateZ(Math.PI / 2);
const bMat = glow(0xffc060, 2.2), bSpread = glow(0xff6030, 2.6), eMat = glow(0xff2858, 4), eGeo = ball(.15);
const halo = c => new THREE.SpriteMaterial({ map: softTex, color: c, transparent: true, opacity: .55, blending: THREE.AdditiveBlending, depthWrite: false });
const eHalo = halo(0xff2050), bHalo = halo(0xff9a30);
const laserGeo = cap(.045, 1.6); laserGeo.rotateZ(Math.PI / 2);
const lMat = glow(0x40ff9a, 3.4), rocketGeo = cap(.11, .45); rocketGeo.rotateZ(Math.PI / 2);
function shoot(x, y, a, speed, enemy, mat) {
  const m = mesh(enemy ? eGeo : bGeo, mat || (enemy ? eMat : bMat), x, y, 0, scene, false); m.rotation.z = a;
  const halo = new THREE.Sprite(enemy ? eHalo : bHalo); halo.scale.set(enemy ? .9 : .55, enemy ? .9 : .55, 1); m.add(halo);
  const k = enemy ? diff().speed : 1;
  const b = { m, vx: Math.cos(a) * speed * k, vy: Math.sin(a) * speed * k, enemy, life: enemy ? 3.2 / k : 1.1, dmg: 1 };
  bullets.push(b); return b;
}
// enemy shots are announced to teammates so each player can dodge them on their own screen
function enemyShot(x, y, a, speed) {
  if (bullets.filter(b => b.enemy && b.life > 0).length >= diff().max * (net.playing ? 1 + remotes.size * .5 : 1)) return;
  a += rnd(-diff().aim, diff().aim); shoot(x, y, a, speed, true); if (net.playing && net.host) net.send({ t: 'ef', x: +x.toFixed(2), y: +y.toFixed(2), a: +a.toFixed(3), s: speed }); sfx('eshot'); }
const WEAPONS = { rifle: { name: 'RIFLE', cd: .12 }, spread: { name: 'SPREAD GUN', cd: .17, color: 0xff7a30 }, laser: { name: 'LASER', cd: .22, color: 0x40ff9a }, rocket: { name: 'ROCKET', cd: .5, color: 0xff3a3a }, nade: { name: '+3 GRENADES', color: 0x38e0ff } };
// ghost shots are copies of a teammate's fire: seen but harmless here
function fireWeapon(w, sx, sy, a, ghost) {
  if (w === 'laser') { const b = shoot(sx, sy, a, 40, false, lMat); b.m.geometry = laserGeo; b.dmg = 2; b.pierce = new Set(); b.ghost = ghost; }
  else if (w === 'rocket') { const b = shoot(sx, sy, a, 17, false, glow(0xff8030, 2.5)); b.m.geometry = rocketGeo; b.rocket = true; b.life = 1.5; b.ghost = ghost; }
  else for (const off of w === 'spread' ? [-.28, -.14, 0, .14, .28] : [0]) shoot(sx, sy, a + off, 26, false, w === 'spread' ? bSpread : bMat).ghost = ghost;
}
let grenades = [];
const nadeGeo = ball(.15), nadeMat = std(0x394a28, .5, .6);
function throwNade(x, y, vx, vy, ghost) {
  const m = mesh(nadeGeo, nadeMat, x, y, .2); mesh(ball(.05), glow(0xff4020, 4), 0, .14, 0, m, false);
  grenades.push({ m, vx, vy, t: 1.25, ghost });
}
// splash damage from grenades, rockets and fuel drums
function blast(x, y, radius, dmg, ghost) {
  explode(x, Math.max(y, .4), radius / 2.6);
  if (ghost) return;
  for (const e of enemies) { const cy = e.type === 'drone' || e.type === 'gunship' ? e.y : e.y + e.h / 2; if (!e.gone && Math.hypot(Math.max(0, Math.abs(e.x - x) - e.w), cy - y) < radius) damage(e, e.type === 'drum' ? 9 : dmg, Math.sign(e.x - x) || 1); }
}
function updateGrenades(dt) {
  for (let i = grenades.length - 1; i >= 0; i--) {
    const n = grenades[i], p = n.m.position; n.t -= dt; n.vy -= 26 * dt; p.x += n.vx * dt; p.y += n.vy * dt; n.m.rotation.z -= dt * 12;
    const overGap = gaps.some(g => p.x > g[0] && p.x < g[1]);
    if (p.y < .15 && !overGap && p.y > -.5) { p.y = .15; n.vy *= -.42; n.vx *= .62; }
    const touch = enemies.some(e => !e.gone && Math.abs(p.x - e.x) < e.w + .15 && p.y > e.y - .5 && p.y < e.y + e.h + .1);
    if (n.t <= 0 || touch || p.y < -4) { scene.remove(n.m); grenades.splice(i, 1); blast(p.x, p.y, 3.2, 8, n.ghost); }
  }
}
let nextId = 1;
function addEnemy(type, x, y = 0, id = nextId++) {
  let o, e = { id, type, x, y, vx: 0, vy: 0, on: true, cd: rnd(.6, 1.8), flash: 0 };
  if (type === 'run' || type === 'gun') {
    o = soldier(type === 'gun' ? { tint: 0xe08a70, visor: 0xff2a10 } : { tint: 0xc8b078, visor: 0xff6a10 }); e.hp = type === 'gun' ? 3 : 1; e.face = -1; o.rotation.y = Math.PI; e.h = 1.8; e.w = .45;
  } else if (type === 'turret') {
    o = new THREE.Group(); mesh(cyl(.7, .95, .7), steel, 0, .35, 0, o); mesh(ball(.55), rust, 0, .8, 0, o);
    const piv = new THREE.Group(); piv.position.y = .85; o.add(piv); mesh(box(1.2, .22, .22), steel, .65, 0, 0, piv); mesh(ball(.13), glow(0xff3020), 0, .15, .52, piv, false);
    o.userData.piv = piv; e.hp = 8; e.h = 1.35; e.w = .8;
  } else if (type === 'drum') {
    o = new THREE.Group(); mesh(cyl(.45, .45, 1.1, 20), std(0xc01c10, .4, .5, { emissive: 0x3a0400 }), 0, .55, 0, o); for (const h of [.25, .85]) mesh(cyl(.47, .47, .1, 20), std(0xffc21a, .5, .3, { emissive: 0x332200 }), 0, h, 0, o);
    mesh(ball(.07), glow(0xff9020, 4), 0, .58, .48, o, false); e.hp = 2; e.h = 1.1; e.w = .46;
  } else if (type === 'gunship') {
    o = new THREE.Group(); const hull = std(0x39432f, .45, .7);
    mesh(cap(.9, 2.4), hull, 0, 0, 0, o).rotation.z = Math.PI / 2; mesh(ball(.7), std(0x14262e, .05, .9), -1.55, .12, .25, o); mesh(cyl(.14, .4, 3.2, 10), hull, 3, .35, 0, o).rotation.z = -Math.PI / 2 + .15; mesh(box(.15, 1.3, .1), rust, 4.5, .8, 0, o);
    for (const z of [-1.1, 1.1]) { mesh(box(1.1, .12, .9), hull, .2, -.45, z, o); mesh(cyl(.22, .22, 1.3, 12), steel, -.1, -.7, z * 1.15, o).rotation.z = Math.PI / 2; }
    mesh(cyl(.14, .14, .7, 8), steel, 0, 1.2, 0, o);
    const rotor = new THREE.Group(); rotor.position.y = 1.55; o.add(rotor); for (const a of [0, Math.PI / 2]) mesh(box(7.4, .05, .26), std(0x101012, .6, .4), 0, 0, 0, rotor).rotation.y = a;
    mesh(ball(.2), glow(0xff2010, 4), -.9, -.75, .75, o, false); const lamp = new THREE.PointLight(0xff4030, 14, 8, 2); lamp.position.set(-1, -1.4, 1); o.add(lamp);
    o.userData.main = rotor; e.hp = e.max = Math.round(diff().boss * .6); e.h = 1.9; e.w = 2.1; e.n = 0; e.base = y;
  } else if (type === 'drone') {
    o = new THREE.Group(); mesh(ball(.42), steel, 0, 0, 0, o).scale.y = .65; mesh(ball(.14), glow(0xff3020, 4), -.3, -.03, .3, o, false);
    o.userData.rot = [-.75, .75].map(s => mesh(box(.8, .04, .12), rust, s, .24, 0, o)); e.hp = 2; e.h = .6; e.w = .6; e.base = y;
  }
  o.position.set(x, y, 0); scene.add(o); e.o = o; enemies.push(e); if (type === 'gunship') gunship = e; return e;
}
let gunship;
function makeBoss() {
  const o = new THREE.Group(), armor = std(0x3b4148, .4, .85);
  mesh(box(5, 8, 4), armor, 1.4, 4, -.4, o); mesh(box(5.6, .6, 4.6), rust, 1.4, 8.2, -.4, o);
  for (let y = 1; y < 8; y += 1.6) mesh(box(.2, .2, 4.2), steel, -1.15, y, -.4, o);
  const core = mesh(ball(.75), glow(0xff3a18, 2.5), -1.15, 2.2, 0, o, false);
  const guns = [4.6, 6.6].map(y => { const p = new THREE.Group(); p.position.set(-1.3, y, .5); o.add(p); mesh(ball(.5), steel, 0, 0, 0, p); mesh(box(1.5, .3, .3), armor, -.8, 0, 0, p); return p; });
  o.position.set(BOSSX + 6, 0, 0); scene.add(o);
  boss = { id: 9999, type: 'boss', o, core, guns, x: BOSSX + 4.85, y: 1.2, w: .9, h: 2.1, hp: diff().boss, max: diff().boss, cd: 2, flash: 0, n: 0 };
  enemies.push(boss);
}
function addPickup(x, y, kind) {
  const c = WEAPONS[kind].color, o = new THREE.Group(); mesh(kind === 'nade' ? ball(.3) : new THREE.OctahedronGeometry(.38), glow(c, 2.2), 0, 0, 0, o, false);
  const r = mesh(new THREE.TorusGeometry(.6, .05, 8, 32), glow(c, 1.5), 0, 0, 0, o, false); o.position.set(x, y, 0); scene.add(o); pickups.push({ o, r, x, y, kind });
}
let spawns = [];
function reset() {
  grenades.forEach(n => scene.remove(n.m)); grenades = []; gunship = null; nextId = 1; combo = 0; comboT = 0; clock0 = 0; shots = 0; hits = 0; gunshipSent = false; dead.clear();
  [...enemies, ...pickups, ...corpses].forEach(e => scene.remove(e.o)); corpses.length = 0; scorches.splice(0).forEach(d => scene.remove(d)); bullets.forEach(b => scene.remove(b.m));
  enemies = []; bullets = []; pickups = []; boss = null; score = 0; lives = diff().lives; checkpoint = 2; camX = 2; time = 0;
  P = { x: 2 + (net.playing ? net.slot * 1.1 : 0), y: 0, vx: 0, vy: 0, on: true, face: 1, aim: 0, cd: 0, inv: 3, weapon: 'rifle', nades: 3, hp: diff().hp, calm: 0, dead: 0, drop: 0, slow: 0, shot: 0 };
  revive(hero); hero.rotation.y = 0; hero.visible = true;
  spawns = [[16, 'run'], [18, 'gun', 2.6], [24, 'run'], [11, 'drum'], [41.5, 'turret'], [34, 'gun', 2.8], [40, 'drone', 4.5], [43, 'run'], [56, 'run'], [58, 'run'], [63, 'gun', 2.6], [55.8, 'drum'], [70.3, 'turret'], [75, 'drone', 5], [85, 'gun', 5.2], [90, 'run'], [89.5, 'drum'], [110, 'gun', 2.7], [114, 'run'], [116, 'drone', 4], [120, 'turret', 5], [121.5, 'drum'], [124.8, 'turret'], [128, 'run'], [132, 'run'], [136, 'gun', 2.7], [145, 'drone', 5], [148, 'drone', 3.6], [182.5, 'turret'], [165, 'gun', 2.8], [173, 'gun', 5.1], [180, 'run'], [182, 'run'], [185, 'drone', 4.5], [190, 'turret', 2.7], [196, 'gun'], [200, 'run'], [203, 'turret'], [207, 'drum'], [212, 'drum']];
  if (diff().extra) spawns.push([27, 'run'], [46, 'drone', 4.2], [66, 'run'], [80, 'gun', 2.8], [94, 'drone', 4.6], [112, 'run'], [137, 'turret', 2.7], [157, 'run'], [170, 'drone', 3.8], [188, 'run'], [199, 'drone', 4.4]);
  spawns.sort((a, b) => a[0] - b[0]);
  addPickup(41, 6, 'spread'); addPickup(62, 4, 'nade'); addPickup(85, 6.6, 'laser'); addPickup(120, 7, 'rocket'); addPickup(136, 4.1, 'nade'); addPickup(173, 6.5, 'spread'); addPickup(192, 4.1, 'laser'); addPickup(209, 1.4, 'nade');
}

// ---------- input ----------
const keys = {}, touch = {};
const map = { ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r', ArrowUp: 'u', KeyW: 'u', ArrowDown: 'd', KeyS: 'd', Space: 'j', KeyK: 'j', KeyJ: 'f', KeyX: 'f', KeyZ: 'j', KeyG: 'n', KeyL: 'n' };
addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  if (map[e.code]) { keys[map[e.code]] = true; e.preventDefault(); }
  if (e.code === 'Enter' && e.target.tagName !== 'INPUT' && state !== 'play' && !net.active) start();
  if (e.code === 'KeyP' && (state === 'play' || state === 'pause')) togglePause();
  if (e.code === 'KeyM') toggleMute();
});
addEventListener('keyup', e => { if (map[e.code]) keys[map[e.code]] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; if (state === 'play' && !net.playing) togglePause(); });
const pad = $('pad'), pointers = new Map();
function dirFrom(ev) {
  const r = pad.getBoundingClientRect(), dx = (ev.clientX - r.left) / r.width - .5, dy = (ev.clientY - r.top) / r.height - .5;
  const dead = .1; touch.l = dx < -dead; touch.r = dx > dead; touch.u = dy < -.17; touch.d = dy > .17;
  $('knob').style.transform = `translate(${clamp(dx, -.35, .35) * r.width}px,${clamp(dy, -.35, .35) * r.height}px)`;
}
pad.addEventListener('pointerdown', e => { pad.setPointerCapture(e.pointerId); pointers.set(e.pointerId, 1); dirFrom(e); });
pad.addEventListener('pointermove', e => { if (pointers.has(e.pointerId)) dirFrom(e); });
for (const n of ['pointerup', 'pointercancel']) pad.addEventListener(n, e => { pointers.delete(e.pointerId); touch.l = touch.r = touch.u = touch.d = false; $('knob').style.transform = ''; });
for (const [id, k] of [['bj', 'j'], ['bf', 'f'], ['bn', 'n']]) {
  const b = $(id); b.addEventListener('pointerdown', e => { b.setPointerCapture(e.pointerId); touch[k] = true; });
  for (const n of ['pointerup', 'pointercancel']) b.addEventListener(n, () => touch[k] = false);
}
addEventListener('contextmenu', e => e.preventDefault());
const down = k => keys[k] || touch[k];
function togglePause() { if (net.playing) return; state = state === 'play' ? 'pause' : 'play'; if (state === 'pause') show('PAUSED', 'Take a breath, soldier.', 'Resume'); else $('menu').hidden = true; }
function toggleMute() { muted = !muted; $('mute').textContent = muted ? 'Sound off' : 'Sound on'; }
$('mute').onclick = toggleMute; $('pause').onclick = () => {
  if (net.active) { net.leave(); $('levels').classList.remove('locked'); toMenu('You left the co-op game.'); } else if (state === 'play' || state === 'pause') togglePause();
};
function show(t, s, b) { $('title').textContent = t; $('sub').textContent = s; $('go').textContent = b; $('menu').hidden = false; }
function start() {
  if (!ready) return;
  initAudio();
  if (state === 'pause') { togglePause(); return; }
  if (net.active) { if (net.host) net.start(); return; }
  begin();
}
function begin() {
  initAudio(); for (const id of [...remotes.keys()]) removeRemote(id);
  makeHero(net.playing ? net.slot : 0); reset(); state = 'play'; $('menu').hidden = true; $('setup').hidden = true;
  $('pause').textContent = net.playing ? 'Leave' : 'Pause'; toast(net.playing ? 'CO-OP MISSION' : 'MISSION 1: IRON JUNGLE');
}
$('go').onclick = start;

// ---------- update ----------
const HEAD = 1.95;
function obstaclesNow() { return blocks.concat(enemies.filter(e => (e.type === 'turret' || e.type === 'drum') && !e.gone).map(e => { const h = e.type === 'drum' ? .46 : .75; return { x1: e.x - h, x2: e.x + h, y: e.y, top: e.y + e.h, turret: e }; })); }
// push a body of half-width r out of anything solid
function collide(e, r, ox) {
  for (const b of obstaclesNow()) {
    if (b.turret === e || e.y >= b.top - .05 || e.y + 1.7 <= b.y) continue;
    if (e.x + r > b.x1 && e.x - r < b.x2) { e.x = ox < (b.x1 + b.x2) / 2 ? b.x1 - r : b.x2 + r; e.blocked = true; }
  }
  if (e.y < -.3) for (const g of gaps) if (e.x > g[0] - .5 && e.x < g[1] + .5) e.x = clamp(e.x, g[0] + .4, g[1] - .4);
}
function physics(e, dt, r = .5) {
  const oy = e.y, ox = e.x; e.vy -= 34 * dt; e.x += e.vx * dt; e.y += e.vy * dt; e.on = false; e.blocked = false;
  if (e.vy <= 0) {
    let top = -Infinity, hit;
    for (const s of solids) if (e.x > s.x1 - .2 && e.x < s.x2 + .2 && oy >= s.y - .02 && e.y <= s.y && s.y > top) { top = s.y; hit = s; }
    for (const b of obstaclesNow()) if (b.turret && b.turret !== e && e.x > b.x1 - .5 && e.x < b.x2 + .5 && oy >= b.top - .02 && e.y <= b.top && b.top > top) { top = b.top; hit = { ground: true }; }
    if (hit) { e.y = top; e.vy = 0; e.on = true; e.ground = hit.ground; }
  } else for (const s of solids) {
    // heads bump against the underside of platforms
    const under = s.y - .3;
    if (!s.ground && e.x > s.x1 - .25 && e.x < s.x2 + .25 && oy + HEAD <= under + .02 && e.y + HEAD > under) { e.y = under - HEAD; e.vy = 0; }
  }
  collide(e, r, ox);
}
function hurt(dir = -P.face, lethal = false) {
  if (P.dead > 0 || (P.inv > 0 && !lethal)) return;
  P.calm = 0;
  // armour takes the hit until it runs out
  if (!lethal && --P.hp > 0) {
    P.inv = diff().guard; scene.userData.hurt = .45; shake = Math.max(shake, .14); wound(P.x, P.y + (P.prone ? .35 : 1.35), dir); sfx('hurt'); return;
  }
  P.hp = 0;
  P.dead = 3; P.slow = .45; scene.userData.hurt = .8; lives--; P.weapon = 'rifle'; hero.visible = true; hero.userData.flash.visible = false;
  P.vx = dir * 3; P.vy = Math.max(P.vy * .3, 0) + (P.on ? 2 : 3); P.prone = false;
  startDeath(hero, dir !== P.face); if (P.y > -1) wound(P.x, P.y + 1.35, dir); shake = Math.max(shake, .22); sfx('hurt');
}
function respawn() {
  if (lives <= 0) {
    if (!net.playing) { finish(false); return; }
    P.out = true; P.dead = 1e9; hero.visible = false; toast('YOU ARE DOWN · WATCHING YOUR TEAM'); return;
  }
  let x = Math.max(checkpoint, camX - Math.min(4, viewHalf - 1.5));
  for (const g of gaps) if (x > g[0] - 4 && x < g[1] + 1.5) x = g[0] - 4;
  for (const b of obstaclesNow()) if (x > b.x1 - 1 && x < b.x2 + 1 && b.y < 1) x = b.x1 - 1.1;
  camX = Math.min(camX, x + viewHalf - 1.5);
  P.nades = Math.max(P.nades, 2); revive(hero);
  Object.assign(P, { x, y: .05, vx: 0, vy: 0, inv: diff().safe, hp: diff().hp, calm: 0, dead: 0 }); hero.visible = true;
  for (const e of enemies) e.cd = Math.max(e.cd, diff().wait);
  bullets.filter(b => b.enemy).forEach(b => b.life = 0);
}
function updatePlayer(dt) {
  if (P.out) return;
  if (P.dead > 0) {
    P.dead -= dt; physics(P, dt, .9); if (P.on) P.vx *= Math.exp(-dt * 4.5);
    hero.position.set(P.x, P.y, 0); if (die(hero, dt, P.on)) { dust2(P.x, P.y); shake = Math.max(shake, .12); }
    if (P.dead <= 0) respawn(); return;
  }
  const h = (down('r') ? 1 : 0) - (down('l') ? 1 : 0), u = down('u'), d = down('d');
  if (h) P.face = h;
  P.prone = d && !h && P.on && !obstaclesNow().some(b => P.y < b.top - .05 && P.y + .6 > b.y && P.x + (P.face > 0 ? 1.5 : 1.2) > b.x1 && P.x - (P.face > 0 ? 1.2 : 1.5) < b.x2);
  P.vx = P.prone ? 0 : h * 7.2;
  P.aim = u ? (h ? .75 : 1.45) : d && h ? -.7 : d && !P.on ? -1.45 : 0;
  if (down('j') && !P.jHeld && P.on) { P.vy = 15.2; sfx('jump'); }
  P.jHeld = down('j');
  physics(P, dt);
  const minX = net.playing ? 0 : camX - viewHalf + 1;
  P.x = clamp(P.x, Math.max(0, minX), boss ? BOSSX + 2.6 : END);
  if (P.y < -3) { hurt(-P.face, true); P.dead = 1.1; }
  if (P.on && P.ground && !gaps.some(g => P.x > g[0] - 2 && P.x < g[1] + 2)) checkpoint = Math.max(checkpoint, P.x - 3);
  P.cd -= dt; P.inv -= dt;
  if (diff().heal && P.hp < diff().hp && (P.calm += dt) >= diff().heal) { P.hp++; P.calm = 0; }
  hero.userData.flash.visible = false;
  if (down('f') && P.cd <= 0) {
    P.cd = WEAPONS[P.weapon].cd;
    const a = P.face > 0 ? P.aim : Math.PI - P.aim;
    const sx = P.x + Math.cos(a) * 1.1, sy = P.y + (P.prone ? .55 : 1.55) + Math.sin(a) * 1.1;
    fireWeapon(P.weapon, sx, sy, a, false); shots++;
    muzzle.position.set(sx, sy, .8); muzzle.intensity = 24; P.flashT = .045; sfx(P.weapon === 'laser' ? 'laser' : P.weapon === 'rocket' ? 'rocket' : 'shot');
    puff(sx, sy, .4, { map: softTex, color: 0xffa040, k: 2.5, add: true, life: .06, size: .9, alpha: .8 });
    casing(P.x + P.face * .3, sy - .05, P.face);
    if (net.playing) net.send({ t: 'sh', w: P.weapon, x: +sx.toFixed(2), y: +sy.toFixed(2), a: +a.toFixed(3) });
  }
  P.nadeCd = (P.nadeCd || 0) - dt;
  if (down('n') && !P.nHeld && P.nades > 0 && P.nadeCd <= 0) {
    P.nades--; P.nadeCd = .45; const v = { x: P.x + P.face * .6, y: P.y + 1.7, vx: P.face * (u ? 6 : 10) + P.vx * .4, vy: u ? 13 : 8 };
    throwNade(v.x, v.y, v.vx, v.vy, false); sfx('nade'); if (net.playing) net.send({ t: 'nd', ...v });
  }
  P.nHeld = down('n');
  P.flashT -= dt; hero.userData.flash.visible = P.flashT > 0; hero.userData.flash.rotation.x = time * 90;
  hero.position.set(P.x, P.y, 0); pose(hero, P, dt);
  hero.visible = P.inv <= 0 || Math.floor(P.inv * 14) % 2 === 0;
  for (const p of pickups) if (!p.got && Math.abs(P.x - p.x) < .9 && Math.abs(P.y + 1 - p.y) < 1.3) {
    p.got = true; scene.remove(p.o); if (p.kind === 'nade') P.nades = Math.min(9, P.nades + 3); else P.weapon = p.kind;
    if (!net.playing || net.host) score += 500; sfx('power'); toast(WEAPONS[p.kind].name);
  }
}
let toastT = 0;
const weather = createWeather(scene, renderer, sun, hemi, sky.material);
let storm = 0;
function toast(t) { $('toast').textContent = t; toastT = 1.8; }
// everyone the enemies can shoot at
function targets() {
  const list = []; if (P.dead <= 0) list.push({ x: P.x, y: P.y, prone: P.prone });
  for (const r of remotes.values()) if (!r.dead && !r.out) list.push({ x: r.x, y: r.y, prone: r.prone });
  return list;
}
const leaderX = () => Math.max(P.out ? 0 : P.x, ...[...remotes.values()].map(r => r.x));
const rearX = () => Math.min(P.out ? 1e9 : P.x, ...[...remotes.values()].filter(r => !r.out).map(r => r.x));
let gunshipSent = false;
function updateEnemies(dt) {
  const authority = !net.playing || net.host;
  if (authority) {
    const front = net.playing ? Math.max(leaderX() + viewHalf * .28, camX) : camX, edge = front + Math.max(viewHalf, 12);
    while (spawns.length && spawns[0][0] < edge + 3) { const [x, t, y] = spawns.shift(); addEnemy(t, t === 'run' ? Math.max(x, edge + 1) : x, y || 0); }
    if (!gunshipSent && leaderX() > 148) { gunshipSent = true; addEnemy('gunship', leaderX() + 16, 6.2); toast('GUNSHIP INBOUND'); }
    if (!boss && leaderX() > BOSSX - 14) { makeBoss(); toast('WARNING: IRON BASTION'); }
  }
  const alive = targets();
  for (const e of enemies) {
    // pick the nearest living player
    let T = null; for (const t of alive) if (!T || Math.abs(t.x - e.x) < Math.abs(T.x - e.x)) T = t;
    const dx = (T ? T.x : P.x) - e.x, ty = (T ? T.y : P.y) + (T && T.prone ? .35 : 1.1);
    const seen = net.playing ? Math.abs(dx) < 13 : Math.abs(e.x - camX) < viewHalf - .8;
    e.cd -= dt / diff().rate;
    if (!seen && e.type !== 'boss') e.cd = Math.max(e.cd, diff().wait / diff().rate);
    if (!authority) {
      const ox = e.x, k = Math.min(1, dt * 11); e.x += ((e.tx ?? e.x) - e.x) * k; e.y += ((e.ty ?? e.y) - e.y) * k; e.vx = (e.x - ox) / Math.max(dt, .001); e.on = e.air !== 1;
      if (e.type === 'turret') e.o.userData.piv.rotation.z = Math.atan2(ty - (e.y + .95), dx);
      if (e.type === 'gun') { e.face = dx < 0 ? -1 : 1; e.aim = clamp(Math.atan2(ty - (e.y + 1.5), Math.abs(dx)), -.8, 1.1); }
    } else if (e.type === 'run') {
      if (!e.dir) e.dir = dx < 0 ? -1 : 1;
      e.face = e.dir; e.vx = e.dir * 4.6 * diff().run;
      if (e.on && e.ground && gaps.some(g => e.dir < 0 ? e.x - g[1] < .8 && e.x - g[1] > 0 : g[0] - e.x < .8 && g[0] - e.x > 0)) e.vy = 13;
      if (e.on && obstaclesNow().some(b => e.y < b.top - .05 && (e.dir < 0 ? e.x - b.x2 > 0 && e.x - b.x2 < 1.5 : b.x1 - e.x > 0 && b.x1 - e.x < 1.5))) e.vy = 12;
      const before = e.x; physics(e, dt);
      // wedged against something: turn around instead of pushing forever
      e.stuck = Math.abs(e.x - before) < Math.abs(e.vx * dt) * .3 ? (e.stuck || 0) + dt : 0;
      if (e.stuck > .35) { e.dir *= -1; e.stuck = 0; }
    } else if (e.type === 'gun') {
      e.face = dx < 0 ? -1 : 1; const a = Math.atan2(ty - (e.y + 1.5), Math.abs(dx));
      e.aim = clamp(a, -.8, 1.1); physics(e, dt);
      if (e.cd <= 0 && seen && T) { e.cd = rnd(1.4, 2.3); const sa = e.face > 0 ? e.aim : Math.PI - e.aim; enemyShot(e.x + Math.cos(sa) * 1.1, e.y + 1.5 + Math.sin(sa), sa, 9.5); }
    } else if (e.type === 'turret') {
      const a = Math.atan2(ty - (e.y + .95), dx); e.o.userData.piv.rotation.z = a;
      if (e.cd <= 0 && seen && T) { e.cd = 1.7; enemyShot(e.x + Math.cos(a) * 1.3, e.y + .95 + Math.sin(a) * 1.3, a, 9); }
    } else if (e.type === 'drone') {
      e.x += clamp(dx, -1, 1) * 2.2 * dt; e.y = e.base + Math.sin(time * 3 + e.base) * .6;
      if (e.cd <= 0 && seen && T) { e.cd = 2.1; enemyShot(e.x, e.y - .3, Math.atan2(ty - e.y, dx), 8); }
    } else if (e.type === 'gunship') {
      const goal = (T ? T.x : e.x) + Math.sin(time * .7) * 6.5;
      e.x += clamp(goal - e.x, -6, 6) * dt * 1.2; e.y = e.base + Math.sin(time * 1.9) * .7;
      if (e.cd <= 0 && T && Math.abs(dx) < 18) {
        e.n++;
        if (e.n % 6 === 0) { for (const off of [-1.4, 0, 1.4]) enemyShot(e.x + off, e.y - 1, -Math.PI / 2 + off * .08, 7); e.cd = 1.5; }
        else { enemyShot(e.x - 1, e.y - .9, Math.atan2(ty - (e.y - .9), dx + 1), 10); e.cd = e.n % 6 > 2 ? 1.1 : .28; }
      }
    } else if (e.type === 'boss') {
      if (e.cd <= 0 && T) {
        e.n++; const rage = e.hp < e.max / 2;
        const g = e.guns[e.n % 2], gx = e.o.position.x + g.position.x - 1.2, gy = g.position.y, a = Math.atan2(ty - gy, T.x - gx);
        if (e.n % 4 === 0) { for (let i = 0; i < 4; i++) enemyShot(e.x - 1.3, .6, Math.PI - i * .22, 8); }
        else for (const off of rage ? [-.2, 0, .2] : [0]) enemyShot(gx, gy, a + off, 9.5);
        e.cd = rage ? .75 : 1.05;
      }
    }
    // visuals
    if (e.type === 'drone') { e.o.userData.rot.forEach(r => r.rotation.y += dt * 40); e.o.rotation.z = -clamp(dx * .04, -.3, .3); }
    if (e.type === 'gunship') { e.o.userData.main.rotation.y += dt * 28; e.face = dx < 0 ? 1 : -1; e.o.rotation.y += ((e.face > 0 ? 0 : Math.PI) - e.o.rotation.y) * Math.min(1, dt * 3); e.o.rotation.z = clamp(-dx * .02, -.16, .16); if (e.hp < e.max / 2 && Math.random() < dt * 14) puff(e.x + 1, e.y + .6, 0, { color: 0x222020, alpha: .6, life: 1.1, size: .8, grow: 1.5, vy: 1.4, vx: 1 }); }
    if (e.type === 'boss') { e.core.scale.setScalar(1 + Math.sin(time * 6) * .08); for (const g of e.guns) g.rotation.z = Math.atan2(ty - g.position.y, (T ? T.x : P.x) - (e.o.position.x + g.position.x)) - Math.PI; }
    e.o.position.set(e.type === 'boss' ? e.o.position.x : e.x, e.type === 'boss' ? 0 : e.y, 0);
    if (e.type === 'run' || e.type === 'gun') pose(e.o, e, dt);
    // touching an enemy is fatal; fuel drums are only scenery until shot
    const flying = e.type === 'drone' || e.type === 'gunship', cy = flying ? e.y : e.y + e.h / 2;
    if (e.type !== 'drum' && P.dead <= 0 && Math.abs(P.x - e.x) < e.w + .25 && Math.abs(P.y + (P.prone ? .3 : .9) - cy) < e.h / 2 + (P.prone ? .2 : .6)) hurt(P.x < e.x ? -1 : 1);
    if (authority && (e.y < -5 || (e.type === 'run' && (net.playing ? e.x < rearX() - 30 : e.x < camX - viewHalf - 8)) || (!net.playing && e.type !== 'boss' && e.type !== 'gunship' && e.x < camX - viewHalf - 8))) e.gone = true;
  }
}
const dead = new Set();
let combo = 0, comboT = 0, clock0 = 0, shots = 0, hits = 0;
const SCORES = { run: 100, gun: 200, drone: 250, turret: 400, drum: 50, gunship: 3000, boss: 5000 };
// damage from this player; guests report it to the host, who owns enemy health
function damage(e, dmg, dir) {
  if (e.gone) return;
  if (e.type === 'boss') { e.core.material.color.setRGB(5, 4, 3); e.flash = .05; }
  if (net.playing && !net.host) { net.toHost({ t: 'hit', id: e.id, d: dmg, dir }); return; }
  e.hp -= dmg; if (e.hp <= 0) killEnemy(e, dir);
}
function killEnemy(e, dir) {
  if (e.gone) return;
  e.gone = true; dead.add(e.id);
  if (e.type !== 'drum') { combo = comboT > 0 ? combo + 1 : 1; comboT = 2.8; }
  score += Math.round(SCORES[e.type] * diff().score * (1 + Math.min(combo - 1, 8) * .25));
  if (net.playing && net.host) net.send({ t: 'k', id: e.id, dir });
  deathFx(e, dir);
  if (e.type === 'boss') { bullets.forEach(q => q.life = 0); endMission(true); }
}
function endMission(won) {
  if (net.playing) { for (let i = 0; i < 3; i++) net.send({ t: 'end', won, score }); net.playing = false; }
  finish(won);
}
function deathFx(e, dir) {
  if (e.type === 'boss') { for (let i = 0; i < 6; i++) explode(e.x + rnd(-1, 3), rnd(1, 7), 1.5); }
  else if (e.type === 'gunship') { for (let i = 0; i < 5; i++) explode(e.x + rnd(-2, 2), e.y + rnd(-1, 1), 1.3); toast('GUNSHIP DOWN'); }
  else if (e.type === 'run' || e.type === 'gun') { e.kept = true; fall(e, dir || -e.face); sfx('hurt'); }
  else if (e.type === 'drum') { e.gone = true; blast(e.x, e.y + .6, 3.4, 8, net.playing && !net.host); if (Math.abs(P.x - e.x) < 2.2 && Math.abs(P.y - e.y) < 2) hurt(P.x < e.x ? -1 : 1); }
  else explode(e.x, e.type === 'drone' ? e.y : e.y + 1, e.type === 'turret' ? 1 : .6);
}
function finish(won, finalScore) {
  if (state === 'won' || state === 'over') return;
  if (finalScore !== undefined) score = finalScore;
  state = won ? 'won' : 'over'; toastT = 0;
  const total = score + (won ? Math.max(0, lives) * 1000 : 0), acc = shots ? Math.min(100, Math.round(hits / shots * 100)) : 0;
  const rank = !won ? '' : lives >= diff().lives - 1 && clock0 < 150 ? 'S' : lives >= 2 ? 'A' : 'B';
  const secs = `${Math.floor(clock0 / 60)}:${String(Math.floor(clock0 % 60)).padStart(2, '0')}`;
  setTimeout(() => {
    if (state !== 'won' && state !== 'over') return;
    show(won ? `MISSION COMPLETE` : 'MISSION FAILED', `${diff().name} · Score ${total} · Time ${secs} · Accuracy ${acc}%${rank ? ' · Rank ' + rank : ''}`, net.active ? (net.host ? 'Play again' : 'Waiting for host') : won ? 'Play again' : 'Try again');
    $('go').disabled = net.active && !net.host;
    $('setup').hidden = false; $('lobby').hidden = !net.active; $('joinrow').hidden = net.active; if (net.active) net.refresh();
  }, won ? 1800 : 300);
}

function updateBullets(dt) {
  for (const b of bullets) {
    b.life -= dt; const p = b.m.position; p.x += b.vx * dt; p.y += b.vy * dt;
    const stop = () => { b.life = 0; if (b.rocket) blast(p.x, p.y, 2.8, 6, b.ghost); };
    if (b.life > 0 && blocks.some(o => p.x > o.x1 && p.x < o.x2 && p.y > o.y && p.y < o.top)) { burst(p.x, p.y, 5, 'hit', 4); stop(); }
    if (b.life > 0 && p.y < .02 && !gaps.some(g => p.x > g[0] && p.x < g[1])) { burst(p.x, .1, 3, 'hit', 3); stop(); }
    if (b.rocket && b.life > 0 && Math.random() < dt * 40) puff(p.x, p.y, 0, { color: 0x6a6260, alpha: .5, life: .5, size: .35, grow: 1.2 });
    if (b.enemy) {
      if (b.life > 0 && P.dead <= 0 && Math.abs(p.x - P.x) < (P.prone ? .8 : .36) && p.y > P.y + .05 && p.y < P.y + (P.prone ? .6 : 1.85)) { b.life = 0; hurt(Math.sign(b.vx) || -P.face); }
    } else if (b.life > 0) for (const e of enemies) {
      if (e.gone || b.pierce?.has(e) || Math.abs(e.x - camX) > Math.max(viewHalf, 12) + 3) continue;
      const low = e.type === 'drone' ? e.y - .5 : e.type === 'gunship' ? e.y - 1.1 : e.y - .1;
      if (Math.abs(p.x - e.x) < e.w && p.y > low && p.y < low + e.h + .2) {
        burst(p.x, p.y, 5, e.type === 'run' || e.type === 'gun' ? 'blood' : 'hit', 5);
        if (b.pierce) b.pierce.add(e); else b.life = 0;
        if (b.rocket) blast(p.x, p.y, 2.8, 6, b.ghost);
        else if (!b.ghost) { hits++; damage(e, b.dmg, Math.sign(b.vx) || 1); }
        if (!b.pierce) break;
      }
    }
  }
  bullets = bullets.filter(b => { if (b.life > 0) return true; scene.remove(b.m); return false; });
  enemies = enemies.filter(e => { if (!e.gone) return true; if (!e.kept) scene.remove(e.o); if (e === gunship) gunship = null; return false; });
}

// ---------- co-op ----------
function removeRemote(id) { const r = remotes.get(id); if (r) { scene.remove(r.o); remotes.delete(id); } }
const r2 = v => Math.round(v * 100) / 100;
const net = createCoop({
  level: () => level, setLevel, removeRemote,
  begin: () => begin(),
  myState: () => ({ x: r2(P.x), y: r2(P.y), vx: r2(P.vx), f: P.face, a: r2(P.aim), pr: P.prone ? 1 : 0, on: P.on ? 1 : 0, d: P.dead > 0 ? 1 : 0, out: P.out ? 1 : 0 }),
  snapshot: () => ({ e: enemies.filter(e => !e.gone).map(e => [e.id, e.type, r2(e.x), r2(e.y), e.face || 1, r2(e.hp), e.on === false ? 1 : 0]), s: score, gone: [...dead].slice(-24) }),
  remoteState(id, slot, m) {
    let r = remotes.get(id);
    if (!r) { r = { o: makeSoldierFor(slot), x: m.x, y: m.y, slot, pose: { face: m.f, on: true } }; remotes.set(id, r); }
    const was = r.dead; Object.assign(r, { tx: m.x, ty: m.y, vx: m.vx, prone: !!m.pr, dead: !!m.d, out: !!m.out, last: time });
    Object.assign(r.pose, { face: m.f, aim: m.a, vx: m.vx, on: !!m.on, prone: !!m.pr });
    if (r.dead && !was) startDeath(r.o, true);
    if (!r.dead && was) { revive(r.o); r.x = m.x; r.y = m.y; }
  },
  world(m) {
    score = m.s;
    const live = new Set();
    for (const [id, type, x, y, face, hp, air] of m.e) {
      live.add(id); if (dead.has(id)) continue;
      let e = enemies.find(q => q.id === id);
      if (!e) {
        if (type === 'boss') { if (!boss) { makeBoss(); toast('WARNING: IRON BASTION'); } e = boss; }
        else { e = addEnemy(type, x, y, id); if (type === 'gunship') toast('GUNSHIP INBOUND'); }
      }
      Object.assign(e, { tx: x, ty: y, face, hp, air });
    }
    for (const e of enemies) if (!live.has(e.id)) { if (m.gone.includes(e.id) && !dead.has(e.id)) { dead.add(e.id); e.gone = true; deathFx(e, 1); } else e.gone = true; }
  },
  event(m, from) {
    if (m.t === 'sh') fireWeapon(m.w, m.x, m.y, m.a, true);
    else if (m.t === 'nd') throwNade(m.x, m.y, m.vx, m.vy, true);
    else if (state !== 'play') return;
    else if (m.t === 'ef') shoot(m.x, m.y, m.a, m.s, true);
    else if (m.t === 'hit' && net.host) { const e = enemies.find(q => q.id === m.id); if (e) damage(e, clamp(m.d, 0, 9), m.dir); }
    else if (m.t === 'k') { const e = enemies.find(q => q.id === m.id); if (e && !e.gone) { e.gone = true; dead.add(e.id); deathFx(e, m.dir); } }
  },
  finish: (won, s) => finish(won, s),
  disconnected: reason => toMenu(reason),
  lobby(c) {
    if (state === 'play') return;
    $('code').textContent = c.code;
    const n = c.peers.size + 1;
    $('lobbyinfo').textContent = !c.room.online ? 'Connecting to the relay…' : c.host ? `${n} of 4 players in the room. Share the code, then press Start.` : c.hostId ? `Joined. ${n} players. Waiting for the host to start…` : 'Looking for that room… check the code if this takes more than a few seconds.';
    $('players').replaceChildren(...[{ slot: c.slot, me: true }, ...c.peers.values()].filter(p => c.host || c.hostId).sort((a, b) => a.slot - b.slot).map(p => { const s = document.createElement('span'); s.style.color = COLORS[p.slot].css; s.textContent = `● P${p.slot + 1}${p.me ? ' (you)' : ''}`; return s; }));
    if (state === 'title') { $('go').disabled = !c.host || !c.room.online; $('go').textContent = c.host ? 'Start co-op mission' : 'Waiting for host'; }
  }
});
function toMenu(message) {
  state = 'title'; toastT = 0; $('levels').classList.remove('locked'); for (const id of [...remotes.keys()]) removeRemote(id);
  makeHero(0); reset(); P.x = 12; hero.position.set(P.x, 0, 0); pose(hero, P, .016);
  show('IRON JUNGLE', message || 'Choose your difficulty.', 'Start mission'); $('go').disabled = false; $('setup').hidden = false; $('lobby').hidden = true; $('joinrow').hidden = false; $('pause').textContent = 'Pause';
}
function enterRoom() { initAudio(); state = 'title'; $('joinrow').hidden = true; $('setup').hidden = false; $('lobby').hidden = false; $('levels').classList.toggle('locked', !net.host); net.room && $('menu').removeAttribute('hidden'); $('go').disabled = true; $('go').textContent = 'Connecting'; $('code').textContent = net.code; $('lobbyinfo').textContent = 'Connecting to the relay…'; $('players').replaceChildren(); }
$('create').onclick = () => { if (!ready) return; net.create(); enterRoom(); };
$('join').onclick = () => { const c = $('codein').value.toUpperCase().replace(/[^A-Z0-9]/g, ''); if (!ready) return; if (c.length !== 5) { $('codein').focus(); $('sub').textContent = 'Enter the 5-character room code.'; return; } net.join(c); enterRoom(); };
$('leave').onclick = () => { net.leave(); $('levels').classList.remove('locked'); toMenu(); };
$('copy').onclick = () => { const link = location.origin + location.pathname + '?room=' + net.code; navigator.clipboard?.writeText(link).then(() => $('copy').textContent = 'Copied', () => $('copy').textContent = link); };
function updateRemotes(dt) {
  for (const r of remotes.values()) {
    const k = Math.min(1, dt * 12); r.x += (r.tx - r.x) * k; r.y += (r.ty - r.y) * k; r.o.position.set(r.x, r.y, 0); r.o.visible = !r.out;
    if (r.dead) die(r.o, dt, r.y > -.1); else pose(r.o, r.pose, dt);
  }
  if (net.playing && net.host && state === 'play' && P.out && [...remotes.values()].every(r => r.out)) endMission(false);
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
  if (state === 'play') { clock0 += dt; comboT -= dt; updatePlayer(dt); updateEnemies(dt); updateBullets(dt); updateGrenades(dt); }
  updateRemotes(dt); net.tick(dt);
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
  if (state === 'play') {
    const focus = P.out ? leaderX() : P.x, locked = boss && focus > BOSSX - 18;
    const target = locked ? BOSSX - Math.max(0, viewHalf - 8) : focus + viewHalf * .28, next = camX + (target - camX) * Math.min(1, dt * (locked ? 2 : 6));
    camX = locked || net.playing ? next : Math.max(camX, next);
  }
  // the weather turns as the squad pushes deeper into the jungle
  const wanted = state === 'title' ? 0 : THREE.MathUtils.smoothstep(camX, 88, 132);
  storm += (wanted - storm) * Math.min(1, dt * 1.5);
  weather.update(dt, camX, storm, () => setTimeout(() => sfx('boom'), 350));
  music?.(state === 'play' && !muted, !!(boss || gunship));
  if (state === 'title') camX = 12 + Math.sin(time * .15) * 8;
  shake *= Math.exp(-dt * 6);
  const lookY = portrait ? .5 : clamp(P.out ? 0 : P.y * .45, 0, 3) + 3.2;
  camera.position.set(camX + (Math.random() - .5) * shake, lookY + 1.8 + (Math.random() - .5) * shake, dist);
  camera.lookAt(camX, lookY, 0);
  sky.position.copy(camera.position); water.position.y = -3.4 + Math.sin(time) * .06;
  sun.position.set(camX + 14, 16, 12); sun.target.position.set(camX, 0, 0);
  toastT -= dt; $('toast').style.opacity = clamp(toastT, 0, 1);
  $('score').textContent = String(score).padStart(6, '0');
  $('lives').textContent = '♥'.repeat(Math.max(0, lives));
  $('health').replaceChildren(...($('health').children.length === diff().hp ? $('health').children : Array.from({ length: diff().hp }, () => document.createElement('i'))));
  [...$('health').children].forEach((el, i) => el.classList.toggle('off', i >= P.hp));
  $('weapon').textContent = `${WEAPONS[P.weapon].name} · GRENADES ${P.nades}`;
  $('combo').textContent = state === 'play' && combo > 1 && comboT > 0 ? `COMBO ×${combo}` : '';
  const big = boss && boss.hp > 0 ? boss : gunship && !gunship.gone ? gunship : null;
  $('bossbar').hidden = !big; $('progress').hidden = !!big || state === 'title';
  if (big) $('bossfill').style.width = Math.max(0, big.hp / (big.max || 1) * 100) + '%';
  else { const dots = [{ x: P.x, slot: net.playing ? net.slot : 0 }, ...remotes.values()]; const box = $('progress'); while (box.children.length > dots.length) box.lastChild.remove(); dots.forEach((d, i) => { const el = box.children[i] || box.appendChild(document.createElement('i')); el.style.left = clamp(d.x / BOSSX * 100, 0, 100) + '%'; el.style.background = COLORS[d.slot].css; }); }
  if (boss && boss.flash > 0) { boss.flash -= dt; if (boss.flash <= 0) boss.core.material.color.set(0xff3a18).multiplyScalar(2.5); }
}
Promise.all([loadSoldier(manager), envReady]).then(() => {
  makeHero(); reset(); hero.position.set(P.x, P.y, 0); P.x = 12; hero.position.x = 12; pose(hero, P, .016);
  ready = true; $('go').textContent = 'Start mission'; $('go').disabled = false;
  const invite = new URLSearchParams(location.search).get('room');
  if (invite) { $('codein').value = invite.toUpperCase().slice(0, 5); $('sub').textContent = 'You were invited. Tap Join to enter the room.'; }
  renderer.setAnimationLoop(() => { clock.update(); const raw = clock.getDelta(); watchSpeed(raw); step(Math.min(raw, 1 / 30)); composer.render(); });
}).catch(err => { console.error(err); $('go').textContent = 'Could not load. Refresh to retry'; });
window.__game = { net, remotes, begin, damage, throwNade, get gunship() { return gunship; }, get score() { return score; }, setLevel, blocks, obstaclesNow, hurt, get ready() { return ready; }, start, step, keys, get P() { return P; }, get boss() { return boss; }, get state() { return state; }, get enemies() { return enemies; }, get lives() { return lives; }, set lives(v) { lives = v; }, render: () => composer.render(), halt: () => renderer.setAnimationLoop(null) };
