// APEX // NIGHT RUN: race mode.
// A neon night-city circuit, arcade drift physics, 3 AI rivals, laps, nitro and a minimap.
import * as THREE from 'three';

const LAPS = 3;
const HALF_W = 8;          // half road width (m)
const WALL = HALF_W + 3.2; // wall offset from centreline
const STEP = 1 / 120;      // fixed physics step
const TRACK = [[0, -200], [250, -210], [380, -150], [400, -20], [330, 60], [220, 40], [150, 110], [180, 230], [90, 300], [-80, 290], [-160, 200], [-120, 110], [-220, 40], [-330, 30], [-380, -80], [-300, -180], [-150, -200]];

const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;
const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const hdr = (hex, k) => new THREE.Color(hex).multiplyScalar(k);

function canvasTex(w, h, draw, { repeat, srgb = true } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (repeat) t.repeat.set(...repeat);
  return t;
}
const fmt = (t) => {
  if (!isFinite(t)) return '--:--.--';
  const m = Math.floor(t / 60), s = t - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, '0')}`;
};

export function createRace(ctx) {
  const { renderer, composer, renderPass, bloom, audio, CARS, loadCar, computeStats, getEnv, onExit } = ctx;
  let built = false;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.3, 1600);
  const api = { active: false, start, stop, update, resize, scene, camera, debug: () => ({ countdown: race.countdown, started: race.started, time: race.time, quality, finished: race.finished, best: race.best, racers: racers.map((r) => ({ fin: r.finished && +r.finishTime.toFixed(2), bl: +r.bestLap.toFixed(2), n: r.cfg.id, p: r.progress, lap: r.lap, v: Math.round(r.vf * 3.6), idx: r.idx })) }) };

  /* ───────── Track data ───────── */
  const curve = new THREE.CatmullRomCurve3(TRACK.map((p) => new THREE.Vector3(p[0], 0, p[1])), true, 'centripetal');
  const N = 1600;
  const P = curve.getSpacedPoints(N); P.pop();
  const LEN = curve.getLength();
  const SEG = LEN / N;
  const T = [], L = [], K = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const t = P[(i + 1) % N].clone().sub(P[(i - 1 + N) % N]).normalize();
    T.push(t);
    L.push(new THREE.Vector3(t.z, 0, -t.x)); // driver's left
  }
  for (let i = 0; i < N; i++) {
    const a = T[(i - 3 + N) % N], b = T[(i + 3) % N];
    K[i] = Math.acos(clamp(a.dot(b), -1, 1)) / (6 * SEG);
  }
  // upcoming max curvature (lookahead in samples), precomputed for AI
  const KA = new Float32Array(N);
  for (let i = 0; i < N; i++) { let m = 0; for (let j = 4; j < 90; j += 2) m = Math.max(m, K[(i + j) % N] / (1 + j * SEG / 60)); KA[i] = m; }

  /* ───────── DOM: HUD ───────── */
  const hud = document.createElement('div');
  hud.id = 'race';
  hud.innerHTML = `
    <div class="rTop">
      <div class="rPos"><b id="rPos">4</b><span>/4</span><em>POS</em></div>
      <div class="rLap"><em>LAP</em><b id="rLap">1/${LAPS}</b></div>
      <div class="rTimes"><div><em>TIME</em><b id="rTime">0:00.00</b></div><div><em>BEST LAP</em><b id="rBest">--:--.--</b></div></div>
    </div>
    <canvas id="rMap" width="220" height="220"></canvas>
    <div class="rBoard" id="rBoard"></div>
    <div class="rCenter"><div id="rCount"></div><div id="rMsg"></div></div>
    <div class="rSpeedo">
      <div class="rGear" id="rGear">N</div>
      <div class="rSpd"><b id="rSpd">0</b><span>KM/H</span></div>
      <div class="rRpm"><i id="rRpm"></i></div>
      <div class="rNos"><span>NITRO</span><i><em id="rNos"></em></i></div>
    </div>
    <div class="rKeys">W/↑ gas · S/↓ brake · A D steer · SPACE drift · SHIFT nitro · C camera · R reset · ESC pause</div>
    <div class="rTouch" id="rTouch">
      <div class="tl"><button data-k="left">◀</button><button data-k="right">▶</button></div>
      <div class="tr"><button data-k="nitro">NOS</button><button data-k="brake">BRK</button><button data-k="gas">GAS</button></div>
    </div>
    <div class="rOverlay" id="rPause"><div class="rCard"><h2>PAUSED</h2>
      <button class="btn primary" data-a="resume">Resume</button>
      <button class="btn" data-a="restart">Restart race</button>
      <button class="btn ghost" data-a="exit">Back to garage</button></div></div>
    <div class="rOverlay" id="rResult"><div class="rCard wide"><h2 id="rResTitle">RACE COMPLETE</h2>
      <table id="rResTable"></table>
      <div class="rBtns"><button class="btn primary" data-a="restart">Race again</button><button class="btn ghost" data-a="exit">Back to garage</button></div></div></div>`;
  document.body.appendChild(hud);
  const $ = (id) => hud.querySelector('#' + id);
  const el = { pos: $('rPos'), lap: $('rLap'), time: $('rTime'), best: $('rBest'), count: $('rCount'), msg: $('rMsg'), gear: $('rGear'), spd: $('rSpd'), rpm: $('rRpm'), nos: $('rNos'), board: $('rBoard'), pause: $('rPause'), result: $('rResult'), resTable: $('rResTable'), resTitle: $('rResTitle') };
  const speedlines = document.getElementById('speedlines');
  hud.querySelectorAll('[data-a]').forEach((b) => b.addEventListener('click', () => {
    const a = b.dataset.a;
    if (a === 'resume') setPaused(false);
    if (a === 'restart') restart();
    if (a === 'exit') stop();
  }));

  /* ───────── Input ───────── */
  const keys = {};
  const touch = {};
  const onKey = (e, down) => {
    if (!api.active) return;
    const k = e.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
    keys[k] = down;
    if (!down) return;
    if (k === 'escape' || k === 'p') { if (!race.finished) setPaused(!race.paused); }
    if (k === 'c') camMode = (camMode + 1) % 3;
    if (k === 'r' && !race.paused) resetCar(player);
    if (k === 'm') audio.setMuted(!audio.muted);
  };
  addEventListener('keydown', (e) => onKey(e, true));
  addEventListener('keyup', (e) => onKey(e, false));
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
  hud.querySelectorAll('#rTouch button').forEach((b) => {
    const k = b.dataset.k;
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); touch[k] = true; b.classList.add('on'); });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => b.addEventListener(ev, () => { touch[k] = false; b.classList.remove('on'); }));
  });
  if (matchMedia('(pointer: coarse)').matches) hud.classList.add('touch');

  function readInput() {
    const pad = navigator.getGamepads ? [...navigator.getGamepads()].find((g) => g) : null;
    let steer = 0, gas = 0, brake = 0, hand = false, nitro = false;
    if (keys.a || keys.arrowleft || touch.left) steer -= 1;
    if (keys.d || keys.arrowright || touch.right) steer += 1;
    if (keys.w || keys.arrowup || touch.gas) gas = 1;
    if (keys.s || keys.arrowdown || touch.brake) brake = 1;
    if (keys[' ']) hand = true;
    if (keys.shift || touch.nitro) nitro = true;
    if (pad) {
      const ax = pad.axes[0] || 0;
      if (Math.abs(ax) > 0.12) steer = ax;
      gas = Math.max(gas, pad.buttons[7]?.value || 0);
      brake = Math.max(brake, pad.buttons[6]?.value || 0);
      hand = hand || !!pad.buttons[1]?.pressed;
      nitro = nitro || !!pad.buttons[0]?.pressed;
      const st = !!pad.buttons[9]?.pressed;
      if (st && !readInput.st && !race.finished) setPaused(!race.paused);
      readInput.st = st;
    }
    return { steer, gas, brake, hand, nitro };
  }

  /* ───────── World build ───────── */
  const sun = new THREE.DirectionalLight(0xb8c6ff, 1.4);
  let skids, smoke = [], nitroMats = [];

  function ribbon(a, b, ya, yb, vLen, mat) {
    const pos = new Float32Array((N + 1) * 2 * 3), uv = new Float32Array((N + 1) * 2 * 2), idx = [];
    for (let i = 0; i <= N; i++) {
      const p = P[i % N], l = L[i % N], v = (i * SEG) / vLen;
      pos.set([p.x + l.x * a, ya, p.z + l.z * a, p.x + l.x * b, yb, p.z + l.z * b], i * 6);
      uv.set([0, v, 1, v], i * 4);
      if (i < N) { const o = i * 2; idx.push(o, o + 2, o + 1, o + 1, o + 2, o + 3); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat);
    m.receiveShadow = true;
    scene.add(m);
    return m;
  }

  function build() {
    built = true;
    scene.background = new THREE.Color(0x05060c);
    scene.fog = new THREE.Fog(0x0b0a1c, 140, 900);

    // sky dome + stars
    const skyTex = canvasTex(16, 512, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, '#020309'); gr.addColorStop(0.55, '#0b0b22'); gr.addColorStop(0.8, '#2a1240'); gr.addColorStop(1, '#4a1a46');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    });
    skyTex.wrapS = skyTex.wrapT = THREE.ClampToEdgeWrapping;
    const sky = new THREE.Mesh(new THREE.SphereGeometry(1400, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false, depthWrite: false }));
    scene.add(sky);
    {
      const n = 1500, p = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const th = Math.random() * Math.PI * 2, ph = Math.random() * 1.2;
        p.set([Math.cos(th) * Math.sin(ph) * 1300, Math.cos(ph) * 1300, Math.sin(th) * Math.sin(ph) * 1300], i * 3);
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
      scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.7 })));
    }
    const moon = new THREE.Mesh(new THREE.CircleGeometry(40, 48), new THREE.MeshBasicMaterial({ color: hdr('#dfe6ff', 2.2), fog: false }));
    moon.position.set(-600, 700, -900); moon.lookAt(0, 0, 0); scene.add(moon);

    // lights
    scene.add(new THREE.HemisphereLight(0x7f8cff, 0x120a18, 0.55));
    sun.position.set(-60, 120, -80);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 10, far: 260 });
    sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03;
    scene.add(sun, sun.target);

    // ground
    const groundTex = canvasTex(512, 512, (g, w, h) => {
      g.fillStyle = '#0c0d12'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.035})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
      g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 3;
      for (let x = 0; x <= w; x += 128) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); g.beginPath(); g.moveTo(0, x); g.lineTo(w, x); g.stroke(); }
    }, { repeat: [120, 120] });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), new THREE.MeshStandardMaterial({ map: groundTex, roughness: 0.95, metalness: 0 }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

    // road surface
    const asphalt = canvasTex(512, 512, (g, w, h) => {
      g.fillStyle = '#17181d'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 26000; i++) { const c = Math.random() * 40 + 10; g.fillStyle = `rgba(${c},${c},${c + 4},.5)`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
      g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(w * 0.18, 0, w * 0.12, h); g.fillRect(w * 0.7, 0, w * 0.12, h); // tyre lines
      g.fillStyle = 'rgba(240,240,240,.85)'; g.fillRect(w * 0.03, 0, 8, h); g.fillRect(w * 0.97 - 8, 0, 8, h);
      g.fillStyle = 'rgba(240,240,240,.7)';
      for (let y = 0; y < h; y += 256) { g.fillRect(w / 3 - 4, y, 8, 120); g.fillRect(2 * w / 3 - 4, y, 8, 120); }
    });
    const roadMat = new THREE.MeshStandardMaterial({ map: asphalt, roughness: 0.62, metalness: 0.15, envMapIntensity: 0.5, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    ribbon(-HALF_W, HALF_W, 0.03, 0.03, 16, roadMat);

    // kerbs (red/white) and shoulders
    const kerb = canvasTex(64, 256, (g, w, h) => { for (let y = 0; y < h; y += 64) { g.fillStyle = '#d8131f'; g.fillRect(0, y, w, 32); g.fillStyle = '#f2f2f2'; g.fillRect(0, y + 32, w, 32); } });
    const kerbMat = new THREE.MeshStandardMaterial({ map: kerb, roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    ribbon(HALF_W, HALF_W + 1.3, 0.05, 0.05, 8, kerbMat);
    ribbon(-HALF_W - 1.3, -HALF_W, 0.05, 0.05, 8, kerbMat);
    const shoulderMat = new THREE.MeshStandardMaterial({ color: 0x0f1014, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    ribbon(HALF_W + 1.3, WALL, 0.02, 0.02, 16, shoulderMat);
    ribbon(-WALL, -HALF_W - 1.3, 0.02, 0.02, 16, shoulderMat);

    // walls with a neon stripe (left cyan, right magenta)
    const wallEm = canvasTex(64, 128, (g, w, h) => { g.fillStyle = '#000'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.fillRect(0, 18, w, 10); g.fillRect(0, 100, w, 3); }, { srgb: false });
    const wallMap = canvasTex(256, 128, (g, w, h) => {
      g.fillStyle = '#1b1d24'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#262933'; for (let x = 0; x < w; x += 64) g.fillRect(x, 0, 3, h);
      g.fillStyle = '#e3c400'; for (let x = -40; x < w; x += 40) { g.beginPath(); g.moveTo(x, 128); g.lineTo(x + 20, 104); g.lineTo(x + 34, 104); g.lineTo(x + 14, 128); g.fill(); }
    });
    const mkWall = (col) => new THREE.MeshStandardMaterial({ map: wallMap, emissiveMap: wallEm, emissive: hdr(col, 2.6), roughness: 0.5, metalness: 0.5, side: THREE.DoubleSide });
    // ribbon() maps u across; for walls we want v along and u up, so build directly
    const wallStrip = (off, mat) => {
      const pos = new Float32Array((N + 1) * 6), uv = new Float32Array((N + 1) * 4), idx = [];
      for (let i = 0; i <= N; i++) {
        const p = P[i % N], l = L[i % N], u = (i * SEG) / 4;
        const x = p.x + l.x * off, z = p.z + l.z * off;
        pos.set([x, 0, z, x, 1.15, z], i * 6);
        uv.set([u, 0, u, 1], i * 4);
        if (i < N) { const o = i * 2; idx.push(o, o + 2, o + 1, o + 1, o + 2, o + 3); }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      g.setIndex(idx); g.computeVertexNormals();
      const m = new THREE.Mesh(g, mat); m.castShadow = false; m.receiveShadow = true; scene.add(m);
    };
    wallStrip(WALL, mkWall('#00e5ff'));
    wallStrip(-WALL, mkWall('#ff2bd6'));

    // street lamps (instanced) + light pools on the road
    const lampCount = Math.floor(LEN / 42);
    const poleG = new THREE.CylinderGeometry(0.12, 0.16, 8, 8); poleG.translate(0, 4, 0);
    const armG = new THREE.BoxGeometry(0.12, 0.12, 3.2); armG.translate(0, 8, -1.5);
    const headG = new THREE.BoxGeometry(0.5, 0.12, 1.1); headG.translate(0, 7.92, -2.8);
    const metal = new THREE.MeshStandardMaterial({ color: 0x24262c, metalness: 0.8, roughness: 0.4 });
    const poles = new THREE.InstancedMesh(poleG, metal, lampCount);
    const arms = new THREE.InstancedMesh(armG, metal, lampCount);
    const heads = new THREE.InstancedMesh(headG, new THREE.MeshBasicMaterial({ color: hdr('#ffd7a3', 7) }), lampCount);
    const glowTex = canvasTex(128, 128, (g, w, h) => {
      const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,.4)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    });
    const poolG = new THREE.PlaneGeometry(14, 14); poolG.rotateX(-Math.PI / 2);
    const pools = new THREE.InstancedMesh(poolG, new THREE.MeshBasicMaterial({ map: glowTex, color: hdr('#ffb46b', 0.45), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }), lampCount);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1), yAx = new THREE.Vector3(0, 1, 0);
    for (let k = 0; k < lampCount; k++) {
      const i = Math.floor((k * N) / lampCount), side = k % 2 ? 1 : -1;
      const p = P[i], l = L[i];
      const base = new THREE.Vector3(p.x + l.x * side * (WALL + 1.2), 0, p.z + l.z * side * (WALL + 1.2));
      // arm points toward the road (local -Z)
      const toRoad = new THREE.Vector3(-l.x * side, 0, -l.z * side);
      q.setFromAxisAngle(yAx, Math.atan2(-toRoad.x, -toRoad.z));
      m4.compose(base, q, one);
      poles.setMatrixAt(k, m4); arms.setMatrixAt(k, m4); heads.setMatrixAt(k, m4);
      m4.compose(new THREE.Vector3(p.x + l.x * side * (WALL - 4), 0.06, p.z + l.z * side * (WALL - 4)), new THREE.Quaternion(), one);
      pools.setMatrixAt(k, m4);
    }
    scene.add(poles, arms, heads, pools);

    // city blocks (instanced, world-space window UVs)
    const winTex = canvasTex(512, 512, (g, w, h) => {
      g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const r = Math.random();
        if (r < 0.32) { g.fillStyle = r < 0.05 ? '#7fe9ff' : r < 0.08 ? '#ff7ad9' : `hsl(${35 + Math.random() * 15},80%,${55 + Math.random() * 25}%)`; g.fillRect(x * 32 + 6, y * 32 + 8, 20, 18); }
      }
    }, { srgb: true });
    const facade = canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = '#16171d'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#0a0b0f'; for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) g.fillRect(x * 32 + 6, y * 32 + 8, 20, 18);
      g.fillStyle = '#20222a'; for (let x = 0; x < w; x += 32) g.fillRect(x, 0, 3, h);
    });
    const bMat = new THREE.MeshStandardMaterial({ map: facade, emissiveMap: winTex, emissive: new THREE.Color(1.6, 1.6, 1.6), roughness: 0.75, metalness: 0.3 });
    bMat.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <uv_vertex>', `#include <uv_vertex>
        #ifdef USE_INSTANCING
          vec3 bs = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
          vec2 bo = instanceMatrix[3].xz * 0.0137;
        #else
          vec3 bs = vec3(1.0); vec2 bo = vec2(0.0);
        #endif
        vec3 bn = abs(normal);
        vec2 buv = bn.y > 0.5 ? vec2(0.01) : (bn.x > 0.5 ? vec2(uv.x * bs.z, uv.y * bs.y) : vec2(uv.x * bs.x, uv.y * bs.y));
        buv = buv / vec2(32.0, 32.0) + bo;
        #ifdef USE_MAP
          vMapUv = buv * 2.0;
        #endif
        #ifdef USE_EMISSIVEMAP
          vEmissiveMapUv = buv;
        #endif`);
    };
    const boxG = new THREE.BoxGeometry(1, 1, 1); boxG.translate(0, 0.5, 0);
    const coarse = P.filter((_, i) => i % 6 === 0);
    const spots = [];
    for (let tries = 0; tries < 6000 && spots.length < 520; tries++) {
      const x = (Math.random() - 0.5) * 1300 + 10, z = (Math.random() - 0.5) * 1000 + 45;
      const w = 16 + Math.random() * 26, d = 16 + Math.random() * 26;
      const r = Math.hypot(w, d) / 2;
      let ok = true;
      for (const p of coarse) { const dx = p.x - x, dz = p.z - z; if (dx * dx + dz * dz < (WALL + 6 + r) ** 2) { ok = false; break; } }
      if (!ok) continue;
      for (const s of spots) { if (Math.hypot(s.x - x, s.z - z) < (s.r + r) * 0.82) { ok = false; break; } }
      if (!ok) continue;
      const nearTrack = Math.min(...coarse.map((p) => Math.hypot(p.x - x, p.z - z)));
      const h = (nearTrack < 80 ? 18 : 30) + Math.random() * (nearTrack < 80 ? 45 : 150);
      spots.push({ x, z, w, d, h, r });
    }
    const blocks = new THREE.InstancedMesh(boxG, bMat, spots.length);
    const col = new THREE.Color();
    spots.forEach((s, i) => {
      m4.compose(new THREE.Vector3(s.x, 0, s.z), q.setFromAxisAngle(yAx, (Math.random() - 0.5) * 0.3), new THREE.Vector3(s.w, s.h, s.d));
      blocks.setMatrixAt(i, m4);
      blocks.setColorAt(i, col.setHSL(0.62 + Math.random() * 0.1, 0.15, 0.5 + Math.random() * 0.4));
    });
    blocks.receiveShadow = true;
    scene.add(blocks);
    // rooftop beacons
    const beacons = new THREE.InstancedMesh(new THREE.SphereGeometry(0.9, 8, 6), new THREE.MeshBasicMaterial({ color: hdr('#ff2a2a', 6) }), spots.length);
    spots.forEach((s, i) => { m4.compose(new THREE.Vector3(s.x, s.h + 1, s.z), q.identity(), s.h > 90 ? one : new THREE.Vector3(0, 0, 0)); beacons.setMatrixAt(i, m4); });
    scene.add(beacons);

    // neon billboards along the track
    const signs = ['APEX', 'NITRO', 'NIGHT RUN', 'TURBO', 'DRIFT', 'MIDNIGHT'];
    const signCols = ['#00e5ff', '#ff2bd6', '#ffb000', '#7cff3a', '#ff4d4d', '#8a5cff'];
    signs.forEach((txt, n) => {
      const tex = canvasTex(1024, 256, (g, w, h) => {
        g.fillStyle = 'rgba(0,0,0,0)'; g.clearRect(0, 0, w, h);
        g.strokeStyle = '#fff'; g.lineWidth = 10; g.strokeRect(12, 12, w - 24, h - 24);
        g.font = '900 150px Orbitron, Arial Black, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillStyle = '#fff'; g.fillText(txt, w / 2, h / 2 + 6);
      });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(28, 7), new THREE.MeshBasicMaterial({ map: tex, color: hdr(signCols[n], 3.2), transparent: true, side: THREE.DoubleSide, depthWrite: false }));
      const i = Math.floor(((n + 0.35) / signs.length) * N), side = n % 2 ? 1 : -1;
      const p = P[i], l = L[i];
      m.position.set(p.x + l.x * side * (WALL + 9), 9, p.z + l.z * side * (WALL + 9));
      m.lookAt(p.x, 7, p.z);
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.4, 9, 0.4), metal);
      post.position.set(m.position.x, 4.5, m.position.z);
      scene.add(m, post);
    });

    // start/finish gantry
    {
      const p = P[0], l = L[0], t = T[0];
      const chk = canvasTex(256, 64, (g, w, h) => { for (let x = 0; x < w; x += 16) for (let y = 0; y < h; y += 16) { g.fillStyle = ((x + y) / 16) % 2 ? '#111' : '#f4f4f4'; g.fillRect(x, y, 16, 16); } });
      const line = new THREE.Mesh(new THREE.PlaneGeometry(HALF_W * 2, 2.4), new THREE.MeshStandardMaterial({ map: chk, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
      line.rotation.x = -Math.PI / 2; line.rotation.z = Math.atan2(t.x, t.z) + Math.PI / 2;
      line.position.set(p.x, 0.07, p.z); scene.add(line);
      const g = new THREE.Group();
      const legMat = new THREE.MeshStandardMaterial({ color: 0x1e2026, metalness: 0.85, roughness: 0.35 });
      for (const s of [-1, 1]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.8, 9, 0.8), legMat); leg.position.set(s * (WALL + 0.4), 4.5, 0); leg.castShadow = true; g.add(leg); }
      const banner = canvasTex(1024, 128, (gc, w, h) => {
        gc.fillStyle = '#05060a'; gc.fillRect(0, 0, w, h);
        for (let x = 0; x < w; x += 32) for (let y = 0; y < 32; y += 16) { gc.fillStyle = ((x + y) / 16) % 2 ? '#111' : '#eee'; gc.fillRect(x, y + (y ? 80 : 0), 16, 16); }
        gc.font = '900 64px Orbitron, Arial Black, sans-serif'; gc.textAlign = 'center'; gc.textBaseline = 'middle';
        gc.fillStyle = '#00e5ff'; gc.fillText('APEX // NIGHT RUN', w / 2, 58);
      });
      const top = new THREE.Mesh(new THREE.BoxGeometry(WALL * 2 + 1.6, 2.2, 0.6), [legMat, legMat, legMat, legMat, new THREE.MeshBasicMaterial({ map: banner, color: hdr('#ffffff', 1.6) }), new THREE.MeshBasicMaterial({ map: banner, color: hdr('#ffffff', 1.6) })]);
      top.position.y = 8.6; g.add(top);
      const strip = new THREE.Mesh(new THREE.BoxGeometry(WALL * 2 + 1.6, 0.12, 0.7), new THREE.MeshBasicMaterial({ color: hdr('#ff2bd6', 5) }));
      strip.position.y = 7.45; g.add(strip);
      g.position.copy(p); g.rotation.y = Math.atan2(t.x, t.z);
      scene.add(g);
    }

    // skid marks: ring buffer of quads
    const skidG = new THREE.PlaneGeometry(0.32, 0.9); skidG.rotateX(-Math.PI / 2);
    skids = new THREE.InstancedMesh(skidG, new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 }), 1400);
    skids.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m4.makeScale(0, 0, 0);
    for (let i = 0; i < 1400; i++) skids.setMatrixAt(i, m4);
    skids.frustumCulled = false;
    skids.userData.n = 0;
    scene.add(skids);

    // drift smoke pool
    const smokeTex = canvasTex(64, 64, (g, w, h) => {
      const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      gr.addColorStop(0, 'rgba(220,220,230,.55)'); gr.addColorStop(1, 'rgba(220,220,230,0)');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    });
    for (let i = 0; i < 48; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, transparent: true, depthWrite: false, opacity: 0 }));
      s.userData = { life: 0, vx: 0, vz: 0 };
      s.visible = false; scene.add(s); smoke.push(s);
    }
    api.glowTex = glowTex;
    drawMapBase();
  }

  /* ───────── Minimap ───────── */
  const mapC = $('rMap'), mapG = mapC.getContext('2d');
  const mapBase = document.createElement('canvas'); mapBase.width = mapBase.height = 220;
  let mapTf;
  function drawMapBase() {
    let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
    for (const p of P) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z); }
    const s = 184 / Math.max(maxX - minX, maxZ - minZ);
    mapTf = (x, z) => [18 + (x - minX) * s + (184 - (maxX - minX) * s) / 2, 18 + (z - minZ) * s + (184 - (maxZ - minZ) * s) / 2];
    const g = mapBase.getContext('2d');
    g.clearRect(0, 0, 220, 220);
    g.lineJoin = 'round';
    const path = () => { g.beginPath(); P.forEach((p, i) => { const [x, y] = mapTf(p.x, p.z); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath(); };
    path(); g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 11; g.stroke();
    path(); g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 5; g.stroke();
    const [sx, sy] = mapTf(P[0].x, P[0].z);
    g.fillStyle = '#ff2bd6'; g.fillRect(sx - 2, sy - 7, 4, 14);
  }
  function drawMap() {
    mapG.clearRect(0, 0, 220, 220);
    mapG.drawImage(mapBase, 0, 0);
    for (const r of racers) {
      const [x, y] = mapTf(r.pos.x, r.pos.z);
      mapG.beginPath(); mapG.arc(x, y, r.isPlayer ? 6 : 4.5, 0, 7);
      mapG.fillStyle = r.isPlayer ? '#00e5ff' : r.mapCol;
      mapG.fill();
      if (r.isPlayer) { mapG.lineWidth = 2; mapG.strokeStyle = '#fff'; mapG.stroke(); }
    }
  }

  /* ───────── Racers ───────── */
  let racers = [], player = null;
  const race = { time: 0, countdown: 0, started: false, finished: false, paused: false, best: Infinity, lapStart: 0, finishOrder: [], endTimer: 0, shown: false };
  let camMode = 0, shake = 0, msgTimer = 0;

  function makeRacer(entry, i, isPlayer, grid) {
    const cfg = entry.cfg;
    const root = new THREE.Group(), body = new THREE.Group();
    const model = entry.group.clone(true);
    model.position.set(0, 0, 0); model.rotation.set(0, 0, 0);
    body.add(model); root.add(body);
    const sz = entry.size;
    // lights
    // one-sided glow cards so headlights don't shine through from behind
    const glowGeo = api.glowGeo || (api.glowGeo = new THREE.PlaneGeometry(1, 1));
    const headMat = api.headMat || (api.headMat = new THREE.MeshBasicMaterial({ map: api.glowTex, color: hdr('#e6eeff', 2.4), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    const tailMat = api.tailMat || (api.tailMat = new THREE.MeshBasicMaterial({ map: api.glowTex, color: hdr('#ff1a1a', 1.8), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    for (const s of [-1, 1]) {
      const hl = new THREE.Mesh(glowGeo, headMat); hl.scale.set(0.6, 0.35, 1); hl.position.set(s * sz.x * 0.34, sz.y * 0.42, sz.z * 0.5 + 0.02); body.add(hl);
      const tl = new THREE.Mesh(glowGeo, tailMat); tl.scale.set(0.42, 0.22, 1); tl.rotation.y = Math.PI; tl.position.set(s * sz.x * 0.36, sz.y * 0.55, -sz.z * 0.5 - 0.02); body.add(tl);
    }
    const flames = [];
    const flameMat = new THREE.SpriteMaterial({ map: api.glowTex, color: hdr('#4fb4ff', 5), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
    nitroMats.push(flameMat);
    for (const s of [-1, 1]) { const f = new THREE.Sprite(flameMat); f.position.set(s * sz.x * 0.18, sz.y * 0.28, -sz.z * 0.53); f.scale.set(0.6, 0.6, 1); body.add(f); flames.push(f); }
    if (isPlayer) {
      const spot = new THREE.SpotLight(0xeaf1ff, 260, 90, 0.5, 0.5, 1.3);
      spot.position.set(0, sz.y * 0.45, sz.z * 0.45);
      spot.target.position.set(0, 0, sz.z * 0.5 + 25);
      body.add(spot, spot.target);
    }
    const wheels = [];
    model.traverse((o) => { if (/^wheel_(fl|fr|rl|rr)$/.test(o.name)) { o.rotation.order = 'YXZ'; wheels.push(o); } });
    scene.add(root);
    const s = computeStats(cfg);
    const r = {
      entry, cfg, root, body, wheels, flames, isPlayer, sz,
      name: `${cfg.make} ${cfg.name}`,
      mapCol: ['#ff4d6d', '#ffd23f', '#7cff3a', '#b28dff'][i],
      vmax: s.top / 3.6 * 0.94,
      a0: (100 / 3.6) / s.zero * 1.08,
      grip: 8 + s.handling * 6,
      steerMax: 2.0 + s.handling * 0.5,
      lat: 13 + s.handling * 7,
      pos: new THREE.Vector3(), vx: 0, vz: 0, h: 0, vf: 0, vr: 0,
      steer: 0, nitro: 1, nitroOn: false, hand: false, drifting: 0,
      idx: 0, lap: 0, half: true, progress: 0, finished: false, finishTime: 0, bestLap: Infinity,
      rpm: cfg.engine.idle, gear: 1, wheelSpin: 0, roll: 0, pitch: 0, accel: 0, grid,
      ai: { lane: [-4, 0, 4, -2][i % 4], phase: Math.random() * 6, skill: 0.93 + Math.random() * 0.05, nitroT: 0 }
    };
    placeOnGrid(r);
    return r;
  }

  function placeOnGrid(r) {
    const row = Math.floor(r.grid / 2), side = r.grid % 2 ? -1 : 1;
    const i = (N - 8 - row * 7) % N;
    const p = P[i], l = L[i], t = T[i];
    r.pos.set(p.x + l.x * side * 3.6, 0, p.z + l.z * side * 3.6);
    r.h = Math.atan2(t.x, t.z);
    r.vx = r.vz = r.vf = r.vr = 0; r.steer = 0; r.nitro = 1; r.idx = i;
    r.lap = 0; r.half = true; r.progress = i - N; r.finished = false; r.finishTime = 0; r.bestLap = Infinity;
    r.roll = r.pitch = 0;
    syncRacer(r, 0);
  }

  function nearest(r, from, span = 70) {
    let best = from, bd = Infinity;
    for (let k = -span; k <= span; k++) {
      const j = (from + k + N) % N, p = P[j];
      const dx = p.x - r.pos.x, dz = p.z - r.pos.z, d = dx * dx + dz * dz;
      if (d < bd) { bd = d; best = j; }
    }
    return best;
  }

  function resetCar(r) {
    r.idx = nearest(r, r.idx, N / 2);
    const p = P[r.idx], t = T[r.idx];
    r.pos.set(p.x, 0, p.z);
    r.h = Math.atan2(t.x, t.z);
    r.vx = r.vz = 0;
    if (r.isPlayer) flash('RESET');
  }

  /* ───────── Physics ───────── */
  const tmp = new THREE.Vector3();
  function physics(r, inp, dt) {
    const sh = Math.sin(r.h), ch = Math.cos(r.h);
    // forward f = (sh, ch), right = (-ch, sh)
    let vf = r.vx * sh + r.vz * ch;
    let vr = -r.vx * ch + r.vz * sh;
    const nitro = inp.nitro && r.nitro > 0.02 && vf > 3;
    r.nitroOn = nitro;
    if (nitro) r.nitro = Math.max(0, r.nitro - dt * 0.22);
    else r.nitro = Math.min(1, r.nitro + dt * (0.012 + (Math.abs(vr) > 4 ? 0.09 : 0)));
    const vmax = r.vmax * (nitro ? 1.15 : 1) * (r.rubber || 1);
    const prevVf = vf;
    if (inp.gas > 0 && vf > -1) {
      const a = r.a0 * (nitro ? 1.7 : 1) * (r.rubber || 1) * Math.max(0.08, 1 - (vf / vmax) ** 2) * (vf < 12 ? 1.15 : 1);
      vf += a * inp.gas * dt;
    }
    if (inp.brake > 0) {
      if (vf > 0.5) vf -= 26 * inp.brake * dt;
      else vf = Math.max(-14, vf - 8 * inp.brake * dt);
    }
    if (!inp.gas && !inp.brake) vf -= Math.sign(vf) * Math.min(Math.abs(vf), 2.2 * dt);
    vf -= vf * Math.abs(vf) * 0.00035 * dt; // aero
    if (vf > vmax) vf = lerp(vf, vmax, 1 - Math.exp(-1.5 * dt));
    // handbrake drift
    r.hand = inp.hand;
    const grip = inp.hand ? 1.4 : (r.drifting > 0.2 ? r.grip * 0.35 : r.grip);
    if (inp.hand && vf > 0) vf -= 3 * dt;
    vr *= Math.exp(-grip * dt);
    // steering (smoothed)
    const target = clamp(inp.steer, -1, 1);
    r.steer += (target - r.steer) * (1 - Math.exp(-(Math.abs(target) > Math.abs(r.steer) ? 7 : 10) * dt));
    const spd = Math.abs(vf);
    let yaw = r.steer * r.steerMax * Math.min(1, spd / 6) / (1 + spd / 40) * Math.sign(vf || 1);
    if (inp.hand && spd > 8) yaw *= 1.45;
    if (r.drifting > 0.2) yaw *= 1.15;
    // keep lateral acceleration sane when not drifting
    if (!inp.hand && spd > 1) { const cap = r.lat / spd; yaw = clamp(yaw, -cap * 1.35, cap * 1.35); }
    r.h -= yaw * dt;
    // drift state: lateral slip
    r.drifting = lerp(r.drifting, Math.abs(vr) > 3.5 && spd > 12 ? 1 : 0, 1 - Math.exp(-6 * dt));
    r.vx = sh * vf - ch * vr;
    r.vz = ch * vf + sh * vr;
    r.vf = vf; r.vr = vr;
    r.accel = (vf - prevVf) / dt;
    r.latAcc = yaw * vf;
    r.pos.x += r.vx * dt;
    r.pos.z += r.vz * dt;

    // track: nearest sample, walls
    const prev = r.idx;
    r.idx = nearest(r, r.idx, 40);
    const p = P[r.idx], l = L[r.idx];
    const d = (r.pos.x - p.x) * l.x + (r.pos.z - p.z) * l.z;
    const lim = WALL - r.sz.x * 0.55;
    if (Math.abs(d) > lim) {
      const s = Math.sign(d);
      r.pos.x -= l.x * s * (Math.abs(d) - lim);
      r.pos.z -= l.z * s * (Math.abs(d) - lim);
      const vn = (r.vx * l.x + r.vz * l.z) * s;
      if (vn > 0) {
        r.vx -= l.x * s * vn * 1.35; r.vz -= l.z * s * vn * 1.35;
        r.vx *= 0.985; r.vz *= 0.985;
        // turn the nose along the wall a little
        const t = T[r.idx], th = Math.atan2(t.x, t.z);
        const dir = Math.cos(wrapAngle(th - r.h)) >= 0 ? th : th + Math.PI;
        r.h += wrapAngle(dir - r.h) * Math.min(1, vn * 0.04);
        if (r.isPlayer && vn > 2.5) shake = Math.min(1, shake + vn * 0.05);
      }
    }
    // laps
    if (r.idx > N * 0.4 && r.idx < N * 0.6) r.half = true;
    if (prev > N * 0.8 && r.idx < N * 0.2) {
      if (r.half) { r.lap++; r.half = false; onLap(r); }
    } else if (prev < N * 0.2 && r.idx > N * 0.8) {
      r.lap--; r.half = true;
    }
    r.progress = r.lap * N + r.idx - N;
    // engine
    const u = clamp(Math.abs(vf) / r.vmax, 0, 1.2);
    const G = [0, 0.16, 0.3, 0.45, 0.6, 0.76, 1.3];
    let g = 1; while (g < 6 && u > G[g]) g++;
    const span = (u - G[g - 1]) / (G[g] - G[g - 1]);
    const e = r.cfg.engine;
    const tgt = vf < -0.5 ? e.idle + (e.redline - e.idle) * 0.4 : lerp(e.idle * 1.6, e.redline, clamp(span, 0, 1)) * (inp.gas ? 1 : 0.85);
    r.rpm = lerp(r.rpm, race.started ? tgt : (inp.gas ? e.redline * 0.9 : e.idle), 1 - Math.exp(-8 * dt));
    r.gear = vf < -0.5 ? 'R' : g;
    r.wheelSpin += vf * dt / 0.34;
  }

  function aiInput(r, dt) {
    if (!race.started) return { steer: 0, gas: 0, brake: 0, hand: false, nitro: false };
    const vf = Math.max(r.vf, 0);
    const look = 9 + vf * 0.5;
    const ahead = (r.idx + Math.round(look / SEG)) % N;
    // lane: drift toward the inside of upcoming corners
    const kSign = Math.sign(T[r.idx].x * T[ahead].z - T[r.idx].z * T[ahead].x);
    const lane = clamp(r.ai.lane + Math.sin(race.time * 0.15 + r.ai.phase) * 1.2 + (r.finished ? 0 : -kSign * Math.min(3, KA[r.idx] * 160)), -HALF_W + 2, HALF_W - 2);
    // avoid cars directly ahead
    let dodge = 0;
    for (const o of racers) {
      if (o === r) continue;
      const dx = o.pos.x - r.pos.x, dz = o.pos.z - r.pos.z;
      const fwd = dx * Math.sin(r.h) + dz * Math.cos(r.h);
      const side = -dx * Math.cos(r.h) + dz * Math.sin(r.h);
      if (fwd > 0 && fwd < 14 && Math.abs(side) < 2.6) dodge += side > 0 ? -2.5 : 2.5;
    }
    const p = P[ahead], l = L[ahead];
    const tx = p.x + l.x * (lane + dodge), tz = p.z + l.z * (lane + dodge);
    const want = Math.atan2(tx - r.pos.x, tz - r.pos.z);
    const diff = wrapAngle(want - r.h);
    const steer = clamp(-diff * 2.6, -1, 1);
    let vt = Math.min(r.vmax, Math.sqrt((r.lat * r.ai.skill) / Math.max(KA[r.idx], 1e-4)));
    if (r.finished) vt *= 0.55;
    // rubber band against the player
    const gap = (player.progress - r.progress) * SEG;
    r.rubber = r.finished ? 1 : clamp(1 + gap / 900, 0.9, 1.1);
    vt *= r.rubber;
    const nitro = !r.finished && KA[r.idx] < 0.004 && vf > 20 && r.nitro > 0.4 && (gap > -40);
    return { steer, gas: vf < vt ? 1 : 0, brake: vf > vt + 2.5 ? clamp((vf - vt) / 8, 0.2, 1) : 0, hand: false, nitro };
  }

  function collide() {
    for (let i = 0; i < racers.length; i++) for (let j = i + 1; j < racers.length; j++) {
      const a = racers[i], b = racers[j];
      for (const sa of [-1, 1]) for (const sb of [-1, 1]) {
        const ax = a.pos.x + Math.sin(a.h) * sa * a.sz.z * 0.27, az = a.pos.z + Math.cos(a.h) * sa * a.sz.z * 0.27;
        const bx = b.pos.x + Math.sin(b.h) * sb * b.sz.z * 0.27, bz = b.pos.z + Math.cos(b.h) * sb * b.sz.z * 0.27;
        const dx = bx - ax, dz = bz - az, d = Math.hypot(dx, dz);
        const min = (a.sz.x + b.sz.x) * 0.5;
        if (d > 0.001 && d < min) {
          const nx = dx / d, nz = dz / d, push = (min - d) / 2;
          a.pos.x -= nx * push; a.pos.z -= nz * push;
          b.pos.x += nx * push; b.pos.z += nz * push;
          const rel = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
          if (rel < 0) {
            const imp = -rel * 0.8 / 2;
            a.vx -= nx * imp; a.vz -= nz * imp;
            b.vx += nx * imp; b.vz += nz * imp;
            if ((a.isPlayer || b.isPlayer) && -rel > 2) shake = Math.min(1, shake - rel * 0.06);
          }
        }
      }
    }
  }

  /* ───────── Visual sync ───────── */
  function syncRacer(r, dt) {
    r.root.position.set(r.pos.x, 0, r.pos.z);
    r.root.rotation.y = r.h;
    const k = 1 - Math.exp(-6 * dt);
    r.roll = lerp(r.roll, clamp(-(r.latAcc || 0) * 0.0035, -0.06, 0.06), k);
    r.pitch = lerp(r.pitch, clamp(-(r.accel || 0) * 0.0018, -0.035, 0.035), k);
    r.body.rotation.set(r.pitch, 0, r.roll);
    r.body.position.y = 0.035 + Math.abs(r.roll) * r.sz.x * 0.3;
    for (const w of r.wheels) {
      w.rotation.x = (r.entry.cfg.rotY ? -1 : 1) * r.wheelSpin;
      if (/f[lr]$/.test(w.name)) w.rotation.y = -r.steer * 0.45;
    }
    const fl = r.nitroOn ? 1 : 0;
    r.flames.forEach((f) => { f.material.opacity = lerp(f.material.opacity, fl, 0.3); const s = 0.55 + Math.random() * 0.45 * fl; f.scale.set(s, s, 1); });
  }

  let skidTick = 0;
  function effects(r, dt) {
    const slip = Math.abs(r.vr) > 3.2 || (r.hand && Math.abs(r.vf) > 6) || (r.accel < -18 && r.vf > 8);
    if (!slip) return;
    skidTick += dt;
    const sh = Math.sin(r.h), ch = Math.cos(r.h);
    for (const s of [-1, 1]) {
      // rear wheels: back = -f, side = right(-ch, sh)
      const x = r.pos.x - sh * r.sz.z * 0.32 + -ch * s * r.sz.x * 0.4;
      const z = r.pos.z - ch * r.sz.z * 0.32 + sh * s * r.sz.x * 0.4;
      const n = skids.userData.n++ % skids.count;
      tmpM.compose(tmpP.set(x, 0.08, z), tmpQ.setFromAxisAngle(Y, Math.atan2(r.vx, r.vz)), ONE);
      skids.setMatrixAt(n, tmpM);
      if (r.isPlayer && Math.random() < 0.35) {
        const p = smoke.find((q) => q.userData.life <= 0);
        if (p) { p.visible = true; p.userData.life = 1; p.position.set(x, 0.4, z); p.userData.vx = r.vx * 0.15 + (Math.random() - 0.5); p.userData.vz = r.vz * 0.15 + (Math.random() - 0.5); p.scale.setScalar(1); }
      }
    }
    skids.instanceMatrix.needsUpdate = true;
  }
  const tmpM = new THREE.Matrix4(), tmpP = new THREE.Vector3(), tmpQ = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0), ONE = new THREE.Vector3(1, 1, 1);

  function stepSmoke(dt) {
    for (const s of smoke) {
      const u = s.userData;
      if (u.life <= 0) continue;
      u.life -= dt * 0.9;
      s.position.x += u.vx * dt; s.position.z += u.vz * dt; s.position.y += dt * 0.8;
      s.scale.setScalar(1 + (1 - u.life) * 5);
      s.material.opacity = Math.max(0, u.life) * 0.5;
      if (u.life <= 0) s.visible = false;
    }
  }

  /* ───────── Camera ───────── */
  const camOff = new THREE.Vector3(), camLook = new THREE.Vector3(), dir = new THREE.Vector3();
  function updateCamera(dt, snap = false) {
    const r = player;
    const sh = Math.sin(r.h), ch = Math.cos(r.h);
    const spd = Math.hypot(r.vx, r.vz);
    // blend heading with velocity direction for a drift-aware chase cam
    dir.set(sh, 0, ch);
    if (spd > 5) { tmp.set(r.vx / spd, 0, r.vz / spd); if (r.vf > 0) dir.lerp(tmp, 0.35).normalize(); }
    let want, look;
    if (race.finished && race.endTimer > 0) {
      const a = race.time * 0.25;
      want = tmp.set(r.pos.x + Math.cos(a) * 9, 2.4, r.pos.z + Math.sin(a) * 9);
      look = camLook.set(r.pos.x, 0.9, r.pos.z);
    } else if (camMode === 2) {
      want = tmp.set(r.pos.x + sh * r.sz.z * 0.22, r.sz.y * 0.82, r.pos.z + ch * r.sz.z * 0.22);
      look = camLook.set(r.pos.x + sh * 30, r.sz.y * 0.8, r.pos.z + ch * 30);
      camera.position.copy(want);
    } else {
      const dist = (camMode ? 10.5 : 6.4) + spd * 0.025 + (r.nitroOn ? 0.8 : 0);
      const hgt = camMode ? 3.6 : 2.05;
      want = tmp.set(r.pos.x - dir.x * dist, hgt, r.pos.z - dir.z * dist);
      look = camLook.set(r.pos.x + dir.x * 6, 1.0, r.pos.z + dir.z * 6);
    }
    if (camMode !== 2 || race.finished) {
      // smooth the offset relative to the car, so the camera never lags further behind at high speed
      const ox = want.x - r.pos.x, oz = want.z - r.pos.z;
      if (snap) camOff.set(ox, want.y, oz);
      else {
        const k = 1 - Math.exp(-6 * dt);
        camOff.x = lerp(camOff.x, ox, k);
        camOff.z = lerp(camOff.z, oz, k);
        camOff.y = lerp(camOff.y, want.y, 1 - Math.exp(-4 * dt));
      }
      camera.position.set(r.pos.x + camOff.x, camOff.y, r.pos.z + camOff.z);
    }
    if (shake > 0) {
      camera.position.x += (Math.random() - 0.5) * shake * 0.25;
      camera.position.y += (Math.random() - 0.5) * shake * 0.18;
      shake = Math.max(0, shake - dt * 2.5);
    }
    if (r.nitroOn) { camera.position.x += (Math.random() - 0.5) * 0.04; camera.position.y += (Math.random() - 0.5) * 0.03; }
    camera.lookAt(look);
    const fov = 62 + clamp(spd / r.vmax, 0, 1.1) * 14 + (r.nitroOn ? 7 : 0);
    camera.fov = lerp(camera.fov, fov, 1 - Math.exp(-3 * dt));
    camera.updateProjectionMatrix();
    // shadow follows player
    sun.position.set(r.pos.x - 60, 120, r.pos.z - 80);
    sun.target.position.set(r.pos.x, 0, r.pos.z);
  }

  /* ───────── Race flow ───────── */
  function flash(text, t = 1.4) { el.msg.textContent = text; el.msg.classList.add('show'); msgTimer = t; }
  function beep(f, d = 0.15, v = 0.25) {
    const a = audio.ctx; if (!a || audio.muted) return;
    const o = a.createOscillator(), g = a.createGain();
    o.type = 'square'; o.frequency.value = f; g.gain.value = v;
    g.gain.setTargetAtTime(0, a.currentTime + d * 0.6, 0.04);
    o.connect(g).connect(a.destination); o.start(); o.stop(a.currentTime + d + 0.2);
  }

  function onLap(r) {
    if (r.lap > 1) {
      const lt = race.time - (r.lapStartT || 0);
      r.bestLap = Math.min(r.bestLap, lt);
      if (r.isPlayer) {
        if (lt <= race.best) { race.best = lt; el.best.textContent = fmt(lt); }
        if (r.lap <= LAPS) flash(r.lap === LAPS ? `FINAL LAP · ${fmt(lt)}` : `LAP ${r.lap} · ${fmt(lt)}`, 2);
      }
    }
    r.lapStartT = race.time;
    if (r.lap > LAPS && !r.finished) {
      r.finished = true; r.finishTime = race.time;
      race.finishOrder.push(r);
      if (r.isPlayer) finishRace();
    }
  }

  function finishRace() {
    race.finished = true;
    race.endTimer = 3;
    const place = race.finishOrder.indexOf(player) + 1;
    flash(place === 1 ? 'YOU WIN!' : `FINISHED P${place}`, 3);
    beep(880, 0.4, 0.3);
  }

  function standings() {
    return [...racers].sort((a, b) => {
      if (a.finished && b.finished) return a.finishTime - b.finishTime;
      if (a.finished) return -1;
      if (b.finished) return 1;
      return b.progress - a.progress;
    });
  }

  function showResults() {
    const st = standings();
    const place = st.indexOf(player) + 1;
    el.resTitle.textContent = place === 1 ? '🏆 VICTORY' : `FINISHED P${place}`;
    el.resTable.innerHTML = '<tr><th>POS</th><th>DRIVER</th><th>TIME</th><th>BEST LAP</th></tr>' + st.map((r, i) =>
      `<tr class="${r.isPlayer ? 'me' : ''}"><td>${i + 1}</td><td>${r.isPlayer ? 'YOU · ' : ''}${r.name}</td><td>${r.finished ? fmt(r.finishTime) : 'RACING…'}</td><td>${fmt(r.bestLap)}</td></tr>`).join('');
  }

  function setPaused(p) {
    race.paused = p;
    el.pause.classList.toggle('show', p);
    if (p) audio.update(player.cfg.engine.idle, 0);
  }

  /* ───────── Quality (keeps it smooth) ───────── */
  let quality = 2, fpsAcc = 0, fpsN = 0, lowFor = 0, highFor = 0;
  function setQuality(q) {
    quality = q;
    const pr = [1, 1, Math.min(devicePixelRatio, 1.5)][q];
    renderer.setPixelRatio(pr);
    composer.setPixelRatio(pr);
    composer.setSize(innerWidth, innerHeight);
    bloom.enabled = q > 0;
    sun.castShadow = q > 0;
  }
  function watchFps(dt) {
    fpsAcc += dt; fpsN++;
    if (fpsAcc < 1) return;
    const fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0;
    if (fps < 48) { lowFor++; highFor = 0; } else if (fps > 58) { highFor++; lowFor = 0; } else { lowFor = highFor = 0; }
    if (lowFor >= 2 && quality > 0) { setQuality(quality - 1); lowFor = 0; }
    if (highFor >= 8 && quality < 2) { setQuality(quality + 1); highFor = 0; }
  }

  /* ───────── Public ───────── */
  let playerIndex = 0;
  async function start(index) {
    playerIndex = index;
    const entries = await Promise.all(CARS.map((_, i) => loadCar(i)));
    if (!built) build();
    for (const r of racers) scene.remove(r.root);
    racers = []; nitroMats = [];
    scene.environment = getEnv();
    scene.environmentIntensity = 0.7;
    // player starts at the back of the grid
    const order = CARS.map((_, i) => i).filter((i) => i !== index);
    order.forEach((ci, g) => racers.push(makeRacer(entries[ci], ci, false, g)));
    player = makeRacer(entries[index], index, true, 3);
    racers.push(player);
    resetRace();
    api.active = true;
    document.body.classList.add('racing');
    renderPass.scene = scene;
    renderPass.camera = camera;
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    camera.fov = 62;
    updateCamera(0, true);
    setQuality(2);
    audio.setCar(player.cfg.engine);
  }

  function resetRace() {
    Object.assign(race, { time: 0, countdown: 3.999, started: false, finished: false, paused: false, best: Infinity, finishOrder: [], endTimer: 0, shown: false });
    racers.forEach((r) => placeOnGrid(r));
    el.best.textContent = '--:--.--';
    el.result.classList.remove('show');
    el.pause.classList.remove('show');
    el.msg.classList.remove('show');
    el.count.textContent = '';
    skids.userData.n = 0;
    tmpM.makeScale(0, 0, 0);
    for (let i = 0; i < skids.count; i++) skids.setMatrixAt(i, tmpM);
    skids.instanceMatrix.needsUpdate = true;
    smoke.forEach((s) => { s.userData.life = 0; s.visible = false; });
    lastBeep = 4;
    updateCamera(0, true);
  }
  function restart() { resetRace(); }

  function stop() {
    api.active = false;
    document.body.classList.remove('racing');
    el.result.classList.remove('show'); el.pause.classList.remove('show');
    for (const r of racers) scene.remove(r.root);
    speedlines.style.opacity = 0;
    onExit(racers.map((r) => r.entry));
    racers = [];
  }

  function resize() {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
  }

  let acc = 0, lastBeep = 4, hudT = 0, boardT = 1;
  function update(dt) {
    if (race.paused) { updateCamera(0); return; }
    watchFps(dt);
    const inp = readInput();
    // countdown
    if (!race.started) {
      race.countdown -= dt;
      const n = Math.ceil(race.countdown);
      if (n !== lastBeep && n >= 1 && n <= 3) { el.count.textContent = n; el.count.className = 'pop'; void el.count.offsetWidth; el.count.className = 'pop go'; beep(440); lastBeep = n; }
      if (race.countdown <= 0) { race.started = true; el.count.textContent = 'GO!'; el.count.className = 'pop'; void el.count.offsetWidth; el.count.className = 'pop go'; beep(880, 0.35); setTimeout(() => (el.count.textContent = ''), 900); }
    } else race.time += dt;

    // fixed-step physics
    acc = Math.min(acc + dt, 0.1);
    while (acc >= STEP) {
      for (const r of racers) {
        let i;
        if (r.isPlayer) i = race.finished || api.autopilot ? aiInput(r, STEP) : inp;
        else i = aiInput(r, STEP);
        if (!race.started) { r.rpm = lerp(r.rpm, r.isPlayer && inp.gas ? r.cfg.engine.redline * 0.85 : r.cfg.engine.idle, 1 - Math.exp(-6 * STEP)); r.gear = 'N'; continue; }
        physics(r, i, STEP);
      }
      if (race.started) collide();
      acc -= STEP;
    }
    for (const r of racers) { syncRacer(r, dt); effects(r, dt); }
    stepSmoke(dt);
    updateCamera(dt);

    // audio
    audio.update(player.rpm, (inp.gas || player.nitroOn) ? 1 : 0.15);

    // end of race
    if (race.finished) {
      race.endTimer -= dt;
      if (race.endTimer <= 0 && !race.shown) { race.shown = true; el.result.classList.add('show'); }
      if (race.shown && (hudT += dt) > 0.5) { hudT = 0; showResults(); }
    }

    // HUD
    if (msgTimer > 0 && (msgTimer -= dt) <= 0) el.msg.classList.remove('show');
    const st = standings();
    el.pos.textContent = st.indexOf(player) + 1;
    el.lap.textContent = `${clamp(player.lap, 1, LAPS)}/${LAPS}`;
    el.time.textContent = fmt(race.time);
    const kmh = Math.round(Math.abs(player.vf) * 3.6);
    el.spd.textContent = kmh;
    el.gear.textContent = race.started ? player.gear : 'N';
    el.rpm.style.width = `${clamp(player.rpm / player.cfg.engine.redline, 0, 1) * 100}%`;
    el.rpm.classList.toggle('red', player.rpm > player.cfg.engine.redline * 0.92);
    el.nos.style.width = `${player.nitro * 100}%`;
    el.nos.parentElement.classList.toggle('on', player.nitroOn);
    speedlines.style.opacity = clamp((kmh - 150) / 150, 0, 0.6) + (player.nitroOn ? 0.3 : 0);
    // wrong way
    const t = T[player.idx];
    if (race.started && !race.finished && player.vf > 5 && t.x * Math.sin(player.h) + t.z * Math.cos(player.h) < -0.3) flash('WRONG WAY', 0.3);
    if (player.drifting > 0.6 && Math.abs(player.vf) > 15 && msgTimer <= 0) flash('DRIFT · NITRO +', 0.25);
    if ((boardT += dt) > 0.25) {
      boardT = 0;
      el.board.innerHTML = st.map((r, i) => `<div class="${r.isPlayer ? 'me' : ''}"><b>${i + 1}</b><i style="background:${r.isPlayer ? '#00e5ff' : r.mapCol}"></i>${r.isPlayer ? 'YOU' : r.cfg.make.toUpperCase()}</div>`).join('');
    }
    drawMap();
  }

  return api;
}
