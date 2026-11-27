// Rigged, motion-captured soldiers: base animation from the mixer, arms (and airborne legs) solved on top.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';

let source;
export async function loadSoldier(manager) { source = await new GLTFLoader(manager).loadAsync('assets/soldier.glb'); }

const V = () => new THREE.Vector3();
const a = V(), b = V(), c = V(), d = V(), want = V(), chest = V(), grip = V(), hold = V(), fore = V(), dir = V(), pole = V(), elbow = V();
const qa = new THREE.Quaternion(), qb = new THREE.Quaternion();
const curl = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), .95);

// rotate `bone` so that the segment bone -> child points along world direction `to`
function point(bone, child, to, k = 1) {
  bone.getWorldPosition(a); child.getWorldPosition(b); b.sub(a).normalize();
  qa.setFromUnitVectors(b, c.copy(to).normalize());
  bone.getWorldQuaternion(qb); qa.multiply(qb);
  bone.parent.getWorldQuaternion(qb).invert();
  qb.multiply(qa); bone.quaternion.slerp(qb, k); bone.updateWorldMatrix(false, true);
}
const UP = new THREE.Vector3(0, 1, 0);
function yaw(bone, angle) {
  bone.getWorldQuaternion(qb); qa.setFromAxisAngle(UP, angle).multiply(qb);
  bone.parent.getWorldQuaternion(qb).invert(); bone.quaternion.copy(qb.multiply(qa)); bone.updateWorldMatrix(false, true);
}
// two-bone IK: shoulder -> elbow -> hand reaches `target`
function reach(upper, lower, hand, target, bend) {
  const S = upper.getWorldPosition(V()), E = lower.getWorldPosition(V()), H = hand.getWorldPosition(V());
  const l1 = S.distanceTo(E), l2 = E.distanceTo(H);
  d.copy(target).sub(S); const dist = THREE.MathUtils.clamp(d.length(), .05, l1 + l2 - .001); d.normalize();
  const x = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist), y = Math.sqrt(Math.max(0, l1 * l1 - x * x));
  pole.copy(bend).addScaledVector(d, -bend.dot(d)).normalize();
  elbow.copy(S).addScaledVector(d, x).addScaledVector(pole, y);
  point(upper, lower, want.copy(elbow).sub(S));
  lower.getWorldPosition(E);
  point(lower, hand, want.copy(target).sub(E));
}

function rifle() {
  const g = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0x24272b, metalness: .9, roughness: .32 });
  const poly = new THREE.MeshStandardMaterial({ color: 0x14151a, metalness: .2, roughness: .6 });
  const add = (geo, m, x, y, z = 0, rz = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.z = rz; o.castShadow = true; g.add(o); return o; };
  const B = (w, h, t) => new THREE.BoxGeometry(w, h, t), C = (r, l) => new THREE.CylinderGeometry(r, r, l, 10);
  add(B(.42, .12, .07), metal, .14, .04); add(B(.3, .09, .08), poly, .48, .035);
  add(C(.018, .34), metal, .78, .045, 0, Math.PI / 2); add(C(.03, .07), poly, .96, .045, 0, Math.PI / 2);
  add(B(.075, .2, .05), poly, .2, -.1, 0, .28); add(B(.06, .14, .05), poly, .0, -.08, 0, -.3);
  add(B(.26, .1, .06), poly, -.2, .0); add(B(.05, .15, .065), poly, -.34, -.02);
  add(B(.16, .035, .035), metal, .15, .14); add(C(.028, .13), poly, .15, .17, 0, Math.PI / 2);
  const flash = new THREE.Group(); flash.position.set(1.08, .045, 0); g.add(flash);
  const fm = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffb340).multiplyScalar(6), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, side: THREE.DoubleSide });
  for (let i = 0; i < 3; i++) { const s = new THREE.Shape(); s.moveTo(0, -.03); s.lineTo(.14, -.09); s.lineTo(.42, 0); s.lineTo(.14, .09); s.lineTo(0, .03); const m = new THREE.Mesh(new THREE.ShapeGeometry(s), fm); m.rotation.x = i * Math.PI / 3; flash.add(m); }
  flash.visible = false;
  return { g, flash };
}

