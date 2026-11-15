// Extruded buildings: three facade styles (glass / concrete / brick), pitched house roofs, rooftop equipment and tower crowns.
import * as THREE from 'three';
import earcut from 'earcut';
import { Acc, rgb, hash } from './acc.js';
import { polygons, area2 } from './geom.js';

const BRICK = [0x9a5a45, 0x8d5f4b, 0xa8664e, 0x7a4d3f, 0xb07a5e, 0x9c8f80, 0xc2b8a6, 0x6e5a4e].map(rgb);
const CONC = [0xb9b4aa, 0xa8a39a, 0xc9c2b4, 0xd6d0c4, 0x9a9a98, 0x8a8f94, 0xbfb6a6].map(rgb);
const GLASS = [0x7fa0b8, 0x6c8fa8, 0x5f7b92, 0x8fb0c4, 0x4f6a80, 0x9db4c2, 0x587a8a].map(rgb);
const SHINGLE = [0x3b3b3d, 0x4a4543, 0x5a3b34, 0x2e3033, 0x55504a, 0x6a4a3a].map(rgb);
const METAL = rgb(0x8a8e92), METAL2 = rgb(0x6a6e72);
const FLOOR_H = 27.2, BAY_W = 12.8; // one facade texture = 8 floors x 4 bays

export class Occ { // tiny spatial index of building footprints, used to keep lamps, trees and labels out of buildings
  constructor() { this.g = new Map(); }
  add(ring, h) {
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (const p of ring) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < z0) z0 = p[1]; if (p[1] > z1) z1 = p[1]; }
    const r = { ring, h, x0, x1, z0, z1 };
    for (let cx = Math.floor(x0 / 48); cx <= Math.floor(x1 / 48); cx++) for (let cz = Math.floor(z0 / 48); cz <= Math.floor(z1 / 48); cz++) { const k = cx + ',' + cz; (this.g.get(k) || this.g.set(k, []).get(k)).push(r); }
  }
  at(x, z) { // building height at a point, 0 if open ground
    const l = this.g.get(Math.floor(x / 48) + ',' + Math.floor(z / 48)); if (!l) return 0;
    for (const r of l) if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1 && pip(r.ring, x, z)) return r.h;
    return 0;
  }
}
function pip(ring, x, z) {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > z) !== (b[1] > z) && x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
}
// wall quads for a ring, outward-facing, into acc (flat normals are computed later)
function prism(acc, ring, y0, y1, cw, ct) {
  const A = area2(ring), k = A > 0 ? 1 : -1, rev = k > 0, n = ring.length;
  for (let i = 0; i < n; i++) {
    const p = ring[i], q = ring[(i + 1) % n];
    const a = acc.v(p[0], y0, p[1], ...cw), b = acc.v(q[0], y0, q[1], ...cw), c = acc.v(q[0], y1, q[1], ...ct), d = acc.v(p[0], y1, p[1], ...ct);
    if (rev) { acc.tri(a, c, b); acc.tri(a, d, c); } else { acc.tri(a, b, c); acc.tri(a, c, d); }
  }
  const flat = []; for (const p of ring) flat.push(p[0], p[1]);
  const idx = earcut(flat, undefined, 2), o = acc.n;
  for (let i = 0; i < flat.length; i += 2) acc.v(flat[i], y1, flat[i + 1], ...ct);
  for (let i = 0; i < idx.length; i += 3) acc.up(o + idx[i], o + idx[i + 1], o + idx[i + 2]);
}
function box(acc, cx, cz, sx, sz, ang, y0, y1, c) {
  const co = Math.cos(ang), si = Math.sin(ang), r = [];
  for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) r.push([cx + (u * sx * co - v * sz * si) / 2, cz + (u * sx * si + v * sz * co) / 2]);
  prism(acc, r, y0, y1, c, c);
}
// triangle oriented away from a centre point
function triOut(acc, a, b, c, cx, cy, cz) {
  const p = acc.p, ax = p[a * 3], ay = p[a * 3 + 1], az = p[a * 3 + 2];
  const ux = p[b * 3] - ax, uy = p[b * 3 + 1] - ay, uz = p[b * 3 + 2] - az, vx = p[c * 3] - ax, vy = p[c * 3 + 1] - ay, vz = p[c * 3 + 2] - az;
  const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
  const mx = (ax + p[b * 3] + p[c * 3]) / 3 - cx, my = (ay + p[b * 3 + 1] + p[c * 3 + 1]) / 3 - cy, mz = (az + p[b * 3 + 2] + p[c * 3 + 2]) / 3 - cz;
  if (nx * mx + ny * my + nz * mz >= 0) acc.tri(a, b, c); else acc.tri(a, c, b);
}
const mul = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
const dist = (p, q) => Math.hypot(q[0] - p[0], q[1] - p[1]);

