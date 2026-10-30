// city.js — procedural buildings on the real Montreal street grid, merged per 800 m tile.
// Every building is an axis-aligned stack of boxes that only ever TOUCH (never overlap), so no two
// faces can share a plane and fight for depth. A coplanar audit runs at the end and is reported.
import * as THREE from 'three';
import {
  DOM, TILE, TILES_U, LAT, D, lineU, lineV, hwU, hwV, SIDEWALK, ALLEY_HW, ART_U, ART_V, district, waterSDF, parkSDF,
  forestSDF, roadSDF, terrainH, mulberry, hash2, BOXES, excludedRect,
} from './core.js';
import { facadeMaterial, STYLE } from './shaders.js';

// ---------------------------------------------------------------- growable typed buffers
class FBuf {
  constructor(n = 4096) { this.a = new Float32Array(n); this.n = 0; }
  push(...v) { if (this.n + v.length > this.a.length) { const b = new Float32Array(Math.max(this.a.length * 2, this.n + v.length)); b.set(this.a); this.a = b; } for (const x of v) this.a[this.n++] = x; }
  arr() { return this.a.slice(0, this.n); }
}
class IBuf {
  constructor(n = 4096) { this.a = new Uint32Array(n); this.n = 0; }
  push(...v) { if (this.n + v.length > this.a.length) { const b = new Uint32Array(this.a.length * 2); b.set(this.a); this.a = b; } for (const x of v) this.a[this.n++] = x; }
  arr() { return this.a.slice(0, this.n); }
}
class TileGeo {
  constructor(cu, cv) { this.cu = cu; this.cv = cv; this.pos = new FBuf(); this.nrm = new FBuf(); this.uv = new FBuf(); this.col = new FBuf(); this.b0 = new FBuf(); this.b1 = new FBuf(); this.idx = new IBuf(); this.vc = 0; }
}
const tiles = new Map();
function tileFor(u, v) {
  const ti = Math.max(0, Math.min(TILES_U - 1, Math.floor((u - DOM.U0) / TILE)));
  const tj = Math.max(0, Math.min(TILES_U - 1, Math.floor((v - DOM.V0) / TILE)));
  const k = ti * 100 + tj;
  let t = tiles.get(k);
  if (!t) tiles.set(k, t = new TileGeo(DOM.U0 + (ti + 0.5) * TILE, DOM.V0 + (tj + 0.5) * TILE));
  return t;
}
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();
// polygon (3 or 4 points, world coords) with outward normal n; winding fixed automatically
function poly(T, pts, n, uvs, P) {
  _a.set(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1], pts[1][2] - pts[0][2]);
  _b.set(pts[2][0] - pts[0][0], pts[2][1] - pts[0][1], pts[2][2] - pts[0][2]);
  _c.crossVectors(_a, _b);
  const flip = _c.x * n[0] + _c.y * n[1] + _c.z * n[2] < 0;
  const base = T.vc;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    T.pos.push(p[0] - T.cu, p[1], p[2] + T.cv);
    T.nrm.push(n[0], n[1], n[2]);
    T.uv.push(uvs[i][0], uvs[i][1]);
    T.col.push(P.col[0], P.col[1], P.col[2]);
    T.b0.push(P.seed, P.style, P.floorH, P.shopH);
    T.b1.push(P.topH, P.grp, P.lit, P.roof);
  }
  T.vc += pts.length;
  if (pts.length === 3) flip ? T.idx.push(base, base + 2, base + 1) : T.idx.push(base, base + 1, base + 2);
  else flip ? T.idx.push(base, base + 2, base + 1, base, base + 3, base + 2) : T.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
}

export const STATS = { buildings: 0, boxes: 0, overlaps: 0, stairs: 0 };
export const STAIRS = [];        // outdoor staircases + balconies (instanced near the camera)
export const TREE_SLOTS = [];    // street / yard trees: [u, v, scale, type]
export const LAMP_SLOTS = [];    // street lamps: [u, v, facingU, facingV, old]

