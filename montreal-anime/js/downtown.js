// downtown.js — Montréal beyond the Plateau: the downtown skyline (south-west, where it really is),
// the Olympic Stadium and its leaning tower (east), Old Montréal's Notre-Dame Basilica, Habitat 67,
// the St. Lawrence with the Jacques-Cartier Bridge and the Biosphère. Stylised to match the toon city,
// built into big merged chunks (one shader, a handful of draw calls) with walkable roofs.
import * as THREE from 'three';
import { h, rng, pick, lin, nsX, ewZ, nsHW, ewHW, U } from './layout.js';
import { batchMaterial, gradient, LAYER_FX } from './toon.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
const mergeGeo = (list) => mergeGeometries(list.map((g) => { const n = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(n.attributes)) if (k !== 'position' && k !== 'normal') n.deleteAttribute(k); return n; }));
import { Batch, cityArea } from './world.js';

import { DOWNTOWN, RIVER_Z, WATER_Y } from './layout.js';

export function buildDowntown(scene, world) {
  const B = new Batch(200), C = world.colliders, glows = world.glows, R = rng(1642);
  const L = lin;
  const box = (x0, x1, y0, y1, z0, z1, col, kind = 0, solid = true) => {
    B.box(x0, x1, y0, y1, z0, z1, L(col), kind);
    if (solid) C.add({ x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1), y0, y1 });
  };
  const geo = (g, m, col, kind = 0) => B.geo(g, m, L(col), kind);
  const M = (x, y, z, ry = 0, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new THREE.Vector3(sx, sy, sz));
  const beacons = [];
  const antenna = (x, y, z, hgt) => { box(x - 0.35, x + 0.35, y, y + hgt, z - 0.35, z + 0.35, '#9aa3ad', 10, false); glows.add(x, y + hgt + 0.6, z, 1, 0.15, 0.1, 3.2); beacons.push([x, y + hgt + 0.6, z]); };

  // ---------------------------------------------------------------- a generic downtown tower
  // podium with shop fronts, a shaft (glass curtain wall or stone), optional setbacks, a mechanical crown
  function tower(cx, cz, w, d, H, o = {}) {
    const g0 = Math.min(h(cz - d / 2), h(cz + d / 2)) - 1.2, top = h(cz) + H;
    const glass = o.glass ?? R() < 0.7, tint = o.tint || (glass ? pick(['#6f8fae', '#7f9bb4', '#5f7f99', '#8aa3b8', '#4f6f86', '#90a4ae'], R) : pick(['#cfc6b6', '#b9b0a2', '#d8d2c6', '#a59a8a'], R));
    const pw = w + (o.podium ?? 8), pd = d + (o.podium ?? 8), ph = h(cz) + (o.podiumH ?? 14);
    box(cx - pw / 2, cx + pw / 2, g0, ph, cz - pd / 2, cz + pd / 2, o.podiumCol || '#bfb6a6', 12);
    // shop fronts at street level (slightly proud of the podium)
    for (const [ax, sx] of [['x', -1], ['x', 1], ['z', -1], ['z', 1]]) {
      if (ax === 'x') B.box(cx + sx * pw / 2, cx + sx * (pw / 2 + 0.08), g0 + 0.3, h(cz) + 4.6, cz - pd / 2 + 2, cz + pd / 2 - 2, L('#7aa0b4'), 8);
      else B.box(cx - pw / 2 + 2, cx + pw / 2 - 2, g0 + 0.3, h(cz) + 4.6, cz + sx * pd / 2, cz + sx * (pd / 2 + 0.08), L('#7aa0b4'), 8);
    }
    B.box(cx - pw / 2 - 0.4, cx + pw / 2 + 0.4, h(cz) + 4.6, h(cz) + 5.3, cz - pd / 2 - 0.4, cz + pd / 2 + 0.4, L('#3d3a4f'), 0);   // canopy band
    // shaft with setbacks
    let y = ph, sw = w, sd = d;
    const steps = o.setbacks ?? (H > 110 ? 2 : H > 70 ? 1 : 0);
    for (let s = 0; s <= steps; s++) {
      const y1 = s === steps ? top : y + (top - ph) * (s === 0 ? 0.55 : 0.25);
      box(cx - sw / 2, cx + sw / 2, y, y1, cz - sd / 2, cz + sd / 2, tint, glass ? 11 : 12);
      if (s < steps) { box(cx - sw / 2 - 0.5, cx + sw / 2 + 0.5, y1 - 0.2, y1 + 0.6, cz - sd / 2 - 0.5, cz + sd / 2 + 0.5, '#e8e4dc', 0, false); sw *= 0.8; sd *= 0.8; }
      y = y1;
    }
    if (o.crown !== false) {
      box(cx - sw * 0.3, cx + sw * 0.3, top, top + 5, cz - sd * 0.3, cz + sd * 0.3, '#8d939b', 10);
      box(cx - sw / 2 - 0.15, cx + sw / 2 + 0.15, top, top + 1.1, cz - sd / 2 - 0.15, cz - sd / 2 + 0.35, '#d9dde2', 0, false);
      if (H > 100) antenna(cx + sw * 0.15, top + 5, cz, 8 + R() * 14);
    }
    return { top, sw, sd };
  }

  // ---------------------------------------------------------------- the street grid: towers in each block
  const blocks = [];
  for (let k = -8; k <= -2; k++) for (let m = 6; m <= 9; m++) {
    const x0 = nsX(k) + nsHW(k) + 4, x1 = nsX(k + 1) - nsHW(k + 1) - 4, z0 = ewZ(m) + ewHW(m) + 4, z1 = ewZ(m + 1) - ewHW(m + 1) - 4;
    if (x1 < DOWNTOWN.x0 || x0 > DOWNTOWN.x1 || z0 < DOWNTOWN.z0 || z1 > DOWNTOWN.z1) continue;
    blocks.push({ k, m, x0, x1, z0, z1, cx: (x0 + x1) / 2, cz: (z0 + z1) / 2 });
  }
  // paved blocks (raised like sidewalks, following the slope) so downtown reads as city, not fields
  for (const b of blocks) {
    const x0 = b.x0 - 3.5, x1 = b.x1 + 3.5, z0 = b.z0 - 3.5, z1 = b.z1 + 3.5, off = 0.15, col = L('#cfcac0');
    const P = (x, z) => [x, h(z) + off, z];
    B.quad(P(x0, z0), P(x1, z0), P(x1, z1), P(x0, z1), [0, 1, 0], col, 0);
    B.quad([x0, h(z0) - 0.4, z0], [x1, h(z0) - 0.4, z0], P(x1, z0), P(x0, z0), [0, 0, -1], L('#a9a49a'), 0);
    B.quad([x0, h(z1) - 0.4, z1], [x1, h(z1) - 0.4, z1], P(x1, z1), P(x0, z1), [0, 0, 1], L('#a9a49a'), 0);
    B.quad([x0, h(z0) - 0.4, z0], [x0, h(z1) - 0.4, z1], P(x0, z1), P(x0, z0), [-1, 0, 0], L('#a9a49a'), 0);
    B.quad([x1, h(z0) - 0.4, z0], [x1, h(z1) - 0.4, z1], P(x1, z1), P(x1, z0), [1, 0, 0], L('#a9a49a'), 0);
    C.add({ x0, x1, z0, z1, y0: h(z1) - 1, t: 'h', off });
    // street trees along the block edges
    for (let x = x0 + 6; x < x1 - 4; x += 14) for (const z of [z0 + 1.6, z1 - 1.6]) world.extraTrees?.push([x, z]);
  }
  const LANDMARK = new Set(['-4,7', '-5,8', '-6,7', '-3,6', '-3,9', '-7,6']);
  // height falls off from the centre of downtown (Place Ville Marie) like the real skyline
  const centre = { x: -320, z: 780 };
  for (const b of blocks) {
    if (LANDMARK.has(b.k + ',' + b.m)) continue;
    const dist = Math.hypot(b.cx - centre.x, b.cz - centre.z), tall = Math.max(0.15, 1 - dist / 520);
    const n = R() < 0.5 ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const w = n === 2 ? (b.x1 - b.x0) * 0.36 : (b.x1 - b.x0) * (0.42 + R() * 0.2), d = (b.z1 - b.z0) * (0.38 + R() * 0.25);
      const cx = n === 2 ? (i ? b.x1 - w / 2 - 6 : b.x0 + w / 2 + 6) : b.cx + (R() - 0.5) * 10, cz = b.cz + (R() - 0.5) * 16;
      tower(cx, cz, w, d, 35 + tall * (60 + R() * 110), { podium: 6, podiumH: 10 + R() * 8 });
    }
  }
  const at = (k, m) => blocks.find((b) => b.k === k && b.m === m) || { cx: nsX(k) + 45, cz: ewZ(m) + 55 };

  // Place Ville Marie — the cruciform aluminium tower with its rotating beacon (188 m)
  { const b = at(-4, 7), top = h(b.cz) + 188, g0 = h(b.cz + 30) - 1.5;
    box(b.cx - 46, b.cx + 46, g0, h(b.cz) + 6, b.cz - 46, b.cz + 46, '#d8d4cc', 12);          // the plaza podium
    box(b.cx - 36, b.cx + 36, h(b.cz) + 6, top, b.cz - 10, b.cz + 10, '#a9b4bf', 11);
    box(b.cx - 10, b.cx + 10, h(b.cz) + 6, top, b.cz - 36, b.cz + 36, '#a9b4bf', 11);
    for (const [sx, sz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {   // the notched points of the cross
      const x = b.cx + sx * 38, z = b.cz + sz * 38;
      box(x - (sz ? 7 : 2.5), x + (sz ? 7 : 2.5), h(b.cz) + 6, top - 4, z - (sx ? 7 : 2.5), z + (sx ? 7 : 2.5), '#a9b4bf', 11);
    }
    box(b.cx - 12, b.cx + 12, top, top + 6, b.cz - 12, b.cz + 12, '#8d939b', 10);
    world.pvmBeacon = new THREE.Vector3(b.cx, top + 7, b.cz);
  }
  // 1000 de La Gauchetière — stone tower with the copper pyramid (205 m)
  { const b = at(-5, 8), top = h(b.cz) + 172;
    tower(b.cx, b.cz, 44, 44, 172, { glass: false, tint: '#d6c7a8', setbacks: 1, crown: false, podium: 14 });
    const pyr = new THREE.ConeGeometry(24, 30, 4, 1).rotateY(Math.PI / 4);
    geo(pyr, M(b.cx, top + 15, b.cz, 0, 1, 1, 1), '#6fa58f', 0);
    C.add({ x0: b.cx - 14, x1: b.cx + 14, z0: b.cz - 14, z1: b.cz + 14, y0: top, y1: top + 14 });
    antenna(b.cx, top + 30, b.cz, 6);
  }
  // 1250 René-Lévesque — glass with a notched, stepped crown (199 m)
  { const b = at(-6, 7);
    const t = tower(b.cx, b.cz, 40, 30, 168, { tint: '#9fb6c6', setbacks: 0, crown: false, podium: 10 });
    box(b.cx - 20, b.cx + 6, t.top, t.top + 18, b.cz - 15, b.cz + 15, '#9fb6c6', 11);
    box(b.cx - 20, b.cx - 6, t.top + 18, t.top + 31, b.cz - 15, b.cz + 15, '#9fb6c6', 11);
    antenna(b.cx - 13, t.top + 31, b.cz, 5);
  }
  // Tour CIBC — dark green glass (187 m)
  { const b = at(-3, 6); tower(b.cx, b.cz, 30, 44, 187, { tint: '#3f6f62', setbacks: 0, podium: 12 }); }
  // Tour de la Bourse — dark bronze with its three mechanical bands (190 m)
  { const b = at(-3, 9), H = 190; const t = tower(b.cx, b.cz, 40, 40, H, { tint: '#4a4036', setbacks: 0, podium: 12 });
    for (const f of [0.33, 0.66]) { const y = h(b.cz) + H * f; box(b.cx - 21, b.cx + 21, y, y + 4, b.cz - 21, b.cz + 21, '#2f2a24', 10, false); }
  }

  // ---------------------------------------------------------------- Olympic Stadium + the Montréal Tower (east)
  { const sx = 780, sz = -80, gy = h(sz) - 2, Rx = 112, Rz = 88;
    const prof = [[52, 0], [62, 6], [92, 22], [112, 30], [116, 36], [108, 44], [90, 47], [70, 46], [56, 41]].map(([r, y]) => new THREE.Vector2(r, y));
    const bowl = new THREE.LatheGeometry(prof, 64); bowl.scale(Rx / 112, 1, Rz / 112);
    geo(bowl, M(sx, gy, sz), '#ece8df', 0);
    for (let i = 0; i < 34; i++) {   // the cantilevered concrete ribs
      const a = i / 34 * Math.PI * 2, x = sx + Math.cos(a) * Rx * 1.02, z = sz + Math.sin(a) * Rz * 1.02;
      geo(new THREE.BoxGeometry(3, 38, 10), M(x, gy + 22, z, -a + Math.PI / 2, 1, 1, 1, 0.32), '#f4f1ea', 0);
    }
    const roof = new THREE.SphereGeometry(70, 48, 12, 0, Math.PI * 2, 0, 0.42); roof.scale(Rx / 112, 0.3, Rz / 112);
    geo(roof, M(sx, gy + 30, sz), '#c9cfd6', 10);
    C.add({ x0: sx - Rx * 0.8, x1: sx + Rx * 0.8, z0: sz - Rz * 0.8, z1: sz + Rz * 0.8, y0: gy, y1: gy + 46 });
    // the inclined tower: 45°, leaning over the stadium, observatory on top
    const tx = sx + Rx + 20, len = 165, lean = Math.PI / 4.4;
    const shaft = new THREE.CylinderGeometry(6, 14, len, 4, 1).rotateY(Math.PI / 4).translate(0, len / 2, 0);
    geo(shaft, M(tx, gy, sz, -Math.PI / 2, 1, 1, 1, 0, lean), '#ece8df', 0);
    const topX = tx - Math.sin(lean) * len, topY = gy + Math.cos(lean) * len;
    geo(new THREE.BoxGeometry(26, 10, 18), M(topX, topY - 2, sz, 0, 1, 1, 1, 0, lean * 0.15), '#3f4e5f', 6);
    for (let i = 0; i < 6; i++) { const z = sz + (i - 2.5) * 6, mx = (topX + sx) / 2, my = (topY + gy + 46) / 2, l = Math.hypot(topX - sx + 40, topY - gy - 46); geo(new THREE.CylinderGeometry(0.25, 0.25, l, 4), M(mx + 20, my, z, 0, 1, 1, 1, 0, Math.atan2(topX - sx + 40, topY - gy - 46)), '#5a6470', 10); }
    C.add({ x0: tx - 14, x1: tx + 14, z0: sz - 14, z1: sz + 14, y0: gy, y1: gy + 30, nowalk: true });
    glows.add(topX, topY + 6, sz, 1, 0.15, 0.1, 3.5); beacons.push([topX, topY + 6, sz]);
  }

  // ---------------------------------------------------------------- Old Montréal: Notre-Dame Basilica
  { const bx = -380, bz = 1205, gy = h(bz) - 0.5, stone = '#b9a888';
    box(bx - 18, bx + 18, gy, gy + 26, bz - 70, bz - 6, stone, 2);                                       // nave
    geo(new THREE.CylinderGeometry(0.01, 26, 14, 4, 1).rotateY(Math.PI / 4).scale(0.98, 1, 2.4), M(bx, gy + 33, bz - 38), '#4f7a6a', 0);   // copper roof
    for (const s of [-1, 1]) {   // the twin towers
      const x = bx + s * 13;
      box(x - 7, x + 7, gy, gy + 62, bz - 8, bz + 6, stone, 2);
      for (const yy of [20, 36, 52]) box(x - 7.3, x + 7.3, gy + yy, gy + yy + 0.8, bz - 8.3, bz + 6.3, '#d8ccb4', 0, false);
      geo(new THREE.ConeGeometry(6.2, 14, 4).rotateY(Math.PI / 4), M(x, gy + 69, bz - 1), '#4f7a6a', 0);
      for (const dz of [-5, 3]) for (const dx of [-5, 5]) geo(new THREE.ConeGeometry(0.9, 6, 6), M(x + dx, gy + 65, bz + dz), stone, 2);
    }
    box(bx - 6, bx + 6, gy, gy + 44, bz - 8, bz + 5.5, stone, 2);
    geo(new THREE.ConeGeometry(8, 10, 3).rotateY(Math.PI / 2).rotateX(0).scale(1.1, 1, 0.3), M(bx, gy + 47, bz + 4.8), stone, 2);   // gable
    for (const dx of [-8, 0, 8]) { box(bx + dx - 2.4, bx + dx + 2.4, gy, gy + 9, bz + 6, bz + 6.3, '#3a2f2a', 0, false); geo(new THREE.CylinderGeometry(2.4, 2.4, 0.3, 12, 1, false, 0, Math.PI).rotateX(Math.PI / 2).rotateZ(Math.PI / 2 * 0), M(bx + dx, gy + 9, bz + 6.15, 0, 1, 1, 1, 0, -Math.PI / 2), '#3a2f2a', 0); }
    // a few greystone buildings of the old town around it
    for (let i = 0; i < 18; i++) { const x = -560 + (i % 6) * 34 + (i % 6 > 2 ? 60 : 0), z = 1150 + Math.floor(i / 6) * 34; if (Math.abs(x - bx) < 40 && Math.abs(z - bz) < 80) continue; const hh = 12 + R() * 10; box(x - 13, x + 13, h(z) - 1, h(z) + hh, z - 12, z + 12, pick(['#b9b0a2', '#a59a8a', '#c8bfae'], R), 2); }
  }

  // ---------------------------------------------------------------- Habitat 67 on its peninsula
  { const hx = -60, hz = RIVER_Z + 40, gy = WATER_Y + 1.5;
    box(hx - 160, hx + 160, WATER_Y - 6, gy, hz - 30, hz + 30, '#9fbf86', 0);          // the Cité-du-Havre strip
    const modR = rng(67);
    for (let c = 0; c < 3; c++) for (let lv = 0; lv < 9; lv++) for (let i = 0; i < 9 - lv; i++) {
      if (modR() < 0.3) continue;
      const x = hx - 70 + c * 70 + (i - (9 - lv) / 2) * 8 + (modR() - 0.5) * 3, z = hz + (modR() - 0.5) * 18, y = gy + lv * 3.4;
      const rot = modR() < 0.5 ? 0 : Math.PI / 2;
      geo(new THREE.BoxGeometry(11.7, 3.3, 5.3), M(x, y + 1.65, z, rot), '#d6cfc2', 12);
    }
    C.add({ x0: hx - 105, x1: hx + 105, z0: hz - 10, z1: hz + 10, y0: gy, y1: gy + 26 });
  }

  // ---------------------------------------------------------------- the St. Lawrence, Jacques-Cartier Bridge, the Biosphère
  const water = new THREE.Mesh(new THREE.PlaneGeometry(4400, 1400, 1, 1).rotateX(-Math.PI / 2), waterMaterial());
  water.position.set(0, WATER_Y, RIVER_Z + 700); water.receiveShadow = true; scene.add(water);
  { // island (Île Sainte-Hélène) with the Biosphère
    const ix = 560, iz = 1620, gy = WATER_Y + 2;
    geo(new THREE.CylinderGeometry(230, 260, 10, 48).scale(1, 1, 0.75), M(ix, gy - 5, iz), '#8fbf74', 0);
    // geodesic dome: every edge of a subdivided icosahedron becomes a thin strut
    const ico = new THREE.IcosahedronGeometry(38, 3), edges = new THREE.EdgesGeometry(ico, 1).attributes.position, a = new THREE.Vector3(), b = new THREE.Vector3(), d = new THREE.Vector3();
    const strut = new THREE.CylinderGeometry(0.22, 0.22, 1, 4);
    for (let i = 0; i < edges.count; i += 2) {
      a.fromBufferAttribute(edges, i); b.fromBufferAttribute(edges, i + 1);
      if (a.y < -14 && b.y < -14) continue;
      d.subVectors(b, a); const l = d.length(); const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
      B.geo(strut, new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5).add(new THREE.Vector3(ix, gy + 14, iz)), q, new THREE.Vector3(1, l, 1)), L('#dfe4ea'), 10);
    }
    const shell = new THREE.Mesh(new THREE.SphereGeometry(37.6, 40, 24, 0, Math.PI * 2, 0, 1.95), new THREE.MeshToonMaterial({ color: 0x9fd0ee, transparent: true, opacity: 0.22, depthWrite: false, gradientMap: gradient }));
    shell.position.set(ix, gy + 14, iz); shell.layers.set(LAYER_FX); scene.add(shell);
    C.add({ x0: ix - 26, x1: ix + 26, z0: iz - 26, z1: iz + 26, y0: gy, y1: gy + 50, nowalk: true });
  }
  { // Jacques-Cartier Bridge: deck on piers and the green steel cantilever trusses
    const A = new THREE.Vector3(240, h(RIVER_Z - 20) + 22, RIVER_Z - 20), Bn = new THREE.Vector3(780, WATER_Y + 36, 2050);
    const dir = new THREE.Vector3().subVectors(Bn, A), len = dir.length(), yaw = Math.atan2(dir.x, dir.z);
    const along = (t) => A.clone().lerp(Bn, t), side = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    const steel = '#4f7a6a';
    const seg = 40, deckW = 20;
    for (let i = 0; i < seg; i++) {
      const p0 = along(i / seg), p1 = along((i + 1) / seg), mid = p0.clone().add(p1).multiplyScalar(0.5), l = p0.distanceTo(p1);
      const pitch = -Math.atan2(p1.y - p0.y, Math.hypot(p1.x - p0.x, p1.z - p0.z));
      geo(new THREE.BoxGeometry(deckW, 1.6, l + 0.2), M(mid.x, mid.y, mid.z, yaw, 1, 1, 1, pitch), '#8d939b', 0);
      if (i % 4 === 0) geo(new THREE.BoxGeometry(6, mid.y - WATER_Y + 4, 8), M(mid.x, (mid.y + WATER_Y) / 2 - 2, mid.z, yaw), '#b9b0a2', 2);   // piers
      // trusses: an arch over the main span, verticals and diagonals
      const tt = i / seg, arch = Math.max(0, Math.sin(Math.min(1, Math.max(0, (tt - 0.35) / 0.4)) * Math.PI)) * 34 + 9;
      for (const s of [-1, 1]) {
        const o = side.clone().multiplyScalar(s * deckW / 2);
        const top = mid.clone().add(o).setY(mid.y + arch);
        geo(new THREE.BoxGeometry(0.9, arch, 0.9), M(mid.x + o.x, mid.y + arch / 2, mid.z + o.z, yaw), steel, 10);
        geo(new THREE.BoxGeometry(0.9, 0.9, l + 0.4), M(top.x, top.y, top.z, yaw, 1, 1, 1, pitch), steel, 10);
        geo(new THREE.BoxGeometry(0.5, Math.hypot(arch, l), 0.5), M(mid.x + o.x, mid.y + arch / 2, mid.z + o.z, yaw, 1, 1, 1, Math.atan2(l, arch) * (i % 2 ? 1 : -1)), steel, 10);
      }
    }
  }

  // Sun Life Building — the white granite giant on Dorchester Square, colonnades and a stepped crown
  { const b = at(-7, 6), x = b.cx, z = b.cz, g0 = h(z + 30) - 1.2, base = h(z), stone = '#e6e1d6';
    box(x - 34, x + 34, g0, base + 52, z - 30, z + 30, stone, 12);
    box(x - 26, x + 26, base + 52, base + 78, z - 22, z + 22, stone, 12);
    box(x - 16, x + 16, base + 78, base + 96, z - 13, z + 13, stone, 12);
    box(x - 35, x + 35, base + 51, base + 53, z - 31, z + 31, '#cfc8bb', 0, false);
    for (let i = -6; i <= 6; i++) for (const s of [-1, 1]) {   // colonnades on the east and west faces
      geo(new THREE.CylinderGeometry(0.9, 1.0, 14, 12), M(x + s * 34.9, base + 24, z + i * 4.4), stone, 0);
      geo(new THREE.CylinderGeometry(0.9, 1.0, 14, 12), M(x + i * 5, base + 24, z + s * 30.9), stone, 0);
    }
    box(x - 36, x + 36, base + 31, base + 33, z - 32, z + 32, '#d6d0c4', 0, false);
    geo(new THREE.ConeGeometry(11, 7, 4).rotateY(Math.PI / 4), M(x, base + 99.5, z), '#7f8a86', 0);
  }

  // Chinatown gates (paifang) on Saint-Laurent
  for (const gz of [640, 905]) {
    const gx = nsX(-2), y = h(gz), red = '#c8312a', jade = '#2f7a5a', gold = '#e8b84a', span = 12;
    for (const s of [-1, 1]) { box(gx + s * span / 2 - 0.6, gx + s * span / 2 + 0.6, y, y + 8.5, gz - 0.6, gz + 0.6, red, 0); box(gx + s * span / 2 - 1, gx + s * span / 2 + 1, y, y + 0.8, gz - 1, gz + 1, '#b9b0a2', 2); }
    for (const [yy, w2] of [[8.5, span + 4], [10.8, span - 1]]) {
      box(gx - w2 / 2, gx + w2 / 2, y + yy, y + yy + 0.9, gz - 0.7, gz + 0.7, red, 0, false);
      geo(new THREE.CylinderGeometry(0.01, 1, 1, 4, 1).rotateY(Math.PI / 4).scale(w2 / 1.3, 1.4, 2.6), M(gx, y + yy + 1.6, gz), jade, 0);
    }
    box(gx - 2.6, gx + 2.6, y + 9.4, y + 10.6, gz - 0.75, gz + 0.75, gold, 0, false);
    C.add({ x0: gx - 9, x1: gx + 9, z0: gz - 1.3, z1: gz + 1.3, y0: y + 8.4, y1: y + 12.4 });
  }

  // Old Port: the Clock Tower and La Grande roue (it turns)
  const wheelG = new THREE.Group();
  { const cx = 60, cz = RIVER_Z - 14, y = h(cz), stone = '#d8cfbf';
    box(cx - 4, cx + 4, y - 1, y + 38, cz - 4, cz + 4, stone, 2);
    box(cx - 4.6, cx + 4.6, y + 30, y + 31, cz - 4.6, cz + 4.6, '#c4b9a6', 0, false);
    geo(new THREE.ConeGeometry(4.6, 9, 4).rotateY(Math.PI / 4), M(cx, y + 42.5, cz), '#6f8a86', 0);
    for (const [dx, dz, ry] of [[0, 4.05, 0], [0, -4.05, Math.PI], [4.05, 0, Math.PI / 2], [-4.05, 0, -Math.PI / 2]]) {
      geo(new THREE.CylinderGeometry(2.2, 2.2, 0.2, 24).rotateX(Math.PI / 2), M(cx + dx, y + 34, cz + dz, ry), '#f4efe6', 6);
      geo(new THREE.BoxGeometry(0.18, 1.7, 0.1), M(cx + dx * 1.03, y + 34.6, cz + dz * 1.03, ry, 1, 1, 1, 0, 0.2), '#2b2550', 0);
      geo(new THREE.BoxGeometry(0.15, 1.2, 0.1), M(cx + dx * 1.03, y + 34.3, cz + dz * 1.03, ry, 1, 1, 1, 0, 1.7), '#2b2550', 0);
    }
    // the wheel: A-frame legs in the batch, the rim with its 42 gondolas as a turning group
    const wx = -140, wz = RIVER_Z - 22, wy = h(wz) + 33, R = 27;
    for (const s of [-1, 1]) for (const sz of [-1, 1]) geo(new THREE.BoxGeometry(1.2, 36, 1.2), M(wx + s * 9, wy - 16, wz + sz * 3, 0, 1, 1, 1, sz * -0.12, s * 0.28), '#e8ecf0', 10);
    wheelG.position.set(wx, wy, wz); scene.add(wheelG);
    const white = new THREE.MeshToonMaterial({ color: 0xf2f4f6, gradientMap: gradient }), parts = [];
    for (const zz of [-1.6, 1.6]) parts.push(new THREE.TorusGeometry(R, 0.45, 8, 96).translate(0, 0, zz));
    for (let i = 0; i < 21; i++) { const a = i / 21 * Math.PI; parts.push(new THREE.BoxGeometry(0.3, R * 2, 0.3).rotateZ(a)); }
    parts.push(new THREE.CylinderGeometry(1.4, 1.4, 4.5, 16).rotateX(Math.PI / 2));
    const rim = new THREE.Mesh(mergeGeo(parts), white); rim.castShadow = true; wheelG.add(rim);
    const gond = new THREE.InstancedMesh(new THREE.BoxGeometry(2.4, 2.6, 2.4), new THREE.MeshToonMaterial({ color: 0x9fd6f2, emissive: 0x5aa0d0, emissiveIntensity: 0.15, gradientMap: gradient }), 42);
    gond.castShadow = true; gond.frustumCulled = false; scene.add(gond);
    world.ferris = { g: wheelG, gond, R, n: 42 };
    C.add({ x0: wx - 12, x1: wx + 12, z0: wz - 4, z1: wz + 4, y0: h(wz), y1: h(wz) + 4 });
  }

  // Saint Joseph's Oratory on the mountain's west slope: the great dome over its stone basilica
  { const ox = -880, oz = -340, gy = h(oz) + 18, stone = '#cdc3b0';
    box(ox - 60, ox + 60, h(oz) - 2, gy, oz - 50, oz + 70, '#8fbf74', 0);                     // the hill terrace
    for (let i = 0; i < 6; i++) box(ox - 20 + i, ox + 20 - i, gy, gy + 0.6 * (i + 1), oz + 46 - i * 2.4, oz + 50 - i * 2.4, '#c8bfae', 2, false);   // the great stairs
    box(ox - 26, ox + 26, gy, gy + 30, oz - 36, oz + 34, stone, 2);
    for (let i = -4; i <= 4; i++) geo(new THREE.CylinderGeometry(1.1, 1.2, 20, 12), M(ox + i * 5.2, gy + 10, oz + 35), stone, 2);
    geo(new THREE.ConeGeometry(30, 10, 4).rotateY(Math.PI / 4).scale(1, 1, 0.3), M(ox, gy + 35, oz + 34), stone, 2);
    geo(new THREE.CylinderGeometry(19, 19, 18, 40), M(ox, gy + 39, oz - 2), stone, 2);
    for (let i = 0; i < 20; i++) { const a = i / 20 * Math.PI * 2; geo(new THREE.CylinderGeometry(0.8, 0.8, 14, 8), M(ox + Math.cos(a) * 19.6, gy + 38, oz - 2 + Math.sin(a) * 19.6), '#e2dacb', 2); }
    geo(new THREE.SphereGeometry(19, 40, 16, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 1.25, 1), M(ox, gy + 48, oz - 2), '#5f8f7e', 0);
    geo(new THREE.CylinderGeometry(3, 3.6, 8, 16), M(ox, gy + 75, oz - 2), stone, 2);
    box(ox - 0.4, ox + 0.4, gy + 79, gy + 86, oz - 2.4, oz - 1.6, '#e8d9a6', 7, false); box(ox - 2, ox + 2, gy + 83, gy + 84, oz - 2.4, oz - 1.6, '#e8d9a6', 7, false);
    C.add({ x0: ox - 26, x1: ox + 26, z0: oz - 36, z1: oz + 34, y0: gy, y1: gy + 30 });
  }

  // the Village: Sainte-Catherine under its canopy of pink balls (thousands of them, strung across the street)
  { const sz = ewZ(5), x0 = 110, x1 = 470, n = 2600, R = rng(18);
    const balls = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 2), new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: gradient }), n);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3(), col = new THREE.Color();
    const pinks = ['#ff6fa8', '#ff8cc0', '#ff4f93', '#ffa3cc', '#f26cb0'];
    for (let i = 0; i < n; i++) {
      const x = x0 + R() * (x1 - x0), z = sz + (R() - 0.5) * 9, r = 0.12 + R() * 0.2;
      const sag = Math.sin(((z - sz) / 9 + 0.5) * Math.PI);   // strings sag across the street
      balls.setMatrixAt(i, m4.compose(v.set(x, h(z) + 7.6 - sag * 0.9 + R() * 0.5, z), q, s.set(r, r, r))); balls.setColorAt(i, col.set(pinks[i % pinks.length]));
    }
    balls.computeBoundingSphere(); balls.castShadow = true; scene.add(balls);
  }

  // fire hydrants on the street corners (Montréal red with a yellow bonnet)
  { const col = (geo, hex) => { const n = geo.index ? geo.toNonIndexed() : geo; for (const k of Object.keys(n.attributes)) if (k !== 'position' && k !== 'normal') n.deleteAttribute(k); const c = new THREE.Color(hex), arr = new Float32Array(n.attributes.position.count * 3); for (let i = 0; i < arr.length; i += 3) arr.set([c.r, c.g, c.b], i); n.setAttribute('color', new THREE.BufferAttribute(arr, 3)); return n; };
    const hg = mergeGeometries([col(new THREE.CylinderGeometry(0.16, 0.19, 0.62, 12).translate(0, 0.31, 0), '#c8312a'), col(new THREE.SphereGeometry(0.17, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 0.62, 0), '#f2c12e'), col(new THREE.CylinderGeometry(0.06, 0.06, 0.42, 8).rotateZ(Math.PI / 2).translate(0, 0.42, 0), '#c8312a'), col(new THREE.CylinderGeometry(0.07, 0.07, 0.12, 8).rotateX(Math.PI / 2).translate(0, 0.4, 0.17), '#f2c12e'), col(new THREE.CylinderGeometry(0.23, 0.23, 0.05, 12).translate(0, 0.02, 0), '#7a1f1a')]);
    const spots = [];
    for (let k = -9; k <= 9; k++) for (let m = -5; m <= 9; m++) {
      const sx = R() < 0.5 ? -1 : 1, sz = R() < 0.5 ? -1 : 1, x = nsX(k) + sx * (nsHW(k) + 1.1), z = ewZ(m) + sz * (ewHW(m) + 3.2);
      if (!cityArea(x, z) && !(x > DOWNTOWN.x0 && x < DOWNTOWN.x1 && z > DOWNTOWN.z0 && z < DOWNTOWN.z1)) continue;
      spots.push([x, C.ground(x, z, h(z) + 1, 0), z]);
    }
    const im = new THREE.InstancedMesh(hg, new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: gradient }), spots.length), m4 = new THREE.Matrix4();
    spots.forEach(([x, y, z], i) => { im.setMatrixAt(i, m4.makeTranslation(x, y, z)); C.add({ x0: x - 0.2, x1: x + 0.2, z0: z - 0.2, z1: z + 0.2, y0: y, y1: y + 0.7, nowalk: true }); });
    im.castShadow = true; im.computeBoundingSphere(); scene.add(im);
  }

  const g = B.build(batchMaterial(), 'downtown'); scene.add(g);
  glows.commit();
  // the PVM searchlight: a sweeping additive beam
  const beam = new THREE.Mesh(new THREE.ConeGeometry(6, 140, 16, 1, true).translate(0, -70, 0).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xfff2c8, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  beam.layers.set(LAYER_FX); if (world.pvmBeacon) beam.position.copy(world.pvmBeacon); scene.add(beam);
  return {
    group: g, water, beacons,
    update(t, night) {
      beam.visible = night > 0.35; beam.rotation.y = t * 0.6; beam.rotation.x = -0.25;
      const F = world.ferris;
      if (F) {   // the Grande roue turns slowly; gondolas hang level
        const a0 = t * 0.05, m4 = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1);
        F.g.rotation.z = a0;
        for (let i = 0; i < F.n; i++) { const a = a0 + i / F.n * Math.PI * 2; p.set(F.g.position.x + Math.cos(a) * F.R, F.g.position.y + Math.sin(a) * F.R - 1.8, F.g.position.z); F.gond.setMatrixAt(i, m4.compose(p, q, s)); }
        F.gond.instanceMatrix.needsUpdate = true; F.gond.material.emissiveIntensity = 0.15 + night * 1.6;
      }
      water.material.uniforms.uTime.value = t;
    },
  };
}

function waterMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uNight: U.uNight, fogColor: { value: new THREE.Color() }, fogNear: { value: 1 }, fogFar: { value: 1000 } },
    fog: true,
    vertexShader: `varying vec3 vW; varying float vFogDepth; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vec4 mv = viewMatrix * w; vFogDepth = -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float uTime, uNight; uniform vec3 fogColor; uniform float fogNear, fogFar; varying vec3 vW; varying float vFogDepth;
float hh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(hh(i), hh(i+vec2(1,0)), f.x), mix(hh(i+vec2(0,1)), hh(i+vec2(1,1)), f.x), f.y); }
void main(){
  vec2 p = vW.xz * 0.05 + vec2(uTime * 0.05, uTime * 0.08);
  float w = n2(p) * 0.6 + n2(p * 2.7 - uTime * 0.1) * 0.4;
  vec3 day = mix(vec3(0.22, 0.46, 0.62), vec3(0.42, 0.68, 0.82), smoothstep(0.45, 0.75, w));
  vec3 c = mix(day, vec3(0.04, 0.07, 0.14), uNight * 0.9);
  c += smoothstep(0.78, 0.84, w) * vec3(0.9, 0.95, 1.0) * (0.5 - 0.3 * uNight);   // toon glints
  float f = smoothstep(fogNear, fogFar, vFogDepth);
  gl_FragColor = vec4(mix(c, fogColor, f), 1.0);
}`,
  });
}
