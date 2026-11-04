// cities.js — Toronto and Ottawa, built on the same street grid as Montréal (the ground shader already
// paints roads, crosswalks and lamp pools everywhere) but far away along the x axis, so each city is its
// own map: Toronto 3.6 km east, Ottawa 3.6 km west. Each city is one merged batch (a handful of draw
// calls), with walkable roofs and solid walls, a sidewalk-and-plaza pad on every block, street trees and
// lamps, landmarks, water you can splash into, traffic lanes, street names and a radar map.
import * as THREE from 'three';
import { h, rng, pick, lin, nsX, ewZ, nsHW, ewHW, nsSW, ewSW, CURB, REGIONS, WATERS, NAMES } from './layout.js';
import { batchMaterial, groundMaterial, gradient } from './toon.js';
import { Batch } from './world.js';
import { waterMaterial } from './downtown.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const CITIES = {
  montreal: { key: 'montreal', name: 'Montréal', tag: 'Plateau-Mont-Royal', spawn: [9, 112], yaw: 0, x0: -950, x1: 1150, station: [30, -175] },
  toronto: {
    key: 'toronto', name: 'Toronto', tag: 'Downtown Toronto', k0: 34, k1: 46, m0: -4, m1: 4, waterZ: 472, spawn: [3555, 38], yaw: Math.PI, station: [3645, 300],
    ns: ['Bathurst Street', 'Portland Street', 'Spadina Avenue', 'Peter Street', 'John Street', 'University Avenue', 'Bay Street', 'Yonge Street', 'Church Street', 'Jarvis Street', 'Sherbourne Street', 'Parliament Street', 'Cherry Street'],
    ew: ['Bloor Street', 'Wellesley Street', 'College Street', 'Gerrard Street', 'Dundas Street', 'Queen Street', 'King Street', 'Front Street', 'Lake Shore Blvd'],
  },
  ottawa: {
    key: 'ottawa', name: 'Ottawa', tag: 'Centretown, Ottawa', k0: -46, k1: -34, m0: -4, m1: 3, waterZ: 398, spawn: [-3600, 300], yaw: Math.PI, station: [-3395, 255],
    ns: ['Bronson Avenue', 'Bay Street', 'Lyon Street', 'Kent Street', 'Bank Street', "O'Connor Street", 'Metcalfe Street', 'Elgin Street', 'Waller Street', 'Cumberland Street', 'King Edward Avenue', 'Dalhousie Street', 'Nelson Street'],
    ew: ['Gladstone Avenue', 'Somerset Street', 'Nepean Street', 'Laurier Avenue', 'Slater Street', 'Queen Street', 'Sparks Street', 'Wellington Street'],
  },
};
export const cityAt = (x) => (x > 2500 ? CITIES.toronto : x < -2500 ? CITIES.ottawa : CITIES.montreal);

// street name tables for whereIs()
for (const c of [CITIES.toronto, CITIES.ottawa]) {
  c.ns.forEach((n, i) => { NAMES.ns[c.k0 + i] = n; });
  c.ew.forEach((n, i) => { NAMES.ew[c.key + ':' + (c.m0 + i)] = n; });
}

// city rectangle (edge of the first/last street plus a margin)
function rect(c) { return { x0: nsX(c.k0) - 30, x1: nsX(c.k1) + 30, z0: ewZ(c.m0) - 40, z1: c.waterZ }; }

export function buildCities(scene, world) {
  const out = {};
  for (const key of ['toronto', 'ottawa']) out[key] = buildCity(scene, world, CITIES[key]);
  world.glows.commit();
  return {
    cities: out,
    update(t, fog) { for (const c of Object.values(out)) for (const w of c.waters) { w.material.uniforms.uTime.value = t; if (fog) { w.material.uniforms.fogColor.value.copy(fog.color); w.material.uniforms.fogNear.value = fog.near; w.material.uniforms.fogFar.value = fog.far; } } },
  };
}