// ---------------------------------------------------------------- box with walls + roof
// b = {u0,u1,v0,v1,y0,y1,base, style, seed, floorH, shopH, bayW, grp, lit, col, roof:'flat'|'mansard'|'gable'|'hip', roofCol, walls:[w,e,s,n]}
export function addBox(b) {
  const T = tileFor((b.u0 + b.u1) / 2, (b.v0 + b.v1) / 2);
  const P = { col: b.col, seed: b.seed, style: b.style, floorH: b.floorH || 3.3, shopH: b.shopH || 0, topH: b.y1 - b.base, grp: b.grp || 1, lit: b.lit ?? 0.6, roof: 0 };
  const x0 = b.u0, x1 = b.u1, z0 = -b.v1, z1 = -b.v0, y0 = b.y0, y1 = b.y1;
  const bayW = b.bayW || 3.6;
  const wall = (ax, az, bx, bz, nx, nz, len) => {
    const nb = Math.max(1, Math.round(len / bayW));
    poly(T, [[ax, y0, az], [bx, y0, bz], [bx, y1, bz], [ax, y1, az]], [nx, 0, nz],
      [[0, y0 - b.base], [nb, y0 - b.base], [nb, y1 - b.base], [0, y1 - b.base]], P);
  };
  const W = b.walls || [1, 1, 1, 1];
  if (W[0]) wall(x0, z0, x0, z1, -1, 0, z1 - z0);
  if (W[1]) wall(x1, z1, x1, z0, 1, 0, z1 - z0);
  if (W[2]) wall(x1, z1, x0, z1, 0, 1, x1 - x0);   // v0 side (faces +z)
  if (W[3]) wall(x0, z0, x1, z0, 0, -1, x1 - x0);  // v1 side (faces -z)
  const R = Object.assign({}, P, { roof: 1, col: b.roofCol || [0.3, 0.3, 0.32] });
  const roof = b.roof || 'flat';
  const ruv = (x, z) => [x * 0.5, z * 0.5];
  let roofY = y1;
  if (roof === 'flat') {
    // parapet: walls rise past the roof, which sits lower; inner faces close it (opposite-facing, never fight)
    const pH = b.parapet ? Math.min(b.parapet, (y1 - y0) * 0.2) : 0;
    roofY = y1 - pH;
    if (pH > 0) {
      const inner = (ax, az, bx, bz, nx, nz, len) => {
        const nb = Math.max(1, Math.round(len / bayW));
        poly(T, [[ax, roofY, az], [bx, roofY, bz], [bx, y1, bz], [ax, y1, az]], [nx, 0, nz], [[0, roofY - b.base], [nb, roofY - b.base], [nb, y1 - b.base], [0, y1 - b.base]], Object.assign({}, P, { col: [P.col[0] * 0.8, P.col[1] * 0.8, P.col[2] * 0.8] }));
      };
      if (W[0]) inner(x0, z1, x0, z0, 1, 0, z1 - z0);
      if (W[1]) inner(x1, z0, x1, z1, -1, 0, z1 - z0);
      if (W[2]) inner(x0, z1, x1, z1, 0, -1, x1 - x0);
      if (W[3]) inner(x1, z0, x0, z0, 0, 1, x1 - x0);
    }
    poly(T, [[x0, roofY, z0], [x1, roofY, z0], [x1, roofY, z1], [x0, roofY, z1]], [0, 1, 0], [ruv(x0, z0), ruv(x1, z0), ruv(x1, z1), ruv(x0, z1)], R);
  } else if (roof === 'mansard') {
    const d = Math.min(2.4, (x1 - x0) * 0.2, (z1 - z0) * 0.2), rh = b.roofH || 4.2, yt = y1 + rh;
    const ix0 = x0 + d, ix1 = x1 - d, iz0 = z0 + d, iz1 = z1 - d;
    const s = Math.hypot(d, rh), ny = d / s, nh = rh / s;
    poly(T, [[x0, y1, z0], [x1, y1, z0], [ix1, yt, iz0], [ix0, yt, iz0]], [0, ny, -nh], [ruv(x0, 0), ruv(x1, 0), ruv(ix1, 3), ruv(ix0, 3)], R);
    poly(T, [[x1, y1, z1], [x0, y1, z1], [ix0, yt, iz1], [ix1, yt, iz1]], [0, ny, nh], [ruv(x1, 0), ruv(x0, 0), ruv(ix0, 3), ruv(ix1, 3)], R);
    poly(T, [[x0, y1, z1], [x0, y1, z0], [ix0, yt, iz0], [ix0, yt, iz1]], [-nh, ny, 0], [ruv(z1, 0), ruv(z0, 0), ruv(iz0, 3), ruv(iz1, 3)], R);
    poly(T, [[x1, y1, z0], [x1, y1, z1], [ix1, yt, iz1], [ix1, yt, iz0]], [nh, ny, 0], [ruv(z0, 0), ruv(z1, 0), ruv(iz1, 3), ruv(iz0, 3)], R);
    poly(T, [[ix0, yt, iz0], [ix1, yt, iz0], [ix1, yt, iz1], [ix0, yt, iz1]], [0, 1, 0], [ruv(ix0, iz0), ruv(ix1, iz0), ruv(ix1, iz1), ruv(ix0, iz1)], Object.assign({}, R, { col: [0.25, 0.25, 0.26] }));
  } else if (roof === 'gable' || roof === 'hip') {
    const alongX = (x1 - x0) >= (z1 - z0);
    const span = alongX ? (z1 - z0) : (x1 - x0), rh = b.roofH || span * 0.38, yt = y1 + rh;
    const s = Math.hypot(span / 2, rh), ny = (span / 2) / s, nh = rh / s;
    if (roof === 'gable') {
      if (alongX) {
        const zm = (z0 + z1) / 2;
        poly(T, [[x0, y1, z0], [x1, y1, z0], [x1, yt, zm], [x0, yt, zm]], [0, ny, -nh], [ruv(x0, 0), ruv(x1, 0), ruv(x1, 4), ruv(x0, 4)], R);
        poly(T, [[x1, y1, z1], [x0, y1, z1], [x0, yt, zm], [x1, yt, zm]], [0, ny, nh], [ruv(x1, 0), ruv(x0, 0), ruv(x0, 4), ruv(x1, 4)], R);
        const nb = Math.max(1, Math.round((z1 - z0) / bayW));
        poly(T, [[x0, y1, z1], [x0, y1, z0], [x0, yt, zm]], [-1, 0, 0], [[0, y1 - b.base], [nb, y1 - b.base], [nb / 2, yt - b.base]], P);
        poly(T, [[x1, y1, z0], [x1, y1, z1], [x1, yt, zm]], [1, 0, 0], [[0, y1 - b.base], [nb, y1 - b.base], [nb / 2, yt - b.base]], P);
      } else {
        const xm = (x0 + x1) / 2;
        poly(T, [[x0, y1, z1], [x0, y1, z0], [xm, yt, z0], [xm, yt, z1]], [-nh, ny, 0], [ruv(z1, 0), ruv(z0, 0), ruv(z0, 4), ruv(z1, 4)], R);
        poly(T, [[x1, y1, z0], [x1, y1, z1], [xm, yt, z1], [xm, yt, z0]], [nh, ny, 0], [ruv(z0, 0), ruv(z1, 0), ruv(z1, 4), ruv(z0, 4)], R);
        const nb = Math.max(1, Math.round((x1 - x0) / bayW));
        poly(T, [[x1, y1, z1], [x0, y1, z1], [xm, yt, z1]], [0, 0, 1], [[0, y1 - b.base], [nb, y1 - b.base], [nb / 2, yt - b.base]], P);
        poly(T, [[x0, y1, z0], [x1, y1, z0], [xm, yt, z0]], [0, 0, -1], [[0, y1 - b.base], [nb, y1 - b.base], [nb / 2, yt - b.base]], P);
      }
    } else {
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, ins = span / 2;
      const r0 = alongX ? [x0 + ins, yt, cz] : [cx, yt, z0 + ins], r1 = alongX ? [x1 - ins, yt, cz] : [cx, yt, z1 - ins];
      if (alongX) {
        poly(T, [[x0, y1, z0], [x1, y1, z0], r1, r0], [0, ny, -nh], [ruv(x0, 0), ruv(x1, 0), ruv(r1[0], 4), ruv(r0[0], 4)], R);
        poly(T, [[x1, y1, z1], [x0, y1, z1], r0, r1], [0, ny, nh], [ruv(x1, 0), ruv(x0, 0), ruv(r0[0], 4), ruv(r1[0], 4)], R);
        poly(T, [[x0, y1, z1], [x0, y1, z0], r0], [-nh, ny, 0], [ruv(z1, 0), ruv(z0, 0), ruv(cz, 4)], R);
        poly(T, [[x1, y1, z0], [x1, y1, z1], r1], [nh, ny, 0], [ruv(z0, 0), ruv(z1, 0), ruv(cz, 4)], R);
      } else {
        poly(T, [[x0, y1, z1], [x0, y1, z0], r0, r1], [-nh, ny, 0], [ruv(z1, 0), ruv(z0, 0), ruv(r0[2], 4), ruv(r1[2], 4)], R);
        poly(T, [[x1, y1, z0], [x1, y1, z1], r1, r0], [nh, ny, 0], [ruv(z0, 0), ruv(z1, 0), ruv(r1[2], 4), ruv(r0[2], 4)], R);
        poly(T, [[x1, y1, z1], [x0, y1, z1], r1], [0, ny, nh], [ruv(x1, 0), ruv(x0, 0), ruv(cx, 4)], R);
        poly(T, [[x0, y1, z0], [x1, y1, z0], r0], [0, ny, -nh], [ruv(x0, 0), ruv(x1, 0), ruv(cx, 4)], R);
      }
    }
  }
  STATS.boxes++;
  BOXES.add({ x0, x1, z0, z1, y0: b.indexY0 ?? b.y0, y1: b.y1 });
  return roofY;
}