export function soldier(p) {
  const root = new THREE.Group(), tilt = new THREE.Group(); root.add(tilt);
  const model = clone(source.scene); model.rotation.y = -Math.PI / 2; model.scale.setScalar(p.scale || 1.22); tilt.add(model);
  const bones = {};
  model.traverse(o => {
    if (/^mixamorig/.test(o.name)) bones[o.name.replace(/^mixamorig:?/, '')] = o;
    if (o.isMesh) {
      o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
      o.material = o.material.clone(); o.material.color.set(/visor/i.test(o.material.name) ? p.visor : p.tint);
      if (/visor/i.test(o.material.name)) { o.material.emissive.set(p.visor); o.material.emissiveIntensity = 1.6; }
    }
  });
  const fingers = Object.keys(bones).filter(n => /Hand(Index|Middle|Ring|Pinky)[123]$/.test(n)).map(n => [bones[n], bones[n].quaternion.clone()]);
  const mixer = new THREE.AnimationMixer(model), actions = {};
  for (const clip of source.animations) if (clip.name !== 'TPose') { actions[clip.name] = mixer.clipAction(clip); actions[clip.name].play(); actions[clip.name].setEffectiveWeight(0); }
  const gun = rifle(); root.add(gun.g);
  let band;
  if (p.band) {
    band = new THREE.Group(); root.add(band);
    const m = new THREE.MeshStandardMaterial({ color: p.band, emissive: p.band, emissiveIntensity: .35, roughness: .7, side: THREE.DoubleSide });
    const tail = new THREE.Mesh(new THREE.PlaneGeometry(.34, .045, 8, 1), m); tail.position.x = -.29; band.add(tail);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.128, .017, 8, 28), m); ring.rotation.x = Math.PI / 2; band.add(ring);
    band.userData = { tail, base: tail.geometry.attributes.position.array.slice() };
  }
  Object.assign(root.userData, { fingers, tilt, model, bones, mixer, actions, gun: gun.g, flash: gun.flash, band, w: { Idle: 1, Run: 0, Walk: 0 }, t: Math.random() * 3 });
  return root;
}

