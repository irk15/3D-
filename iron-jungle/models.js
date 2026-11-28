// Downloaded models: sentry turret and attack drone (CC BY 4.0, see the license.txt in each folder)
// and photo-scanned Poly Haven props (CC0).
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';

const PROPS = ['Barrel_01', 'barrel_03', 'wooden_crate_02', 'old_military_crate', 'portable_generator', 'old_tyre', 'ammo_box'];
const lib = {};
let gun, droneClips, droneBox;
// true bounds of a rigged model: measure its vertices as the skeleton poses them
function posedBox(root) {
  const box = new THREE.Box3(), v = new THREE.Vector3(); root.updateMatrixWorld(true);
  root.traverse(o => { if (!o.isMesh) return; if (o.isSkinnedMesh) o.skeleton.update(); const p = o.geometry.attributes.position; for (let i = 0; i < p.count; i++) box.expandByPoint(o.getVertexPosition(i, v).applyMatrix4(o.matrixWorld)); });
  return box;
}

export async function loadModels(manager) {
  const loader = new GLTFLoader(manager), get = path => loader.loadAsync(`assets/${path}/scene.gltf`);
  const [t, d, ...props] = await Promise.all([get('turret'), get('drone'), ...PROPS.map(n => get('props/' + n))]);
  PROPS.forEach((n, i) => lib[n] = props[i].scene);
  lib.drone = d.scene; droneClips = d.animations;
  gun = splitTurret(t.scene);
  droneBox = posedBox(d.scene);
  // lift the dark paintwork so both machines read clearly against the jungle, day and night
  gun.material.color.setRGB(2.1, 2.2, 1.7); gun.material.metalness = .55; gun.material.emissive.set(0x1c241c);
  d.scene.traverse(o => { if (o.isMesh) o.material.color.setScalar(1.5); });
}

// the turret arrives as one mesh: cut it into a fixed pedestal and a gun head that can aim
function splitTurret(scene) {
  let mesh; scene.updateMatrixWorld(true); scene.traverse(o => { if (o.isMesh && /^turret/.test(o.name)) mesh = o; });
  let geo = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld); if (geo.index) geo = geo.toNonIndexed();
  geo.computeBoundingBox(); const { min, max } = geo.boundingBox, w = max.x - min.x, h = max.y - min.y, p = geo.attributes.position;
  const sets = [[], []];
  for (let i = 0; i < p.count; i += 3) {
    const x = ((p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3 - min.x) / w, y = ((p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3 - min.y) / h;
    sets[y > .62 || (x > .29 && y > .38) ? 1 : 0].push(i, i + 1, i + 2);
  }
  const part = list => {
    const g = new THREE.BufferGeometry();
    for (const [name, a] of Object.entries(geo.attributes)) {
      const out = new a.array.constructor(list.length * a.itemSize);
      list.forEach((v, j) => { for (let k = 0; k < a.itemSize; k++) out[j * a.itemSize + k] = a.array[v * a.itemSize + k]; });
      g.setAttribute(name, new THREE.BufferAttribute(out, a.itemSize, a.normalized));
    }
    return g;
  };
  const base = part(sets[0]), head = part(sets[1]); base.computeBoundingBox();
  const centre = base.boundingBox.getCenter(new THREE.Vector3()), pivot = new THREE.Vector3(centre.x, min.y + h * .64, centre.z);
  base.translate(-centre.x, -min.y, -centre.z); head.translate(-pivot.x, -pivot.y, -pivot.z);
  return { base, head, material: mesh.material, height: h, pivotY: h * .64 };
}

const shade = o => o.traverse(m => { if (m.isMesh) { m.castShadow = m.receiveShadow = true; } });

export function turret() {
  const out = new THREE.Group(), body = new THREE.Group(), k = 1.7 / gun.height;
  body.scale.setScalar(k); out.add(body);
  body.add(new THREE.Mesh(gun.base, gun.material));
  const head = new THREE.Mesh(gun.head, gun.material); head.position.y = gun.pivotY; head.rotation.order = 'YZX'; body.add(head);
  shade(out);
  // angle is measured in the screen plane; the head swings round instead of rolling upside down
  out.userData.aim = a => {
    const left = Math.cos(a) < 0; head.rotation.y = left ? Math.PI : 0;
    head.rotation.z = THREE.MathUtils.clamp(Math.atan2(Math.sin(a), Math.abs(Math.cos(a))), -.5, 1.3);
  };
  return out;
}

export function drone() {
  const model = clone(lib.drone), out = new THREE.Group(), turn = new THREE.Group();
  const size = droneBox.getSize(new THREE.Vector3()), k = 1.9 / size.x;
  model.position.sub(droneBox.getCenter(new THREE.Vector3())); const fit = new THREE.Group(); fit.scale.setScalar(k); fit.add(model); turn.add(fit); out.add(turn);
  shade(model); model.traverse(o => { if (o.isSkinnedMesh) o.frustumCulled = false; });
  const mixer = new THREE.AnimationMixer(model), clip = n => mixer.clipAction(droneClips.find(c => c.name.trim().endsWith(n)));
  clip('idle').play(); const fire = clip('Fire').setLoop(THREE.LoopOnce);
  let yaw = -1.1;
  out.userData.update = (dt, dx) => { yaw += ((dx < 0 ? -1.1 : 1.1) - yaw) * Math.min(1, dt * 5); turn.rotation.y = yaw; mixer.update(dt); };
  out.userData.fire = () => fire.reset().play();
  return out;
}

// a prop stretched to fill exactly w × h × d, standing on the ground
export function prop(name, w, h, d) {
  const model = lib[name].clone(true), box = new THREE.Box3().setFromObject(model), size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  model.position.sub(new THREE.Vector3(c.x, box.min.y, c.z));
  const out = new THREE.Group(), fit = new THREE.Group(); fit.add(model); out.add(fit);
  fit.scale.set(w / size.x, h / size.y, (d ?? size.z * w / size.x) / size.z); shade(out);
  return out;
}

// builds the real-model versions of the obstacles and supply dumps that props.js marked out
export function placeProps(scene, blocks) {
  const add = (o, x, y, z, turn = 0) => { o.position.set(x, y, z); o.rotation.y = turn; scene.add(o); return o; };
  for (const { x, type, w, h } of blocks.swaps) {
    if (type === 'crate') add(prop('wooden_crate_02', w, h, 1.4), x, 0, 0);
    else for (const [dx, z, turn] of [[-w / 4, .25, .4], [w / 4, -.1, 2.1], [-w / 6, -.75, 4]]) add(prop('barrel_03', w / 2, h, w / 2), x + dx, 0, z, turn);
  }
  for (const { x, z, turn } of blocks.depots) {
    const g = add(new THREE.Group(), x, 0, z, turn), put = (n, px, py, pz, pw, ph, r = 0) => { const o = prop(n, pw, ph); o.position.set(px, py, pz); o.rotation.y = r; g.add(o); };
    put('old_military_crate', -.7, 0, 0, 2, .75, .1); put('ammo_box', -.9, .75, .1, .7, .42, -.3); put('portable_generator', 1.2, 0, .2, 1.3, 1.05, -.4);
    put('old_tyre', 2.2, 0, .5, .8, .8, .8); put('Barrel_01', -2.1, 0, -.2, .8, 1.15);
  }
}
