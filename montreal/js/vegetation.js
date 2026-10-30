// vegetation.js — street, yard, park and forest trees; street lamps; outdoor staircases.
// Trees and lamps are instanced per 800 m tile (frustum culled per tile) and dissolve with
// alpha-to-coverage at distance; far forest is carried by the canopy shell (terrain.js).
import * as THREE from 'three';
import {
  DOM, TILE, TILES_U, U, terrainH, waterSDF, parkSDF, forestSDF, roadSDF, roadEdge, district, D, mulberry, BOXES, EXCL, fbm,
} from './core.js';
import { TREE_SLOTS, LAMP_SLOTS, STAIRS } from './city.js';
import { treeMaterial, propMaterial, GlowField } from './shaders.js';

function withPart(g, part) {
  g = g.index ? g.toNonIndexed() : g;
  g.setAttribute('aPart', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count).fill(part), 1));
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'aPart'].includes(k)) g.deleteAttribute(k);
  return g;
}
function merge(list) {
  let n = 0; for (const g of list) n += g.attributes.position.count;
  const P = new Float32Array(n * 3), N = new Float32Array(n * 3), A = new Float32Array(n);
  let o = 0;
  for (const g of list) { P.set(g.attributes.position.array, o * 3); N.set(g.attributes.normal.array, o * 3); A.set(g.attributes.aPart.array, o); o += g.attributes.position.count; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(N, 3)); g.setAttribute('aPart', new THREE.BufferAttribute(A, 1));
  return g;
}
function blob(r, sx, sy, sz, x, y, z, seed) {
  const g = new THREE.IcosahedronGeometry(r, 0);
  const p = g.attributes.position, n = g.attributes.normal, rnd = mulberry(seed);
  const jit = new Map();
  for (let i = 0; i < p.count; i++) {
    const k = p.getX(i).toFixed(3) + p.getY(i).toFixed(3) + p.getZ(i).toFixed(3);
    if (!jit.has(k)) jit.set(k, 0.82 + rnd() * 0.32);
    const j = jit.get(k);
    const vx = p.getX(i) * j, vy = p.getY(i) * j, vz = p.getZ(i) * j;
    const l = Math.hypot(vx, vy, vz);
    n.setXYZ(i, vx / l, vy / l, vz / l);
    p.setXYZ(i, vx * sx + x, vy * sy + y, vz * sz + z);
  }
  return g;
}
export function deciduousGeo() {
  const trunk = new THREE.CylinderGeometry(0.16, 0.26, 4.2, 5, 1, true); trunk.translate(0, 2.1, 0);
  return merge([withPart(trunk, 0), withPart(blob(1, 3.0, 2.6, 3.0, 0, 5.6, 0, 3), 1), withPart(blob(1, 2.0, 1.8, 2.0, 0.9, 7.2, -0.5, 7), 1)]);
}
export function coniferGeo() {
  const trunk = new THREE.CylinderGeometry(0.14, 0.22, 2.4, 5, 1, true); trunk.translate(0, 1.2, 0);
  const parts = [withPart(trunk, 0)];
  for (let i = 0; i < 3; i++) { const c = new THREE.ConeGeometry(2.6 - i * 0.7, 3.4, 7, 1, true); c.translate(0, 3.0 + i * 2.1, 0); parts.push(withPart(c, 1)); }
  return merge(parts);
}

