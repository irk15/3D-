// Map labels: street names painted flat on the roads, floating place / landmark labels. One small text atlas per tile.
import * as THREE from 'three';
import { lines } from './geom.js';
import { ROAD, roadClass } from './flat.js';

const AW = 1024, AH = 512, ROWH = 34;
const SHOW = { motorway: 1, trunk: 1, primary: 1, secondary: 1, tertiary: 1, minor: 1 };
const POI_OK = new Set(['attraction', 'museum', 'zoo', 'stadium', 'theatre', 'cinema', 'library', 'university', 'college', 'hospital', 'park', 'castle', 'monument', 'railway', 'town_hall', 'courthouse', 'art_gallery', 'arts_centre', 'aquarium', 'garden', 'place_of_worship', 'embassy', 'lodging', 'stadium', 'marina', 'harbour', 'ferry_terminal', 'bus', 'fuel']);
const POI_GOOD = (p) => POI_OK.has(p.class) || POI_OK.has(p.subclass);
const PLACE = { suburb: 1, neighbourhood: 1, quarter: 1, village: 1, town: 1, city: 1, borough: 1 };

class Atlas {
  constructor() { this.c = document.createElement('canvas'); this.c.width = AW; this.c.height = AH; this.x = this.c.getContext('2d'); this.px = 4; this.py = 4; this.map = new Map(); this.n = 0; }
  add(text, kind) { // returns {u0,v0,u1,v1,aspect} or null if the atlas is full
    const key = kind + '|' + text, hit = this.map.get(key); if (hit) return hit;
    const x = this.x, big = kind === 'place', size = big ? 28 : 22;
    x.font = `${big ? 700 : 600} ${size}px system-ui, Segoe UI, Arial, sans-serif`;
    const w = Math.ceil(Math.min(x.measureText(text).width, 420)) + 12;
    if (this.px + w > AW - 4) { this.px = 4; this.py += ROWH; }
    if (this.py + ROWH > AH) return null;
    x.textBaseline = 'middle'; x.lineJoin = 'round'; x.lineWidth = big ? 6 : 5;
    x.strokeStyle = kind === 'street' ? 'rgba(10,12,16,0.85)' : 'rgba(6,8,14,0.9)';
    x.fillStyle = kind === 'street' ? '#f6f2e4' : kind === 'poi' ? '#ffe4a0' : '#ffffff';
    const cy = this.py + ROWH / 2;
    x.strokeText(text, this.px + 6, cy, 420); x.fillText(text, this.px + 6, cy, 420);
    const r = { u0: this.px / AW, u1: (this.px + w) / AW, v0: 1 - (this.py + ROWH) / AH, v1: 1 - this.py / AH, aspect: w / ROWH };
    this.px += w + 4; this.map.set(key, r); this.n++; return r;
  }
  texture(renderer) { const t = new THREE.CanvasTexture(this.c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; return t; }
}

const BILL_VS = `attribute vec3 ctr; attribute vec2 cor; varying vec2 vUv; varying float vD;
#include <common>
#include <logdepthbuf_pars_vertex>
uniform float uGrow;
void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(ctr, 1.0); vD = -mv.z; float s = max(1.0, vD / uGrow); mv.xy += cor * s; gl_Position = projectionMatrix * mv;
#include <logdepthbuf_vertex>
}`;
const BILL_FS = `uniform sampler2D map; uniform vec4 uFade; varying vec2 vUv; varying float vD;
#include <common>
#include <logdepthbuf_pars_fragment>
void main(){
#include <logdepthbuf_fragment>
  vec4 t = texture2D(map, vUv); float f = smoothstep(uFade.x, uFade.y, vD) * (1.0 - smoothstep(uFade.z, uFade.w, vD)); t.a *= f; if (t.a < 0.06) discard;
  gl_FragColor = t;
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`;

export function flatMaterial(tex) {
  const m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6, toneMapped: false });
  m.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <fog_fragment>', '#include <fog_fragment>\n gl_FragColor.a *= 0.92 * (1.0 - smoothstep(450.0, 1300.0, vFogDepth)); if (gl_FragColor.a < 0.04) discard;'); };
  m.customProgramCacheKey = () => 'tc-flat-label';
  return m;
}
export function billboardMaterial(tex, grow, fade) {
  return new THREE.ShaderMaterial({ uniforms: { map: { value: tex }, uGrow: { value: grow }, uFade: { value: new THREE.Vector4(...fade) } }, vertexShader: BILL_VS, fragmentShader: BILL_FS, transparent: true, depthWrite: false, fog: false });
}