// ---------------------------------------------------------------- lot helpers
function landOK(u, v) {
  return waterSDF(u, v) > 3 && parkSDF(u, v) < -1.5 && forestSDF(u, v) < -1.5 && roadSDF(u, v) < -2.5;
}
function lotOK(u0, u1, v0, v1, dset) {
  if (u1 - u0 < 4 || v1 - v0 < 4) return false;
  if (excludedRect(u0, u1, v0, v1)) return false;
  const nu = Math.max(1, Math.ceil((u1 - u0) / 25)), nv = Math.max(1, Math.ceil((v1 - v0) / 25));
  for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) {
    const u = u0 + (u1 - u0) * i / nu, v = v0 + (v1 - v0) * j / nv;
    if (!landOK(u, v)) return false;
    if (dset && !dset.has(district(u, v))) return false;
  }
  return true;
}
function groundMin(u0, u1, v0, v1) {
  let lo = Infinity, hi = -Infinity;
  for (const [u, v] of [[u0, v0], [u1, v0], [u0, v1], [u1, v1], [(u0 + u1) / 2, (v0 + v1) / 2]]) { const h = terrainH(u, v); lo = Math.min(lo, h); hi = Math.max(hi, h); }
  return [lo, hi];
}
// a whole building: optional podium, main shaft, optional crown setback. Boxes only touch.
function building(o, rnd) {
  const [lo, hi] = groundMin(o.u0, o.u1, o.v0, o.v1);
  const base = hi;                         // ground floor at the highest corner (walls go below)
  const y0 = lo - 2.5;
  const common = { style: o.style, seed: rnd() * 100, floorH: o.floorH, bayW: o.bayW, grp: o.grp, lit: o.lit, col: o.col, base, roofCol: o.roofCol, shopH: o.shopH };
  let top = base + o.h;
  const par = o.h > 40 ? 1.2 : 0.8;
  let fp = [o.u0, o.u1, o.v0, o.v1], roofY;
  if (o.podium && o.h > o.podium + 20) {
    const ph = base + o.podium;
    addBox(Object.assign({}, common, { u0: o.u0, u1: o.u1, v0: o.v0, v1: o.v1, y0, y1: ph, roof: 'flat', style: o.podiumStyle ?? o.style }));
    const ins = o.inset || 6;
    const tu0 = o.u0 + ins * (0.5 + rnd()), tu1 = o.u1 - ins * (0.5 + rnd()), tv0 = o.v0 + ins * (0.5 + rnd()), tv1 = o.v1 - ins * (0.5 + rnd());
    if (o.crown && o.h > 70) {
      const ch = ph + (top - ph) * (0.82 + rnd() * 0.08);
      addBox(Object.assign({}, common, { u0: tu0, u1: tu1, v0: tv0, v1: tv1, y0: ph, y1: ch, roof: 'flat', walls: [1, 1, 1, 1], shopH: 0 }));
      const ci = 2 + rnd() * 3;
      fp = [tu0 + ci, tu1 - ci, tv0 + ci, tv1 - ci];
      roofY = addBox(Object.assign({}, common, { u0: fp[0], u1: fp[1], v0: fp[2], v1: fp[3], y0: ch, y1: top, roof: o.roof || 'flat', shopH: 0, parapet: par }));
    } else {
      fp = [tu0, tu1, tv0, tv1];
      roofY = addBox(Object.assign({}, common, { u0: tu0, u1: tu1, v0: tv0, v1: tv1, y0: ph, y1: top, roof: o.roof || 'flat', shopH: 0, parapet: par }));
    }
  } else {
    roofY = addBox(Object.assign({}, common, { u0: o.u0, u1: o.u1, v0: o.v0, v1: o.v1, y0, y1: top, roof: o.roof || 'flat', roofH: o.roofH, parapet: par }));
  }
  // rooftop mechanical penthouse on mid/high-rises
  if ((o.roof || 'flat') === 'flat' && o.h > 22 && rnd() < 0.6) {
    const w = fp[1] - fp[0], d = fp[3] - fp[2];
    const pw = w * (0.25 + rnd() * 0.2), pd = d * (0.25 + rnd() * 0.2);
    const cu = fp[0] + w * (0.3 + rnd() * 0.4), cv = fp[2] + d * (0.3 + rnd() * 0.4);
    if (pw > 3 && pd > 3) addBox(Object.assign({}, common, { u0: cu - pw / 2, u1: cu + pw / 2, v0: cv - pd / 2, v1: cv + pd / 2, y0: roofY, y1: top + 2 + rnd() * 3, roof: 'flat', style: STYLE.CONCRETE, col: [0.55, 0.55, 0.54], shopH: 0, lit: 0.1, indexY0: top }));
  }
  STATS.buildings++;
  return { base, top };
}

