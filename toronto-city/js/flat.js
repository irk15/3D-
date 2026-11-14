// Ground, land cover, parks, water, roads, sidewalks and rails for one tile. Everything flat is merged into 2 meshes.
import earcut from 'earcut';
import { Acc, rgb, hash } from './acc.js';
import { polygons, lines } from './geom.js';

const COL = {
  ground: rgb(0x4b4e49), grass: rgb(0x4f6a3f), wood: rgb(0x3a5a35), park: rgb(0x547a45), sand: rgb(0xb7ab86), farm: rgb(0x6b7a45),
  rock: rgb(0x7b7b78), wetland: rgb(0x4b6a55), residential: rgb(0x55574f), commercial: rgb(0x5d5c58), industrial: rgb(0x555558),
  cemetery: rgb(0x4a6244), pitch: rgb(0x5b8a4a), school: rgb(0x58595a), water: rgb(0x16405c)
};
const LAND = { grass: 'grass', wood: 'wood', sand: 'sand', farmland: 'farm', rock: 'rock', wetland: 'wetland', ice: 'rock' };
const LANDUSE = { residential: 'residential', commercial: 'commercial', retail: 'commercial', industrial: 'industrial', cemetery: 'cemetery', pitch: 'pitch', playground: 'pitch', school: 'school', university: 'school', college: 'school', hospital: 'school', railway: 'industrial', stadium: 'pitch' };
// y offsets keep coplanar layers apart (no z-fighting)
const Y = { ground: 0, landuse: 0.05, land: 0.1, park: 0.15, water: 0.2 };
const ROAD = { // class -> [half width m, rgb, y, sidewalk]
  motorway: [10, rgb(0x2a2b2e), 0.3, false], trunk: [9, rgb(0x2b2c30), 0.28, false], primary: [8, rgb(0x2d2f33), 0.26, true],
  secondary: [6.5, rgb(0x303236), 0.24, true], tertiary: [5.5, rgb(0x33353a), 0.22, true], minor: [4.2, rgb(0x383a3f), 0.2, true],
  service: [2.6, rgb(0x3d3f44), 0.18, false], track: [1.5, rgb(0x5a5648), 0.18, false], path: [1.0, rgb(0x8a8576), 0.19, false],
  rail: [1.6, rgb(0x232323), 0.32, false], transit: [1.6, rgb(0x232323), 0.32, false], runway: [30, rgb(0x2c2c2e), 0.2, false], taxiway: [12, rgb(0x303033), 0.2, false]
};
const SIDEWALK = rgb(0x8c8a84), CENTRE = rgb(0xc9b75a);

function ribbon(acc, pts, hw, col, y) {
  const n = pts.length; if (n < 2) return;
  const P = [pts[0]]; for (let i = 1; i < n; i++) if (Math.hypot(pts[i][0] - P[P.length - 1][0], pts[i][1] - P[P.length - 1][1]) > 0.2) P.push(pts[i]);
  if (P.length < 2) return;
  const m = P.length, nrm = [];
  for (let i = 0; i < m - 1; i++) { const dx = P[i + 1][0] - P[i][0], dz = P[i + 1][1] - P[i][1], l = Math.hypot(dx, dz); nrm.push([dz / l, -dx / l]); }
  let prevL = -1, prevR = -1;
  for (let i = 0; i < m; i++) {
    let nx, nz, k = 1;
    if (i === 0) [nx, nz] = nrm[0]; else if (i === m - 1) [nx, nz] = nrm[m - 2];
    else {
      const a = nrm[i - 1], b = nrm[i]; nx = a[0] + b[0]; nz = a[1] + b[1];
      const l = Math.hypot(nx, nz) || 1; nx /= l; nz /= l;
      k = Math.min(2.2, 1 / Math.max(0.45, nx * a[0] + nz * a[1]));
    }
    const l = acc.v(P[i][0] + nx * hw * k, y, P[i][1] + nz * hw * k, col[0], col[1], col[2]);
    const r = acc.v(P[i][0] - nx * hw * k, y, P[i][1] - nz * hw * k, col[0], col[1], col[2]);
    if (prevL >= 0) { acc.up(prevL, prevR, l); acc.up(prevR, r, l); }
    prevL = l; prevR = r;
  }
}
function fillPoly(acc, poly, y, col) {
  const flat = [], holes = [];
  for (let ri = 0; ri < poly.length; ri++) { if (ri > 0) holes.push(flat.length / 2); for (const p of poly[ri]) flat.push(p[0], p[1]); }
  const idx = earcut(flat, holes.length ? holes : undefined, 2);
  const o = acc.n;
  for (let i = 0; i < flat.length; i += 2) acc.v(flat[i], y, flat[i + 1], col[0], col[1], col[2]);
  for (let i = 0; i < idx.length; i += 3) acc.up(o + idx[i], o + idx[i + 1], o + idx[i + 2]);
  return { flat, idx };
}

