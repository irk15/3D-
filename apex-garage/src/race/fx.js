// Particle and decal effects: skid marks, tyre smoke, sparks, rain, backfire flashes.
import * as THREE from 'three';
import { canvasTex, glowTex, hdr } from './tracks.js';

const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), S = new THREE.Vector3(1, 1, 1), Y = new THREE.Vector3(0, 1, 0);

export function createFx(scene) {
  /* skid marks: instanced ring buffer */
  const SK = 2400;
  const skidG = new THREE.PlaneGeometry(0.3, 0.9); skidG.rotateX(-Math.PI / 2);
  const skids = new THREE.InstancedMesh(skidG, new THREE.MeshBasicMaterial({ color: 0x050505, transparent: true, opacity: 0.6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 }), SK);
  skids.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  skids.frustumCulled = false;
  let skidN = 0, skidDirty = false;
  const clearSkids = () => { M.makeScale(0, 0, 0); for (let i = 0; i < SK; i++) skids.setMatrixAt(i, M); skids.instanceMatrix.needsUpdate = true; skidN = 0; };
  clearSkids();
  scene.add(skids);

  /* smoke: sprite pool */
  const smokeTex = canvasTex(64, 64, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gr.addColorStop(0, 'rgba(225,225,232,.6)'); gr.addColorStop(1, 'rgba(225,225,232,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
  const smoke = [];
  for (let i = 0; i < 70; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, transparent: true, depthWrite: false, opacity: 0 }));
    s.visible = false; s.userData = { life: 0, vx: 0, vy: 0, vz: 0, grow: 4 };
    scene.add(s); smoke.push(s);
  }
  let smokeI = 0;

  /* sparks: points with per-particle velocity */
  const SP = 260;
  const spPos = new Float32Array(SP * 3), spVel = new Float32Array(SP * 3), spLife = new Float32Array(SP);
  const spGeo = new THREE.BufferGeometry();
  spGeo.setAttribute('position', new THREE.BufferAttribute(spPos, 3).setUsage(THREE.DynamicDrawUsage));
  const sparks = new THREE.Points(spGeo, new THREE.PointsMaterial({ color: hdr('#ffb347', 4), size: 0.16, map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  sparks.frustumCulled = false;
  scene.add(sparks);
  let spI = 0;

  /* backfire / shift flashes */
  const flashes = [];
  for (let i = 0; i < 10; i++) {
    const f = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: hdr('#ff7a1a', 5), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
    f.visible = false; f.userData = { life: 0 }; scene.add(f); flashes.push(f);
  }

  /* rain */
  const RN = 3200, rainBox = 46;
  const rPos = new Float32Array(RN * 6);
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rPos, 3).setUsage(THREE.DynamicDrawUsage));
  const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: 0xaab8d0, transparent: true, opacity: 0.35, depthWrite: false }));
  rain.frustumCulled = false; rain.visible = false;
  const drops = new Float32Array(RN * 3);
  for (let i = 0; i < RN; i++) { drops[i * 3] = (Math.random() - 0.5) * rainBox * 2; drops[i * 3 + 1] = Math.random() * 30; drops[i * 3 + 2] = (Math.random() - 0.5) * rainBox * 2; }
  scene.add(rain);

  return {
    clear() {
      clearSkids();
      smoke.forEach((s) => { s.userData.life = 0; s.visible = false; });
      spLife.fill(0);
      flashes.forEach((f) => { f.userData.life = 0; f.visible = false; });
    },
    setRain(on) { rain.visible = on; },
    skid(x, y, z, heading, w = 0.3) {
      M.compose(V.set(x, y + 0.08, z), Q.setFromAxisAngle(Y, heading), S.set(w / 0.3, 1, 1));
      skids.setMatrixAt(skidN++ % SK, M);
      skidDirty = true;
    },
    smoke(x, y, z, vx, vz, size = 1) {
      const s = smoke[smokeI++ % smoke.length], u = s.userData;
      s.visible = true; u.life = 1; u.grow = 3 + size * 3;
      s.position.set(x, y + 0.35, z);
      u.vx = vx * 0.25 + (Math.random() - 0.5) * 1.5; u.vy = 0.6 + Math.random() * 0.6; u.vz = vz * 0.25 + (Math.random() - 0.5) * 1.5;
      s.scale.setScalar(0.8 * size);
    },
    sparks(x, y, z, vx, vz, n = 8) {
      for (let k = 0; k < n; k++) {
        const i = spI++ % SP;
        spPos[i * 3] = x; spPos[i * 3 + 1] = y + 0.3; spPos[i * 3 + 2] = z;
        spVel[i * 3] = vx * 0.6 + (Math.random() - 0.5) * 6; spVel[i * 3 + 1] = 1 + Math.random() * 4; spVel[i * 3 + 2] = vz * 0.6 + (Math.random() - 0.5) * 6;
        spLife[i] = 0.4 + Math.random() * 0.5;
      }
    },
    flash(x, y, z, big = false) {
      const f = flashes.find((q) => q.userData.life <= 0) || flashes[0];
      f.visible = true; f.userData.life = big ? 0.12 : 0.07; f.position.set(x, y, z);
      const s = big ? 1.1 : 0.6; f.scale.set(s, s, 1); f.material.opacity = 1;
    },
    update(dt, cam) {
      if (skidDirty) { skids.instanceMatrix.needsUpdate = true; skidDirty = false; }
      for (const s of smoke) {
        const u = s.userData; if (u.life <= 0) continue;
        u.life -= dt * 0.8;
        s.position.x += u.vx * dt; s.position.y += u.vy * dt; s.position.z += u.vz * dt;
        s.scale.setScalar(0.8 + (1 - u.life) * u.grow);
        s.material.opacity = Math.max(0, u.life) * 0.42;
        if (u.life <= 0) s.visible = false;
      }
      let any = false;
      for (let i = 0; i < SP; i++) {
        if (spLife[i] <= 0) { spPos[i * 3 + 1] = -999; continue; }
        any = true;
        spLife[i] -= dt;
        spVel[i * 3 + 1] -= 9.8 * dt;
        spPos[i * 3] += spVel[i * 3] * dt; spPos[i * 3 + 1] += spVel[i * 3 + 1] * dt; spPos[i * 3 + 2] += spVel[i * 3 + 2] * dt;
      }
      if (any || this._sp) spGeo.attributes.position.needsUpdate = true;
      this._sp = any;
      for (const f of flashes) { const u = f.userData; if (u.life <= 0) continue; u.life -= dt; f.material.opacity = Math.max(0, u.life * 12); if (u.life <= 0) f.visible = false; }
      if (rain.visible && cam) {
        const cx = cam.position.x, cy = cam.position.y, cz = cam.position.z;
        for (let i = 0; i < RN; i++) {
          let y = drops[i * 3 + 1] - dt * 26;
          if (y < 0) y += 30;
          drops[i * 3 + 1] = y;
          let x = drops[i * 3], z = drops[i * 3 + 2];
          // wrap drops around the camera
          const wx = cx + (((x - cx) % (rainBox * 2)) + rainBox * 3) % (rainBox * 2) - rainBox;
          const wz = cz + (((z - cz) % (rainBox * 2)) + rainBox * 3) % (rainBox * 2) - rainBox;
          drops[i * 3] = wx; drops[i * 3 + 2] = wz;
          const o = i * 6, yy = cy - 12 + y;
          rPos[o] = wx; rPos[o + 1] = yy; rPos[o + 2] = wz;
          rPos[o + 3] = wx + 0.05; rPos[o + 4] = yy - 0.7; rPos[o + 5] = wz + 0.05;
        }
        rainGeo.attributes.position.needsUpdate = true;
      }
    }
  };
}