export function pose(o, e, dt) {
  const u = o.userData, B = u.bones;
  e.face = e.face || 1; u.t += dt;
  const target = e.face > 0 ? 0 : Math.PI;
  o.rotation.y += (target - o.rotation.y) * Math.min(1, dt * 14);
  const air = !e.on, run = Math.abs(e.vx) > .5 && !air;
  const goal = run ? 'Run' : 'Idle';
  for (const n in u.actions) { u.w[n] += ((n === goal ? 1 : 0) - u.w[n]) * Math.min(1, dt * 12); u.actions[n].setEffectiveWeight(u.w[n]); }
  u.actions.Run.timeScale = Math.max(.9, Math.abs(e.vx) / 5.6);
  u.mixer.update(dt);
  const lie = e.prone ? 1 : 0;
  u.lie = THREE.MathUtils.lerp(u.lie || 0, lie, Math.min(1, dt * 14));
  u.tilt.rotation.z = -u.lie * 1.46; u.tilt.position.set(-u.lie * .95, u.lie * .27, 0);
  o.updateWorldMatrix(true, true);
  const f = Math.cos(o.rotation.y) >= 0 ? 1 : -1, aim = e.aim || 0;
  dir.set(Math.cos(aim) * f, Math.sin(aim), 0);
  if (air) {
    point(B.LeftUpLeg, B.LeftLeg, want.set(.9 * f, -.35, 0)); point(B.LeftLeg, B.LeftFoot, want.set(-.35 * f, -1, 0));
    point(B.RightUpLeg, B.RightLeg, want.set(-.15 * f, -1, 0)); point(B.RightLeg, B.RightFoot, want.set(-.95 * f, -.3, 0));
  }
  if (!air && !run && !e.prone) {
    // braced firing stance: left foot forward, knees soft
    point(B.LeftUpLeg, B.LeftLeg, want.set(.42 * f, -.9, -.1 * f)); point(B.LeftLeg, B.LeftFoot, want.set(-.04 * f, -1, 0));
    point(B.RightUpLeg, B.RightLeg, want.set(-.2 * f, -.96, .12 * f)); point(B.RightLeg, B.RightFoot, want.set(-.46 * f, -.89, 0));
    u.tilt.updateWorldMatrix(true, true);
    const foot = Math.min(B.LeftFoot.getWorldPosition(a).y, B.RightFoot.getWorldPosition(b).y) - o.getWorldPosition(c).y;
    u.tilt.position.y += .13 - foot; u.tilt.updateWorldMatrix(true, true);
  }
  if (!e.prone) {
    point(B.Spine, B.Spine1, want.set((.14 + (run ? .1 : 0) - Math.sin(aim) * .16) * f, 1, 0));
    point(B.Spine1, B.Spine2, want.set((.16 + (run ? .08 : 0) - Math.sin(aim) * .24) * f, 1, 0));
    yaw(B.Spine2, -.42);            // blade the shoulders behind the rifle
    yaw(B.Neck, .36);               // eyes stay down the sights
    point(B.Neck, B.Head, want.set((.34 - Math.sin(aim) * .2) * f, 1, .08 * f), .9);
  } else point(B.Neck, B.Head, want.set(.25 * f, 1, 0));
  // stock tucked into the right shoulder, support hand under the handguard
  B.RightArm.getWorldPosition(chest); B.LeftArm.getWorldPosition(fore); chest.lerp(fore, .3);
  const lift = Math.abs(dir.y);
  grip.copy(chest).addScaledVector(dir, .32); grip.y -= .12 - Math.max(0, dir.y) * .04; grip.x += f * lift * .24; grip.z += .06 * f;
  // targets are the wrists, so they sit just behind and below the parts the fingers wrap around
  hold.copy(grip).addScaledVector(dir, -.07); hold.y -= .05;
  fore.copy(grip).addScaledVector(dir, .24); fore.y -= .055; fore.z -= .02 * f;
  reach(B.RightArm, B.RightForeArm, B.RightHand, hold, want.set(-.35 * f, -1, .7 * f).clone());
  reach(B.LeftArm, B.LeftForeArm, B.LeftHand, fore, want.set(.1 * f, -1, -.35 * f).clone());
  // hands follow the rifle, fingers closed
  point(B.RightHand, B.RightHandMiddle1, want.copy(dir).setY(dir.y - .25));
  point(B.LeftHand, B.LeftHandMiddle1, want.copy(dir).setY(dir.y + .3).setZ(.8 * f));
  for (const [bone, base] of u.fingers) bone.quaternion.copy(base).multiply(curl);
  // gun and headband live in the soldier's local space
  o.worldToLocal(u.gun.position.copy(grip));
  u.gun.position.y += .03; u.gun.rotation.set(0, 0, aim);
  if (u.band) {
    B.Head.getWorldPosition(a); B.HeadTop_End.getWorldPosition(b);
    o.worldToLocal(u.band.position.copy(a).lerp(b, .66));
    u.band.rotation.z = -u.lie * .4;
    const g = u.band.userData.tail.geometry.attributes.position, base = u.band.userData.base;
    for (let i = 0; i < g.count; i++) { const x = base[i * 3], k = (.17 - x) / .34; g.setY(i, base[i * 3 + 1] + Math.sin(u.t * 14 + x * 14) * .07 * k - (run || air ? 0 : k * k * .3)); }
    g.needsUpdate = true;
  }
}

