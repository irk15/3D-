// Extruded buildings, merged into one wall mesh + one roof mesh per tile.
import * as THREE from 'three';
import earcut from 'earcut';
import { Acc, rgb, hash } from './acc.js';
import { polygons, area2 } from './geom.js';

const LOW = [0xb9b4aa, 0xa8a39a, 0x9c8f80, 0x8d5f4b, 0xc9c2b4, 0x7e8a94, 0xd6d0c4, 0x7a6a5c, 0xb07a5e].map(rgb);
const TALL = [0x5f7b92, 0x6c8296, 0x4f6475, 0x8896a3, 0x75889a, 0x9aa7b3].map(rgb);
const FLOOR_H = 27.2, BAY_W = 12.8; // one facade texture = 8 floors x 4 bays

export function* buildBuildings(layer, T, seed) {
  const walls = new Acc(), roofs = new Acc(), uv = [], nrm = [];
  for (let fi = 0; fi < layer.length; fi++) {
    if (fi % 250 === 0) yield;
    const f = layer.feature(fi), pr = f.properties;
    if (pr.hide_3d === true || pr.hide_3d === 'true') continue;
    const rnd = hash(seed + fi * 7919);
    let h = +pr.render_height;
    if (!(h > 0)) h = 7 + rnd * 8;
    let minh = +pr.render_min_height || 0;
    if (h <= minh + 1) h = minh + 4;
    const pal = h > 70 ? TALL : LOW;
    const base = pal[Math.floor(rnd * pal.length) % pal.length];
    const tone = 0.85 + hash(seed + fi * 31) * 0.3;
    const uOff = hash(seed + fi * 13);
    for (const poly of polygons(f, T)) {
      // ---- walls
      for (let ri = 0; ri < poly.length; ri++) {
        const ring = poly[ri], A = area2(ring), k = (A > 0 ? 1 : -1) * (ri > 0 ? -1 : 1), rev = k > 0;
        let dist = 0;
        for (let i = 0, n = ring.length; i < n; i++) {
          const p = ring[i], q = ring[(i + 1) % n];
          const dx = q[0] - p[0], dz = q[1] - p[1], len = Math.hypot(dx, dz);
          if (len < 0.05) continue;
          const nx = (dz * k) / len, nz = (-dx * k) / len;
          const lo = minh === 0 ? 0.7 : 1; // darker at street level = cheap ambient occlusion
          const cb = [base[0] * tone * lo, base[1] * tone * lo, base[2] * tone * lo], ct = [base[0] * tone, base[1] * tone, base[2] * tone];
          const a = walls.v(p[0], minh, p[1], cb[0], cb[1], cb[2]);
          const b = walls.v(q[0], minh, q[1], cb[0], cb[1], cb[2]);
          const c = walls.v(q[0], h, q[1], ct[0], ct[1], ct[2]);
          const d = walls.v(p[0], h, p[1], ct[0], ct[1], ct[2]);
          const u0 = dist / BAY_W + uOff, u1 = (dist + len) / BAY_W + uOff, v0 = minh / FLOOR_H, v1 = h / FLOOR_H;
          uv.push(u0, v0, u1, v0, u1, v1, u0, v1);
          for (let j = 0; j < 4; j++) nrm.push(nx, 0, nz);
          if (rev) { walls.tri(a, c, b); walls.tri(a, d, c); } else { walls.tri(a, b, c); walls.tri(a, c, d); }
          dist += len;
        }
      }
      // ---- roof
      const flat = [], holes = [];
      for (let ri = 0; ri < poly.length; ri++) { if (ri > 0) holes.push(flat.length / 2); for (const p of poly[ri]) flat.push(p[0], p[1]); }
      const idx = earcut(flat, holes.length ? holes : undefined, 2);
      if (!idx.length) continue;
      const rc = [base[0] * tone * 0.55, base[1] * tone * 0.55, base[2] * tone * 0.55];
      const o = roofs.n;
      for (let i = 0; i < flat.length; i += 2) roofs.v(flat[i], h, flat[i + 1], rc[0], rc[1], rc[2]);
      for (let i = 0; i < idx.length; i += 3) roofs.up(o + idx[i], o + idx[i + 1], o + idx[i + 2]);
    }
  }
  const out = {};
  if (!walls.empty) {
    const g = walls.geometry(false, { uv: { data: uv, size: 2 } });
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    out.walls = g;
  }
  if (!roofs.empty) out.roofs = roofs.geometry(true);
  return out;
}

// Procedural facade texture: 4 bays x 8 floors. Same layout used for the night-time lit windows.
export function makeFacadeTextures(renderer) {
  const W = 256, H = 512, cols = 4, rows = 8, cw = W / cols, rh = H / rows;
  const day = document.createElement('canvas'), nite = document.createElement('canvas');
  day.width = nite.width = W; day.height = nite.height = H;
  const d = day.getContext('2d'), n = nite.getContext('2d');
  d.fillStyle = '#ffffff'; d.fillRect(0, 0, W, H); n.fillStyle = '#000'; n.fillRect(0, 0, W, H);
  let s = 12345; const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const x = c * cw + 9, y = r * rh + 12, w = cw - 18, h = rh - 24;
    const g = d.createLinearGradient(0, y, 0, y + h);
    const t = 58 + rnd() * 34;
    g.addColorStop(0, `rgb(${t + 40},${t + 58},${t + 80})`); g.addColorStop(1, `rgb(${t},${t + 10},${t + 22})`);
    d.fillStyle = g; d.fillRect(x, y, w, h);
    d.fillStyle = 'rgba(0,0,0,0.25)'; d.fillRect(x + w / 2 - 1, y, 2, h); // mullion
    d.fillStyle = 'rgba(0,0,0,0.12)'; d.fillRect(c * cw, r * rh + rh - 6, cw, 6); // floor slab shadow
    if (rnd() < 0.38) {
      const warm = rnd();
      n.fillStyle = warm < 0.7 ? `rgb(255,${190 + rnd() * 40 | 0},${110 + rnd() * 50 | 0})` : `rgb(${190 + rnd() * 40 | 0},${220 + rnd() * 30 | 0},255)`;
      n.fillRect(x, y, w, h);
    }
  }
  const mk = (cv) => { const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); return t; };
  return { map: mk(day), emissiveMap: mk(nite) };
}
