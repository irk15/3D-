// Streams OpenStreetMap vector tiles around the camera and turns them into merged 3D meshes (time-sliced, no hitches).
import * as THREE from 'three';
import Pbf from 'pbf';
import { VectorTile } from '@mapbox/vector-tile';
import { CFG } from './config.js';
import { tileOfLonLat, tileFrame, x2lon, z2lat } from './proj.js';
import { buildBuildings, makeFacadeTextures } from './buildings.js';
import { buildFlat } from './flat.js';
import { buildTrees } from './trees.js';

export class TileManager {
  constructor(scene, renderer) {
    this.scene = scene; this.tiles = new Map(); this.queue = []; this.jobs = []; this.active = 0; this.url = null; this.status = 'starting';
    const tex = makeFacadeTextures(renderer);
    this.wallMat = new THREE.MeshStandardMaterial({ vertexColors: true, map: tex.map, emissiveMap: tex.emissiveMap, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.78, metalness: 0.05 });
    this.roofMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });
    this.landMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 });
    this.roadMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    this.zoom = CFG.ZOOM; this.radius = CFG.RADIUS; this.last = null;
  }
  async init() {
    try {
      const r = await fetch(CFG.TILEJSON); const j = await r.json();
      this.url = j.tiles[0]; this.status = 'tiles ready';
    } catch (e) { this.status = 'TILE SOURCE UNREACHABLE: ' + e.message; throw e; }
  }
  setNight(v) { this.wallMat.emissiveIntensity = v * 1.15; }
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
      const r = j.gen.next();
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
    const T = { ...F, extent: ext }, seed = (t.x * 73856093) ^ (t.y * 19349663), group = new THREE.Group();
    const flat = yield* buildFlat(vt, T, seed); yield;
    const add = (g, m, order = 0) => { if (!g) return; const mesh = new THREE.Mesh(g, m); mesh.matrixAutoUpdate = false; mesh.renderOrder = order; group.add(mesh); };
    add(flat.land, this.landMat); add(flat.roads, this.roadMat);
    const trees = buildTrees(flat.treeTris, seed); if (trees) group.add(trees); yield;
    if (vt.layers.building) { const b = yield* buildBuildings(vt.layers.building, T, seed); add(b.walls, this.wallMat); add(b.roofs, this.roofMat); }
    return group;
  }
  drop(k, rec) { if (rec.job) rec.job.dead = true; if (rec.group) { this.scene.remove(rec.group); this.dispose(rec.group); } this.tiles.delete(k); }
  dispose(g) { g.traverse((o) => { if (o.geometry && !o.isInstancedMesh) o.geometry.dispose(); if (o.isInstancedMesh) o.dispose(); }); }
  get loaded() { let n = 0; for (const t of this.tiles.values()) if (t.group) n++; return n; }
  get total() { return this.tiles.size + this.queue.length; }
}