// ---------- death: hit reaction, knees give way, weighted fall, settle ----------
const smooth = (x, a0, a1) => THREE.MathUtils.smoothstep(x, a0, a1);
// keyframes: [time, spine, head, thighL, shinL, thighR, shinR, upperArmL, foreArmL, upperArmR, foreArmR, bodyAngle]
// directions are [forward, up, side]; a positive body angle tips the soldier onto his back
const FALLS = {
  back: [
    [0, [-.1, 1, 0], [-.35, 1, 0], [.15, -1, -.1], [-.1, -1, 0], [-.1, -1, .1], [-.25, -1, 0], [.2, -.5, -.8], [.8, .1, -.4], [.1, -.6, .8], [.8, 0, .3], .05],
    [.16, [-.55, .85, .12], [-.8, .6, .1], [.5, -.85, -.12], [-.35, -1, 0], [.05, -1, .15], [-.4, -.9, 0], [.35, .35, -.85], [.5, .8, -.4], [-.2, .1, 1], [.1, .8, .5], .24],
    [.48, [-.3, .95, .15], [-.4, .9, .25], [.85, -.5, -.18], [-.55, -.85, 0], [.55, -.8, .22], [-.7, -.7, 0], [.15, -.1, -1], [.45, .35, -.8], [-.35, -.3, .9], [-.1, .4, .9], .72],
    [.84, [-.06, 1, .04], [-.2, 1, .2], [.55, -.82, -.2], [-.15, -1, -.05], [.2, -1, .25], [-.1, -1, .1], [-.1, .1, -1], [-.1, .65, -.75], [-.2, -.45, .9], [.1, -.5, .85], 1.62],
    [1.02, [.05, 1, 0], [.05, 1, .3], [.38, -.92, -.18], [-.18, -1, 0], [.12, -1, .22], [0, -1, .1], [-.05, -.1, -1], [0, .45, -.9], [-.1, -.65, .75], [.15, -.8, .6], 1.47],
    [1.45, [.02, 1, 0], [-.08, 1, .55], [.2, -1, -.2], [-.04, -1, -.08], [.06, -1, .2], [-.06, -1, .1], [-.05, -.35, -.95], [.05, .2, -1], [-.08, -.75, .65], [.05, -.9, .45], 1.52]
  ],
  knees: [
    [0, [.2, 1, 0], [.3, 1, 0], [.15, -1, -.1], [-.1, -1, 0], [-.05, -1, .1], [-.2, -1, 0], [.4, -.8, -.4], [.9, -.2, -.1], [.3, -.8, .4], [.9, -.3, .1], 0],
    [.2, [.5, .85, -.15], [.55, .8, -.2], [.55, -.82, -.1], [-.5, -.86, 0], [.35, -.93, .1], [-.55, -.82, 0], [.5, -.75, -.4], [.7, -.65, .3], [.15, -1, .35], [.45, -.9, 0], 0],
    [.56, [.18, 1, 0], [.55, .8, .1], [.5, -.86, -.14], [-1, -.12, 0], [.38, -.92, .14], [-1, -.08, 0], [.08, -1, -.3], [.2, -1, -.12], [0, -1, .32], [.15, -1, .1], -.04],
    [.74, [.28, .96, .08], [.2, .95, .25], [.4, -.9, -.14], [-1, -.1, 0], [.3, -.95, .14], [-1, -.06, 0], [.1, -1, -.3], [.3, -.95, -.1], [.05, -1, .3], [.2, -1, .1], -.14],
    [1.18, [.1, 1, 0], [-.15, 1, .35], [0, -1, -.15], [-.45, -.9, 0], [-.02, -1, .15], [-.35, -.93, .05], [.2, .45, -.85], [.15, 1, -.25], [.35, -.35, .85], [.5, .4, .65], -1.55],
    [1.32, [.04, 1, 0], [-.12, 1, .5], [-.02, -1, -.18], [-.25, -.96, 0], [0, -1, .18], [-.12, -1, .05], [.08, .35, -.93], [.05, 1, -.1], [.12, -.5, .85], [.1, .2, 1], -1.45],
    [1.65, [.02, 1, 0], [-.06, 1, .7], [0, -1, -.2], [-.06, -1, 0], [0, -1, .2], [-.04, -1, .05], [.04, .3, -.95], [0, 1, -.12], [.06, -.65, .75], [.05, .1, 1], -1.52]
  ]
};
const SEGMENTS = [['Spine', 'Spine1'], ['Neck', 'Head'], ['LeftUpLeg', 'LeftLeg'], ['LeftLeg', 'LeftFoot'], ['RightUpLeg', 'RightLeg'], ['RightLeg', 'RightFoot'], ['LeftArm', 'LeftForeArm'], ['LeftForeArm', 'LeftHand'], ['RightArm', 'RightForeArm'], ['RightForeArm', 'RightHand']];
const CONTACT = { Hips: .16, Spine2: .2, Head: .15, LeftLeg: .1, RightLeg: .1, LeftFoot: .12, RightFoot: .12, LeftHand: .06, RightHand: .06 };

