// world.js — builds the Plateau: sidewalks, plexes with outdoor staircases, Saint-Denis shops,
// alleys, the park, the metro plaza, the church, props, trees, lamps and every collider.
// Rule used everywhere: attached parts protrude by distinct amounts or are inset, so no two
// surfaces ever share a plane over the same area (no z-fighting, no flicker).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  h, SLOPE, CURB, nsX, ewZ, nsHW, nsSW, ewHW, ewSW, alleyX, ALLEY_HW, DETAIL, PARK, PLAZA, CHURCH, GREEN_ALLEY, inRect, rng, pick, lin, U,
} from './layout.js';
import { batchMaterial, groundMaterial, toon, Glows, LAYER_FX, gradient } from './toon.js';

const FH = 3.1;
const SLOPE_A = Math.atan(SLOPE);

// ================================================================= geometry batch (vertex colours + kinds)
class Chunk { constructor() { this.p = []; this.n = []; this.c = []; this.k = []; this.i = []; this.vc = 0; } }
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _x = new THREE.Vector3();
const BOXT = new THREE.BoxGeometry(1, 1, 1);
export class Batch {
  constructor(size = 64) { this.size = size; this.chunks = new Map(); }
  ch(x, z) { const k = Math.floor(x / this.size) * 10000 + Math.floor(z / this.size); let c = this.chunks.get(k); if (!c) this.chunks.set(k, c = new Chunk()); return c; }
  quad(a, b, c, d, n, col, kind) {
    const C = this.ch((a[0] + c[0]) / 2, (a[2] + c[2]) / 2);
    _a.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]); _b.set(c[0] - a[0], c[1] - a[1], c[2] - a[2]); _x.crossVectors(_a, _b);
    const flip = _x.x * n[0] + _x.y * n[1] + _x.z * n[2] < 0;
    const v = C.vc;
    for (const q of [a, b, c, d]) { C.p.push(q[0], q[1], q[2]); C.n.push(n[0], n[1], n[2]); C.c.push(col[0], col[1], col[2]); C.k.push(kind); }
    C.vc += 4;
    if (flip) C.i.push(v, v + 2, v + 1, v, v + 3, v + 2); else C.i.push(v, v + 1, v + 2, v, v + 2, v + 3);
  }
  // axis-aligned box; faces: px nx py ny pz nz
  box(x0, x1, y0, y1, z0, z1, col, kind = 0, faces = [1, 1, 1, 0, 1, 1]) {
    if (x0 > x1) [x0, x1] = [x1, x0]; if (z0 > z1) [z0, z1] = [z1, z0]; if (y0 > y1) [y0, y1] = [y1, y0];
    if (faces[0]) this.quad([x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1], [1, 0, 0], col, kind);
    if (faces[1]) this.quad([x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1], [-1, 0, 0], col, kind);
    if (faces[2]) this.quad([x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], [0, 1, 0], col, kind);
    if (faces[3]) this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0], col, kind);
    if (faces[4]) this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], col, kind);
    if (faces[5]) this.quad([x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [0, 0, -1], col, kind);
  }
  geo(g, m, col, kind) {
    const P = g.attributes.position, N = g.attributes.normal;
    const nm = new THREE.Matrix3().getNormalMatrix(m);
    const e = new THREE.Vector3();
    m.decompose(_x, new THREE.Quaternion(), _a);
    const C = this.ch(_x.x, _x.z), v0 = C.vc;
    for (let i = 0; i < P.count; i++) {
      e.fromBufferAttribute(P, i).applyMatrix4(m); C.p.push(e.x, e.y, e.z);
      e.fromBufferAttribute(N, i).applyMatrix3(nm).normalize(); C.n.push(e.x, e.y, e.z);
      C.c.push(col[0], col[1], col[2]); C.k.push(kind);
    }
    C.vc += P.count;
    if (g.index) for (let i = 0; i < g.index.count; i++) C.i.push(v0 + g.index.getX(i));
    else for (let i = 0; i < P.count; i++) C.i.push(v0 + i);
  }
  boxM(cx, cy, cz, sx, sy, sz, rx, ry, rz, col, kind = 0) {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(cx, cy, cz), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new THREE.Vector3(sx, sy, sz));
    this.geo(BOXT, m, col, kind);
  }
  beam(a, b, t, col, kind = 10) {   // square bar from a to b
    const d = new THREE.Vector3().subVectors(b, a), L = d.length();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    const m = new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), q, new THREE.Vector3(t, L, t));
    this.geo(BOXT, m, col, kind);
  }
  build(mat, name) {
    const g = new THREE.Group(); g.name = name; let tris = 0;
    for (const C of this.chunks.values()) {
      if (!C.vc) continue;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(C.p, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(C.n, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(C.c, 3));
      geo.setAttribute('aKind', new THREE.Float32BufferAttribute(C.k, 1));
      geo.setIndex(C.vc > 65535 ? new THREE.Uint32BufferAttribute(C.i, 1) : new THREE.Uint16BufferAttribute(C.i, 1));
      geo.computeBoundingSphere();
      const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; m.matrixAutoUpdate = false;
      g.add(m); tris += C.i.length / 3;
    }
    this.chunks.clear();
    g.userData.tris = tris;
    return g;
  }
}

// ================================================================= colliders
// top types: flat (y1), 'h' (ground slope + off), 'ramp' along z or x
export class Colliders {
  constructor() { this.cell = 8; this.grid = new Map(); this.list = []; }
  add(c) {
    if (c.x0 > c.x1) [c.x0, c.x1] = [c.x1, c.x0]; if (c.z0 > c.z1) [c.z0, c.z1] = [c.z1, c.z0];
    const id = this.list.length; this.list.push(c);
    for (let i = Math.floor(c.x0 / this.cell); i <= Math.floor(c.x1 / this.cell); i++)
      for (let j = Math.floor(c.z0 / this.cell); j <= Math.floor(c.z1 / this.cell); j++) {
        const k = i * 100000 + j; let a = this.grid.get(k); if (!a) this.grid.set(k, a = []); a.push(id);
      }
    return c;
  }
  top(c, x, z) {
    if (c.t === 'h') return h(z) + c.off;
    if (c.t === 'ramp') { const s = c.axis === 'z' ? (z - c.a0) / (c.a1 - c.a0) : (x - c.a0) / (c.a1 - c.a0); return c.r0 + (c.r1 - c.r0) * Math.min(1, Math.max(0, s)); }
    return c.y1;
  }
  near(x, z, r) {
    const out = new Set();
    for (let i = Math.floor((x - r) / this.cell); i <= Math.floor((x + r) / this.cell); i++)
      for (let j = Math.floor((z - r) / this.cell); j <= Math.floor((z + r) / this.cell); j++) { const a = this.grid.get(i * 100000 + j); if (a) for (const id of a) out.add(id); }
    return out;
  }
  // highest walkable surface under (x,z) not above maxY
  ground(x, z, maxY, r = 0.0) {
    let g = h(z);
    for (const id of this.near(x, z, r + 0.01)) {
      const c = this.list[id];
      if (x < c.x0 - r || x > c.x1 + r || z < c.z0 - r || z > c.z1 + r) continue;
      const t = this.top(c, Math.min(c.x1, Math.max(c.x0, x)), Math.min(c.z1, Math.max(c.z0, z)));
      if (t <= maxY && t > g) g = t;
    }
    return g;
  }
  // does a circle at (x,z) with feet at y hit something too tall to step onto?
  blocked(x, z, r, feet, step, head) {
    for (const id of this.near(x, z, r)) {
      const c = this.list[id];
      if (x < c.x0 - r || x > c.x1 + r || z < c.z0 - r || z > c.z1 + r) continue;
      const cx = Math.min(c.x1, Math.max(c.x0, x)), cz = Math.min(c.z1, Math.max(c.z0, z));
      if ((x - cx) ** 2 + (z - cz) ** 2 > r * r) continue;
      if (c.y0 > head) continue;
      const t = this.top(c, cx, cz);
      if (t > feet + step) return c;
    }
    return null;
  }
  // camera probe: is the point inside something solid?
  solid(x, y, z) {
    if (y < h(z) + 0.25) return true;
    for (const id of this.near(x, z, 0)) {
      const c = this.list[id];
      if (c.thin) continue;
      if (x > c.x0 && x < c.x1 && z > c.z0 && z < c.z1 && y > c.y0 && y < this.top(c, x, z)) return true;
    }
    return false;
  }
}

// ================================================================= texture atlas (signs, awnings, murals, plates)
class Atlas {
  constructor(size = 2048) {
    this.size = size; this.cv = document.createElement('canvas'); this.cv.width = this.cv.height = size;
    this.x = this.cv.getContext('2d'); this.cx = 0; this.cy = 0; this.rowH = 0;
    this.x.fillStyle = '#2b2a33'; this.x.fillRect(0, 0, size, size);
  }
  alloc(w, h) {
    if (this.cx + w > this.size) { this.cx = 0; this.cy += this.rowH + 4; this.rowH = 0; }
    const r = { x: this.cx, y: this.cy, w, h }; this.cx += w + 4; this.rowH = Math.max(this.rowH, h);
    if (this.cy + h > this.size) console.warn('atlas full');
    return r;
  }
  draw(w, h, fn) { const r = this.alloc(w, h); this.x.save(); this.x.translate(r.x, r.y); this.x.beginPath(); this.x.rect(0, 0, w, h); this.x.clip(); fn(this.x, w, h); this.x.restore(); return r; }
  texture() { const t = new THREE.CanvasTexture(this.cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; return t; }
}
const FONT = '"Fredoka", "Trebuchet MS", system-ui, sans-serif';
function rr(x, a, b, w, hh, r) { x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + hh, r); x.arcTo(a + w, b + hh, a, b + hh, r); x.arcTo(a, b + hh, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath(); }
function fitText(x, text, maxW, size, weight = 600) { let s = size; do { x.font = `${weight} ${s}px ${FONT}`; s -= 2; } while (x.measureText(text).width > maxW && s > 10); }

// textured boxes (signs, awnings, plates) merged into one mesh with the atlas
class SignBatch {
  constructor(atlas) { this.atlas = atlas; this.gs = []; }
  uvMap(g, faceRects) {   // faceRects[6] for px nx py ny pz nz
    const uv = g.attributes.uv, S = this.atlas.size;
    for (let f = 0; f < 6; f++) {
      const r = faceRects[f];
      for (let i = f * 4; i < f * 4 + 4; i++) { const u = uv.getX(i), v = uv.getY(i); uv.setXY(i, (r.x + u * r.w) / S, 1 - (r.y + (1 - v) * r.h) / S); }
    }
  }
  box(cx, cy, cz, sx, sy, sz, ry, rx, front, side, glow = 0, frontBack = null) {
    const g = new THREE.BoxGeometry(sx, sy, sz);
    const rects = [side, side, side, side, front, frontBack || side];
    this.uvMap(g, rects);
    const gl = new Float32Array(24); if (glow) { for (let i = 16; i < 20; i++) gl[i] = glow; if (frontBack) for (let i = 20; i < 24; i++) gl[i] = glow; }
    g.setAttribute('aGlow', new THREE.BufferAttribute(gl, 1));
    g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(cx, cy, cz), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, 0, 'YXZ')), new THREE.Vector3(1, 1, 1)));
    this.gs.push(g);
  }
  awning(cx, cy, cz, sx, sz, tilt, rect) {
    const g = new THREE.BoxGeometry(sx, 0.08, sz); this.uvMap(g, [rect, rect, rect, rect, rect, rect]);
    g.setAttribute('aGlow', new THREE.BufferAttribute(new Float32Array(24), 1));
    g.rotateZ(tilt); g.translate(cx, cy, cz); this.gs.push(g);
  }
  // a single quad (mural on a wall) — the wall face itself, so nothing lies on top of it
  quad(a, b, c, d, n, rect, glow = 0) {
    const S = this.atlas.size;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c, ...d], 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute([...n, ...n, ...n, ...n], 3));
    const u0 = rect.x / S, u1 = (rect.x + rect.w) / S, v0 = 1 - (rect.y + rect.h) / S, v1 = 1 - rect.y / S;
    g.setAttribute('uv', new THREE.Float32BufferAttribute([u0, v0, u1, v0, u1, v1, u0, v1], 2));
    g.setAttribute('aGlow', new THREE.Float32BufferAttribute([glow, glow, glow, glow], 1));
    _a.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]); _b.set(c[0] - a[0], c[1] - a[1], c[2] - a[2]); _x.crossVectors(_a, _b);
    g.setIndex(_x.x * n[0] + _x.y * n[1] + _x.z * n[2] < 0 ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3]);
    this.gs.push(g.toNonIndexed());
  }
  build() {
    const all = this.gs.map((g) => (g.index ? g.toNonIndexed() : g));
    const g = mergeGeometries(all, false); g.computeBoundingSphere();
    const tex = this.atlas.texture();
    const m = new THREE.MeshToonMaterial({ map: tex, gradientMap: gradient });
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uNight = U.uNight; sh.uniforms.uSnow = U.uSnow;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aGlow; varying float vGlow; varying float vUpS;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = aGlow; vUpS = normal.y;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uNight, uSnow; varying float vGlow; varying float vUpS;')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * vGlow * uNight * 1.6;\ndiffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.93,0.95,1.0), uSnow * step(0.7, vUpS) * (1.0 - vGlow));');
    };
    m.customProgramCacheKey = () => 'signs';
    const mesh = new THREE.Mesh(g, m); mesh.castShadow = true; mesh.receiveShadow = true; mesh.matrixAutoUpdate = false;
    return mesh;
  }
}

