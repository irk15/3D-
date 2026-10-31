// rig.js — Mixamo characters (X Bot, Michelle, Vanguard) with skeletal animation.
// Locomotion is a speed-driven blend of idle / walk / run clips. On top of the mocap, a procedural
// layer bends the skeleton for things Mixamo clips don't cover here: jump tuck, double-jump flip,
// flying (superhero pose), bike riding, waving, umbrella and parcel. Squash & stretch on jumps and
// landings, a lean into turns and wings with follow-through give the motion its cartoon bounce.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { gradient, toon } from './toon.js';

export const MODELS = {
  bot: { file: 'xbot.glb', name: 'X Bot', height: 1.72 },
  michelle: { file: 'michelle.glb', name: 'Michelle', height: 1.66 },
  soldier: { file: 'soldier.glb', name: 'Vanguard', height: 1.76 },
  // light versions for crowds (same skeleton and animations, ~⅓ the triangles)
  bot_lo: { file: 'xbot_lo.glb', name: 'X Bot', height: 1.72, base: 'bot' },
  michelle_lo: { file: 'michelle_lo.glb', name: 'Michelle', height: 1.66, base: 'michelle' },
};
const LIB = {};
export const rigReady = () => Object.keys(LIB).length > 0;

// ---------------------------------------------------------------- loading + retargeting
export async function loadRigs(base, onProgress) {
  const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
  const keys = Object.keys(MODELS); let done = 0;
  const gl = await Promise.all(keys.map((k) => loader.loadAsync(base + MODELS[k].file).then((g) => { onProgress?.(++done / keys.length); return g; })));
  keys.forEach((k, i) => {
    const g = gl[i], scene = g.scene;
    scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(scene, true);
    const hips = findBone(scene, 'Hips');
    const Qp = new THREE.Quaternion(); hips?.parent.getWorldQuaternion(Qp);
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(Qp.clone().multiply(hips ? hips.quaternion : new THREE.Quaternion()));
    LIB[k] = { faceYaw: Math.atan2(fwd.x, fwd.z), scene, clips: g.animations, rawH: box.max.y - box.min.y, minY: box.min.y, hips: { Qp, q: hips ? hips.quaternion.clone() : new THREE.Quaternion(), p: hips ? hips.position.clone() : new THREE.Vector3(0, 1, 0) } };
  });
  // rest pose for retargeting: the model's T-pose clip if it has one, else its bind pose
  for (const k of keys) {
    const L = LIB[k], c = SkeletonUtils.clone(L.scene), tp = L.clips.find((x) => /tpose/i.test(x.name));
    if (tp) { const m = new THREE.AnimationMixer(c), a = m.clipAction(clean(tp, null, null)); a.play(); m.update(0); }
    c.updateMatrixWorld(true);
    L.rest = {}; c.traverse((b) => { if (b.isBone) L.rest[b.name] = b.getWorldQuaternion(new THREE.Quaternion()); });
  }
  // build each character's clip set: own clips where it has them, X Bot's otherwise (same Mixamo skeleton)
  const src = (k, n) => LIB[k].clips.find((c) => c.name.toLowerCase() === n.toLowerCase());
  for (const k of keys) {
    if (MODELS[k].base) continue;
    const L = LIB[k], set = {};
    const take = (name, from, clipName) => { const c = src(from, clipName); if (c) set[name] = from === k ? clean(c, null, null) : retarget(c, LIB[from], L); };
    take('idle', k === 'soldier' ? 'soldier' : 'bot', k === 'soldier' ? 'Idle' : 'idle');
    take('walk', k === 'soldier' ? 'soldier' : 'bot', k === 'soldier' ? 'Walk' : 'walk');
    take('run', k === 'soldier' ? 'soldier' : 'bot', k === 'soldier' ? 'Run' : 'run');
    take('nod', 'bot', 'agree'); take('shake', 'bot', 'headShake'); take('dance', 'michelle', 'SambaDance');
    const names = new Set(); L.scene.traverse((o) => names.add(o.name));
    for (const c of Object.values(set)) c.tracks = c.tracks.filter((t) => names.has(t.name.slice(0, t.name.lastIndexOf('.'))));
    L.set = set;
  }
  for (const k of keys) if (MODELS[k].base) { const b = LIB[MODELS[k].base]; LIB[k].set = b.set; LIB[k].faceYaw = b.faceYaw; }
  return LIB;
}
function findBone(root, name) { let b = null; root.traverse((o) => { if (!b && o.isBone && o.name.replace(/^mixamorig:?/, '') === name) b = o; }); return b; }
// Keep rotations, drop per-bone translations (they'd force the source's proportions). The hips are
// retargeted through world space, because Mixamo exports differ in how the armature root is rotated
// (Y-up vs Z-up), then their height is rescaled to the target's legs.
function clean(clip, S, T) {
  const tracks = [];
  const q = new THREE.Quaternion(), v = new THREE.Vector3();
  let rot = null, nS, nT, kH;
  if (S) {
    const wS = S.Qp.clone().multiply(S.q), wT = T.Qp.clone().multiply(T.q);
    rot = { pre: T.Qp.clone().invert(), SQp: S.Qp, fix: wS.clone().invert().multiply(wT) };
    nS = S.p.clone().applyQuaternion(S.Qp); nT = T.p.clone().applyQuaternion(T.Qp); kH = nT.y / (nS.y || 1);
  }
  for (const t of clip.tracks) {
    if (t.name.endsWith('.scale')) continue;
    const isHips = /Hips\.(position|quaternion)$/.test(t.name);
    if (t.name.endsWith('.position')) {
      if (!isHips) continue;
      const vals = t.values.slice();
      if (S) for (let i = 0; i < vals.length; i += 3) {
        v.fromArray(vals, i).applyQuaternion(S.Qp).sub(nS).multiplyScalar(kH).add(nT).applyQuaternion(rot.pre); v.toArray(vals, i);
      }
      tracks.push(new THREE.VectorKeyframeTrack(t.name, t.times, vals)); continue;
    }
    if (S && isHips) {
      const vals = t.values.slice();
      for (let i = 0; i < vals.length; i += 4) { q.fromArray(vals, i); q.premultiply(rot.SQp).multiply(rot.fix).premultiply(rot.pre); q.toArray(vals, i); }
      tracks.push(new THREE.QuaternionKeyframeTrack(t.name, t.times, vals)); continue;
    }
    tracks.push(t);
  }
  return new THREE.AnimationClip(clip.name, clip.duration, tracks);
}

