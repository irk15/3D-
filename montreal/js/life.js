// life.js — traffic, parked cars, pedestrians and gulls.
import * as THREE from 'three';
import {
  U, terrainH, district, D, lineU, lineV, idxU, idxV, hwU, hwV, ART_U, ART_V, gridHere, roadEdge, hash2, latticeAllowed, waterSDF,
} from './core.js';
import { GlowField } from './shaders.js';

// ---------------------------------------------------------------- vehicle geometry (lights live INSIDE the body faces)
function partGeo(g, part, keepUv = true) {
  g = g.index ? g.toNonIndexed() : g;
  g.setAttribute('aPart', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count).fill(part), 1));
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  return g;
}
function mergeG(gs) {
  const out = new THREE.BufferGeometry(); let n = 0; for (const g of gs) n += g.attributes.position.count;
  for (const name of ['position', 'normal', 'uv', 'aPart']) {
    const size = gs[0].attributes[name].itemSize, arr = new Float32Array(n * size); let o = 0;
    for (const g of gs) { arr.set(g.attributes[name].array, o); o += g.attributes[name].array.length; }
    out.setAttribute(name, new THREE.BufferAttribute(arr, size));
  }
  out.computeBoundingSphere(); return out;
}
function carGeo() {
  const L = 4.5, W = 1.84;
  const body = new THREE.BoxGeometry(L, 0.74, W); body.translate(0, 0.32 + 0.37, 0);
  const cab = new THREE.BoxGeometry(L * 0.5, 0.58, W * 0.88); cab.translate(-0.25, 1.06 + 0.29, 0);
  const gs = [partGeo(body, 0), partGeo(cab, 1)];
  for (const [x, z] of [[1.42, 0.84], [1.42, -0.84], [-1.42, 0.84], [-1.42, -0.84]]) { const w = new THREE.CylinderGeometry(0.34, 0.34, 0.22, 10); w.rotateX(Math.PI / 2); w.translate(x, 0.34, z); gs.push(partGeo(w, 2)); }
  return mergeG(gs);
}
function busGeo() {
  const body = new THREE.BoxGeometry(12, 2.85, 2.55); body.translate(0, 0.35 + 1.425, 0);
  const gs = [partGeo(body, 3)];
  for (const [x, z] of [[4, 1.15], [4, -1.15], [-3.6, 1.15], [-3.6, -1.15]]) { const w = new THREE.CylinderGeometry(0.5, 0.5, 0.3, 10); w.rotateX(Math.PI / 2); w.translate(x, 0.5, z); gs.push(partGeo(w, 2)); }
  return mergeG(gs);
}
function vehicleMaterial() {
  const m = new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.5, name: 'vehicle' });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uNight = U.uNight;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
