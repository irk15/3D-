// Streams OpenStreetMap vector tiles around the camera and turns them into merged 3D meshes (time-sliced, no hitches).
import * as THREE from 'three';
import Pbf from 'pbf';
import { VectorTile } from '@mapbox/vector-tile';
import { CFG } from './config.js';
import { tileOfLonLat, tileFrame, x2lon, z2lat } from './proj.js';
import { buildBuildings, makeFacadeTextures, Occ } from './buildings.js';
import { buildStreets } from './streets.js';
import { buildLamps, makePoolTexture } from './props.js';
import { patchWeather } from '../../lib/atmosphere.js';
import { MIRROR_LAYER } from '../../lib/mirror.js';
import { buildLabels, flatMaterial, billboardMaterial } from './labels.js';
import { buildFlat } from './flat.js';
import { buildTrees, instTrees } from './trees.js';

export class TileManager {
  constructor(scene, renderer) {
    this.scene = scene; this.tiles = new Map(); this.queue = []; this.jobs = []; this.active = 0; this.url = null; this.status = 'starting';
    this.renderer = renderer;
    const tex = makeFacadeTextures(renderer);
    const wm = (k, rough, metal, env) => new THREE.MeshStandardMaterial({ vertexColors: true, map: tex[k].map, emissiveMap: tex[k].emissiveMap, emissive: 0xffffff, emissiveIntensity: 0, roughness: rough, metalness: metal, envMapIntensity: env });
    this.wallMats = { glass: wm('glass', 0.22, 0.5, 1.5), concrete: wm('concrete', 0.7, 0.08, 0.5), brick: wm('brick', 0.92, 0.02, 0.35) };
    this.roofMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });
    this.detailMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0.05 });
    this.landMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 });
    this.roadMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    patchWeather(this.roofMat, { snow: 1, wet: 0.8, key: 'roof' }); patchWeather(this.detailMat, { snow: 1, wet: 0.8, key: 'det' });
    patchWeather(this.landMat, { snow: 0.95, wet: 0.6, key: 'land' }); patchWeather(this.roadMat, { snow: 0.55, wet: 1, key: 'road' });
    // animated water: sky-reflecting, gently rippled normals
    this.waterU = { value: 0 };
    this.waterMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.06, metalness: 0.15, envMapIntensity: 1.6, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    this.waterMat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = this.waterU; const mu = this.mirrorU || { tMirror: { value: null }, uMirrorMat: { value: new THREE.Matrix4() }, uMirrorOn: { value: 0 } }; Object.assign(sh.uniforms, mu);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP; uniform float uTime; uniform sampler2D tMirror; uniform mat4 uMirrorMat; uniform float uMirrorOn;')
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        { vec2 p = vWP.xz; float t = uTime;
          vec2 g = vec2(sin(p.x*0.23+t*0.9)+0.6*sin(p.y*0.31-t*0.7)+0.5*sin((p.x+p.y)*0.11+t*0.5)+0.35*sin(p.x*0.9+p.y*0.6+t*1.7),
                        cos(p.y*0.27+t*0.8)+0.6*cos(p.x*0.19-t*0.6)+0.5*sin((p.x-p.y)*0.13+t*0.4)+0.35*cos(p.y*0.8-p.x*0.5+t*1.5));
          normal = normalize(normal + (viewMatrix * vec4(g.x, 0.0, g.y, 0.0)).xyz * 0.035); }`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        if (uMirrorOn > 0.5) { vec4 mc = uMirrorMat * vec4(vWP, 1.0); vec2 muv = mc.xy / mc.w + normal.xz * 0.02; vec3 mir = texture2D(tMirror, clamp(muv, 0.001, 0.999)).rgb; float fr = 0.06 + 0.9 * pow(1.0 - clamp(dot(normalize(vViewPosition), normal), 0.0, 1.0), 4.0); totalEmissiveRadiance += mir * fr * 0.85; }`);
    };
    this.zebraMat = this.decalMat(0, 0.85);
    this.dashMat = this.decalMat(1, 0.8);
    this.lampMats = { pole: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.4 }), head: new THREE.MeshBasicMaterial({ color: 0x3a3a3a, toneMapped: false }),
      pool: new THREE.MeshBasicMaterial({ map: makePoolTexture(), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -5 }) };
    this.shadows = true;
    this.zoom = CFG.ZOOM; this.radius = CFG.RADIUS; this.last = null;
  }
  decalMat(kind, rough) { // kind 0: zebra bars across the road, 1: dashed lane line
    const c = document.createElement('canvas'); c.width = 32; c.height = 32; const x = c.getContext('2d'); x.fillStyle = '#fff';
    if (kind === 0) x.fillRect(0, 0, 16, 32); else x.fillRect(0, 0, 32, 11);
    const tx = new THREE.CanvasTexture(c); tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 8; tx.magFilter = THREE.LinearFilter;
    return new THREE.MeshStandardMaterial({ vertexColors: true, map: tx, alphaTest: 0.5, roughness: rough, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  }
  async init() {
    try {
      const r = await fetch(CFG.TILEJSON); const j = await r.json();
      this.url = j.tiles[0]; this.status = 'tiles ready';
    } catch (e) { this.status = 'TILE SOURCE UNREACHABLE: ' + e.message; throw e; }
  }
  setNight(v) {
    for (const k in this.wallMats) this.wallMats[k].emissiveIntensity = v * (k === 'glass' ? 1.25 : 1.1);
    this.lampMats.head.color.setRGB(0.25 + v * 3.2, 0.24 + v * 2.5, 0.2 + v * 1.4); this.lampMats.pool.opacity = Math.min(1, v) * 0.5;
  }
  setShadows(on) { this.shadows = on; for (const rec of this.tiles.values()) if (rec.group) rec.group.traverse((o) => { if (o.userData.cs) o.castShadow = on; if (o.userData.rs) o.receiveShadow = on; }); }
  tileSize() { return 40075016 * Math.cos((43.65 * Math.PI) / 180) / 2 ** this.zoom; }

  update(cam, budgetMs = 7) {
    if (!this.url) return;
    const c = tileOfLonLat(x2lon(cam.x), z2lat(cam.z), this.zoom), key = c.x + ',' + c.y;
    if (key !== this.last) {
      this.last = key; this.queue = [];
      for (let dy = -this.radius; dy <= this.radius; dy++) for (let dx = -this.radius; dx <= this.radius; dx++) {
        const x = c.x + dx, y = c.y + dy, k = x + ',' + y;
        if (!this.tiles.has(k)) this.queue.push({ x, y, k, d: dx * dx + dy * dy });
      }
      this.queue.sort((a, b) => a.d - b.d);
      for (const [k, t] of this.tiles) { const [tx, ty] = k.split(',').map(Number); if (Math.max(Math.abs(tx - c.x), Math.abs(ty - c.y)) > this.radius + 1) this.drop(k, t); }
    }
    while (this.active < 4 && this.queue.length) this.fetchTile(this.queue.shift());
    // run build jobs inside a per-frame time budget
    const t0 = performance.now();
    while (this.jobs.length && performance.now() - t0 < budgetMs) {
      const j = this.jobs[0];
      if (j.dead) { this.jobs.shift(); continue; }
      let r; try { r = j.gen.next(); } catch (e) { console.warn('tile build failed', e); this.status = 'tile build error: ' + e.message; this.jobs.shift(); continue; }
      if (r.done) { this.jobs.shift(); j.finish(r.value); }
    }
  }
  async fetchTile(t) {
    this.tiles.set(t.k, { group: null, loading: true }); this.active++;
    try {
      const u = this.url.replace('{z}', this.zoom).replace('{x}', t.x).replace('{y}', t.y);
      const res = await fetch(u); if (!res.ok) throw new Error(res.status);
      const vt = new VectorTile(new Pbf(new Uint8Array(await res.arrayBuffer())));
      const rec = this.tiles.get(t.k); if (!rec) return;
      const job = { dead: false, gen: this.build(vt, t), finish: (g) => { if (this.tiles.get(t.k) === rec) { rec.group = g; rec.loading = false; this.scene.add(g); } else this.dispose(g); } };
      rec.job = job; this.jobs.push(job);
    } catch (e) { this.tiles.delete(t.k); this.status = 'tile error ' + e.message; }
    finally { this.active--; }
  }
  *build(vt, t) {
    const F = tileFrame(t.x, t.y, this.zoom), ext = (vt.layers.building || vt.layers.transportation || { extent: 4096 }).extent || 4096;
    const T = { ...F, extent: ext }, seed = (t.x * 73856093) ^ (t.y * 19349663), group = new THREE.Group(), occ = new Occ();
    const add = (g, m, o = {}) => { if (!g) return null; const mesh = new THREE.Mesh(g, m); mesh.matrixAutoUpdate = false; mesh.renderOrder = o.order || 0; mesh.userData.cs = !!o.cast; mesh.userData.rs = !!o.recv; if (o.mirror) mesh.layers.enable(MIRROR_LAYER); mesh.castShadow = !!o.cast && this.shadows; mesh.receiveShadow = !!o.recv && this.shadows; group.add(mesh); return mesh; };
    const flat = yield* buildFlat(vt, T, seed); yield;
    add(flat.land, this.landMat, { recv: true, mirror: true }); add(flat.water, this.waterMat, { recv: false }); add(flat.roads, this.roadMat, { recv: true });
    if (vt.layers.building) {
      const b = yield* buildBuildings(vt.layers.building, T, seed, occ);
      for (const k in b.walls) add(b.walls[k], this.wallMats[k], { cast: true, recv: true, mirror: true });
      add(b.roofs, this.roofMat, { cast: true, recv: true, mirror: true }); add(b.detail, this.detailMat, { cast: true, recv: true, mirror: true });
    }
    yield;
    let st = {}; try { st = yield* buildStreets(vt, T, seed, occ); } catch (e) { console.warn('streets failed', e); }
    add(st.dash, this.dashMat, { order: 1, recv: true }); add(st.zebra, this.zebraMat, { order: 1, recv: true });
    const lamps = st.lamps && buildLamps(st.lamps, this.lampMats); if (lamps) { lamps.traverse((o) => { if (o.isMesh) { o.userData.cs = o.castShadow; } }); group.add(lamps); }
    yield;
    const trees = buildTrees(flat.treeTris, seed); if (trees) { trees.castShadow = this.shadows; trees.userData.cs = true; group.add(trees); }
    const sTrees = st.trees && instTrees(st.trees); if (sTrees) { sTrees.castShadow = this.shadows; sTrees.userData.cs = true; group.add(sTrees); }
    yield;
    try {
      const lb = buildLabels(vt, T, seed, occ, this.renderer);
      if (lb) {
        group.userData.tex = lb.tex;
        if (lb.flat) { const m = new THREE.Mesh(lb.flat, flatMaterial(lb.tex)); m.userData.own = true; m.matrixAutoUpdate = false; m.renderOrder = 6; group.add(m); }
        if (lb.poi) { const m = new THREE.Mesh(lb.poi, billboardMaterial(lb.tex, 420, [60, 160, 1500, 2400])); m.userData.own = true; m.frustumCulled = true; m.renderOrder = 8; group.add(m); }
        if (lb.place) { const m = new THREE.Mesh(lb.place, billboardMaterial(lb.tex, 1400, [500, 1100, 7500, 11000])); m.userData.own = true; m.renderOrder = 9; group.add(m); }
      }
    } catch (e) { console.warn('labels failed', e); }
    return group;
  }
  drop(k, rec) { if (rec.job) rec.job.dead = true; if (rec.group) { this.scene.remove(rec.group); this.dispose(rec.group); } this.tiles.delete(k); }
  dispose(g) { g.traverse((o) => { if (o.geometry && !o.isInstancedMesh) o.geometry.dispose(); if (o.isInstancedMesh) o.dispose(); if (o.userData.own) o.material.dispose(); }); if (g.userData.tex) g.userData.tex.dispose(); }
  get loaded() { let n = 0; for (const t of this.tiles.values()) if (t.group) n++; return n; }
  get total() { return this.tiles.size + this.queue.length; }
}
