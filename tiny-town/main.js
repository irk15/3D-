import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const $ = id => document.getElementById(id);
const IS_MOBILE = matchMedia('(pointer:coarse)').matches || innerWidth < 700;
const TAU = Math.PI * 2;

/* ---------- renderer ---------- */
const canvas = $('gl');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
} catch (e) { $('nogl').hidden = false; $('loader').remove(); throw e; }
renderer.setPixelRatio(Math.min(devicePixelRatio, IS_MOBILE ? 1.75 : 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.VSMShadowMap;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.0;

const scene = new THREE.Scene();
const SKY = new THREE.Color(0xcfe3e6);
scene.background = SKY;
scene.fog = new THREE.Fog(0xcfe3e6, 230, 520);
const pm = new THREE.PMREMGenerator(renderer);
scene.environment = pm.fromScene(new RoomEnvironment(), .04).texture;
scene.environmentIntensity = .35;

const camera = new THREE.PerspectiveCamera(24, 1, 1, 600);

/* ---------- lights ---------- */
const hemi = new THREE.HemisphereLight(0xeaf6ff, 0xb9c9a0, 1.0);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1dc, 3.1);
sun.position.set(-34, 62, 40);
sun.castShadow = true;
const SM = IS_MOBILE ? 2048 : 4096;
sun.shadow.mapSize.set(SM, SM);
Object.assign(sun.shadow.camera, { left: -78, right: 78, top: 78, bottom: -78, near: 10, far: 200 });
sun.shadow.bias = -.0006; sun.shadow.normalBias = .05; sun.shadow.radius = 5; sun.shadow.blurSamples = 16;
scene.add(sun, sun.target);

/* ---------- helpers ---------- */
function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const rnd = mulberry32(20261027);
const R = (a, b) => a + (b - a) * rnd();
const pick = a => a[Math.floor(rnd() * a.length)];
const world = new THREE.Group(); scene.add(world);
const dynamic = [];

const matCache = new Map();
function M(hex, rough = .82, metal = 0, extra = {}) {
  const k = hex + '|' + rough + '|' + metal + '|' + JSON.stringify(extra);
  if (!matCache.has(k)) matCache.set(k, new THREE.MeshStandardMaterial({ color: hex, roughness: rough, metalness: metal, ...extra }));
  return matCache.get(k);
}
const glass = () => M(0x35566e, .25, .1);
function shade(m, cast = true, rec = true) { m.castShadow = cast; m.receiveShadow = rec; return m; }
function add(m, parent = world) { parent.add(m); return m; }
function box(w, h, d, hex, x, y, z, r = .08, parent = world, rough = .82) {
  const g = r > 0 ? new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2 - .001, h / 2 - .001, d / 2 - .001)) : new THREE.BoxGeometry(w, h, d);
  const m = shade(new THREE.Mesh(g, typeof hex === 'number' ? M(hex, rough) : hex));
  m.position.set(x, y, z); parent.add(m); return m;
}
function cyl(rt, rb, h, hex, x, y, z, seg = 24, parent = world, rough = .8) {
  const m = shade(new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), typeof hex === 'number' ? M(hex, rough) : hex));
  m.position.set(x, y, z); parent.add(m); return m;
}
function sph(r, hex, x, y, z, parent = world, rough = .8) {
  const m = shade(new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), typeof hex === 'number' ? M(hex, rough) : hex));
  m.position.set(x, y, z); parent.add(m); return m;
}

function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  return t;
}
const stripeCache = {};
function stripeMat(c1, c2) {
  const k = c1 + c2;
  if (!stripeCache[k]) {
    const t = canvasTex(256, 32, (g, w, h) => { const n = 8; for (let i = 0; i < n; i++) { g.fillStyle = i % 2 ? c2 : c1; g.fillRect(i * w / n, 0, w / n + 1, h); } });
    stripeCache[k] = new THREE.MeshStandardMaterial({ map: t, roughness: .8 });
  }
  return stripeCache[k];
}
function signMat(text, bg, fg, font = '800 40px Inter, system-ui, sans-serif') {
  const t = canvasTex(512, 128, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.fillStyle = fg; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2 + 2);
  });
  return new THREE.MeshStandardMaterial({ map: t, roughness: .6 });
}

/* ---------- global layout ---------- */
const P = 16, BS = 12, SW = .14, HALF = BS / 2;
const bx = i => (i - 2) * P, bz = j => (j - 2.5) * P;           // block centres
const roadX = k => (k - 1.5) * P, roadZ = k => (k - 2) * P;     // road centre lines
const COLS = 5, ROWS = 5;

/* ground + asphalt */
{
  const g = new THREE.Mesh(new THREE.PlaneGeometry(520, 520), M(0x8d9093, .95));
  g.rotation.x = -Math.PI / 2; g.receiveShadow = true; world.add(g);
}

/* trees & windows collected, instanced at the end */
const roundTrees = [], coneTrees = [], wins = [];
const PAL_ROUND = [0x8fb83a, 0xa0c24a, 0x7fae33, 0xaccb55, 0x74a52f];
const PAL_CONE = [0x1d7043, 0x257f47, 0x17653b, 0x2b8a4f, 0x155d37];
function tree(x, z, kind = 'round', s = 1, y0 = SW) {
  const o = { x, y: y0, z, s, c: new THREE.Color(kind === 'round' ? pick(PAL_ROUND) : pick(PAL_CONE)) };
  (kind === 'round' ? roundTrees : coneTrees).push(o);
}