attribute float aPart; attribute float iBrake; varying float vPart; varying vec3 vON; varying vec2 vUv2; varying float vBrake;`)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPart = aPart; vON = normal; vUv2 = uv; vBrake = iBrake;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
uniform float uNight; varying float vPart; varying vec3 vON; varying vec2 vUv2; varying float vBrake; float vR, vM; vec3 vE;`)
      .replace('#include <color_fragment>', /* glsl */`#include <color_fragment>
vec3 paint = diffuseColor.rgb; vR = 0.3; vM = 0.55; vE = vec3(0.0);
if (vPart > 0.5 && vPart < 1.5) {
  if (abs(vON.y) < 0.5) { diffuseColor.rgb = vec3(0.03, 0.04, 0.05); vR = 0.05; vM = 0.9; }
} else if (vPart > 1.5 && vPart < 2.5) { diffuseColor.rgb = vec3(0.025); vR = 0.85; vM = 0.0; }
else if (vPart < 0.5) {
  float lightRow = step(0.42, vUv2.y) * step(vUv2.y, 0.8);
  float side = step(vUv2.x, 0.22) + step(0.78, vUv2.x);
  if (vON.x > 0.9) { float hl = lightRow * side; diffuseColor.rgb = mix(paint, vec3(0.92), hl); vE += vec3(1.0, 0.95, 0.85) * hl * (0.15 + uNight * 3.0);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.04), step(vUv2.y, 0.32) * (1.0 - hl)); }
  if (vON.x < -0.9) { float tl = lightRow * side; diffuseColor.rgb = mix(paint, vec3(0.45, 0.02, 0.02), tl); vE += vec3(1.0, 0.04, 0.02) * tl * (0.06 + 0.7 * uNight + 2.4 * vBrake); }
  diffuseColor.rgb = mix(diffuseColor.rgb, paint * 0.25, step(vUv2.y, 0.12) * step(abs(vON.y), 0.5));
} else {   // bus: windows band + destination sign
  float win = step(abs(vON.y), 0.5) * step(0.5, vUv2.y) * step(vUv2.y, 0.86);
  diffuseColor.rgb = mix(paint, vec3(0.05, 0.07, 0.08), win); vR = mix(0.4, 0.06, win); vM = mix(0.2, 0.8, win);
  vE += vec3(0.95, 0.97, 1.0) * win * uNight * 0.9;
  if (abs(vON.x) > 0.9) { float sg = step(0.86, vUv2.y) * step(vUv2.y, 0.96) * step(0.2, vUv2.x) * step(vUv2.x, 0.8); vE += vec3(1.0, 0.75, 0.1) * sg * (0.4 + uNight * 2.0); }
  float stripe = step(abs(vON.y), 0.5) * step(0.32, vUv2.y) * step(vUv2.y, 0.42);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.05, 0.36, 0.62), stripe);
}`).replace('#include <roughnessmap_fragment>', 'float roughnessFactor = vR;')
      .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = vM;')
      .replace('#include <emissivemap_fragment>', 'totalEmissiveRadiance += vE;');
  };
  m.customProgramCacheKey = () => 'vehicle';
  return m;
}
const PAINT = [0xf2f2f2, 0x1b1c1e, 0x8c9096, 0x2b3f5c, 0x7a1d1d, 0xb8bcc2, 0x3a3f38, 0x5b6b7c, 0xd7d2c4, 0x1f4a6e, 0xa83c1e, 0xe8d24a, 0x2d5a3d];

// ---------------------------------------------------------------- pedestrians
function pedGeo() {
  const gs = [];
  const add = (g, limb, x, y, z) => { g.translate(x, y, z); g = g.toNonIndexed(); g.setAttribute('aPart', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count).fill(limb), 1)); if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); gs.push(g); };
  add(new THREE.BoxGeometry(0.26, 0.62, 0.42), 0, 0, 1.2, 0);                  // torso
  add(new THREE.SphereGeometry(0.115, 8, 6), 5, 0.01, 1.66, 0);               // head
  add(new THREE.BoxGeometry(0.15, 0.88, 0.16), 1, 0, 0.45, 0.1);              // left leg
  add(new THREE.BoxGeometry(0.15, 0.88, 0.16), 2, 0, 0.45, -0.1);             // right leg
  add(new THREE.BoxGeometry(0.1, 0.62, 0.11), 3, 0, 1.17, 0.27);              // left arm
  add(new THREE.BoxGeometry(0.1, 0.62, 0.11), 4, 0, 1.17, -0.27);             // right arm
  return mergeG(gs);
}
function pedMaterial() {
  const m = new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, name: 'ped' });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = U.uTime;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
attribute float aPart; attribute vec3 iAnim; uniform float uTime; varying float vLimb; flat varying float vHash;
vec3 swingZ(vec3 p, vec3 piv, float a){ p -= piv; float c = cos(a), s = sin(a); p.xy = vec2(c * p.x - s * p.y, s * p.x + c * p.y); return p + piv; }`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vLimb = aPart; vHash = fract(sin(float(gl_InstanceID) * 12.9898) * 43758.5453);
float sw = sin(uTime * iAnim.z + iAnim.x) * iAnim.y;
if (aPart > 0.5 && aPart < 1.5) transformed = swingZ(transformed, vec3(0.0, 0.9, 0.0), sw);
if (aPart > 1.5 && aPart < 2.5) transformed = swingZ(transformed, vec3(0.0, 0.9, 0.0), -sw);
if (aPart > 2.5 && aPart < 3.5) transformed = swingZ(transformed, vec3(0.0, 1.45, 0.0), -sw * 0.8);
if (aPart > 3.5 && aPart < 4.5) transformed = swingZ(transformed, vec3(0.0, 1.45, 0.0), sw * 0.8);
transformed.y += abs(sin(uTime * iAnim.z + iAnim.x)) * 0.035 * step(0.01, iAnim.y);`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vLimb; flat varying float vHash;')
      .replace('#include <color_fragment>', `#include <color_fragment>
vec3 skin = mix(mix(vec3(0.94, 0.76, 0.62), vec3(0.62, 0.42, 0.29), step(0.45, vHash)), vec3(0.34, 0.22, 0.15), step(0.78, vHash));
vec3 pants = mix(vec3(0.10, 0.11, 0.14), vec3(0.23, 0.30, 0.42), step(0.5, fract(vHash * 7.0)));
pants = mix(pants, vec3(0.45, 0.40, 0.33), step(0.85, fract(vHash * 13.0)));
if (vLimb > 4.5) diffuseColor.rgb = skin;
else if (vLimb > 0.5 && vLimb < 2.5) diffuseColor.rgb = pants;`);
  };
  m.customProgramCacheKey = () => 'ped';
  return m;
}
const CLOTHES = [0x1d2a44, 0x7a1f24, 0x2f4f3a, 0xc9b79c, 0x303030, 0x5a3e2b, 0x8d8f93, 0xe6e1d6, 0x1e5a7a, 0xb5651d, 0x6b2d5c, 0xd9c14a];

