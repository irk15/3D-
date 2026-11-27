// Solid obstacles on the path and detailed scenery behind it.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export function buildProps(scene, rnd, mats, gaps, end) {
  const { rock, rockNormal, steel, rust, bark } = mats;
  const M = (color, roughness = .8, metalness = .05, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
  const grain = { normalMap: rockNormal, normalScale: new THREE.Vector2(.5, .5) };
  const wood = M(0x8a6038, .85, 0, grain), woodDark = M(0x4d321e, .9, 0, grain), olive = M(0x596238, .65, .35, grain), oliveDark = M(0x333a24, .7, .35),
    canvas = M(0x7c7248, .95, 0, { ...grain, side: THREE.DoubleSide }), sand = M(0x9a8258, 1, 0, grain), rubber = M(0x121214, .9, .05),
    stone = M(0x8d8878, .95, 0, { map: rock.map, normalMap: rockNormal }), moss = M(0x4c6a2c, 1, 0, grain), red = M(0x8c2a1a, .55, .45, grain),
    glass = M(0x1a3038, .08, .9), lamp = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff3020).multiplyScalar(3) }), warm = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffb050).multiplyScalar(2.2) });
  const root = new THREE.Group();
  const add = (g, geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); g.add(m); return m; };
  const B = (w, h, d) => new THREE.BoxGeometry(w, h, d), C = (a, b, h, s = 14) => new THREE.CylinderGeometry(a, b, h, s), cap = (r, l) => new THREE.CapsuleGeometry(r, l, 4, 10), T = (r, t) => new THREE.TorusGeometry(r, t, 8, 24);
  const group = (x, y = 0, z = 0, ry = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; root.add(g); return g; };
  function boulder(g, r, x, y, z, mat = stone, sy = .7) {
    const geo = new THREE.IcosahedronGeometry(r, 3), p = geo.attributes.position, v = new THREE.Vector3(), s = rnd(0, 9);
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const k = 1 + Math.sin(v.x * 3.1 / r + s) * .14 + Math.sin(v.y * 4.7 / r + s * 2) * .1 + Math.sin(v.z * 5.3 / r + s * 3) * .1; v.multiplyScalar(k); p.setXYZ(i, v.x, v.y * sy, v.z); }
    geo.computeVertexNormals(); add(g, geo, mat, x, y, z, 0, rnd(0, 6), 0);
  }

  // ----- obstacles: visible size matches the collision box exactly -----
  const obstacles = {
    crate(g, w, h) {
      add(g, B(w - .1, h - .06, 1.5), wood, 0, h / 2, 0);
      for (const z of [-.76, .76]) { for (const y of [.07, h - .07]) add(g, B(w, .14, .08), woodDark, 0, y, z); for (const x of [-w / 2 + .07, w / 2 - .07]) add(g, B(.14, h, .1), woodDark, x, h / 2, z); add(g, B(Math.hypot(w, h) - .25, .1, .06), woodDark, 0, h / 2, z, 0, 0, Math.atan2(h, w)); }
      add(g, B(w, .06, 1.58), woodDark, 0, h - .03, 0);
    },
    barrels(g, w, h) {
      for (const [x, z, m] of [[-w / 4, .25, red], [w / 4, -.1, olive], [-w / 6, -.75, rust]]) { add(g, C(w / 4, w / 4, h, 20), m, x, h / 2, z); for (const y of [.08, h * .35, h * .68, h - .03]) add(g, T(w / 4 + .005, .028), steel, x, y, z, Math.PI / 2); add(g, C(.07, .07, .05), steel, x + .1, h + .01, z); }
    },
    sandbags(g, w, h) {
      const rows = 4, bh = h / rows;
      for (let r = 0; r < rows; r++) { const n = r % 2 ? 2 : 3, bw = w / n; for (let i = 0; i < n; i++) for (const z of [-.45, .2, .75]) { const m = add(g, cap(bh * .55, Math.max(.05, bw - bh * 1.1)), sand, -w / 2 + bw * (i + .5), bh * (r + .5), z + rnd(-.05, .05), 0, rnd(-.08, .08), Math.PI / 2); m.scale.set(.92, 1, 1.25); } }
    },
    log(g, w, h) {
      add(g, C(h / 2, h / 2 * 1.08, 2.4, 16), bark, 0, h / 2, 0, Math.PI / 2);
      add(g, C(h / 2 * .86, h / 2 * .86, 2.44, 16), wood, 0, h / 2, 0, Math.PI / 2);
      for (const r of [.15, .3]) add(g, T(r, .012), woodDark, 0, h / 2, 1.23);
      for (let i = 0; i < 7; i++) boulder(g, .16, rnd(-.3, .3), h - .06, rnd(-1, 1), moss, .35);
    }
  };
  const blocks = [];
  [[8, 'barrels', 1.3, 1.1], [13.6, 'crate', 1.2, 1.2], [26, 'sandbags', 1.5, 1], [57.6, 'crate', 1.2, 1.2], [67.5, 'log', 1, 1], [74, 'crate', 1.2, 1.2], [89, 'sandbags', 1.5, 1], [105.8, 'crate', 1.1, 1.2], [125.5, 'barrels', 1.3, 1.1], [130.4, 'crate', 1.2, 1.2], [144, 'log', 1, 1], [178, 'sandbags', 1.5, 1], [185.6, 'crate', 1.2, 1.2], [198, 'barrels', 1.3, 1.1]].forEach(([x, type, w, h]) => {
    obstacles[type](group(x), w, h); blocks.push({ x1: x - w / 2, x2: x + w / 2, y: 0, top: h });
  });

  // ----- scenery behind the path -----
  const inGap = (x, pad) => gaps.some(g => x > g[0] - pad && x < g[1] + pad);
  const scenery = {
    jeep(g) {
      add(g, B(3.3, .55, 1.7), olive, 0, .85, 0); add(g, B(1.1, .35, 1.6), olive, 1.05, 1.28, 0); add(g, B(1.5, .5, 1.75), oliveDark, -.8, 1.3, 0);
      add(g, B(.08, .75, 1.55), oliveDark, .42, 1.75, 0, 0, 0, .18); add(g, B(.04, .55, 1.35), glass, .47, 1.76, 0, 0, 0, .18);
      for (const x of [-1.15, 1.15]) for (const z of [-.9, .9]) { add(g, T(.4, .19), rubber, x, .55, z); add(g, C(.24, .24, .2), steel, x, .55, z, Math.PI / 2); add(g, B(1.05, .12, .42), oliveDark, x, 1.14, z); }
      for (const z of [-.55, .55]) add(g, C(.13, .13, .08), warm, 1.68, .95, z, 0, 0, Math.PI / 2);
      add(g, T(.36, .15), rubber, -1.75, 1.2, 0, 0, Math.PI / 2); add(g, C(.02, .02, 2.2), steel, -1.4, 2.4, .6, 0, 0, .12);
    },
    tower(g) {
      for (const x of [-1.2, 1.2]) for (const z of [-1, 1]) add(g, C(.1, .15, 5.4, 8), woodDark, x * 1.08, 2.6, z, 0, 0, x * .05);
      for (const y of [1.3, 3.3]) for (const z of [-1, 1]) for (const s of [-1, 1]) add(g, B(3.1, .09, .09), woodDark, 0, y, z, 0, 0, s * .66);
      add(g, B(3.2, .18, 2.6), wood, 0, 5.3, 0); for (const z of [-1.25, 1.25]) for (const y of [5.75, 6.15]) add(g, B(3.1, .09, .09), wood, 0, y, z);
      for (const x of [-1.45, 1.45]) for (const z of [-1.2, 1.2]) add(g, B(.11, 2.2, .11), woodDark, x, 6.4, z);
      add(g, new THREE.ConeGeometry(2.6, 1.2, 4), canvas, 0, 8, 0, 0, Math.PI / 4); add(g, C(.2, .28, .4), steel, .9, 5.8, 1.3, Math.PI / 2); add(g, new THREE.CircleGeometry(.2, 20), warm, .9, 5.8, 1.51);
      for (let y = .4; y < 5.2; y += .45) add(g, B(.7, .06, .08), wood, -.3, y, 1.25); for (const x of [-.66, .06]) add(g, B(.08, 5.3, .08), wood, x, 2.65, 1.25);
    },
    tent(g) {
      const s = new THREE.Shape(); s.moveTo(-1.8, 0); s.lineTo(-1.2, 1.3); s.lineTo(0, 1.9); s.lineTo(1.2, 1.3); s.lineTo(1.8, 0); s.closePath();
      const geo = new THREE.ExtrudeGeometry(s, { depth: 2.2, bevelEnabled: false }); geo.translate(0, 0, -1.1); add(g, geo, canvas);
      const door = new THREE.Shape(); door.moveTo(-.65, 0); door.lineTo(0, 1.4); door.lineTo(.65, 0); add(g, new THREE.ShapeGeometry(door), rubber, 0, 0, 1.12);
      add(g, C(.05, .05, 2.3, 6), woodDark, 0, 1.15, 1.16); add(g, new THREE.SphereGeometry(.12, 10, 8), warm, .9, 1.05, 1.25);
      for (const x of [-2.2, 2.2]) add(g, C(.015, .015, 1.5, 5), woodDark, x * .85, .65, 1.1, 0, 0, x > 0 ? .8 : -.8);
    },
    temple(g) {
      for (let i = 0; i < 3; i++) add(g, B(6 - i * .8, .35, 2.8 - i * .5), stone, 0, .17 + i * .35, -i * .2);
      for (const [x, h] of [[-2, 4.2], [0, 2.4], [2, 4.2]]) { add(g, B(.95, .3, .95), stone, x, 1.2, -.4); for (let y = 0; y < h; y += .7) add(g, C(.33, .35, .66, 12), stone, x + rnd(-.04, .04), 1.7 + y, -.4, 0, rnd(0, 3), rnd(-.02, .02)); if (h > 3) add(g, B(1, .28, 1), stone, x, 5.6, -.4); }
      add(g, B(5.4, .55, 1.1), stone, 0, 6, -.4, 0, 0, .025); add(g, B(3.6, .4, .9), stone, -.4, 6.45, -.4, 0, 0, -.04);
      for (let i = 0; i < 14; i++) boulder(g, .24, rnd(-2.7, 2.7), rnd() > .5 ? 6.7 : 1.1, rnd(-.4, .6), moss, .4);
      boulder(g, .6, 3.3, .35, .8); boulder(g, .4, -3.2, .25, 1);
    },
    head(g) {
      add(g, B(2.4, .6, 2), stone, 0, .3, 0); add(g, new THREE.DodecahedronGeometry(1.35, 1), stone, 0, 1.9, 0).scale.set(.95, 1.25, .8);
      add(g, B(2.2, .35, .5), stone, 0, 2.5, .95); add(g, new THREE.ConeGeometry(.32, 1.1, 6), stone, 0, 1.9, 1.15); add(g, B(1.1, .22, .35), stone, 0, 1.15, 1);
      for (const x of [-.48, .48]) add(g, new THREE.SphereGeometry(.17, 12, 8), warm, x, 2.2, 1.02).scale.set(1.2, .6, .5);
      for (let i = 0; i < 12; i++) boulder(g, .3, rnd(-1.2, 1.2), rnd(.4, 3.3), rnd(-.2, .5), moss, .35);
    },
    heli(g) {
      add(g, cap(.9, 2.2), olive, 0, 1.15, 0, 0, 0, Math.PI / 2 - .12); add(g, new THREE.SphereGeometry(.74, 20, 14), glass, 1.55, 1.28, .22);
      add(g, C(.14, .38, 3.4), olive, -2.9, 1.75, 0, 0, 0, Math.PI / 2 - .2); add(g, B(.12, 1.2, .08), oliveDark, -4.5, 2.4, 0, 0, 0, .3); for (const r of [.4, 1.97]) add(g, B(.08, 1.3, .1), steel, -4.4, 2.05, .2, 0, 0, r);
      add(g, C(.12, .12, .7), steel, .1, 2.2, 0); add(g, B(5.6, .06, .28), rubber, .1, 2.55, 0, 0, .35, -.14); add(g, B(3, .06, .28), rubber, .1, 2.5, .3, .2, -1.2, .22);
      for (const z of [-.8, .8]) { add(g, C(.07, .07, 3, 8), steel, .1, .18, z, 0, 0, Math.PI / 2 - .06); for (const x of [-.7, .9]) add(g, C(.05, .05, .9, 6), steel, x, .6, z * .75, z > 0 ? -.4 : .4); }
    },
    tank(g) {
      add(g, C(1.1, 1.1, 3, 24), rust, 0, 1.7, 0, 0, 0, Math.PI / 2); for (const x of [-1.5, 1.5]) add(g, new THREE.SphereGeometry(1.1, 24, 12), rust, x, 1.7, 0).scale.x = .35;
      for (const x of [-1, 0, 1]) add(g, T(1.12, .045), steel, x, 1.7, 0, 0, Math.PI / 2); for (const x of [-1.1, 1.1]) add(g, B(.3, 1.2, 1.9), oliveDark, x, .5, 0);
      add(g, C(.1, .1, 1.6, 10), steel, 2.2, .8, .5); add(g, T(.22, .04), red, 2.2, 1.65, .5);
    },
    antenna(g) {
      for (const x of [-.6, .6]) for (const z of [-.6, .6]) add(g, C(.04, .06, 9, 6), steel, x * .5, 4.5, z * .5, -z * .07, 0, x * .07);
      for (let y = .8; y < 8.8; y += .9) { const w = 1.25 - y * .12; for (const z of [-w / 2, w / 2]) { add(g, B(w, .035, .035), steel, 0, y, z); add(g, B(w * 1.35, .03, .03), steel, 0, y + .45, z, 0, 0, .72); } }
      add(g, new THREE.SphereGeometry(.14, 10, 8), lamp, 0, 9.15, 0); add(g, new THREE.SphereGeometry(.6, 20, 10, 0, 6.3, 0, 1.1), steel, .35, 6.4, .5, 2.1, 0, -.4);
    },
    fence(g) {
      for (let x = -3; x <= 3; x += 1.5) add(g, C(.07, .09, 1.7, 7), woodDark, x, .8, 0, 0, 0, rnd(-.08, .08));
      for (const y of [.55, 1.0, 1.45]) add(g, C(.012, .012, 6, 5), steel, 0, y, 0, 0, 0, Math.PI / 2);
      for (let x = -2.8; x < 3; x += .22) add(g, T(.17, .008), steel, x, 1.65, 0, 0, 1.1);
    },
    supplies(g) {
      for (const [x, y, z, s] of [[-.8, .45, 0, .9], [.25, .45, -.2, .9], [-.3, 1.25, -.1, .7]]) { add(g, B(s, s, s), wood, x, y, z, 0, rnd(-.3, .3)); add(g, B(s + .04, .09, s + .04), woodDark, x, y + s / 2 - .06, z); }
      for (let i = 0; i < 3; i++) { add(g, B(.36, .55, .2), i % 2 ? red : olive, 1.1 + i * .42, .28, .3); add(g, T(.09, .025), steel, 1.1 + i * .42, .6, .3); }
      add(g, B(.9, .35, .4), oliveDark, .2, .18, .85, 0, .3);
    }
  };
  const order = ['tent', 'supplies', 'jeep', 'fence', 'tower', 'head', 'tank', 'temple', 'antenna', 'heli'];
  let n = 0;
  for (let x = 3; x < end - 6; x += 7.2, n++) {
    let px = x; for (const g of gaps) if (px > g[0] - 3.5 && px < g[1] + 3.5) px = g[1] + 3.6;
    const type = order[n % order.length], deep = type === 'temple' || type === 'tower' || type === 'antenna';
    scenery[type](group(px, 0, deep ? -7.4 : -5.4, rnd(-.35, .35)));
  }
  for (let x = -18; x < end + 28; x += rnd(1.2, 3)) {
    if (inGap(x, 1)) continue;
    boulder(group(x), rnd(.25, .8), 0, .1, rnd(-9, -3.6));
    if (rnd() > .6) boulder(group(x + .5), rnd(.12, .26), 0, .05, rnd(2.1, 2.9));
  }
  // raised jungle floor so the scenery has ground to stand on
  const spans = [[-24, gaps[0][0]], ...gaps.map((g, i) => [g[1], gaps[i + 1] ? gaps[i + 1][0] : end + 34])];
  for (const [a, b] of spans) add(root, B(b - a, 3.6, 7.6), M(0x3a4424, 1, 0, { map: mats.grass, normalMap: rockNormal }), (a + b) / 2, -1.95, -7.7);

  // merge static meshes per material and per stretch of level to keep draw calls low
  root.updateMatrixWorld(true);
  const buckets = new Map();
  root.traverse(o => {
    if (!o.isMesh) return;
    let geo = o.geometry.clone().applyMatrix4(o.matrixWorld); if (geo.index) geo = geo.toNonIndexed(); geo.clearGroups();
    const chunk = Math.floor((o.matrixWorld.elements[12]) / 30), key = o.material.uuid + ':' + chunk;
    if (!buckets.has(key)) buckets.set(key, { mat: o.material, list: [] }); buckets.get(key).list.push(geo);
  });
  for (const { mat, list } of buckets.values()) { const m = new THREE.Mesh(mergeGeometries(list), mat); m.castShadow = true; m.receiveShadow = true; scene.add(m); }
  return blocks;
}