function buildCity(scene, world, def) {
  const B = new Batch(160), C = world.colliders, glows = world.glows, R = rng(def.key === 'toronto' ? 416 : 613), L = lin;
  const r = rect(def);
  REGIONS.walk.push({ x0: r.x0 - 20, x1: r.x1 + 20, z0: r.z0 - 20, z1: r.z1 + 400 });
  REGIONS.fly.push({ x0: r.x0 - 350, x1: r.x1 + 350, z0: r.z0 - 350, z1: r.z1 + 900 });
  WATERS.push({ x0: r.x0 - 400, x1: r.x1 + 400, z0: def.waterZ, z1: def.waterZ + 2000, y: h(def.waterZ) - 1.6, back: def.waterZ - 10 });

  const box = (x0, x1, y0, y1, z0, z1, col, kind = 0, solid = true, extra) => {
    B.box(x0, x1, y0, y1, z0, z1, L(col), kind);
    if (solid) C.add(Object.assign({ x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1), y0, y1 }, extra));
  };
  const M = (x, y, z, ry = 0, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new THREE.Vector3(sx, sy, sz));
  const geo = (g, m, col, kind = 0) => B.geo(g.index ? g.toNonIndexed() : g, m, L(col), kind);
  const solid = (x0, x1, z0, z1, y0, y1) => C.add({ x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1), y0, y1 });

  // ------------------------------------------------------------- ground + the lake/river
  const gw = r.x1 - r.x0 + 120, gz0 = r.z0 - 260, gz1 = def.waterZ + 6, gd = gz1 - gz0;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(gw, gd, 1, 48).rotateX(-Math.PI / 2), groundMaterial());
  ground.position.set((r.x0 + r.x1) / 2, 0, (gz0 + gz1) / 2);
  { const P = ground.geometry.attributes.position; for (let i = 0; i < P.count; i++) P.setY(i, h(P.getZ(i) + ground.position.z)); ground.geometry.computeVertexNormals(); }
  ground.receiveShadow = true; ground.updateMatrix(); ground.matrixAutoUpdate = false; scene.add(ground);
  const waters = [];
  const wy = h(def.waterZ) - 1.6;
  { const w = new THREE.Mesh(new THREE.PlaneGeometry(gw + 2400, 2600).rotateX(-Math.PI / 2), waterMaterial()); w.position.set((r.x0 + r.x1) / 2, wy, def.waterZ + 1300); scene.add(w); waters.push(w); }
  // a stone quay along the water's edge
  box(r.x0 - 60, r.x1 + 60, wy - 3, h(def.waterZ) + CURB, def.waterZ - 2, def.waterZ + 0.5, '#9d968a', 2);
  // the land beyond the city: low hills so the edges don't end in nothing
  for (const [x0, x1] of [[r.x0 - 260, r.x0 - 40], [r.x1 + 40, r.x1 + 260]]) box(x0, x1, h(r.z1) - 30, h(r.z0) + 4, r.z0 - 200, def.waterZ - 2, '#6f8f5a', 0, true);

  // ------------------------------------------------------------- blocks
  const blocks = [];
  for (let k = def.k0; k < def.k1; k++) for (let m = def.m0; m < def.m1; m++) {
    const x0 = nsX(k) + nsHW(k), x1 = nsX(k + 1) - nsHW(k + 1), z0 = ewZ(m) + ewHW(m), z1 = ewZ(m + 1) - ewHW(m + 1);
    blocks.push({ k, m, x0, x1, z0, z1, ix0: x0 + nsSW(k), ix1: x1 - nsSW(k + 1), iz0: z0 + ewSW(m), iz1: z1 - ewSW(m + 1), cx: (x0 + x1) / 2, cz: (z0 + z1) / 2 });
  }
  // the band between the last street and the water: a paved waterfront promenade
  { const m = def.m1, z0 = ewZ(m) + ewHW(m), z1 = def.waterZ - 2; blocks.push({ k: 999, m, x0: r.x0 + 20, x1: r.x1 - 20, z0, z1, ix0: r.x0 + 20, ix1: r.x1 - 20, iz0: z0 + 3, iz1: z1, cx: (r.x0 + r.x1) / 2, cz: (z0 + z1) / 2, front: true }); }
  const at = (k, m) => blocks.find((b) => b.k === k && b.m === m);
  const special = new Map();   // "k,m" -> 'park' | 'landmark'
  const pad = (b, col = '#cfcac0') => {
    const off = CURB, P = (x, z) => [x, h(z) + off, z], { x0, x1, z0, z1 } = b;
    B.quad(P(x0, z0), P(x1, z0), P(x1, z1), P(x0, z1), [0, 1, 0], L(col), 0);
    for (const [a, c, n] of [[[x0, z0], [x1, z0], [0, 0, -1]], [[x0, z1], [x1, z1], [0, 0, 1]], [[x0, z0], [x0, z1], [-1, 0, 0]], [[x1, z0], [x1, z1], [1, 0, 0]]])
      B.quad([a[0], h(a[1]) - 0.4, a[1]], [c[0], h(c[1]) - 0.4, c[1]], P(c[0], c[1]), P(a[0], a[1]), n, L('#a9a49a'), 0);
    C.add({ x0, x1, z0, z1, y0: h(z1) - 1, t: 'h', off });
  };
  const trees = [], lamps = [];
  const parkInside = (b, col = '#6fa25a') => {   // grass with paths, raised a touch above the paving
    const P = (x, z) => [x, h(z) + CURB + 0.03, z];
    B.quad(P(b.ix0, b.iz0), P(b.ix1, b.iz0), P(b.ix1, b.iz1), P(b.ix0, b.iz1), [0, 1, 0], L(col), 0);
    const Q = (x, z) => [x, h(z) + CURB + 0.05, z], cx = b.cx, cz = b.cz;
    B.quad(Q(cx - 1.6, b.iz0), Q(cx + 1.6, b.iz0), Q(cx + 1.6, b.iz1), Q(cx - 1.6, b.iz1), [0, 1, 0], L('#d8ccb2'), 0);
    B.quad(Q(b.ix0, cz - 1.6), Q(b.ix1, cz - 1.6), Q(b.ix1, cz + 1.6), Q(b.ix0, cz + 1.6), [0, 1, 0], L('#d8ccb2'), 0);
    for (let i = 0; i < 16; i++) { const x = b.ix0 + 4 + R() * (b.ix1 - b.ix0 - 8), z = b.iz0 + 4 + R() * (b.iz1 - b.iz0 - 8); if (Math.abs(x - cx) > 3 && Math.abs(z - cz) > 3) trees.push([x, z, 1 + R() * 0.5]); }
  };

  // ------------------------------------------------------------- building kit
  // podium + shaft (glass curtain wall or punched stone) + setbacks + crown
  function tower(cx, cz, w, d, H, o = {}) {
    const g0 = Math.min(h(cz - d / 2 - 6), h(cz + d / 2 + 6)) - 1.2, base = h(cz) + CURB, top = base + H;
    const glass = o.glass ?? R() < 0.7;
    const tint = o.tint || (glass ? pick(['#6f8fae', '#7f9bb4', '#5f7f99', '#8aa3b8', '#4f6f86', '#90a4ae', '#5d8a8f', '#7a8e9e'], R) : pick(['#cfc6b6', '#b9b0a2', '#d8d2c6', '#a59a8a', '#c4b49c'], R));
    let y = g0;
    if (o.podium !== 0) {
      const pw = w + (o.podium ?? 8), pd = d + (o.podium ?? 8), ph = base + (o.podiumH ?? 10 + R() * 6);
      box(cx - pw / 2, cx + pw / 2, g0, ph, cz - pd / 2, cz + pd / 2, o.podiumCol || pick(['#bfb6a6', '#a99f92', '#cfc8bc', '#8f8a84'], R), 12);
      for (const [ax, s] of [['x', -1], ['x', 1], ['z', -1], ['z', 1]]) {   // shop fronts
        if (ax === 'x') B.box(cx + s * pw / 2, cx + s * (pw / 2 + 0.08), base, base + 4.4, cz - pd / 2 + 2, cz + pd / 2 - 2, L('#7aa0b4'), 8);
        else B.box(cx - pw / 2 + 2, cx + pw / 2 - 2, base, base + 4.4, cz + s * pd / 2, cz + s * (pd / 2 + 0.08), L('#7aa0b4'), 8);
      }
      B.box(cx - pw / 2 - 0.4, cx + pw / 2 + 0.4, base + 4.4, base + 5.0, cz - pd / 2 - 0.4, cz + pd / 2 + 0.4, L('#3d3a4f'), 0);
      y = ph;
    }
    let sw = w, sd = d;
    const steps = o.setbacks ?? (H > 150 ? 2 : H > 80 ? 1 : 0);
    for (let s = 0; s <= steps; s++) {
      const y1 = s === steps ? top : y + (top - y) * (s === 0 ? 0.6 : 0.4);
      box(cx - sw / 2, cx + sw / 2, y, y1, cz - sd / 2, cz + sd / 2, tint, glass ? 11 : 12);
      if (s < steps) { box(cx - sw / 2 - 0.5, cx + sw / 2 + 0.5, y1 - 0.2, y1 + 0.6, cz - sd / 2 - 0.5, cz + sd / 2 + 0.5, '#e8e4dc', 0, false); sw *= 0.8; sd *= 0.8; }
      y = y1;
    }
    if (o.crown !== false) {
      box(cx - sw * 0.32, cx + sw * 0.32, top, top + 5, cz - sd * 0.32, cz + sd * 0.32, '#8d939b', 10);
      box(cx - sw / 2 - 0.15, cx + sw / 2 + 0.15, top, top + 1.2, cz - sd / 2 - 0.15, cz + sd / 2 + 0.15, '#d9dde2', 0, false);
      if (H > 140) { const ah = 10 + R() * 18; box(cx - 0.35, cx + 0.35, top + 5, top + 5 + ah, cz - 0.35, cz + 0.35, '#9aa3ad', 10, false); glows.add(cx, top + 5.6 + ah, cz, 1, 0.15, 0.1, 3.2); }
    }
    return { top, sw, sd };
  }
  // a continuous street wall of mid-rise buildings around the edge of a block (leaves the middle free)
  function streetWall(b, hMin, hMax, palette, depth = 13) {
    const edge = (along, a0, a1, fixed, out) => {
      let a = a0;
      while (a < a1 - 4) {
        const len = Math.min(a1 - a, 12 + R() * 18), hh = hMin + R() * (hMax - hMin), col = pick(palette, R), kind = R() < 0.75 ? 4 : 12;
        if (along === 'x') { const z0 = out < 0 ? fixed : fixed - depth, z1 = out < 0 ? fixed + depth : fixed, g0 = Math.min(h(z0), h(z1)) - 0.8; box(a, a + len, g0, h((z0 + z1) / 2) + CURB + hh, z0, z1, col, kind); B.box(a + 0.6, a + len - 0.6, h(fixed) + CURB, h(fixed) + CURB + 3.6, fixed + out * 0.08, fixed, L(R() < 0.5 ? '#7aa0b4' : '#c9a774'), 8); }
        else { const x0 = out < 0 ? fixed : fixed - depth, x1 = out < 0 ? fixed + depth : fixed, g0 = Math.min(h(a), h(a + len)) - 0.8; box(x0, x1, g0, h(a + len / 2) + CURB + hh, a, a + len, col, kind); }
        a += len;
      }
    };
    edge('x', b.ix0, b.ix1, b.iz0, -1); edge('x', b.ix0, b.ix1, b.iz1, 1);
    edge('z', b.iz0 + depth, b.iz1 - depth, b.ix0, -1); edge('z', b.iz0 + depth, b.iz1 - depth, b.ix1, 1);
  }
  const BRICK = ['#a65a45', '#b9735a', '#8f4a3c', '#c4a07a', '#d2c3a8', '#9a8f84', '#7d6f68', '#b8a48a'];

  // ------------------------------------------------------------- city-specific landmarks
  const isTO = def.key === 'toronto';
  if (isTO) buildToronto(); else buildOttawa();

  // ------------------------------------------------------------- generic blocks (everything not taken by a landmark)
  const core = isTO ? { x: nsX(40) + 45, z: ewZ(2) + 50, r: 520 } : { x: nsX(-42) + 45, z: ewZ(0) + 50, r: 420 };
  for (const b of blocks) {
    pad(b, b.front ? '#c9bfae' : '#cfcac0');
    const sp = special.get(b.k + ',' + b.m);
    if (b.front) { // waterfront: boardwalk, benches, trees
      const P = (x, z) => [x, h(z) + CURB + 0.03, z]; B.quad(P(b.x0, b.z1 - 8), P(b.x1, b.z1 - 8), P(b.x1, b.z1), P(b.x0, b.z1), [0, 1, 0], L('#a87c52'), 3);
      for (let x = b.x0 + 8; x < b.x1; x += 16) trees.push([x, b.z1 - 12, 1.1]);
      continue;
    }
    // sidewalk trees and lamps (lamps sit where the ground shader paints the night pools)
    for (let x = b.x0 + 7; x < b.x1 - 4; x += 15) { trees.push([x, b.z0 + 1.6, 0.9 + R() * 0.3]); trees.push([x + 7, b.z1 - 1.6, 0.9 + R() * 0.3]); }
    if (sp === 'landmark') continue;
    if (sp === 'park') { parkInside(b); continue; }
    const d = Math.hypot(b.cx - core.x, b.cz - core.z), tall = Math.max(0, 1 - d / core.r), rr = R();
    if (isTO) {
      if (tall > 0.62) {   // Financial District: 1–2 big office towers on plazas
        const n = rr < 0.55 ? 1 : 2;
        for (let i = 0; i < n; i++) { const w = (b.ix1 - b.ix0) * (n === 1 ? 0.5 : 0.38), dd = (b.iz1 - b.iz0) * (0.4 + R() * 0.2); tower(n === 1 ? b.cx : i ? b.ix1 - w / 2 - 5 : b.ix0 + w / 2 + 5, b.cz + (R() - 0.5) * 12, w, dd, 120 + tall * (110 + R() * 70), { podium: 6 }); }
      } else if (tall > 0.18 || rr < 0.35) {   // the condo forest: slim glass towers on brick podiums
        streetWall(b, 8, 18, BRICK, 11);
        const n = 1 + (R() < 0.6 ? 1 : 0) + (tall > 0.4 && R() < 0.5 ? 1 : 0);
        for (let i = 0; i < n; i++) { const w = 18 + R() * 8, x = b.ix0 + 22 + (b.ix1 - b.ix0 - 44) * (n === 1 ? 0.5 : i / (n - 1)), z = b.cz + (R() - 0.5) * 20; tower(x, z, w, w * (0.8 + R() * 0.5), 60 + tall * 120 + R() * 70, { podium: 0, glass: R() < 0.85 }); }
      } else if (rr < 0.12) parkInside(b);
      else streetWall(b, 7, 16, BRICK, 14);
    } else {
      if (tall > 0.5) {   // downtown Ottawa: office slabs of stone and glass (a height limit keeps them modest)
        const n = rr < 0.5 ? 1 : 2;
        for (let i = 0; i < n; i++) { const w = (b.ix1 - b.ix0) * (n === 1 ? 0.55 : 0.4), dd = (b.iz1 - b.iz0) * (0.45 + R() * 0.2); tower(n === 1 ? b.cx : i ? b.ix1 - w / 2 - 4 : b.ix0 + w / 2 + 4, b.cz, w, dd, 40 + tall * 70 + R() * 20, { podium: 6, glass: R() < 0.5 }); }
      } else if (tall > 0.15) { streetWall(b, 10, 26, BRICK.concat(['#d6ccb8', '#c9bda6']), 15); if (R() < 0.35) tower(b.cx, b.cz, 22, 26, 45 + R() * 30, { podium: 0, glass: false }); }
      else if (rr < 0.15) parkInside(b);
      else streetWall(b, 7, 14, BRICK, 12);
    }
  }
  // lamp posts every 30 m on both sidewalks (matching the ground shader's lamp pools)
  for (let k = def.k0; k <= def.k1; k++) { const sx = nsX(k), off = nsHW(k) + 0.6; for (let z = Math.ceil(r.z0 / 30) * 30; z < def.waterZ - 20; z += 30) { lamps.push([sx + off, z]); lamps.push([sx - off, z + 15]); } }
  for (let m = def.m0; m <= def.m1; m++) { const sz = ewZ(m), off = ewHW(m) + 0.6; for (let x = Math.ceil(r.x0 / 30) * 30; x < r.x1; x += 30) { lamps.push([x, sz + off]); lamps.push([x + 15, sz - off]); } }
  const near = (x, z) => C.blocked(x, z, 0.3, h(z) + 0.3, 0.2, h(z) + 3);
  const lampG = mergeGeometries([new THREE.CylinderGeometry(0.07, 0.09, 5.2, 6).translate(0, 2.6, 0), new THREE.BoxGeometry(0.9, 0.1, 0.12).translate(0.35, 5.15, 0)]);
  const headG = new THREE.BoxGeometry(0.42, 0.14, 0.3).translate(0.7, 5.05, 0);
  for (const [x, z] of lamps) { if (near(x, z)) continue; const y = h(z) + CURB, toRoad = 0; geo(lampG, M(x, y, z, toRoad), '#3d4650', 10); geo(headG, M(x, y, z, toRoad), '#fff3d0', 7); }
  // street trees: instanced (trunk + two-tier canopy) — two draw calls for the whole city
  {
    const tr = trees.filter(([x, z]) => !near(x, z));
    const trunk = new THREE.CylinderGeometry(0.14, 0.2, 2.6, 6).translate(0, 1.3, 0);
    const crown = mergeGeometries([new THREE.IcosahedronGeometry(1.7, 0).translate(0, 3.6, 0), new THREE.IcosahedronGeometry(1.2, 0).translate(0.5, 4.7, 0.2)]);
    const m1 = new THREE.InstancedMesh(trunk, new THREE.MeshToonMaterial({ color: 0x6b4f3a, gradientMap: gradient }), tr.length);
    const m2 = new THREE.InstancedMesh(crown, new THREE.MeshToonMaterial({ color: isTO ? 0x5f9a48 : 0x6aa04c, gradientMap: gradient }), tr.length);
    const m4 = new THREE.Matrix4();
    tr.forEach(([x, z, s], i) => { m4.compose(new THREE.Vector3(x, h(z) + CURB, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), R() * 6), new THREE.Vector3(s, s, s)); m1.setMatrixAt(i, m4); m2.setMatrixAt(i, m4); C.add({ x0: x - 0.2, x1: x + 0.2, z0: z - 0.2, z1: z + 0.2, y0: h(z), y1: h(z) + 3, thin: true }); });
    for (const m of [m1, m2]) { m.castShadow = true; m.receiveShadow = true; m.computeBoundingSphere(); scene.add(m); }
  }

  const g = B.build(batchMaterial(), def.key); scene.add(g);
  const map = radar(def, blocks, r);
  return { def, group: g, waters, map, rect: r };

  // ============================================================= Toronto
  function buildToronto() {
    // --- CN Tower (553 m): Y-shaped base, hexagonal shaft, the main pod, the SkyPod and the mast
    { const b = at(38, 3); special.set('38,3', 'landmark'); const x = b.cx, z = b.cz, y = h(z) + CURB;
      for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; geo(new THREE.BoxGeometry(5, 120, 26).translate(0, 60, 13), M(x, y, z, a, 1, 1, 1, 0, 0), '#d9d4c9', 0); }
      geo(new THREE.CylinderGeometry(4.5, 9, 340, 6), M(x, y + 170, z), '#e3ded3', 0);
      solid(x - 8, x + 8, z - 8, z + 8, y, y + 340);
      geo(new THREE.CylinderGeometry(19, 15, 9, 24), M(x, y + 342, z), '#d9d4c9', 0);
      geo(new THREE.CylinderGeometry(19.5, 19.5, 8, 24), M(x, y + 350, z), '#4a6278', 5);   // the glass ring
      geo(new THREE.CylinderGeometry(14, 19, 8, 24), M(x, y + 358, z), '#d9d4c9', 0);
      geo(new THREE.CylinderGeometry(3.6, 4.2, 85, 6), M(x, y + 404, z), '#e3ded3', 0);
      geo(new THREE.CylinderGeometry(6.5, 6, 7, 16), M(x, y + 447, z), '#4a6278', 5);
      geo(new THREE.CylinderGeometry(0.8, 2.6, 100, 8), M(x, y + 500, z), '#c9c4bc', 10);
      for (let i = 0; i < 6; i++) glows.add(x, y + 552 - i * 18, z, 1, 0.12, 0.1, 3 + (i === 0 ? 3 : 0));
      solid(x - 19, x + 19, z - 19, z + 19, y + 338, y + 362);
      world.cnTower = new THREE.Vector3(x, y + 362, z);
    }
    // --- Rogers Centre: the white dome next door
    { const b = at(37, 3); special.set('37,3', 'landmark'); const x = b.cx - 4, z = b.cz, y = h(z) + CURB, Rr = 46;
      geo(new THREE.CylinderGeometry(Rr, Rr + 2, 26, 40, 1, true), M(x, y + 13, z), '#e6e2da', 12);
      geo(new THREE.SphereGeometry(Rr + 0.5, 40, 10, 0, Math.PI * 2, 0, Math.PI / 2), M(x, y + 26, z, 0, 1, 0.42, 1), '#f2f0ea', 9);
      for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI; geo(new THREE.TorusGeometry(Rr + 0.6, 0.35, 4, 40, Math.PI), M(x, y + 26, z, a, 1, 0.42, 1), '#b9b6b0', 10); }
      C.add({ x0: x - Rr * 0.72, x1: x + Rr * 0.72, z0: z - Rr * 0.72, z1: z + Rr * 0.72, y0: y, y1: y + 44 }); C.add({ x0: x - Rr, x1: x + Rr, z0: z - Rr * 0.4, z1: z + Rr * 0.4, y0: y, y1: y + 32 }); C.add({ x0: x - Rr * 0.4, x1: x + Rr * 0.4, z0: z - Rr, z1: z + Rr, y0: y, y1: y + 32 });
    }
    // --- City Hall: two curved towers around the council saucer, Nathan Phillips Square and the TORONTO sign
    { const b = at(39, 0); special.set('39,0', 'landmark'); const y = h(b.cz) + CURB;
      const crescent = (rIn, rOut, ang) => { const s = new THREE.Shape(); s.absarc(0, 0, rOut, -ang / 2, ang / 2, false); s.absarc(0, 0, rIn, ang / 2, -ang / 2, true); return new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false, curveSegments: 18 }).rotateX(-Math.PI / 2); };
      const cx = b.cx, cz = b.iz0 + 26;
      geo(crescent(26, 32, 1.9), M(cx - 6, y, cz, Math.PI, 1, 79, 1), '#d7d3c9', 11); solid(cx - 38, cx - 24, cz - 18, cz + 18, y, y + 79);
      geo(crescent(26, 32, 1.9), M(cx + 6, y, cz, 0, 1, 99, 1), '#d7d3c9', 11); solid(cx + 24, cx + 38, cz - 18, cz + 18, y, y + 99);
      box(cx - 22, cx + 22, y - 1, y + 8, cz - 14, cz + 14, '#cfcac0', 12);
      geo(new THREE.SphereGeometry(16, 24, 8, 0, Math.PI * 2, 0, Math.PI / 2), M(cx, y + 8, cz, 0, 1, 0.38, 1), '#e8e4dc', 0);
      solid(cx - 12, cx + 12, cz - 12, cz + 12, y + 8, y + 14);
      // the square: reflecting pool (a skating rink in winter), three arches, the sign
      const pz = cz + 46, P = (x, z) => [x, y + 0.06, z];
      B.quad(P(cx - 24, pz - 9), P(cx + 24, pz - 9), P(cx + 24, pz + 9), P(cx - 24, pz + 9), [0, 1, 0], L('#7fb3d0'), 5);
      for (const ax of [-16, 0, 16]) geo(new THREE.TorusGeometry(9, 0.45, 6, 20, Math.PI), M(cx + ax, y, pz), '#e8e4dc', 0);
      const FONT = { T: ['11111', '00100', '00100', '00100', '00100'], O: ['01110', '10001', '10001', '10001', '01110'], R: ['11110', '10001', '11110', '10010', '10001'], N: ['10001', '11001', '10101', '10011', '10001'] };
      const COLS = ['#e4402b', '#f2a93b', '#ffd447', '#5fbf5a', '#3c9be8', '#8a5bd6', '#e85c9a'];
      [...'TORONTO'].forEach((ch, i) => { const F = FONT[ch], s = 0.62, x0 = cx - 25 + i * 7.2, z0 = pz - 13; F.forEach((row, ry) => [...row].forEach((v, rx) => { if (v === '1') box(x0 + rx * s, x0 + rx * s + s, y + (4 - ry) * s, y + (5 - ry) * s, z0, z0 + 0.7, COLS[i], 0, false); })); });
      solid(cx - 25, cx + 25, pz - 13, pz - 12.3, y, y + 3.2);
    }
    // --- the Financial District landmarks around King & Bay
    { const b = at(40, 2); special.set('40,2', 'landmark');   // First Canadian Place (white marble, 298 m) + Scotia Plaza (red granite)
      tower(b.ix0 + 20, b.cz - 12, 30, 30, 290, { glass: false, tint: '#ecebe6', setbacks: 0, podium: 6 });
      tower(b.ix1 - 18, b.cz + 16, 28, 28, 262, { glass: false, tint: '#8a3b33', setbacks: 1, podium: 4 });
    }
    { const b = at(39, 2); special.set('39,2', 'landmark');   // TD Centre: Mies's black towers
      tower(b.ix0 + 18, b.cz - 10, 26, 40, 222, { tint: '#23262b', setbacks: 0, podium: 0, crown: false });
      tower(b.ix1 - 15, b.cz + 18, 22, 34, 180, { tint: '#23262b', setbacks: 0, podium: 0, crown: false });
    }
    { const b = at(40, 3); special.set('40,3', 'landmark');   // Royal Bank Plaza (gold glass) and Union Station
      tower(b.ix0 + 18, b.iz0 + 16, 26, 22, 180, { tint: '#c9a24a', setbacks: 0, podium: 0, crown: false });
      tower(b.ix0 + 34, b.iz0 + 26, 18, 16, 128, { tint: '#c9a24a', setbacks: 0, podium: 0, crown: false });
      const y = h(b.cz) + CURB, z0 = b.iz1 - 30, z1 = b.iz1 - 4;
      box(b.ix0 + 4, b.ix1 - 4, h(z1) - 1, y + 20, z0, z1, '#d9cdb4', 12);
      for (let x = b.ix0 + 12; x < b.ix1 - 10; x += 4.4) geo(new THREE.CylinderGeometry(0.9, 1, 14, 10), M(x, y + 7, z0 - 2.4), '#e6dcc6', 0);
      box(b.ix0 + 10, b.ix1 - 10, y + 14, y + 16.5, z0 - 4, z0, '#d9cdb4', 0, false);
      world.unionStation = new THREE.Vector3(b.cx, y, z0 - 6);
    }
    { const b = at(39, 3); special.set('39,3', 'landmark');   // Fairmont Royal York: stepped stone with a copper roof
      const t = tower(b.cx, b.cz, 46, 30, 92, { glass: false, tint: '#c9b896', setbacks: 2, podium: 8, crown: false });
      geo(new THREE.ConeGeometry(t.sw * 0.62, 14, 4, 1).rotateY(Math.PI / 4), M(b.cx, t.top + 7, b.cz, 0, 1, 1, t.sd / t.sw), '#5f9f84', 0);
    }
    { const b = at(39, -3); special.set('39,-3', 'landmark'); parkInside(b, '#6fa25a');   // Queen's Park: the pink sandstone legislature
      const y = h(b.cz) + CURB, cx = b.cx, cz = b.iz0 + 22;
      box(cx - 34, cx + 34, h(cz + 10) - 1, y + 18, cz - 10, cz + 10, '#c98f7a', 2);
      box(cx - 10, cx + 10, y, y + 30, cz - 12, cz + 12, '#c98f7a', 2);
      for (const sx of [-1, 1]) { box(cx + sx * 6 - 2.5, cx + sx * 6 + 2.5, y + 30, y + 42, cz - 9, cz - 4, '#c98f7a', 2); geo(new THREE.ConeGeometry(3.6, 7, 4).rotateY(Math.PI / 4), M(cx + sx * 6, y + 45.5, cz - 6.5), '#5f9f84', 0); }
      geo(new THREE.ConeGeometry(12, 8, 4).rotateY(Math.PI / 4), M(cx, y + 34, cz, 0, 1, 1, 0.9), '#5f9f84', 0);
    }
    { const b = at(41, 0); special.set('41,0', 'landmark');   // Yonge–Dundas Square: plaza ringed by giant screens
      const y = h(b.cz) + CURB;
      streetWall({ ...b, iz0: b.iz0 + 40 }, 14, 24, BRICK, 14);
      for (const [x, z, ry, wdt, hh] of [[b.ix0 + 2, b.iz0 + 18, Math.PI / 2, 22, 12], [b.cx, b.iz0 + 1, 0, 30, 14], [b.ix1 - 2, b.iz0 + 18, -Math.PI / 2, 22, 12]]) {
        box(x - (ry ? 1 : wdt / 2), x + (ry ? 1 : wdt / 2), y, y + 10 + hh, z - (ry ? wdt / 2 : 1), z + (ry ? wdt / 2 : 1), '#2b2d33', 10);
        billboard(x + Math.sin(ry) * 1.1, y + 10 + hh / 2, z + Math.cos(ry) * 1.1, ry, wdt - 2, hh - 1.5);
      }
    }
    { const b = at(36, -1); special.set('36,-1', 'park'); }
    { const b = at(44, 1); special.set('44,1', 'park'); }
    // --- the Gardiner Expressway: an elevated deck along the waterfront with ramps at both ends (drivable)
    { const z0 = ewZ(4) + ewHW(4) + 22, z1 = z0 + 18, zc = (z0 + z1) / 2, top = h(z0) + 9, xa = r.x0 + 150, xb = r.x1 - 150;
      box(xa, xb, top - 1.2, top, z0, z1, '#9a958c', 0);
      for (let x = xa + 10; x < xb; x += 34) { box(x - 1, x + 1, h(z1) - 1, top - 1.2, zc - 1.2, zc + 1.2, '#8e8a83', 0); }
      for (const z of [z0, z1]) box(xa, xb, top, top + 1.1, z - 0.2, z + 0.2, '#b8b3aa', 0, true, { thin: true });
      const ramp = (xa2, xb2, up) => {   // sloping deck (drawn as one quad) + ramp collider
        const yl = up ? h(zc) + CURB : top, yr = up ? top : h(zc) + CURB, Pq = (x, y2, z) => [x, y2, z];
        B.quad(Pq(xa2, yl, z0), Pq(xb2, yr, z0), Pq(xb2, yr, z1), Pq(xa2, yl, z1), [0, 1, 0], L('#9a958c'), 0);
        C.add({ x0: xa2, x1: xb2, z0, z1, y0: h(z1) - 1, t: 'ramp', axis: 'x', a0: xa2, a1: xb2, r0: yl, r1: yr });
      };
      ramp(xa - 120, xa, true); ramp(xb, xb + 120, false);
      for (let x = xa + 5; x < xb; x += 60) for (const z of [z0 + 0.6, z1 - 0.6]) glows.add(x, top + 4, z, 1, 0.85, 0.6, 1.4);
    }
    // the Toronto Islands across the harbour
    box(r.x0 + 200, r.x1 - 100, wy - 1, wy + 1.2, def.waterZ + 340, def.waterZ + 520, '#6f9a52', 0, false);
    for (let i = 0; i < 40; i++) trees.push([r.x0 + 220 + R() * (r.x1 - r.x0 - 340), def.waterZ + 360 + R() * 140, 1.4 + R()]);
  }

  // ============================================================= Ottawa
  function buildOttawa() {
    // --- Parliament Hill: a raised lawn over the river with Centre Block, the Peace Tower, the Library,
    // the East and West Blocks and the Centennial Flame
    const hx0 = nsX(-41) + 6, hx1 = nsX(-39) - 6, hz0 = ewZ(3) + ewHW(3) + 4, hz1 = def.waterZ - 3, lift = 6;
    for (const k of [-41, -40]) special.set(k + ',3', 'landmark');
    { const P = (x, z) => [x, h(z) + lift, z];
      B.quad(P(hx0, hz0), P(hx1, hz0), P(hx1, hz1), P(hx0, hz1), [0, 1, 0], L('#5d9a4a'), 0);
      for (const [a, c, n] of [[[hx0, hz0], [hx1, hz0], [0, 0, -1]], [[hx0, hz0], [hx0, hz1], [-1, 0, 0]], [[hx1, hz0], [hx1, hz1], [1, 0, 0]]]) B.quad([a[0], h(a[1]) - 0.5, a[1]], [c[0], h(c[1]) - 0.5, c[1]], P(c[0], c[1]), P(a[0], a[1]), n, L('#b7aa8e'), 2);
      C.add({ x0: hx0, x1: hx1, z0: hz0, z1: hz1, y0: h(hz1) - 1, t: 'h', off: lift });
      // the walk up from Wellington Street
      const cx = (hx0 + hx1) / 2, rz1 = hz0 + 16;
      B.quad([cx - 9, h(hz0) + CURB, hz0 - 0.1], [cx + 9, h(hz0) + CURB, hz0 - 0.1], [cx + 9, h(rz1) + lift + 0.02, rz1], [cx - 9, h(rz1) + lift + 0.02, rz1], [0, 1, 0], L('#d8ccb2'), 0);
      C.add({ x0: cx - 9, x1: cx + 9, z0: hz0 - 0.1, z1: rz1, y0: h(rz1) - 1, t: 'ramp', axis: 'z', a0: hz0, a1: rz1, r0: h(hz0) + CURB, r1: h(rz1) + lift });
      const Q = (x, z) => [x, h(z) + lift + 0.03, z]; B.quad(Q(cx - 5, rz1), Q(cx + 5, rz1), Q(cx + 5, hz0 + 46), Q(cx - 5, hz0 + 46), [0, 1, 0], L('#d8ccb2'), 0);
      const yH = (z) => h(z) + lift;
      // Centre Block
      const cz0 = hz0 + 46, cz1 = cz0 + 30, yb = yH(cz1) - 0.5, top = yH(cz0) + 26;
      box(cx - 62, cx + 62, yb, top, cz0, cz1, '#cbb68e', 2);
      const roof = (x0, x1, z0, z1, y, hh) => { const s = new THREE.Shape(); s.moveTo(-(z1 - z0) / 2, 0); s.lineTo((z1 - z0) / 2, 0); s.lineTo(0, hh); s.closePath(); geo(new THREE.ExtrudeGeometry(s, { depth: x1 - x0, bevelEnabled: false }).rotateY(Math.PI / 2), M(x0, y, (z0 + z1) / 2), '#5f9f84', 0); };
      roof(cx - 62, cx + 62, cz0, cz1, top, 11);
      for (const sx of [-1, 1]) for (const z of [cz0, cz1]) { box(cx + sx * 62 - 4, cx + sx * 62 + 4, yb, top + 6, z - 4, z + 4, '#cbb68e', 2); geo(new THREE.ConeGeometry(4.2, 10, 4).rotateY(Math.PI / 4), M(cx + sx * 62, top + 11, z), '#5f9f84', 0); }
      for (let x = cx - 52; x <= cx + 52; x += 13) if (Math.abs(x - cx) > 10) geo(new THREE.ConeGeometry(1.1, 6, 4), M(x, top + 3, cz0), '#5f9f84', 0);
      // Peace Tower
      const tz = cz0 - 2, ty = top + 46;
      box(cx - 7, cx + 7, yH(tz) - 0.5, ty, tz - 7, tz + 7, '#cbb68e', 2);
      box(cx - 7.6, cx + 7.6, ty, ty + 12, tz - 7.6, tz + 7.6, '#cbb68e', 2);
      for (const [ox, oz, ry] of [[0, -7.7, 0], [0, 7.7, 0], [-7.7, 0, Math.PI / 2], [7.7, 0, Math.PI / 2]]) { geo(new THREE.CylinderGeometry(3.2, 3.2, 0.3, 24).rotateX(Math.PI / 2), M(cx + ox, ty + 6, tz + oz, ry), '#f4f0e4', 0); geo(new THREE.CylinderGeometry(3.5, 3.5, 0.2, 24).rotateX(Math.PI / 2), M(cx + ox * 0.995, ty + 6, tz + oz * 0.995, ry), '#2b2550', 0); }
      geo(new THREE.ConeGeometry(10.2, 24, 4).rotateY(Math.PI / 4), M(cx, ty + 24, tz), '#5f9f84', 0);
      geo(new THREE.CylinderGeometry(0.2, 0.5, 9, 6), M(cx, ty + 40, tz), '#cfc7a8', 10);
      glows.add(cx, ty + 6, tz - 7.9, 1, 0.92, 0.7, 2.6); glows.add(cx, ty + 45, tz, 1, 0.3, 0.2, 2.4);
      world.peaceTower = new THREE.Vector3(cx, ty + 12, tz);
      // Library of Parliament (round, behind, towards the river)
      const lz = cz1 + 18; geo(new THREE.CylinderGeometry(13, 13, 24, 16), M(cx, yH(lz) + 12, lz), '#cbb68e', 2); solid(cx - 11, cx + 11, lz - 11, lz + 11, yH(lz), yH(lz) + 24);
      geo(new THREE.ConeGeometry(14, 22, 16), M(cx, yH(lz) + 35, lz), '#5f9f84', 0); geo(new THREE.CylinderGeometry(2, 2.4, 6, 8), M(cx, yH(lz) + 49, lz), '#cbb68e', 0); geo(new THREE.ConeGeometry(2.6, 6, 8), M(cx, yH(lz) + 55, lz), '#5f9f84', 0);
      // East and West Blocks, side-on to the lawn
      for (const sx of [-1, 1]) { const x = cx + sx * 82, z0 = hz0 + 10, z1 = hz0 + 70; box(x - 11, x + 11, yH(z1) - 0.5, yH(z0) + 20, z0, z1, '#c4ae86', 2); const s = new THREE.Shape(); s.moveTo(-11, 0); s.lineTo(11, 0); s.lineTo(0, 9); s.closePath(); geo(new THREE.ExtrudeGeometry(s, { depth: 60, bevelEnabled: false }), M(x, yH(z0) + 20, z0), '#5f9f84', 0); box(x - 4, x + 4, yH(z0) + 20, yH(z0) + 34, z0 + 2, z0 + 10, '#c4ae86', 2); geo(new THREE.ConeGeometry(5.6, 12, 4).rotateY(Math.PI / 4), M(x, yH(z0) + 40, z0 + 6), '#5f9f84', 0); }
      // the Centennial Flame
      const fz = hz0 + 28; geo(new THREE.CylinderGeometry(4.5, 5, 1.2, 12), M(cx, yH(fz) + 0.6, fz), '#7d7a74', 2); glows.add(cx, yH(fz) + 2.2, fz, 1, 0.55, 0.15, 3.4); world.flame = new THREE.Vector3(cx, yH(fz) + 1.5, fz);
      for (let i = 0; i < 14; i++) trees.push([hx0 + 6 + R() * 30, hz0 + 20 + R() * (hz1 - hz0 - 30), 1.3], [hx1 - 6 - R() * 30, hz0 + 20 + R() * (hz1 - hz0 - 30), 1.3]);
    }
    // --- the Rideau Canal: a stone-lined channel between Elgin and Waller, bridges at every street, locks by the river
    const kx = nsX(-39) + 45, half = 11;
    for (let m = def.m0 - 1; m < def.m1 + 1; m++) {
      const za = Math.max(r.z0 - 30, ewZ(m) + ewHW(m) + 1), zb = Math.min(def.waterZ - 2, ewZ(m + 1) - ewHW(m + 1) - 1);
      if (zb <= za) continue;
      const P = (x, z) => [x, h(z) + 0.18, z];
      const water = new THREE.Mesh(new THREE.PlaneGeometry(half * 2, zb - za, 1, 8).rotateX(-Math.PI / 2), waterMaterial()); water.material.polygonOffset = true; water.material.polygonOffsetFactor = -2;
      { const Pp = water.geometry.attributes.position; for (let i = 0; i < Pp.count; i++) Pp.setY(i, h(Pp.getZ(i) + (za + zb) / 2) + 0.18); }
      water.position.set(kx, 0, (za + zb) / 2); scene.add(water); waters.push(water);
      WATERS.push({ x0: kx - half, x1: kx + half, z0: za, z1: zb, y: null, slope: 0.4, side: kx - half - 3 });
      for (const sx of [-1, 1]) { const x = kx + sx * (half + 0.6); box(x - 0.6, x + 0.6, h(zb) - 0.8, h(za) + CURB + 0.9, za, zb, '#a39a8c', 2); }
      void P;
      // locks near the river
      if (zb > def.waterZ - 60) for (let z = za + 10; z < zb - 4; z += 14) box(kx - half, kx + half, h(z) + 0.1, h(z) + 1.6, z, z + 0.6, '#5a4632', 3, false);
    }
    for (let m = def.m0; m <= def.m1; m++) { const z = ewZ(m), hw = ewHW(m) + ewSW(m); for (const s of [-1, 1]) box(kx - half - 1, kx + half + 1, h(z) + CURB, h(z) + CURB + 1.0, z + s * (hw + 0.6) - 0.2, z + s * (hw + 0.6) + 0.2, '#8a8478', 2, true, { thin: true }); }
    // --- Château Laurier: limestone castle hotel by the canal locks
    { const x0 = kx + half + 5, x1 = nsX(-38) - nsHW(-38) - 2, z0 = ewZ(3) + ewHW(3) + 10, z1 = def.waterZ - 14, y = h(z0) + CURB, top = y + 34;
      box(x0, x1, h(z1) - 0.8, top, z0, z1, '#d8cdb5', 12);
      const s = new THREE.Shape(); s.moveTo(-(z1 - z0) / 2, 0); s.lineTo((z1 - z0) / 2, 0); s.lineTo(0, 16); s.closePath(); geo(new THREE.ExtrudeGeometry(s, { depth: x1 - x0, bevelEnabled: false }).rotateY(Math.PI / 2), M(x0, top, (z0 + z1) / 2), '#5f9f84', 0);
      for (const x of [x0 + 3, x1 - 3]) for (const z of [z0 + 3, z1 - 3]) { geo(new THREE.CylinderGeometry(3.4, 3.4, 40, 12), M(x, y + 20, z), '#d8cdb5', 12); geo(new THREE.ConeGeometry(4.2, 12, 12), M(x, y + 46, z), '#5f9f84', 0); }
      for (let x = x0 + 8; x < x1 - 6; x += 9) geo(new THREE.ConeGeometry(1.4, 5, 4).rotateY(Math.PI / 4), M(x, top + 4, z0 + 2), '#5f9f84', 0);
    }
    // --- National War Memorial on Confederation Square
    { const b = at(-40, 2); const x = b.ix1 - 14, z = b.iz1 - 14, y = h(z) + CURB;
      box(x - 7, x + 7, y, y + 2, z - 7, z + 7, '#8f8c86', 2); box(x - 4.5, x - 2.5, y + 2, y + 21, z - 2, z + 2, '#9a968f', 2); box(x + 2.5, x + 4.5, y + 2, y + 21, z - 2, z + 2, '#9a968f', 2); box(x - 4.5, x + 4.5, y + 15, y + 21, z - 2, z + 2, '#9a968f', 2);
      geo(new THREE.ConeGeometry(1.6, 3, 8), M(x, y + 22.5, z), '#4f6e5c', 0);
    }
    // --- ByWard Market: the brick market hall and striped stalls
    { const b = at(-38, 1); special.set('-38,1', 'landmark'); const y = h(b.cz) + CURB;
      streetWall(b, 8, 14, BRICK, 13);
      box(b.cx - 20, b.cx + 20, h(b.cz + 8) - 0.5, y + 9, b.cz - 8, b.cz + 8, '#9c4a3a', 1);
      const s = new THREE.Shape(); s.moveTo(-8.5, 0); s.lineTo(8.5, 0); s.lineTo(0, 5); s.closePath(); geo(new THREE.ExtrudeGeometry(s, { depth: 41, bevelEnabled: false }).rotateY(Math.PI / 2), M(b.cx - 20.5, y + 9, b.cz), '#7a2f28', 0);
      const AW = ['#e4402b', '#f2a93b', '#3c9be8', '#5fbf5a', '#e85c9a'];
      for (let i = 0; i < 8; i++) { const x = b.cx - 18 + i * 5.2, z = b.cz + 12.5; box(x - 2, x + 2, y + 2.2, y + 2.5, z - 1.5, z + 1.5, AW[i % 5], 0, false); for (const sx of [-1, 1]) box(x + sx * 1.9 - 0.06, x + sx * 1.9 + 0.06, y, y + 2.2, z + 1.3, z + 1.42, '#6b5a48', 0, false); box(x - 1.6, x + 1.6, y + 0.9, y + 1.0, z - 1, z + 1, '#c9a774', 0, false); }
    }
    { special.set('-39,1', 'park'); special.set('-44,-2', 'park'); }
    // the Gatineau hills across the river
    box(r.x0 - 300, r.x1 + 300, wy - 1, wy + 14, def.waterZ + 520, def.waterZ + 760, '#5d8a4a', 0, false);
    for (let i = 0; i < 6; i++) { const x = r.x0 + 200 + i * 160 + R() * 60, z = def.waterZ + 540; box(x - 15, x + 15, wy, wy + 30 + R() * 50, z - 10, z + 10, pick(['#d8d2c6', '#8fa3b4', '#b9b0a2'], R), 11, false); }
  }

  function billboard(x, y, z, ry, w, hh) {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = Math.round(512 * hh / w); const c = cv.getContext('2d');
    const ads = [['#e4402b', '#fff', 'MAPLE COLA', 'taste the north'], ['#1f2a44', '#ffd447', 'TORONTO LIVE', 'tonight · Scotiabank Arena'], ['#5fbf5a', '#fff', 'TIMBITS 24/7', 'double-double?'], ['#8a5bd6', '#fff', 'NEON 88 FM', 'synthwave all night']];
    const a = ads[(Math.abs(Math.round(x + z)) % ads.length)];
    c.fillStyle = a[0]; c.fillRect(0, 0, cv.width, cv.height); c.fillStyle = a[1]; c.textAlign = 'center'; c.font = `700 ${cv.height * 0.32}px Oswald, Impact, sans-serif`; c.fillText(a[2], cv.width / 2, cv.height * 0.55); c.font = `500 ${cv.height * 0.14}px Oswald, sans-serif`; c.fillText(a[3], cv.width / 2, cv.height * 0.82);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, hh), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })); m.position.set(x, y, z); m.rotation.y = ry; scene.add(m);
  }
}

// a radar picture of the city (1 px per metre)
function radar(def, blocks, r) {
  const X0 = r.x0 - 60, Z0 = r.z0 - 60, W = Math.ceil(r.x1 - r.x0 + 120), H = Math.ceil(def.waterZ + 500 - Z0);
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const x = cv.getContext('2d');
  x.fillStyle = '#3d454d'; x.fillRect(0, 0, W, H);
  x.fillStyle = '#2f5f7f'; x.fillRect(0, def.waterZ - Z0, W, H);
  x.fillStyle = '#59626b'; for (const b of blocks) x.fillRect(b.x0 - X0, b.z0 - Z0, b.x1 - b.x0, b.z1 - b.z0);
  x.fillStyle = '#a9b0b6';
  for (let k = def.k0; k <= def.k1; k++) x.fillRect(nsX(k) - nsHW(k) - X0, r.z0 - Z0, nsHW(k) * 2, def.waterZ - r.z0);
  for (let m = def.m0; m <= def.m1; m++) x.fillRect(r.x0 - X0, ewZ(m) - ewHW(m) - Z0, r.x1 - r.x0, ewHW(m) * 2);
  return { cv, X0, Z0 };
}