// ---------------------------------------------------------------- the simulation
export class Life {
  constructor(scene, paths, quality) {
    this.scene = scene; this.paths = paths;
    this.group = new THREE.Group(); this.group.name = 'life'; scene.add(this.group);
    this.vmat = vehicleMaterial();
    this.cap = { cars: 900, buses: 40, parked: 1800, peds: 1100, bridge: 160 };
    const mkInst = (geo, n) => {
      const g = geo.clone();
      g.setAttribute('iBrake', new THREE.InstancedBufferAttribute(new Float32Array(n), 1));
      const im = new THREE.InstancedMesh(g, this.vmat, n); im.count = 0; im.frustumCulled = false; im.castShadow = true; im.receiveShadow = true;
      im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
      this.group.add(im); return im;
    };
    const cg = carGeo();
    this.carMesh = mkInst(cg, this.cap.cars + this.cap.bridge);
    this.busMesh = mkInst(busGeo(), this.cap.buses);
    this.parkMesh = mkInst(cg, this.cap.parked);
    const pg = pedGeo();
    pg.setAttribute('iAnim', new THREE.InstancedBufferAttribute(new Float32Array(this.cap.peds * 3), 3));
    this.pedMesh = new THREE.InstancedMesh(pg, pedMaterial(), this.cap.peds); this.pedMesh.count = 0; this.pedMesh.frustumCulled = false; this.pedMesh.castShadow = true;
    this.pedMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(this.cap.peds * 3), 3);
    this.group.add(this.pedMesh);
    this.glow = new GlowField((this.cap.cars + this.cap.bridge + this.cap.buses) * 4); this.group.add(this.glow.mesh);
    this.cars = []; this.peds = []; this.bridgeCars = [];
    this.setQuality(quality);
    this.lastPark = new THREE.Vector3(1e9, 0, 0);
    this.m4 = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.q2 = new THREE.Quaternion(); this.p = new THREE.Vector3(); this.s = new THREE.Vector3(1, 1, 1);
    this.col = new THREE.Color();
    this.birds = makeBirds(this.group);
    this.t = 0;
  }
  setQuality(q) {
    this.nCars = Math.min(this.cap.cars, q.cars); this.nBus = Math.min(this.cap.buses, q.buses); this.nPeds = Math.min(this.cap.peds, q.peds);
    this.R = q.lifeRadius; this.parkR = q.parkRadius; this.nBridge = Math.min(this.cap.bridge, q.bridgeCars);
    this.cars.length = 0; this.peds.length = 0; this.bridgeCars.length = 0; this.inited = false; this.lastPark = new THREE.Vector3(1e9, 0, 0);
  }
  // lanes for a street: [{o: lateral offset, dir}]
  lanes(axis, idx, old) {
    if (old) { const dir = (((idx % 2) + 2) % 2) ? 1 : -1; return [{ o: 0.3 * dir * (axis ? -1 : 1), dir }]; }
    const hw = axis === 0 ? hwU(idx) : hwV(idx);
    if (hw < 6) { const dir = (((idx % 2) + 2) % 2) ? 1 : -1; return [{ o: 0, dir }]; }
    const n = Math.max(1, Math.floor((hw - 0.6) / 3.4)), out = [];
    for (let j = 0; j < n; j++) for (const dir of [1, -1]) out.push({ o: (1.8 + 3.4 * j) * dir * (axis ? -1 : 1), dir });
    return out;
  }
  posOf(c) { return c.axis === 0 ? [c.c + c.o, c.s] : [c.s, c.c + c.o]; }
  spawnCar(c, cam, initial) {
    const cu = cam.x, cv = -cam.z;
    for (let tries = 0; tries < 30; tries++) {
      const r = this.R * (initial ? Math.sqrt(Math.random()) : 0.55 + 0.45 * Math.random()), a = Math.random() * 6.283;
      const u = cu + Math.cos(a) * r, v = cv + Math.sin(a) * r;
      const d = district(u, v); if (!latticeAllowed(d)) continue;
      const old = d === D.OLD;
      const axis = Math.random() < 0.5 ? 0 : 1;
      let idx = axis === 0 ? idxU(u, old) : idxV(v, old);
      if (c.bus) { // buses only on arterials
        const tbl = axis === 0 ? ART_U : ART_V; const keys = Object.keys(tbl).map(Number);
        idx = keys.reduce((b, k) => Math.abs(k - (axis === 0 ? idxU(u) : idxV(v))) < Math.abs(b - (axis === 0 ? idxU(u) : idxV(v))) ? k : b, keys[0]);
        if (old) continue;
      } else if (!old && Math.random() < 0.35) {
        const tbl = axis === 0 ? ART_U : ART_V; const keys = Object.keys(tbl).map(Number);
        const near = keys.filter((k) => Math.abs((axis === 0 ? lineU(k) - u : lineV(k) - v)) < 600);
        if (near.length) idx = near[Math.floor(Math.random() * near.length)];
      }
      const lc = axis === 0 ? lineU(idx, old) : lineV(idx, old);
      const s = axis === 0 ? v : u;
      const pu = axis === 0 ? lc : s, pv = axis === 0 ? s : lc;
      if (!gridHere(pu, pv) || isOldAt(pu, pv) !== old) continue;
      const L = this.lanes(axis, idx, old); const ln = L[Math.floor(Math.random() * L.length)];
      Object.assign(c, { axis, idx, old, c: lc, o: ln.o, dir: ln.dir, s, v: 6 + Math.random() * 6, vmax: (old ? 6 : (ART_U[idx] !== undefined && axis === 0) || (ART_V[idx] !== undefined && axis === 1) ? 15 : 10) * (0.85 + Math.random() * 0.3), brake: 0 });
      c.key = `${axis}|${idx}|${old ? 1 : 0}|${c.o.toFixed(1)}`;
      if (this.cars.some((o) => o !== c && o.key === c.key && Math.abs(o.s - c.s) < 14)) continue;
      return true;
    }
    return false;
  }
  signal(c, m, t) {
    const k = c.idx;
    const ph = ((t + ((((k * 7 + m * 13) % 11) + 11) % 11) * 4) % 44 + 44) % 44;
    if (c.axis === 0) return ph < 18 ? 0 : ph < 21 ? 1 : 2;   // 0 green 1 yellow 2 red
    return ph >= 22 && ph < 40 ? 0 : ph >= 40 && ph < 43 ? 1 : 2;
  }
  update(dt, cam, focusPos) {
    this.t += dt; const t = this.t;
    dt = Math.min(dt, 0.1);
    const fleet = this.nCars + this.nBus;
    if (!this.inited) {
      this.inited = true;
      for (let i = 0; i < fleet; i++) { const c = { bus: i >= this.nCars, inst: i < this.nCars ? i : i - this.nCars }; this.cars.push(c); this.spawnCar(c, cam, true); this.col.set(c.bus ? 0xf4f4f2 : PAINT[i % PAINT.length]); (c.bus ? this.busMesh : this.carMesh).setColorAt(c.inst, this.col); }
      for (let i = 0; i < this.nPeds; i++) { const p = { inst: i }; this.peds.push(p); this.spawnPed(p, cam, true); this.col.set(CLOTHES[i % CLOTHES.length]); this.pedMesh.setColorAt(i, this.col); }
      this.initBridges();
      this.carMesh.instanceColor.needsUpdate = this.busMesh.instanceColor.needsUpdate = this.pedMesh.instanceColor.needsUpdate = true;
    }
    // ---- grid traffic
    const groups = new Map();
    for (const c of this.cars) { let a = groups.get(c.key); if (!a) groups.set(c.key, a = []); a.push(c); }
    for (const a of groups.values()) { a.sort((x, y) => (y.s - x.s) * y.dir); for (let i = 0; i < a.length; i++) a[i].lead = i > 0 ? a[i - 1] : null; }
    const cu = cam.x, cv = -cam.z, R2 = this.R * this.R;
    for (const c of this.cars) {
      let vDes = c.vmax;
      const len = c.bus ? 12 : 4.6;
      if (c.lead) { const gap = (c.lead.s - c.s) * c.dir - len - 2; vDes = Math.min(vDes, Math.max(0, gap * 0.8)); }
      // next intersection ahead
      const fn = c.axis === 0 ? (s) => idxV(s, c.old) : (s) => idxU(s, c.old);
      const lf = c.axis === 0 ? (m) => lineV(m, c.old) : (m) => lineU(m, c.old);
      const hf = c.axis === 0 ? (m) => hwV(m, c.old) : (m) => hwU(m, c.old);
      let m = fn(c.s);
      let stop = lf(m) - c.dir * (hf(m) + 4.6);
      if ((stop - c.s) * c.dir < -0.5) { m += c.dir; stop = lf(m) - c.dir * (hf(m) + 4.6); }
      const dStop = (stop - c.s) * c.dir;
      if (dStop < 70) {
        const ip = c.axis === 0 ? [c.c, lf(m)] : [lf(m), c.c];
        const st = this.signal(c, m, t);
        if ((st === 2 || (st === 1 && dStop > 10)) && gridHere(ip[0], ip[1])) vDes = Math.min(vDes, Math.max(0, (dStop - 0.5) * 0.55));
      }
      const acc = Math.max(-7, Math.min(2.6, (vDes - c.v) * 1.6));
      const prev = c.v;
      c.v = Math.max(0, c.v + acc * dt);
      c.brake += ((c.v < prev - 0.02 || c.v < 0.3 ? 1 : 0) - c.brake) * Math.min(1, dt * 8);
      c.s += c.v * dt * c.dir;
      const [u, v] = this.posOf(c);
      const ahead = c.axis === 0 ? [c.c, c.s + c.dir * 14] : [c.s + c.dir * 14, c.c];
      if ((u - cu) ** 2 + (v - cv) ** 2 > R2 || !gridHere(ahead[0], ahead[1]) || isOldAt(ahead[0], ahead[1]) !== c.old) {
        this.spawnCar(c, cam, false);
      }
    }
    // ---- write instances
    const writeVeh = (mesh, list) => {
      const br = mesh.geometry.attributes.iBrake.array; let n = 0;
      for (const c of list) {
        const [u, v] = this.posOf(c);
        const y = terrainH(u, v);
        const fx = c.axis === 0 ? 0 : c.dir * 2, fz = c.axis === 0 ? c.dir * 2 : 0;
        const pitch = Math.atan2(terrainH(u + fx, v + fz) - terrainH(u - fx, v - fz), 4);
        const yaw = c.axis === 0 ? (c.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (c.dir > 0 ? 0 : Math.PI);
        this.q.setFromAxisAngle(Y, yaw).multiply(this.q2.setFromAxisAngle(Z, pitch));
        this.m4.compose(this.p.set(u, y, -v), this.q, this.s); mesh.setMatrixAt(c.inst, this.m4);
        br[c.inst] = c.brake; n = Math.max(n, c.inst + 1);
      }
      mesh.count = n; mesh.instanceMatrix.needsUpdate = true; mesh.geometry.attributes.iBrake.needsUpdate = true;
    };
    const carsOnly = this.cars.filter((c) => !c.bus), buses = this.cars.filter((c) => c.bus);
    writeVeh(this.busMesh, buses);
    // bridge cars share the car mesh after the grid cars
    this.updateBridges(dt);
    const br = this.carMesh.geometry.attributes.iBrake.array;
    writeVeh(this.carMesh, carsOnly);
    for (const b of this.bridgeCars) {
      const P = b.path, L = P.L;
      const tt = Math.min(0.999, Math.max(0.001, b.s / L));
      const p = P.curve.getPointAt(tt), tg = P.curve.getTangentAt(tt);
      const rx = -tg.z, rz = tg.x, rl = Math.hypot(rx, rz);
      this.p.set(p.x + rx / rl * b.o, p.y + 0.05, p.z + rz / rl * b.o);
      const yaw = Math.atan2(-tg.z * b.dir, tg.x * b.dir);
      const pitch = Math.asin(Math.max(-1, Math.min(1, tg.y * b.dir)));
      this.q.setFromAxisAngle(Y, yaw).multiply(this.q2.setFromAxisAngle(Z, pitch));
      this.m4.compose(this.p, this.q, this.s); this.carMesh.setMatrixAt(b.inst, this.m4); br[b.inst] = 0;
      b.wp = this.p.clone(); b.yaw = yaw;
    }
    this.carMesh.count = Math.max(this.carMesh.count, this.nCars + this.bridgeCars.length);
    // ---- light glows (night)
    const g = this.glow; g.n = 0;
    if (U.uNight.value > 0.02) {
      const addLights = (x, y, z, yaw, len, wid, bus) => {
        const cx = Math.cos(yaw), sz = -Math.sin(yaw), px = -sz, pz = cx;
        for (const sd of [-1, 1]) {
          g.add(x + cx * len / 2 + px * sd * wid, y + (bus ? 0.9 : 0.62), z + sz * len / 2 + pz * sd * wid, 1, 0.95, 0.85, 0.9, 0.55, 0);
          g.add(x - cx * len / 2 + px * sd * wid, y + (bus ? 0.9 : 0.62), z - sz * len / 2 + pz * sd * wid, 1, 0.08, 0.04, 0.8, 0.4, 0);
        }
      };
      for (const c of this.cars) {
        const [u, v] = this.posOf(c); const dx = u - cu, dz = v - cv;
        if (dx * dx + dz * dz > 700 * 700) continue;
        const yaw = c.axis === 0 ? (c.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (c.dir > 0 ? 0 : Math.PI);
        addLights(u, terrainH(u, v), -v, yaw, c.bus ? 12 : 4.5, c.bus ? 1.0 : 0.62, c.bus);
      }
      for (const b of this.bridgeCars) if (b.wp) addLights(b.wp.x, b.wp.y, b.wp.z, b.yaw, 4.5, 0.62, false);
    }
    g.commit();
    // ---- pedestrians
    this.updatePeds(dt, cam);
    // ---- parked cars (deterministic, refreshed as the camera moves)
    if (cam.distanceTo(this.lastPark) > 60) { this.lastPark.copy(cam); this.refreshParked(cam); }
    this.birds(dt, t);
  }
  // -------------------------------------------------------------- bridges
  initBridges() {
    this.bridgeCars.length = 0;
    const list = Object.values(this.paths).filter((p) => p.lanes);
    let inst = this.nCars;
    for (const P of list) { P.L = P.curve.getLength(); }
    const per = Math.floor(this.nBridge / Math.max(1, list.reduce((a, p) => a + p.lanes.length, 0)));
    for (const P of list) for (const o of P.lanes) {
      for (let i = 0; i < per; i++) {
        const b = { path: P, o, dir: o > 0 ? 1 : -1, s: Math.random() * P.L, v: 14 + Math.random() * 6, inst: inst++ };
        this.bridgeCars.push(b); this.col.set(PAINT[(inst * 7) % PAINT.length]); this.carMesh.setColorAt(b.inst, this.col);
      }
    }
    this.carMesh.instanceColor.needsUpdate = true;
  }
  updateBridges(dt) {
    for (const b of this.bridgeCars) {
      b.s += b.v * dt * b.dir;
      if (b.s > b.path.L - 2) b.s = 2; if (b.s < 2) b.s = b.path.L - 2;
    }
  }
  // -------------------------------------------------------------- pedestrians
  spawnPed(p, cam, initial) {
    const cu = cam.x, cv = -cam.z, R = Math.min(this.R, 420);
    for (let tries = 0; tries < 30; tries++) {
      const r = R * (initial ? Math.sqrt(Math.random()) : 0.6 + 0.4 * Math.random()), a = Math.random() * 6.283;
      const u = cu + Math.cos(a) * r, v = cv + Math.sin(a) * r;
      const d = district(u, v);
      if (d === D.PLAZA || (d === D.ISLANDS && waterSDF(u, v) > 5 && Math.random() < 0.15) || d === D.CAMPUS) {
        if (roadEdge(u, v) < 2 || waterSDF(u, v) < 3) continue;
        Object.assign(p, { mode: 1, u, v, h: Math.random() * 6.283, speed: 1.1 + Math.random() * 0.4, phase: Math.random() * 6, idle: Math.random() < 0.25 });
        return true;
      }
      if (!latticeAllowed(d)) continue;
      const old = d === D.OLD, axis = Math.random() < 0.5 ? 0 : 1;
      const idx = axis === 0 ? idxU(u, old) : idxV(v, old);
      const lc = axis === 0 ? lineU(idx, old) : lineV(idx, old), hw = axis === 0 ? hwU(idx, old) : hwV(idx, old);
      const side = Math.random() < 0.5 ? 1 : -1, off = hw + 0.7 + Math.random() * 1.8;
      const s = axis === 0 ? v : u;
      const pu = axis === 0 ? lc + side * off : s, pv = axis === 0 ? s : lc + side * off;
      if (!gridHere(axis === 0 ? lc : s, axis === 0 ? s : lc)) continue;
      const e = roadEdge(pu, pv); if (e < 0.2 || e > 3) continue;
      Object.assign(p, { mode: 0, axis, idx, old, c: lc, off: side * off, dir: Math.random() < 0.5 ? 1 : -1, s, speed: 1.1 + Math.random() * 0.5, phase: Math.random() * 6, idle: Math.random() < 0.12 });
      return true;
    }
    return false;
  }
  updatePeds(dt, cam) {
    const cu = cam.x, cv = -cam.z, R = Math.min(this.R, 420), anim = this.pedMesh.geometry.attributes.iAnim.array;
    const nightF = 1 - 0.55 * U.uNight.value;
    let n = 0;
    const want = Math.floor(this.peds.length * nightF);
    for (let i = 0; i < this.peds.length; i++) {
      const p = this.peds[i];
      if (i >= want) continue;
      let u, v, yaw;
      if (p.mode === 1) {
        if (!p.idle) {
          p.h += (Math.random() - 0.5) * dt * 0.6;
          const nu = p.u + Math.cos(p.h) * p.speed * dt, nv = p.v + Math.sin(p.h) * p.speed * dt;
          if (roadEdge(nu, nv) < 1.5 || waterSDF(nu, nv) < 3 || !(district(nu, nv) === D.PLAZA || district(nu, nv) === D.ISLANDS || district(nu, nv) === D.CAMPUS)) p.h += Math.PI * 0.8;
          else { p.u = nu; p.v = nv; }
        }
        u = p.u; v = p.v; yaw = p.h;
      } else {
        if (!p.idle) p.s += p.speed * dt * p.dir;
        u = p.axis === 0 ? p.c + p.off : p.s; v = p.axis === 0 ? p.s : p.c + p.off;
        yaw = p.axis === 0 ? (p.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (p.dir > 0 ? 0 : Math.PI);
        const la = p.axis === 0 ? [p.c, p.s + p.dir * 4] : [p.s + p.dir * 4, p.c];
        if (!gridHere(la[0], la[1])) { p.dir = -p.dir; }
      }
      if ((u - cu) ** 2 + (v - cv) ** 2 > R * R) { this.spawnPed(p, cam, false); continue; }
      const y = terrainH(u, v);
      this.q.setFromAxisAngle(Y, yaw);
      this.m4.compose(this.p.set(u, y, -v), this.q, this.s.set(1, 0.92 + (p.inst % 7) * 0.025, 1));
      this.pedMesh.setMatrixAt(n, this.m4);
      anim[n * 3] = p.phase; anim[n * 3 + 1] = p.idle ? 0 : 0.42; anim[n * 3 + 2] = p.idle ? 0 : 6.2 * p.speed / 1.35;
      n++;
    }
    this.s.set(1, 1, 1);
    this.pedMesh.count = n; this.pedMesh.instanceMatrix.needsUpdate = true; this.pedMesh.geometry.attributes.iAnim.needsUpdate = true;
  }
  // -------------------------------------------------------------- parked cars
  refreshParked(cam) {
    const cu = cam.x, cv = -cam.z, R = this.parkR; let n = 0;
    const max = Math.min(this.cap.parked, this.parkR > 250 ? this.cap.parked : 700);
    const doLine = (axis, idx, old) => {
      const hw = axis === 0 ? hwU(idx, old) : hwV(idx, old);
      if (hw > 6 || old) return;
      const lc = axis === 0 ? lineU(idx) : lineV(idx);
      const c0 = axis === 0 ? cv : cu;
      const span = Math.sqrt(Math.max(0, R * R - (lc - (axis === 0 ? cu : cv)) ** 2));
      for (let s = Math.floor((c0 - span) / 6.3) * 6.3; s < c0 + span && n < max; s += 6.3) {
        for (const side of [-1, 1]) {
          const h = hash2(idx * 31 + axis * 7 + (side + 1), Math.round(s / 6.3));
          if (h > 0.62) continue;
          const pu = axis === 0 ? lc + side * (hw - 1.15) : s, pv = axis === 0 ? s : lc + side * (hw - 1.15);
          const cross = axis === 0 ? Math.abs(pv - lineV(idxV(pv))) - hwV(idxV(pv)) : Math.abs(pu - lineU(idxU(pu))) - hwU(idxU(pu));
          if (cross < 7) continue;
          if (!gridHere(axis === 0 ? lc : s, axis === 0 ? s : lc) || district(pu, pv) === D.OLD) continue;
          const yaw = (axis === 0 ? Math.PI / 2 : 0) + (h < 0.31 ? Math.PI : 0);
          this.q.setFromAxisAngle(Y, yaw);
          this.m4.compose(this.p.set(pu, terrainH(pu, pv), -pv), this.q, this.s); this.parkMesh.setMatrixAt(n, this.m4);
          this.col.set(PAINT[Math.floor(hash2(idx * 3 + side, Math.round(s)) * PAINT.length)]); this.parkMesh.setColorAt(n, this.col);
          n++;
        }
      }
    };
    for (let k = idxU(cu - R); k <= idxU(cu + R); k++) doLine(0, k, false);
    for (let m = idxV(cv - R); m <= idxV(cv + R); m++) doLine(1, m, false);
    this.parkMesh.count = n; this.parkMesh.instanceMatrix.needsUpdate = true; if (this.parkMesh.instanceColor) this.parkMesh.instanceColor.needsUpdate = true;
  }
}
const Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);
const isOldAt = (u, v) => district(u, v) === D.OLD;

// ---------------------------------------------------------------- gulls over the Old Port and the river
function makeBirds(group) {
  const N = 60;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, -0.35, 0, 0.9, 0.25, 0, 0, 0, 0, 0, 0.25, 0, 0, -0.35, 0, -0.9], 3));
  g.setAttribute('aWing', new THREE.Float32BufferAttribute([0, 1, 0, 0, 0, 1], 1));
  g.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ color: 0xeeeeea, roughness: 0.8, side: THREE.DoubleSide });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = U.uTime;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aWing; uniform float uTime;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed.y += aWing * sin(uTime * 7.0 + float(gl_InstanceID) * 1.7) * 0.45;');
  };
  mat.customProgramCacheKey = () => 'gull';
  const im = new THREE.InstancedMesh(g, mat, N); im.frustumCulled = false; group.add(im);
  const flock = [];
  const centers = [[1500, -900], [2300, -1200], [900, -1500], [4200, -300]];
  for (let i = 0; i < N; i++) { const c = centers[i % centers.length]; flock.push({ cu: c[0] + Math.random() * 200, cv: c[1] + Math.random() * 200, r: 40 + Math.random() * 120, h: 18 + Math.random() * 40, w: (0.15 + Math.random() * 0.2) * (Math.random() < 0.5 ? 1 : -1), a: Math.random() * 6.28 }); }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(2.2, 2.2, 2.2), up = new THREE.Vector3(0, 1, 0);
  return (dt, t) => {
    flock.forEach((b, i) => {
      b.a += b.w * dt;
      const u = b.cu + Math.cos(b.a) * b.r, v = b.cv + Math.sin(b.a) * b.r;
      p.set(u, b.h + Math.sin(t * 0.5 + i) * 3, -v);
      q.setFromAxisAngle(up, -b.a - (b.w > 0 ? 0 : Math.PI));
      m4.compose(p, q, s); im.setMatrixAt(i, m4);
    });
    im.instanceMatrix.needsUpdate = true;
  };
}
