// terrain.js — ground tiles, water, distant forest canopy shell, horizon ring and far hills.
import * as THREE from 'three';
import { DOM, TILE, TILES_U, TILES_V, terrainH, waterSDF, forestSDF, ll2g, fbm, smooth, QUAY } from './core.js';
import { groundMaterial, waterMaterial, canopyMaterial } from './shaders.js';

const tmpN = new THREE.Vector3();

function classify(u0, v0) {
  let wMin = 1e9, wMax = -1e9, hMin = 1e9, hMax = -1e9, fMax = -1e9;
  const n = 12;
  for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) {
    const u = u0 + TILE * i / n, v = v0 + TILE * j / n;
    const w = waterSDF(u, v); wMin = Math.min(wMin, w); wMax = Math.max(wMax, w);
    const f = forestSDF(u, v); fMax = Math.max(fMax, f);
    if (w > 0) { const h = terrainH(u, v); hMin = Math.min(hMin, h); hMax = Math.max(hMax, h); }
  }
  return { hasWater: wMin < 2, hasLand: wMax > -3, relief: hMax - hMin, forest: fMax > -10 };
}

// Build one terrain tile. Vertices near the shoreline are snapped onto it (along the SDF gradient),
// border vertices only slide along the border so neighbouring tiles never overlap.
function buildTile(u0, v0, seg) {
  const cell = TILE / seg, N = seg + 1;
  const cu = u0 + TILE / 2, cv = v0 + TILE / 2;
  const pos = new Float32Array((N * N + 4 * N) * 3);
  let p = 0;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    let u = u0 + i * cell, v = v0 + j * cell;
    const ws = waterSDF(u, v);
    if (Math.abs(ws) < cell * 0.55 && Math.abs(ws) < 30) {
      const h = cell * 0.25;
      let gu = (waterSDF(u + h, v) - waterSDF(u - h, v)) / (2 * h);
      let gv = (waterSDF(u, v + h) - waterSDF(u, v - h)) / (2 * h);
      const edgeI = i === 0 || i === seg, edgeJ = j === 0 || j === seg;
      if (edgeI) gu = 0; if (edgeJ) gv = 0;
      const l2 = gu * gu + gv * gv;
      if (l2 > 0.04 && !(edgeI && edgeJ)) {
        let du = -ws * gu / l2, dv = -ws * gv / l2;
        const m = Math.hypot(du, dv), lim = cell * 0.6;
        if (m > lim) { du *= lim / m; dv *= lim / m; }
        u += du; v += dv;
      }
    }
    pos[p++] = u - cu; pos[p++] = terrainH(u, v); pos[p++] = -(v - cv);
  }
  const idx = [];
  for (let j = 0; j < seg; j++) for (let i = 0; i < seg; i++) {
    const a = j * N + i, b = a + 1, c = a + N, d = c + 1;
    // pick the diagonal that follows the terrain better (reduces zig-zag along shores)
    const ya = pos[a * 3 + 1], yb = pos[b * 3 + 1], yc = pos[c * 3 + 1], yd = pos[d * 3 + 1];
    if (Math.abs(ya - yd) < Math.abs(yb - yc)) idx.push(a, b, d, a, d, c); else idx.push(a, b, c, b, d, c);
  }
  // skirts (hide hairline cracks between tiles of different resolution)
  const ring = [];
  for (let i = 0; i < N; i++) ring.push(i);                       // v0 edge
  for (let j = 1; j < N; j++) ring.push(j * N + seg);              // u1 edge
  for (let i = seg - 1; i >= 0; i--) ring.push(seg * N + i);       // v1 edge
  for (let j = seg - 1; j >= 1; j--) ring.push(j * N);             // u0 edge
  ring.push(0);
  let base = N * N;
  const skirtIdx = [];
  for (let r = 0; r < ring.length; r++) {
    const s = ring[r];
    pos[p++] = pos[s * 3]; pos[p++] = pos[s * 3 + 1] - 9; pos[p++] = pos[s * 3 + 2];
  }
  for (let r = 0; r < ring.length - 1; r++) {
    const a = ring[r], b = ring[r + 1], a2 = base + r, b2 = base + r + 1;
    skirtIdx.push(a, a2, b, b, a2, b2, a, b, a2, b, b2, a2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos.subarray(0, p), 3));
  g.setIndex(idx.concat(skirtIdx));
  g.computeVertexNormals();
  // skirt normals copy their top vertex so the seam is invisible
  const nrm = g.attributes.normal.array;
  for (let r = 0; r < ring.length; r++) { const s = ring[r], t = base + r; nrm[t * 3] = nrm[s * 3]; nrm[t * 3 + 1] = nrm[s * 3 + 1]; nrm[t * 3 + 2] = nrm[s * 3 + 2]; }
  g.computeBoundingSphere();
  return { g, cu, cv };
}

