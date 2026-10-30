// landmarks.js — Montreal's hero buildings, bridges and the REM, at their real positions.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ll2g, terrainH, waterSDF, exclude, BOXES, U, mulberry, lineU, lineV, hwU, hwV, D, district, floorAt, roadEdge } from './core.js';
import { addBox } from './city.js';
import { STYLE, GlowField } from './shaders.js';

// ---------------------------------------------------------------- materials
const std = (c, r = 0.8, m = 0, extra = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: r, metalness: m }, extra));
export const MAT = {
  stone: std(0x9c978e, 0.85), stoneL: std(0xbfb8aa, 0.85), stoneD: std(0x6f6a63, 0.9), copper: std(0x5f9e87, 0.55, 0.35),
  slate: std(0x3d434b, 0.7, 0.1), silver: std(0xc9ced3, 0.28, 0.9), steelG: std(0x56695e, 0.55, 0.6), steel: std(0x7b8186, 0.5, 0.7),
  rust: std(0x5a4a3f, 0.7, 0.4), conc: std(0xa9a69e, 0.9), concD: std(0x7f7b74, 0.92), white: std(0xe9e8e3, 0.6), glass: std(0x1f2f37, 0.08, 0.85),
  red: std(0xa3241d, 0.6), green: std(0x2f6b45, 0.7), gold: std(0xc9a14a, 0.3, 0.9), brickY: std(0xc7b07a, 0.85), dark: std(0x1c1d1f, 0.6),
  asphalt: std(0x2a2b2d, 0.9), wood: std(0x6e4b33, 0.85), cable: std(0xdedede, 0.4, 0.6), yellow: std(0xd8b23a, 0.6),
};
const NIGHT = [];   // [material, base emissive intensity]
function nightMat(color, emissive, base, r = 0.6, m = 0) {
  const mat = new THREE.MeshStandardMaterial({ color, roughness: r, metalness: m, emissive, emissiveIntensity: 0 });
  NIGHT.push([mat, base]); return mat;
}
MAT.lampW = nightMat(0xdddddd, 0xfff2d8, 3.2); MAT.lampCross = nightMat(0xcfd3d8, 0xffffff, 4.0, 0.4, 0.6);
MAT.winWarm = nightMat(0x223038, 0xffc77a, 1.6, 0.15, 0.6); MAT.ledRim = nightMat(0x9aa3ad, 0x9fd8ff, 3.0, 0.3, 0.8);
MAT.goldLit = nightMat(0xc9a14a, 0xffb347, 1.2, 0.3, 0.9); MAT.blueLit = nightMat(0x6f7f8f, 0x4aa8ff, 1.5, 0.4, 0.6);