/* ---------- building blocks ---------- */
const WALL = [0xf6f4ef, 0xefece5, 0xe9e0cf, 0xf1efea, 0xe4e6e8];
const PASTEL = [0xe8a86d, 0x6aa7c8, 0xd77a7a, 0x7bbf9a];
function addWindows(cx, cz, w, d, h, y0, skipGround, faces = [1, 1, 1, 1]) {
  const floors = Math.max(1, Math.floor(h / 1.7)), fh = h / floors;
  const F = [{ nx: 0, nz: 1 }, { nx: 0, nz: -1 }, { nx: 1, nz: 0 }, { nx: -1, nz: 0 }];
  F.forEach((f, fi) => {
    if (!faces[fi]) return;
    const span = f.nx ? d : w, cols = Math.max(1, Math.floor((span - .7) / 1.3)), gap = span / cols;
    for (let c = 0; c < cols; c++) {
      const off = -span / 2 + gap * (c + .5);
      for (let fl = skipGround ? 1 : 0; fl < floors; fl++) {
        const y = y0 + fl * fh + fh * .52;
        if (f.nz) wins.push({ x: cx + off, y, z: cz + f.nz * (d / 2 + .02), ry: f.nz > 0 ? 0 : Math.PI });
        else wins.push({ x: cx + f.nx * (w / 2 + .02), y, z: cz + off, ry: f.nx > 0 ? Math.PI / 2 : -Math.PI / 2 });
      }
    }
  });
  return floors;
}
function awning(x, y, z, w, c1, c2) {
  const g = new THREE.Group(); g.position.set(x, y, z);
  const top = shade(new THREE.Mesh(new RoundedBoxGeometry(w, .12, 1.25, 2, .05), stripeMat(c1, c2)));
  top.position.set(0, 0, .6); top.rotation.x = .32; g.add(top);
  const val = shade(new THREE.Mesh(new RoundedBoxGeometry(w, .22, .08, 2, .03), stripeMat(c1, c2)));
  val.position.set(0, -.2, 1.17); g.add(val);
  world.add(g); return g;
}
function storefront(cx, cz, w, d, y0) {
  box(w * .78, 1.45, .1, glass(), cx, y0 + .85, cz + d / 2 + .04, .04);
  box(.7, 1.3, .12, 0xf3f3f0, cx + w * .26, y0 + .78, cz + d / 2 + .06, .04);
}
function rooftopClutter(cx, cz, w, d, y) {
  const n = Math.floor(R(0, 3));
  for (let i = 0; i < n; i++) {
    const x = cx + R(-w / 2 + .9, w / 2 - .9), z = cz + R(-d / 2 + .9, d / 2 - .9);
    const t = rnd();
    if (t < .5) { box(.95, .55, .75, 0xdcdedf, x, y + .28, z, .05); cyl(.26, .26, .06, 0x8a8f94, x, y + .58, z, 14); }
    else if (t < .8) { cyl(.45, .45, .8, 0xcfd2d4, x, y + .4, z, 18); }
    else { box(1.2, .7, 1.0, 0xe4e1d8, x, y + .35, z, .06); }
  }
}
function building(cx, cz, w, d, h, o = {}) {
  const y0 = SW;
  const col = o.wall ?? pick(WALL);
  box(w, h, d, col, cx, y0 + h / 2, cz, .14);
  box(w + .3, .22, d + .3, o.cap ?? 0xfbfbf9, cx, y0 + h + .11, cz, .06);
  if (!o.noTop) rooftopClutter(cx, cz, w, d, y0 + h + .22);
  addWindows(cx, cz, w, d, h, y0, !!o.shop, [1, 1, 1, 1]);
  if (o.shop) {
    storefront(cx, cz, w, d, y0);
    const [c1, c2] = o.stripes ?? pick([['#f2c230', '#fff'], ['#2fa36b', '#fff'], ['#8a4fd6', '#fff'], ['#e65a4f', '#fff']]);
    awning(cx, y0 + 2.05, cz + d / 2 + .02, w * .86, c1, c2);
  }
  if (o.sign) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w * .8, w * .8 * .25), o.sign);
    m.position.set(cx, y0 + h - .55, cz + d / 2 + .04); world.add(m);
  }
  return { x: cx, z: cz, w, d, h };
}
function house(cx, cz, w, d, h) {
  const y0 = SW, col = pick([0xf6f4ef, 0xefece5, 0xf3ede2]);
  box(w, h, d, col, cx, y0 + h / 2, cz, .12);
  const sh = new THREE.Shape(); const rw = w / 2 + .25;
  sh.moveTo(-rw, 0); sh.lineTo(rw, 0); sh.lineTo(0, 1.5); sh.closePath();
  const eg = new THREE.ExtrudeGeometry(sh, { depth: d + .5, bevelEnabled: true, bevelSize: .06, bevelThickness: .06, bevelSegments: 2 });
  const roof = shade(new THREE.Mesh(eg, M(0x8a9097, .8)));
  roof.position.set(cx, y0 + h, cz - d / 2 - .25); world.add(roof);
  box(.5, 1.0, .5, 0xb9a98f, cx + w * .25, y0 + h + 1.1, cz - d * .15, .05);
  addWindows(cx, cz, w, d, h, y0, false);
  box(.62, 1.2, .1, 0x2f8f6b, cx - w * .25, y0 + .7, cz + d / 2 + .05, .04);
  box(w * .6, .7, .1, 0x7dc1c9, cx + w * .12, y0 + h * .35, cz + d / 2 + .06, .05, world, .3);
}
function kiosk(cx, cz, w, d, h) {
  const y0 = SW;
  box(w, h, d, 0xd9c8a2, cx, y0 + h / 2, cz, .1);
  box(w + .25, .2, d + .25, 0xf4efe2, cx, y0 + h + .1, cz, .05);
  box(.7, .9, .08, 0xf2c94c, cx + .2, y0 + h * .55, cz + d / 2 + .04, .04, world, .35);
  box(.9, .5, .7, 0xe0dfda, cx - w * .2, y0 + h + .45, cz, .05);
}
function heroBuilding(cx, cz) {
  const w = 5.2, d = 5.0, h = 8.4, y0 = SW;
  building(cx, cz, w, d, h, { wall: 0xfbfaf7, shop: true, stripes: ['#8a4fd6', '#ffffff'], noTop: true });
  // purple "target" roof logo
  const g = new THREE.Group(); g.position.set(cx - .2, y0 + h + .5, cz + .3); g.rotation.x = -.35;
  const ring = (r, hex, y) => { const m = shade(new THREE.Mesh(new THREE.CylinderGeometry(r, r, .12, 40), M(hex, .35))); m.position.y = y; g.add(m); };
  ring(1.5, 0x7b3fc4, 0); ring(1.1, 0xffffff, .04); ring(.78, 0x7b3fc4, .08); ring(.42, 0xffffff, .12);
  world.add(g);
  const leg = box(.1, .5, .1, 0x9a9aa0, cx - .2, y0 + h + .35, cz + .3, .02);
  // small purple disc over the entrance
  const s = shade(new THREE.Mesh(new THREE.CylinderGeometry(.55, .55, .1, 32), M(0x7b3fc4, .35)));
  s.position.set(cx + 1.6, y0 + 2.9, cz + d / 2 + .5); s.rotation.x = Math.PI / 2 - .2; world.add(s);
  const s2 = shade(new THREE.Mesh(new THREE.CylinderGeometry(.3, .3, .12, 32), M(0xffffff, .35)));
  s2.position.copy(s.position); s2.position.z += .02; s2.rotation.copy(s.rotation); world.add(s2);
}

