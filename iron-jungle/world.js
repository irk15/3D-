// Builds one mission's scenery. Everything static goes into a group that is thrown away when the
// mission changes, so the same code serves all three looks.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import * as ENV from './environment.js?v=9';
import { buildProps } from './props.js?v=9';
import { placeProps } from './models.js?v=9';
import { helicopter } from './heli.js?v=7';

export function createWorld({ scene, texLoader, wind, END }) {
  function tex(file, rx = 1, ry = 1, color = true) {
    const t = texLoader.load('assets/' + file); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.anisotropy = 8; if (color) t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  const std = (color, roughness = .75, metalness = .05, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
  const glow = (color, k = 3) => new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), fog: false });
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const cyl = (a, b, h, s = 12) => new THREE.CylinderGeometry(a, b, h, s);
  const ball = r => new THREE.SphereGeometry(r, 14, 10);
  const rockMap = tex('rock.jpg'), rockNormal = tex('rock-n.jpg', 1, 1, false), grassMap = tex('grass.jpg'), waterNormal = tex('water-n.jpg', 1, 1, false);
  // shared with the game: debris, platforms and the boss use these
  const rockMat = std(0x77685f, .95, 0, { map: rockMap, normalMap: rockNormal, normalScale: new THREE.Vector2(1.6, 1.6) });
  const steel = std(0x777b7e, .42, .8, { normalMap: rockNormal, normalScale: new THREE.Vector2(.15, .15) }), rust = std(0xa05a30, .68, .55, { map: rockMap });
  const bark = std(0x6a4a34, 1, 0, { map: rockMap, normalMap: rockNormal });
  let group;

  function clear() {
    if (!group) return;
    group.traverse(o => { if (o.isInstancedMesh) o.dispose(); o.geometry?.dispose(); });
    scene.remove(group);
  }

  function build(def, number) {
    clear(); group = new THREE.Group(); scene.add(group);
    // the same seed on every device keeps co-op scenery identical
    let seed = 7 + (number - 1) * 4111;
    const rnd = (a = 0, b = 1) => { seed = (seed * 16807) % 2147483647; return a + (seed / 2147483647) * (b - a); };
    const theme = def.theme, gaps = def.gaps, solids = [];
    const mesh = (geo, mat, x = 0, y = 0, z = 0, parent = group, shadow = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = shadow; m.receiveShadow = true; parent.add(m); return m; };
    rockMat.color.set(theme.rock);
    const [groundColor, groundTex] = theme.ground;
    function ground(x1, x2) {
      const w = x2 - x1, cx = (x1 + x2) / 2;
      mesh(box(w, 6, 7), rockMat, cx, -3.2, -.5);
      let top = null; if (groundTex) { top = (groundTex === 'grass' ? grassMap : rockMap).clone(); top.repeat.set(w / 5, 1.45); }
      mesh(box(w + .15, .25, 7.2), std(groundColor, .92, 0, top ? { map: top } : { normalMap: rockNormal, normalScale: new THREE.Vector2(.35, .35) }), cx, -.125, -.5);
      ENV.cliff(group, rockMat, rnd, x1, x2);
      for (let x = x1 + .5; x < x2 - .4; x += rnd(.9, 2.4)) { const r = mesh(new THREE.IcosahedronGeometry(rnd(.2, .5), 1), rockMat, x, rnd(-3.3, -.9), 3.2); r.rotation.set(rnd(0, 3), rnd(0, 3), 0); r.scale.y = rnd(.5, .8); }
      solids.push({ x1, x2, y: 0, ground: true });
    }
    let from = -20; for (const [a, b] of gaps) { ground(from, a); from = b; } ground(from, END + 30);
    ENV.grassField(group, wind, rnd, solids.map(s => [s.x1, s.x2]), theme.grass, theme.grassDensity);
    for (const [x, y, w] of def.platforms) {
      mesh(box(w, .28, 2.4), steel, x, y - .14, 0);
      mesh(box(w, .07, .08), rust, x, y - .02, 1.22);
      for (const s of [-1, 1]) mesh(cyl(.09, .12, y, 8), rust, x + s * (w / 2 - .3), y / 2, -1.14);
      if (theme.foliage === 'pine') mesh(box(w, .05, 1), std(0xb4c4dc, .9, 0), x, y + .012, -.6, group, false);
      solids.push({ x1: x - w / 2, x2: x + w / 2, y });
    }
    const water = ENV.water(group, waterNormal, END + 80, END / 2); water.material.color.set(theme.water);
    const air = ENV.atmosphere(group, rnd, END, theme);

    const dummy = new THREE.Object3D(), col = new THREE.Color();
    // many copies of one shape, split into stretches so off-screen ones are culled
    function scatter(geo, mat, list, tint, shadow = false) {
      const chunks = new Map(); for (const l of list) { const k = Math.floor(l[0] / 24); if (!chunks.has(k)) chunks.set(k, []); chunks.get(k).push(l); }
      for (const part of chunks.values()) {
        const im = new THREE.InstancedMesh(geo, mat, part.length);
        part.forEach((l, i) => { dummy.position.set(l[0], l[1], l[2]); dummy.rotation.set(l[4] || 0, l[5] || 0, l[6] || 0, 'YXZ'); dummy.scale.setScalar(l[3]); dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix); if (tint) im.setColorAt(i, tint()); });
        im.receiveShadow = true; im.castShadow = shadow; im.computeBoundingSphere(); group.add(im);
      }
    }
    const inGap = (x, pad) => gaps.some(g => x > g[0] - pad && x < g[1] + pad);
    if (theme.foliage !== 'pine') {
      const dry = theme.foliage === 'desert';
      const leaf = ENV.frondGeometry(), leafMat = ENV.frondMaterial(ENV.frondTexture(rnd), wind);
      if (dry) leafMat.emissive.set(0x140c02);
      const tint = () => dry ? col.setHSL(rnd(.09, .14), rnd(.4, .6), rnd(.2, .34)) : col.setHSL(rnd(.2, .32), rnd(.45, .7), rnd(.16, .34));
      const bush = [], crown = [];
      for (let x = -20; x < END + 30; x += dry ? 2.6 : .55) {
        if (inGap(x, .6)) continue;
        const z = rnd(-3.8, -2.2);
        for (let i = 0; i < 4; i++) bush.push([x, 0, z, rnd(.3, .75) * (dry ? .75 : 1), rnd(.2, 1), rnd(0, 6.3), rnd(-.4, .4)]);
      }
      for (let x = -24; x < END + 40; x += dry ? rnd(9, 17) : rnd(1.8, 3.8)) {
        const z = rnd(-22, -6), h = rnd(5, 11);
        const tg = new THREE.CylinderGeometry(.13, .3, h + 3, 9, 14), tp = tg.attributes.position;
        for (let i = 0; i < tp.count; i++) { const ring = 1 + (Math.round((tp.getY(i) / (h + 3) + .5) * 14) % 2) * .13; tp.setX(i, tp.getX(i) * ring); tp.setZ(i, tp.getZ(i) * ring); }
        const t = mesh(tg, bark, x, h / 2 - 1.5, z, group, false); t.rotation.z = rnd(-.09, .09);
        const tx = x - Math.sin(t.rotation.z) * h / 2;
        for (let i = 0; i < 11; i++) crown.push([tx, h, z, rnd(.9, 1.7), rnd(.9, 1.6), i * .58 + rnd(0, .4), 0]);
        for (let i = 0; i < 5; i++) crown.push([x + rnd(-1.5, 1.5), -.4, z + rnd(-1, 1), rnd(.8, 1.5), rnd(.2, .9), rnd(0, 6.3), 0]);
      }
      scatter(leaf, leafMat, bush, tint); scatter(leaf, leafMat, crown, tint);
      if (dry) {
        // saguaro cacti and flat-topped mesas
        const parts = [new THREE.CapsuleGeometry(.28, 3.2, 6, 12).translate(0, 1.8, 0)];
        for (const [s, y, h] of [[-1, 1.5, 1.2], [1, 2.1, .9]]) parts.push(new THREE.CapsuleGeometry(.17, .55, 4, 10).rotateZ(Math.PI / 2).translate(s * .45, y, 0), new THREE.CapsuleGeometry(.17, h, 4, 10).translate(s * .78, y + h / 2, 0));
        const cacti = []; for (let x = -18; x < END + 30; x += rnd(3.5, 8)) cacti.push([x, -.4, rnd(-14, -5.5), rnd(.6, 1.35), 0, rnd(-.5, .5), 0]);
        scatter(mergeGeometries(parts), std(0x4c6a30, .85, 0), cacti, null, true);
        for (let x = -20; x < END + 40; x += rnd(16, 28)) { const h = rnd(7, 13), r = rnd(3, 6); const m = mesh(cyl(r * .72, r, h, 9), rockMat, x, h / 2 - 3, rnd(-32, -24), group, false); m.rotation.y = rnd(0, 6); mesh(cyl(r * .8, r * .78, .8, 9), rockMat, x, h - 3, m.position.z, group, false); }
      }
    } else {
      // pine forest with snow on every tier
      const tier = (r, h, y) => new THREE.ConeGeometry(r, h, 10).translate(0, y, 0);
      const greens = mergeGeometries([tier(1.5, 2.2, 1.9), tier(1.2, 2, 3), tier(.85, 1.8, 4.1), cyl(.18, .24, 1.2, 8).translate(0, .5, 0)]);
      const snow = mergeGeometries([tier(.8, 1.15, 2.47), tier(.66, 1.05, 3.52), tier(.5, 1.05, 4.52)]);
      const trees = []; for (let x = -24; x < END + 40; x += rnd(1.1, 2.6)) trees.push([x, rnd(-1.2, -.3), rnd(-23, -8.5), rnd(.8, 1.75), 0, rnd(0, 6), rnd(-.04, .04)]);
      scatter(greens, std(0x1c4038, .9, 0), trees); scatter(snow, std(0x9db0cc, .9, 0), trees);
      for (let x = -18; x < END + 30; x += rnd(.8, 2)) if (!inGap(x, 1)) { const m = mesh(ball(rnd(.25, .6)), std(0xaabbd4, .9, 0), x, -.08, rnd(-3.9, -2.8), group, false); m.scale.set(1.6, .45, 1); }
    }
    mesh(box(END + 100, 1, 30), std(theme.under, 1), END / 2, -4.2, -19, group, false);
    for (let layer = 0; layer < 3; layer++) {
      const s = new THREE.Shape(); s.moveTo(-120, -20);
      let h = 9;
      for (let x = -120; x <= END + 140; x += 1.6) { h = THREE.MathUtils.clamp(h + rnd(-1.1, 1.1), 4, 14); s.lineTo(x, h + layer * 7 + Math.sin(x * .09 + layer * 2) * 3 + rnd(-.25, .25)); }
      s.lineTo(END + 140, -20);
      mesh(new THREE.ShapeGeometry(s), new THREE.MeshBasicMaterial({ color: theme.mountains[layer] }), 0, 0, -34 - layer * 28, group, false);
    }
    // props
    const blocks = buildProps(group, rnd, { rock: rockMat, rockNormal, steel, rust, bark, grass: grassMap }, gaps, END, def);
    for (const b of blocks) solids.push({ x1: b.x1 - .3, x2: b.x2 + .3, y: b.top, ground: true, block: true });
    placeProps(group, blocks);
    for (const pad of blocks.pads) { const h = helicopter(6.4, false); h.position.set(pad.x, h.userData.height / 2, pad.z); h.rotation.y = pad.turn; group.add(h); }
    // torches
    const flames = [];
    for (let x = 4; x < 215; x += 21) {
      if (inGap(x, .5)) continue;
      mesh(cyl(.06, .08, 2, 6), bark, x, 1, -2.4);
      flames.push(mesh(ball(.17), glow(0xff7a22, 4), x, 2.15, -2.4, group, false));
    }
    // fireflies / drifting motes
    const dustGeo = new THREE.BufferGeometry(), dp = new Float32Array(600 * 3);
    for (let i = 0; i < 600; i++) dp.set([rnd(-20, END), rnd(0, 10), rnd(-9, 5)], i * 3);
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dp, 3));
    const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: new THREE.Color(theme.dust).multiplyScalar(2), size: .06, transparent: true, opacity: .7 }));
    group.add(dust);
    return { solids, gaps, blocks, flames, dust, water, air };
  }
  return { build, steel, rust, rockMat };
}