export function deciduousHiGeo() {
  const parts = [];
  const trunk = new THREE.CylinderGeometry(0.13, 0.3, 4.8, 8, 1, true); trunk.translate(0, 2.4, 0); parts.push(withPart(trunk, 0));
  for (const [a, t] of [[0.3, 0.7], [2.4, 0.6], [4.3, 0.75]]) {
    const b = new THREE.CylinderGeometry(0.05, 0.09, 2.4, 5, 1, true); b.translate(0, 1.2, 0); b.rotateZ(t); b.rotateY(a); b.translate(0, 3.5, 0); parts.push(withPart(b, 0));
  }
  const blobs = [[0, 6.0, 0, 2.2], [1.5, 5.4, 0.6, 1.6], [-1.4, 5.6, -0.5, 1.7], [0.4, 5.3, -1.6, 1.5], [-0.5, 5.2, 1.6, 1.5], [0.6, 7.3, 0.3, 1.5], [-0.8, 6.9, -0.7, 1.3], [1.6, 6.6, -1.0, 1.2]];
  blobs.forEach(([x, y, z, r], i) => { const g = new THREE.IcosahedronGeometry(1, 1); const p = g.attributes.position, n = g.attributes.normal, rnd = mulberry(11 + i);
    const seen = new Map();
    for (let k = 0; k < p.count; k++) { const key = p.getX(k).toFixed(3) + p.getY(k).toFixed(3) + p.getZ(k).toFixed(3); if (!seen.has(key)) seen.set(key, 0.85 + rnd() * 0.3); const j = seen.get(key);
      const vx = p.getX(k) * j, vy = p.getY(k) * j, vz = p.getZ(k) * j, l = Math.hypot(vx, vy, vz); n.setXYZ(k, vx / l, vy / l, vz / l); p.setXYZ(k, vx * r + x, vy * r * 0.85 + y, vz * r + z); }
    parts.push(withPart(g, 1)); });
  return merge(parts);
}
export function coniferHiGeo() {
  const trunk = new THREE.CylinderGeometry(0.12, 0.24, 3, 8, 1, true); trunk.translate(0, 1.5, 0);
  const parts = [withPart(trunk, 0)];
  for (let i = 0; i < 6; i++) { const c = new THREE.ConeGeometry(2.7 - i * 0.4, 2.6, 10, 1, true); c.translate(0, 2.4 + i * 1.25, 0); parts.push(withPart(c, 1)); }
  return merge(parts);
}