/* ---------- block builders ---------- */
function sidewalk(cx, cz, hex = 0xd6d6d3) {
  const m = shade(new THREE.Mesh(new RoundedBoxGeometry(BS, SW * 2, BS, 3, .12), M(hex, .9)), false, true);
  m.position.set(cx, 0, cz); world.add(m);
}
function lamp(x, z) {
  cyl(.05, .06, 2.6, 0x5c6168, x, SW + 1.3, z, 8);
  sph(.2, 0xfffdf0, x, SW + 2.7, z, world, .4);
}
function trafficLight(x, z, ry) {
  const g = new THREE.Group(); g.position.set(x, SW, z); g.rotation.y = ry; world.add(g);
  cyl(.05, .05, 2.4, 0x3f4349, 0, 1.2, 0, 8, g);
  box(.3, .75, .22, 0x2c2f34, 0, 2.5, .15, .06, g);
  [[0xff4a3d, .22], [0xffc63d, 0], [0x3dd17a, -.22]].forEach(([c, y], i) => {
    const l = new THREE.Mesh(new THREE.SphereGeometry(.07, 10, 8), new THREE.MeshBasicMaterial({ color: c })); l.position.set(0, 2.5 + y, .27); g.add(l);
  });
}

const PEOPLE_COL = [0xe0594f, 0x3f8fd2, 0xf2b630, 0x4aa86a, 0xb07be0, 0xf08a3e, 0x2e3a4a, 0xf4f1ea];
const SKIN = [0xf0c8a0, 0xd9a276, 0x9c6a48, 0xf5d5b8];
function makePerson(sc = 1) {
  const g = new THREE.Group();
  const col = pick(PEOPLE_COL);
  const body = shade(new THREE.Mesh(new THREE.CapsuleGeometry(.13, .28, 4, 10), M(col, .8))); body.position.y = .5; g.add(body);
  const head = shade(new THREE.Mesh(new THREE.SphereGeometry(.12, 14, 10), M(pick(SKIN), .7))); head.position.y = .86; g.add(head);
  if (rnd() < .5) { const hair = shade(new THREE.Mesh(new THREE.SphereGeometry(.125, 12, 8, 0, TAU, 0, 1.2), M(pick([0x2a2220, 0x6b4426, 0xd9b36a, 0x1a1a1a]), .8))); hair.position.y = .88; g.add(hair); }
  const legs = [-1, 1].map(s => { const l = shade(new THREE.Mesh(new THREE.CylinderGeometry(.045, .045, .3, 6), M(0x3d4350, .8))); l.position.set(s * .06, .15, 0); l.geometry.translate(0, -.0, 0); g.add(l); return l; });
  g.scale.setScalar(sc); g.userData.legs = legs; return g;
}
function person(x, y, z, sc = .95) { const p = makePerson(sc); p.position.set(x, y, z); p.rotation.y = R(0, TAU); world.add(p); return p; }