// ---------------------------------------------------------------- palettes
const BRICK = [[0.55, 0.27, 0.19], [0.62, 0.33, 0.22], [0.50, 0.30, 0.24], [0.66, 0.42, 0.30], [0.45, 0.22, 0.17], [0.70, 0.55, 0.40]];
const STONE = [[0.62, 0.60, 0.56], [0.56, 0.55, 0.52], [0.66, 0.63, 0.57], [0.52, 0.50, 0.47]];
const CONC = [[0.58, 0.57, 0.55], [0.50, 0.50, 0.50], [0.64, 0.62, 0.58], [0.42, 0.42, 0.44]];
const GLASSC = [[0.30, 0.38, 0.42], [0.24, 0.30, 0.34], [0.36, 0.40, 0.42], [0.20, 0.26, 0.28]];
const ROOFS = [[0.24, 0.26, 0.28], [0.22, 0.20, 0.20], [0.32, 0.50, 0.44], [0.30, 0.24, 0.20]];
const pick = (a, r) => a[Math.floor(r() * a.length) % a.length];

// ---------------------------------------------------------------- district generators
function plexRows(k, m, b, rnd, dist) {
  const artW = ART_U[k] !== undefined, artE = ART_U[k + 1] !== undefined;
  const half = (b.u1 - b.u0) / 2 - ALLEY_HW;
  for (const side of [0, 1]) {
    const art = side ? artE : artW;
    const commercial = art && rnd() < 0.85;
    const setback = commercial ? 0 : 1.8 + rnd() * 2.4;
    let depth = commercial ? 15 + rnd() * 4 : 11 + rnd() * 4;
    depth = Math.min(depth, half - setback - 1);
    if (depth < 7) continue;
    const u0 = side ? b.u1 - setback - depth : b.u0 + setback, u1 = u0 + depth;
    const front = side ? u1 : u0;   // street-facing wall
    let v = b.v0;
    const L = b.v1 - b.v0;
    while (v < b.v1 - 6) {
      const pw = 7.2 + rnd() * 0.8;
      let n = 2 + Math.floor(rnd() * 4);
      let len = n * pw;
      if (b.v1 - (v + len) < pw * 1.2) { len = b.v1 - v; n = Math.max(1, Math.round(len / pw)); }
      const gap = !commercial && rnd() < 0.06;
      if (!gap && lotOK(u0, u1, v, v + len, null)) {
        const r = rnd();
        const floors = commercial ? 3 + (r < 0.4 ? 1 : 0) : (r < 0.33 ? 2 : r < 0.9 ? 3 : 4);
        const grey = dist === D.PLEX && rnd() < 0.16;
        const style = grey ? STYLE.GREYSTONE : (dist === D.SUDOUEST && rnd() < 0.15 ? STYLE.WAREHOUSE : STYLE.PLEX);
        const col = grey ? pick(STONE, rnd) : pick(BRICK, rnd);
        const h = floors * 3.15 + 0.7 + (commercial ? 1.2 : 0);
        const { base } = building({ u0, u1, v0: v, v1: v + len, h, style, floorH: 3.15, bayW: len / (n * 2), grp: 2, lit: 0.75, col, shopH: commercial ? 4.2 : 0 }, rnd);
        if (!commercial) {
          const dir = side ? 1 : -1;
          for (let i = 0; i < n; i++) {
            const pv = v + (i + 0.5) * (len / n);
            if (setback >= 1.6 && rnd() < 0.82) STAIRS.push([front, pv + (rnd() < 0.5 ? -1 : 1) * len / n * 0.22, base, dir, floors, setback]);
            if (rnd() < 0.22) TREE_SLOTS.push([side ? u0 - (half - depth - setback) * 0.5 - 2 : u1 + (half - depth - setback) * 0.5 + 2, pv, 0.8 + rnd() * 0.5, 0]);
          }
        }
      }
      v += len;
    }
  }
}
function houses(k, m, b, rnd, dist) {
  for (const side of [0, 1]) {
    let v = b.v0 + 2;
    while (v < b.v1 - 10) {
      const fw = 11 + rnd() * 7, depth = 10 + rnd() * 5, setback = 5 + rnd() * 4, gap = 3 + rnd() * 4;
      const u0 = side ? b.u1 - setback - depth : b.u0 + setback, u1 = u0 + depth;
      if (v + fw > b.v1) break;
      if (lotOK(u0, u1, v, v + fw, null)) {
        const stone = dist === D.HOUSES && rnd() < 0.35;
        const floors = dist === D.SOUTH && rnd() < 0.45 ? 1 : 2 + (rnd() < 0.25 ? 1 : 0);
        const roof = rnd() < 0.6 ? 'gable' : 'hip';
        building({ u0, u1, v0: v, v1: v + fw, h: floors * 3.0 + 0.4, style: stone ? STYLE.GREYSTONE : STYLE.HOUSE, floorH: 3.0, bayW: 3.4, grp: 2, lit: 0.6,
          col: stone ? pick(STONE, rnd) : (rnd() < 0.5 ? pick(BRICK, rnd) : [0.78, 0.76, 0.70]), roof, roofCol: pick(ROOFS, rnd), roofH: 2.6 + rnd() * 1.4 }, rnd);
        TREE_SLOTS.push([side ? u0 - setback * 0.5 : u1 + setback * 0.5, v + fw * rnd(), 1 + rnd() * 0.5, rnd() < 0.25 ? 1 : 0]);
        if (rnd() < 0.7) TREE_SLOTS.push([(b.u0 + b.u1) / 2 + (rnd() - 0.5) * 8, v + fw * 0.5, 1 + rnd() * 0.6, rnd() < 0.2 ? 1 : 0]);
      }
      v += fw + gap;
    }
  }
}
function towerBlock(k, m, b, rnd, dist, opts) {
  const W = b.u1 - b.u0, L = b.v1 - b.v0;
  const nu = W > 70 && rnd() < 0.6 ? 2 : 1;
  const nv = L > 110 ? (rnd() < 0.5 ? 3 : 2) : (L > 60 ? 2 : 1);
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
    const u0 = b.u0 + W * i / nu + (i ? 1 : 0), u1 = b.u0 + W * (i + 1) / nu - (i < nu - 1 ? 1 : 0);
    const v0 = b.v0 + L * j / nv + (j ? 1 : 0), v1 = b.v0 + L * (j + 1) / nv - (j < nv - 1 ? 1 : 0);
    if (!lotOK(u0, u1, v0, v1, null)) continue;
    const cu = (u0 + u1) / 2, cv = (v0 + v1) / 2;
    const r = rnd();
    const onSteCath = (m === 3 && j === 0) || (m + 1 === 3 && j === nv - 1);
    let h, style, col, podium = 0, crown = false, shopH = 0;
    if (dist === D.DOWNTOWN) {
      const dc = Math.hypot(cu * 0.8, cv - 60);
      const tall = 30 + 165 * Math.exp(-dc / 850) * (0.35 + 0.75 * rnd());
      if (onSteCath && r < 0.55) { h = 9 + rnd() * 14; style = rnd() < 0.5 ? STYLE.STONE : STYLE.PLEX; col = style === STYLE.STONE ? pick(STONE, rnd) : pick(BRICK, rnd); shopH = 4.6; }
      else if (r < 0.18) { h = 12 + rnd() * 20; style = rnd() < 0.5 ? STYLE.GREYSTONE : STYLE.STONE; col = pick(STONE, rnd); shopH = rnd() < 0.5 ? 4.4 : 0; }
      else {
        h = Math.min(185, tall);
        const s = rnd();
        style = s < 0.42 ? STYLE.GLASS : s < 0.62 ? STYLE.CONCRETE : s < 0.72 ? STYLE.BRUTAL : s < 0.8 ? STYLE.COPPERGLASS : s < 0.9 ? STYLE.ALU : STYLE.DARK;
        col = style === STYLE.GLASS || style === STYLE.COPPERGLASS ? pick(GLASSC, rnd) : pick(CONC, rnd);
        podium = h > 50 && rnd() < 0.75 ? 10 + rnd() * 14 : 0; crown = rnd() < 0.5; shopH = podium ? 4.5 : 0;
      }
    } else if (dist === D.QDS || dist === D.CDN) {
      h = dist === D.CDN ? (r < 0.12 ? 30 + rnd() * 40 : 10 + rnd() * 10) : (r < 0.25 ? 30 + rnd() * 40 : 12 + rnd() * 18);
      const s = rnd();
      style = h > 28 ? (s < 0.5 ? STYLE.CONCRETE : s < 0.75 ? STYLE.GLASS : STYLE.BRUTAL) : (s < 0.6 ? STYLE.PLEX : STYLE.STONE);
      col = style === STYLE.GLASS ? pick(GLASSC, rnd) : style === STYLE.PLEX ? pick(BRICK, rnd) : pick(CONC, rnd);
      shopH = onSteCath || ART_U[k] !== undefined ? 4.3 : 0;
    } else if (dist === D.NUNS) {
      if (r < 0.45) continue;
      h = 35 + rnd() * 60; style = rnd() < 0.5 ? STYLE.CONCRETE : STYLE.GLASS; col = style === STYLE.GLASS ? pick(GLASSC, rnd) : pick(CONC, rnd);
      const shrink = 0.25;
      const du = (u1 - u0) * shrink, dv = (v1 - v0) * shrink;
      building({ u0: u0 + du, u1: u1 - du, v0: v0 + dv, v1: v1 - dv, h, style, floorH: 3.0, bayW: 3.2, grp: 1, lit: 0.6, col }, rnd);
      TREE_SLOTS.push([u0 + 4, v0 + 4, 1.2, 0], [u1 - 4, v1 - 4, 1.2, 0], [u0 + 4, v1 - 4, 1.1, 1]);
      continue;
    } else if (dist === D.PORT) {
      h = 10 + rnd() * 8; style = STYLE.WAREHOUSE; col = pick(CONC, rnd);
      const du = (u1 - u0) * 0.15, dv = (v1 - v0) * 0.1;
      building({ u0: u0 + du, u1: u1 - du, v0: v0 + dv, v1: v1 - dv, h, style, floorH: 5, bayW: 6, grp: 1, lit: 0.2, col, roof: rnd() < 0.5 ? 'gable' : 'flat', roofCol: [0.4, 0.42, 0.44], roofH: 3 }, rnd);
      continue;
    } else { // Griffintown condos / warehouses
      if (r < 0.45) { h = 30 + rnd() * 55; style = rnd() < 0.6 ? STYLE.GLASS : STYLE.CONCRETE; col = style === STYLE.GLASS ? pick(GLASSC, rnd) : pick(CONC, rnd); podium = 8 + rnd() * 8; }
      else { h = 14 + rnd() * 12; style = STYLE.WAREHOUSE; col = pick(BRICK, rnd); }
    }
    const floorH = style === STYLE.GLASS || style === STYLE.COPPERGLASS || style === STYLE.DARK || style === STYLE.ALU ? 3.8 : 3.4;
    const bayW = style === STYLE.GLASS || style === STYLE.COPPERGLASS ? 1.6 : style === STYLE.ALU ? 1.5 : 3.2;
    building({ u0, u1, v0, v1, h, style, floorH, bayW, grp: style === STYLE.PLEX ? 2 : 3, lit: style === STYLE.GLASS ? 0.55 : 0.65, col, podium, podiumStyle: STYLE.STONE, crown, shopH, roof: h < 25 && rnd() < 0.15 ? 'mansard' : 'flat', roofCol: pick(ROOFS, rnd) }, rnd);
  }
}
function oldMontreal(rnd) {
  for (let k = 0; k < 20; k++) for (let m = -5; m < 0; m++) {
    const lu0 = lineU(k, true), lu1 = lineU(k + 1, true), lv0 = lineV(m, true), lv1 = lineV(m + 1, true);
    if ((lv0 + lv1) / 2 < -800) continue;              // keep the Old Port waterfront open
    const b = { u0: lu0 + hwU(k, true) + SIDEWALK, u1: lu1 - hwU(k + 1, true) - SIDEWALK, v0: lv0 + hwV(m, true) + SIDEWALK, v1: lv1 - hwV(m + 1, true) - SIDEWALK };
    if (district((b.u0 + b.u1) / 2, (b.v0 + b.v1) / 2) !== D.OLD) continue;
    const depth = Math.min(16, (b.v1 - b.v0) / 2 - 3);
    const shopStreet = m === -3 || m + 1 === -3;
    const side = (u0, u1, v0, v1, alongU) => {
      let s = alongU ? u0 : v0; const e = alongU ? u1 : v1;
      while (s < e - 5) {
        let w = 9 + rnd() * 14; if (e - (s + w) < 8) w = e - s;
        const box = alongU ? [s, s + w, v0, v1] : [u0, u1, s, s + w];
        if (lotOK(box[0], box[1], box[2], box[3], null)) {
          const r = rnd();
          const style = r < 0.62 ? STYLE.STONE : r < 0.86 ? STYLE.WAREHOUSE : STYLE.GREYSTONE;
          const floors = 3 + Math.floor(rnd() * 4);
          building({ u0: box[0], u1: box[1], v0: box[2], v1: box[3], h: floors * 3.9 + 1, style, floorH: 3.9, bayW: 3.3, grp: 2, lit: 0.6,
            col: style === STYLE.WAREHOUSE ? pick(BRICK, rnd) : pick(STONE, rnd), shopH: shopStreet || rnd() < 0.3 ? 4.6 : 0,
            roof: rnd() < 0.3 ? 'mansard' : 'flat', roofCol: rnd() < 0.3 ? [0.33, 0.52, 0.45] : [0.22, 0.23, 0.26], roofH: 4 + rnd() * 1.5 }, rnd);
        }
        s += w + (rnd() < 0.08 ? 4 : 0);
      }
    };
    side(b.u0, b.u1, b.v1 - depth, b.v1, true);                   // north side, full length
    side(b.u0, b.u1, b.v0, b.v0 + depth, true);                   // south side, full length
    if (b.v1 - b.v0 - 2 * depth > 8) {
      side(b.u0, b.u0 + depth, b.v0 + depth, b.v1 - depth, false);  // west, between
      side(b.u1 - depth, b.u1, b.v0 + depth, b.v1 - depth, false);  // east, between
    }
    // lanterns
    for (let u = Math.ceil(lu0 / 22) * 22; u < lu1; u += 22) LAMP_SLOTS.push([u, lv0 + hwV(m, true) + 0.7, 0, 1, 1]);
  }
}

