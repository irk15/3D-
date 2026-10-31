// cars.js — detailed toon cars, shared by traffic (moving) and parked cars (baked into the city batch).
// Bodies are extruded side profiles with rounded edges and real wheel arches; then a glass greenhouse,
// pillars, bumpers, grille, head/tail lights, mirrors, door seams and handles, plates, and wheels with
// tyres, rims and hubs. Six models: sedan, hatchback, SUV, taxi, pickup and delivery van.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { toon, gradient } from './toon.js';

export const CAR_KINDS = ['sedan', 'sedan', 'hatch', 'hatch', 'suv', 'taxi', 'pickup', 'van'];
const SPEC = {
  //        length width  sill  belt   roof   front   rear   cabin front/back z   wheelbase  wheel r
  sedan:  { L: 4.5, W: 1.82, y0: 0.3, belt: 0.98, roof: 1.46, nose: 0.78, tail: 0.92, cf: 0.85, cb: -1.55, wb: 1.38, wr: 0.36 },
  taxi:   { L: 4.6, W: 1.84, y0: 0.3, belt: 0.98, roof: 1.47, nose: 0.78, tail: 0.92, cf: 0.85, cb: -1.6, wb: 1.42, wr: 0.36 },
  hatch:  { L: 3.95, W: 1.76, y0: 0.3, belt: 0.98, roof: 1.5, nose: 0.8, tail: 1.02, cf: 0.75, cb: -1.85, wb: 1.25, wr: 0.34, hatch: true },
  suv:    { L: 4.7, W: 1.94, y0: 0.42, belt: 1.18, roof: 1.84, nose: 1.0, tail: 1.12, cf: 0.95, cb: -2.25, wb: 1.48, wr: 0.42, hatch: true, rack: true },
  pickup: { L: 5.2, W: 1.96, y0: 0.44, belt: 1.16, roof: 1.86, nose: 1.0, tail: 0.86, cf: 1.15, cb: -0.25, wb: 1.7, wr: 0.43, bed: true },
  van:    { L: 5.1, W: 1.98, y0: 0.38, belt: 1.12, roof: 2.35, nose: 1.0, tail: 2.25, cf: 1.45, cb: -2.5, wb: 1.7, wr: 0.38, van: true },
};

// rounded side-profile shape (u = along the car, +front; v = height), with arches over the wheels
function profile(pts, arches, wr, y0) {
  const s = new THREE.Shape();
  const [first, ...rest] = pts;
  s.moveTo(first[0], first[1]);
  for (const p of rest) {
    if (p.length === 4) s.quadraticCurveTo(p[0], p[1], p[2], p[3]); else s.lineTo(p[0], p[1]);
  }
  // bottom edge from the front back to the rear, cutting the wheel arches
  for (const az of [...arches].sort((a, b) => b - a)) {
    s.lineTo(az + wr + 0.08, y0);
    s.absarc(az, y0, wr + 0.08, 0, Math.PI, false);
  }
  s.closePath();
  return s;
}
function extrudeX(shape, width, bevel = 0.06, segs = 3) {
  const d = Math.max(0.02, width - bevel * 2);
  const g = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelOffset: -bevel, bevelSegments: 2, curveSegments: segs });
  g.rotateY(-Math.PI / 2); g.translate(d / 2, 0, 0);
  return g;
}
const box = (sx, sy, sz, x, y, z, ry = 0, rx = 0) => { const g = new THREE.BoxGeometry(sx, sy, sz); if (rx) g.rotateX(rx); if (ry) g.rotateY(ry); g.translate(x, y, z); return g; };
const toNI = (g) => (g.index ? g.toNonIndexed() : g);
const merge = (list) => mergeGeometries(list.map((g) => { const n = toNI(g); for (const k of Object.keys(n.attributes)) if (k !== 'position' && k !== 'normal') n.deleteAttribute(k); return n; }));