/* city block */
function cityBlock(i, j, hero) {
  const cx = bx(i), cz = bz(j);
  sidewalk(cx, cz);
  const slots = [[-2.9, -2.9], [2.9, -2.9], [-2.9, 2.9], [2.9, 2.9]];
  slots.forEach(([ox, oz], si) => {
    const x = cx + ox + R(-.15, .15), z = cz + oz + R(-.15, .15);
    const front = oz > 0;
    if (hero && si === 0) { heroBuilding(x + .1, z + .1); return; }
    const t = rnd(); const w = R(3.9, 4.7), d = R(3.9, 4.7);
    if (!front) {
      if (t < .5) building(x, z, w, d, R(4.8, 8.2), {});
      else if (t < .72) building(x, z, w, d, R(3.2, 4.5), { shop: true });
      else if (t < .8) house(x, z, w - .4, d - .2, R(2.4, 3.2));
      else building(x, z, w, d, R(5.5, 7.5), {});
    } else {
      if (t < .46) building(x, z, w, d, R(2.6, 3.6), { shop: true });
      else if (t < .56) house(x, z, w - .4, d - .2, R(2.4, 3.1));
      else if (t < .84) building(x, z, w, d, R(4.2, 6.5), {});
      else kiosk(x, z, 3.2, 3.2, 2.7);
    }
  });
  // greenery between lots + centre
  [[0, 0, 'cone', 1.15], [0, -2.9, 'round', .7], [0, 2.9, 'round', .7], [-2.9, 0, 'round', .75], [2.9, 0, 'cone', .8]].forEach(([ox, oz, k, s]) => { if (rnd() < .72) tree(cx + ox + R(-.2, .2), cz + oz + R(-.2, .2), k, s * R(.85, 1.15)); });
  // street furniture on corners
  [[1, 1], [-1, 1], [1, -1], [-1, -1]].forEach(([sx, sz]) => {
    const t = rnd();
    if (t < .35) trafficLight(cx + sx * 5.55, cz + sz * 5.55, Math.atan2(sx, sz) + Math.PI);
    else if (t < .55) lamp(cx + sx * 5.6, cz + sz * 5.6);
  });
}

/* park */
const pondDone = { v: false };
function parkBlock(i, j, pond) {
  const cx = bx(i), cz = bz(j);
  sidewalk(cx, cz, 0xd6d6d3);
  const grass = shade(new THREE.Mesh(new RoundedBoxGeometry(BS - 1.2, .12, BS - 1.2, 3, .06), M(0x93c441, .95)), false, true);
  grass.position.set(cx, SW + .04, cz); world.add(grass);
  const y = SW + .1;
  // winding path
  [[0, 0, 11, .9, 0], [0, 0, .9, 11, 0]].forEach(([px, pz, w, d]) => box(w, .03, d, 0xeee6cf, cx + px, y + .02, cz + pz, 0));
  if (pond) {
    const px = cx - 2.2, pz = cz - 1.5;
    const water = shade(new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, .06, 40), M(0x78c8dc, .12, .1)), false, true);
    water.position.set(px, y + .03, pz); water.scale.set(1.25, 1, .85); world.add(water);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(2.4, .12, 8, 48), M(0xe9e3d3, .8)); rim.rotation.x = Math.PI / 2; rim.position.set(px, y + .05, pz); rim.scale.set(1.25, .85, 1); rim.castShadow = true; world.add(rim);
    for (let k = 0; k < 4; k++) {
      const a = R(0, TAU), rx = px + Math.cos(a) * 3.9, rz = pz + Math.sin(a) * 2.7;
      person(rx, y, rz);
      if (k === 1) { cyl(.04, .04, 1.1, 0xdddddd, rx + .6, y + .55, rz, 6); const um = shade(new THREE.Mesh(new THREE.ConeGeometry(.75, .35, 14), M(0xf4efe4, .8))); um.position.set(rx + .6, y + 1.25, rz); world.add(um); }
    }
  }
  const nT = 11;
  for (let k = 0; k < nT; k++) {
    let x, z, tries = 0;
    do { x = cx + R(-4.8, 4.8); z = cz + R(-4.8, 4.8); tries++; }
    while (tries < 20 && ((Math.abs(x - cx) < .9 || Math.abs(z - cz) < .9) || (pond && Math.hypot((x - (cx - 2.2)) / 3.2, (z - (cz - 1.5)) / 2.4) < 1.1)));
    tree(x, z, rnd() < .3 ? 'cone' : 'round', R(.8, 1.4), y);
  }
  for (let k = 0; k < 3; k++) box(1.1, .22, .35, 0x9a6d45, cx + R(-3, 3) * (k % 2 ? 1 : -1), y + .15, cz + (k % 2 ? 1.25 : -1.25), .04);
}