// Bake a clip from one Mixamo skeleton onto another. The two exports don't share bone axes (X Bot's
// bones rest at identity, Michelle's and Vanguard's legs/shoulders are rotated), so each bone's motion is
// transferred as a world-space rotation relative to its rest pose, sampled at 30 fps.
function retarget(clip, S, T, fps = 30) {
  const src = SkeletonUtils.clone(S.scene); src.updateMatrixWorld(true);
  const bonesOf = (root) => { const m = {}; root.traverse((b) => { if (b.isBone) m[b.name] = b; }); return m; };
  const sB = bonesOf(src), tB = bonesOf(T.scene);
  T.scene.updateMatrixWorld(true);
  const restS = S.rest, restT = T.rest, order = [];
  const tHips = Object.values(tB).find((b) => /Hips$/.test(b.name));
  tHips.traverse((b) => { if (b.isBone) order.push(b.name); });
  const parentRest = tHips.parent.getWorldQuaternion(new THREE.Quaternion());
  const mixer = new THREE.AnimationMixer(src), act = mixer.clipAction(clean(clip, null, null)); act.play();
  const n = Math.max(2, Math.ceil(clip.duration * fps) + 1), times = new Float32Array(n);
  const vals = {}; for (const name of order) vals[name] = new Float32Array(n * 4);
  const hipsPos = new Float32Array(n * 3), sHips = Object.values(sB).find((b) => /Hips$/.test(b.name));
  const W = {}, q = new THREE.Quaternion(), d = new THREE.Quaternion(), v = new THREE.Vector3();
  const nS = S.hips.p.clone().applyQuaternion(S.hips.Qp), nT = T.hips.p.clone().applyQuaternion(T.hips.Qp), kH = nT.y / (nS.y || 1), preT = T.hips.Qp.clone().invert();
  // the two exports may face opposite ways: express motion in each character's own facing
  const Yq = (a) => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), a);
  const M = Yq(T.faceYaw).multiply(Yq(S.faceYaw).invert()), Mi = M.clone().invert();
  for (let f = 0; f < n; f++) {
    const t = Math.min(clip.duration, f / fps); times[f] = t;
    act.time = t; mixer.update(0); src.updateMatrixWorld(true);
    for (const name of order) {
      const tb = tB[name], pw = tb.parent && tb.parent.isBone && W[tb.parent.name] ? W[tb.parent.name] : parentRest;
      const sb = sB[name];
      let w;
      if (sb && restS[name] && restT[name]) { sb.getWorldQuaternion(q); d.copy(q).multiply(restS[name].clone().invert()); d.premultiply(M).multiply(Mi); w = d.clone().multiply(restT[name]); }
      else w = pw.clone().multiply(tb.quaternion);
      W[name] = w;
      q.copy(pw).invert().multiply(w); q.toArray(vals[name], f * 4);
    }
    v.copy(sHips.position).applyQuaternion(S.hips.Qp).sub(nS).applyQuaternion(M).multiplyScalar(kH).add(nT).applyQuaternion(preT); v.toArray(hipsPos, f * 3);
  }
  const tracks = order.map((name) => new THREE.QuaternionKeyframeTrack(name + '.quaternion', times, vals[name]));
  tracks.push(new THREE.VectorKeyframeTrack(tHips.name + '.position', times, hipsPos));
  return new THREE.AnimationClip(clip.name, clip.duration, tracks);
}