// ---------------------------------------------------------------- geometry kit
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3();
class Kit {
  constructor() { this.parts = new Map(); this.solo = []; }
  add(mat, geo, x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
    _m.compose(_v.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz, 'YXZ')), _s.set(sx, sy, sz));
    const g = (geo.index ? geo.toNonIndexed() : geo.clone()).applyMatrix4(_m);
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    let a = this.parts.get(mat); if (!a) this.parts.set(mat, a = []); a.push(g);
    return g;
  }
  box(mat, w, h, d, x, y, z, ry = 0) { return this.add(mat, new THREE.BoxGeometry(w, h, d), x, y + h / 2, z, ry); }
  cyl(mat, rt, rb, h, x, y, z, seg = 16, open = false) { return this.add(mat, new THREE.CylinderGeometry(rt, rb, h, seg, 1, open), x, y + h / 2, z); }
  beam(mat, a, b, t, t2 = t) {
    const d = new THREE.Vector3().subVectors(b, a), L = d.length();
    if (L < 1e-3) return;
    const g = new THREE.BoxGeometry(t, L, t2);
    _q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    _m.compose(_v.copy(a).add(b).multiplyScalar(0.5), _q, _s.set(1, 1, 1));
    const gg = g.toNonIndexed().applyMatrix4(_m);
    let arr = this.parts.get(mat); if (!arr) this.parts.set(mat, arr = []); arr.push(gg);
  }
  build(name, cast = true) {
    const grp = new THREE.Group(); grp.name = name;
    for (const [mat, gs] of this.parts) {
      const g = mergeGeometries(gs, false); g.computeBoundingSphere();
      const mesh = new THREE.Mesh(g, mat); mesh.castShadow = cast; mesh.receiveShadow = true; mesh.matrixAutoUpdate = false;
      grp.add(mesh);
    }
    for (const s of this.solo) grp.add(s);
    return grp;
  }
}
function prismGeo(w, h, len) {
  const sh = new THREE.Shape(); sh.moveTo(-w / 2, 0); sh.lineTo(w / 2, 0); sh.lineTo(0, h); sh.lineTo(-w / 2, 0);
  const g = new THREE.ExtrudeGeometry(sh, { depth: len, bevelEnabled: false }); g.translate(0, 0, -len / 2); return g;
}
function place(grp, u, v, y, yawDeg = 0) {
  grp.position.set(u, y, -v); grp.rotation.y = yawDeg * Math.PI / 180; grp.updateMatrix(); grp.matrixAutoUpdate = false;
  grp.updateMatrixWorld(true);
  return grp;
}
// local (x right, z back) -> grid (u,v) for a landmark placed at (u0,v0) with yaw
function l2g(u0, v0, yawDeg, x, z) {
  const a = yawDeg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  const wx = x * c + z * s, wz = -x * s + z * c;
  return [u0 + wx, v0 - wz];
}
function hmax(u0, v0, r) { let h = -1e9; for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) h = Math.max(h, terrainH(u0 + i * r / 2, v0 + j * r / 2)); return h; }
function hmin(u0, v0, r) { let h = 1e9; for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) h = Math.min(h, terrainH(u0 + i * r / 2, v0 + j * r / 2)); return h; }
function nearestLand(u, v, need = 8) {
  if (waterSDF(u, v) > need) return [u, v];
  for (let r = 10; r < 600; r += 10) for (let a = 0; a < 16; a++) {
    const uu = u + Math.cos(a / 16 * 6.283) * r, vv = v + Math.sin(a / 16 * 6.283) * r;
    if (waterSDF(uu, vv) > need) return [uu, vv];
  }
  return [u, v];
}
// centre of the widest nearby land (Habitat sits on the narrow Cité du Havre)
function nearLandStrip(u, v) {
  let best = [u, v], bs = waterSDF(u, v);
  for (let r = 0; r <= 400; r += 20) for (let a = 0; a < 24; a++) {
    const uu = u + Math.cos(a / 24 * 6.283) * r, vv = v + Math.sin(a / 24 * 6.283) * r;
    const s = waterSDF(uu, vv) - r * 0.05; if (s > bs) { bs = s; best = [uu, vv]; }
  }
  return best;
}
function canvasTex(w, h, draw, opts = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (opts.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  return t;
}

// ---------------------------------------------------------------- registry
export const LANDMARKS = [];
function reg(id, name, fr, area, year, facts, u, v, opts = {}) {
  const L = Object.assign({ id, name, fr, area, year, facts, u, v, h: opts.h || 40, yaw: opts.yaw ?? 200, dist: opts.dist || 260, pitch: opts.pitch ?? 18 }, opts);
  LANDMARKS.push(L); return L;
}
const G = (lat, lon) => ll2g(lat, lon);

// ---------------------------------------------------------------- hero towers (facade shader)
// Each entry: [id, name, u, v, w(u), d(v), h, style, colour, extra]
function blockCenter(k, m) { return [(lineU(k) + lineU(k + 1)) / 2, (lineV(m) + lineV(m + 1)) / 2]; }
const HEROES = [];
export function registerExclusions() {
  const T = (id, k, m, w, d, h, style, col, extra = {}) => { const [u, v] = blockCenter(k, m); HEROES.push(Object.assign({ id, u: u + (extra.du || 0), v: v + (extra.dv || 0), w, d, h, style, col }, extra)); };
  T('pvm', -1, 1, 0, 0, 188, STYLE.ALU, [0.70, 0.72, 0.74], { cruciform: true });
  T('1000', -2, -1, 56, 46, 176, STYLE.ALU, [0.80, 0.76, 0.68], { pyramid: 29 });
  T('1250', -4, 0, 50, 38, 178, STYLE.GLASS, [0.55, 0.60, 0.64], { crown: 21 });
  T('cibc', -4, 1, 40, 34, 187, STYLE.DARK, [0.16, 0.22, 0.20], {});
  T('sunlife', -2, 1, 84, 72, 122, STYLE.STONE, [0.66, 0.64, 0.60], { tiers: [62, 95] });
  T('bourse', 1, -1, 42, 42, 190, STYLE.DARK, [0.28, 0.24, 0.20], { bands: true });
  T('marriott', -3, -1, 44, 26, 139, STYLE.BRUTAL, [0.86, 0.85, 0.82], {});
  T('canadiens', -5, -1, 34, 30, 167, STYLE.GLASS, [0.50, 0.56, 0.60], { dv: 30 });
  T('deloitte', -5, -2, 46, 34, 130, STYLE.COPPERGLASS, [0.36, 0.42, 0.40], {});
  T('1501', 0, 3, 44, 40, 158, STYLE.GLASS, [0.40, 0.48, 0.54], { crown: 14, dv: -20 });
  T('kpmg', -3, 4, 38, 34, 128, STYLE.STONE, [0.62, 0.58, 0.52], { pyramid: 18 });
  T('hydro', 5, 1, 52, 30, 137, STYLE.ALU, [0.62, 0.66, 0.70], {});
  T('desjardins', 7, 2, 0, 0, 152, STYLE.CONCRETE, [0.70, 0.68, 0.63], { desj: true });
  T('pda', 6, 3, 86, 58, 30, STYLE.BRUTAL, [0.42, 0.40, 0.38], { dv: 30 });
  T('bell', -4, -1, 92, 120, 38, STYLE.GLASS, [0.30, 0.36, 0.40], {});
  for (const H of HEROES) {
    const hw = (H.w || 90) / 2 + 4, hd = (H.d || 90) / 2 + 4;
    exclude(H.u - hw, H.u + hw, H.v - hd, H.v + hd);
  }
  // Mary Queen of the World cathedral block, Old Montreal heroes, campuses handled by the mask
  const [cu, cv] = blockCenter(-2, 0); exclude(cu - 45, cu + 45, cv - 80, cv + 80);
  exclude(1299, 1364, -546, -429);                  // City Hall
  exclude(1440, 1590, -800, -676);                  // Bonsecours Market
  const [au, av] = G(45.4799, -73.5777); exclude(au - 80, au + 80, av - 40, av + 40); // Atwater market
  const [fu, fv] = G(45.4950, -73.5560); exclude(fu - 30, fu + 30, fv - 30, fv + 30); // Five Roses
}

function heroTower(H) {
  const base = hmax(H.u, H.v, Math.max(H.w, H.d, 60) / 2);
  const y0 = hmin(H.u, H.v, Math.max(H.w, H.d, 60) / 2) - 3;
  const P = { style: H.style, seed: H.u * 0.13 + H.v * 0.07, floorH: H.style === STYLE.STONE ? 3.6 : 3.9, bayW: H.style === STYLE.GLASS || H.style === STYLE.COPPERGLASS ? 1.6 : 1.55, grp: 1, lit: 0.7, col: H.col, base, roofCol: [0.36, 0.58, 0.50] };
  const top = base + H.h;
  const box = (u0, u1, v0, v1, a, b, extra = {}) => addBox(Object.assign({}, P, { u0, u1, v0, v1, y0: a, y1: b, roof: 'flat' }, extra));
  if (H.cruciform) {
    const a = 17, L = 46, g = H.u, h = H.v;
    box(g - a, g + a, h - a, h + a, y0, top, { walls: [0, 0, 0, 0] });
    box(g + a, g + L, h - a, h + a, y0, top, { walls: [0, 1, 1, 1] });
    box(g - L, g - a, h - a, h + a, y0, top, { walls: [1, 0, 1, 1] });
    box(g - a, g + a, h + a, h + L, y0, top, { walls: [1, 1, 0, 1] });
    box(g - a, g + a, h - L, h - a, y0, top, { walls: [1, 1, 1, 0] });
    box(g - 9, g + 9, h - 9, h + 9, top, top + 6, { style: STYLE.CONCRETE, col: [0.5, 0.5, 0.5] });
    return { top: top + 6, base };
  }
  if (H.desj) {   // Complexe Desjardins: podium + four towers
    box(H.u - 46, H.u + 46, H.v - 50, H.v + 50, y0, base + 18, { style: STYLE.CONCRETE, shopH: 5 });
    const t = [[-24, -26, 152], [24, 26, 130], [24, -26, 118], [-24, 26, 100]];
    for (const [du, dv, hh] of t) box(H.u + du - 14, H.u + du + 14, H.v + dv - 14, H.v + dv + 14, base + 18, base + hh);
    return { top: base + 152, base };
  }
  const hu = H.w / 2, hd = H.d / 2;
  if (H.tiers) {
    box(H.u - hu, H.u + hu, H.v - hd, H.v + hd, y0, base + H.tiers[0], { shopH: 5 });
    box(H.u - hu + 10, H.u + hu - 10, H.v - hd + 9, H.v + hd - 9, base + H.tiers[0], base + H.tiers[1]);
    box(H.u - hu + 22, H.u + hu - 22, H.v - hd + 20, H.v + hd - 20, base + H.tiers[1], top);
    return { top, base };
  }
  if (H.bands) {
    let a = y0; const segs = [[0.27, 0.29], [0.53, 0.55], [0.79, 0.81]];
    for (const [s0, s1] of segs) {
      box(H.u - hu, H.u + hu, H.v - hd, H.v + hd, a, base + H.h * s0);
      box(H.u - hu + 1.2, H.u + hu - 1.2, H.v - hd + 1.2, H.v + hd - 1.2, base + H.h * s0, base + H.h * s1, { style: STYLE.CONCRETE, col: [0.2, 0.18, 0.16] });
      a = base + H.h * s1;
    }
    box(H.u - hu, H.u + hu, H.v - hd, H.v + hd, a, top);
    return { top, base };
  }
  if (H.pyramid) {
    box(H.u - hu, H.u + hu, H.v - hd, H.v + hd, y0, top, { roof: 'hip', roofH: H.pyramid, roofCol: [0.36, 0.60, 0.50] });
    return { top: top + H.pyramid, base };
  }
  if (H.crown) {
    box(H.u - hu, H.u + hu, H.v - hd, H.v + hd, y0, top);
    box(H.u - hu + 6, H.u + hu - 6, H.v - hd + 5, H.v + hd - 5, top, top + H.crown);
    return { top: top + H.crown, base };
  }
  box(H.u - hu, H.u + hu, H.v - hd, H.v + hd, y0, top, { shopH: H.h < 50 ? 0 : 5 });
  return { top, base };
}

// ---------------------------------------------------------------- facade textures
function gothicFacade() {
  return canvasTex(512, 512, (x, w, h) => {
    x.fillStyle = '#a8a196'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 2000; i++) { x.fillStyle = `rgba(0,0,0,${Math.random() * 0.06})`; x.fillRect(Math.random() * w, Math.random() * h, 3, 2); }
    x.strokeStyle = 'rgba(60,55,50,.35)'; x.lineWidth = 1;
    for (let y = 0; y < h; y += 14) { x.beginPath(); x.moveTo(0, y); x.lineTo(w, y); x.stroke(); }
    const arch = (cx, by, aw, ah, fill) => { x.fillStyle = fill; x.beginPath(); x.moveTo(cx - aw / 2, by); x.lineTo(cx - aw / 2, by - ah + aw * 0.55); x.quadraticCurveTo(cx - aw / 2, by - ah, cx, by - ah - aw * 0.25); x.quadraticCurveTo(cx + aw / 2, by - ah, cx + aw / 2, by - ah + aw * 0.55); x.lineTo(cx + aw / 2, by); x.fill(); };
    for (const cx of [150, 256, 362]) { arch(cx, 500, 70, 150, '#3a342e'); arch(cx, 500, 50, 130, '#1d1a17'); }
    for (const cx of [150, 256, 362]) { arch(cx, 300, 46, 80, '#5d564d'); x.fillStyle = '#d8d2c4'; x.fillRect(cx - 9, 240, 18, 50); x.beginPath(); x.arc(cx, 232, 9, 0, 7); x.fill(); }
    arch(256, 200, 120, 150, '#2b2a2c'); x.strokeStyle = '#8d867b'; x.lineWidth = 4; for (const dx of [-30, 0, 30]) { x.beginPath(); x.moveTo(256 + dx, 200); x.lineTo(256 + dx, 90); x.stroke(); }
    x.fillStyle = '#7a7368'; for (let i = 0; i < 9; i++) x.fillRect(40 + i * 54, 340, 26, 8);
  });
}
function towerFacade() {
  return canvasTex(256, 512, (x, w, h) => {
    x.fillStyle = '#a49d92'; x.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 12) { x.fillStyle = 'rgba(60,55,50,.25)'; x.fillRect(0, y, w, 1); }
    const arch = (cx, by, aw, ah) => { x.fillStyle = '#25221f'; x.beginPath(); x.moveTo(cx - aw / 2, by); x.lineTo(cx - aw / 2, by - ah + aw * 0.6); x.quadraticCurveTo(cx - aw / 2, by - ah, cx, by - ah - aw * 0.3); x.quadraticCurveTo(cx + aw / 2, by - ah, cx + aw / 2, by - ah + aw * 0.6); x.lineTo(cx + aw / 2, by); x.fill(); };
    arch(128, 170, 90, 120); arch(128, 340, 60, 100); arch(70, 470, 30, 60); arch(186, 470, 30, 60);
    x.strokeStyle = '#6f685e'; x.lineWidth = 3; for (let y = 70; y < 170; y += 14) { x.beginPath(); x.moveTo(86, y); x.lineTo(170, y); x.stroke(); }
  });
}
function clockFace() {
  return canvasTex(256, 256, (x, w, h) => {
    x.fillStyle = '#9b958b'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#efe9da'; x.beginPath(); x.arc(128, 128, 96, 0, 7); x.fill();
    x.strokeStyle = '#222'; x.lineWidth = 6; x.stroke();
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; x.beginPath(); x.moveTo(128 + Math.sin(a) * 78, 128 - Math.cos(a) * 78); x.lineTo(128 + Math.sin(a) * 90, 128 - Math.cos(a) * 90); x.stroke(); }
    x.lineWidth = 7; x.beginPath(); x.moveTo(128, 128); x.lineTo(128, 64); x.stroke(); x.lineWidth = 5; x.beginPath(); x.moveTo(128, 128); x.lineTo(176, 140); x.stroke();
  });
}
function signTex() {
  return canvasTex(2048, 256, (x, w, h) => {
    x.clearRect(0, 0, w, h);
    x.font = 'bold 200px Arial Black, Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillStyle = '#ff2a1c'; x.fillText('FARINE FIVE ROSES', w / 2, h / 2 + 8);
  });
}
function deckTex() {
  const t = canvasTex(256, 512, (x, w, h) => {
    x.fillStyle = '#2c2d2f'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 3000; i++) { x.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`; x.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    x.fillStyle = '#d9b43a'; x.fillRect(w / 2 - 5, 0, 3, h); x.fillRect(w / 2 + 2, 0, 3, h);
    x.fillStyle = '#e8e8e8'; for (const f of [0.2, 0.33, 0.67, 0.8]) for (let y = 0; y < h; y += 128) x.fillRect(w * f - 2, y, 4, 64);
    x.fillRect(6, 0, 4, h); x.fillRect(w - 10, 0, 4, h);
  }, { repeat: true });
  return t;
}

// ---------------------------------------------------------------- path helper for bridges / REM
function pathFrom(points) {   // points: [u, v, h]
  const curve = new THREE.CatmullRomCurve3(points.map(([u, v, h]) => new THREE.Vector3(u, h, -v)), false, 'centripetal');
  return curve;
}
function deckRibbon(kit, curve, width, thick, mat, sideMat, step = 6, uvLen = 40) {
  const L = curve.getLength(), n = Math.max(2, Math.ceil(L / step));
  const P = [], Nn = [], UV = [], I = [];
  const pts = curve.getSpacedPoints(n);
  const frames = [];
  for (let i = 0; i <= n; i++) {
    const p = pts[i], t = curve.getTangentAt(Math.min(1, i / n));
    const r = new THREE.Vector3(-t.z, 0, t.x).normalize();
    frames.push([p, r]);
  }
  // top surface
  for (let i = 0; i <= n; i++) {
    const [p, r] = frames[i];
    const a = p.clone().addScaledVector(r, -width / 2), b = p.clone().addScaledVector(r, width / 2);
    P.push(a.x, a.y, a.z, b.x, b.y, b.z); Nn.push(0, 1, 0, 0, 1, 0);
    const vv = (i / n) * L / uvLen; UV.push(0, vv, 1, vv);
    if (i < n) { const k = i * 2; I.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(Nn, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2)); g.setIndex(I);
  g.computeVertexNormals();
  kit.add(mat, g);
  // sides + bottom as a closed tube below the deck
  const S = [], SI = [];
  for (let i = 0; i <= n; i++) {
    const [p, r] = frames[i];
    const q = [p.clone().addScaledVector(r, -width / 2), p.clone().addScaledVector(r, width / 2), p.clone().addScaledVector(r, width / 2).add(new THREE.Vector3(0, -thick, 0)), p.clone().addScaledVector(r, -width / 2).add(new THREE.Vector3(0, -thick, 0))];
    for (const v of q) S.push(v.x, v.y - 0.001, v.z);
    if (i < n) { const k = i * 4; for (const [a, b] of [[1, 2], [2, 3], [3, 0]]) SI.push(k + a, k + b, k + 4 + a, k + b, k + 4 + b, k + 4 + a); }
  }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(S, 3)); sg.setIndex(SI); sg.computeVertexNormals();
  kit.add(sideMat, sg);
  return { frames, L, n };
}

// ---------------------------------------------------------------- build everything
export function buildLandmarks(scene) {
  const root = new THREE.Group(); root.name = 'landmarks';
  const glow = new GlowField(6000);
  const anim = [];
  const paths = {};   // traffic paths on bridges, REM
  const rnd = mulberry(375);

  // --- hero towers
  const tops = {};
  for (const H of HEROES) tops[H.id] = heroTower(H);
  const towerInfo = {
    pvm: ['Place Ville Marie', 'Place Ville Marie', 'Downtown', '1962', ['Cruciform tower by I. M. Pei & Associates (Henry N. Cobb).', 'Its rooftop beacon sweeps the sky over the city every night.', '47 storeys, 188 m.']],
    '1000': ['1000 de La Gauchetière', '1000 De La Gauchetière', 'Downtown', '1992', ['At 205 m, the tallest building in Montreal.', 'Capped by a copper pyramid and kept just below Mount Royal, as city rules require.', 'Has an indoor skating rink in its atrium.']],
    bourse: ['Tour de la Bourse', 'Tour de la Bourse', 'Downtown', '1964', ['Designed by Luigi Moretti and Pier Luigi Nervi.', 'Its dark bronze shaft is broken by recessed mechanical floors.', '190 m.']],
    sunlife: ['Sun Life Building', 'Édifice Sun Life', 'Downtown', '1913–1931', ['Once the largest building in the British Empire by floor area.', 'Its granite tiers face Dorchester Square.']],
    desjardins: ['Complexe Desjardins', 'Complexe Desjardins', 'Quartier des spectacles', '1976', ['Four towers over a busy indoor atrium.', 'Linked to the underground city (RÉSO).']],
  };
  for (const [id, info] of Object.entries(towerInfo)) {
    const H = HEROES.find((h) => h.id === id); if (!H) continue;
    reg(id, info[0], info[1], info[2], info[3], info[4], H.u, H.v, { h: tops[id].top - tops[id].base, dist: 420, yaw: 215, pitch: 14 });
  }
  // PVM beacon: four rotating beams
  {
    const H = HEROES.find((h) => h.id === 'pvm');
    const beamMat = new THREE.ShaderMaterial({
      uniforms: { uNight: U.uNight }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: 'varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform float uNight; varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ float edge = pow(abs(dot(normalize(vN), normalize(vV))), 2.5); float a = pow(1.0 - vUv.y, 2.5) * 0.05 * uNight * edge * smoothstep(0.0, 0.02, vUv.y); gl_FragColor = vec4(vec3(0.85, 0.9, 1.0) * a, 1.0); }',
    });
    const beams = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const g = new THREE.CylinderGeometry(22, 0.6, 1600, 12, 1, true); g.translate(0, 800, 0);
      const m = new THREE.Mesh(g, beamMat); m.rotation.z = -Math.PI / 2 + 0.06; m.rotation.y = i * Math.PI / 2; m.frustumCulled = false; m.renderOrder = 15;
      const holder = new THREE.Group(); holder.rotation.y = i * Math.PI / 2; holder.add(m); m.rotation.y = 0; beams.add(holder);
    }
    beams.position.set(H.u, tops.pvm.top + 2, -H.v);
    root.add(beams);
    anim.push((t) => { beams.rotation.y = t * 0.35; beams.visible = U.uNight.value > 0.05; });
  }
  // aircraft warning lights on the tall towers (slow pulse, never strobing)
  for (const H of HEROES) {
    const T = tops[H.id]; if (!T || T.top - T.base < 120) continue;
    const r = Math.max(H.w || 40, H.d || 40) / 2 - 2;
    for (const [a, b] of [[-1, -1], [1, 1], [1, -1], [-1, 1]]) glow.add(H.u + a * r * 0.7, T.top + 1, -(H.v + b * r * 0.7), 1, 0.12, 0.06, 1.2, 2.2, 3);
  }

  // --- Mary Queen of the World Cathedral (faces René-Lévesque, to the grid north)
  {
    const [u, v] = blockCenter(-2, 0);
    const k = new Kit(), y = hmax(u, v, 40);
    k.box(MAT.stoneL, 32, 24, 84, 0, -4, 6);
    k.add(MAT.copper, new THREE.CylinderGeometry(0.01, 17.5, 9, 4, 1), 0, 24.5, 6, Math.PI / 4, 0, 0, 1, 1, 2.6);
    k.box(MAT.stoneL, 46, 28, 9, 0, -4, -38);
    for (let i = -4; i <= 4; i++) k.cyl(MAT.white, 1.1, 1.1, 18, i * 4.6, 0, -43.5, 10);
    k.box(MAT.stoneL, 46, 3, 3, 0, 18, -43.5);
    for (let i = -6; i <= 6; i++) { k.cyl(MAT.stoneL, 0.7, 0.7, 1.4, i * 3.6, 24, -38); k.add(MAT.stoneL, new THREE.SphereGeometry(0.75, 8, 6), i * 3.6, 26.2, -38); }
    k.cyl(MAT.stoneL, 11, 11, 14, 0, 20, 14, 28);
    k.add(MAT.copper, new THREE.SphereGeometry(12, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), 0, 34, 14, 0, 0, 0, 1, 1.35, 1);
    k.cyl(MAT.stoneL, 2.2, 2.6, 6, 0, 50, 14, 12); k.add(MAT.copper, new THREE.ConeGeometry(2.6, 5, 12), 0, 58.5, 14); k.box(MAT.gold, 0.4, 3, 0.4, 0, 61, 14);
    for (const s of [-1, 1]) { k.cyl(MAT.stoneL, 4, 4, 5, s * 18, 20, -30, 16); k.add(MAT.copper, new THREE.SphereGeometry(4.4, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), s * 18, 25, -30, 0, 0, 0, 1, 1.3, 1); }
    root.add(place(k.build('cathedral'), u, v, y - 4 + 4, 0));
    BOXES.add({ x0: u - 23, x1: u + 23, z0: -v - 44, z1: -v + 48, y0: y - 4, y1: y + 20 });
    reg('cathedral', 'Mary Queen of the World', 'Cathédrale Marie-Reine-du-Monde', 'Downtown', '1894', ['A quarter-scale model of St. Peter\'s Basilica in Rome.', 'Its copper dome sits among the downtown towers on René-Lévesque.'], u, v, { h: 60, dist: 200, yaw: 160 });
  }

  // --- Notre-Dame Basilica (facade to the grid north, onto Place d'Armes)
  {
    const u = (lineU(7, true) + lineU(8, true)) / 2, v = (lineV(-3, true) + lineV(-2, true)) / 2 + 4;
    const y = hmax(u, v, 40);
    const k = new Kit();
    const fac = gothicFacade(), twr = towerFacade();
    const facMat = new THREE.MeshStandardMaterial({ map: fac, roughness: 0.85, emissive: 0xffd9a8, emissiveMap: fac, emissiveIntensity: 0 });
    const twrMat = new THREE.MeshStandardMaterial({ map: twr, roughness: 0.85, emissive: 0xffd9a8, emissiveMap: twr, emissiveIntensity: 0 });
    NIGHT.push([facMat, 0.32], [twrMat, 0.32]);
    k.box(MAT.stone, 33, 27, 70, 0, -4, 6);
    // pitched roof (prism) along the nave
    k.add(MAT.copper, prismGeo(35, 11, 70), 0, 23, 6);
    // facade block and twin towers with textured fronts
    const facG = new THREE.BoxGeometry(34, 34, 8);
    const facMesh = new THREE.Mesh(facG, [MAT.stone, MAT.stone, MAT.stone, MAT.stone, MAT.stone, facMat]);
    facMesh.position.set(0, 13, -33); k.solo.push(facMesh);
    for (const s of [-1, 1]) {
      const tg = new THREE.BoxGeometry(12, 58, 12);
      const tm = new THREE.Mesh(tg, [twrMat, twrMat, MAT.stone, MAT.stone, MAT.stone, twrMat]);
      tm.position.set(s * 17.5, 25, -33); k.solo.push(tm);
      for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.add(MAT.stone, new THREE.ConeGeometry(1.1, 7, 6), s * 17.5 + a * 5.2, 57.5, -33 + b * 5.2);
      k.add(MAT.stoneD, new THREE.ConeGeometry(4.5, 5, 4), s * 17.5, 56.5, -33, Math.PI / 4);
    }
    for (const m of k.solo) { m.castShadow = true; m.receiveShadow = true; }
    root.add(place(k.build('basilica'), u, v, y, 0));
    BOXES.add({ x0: u - 23.5, x1: u + 23.5, z0: -v - 40, z1: -v + 42, y0: y - 4, y1: y + 23 });
    glow.add(u, y + 2, -(v + 47), 1, 0.85, 0.6, 0.6, 9, 0);
    reg('basilica', 'Notre-Dame Basilica', 'Basilique Notre-Dame', 'Old Montreal', '1829', ['Gothic Revival masterpiece by architect James O\'Donnell.', 'Twin towers rise 69 m over Place d\'Armes.', 'Its deep-blue, gold-starred interior is world famous.'], u, v, { h: 60, dist: 180, yaw: 200, pitch: 12, stand: [u, v + 95, 180] });
  }

  // --- City Hall (Second Empire, copper mansard, faces Notre-Dame St to the south)
  {
    const u = 1331, v = -528, base = hmax(u, v, 30), y0 = hmin(u, v, 30) - 3;
    const P = { style: STYLE.STONE, seed: 7, floorH: 4.6, bayW: 3.6, grp: 1, lit: 0.7, col: [0.70, 0.67, 0.60], base, roofCol: [0.36, 0.60, 0.50] };
    addBox(Object.assign({}, P, { u0: u - 31, u1: u + 31, v0: v - 16, v1: v + 16, y0, y1: base + 19, roof: 'mansard', roofH: 6 }));
    addBox(Object.assign({}, P, { u0: u - 8, u1: u + 8, v0: v - 19, v1: v - 16, y0, y1: base + 23, roof: 'flat', walls: [1, 1, 1, 0] }));
    const k = new Kit();
    k.box(MAT.stone, 12, 10, 12, 0, 25 + 0, -2);
    k.add(MAT.copper, new THREE.ConeGeometry(9, 9, 4), 0, 39.5, -2, Math.PI / 4);
    k.box(MAT.copper, 2, 4, 2, 0, 44, -2);
    root.add(place(k.build('cityhall'), u, v, base, 0));
    reg('cityhall', 'Montreal City Hall', 'Hôtel de ville de Montréal', 'Old Montreal', '1878', ['Second Empire style; rebuilt inside its walls after a 1922 fire.', 'Charles de Gaulle gave his "Vive le Québec libre" speech from its balcony in 1967.'], u, v, { h: 45, dist: 170, yaw: 160 });
  }

  // --- Bonsecours Market (silver dome)
  {
    const u = 1515, v = -742, base = hmax(u, v, 60), y0 = hmin(u, v, 70) - 3;
    const P = { style: STYLE.STONE, seed: 11, floorH: 4.4, bayW: 3.4, grp: 1, lit: 0.65, col: [0.66, 0.64, 0.60], base, roofCol: [0.55, 0.57, 0.6] };
    addBox(Object.assign({}, P, { u0: u - 66, u1: u + 66, v0: v - 13, v1: v + 13, y0, y1: base + 14, roof: 'hip', roofH: 5 }));
    const k = new Kit();
    k.cyl(MAT.stone, 8.5, 8.5, 7, 0, 18, 0, 28);
    k.add(MAT.silver, new THREE.SphereGeometry(9.5, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), 0, 25, 0, 0, 0, 0, 1, 1.15, 1);
    k.cyl(MAT.stone, 1.6, 1.8, 3, 0, 35.6, 0, 10); k.add(MAT.silver, new THREE.ConeGeometry(2, 3, 10), 0, 40, 0);
    for (let i = -3; i <= 3; i++) k.cyl(MAT.white, 0.85, 0.95, 11, i * 3.4, 0, -16, 10);
    k.add(MAT.stone, new THREE.CylinderGeometry(0.01, 13, 4, 3), 0, 13, -16, 0, Math.PI / 2, 0, 1, 1, 0.35);
    k.box(MAT.stone, 25, 2, 4, 0, 10.8, -15.8);
    root.add(place(k.build('bonsecours'), u, v, base, 0));
    glow.add(u, base + 26, -v, 0.8, 0.85, 1, 0.5, 14, 0);
    reg('bonsecours', 'Bonsecours Market', 'Marché Bonsecours', 'Old Montreal', '1847', ['Its silver dome is a waterfront landmark.', 'Served as Montreal\'s city hall and briefly housed the Parliament of the Province of Canada (1849).'], u, v, { h: 40, dist: 200, yaw: 200 });
  }

  // --- Place Jacques-Cartier: Nelson's Column
  {
    const u = 1258, v = -600, y = terrainH(u, v);
    const k = new Kit(); k.box(MAT.stone, 5, 4, 5, 0, -1, 0); k.cyl(MAT.stone, 1.1, 1.3, 17, 0, 3, 0, 14); k.add(MAT.stoneD, new THREE.SphereGeometry(1.3, 10, 8), 0, 21, 0);
    root.add(place(k.build('nelson'), u, v, y, 0));
  }

  // --- Old Port: Clock Tower (end of its quay) and La Grande Roue
  {
    const [pu, pv] = G(45.5118, -73.5452);
    let u = pu, v = pv - 270; [u, v] = nearestLand(u, v, 6);
    const y = terrainH(u, v);
    const k = new Kit();
    k.box(MAT.stone, 9, 30, 9, 0, -3, 0); k.box(MAT.stone, 7.5, 9, 7.5, 0, 27, 0);
    const cf = clockFace(); const cm = new THREE.MeshStandardMaterial({ map: cf, roughness: 0.8, emissive: 0xfff3d0, emissiveMap: cf, emissiveIntensity: 0 }); NIGHT.push([cm, 0.6]);
    const cg = new THREE.BoxGeometry(7.6, 7.6, 7.6); const cmesh = new THREE.Mesh(cg, [cm, cm, MAT.stone, MAT.stone, cm, cm]); cmesh.position.set(0, 31.8, 0); cmesh.castShadow = true; k.solo.push(cmesh);
    k.add(MAT.copper, new THREE.ConeGeometry(5.6, 8, 4), 0, 40, 0, Math.PI / 4); k.box(MAT.stone, 1, 3, 1, 0, 44, 0);
    root.add(place(k.build('clocktower'), u, v, y, 0));
    BOXES.add({ x0: u - 4.5, x1: u + 4.5, z0: -v - 4.5, z1: -v + 4.5, y0: y - 3, y1: y + 36 });
    reg('clocktower', 'Clock Tower', "Tour de l'Horloge", 'Old Port', '1922', ['Memorial to the sailors of the merchant marine, at the end of the Clock Tower Quay.', 'Climb its 192 steps for a view of the Jacques Cartier Bridge.'], u, v, { h: 45, dist: 160, yaw: 230 });
  }
  {
    const [pu, pv] = G(45.5078, -73.5488);
    let [u, v] = nearestLand(pu, pv - 120, 12);
    const y = terrainH(u, v), R = 27, cy = 33;
    const legs = new Kit();
    for (const s of [-1, 1]) { legs.beam(MAT.white, new THREE.Vector3(-14, 0, s * 4), new THREE.Vector3(0, cy, s * 2.5), 1.2); legs.beam(MAT.white, new THREE.Vector3(14, 0, s * 4), new THREE.Vector3(0, cy, s * 2.5), 1.2); }
    legs.box(MAT.dark, 30, 3, 12, 0, 0, 0);
    root.add(place(legs.build('roue-legs'), u, v, y, 0));
    const wk = new Kit();
    const rim = new THREE.TorusGeometry(R, 0.5, 6, 96);
    wk.add(MAT.ledRim, rim, 0, 0, 2.2); wk.add(MAT.ledRim, rim, 0, 0, -2.2);
    for (let i = 0; i < 21; i++) { const a = i / 21 * Math.PI * 2; for (const z of [-2.2, 2.2]) wk.beam(MAT.white, new THREE.Vector3(0, 0, z * 0.4), new THREE.Vector3(Math.cos(a) * R, Math.sin(a) * R, z), 0.25); }
    wk.cyl(MAT.white, 1.6, 1.6, 6, 0, -3, 0, 16);
    const wheel = wk.build('roue', true);
    const gond = new THREE.InstancedMesh(new THREE.BoxGeometry(2.6, 2.4, 2.4), MAT.winWarm, 42);
    wheel.add(gond); wheel.position.set(u, y + cy, -v); wheel.matrixAutoUpdate = true;
    root.add(wheel);
    const tmpM = new THREE.Matrix4();
    anim.push((t) => {
      const a0 = t * 0.025;
      wheel.rotation.z = a0;
      for (let i = 0; i < 42; i++) { const a = i / 42 * Math.PI * 2; tmpM.makeRotationZ(-a0).setPosition(Math.cos(a) * (R + 1.6), Math.sin(a) * (R + 1.6) - 1.6, 0); gond.setMatrixAt(i, tmpM); }
      gond.instanceMatrix.needsUpdate = true;
    });
    reg('roue', 'La Grande Roue de Montréal', 'La Grande Roue de Montréal', 'Old Port', '2017', ['At 60 m, the tallest Ferris wheel in Canada.', '42 heated and air-conditioned gondolas.'], u, v, { h: 60, dist: 170, yaw: 210 });
  }

  // --- Silo No. 5 and the Farine Five Roses sign
  {
    const [su, sv] = G(45.4975, -73.5525);
    let [u, v] = nearestLand(su, sv, 20);
    const y = hmin(u, v, 60) - 2, base = hmax(u, v, 40);
    const k = new Kit();
    k.box(MAT.concD, 36, base - y + 58, 22, -70, 0, 0);
    for (let row = 0; row < 3; row++) for (let i = 0; i < 12; i++) k.cyl(MAT.concD, 4.6, 4.6, base - y + 34, -46 + i * 9.4, 0, -9.4 + row * 9.4, 16);
    k.box(MAT.concD, 120, 4, 6, 10, base - y + 34, 0);
    k.beam(MAT.rust, new THREE.Vector3(-52, base - y + 50, 0), new THREE.Vector3(70, base - y + 18, 30), 3, 3);
    root.add(place(k.build('silo5'), u, v, y, 18));
    exclude(u - 95, u + 95, v - 40, v + 40);
    reg('silo5', 'Silo No. 5', 'Silo no 5', 'Old Port', '1903–1958', ['A colossal grain elevator at Pointe-du-Moulin, closed in 1994.', 'An icon of Montreal\'s industrial port.'], u, v, { h: 60, dist: 300, yaw: 160 });
    // Five Roses
    const [fu0, fv0] = G(45.4950, -73.5560);
    const [fu, fv] = nearestLand(fu0, fv0, 15);
    const fy = hmin(fu, fv, 20) - 2, fb = hmax(fu, fv, 15);
    const f = new Kit();
    f.box(MAT.concD, 22, fb - fy + 40, 18, 0, 0, 0);
    for (let i = -6; i <= 6; i++) { f.beam(MAT.steel, new THREE.Vector3(i * 6, fb - fy + 40, 0), new THREE.Vector3(i * 6, fb - fy + 54, 0), 0.4); }
    f.beam(MAT.steel, new THREE.Vector3(-37, fb - fy + 47, 0), new THREE.Vector3(37, fb - fy + 47, 0), 0.4);
    const st = signTex(); st.generateMipmaps = true;
    const sm = new THREE.MeshStandardMaterial({ map: st, alphaTest: 0.5, alphaToCoverage: true, transparent: false, emissive: 0xff2a1c, emissiveMap: st, emissiveIntensity: 0, roughness: 0.6, side: THREE.FrontSide });
    NIGHT.push([sm, 2.2]);
    for (const s of [-1, 1]) { const pm = new THREE.Mesh(new THREE.PlaneGeometry(74, 9.2), sm); pm.position.set(0, fb - fy + 47.5, s * 0.6); if (s < 0) pm.rotation.y = Math.PI; f.solo.push(pm); }
    root.add(place(f.build('fiveroses'), fu, fv, fy, 35));
    BOXES.add({ x0: fu - 11, x1: fu + 11, z0: -fv - 11, z1: -fv + 11, y0: fy, y1: fb + 40 });
    reg('fiveroses', 'Farine Five Roses sign', 'Enseigne Farine Five Roses', 'Old Port', '1948', ['Giant red letters on top of the old flour mill by the Lachine Canal.', 'Lit every night; a beloved piece of the skyline.'], fu, fv, { h: 55, dist: 230, yaw: 150 });
  }

  // --- Habitat 67 (stacked modules, each a real box with windows)
  {
    const [hu1, hv1] = G(45.4997, -73.5435);
    const [hu0, hv0] = nearLandStrip(hu1, hv1);
    const rr = mulberry(67);
    const C = 5.7, H = 3.6, occ = new Set();
    const key = (i, j, l) => i + ',' + j + ',' + l;
    const placed = [];
    const landC = (i, j) => waterSDF(hu0 + (i + 0.5) * C, hv0 + (j + 0.5) * C) > 7;
    // three "hills" of modules, each a stepped ziggurat that leans as it rises
    for (const [ci, cj] of [[-14, 0], [0, 1], [13, -1]]) {
      for (let l = 0; l < 12; l++) {
        const rad = 7.5 - l * 0.55, rj = 3.2 - l * 0.22;
        for (let t = 0; t < 140; t++) {
          const i = ci + Math.round((rr() * 2 - 1) * rad + l * 0.45), j = cj + Math.round((rr() * 2 - 1) * rj);
          const along = rr() < 0.55;
          const cells = along ? [[i, j], [i + 1, j]] : [[i, j], [i, j + 1]];
          if (cells.some(([a, b]) => occ.has(key(a, b, l)) || !landC(a, b))) continue;
          if (l > 0 && !cells.some(([a, b]) => occ.has(key(a, b, l - 1)))) continue;
          if (l > 0 && rr() < 0.25) continue;
          for (const [a, b] of cells) occ.add(key(a, b, l));
          placed.push([cells, l]);
        }
      }
    }
    const yb = hmax(hu0, hv0, 80);
    let n = 0;
    for (const [cells, l] of placed) {
      // axis-aligned in a local grid that is itself axis-aligned (keeps every module a clean box)
      const is = cells.map((c) => c[0]), js = cells.map((c) => c[1]);
      const u0 = hu0 + Math.min(...is) * C, u1 = hu0 + (Math.max(...is) + 1) * C, v0 = hv0 + Math.min(...js) * C, v1 = hv0 + (Math.max(...js) + 1) * C;
      if (waterSDF((u0 + u1) / 2, (v0 + v1) / 2) < 4) continue;
      addBox({ u0, u1, v0, v1, y0: l === 0 ? yb - 3 : yb + l * H, y1: yb + (l + 1) * H, base: yb + l * H, style: STYLE.CONCRETE, seed: n++, floorH: H, bayW: 2.8, grp: 1, lit: 0.7, col: [0.80, 0.77, 0.70], roof: 'flat' });
    }
    reg('habitat67', 'Habitat 67', 'Habitat 67', 'Cité du Havre', '1967', ['Moshe Safdie\'s housing experiment for Expo 67.', '354 prefabricated concrete modules stacked into a hillside of homes.'], hu0, hv0, { h: 40, dist: 220, yaw: 330, pitch: 16 });
  }

  // --- Biosphere (geodesic frame, Buckminster Fuller)
  {
    const [bu, bv] = G(45.5141, -73.5313);
    const y = terrainH(bu, bv), R = 38;
    const ico = new THREE.IcosahedronGeometry(R, 4);
    const p = ico.attributes.position; const edges = new Map();
    const vk = (i) => `${p.getX(i).toFixed(2)},${p.getY(i).toFixed(2)},${p.getZ(i).toFixed(2)}`;
    for (let i = 0; i < p.count; i += 3) for (const [a, b] of [[i, i + 1], [i + 1, i + 2], [i + 2, i]]) {
      const ka = vk(a), kb = vk(b), k2 = ka < kb ? ka + '|' + kb : kb + '|' + ka;
      if (!edges.has(k2)) edges.set(k2, [new THREE.Vector3(p.getX(a), p.getY(a), p.getZ(a)), new THREE.Vector3(p.getX(b), p.getY(b), p.getZ(b))]);
    }
    const list = [...edges.values()].filter(([a, b]) => a.y > -R * 0.5 && b.y > -R * 0.5);
    const im = new THREE.InstancedMesh(new THREE.BoxGeometry(0.35, 1, 0.35), MAT.blueLit, list.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
    list.forEach(([a, b], i) => { const d = b.clone().sub(a); const L = d.length(); q.setFromUnitVectors(up, d.normalize()); m4.compose(a.clone().add(b).multiplyScalar(0.5), q, new THREE.Vector3(1, L, 1)); im.setMatrixAt(i, m4); });
    im.castShadow = true; im.position.set(bu, y + R * 0.5, -bv); im.updateMatrix(); im.matrixAutoUpdate = false; im.computeBoundingSphere();
    root.add(im);
    const k = new Kit(); k.cyl(MAT.conc, R * 0.87, R * 0.9, 2, 0, -1, 0, 48); root.add(place(k.build('bio-base'), bu, bv, y, 0));
    reg('biosphere', 'Biosphere', 'Biosphère', 'Parc Jean-Drapeau', '1967', ['Buckminster Fuller\'s geodesic dome, the United States pavilion at Expo 67.', '76 m across; its acrylic skin burned away in 1976, leaving the steel lattice.'], bu, bv, { h: 62, dist: 200, yaw: 250 });
  }

  // --- Casino de Montréal (former French pavilion) and the Quebec pavilion cube
  {
    const [cu, cv] = G(45.5056, -73.5262);
    const y = hmax(cu, cv, 40);
    const k = new Kit();
    for (let t = 0; t < 4; t++) { const s = 52 - t * 7; k.box(t % 2 ? MAT.goldLit : MAT.white, s, 6.5, s * 0.8, 0, -3 + t * 7, 0); }
    for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2; k.beam(MAT.white, new THREE.Vector3(Math.cos(a) * 30, -3, Math.sin(a) * 24), new THREE.Vector3(Math.cos(a) * 22, 28, Math.sin(a) * 18), 0.8, 1.6); }
    k.box(MAT.goldLit, 30, 30, 30, 62, -2, 10);
    root.add(place(k.build('casino'), cu, cv, y, 10));
    BOXES.add({ x0: cu - 30, x1: cu + 30, z0: -cv - 25, z1: -cv + 25, y0: y - 3, y1: y + 25 });
    reg('casino', 'Casino de Montréal', 'Casino de Montréal', 'Parc Jean-Drapeau', '1967 / 1993', ['Housed in the former French pavilion of Expo 67, with the Quebec pavilion beside it.', 'Glows gold over Île Notre-Dame at night.'], cu, cv, { h: 30, dist: 200, yaw: 300 });
  }

  // --- La Ronde (rides at the tip of Île Sainte-Hélène)
  {
    const [lu, lv] = G(45.5222, -73.5338);
    const [u, v] = nearestLand(lu, lv, 25);
    const y = terrainH(u, v);
    const k = new Kit();
    k.add(MAT.ledRim, new THREE.TorusGeometry(18, 0.4, 6, 64), 0, 21, 0);
    for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; k.beam(MAT.white, new THREE.Vector3(0, 21, 0), new THREE.Vector3(Math.cos(a) * 18, 21 + Math.sin(a) * 18, 0), 0.3); }
    k.beam(MAT.white, new THREE.Vector3(-9, 0, 0), new THREE.Vector3(0, 21, 0), 0.8); k.beam(MAT.white, new THREE.Vector3(9, 0, 0), new THREE.Vector3(0, 21, 0), 0.8);
    k.cyl(MAT.red, 1.4, 1.8, 62, 40, 0, 10, 12); k.cyl(MAT.yellow, 3, 3, 3, 40, 50, 10, 12);
    const track = new THREE.CatmullRomCurve3([[-60, 2, -30], [-20, 30, -45], [20, 8, -40], [55, 24, -20], [60, 6, 20], [10, 18, 35], [-40, 4, 30], [-70, 14, 0]].map((a) => new THREE.Vector3(...a)), true);
    k.add(MAT.wood, new THREE.TubeGeometry(track, 200, 0.9, 5, true));
    for (let i = 0; i < 60; i++) { const p = track.getPointAt(i / 60); k.beam(MAT.wood, new THREE.Vector3(p.x, -2, p.z), p, 0.5); }
    root.add(place(k.build('laronde'), u, v, y, 30));
    reg('laronde', 'La Ronde', 'La Ronde', 'Parc Jean-Drapeau', '1967', ['Amusement park built for Expo 67 on Île Sainte-Hélène.', 'Home of Le Monstre, a towering wooden roller coaster.'], u, v, { h: 50, dist: 230, yaw: 200 });
  }

  // --- Olympic Stadium, the inclined Montreal Tower and the Biodome
  {
    const [ou, ov] = G(45.5580, -73.5519);
    const y = hmin(ou, ov, 140);
    const k = new Kit(), A = 140, B = 112, N = 34;
    for (let i = 0; i < N; i++) {
      const a = i / N * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.quadraticCurveTo(10, 30, 2, 52); sh.lineTo(-6, 54); sh.quadraticCurveTo(-4, 26, -14, 0); sh.lineTo(0, 0);
      const g = new THREE.ExtrudeGeometry(sh, { depth: 3.2, bevelEnabled: false, curveSegments: 6 }); g.translate(0, 0, -1.6);
      k.add(MAT.conc, g, ca * A, -2, -sa * B, a + Math.PI, 0, 0);
    }
    k.add(MAT.concD, new THREE.CylinderGeometry(1, 1.12, 26, 64, 1, true), 0, 11, 0, 0, 0, 0, A * 0.92, 1, B * 0.92);
    const roof = new THREE.SphereGeometry(1, 64, 16, 0, Math.PI * 2, 0, 0.55);
    k.add(MAT.white, roof, 0, -7, 0, 0, 0, 0, A * 1.26, 72, B * 1.26);
    // the 45-degree tower rising from the north end and leaning over the roof
    const tb = new THREE.Vector3(-A - 10, 0, 0), dir = new THREE.Vector3(Math.cos(Math.PI / 4), Math.sin(Math.PI / 4), 0);
    const tl = 225;
    for (let i = 0; i < 12; i++) {
      const s0 = i / 12, s1 = (i + 1) / 12, w0 = 30 - 18 * s0, w1 = 30 - 18 * s1;
      const p0 = tb.clone().addScaledVector(dir, tl * s0), p1 = tb.clone().addScaledVector(dir, tl * s1);
      k.beam(MAT.conc, p0, p1, (w0 + w1) / 2, (w0 + w1) / 2 * 0.8);
    }
    const top = tb.clone().addScaledVector(dir, tl);
    k.beam(MAT.glass, top.clone().addScaledVector(dir, -14), top, 16, 18);
    for (let i = 0; i < 6; i++) k.beam(MAT.cable, top.clone().addScaledVector(dir, -40 - i * 6).add(new THREE.Vector3(0, 0, (i - 2.5) * 3)), new THREE.Vector3(-A * 0.4 + i * 12, 70, (i - 2.5) * 16), 0.3);
    root.add(place(k.build('olympic'), ou, ov, y, 0));
    const tw = top.clone(); const wpos = new THREE.Vector3(tw.x + ou, tw.y + y, tw.z - ov);
    glow.add(wpos.x, wpos.y + 6, wpos.z, 1, 0.15, 0.1, 1.2, 4, 3);
    for (let i = 1; i < 12; i++) { const p = tb.clone().addScaledVector(dir, tl * i / 12); glow.add(p.x + ou, p.y + y + 2, p.z - ov + 13, 1, 0.9, 0.75, 0.7, 2.5, 0); }
    BOXES.add({ x0: ou - A, x1: ou + A, z0: -ov - B, z1: -ov + B, y0: y - 2, y1: y + 58 });
    // Biodome: low ribbed dome west of the stadium
    const bk = new Kit();
    bk.add(MAT.silver, new THREE.SphereGeometry(1, 48, 10, 0, Math.PI * 2, 0, Math.PI / 2), 0, -2, 0, 0, 0, 0, 82, 26, 62);
    for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; bk.beam(MAT.conc, new THREE.Vector3(Math.cos(a) * 84, -2, Math.sin(a) * 64), new THREE.Vector3(0, 25, 0), 1.2); }
    root.add(place(bk.build('biodome'), ou - 255, ov + 40, hmin(ou - 255, ov + 40, 80), 0));
    reg('olympic', 'Olympic Stadium', 'Stade olympique', 'Hochelaga-Maisonneuve', '1976', ['Built for the 1976 Summer Olympics, designed by Roger Taillibert.', 'Its 165 m Montreal Tower is the tallest inclined tower in the world (45°).', 'A funicular climbs the tower to an observatory.'], ou, ov, { h: 170, dist: 520, yaw: 210, pitch: 16 });
  }

  // --- Mount Royal: the Cross, the Chalet and the Kondiaronk Belvedere
  {
    const [cu, cv] = G(45.5085, -73.5875);
    const y = hmin(cu, cv, 6);
    const k = new Kit();
    k.box(MAT.lampCross, 2.4, 33, 2.4, 0, -1.5, 0); k.box(MAT.lampCross, 11.2, 2.4, 2.4, 0, 21.5, 0);
    k.box(MAT.concD, 6, 3, 6, 0, -2, 0);
    root.add(place(k.build('cross'), cu, cv, y, 20));
    for (let i = 0; i < 16; i++) glow.add(cu, y + 1 + i * 1.95, -cv, 1, 1, 1, 1.0, 3.2, 0);
    for (let i = -3; i <= 3; i++) if (i) { const a = 20 * Math.PI / 180; glow.add(cu + Math.cos(a) * i * 1.6, y + 22.7, -cv - Math.sin(a) * i * 1.6, 1, 1, 1, 1.0, 3.2, 0); }
    reg('cross', 'Mount Royal Cross', 'Croix du mont Royal', 'Mount Royal', '1924', ['31 m illuminated cross on the summit, 233 m above sea level.', 'Commemorates the cross Paul de Chomedey de Maisonneuve placed here in 1643.'], cu, cv, { h: 30, dist: 160, yaw: 160, pitch: 14 });

    const [bu, bv] = G(45.5037, -73.5868);
    const top = hmax(bu, bv, 46) + 0.4, bot = hmin(bu, bv, 46) - 6;
    const b = new Kit();
    const plaza = new THREE.CylinderGeometry(44, 44, top - bot, 48, 1, false, -Math.PI * 0.5, Math.PI);
    b.add(MAT.stoneL, plaza, 0, (top + bot) / 2, 0);
    const bal = new THREE.CylinderGeometry(44, 44, 1.1, 64, 1, true, -Math.PI * 0.5, Math.PI);
    b.add(MAT.stone, bal, 0, top + 0.55, 0);
    const ch = new Kit();
    root.add(place(b.build('belvedere'), bu, bv, 0, 0));
    const cy = hmax(bu, bv + 34, 20);
    const P = { style: STYLE.GREYSTONE, seed: 3, floorH: 6, bayW: 4.4, grp: 1, lit: 0.8, col: [0.72, 0.69, 0.62], base: cy, roofCol: [0.36, 0.30, 0.26] };
    addBox(Object.assign({}, P, { u0: bu - 32, u1: bu + 32, v0: bv + 22, v1: bv + 44, y0: hmin(bu, bv + 34, 30) - 3, y1: cy + 12, roof: 'hip', roofH: 7 }));
    BOXES.add({ x0: bu - 44, x1: bu + 44, z0: -bv - 0.1, z1: -bv + 44, y0: bot, y1: top });
    reg('belvedere', 'Kondiaronk Belvedere', 'Belvédère Kondiaronk', 'Mount Royal', '1932', ['The classic lookout over downtown from the Mount Royal Chalet.', 'Named for the Wendat chief who negotiated the Great Peace of Montreal in 1701.'], bu, bv, { h: 10, dist: 260, yaw: 20, pitch: 22, stand: [bu, bv - 30, 180] });
  }

  // --- Saint Joseph's Oratory
  {
    const [ou, ov] = G(45.4924, -73.6177);
    const base = hmax(ou, ov, 50), bot = hmin(ou, ov, 70) - 4;
    const yaw = 150;
    const k = new Kit();
    k.box(MAT.stoneL, 46, base - bot + 34, 92, 0, bot - base, 8);
    k.add(MAT.copper, new THREE.CylinderGeometry(0.01, 27, 10, 4, 1), 0, 39, 8, Math.PI / 4, 0, 0, 1, 1, 2.3);
    for (let i = -4; i <= 4; i++) k.cyl(MAT.white, 1.4, 1.5, 20, i * 4.8, 4, -40, 12);
    k.box(MAT.stoneL, 46, 6, 6, 0, 24, -40);
    k.cyl(MAT.stoneL, 21, 21, 20, 0, 34, 14, 40);
    k.add(MAT.copper, new THREE.SphereGeometry(23, 40, 18, 0, Math.PI * 2, 0, Math.PI / 2), 0, 54, 14, 0, 0, 0, 1, 1.45, 1);
    k.cyl(MAT.stoneL, 3.6, 4, 8, 0, 86, 14, 14); k.add(MAT.copper, new THREE.ConeGeometry(4.2, 6, 14), 0, 97, 14); k.box(MAT.gold, 0.6, 5, 0.6, 0, 100, 14); k.box(MAT.gold, 3, 0.6, 0.6, 0, 103, 14);
    for (let s = 0; s < 5; s++) k.box(MAT.stone, 70 - s * 8, base - bot + 1 - s * 1.2 - (s ? 0 : 0), 14, 0, bot - base, -52 - s * 14);
    root.add(place(k.build('oratory'), ou, ov, base, yaw));
    reg('oratory', "Saint Joseph's Oratory", 'Oratoire Saint-Joseph du Mont-Royal', 'Côte-des-Neiges', '1924–1967', ['Canada\'s largest church, on the north-west slope of Mount Royal.', 'Its copper dome is among the largest in the world.', 'Founded by Saint Brother André.'], ou, ov, { h: 100, dist: 330, yaw: 150, pitch: 12 });
  }

  // --- Université de Montréal, Roger-Gaudry pavilion and its tower
  {
    const [uu, uv] = G(45.5040, -73.6150);
    const base = hmax(uu, uv, 60), y0 = hmin(uu, uv, 120) - 4;
    const P = { style: STYLE.GREYSTONE, seed: 21, floorH: 4, bayW: 3.2, grp: 1, lit: 0.6, col: [0.82, 0.72, 0.52], base, roofCol: [0.3, 0.3, 0.3] };
    addBox(Object.assign({}, P, { u0: uu - 120, u1: uu + 120, v0: uv - 10, v1: uv + 10, y0, y1: base + 20, roof: 'flat' }));
    for (const s of [-1, 1]) addBox(Object.assign({}, P, { u0: uu + s * 70 - 10, u1: uu + s * 70 + 10, v0: uv + 10, v1: uv + 70, y0, y1: base + 18 }));
    addBox(Object.assign({}, P, { u0: uu - 8, u1: uu + 8, v0: uv - 18, v1: uv - 10, y0, y1: base + 24, walls: [1, 1, 1, 0] }));
    addBox(Object.assign({}, P, { u0: uu - 7, u1: uu + 7, v0: uv - 7, v1: uv + 7, y0: base + 20, y1: base + 58 }));
    addBox(Object.assign({}, P, { u0: uu - 5, u1: uu + 5, v0: uv - 5, v1: uv + 5, y0: base + 58, y1: base + 70, roof: 'hip', roofH: 6, roofCol: [0.36, 0.60, 0.50] }));
    reg('udem', 'Université de Montréal', 'Université de Montréal', 'Côte-des-Neiges', '1943', ['Ernest Cormier\'s Art Deco Roger-Gaudry pavilion and its tower crown the mountain\'s north slope.', 'One of the largest universities in Canada.'], uu, uv, { h: 70, dist: 380, yaw: 200 });
  }

  // --- McGill University (greystone halls around the lower field)
  {
    const u0 = lineU(-2) + 12, u1 = lineU(2) - 12, v0 = lineV(5) + 14, v1 = lineV(6) - 12;
    const P = { style: STYLE.GREYSTONE, floorH: 4.2, bayW: 3.3, grp: 1, lit: 0.65, col: [0.66, 0.64, 0.58], roofCol: [0.30, 0.48, 0.42] };
    const hall = (a, b, c, d, h, roof, seed) => { const base = hmax((a + b) / 2, (c + d) / 2, 25); addBox(Object.assign({}, P, { seed, base, u0: a, u1: b, v0: c, v1: d, y0: hmin((a + b) / 2, (c + d) / 2, 40) - 3, y1: base + h, roof, roofH: 5 })); return base; };
    const mid = (u0 + u1) / 2;
    const ab = hall(mid - 32, mid + 32, v1 - 26, v1, 17, 'hip', 31);
    const k = new Kit(); k.cyl(MAT.stone, 4.5, 4.5, 6, 0, 0, 0, 16); k.add(MAT.copper, new THREE.SphereGeometry(5, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0, 6, 0, 0, 0, 0, 1, 1.3, 1);
    root.add(place(k.build('mcgill-cupola'), mid, v1 - 13, ab + 21, 0));
    hall(u0, u0 + 30, v0 + 30, v1 - 6, 15, 'mansard', 32); hall(u1 - 30, u1, v0 + 30, v1 - 6, 15, 'mansard', 33);
    hall(u0, u0 + 50, v0, v0 + 22, 13, 'hip', 34); hall(u1 - 50, u1, v0, v0 + 22, 18, 'flat', 35);
    reg('mcgill', 'McGill University', 'Université McGill', 'Downtown', '1821', ['Founded in 1821 on land bequeathed by fur trader James McGill.', 'Its greystone campus climbs from Sherbrooke Street to the mountain.'], mid, (v0 + v1) / 2, { h: 25, dist: 260, yaw: 170 });
  }

  // --- Place des Arts esplanade light shows (Quartier des spectacles)
  {
    const H = HEROES.find((h) => h.id === 'pda');
    reg('pda', 'Place des Arts', 'Place des Arts', 'Quartier des spectacles', '1963', ['Canada\'s largest performing arts complex.', 'At night the Quartier des spectacles glows with projections and light art.'], H.u, H.v, { h: 30, dist: 230, yaw: 190 });
    const rq = mulberry(21);
    for (let i = 0; i < 70; i++) {
      const u = 690 + rq() * 420, v = lineV(3) + (rq() < 0.5 ? -1 : 1) * (8 + rq() * 3);
      glow.add(u, terrainH(u, v) + 5 + rq() * 7, -v, 1, 1, 1, 0.9, 1.8 + rq() * 1.5, 4);
    }
  }

  // --- Chinatown gate (spans Saint-Laurent)
  {
    const u = lineU(9), v = lineV(0) + 55, y = terrainH(u, v);
    const k = new Kit(), w = hwU(9) + 1.3;
    for (const s of [-1, 1]) { k.cyl(MAT.red, 0.55, 0.6, 8.5, s * w, -0.5, 0, 10); k.box(MAT.stoneD, 1.8, 0.8, 1.8, s * w, -0.4, 0); }
    k.box(MAT.red, w * 2 + 2, 1.2, 1.2, 0, 7.4, 0);
    k.box(MAT.gold, w * 1.2, 1.4, 0.3, 0, 8.6, 0);
    k.add(MAT.green, prismGeo(3.6, 1.9, w * 2 + 4), 0, 10, 0, Math.PI / 2);
    root.add(place(k.build('chinatown'), u, v, y, 0));
    reg('chinatown', 'Chinatown', 'Quartier chinois', 'Downtown', '1890s', ['Paifang gates mark the entrances to Montreal\'s Chinatown.', 'Rue De La Gauchetière is its pedestrian heart.'], u, v, { h: 10, dist: 90, yaw: 200, pitch: 10 });
  }

  // --- Atwater Market (Art Deco hall and clock tower by the canal)
  {
    const [au0, av0] = G(45.4799, -73.5777);
    const [au, av] = nearestLand(au0, av0, 20);
    const base = hmax(au, av, 40), y0 = hmin(au, av, 60) - 3;
    const P = { style: STYLE.WAREHOUSE, seed: 41, floorH: 5, bayW: 4, grp: 1, lit: 0.7, col: [0.78, 0.72, 0.60], base, roofCol: [0.3, 0.32, 0.34] };
    addBox(Object.assign({}, P, { u0: au - 70, u1: au + 70, v0: av - 12, v1: av + 12, y0, y1: base + 11, roof: 'flat' }));
    addBox(Object.assign({}, P, { u0: au - 6, u1: au + 6, v0: av - 6, v1: av + 6, y0: base + 11, y1: base + 30, style: STYLE.STONE }));
    addBox(Object.assign({}, P, { u0: au - 4, u1: au + 4, v0: av - 4, v1: av + 4, y0: base + 30, y1: base + 37, style: STYLE.STONE, roof: 'hip', roofH: 4 }));
    reg('atwater', 'Atwater Market', 'Marché Atwater', 'Saint-Henri', '1933', ['Art Deco public market on the Lachine Canal.', 'Its clock tower watches over farm stalls and the canal bike path.'], au, av, { h: 35, dist: 200, yaw: 200 });
  }
  reg('canal', 'Lachine Canal', 'Canal de Lachine', 'Sud-Ouest', '1825', ['14.5 km canal that let ships bypass the Lachine Rapids.', 'Now a linear park lined with lofts, locks and bike paths.'], ...G(45.4872, -73.5695), { h: 10, dist: 300, yaw: 230, pitch: 25 });

  // --- Port of Montreal: gantry cranes, container stacks, a moored ship
  {
    const shore = [[45.5262, -73.5402], [45.5330, -73.5370], [45.5420, -73.5330], [45.5500, -73.5290], [45.5580, -73.5232], [45.5660, -73.5160]];
    const curve = pathFrom(shore.map(([la, lo]) => { const [u, v] = G(la, lo); return [u, v, 0]; }));
    const k = new Kit();
    const L = curve.getLength();
    // inland normal at arc length s (grid units), chosen by probing the water field
    const frame = (s) => {
      const p = curve.getPointAt(s / L), t = curve.getTangentAt(s / L);
      let nx = -t.z, nz = t.x;
      if (waterSDF(p.x + nx * 20, -(p.z + nz * 20)) < waterSDF(p.x - nx * 20, -(p.z - nz * 20))) { nx = -nx; nz = -nz; }
      return { p, t, nx, nz, yaw: Math.atan2(-t.z, t.x) };
    };
    for (let s = 120; s < L - 60; s += 260) {
      const { p, nx, nz, yaw } = frame(s);
      let x = p.x, z = p.z;
      for (let i = 0; i < 60 && waterSDF(x, -z) < 14; i++) { x += nx * 2; z += nz * 2; }
      const u = x, v = -z;
      if (waterSDF(u, v) < 14) continue;
      const y = terrainH(u, v);
      const cr = new Kit();
      for (const [a, b] of [[-9, -8], [9, -8], [-9, 8], [9, 8]]) cr.box(MAT.red, 1.4, 42, 1.4, a, 0, b);
      cr.box(MAT.red, 22, 3, 18, 0, 40, 0); cr.box(MAT.red, 3, 2.5, 95, 0, 44, -25); cr.box(MAT.white, 6, 4, 6, 0, 46, -5);
      const g = cr.build('crane'); place(g, u, v, y, 0);
      g.rotation.y = Math.atan2(nx, nz); g.updateMatrix(); g.updateMatrixWorld(true);
      root.add(g);
      glow.add(u, y + 50, -v, 1, 0.15, 0.1, 1.2, 2.5, 3);
    }
    // containers: instanced, coloured, on port land
    const rc = mulberry(9);
    const cont = []; const colors = [0x8a2c22, 0x1f4e79, 0x2f6b45, 0xb06c1e, 0x6b6e70, 0x7a1f3d, 0xc9b03a];
    for (let s = 60; s < L; s += 14) {
      const { p, nx, nz, yaw } = frame(s);
      for (let row = 0; row < 7; row++) {
        const off = 50 + row * 3.2;
        const x = p.x + nx * off, z = p.z + nz * off, u = x, v = -z;
        if (waterSDF(u, v) < 10 || district(u, v) !== D.PORT || roadEdge(u, v) < 2.5 || rc() < 0.25) continue;
        const stack = 1 + Math.floor(rc() * 4), y = terrainH(u, v);
        for (let h = 0; h < stack; h++) cont.push([u, y + h * 2.6, v, yaw, colors[Math.floor(rc() * colors.length)]]);
      }
    }
    const cg = new THREE.BoxGeometry(12.2, 2.6, 2.44); cg.translate(0, 1.3, 0);
    const cm = new THREE.InstancedMesh(cg, new THREE.MeshStandardMaterial({ roughness: 0.7, metalness: 0.3 }), Math.max(1, cont.length));
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
    cont.forEach(([u, y, v, a, col], i) => { m4.compose(new THREE.Vector3(u, y, -v), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), a), new THREE.Vector3(1, 1, 1)); cm.setMatrixAt(i, m4); cm.setColorAt(i, c.set(col)); });
    cm.count = cont.length;
    cm.castShadow = true; cm.receiveShadow = true; cm.computeBoundingSphere(); root.add(cm);
    reg('port', 'Port of Montreal', 'Port de Montréal', 'Hochelaga', '1830', ['One of the largest inland ports in the world, 1,600 km from the Atlantic.', 'Gantry cranes line the river east of the Old Port.'], ...G(45.5420, -73.5330), { h: 45, dist: 420, yaw: 250, pitch: 22 });
  }

  // ---------------------------------------------------------------- bridges
  const bridgeLights = (curve, width, every, mode, color, hOff = 1.5) => {
    const L = curve.getLength();
    for (let s = 0; s < L; s += every) {
      const p = curve.getPointAt(s / L), t = curve.getTangentAt(s / L), r = new THREE.Vector3(-t.z, 0, t.x).normalize();
      for (const sd of [-1, 1]) glow.add(p.x + r.x * sd * width / 2, p.y + hOff, p.z + r.z * sd * width / 2, color[0], color[1], color[2], 0.9, 1.6, mode);
    }
  };
  const piers = (k, curve, every, w, d, skip = 0) => {
    const L = curve.getLength();
    for (let s = skip; s < L - skip; s += every) {
      const p = curve.getPointAt(s / L), t = curve.getTangentAt(s / L);
      const gu = p.x, gv = -p.z, g = Math.min(terrainH(gu, gv), 0) - 6;
      const top = p.y - 2.6;
      if (top - g < 3) continue;
      const yaw = Math.atan2(-t.z, t.x);
      k.add(MAT.conc, new THREE.BoxGeometry(d, top - g, w), p.x, (top + g) / 2, p.z, yaw);
    }
  };
  const truss = (k, curve, s0, s1, width, heightFn, mat, panel = 12, under = false) => {
    const L = curve.getLength();
    const tops = [[], []], bots = [[], []];
    for (let s = s0; s <= s1 + 0.01; s += panel) {
      const p = curve.getPointAt(Math.min(1, s / L)), t = curve.getTangentAt(Math.min(1, s / L)), r = new THREE.Vector3(-t.z, 0, t.x).normalize();
      const hh = heightFn((s - s0) / (s1 - s0));
      for (const [i, sd] of [[0, -1], [1, 1]]) {
        const b = p.clone().addScaledVector(r, sd * width / 2); b.y += under ? -2.5 : 0;
        const tp = b.clone(); tp.y += under ? -hh : hh;
        bots[i].push(b); tops[i].push(tp);
      }
    }
    for (let i = 0; i < 2; i++) {
      const T = tops[i], B = bots[i];
      for (let j = 0; j < T.length; j++) {
        k.beam(mat, B[j], T[j], 0.9);
        if (j < T.length - 1) { k.beam(mat, T[j], T[j + 1], 1.3); k.beam(mat, B[j], B[j + 1], 1.3); k.beam(mat, j % 2 ? B[j] : T[j], j % 2 ? T[j + 1] : B[j + 1], 0.7); }
      }
    }
    if (!under) for (let j = 0; j < tops[0].length; j += 2) { k.beam(mat, tops[0][j], tops[1][j], 0.8); if (j + 2 < tops[0].length) k.beam(mat, tops[0][j], tops[1][j + 2], 0.5); }
    return tops;
  };
  const deckMat = new THREE.MeshStandardMaterial({ map: deckTex(), roughness: 0.85 });

  // Jacques Cartier Bridge
  {
    const pts = [[45.5268, -73.5512, 0], [45.5240, -73.5480, 24], [45.5212, -73.5446, 42], [45.5194, -73.5400, 46], [45.5181, -73.5362, 41],
      [45.5180, -73.5300, 33], [45.5203, -73.5232, 27], [45.5226, -73.5178, 13], [45.5240, -73.5128, 0]].map(([la, lo, h]) => { const [u, v] = G(la, lo); return [u, v, h]; });
    pts[0][2] = terrainH(pts[0][0], pts[0][1]) - 1.2; pts[pts.length - 1][2] = terrainH(pts.at(-1)[0], pts.at(-1)[1]) - 1.2;
    const curve = pathFrom(pts);
    const k = new Kit();
    const { L } = deckRibbon(k, curve, 22, 2.4, deckMat, MAT.steelG);
    piers(k, curve, 64, 16, 7, 60);
    const sA = L * 0.16, sB = L * 0.47;
    const tops = truss(k, curve, sA, sB, 23, (t) => 9 + 36 * (0.55 * Math.pow(Math.sin(Math.PI * t), 0.6) + 0.45 * (Math.exp(-Math.pow((t - 0.25) / 0.13, 2)) + Math.exp(-Math.pow((t - 0.75) / 0.13, 2)))), MAT.steelG, 11);
    truss(k, curve, sB + 8, L * 0.9, 21, () => 6, MAT.steelG, 12, true);
    truss(k, curve, L * 0.06, sA - 8, 21, () => 5, MAT.steelG, 12, true);
    const rail = new Kit();
    root.add(k.build('jacques-cartier'));
    for (const side of tops) for (let j = 0; j < side.length; j += 1) glow.add(side[j].x, side[j].y + 0.8, side[j].z, 1, 1, 1, 0.9, 1.8, 4);
    bridgeLights(curve, 23, 24, 0, [1, 0.85, 0.6]);
    paths.jacquesCartier = { curve, width: 22, lanes: [-7, -3.5, 3.5, 7] };
    const mid = curve.getPointAt(0.33);
    reg('jacquescartier', 'Jacques Cartier Bridge', 'Pont Jacques-Cartier', 'Saint Lawrence River', '1930', ['Steel cantilever bridge linking Montreal, Île Sainte-Hélène and Longueuil.', 'Since 2017 its 2,800 LEDs change colour with the seasons and the city\'s pulse.'], mid.x, -mid.z, { h: 60, dist: 520, yaw: 120, pitch: 14 });
  }
  // Victoria Bridge (low steel through-truss spans)
  {
    const pts = [[45.4872, -73.5440, 0], [45.4866, -73.5405, 10], [45.4880, -73.5300, 14], [45.4900, -73.5190, 14], [45.4918, -73.5110, 12], [45.4930, -73.5060, 0]].map(([la, lo, h]) => { const [u, v] = G(la, lo); return [u, v, h]; });
    pts[0][2] = terrainH(pts[0][0], pts[0][1]) - 1.2; pts.at(-1)[2] = terrainH(pts.at(-1)[0], pts.at(-1)[1]) - 1.2;
    const curve = pathFrom(pts);
    const k = new Kit();
    const { L } = deckRibbon(k, curve, 15, 1.8, deckMat, MAT.rust);
    piers(k, curve, 80, 12, 8, 40);
    for (let s = L * 0.08; s < L * 0.9; s += 82) truss(k, curve, s, s + 78, 15.5, (t) => 7 + 2.5 * Math.sin(Math.PI * t), MAT.rust, 9.75);
    root.add(k.build('victoria'));
    bridgeLights(curve, 15, 30, 0, [1, 0.8, 0.55]);
    paths.victoria = { curve, width: 15, lanes: [-3.3, 3.3] };
    const mid = curve.getPointAt(0.5);
    reg('victoria', 'Victoria Bridge', 'Pont Victoria', 'Saint Lawrence River', '1859', ['The first bridge across the Saint Lawrence.', 'Rebuilt in 1898 with the steel trusses it still wears today.'], mid.x, -mid.z, { h: 30, dist: 520, yaw: 200, pitch: 16 });
  }
  // Samuel De Champlain Bridge (cable-stayed) — carries the REM in its central corridor
  {
    const pts = [[45.4706, -73.5458, 0], [45.4660, -73.5410, 8], [45.4612, -73.5355, 16], [45.4620, -73.5200, 22], [45.4630, -73.5070, 34], [45.4640, -73.4990, 42], [45.4648, -73.4940, 26], [45.4652, -73.4895, 10], [45.4650, -73.4850, 0]].map(([la, lo, h]) => { const [u, v] = G(la, lo); return [u, v, h]; });
    pts[0][2] = terrainH(pts[0][0], pts[0][1]) - 1.2; pts.at(-1)[2] = terrainH(pts.at(-1)[0], pts.at(-1)[1]) - 1.2;
    const curve = pathFrom(pts);
    const k = new Kit();
    const { L } = deckRibbon(k, curve, 52, 3, deckMat, MAT.white);
    piers(k, curve, 75, 40, 6, 50);
    const sp = L * 0.82;
    const p = curve.getPointAt(sp / L), t = curve.getTangentAt(sp / L), r = new THREE.Vector3(-t.z, 0, t.x).normalize();
    const base = new THREE.Vector3(p.x, -6, p.z), H = 168;
    for (const sd of [-1, 1]) {
      const footA = base.clone().addScaledVector(r, sd * 9);
      const mid = base.clone().addScaledVector(r, sd * 3.2); mid.y = p.y + 24;
      const topP = base.clone().addScaledVector(r, sd * 2.6); topP.y = H;
      k.beam(MAT.white, footA, mid, 6, 5); k.beam(MAT.white, mid, topP, 4.2, 4);
    }
    for (let i = 0; i < 14; i++) for (const dirS of [-1, 1]) {
      const anchor = curve.getPointAt(Math.min(0.995, Math.max(0.005, (sp + dirS * (30 + i * 15)) / L)));
      const at = new THREE.Vector3(p.x, 100 + i * 4.6, p.z);
      k.beam(MAT.cable, at, anchor.clone().add(new THREE.Vector3(0, 1, 0)), 0.32);
    }
    root.add(k.build('champlain'));
    glow.add(p.x, H + 2, p.z, 1, 0.15, 0.1, 1.4, 3, 3);
    bridgeLights(curve, 52, 30, 0, [0.9, 0.92, 1]);
    paths.champlain = { curve, width: 52, lanes: [-20, -16.5, -13, 13, 16.5, 20] };
    reg('champlain', 'Samuel De Champlain Bridge', 'Pont Samuel-De Champlain', 'Saint Lawrence River', '2019', ['Cable-stayed bridge replacing the 1962 Champlain Bridge.', 'Its central corridor carries the REM light metro to the South Shore.'], p.x, -p.z, { h: 120, dist: 700, yaw: 300, pitch: 14 });
  }
  // Concorde Bridge (Cité du Havre to the islands)
  {
    const pts = [[45.5004, -73.5392, 0], [45.5022, -73.5370, 9], [45.5050, -73.5345, 9], [45.5070, -73.5325, 0]].map(([la, lo, h]) => { const [u, v] = G(la, lo); return [u, v, h]; });
    pts[0][2] = terrainH(pts[0][0], pts[0][1]) - 1; pts.at(-1)[2] = terrainH(pts.at(-1)[0], pts.at(-1)[1]) - 1;
    const curve = pathFrom(pts); const k = new Kit();
    deckRibbon(k, curve, 14, 1.6, deckMat, MAT.conc); piers(k, curve, 45, 10, 4, 20);
    root.add(k.build('concorde'));
    paths.concorde = { curve, width: 14, lanes: [-3.2, 3.2] };
  }

  // ---------------------------------------------------------------- REM elevated guideway + train
  {
    const pts = [[45.4952, -73.5612, 9], [45.4925, -73.5578, 14], [45.4890, -73.5535, 14], [45.4835, -73.5500, 13], [45.4765, -73.5476, 13], [45.4718, -73.5450, 12], [45.4675, -73.5418, 12], [45.4630, -73.5375, 17]]
      .map(([la, lo, h]) => { const [u, v] = G(la, lo); return [u, v, Math.max(h, terrainH(u, v) + 9)]; });
    const champ = paths.champlain.curve;
    const cpts = []; for (let i = 0; i <= 40; i++) { const p = champ.getPointAt(0.12 + i / 40 * 0.86); cpts.push([p.x, -p.z, p.y + 0.6]); }
    const curve = pathFrom(pts.concat(cpts.slice(2)));
    const k = new Kit();
    const L = curve.getLength(), lenA = pathFrom(pts).getLength();
    deckRibbon(k, new THREE.CatmullRomCurve3(curve.getSpacedPoints(Math.ceil(lenA / 6)).slice(0, Math.ceil(lenA / 6) - 3)), 9, 2, MAT.conc, MAT.conc);
    piers(k, pathFrom(pts), 35, 4, 4, 0);
    root.add(k.build('rem-guideway'));
    // the train: two 2-car sets, white with a green band, lit windows
    const car = new Kit();
    car.box(MAT.white, 3.0, 3.4, 38, 0, 0.6, 0); car.box(MAT.winWarm, 3.06, 1.1, 34, 0, 2.2, 0); car.box(MAT.green, 3.06, 0.35, 38, 0, 1.4, 0);
    const trainA = car.build('rem-car'); const trainB = trainA.clone(); trainA.matrixAutoUpdate = trainB.matrixAutoUpdate = true;
    root.add(trainA, trainB);
    const look = new THREE.Vector3();
    let s = 0, dir = 1, wait = 0;
    anim.push((tt, dt) => {
      if (wait > 0) { wait -= dt; } else { s += dir * 24 * dt; if (s > L - 60) { s = L - 60; dir = -1; wait = 12; } if (s < 20) { s = 20; dir = 1; wait = 12; } }
      for (const [tr, off] of [[trainA, 0], [trainB, -39]]) {
        const ss = Math.max(1, Math.min(L - 1, s + off * dir));
        const p = curve.getPointAt(ss / L); look.copy(curve.getPointAt(Math.min(1, (ss + 2) / L)));
        tr.position.set(p.x, p.y + 0.4, p.z); tr.lookAt(look.x, p.y + 0.4, look.z);
      }
    });
    paths.rem = { curve };
    const mid = curve.getPointAt(0.12);
    reg('rem', 'REM light metro', 'Réseau express métropolitain', 'Sud-Ouest', '2023', ['Automated light metro; its South Shore branch opened in 2023.', 'Runs on an elevated guideway over the Lachine Canal and across the Samuel De Champlain Bridge.'], mid.x, -mid.z, { h: 20, dist: 220, yaw: 250, pitch: 18 });
  }

  // ---------------------------------------------------------------- ships
  {
    const shipKit = new Kit();
    const hull = new THREE.Shape(); hull.moveTo(-90, 0); hull.lineTo(80, 0); hull.quadraticCurveTo(100, 0, 104, 9); hull.lineTo(-92, 9); hull.lineTo(-90, 0);
    const hg = new THREE.ExtrudeGeometry(hull, { depth: 26, bevelEnabled: false }); hg.translate(0, -5, -13);
    shipKit.add(MAT.red, hg); shipKit.box(MAT.white, 18, 14, 24, -75, 4, 0); shipKit.box(MAT.winWarm, 18.2, 1.6, 24.2, -75, 13, 0);
    const rs = mulberry(5); const cc = [MAT.red, MAT.green, MAT.yellow, MAT.steel, MAT.dark];
    for (let i = 0; i < 12; i++) for (let j = -2; j <= 2; j++) shipKit.box(cc[Math.floor(rs() * cc.length)], 12, 2.6 * (1 + Math.floor(rs() * 3)), 2.4, -50 + i * 12.6, 4, j * 4.9);
    const ship = shipKit.build('ship');
    const route = pathFrom([[45.4560, -73.4990], [45.4800, -73.5180], [45.4990, -73.5290], [45.5120, -73.5420], [45.5235, -73.5395], [45.5420, -73.5290], [45.5650, -73.5120]].map(([la, lo]) => { const [u, v] = G(la, lo); return [u, v, 0]; }));
    ship.matrixAutoUpdate = true; root.add(ship);
    const RL = route.getLength(); let sp = 0.35 * RL; const look = new THREE.Vector3();
    anim.push((t, dt) => { sp = (sp + 4.5 * dt) % RL; const p = route.getPointAt(sp / RL); look.copy(route.getPointAt(Math.min(1, (sp + 5) / RL))); ship.position.set(p.x, 0, p.z); ship.lookAt(look.x, 0, look.z); ship.rotateY(-Math.PI / 2); });
    const moored = ship.clone(); moored.matrixAutoUpdate = false;
    const [mu, mv] = G(45.5470, -73.5300); moored.position.set(mu + 70, 0, -mv - 70); moored.rotation.y = 0.55; moored.updateMatrix(); root.add(moored);
  }

  glow.commit();
  root.add(glow.mesh);
  scene.add(root);
  return {
    root, glow, paths,
    update(t, dt) { const n = U.uNight.value; for (const [m, b] of NIGHT) m.emissiveIntensity = b * n; for (const f of anim) f(t, dt); },
  };
}

// a safe street-level standing spot near a landmark (for VR teleports and walk mode)
export function standPoint(L) {
  if (L.stand) return L.stand;
  for (const r of [L.h * 0.5 + 40, 70, 110, 160, 220]) for (let a = 0; a < 24; a++) {
    const ang = (L.yaw + 180 + (a % 2 ? 1 : -1) * Math.ceil(a / 2) * 15) * Math.PI / 180;
    const u = L.u + Math.sin(ang) * r, v = L.v - Math.cos(ang) * r;
    if (waterSDF(u, v) < 3) continue;
    const y = terrainH(u, v);
    if (BOXES.inside(u, -v, y + 1, 1.5)) continue;
    return [u, v, Math.atan2(L.u - u, L.v - v) * 180 / Math.PI];
  }
  return [L.u + 60, L.v, 0];
}