/* basketball court */
function courtBlock(i, j) {
  const cx = bx(i), cz = bz(j);
  sidewalk(cx, cz);
  const court = shade(new THREE.Mesh(new RoundedBoxGeometry(10.8, .1, 7.6, 2, .04), M(0xe0743a, .85)), false, true);
  court.position.set(cx - .3, SW + .06, cz - 1.5); world.add(court);
  const y = SW + .13, L = M(0xffffff, .7);
  box(10.2, .02, .1, L, cx - .3, y, cz - 1.5 - 3.4, 0); box(10.2, .02, .1, L, cx - .3, y, cz - 1.5 + 3.4, 0);
  box(.1, .02, 6.9, L, cx - .3 - 5, y, cz - 1.5, 0); box(.1, .02, 6.9, L, cx - .3 + 5, y, cz - 1.5, 0); box(.1, .02, 6.9, L, cx - .3, y, cz - 1.5, 0);
  const circ = new THREE.Mesh(new THREE.TorusGeometry(1.2, .05, 6, 40), L); circ.rotation.x = Math.PI / 2; circ.position.set(cx - .3, y, cz - 1.5); world.add(circ);
  [-1, 1].forEach(s => { box(2.4, .03, 2.4, 0x2d9d93, cx - .3 + s * 3.8, y + .005, cz - 1.5, 0); box(.1, 1.7, .1, 0xcfd2d6, cx - .3 + s * 5.2, y + .85, cz - 1.5, .02); box(.08, .7, 1.1, 0xffffff, cx - .3 + s * 5.0, y + 1.7, cz - 1.5, .02); const r = new THREE.Mesh(new THREE.TorusGeometry(.25, .03, 6, 16), M(0xff6a2a, .5)); r.rotation.x = Math.PI / 2; r.position.set(cx - .3 + s * 4.7, y + 1.55, cz - 1.5); world.add(r); });
  for (let k = 0; k < 6; k++) { const p = person(cx - .3 + R(-4, 4), y, cz - 1.5 + R(-2.5, 2.5)); }
  // bleachers
  for (let s = 0; s < 3; s++) box(10.4, .28, .7, 0xf2f2f0, cx - .3, SW + .3 + s * .3, cz + 3.1 + s * .72, .05);
  for (let k = 0; k < 5; k++) person(cx - 4 + R(0, 8), SW + .75, cz + 3.8, .9);
}

/* plaza */
function plazaBlock(i, j) {
  const cx = bx(i), cz = bz(j);
  sidewalk(cx, cz, 0xe9e5d8);
  const fy = SW + .02;
  cyl(1.9, 2.0, .45, 0xf4f1ea, cx, fy + .22, cz, 40); cyl(1.65, 1.65, .5, M(0x7cc9de, .1, .1), cx, fy + .26, cz, 40);
  cyl(.3, .4, 1.3, 0xf4f1ea, cx, fy + .8, cz, 16); sph(.35, 0xf4f1ea, cx, fy + 1.55, cz);
  for (let k = 0; k < 8; k++) { const a = k / 8 * TAU + .4, r = 4.4; const px = cx + Math.cos(a) * r, pz = cz + Math.sin(a) * r; cyl(.62, .62, .4, 0xd9d4c6, px, SW + .2, pz, 18); tree(px, pz, k % 2 ? 'round' : 'cone', .75, SW + .35); }
  for (let k = 0; k < 8; k++) person(cx + R(-4.5, 4.5), SW, cz + R(-4.5, 4.5));
}

/* forest strip */
function forest() {
  const z0 = bz(4) + HALF + 4 + .5;
  const g = shade(new THREE.Mesh(new THREE.PlaneGeometry(240, 120), M(0x9ccc45, .95)), false, true);
  g.rotation.x = -Math.PI / 2; g.position.set(0, .03, z0 - .5 + 60); world.add(g);
  for (let n = 0; n < 480; n++) {
    const x = R(-70, 70), z = R(z0 - 1.5, z0 + 38);
    const near = (z - z0) / 38;
    tree(x, z, rnd() < .52 ? 'cone' : 'round', R(1.15, 2.1) * (1 + near * .5), .03);
  }
  for (let n = 0; n < 160; n++) { const side = rnd() < .5 ? -1 : 1; tree(side * R(41, 70), R(-60, z0), rnd() < .5 ? 'cone' : 'round', R(1.1, 1.9), .03); }
  for (let n = 0; n < 90; n++) tree(R(-70, 70), R(-85, -52), rnd() < .5 ? 'cone' : 'round', R(1.1, 1.9), .03);
}

/* ---------- roads: markings ---------- */
const dashes = [], stripes = [], rails = [];
function roadMarkings() {
  const RZ = [0, 1, 2, 3, 4], RX = [0, 1, 2, 3];
  const tramZ = new Set([1, 4]);
  RZ.forEach(k => {
    const z = roadZ(k);
    if (tramZ.has(k)) { for (let x = -66; x < 66; x += 1.8) rails.push({ x, z: z - .55, ry: 0, w: 1.9 }, { x, z: z + .55, ry: 0, w: 1.9 }); }
    else for (let x = -66; x < 66; x += 3.4) dashes.push({ x, z, w: 1.5, d: .14 });
  });
  RX.forEach(k => { const x = roadX(k); for (let z = -66; z < 66; z += 3.4) dashes.push({ x, z, w: .14, d: 1.5 }); });
  // crosswalks
  RZ.forEach(kz => RX.forEach(kx => {
    const x = roadX(kx), z = roadZ(kz);
    for (let s = -1; s <= 1; s += 2) {
      for (let n = -3; n <= 3; n++) {
        stripes.push({ x: x + n * .52, z: z + s * 3.0, w: .3, d: 1.5 });
        stripes.push({ x: x + s * 3.0, z: z + n * .52, w: 1.5, d: .3 });
      }
    }
  }));
}