// ================================================================= palettes
const BRICKS = ['#c4664a', '#b35a44', '#d27b4f', '#c97d5d', '#a9533f', '#dd9a6a', '#c86f61', '#b86a52'];
const PAINTS = ['#e8c879', '#8ec5b8', '#e79c84', '#9fb6dc', '#d9a5c4', '#f0dcae', '#a9cf98'];
const STONES = ['#c9c2b6', '#bdb6aa', '#d4cdbf'];
const TRIM = ['#f4efe6', '#2f4f46', '#3d3a4f', '#7a2f3a', '#2e5a7a', '#efe6c8'];
const DOORS = ['#d8473f', '#2f7fbf', '#3f9a6a', '#f2b43c', '#7b4fb0', '#e36f9c', '#1f3f5f', '#f07c3c'];
const IRON = '#2a3036';
const L = (hex) => lin(hex);

// ================================================================= the world
export function buildWorld(scene) {
  const B = new Batch(96), C = new Colliders(), atlas = new Atlas(2048), S = new SignBatch(atlas);
  const glows = new Glows(1600);
  const spots = { balcony: [], back: [], alley: [], sidewalk: [], shed: [] };
  const npcPaths = [], shops = [], lamps = [], trees = [], parked = [], benches = [], foot = [];
  const SIDE = atlas.draw(8, 8, (x) => { x.fillStyle = '#e9e4d8'; x.fillRect(0, 0, 8, 8); });
  const SIDE_DARK = atlas.draw(8, 8, (x) => { x.fillStyle = '#2b3036'; x.fillRect(0, 0, 8, 8); });
  const R = rng(1642);

  // ---------------------------------------------------------- sidewalks (sloped slabs that follow the street)
  const sidewalk = (x0, x1, z0, z1) => {
    if (x1 - x0 < 0.2 || z1 - z0 < 0.2) return;
    const T = 0.9, cz = (z0 + z1) / 2, cx = (x0 + x1) / 2;
    const top = h(cz) + CURB, n = new THREE.Vector3(0, Math.cos(SLOPE_A), Math.sin(SLOPE_A));
    const c = new THREE.Vector3(cx, top, cz).addScaledVector(n, -T / 2);
    B.boxM(c.x, c.y, c.z, x1 - x0, T, (z1 - z0) / Math.cos(SLOPE_A), SLOPE_A, 0, 0, L('#cfc8bd'), 0);
    C.add({ x0, x1, z0, z1, y0: h(z0) - 1, t: 'h', off: CURB });
  };
  for (let k = -5; k < 5; k++) for (let m = -4; m < 4; m++) {
    const xa = nsX(k) + nsHW(k), xb = nsX(k + 1) - nsHW(k + 1), za = ewZ(m) + ewHW(m), zb = ewZ(m + 1) - ewHW(m + 1);
    if (xb < -470 || xa > 470 || zb < -520 || za > 520) continue;
    const swa = nsSW(k), swb = nsSW(k + 1), swn = ewSW(m), sws = ewSW(m + 1);
    sidewalk(xa, xa + swa, za, zb); sidewalk(xb - swb, xb, za, zb);
    sidewalk(xa + swa, xb - swb, za, za + swn); sidewalk(xa + swa, xb - swb, zb - sws, zb);
  }

  // ---------------------------------------------------------- building parts
  const glass = (lit) => (lit ? 6 : 5);
  // a window on a facade plane. axis 'x': wall is the plane x = wx facing f (±1), centred at (zc, yc)
  function windowAt(axis, wx, f, uc, yc, w, hh, trim, opts = {}) {
    const P = (a, b, c0, c1, y0, y1, col, kind) => (axis === 'x' ? B.box(wx + f * a, wx + f * b, y0, y1, c0, c1, col, kind) : B.box(c0, c1, y0, y1, wx + f * a, wx + f * b, col, kind));
    const lit = R() < 0.55;
    P(-0.1, 0.04, uc - w / 2, uc + w / 2, yc - hh / 2, yc + hh / 2, L('#6f9ccc'), glass(lit));
    const t = 0.1;
    P(-0.05, 0.1, uc - w / 2 - t, uc - w / 2, yc - hh / 2, yc + hh / 2, trim, 0);
    P(-0.05, 0.1, uc + w / 2, uc + w / 2 + t, yc - hh / 2, yc + hh / 2, trim, 0);
    P(-0.05, 0.1, uc - w / 2 - t, uc + w / 2 + t, yc + hh / 2, yc + hh / 2 + t, trim, 0);
    P(-0.05, 0.16, uc - w / 2 - 0.16, uc + w / 2 + 0.16, yc - hh / 2 - 0.09, yc - hh / 2, trim, 0);     // sill
    if (opts.mullion) { P(-0.05, 0.07, uc - 0.025, uc + 0.025, yc - hh / 2, yc - 0.03, trim, 0); P(-0.05, 0.07, uc - 0.025, uc + 0.025, yc + 0.03, yc + hh / 2, trim, 0); }
    if (opts.brow) P(-0.05, 0.14, uc - w / 2 - 0.22, uc + w / 2 + 0.22, yc + hh / 2 + t, yc + hh / 2 + t + 0.22, opts.brow, 2);
  }
  function doorAt(axis, wx, f, uc, y0, w, hh, col, trim) {
    const P = (a, b, c0, c1, ya, yb, cc, kind) => (axis === 'x' ? B.box(wx + f * a, wx + f * b, ya, yb, c0, c1, cc, kind) : B.box(c0, c1, ya, yb, wx + f * a, wx + f * b, cc, kind));
    P(-0.1, 0.035, uc - w / 2, uc + w / 2, y0 + 0.01, y0 + hh, col, 0);
    P(-0.1, 0.05, uc - w * 0.3, uc + w * 0.3, y0 + hh * 0.62, y0 + hh * 0.9, L('#6f9ccc'), glass(R() < 0.4));
    P(-0.05, 0.1, uc - w / 2 - 0.1, uc - w / 2, y0, y0 + hh, trim, 0);
    P(-0.05, 0.1, uc + w / 2, uc + w / 2 + 0.1, y0, y0 + hh, trim, 0);
    P(-0.05, 0.1, uc - w / 2 - 0.1, uc + w / 2 + 0.1, y0 + hh, y0 + hh + 0.12, trim, 0);
  }
  // railing along a straight edge (posts every ~0.6 m), axis 'z' means it runs along z at x = xr
  function railing(axis, xr, a0, a1, y, col, gapA = null) {
    const n = Math.max(2, Math.round((a1 - a0) / 0.6));
    const P = (ca, cb, ya, yb, t) => (axis === 'z' ? B.box(xr - t, xr + t, ya, yb, ca, cb, col, 10) : B.box(ca, cb, ya, yb, xr - t, xr + t, col, 10));
    const segs = gapA ? [[a0, gapA[0]], [gapA[1], a1]] : [[a0, a1]];
    for (const [s0, s1] of segs) {
      if (s1 - s0 < 0.1) continue;
      P(s0, s1, y + 0.93, y + 1.0, 0.035); P(s0, s1, y + 0.1, y + 0.15, 0.03);
      const m = Math.max(1, Math.round((s1 - s0) / 0.6));
      for (let i = 0; i <= m; i++) { const a = s0 + (s1 - s0) * i / m; P(a - 0.025, a + 0.025, y, y + 0.92, 0.025); }
      if (axis === 'z') C.add({ x0: xr - 0.06, x1: xr + 0.06, z0: s0, z1: s1, y0: y, y1: y + 1.0, thin: true });
      else C.add({ x0: s0, x1: s1, z0: xr - 0.06, z1: xr + 0.06, y0: y, y1: y + 1.0, thin: true });
    }
  }
  // straight outdoor staircase along z (Montreal style), x-range [sx0,sx1], from zb (ground) to zt (yTop)
  function stairZ(sx0, sx1, zb, zt, yTop, col, wood = false) {
    const yb = h(zb), rise = yTop - yb, n = Math.max(4, Math.round(rise / 0.2)), dir = Math.sign(zt - zb), run = (zt - zb) / n;
    for (let i = 0; i < n; i++) {
      const za = zb + run * i, zc = zb + run * (i + 1) + (i < n - 1 ? dir * 0.02 : 0), y = yb + rise * (i + 1) / n;
      B.box(sx0, sx1, y - 0.06, y, za, zc, col, wood ? 3 : 10);
    }
    // stringers + sloped hand rails
    const a = new THREE.Vector3(), b = new THREE.Vector3();
    for (const x of [sx0 + 0.04, sx1 - 0.04]) {
      B.beam(a.set(x, yb - 0.05, zb), b.set(x, yTop - 0.1, zt), 0.09, col);
      B.beam(a.set(x, yb + 0.95, zb), b.set(x, yTop + 0.95, zt), 0.06, col);
      for (let i = 0; i <= n; i += 2) { const z = zb + run * i, y = yb + rise * i / n; B.box(x - 0.025, x + 0.025, y, y + 0.93, z - 0.025, z + 0.025, col, 10); }
      C.add({ x0: x - 0.05, x1: x + 0.05, z0: Math.min(zb, zt), z1: Math.max(zb, zt), y0: yb, y1: yTop + 1, thin: true, t: 'ramp', axis: 'z', a0: zb, a1: zt, r0: yb + 1.0, r1: yTop + 1.0 });
    }
    C.add({ x0: sx0 + 0.1, x1: sx1 - 0.1, z0: Math.min(zb, zt), z1: Math.max(zb, zt), y0: yb - 0.3, t: 'ramp', axis: 'z', a0: zb, a1: zt, r0: yb, r1: yTop });
  }
  function spiral(cx, cz, y0, y1, col) {
    B.box(cx - 0.05, cx + 0.05, y0 - 0.1, y1 + 1.0, cz - 0.05, cz + 0.05, col, 10);
    const n = 14;
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 1.75, y = y0 + (y1 - y0) * (i + 1) / n;
      B.boxM(cx + Math.cos(a) * 0.4, y - 0.03, cz + Math.sin(a) * 0.4, 0.75, 0.05, 0.28, 0, -a, 0, col, 10);
      if (i % 2 === 0) B.box(cx + Math.cos(a) * 0.78 - 0.02, cx + Math.cos(a) * 0.78 + 0.02, y, y + 0.9, cz + Math.sin(a) * 0.78 - 0.02, cz + Math.sin(a) * 0.78 + 0.02, col, 10);
    }
    C.add({ x0: cx - 0.85, x1: cx + 0.85, z0: cz - 0.85, z1: cz + 0.85, y0: y0 - 0.2, y1: y1 + 1 });
  }

  // ---------------------------------------------------------- one Montreal plex (or Saint-Denis shop building)
  // f: +1 if the front faces +x. xf: front facade plane. Lot spans z0..z1.
  function plex(o) {
    const { xf, f, z0, z1, D, F, commercial, corner, fill } = o;
    const xb = xf - f * D, xa = Math.min(xf, xb), xc = Math.max(xf, xb);
    const base = h(z0) + 0.3, y0 = h(z1) - 0.8;
    const gH = commercial ? 3.9 : FH;
    const top = base + gH + (F - 1) * FH + 0.6;
    const W = z1 - z0;
    const stone = !fill && !commercial && R() < 0.2;
    const wallCol = L(stone ? pick(STONES, R) : (R() < 0.12 ? pick(PAINTS, R) : pick(BRICKS, R)));
    const wallKind = fill ? 4 : stone ? 2 : (R() < 0.12 ? 3 : 1);
    const trim = L(pick(TRIM, R)), roofC = L('#55565e');
    // walls (faces individually so a mural can replace a side)
    const murals = o.mural;
    const faceX = (x, nx) => B.quad([x, y0, z0], [x, top, z0], [x, top, z1], [x, y0, z1], [nx, 0, 0], wallCol, wallKind);
    faceX(xf, f); faceX(xb, -f);
    for (const [z, nz] of [[z0, -1], [z1, 1]]) {
      if (murals && murals.side === nz) {
        S.quad([xa, base, z], [xc, base, z], [xc, top - 0.6, z], [xa, top - 0.6, z], [0, 0, nz], murals.rect);
        B.quad([xa, y0, z], [xc, y0, z], [xc, base, z], [xa, base, z], [0, 0, nz], wallCol, wallKind);
        B.quad([xa, top - 0.6, z], [xc, top - 0.6, z], [xc, top, z], [xa, top, z], [0, 0, nz], wallCol, wallKind);
      } else B.quad([xa, y0, z], [xc, y0, z], [xc, top, z], [xa, top, z], [0, 0, nz], wallCol, wallKind);
    }
    B.quad([xa, top, z0], [xc, top, z0], [xc, top, z1], [xa, top, z1], [0, 1, 0], roofC, 9);
    C.add({ x0: xa, x1: xc, z0, z1, y0, y1: top });
    if (!fill) foot.push([xa, xc, z0, z1]);
    if (fill) { // simple cornice line and done
      B.box(xf, xf + f * 0.3, top - 0.45, top - 0.05, z0 + 0.04, z1 - 0.04, trim, 0);
      return { base, top };
    }
    // cornice + brackets (the Plateau's pressed-tin cornices)
    const cor = L(pick(['#2f3a44', '#7a2f3a', '#2f4f46', '#e8e2d2', '#3d3a4f', '#b9874b'], R));
    B.box(xf, xf + f * 0.5, top - 0.75, top - 0.15, z0 + 0.03, z1 - 0.03, cor, 0);
    B.box(xf, xf + f * 0.58, top - 0.15, top + 0.05, z0 + 0.03, z1 - 0.03, cor, 0);
    for (let z = z0 + 0.5; z < z1 - 0.3; z += 1.25) B.box(xf, xf + f * 0.4, top - 1.05, top - 0.75, z - 0.08, z + 0.08, cor, 0);
    // plinth (foundation ledge), inset at both ends
    B.box(xf - f * 0.02, xf + f * 0.07, y0, base + 0.05, z0 + 0.03, z1 - 0.03, L('#9d968c'), 2);

    const doorCol = L(pick(DOORS, R));
    const yb = base + gH, yb3 = yb + FH;
    let stairInfo = null;
    if (commercial) {
      // ground-floor shop: big windows, door, awning, sign
      const shop = o.shop;
      const dz = z0 + W * (R() < 0.5 ? 0.22 : 0.78);
      for (const [a, b] of [[z0 + 0.5, dz - 0.75], [dz + 0.75, z1 - 0.5]]) {
        if (b - a < 0.8) continue;
        B.box(xf - f * 0.1, xf + f * 0.04, base + 0.55, base + 3.0, a, b, L('#7fb2d6'), 8);
        B.box(xf - f * 0.05, xf + f * 0.12, base + 3.0, base + 3.12, a - 0.1, b + 0.1, trim, 0);
        B.box(xf - f * 0.05, xf + f * 0.12, base + 0.3, base + 0.55, a - 0.1, b + 0.1, trim, 0);
        for (const zz of [a - 0.05, b + 0.05]) B.box(xf - f * 0.05, xf + f * 0.12, base + 0.55, base + 3.0, zz - 0.05, zz + 0.05, trim, 0);
      }
      doorAt('x', xf, f, dz, base, 1.1, 2.5, doorCol, trim);
      // awning (striped, sloped) and sign board
      const awn = shop.awning, aw = W - 0.8;
      S.awning(xf + f * 0.74, base + 3.35, (z0 + z1) / 2, 1.5, aw, -f * 0.35, awn);
      S.box(xf + f * 0.12, base + 3.75, (z0 + z1) / 2, Math.min(aw, 5.5), 0.7, 0.16, f > 0 ? Math.PI / 2 : -Math.PI / 2, 0, shop.rect, SIDE_DARK, 1);
      shops.push({ x: xf + f * 2.2, z: (z0 + z1) / 2, name: shop.name, kind: shop.kind, line: shop.line });
    } else {
      // ground floor: two doors (ground unit + stairs to upstairs) and a window
      const left = R() < 0.5;
      const d1 = z0 + W * (left ? 0.2 : 0.8), d2 = z0 + W * (left ? 0.42 : 0.58), wz = z0 + W * (left ? 0.75 : 0.25);
      doorAt('x', xf, f, d1, base, 1.0, 2.35, doorCol, trim); doorAt('x', xf, f, d2, base, 1.0, 2.35, L(pick(DOORS, R)), trim);
      windowAt('x', xf, f, wz, base + 1.5, 1.3, 1.5, trim, { mullion: true, brow: stone ? L('#a9a296') : null });
      // stoop
      const sh0 = Math.min(d1, d2) - 0.7, sh1 = Math.max(d1, d2) + 0.7;
      B.box(xf + f * 0.04, xf + f * 0.95, h(sh1) - 0.3, base, sh0, sh1, L('#a39a90'), 2);
      C.add({ x0: Math.min(xf, xf + f * 0.95), x1: Math.max(xf, xf + f * 0.95), z0: sh0, z1: sh1, y0: h(sh1) - 0.3, y1: base });
    }
    // upper floors
    for (let fl = 1; fl < F; fl++) {
      const y = base + gH + (fl - 1) * FH;
      const balcony = !commercial || R() < 0.4;
      const pat = commercial ? [0.2, 0.5, 0.8] : [0.18, 0.5, 0.82];
      pat.forEach((t, i) => {
        const z = z0 + W * t;
        if (balcony && i === 1 && !commercial) doorAt('x', xf, f, z, y, 1.0, 2.3, doorCol, trim);
        else windowAt('x', xf, f, z, y + 1.45, commercial ? 1.2 : 1.15, 1.55, trim, { mullion: true, brow: stone ? L('#a9a296') : (R() < 0.3 ? trim : null) });
      });
    }
    // balconies, front stairs, spiral (residential)
    if (!commercial && o.stairs) {
      const bd = 1.6, bz0 = z0 + 0.3, bz1 = z1 - 0.3;
      const ironC = L(R() < 0.7 ? IRON : pick(['#2f5a4a', '#5a2f3a', '#2f4a6a'], R));
      const slab = (y, d) => { B.box(xf, xf + f * d, y - 0.16, y, bz0, bz1, L('#8e877d'), 0); C.add({ x0: Math.min(xf, xf + f * d), x1: Math.max(xf, xf + f * d), z0: bz0, z1: bz1, y0: y - 0.16, y1: y }); };
      slab(yb, bd);
      const dirS = R() < 0.5 ? 1 : -1;
      const sx0 = Math.min(xf + f * (bd + 0.05), xf + f * (bd + 1.3)), sx1 = Math.max(xf + f * (bd + 0.05), xf + f * (bd + 1.3));
      const zt = dirS > 0 ? z1 - 1.25 : z0 + 1.25, landEnd = zt + dirS * 1.05;
      const rise = yb - h(zt), Ls = Math.min(W - 1.6, rise / 0.78);
      const zbS = zt - dirS * Ls;
      stairZ(sx0, sx1, zbS, zt, yb, ironC);
      // landing joined to the balcony
      B.box(sx0, sx1, yb - 0.16, yb, Math.min(zt, landEnd), Math.max(zt, landEnd), L('#8e877d'), 0);
      C.add({ x0: sx0, x1: sx1, z0: Math.min(zt, landEnd), z1: Math.max(zt, landEnd), y0: yb - 0.16, y1: yb });
      const xr = xf + f * (bd - 0.03);
      railing('z', xr, bz0, bz1, yb, ironC, [Math.min(zt, landEnd) - 0.05, Math.max(zt, landEnd) + 0.05]);
      railing('z', xf + f * (bd + 1.27), Math.min(zt, landEnd), Math.max(zt, landEnd), yb, ironC);
      railing('x', landEnd + dirS * -0.03, Math.min(xr, xf + f * (bd + 1.27)), Math.max(xr, xf + f * (bd + 1.27)), yb, ironC);
      for (const zE of [bz0 + 0.03, bz1 - 0.03]) railing('x', zE, Math.min(xf, xr), Math.max(xf, xr), yb, ironC);
      // posts holding the balcony
      for (const z of [bz0 + 0.1, bz1 - 0.1]) B.box(xf + f * (bd - 0.18), xf + f * (bd - 0.06), h(z) - 0.1, yb - 0.16, z - 0.06, z + 0.06, ironC, 10);
      stairInfo = { x: (sx0 + sx1) / 2, z: landEnd - dirS * 0.5, y: yb, bx: xf + f * bd * 0.5, bz: (bz0 + bz1) / 2 };
      (spots.stairs ||= []).push({ x: (sx0 + sx1) / 2, zb: zbS, zt, dirS, yb, bx: xf + f * 0.8, street: o.street });
      spots.balcony.push({ x: xf + f * 0.8, y: yb, z: (bz0 + bz1) / 2, street: o.street });
      if (F >= 3) {
        const bd3 = 1.4, hasSpiral = R() < 0.45;
        const t0 = hasSpiral && dirS > 0 ? bz0 + 1.75 : bz0, t1 = hasSpiral && dirS < 0 ? bz1 - 1.75 : bz1;
        B.box(xf, xf + f * bd3, yb3 - 0.16, yb3, t0, t1, L('#8e877d'), 0);
        C.add({ x0: Math.min(xf, xf + f * bd3), x1: Math.max(xf, xf + f * bd3), z0: t0, z1: t1, y0: yb3 - 0.16, y1: yb3 });
        railing('z', xf + f * (bd3 - 0.03), t0, t1, yb3, ironC);
        for (const z of [t0 + 0.03, t1 - 0.03]) railing('x', z, Math.min(xf, xf + f * bd3), Math.max(xf, xf + f * bd3), yb3, ironC);
        for (const z of [t0 + 0.1, t1 - 0.1]) B.box(xf + f * (bd3 - 0.15), xf + f * (bd3 - 0.05), yb, yb3 - 0.16, z - 0.05, z + 0.05, ironC, 10);
        B.box(xf, xf + f * (bd3 + 0.2), top - 1.25, top - 1.1, bz0 - 0.1, bz1 + 0.1, cor, 0);
        if (hasSpiral) spiral(xf + f * 0.85, dirS > 0 ? bz0 + 0.85 : bz1 - 0.85, yb, yb3, ironC);
      }
    }
    // back facade: windows + wooden back balcony with stairs to the yard
    if (!fill) {
      for (let fl = 0; fl < F; fl++) {
        const y = base + (fl ? gH + (fl - 1) * FH : 0);
        [0.25, 0.7].forEach((t) => windowAt('x', xb, -f, z0 + W * t, y + 1.45, 1.0, 1.35, L('#efe8da')));
      }
      if (o.backStairs) {
        const wood = L('#a8774f'), bd = 1.8, bz0 = z0 + 0.4, bz1 = z1 - 0.4;
        B.box(xb, xb - f * bd, yb - 0.15, yb, bz0, bz1, wood, 3);
        C.add({ x0: Math.min(xb, xb - f * bd), x1: Math.max(xb, xb - f * bd), z0: bz0, z1: bz1, y0: yb - 0.15, y1: yb });
        const sx0 = Math.min(xb - f * (bd + 0.05), xb - f * (bd + 1.0)), sx1 = Math.max(xb - f * (bd + 0.05), xb - f * (bd + 1.0));
        const zt = z1 - 1.2, zbS = zt - Math.min(W - 1.6, (yb - h(zt)) / 0.8);
        stairZ(sx0, sx1, zbS, zt, yb, wood, true);
        B.box(sx0, sx1, yb - 0.15, yb, zt, zt + 1.0, wood, 3);
        C.add({ x0: sx0, x1: sx1, z0: zt, z1: zt + 1.0, y0: yb - 0.15, y1: yb });
        railing('z', xb - f * (bd - 0.03), bz0, bz1, yb, wood, [zt - 0.05, zt + 1.05]);
        railing('z', xb - f * (bd + 0.98), zt, zt + 1.0, yb, wood);
        for (const z of [bz0 + 0.1, bz1 - 0.1]) B.box(xb - f * (bd - 0.15), xb - f * (bd - 0.03), h(z) - 0.1, yb - 0.15, z - 0.06, z + 0.06, wood, 3);
        spots.back.push({ x: xb - f * 0.9, y: yb, z: (bz0 + bz1) / 2 });
      }
    }
    return { base, top, stairInfo };
  }

  // ---------------------------------------------------------- shops on Saint-Denis / Mont-Royal
  const SHOPS = [
    ['CAFÉ LUMIÈRE', 'cafe', '#2f5a4a', '#f4e3c3', 'Un café? Ça te donne des ailes. (+ vitesse)'],
    ['BOULANGERIE', 'bakery', '#f2d9a6', '#7a3d24', 'Croissants tout chauds, sortis du four!'],
    ['DÉPANNEUR', 'dep', '#d8473f', '#ffffff', 'Chips, lait, billets de loterie… tout ce qu\'il faut.'],
    ['POUTINERIE', 'poutine', '#f2b43c', '#3a2a1a', 'Frites, fromage en grains, sauce brune. Classique.'],
    ['FRUITERIE', 'fruit', '#4f9a4a', '#ffffff', 'Pommes du Québec, bleuets du Lac-Saint-Jean!'],
    ['LIBRAIRIE', 'books', '#3d3a6f', '#f4e3c3', 'Romans, BD et poésie… en français et en anglais.'],
    ['FLEURISTE', 'flowers', '#e79cb4', '#5a1f3a', 'Des tulipes pour quelqu\'un de spécial?'],
    ['DISQUAIRE', 'vinyl', '#1f1f2a', '#ff6fa8', 'Vinyles usagés: jazz, punk, chanson québécoise.'],
    ['BAGELS', 'bagels', '#f4efe6', '#7a3d24', 'Bagels roulés à la main, cuits au feu de bois.'],
    ['FROMAGERIE', 'cheese', '#f2d36b', '#3a5a2a', 'Plus de 300 fromages d\'ici.'],
    ['FRIPERIE', 'thrift', '#8ec5b8', '#2a3a3a', 'Vêtements vintage, pas chers!'],
    ['BARBIER', 'barber', '#2e5a7a', '#f4efe6', 'Une coupe? Assieds-toi.'],
    ['SUSHI', 'sushi', '#f4efe6', '#c83a3a', 'Le comptoir ouvre à 11 h 30.'],
    ['PHO SAIGON', 'pho', '#c83a3a', '#f8e08e', 'Un bol de pho pour se réchauffer.'],
    ['BAR LE TUQUE', 'bar', '#3d3a4f', '#f2b43c', 'Spectacle ce soir à 21 h!'],
    ['QUINCAILLERIE', 'hardware', '#c8573a', '#ffffff', 'Pelles à neige en solde.'],
  ];
  const shopDefs = SHOPS.map(([name, kind, bg, fg, line]) => {
    const rect = atlas.draw(512, 96, (x, w, hh) => {
      x.fillStyle = bg; x.fillRect(0, 0, w, hh);
      x.strokeStyle = fg; x.globalAlpha = 0.5; x.lineWidth = 4; rr(x, 8, 8, w - 16, hh - 16, 10); x.stroke(); x.globalAlpha = 1;
      x.fillStyle = fg; x.textAlign = 'center'; x.textBaseline = 'middle'; fitText(x, name, w - 60, 58, 700); x.fillText(name, w / 2, hh / 2 + 3);
    });
    const stripe = pick(['#d8473f', '#2f7fbf', '#3f9a6a', '#f2b43c', '#7b4fb0', '#2f5a4a'], R);
    const awning = atlas.draw(128, 128, (x, w, hh) => { for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? '#f4efe6' : stripe; x.fillRect(0, i * 16, w, 16); } });
    return { name, kind, rect, awning, line };
  });
  let shopI = 0;
  const nextShop = () => shopDefs[(shopI++) % shopDefs.length];

  // ---------------------------------------------------------- murals (procedural, anime-poster style)
  const muralDefs = [];
  const mural = (fn) => muralDefs.push({ rect: atlas.draw(512, 512, fn) });
  mural((x, w, hh) => {   // sunset over the mountain
    const g = x.createLinearGradient(0, 0, 0, hh); g.addColorStop(0, '#ff8fa3'); g.addColorStop(0.55, '#ffd27f'); g.addColorStop(1, '#ffb37f'); x.fillStyle = g; x.fillRect(0, 0, w, hh);
    x.fillStyle = '#fff3c4'; x.beginPath(); x.arc(w * 0.62, hh * 0.45, 90, 0, 7); x.fill();
    x.fillStyle = '#5a4a8f'; x.beginPath(); x.moveTo(0, hh); x.quadraticCurveTo(w * 0.35, hh * 0.35, w * 0.7, hh * 0.62); x.quadraticCurveTo(w * 0.85, hh * 0.7, w, hh * 0.6); x.lineTo(w, hh); x.fill();
    x.fillStyle = '#fff'; x.fillRect(w * 0.33 - 4, hh * 0.3, 8, 70); x.fillRect(w * 0.33 - 22, hh * 0.3 + 18, 44, 8);
    x.fillStyle = '#2f2a4f'; x.font = `700 64px ${FONT}`; x.textAlign = 'center'; x.fillText('MONTRÉAL', w / 2, hh - 40);
  });
  mural((x, w, hh) => {   // giant birds and waves
    x.fillStyle = '#2f7fbf'; x.fillRect(0, 0, w, hh);
    for (let i = 0; i < 9; i++) { x.fillStyle = i % 2 ? '#8ec5e8' : '#f4efe6'; x.beginPath(); x.ellipse(w * (i % 3) / 2.2 + 60, hh * Math.floor(i / 3) / 2.6 + 90, 120, 60, 0.4, 0, 7); x.fill(); }
    x.fillStyle = '#f2b43c'; for (let i = 0; i < 5; i++) { x.beginPath(); const cx = 80 + i * 90, cy = 120 + (i % 2) * 140; x.moveTo(cx, cy); x.quadraticCurveTo(cx + 40, cy - 50, cx + 80, cy); x.quadraticCurveTo(cx + 40, cy - 20, cx, cy); x.fill(); }
    x.fillStyle = '#f4efe6'; x.font = `700 48px ${FONT}`; x.textAlign = 'center'; x.fillText('Je me souviens', w / 2, hh - 36);
  });
  mural((x, w, hh) => {   // a girl with a tuque (original character)
    x.fillStyle = '#9fd3c7'; x.fillRect(0, 0, w, hh);
    for (let i = 0; i < 40; i++) { x.fillStyle = 'rgba(255,255,255,.5)'; x.beginPath(); x.arc((i * 97) % w, (i * 53) % hh, 6 + (i % 4) * 3, 0, 7); x.fill(); }
    x.fillStyle = '#f2d2b6'; x.beginPath(); x.arc(w / 2, hh * 0.55, 130, 0, 7); x.fill();
    x.fillStyle = '#d8473f'; x.beginPath(); x.arc(w / 2, hh * 0.47, 140, Math.PI, 0); x.fill(); x.fillRect(w / 2 - 145, hh * 0.45, 290, 40);
    x.fillStyle = '#fff'; x.beginPath(); x.arc(w / 2, hh * 0.47 - 150, 34, 0, 7); x.fill();
    x.fillStyle = '#2a2240'; for (const s of [-1, 1]) { x.beginPath(); x.ellipse(w / 2 + s * 50, hh * 0.6, 18, 26, 0, 0, 7); x.fill(); }
    x.fillStyle = '#f08a8a'; for (const s of [-1, 1]) { x.beginPath(); x.ellipse(w / 2 + s * 82, hh * 0.68, 22, 12, 0, 0, 7); x.fill(); }
    x.strokeStyle = '#2a2240'; x.lineWidth = 6; x.beginPath(); x.arc(w / 2, hh * 0.68, 26, 0.2, Math.PI - 0.2); x.stroke();
  });
  mural((x, w, hh) => {   // geometric maple leaves
    x.fillStyle = '#3d3a6f'; x.fillRect(0, 0, w, hh);
    const leaf = (cx, cy, s, c) => { x.fillStyle = c; x.beginPath(); for (let i = 0; i < 11; i++) { const a = -Math.PI / 2 + i / 11 * Math.PI * 2, r = i % 2 ? s * 0.45 : s; x.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } x.fill(); x.fillRect(cx - 4, cy, 8, s * 0.8); };
    leaf(w * 0.3, hh * 0.35, 110, '#e4572e'); leaf(w * 0.72, hh * 0.3, 80, '#f2b43c'); leaf(w * 0.55, hh * 0.68, 130, '#d8473f'); leaf(w * 0.18, hh * 0.78, 60, '#f2b43c');
  });

  // ---------------------------------------------------------- rows of buildings
  const DET = (x, z) => x > DETAIL.x0 && x < DETAIL.x1 && z > DETAIL.z0 && z < DETAIL.z1;
  let muralN = 0;
  for (let k = -4; k < 4; k++) for (let m = -4; m < 4; m++) {
    const sxa = nsX(k), sxb = nsX(k + 1), ax = alleyX(k);
    const za = ewZ(m) + ewHW(m) + ewSW(m), zb = ewZ(m + 1) - ewHW(m + 1) - ewSW(m + 1);
    const blockCx = (sxa + sxb) / 2, blockCz = (za + zb) / 2;
    if (inRect(PARK, blockCx, blockCz)) continue;
    for (const side of [0, 1]) {
      // side 0: row west of the alley, fronting street k (front faces -x). side 1: east of alley, fronting k+1 (faces +x)
      const f = side ? 1 : -1;
      const streetK = side ? k + 1 : k;
      const frontEdge = side ? sxb - nsHW(k + 1) - nsSW(k + 1) : sxa + nsHW(k) + nsSW(k);
      const backEdge = side ? ax + ALLEY_HW : ax - ALLEY_HW;
      const depthAvail = Math.abs(frontEdge - backEdge);
      const rowX = (frontEdge + backEdge) / 2;
      const detail = DET(rowX, blockCz);
      if (Math.abs(rowX) > 400 || blockCz < -500 || blockCz > 500) continue;
      const fx = -f;   // facade normal points from the row toward its street: street is at smaller x for side 0
      const commercialStreet = streetK === 0;
      const lots = [];
      let z = za + 0.4;
      while (z < zb - 4) {
        let w = commercialStreet ? 6.5 + R() * 2.5 : 7.2 + R() * 1.0;
        if (zb - 0.4 - (z + w) < 6) w = zb - 0.4 - z;
        lots.push([z, z + w]); z += w;
      }
      lots.forEach(([z0, z1], i) => {
        const cz = (z0 + z1) / 2;
        if (side === 0 && inRect(PLAZA, rowX, cz, 0.5) && k === 0) return;
        if (side === 0 && k === 0 && cz > CHURCH.z0 - 3 && cz < CHURCH.z1 + 3) return;
        const corner = i === 0 ? -1 : i === lots.length - 1 ? 1 : 0;
        const commercial = commercialStreet || (corner && ((corner === -1 && m === -1) || (corner === 1 && m + 1 === -1)) && detail);
        const setback = commercial ? 0 : (detail ? 3.3 : 2.5);
        const xfront = side ? frontEdge - setback : frontEdge + setback;
        const D = Math.min(depthAvail - setback - (detail ? 7 : 2), commercial ? 15 : 12 + R() * 2);
        if (D < 6) return;
        const F = commercial ? 3 : (R() < 0.75 ? 3 : 2);
        const fill = !detail;
        const wantMural = detail && corner && !commercial && R() < 0.5;
        const res = plex({
          xf: xfront, f: side ? 1 : -1, z0, z1, D, F, commercial, corner, fill, street: streetK,
          stairs: !commercial && detail && setback >= 3, backStairs: detail && !commercial && R() < 0.45,
          shop: commercial ? nextShop() : null,
          mural: wantMural ? { side: corner, rect: muralDefs[muralN++ % muralDefs.length].rect } : null,
        });
        if (!detail) return;
        // front yard bits: small fence & flowers or a bike
        if (!commercial && R() < 0.5) {
          const fxx = side ? frontEdge - 0.25 : frontEdge + 0.25;
          const fc = L(pick(['#2a3036', '#f4efe6', '#2f4f46'], R));
          railing('z', fxx, z0 + 0.3, z1 - 0.3, h(z1) + 0.0, fc, [cz - 0.9, cz + 0.9]);
        }
        // back yard: shed, fence, tree
        const yardX0 = Math.min(xfront - (side ? 1 : -1) * D, backEdge), yardX1 = Math.max(xfront - (side ? 1 : -1) * D, backEdge);
        if (yardX1 - yardX0 > 4 && R() < 0.35) {
          const sx0 = side ? yardX0 + 0.5 : yardX1 - 3.0, sz0 = z0 + 0.6;
          const shH = 2.2 + R() * 0.4, by = h(sz0 + 2.4) - 0.2;
          B.box(sx0, sx0 + 2.5, by, h(sz0) + shH, sz0, sz0 + 2.4, L(pick(['#a8774f', '#8fb0a4', '#d9c49a', '#b55a4a'], R)), 3);
          C.add({ x0: sx0, x1: sx0 + 2.5, z0: sz0, z1: sz0 + 2.4, y0: by, y1: h(sz0) + shH });
          spots.shed.push({ x: sx0 + 1.25, z: sz0 + 1.2, y: h(sz0) + shH, side });
        }
        if (yardX1 - yardX0 > 4 && R() < 0.4) trees.push([(yardX0 + yardX1) / 2 + (R() - 0.5) * 2, cz + (R() - 0.5) * 3, 0.9 + R() * 0.4, 0]);
        // fence along the alley
        const fxA = side ? backEdge + 0.15 : backEdge - 0.15;
        railing('z', fxA, z0 + 0.05, z1 - 0.05, h(z1) - 0.05, L(R() < 0.5 ? '#a8774f' : '#9aa3a8'), R() < 0.5 ? [cz - 0.7, cz + 0.7] : null);
      });
    }
  }

  // ---------------------------------------------------------- street furniture
  const poleCol = L('#7d858c');
  function lamp(x, z, dx, dz) {
    const y = h(z) + CURB;
    B.box(x - 0.08, x + 0.08, y - 0.2, y + 7.2, z - 0.08, z + 0.08, poleCol, 10);
    const ex = x + dx * 1.7, ez = z + dz * 1.7;
    B.box(Math.min(x, ex) - 0.05, Math.max(x, ex) + 0.05, y + 7.05, y + 7.15, Math.min(z, ez) - 0.05, Math.max(z, ez) + 0.05, poleCol, 10);
    B.box(ex - 0.32, ex + 0.32, y + 6.85, y + 7.12, ez - 0.2, ez + 0.2, L('#5a6066'), 10);
    B.box(ex - 0.26, ex + 0.26, y + 6.80, y + 6.86, ez - 0.15, ez + 0.15, L('#fff4d6'), 7);
    C.add({ x0: x - 0.12, x1: x + 0.12, z0: z - 0.12, z1: z + 0.12, y0: y - 0.2, y1: y + 7.2 });
    lamps.push([ex, y + 6.75, ez]);
    glows.add(ex, y + 6.7, ez, 1, 0.82, 0.55, 0.7);
  }
  const onStreetArea = (x, z, pad = 0) => {
    const k = Math.round(x / 90), m = Math.round((z + 160) / 110) - 1;
    return Math.abs(x - nsX(k)) < nsHW(k) + nsSW(k) + pad && Math.abs(z - ewZ(m)) < ewHW(m) + ewSW(m) + pad;
  };
  const LAMPR = { x0: -300, x1: 300, z0: -420, z1: 430 };
  for (let k = -3; k <= 3; k++) {
    const sx = nsX(k), off = nsHW(k) + 0.6;
    for (let z = LAMPR.z0; z <= LAMPR.z1; z += 15) {
      const east = Math.round(z / 15) % 2 === 0;
      const x = east ? sx + off : sx - off;
      const m = Math.round((z + 160) / 110) - 1;
      if (Math.abs(z - ewZ(m)) < ewHW(m) + ewSW(m) + 1) continue;
      if (Math.abs(x) > 140 || z < DETAIL.z0 || z > DETAIL.z1) { if ((Math.abs(x) > 300)) continue; }
      lamp(x, z, east ? -1 : 1, 0);
    }
  }
  for (let m = -3; m <= 3; m++) {
    const sz = ewZ(m), off = ewHW(m) + 0.6;
    for (let x = LAMPR.x0; x <= LAMPR.x1; x += 15) {
      const southSide = Math.round(x / 15) % 2 === 0;
      const z = southSide ? sz + off : sz - off;
      const k = Math.round(x / 90);
      if (Math.abs(x - nsX(k)) < nsHW(k) + nsSW(k) + 1) continue;
      lamp(x, z, 0, southSide ? -1 : 1);
    }
  }
  // street trees in the detailed district
  for (let k = -1; k <= 1; k++) {
    const sx = nsX(k), off = nsHW(k) + nsSW(k) - 0.9;
    for (const s of [-1, 1]) for (let z = DETAIL.z0; z < DETAIL.z1; z += 10 + R() * 4) {
      const x = sx + s * off;
      if (onStreetArea(x, z, 2) || inRect(PLAZA, x, z, 1)) continue;
      if (Math.abs((z - (s > 0 ? 0 : 15)) / 15 - Math.round((z - (s > 0 ? 0 : 15)) / 15)) * 15 < 2.5) continue;   // keep clear of lamps
      if (R() < (k === 0 ? 0.55 : 0.85)) trees.push([x, z, 0.85 + R() * 0.35, 0]);
    }
  }
  // parked cars along the curbs (static), with gaps for the driveways
  for (let k = -1; k <= 1; k++) {
    const sx = nsX(k), lane = nsHW(k) - (k === 0 ? 1.15 : 1.2);
    for (const s of [-1, 1]) for (let z = DETAIL.z0 + 4; z < DETAIL.z1; z += 6.2) {
      if (onStreetArea(sx, z, 6) || R() < 0.42) continue;
      parked.push([sx + s * lane, z, s > 0 ? 0 : Math.PI]);
    }
  }
  for (const m of [-1, 0, 1]) {
    const sz = ewZ(m), lane = ewHW(m) - 1.2;
    for (const s of [-1, 1]) for (let x = DETAIL.x0 + 3; x < DETAIL.x1; x += 6.2) {
      if (onStreetArea(x, sz, 6) || R() < 0.5) continue;
      parked.push([x, sz + s * lane, s > 0 ? -Math.PI / 2 : Math.PI / 2]);
    }
  }
  const CAR_COLS = ['#e8e4dc', '#2f3a44', '#d8473f', '#7fb2d6', '#f2b43c', '#3f7a5a', '#b9b9c0', '#e79cb4', '#5a4a8f'];
  for (const [x, z, ry] of parked) carStatic(B, C, x, z, ry, L(pick(CAR_COLS, R)));

  // utility poles + wires along the alleys (the overhead tangle every Plateau alley has)
  const wireCol = L('#26262c');
  for (let k = -2; k <= 1; k++) {
    const ax = alleyX(k), px = ax + ALLEY_HW - 0.35;
    if (ax < DETAIL.x0 || ax > DETAIL.x1) continue;
    for (let m = -1; m <= 3; m++) {
      const z0 = ewZ(m - 1) + ewHW(m - 1) + ewSW(m - 1) + 2, z1 = ewZ(m) - ewHW(m) - ewSW(m) - 2;
      if (z1 < DETAIL.z0 || z0 > DETAIL.z1) continue;
      const poles = []; for (let z = z0; z <= z1 + 0.1; z += (z1 - z0) / 3) poles.push(z);
      for (const z of poles) {
        const y = h(z);
        B.box(px - 0.13, px + 0.13, y - 0.3, y + 8.4, z - 0.13, z + 0.13, L('#7a5a3e'), 3);
        B.box(px - 1.0, px + 0.6, y + 7.7, y + 7.85, z - 0.07, z + 0.07, L('#7a5a3e'), 3);
        B.box(px - 0.2, px + 0.2, y + 6.6, y + 7.3, z + 0.13, z + 0.53, L('#5f6870'), 10);   // transformer
        C.add({ x0: px - 0.15, x1: px + 0.15, z0: z - 0.15, z1: z + 0.15, y0: y - 0.3, y1: y + 8.4 });
      }
      for (let i = 0; i < poles.length - 1; i++) for (const [dx, dy] of [[-0.9, 7.85], [0.5, 7.85], [-0.2, 7.2]]) {
        const a = new THREE.Vector3(px + dx, h(poles[i]) + dy, poles[i]), b = new THREE.Vector3(px + dx, h(poles[i + 1]) + dy, poles[i + 1]);
        const mid = a.clone().lerp(b, 0.5); mid.y -= 0.55;
        const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
        B.geo(new THREE.TubeGeometry(curve, 10, 0.03, 4), new THREE.Matrix4(), wireCol, 10);
      }
      // service drops from the poles to the houses
      for (let i = 0; i < poles.length; i++) for (const s of [-1, 1]) {
        const a = new THREE.Vector3(px - 0.2, h(poles[i]) + 7.3, poles[i]);
        const b = new THREE.Vector3(ax + s * 9, h(poles[i]) + 6.6, poles[i] + (R() - 0.5) * 6);
        const mid = a.clone().lerp(b, 0.5); mid.y -= 0.4;
        B.geo(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, mid, b), 8, 0.022, 3), new THREE.Matrix4(), wireCol, 10);
      }
      spots.alley.push({ x: ax, z: (z0 + z1) / 2, y: h((z0 + z1) / 2), green: ax === GREEN_ALLEY.x && m === 0 });
    }
  }
  // green alley: planters, laundry lines, kids' toys, flowers
  {
    const ax = GREEN_ALLEY.x, z0 = GREEN_ALLEY.z0 + 12, z1 = GREEN_ALLEY.z1 - 12;
    for (let z = z0; z < z1; z += 7 + R() * 4) {
      const s = R() < 0.5 ? -1 : 1, x = ax + s * 1.6;
      B.box(x - 0.45, x + 0.45, h(z) - 0.1, h(z) + 0.55, z - 1.2, z + 1.2, L('#a8774f'), 3);
      C.add({ x0: x - 0.45, x1: x + 0.45, z0: z - 1.2, z1: z + 1.2, y0: h(z) - 0.1, y1: h(z) + 0.55 });
      for (let i = 0; i < 5; i++) {
        const g = new THREE.IcosahedronGeometry(0.28 + R() * 0.15, 0);
        B.geo(g, new THREE.Matrix4().makeTranslation(x + (R() - 0.5) * 0.5, h(z) + 0.75, z + (R() - 0.5) * 1.8), L(pick(['#5aa04a', '#e36f9c', '#f2b43c', '#7b4fb0', '#4f8f3a'], R)), 0);
      }
    }
    for (let z = z0 + 5; z < z1; z += 16) {   // laundry between back balconies
      const y = h(z) + 5.5, a = new THREE.Vector3(ax - 9, y, z), b = new THREE.Vector3(ax + 9, y, z + 2), mid = a.clone().lerp(b, 0.5); mid.y -= 0.6;
      const cv = new THREE.QuadraticBezierCurve3(a, mid, b);
      B.geo(new THREE.TubeGeometry(cv, 12, 0.015, 3), new THREE.Matrix4(), L('#f4efe6'), 10);
      for (let i = 1; i < 8; i++) { const p = cv.getPoint(i / 8); B.box(p.x - 0.3, p.x + 0.3, p.y - 0.75, p.y - 0.02, p.z - 0.02, p.z + 0.02, L(pick(['#f4efe6', '#d8473f', '#7fb2d6', '#f2b43c', '#e79cb4'], R)), 0); }
    }
  }

  // ---------------------------------------------------------- the park (Carré Saint-Louis)
  const pc = { x: (PARK.x0 + PARK.x1) / 2, z: (PARK.z0 + PARK.z1) / 2 };
  {
    const y = h(pc.z);
    // fountain: basin rim, water, tiered centre
    const rim = new THREE.LatheGeometry([new THREE.Vector2(7.4, -0.1), new THREE.Vector2(7.4, 0.55), new THREE.Vector2(6.8, 0.55), new THREE.Vector2(6.8, -0.1)], 48).toNonIndexed();
    rim.computeVertexNormals();
    B.geo(rim, new THREE.Matrix4().makeTranslation(pc.x, y, pc.z), L('#d2cabd'), 2);
    B.geo(new THREE.CylinderGeometry(6.85, 6.85, 0.3, 48), new THREE.Matrix4().makeTranslation(pc.x, y + 0.05, pc.z), L('#5fa8d6'), 5);
    B.geo(new THREE.CylinderGeometry(1.6, 2.0, 1.0, 20), new THREE.Matrix4().makeTranslation(pc.x, y + 0.6, pc.z), L('#c9c2b6'), 2);
    B.geo(new THREE.CylinderGeometry(2.4, 0.5, 0.35, 20), new THREE.Matrix4().makeTranslation(pc.x, y + 1.9, pc.z), L('#c9c2b6'), 2);
    B.geo(new THREE.CylinderGeometry(0.35, 0.45, 0.9, 12), new THREE.Matrix4().makeTranslation(pc.x, y + 1.5, pc.z), L('#c9c2b6'), 2);
    C.add({ x0: pc.x - 2.0, x1: pc.x + 2.0, z0: pc.z - 2.0, z1: pc.z + 2.0, y0: y - 0.2, y1: y + 1.1 });
    C.add({ x0: pc.x - 1.2, x1: pc.x + 1.2, z0: pc.z - 1.2, z1: pc.z + 1.2, y0: y - 0.2, y1: y + 2.08 });
    for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; C.add({ x0: pc.x + Math.cos(a) * 7.1 - 0.5, x1: pc.x + Math.cos(a) * 7.1 + 0.5, z0: pc.z + Math.sin(a) * 7.1 - 0.5, z1: pc.z + Math.sin(a) * 7.1 + 0.5, y0: y - 0.2, y1: y + 0.56 }); }
    spots.fountain = { x: pc.x, y: y + 2.08, z: pc.z };
    // gazebo (kiosque) on a raised platform you can step onto
    const gx = pc.x + 22, gz = pc.z - 22, gy = h(gz);
    B.geo(new THREE.CylinderGeometry(4.2, 4.4, 0.5, 8), new THREE.Matrix4().makeTranslation(gx, gy + 0.15, gz), L('#d8d0c2'), 2);
    C.add({ x0: gx - 3.8, x1: gx + 3.8, z0: gz - 3.8, z1: gz + 3.8, y0: gy - 0.2, y1: gy + 0.4 });
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + Math.PI / 8; const x = gx + Math.cos(a) * 3.7, z = gz + Math.sin(a) * 3.7; B.box(x - 0.1, x + 0.1, gy + 0.4, gy + 3.4, z - 0.1, z + 0.1, L('#f4efe6'), 0); C.add({ x0: x - 0.12, x1: x + 0.12, z0: z - 0.12, z1: z + 0.12, y0: gy, y1: gy + 3.4 }); }
    B.geo(new THREE.ConeGeometry(4.9, 2.1, 8), new THREE.Matrix4().makeTranslation(gx, gy + 4.45, gz), L('#3f9a6a'), 9);
    B.geo(new THREE.CylinderGeometry(4.9, 4.9, 0.25, 8), new THREE.Matrix4().makeTranslation(gx, gy + 3.47, gz), L('#f4efe6'), 0);
    spots.gazebo = { x: gx, y: gy + 0.4, z: gz };
    // trees, benches, lanterns
    for (let i = 0; i < 70; i++) {
      const x = PARK.x0 + 3 + R() * (PARK.x1 - PARK.x0 - 6), z = PARK.z0 + 3 + R() * (PARK.z1 - PARK.z0 - 6);
      const r = Math.hypot(x - pc.x, z - pc.z);
      const diag = Math.min(Math.abs((x - pc.x) - (z - pc.z) * 0.95), Math.abs((x - pc.x) + (z - pc.z) * 0.95));
      if (r < 18 || diag < 3 || Math.abs(x - pc.x) < 3 || Math.hypot(x - gx, z - gz) < 7) continue;
      trees.push([x, z, 1.0 + R() * 0.5, R() < 0.15 ? 1 : 0]);
    }
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2 + 0.2, x = pc.x + Math.cos(a) * 11.5, z = pc.z + Math.sin(a) * 11.5;
      bench(B, C, x, z, -a + Math.PI / 2); benches.push([x, z, -a + Math.PI / 2]);
    }
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2, x = pc.x + Math.cos(a) * 16.5, z = pc.z + Math.sin(a) * 16.5; lantern(B, C, glows, x, z); }
  }

  // ---------------------------------------------------------- metro plaza: pavilion, food truck, bus shelter, bikes
  {
    const cx = (PLAZA.x0 + PLAZA.x1) / 2, cz = (PLAZA.z0 + PLAZA.z1) / 2 - 6;
    const by = h(cz - 8) + 0.05;
    // pavilion: glass box under a big flat roof, the "M" sign on a pylon
    const px0 = cx - 9, px1 = cx + 9, pz0 = cz - 7, pz1 = cz + 7;
    B.box(px0 + 0.6, px1 - 0.6, h(pz1) - 0.3, by + 3.6, pz0 + 0.6, pz1 - 0.6, L('#7fb2d6'), 8);
    for (let x = px0 + 0.6; x <= px1 - 0.5; x += 2.0) for (const z of [pz0 + 0.55, pz1 - 0.55]) B.box(x - 0.06, x + 0.06, by, by + 3.6, z - 0.06, z + 0.06, L('#3d4650'), 10);
    B.box(px0, px1, by + 3.6, by + 4.3, pz0, pz1, L('#e9e4d8'), 0);
    B.box(px0 - 0.4, px1 + 0.4, by + 4.3, by + 4.45, pz0 - 0.4, pz1 + 0.4, L('#3d4650'), 9);
    C.add({ x0: px0 + 0.5, x1: px1 - 0.5, z0: pz0 + 0.5, z1: pz1 - 0.5, y0: h(pz1) - 0.3, y1: by + 3.6 });
    C.add({ x0: px0 - 0.4, x1: px1 + 0.4, z0: pz0 - 0.4, z1: pz1 + 0.4, y0: by + 3.55, y1: by + 4.45 });
    spots.pavilion = { x: cx, y: by + 4.45, z: cz };
    const metroR = atlas.draw(256, 256, (x, w, hh) => { x.fillStyle = '#1f6fbf'; x.fillRect(0, 0, w, hh); x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = `700 170px ${FONT}`; x.fillText('M', w / 2, hh / 2 + 10); });
    const metroName = atlas.draw(512, 96, (x, w, hh) => { x.fillStyle = '#1f6fbf'; x.fillRect(0, 0, w, hh); x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle'; fitText(x, 'MÉTRO MONT-ROYAL', w - 40, 56, 700); x.fillText('MÉTRO MONT-ROYAL', w / 2, hh / 2 + 3); });
    const mx = px1 + 2.5, mz = pz1 - 1, my = h(mz);
    B.box(mx - 0.15, mx + 0.15, my - 0.2, my + 4.6, mz - 0.15, mz + 0.15, L('#3d4650'), 10);
    S.box(mx, my + 5.2, mz, 1.2, 1.2, 0.25, 0, 0, metroR, SIDE, 1, metroR);
    S.box(cx, by + 3.95, pz1 + 0.06, 9, 0.6, 0.12, 0, 0, metroName, SIDE, 1);
    C.add({ x0: mx - 0.2, x1: mx + 0.2, z0: mz - 0.2, z1: mz + 0.2, y0: my, y1: my + 5.8 });
    // crates stacked against the pavilion (a way up to its roof)
    const crx = px1 + 1.0, crz = pz0 + 2;
    for (const [dx, dz, lvl] of [[0, 0, 0], [0, 1.0, 0], [1.0, 0, 0], [0, 0, 1], [0, 1.0, 1], [0, 0.5, 2]]) {
      const x = crx + dx, z = crz + dz, y = h(crz) + 0.05 + lvl * 0.95;
      B.box(x - 0.47, x + 0.47, y, y + 0.9, z - 0.47, z + 0.47, L('#b98a55'), 3);
      C.add({ x0: x - 0.47, x1: x + 0.47, z0: z - 0.47, z1: z + 0.47, y0: y, y1: y + 0.9 });
    }
    // food truck
    const tx = cx - 5, tz = PLAZA.z1 - 6;
    foodTruck(B, C, S, atlas, tx, tz, SIDE, FONT);
    spots.truck = { x: tx, y: h(tz) + 3.3, z: tz };
    shops.push({ x: tx + 2.6, z: tz, name: 'Camion à poutine', kind: 'poutine', line: 'Une poutine bien chaude? Mange-la sur la place.' });
    // bike-share dock
    for (let i = 0; i < 7; i++) { const z = PLAZA.z0 + 4 + i * 1.1, x = PLAZA.x1 - 2.2; bike(B, x, z); }
    // bus shelter on Mont-Royal (with a bin and a bench to climb)
    const sx = 26, sz = ewZ(-1) - ewHW(-1) - 2.2, sy = h(sz) + CURB;
    for (const dx of [-2.2, 2.2]) for (const dz of [-0.7, 0.7]) B.box(sx + dx - 0.05, sx + dx + 0.05, sy, sy + 2.5, sz + dz - 0.05, sz + dz + 0.05, L('#3d4650'), 10);
    B.box(sx - 2.25, sx + 2.25, sy + 0.2, sy + 2.3, sz - 0.73, sz - 0.67, L('#9fd3e8'), 5);
    B.box(sx - 2.5, sx + 2.5, sy + 2.5, sy + 2.62, sz - 1.0, sz + 1.0, L('#e9e4d8'), 0);
    C.add({ x0: sx - 2.5, x1: sx + 2.5, z0: sz - 1.0, z1: sz + 1.0, y0: sy + 2.45, y1: sy + 2.62 });
    C.add({ x0: sx - 2.25, x1: sx + 2.25, z0: sz - 0.78, z1: sz - 0.62, y0: sy, y1: sy + 2.3, thin: true });
    bench(B, C, sx, sz - 0.2, Math.PI);
    const bx = sx + 3.1, bz = sz - 0.4;
    B.box(bx - 0.4, bx + 0.4, sy, sy + 1.25, bz - 0.4, bz + 0.4, L('#2f7f4a'), 0);
    C.add({ x0: bx - 0.4, x1: bx + 0.4, z0: bz - 0.4, z1: bz + 0.4, y0: sy, y1: sy + 1.25 });
    spots.shelter = { x: sx, y: sy + 2.62, z: sz };
  }

  // ---------------------------------------------------------- the church on Saint-Denis
  {
    const x0 = CHURCH.x0 + 4, x1 = CHURCH.x1 - 2, z0 = CHURCH.z0 + 2, z1 = CHURCH.z1 - 2;
    const base = h(z0) + 0.6, y0 = h(z1) - 1;
    const stone = L('#bdb3a2'), roofC = L('#4f8f86');
    // nave
    B.box(x0 + 8, x1, y0, base + 13, z0 + 6, z1 - 6, stone, 2, [1, 0, 0, 0, 1, 1]);
    const nl = x1 - (x0 + 8), nw = (z1 - 6) - (z0 + 6);
    const roof = new THREE.CylinderGeometry(nw * 0.6, nw * 0.6, nl - 0.04, 4, 1); roof.rotateZ(Math.PI / 2); roof.rotateX(Math.PI / 4);
    B.geo(roof, new THREE.Matrix4().compose(new THREE.Vector3((x0 + 8 + x1) / 2 + 0.02, base + 13, (z0 + z1) / 2), new THREE.Quaternion(), new THREE.Vector3(1, 0.32, 1)), roofC, 9);
    // front tower block with the spire
    B.box(x0, x0 + 8, y0, base + 17, z0 + 4, z1 - 4, stone, 2);
    B.box(x0 + 1, x0 + 7, base + 17, base + 26, (z0 + z1) / 2 - 3, (z0 + z1) / 2 + 3, stone, 2);
    B.geo(new THREE.ConeGeometry(4.2, 14, 8), new THREE.Matrix4().makeTranslation(x0 + 4, base + 33, (z0 + z1) / 2), roofC, 9);
    B.box(x0 + 3.92, x0 + 4.08, base + 40, base + 42.6, (z0 + z1) / 2 - 0.08, (z0 + z1) / 2 + 0.08, L('#e8c464'), 10);
    B.box(x0 + 3.92, x0 + 4.08, base + 41.5, base + 41.66, (z0 + z1) / 2 - 0.7, (z0 + z1) / 2 + 0.7, L('#e8c464'), 10);
    // rose window, arched doors, clock
    const zc = (z0 + z1) / 2;
    windowAt('x', x0, -1, zc, base + 11, 3.2, 3.2, L('#9d8f7a'));
    for (const dz of [-3.2, 0, 3.2]) doorAt('x', x0, -1, zc + dz, base, dz ? 1.5 : 2.2, dz ? 3.2 : 4.2, L('#6b3a24'), L('#9d8f7a'));
    for (const dz of [-1, 1]) windowAt('x', x0 + 0.0, -1, zc + dz * 2.2, base + 21, 1.0, 3.6, L('#9d8f7a'));
    for (let x = x0 + 11; x < x1 - 2; x += 5) for (const z of [z0 + 6, z1 - 6]) windowAt('z', z, z < zc ? -1 : 1, x, base + 7, 1.6, 5.2, L('#9d8f7a'));
    C.add({ x0: x0, x1: x1, z0: z0 + 4, z1: z1 - 4, y0, y1: base + 26 });
    // front steps (walkable)
    for (let i = 0; i < 4; i++) { const sx = x0 - 0.6 * (i + 1); B.box(sx, x0, y0, base - 0.15 * i, zc - 5, zc + 5, L('#c9c2b6'), 2); C.add({ x0: sx, x1: x0, z0: zc - 5, z1: zc + 5, y0, y1: base - 0.15 * i }); }
    spots.church = { x: x0 - 0.5, y: base, z: zc };
    shops.push({ x: x0 - 3, z: zc, name: 'Église Saint-Jean', kind: 'church', line: 'Les cloches sonnent à chaque heure. Bienvenue.' });
  }

  // ---------------------------------------------------------- street name plates + stop signs at corners
  const plate = (text) => atlas.draw(384, 72, (x, w, hh) => { x.fillStyle = '#1f4f9f'; x.fillRect(0, 0, w, hh); x.strokeStyle = '#fff'; x.lineWidth = 4; x.strokeRect(6, 6, w - 12, hh - 12); x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle'; fitText(x, text, w - 30, 40, 600); x.fillText(text, w / 2, hh / 2 + 2); });
  const plates = {};
  const arret = atlas.draw(256, 256, (x, w, hh) => {
    x.fillStyle = '#e9e4d8'; x.fillRect(0, 0, w, hh);
    x.fillStyle = '#d0312d'; x.beginPath(); for (let i = 0; i < 8; i++) { const a = Math.PI / 8 + i * Math.PI / 4; x.lineTo(w / 2 + Math.cos(a) * 124, hh / 2 + Math.sin(a) * 124); } x.fill();
    x.strokeStyle = '#fff'; x.lineWidth = 8; x.beginPath(); for (let i = 0; i < 8; i++) { const a = Math.PI / 8 + i * Math.PI / 4; x.lineTo(w / 2 + Math.cos(a) * 112, hh / 2 + Math.sin(a) * 112); } x.closePath(); x.stroke();
    x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = `700 62px ${FONT}`; x.fillText('ARRÊT', w / 2, hh / 2 + 4);
  });
  const stopFaces = [];
  for (let k = -1; k <= 1; k++) for (let m = -2; m <= 2; m++) {
    const sx = nsX(k), sz = ewZ(m);
    if (sz < DETAIL.z0 - 5 || sz > DETAIL.z1 + 5) continue;
    const ox = nsHW(k) + 0.5, oz = ewHW(m) + 0.5;
    const nsN = (await0(plates, 'ns' + k, () => plate(nameNS(k)))), ewN = await0(plates, 'ew' + m, () => plate(nameEW(m)));
    const lights = k === 0 && (m === -1 || m === 1);
    for (const [cxs, czs] of [[1, 1], [-1, -1]]) {
      const x = sx + cxs * ox, z = sz + czs * oz, y = h(z) + CURB;
      B.box(x - 0.05, x + 0.05, y - 0.2, y + 3.2, z - 0.05, z + 0.05, poleCol, 10);
      C.add({ x0: x - 0.08, x1: x + 0.08, z0: z - 0.08, z1: z + 0.08, y0: y, y1: y + 3.2 });
      S.box(x, y + 3.45, z, 1.9, 0.36, 0.06, 0, 0, ewN, SIDE, 0, ewN);
      S.box(x, y + 3.85, z, 1.9, 0.36, 0.06, Math.PI / 2, 0, nsN, SIDE, 0, nsN);
      if (!lights && k !== 0) {
        // all-way stop: octagon facing traffic on the north-south street
        const g = new THREE.CylinderGeometry(0.42, 0.42, 0.05, 8);
        stopFaces.push({ g, x: x, y: y + 2.3, z: z + czs * 0.06, ry: czs > 0 ? 0 : Math.PI });
      }
    }
  }
  for (const s of stopFaces) {
    const g = s.g; g.rotateY(Math.PI / 8); g.rotateX(Math.PI / 2); g.rotateY(s.ry);
    const uv = g.attributes.uv, P = g.attributes.position, N = g.attributes.normal, Sz = atlas.size;
    for (let i = 0; i < uv.count; i++) {
      const nz = N.getZ(i) * (s.ry ? -1 : 1);
      if (nz > 0.9) { const px = P.getX(i) * (s.ry ? -1 : 1), py = P.getY(i); uv.setXY(i, (arret.x + (0.5 + px / 0.92) * arret.w) / Sz, 1 - (arret.y + (0.5 - py / 0.92) * arret.h) / Sz); }
      else uv.setXY(i, (SIDE.x + 4) / Sz, 1 - (SIDE.y + 4) / Sz);
    }
    g.translate(s.x, s.y, s.z); g.setAttribute('aGlow', new THREE.Float32BufferAttribute(new Float32Array(P.count), 1));
    S.gs.push(g);
  }

  // ---------------------------------------------------------- ground, backdrop
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(3200, 3200, 1, 64).rotateX(-Math.PI / 2), groundMaterial());
  { const P = ground.geometry.attributes.position; for (let i = 0; i < P.count; i++) P.setY(i, h(P.getZ(i))); ground.geometry.computeVertexNormals(); }
  ground.receiveShadow = true; ground.matrixAutoUpdate = false;
  scene.add(ground);

  const city = B.build(batchMaterial(), 'city');
  scene.add(city);
  // trees (instanced) — canopies change with the seasons
  const treesObj = buildTrees(scene, trees, C);
  const signs = S.build(); scene.add(signs);
  glows.commit(); scene.add(glows.mesh);
  const backdrop = buildBackdrop(scene, glows);
  glows.commit();

  return { city, signs, ground, colliders: C, spots, npcPaths, shops, lamps, glows, trees: treesObj, benches, backdrop, tris: city.userData.tris, parkC: pc, foot };
}
function await0(o, k, f) { if (!o[k]) o[k] = f(); return o[k]; }
const nameNS = (k) => ({ '-1': 'Rue Drolet', 0: 'Rue Saint-Denis', 1: 'Rue Saint-Hubert' }[k] || 'Rue');
const nameEW = (m) => ({ '-2': 'Rue Gilford', '-1': 'Av. du Mont-Royal', 0: 'Rue Marie-Anne', 1: 'Rue Rachel', 2: 'Rue Duluth' }[m] || 'Rue');

// ================================================================= small props
function bench(B, C, x, z, ry) {
  const y = h(z) + 0.02, wood = lin('#b07a4a'), iron = lin('#2a3036');
  const c = Math.cos(ry), s = Math.sin(ry);
  const P = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
  for (const lx of [-0.75, 0.75]) { const [px, pz] = P(lx, 0); B.boxM(px, y + 0.22, pz, 0.08, 0.44, 0.5, 0, ry, 0, iron, 10); }
  for (let i = 0; i < 3; i++) { const [px, pz] = P(0, -0.18 + i * 0.16); B.boxM(px, y + 0.47, pz, 1.8, 0.05, 0.13, 0, ry, 0, wood, 3); }
  for (let i = 0; i < 2; i++) { const [px, pz] = P(0, -0.3); B.boxM(px, y + 0.65 + i * 0.18, pz - 0.0, 1.8, 0.12, 0.05, 0, ry, 0, wood, 3); }
  C.add({ x0: x - 0.9, x1: x + 0.9, z0: z - 0.9, z1: z + 0.9, y0: y, y1: y + 0.5 });
}
function lantern(B, C, glows, x, z) {
  const y = h(z), c = lin('#1f2a26');
  B.box(x - 0.07, x + 0.07, y - 0.1, y + 3.4, z - 0.07, z + 0.07, c, 10);
  B.geo(new THREE.CylinderGeometry(0.22, 0.15, 0.55, 6), new THREE.Matrix4().makeTranslation(x, y + 3.7, z), lin('#fff1cc'), 7);
  B.geo(new THREE.ConeGeometry(0.32, 0.3, 6), new THREE.Matrix4().makeTranslation(x, y + 4.12, z), c, 10);
  C.add({ x0: x - 0.1, x1: x + 0.1, z0: z - 0.1, z1: z + 0.1, y0: y, y1: y + 4 });
  glows.add(x, y + 3.7, z, 1, 0.85, 0.6, 0.6);
}
function bike(B, x, z) {
  const y = h(z) + 0.02, fr = lin('#d0312d'), dk = lin('#2a3036');
  for (const dx of [-0.5, 0.5]) B.geo(new THREE.TorusGeometry(0.32, 0.035, 5, 14).rotateY(Math.PI / 2), new THREE.Matrix4().makeTranslation(x + 0, y + 0.34, z + dx * 0.0 + dx * 0), dk, 10);
  B.box(x - 0.03, x + 0.03, y + 0.34, y + 0.8, z - 0.5, z + 0.5, fr, 0);
  B.box(x - 0.15, x + 0.15, y + 0.85, y + 0.92, z + 0.25, z + 0.45, dk, 0);
}
export function carStatic(B, C, x, z, ry, col) {
  const y = h(z);
  const c = Math.cos(ry), s = Math.sin(ry);
  // body (lower + cabin), lights inside the body faces, wheels
  B.boxM(x, y + 0.62, z, 1.78, 0.62, 4.3, 0, ry, 0, col, 0);
  B.boxM(x - s * 0.15, y + 1.2, z - c * 0.15, 1.6, 0.56, 2.3, 0, ry, 0, col, 0);
  B.boxM(x - s * 0.15, y + 1.2, z - c * 0.15, 1.66, 0.42, 2.0, 0, ry, 0, lin('#6f9ccc'), 5);
  for (const [lx, lz] of [[0.82, 1.35], [-0.82, 1.35], [0.82, -1.35], [-0.82, -1.35]]) {
    const wx = x + lx * c + lz * s, wz = z - lx * s + lz * c;
    B.geo(new THREE.CylinderGeometry(0.34, 0.34, 0.24, 10).rotateZ(Math.PI / 2).rotateY(ry), new THREE.Matrix4().makeTranslation(wx, y + 0.34, wz), lin('#1e1f24'), 10);
  }
  const ex = Math.abs(c) * 0.95 + Math.abs(s) * 2.2, ez = Math.abs(s) * 0.95 + Math.abs(c) * 2.2;
  C.add({ x0: x - ex, x1: x + ex, z0: z - ez, z1: z + ez, y0: y, y1: y + 1.5 });
}
function foodTruck(B, C, S, atlas, x, z, SIDE, FONT) {
  const y = h(z), body = lin('#f2b43c');
  B.box(x - 1.3, x + 1.3, y + 0.5, y + 3.2, z - 3.4, z + 3.4, body, 0);
  B.box(x - 1.25, x + 1.25, y + 0.5, y + 2.3, z + 3.4, z + 4.8, body, 0);
  B.box(x - 1.27, x + 1.27, y + 1.55, y + 2.2, z + 3.6, z + 4.75, lin('#6f9ccc'), 5);
  B.box(x + 1.3, x + 1.36, y + 1.5, y + 2.6, z - 2.4, z + 1.4, lin('#f4efe6'), 8);
  B.box(x + 1.3, x + 2.2, y + 1.3, y + 1.38, z - 2.4, z + 1.4, lin('#f4efe6'), 0);   // counter
  for (const [dz, dx] of [[-2.4, -1.3], [-2.4, 1.3], [2.8, -1.3], [2.8, 1.3]]) B.geo(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 10).rotateZ(Math.PI / 2), new THREE.Matrix4().makeTranslation(x + dx * 0.95, y + 0.42, z + dz), lin('#1e1f24'), 10);
  C.add({ x0: x - 1.3, x1: x + 1.3, z0: z - 3.4, z1: z + 4.8, y0: y, y1: y + 3.2 });
  const r = atlas.draw(512, 128, (cx, w, hh) => { cx.fillStyle = '#f2b43c'; cx.fillRect(0, 0, w, hh); cx.fillStyle = '#7a2f1a'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.font = `700 64px ${FONT}`; cx.fillText('POUTINE!', w / 2, hh / 2 + 4); });
  S.box(x + 1.38, y + 2.85, z - 0.5, 5.2, 0.62, 0.06, Math.PI / 2, 0, r, SIDE, 1);
  // cooler + step to climb the truck
  B.box(x + 1.6, x + 2.4, y, y + 0.8, z + 2.0, z + 2.8, lin('#2f7fbf'), 0); C.add({ x0: x + 1.6, x1: x + 2.4, z0: z + 2.0, z1: z + 2.8, y0: y, y1: y + 0.8 });
  B.box(x + 1.4, x + 2.2, y, y + 1.9, z + 3.0, z + 3.9, lin('#b98a55'), 3); C.add({ x0: x + 1.4, x1: x + 2.2, z0: z + 3.0, z1: z + 3.9, y0: y, y1: y + 1.9 });
  C.add({ x0: x - 1.3, x1: x + 1.3, z0: z - 3.4, z1: z + 3.4, y0: y + 3.1, y1: y + 3.2 });
}

// ================================================================= trees (instanced) with seasons
function buildTrees(scene, list, C) {
  const n = list.length;
  const trunkG = new THREE.CylinderGeometry(0.14, 0.24, 4.2, 6); trunkG.translate(0, 2.1, 0);
  const blob = (r, x, y, z, sy = 0.85) => { const g = new THREE.IcosahedronGeometry(r, 1); g.scale(1, sy, 1); g.translate(x, y, z); return g; };
  const crownG = mergeGeometries([blob(2.1, 0, 5.4, 0), blob(1.5, 1.3, 4.9, 0.4), blob(1.4, -1.2, 5.0, -0.5), blob(1.3, 0.2, 6.6, 0.2), blob(1.2, -0.3, 4.7, 1.3)]);
  const pineG = mergeGeometries([new THREE.ConeGeometry(2.0, 3.0, 8).translate(0, 3.2, 0), new THREE.ConeGeometry(1.6, 2.6, 8).translate(0, 4.8, 0), new THREE.ConeGeometry(1.1, 2.2, 8).translate(0, 6.2, 0)]);
  const branchG = mergeGeometries([0, 1, 2, 3, 4].map((i) => { const g = new THREE.CylinderGeometry(0.04, 0.09, 2.6, 4); g.translate(0, 1.3, 0); g.rotateZ(0.6 + (i % 2) * 0.3); g.rotateY(i * 1.3); g.translate(0, 3.6 + (i % 3) * 0.6, 0); return g; }));
  const trunkM = toon('#6e4a36');
  const crownM = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: gradient });
  crownM.onBeforeCompile = (sh) => {
    sh.uniforms.uAutumn = U.uAutumn; sh.uniforms.uSnow = U.uSnow; sh.uniforms.uTime = U.uTime;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nflat varying float vSeed; varying float vUp; uniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vec4 org = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0); vSeed = fract(org.x * 0.173 + org.z * 0.0911); vUp = normal.y;
