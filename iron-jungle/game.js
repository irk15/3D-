import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

const $ = id => document.getElementById(id);
let seed = 7;
const rnd = (a = 0, b = 1) => { seed = (seed * 16807) % 2147483647; return a + (seed / 2147483647) * (b - a); };
const clamp = THREE.MathUtils.clamp;
const END = 232, BOSSX = 220;

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x6b5566, 0.016);
const camera = new THREE.PerspectiveCamera(36, 1, 0.5, 600);

// sky
const sky = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), new THREE.ShaderMaterial({
  side: THREE.BackSide, fog: false, depthWrite: false,
  vertexShader: 'varying vec3 p;void main(){p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader: `varying vec3 p;void main(){vec3 d=normalize(p);float h=d.y;
  vec3 c=mix(vec3(.62,.22,.12),vec3(.17,.12,.24),smoothstep(-.02,.22,h));c=mix(c,vec3(.02,.04,.1),smoothstep(.2,.7,h));
  float s=max(dot(d,normalize(vec3(.35,.13,-1.))),0.);c+=vec3(1.,.55,.22)*(pow(s,900.)*4.+pow(s,18.)*.45);gl_FragColor=vec4(c,1.);}`
}));
scene.add(sky);

scene.add(new THREE.HemisphereLight(0x8fa6d8, 0x2a2014, 1.1));
const sun = new THREE.DirectionalLight(0xffb070, 3.2);
sun.castShadow = true; sun.shadow.mapSize.set(1536, 1536);
Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 20, bottom: -14, far: 90 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);
const rim = new THREE.DirectionalLight(0x5a8cff, 1.3); rim.position.set(-8, 6, -12); scene.add(rim);

function noiseTex(base, spread, size = 256, rep = 1) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'); g.fillStyle = base; g.fillRect(0, 0, size, size);
  for (let i = 0; i < 5000; i++) { const v = rnd() > .5 ? 255 : 0; g.fillStyle = `rgba(${v},${v},${v},${rnd(0, spread)})`; g.beginPath(); g.arc(rnd(0, size), rnd(0, size), rnd(.5, 5), 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, 1); t.colorSpace = THREE.SRGBColorSpace; return t;
}
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
const rockTex = noiseTex('#4a3d33', .22, 256, 6), mudTex = noiseTex('#3d4a24', .1, 256, 8);
const rockMat = std(0xffffff, .95, 0, { map: rockTex, bumpMap: rockTex, bumpScale: 3 });
const grassMat = std(0xffffff, .9, 0, { map: mudTex, bumpMap: mudTex, bumpScale: 2 });
function ground(x1, x2) {
  const w = x2 - x1, cx = (x1 + x2) / 2;
  mesh(box(w, 6, 7), rockMat, cx, -3.2, -.5);
  mesh(box(w + .2, .25, 7.2), grassMat, cx, -.12, -.5);
  for (let x = x1 + .5; x < x2 - .4; x += rnd(.5, 1.4)) { const r = mesh(new THREE.DodecahedronGeometry(rnd(.2, .55)), rockMat, x, rnd(-2.6, -.5), 2.95); r.rotation.set(rnd(0, 3), rnd(0, 3), 0); }
  solids.push({ x1, x2, y: 0, ground: true });
}
const gaps = [[48, 51.2], [96, 99.4], [152, 155.6]];
ground(-20, 48); ground(51.2, 96); ground(99.4, 152); ground(155.6, END + 30);
const steel = std(0x55595c, .45, .75), rust = std(0x7a4526, .7, .5);
function platform(x, y, w) {
  mesh(box(w, .28, 2.4), steel, x, y - .14, 0);
  mesh(box(w, .07, .08), rust, x, y - .02, 1.22);
  for (const s of [-1, 1]) mesh(cyl(.09, .12, y, 8), rust, x + s * (w / 2 - .3), y / 2, -.9);
  solids.push({ x1: x - w / 2, x2: x + w / 2, y });
}
[[18, 2.6, 6], [34, 2.8, 5], [41, 5, 4], [62, 2.6, 7], [78, 2.8, 5], [85, 5.2, 5], [110, 2.7, 6], [120, 5, 6], [136, 2.7, 8], [165, 2.8, 5], [173, 5.1, 5], [190, 2.7, 6]].forEach(p => platform(...p));

// water in pits
const water = mesh(new THREE.PlaneGeometry(END + 80, 14), std(0x14323a, .12, .6), END / 2, -3.4, 0, scene, false);
water.rotation.x = -Math.PI / 2;

// foliage (instanced)
function leafGeo() {
  const g = new THREE.PlaneGeometry(.55, 2.6, 2, 8); g.translate(0, 1.3, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const t = p.getY(i) / 2.6; p.setX(i, p.getX(i) * Math.sin(Math.PI * Math.min(.96, t * .9 + .08))); p.setZ(i, t * t * 1.2); p.setY(i, p.getY(i) - t * t * t * .8); }
  g.computeVertexNormals(); return g;
}
const leaf = leafGeo(), dummy = new THREE.Object3D(), col = new THREE.Color();
const wind = { value: 0 };
function leafMat() {
  const m = std(0xffffff, .65, 0, { side: THREE.DoubleSide });
  m.onBeforeCompile = s => { s.uniforms.t = wind; s.vertexShader = 'uniform float t;\n' + s.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed.x+=sin(t*1.4+instanceMatrix[3].x)*.06*position.y*position.y;'); };
  return m;
}
function fronds(list) {
  const im = new THREE.InstancedMesh(leaf, leafMat(), list.length);
  list.forEach((l, i) => { dummy.position.set(l[0], l[1], l[2]); dummy.rotation.set(l[4], l[5], l[6], 'YXZ'); dummy.scale.setScalar(l[3]); dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix); im.setColorAt(i, col.setHSL(rnd(.23, .34), rnd(.4, .65), rnd(.07, .19))); });
  im.receiveShadow = true; scene.add(im); return im;
}
const bush = [], crown = [];
for (let x = -20; x < END + 30; x += .55) {
  if (gaps.some(g => x > g[0] - .6 && x < g[1] + .6)) continue;
  const z = rnd(-3.8, -2.2);
  for (let i = 0; i < 4; i++) bush.push([x, 0, z, rnd(.3, .75), rnd(.2, 1), rnd(0, 6.3), rnd(-.4, .4)]);
}
fronds(bush);
const bark = std(0x35261b, 1);
for (let x = -24; x < END + 40; x += rnd(1.8, 3.8)) {
  const z = rnd(-22, -6), h = rnd(5, 11);
  const t = mesh(cyl(.14, .32, h + 3, 7), bark, x, h / 2 - 1.5, z, scene, false); t.rotation.z = rnd(-.09, .09);
  const tx = x - Math.sin(t.rotation.z) * h / 2;
  for (let i = 0; i < 11; i++) crown.push([tx, h, z, rnd(.9, 1.7), rnd(.9, 1.6), i * .58 + rnd(0, .4), 0]);
  for (let i = 0; i < 5; i++) crown.push([x + rnd(-1.5, 1.5), -.4, z + rnd(-1, 1), rnd(.8, 1.5), rnd(.2, .9), rnd(0, 6.3), 0]);
}
fronds(crown);
mesh(box(END + 100, 1, 30), std(0x101a0c, 1), END / 2, -4.2, -19, scene, false);
for (let layer = 0; layer < 3; layer++) {
  const s = new THREE.Shape(); s.moveTo(-120, -20);
  for (let x = -120; x <= END + 140; x += 7) s.lineTo(x, rnd(5, 13) + layer * 7);
  s.lineTo(END + 140, -20);
  mesh(new THREE.ShapeGeometry(s), new THREE.MeshBasicMaterial({ color: [0x1b1f24, 0x2b2733, 0x43303c][layer] }), 0, 0, -34 - layer * 28, scene, false);
}
// props
const crateMat = std(0x56603a, .7, .2);
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

// ---------- characters ----------
function soldier(p) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const skin = std(p.skin, .6), cloth = std(p.cloth, .85), vest = std(p.vest, .6, .25), dark = std(0x14161a, .55, .5);
  const hips = new THREE.Group(); hips.position.y = .95; body.add(hips);
  mesh(box(.42, .22, .34), dark, 0, 0, 0, hips);
  const legs = [-.15, .15].map(z => {
    const thigh = new THREE.Group(); thigh.position.set(0, -.03, z); hips.add(thigh);
    mesh(cap(.13, .28), cloth, 0, -.23, 0, thigh);
    const shin = new THREE.Group(); shin.position.y = -.46; thigh.add(shin);
    mesh(cap(.105, .28), cloth, 0, -.2, 0, shin);
    mesh(box(.34, .15, .2), dark, .07, -.42, 0, shin);
    return { thigh, shin };
  });
  const torso = new THREE.Group(); torso.position.y = .08; hips.add(torso);
  const chest = mesh(cap(.25, .32), cloth, 0, .32, 0, torso); chest.scale.set(.9, 1, 1.15);
  mesh(box(.42, .42, .54), vest, .03, .36, 0, torso);
  for (const z of [-.16, 0, .16]) mesh(box(.1, .15, .12), dark, .27, .2, z, torso);
  mesh(box(.24, .4, .36), dark, -.3, .38, 0, torso);
  const head = new THREE.Group(); head.position.y = .86; torso.add(head);
  mesh(ball(.18), skin, 0, 0, 0, head);
  if (p.hero) {
    mesh(ball(.19), std(0x1b100b, 1), -.03, .05, 0, head).scale.set(1, .85, 1);
    mesh(cyl(.192, .192, .07, 16), std(p.band, .7), -.005, .07, 0, head);
    const tail = mesh(box(.32, .05, .03), std(p.band, .7), -.32, .05, .05, head); root.userData.tail = tail;
  } else {
    mesh(new THREE.SphereGeometry(.215, 16, 10, 0, 6.3, 0, 1.75), vest, 0, .02, 0, head);
    mesh(box(.05, .05, .26), glow(0xff2a18, 3), .175, .005, 0, head, false);
  }
  const arms = new THREE.Group(); arms.position.set(.02, .52, 0); torso.add(arms);
  for (const z of [-.34, .3]) {
    const up = mesh(cap(.095, .22), p.hero ? skin : cloth, .13, -.1, z, arms); up.rotation.z = .9;
    const fore = mesh(cap(.075, .26), skin, .42, -.13, z * .55, arms); fore.rotation.z = Math.PI / 2; fore.rotation.y = z * .5;
  }
  const gun = new THREE.Group(); gun.position.set(.5, -.08, .1); arms.add(gun);
  mesh(box(.62, .15, .11), dark, 0, 0, 0, gun);
  mesh(cyl(.035, .035, .46, 8), steel, .5, .02, 0, gun).rotation.z = Math.PI / 2;
  mesh(box(.1, .24, .08), dark, .06, -.17, 0, gun).rotation.z = .25;
  mesh(box(.28, .13, .09), dark, -.4, -.05, 0, gun);
  const flash = mesh(new THREE.OctahedronGeometry(.17), glow(0xffc860, 5), .86, .02, 0, gun, false); flash.scale.set(2, .8, .8); flash.visible = false;
  Object.assign(root.userData, { body, hips, legs, torso, arms, flash });
  root.scale.setScalar(p.scale || 1.12);
  return root;
}
function pose(o, e, dt) {
  const u = o.userData;
  e.face = e.face || 1;
  const targetY = e.face > 0 ? 0 : Math.PI;
  o.rotation.y += (targetY - o.rotation.y) * Math.min(1, dt * 16);
  const run = Math.abs(e.vx) > .5 && e.on;
  e.phase = (e.phase || 0) + dt * (run ? 12 : 2);
  u.legs.forEach((l, i) => {
    const a = e.phase + i * Math.PI;
    let th = run ? Math.sin(a) * .85 : (i ? .12 : -.12), sh = run ? -Math.max(0, Math.cos(a)) * 1.3 - .1 : -.08;
    if (!e.on) { th = i ? 1.0 : -.15; sh = i ? -1.5 : -.8; }
    if (e.prone) { th = -1.5 + (i ? .1 : -.1); sh = 0; }
    l.thigh.rotation.z += (th - l.thigh.rotation.z) * Math.min(1, dt * 20);
    l.shin.rotation.z += (sh - l.shin.rotation.z) * Math.min(1, dt * 20);
  });
  u.hips.position.y = e.prone ? .24 : .95 + (run ? Math.abs(Math.cos(e.phase)) * .08 : Math.sin(e.phase) * .012);
  u.torso.rotation.z = e.prone ? -1.35 : run ? -.18 : -.04;
  u.arms.rotation.z = (e.aim || 0) - u.torso.rotation.z;
  if (u.tail) { u.tail.rotation.z = Math.sin(e.phase * 1.7) * .25 + (run ? .1 : -.7); }
}

// ---------- fx ----------
const fx = [], sparkGeo = new THREE.BoxGeometry(.09, .09, .09);
const sparkMats = { fire: glow(0xff8a20, 4), hit: glow(0xffe2a0, 3), blood: glow(0x9a1010, 1), smoke: new THREE.MeshBasicMaterial({ color: 0x1c1816, transparent: true, opacity: .45 }) };
function burst(x, y, n, kind, power = 6, size = 1) {
  for (let i = 0; i < n; i++) {
    const m = mesh(sparkGeo, sparkMats[kind], x, y, rnd(-.3, .5), scene, false);
    const a = rnd(0, 6.3), s = rnd(.2, 1) * power;
    fx.push({ m, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: rnd(-2, 2), life: rnd(.2, .7), max: .7, s: size * rnd(.5, 1.6), g: kind === 'smoke' ? -3 : 14 });
  }
}
const boomLight = new THREE.PointLight(0xff8830, 0, 16, 1.8); scene.add(boomLight);
const muzzle = new THREE.PointLight(0xffc070, 0, 8, 2); scene.add(muzzle);
let shake = 0;
function explode(x, y, big = 1) {
  burst(x, y, 26 * big, 'fire', 9 * big, 2 * big); burst(x, y, 10 * big, 'smoke', 3, 4 * big);
  boomLight.position.set(x, y, 1.5); boomLight.intensity = 90 * big; shake = Math.max(shake, .25 * big); sfx('boom');
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
const hero = soldier({ skin: 0xc98a5e, cloth: 0x2b5f8a, vest: 0x2c3a46, band: 0xff2a1e, hero: true }); scene.add(hero);
const heroLight = new THREE.PointLight(0xbfd8ff, 7, 5, 2); heroLight.position.set(0, 1.8, 1.8); hero.add(heroLight);
let P, enemies = [], bullets = [], pickups = [], score = 0, lives, state = 'title', camX = 0, boss, checkpoint = 2, time = 0;
const bGeo = cap(.07, .42); bGeo.rotateZ(Math.PI / 2);
const bMat = glow(0xffd070, 4), bSpread = glow(0xff6030, 4), eMat = glow(0xff2858, 4), eGeo = ball(.15);
function shoot(x, y, a, speed, enemy, mat) {
  const m = mesh(enemy ? eGeo : bGeo, mat || (enemy ? eMat : bMat), x, y, 0, scene, false); m.rotation.z = a;
  bullets.push({ m, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, enemy, life: enemy ? 3.2 : 1.1 });
}
function addEnemy(type, x, y = 0) {
  let o, e = { type, x, y, vx: 0, vy: 0, on: true, cd: rnd(.6, 1.8), flash: 0 };
  if (type === 'run' || type === 'gun') {
    o = soldier({ skin: 0x9a6a4c, cloth: 0x4a4436, vest: 0x2e3326, scale: 1.1 }); e.hp = type === 'gun' ? 3 : 1; e.face = -1; o.rotation.y = Math.PI; e.h = 1.8; e.w = .45;
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
  [...enemies, ...pickups].forEach(e => scene.remove(e.o)); bullets.forEach(b => scene.remove(b.m));
  enemies = []; bullets = []; pickups = []; boss = null; score = 0; lives = 5; checkpoint = 2; camX = 2; time = 0;
  P = { x: 2, y: 0, vx: 0, vy: 0, on: true, face: 1, aim: 0, cd: 0, inv: 2, spread: false, dead: 0, drop: 0 };
  hero.rotation.y = 0; hero.visible = true;
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
function hurt() {
  if (P.inv > 0 || P.dead > 0) return;
  P.dead = 1.3; lives--; P.spread = false; hero.visible = false; explode(P.x, P.y + 1, .7); burst(P.x, P.y + 1, 20, 'blood', 6); sfx('hurt');
}
function respawn() {
  if (lives <= 0) { state = 'over'; show('MISSION FAILED', `Score ${score}`, 'Try again'); return; }
  let x = Math.max(checkpoint, camX - Math.min(4, viewHalf - 1.5));
  for (const g of gaps) if (x > g[0] - 4 && x < g[1] + 1.5) x = g[0] - 4;
  camX = Math.min(camX, x + viewHalf - 1.5);
  Object.assign(P, { x, y: 2.5, vx: 0, vy: 0, inv: 2.5, dead: 0 }); hero.visible = true;
  bullets.filter(b => b.enemy).forEach(b => b.life = 0);
}
function updatePlayer(dt) {
  if (P.dead > 0) { P.dead -= dt; if (P.dead <= 0) respawn(); return; }
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
  if (P.y < -3) { P.inv = 0; hurt(); }
  if (P.on && P.ground && !gaps.some(g => P.x > g[0] - 2 && P.x < g[1] + 2)) checkpoint = Math.max(checkpoint, P.x - 3);
  P.cd -= dt; P.inv -= dt;
  hero.userData.flash.visible = false;
  if (down('f') && P.cd <= 0) {
    P.cd = P.spread ? .17 : .12;
    const a = P.face > 0 ? P.aim : Math.PI - P.aim;
    const sx = P.x + Math.cos(a) * 1.1, sy = P.y + (P.prone ? .55 : 1.55) + Math.sin(a) * 1.1;
    for (const off of P.spread ? [-.28, -.14, 0, .14, .28] : [0]) shoot(sx, sy, a + off, 26, false, P.spread ? bSpread : bMat);
    muzzle.position.set(sx, sy, .8); muzzle.intensity = 18; P.flashT = .05; sfx('shot');
    burst(sx, sy, 2, 'hit', 3, .6);
  }
  P.flashT -= dt; hero.userData.flash.visible = P.flashT > 0;
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
    if (alive && Math.abs(dx) < e.w + .25 && Math.abs(P.y + (P.prone ? .3 : .9) - cy) < e.h / 2 + (P.prone ? .2 : .6)) hurt();
    if (e.y < -5 || (e.type !== 'boss' && e.x < camX - viewHalf - 8)) e.gone = true;
  }
}
function updateBullets(dt) {
  for (const b of bullets) {
    b.life -= dt; const p = b.m.position; p.x += b.vx * dt; p.y += b.vy * dt;
    if (p.y < .02 && !gaps.some(g => p.x > g[0] && p.x < g[1])) { b.life = 0; burst(p.x, .1, 3, 'hit', 3); }
    if (b.enemy) {
      if (b.life > 0 && P.dead <= 0 && Math.abs(p.x - P.x) < (P.prone ? .8 : .36) && p.y > P.y + .05 && p.y < P.y + (P.prone ? .6 : 1.85)) { b.life = 0; hurt(); }
    } else if (b.life > 0) for (const e of enemies) {
      if (e.gone || Math.abs(e.x - camX) > viewHalf + 2) continue;
      const low = e.type === 'drone' ? e.y - .5 : e.y - .1;
      if (Math.abs(p.x - e.x) < e.w && p.y > low && p.y < low + e.h + .2) {
        b.life = 0; e.hp--; burst(p.x, p.y, 5, e.type === 'run' || e.type === 'gun' ? 'blood' : 'hit', 5);
        if (e.type === 'boss') { e.core.material.color.setRGB(5, 4, 3); e.flash = .05; }
        if (e.hp <= 0) {
          e.gone = true; score += { run: 100, gun: 200, drone: 250, turret: 400, boss: 5000 }[e.type];
          if (e.type === 'boss') { for (let i = 0; i < 6; i++) explode(e.x + rnd(-1, 3), rnd(1, 7), 1.5); bullets.forEach(q => q.life = 0); state = 'won'; setTimeout(() => state === 'won' && show('MISSION COMPLETE', `Score ${score + lives * 1000}`, 'Play again'), 1800); }
          else explode(e.x, e.type === 'drone' ? e.y : e.y + 1, e.type === 'turret' ? 1 : .6);
        }
        break;
      }
    }
  }
  bullets = bullets.filter(b => { if (b.life > 0) return true; scene.remove(b.m); return false; });
  enemies = enemies.filter(e => { if (!e.gone) return true; scene.remove(e.o); return false; });
}

// ---------- loop ----------
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), .7, .5, .9); composer.addPass(bloom);
composer.addPass(new OutputPass());
let viewHalf = 12, dist = 20, portrait = false;
function resize() {
  const w = innerWidth, h = innerHeight; if (!w || !h) return;
  portrait = h > w; renderer.setSize(w, h); composer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
  const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  dist = Math.max(19, (portrait ? 7.5 : 11) / (t * camera.aspect));
  viewHalf = dist * t * camera.aspect;
}
addEventListener('resize', resize); resize();
reset();
const clock = new THREE.Clock();
function step(dt) {
  if (state === 'pause') return;
  time += dt; wind.value = time;
  if (state === 'play') { updatePlayer(dt); updateEnemies(dt); updateBullets(dt); }
  for (const p of pickups) if (!p.got) { p.o.position.y = p.y + Math.sin(time * 3) * .2; p.o.rotation.y += dt * 2; p.r.rotation.x += dt; }
  for (const f of fx) { f.life -= dt; f.vy -= f.g * dt; f.m.position.x += f.vx * dt; f.m.position.y += f.vy * dt; f.m.position.z += f.vz * dt; f.m.scale.setScalar(Math.max(.01, f.s * Math.min(1, f.life / .3))); f.m.rotation.x += dt * 8; if (f.life <= 0) scene.remove(f.m); }
  for (let i = fx.length - 1; i >= 0; i--) if (fx[i].life <= 0) fx.splice(i, 1);
  boomLight.intensity *= Math.exp(-dt * 7); muzzle.intensity *= Math.exp(-dt * 22);
  flames.forEach((f, i) => f.scale.set(1, 1.3 + Math.sin(time * 17 + i * 3) * .3, 1));
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
renderer.setAnimationLoop(() => { step(Math.min(clock.getDelta(), 1 / 30)); composer.render(); });
window.__game = { start, step, keys, get P() { return P; }, get boss() { return boss; }, get state() { return state; }, get enemies() { return enemies; }, get lives() { return lives; }, set lives(v) { lives = v; }, render: () => composer.render(), halt: () => renderer.setAnimationLoop(null) };