// build all parts of one model: { paint, glass, dark, chrome, light (white), hl, tl, plate, tyre, rim, wheels:[[x,z]], wr }
const CACHE = {};
export function carParts(kind) {
  if (CACHE[kind]) return CACHE[kind];
  const S = SPEC[kind] || SPEC.sedan, hl = S.L / 2, hw = S.W / 2, y0 = S.y0;
  const P = { paint: [], glass: [], dark: [], chrome: [], light: [], hl: [], tl: [], plate: [], trim: [] };
  const fz = hl, bz = -hl, arches = [S.wb, -S.wb];
  // ---- lower body
  let low;
  if (S.van) low = [[bz + 0.05, y0], [bz - 0.02, S.roof - 0.15, bz + 0.1, S.roof], [fz - 0.8, S.roof], [fz - 0.3, S.belt + 0.35], [fz - 0.08, S.belt + 0.15, fz - 0.02, S.nose - 0.05], [fz + 0.04, y0 + 0.15, fz - 0.05, y0]];
  else low = [[bz + 0.05, y0], [bz - 0.02, S.tail - 0.12, bz + 0.08, S.tail], [S.cb - 0.15, S.belt], [S.cf + 0.1, S.belt], [fz - 0.25, S.nose + 0.05, fz - 0.05, S.nose - 0.05], [fz + 0.04, y0 + 0.15, fz - 0.05, y0]];
  if (S.bed) low = [[bz + 0.05, y0], [bz - 0.02, S.tail - 0.1, bz + 0.06, S.tail], [S.cb - 0.05, S.tail], [S.cb - 0.05, S.belt], [S.cf + 0.1, S.belt], [fz - 0.25, S.nose + 0.05, fz - 0.05, S.nose - 0.05], [fz + 0.04, y0 + 0.15, fz - 0.05, y0]];
  P.paint.push(extrudeX(profile(low, arches, S.wr, y0), S.W, 0.07, 4));
  // ---- greenhouse (glass) + roof + pillars
  if (!S.van) {
    const rf = S.cf - (S.roof - S.belt) * 1.25, rb = S.hatch ? S.cb + 0.18 : S.cb + (S.roof - S.belt) * 0.85;
    const gh = new THREE.Shape(); gh.moveTo(S.cb, S.belt - 0.02); gh.lineTo(S.cf, S.belt - 0.02); gh.lineTo(rf, S.roof - 0.04); gh.lineTo(rb, S.roof - 0.04); gh.closePath();
    P.glass.push(extrudeX(gh, S.W - 0.26, 0.03, 1));
    P.paint.push(box(S.W - 0.2, 0.08, rf - rb + 0.06, 0, S.roof - 0.02, (rf + rb) / 2));
    const pil = (za, ya, zb, yb, t = 0.09) => { const dz = zb - za, dy = yb - ya, l = Math.hypot(dz, dy); for (const s of [-1, 1]) P.paint.push(box(0.05, l, t, s * (hw - 0.115), (ya + yb) / 2, (za + zb) / 2, 0, Math.atan2(dz, dy))); };
    pil(S.cf, S.belt, rf, S.roof - 0.02, 0.1);                 // A
    const mid = (S.cf + S.cb) / 2 - 0.1; pil(mid, S.belt, mid, S.roof - 0.02, 0.12);   // B
    pil(S.cb, S.belt, rb, S.roof - 0.02, S.hatch ? 0.22 : 0.14);   // C
    // windscreen frame top/bottom bars
    P.dark.push(box(S.W - 0.3, 0.05, 0.08, 0, S.belt + 0.01, S.cf - 0.02));
  } else {
    // van: one tall body; windscreen and cab windows sit proud of it
    const au = fz - 0.8, av = S.roof - 0.08, bu = fz - 0.32, bv = S.belt + 0.38, du = bu - au, dv = bv - av, l = Math.hypot(du, dv);
    const nu = -dv / l, nv = du / l;   // outward normal (front/up)
    P.glass.push(box(S.W - 0.34, l * 0.92, 0.03, 0, (av + bv) / 2 + nv * 0.018, (au + bu) / 2 + nu * 0.018, 0, Math.atan2(du, dv)));
    for (const s of [-1, 1]) P.glass.push(box(0.03, 0.5, 0.75, s * (hw + 0.006), S.roof - 0.48, fz - 1.15));
    P.trim.push(...[-1, 1].map((s) => box(0.02, 0.5, 3.2, s * (hw + 0.012), S.tail + 0.55, -0.6)));     // livery band
    P.dark.push(box(0.02, S.roof - S.belt - 0.15, 0.03, hw + 0.012, (S.roof + S.belt) / 2, -0.6));    // sliding door seam
  }
  // ---- pickup bed walls
  if (S.bed) {
    const wt = S.belt + 0.12 - S.tail;
    for (const s of [-1, 1]) P.paint.push(box(0.08, wt, S.cb - bz - 0.12, s * (hw - 0.045), S.tail + wt / 2, (S.cb + bz) / 2 + 0.02));
    P.paint.push(box(S.W - 0.18, wt, 0.08, 0, S.tail + wt / 2, bz + 0.1));
    P.dark.push(box(S.W - 0.2, 0.04, S.cb - bz - 0.25, 0, S.tail + 0.01, (S.cb + bz) / 2));
  }
  // ---- bumpers, grille, lights, plates
  const by = y0 + 0.17;
  P.dark.push(box(S.W + 0.03, 0.22, 0.2, 0, by, fz - 0.03), box(S.W + 0.03, 0.22, 0.2, 0, by, bz + 0.05));
  const gy = S.van ? S.nose - 0.12 : S.nose - 0.16;
  P.dark.push(box(S.W * 0.42, 0.16, 0.06, 0, gy, fz + 0.005));
  P.chrome.push(box(S.W * 0.46, 0.03, 0.065, 0, gy + 0.095, fz + 0.002), box(S.W * 0.46, 0.03, 0.065, 0, gy - 0.095, fz + 0.002));
  for (const s of [-1, 1]) {
    P.hl.push(box(0.36, 0.13, 0.08, s * (hw - 0.3), gy + 0.02, fz - 0.005));
    P.light.push(box(0.12, 0.05, 0.05, s * (hw - 0.14), by + 0.02, fz + 0.08));          // fog / indicator
    P.tl.push(box(0.36, 0.14, 0.07, s * (hw - 0.26), S.tail - 0.14, bz + 0.02));
  }
  P.plate.push(box(0.52, 0.13, 0.03, 0, by, fz + 0.075), box(0.52, 0.13, 0.03, 0, S.tail - 0.32, bz - 0.005));
  // ---- mirrors, door seams, handles, side skirts
  for (const s of [-1, 1]) {
    const mz = S.van ? fz - 0.7 : S.cf - 0.05, my = S.belt + (S.van ? 0.3 : 0.07);
    P.paint.push(box(0.14, 0.11, 0.16, s * (hw + 0.07), my, mz));
    P.dark.push(box(0.06, 0.03, 0.05, s * (hw + 0.02), my - 0.02, mz));
    if (!S.van) {
      const mid = (S.cf + S.cb) / 2 - 0.1;
      P.dark.push(box(0.012, S.belt - y0 - 0.32, 0.02, s * (hw + 0.004), (S.belt + y0 + 0.2) / 2, mid));
      if (!S.bed) P.dark.push(box(0.012, S.belt - y0 - 0.32, 0.02, s * (hw + 0.004), (S.belt + y0 + 0.2) / 2, S.cf + 0.05));
      for (const z of [mid + 0.35, S.bed ? null : mid - 0.75].filter((v) => v !== null)) P.chrome.push(box(0.03, 0.035, 0.16, s * (hw + 0.012), S.belt - 0.12, z));
    }
    P.dark.push(box(0.04, 0.1, S.wb * 2 - S.wr * 2 - 0.3, s * (hw - 0.01), y0 + 0.08, 0));
  }
  if (S.rack) for (const s of [-1, 1]) P.dark.push(box(0.05, 0.05, 1.6, s * (hw - 0.3), S.roof + 0.06, -0.55));
  if (kind === 'taxi') { P.light.push(box(0.62, 0.2, 0.26, 0, S.roof + 0.11, -0.35)); P.dark.push(box(0.66, 0.04, 0.3, 0, S.roof + 0.02, -0.35)); for (const s of [-1, 1]) P.trim.push(box(0.015, 0.09, 2.6, s * (hw + 0.008), S.belt - 0.22, -0.15)); }
  // ---- wheels (built once, positioned per car)
  const tyre = new THREE.CylinderGeometry(S.wr, S.wr, 0.26, 18); tyre.rotateZ(Math.PI / 2);
  const rim = new THREE.CylinderGeometry(S.wr * 0.62, S.wr * 0.62, 0.275, 12); rim.rotateZ(Math.PI / 2);
  const hub = new THREE.CylinderGeometry(S.wr * 0.18, S.wr * 0.18, 0.29, 8); hub.rotateZ(Math.PI / 2);
  const spokes = []; for (let i = 0; i < 5; i++) { const sp = new THREE.BoxGeometry(0.28, S.wr * 1.05, 0.06); sp.rotateX(i / 5 * Math.PI); spokes.push(sp); }
  const out = { S };
  for (const [k, list] of Object.entries(P)) out[k] = list.length ? merge(list) : null;
  out.tyre = tyre; out.rim = merge([rim, ...spokes]); out.hub = hub;
  out.wheels = [[hw - 0.15, S.wb], [-(hw - 0.15), S.wb], [hw - 0.15, -S.wb], [-(hw - 0.15), -S.wb]];
  return (CACHE[kind] = out);
}