// ---------------------------------------------------------------- materials
const matCache = new Map();
function toonFrom(m, color) {
  const key = (m.map ? m.map.uuid : m.name) + color;
  if (matCache.has(key)) return matCache.get(key);
  const t = new THREE.MeshToonMaterial({ color, map: m.map || null, gradientMap: gradient });
  matCache.set(key, t); return t;
}

// ---------------------------------------------------------------- wings / props (in body space)
function makeWings(col) {
  const g = new THREE.Group(), L = new THREE.Group(), R = new THREE.Group(); g.add(L, R);
  const fW = toon('#fbf7ef'), fT = toon(col);
  const sph = new THREE.SphereGeometry(1, 16, 10);
  for (const [w, s] of [[L, 1], [R, -1]]) {
    [[0.42, 0.13, 0.0, 0.62], [0.34, 0.12, -0.13, 0.5], [0.27, 0.1, -0.25, 0.38]].forEach(([len, wd, dy, out], i) => {
      const f = new THREE.Mesh(sph, fW); f.position.set(s * out * 0.68, dy, -0.02 * i); f.scale.set(len, wd, 0.03); f.rotation.z = s * (0.25 + i * 0.22); f.castShadow = true; w.add(f);
      const tip = new THREE.Mesh(sph, fT); tip.position.set(s * out * 1.2, dy - 0.04 - i * 0.03, -0.02 * i - 0.006); tip.scale.set(len * 0.3, wd * 0.8, 0.022); tip.rotation.z = s * (0.3 + i * 0.22); w.add(tip);
    });
  }
  g.position.set(0, 1.28, -0.16); g.visible = false;
  return { g, L, R };
}
function makeParcel() { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.26, 0.3), toon('#c98a4b')); b.castShadow = true; g.add(b); const t = new THREE.Mesh(new THREE.BoxGeometry(0.37, 0.05, 0.31), toon('#f4efe6')); g.add(t); g.position.set(0, 1.0, 0.36); g.visible = false; return g; }
function makeUmbrella(col) {
  const g = new THREE.Group();
  const c = new THREE.Mesh(new THREE.ConeGeometry(0.62, 0.32, 10, 1, true), toon(col, { side: THREE.DoubleSide })); c.position.y = 0.95; g.add(c);
  const p = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.0, 6), toon('#2b2550')); p.position.y = 0.45; g.add(p);
  g.visible = false; return g;
}