export class Vegetation {
  constructor(scene, quality) {
    this.scene = scene;
    this.group = new THREE.Group(); this.group.name = 'vegetation'; scene.add(this.group);
    const rnd = mulberry(1976);
    this.nearGrid = new Map(); this.nearData = [];
    const geoD = deciduousGeo(), geoC = coniferGeo();
    // forest uses its own (shorter) fade so the canopy shell can take over
    this.forestFade = { uFadeNear: { value: 520 }, uFadeFar: { value: 720 } };   // mirrored in U.uForestFade for the canopy shell
    const mats = {
      d: treeMaterial(false), c: treeMaterial(true),
      fd: treeMaterial(false), fc: treeMaterial(true),
    };
    for (const k of ['fd', 'fc']) {
      const m = mats[k]; m.name += 'F';
      const prev = m.onBeforeCompile;
      m.onBeforeCompile = (sh) => { prev(sh); sh.uniforms.uFadeNear = this.forestFade.uFadeNear; sh.uniforms.uFadeFar = this.forestFade.uFadeFar; };
    }
    this.mats = mats;
    // ---- collect slots per tile
    const tiles = new Map();
    const tkey = (u, v) => Math.floor((u - DOM.U0) / TILE) * 100 + Math.floor((v - DOM.V0) / TILE);
    const push = (cls, u, v, s, conifer) => {
      const k = tkey(u, v); let t = tiles.get(k);
      if (!t) tiles.set(k, t = { d: [], c: [], fd: [], fc: [], u: DOM.U0 + (Math.floor((u - DOM.U0) / TILE) + 0.5) * TILE, v: DOM.V0 + (Math.floor((v - DOM.V0) / TILE) + 0.5) * TILE });
      t[(cls === 'f' ? 'f' : '') + (conifer ? 'c' : 'd')].push([u, v, s]);
    };
    const okSpot = (u, v, clear = 1.8) => waterSDF(u, v) > 2.5 && roadEdge(u, v) > clear && !BOXES.inside(u, -v, terrainH(u, v) + 2, 1.2);
    let nStreet = 0;
    for (const [u, v, s, type] of TREE_SLOTS) {
      if (!okSpot(u, v, 0.6)) continue;
      push('s', u, v, s, type === 1); nStreet++;
    }
    // parks, cemeteries and woods: jittered grid scatter
    const inExcl = (u, v) => EXCL.some((e) => u > e[0] && u < e[1] && v > e[2] && v < e[3]);
    let nPark = 0, nForest = 0;
    const fstep = quality.forestStep || 7.5;
    for (let u = DOM.U0; u < DOM.U1; u += fstep) for (let v = DOM.V0; v < DOM.V1; v += fstep) {
      const ju = u + (rnd() - 0.5) * fstep * 0.9, jv = v + (rnd() - 0.5) * fstep * 0.9;
      const fs = forestSDF(ju, jv);
      if (fs > 1.5) {
        if (rnd() > 0.88 || !okSpot(ju, jv, 2.5) || inExcl(ju, jv)) continue;
        const clump = fbm(ju * 0.02, jv * 0.02, 2);
        push('f', ju, jv, 0.95 + rnd() * 0.55, rnd() < 0.12 + clump * 0.2); nForest++;
        continue;
      }
      const ps = parkSDF(ju, jv);
      if (ps > 3 && rnd() < 0.10 + 0.28 * fbm(ju * 0.01, jv * 0.01, 2)) {
        if (!okSpot(ju, jv, 3) || inExcl(ju, jv)) continue;
        if (district(ju, jv) === D.ISLANDS && rnd() < 0.3) continue;
        push('s', ju, jv, 0.95 + rnd() * 0.6, rnd() < 0.18); nPark++;
      }
    }
    // ---- build instanced meshes
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pos = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), col = new THREE.Color();
    const greens = [[0.20, 0.33, 0.10], [0.16, 0.29, 0.09], [0.25, 0.36, 0.12], [0.14, 0.25, 0.10], [0.28, 0.38, 0.14]];
    this.tileMeshes = [];
    let total = 0;
    for (const t of tiles.values()) {
      for (const key of ['d', 'c', 'fd', 'fc']) {
        const list = t[key]; if (!list.length) continue;
        const im = new THREE.InstancedMesh(key.endsWith('c') ? geoC : geoD, mats[key], list.length);
        list.forEach(([u, v, s], i) => {
          pos.set(u, terrainH(u, v) - 0.25, -v);
          const ry = rnd() * 6.283;
          q.setFromAxisAngle(up, ry);
          sc.set(s * (0.9 + rnd() * 0.2), s * (0.85 + rnd() * 0.3), s * (0.9 + rnd() * 0.2));
          m4.compose(pos, q, sc); im.setMatrixAt(i, m4);
          const g = greens[Math.floor(rnd() * greens.length)];
          im.setColorAt(i, col.setRGB(g[0], g[1], g[2]));
          this.nearAdd(pos.x, pos.y, pos.z, ry, sc.x, sc.y, sc.z, g, key.endsWith('c'));
        });
        im.castShadow = true; im.receiveShadow = true;
        im.computeBoundingSphere();
        im.userData.c = new THREE.Vector3(t.u, 0, -t.v); im.userData.forest = key.startsWith('f');
        this.group.add(im); this.tileMeshes.push(im); total += list.length;
      }
    }
    this.counts = { street: nStreet, park: nPark, forest: nForest, total };
    // near-camera high-detail trees (cross-faded with the tile trees by alpha-to-coverage)
    this.hiD = new THREE.InstancedMesh(deciduousHiGeo(), treeMaterial(false, true), 2600);
    this.hiC = new THREE.InstancedMesh(coniferHiGeo(), treeMaterial(true, true), 1200);
    for (const m of [this.hiD, this.hiC]) { m.count = 0; m.frustumCulled = false; m.castShadow = true; m.receiveShadow = true; m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(m.instanceMatrix.count * 3), 3); this.group.add(m); }
    this.lastNear = new THREE.Vector3(1e9, 0, 0);

    // ---- street lamps (instanced per tile) + glow sprites near the camera
    const lampGeo = (() => {
      const pole = new THREE.CylinderGeometry(0.08, 0.12, 8.2, 6); pole.translate(0, 4.1, 0);
      const arm = new THREE.BoxGeometry(1.9, 0.1, 0.1); arm.translate(-0.9, 8.1, 0);
      const head = new THREE.BoxGeometry(0.7, 0.16, 0.34); head.translate(-1.85, 8.0, 0);
      const gs = [pole, arm, head].map((g) => g.toNonIndexed());
      gs.forEach((g, i) => g.setAttribute('aGlow', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count).fill(i === 2 ? 1 : 0), 1)));
      return mergeSimple(gs);
    })();
    const lanternGeo = (() => {
      const pole = new THREE.CylinderGeometry(0.07, 0.11, 3.6, 8); pole.translate(0, 1.8, 0);
      const box = new THREE.CylinderGeometry(0.22, 0.16, 0.55, 6); box.translate(0, 3.9, 0);
      const cap = new THREE.ConeGeometry(0.3, 0.3, 6); cap.translate(0, 4.32, 0);
      const gs = [pole, box, cap].map((g) => g.toNonIndexed());
      gs.forEach((g, i) => g.setAttribute('aGlow', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count).fill(i === 1 ? 1 : 0), 1)));
      return mergeSimple(gs);
    })();
    const lampMat = propMaterial({ color: 0x3b3f44, roughness: 0.5, metalness: 0.6, name: 'lamp' }, [3.2, 2.5, 1.7]);
    const lanternMat = propMaterial({ color: 0x1d2420, roughness: 0.5, metalness: 0.5, name: 'lantern' }, [3.6, 2.4, 1.2]);
    const lt = new Map();
    this.lampPts = [];
    for (const [u, v, fu, fv, old] of LAMP_SLOTS) {
      if (waterSDF(u, v) < 1.5 || parkSDF(u, v) > 0 || forestSDF(u, v) > 0 || roadSDF(u, v) > -0.5) continue;
      const y = terrainH(u, v);
      if (BOXES.inside(u, -v, y + 3, 0.3)) continue;
      const k = tkey(u, v); let a = lt.get(k); if (!a) lt.set(k, a = { s: [], o: [] });
      (old ? a.o : a.s).push([u, v, y, fu, fv]);
      this.lampPts.push(old ? [u, y + 3.9, v] : [u + fu * 1.85, y + 7.95, v + fv * 1.85]);
    }
    for (const [k, a] of lt) {
      for (const [list, geo, mat] of [[a.s, lampGeo, lampMat], [a.o, lanternGeo, lanternMat]]) {
        if (!list.length) continue;
        const im = new THREE.InstancedMesh(geo, mat, list.length);
        list.forEach(([u, v, y, fu, fv], i) => {
          const yaw = Math.atan2(-fv, -fu);   // arm (local -x) points toward the street
          m4.compose(pos.set(u, y - 0.1, -v), q.setFromAxisAngle(up, yaw), sc.set(1, 1, 1)); im.setMatrixAt(i, m4);
        });
        im.castShadow = false; im.computeBoundingSphere();
        const c = list[0]; im.userData.c = new THREE.Vector3(c[0], 0, -c[1]); im.userData.lamp = true;
        this.group.add(im); this.tileMeshes.push(im);
      }
    }
    this.lampGlow = new GlowField(2600); this.group.add(this.lampGlow.mesh);
    // ---- outdoor staircases + balconies near the camera
    this.stairGeo = stairGeometry(); this.balcGeo = balconyGeometry();
    const stairMat = propMaterial({ color: 0x23262a, roughness: 0.55, metalness: 0.5, name: 'stair' });
    this.stairs = new THREE.InstancedMesh(this.stairGeo, stairMat, 3000);
    this.balcs = new THREE.InstancedMesh(this.balcGeo, stairMat, 3000);
    for (const m of [this.stairs, this.balcs]) { m.count = 0; m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; this.group.add(m); }
    this.stairGrid = new Map();
    for (const s of STAIRS) { const k = Math.floor(s[0] / 100) * 1000 + Math.floor(s[1] / 100); let a = this.stairGrid.get(k); if (!a) this.stairGrid.set(k, a = []); a.push(s); }
    this.lastRefresh = new THREE.Vector3(1e9, 0, 0);
    this.propRadius = quality.propRadius || 320;
  }
  nearAdd(x, y, z, ry, sx, sy, sz, g, conifer) {
    const id = this.nearData.length;
    this.nearData.push([x, y, z, ry, sx, sy, sz, g[0], g[1], g[2], conifer ? 1 : 0]);
    const k = Math.floor(x / 50) * 100000 + Math.floor(z / 50);
    let a = this.nearGrid.get(k); if (!a) this.nearGrid.set(k, a = []); a.push(id);
  }
  updateNear(cam) {
    if (cam.distanceTo(this.lastNear) < 10) return;
    this.lastNear.copy(cam);
    const R = U.uNearFade.value.y + 8, R2 = R * R;
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), p = new THREE.Vector3(), s = new THREE.Vector3(), c = new THREE.Color();
    let nd = 0, nc = 0;
    for (let i = Math.floor((cam.x - R) / 50); i <= Math.floor((cam.x + R) / 50); i++) for (let j = Math.floor((cam.z - R) / 50); j <= Math.floor((cam.z + R) / 50); j++) {
      const a = this.nearGrid.get(i * 100000 + j); if (!a) continue;
      for (const id of a) {
        const t = this.nearData[id];
        const dx = t[0] - cam.x, dz = t[2] - cam.z; if (dx * dx + dz * dz > R2) continue;
        const mesh = t[10] ? this.hiC : this.hiD; const n = t[10] ? nc : nd;
        if (n >= mesh.instanceMatrix.count) continue;
        m4.compose(p.set(t[0], t[1], t[2]), q.setFromAxisAngle(up, t[3]), s.set(t[4], t[5], t[6]));
        mesh.setMatrixAt(n, m4); mesh.setColorAt(n, c.setRGB(t[7], t[8], t[9]));
        if (t[10]) nc++; else nd++;
      }
    }
    this.hiD.count = nd; this.hiC.count = nc;
    for (const m of [this.hiD, this.hiC]) { m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; }
  }
  setQuality(q) {
    this.propRadius = q.propRadius; U.uFadeNear.value = q.treeFade[0]; U.uFadeFar.value = q.treeFade[1];
    this.forestFade.uFadeNear.value = q.forestFade[0]; this.forestFade.uFadeFar.value = q.forestFade[1]; U.uForestFade.value.set(q.forestFade[0], q.forestFade[1]);
    U.uNearFade.value.set(q.nearTrees * 0.75, q.nearTrees);
    this.lastRefresh.set(1e9, 0, 0); this.lastNear.set(1e9, 0, 0);
  }
  update(cam) {
    this.updateNear(cam);
    const farT = U.uFadeFar.value + 450, farF = this.forestFade.uFadeFar.value + 450;
    for (const m of this.tileMeshes) {
      const c = m.userData.c;
      const d = Math.hypot(c.x - cam.x, c.z - cam.z) - TILE * 0.72;
      m.visible = d < (m.userData.forest ? farF : m.userData.lamp ? U.uFadeFar.value * 0.6 + 200 : farT);
    }
    if (cam.distanceTo(this.lastRefresh) < 45) return;
    this.lastRefresh.copy(cam);
    // lamp heads near the camera get a glow sprite
    const lg = this.lampGlow; lg.n = 0;
    const R2 = Math.pow(Math.min(650, this.propRadius * 2), 2);
    for (const [u, y, v] of this.lampPts) {
      const dx = u - cam.x, dz = -v - cam.z; if (dx * dx + dz * dz > R2) continue;
      if (lg.add(u, y - 0.1, -v, 1.0, 0.82, 0.6, 0.85, 0.9, 0) < 0) break;
    }
    lg.commit();
    // staircases
    const R = this.propRadius, cu = cam.x, cv = -cam.z;
    let ns = 0, nb = 0;
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), p = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
    for (let i = Math.floor((cu - R) / 100); i <= Math.floor((cu + R) / 100); i++) for (let j = Math.floor((cv - R) / 100); j <= Math.floor((cv + R) / 100); j++) {
      const a = this.stairGrid.get(i * 1000 + j); if (!a) continue;
      for (const [fu, v, base, dir, floors, setback] of a) {
        if ((fu - cu) ** 2 + (v - cv) ** 2 > R * R) continue;
        q.setFromAxisAngle(up, dir > 0 ? 0 : Math.PI);
        if (ns < 3000) { m4.compose(p.set(fu, base, -v), q, one); this.stairs.setMatrixAt(ns++, m4); }
        if (floors >= 3 && nb < 3000) { m4.compose(p.set(fu, base + 3.15, -v), q, one); this.balcs.setMatrixAt(nb++, m4); }
      }
    }
    this.stairs.count = ns; this.balcs.count = nb;
    this.stairs.instanceMatrix.needsUpdate = true; this.balcs.instanceMatrix.needsUpdate = true;
  }
}
function mergeSimple(gs) {
  let n = 0; for (const g of gs) n += g.attributes.position.count;
  const out = new THREE.BufferGeometry();
  for (const name of Object.keys(gs[0].attributes)) {
    const size = gs[0].attributes[name].itemSize, arr = new Float32Array(n * size); let o = 0;
    for (const g of gs) { arr.set(g.attributes[name].array, o); o += g.attributes[name].array.length; }
    out.setAttribute(name, new THREE.BufferAttribute(arr, size));
  }
  out.computeBoundingSphere();
  return out;
}
// Montreal outdoor staircase (local +x = toward the street, facade at x = 0)
function stairGeometry() {
  const gs = [];
  const add = (g, x, y, z) => { g.translate(x, y, z); gs.push(g.toNonIndexed()); };
  add(new THREE.BoxGeometry(1.45, 0.14, 3.2), 0.76, 3.15, 1.2);                          // 2nd-floor balcony slab
  add(new THREE.BoxGeometry(0.05, 0.9, 3.2), 1.46, 3.67, 1.2);                           // balcony railing
  add(new THREE.BoxGeometry(1.45, 0.05, 0.05), 0.76, 4.1, 2.78);
  for (let i = 0; i < 12; i++) add(new THREE.BoxGeometry(0.9, 0.06, 0.3), 1.95, 0.26 * (i + 1), -2.0 + i * 0.27);  // treads
  for (const z of [-2.1, -0.4, 1.2, 2.8]) add(new THREE.BoxGeometry(0.07, 3.1, 0.07), 2.0 - (z > 1 ? 0.6 : 0), 1.55, z);   // posts
  const g = mergeSimple(gs.map((x) => { for (const k of Object.keys(x.attributes)) if (k !== 'position' && k !== 'normal') x.deleteAttribute(k); return x; }));
  return g;
}
function balconyGeometry() {
  const gs = [];
  const add = (g, x, y, z) => { g.translate(x, y, z); gs.push(g.toNonIndexed()); };
  add(new THREE.BoxGeometry(1.3, 0.12, 3.2), 0.68, 3.15, 1.2);
  add(new THREE.BoxGeometry(0.05, 0.9, 3.2), 1.31, 3.66, 1.2);
  for (const z of [-0.38, 2.78]) add(new THREE.BoxGeometry(0.06, 3.15, 0.06), 1.3, 1.6, z);
  return mergeSimple(gs.map((x) => { for (const k of Object.keys(x.attributes)) if (k !== 'position' && k !== 'normal') x.deleteAttribute(k); return x; }));
}
