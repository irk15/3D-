// Rider: the Mixamo racing-suit character, posed per bike with two-bone IK
// (hands on the grips, feet on the pegs, knees tucked to the tank, torso crouched to reach the bars),
// then baked into a static mesh so every copy of the bike is cheap to draw.
import * as THREE from 'three';

let src = null, pending = null;
const baked = new Map();
const V = () => new THREE.Vector3();
const wp = (o, v = V()) => o.getWorldPosition(v);
const _q = new THREE.Quaternion(), _pq = new THREE.Quaternion();

function applyWorldRot(bone, q) {
  bone.parent.updateWorldMatrix(true, false);
  bone.parent.getWorldQuaternion(_pq);
  const local = _pq.clone().invert().multiply(q).multiply(_pq);
  bone.quaternion.premultiply(local);
  bone.updateMatrixWorld(true);
}
function rotWorld(bone, axis, angle) { if (bone) applyWorldRot(bone, _q.setFromAxisAngle(axis, angle).clone()); }
// rotate `bone` so that `child` points at `target`
function aim(bone, child, target) {
  bone.updateWorldMatrix(true, true);
  const b = wp(bone), c = wp(child);
  const from = c.sub(b).normalize(), to = target.clone().sub(b).normalize();
  applyWorldRot(bone, new THREE.Quaternion().setFromUnitVectors(from, to));
}
// two-bone IK: upper → mid → end reaches target, bending toward pole
function ik(upper, mid, end, target, pole) {
  upper.updateWorldMatrix(true, true);
  const a = wp(upper), b = wp(mid), c = wp(end);
  const l1 = a.distanceTo(b), l2 = b.distanceTo(c);
  const d = target.clone().sub(a);
  const dist = THREE.MathUtils.clamp(d.length(), Math.abs(l1 - l2) + 1e-3, (l1 + l2) * 0.998);
  d.normalize();
  const cosA = THREE.MathUtils.clamp((l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist), -1, 1);
  const pd = pole.clone().sub(d.clone().multiplyScalar(pole.dot(d))).normalize();
  const elbow = a.clone().addScaledVector(d, l1 * cosA).addScaledVector(pd, l1 * Math.sqrt(1 - cosA * cosA));
  aim(upper, mid, elbow);
  aim(mid, end, a.clone().addScaledVector(d, dist));
}

export function loadRider(loader) {
  if (src) return Promise.resolve(src);
  if (pending) return pending;
  pending = new Promise((resolve, reject) => {
    loader.load('models/biker.glb', (gltf) => {
      const root = gltf.scene;
      const bones = {};
      root.traverse((o) => { if (o.isBone) bones[o.name.replace(/^mixamorig\d*:?/, '')] = o; });
      const rest = new Map();
      root.traverse((o) => rest.set(o, o.quaternion.clone()));
      root.updateMatrixWorld(true);
      const side = wp(bones.LeftArm).x > wp(bones.RightArm).x ? 1 : -1; // world-x sign of the rider's left
      src = { root, bones, rest, side };
      resolve(src);
    }, undefined, reject);
  });
  return pending;
}

function reset() {
  for (const [o, q] of src.rest) o.quaternion.copy(q);
  src.root.position.set(0, 0, 0);
  src.root.updateMatrixWorld(true);
}