// ---- a moving car: ONE vertex-coloured body mesh + head/brake light meshes (their glow changes),
// and wheels drawn for every car at once by a shared instanced mesh (see WheelSet)
const bodyCache = new Map();
const colored = (geo, hex) => { const g = toNI(geo).clone(); for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k); const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
function bodyGeo(kind, paint) {
  const key = kind + paint; if (bodyCache.has(key)) return bodyCache.get(key);
  const p = carParts(kind), list = [];
  for (const [part, hex] of [['paint', kind === 'taxi' ? '#f2b43c' : paint], ['glass', '#41678f'], ['dark', '#24262c'], ['chrome', '#d9dde2'], ['light', '#fff6dc'], ['plate', '#f4f1e8'], ['trim', kind === 'taxi' ? '#2b2550' : '#e4402b']]) if (p[part]) list.push(colored(p[part], hex));
  const g = mergeGeometries(list); g.computeBoundingSphere(); bodyCache.set(key, g); return g;
}
const bodyMat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: gradient });
export function carModel(col, kind = 'sedan') {
  const p = carParts(kind), g = new THREE.Group();
  const body = new THREE.Mesh(bodyGeo(kind, col), bodyMat); body.castShadow = true; body.receiveShadow = true; g.add(body);
  const hl = new THREE.MeshToonMaterial({ color: 0xfff6dc, emissive: 0xfff2c8, emissiveIntensity: 0.2, gradientMap: gradient });
  const tl = new THREE.MeshToonMaterial({ color: 0xc8262a, emissive: 0xff2a2a, emissiveIntensity: 0.2, gradientMap: gradient });
  g.add(new THREE.Mesh(p.hl, hl), new THREE.Mesh(p.tl, tl));
  const wheels = p.wheels.map(([x, z]) => { const w = new THREE.Object3D(); w.position.set(x, p.S.wr, z); w.userData.wr = p.S.wr; g.add(w); return w; });
  return { g, wheels, hl, tl };
}
// every traffic wheel in one draw call
export class WheelSet {
  constructor(scene, max) {
    const R = 0.36, tyre = new THREE.CylinderGeometry(R, R, 0.26, 18).rotateZ(Math.PI / 2), rim = new THREE.CylinderGeometry(R * 0.62, R * 0.62, 0.275, 12).rotateZ(Math.PI / 2), hub = new THREE.CylinderGeometry(R * 0.18, R * 0.18, 0.29, 8).rotateZ(Math.PI / 2);
    const spokes = []; for (let i = 0; i < 5; i++) spokes.push(colored(new THREE.BoxGeometry(0.28, R * 1.05, 0.06).rotateX(i / 5 * Math.PI), '#c9ced6'));
    const geo = mergeGeometries([colored(tyre, '#1d1e22'), colored(rim, '#c9ced6'), colored(hub, '#8b919c'), ...spokes]);
    this.im = new THREE.InstancedMesh(geo, bodyMat, max); this.im.castShadow = true; this.im.frustumCulled = false; this.im.count = 0; scene.add(this.im);
    this.m = new THREE.Matrix4(); this.s = new THREE.Matrix4(); this.R = R;
  }
  sync(cars) {
    let n = 0;
    for (const car of cars) {
      if (!car.m.g.visible) continue;
      car.m.g.updateMatrixWorld(true);
      for (const w of car.m.wheels) { const k = w.userData.wr / this.R; this.m.multiplyMatrices(w.matrixWorld, this.s.makeScale(1, k, k)); this.im.setMatrixAt(n++, this.m); }
    }
    this.im.count = n; this.im.instanceMatrix.needsUpdate = true;
  }
}

// ---- a parked car baked into the world batch (B.geo) — same geometry, vertex colours + batch kinds
export function carIntoBatch(B, lin, x, y, z, ry, col, kind) {
  const p = carParts(kind), m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(1, 1, 1));
  const put = (geo, c, k = 0) => { if (geo) B.geo(geo, m, lin(c), k); };
  put(p.paint, kind === 'taxi' ? '#f2b43c' : col); put(p.glass, '#6f9ccc', 5); put(p.dark, '#24262c'); put(p.chrome, '#d9dde2', 10);
  put(p.light, '#fff6dc'); put(p.plate, '#f4f1e8'); put(p.trim, kind === 'taxi' ? '#2b2550' : '#e4402b'); put(p.hl, '#fff3d6'); put(p.tl, '#c8262a');
  for (const [wx, wz] of p.wheels) {
    const wm = new THREE.Matrix4().makeTranslation(wx, p.S.wr, wz).premultiply(m);
    B.geo(p.tyre, wm, lin('#1d1e22'), 0); B.geo(p.rim, wm, lin('#c9ced6'), 10); B.geo(p.hub, wm, lin('#8b919c'), 0);
  }
  return p.S;
}