export function* buildBuildings(layer, T, seed, occ) {
  const W = { glass: new Acc(), concrete: new Acc(), brick: new Acc() }, UV = { glass: [], concrete: [], brick: [] }, NR = { glass: [], concrete: [], brick: [] };
  const roofs = new Acc(), det = new Acc();
  for (let fi = 0; fi < layer.length; fi++) {
    if (fi % 200 === 0) yield;
    const f = layer.feature(fi), pr = f.properties;
    if (pr.hide_3d === true || pr.hide_3d === 'true') continue;
    const rnd = hash(seed + fi * 7919), rnd2 = hash(seed + fi * 104729), rnd3 = hash(seed + fi * 1299709);
    let h = +pr.render_height;
    if (!(h > 0)) h = 7 + rnd * 8;
    let minh = +pr.render_min_height || 0;
    if (h <= minh + 1) h = minh + 4;
    // facade style by height, with some mix
    let style, pal;
    if (h > 75) { style = rnd2 < 0.68 ? 'glass' : 'concrete'; }
    else if (h > 24) { style = rnd2 < 0.2 ? 'glass' : rnd2 < 0.62 ? 'concrete' : 'brick'; }
    else style = rnd2 < 0.62 ? 'brick' : 'concrete';
    pal = style === 'glass' ? GLASS : style === 'brick' ? BRICK : CONC;
    const base = pal[Math.floor(rnd * pal.length) % pal.length];
    const tone = 0.86 + hash(seed + fi * 31) * 0.28;
    const uOff = hash(seed + fi * 13);
    const walls = W[style], uv = UV[style], nrm = NR[style];
    for (const poly of polygons(f, T)) {
      occ.add(poly[0], h);
      const ring0 = poly[0], A0 = Math.abs(area2(ring0));
      // ---- pitched roof for small houses (4-corner footprints)
      const gable = poly.length === 1 && ring0.length === 4 && minh === 0 && h <= 15 && A0 > 28 && A0 < 440 && rnd3 < (h <= 11 ? 0.88 : 0.5);
      const eave = gable ? h : h;
      // ---- walls
      for (let ri = 0; ri < poly.length; ri++) {
        const ring = poly[ri], A = area2(ring), k = (A > 0 ? 1 : -1) * (ri > 0 ? -1 : 1), rev = k > 0;
        let d = 0;
        for (let i = 0, n = ring.length; i < n; i++) {
          const p = ring[i], q = ring[(i + 1) % n];
          const dx = q[0] - p[0], dz = q[1] - p[1], len = Math.hypot(dx, dz);
          if (len < 0.05) continue;
          const nx = (dz * k) / len, nz = (-dx * k) / len;
          const lo = minh === 0 ? 0.68 : 1; // darker at street level = cheap ambient occlusion
          const cb = [base[0] * tone * lo, base[1] * tone * lo, base[2] * tone * lo], ct = [base[0] * tone, base[1] * tone, base[2] * tone];
          const a = walls.v(p[0], minh, p[1], cb[0], cb[1], cb[2]);
          const b = walls.v(q[0], minh, q[1], cb[0], cb[1], cb[2]);
          const c = walls.v(q[0], eave, q[1], ct[0], ct[1], ct[2]);
          const dd = walls.v(p[0], eave, p[1], ct[0], ct[1], ct[2]);
          const u0 = d / BAY_W + uOff, u1 = (d + len) / BAY_W + uOff, v0 = minh / FLOOR_H, v1 = eave / FLOOR_H;
          uv.push(u0, v0, u1, v0, u1, v1, u0, v1);
          for (let j = 0; j < 4; j++) nrm.push(nx, 0, nz);
          if (rev) { walls.tri(a, c, b); walls.tri(a, dd, c); } else { walls.tri(a, b, c); walls.tri(a, c, dd); }
          d += len;
        }
      }
      if (gable) {
        const [p0, p1, p2, p3] = ring0, cx = (p0[0] + p1[0] + p2[0] + p3[0]) / 4, cz = (p0[1] + p1[1] + p2[1] + p3[1]) / 4;
        const longA = dist(p0, p1) + dist(p2, p3) >= dist(p1, p2) + dist(p3, p0);
        const [a0, a1, a2, a3] = longA ? [p0, p1, p2, p3] : [p1, p2, p3, p0]; // a0-a1 and a2-a3 are the long sides
        const shortLen = Math.min(dist(a1, a2), dist(a3, a0)), rise = Math.min(4.2, Math.max(1.6, shortLen * 0.3));
        const m1 = [(a1[0] + a2[0]) / 2, (a1[1] + a2[1]) / 2], m2 = [(a3[0] + a0[0]) / 2, (a3[1] + a0[1]) / 2];
        const rc = mul(SHINGLE[Math.floor(rnd3 * 977) % SHINGLE.length], tone), wc = mul(base, tone);
        const V = (p, y, c) => det.v(p[0], y, p[1], c[0], c[1], c[2]);
        const A_ = V(a0, h, rc), B_ = V(a1, h, rc), C_ = V(a2, h, rc), D_ = V(a3, h, rc), M1 = V(m1, h + rise, rc), M2 = V(m2, h + rise, rc);
        const cy = h + rise * 0.4;
        triOut(det, A_, B_, M1, cx, cy, cz); triOut(det, A_, M1, M2, cx, cy, cz); triOut(det, C_, D_, M2, cx, cy, cz); triOut(det, C_, M2, M1, cx, cy, cz);
        const gA = V(a1, h, wc), gB = V(a2, h, wc), gM = V(m1, h + rise, wc), gC = V(a3, h, wc), gD = V(a0, h, wc), gN = V(m2, h + rise, wc);
        triOut(det, gA, gB, gM, cx, cy, cz); triOut(det, gC, gD, gN, cx, cy, cz);
        continue;
      }
      // ---- flat roof
      const flat = [], holes = [];
      for (let ri = 0; ri < poly.length; ri++) { if (ri > 0) holes.push(flat.length / 2); for (const p of poly[ri]) flat.push(p[0], p[1]); }
      const idx = earcut(flat, holes.length ? holes : undefined, 2);
      if (!idx.length) continue;
      const rr = style === 'glass' ? 0.5 : 0.62, rc = [base[0] * tone * rr, base[1] * tone * rr, base[2] * tone * rr];
      const o = roofs.n;
      for (let i = 0; i < flat.length; i += 2) roofs.v(flat[i], h, flat[i + 1], rc[0], rc[1], rc[2]);
      for (let i = 0; i < idx.length; i += 3) roofs.up(o + idx[i], o + idx[i + 1], o + idx[i + 2]);
      // ---- rooftop equipment
      if (h >= 14 && A0 > 140 && minh === 0 || h >= 14 && A0 > 400) {
        let cx = 0, cz = 0; for (const p of ring0) { cx += p[0]; cz += p[1]; } cx /= ring0.length; cz /= ring0.length;
        const ang = Math.atan2(ring0[1][1] - ring0[0][1], ring0[1][0] - ring0[0][0]), span = Math.sqrt(A0);
        const nb = A0 > 2500 ? 4 : A0 > 900 ? 3 : A0 > 350 ? 2 : 1;
        for (let b = 0; b < nb; b++) {
          const ox = (hash(seed + fi * 17 + b * 5) - 0.5) * span * 0.55, oz = (hash(seed + fi * 19 + b * 7) - 0.5) * span * 0.55;
          const sx = 2.2 + hash(seed + fi * 23 + b) * 4.5, sz = 2.2 + hash(seed + fi * 29 + b) * 4.5, hh = 1.3 + hash(seed + fi * 37 + b) * 2.6;
          const bx = cx + ox, bz = cz + oz, r = Math.max(sx, sz) / 2 + 0.5;
          if (pip(ring0, bx, bz) && pip(ring0, bx + r, bz) && pip(ring0, bx - r, bz) && pip(ring0, bx, bz + r) && pip(ring0, bx, bz - r)) box(det, bx, bz, sx, sz, ang, h, h + hh, b % 2 ? METAL : METAL2);
        }
      }
      // ---- tower crown + spire
      if (h >= 95 && poly.length === 1 && A0 > 260) {
        let cx = 0, cz = 0; for (const p of ring0) { cx += p[0]; cz += p[1]; } cx /= ring0.length; cz /= ring0.length;
        const sc = (s) => ring0.map((p) => [cx + (p[0] - cx) * s, cz + (p[1] - cz) * s]);
        const cr = sc(0.72);
        if (cr.every((p) => pip(ring0, p[0], p[1])) && pip(ring0, cx, cz)) {
          const ch = 3 + h * 0.035, cc = mul(base, tone * 0.62);
          prism(det, cr, h, h + ch, cc, mul(cc, 0.8));
          const c2 = sc(0.4);
          prism(det, c2, h + ch, h + ch * 1.9, mul(cc, 0.9), mul(METAL, 0.9));
          if (h >= 150 && rnd < 0.7) box(det, cx, cz, 1.1, 1.1, 0, h + ch * 1.9, h + ch * 1.9 + h * 0.12, METAL2);
        }
      }
    }
  }
  const out = { walls: {} };
  for (const s in W) {
    if (W[s].empty) continue;
    const g = W[s].geometry(false, { uv: { data: UV[s], size: 2 } });
    g.setAttribute('normal', new THREE.Float32BufferAttribute(NR[s], 3));
    out.walls[s] = g;
  }
  if (!roofs.empty) out.roofs = roofs.geometry(true);
  if (!det.empty) { const g = det.geometry(false).toNonIndexed(); g.computeVertexNormals(); out.detail = g; }
  return out;
}