/* ---------- build ---------- */
const MAP = [
  ['park', 'city', 'city', 'plaza', 'park'],
  ['court', 'city', 'city', 'city', 'city'],
  ['city', 'city', 'hero', 'city', 'city'],
  ['city', 'plaza', 'city', 'city', 'park'],
  ['city', 'city', 'city', 'city', 'city'],
];
let pondUsed = false;
for (let j = 0; j < ROWS; j++) for (let i = 0; i < COLS; i++) {
  const t = MAP[j][i];
  if (t === 'city') cityBlock(i, j, false);
  else if (t === 'hero') cityBlock(i, j, true);
  else if (t === 'park') { parkBlock(i, j, !pondUsed); pondUsed = true; }
  else if (t === 'court') courtBlock(i, j);
  else if (t === 'plaza') plazaBlock(i, j);
}
forest();
roadMarkings();

/* instanced meshes ------------------------------------------------ */
function instanced(geo, mat, list, setter, cast = true, rec = true) {
  if (!list.length) return null;
  const im = new THREE.InstancedMesh(geo, mat, list.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3();
  list.forEach((o, i) => { setter(o, v, e, s); q.setFromEuler(e); m4.compose(v, q, s); im.setMatrixAt(i, m4); if (o.c) im.setColorAt(i, o.c); });
  im.castShadow = cast; im.receiveShadow = rec; im.instanceMatrix.needsUpdate = true; world.add(im); return im;
}
// trees
{
  let g = new THREE.IcosahedronGeometry(1, 3); g.deleteAttribute('normal'); g.deleteAttribute('uv'); g = mergeVertices(g, 1e-4);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const n = 1 + .085 * Math.sin(x * 5.1 + z * 3.3) * Math.cos(y * 4.7 + x * 2.1) + .05 * Math.sin(z * 9 + y * 7);
    p.setXYZ(i, x * n, y * n * .93, z * n);
  }
  g.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ roughness: .9 });
  instanced(g, mat, roundTrees, (o, v, e, s) => { const r = o.s * 1.05; v.set(o.x, o.y + o.s * 1.3 + r * .9, o.z); e.set(0, (o.x * 7.3) % TAU, 0); s.set(r, r, r); });
  const trunk = new THREE.CylinderGeometry(.09, .13, 1, 8); trunk.translate(0, .5, 0);
  instanced(trunk, M(0x7a5a3a, .9), roundTrees.map(o => ({ ...o, c: null })), (o, v, e, s) => { v.set(o.x, o.y, o.z); e.set(0, 0, 0); s.set(o.s, o.s * 1.7, o.s); });
  // cone trees
  const prof = [[0, 0], [.78, 0], [.92, .08], [.84, .22], [.66, .45], [.42, .72], [.17, .93], [0, 1]].map(([x, y]) => new THREE.Vector2(x, y));
  const cg = new THREE.LatheGeometry(prof, 20); cg.computeVertexNormals();
  instanced(cg, mat, coneTrees, (o, v, e, s) => { v.set(o.x, o.y + o.s * .45, o.z); e.set(0, 0, 0); s.set(o.s * 1.05, o.s * 2.7, o.s * 1.05); });
  instanced(trunk, M(0x6a4d32, .9), coneTrees.map(o => ({ ...o, c: null })), (o, v, e, s) => { v.set(o.x, o.y, o.z); e.set(0, 0, 0); s.set(o.s * .9, o.s * 1.2, o.s * .9); });
}
// windows
{
  const frame = new THREE.BoxGeometry(1.0, 1.08, .06), pane = new THREE.BoxGeometry(.78, .88, .09);
  const set = (o, v, e, s) => { v.set(o.x, o.y, o.z); e.set(0, o.ry, 0); s.set(1, 1, 1); };
  instanced(frame, M(0xffffff, .6), wins, set, false, true);
  instanced(pane, M(0x6f93b5, .22, .1, { envMapIntensity: 1.4 }), wins, set, false, true);
}
// markings
{
  const set = (o, v, e, s) => { v.set(o.x, .012, o.z); e.set(0, o.ry || 0, 0); s.set(o.w, 1, o.d || .14); };
  const g = new THREE.BoxGeometry(1, .02, 1);
  instanced(g, M(0xf4f4f0, .9), dashes, set, false, true);
  instanced(g, M(0xf4f4f0, .9), stripes, set, false, true);
  instanced(g, M(0x4d5157, .6, .3), rails, set, false, true);
}

