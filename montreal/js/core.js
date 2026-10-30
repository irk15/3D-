// core.js — projection, baked masks, the Montreal street grid and the terrain height field.
// Everything here is shared by the CPU (placement, physics, VR floor) and mirrored in GLSL
// (ground shader) so roads, parks and buildings always line up exactly.
import * as THREE from 'three';

// ---------------------------------------------------------------- projection
// Origin = Place Ville Marie. Grid frame: +u = Montreal "east", +v = Montreal "north".
// The street grid is rotated ~55° from true east, so in this frame it is axis-aligned.
// World: x = u, z = -v, y = up. All coordinates stay within ±10 km of the origin and every
// mesh is built around its own tile centre, so float32 precision is never the limit.
export const LAT0 = 45.5015, LON0 = -73.5690;
export const MY = 111320, MX = 111320 * Math.cos(LAT0 * Math.PI / 180);
export const THETA = 55 * Math.PI / 180, CT = Math.cos(THETA), ST = Math.sin(THETA);
export function ll2g(lat, lon) {
  const ex = (lon - LON0) * MX, ny = (lat - LAT0) * MY;
  return [ex * CT + ny * ST, -ex * ST + ny * CT];
}
export function llw(lat, lon, y = 0) { const [u, v] = ll2g(lat, lon); return new THREE.Vector3(u, y, -v); }
// true ENU direction -> world
export function enu2w(e, n, up) { return new THREE.Vector3(e * CT + n * ST, up, -(-e * ST + n * CT)); }

// ---------------------------------------------------------------- domain
export const DOM = { U0: -4600, U1: 8200, V0: -7800, V1: 5000, N: 4096 };
DOM.PX = (DOM.U1 - DOM.U0) / DOM.N;
export const TILE = 800;
export const TILES_U = (DOM.U1 - DOM.U0) / TILE, TILES_V = (DOM.V1 - DOM.V0) / TILE;