// ---------------------------------------------------------------- street furniture slots
function lampsAndTrees(k, m, b, dist, rnd) {
  const lu0 = lineU(k), lu1 = lineU(k + 1), lv0 = lineV(m), lv1 = lineV(m + 1);
  // lamps exactly where the ground shader draws their light pools
  const vA = lv0 + hwV(m) + 5, vB = lv1 - hwV(m + 1) - 5;
  // + side of street k (east side of line k) lies in this block: lamps at v = 32n
  for (let v = Math.ceil(vA / 32) * 32; v <= vB; v += 32) LAMP_SLOTS.push([lu0 + hwU(k) + 0.7, v, -1, 0, 0]);
  // - side of street k+1 (west side of line k+1): v = 32n + 16
  for (let v = Math.ceil((vA - 16) / 32) * 32 + 16; v <= vB; v += 32) LAMP_SLOTS.push([lu1 - hwU(k + 1) - 0.7, v, 1, 0, 0]);
  const uA = lu0 + hwU(k) + 5, uB = lu1 - hwU(k + 1) - 5;
  for (let u = Math.ceil(uA / 32) * 32; u <= uB; u += 32) LAMP_SLOTS.push([u, lv0 + hwV(m) + 0.7, 0, -1, 0]);
  for (let u = Math.ceil((uA - 16) / 32) * 32 + 16; u <= uB; u += 32) LAMP_SLOTS.push([u, lv1 - hwV(m + 1) - 0.7, 0, 1, 0]);
  // street trees (Montreal is very leafy outside the core)
  const leafy = dist === D.PLEX || dist === D.HOUSES || dist === D.EAST || dist === D.VERDUN || dist === D.CDN || dist === D.SOUTH || dist === D.NUNS || dist === D.SUDOUEST;
  const sp = leafy ? 11.5 : 15, prob = leafy ? 0.72 : (dist === D.DOWNTOWN || dist === D.QDS ? 0.45 : 0.3);
  for (let v = vA + 4; v < vB - 4; v += sp) {
    if (rnd() < prob) TREE_SLOTS.push([lu0 + hwU(k) + 1.3, v + rnd() * 3, 0.85 + rnd() * 0.4, 0]);
    if (rnd() < prob) TREE_SLOTS.push([lu1 - hwU(k + 1) - 1.3, v + rnd() * 3, 0.85 + rnd() * 0.4, 0]);
  }
  for (let u = uA + 4; u < uB - 4; u += sp * 1.3) {
    if (rnd() < prob * 0.6) TREE_SLOTS.push([u, lv0 + hwV(m) + 1.3, 0.8 + rnd() * 0.4, 0]);
    if (rnd() < prob * 0.6) TREE_SLOTS.push([u, lv1 - hwV(m + 1) - 1.3, 0.8 + rnd() * 0.4, 0]);
  }
}

