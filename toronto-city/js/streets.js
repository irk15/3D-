// Street-level detail from the road network: lane dashes, zebra crosswalks, street lamps and street-tree positions.
import { Acc, hash } from './acc.js';
import { lines } from './geom.js';
import { ROAD, roadClass } from './flat.js';

const WHITE = [0.86, 0.86, 0.82];
const KEY = (x, z) => Math.round(x * 2) + ',' + Math.round(z * 2);

// strip of width w, offset sideways by `off`, with UVs (u across 0..1, v = metres along / period)
function strip(acc, uv, pts, off, w, y, period) {
  const P = [pts[0]]; for (let i = 1; i < pts.length; i++) if (Math.hypot(pts[i][0] - P[P.length - 1][0], pts[i][1] - P[P.length - 1][1]) > 0.3) P.push(pts[i]);
  const m = P.length; if (m < 2) return;
  const nr = []; for (let i = 0; i < m - 1; i++) { const dx = P[i + 1][0] - P[i][0], dz = P[i + 1][1] - P[i][1], l = Math.hypot(dx, dz); nr.push([dz / l, -dx / l]); }
  let d = 0, pl = -1, pr = -1;
  for (let i = 0; i < m; i++) {
    let nx, nz, k = 1;
    if (i === 0) [nx, nz] = nr[0]; else if (i === m - 1) [nx, nz] = nr[m - 2];
    else { const a = nr[i - 1], b = nr[i]; nx = a[0] + b[0]; nz = a[1] + b[1]; const l = Math.hypot(nx, nz) || 1; nx /= l; nz /= l; k = Math.min(2, 1 / Math.max(0.5, nx * a[0] + nz * a[1])); }
    if (i) d += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]);
    const cx = P[i][0] + nx * off * k, cz = P[i][1] + nz * off * k, hw = (w / 2) * k;
    const l = acc.v(cx + nx * hw, y, cz + nz * hw, ...WHITE), r = acc.v(cx - nx * hw, y, cz - nz * hw, ...WHITE);
    uv.push(1, d / period, 0, d / period);
    if (pl >= 0) { acc.up(pl, pr, l); acc.up(pr, r, l); }
    pl = l; pr = r;
  }
}
function quadUV(acc, uv, cx, cz, dx, dz, hl, hwid, y, ru) { // zebra: bars run along (dx,dz); u repeats `ru` times across the road
  const nx = dz, nz = -dx;
  const a = acc.v(cx - dx * hl - nx * hwid, y, cz - dz * hl - nz * hwid, ...WHITE), b = acc.v(cx - dx * hl + nx * hwid, y, cz - dz * hl + nz * hwid, ...WHITE);
  const c = acc.v(cx + dx * hl + nx * hwid, y, cz + dz * hl + nz * hwid, ...WHITE), d = acc.v(cx + dx * hl - nx * hwid, y, cz + dz * hl - nz * hwid, ...WHITE);
  uv.push(0, 0, ru, 0, ru, 1, 0, 1);
  acc.up(a, b, c); acc.up(a, c, d);
}