// ---------- procedural facade textures (day colour + matching emissive night windows), three styles
const TEX_W = 512, TEX_H = 1024, COLS = 4, ROWS = 8;
export function makeFacadeTextures(renderer) {
  const cw = TEX_W / COLS, rh = TEX_H / ROWS;
  let s = 12345; const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const lit = () => { const warm = rnd(); return warm < 0.72 ? `rgb(255,${185 + rnd() * 45 | 0},${100 + rnd() * 60 | 0})` : `rgb(${185 + rnd() * 45 | 0},${215 + rnd() * 35 | 0},255)`; };
  const mk = (draw) => {
    const day = document.createElement('canvas'), nite = document.createElement('canvas'); day.width = nite.width = TEX_W; day.height = nite.height = TEX_H;
    const d = day.getContext('2d'), n = nite.getContext('2d'); d.fillStyle = '#fff'; d.fillRect(0, 0, TEX_W, TEX_H); n.fillStyle = '#000'; n.fillRect(0, 0, TEX_W, TEX_H);
    draw(d, n);
    const t = (cv) => { const x = new THREE.CanvasTexture(cv); x.wrapS = x.wrapT = THREE.RepeatWrapping; x.colorSpace = THREE.SRGBColorSpace; x.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); return x; };
    return { map: t(day), emissiveMap: t(nite) };
  };
  const glass = mk((d, n) => {
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) for (let p = 0; p < 2; p++) {
      const x = c * cw + p * (cw / 2) + 3, y = r * rh + 10, w = cw / 2 - 6, h = rh - 22, t = 50 + rnd() * 44;
      const g = d.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, `rgb(${t + 70},${t + 96},${t + 120})`); g.addColorStop(0.55, `rgb(${t + 20},${t + 44},${t + 66})`); g.addColorStop(1, `rgb(${t},${t + 14},${t + 30})`);
      d.fillStyle = g; d.fillRect(x, y, w, h);
      d.fillStyle = 'rgba(255,255,255,0.07)'; d.beginPath(); d.moveTo(x, y + h); d.lineTo(x + w * 0.6, y); d.lineTo(x + w, y); d.lineTo(x + w * 0.4, y + h); d.fill(); // diagonal reflection streak
      if (rnd() < 0.3) { n.fillStyle = lit(); n.fillRect(x, y, w, h); }
    }
    for (let r = 0; r < ROWS; r++) { d.fillStyle = 'rgba(30,40,50,0.55)'; d.fillRect(0, r * rh + rh - 12, TEX_W, 12); }
  });
  const conc = mk((d, n) => {
    d.fillStyle = 'rgba(0,0,0,0.04)'; for (let i = 0; i < 900; i++) d.fillRect(rnd() * TEX_W, rnd() * TEX_H, 2 + rnd() * 5, 1 + rnd() * 3);
    for (let r = 0; r < ROWS; r++) {
      const y = r * rh + rh * 0.24, h = rh * 0.52, t = 60 + rnd() * 30;
      const g = d.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, `rgb(${t + 46},${t + 62},${t + 84})`); g.addColorStop(1, `rgb(${t},${t + 12},${t + 26})`);
      d.fillStyle = g; d.fillRect(0, y, TEX_W, h);
      d.fillStyle = 'rgba(0,0,0,0.4)'; for (let c = 0; c <= COLS * 2; c++) d.fillRect(c * (cw / 2) - 2, y, 4, h);
      d.fillStyle = 'rgba(0,0,0,0.22)'; d.fillRect(0, r * rh + rh - 8, TEX_W, 8); d.fillStyle = 'rgba(255,255,255,0.16)'; d.fillRect(0, r * rh + rh * 0.76, TEX_W, 4); // slab edge + sill light
      for (let c = 0; c < COLS * 2; c++) if (rnd() < 0.38) { n.fillStyle = lit(); n.fillRect(c * (cw / 2) + 2, y + 2, cw / 2 - 4, h - 4); }
    }
  });
  const brick = mk((d, n) => {
    for (let y = 0, row = 0; y < TEX_H; y += 8, row++) for (let x = -(row % 2) * 9; x < TEX_W; x += 18) { const v = 205 + rnd() * 40 | 0; d.fillStyle = `rgb(${v},${v - 6},${v - 12})`; d.fillRect(x + 1, y + 1, 16, 6); }
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) for (let p = 0; p < 1; p++) {
      const x = c * cw + cw * 0.22, y = r * rh + rh * 0.2, w = cw * 0.56, h = rh * 0.56, t = 40 + rnd() * 30;
      d.fillStyle = 'rgba(245,242,235,1)'; d.fillRect(x - 5, y - 5, w + 10, h + 10); // frame
      const g = d.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, `rgb(${t + 40},${t + 56},${t + 76})`); g.addColorStop(1, `rgb(${t},${t + 10},${t + 22})`);
      d.fillStyle = g; d.fillRect(x, y, w, h);
      d.fillStyle = 'rgba(235,232,225,1)'; d.fillRect(x + w / 2 - 2, y, 4, h); d.fillRect(x, y + h / 2 - 2, w, 4); // mullions
      d.fillStyle = 'rgba(0,0,0,0.3)'; d.fillRect(x - 7, y + h + 5, w + 14, 5); // sill shadow
      if (rnd() < 0.36) { n.fillStyle = lit(); n.fillRect(x, y, w, h); n.fillStyle = '#000'; n.fillRect(x + w / 2 - 2, y, 4, h); n.fillRect(x, y + h / 2 - 2, w, 4); }
    }
  });
  return { glass, concrete: conc, brick };
}