// ---------------------------------------------------------------- main
export function generateCity(scene, onProgress) {
  const rnd = mulberry(1642);   // Ville-Marie was founded in 1642
  const kmin = Math.floor((DOM.U0 - LAT.UOFF) / LAT.SU), kmax = Math.ceil((DOM.U1 - LAT.UOFF) / LAT.SU);
  const mmin = Math.floor((DOM.V0 - LAT.VOFF) / LAT.SV), mmax = Math.ceil((DOM.V1 - LAT.VOFF) / LAT.SV);
  for (let k = kmin; k < kmax; k++) {
    for (let m = mmin; m < mmax; m++) {
      const lu0 = lineU(k), lu1 = lineU(k + 1), lv0 = lineV(m), lv1 = lineV(m + 1);
      const cu = (lu0 + lu1) / 2, cv = (lv0 + lv1) / 2;
      const dist = district(cu, cv);
      if (dist === 0 || dist === D.OLD || dist === D.ISLANDS || dist === D.PLAZA || dist === D.CAMPUS) continue;
      if (waterSDF(cu, cv) < -20) continue;
      const b = { u0: lu0 + hwU(k) + SIDEWALK, u1: lu1 - hwU(k + 1) - SIDEWALK, v0: lv0 + hwV(m) + SIDEWALK, v1: lv1 - hwV(m + 1) - SIDEWALK };
      const r2 = mulberry((k + 500) * 7919 + (m + 500) * 104729);
      if (dist !== D.PORT) lampsAndTrees(k, m, b, dist, r2);
      switch (dist) {
        case D.PLEX: case D.EAST: case D.VERDUN:
          if (dist === D.EAST && r2() < 0.18) towerBlock(k, m, b, r2, D.PORT); else plexRows(k, m, b, r2, dist); break;
        case D.SUDOUEST: {
          const griff = cu > -1400 && cu < 340 && cv > -1450 && cv < -300;
          if (griff || r2() < 0.3) towerBlock(k, m, b, r2, D.SUDOUEST); else plexRows(k, m, b, r2, dist); break;
        }
        case D.CDN: if (r2() < 0.45) plexRows(k, m, b, r2, dist); else towerBlock(k, m, b, r2, D.CDN); break;
        case D.HOUSES: case D.SOUTH: houses(k, m, b, r2, dist); break;
        case D.DOWNTOWN: case D.QDS: towerBlock(k, m, b, r2, dist); break;
        case D.NUNS: towerBlock(k, m, b, r2, D.NUNS); break;
        case D.PORT: towerBlock(k, m, b, r2, D.PORT); break;
        default: plexRows(k, m, b, r2, dist);
      }
    }
    if (onProgress && (k % 8 === 0)) onProgress((k - kmin) / (kmax - kmin));
  }
  oldMontreal(rnd);
  STATS.stairs = STAIRS.length;
}