// ---------------------------------------------------------------- the character
const V = (x, y, z) => new THREE.Vector3(x, y, z).normalize();
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3(), _q = new THREE.Quaternion(), _wq = new THREE.Quaternion(), _pq = new THREE.Quaternion(), _bq = new THREE.Quaternion();
export function makeRigged(o = {}) {
  const kind = LIB[o.model] ? o.model : 'bot', L = LIB[kind];
  const root = new THREE.Group();                       // world position + yaw (driven by the controller)
  const body = new THREE.Group(); body.position.y = 0.95; root.add(body);   // pivot at the waist: lean, flip, squash
  const model = SkeletonUtils.clone(L.scene);
  const s = (MODELS[kind].height * (o.scale || 1)) / L.rawH;
  model.scale.setScalar(s); model.position.y = -0.95 - L.minY * s; model.rotation.y = -L.faceYaw; body.add(model);   // some exports face -Z
  const top = o.top || '#2f8f8a', joints = o.pants || '#2f3550';
  model.traverse((m) => {
    if (!m.isMesh) return;
    // cull off-screen characters in every pass (colour, outlines, shadows) with a generous bounding sphere
    m.castShadow = true; m.receiveShadow = true; m.frustumCulled = true; 
    if (kind === 'bot') m.material = /joint/i.test(m.material.name) ? toon(joints) : toon(top);
    else m.material = toonFrom(m.material, o.tint || '#ffffff');
  });
  // culling sphere: a 1.5 m ball around the body, expressed in each skinned mesh's own space
  // (compressed meshes keep normalised positions, so the geometry's own bounds are meaningless)
  root.updateMatrixWorld(true);
  model.traverse((m) => { if (m.isSkinnedMesh) { const inv = m.matrixWorld.clone().invert(); m.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.9, 0), 1.5).applyMatrix4(inv); } });
  const bones = {};
  model.traverse((b) => { if (b.isBone) bones[b.name.replace(/^mixamorig:?/, '')] = b; });
  const mixer = new THREE.AnimationMixer(model);
  const act = {};
  for (const [n, clip] of Object.entries(L.set)) { const a = mixer.clipAction(clip); a.enabled = true; a.setEffectiveWeight(0); a.play(); act[n] = a; if (n === 'nod' || n === 'shake' || n === 'dance') a.setLoop(THREE.LoopRepeat); }
  for (const n of ['idle', 'walk', 'run']) act[n]?.setEffectiveWeight(n === 'idle' ? 1 : 0);
  // props: the wings ride on the upper spine (so they stay on the back whatever the pose);
  // the umbrella and the parcel are placed at the hands every frame
  root.updateMatrixWorld(true);
  const wings = makeWings(o.hatCol || o.scarf || '#e4402b');
  const spineB = bones.Spine2 || bones.Spine1 || bones.Spine;
  if (spineB) {
    const bp = new THREE.Vector3(), bq = new THREE.Quaternion(), bs = new THREE.Vector3(), q0 = new THREE.Quaternion();
    spineB.matrixWorld.decompose(bp, bq, bs);
    const wp = new THREE.Vector3(0, 0.06, -0.17).applyQuaternion(body.getWorldQuaternion(q0)).add(bp);
    spineB.add(wings.g); wings.g.scale.setScalar(1 / bs.x);
    wings.g.quaternion.copy(bq.clone().invert().multiply(q0));
    spineB.worldToLocal(wp); wings.g.position.copy(wp);
  } else { wings.g.position.set(0, 0.42, -0.17); body.add(wings.g); }
  const parcel = makeParcel(); body.add(parcel);
  const umb = makeUmbrella(o.hatCol || '#e4402b'); body.add(umb);
  const _h1 = new THREE.Vector3(), _h2 = new THREE.Vector3();
  const atHand = (name, out) => { const b = bones[name]; if (!b) return null; b.updateWorldMatrix(true, false); out.setFromMatrixPosition(b.matrixWorld); return body.worldToLocal(out); };
  const st = { t: Math.random() * 10, air: 0, fly: 0, bike: 0, wave: 0, umb: 0, parcel: 0, land: 0, jump: 0, gest: null, gestT: 0, gestW: 0, lean: 0, prevYaw: 0, ph: 0, w: { idle: 1, walk: 0, run: 0 } };
  const walkD = act.walk?.getClip().duration || 1, runD = act.run?.getClip().duration || 0.7;
  const WALK = kind === 'soldier' ? 1.5 : 1.6, RUN = kind === 'soldier' ? 4.2 : 4.6;   // native clip speeds (m/s)

  function aim(a, b, dirBody, w) {
    if (w <= 0.001) return;
    const A = bones[a], B = bones[b]; if (!A || !B) return;
    A.updateWorldMatrix(true, false); B.updateWorldMatrix(false, false);
    _a.setFromMatrixPosition(A.matrixWorld); _b.setFromMatrixPosition(B.matrixWorld);
    _d.subVectors(_b, _a).normalize();
    body.getWorldQuaternion(_bq); const want = _b.copy(dirBody).applyQuaternion(_bq).normalize();
    _q.setFromUnitVectors(_d, want);
    A.getWorldQuaternion(_wq); _q.multiply(_wq);
    A.parent.getWorldQuaternion(_pq).invert(); _pq.multiply(_q);
    if (Number.isFinite(_pq.x + _pq.y + _pq.z + _pq.w)) A.quaternion.slerp(_pq, Math.min(1, w));   // never let a bad target poison a bone
  }
  function gesture(name, dur = 2.5) { if (!act[name]) return; st.gest = name; st.gestT = dur; act[name].reset(); act[name].setEffectiveWeight(0); }

  function animate(dt, speed, grounded, wave = 0, op = {}) {
    st.t += dt;
    if (op.talk && (!st.gest || st.gestT < 0.2)) gesture('nod', 1.4);
    const k = (r) => 1 - Math.exp(-dt * r);
    const lerp = (a, b, x) => a + (b - a) * x;
    // ---- locomotion weights
    const sp = op.fly ? 0 : speed;
    const tw = { idle: sp < 0.15 ? 1 : 0, walk: 0, run: 0 };
    if (sp >= 0.15) { const r = Math.min(1, Math.max(0, (sp - 2.4) / 1.4)); tw.walk = 1 - r; tw.run = r; }
    st.gestT -= dt;
    const gestOn = st.gest && st.gestT > 0 && sp < 0.6 && grounded && !op.bike && !op.fly;
    st.gestW = lerp(st.gestW, gestOn ? 1 : 0, k(6));
    if (st.gestW < 0.01 && st.gestT <= 0) st.gest = null;
    for (const n of ['idle', 'walk', 'run']) { st.w[n] = lerp(st.w[n], tw[n], k(8)); act[n]?.setEffectiveWeight(st.w[n] * (1 - st.gestW)); }
    for (const n of ['nod', 'shake', 'dance']) act[n]?.setEffectiveWeight(st.gest === n ? st.gestW : 0);
    // stride-matched playback; walk and run share a phase so the feet don't skip when they blend
    const wts = Math.min(1.7, Math.max(0.55, sp / WALK)), rts = Math.min(1.5, Math.max(0.7, sp / RUN));
    const phRate = st.w.run > st.w.walk ? rts / runD : wts / walkD;
    const prevPh = st.ph; st.ph = (st.ph + dt * phRate * (grounded ? 1 : 0.25)) % 1;
    if (act.walk) { act.walk.timeScale = 0; act.walk.time = st.ph * walkD; }
    if (act.run) { act.run.timeScale = 0; act.run.time = st.ph * runD; }
    mixer.update(dt);
    const step = grounded && sp > 0.3 && !op.bike && ((prevPh < 0.5 && st.ph >= 0.5) || st.ph < prevPh);
    // ---- procedural layer
    st.air = lerp(st.air, grounded || op.bike || op.fly ? 0 : 1, k(10));
    st.fly = lerp(st.fly, op.fly != null && op.wings ? Math.max(0.35, op.fly) : 0, k(4));
    st.bike = lerp(st.bike, op.bike ? 1 : 0, k(10));
    st.wave = lerp(st.wave, wave > 0 ? 1 : 0, k(8));
    st.umb = lerp(st.umb, op.umbrella ? 1 : 0, k(8));
    st.parcel = lerp(st.parcel, op.parcel ? 1 : 0, k(8));
    const air = st.air * (1 - st.fly), f = st.fly;
    // jump tuck
    if (air > 0.01) {
      for (const sd of ['Left', 'Right']) { const x = sd === 'Left' ? 1 : -1;
        aim(sd + 'UpLeg', sd + 'Leg', V(x * 0.15, -0.55, sd === 'Left' ? 0.85 : 0.45), air * 0.85);
        aim(sd + 'Leg', sd + 'Foot', V(0, -1, sd === 'Left' ? -0.35 : -0.6), air * 0.85);
        aim(sd + 'Arm', sd + 'ForeArm', V(x * 0.55, 0.75, 0.15), air * 0.55);
      }
    }
    // flying: torso horizontal, right fist forward, left arm swept back, legs trailing
    if (f > 0.01) {
      const sup = Math.min(1, Math.max(0, ((op.fly || 0) - 0.6) * 3)) * f;   // op.fly is undefined once you stop flying
      aim('Spine', 'Spine1', V(0, 1, 0.12), f * 0.6);
      aim('LeftArm', 'LeftForeArm', V(0.75 - 0.35 * sup, -0.35 - 0.4 * sup, -0.35 - 0.2 * sup), f);
      aim('LeftForeArm', 'LeftHand', V(0.7 - 0.45 * sup, -0.3 - 0.5 * sup, -0.3 - 0.25 * sup), f);
      // slow / falling: both arms spread like a glider (both always in view); fast: right fist out front-right
      aim('RightArm', 'RightForeArm', V(-0.75 + 0.3 * sup, -0.35 + 1.2 * sup, -0.35 + 0.5 * sup), f);
      aim('RightForeArm', 'RightHand', V(-0.7 + 0.35 * sup, -0.3 + 1.25 * sup, -0.3 + 0.45 * sup), f);
      const kick = Math.sin(st.t * 3) * 0.12;
      aim('LeftUpLeg', 'LeftLeg', V(0.08, -1, -0.08 + kick), f); aim('LeftLeg', 'LeftFoot', V(0.05, -1, -0.25 + kick), f);
      aim('RightUpLeg', 'RightLeg', V(-0.08, -1, -0.08 - kick), f); aim('RightLeg', 'RightFoot', V(-0.05, -1, -0.45 - kick), f);
      aim('Neck', 'Head', V(0, 1, -0.6), f * 0.75);
    }
    // bike: sit, hands on the bars, pedal
    if (st.bike > 0.01) {
      const b = st.bike, p = st.t * Math.max(1.5, speed * 2.2);
      for (const [sd, x, ph] of [['Left', 1, 0], ['Right', -1, Math.PI]]) {
        aim(sd + 'UpLeg', sd + 'Leg', V(x * 0.12, -0.15 + Math.sin(p + ph) * 0.35, 1), b);
        aim(sd + 'Leg', sd + 'Foot', V(0, -1, -0.15 + Math.cos(p + ph) * 0.35), b);
        aim(sd + 'Arm', sd + 'ForeArm', V(x * 0.3, -0.45, 1), b); aim(sd + 'ForeArm', sd + 'Hand', V(x * 0.1, -0.25, 1), b);
      }
      aim('Spine', 'Spine1', V(0, 1, 0.45), b);
    }
    // sitting (benches, café chairs) and driving: thighs forward, shins down, hands on lap or on the wheel
    st.sit = lerp(st.sit || 0, op.sit || op.drive ? 1 : 0, k(10));
    if (st.sit > 0.01) {
      const s = st.sit;
      for (const [sd, x] of [['Left', 1], ['Right', -1]]) {
        aim(sd + 'UpLeg', sd + 'Leg', V(x * 0.14, -0.08, 1), s);
        aim(sd + 'Leg', sd + 'Foot', V(x * 0.03, op.drive ? -0.7 : -1, op.drive ? 0.7 : 0.12), s);
        if (op.drive) { aim(sd + 'Arm', sd + 'ForeArm', V(x * 0.2, -0.3, 1), s); aim(sd + 'ForeArm', sd + 'Hand', V(-x * 0.25 + x * (op.steer || 0) * 0.3, 0.2 - x * (op.steer || 0) * 0.4, 1), s); }
        else if (!op.phone) { aim(sd + 'Arm', sd + 'ForeArm', V(x * 0.25, -1, 0.35), s * 0.9); aim(sd + 'ForeArm', sd + 'Hand', V(-x * 0.2, -0.25, 1), s * 0.9); }
      }
      aim('Spine', 'Spine1', V(0, 1, op.drive ? -0.18 : -0.05), s * 0.8);
    }
    // looking at a phone
    st.phone = lerp(st.phone || 0, op.phone ? 1 : 0, k(8));
    if (st.phone > 0.01) { aim('RightArm', 'RightForeArm', V(-0.3, -0.9, 0.35), st.phone); aim('RightForeArm', 'RightHand', V(0.35, 0.7, 0.7), st.phone); aim('Neck', 'Head', V(0, 0.75, 0.6), st.phone * 0.7); }
    // parcel: arms forward under the box
    if (st.parcel > 0.01 && st.bike < 0.5 && f < 0.5) for (const [sd, x] of [['Left', 1], ['Right', -1]]) { aim(sd + 'Arm', sd + 'ForeArm', V(x * 0.25, -0.6, 0.75), st.parcel); aim(sd + 'ForeArm', sd + 'Hand', V(-x * 0.25, 0.15, 1), st.parcel); }
    // umbrella overhead (right arm)
    if (st.umb > 0.01 && f < 0.5) { aim('RightArm', 'RightForeArm', V(-0.35, 0.9, 0.1), st.umb); aim('RightForeArm', 'RightHand', V(0.15, 1, 0.1), st.umb); }
    // wave hello (right arm)
    if (st.wave > 0.01) { aim('RightArm', 'RightForeArm', V(-0.6, 0.85, 0.15), st.wave); aim('RightForeArm', 'RightHand', V(-0.15 + Math.sin(st.t * 11) * 0.45, 1, 0.25), st.wave); }
    // ---- whole-body: lean into turns, fly tilt, flip, squash & stretch
    let dy = root.rotation.y - st.prevYaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); st.prevYaw = root.rotation.y;
    st.lean = lerp(st.lean, Math.max(-0.35, Math.min(0.35, -dy / Math.max(dt, 1e-3) * 0.045 * Math.min(1, speed / 3))), k(6));
    if (op.fly != null && op.wings) st.lean = lerp(st.lean, st.lean * 2.2, 0.2);
    const flip = op.flip ? -op.flip * Math.PI * 2 : 0;
    body.rotation.set(f * 1.25 + (op.bike ? 0 : 0) + flip, 0, st.lean, 'YXZ');
    if (st.jump > 0) st.jump = Math.max(0, st.jump - dt * 5);
    st.land = Math.max(0, st.land - dt * 4.5);
    const sq = st.land * 0.16 * Math.sin(st.land * Math.PI) - st.jump * 0.1 + (air > 0.5 && !op.flip ? -0.04 : 0);
    body.scale.set(1 + sq * 0.6, 1 - sq, 1 + sq * 0.6);
    body.position.y = 0.95 + (op.bike ? 0.1 : 0) - st.land * 0.05 - (st.sit || 0) * (op.drive ? 0.42 : 0.4);
    // wings with follow-through (they lag the body's motion)
    wings.g.visible = !!op.wings; if (op.wings) { const fl = op.flap ?? 1; const a2 = 0.2 + Math.sin(st.t * (6 + fl * 6)) * (0.15 + 0.5 * fl); wings.L.rotation.set(0, -0.35, a2); wings.R.rotation.set(0, 0.35, -a2); }
    parcel.visible = st.parcel > 0.5; umb.visible = st.umb > 0.5;
    if (umb.visible && atHand('RightHand', _h1)) umb.position.copy(_h1).add(_h2.set(0, -0.08, 0));
    if (parcel.visible && atHand('LeftHand', _h1) && atHand('RightHand', _h2)) parcel.position.copy(_h1).add(_h2).multiplyScalar(0.5).add(_h2.set(0, 0.12, 0.04));
    return step;
  }
  return {
    root, body, model, mixer, st, kind, animate, gesture,
    head: bones.Head || body,
    land() { st.land = 1; }, jump() { st.jump = 1; },
  };
}