export function* buildStreets(vt, T, seed, occ) {
  const R = vt.layers.transportation; if (!R) return {};
  const x0 = T.x0, z0 = T.z0, x1 = T.x0 + T.sx, z1 = T.z0 + T.sz;
  const dash = new Acc(), du = [], zebra = new Acc(), zu = [], lamps = [], trees = [], nodes = new Map(), L = [];
  for (let i = 0; i < R.length; i++) {
    if (i % 300 === 0) yield;
    const f = R.feature(i), p = f.properties;
    if (f.type !== 2 || p.brunnel === 'tunnel') continue;
    const cls = roadClass(p), spec = ROAD[cls];
    if (!spec || !spec[3] && cls !== 'motorway' && cls !== 'trunk') continue;
    for (const ln of lines(f, T)) if (ln.length > 1) L.push({ ln, cls, spec, bridge: p.brunnel === 'bridge' });
  }
  // node graph for intersections
  for (const { ln, spec, cls } of L) {
    for (let j = 0; j < ln.length; j++) {
      const q = ln[j], k = KEY(q[0], q[1]); let nd = nodes.get(k); if (!nd) nodes.set(k, nd = { x: q[0], z: q[1], legs: [] });
      for (const s of [-1, 1]) {
        let m = j + s, dd = 0; if (m < 0 || m >= ln.length) continue;
        while (m + s >= 0 && m + s < ln.length && Math.hypot(ln[m][0] - q[0], ln[m][1] - q[1]) < 7) m += s;
        dd = Math.hypot(ln[m][0] - q[0], ln[m][1] - q[1]); if (dd < 0.5) continue;
        nd.legs.push({ dx: (ln[m][0] - q[0]) / dd, dz: (ln[m][1] - q[1]) / dd, hw: spec[0], cls, side: !!spec[3] });
      }
    }
  }
  const ix = new Map();
  for (const nd of nodes.values()) if (nd.legs.length >= 3) { const k = Math.floor(nd.x / 16) + ',' + Math.floor(nd.z / 16); (ix.get(k) || ix.set(k, []).get(k)).push(nd); }
  yield;
  // zebra crossings at intersections
  for (const nd of nodes.values()) {
    if (nd.legs.length < 3 || nd.x < x0 + 6 || nd.x > x1 - 6 || nd.z < z0 + 6 || nd.z > z1 - 6) continue;
    for (const lg of nd.legs) {
      if (!lg.side || lg.hw > 9) continue;
      let ow = 0; for (const o of nd.legs) if (o !== lg && o.hw > ow) ow = o.hw;
      const off = ow + 3.4;
      quadUV(zebra, zu, nd.x + lg.dx * off, nd.z + lg.dz * off, lg.dx, lg.dz, 1.6, lg.hw * 0.92, ROAD[lg.cls][2] + 0.04, Math.max(3, Math.round((lg.hw * 1.84) / 1.1)));
    }
  }
  yield;
  // lane dashes, lamps, street trees
  let n = 0;
  for (const { ln, cls, spec, bridge } of L) {
    if (++n % 120 === 0) yield;
    const hw = spec[0], y = spec[2] + (bridge ? 0.1 : 0) + 0.045;
    if (cls === 'motorway' || cls === 'trunk' || cls === 'primary' || (cls === 'secondary' && hw >= 6)) { strip(dash, du, ln, hw * 0.5, 0.18, y, 9); strip(dash, du, ln, -hw * 0.5, 0.18, y, 9); }
    if (bridge || !spec[3]) continue;
    const lampStep = cls === 'minor' ? 46 : 36, treeStep = 15, lampOff = hw + 1.9, treeOff = hw + (cls === 'minor' ? 4.6 : 3.6);
    let along = 0, lampAt = lampStep * 0.5, treeAt = treeStep * 0.5, lc = 0, tc = 0;
    for (let j = 1; j < ln.length; j++) {
      const a = ln[j - 1], b = ln[j], dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz); if (len < 0.01) continue;
      const tx = dx / len, tz = dz / len, nx = tz, nz = -tx;
      while (lampAt < along + len) { // lamps, alternating sides
        const s = lampAt - along, px = a[0] + tx * s, pz = a[1] + tz * s, side = (lc++ & 1) ? 1 : -1; lampAt += lampStep;
        if (px < x0 || px >= x1 || pz < z0 || pz >= z1 || nearNode(ix, px, pz, 11)) continue;
        const lx = px + nx * lampOff * side, lz = pz + nz * lampOff * side;
        if (!occ.at(lx, lz) && lamps.length < 3300) lamps.push(lx, lz, Math.atan2(-nx * side, -nz * side));
      }
      while (treeAt < along + len) { // street trees, both sides, ~55% of slots
        const s = treeAt - along, px = a[0] + tx * s, pz = a[1] + tz * s; treeAt += treeStep;
        if (cls === 'primary' || px < x0 || px >= x1 || pz < z0 || pz >= z1 || nearNode(ix, px, pz, 12)) continue;
        for (const side of [-1, 1]) {
          const r = hash(seed + (tc++) * 7 + side * 13 + (px * 31 | 0));
          if (r > 0.55) continue;
          const tx2 = px + nx * treeOff * side + (hash(seed + tc * 3) - 0.5) * 1.2, tz2 = pz + nz * treeOff * side;
          if (!occ.at(tx2, tz2) && trees.length < 3600) trees.push(tx2, tz2, r * 0.9);
        }
      }
      along += len;
    }
  }
  return { dash: dash.empty ? null : dash.geometry(true, { uv: { data: du, size: 2 } }), zebra: zebra.empty ? null : zebra.geometry(true, { uv: { data: zu, size: 2 } }), lamps, trees };
}
function nearNode(ix, x, z, r) {
  const cx = Math.floor(x / 16), cz = Math.floor(z / 16);
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const l = ix.get((cx + a) + ',' + (cz + b)); if (l) for (const nd of l) if (Math.hypot(nd.x - x, nd.z - z) < r) return true; }
  return false;
}