// geometry in bike space (metres, nose +Z, ground y=0): seat [z,y], bar [z,y,halfWidth], peg [z,y,halfWidth]
function poseFor(g) {
  reset();
  const { root, bones: B, side } = src;
  const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0);
  const hipT = new THREE.Vector3(0, g.seat[1] + 0.1, g.seat[0] + 0.04);
  root.position.add(hipT.clone().sub(wp(B.Hips)));
  root.updateMatrixWorld(true);
  // crouch: lean the spine until the hands reach the bars with soft elbows
  const armLen = wp(B.LeftArm).distanceTo(wp(B.LeftForeArm)) + wp(B.LeftForeArm).distanceTo(wp(B.LeftHand));
  const bar = (s) => new THREE.Vector3(s * side * g.bar[2], g.bar[1], g.bar[0]);
  let lean = 0;
  for (let k = 0; k < 40; k++) {
    if (wp(B.LeftArm).distanceTo(bar(1)) < armLen * 0.86 || lean > 1.3) break;
    for (const s of [B.Spine, B.Spine1, B.Spine2]) rotWorld(s, X, 0.012);
    lean += 0.036;
  }
  // head up to look down the road
  rotWorld(B.Neck, X, -lean * 0.45);
  rotWorld(B.Head, X, -lean * 0.42);
  // arms: elbows bent down and slightly out
  for (const s of [1, -1]) {
    const L = s === 1 ? 'Left' : 'Right';
    rotWorld(B[`${L}Shoulder`], Y, -s * side * 0.1);
    ik(B[`${L}Arm`], B[`${L}ForeArm`], B[`${L}Hand`], bar(s), new THREE.Vector3(s * side * 0.3, -1, -0.45));
    if (B[`${L}HandMiddle1`]) aim(B[`${L}Hand`], B[`${L}HandMiddle1`], bar(s).add(new THREE.Vector3(s * side * 0.11, -0.015, 0.06)));
    // fingers wrap around the grip, thumb underneath
    const hq = new THREE.Quaternion(); B[`${L}Hand`].getWorldQuaternion(hq);
    const handDir = wp(B[`${L}HandMiddle1`]).sub(wp(B[`${L}Hand`])).normalize();
    const curlAxis = new THREE.Vector3().crossVectors(handDir, Y).normalize().negate();
    for (const f of ['Index', 'Middle', 'Ring', 'Pinky']) {
      [1.0, 1.05, 0.75].forEach((a, j) => rotWorld(B[`${L}Hand${f}${j + 1}`], curlAxis, a));
    }
    rotWorld(B[`${L}HandThumb1`], curlAxis, 0.35);
    rotWorld(B[`${L}HandThumb2`], curlAxis, 0.5);
  }
  // legs: knees forward against the tank, feet on the pegs
  for (const s of [1, -1]) {
    const L = s === 1 ? 'Left' : 'Right';
    const peg = new THREE.Vector3(s * side * g.peg[2], g.peg[1] + 0.06, g.peg[0] + 0.04);
    ik(B[`${L}UpLeg`], B[`${L}Leg`], B[`${L}Foot`], peg, new THREE.Vector3(s * side * 0.06, 0.3, 1));
    if (B[`${L}ToeBase`]) aim(B[`${L}Foot`], B[`${L}ToeBase`], peg.clone().add(new THREE.Vector3(s * side * 0.01, -0.06, 0.16)));
  }
}

function bake() {
  const { root } = src;
  root.updateMatrixWorld(true);
  const group = new THREE.Group();
  const v = V();
  root.traverse((o) => {
    if (!o.isSkinnedMesh) return;
    o.skeleton.update();
    const g0 = o.geometry, n = g0.attributes.position.count;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      o.getVertexPosition(i, v);
      v.applyMatrix4(o.matrixWorld);
      pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    if (g0.attributes.uv) g.setAttribute('uv', g0.attributes.uv);
    if (g0.index) g.setIndex(g0.index);
    g.computeVertexNormals();
    g.computeBoundingBox(); g.computeBoundingSphere();
    const m = new THREE.Mesh(g, o.material);
    m.castShadow = true; m.receiveShadow = true;
    group.add(m);
  });
  return group;
}

const DEFAULT = { seat: [-0.31, 0.85], bar: [0.45, 0.95, 0.32], peg: [-0.23, 0.42, 0.18] };
export function attachRider(holder, cfg) {
  if (!src) return null;
  if (!baked.has(cfg.id)) { poseFor(cfg.rider || DEFAULT); baked.set(cfg.id, bake()); reset(); }
  const r = baked.get(cfg.id).clone(true);
  r.name = 'rider';
  holder.add(r);
  return r;
}