/* ---------- vehicles ---------- */
function makeCar(color, taxi) {
  const g = new THREE.Group();
  box(2.1, .52, 1.0, color, 0, .5, 0, .22, g, .45);
  box(1.08, .46, .9, color, -.1, .98, 0, .2, g, .45);
  box(1.06, .27, .92, glass(), -.08, 1.0, 0, .08, g);
  [[.65, .25, .5], [.65, .25, -.5], [-.65, .25, .5], [-.65, .25, -.5]].forEach(([x, y, z]) => { const w = shade(new THREE.Mesh(new THREE.CylinderGeometry(.24, .24, .16, 14), M(0x24272b, .8))); w.rotation.x = Math.PI / 2; w.position.set(x, y, z); g.add(w); });
  [-.32, .32].forEach(z => { const l = new THREE.Mesh(new THREE.SphereGeometry(.09, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfff3c0 })); l.position.set(1.04, .55, z); g.add(l); });
  if (taxi) box(.4, .14, .22, 0xfff3c0, -.1, 1.28, 0, .04, g);
  g.scale.setScalar(.95); return g;
}
function makeTram() {
  const g = new THREE.Group();
  [-1, 1].forEach(s => {
    const x = s * 2.15;
    box(4.2, 1.45, 1.35, 0xf0612a, x, 1.15, 0, .3, g, .4);
    box(4.22, .32, 1.37, 0xffffff, x, .85, 0, .12, g, .4);
    box(4.0, .5, 1.39, glass(), x, 1.4, 0, .15, g);
    box(4.0, .12, 1.0, 0xe9e4da, x, 1.95, 0, .05, g);
    box(.5, .3, .4, 0x3b3f45, x + .3, 2.15, 0, .05, g);
  });
  box(.5, .9, 1.1, 0x2d3036, 0, .9, 0, .15, g);
  return g;
}
const vehicles = [];
function addVehicle(obj, axis, line, dir, speed, pos) {
  obj.userData = { axis, line, dir, speed, pos }; world.add(obj); vehicles.push(obj);
}
{
  const cols = [0xe0443a, 0xf4c22b, 0x3f8fd2, 0xf4f1ea, 0xf08a3e, 0x2fa36b, 0xd0d4d9];
  const tramRoads = [1, 4];
  for (let k = 0; k < 5; k++) {
    const z = roadZ(k);
    if (tramRoads.includes(k)) {
      [0].forEach(() => addVehicle(makeTram(), 'x', z + (k === 1 ? 0 : 0), k === 1 ? 1 : -1, 2.6, R(-50, 50)));
      continue;
    }
    [1, -1].forEach(dir => {
      const n = 3;
      for (let c = 0; c < n; c++) { const col = pick(cols); addVehicle(makeCar(col, col === 0xf4c22b), 'x', z + dir * 1.0, dir, 4.5 + (k % 2), -60 + c * 38 + R(0, 12) + (dir > 0 ? 0 : 25)); }
    });
  }
  [0, 1, 2, 3].forEach(k => {
    const x = roadX(k);
    [1, -1].forEach(dir => { const col = pick(cols); addVehicle(makeCar(col, col === 0xf4c22b), 'z', x - dir * 1.0, dir, 4.2, R(-50, 50)); });
  });
  vehicles.forEach(v => { v.userData.pos = v.userData.pos % 100; });
}

/* ---------- walkers on pavements ---------- */
const walkers = [];
{
  const L = 11.1;
  for (let j = 0; j < ROWS; j++) for (let i = 0; i < COLS; i++) {
    if (MAP[j][i] === 'court') continue;
    const n = MAP[j][i] === 'plaza' ? 0 : (rnd() < .85 ? Math.floor(R(2, 6)) : 1);
    for (let k = 0; k < n; k++) {
      const p = makePerson(.95); world.add(p);
      walkers.push({ p, cx: bx(i), cz: bz(j), t: R(0, 4 * L), dir: rnd() < .5 ? 1 : -1, sp: R(.35, .7), L, ph: R(0, 6) });
    }
  }
}
function perimeter(t, L) { // square ring centred at origin, half = L/2
  const h = L / 2; t = ((t % (4 * L)) + 4 * L) % (4 * L);
  const s = Math.floor(t / L), u = t - s * L;
  if (s === 0) return [-h + u, h, 1, 0];
  if (s === 1) return [h, h - u, 0, -1];
  if (s === 2) return [h - u, -h, -1, 0];
  return [-h, -h + u, 0, 1];
}