// returns { atlas texture, flat geometry, poi geometry, place geometry } for a tile
export function buildLabels(vt, T, seed, occ, renderer) {
  const atlas = new Atlas(), x0 = T.x0, z0 = T.z0, x1 = T.x0 + T.sx, z1 = T.z0 + T.sz;
  const fp = [], fu = [], fi = []; // flat street names
  const quad = (P, U, I, cx, cy, cz, rx, rz, ux, uz, hw, hh, r, zoff) => { // ground-parallel or billboard-ready quad
    const o = P.length / 3;
    P.push(cx - rx * hw - ux * hh, cy, cz - rz * hw - uz * hh, cx + rx * hw - ux * hh, cy, cz + rz * hw - uz * hh, cx + rx * hw + ux * hh, cy, cz + rz * hw + uz * hh, cx - rx * hw + ux * hh, cy, cz - rz * hw + uz * hh);
    U.push(r.u0, r.v0, r.u1, r.v0, r.u1, r.v1, r.u0, r.v1); I.push(o, o + 1, o + 2, o, o + 2, o + 3);
  };
  const TN = vt.layers.transportation_name;
  if (TN) {
    const used = new Map();
    for (let i = 0; i < TN.length; i++) {
      const f = TN.feature(i), p = f.properties, name = p.name || p['name:latin'];
      if (!name || f.type !== 2) continue;
      const cls = roadClass(p); if (!SHOW[cls]) continue;
      const hw = ROAD[cls][0], r = atlas.add(name, 'street'); if (!r) break;
      const th = Math.min(7.5, Math.max(3.4, hw * 0.85)), tw = th * r.aspect;
      for (const ln of lines(f, T)) {
        let since = 160 + (hash(seed + i) * 120); // metres since last label on this line
        for (let j = 1; j < ln.length; j++) {
          let a = ln[j - 1], b = ln[j]; const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz);
          since += len; if (len < tw * 1.05 || since < 280) continue;
          const cx = (a[0] + b[0]) / 2, cz = (a[1] + b[1]) / 2; if (cx < x0 + 8 || cx > x1 - 8 || cz < z0 + 8 || cz > z1 - 8) continue;
          if ((used.get(name) || 0) >= 4) continue;
          let ux = dx / len, uz = dz / len; if (ux < -1e-6 || (Math.abs(ux) < 1e-6 && uz > 0)) { ux = -ux; uz = -uz; }
          quad(fp, fu, fi, cx, ROAD[cls][2] + 0.42, cz, ux, uz, uz, -ux, tw / 2, th / 2, r); since = 0; used.set(name, (used.get(name) || 0) + 1);
        }
      }
    }
  }
  // floating billboards: points of interest and place names
  const mkBill = () => ({ ctr: [], cor: [], uv: [], idx: [] });
  const poi = mkBill(), place = mkBill();
  const bill = (B, r, x, y, z, hh) => { const w = hh * r.aspect, o = B.ctr.length / 3; for (let k = 0; k < 4; k++) B.ctr.push(x, y, z); B.cor.push(-w / 2, 0, w / 2, 0, w / 2, hh, -w / 2, hh); B.uv.push(r.u0, r.v0, r.u1, r.v0, r.u1, r.v1, r.u0, r.v1); B.idx.push(o, o + 1, o + 2, o, o + 2, o + 3); };
  const PO = vt.layers.poi;
  if (PO) {
    const list = [];
    for (let i = 0; i < PO.length; i++) { const f = PO.feature(i), p = f.properties; if (!p.name || f.type !== 1 || !POI_GOOD(p)) continue; list.push({ i, rank: +p.rank || 50 }); }
    list.sort((a, b) => a.rank - b.rank);
    for (const { i } of list.slice(0, 22)) {
      const f = PO.feature(i), p = f.properties, g = f.loadGeometry()[0][0], x = T.x0 + (g.x / T.extent) * T.sx, z = T.z0 + (g.y / T.extent) * T.sz;
      if (x < x0 || x > x1 || z < z0 || z > z1) continue;
      const r = atlas.add(p.name, 'poi'); if (!r) break;
      bill(poi, r, x, Math.max(16, occ.at(x, z) + 8), z, 5.2);
    }
  }
  const PL = vt.layers.place;
  if (PL) for (let i = 0; i < PL.length; i++) {
    const f = PL.feature(i), p = f.properties; if (!p.name || f.type !== 1 || !PLACE[p.class]) continue;
    const g = f.loadGeometry()[0][0], x = T.x0 + (g.x / T.extent) * T.sx, z = T.z0 + (g.y / T.extent) * T.sz;
    if (x < x0 || x > x1 || z < z0 || z > z1) continue;
    const r = atlas.add(p.name, 'place'); if (!r) break;
    bill(place, r, x, 150, z, 26);
  }
  if (!atlas.n) return null;
  const mk = (B) => { if (!B.idx.length) return null; const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(B.ctr, 3)); g.setAttribute('ctr', new THREE.Float32BufferAttribute(B.ctr, 3)); g.setAttribute('cor', new THREE.Float32BufferAttribute(B.cor, 2)); g.setAttribute('uv', new THREE.Float32BufferAttribute(B.uv, 2)); g.setIndex(B.idx); g.boundingSphere = new THREE.Sphere(new THREE.Vector3((x0 + x1) / 2, 60, (z0 + z1) / 2), T.sx * 0.9); return g; };
  let flat = null;
  if (fi.length) {
    flat = new THREE.BufferGeometry(); flat.setAttribute('position', new THREE.Float32BufferAttribute(fp, 3)); flat.setAttribute('uv', new THREE.Float32BufferAttribute(fu, 2));
    const nn = new Float32Array(fp.length); for (let i = 1; i < nn.length; i += 3) nn[i] = 1; flat.setAttribute('normal', new THREE.BufferAttribute(nn, 3)); flat.setIndex(fi); flat.computeBoundingSphere();
    // quads were built with arbitrary winding; make every triangle face up
    const ix = flat.index.array;
    for (let t = 0; t < ix.length; t += 3) { const a = ix[t] * 3, b = ix[t + 1] * 3, c = ix[t + 2] * 3; const cy = (fp[b] - fp[a]) * (fp[c + 2] - fp[a + 2]) - (fp[b + 2] - fp[a + 2]) * (fp[c] - fp[a]); if (cy > 0) { const q = ix[t + 1]; ix[t + 1] = ix[t + 2]; ix[t + 2] = q; } }
  }
  return { atlas, tex: atlas.texture(renderer), flat, poi: mk(poi), place: mk(place) };
}
function hash(n) { n = (n ^ 61) ^ (n >>> 16); n = (n + (n << 3)) | 0; n ^= n >>> 4; n = Math.imul(n, 0x27d4eb2d); n ^= n >>> 15; return (n >>> 0) / 4294967296; }