transformed.x += sin(uTime * 1.3 + vSeed * 30.0) * 0.06 * max(transformed.y - 3.0, 0.0);`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uAutumn, uSnow; flat varying float vSeed; varying float vUp;')
      .replace('#include <color_fragment>', `#include <color_fragment>
vec3 fall = vSeed < 0.33 ? vec3(0.86, 0.30, 0.16) : vSeed < 0.66 ? vec3(0.95, 0.62, 0.18) : vec3(0.92, 0.80, 0.30);
diffuseColor.rgb = mix(diffuseColor.rgb, fall, uAutumn * step(0.1, vSeed));
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.94, 0.96, 1.0), uSnow * smoothstep(0.1, 0.6, vUp));`);
  };
  crownM.customProgramCacheKey = () => 'crown';
  const pineM = new THREE.MeshToonMaterial({ color: 0x2f6b4a, gradientMap: gradient });
  pineM.onBeforeCompile = (sh) => { sh.uniforms.uSnow = U.uSnow; sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vUp;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvUp = normal.y;'); sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uSnow; varying float vUp;').replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.94,0.96,1.0), uSnow * smoothstep(0.2,0.6,vUp));'); };
  pineM.customProgramCacheKey = () => 'pine';
  const trunks = new THREE.InstancedMesh(trunkG, trunkM, n), crowns = new THREE.InstancedMesh(crownG, crownM, n), pines = new THREE.InstancedMesh(pineG, pineM, n), branches = new THREE.InstancedMesh(branchG, trunkM, n);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), col = new THREE.Color();
  const greens = ['#5aa04a', '#4f9a44', '#6bb054', '#3f8a46', '#7ab85a'];
  let nc = 0, np = 0;
  const R = rng(77);
  list.forEach(([x, z, s, type], i) => {
    m4.compose(new THREE.Vector3(x, h(z) - 0.1, z), q.setFromAxisAngle(up, R() * 6.28), new THREE.Vector3(s, s * (0.9 + R() * 0.2), s));
    trunks.setMatrixAt(i, m4); branches.setMatrixAt(i, m4);
    if (type === 1) pines.setMatrixAt(np++, m4); else { crowns.setMatrixAt(nc, m4); crowns.setColorAt(nc++, col.set(pick(greens, R))); }
    C.add({ x0: x - 0.25 * s, x1: x + 0.25 * s, z0: z - 0.25 * s, z1: z + 0.25 * s, y0: h(z) - 0.2, y1: h(z) + 4 * s });
  });
  crowns.count = nc; pines.count = np;
  for (const m of [trunks, crowns, pines, branches]) { m.castShadow = true; m.receiveShadow = true; m.computeBoundingSphere(); m.frustumCulled = false; scene.add(m); }
  branches.visible = false;
  return { trunks, crowns, pines, branches, setWinter(w) { crowns.visible = !w; branches.visible = w; } };
}

// ================================================================= backdrop: Mount Royal with its cross, downtown towers
function buildBackdrop(scene, glows) {
  const g = new THREE.Group(); g.name = 'backdrop';
  const fogless = (hex) => { const m = new THREE.MeshToonMaterial({ color: hex, gradientMap: gradient, fog: false }); return m; };
  // the mountain: a soft, wide hill with autumn-able forest bumps
  const hill = new THREE.SphereGeometry(1, 64, 24, 0, Math.PI * 2, 0, Math.PI / 2);
  const P = hill.attributes.position, cols = [];
  const R = rng(9);
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
    const n = 1 + 0.06 * Math.sin(x * 9 + z * 7) + 0.04 * Math.sin(x * 23 - z * 17);
    P.setXYZ(i, x * 620 * n, y * 210 * n * (1 - 0.25 * Math.abs(x)), z * 300 * n);
  }
  hill.computeVertexNormals();
  const hm = fogless('#6f9a74');
  hm.onBeforeCompile = (sh) => {
    sh.uniforms.uAutumn = U.uAutumn; sh.uniforms.uSnow = U.uSnow; sh.uniforms.uNight = U.uNight;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vLP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvLP = position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
uniform float uAutumn, uSnow, uNight; varying vec3 vLP;
float hh(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
vec2 q = vLP.xz / 38.0; vec2 i = floor(q), f = fract(q); f = f * f * (3.0 - 2.0 * f);
float r = mix(mix(hh(i), hh(i + vec2(1, 0)), f.x), mix(hh(i + vec2(0, 1)), hh(i + vec2(1, 1)), f.x), f.y);
r = floor(r * 4.0) / 4.0;                       // painted, banded patches
vec3 g1 = mix(vec3(0.36, 0.58, 0.40), vec3(0.46, 0.66, 0.44), r);
vec3 f1 = r < 0.3 ? vec3(0.80, 0.40, 0.26) : r < 0.6 ? vec3(0.90, 0.62, 0.30) : vec3(0.58, 0.62, 0.38);
vec3 c = mix(g1, f1, uAutumn);
c = mix(c, vec3(0.92, 0.94, 0.98), uSnow * 0.85);
c = mix(c, vec3(0.62, 0.75, 0.88), 0.32);         // aerial perspective
c = mix(c, vec3(0.08, 0.10, 0.20), uNight * 0.7);
diffuseColor.rgb = c;`);
  };
  hm.customProgramCacheKey = () => 'hill';
  const mtn = new THREE.Mesh(hill, hm); mtn.position.set(-120, h(-900) - 30, -900); g.add(mtn);
  // the cross on the summit (lit at night)
  const crossM = new THREE.MeshToonMaterial({ color: 0xe9eef5, gradientMap: gradient, fog: false, emissive: 0xffffff, emissiveIntensity: 0 });
  const cy = mtn.position.y + 205, cx = -120, cz = -900;
  const cross = new THREE.Group();
  cross.add(new THREE.Mesh(new THREE.BoxGeometry(3, 34, 3), crossM)); const arm = new THREE.Mesh(new THREE.BoxGeometry(14, 3, 3), crossM); arm.position.y = 8; cross.add(arm);
  cross.position.set(cx, cy + 15, cz); g.add(cross);
  for (let i = 0; i < 12; i++) glows.add(cx, cy + 1 + i * 2.6, cz + 2, 1, 1, 1, 3.5);
  for (const dx of [-5, -2.5, 2.5, 5]) glows.add(cx + dx, cy + 23, cz + 2, 1, 1, 1, 3.5);
  // distant downtown skyline (south-west), simple toon towers
  const tR = rng(5), towerCols = ['#9fb6cc', '#b8c4d4', '#8fa6bf', '#c8d0dc', '#7f96b2'];
  for (let i = 0; i < 26; i++) {
    const w = 18 + tR() * 26, hh = 60 + tR() * 150, x = -950 + tR() * 700, z = 700 + tR() * 380;
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, hh, w * (0.7 + tR() * 0.6)), fogless(pick(towerCols, tR)));
    m.position.set(x, h(z) + hh / 2 - 20, z); g.add(m);
  }
  g.traverse((o) => { if (o.isMesh) { o.matrixAutoUpdate = false; o.updateMatrix(); } });
  scene.add(g);
  return { group: g, crossM, mountain: mtn };
}