/* ---------- post-processing: tilt-shift ---------- */
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: IS_MOBILE ? 2 : 4 }));
composer.addPass(new RenderPass(scene, camera));
const TS = {
  uniforms: { tDiffuse: { value: null }, res: { value: new THREE.Vector2(1, 1) }, focus: { value: .5 }, width: { value: .2 }, amount: { value: 12 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform vec2 res; uniform float focus,width,amount; varying vec2 vUv;
    void main(){
      float d = abs(vUv.y - focus);
      float b = smoothstep(width, width + .4, d) * amount;
      vec3 sum = vec3(0.); float tot = 0.;
      const int N = 26;
      for(int i=0;i<N;i++){
        float a = float(i) * 2.39996;
        float r = sqrt((float(i)+.5)/float(N)) * b;
        vec3 c = texture2D(tDiffuse, vUv + vec2(cos(a), sin(a)) * r / res).rgb;
        float w = 1. + dot(c, vec3(.33)) * .6;   // slight bokeh bias to highlights
        sum += c * w; tot += w;
      }
      vec3 col = sum / tot;
      float l = dot(col, vec3(.299,.587,.114));
      col = mix(vec3(l), col, 1.14);               // gentle saturation lift
      vec2 q = vUv - .5; col *= 1. - dot(q,q) * .32;
      gl_FragColor = vec4(col, 1.);
    }`
};
const tsPass = new ShaderPass(TS); composer.addPass(tsPass);
composer.addPass(new OutputPass());

/* ---------- camera orbit ---------- */
const cam = { az: -.1, el: .78, d: 90, tx: 0, tz: 4, zoom: 1 };
const goal = { ...cam };
let lastInput = -1e9, tsOn = true, paused = false;
function frameDistance() {
  const asp = innerWidth / innerHeight, vf = THREE.MathUtils.degToRad(camera.fov);
  const span = asp < 1 ? 36 : 50;                    // world units to fit across the screen
  return (span / 2) / (Math.tan(vf / 2) * asp) * (asp < 1 ? 1 : 1);
}
function resize() {
  const w = innerWidth, h = innerHeight, pr = renderer.getPixelRatio();
  renderer.setSize(w, h, false); composer.setPixelRatio(pr); composer.setSize(w, h);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  tsPass.uniforms.res.value.set(w * pr, h * pr);
  tsPass.uniforms.amount.value = (tsOn ? 13 : 0) * (h * pr / 1000);
  goal.d = cam.d = frameDistance() * goal.zoom;
}
addEventListener('resize', resize);

const ptrs = new Map(); let pinch0 = 0, zoom0 = 1;
canvas.addEventListener('pointerdown', e => { canvas.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); lastInput = performance.now(); if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); zoom0 = goal.zoom; } $('hint').classList.add('off'); });
canvas.addEventListener('pointermove', e => {
  const p = ptrs.get(e.pointerId); if (!p) return;
  const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY; lastInput = performance.now();
  if (ptrs.size === 1) { goal.az -= dx * .0055; goal.el = THREE.MathUtils.clamp(goal.el + dy * .0045, .32, 1.28); }
  else if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; const dist = Math.hypot(a.x - b.x, a.y - b.y); goal.zoom = THREE.MathUtils.clamp(zoom0 * pinch0 / dist, .28, 1.5); }
});
const up = e => { ptrs.delete(e.pointerId); };
canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
canvas.addEventListener('wheel', e => { e.preventDefault(); goal.zoom = THREE.MathUtils.clamp(goal.zoom * Math.exp(e.deltaY * .0012), .28, 1.5); lastInput = performance.now(); $('hint').classList.add('off'); }, { passive: false });
$('focus').onclick = e => { tsOn = !tsOn; e.target.textContent = 'Tilt-shift: ' + (tsOn ? 'on' : 'off'); e.target.setAttribute('aria-pressed', tsOn); resize(); };
$('pause').onclick = e => { paused = !paused; e.target.textContent = paused ? 'Resume life' : 'Pause life'; e.target.setAttribute('aria-pressed', paused); };

/* ---------- loop ---------- */
let elapsed = 0, frames = 0, lastT = performance.now();
const tmp = new THREE.Vector3();
function update(dt) {
  elapsed += dt;
  // idle drift
  const idle = performance.now() - lastInput > 5000;
  if (idle) goal.az += Math.sin(elapsed * .18) * .00045 * (dt * 60);
  const k = 1 - Math.exp(-dt * 6);
  cam.az += (goal.az - cam.az) * k; cam.el += (goal.el - cam.el) * k; cam.zoom += (goal.zoom - cam.zoom) * k;
  cam.d = frameDistance() * cam.zoom;
  const cx = cam.tx, cz = cam.tz;
  camera.position.set(cx + Math.sin(cam.az) * Math.cos(cam.el) * cam.d, Math.sin(cam.el) * cam.d, cz + Math.cos(cam.az) * Math.cos(cam.el) * cam.d);
  camera.lookAt(cx, 0, cz);
  if (!paused) {
    for (const v of vehicles) {
      const u = v.userData; u.pos += u.speed * u.dir * dt;
      if (u.pos > 55) u.pos = -55; if (u.pos < -55) u.pos = 55;
      if (u.axis === 'x') { v.position.set(u.pos, SW * 0, u.line); v.rotation.y = u.dir > 0 ? 0 : Math.PI; }
      else { v.position.set(u.line, 0, u.pos); v.rotation.y = u.dir > 0 ? -Math.PI / 2 : Math.PI / 2; }
    }
    for (const w of walkers) {
      w.t += w.sp * w.dir * dt;
      const [x, z, dx, dz] = perimeter(w.t, w.L);
      w.p.position.set(w.cx + x * .98, SW, w.cz + z * .98);
      w.p.rotation.y = Math.atan2(dx * w.dir, dz * w.dir);
      const sw = Math.sin(elapsed * 7 * w.sp + w.ph);
      w.p.userData.legs[0].rotation.x = sw * .5; w.p.userData.legs[1].rotation.x = -sw * .5;
      w.p.position.y = SW + Math.abs(sw) * .018;
    }
  }
}
function frame() {
  const nowT = performance.now(), dt = Math.min((nowT - lastT) / 1000, .1); lastT = nowT;
  update(dt);
  composer.render();
  if (++frames === 3) { $('loader').classList.add('done'); setTimeout(() => $('loader').remove(), 900); }
}
resize();
renderer.setAnimationLoop(frame);
setTimeout(() => $('hint').classList.add('off'), 9000);

window.__city = { camera, goal, cam, scene, update, resize, setView(az, el, zoom = 1) { goal.az = cam.az = az; goal.el = cam.el = el; goal.zoom = cam.zoom = zoom; lastInput = performance.now(); update(0); }, stats: () => ({ round: roundTrees.length, cone: coneTrees.length, wins: wins.length, vehicles: vehicles.length, walkers: walkers.length }) };