// ---------------------------------------------------------------- deterministic random + noise
export function mulberry(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
export function hash2(x, y) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x, y, oct = 4) {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { s += a * vnoise(x * f, y * f); f *= 2.03; a *= 0.5; }
  return s;
}
export const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// ---------------------------------------------------------------- masks
export const MASK = { ready: false };
async function loadImage(url) {
  const img = new Image();
  img.decoding = 'async';
  img.src = url;
  await img.decode();
  return img;
}
function channels(img) {
  const N = DOM.N;
  const cv = document.createElement('canvas'); cv.width = N; cv.height = N;
  const cx = cv.getContext('2d', { willReadFrequently: true });
  cx.drawImage(img, 0, 0);
  const d = cx.getImageData(0, 0, N, N).data;
  const r = new Uint8Array(N * N), g = new Uint8Array(N * N), b = new Uint8Array(N * N);
  for (let i = 0, j = 0; i < N * N; i++, j += 4) { r[i] = d[j]; g[i] = d[j + 1]; b[i] = d[j + 2]; }
  cv.width = cv.height = 1;
  return [r, g, b];
}
export async function loadMasks(base) {
  const [a, b] = await Promise.all([loadImage(base + 'mask_a.png'), loadImage(base + 'mask_b.png')]);
  [MASK.water, MASK.park, MASK.forest] = channels(a);
  [MASK.road, MASK.dist, MASK.shore] = channels(b);
  const mk = (img) => {
    const t = new THREE.Texture(img);
    t.colorSpace = THREE.NoColorSpace; t.flipY = true; t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.anisotropy = 8; t.needsUpdate = true;
    return t;
  };
  MASK.texA = mk(a); MASK.texB = mk(b);
  MASK.ready = true;
}
// bilinear sample of a channel, rows stored top (V1) -> bottom (V0); clamped outside the domain
function samp(arr, u, v) {
  const N = DOM.N;
  let fx = (u - DOM.U0) / DOM.PX - 0.5, fy = (DOM.V1 - v) / DOM.PX - 0.5;
  fx = Math.min(N - 1.001, Math.max(0, fx)); fy = Math.min(N - 1.001, Math.max(0, fy));
  const x0 = fx | 0, y0 = fy | 0, tx = fx - x0, ty = fy - y0, i = y0 * N + x0;
  const a = arr[i], b = arr[i + 1], c = arr[i + N], d = arr[i + N + 1];
  return (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
}
const sdfm = (x) => (x - 128) / 4;
export const waterSDF = (u, v) => sdfm(samp(MASK.water, u, v));   // + land, - water (m)
export const parkSDF = (u, v) => sdfm(samp(MASK.park, u, v));     // + inside park
export const forestSDF = (u, v) => sdfm(samp(MASK.forest, u, v));
export const roadSDF = (u, v) => sdfm(samp(MASK.road, u, v));     // + inside a non-grid road
export const shoreDist = (u, v) => samp(MASK.shore, u, v) * 16;
export function district(u, v) {
  const N = DOM.N;
  const x = Math.min(N - 1, Math.max(0, Math.floor((u - DOM.U0) / DOM.PX)));
  const y = Math.min(N - 1, Math.max(0, Math.floor((DOM.V1 - v) / DOM.PX)));
  if (u < DOM.U0 || u > DOM.U1 || v < DOM.V0 || v > DOM.V1) return 0;
  return MASK.dist[y * N + x] >> 4;
}
// District ids (see tools/bake_mask.py)
export const D = { NONE: 0, DOWNTOWN: 1, OLD: 2, PLEX: 3, HOUSES: 4, SUDOUEST: 5, EAST: 6, CDN: 7, PORT: 8, VERDUN: 9, NUNS: 10, SOUTH: 11, QDS: 12, ISLANDS: 13, PLAZA: 14, CAMPUS: 15 };

// ---------------------------------------------------------------- street grid (lattice)
// Global lattice: N-S streets every 113 m (u), E-W streets every 190 m (v).
// Old Montreal has its own finer lattice that shares its boundary lines with the global one.
export const LAT = { SU: 113, UOFF: 1, SV: 190, VOFF: -300, SU2: 1469 / 20, UOFF2: 340, SV2: 125, VOFF2: -300 };
// arterial lines (index -> half width of pavement)
export const ART_U = { '-17': 8, '-11': 7.5, '-3': 7.5, '0': 9, '5': 8.5, '9': 7.5, '13': 9, '24': 8.5, '27': 8, '48': 9.5, '36': 7.5 };
export const ART_V = { '0': 8, '1': 10, '3': 7, '4': 6.2, '5': 9.5, '6': 7, '11': 7, '13': 8.5, '16': 7.5, '20': 8.5, '-6': 8 };
export const STREET_NAMES_U = { '-17': 'Atwater', '-11': 'Guy', '-3': 'Peel', '0': 'McGill College', '5': 'du Parc', '9': 'Saint-Laurent', '13': 'Saint-Denis', '24': 'Papineau', '27': 'De Lorimier', '48': 'Pie-IX', '36': "D'Iberville" };
export const STREET_NAMES_V = { '0': 'Saint-Antoine', '1': 'René-Lévesque', '3': 'Sainte-Catherine', '4': 'De Maisonneuve', '5': 'Sherbrooke', '6': 'Des Pins', '11': 'Rachel', '13': 'Mont-Royal', '16': 'Laurier', '20': 'Rosemont', '-6': 'Wellington' };
export const HW_LOCAL = 5.2, HW_OLD = 4.2, SIDEWALK = 3.0, ALLEY_HW = 2.6;
export const isOld = (d) => d === D.OLD;
export function latticeAllowed(d) { return d !== 0 && d !== D.ISLANDS && d !== D.PLAZA && d !== D.CAMPUS; }
export const hasAlleys = (d) => d === D.PLEX || d === D.EAST || d === D.VERDUN || d === D.CDN || d === D.SUDOUEST;
export function lineU(k, old) { return old ? LAT.UOFF2 + LAT.SU2 * k : LAT.UOFF + LAT.SU * k; }
export function lineV(m, old) { return old ? LAT.VOFF2 + LAT.SV2 * m : LAT.VOFF + LAT.SV * m; }
export function idxU(u, old) { return old ? Math.round((u - LAT.UOFF2) / LAT.SU2) : Math.round((u - LAT.UOFF) / LAT.SU); }
export function idxV(v, old) { return old ? Math.round((v - LAT.VOFF2) / LAT.SV2) : Math.round((v - LAT.VOFF) / LAT.SV); }
export function hwU(k, old) { return old ? HW_OLD : (ART_U[k] || HW_LOCAL); }
export function hwV(m, old) { return old ? (m === -4 ? 7 : HW_OLD) : (ART_V[m] || HW_LOCAL); }
// Is (u,v) a place where grid streets exist (land, not park/forest/plaza)?
export function gridHere(u, v) {
  const d = district(u, v);
  if (!latticeAllowed(d)) return false;
  return waterSDF(u, v) > 0 && parkSDF(u, v) < 0 && forestSDF(u, v) < 0;
}
// Signed distance to the nearest pavement edge (negative = on the roadway). Includes non-grid roads.
export function roadEdge(u, v) {
  let e = 1e9;
  const d = district(u, v);
  if (latticeAllowed(d) && waterSDF(u, v) > 0 && parkSDF(u, v) < 0 && forestSDF(u, v) < 0) {
    const old = isOld(d);
    const k = idxU(u, old), m = idxV(v, old);
    e = Math.min(Math.abs(u - lineU(k, old)) - hwU(k, old), Math.abs(v - lineV(m, old)) - hwV(m, old));
  }
  return Math.min(e, -roadSDF(u, v));
}

// ---------------------------------------------------------------- terrain height
// Mount Royal massif with its three summits, Saint Joseph's shoulder, Ile Ste-Helene hill,
// a gentle rise from the river (the old terraces) and very low-frequency undulation.
const PEAKS = [];
function peak(lat, lon, h, r, p, sx = 1, sy = 1) { const [u, v] = ll2g(lat, lon); PEAKS.push({ u, v, h, r, p, sx, sy }); }
peak(45.5070, -73.5900, 112, 900, 2.2, 1.25, 0.9);  // massif base
peak(45.5085, -73.5875, 78, 330, 2.6);              // Mont Royal summit (the cross), 233 m
peak(45.5040, -73.5878, 52, 260, 2.4);              // chalet / Kondiaronk shoulder
peak(45.5075, -73.6065, 92, 430, 2.4);              // Outremont summit, 211 m
peak(45.4885, -73.6045, 84, 360, 2.4);              // Westmount summit, 201 m
peak(45.4980, -73.5975, 30, 380, 2.0);              // Beaver Lake saddle
peak(45.4935, -73.6150, 42, 420, 2.2);              // Saint Joseph's Oratory shoulder
peak(45.5165, -73.5322, 18, 260, 2.0, 0.7, 1.4);    // Ile Sainte-Helene hill
export function landHeight(u, v) {
  const sd = shoreDist(u, v);
  let h = 3.6 + 44 * smooth(0, 2600, sd);
  for (const p of PEAKS) {
    const du = (u - p.u) / (p.r * p.sx), dv = (v - p.v) / (p.r * p.sy);
    const q = du * du + dv * dv;
    if (q < 9) h += p.h * Math.exp(-Math.pow(q, p.p * 0.5));
  }
  h += (fbm(u * 0.0011 + 7.3, v * 0.0011 - 2.1, 3) - 0.5) * 7 * smooth(10, 120, sd);
  return h;
}
export const QUAY = 2.9;
// Height used by the terrain mesh, buildings, traffic, people and the VR floor.
export function terrainH(u, v) {
  const ws = waterSDF(u, v);
  const land = landHeight(u, v);
  if (ws >= 4) return land;
  if (ws <= -2) return -6 - 6 * smooth(2, 30, -ws);
  // narrow, steep quay band so the waterline never runs along a shallow slope
  const t = (ws + 2) / 6;
  const top = Math.min(land, QUAY + (land - QUAY) * smooth(0, 1, t));
  return -6 + (top + 6) * smooth(0, 0.34, t) ;
}

// ---------------------------------------------------------------- spatial hash for building boxes
// Used for walk-mode collision, VR floor (rooftops) and teleport targets.
export class BoxIndex {
  constructor(cell = 64) { this.cell = cell; this.map = new Map(); this.boxes = []; }
  key(i, j) { return i * 100003 + j; }
  add(b) { // b = {x0,x1,z0,z1,y0,y1}
    const id = this.boxes.length; this.boxes.push(b);
    const c = this.cell;
    for (let i = Math.floor(b.x0 / c); i <= Math.floor(b.x1 / c); i++)
      for (let j = Math.floor(b.z0 / c); j <= Math.floor(b.z1 / c); j++) {
        const k = this.key(i, j); let a = this.map.get(k); if (!a) this.map.set(k, a = []); a.push(id);
      }
    return id;
  }
  query(x, z) { return this.map.get(this.key(Math.floor(x / this.cell), Math.floor(z / this.cell))) || []; }
  topAt(x, z, below = Infinity) { // highest roof under (x,z) whose top is <= below
    let best = -Infinity;
    for (const id of this.query(x, z)) {
      const b = this.boxes[id];
      if (x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1 && b.y1 <= below && b.y1 > best) best = b.y1;
    }
    return best;
  }
  inside(x, z, y, pad = 0) {
    for (const id of this.query(x, z)) {
      const b = this.boxes[id];
      if (x > b.x0 - pad && x < b.x1 + pad && z > b.z0 - pad && z < b.z1 + pad && y > b.y0 && y < b.y1 - 0.05) return b;
    }
    return null;
  }
}
export const BOXES = new BoxIndex(64);
// floor under a point: terrain or a roof (for VR / walking)
export function floorAt(x, z, headY = Infinity) {
  const t = terrainH(x, -z);
  const r = BOXES.topAt(x, z, headY);
  return Math.max(t, r);
}

// ---------------------------------------------------------------- exclusion zones (landmarks)
export const EXCL = [];
export function exclude(u0, u1, v0, v1) { EXCL.push([Math.min(u0, u1), Math.max(u0, u1), Math.min(v0, v1), Math.max(v0, v1)]); }
export function excludedRect(u0, u1, v0, v1) {
  for (const e of EXCL) if (u1 > e[0] && u0 < e[1] && v1 > e[2] && v0 < e[3]) return true;
  return false;
}

// ---------------------------------------------------------------- shared uniforms
export const U = {
  uTime: { value: 0 },
  uNight: { value: 0 },        // 0 day .. 1 night (drives lights)
  uSnow: { value: 0 },         // snow cover 0..1
  uWet: { value: 0 },          // wet surfaces 0..1
  uAutumn: { value: 0 },       // foliage colour 0..1
  uWinter: { value: 0 },       // bare trees 0..1
  uLit: { value: 0.5 },        // fraction of windows lit
  uFadeNear: { value: 1100 },  // tree / prop dither fade start
  uFadeFar: { value: 1500 },
  uMaskA: { value: null }, uMaskB: { value: null },
  uDom: { value: new THREE.Vector4(DOM.U0, DOM.V0, DOM.U1 - DOM.U0, DOM.V1 - DOM.V0) },
  uSunDir: { value: new THREE.Vector3(0, 1, 0) },
  uDetail: { value: 1 },
  uSkyZen: { value: new THREE.Color(0.25, 0.42, 0.75) },
  uSkyHor: { value: new THREE.Color(0.7, 0.75, 0.8) },
  uNearFade: { value: new THREE.Vector2(95, 125) },
  uForestFade: { value: new THREE.Vector2(520, 720) },
  tMirror: { value: null }, uMirrorMat: { value: new THREE.Matrix4() }, uMirrorOn: { value: 0 },
};