export function* buildFlat(vt, T, seed) {
  const land = new Acc(), roads = new Acc(), treeTris = [];
  // ground quad for the whole tile
  const g = COL.ground, x1 = T.x0 + T.sx, z1 = T.z0 + T.sz;
  const q = [land.v(T.x0, Y.ground, T.z0, ...g), land.v(x1, Y.ground, T.z0, ...g), land.v(x1, Y.ground, z1, ...g), land.v(T.x0, Y.ground, z1, ...g)];
  land.up(q[0], q[1], q[2]); land.up(q[0], q[2], q[3]);
  const polyLayer = (name, pick, y, collectTrees) => {
    const L = vt.layers[name]; if (!L) return;
    for (let i = 0; i < L.length; i++) {
      const f = L.feature(i), key = pick(f.properties); if (!key) continue;
      for (const poly of polygons(f, T)) {
        const { flat, idx } = fillPoly(land, poly, y, COL[key]);
        if (collectTrees && (key === 'wood' || key === 'park' || key === 'grass')) for (let t = 0; t < idx.length; t += 3) treeTris.push(key === 'wood' ? 1 : 0.35, flat[idx[t] * 2], flat[idx[t] * 2 + 1], flat[idx[t + 1] * 2], flat[idx[t + 1] * 2 + 1], flat[idx[t + 2] * 2], flat[idx[t + 2] * 2 + 1]);
      }
    }
  };
  polyLayer('landuse', (p) => LANDUSE[p.class], Y.landuse); yield;
  polyLayer('landcover', (p) => LAND[p.class], Y.land, true); yield;
  polyLayer('park', () => 'park', Y.park, true); yield;
  polyLayer('water', () => 'water', Y.water); yield;

  // roads
  const R = vt.layers.transportation;
  if (R) for (let i = 0; i < R.length; i++) {
    if (i % 400 === 0) yield;
    const f = R.feature(i), p = f.properties;
    if (f.type !== 2 || p.brunnel === 'tunnel') continue;
    let cls = p.class; if (cls === 'motorway_link' || cls === 'trunk_link') cls = cls.split('_')[0]; if (cls === 'primary_link' || cls === 'secondary_link' || cls === 'tertiary_link') cls = 'service';
    if (cls === 'busway' || cls === 'bus_guideway' || cls === 'ferry' || cls === 'pier') continue;
    const spec = ROAD[cls]; if (!spec) continue;
    const bridge = p.brunnel === 'bridge' ? 0.1 : 0;
    for (const ln of lines(f, T)) {
      if (spec[3]) ribbon(roads, ln, spec[0] + 2.4, SIDEWALK, spec[2] - 0.08);
      ribbon(roads, ln, spec[0], spec[1], spec[2] + bridge);
      if (cls === 'primary' || cls === 'secondary' || cls === 'tertiary') ribbon(roads, ln, 0.16, CENTRE, spec[2] + bridge + 0.03);
    }
  }
  const A = vt.layers.aeroway;
  if (A) for (let i = 0; i < A.length; i++) { const f = A.feature(i), s = ROAD[f.properties.class]; if (s && f.type === 2) for (const ln of lines(f, T)) ribbon(roads, ln, s[0], s[1], s[2]); }
  yield;
  return { land: land.geometry(true), roads: roads.empty ? null : roads.geometry(true), treeTris };
}