export function finalizeCity(scene) {
  const mat = facadeMaterial();
  const group = new THREE.Group(); group.name = 'city';
  let tris = 0;
  for (const T of tiles.values()) {
    if (!T.vc) continue;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(T.pos.arr(), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(T.nrm.arr(), 3));
    g.setAttribute('uv', new THREE.BufferAttribute(T.uv.arr(), 2));
    g.setAttribute('aCol', new THREE.BufferAttribute(T.col.arr(), 3));
    g.setAttribute('aB0', new THREE.BufferAttribute(T.b0.arr(), 4));
    g.setAttribute('aB1', new THREE.BufferAttribute(T.b1.arr(), 4));
    g.setIndex(new THREE.BufferAttribute(T.idx.arr(), 1));
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, mat);
    m.position.set(T.cu, 0, -T.cv); m.castShadow = true; m.receiveShadow = true; m.matrixAutoUpdate = false; m.updateMatrix();
    group.add(m); tris += T.idx.n / 3;
  }
  tiles.clear();
  scene.add(group);
  STATS.overlaps = auditOverlaps();
  return { group, mat, tris };
}

// Coplanar / overlap audit: any two boxes whose VOLUMES overlap could produce coincident faces.
// The generator only ever lets boxes touch; this proves it at load time.
export function auditOverlaps() {
  let bad = 0; const seen = new Set();
  for (const [key, ids] of BOXES.map) {
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
      const a = BOXES.boxes[ids[i]], b = BOXES.boxes[ids[j]];
      const e = 0.01;
      if (a.x0 < b.x1 - e && b.x0 < a.x1 - e && a.z0 < b.z1 - e && b.z0 < a.z1 - e && a.y0 < b.y1 - e && b.y0 < a.y1 - e) {
        const pk = ids[i] * 1e7 + ids[j]; if (seen.has(pk)) continue; seen.add(pk); bad++;
        if (bad < 6) console.warn('[audit] overlapping boxes', a, b);
      }
    }
  }
  return bad;
}