function buildCanopy(u0, v0, seg) {
  const cell = TILE / seg, N = seg + 1, cu = u0 + TILE / 2, cv = v0 + TILE / 2;
  const pos = [], fsv = [];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const u = u0 + i * cell, v = v0 + j * cell;
    const fs = forestSDF(u, v);
    const t = terrainH(u, v);
    const top = 11 + 7 * fbm(u * 0.02, v * 0.02, 2);
    const h = fs > 0 ? t + top * smooth(0, 10, fs) : t - 4;     // drops BELOW the ground at the edge
    pos.push(u - cu, Math.max(h, fs > 0 ? t + 1.5 : h), -(v - cv)); fsv.push(fs);
  }
  const idx = [];
  for (let j = 0; j < seg; j++) for (let i = 0; i < seg; i++) {
    const a = j * N + i, b = a + 1, c = a + N, d = c + 1;
    if (Math.max(fsv[a], fsv[b], fsv[c], fsv[d]) > -2) idx.push(a, b, c, b, d, c);
  }
  if (!idx.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx); g.computeVertexNormals(); g.computeBoundingSphere();
  return { g, cu, cv };
}

export function buildTerrain(scene, opts = {}) {
  const ground = groundMaterial(), water = waterMaterial(), canopy = canopyMaterial();
  water.polygonOffset = true; water.polygonOffsetFactor = 1; water.polygonOffsetUnits = 2;
  const root = new THREE.Group(); root.name = 'terrain';
  const tiles = [], waters = [], canopies = [];
  let tris = 0;
  for (let ti = 0; ti < TILES_U; ti++) for (let tj = 0; tj < TILES_V; tj++) {
    const u0 = DOM.U0 + ti * TILE, v0 = DOM.V0 + tj * TILE;
    const c = classify(u0, v0);
    const dc = Math.hypot(u0 + TILE / 2, v0 + TILE / 2);
    if (c.hasLand) {
      let seg = 12;
      if (c.hasWater) seg = dc < 3500 ? 56 : 28;
      if (c.relief > 30) seg = Math.max(seg, 56);
      else if (c.relief > 14) seg = Math.max(seg, 24);
      const { g, cu, cv } = buildTile(u0, v0, seg);
      const m = new THREE.Mesh(g, ground);
      m.position.set(cu, 0, -cv); m.receiveShadow = true; m.matrixAutoUpdate = false; m.updateMatrix();
      m.userData.tile = [ti, tj];
      root.add(m); tiles.push(m); tris += g.index.count / 3;
    }
    if (c.hasWater) {
      const g = new THREE.PlaneGeometry(TILE, TILE, 2, 2); g.rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(g, water);
      m.position.set(u0 + TILE / 2, 0, -(v0 + TILE / 2)); m.receiveShadow = true; m.matrixAutoUpdate = false; m.updateMatrix();
      root.add(m); waters.push(m);
    }
    if (c.forest) {
      const r = buildCanopy(u0, v0, 32);
      if (r) {
        const m = new THREE.Mesh(r.g, canopy);
        m.position.set(r.cu, 0, -r.cv); m.castShadow = false; m.receiveShadow = true; m.matrixAutoUpdate = false; m.updateMatrix();
        root.add(m); canopies.push(m); tris += r.g.index.count / 3;
      }
    }
  }
  // ---- horizon ring: same height function beyond the domain (masks clamp at the edge, so the
  // river and the land simply continue), with cells that exactly abut the tiled area.
  const steps = [800, 800, 1600, 1600, 3200, 6400, 12800, 25600];
  const axis = (a0, a1) => {
    const L = []; let acc = a0; for (const s of steps) { acc -= s; L.unshift(acc); }
    const M = []; for (let a = a0; a <= a1 + 1; a += TILE) M.push(a);
    const R = []; acc = a1; for (const s of steps) { acc += s; R.push(acc); }
    return L.concat(M, R);
  };
  const xs = axis(DOM.U0, DOM.U1), zs = axis(DOM.V0, DOM.V1);
  const fp = [], fi = [], wp = [], wi = [];
  const vid = new Map();
  const vtx = (i, j) => {
    const k = i * 1000 + j; if (vid.has(k)) return vid.get(k);
    const u = xs[i], v = zs[j];
    let h = terrainH(u, v);
    const r = Math.hypot(u - 1800, v + 1400);
    h += (fbm(u * 0.0004, v * 0.0004, 3) - 0.4) * 40 * smooth(9000, 16000, r);
    const id = fp.length / 3; fp.push(u, h, -v); vid.set(k, id); return id;
  };
  for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < zs.length - 1; j++) {
    const inside = xs[i] >= DOM.U0 && xs[i + 1] <= DOM.U1 && zs[j] >= DOM.V0 && zs[j + 1] <= DOM.V1;
    if (inside) continue;
    const a = vtx(i, j), b = vtx(i + 1, j), c = vtx(i, j + 1), d = vtx(i + 1, j + 1);
    fi.push(a, b, c, b, d, c);
    const w0 = wp.length / 3;
    wp.push(xs[i], 0, -zs[j], xs[i + 1], 0, -zs[j], xs[i], 0, -zs[j + 1], xs[i + 1], 0, -zs[j + 1]);
    wi.push(w0, w0 + 1, w0 + 2, w0 + 1, w0 + 3, w0 + 2);
  }
  const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.Float32BufferAttribute(fp, 3)); fg.setIndex(fi); fg.computeVertexNormals();
  const far = new THREE.Mesh(fg, ground); far.receiveShadow = false; far.matrixAutoUpdate = false; root.add(far);
  const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(wp, 3)); wg.setIndex(wi); wg.computeVertexNormals();
  const farW = new THREE.Mesh(wg, water); farW.matrixAutoUpdate = false; root.add(farW); waters.push(farW);
  // ---- the Monteregian hills on the south-east horizon (sunk into the ground, never coplanar)
  const hillMat = new THREE.MeshStandardMaterial({ color: 0x3a4a2c, roughness: 1 });
  for (const [lat, lon, hgt, rad] of [[45.553, -73.312, 190, 2600], [45.550, -73.155, 390, 3200], [45.497, -73.012, 330, 2600], [45.405, -73.083, 230, 2200], [45.395, -72.983, 240, 2000]]) {
    const [u, v] = ll2g(lat, lon);
    const g = new THREE.SphereGeometry(1, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    const P = g.attributes.position;
    for (let k = 0; k < P.count; k++) {
      const x = P.getX(k), y = P.getY(k), z = P.getZ(k);
      const n = 0.82 + 0.3 * fbm(x * 2 + lat, z * 2 + lon, 3);
      P.setXYZ(k, x * rad * n, y * hgt * n * (0.8 + 0.4 * (1 - Math.abs(x))) - 40, z * rad * n);
    }
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, hillMat); m.position.set(u, 0, -v); m.matrixAutoUpdate = false; m.updateMatrix();
    root.add(m);
  }
  scene.add(root);
  return { root, tiles, waters, canopies, ground, water, canopy, tris };
}