export function startDeath(o, fromFront) {
  const u = o.userData; u.flash.visible = false;
  u.death = { t: 0, keys: FALLS[fromFront ? 'back' : 'knees'], gv: new THREE.Vector3((Math.random() - .3) * 2.2, 2.4, .8), spin: (Math.random() - .5) * 9, rate: .9 + Math.random() * .22, twist: (Math.random() - .5) * .35, landed: false };
}
export function revive(o) {
  const u = o.userData; u.death = null; u.lie = 0; u.tilt.rotation.set(0, 0, 0); u.tilt.position.set(0, 0, 0); u.mixer.stopAllAction();
  for (const n in u.actions) { u.actions[n].reset().play(); u.w[n] = n === 'Idle' ? 1 : 0; u.actions[n].setEffectiveWeight(u.w[n]); }
}
// returns true on the frame the torso hits the ground
export function die(o, dt, grounded) {
  const u = o.userData, B = u.bones, d = u.death, K = d.keys;
  d.t += dt * d.rate;
  let i = 0; while (i < K.length - 2 && d.t > K[i + 1][0]) i++;
  const p = K[i], q = K[i + 1], raw = THREE.MathUtils.clamp((d.t - p[0]) / (q[0] - p[0]), 0, 1);
  const falling = Math.abs(q[11]) - Math.abs(p[11]) > .4;
  const s = falling ? raw * raw : smooth(raw, 0, 1);   // gravity accelerates the topple
  const angle = THREE.MathUtils.lerp(p[11], q[11], s);
  const f = Math.cos(o.rotation.y) >= 0 ? 1 : -1, cs = Math.cos(angle), sn = Math.sin(angle), k = Math.min(1, dt * 22);
  u.tilt.rotation.set(d.twist * smooth(d.t, .2, 1), 0, angle); u.tilt.position.set(0, 0, 0); o.updateWorldMatrix(true, true);
  if (d.t < p[0] + 2.2) SEGMENTS.forEach(([from, to], n) => {
    const x = THREE.MathUtils.lerp(p[n + 1][0], q[n + 1][0], s), y = THREE.MathUtils.lerp(p[n + 1][1], q[n + 1][1], s), z = THREE.MathUtils.lerp(p[n + 1][2], q[n + 1][2], s);
    point(B[from], B[to], want.set((x * cs - y * sn) * f, x * sn + y * cs, z * f), k);
  });
  // keep whichever body part is lowest resting on the floor
  o.updateWorldMatrix(true, true);
  if (grounded) {
    let low = Infinity; for (const n in CONTACT) low = Math.min(low, B[n].getWorldPosition(a).y - CONTACT[n]);
    u.tilt.position.y = o.getWorldPosition(b).y - low;
  }
  // the rifle slips out of his hands
  const g = u.gun.position;
  d.gv.y -= 16 * dt; g.addScaledVector(d.gv, dt); u.gun.rotation.z += d.spin * dt;
  if (grounded && g.y < .09) { g.y = .09; d.gv.y *= -.25; d.gv.x *= .5; d.gv.z *= .4; d.spin = 0; u.gun.rotation.z += (Math.round(u.gun.rotation.z / Math.PI) * Math.PI - u.gun.rotation.z) * Math.min(1, dt * 14); u.gun.rotation.x += (1.45 - u.gun.rotation.x) * Math.min(1, dt * 9); }
  if (u.band) { B.Head.getWorldPosition(a); B.HeadTop_End.getWorldPosition(b); o.worldToLocal(u.band.position.copy(a).lerp(b, .66)); u.band.rotation.z = angle; }
  const hit = !d.landed && grounded && Math.abs(angle) > 1.4; if (hit) d.landed = true; return hit;
}
