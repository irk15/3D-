// Track layouts, themes and world building for race mode.
import * as THREE from 'three';

export const HALF_W = 8;
export const WALL = HALF_W + 3.2;

export const TRACKS = [
  {
    id: 'downtown', name: 'Neon Downtown', desc: 'Night · city street circuit', theme: 'city',
    pts: [[0, -200], [250, -210], [380, -150], [400, -20], [330, 60], [220, 40], [150, 110], [180, 230], [90, 300], [-80, 290], [-160, 200], [-120, 110], [-220, 40], [-330, 30], [-380, -80], [-300, -180], [-150, -200]]
  },
  {
    id: 'coast', name: 'Sunset Coast', desc: 'Golden hour · cliffside hills', theme: 'coast',
    pts: [[0, 0, 2], [220, -20, 4], [420, -10, 10], [560, 60, 18], [600, 200, 24], [520, 330, 22], [380, 360, 14], [260, 300, 8], [180, 380, 6], [40, 420, 4], [-120, 380, 3], [-220, 260, 6], [-200, 140, 10], [-300, 60, 8], [-260, -60, 4], [-120, -60, 2]]
  },
  {
    id: 'docks', name: 'Harbor Docks', desc: 'Dusk · tight technical port', theme: 'docks',
    pts: [[0, 0], [180, 0], [260, 40], [260, 140], [190, 180], [120, 150], [60, 200], [60, 300], [180, 320], [300, 300], [360, 380], [300, 460], [120, 460], [-60, 440], [-120, 340], [-60, 240], [-140, 160], [-140, 40], [-80, 0]]
  }
];

const THEMES = {
  city: {
    sky: ['#020309', '#0b0b22', '#2a1240', '#4a1a46'], fog: ['#0b0a1c', 140, 900], bg: '#05060c',
    hemi: ['#7f8cff', '#120a18', 0.55], sun: ['#b8c6ff', 1.4, [-60, 120, -80]],
    lamp: '#ffd7a3', wallA: '#00e5ff', wallB: '#ff2bd6', stars: true, moon: true, exposure: 1.0, envBoost: 0.75
  },
  coast: {
    sky: ['#1b2f6b', '#6d4c8f', '#ff8a5c', '#ffcf86'], fog: ['#f3a27a', 220, 1300], bg: '#f2a07a',
    hemi: ['#ffd9b0', '#3a2a3a', 0.9], sun: ['#ffb070', 2.6, [-520, 120, -300]],
    lamp: '#ffe3b8', wallA: '#ff8a3d', wallB: '#ffd23f', stars: false, sunDisc: true, exposure: 0.95, envBoost: 1.0
  },
  docks: {
    sky: ['#0d1230', '#2a2257', '#8a3b6b', '#ff7a4a'], fog: ['#3a2a4a', 160, 1000], bg: '#2a2042',
    hemi: ['#9aa6ff', '#1a1420', 0.65], sun: ['#ff9a6a', 1.5, [400, 90, 500]],
    lamp: '#ffae4a', wallA: '#ffae00', wallB: '#00e5ff', stars: true, exposure: 1.0, envBoost: 0.85
  }
};

const clamp = THREE.MathUtils.clamp;
export const hdr = (hex, k) => new THREE.Color(hex).multiplyScalar(k);

export function canvasTex(w, h, draw, { repeat, srgb = true } = {}) {
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

export const glowTex = typeof document === 'undefined' ? null : canvasTex(128, 128, (g, w, h) => {
  const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,.4)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
});

/* ───────── Geometry of the racing line ───────── */
export function trackData(def, N = 1800) {
  const curve = new THREE.CatmullRomCurve3(def.pts.map((p) => new THREE.Vector3(p[0], (p[2] || 0) + 0.2, p[1])), true, 'centripetal');
  const P = curve.getSpacedPoints(N); P.pop();
  const LEN = curve.getLength(), SEG = LEN / N;
  const T = [], L = [], slope = new Float32Array(N), K = new Float32Array(N), signK = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const a = P[(i - 1 + N) % N], b = P[(i + 1) % N];
    const t = new THREE.Vector3(b.x - a.x, 0, b.z - a.z);
    const hd = t.length();
    t.divideScalar(hd);
    T.push(t);
    L.push(new THREE.Vector3(t.z, 0, -t.x));
    slope[i] = (b.y - a.y) / hd;
  }
  for (let i = 0; i < N; i++) {
    const a = T[(i - 4 + N) % N], b = T[(i + 4) % N];
    K[i] = Math.acos(clamp(a.dot(b), -1, 1)) / (8 * SEG);
    signK[i] = Math.sign(a.x * b.z - a.z * b.x);
  }
  // speed profile for unit grip (m/s at mu*g = 1): corner limit + braking pass
  const VP = new Float32Array(N);
  for (let i = 0; i < N; i++) VP[i] = Math.min(200, Math.sqrt(1 / Math.max(K[i], 1e-5)));
  for (let pass = 0; pass < 3; pass++) {
    for (let i = N - 1; i >= 0; i--) {
      const nx = VP[(i + 1) % N];
      VP[i] = Math.min(VP[i], Math.sqrt(nx * nx + 2 * 0.85 * SEG));
    }
  }
  // lookahead curvature (for AI lane choice)
  const KA = new Float32Array(N);
  for (let i = 0; i < N; i++) { let m = 0; for (let j = 4; j < 80; j += 2) m = Math.max(m, K[(i + j) % N] / (1 + j * SEG / 60)); KA[i] = m; }

  function nearest(x, z, from, span = 60) {
    let best = from, bd = Infinity;
    for (let k = -span; k <= span; k++) {
      const j = (from + k + N) % N, p = P[j];
      const dx = p.x - x, dz = p.z - z, d = dx * dx + dz * dz;
      if (d < bd) { bd = d; best = j; }
    }
    return best;
  }
  function nearestGlobal(x, z) {
    let best = 0, bd = Infinity;
    for (let j = 0; j < N; j += 4) { const p = P[j], d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < bd) { bd = d; best = j; } }
    return nearest(x, z, best, 6);
  }
  // height + slope at a world point near sample i (linear along the segment)
  function heightAt(i, x, z) {
    const p = P[i], t = T[i];
    const along = (x - p.x) * t.x + (z - p.z) * t.z;
    return p.y + along * slope[i];
  }
  return { def, curve, P, T, L, K, KA, VP, signK, slope, N, SEG, LEN, nearest, nearestGlobal, heightAt };
}

/* ───────── World build ───────── */
export function buildTrack(def, renderer) {
  const th = THEMES[def.theme];
  const tr = trackData(def);
  const { P, T, L, N, SEG, LEN } = tr;
  const scene = new THREE.Scene();
  const disposables = [];
  const keep = (o) => { disposables.push(o); return o; };
  scene.background = new THREE.Color(th.bg);
  scene.fog = new THREE.Fog(th.fog[0], th.fog[1], th.fog[2]);

  // bounds
  let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
  for (const p of P) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z); }
  const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2, span = Math.max(maxX - minX, maxZ - minZ);
  tr.bounds = { minX, maxX, minZ, maxZ, cx, cz, span };

  // sky
  const skyTex = canvasTex(16, 512, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, th.sky[0]); gr.addColorStop(0.5, th.sky[1]); gr.addColorStop(0.82, th.sky[2]); gr.addColorStop(1, th.sky[3]);
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
  skyTex.wrapS = skyTex.wrapT = THREE.ClampToEdgeWrapping;
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1500, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false, depthWrite: false }));
  sky.position.set(cx, -20, cz);
  scene.add(sky);
  if (th.stars) {
    const n = 1400, p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, b = Math.random() * 1.1;
      p.set([cx + Math.cos(a) * Math.sin(b) * 1400, Math.cos(b) * 1400, cz + Math.sin(a) * Math.sin(b) * 1400], i * 3);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: def.theme === 'city' ? 0.7 : 0.35 })));
  }
  if (th.moon) {
    const moon = new THREE.Mesh(new THREE.CircleGeometry(40, 48), new THREE.MeshBasicMaterial({ color: hdr('#dfe6ff', 2.2), fog: false }));
    moon.position.set(cx - 600, 700, cz - 900); moon.lookAt(cx, 0, cz); scene.add(moon);
  }
  if (th.sunDisc) {
    const s = th.sun[2];
    const d = new THREE.Vector3(s[0], s[1], s[2]).normalize();
    const sun = new THREE.Mesh(new THREE.CircleGeometry(70, 48), new THREE.MeshBasicMaterial({ color: hdr('#ffd28a', 3), fog: false }));
    sun.position.set(cx + d.x * 1350, d.y * 1350 * 0.6, cz + d.z * 1350); sun.lookAt(cx, 0, cz); scene.add(sun);
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), new THREE.MeshBasicMaterial({ map: glowTex, color: hdr('#ff9a5a', 0.9), transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
    halo.position.copy(sun.position).multiplyScalar(0.995); halo.lookAt(cx, 0, cz); scene.add(halo);
  }

  // lights
  const hemi = new THREE.HemisphereLight(th.hemi[0], th.hemi[1], th.hemi[2]);
  const sun = new THREE.DirectionalLight(th.sun[0], th.sun[1]);
  sun.userData.dir = new THREE.Vector3(...th.sun[2]).normalize();
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -32, right: 32, top: 32, bottom: -32, near: 10, far: 400 });
  sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03;
  scene.add(hemi, sun, sun.target);

  // ground / water
  const groundCol = { city: '#0c0d12', coast: '#6b5a3e', docks: '#2a2c31' }[def.theme];
  const groundTex = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = groundCol; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(${def.theme === 'coast' ? '40,60,20' : '255,255,255'},${Math.random() * 0.05})`; g.fillRect(Math.random() * w, Math.random() * h, 3, 3); }
    if (def.theme !== 'coast') { g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 3; for (let x = 0; x <= w; x += 128) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); g.beginPath(); g.moveTo(0, x); g.lineTo(w, x); g.stroke(); } }
  }, { repeat: [80, 80] });
  const landR = def.theme === 'city' ? 1600 : span * 0.5 + 170;
  const ground = new THREE.Mesh(def.theme === 'city' ? new THREE.PlaneGeometry(3200, 3200) : new THREE.CircleGeometry(landR, 64), new THREE.MeshStandardMaterial({ map: groundTex, roughness: 0.95 }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(cx, 0, cz); ground.receiveShadow = true; scene.add(ground);
  if (def.theme !== 'city') {
    const water = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), new THREE.MeshStandardMaterial({ color: def.theme === 'coast' ? 0x1d4a6e : 0x101a2a, roughness: 0.12, metalness: 0.6, envMapIntensity: 1.4 }));
    water.rotation.x = -Math.PI / 2; water.position.set(cx, -1.2, cz); scene.add(water);
    if (def.theme === 'coast') {
      const beach = new THREE.Mesh(new THREE.RingGeometry(landR - 2, landR + 40, 64), new THREE.MeshStandardMaterial({ color: 0xd9c08f, roughness: 1 }));
      beach.rotation.x = -Math.PI / 2; beach.position.set(cx, -0.6, cz); scene.add(beach);
    } else {
      const quay = new THREE.Mesh(new THREE.CylinderGeometry(landR, landR, 2.4, 64, 1, true), new THREE.MeshStandardMaterial({ color: 0x3a3c42, roughness: 0.9, side: THREE.DoubleSide }));
      quay.position.set(cx, -1.2, cz); scene.add(quay);
    }
  }

  // road ribbons
  function ribbon(a, b, ya, yb, vLen, mat, opts = {}) {
    const pos = new Float32Array((N + 1) * 6), uv = new Float32Array((N + 1) * 4), idx = [];
    for (let i = 0; i <= N; i++) {
      const p = P[i % N], l = L[i % N], v = (i * SEG) / vLen;
      const y0 = opts.abs ? ya : p.y + ya, y1 = opts.absB ? yb : p.y + yb;
      pos.set([p.x + l.x * a, y0, p.z + l.z * a, p.x + l.x * b, y1, p.z + l.z * b], i * 6);
      if (opts.vertical) uv.set([v, 0, v, 1], i * 4); else uv.set([0, v, 1, v], i * 4);
      if (i < N) { const o = i * 2; idx.push(o, o + 2, o + 1, o + 1, o + 2, o + 3); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat); m.receiveShadow = true; scene.add(m);
    return m;
  }

  const asphalt = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = def.theme === 'coast' ? '#2a2b30' : '#17181d'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 26000; i++) { const c = Math.random() * 40 + 10; g.fillStyle = `rgba(${c},${c},${c + 4},.5)`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(w * 0.18, 0, w * 0.12, h); g.fillRect(w * 0.7, 0, w * 0.12, h);
    g.fillStyle = 'rgba(240,240,240,.85)'; g.fillRect(w * 0.03, 0, 8, h); g.fillRect(w * 0.97 - 8, 0, 8, h);
    g.fillStyle = 'rgba(240,240,240,.7)';
    for (let y = 0; y < h; y += 256) { g.fillRect(w / 3 - 4, y, 8, 120); g.fillRect(2 * w / 3 - 4, y, 8, 120); }
  });
  const roadMat = new THREE.MeshStandardMaterial({ map: asphalt, roughness: 0.62, metalness: 0.15, envMapIntensity: 0.5, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  ribbon(-HALF_W, HALF_W, 0.03, 0.03, 16, roadMat);
  const kerb = canvasTex(64, 256, (g, w, h) => { for (let y = 0; y < h; y += 64) { g.fillStyle = '#d8131f'; g.fillRect(0, y, w, 32); g.fillStyle = '#f2f2f2'; g.fillRect(0, y + 32, w, 32); } });
  const kerbMat = new THREE.MeshStandardMaterial({ map: kerb, roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  ribbon(HALF_W, HALF_W + 1.3, 0.05, 0.05, 8, kerbMat);
  ribbon(-HALF_W - 1.3, -HALF_W, 0.05, 0.05, 8, kerbMat);
  const shoulderMat = new THREE.MeshStandardMaterial({ color: def.theme === 'coast' ? 0x4a4536 : 0x0f1014, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  ribbon(HALF_W + 1.3, WALL, 0.02, 0.02, 16, shoulderMat);
  ribbon(-WALL, -HALF_W - 1.3, 0.02, 0.02, 16, shoulderMat);
  // embankment from the raised road down to the ground
  if (def.theme === 'coast') {
    const emb = new THREE.MeshStandardMaterial({ color: 0x5b4c34, roughness: 1, side: THREE.DoubleSide });
    ribbon(WALL, WALL + 26, 0, 0.0, 16, emb, { absB: true });
    ribbon(-WALL - 26, -WALL, 0.0, 0, 16, emb, { abs: true });
  }

  // walls with neon stripe
  const wallEm = canvasTex(64, 128, (g, w, h) => { g.fillStyle = '#000'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.fillRect(0, 18, w, 10); g.fillRect(0, 100, w, 3); }, { srgb: false });
  const wallMap = canvasTex(256, 128, (g, w, h) => {
    g.fillStyle = def.theme === 'coast' ? '#d9d6cf' : '#1b1d24'; g.fillRect(0, 0, w, h);
    g.fillStyle = def.theme === 'coast' ? '#bdb8ae' : '#262933'; for (let x = 0; x < w; x += 64) g.fillRect(x, 0, 3, h);
    g.fillStyle = def.theme === 'coast' ? '#d8131f' : '#e3c400';
    for (let x = -40; x < w; x += 40) { g.beginPath(); g.moveTo(x, 128); g.lineTo(x + 20, 104); g.lineTo(x + 34, 104); g.lineTo(x + 14, 128); g.fill(); }
  });
  const mkWall = (col) => new THREE.MeshStandardMaterial({ map: wallMap, emissiveMap: wallEm, emissive: hdr(col, def.theme === 'coast' ? 0.9 : 2.6), roughness: 0.5, metalness: 0.4, side: THREE.DoubleSide });
  ribbon(WALL, WALL, 0, 1.15, 4, mkWall(th.wallA), { vertical: true });
  ribbon(-WALL, -WALL, 1.15, 0, 4, mkWall(th.wallB), { vertical: true });

  // street lamps
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1), yAx = new THREE.Vector3(0, 1, 0), zero = new THREE.Vector3(0, 0, 0);
  const lampCount = Math.floor(LEN / 42);
  const poleG = new THREE.CylinderGeometry(0.12, 0.16, 8, 8); poleG.translate(0, 4, 0);
  const armG = new THREE.BoxGeometry(0.12, 0.12, 3.2); armG.translate(0, 8, -1.5);
  const headG = new THREE.BoxGeometry(0.5, 0.12, 1.1); headG.translate(0, 7.92, -2.8);
  const metal = new THREE.MeshStandardMaterial({ color: 0x24262c, metalness: 0.8, roughness: 0.4 });
  const poles = new THREE.InstancedMesh(poleG, metal, lampCount);
  const arms = new THREE.InstancedMesh(armG, metal, lampCount);
  const heads = new THREE.InstancedMesh(headG, new THREE.MeshBasicMaterial({ color: hdr(th.lamp, def.theme === 'coast' ? 3 : 7) }), lampCount);
  const poolG = new THREE.PlaneGeometry(14, 14); poolG.rotateX(-Math.PI / 2);
  const pools = new THREE.InstancedMesh(poolG, new THREE.MeshBasicMaterial({ map: glowTex, color: hdr(th.lamp, def.theme === 'coast' ? 0.12 : 0.42), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }), lampCount);
  const camSpots = [];
  for (let k = 0; k < lampCount; k++) {
    const i = Math.floor((k * N) / lampCount), side = k % 2 ? 1 : -1;
    const p = P[i], l = L[i];
    const base = new THREE.Vector3(p.x + l.x * side * (WALL + 1.2), p.y - 0.2, p.z + l.z * side * (WALL + 1.2));
    q.setFromAxisAngle(yAx, Math.atan2(l.x * side, l.z * side));
    m4.compose(base, q, one);
    poles.setMatrixAt(k, m4); arms.setMatrixAt(k, m4); heads.setMatrixAt(k, m4);
    m4.compose(new THREE.Vector3(p.x + l.x * side * (WALL - 4), p.y + 0.06, p.z + l.z * side * (WALL - 4)), q.identity(), one);
    pools.setMatrixAt(k, m4);
    if (k % 3 === 0) camSpots.push({ i, pos: new THREE.Vector3(p.x + l.x * side * (WALL + 3), p.y + 2.2 + (k % 2) * 3, p.z + l.z * side * (WALL + 3)) });
  }
  scene.add(poles, arms, heads, pools);
  tr.camSpots = camSpots;

  // distance from track test for decoration placement
  const coarse = P.filter((_, i) => i % 6 === 0);
  const clearOfTrack = (x, z, r) => { for (const p of coarse) { const dx = p.x - x, dz = p.z - z; if (dx * dx + dz * dz < (WALL + 6 + r) ** 2) return false; } return true; };
  const distTrack = (x, z) => { let m = Infinity; for (const p of coarse) m = Math.min(m, Math.hypot(p.x - x, p.z - z)); return m; };

  const boxG = new THREE.BoxGeometry(1, 1, 1); boxG.translate(0, 0.5, 0);
  if (def.theme === 'city') buildCity();
  if (def.theme === 'coast') buildCoast();
  if (def.theme === 'docks') buildDocks();

  function windowMaterial(lit = 0.32, facadeCol = '#16171d') {
    const winTex = canvasTex(512, 512, (g) => {
      g.fillStyle = '#000'; g.fillRect(0, 0, 512, 512);
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const r = Math.random();
        if (r < lit) { g.fillStyle = r < 0.05 ? '#7fe9ff' : r < 0.08 ? '#ff7ad9' : `hsl(${35 + Math.random() * 15},80%,${55 + Math.random() * 25}%)`; g.fillRect(x * 32 + 6, y * 32 + 8, 20, 18); }
      }
    });
    const facade = canvasTex(256, 256, (g) => {
      g.fillStyle = facadeCol; g.fillRect(0, 0, 256, 256);
      g.fillStyle = 'rgba(0,0,0,.45)'; for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) g.fillRect(x * 32 + 6, y * 32 + 8, 20, 18);
      g.fillStyle = 'rgba(255,255,255,.06)'; for (let x = 0; x < 256; x += 32) g.fillRect(x, 0, 3, 256);
    });
    const mat = new THREE.MeshStandardMaterial({ map: facade, emissiveMap: winTex, emissive: new THREE.Color(1.6, 1.6, 1.6), roughness: 0.75, metalness: 0.3 });
    mat.onBeforeCompile = (sh) => {
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
    return mat;
  }

  function scatterBlocks(count, area, sizeFn, mat, colorFn) {
    const spots = [];
    for (let tries = 0; tries < count * 14 && spots.length < count; tries++) {
      const x = cx + (Math.random() - 0.5) * area[0], z = cz + (Math.random() - 0.5) * area[1];
      const s = sizeFn(x, z);
      if (!s) continue;
      const r = Math.hypot(s.w, s.d) / 2;
      if (!clearOfTrack(x, z, r)) continue;
      let ok = true;
      for (const o of spots) if (Math.hypot(o.x - x, o.z - z) < (o.r + r) * 0.82) { ok = false; break; }
      if (!ok) continue;
      spots.push({ x, z, r, ...s });
    }
    const mesh = new THREE.InstancedMesh(boxG, mat, Math.max(1, spots.length));
    const col = new THREE.Color();
    spots.forEach((s, i) => {
      m4.compose(new THREE.Vector3(s.x, s.y || 0, s.z), q.setFromAxisAngle(yAx, s.rot ?? (Math.random() - 0.5) * 0.3), new THREE.Vector3(s.w, s.h, s.d));
      mesh.setMatrixAt(i, m4);
      if (colorFn) mesh.setColorAt(i, colorFn(col, s));
    });
    mesh.receiveShadow = true;
    scene.add(mesh);
    return { mesh, spots };
  }

  function buildCity() {
    const { spots } = scatterBlocks(520, [1300, 1000], (x, z) => {
      const near = distTrack(x, z) < 80;
      return { w: 16 + Math.random() * 26, d: 16 + Math.random() * 26, h: (near ? 18 : 30) + Math.random() * (near ? 45 : 150) };
    }, windowMaterial(0.32), (c) => c.setHSL(0.62 + Math.random() * 0.1, 0.15, 0.5 + Math.random() * 0.4));
    const beacons = new THREE.InstancedMesh(new THREE.SphereGeometry(0.9, 8, 6), new THREE.MeshBasicMaterial({ color: hdr('#ff2a2a', 6) }), Math.max(1, spots.length));
    spots.forEach((s, i) => { m4.compose(new THREE.Vector3(s.x, s.h + 1, s.z), q.identity(), s.h > 90 ? one : zero); beacons.setMatrixAt(i, m4); });
    scene.add(beacons);
    billboards(['APEX', 'NITRO', 'NIGHT RUN', 'TURBO', 'DRIFT', 'MIDNIGHT'], ['#00e5ff', '#ff2bd6', '#ffb000', '#7cff3a', '#ff4d4d', '#8a5cff'], 3.2);
  }

  function buildCoast() {
    // villas
    scatterBlocks(140, [span + 300, span + 300], (x, z) => {
      const d = distTrack(x, z); if (d > 160 || Math.hypot(x - cx, z - cz) > landR - 30) return null;
      return { w: 12 + Math.random() * 14, d: 10 + Math.random() * 12, h: 5 + Math.random() * 9 };
    }, windowMaterial(0.18, '#e9e2d4'), (c) => c.setHSL(0.08 + Math.random() * 0.05, 0.3, 0.75 + Math.random() * 0.2));
    // palms
    const trunkG = new THREE.CylinderGeometry(0.18, 0.32, 9, 6); trunkG.translate(0, 4.5, 0);
    const leafG = new THREE.ConeGeometry(3.6, 2.2, 7, 1, true); leafG.translate(0, 9, 0);
    const trunks = [], n = Math.floor(LEN / 18);
    const trunkM = new THREE.InstancedMesh(trunkG, new THREE.MeshStandardMaterial({ color: 0x6b4a2b, roughness: 0.9 }), n);
    const leafM = new THREE.InstancedMesh(leafG, new THREE.MeshStandardMaterial({ color: 0x2f6b2a, roughness: 0.8, side: THREE.DoubleSide }), n);
    for (let k = 0; k < n; k++) {
      const i = Math.floor((k * N) / n + Math.random() * 6) % N, side = Math.random() < 0.5 ? 1 : -1;
      const p = P[i], l = L[i], off = WALL + 4 + Math.random() * 10;
      const x = p.x + l.x * side * off, z = p.z + l.z * side * off;
      if (!clearOfTrack(x, z, -4)) { m4.makeScale(0, 0, 0); trunkM.setMatrixAt(k, m4); leafM.setMatrixAt(k, m4); continue; }
      const s = 0.8 + Math.random() * 0.5;
      m4.compose(new THREE.Vector3(x, Math.max(0, p.y - 1.5 - (off - WALL) * 0.8), z), q.setFromEuler(new THREE.Euler((Math.random() - 0.5) * 0.15, Math.random() * 6, (Math.random() - 0.5) * 0.15)), new THREE.Vector3(s, s, s));
      trunkM.setMatrixAt(k, m4); leafM.setMatrixAt(k, m4);
      trunks.push(k);
    }
    trunkM.castShadow = leafM.castShadow = false;
    scene.add(trunkM, leafM);
    // hills in the distance
    const hillM = new THREE.MeshStandardMaterial({ color: 0x5a4a3a, roughness: 1, flatShading: true });
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * Math.PI * 2, r = landR * (0.95 + Math.random() * 0.3);
      const h = new THREE.Mesh(new THREE.ConeGeometry(80 + Math.random() * 120, 50 + Math.random() * 120, 7), hillM);
      h.position.set(cx + Math.cos(a) * r, 10, cz + Math.sin(a) * r);
      scene.add(h);
    }
    billboards(['APEX', 'SUNSET RUN', 'NITRO', 'COAST'], ['#ff8a3d', '#ffd23f', '#00e5ff', '#ff2bd6'], 2.2);
  }

  function buildDocks() {
    // container stacks
    const corr = canvasTex(256, 64, (g, w, h) => { g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(0,0,0,.25)'; for (let x = 0; x < w; x += 8) g.fillRect(x, 0, 3, h); g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(0, 0, w, 3); g.fillRect(0, h - 3, w, 3); });
    const cMat = new THREE.MeshStandardMaterial({ map: corr, roughness: 0.6, metalness: 0.4 });
    const pal = ['#c0392b', '#1f6fb2', '#e67e22', '#27ae60', '#8e44ad', '#f1c40f', '#7f8c8d', '#16a085'];
    const units = [];
    for (let tries = 0; tries < 3000 && units.length < 900; tries++) {
      const x = cx + (Math.random() - 0.5) * (span + 200), z = cz + (Math.random() - 0.5) * (span + 200);
      if (Math.hypot(x - cx, z - cz) > landR - 20 || !clearOfTrack(x, z, 9)) continue;
      const rot = Math.random() < 0.5 ? 0 : Math.PI / 2, stack = 1 + Math.floor(Math.random() * 4);
      let ok = true; for (const u of units) if (Math.hypot(u.x - x, u.z - z) < 14) { ok = false; break; }
      if (!ok) continue;
      for (let s = 0; s < stack; s++) units.push({ x, z, y: s * 2.6, rot, c: pal[(Math.random() * pal.length) | 0] });
    }
    const cm = new THREE.InstancedMesh(boxG, cMat, Math.max(1, units.length));
    const col = new THREE.Color();
    units.forEach((u, i) => { m4.compose(new THREE.Vector3(u.x, u.y, u.z), q.setFromAxisAngle(yAx, u.rot), new THREE.Vector3(12.2, 2.6, 2.45)); cm.setMatrixAt(i, m4); cm.setColorAt(i, col.set(u.c)); });
    cm.receiveShadow = true;
    scene.add(cm);
    // warehouses
    scatterBlocks(40, [span + 260, span + 260], (x, z) => {
      if (Math.hypot(x - cx, z - cz) > landR - 40 || distTrack(x, z) < 40) return null;
      return { w: 40 + Math.random() * 40, d: 25 + Math.random() * 30, h: 12 + Math.random() * 10 };
    }, windowMaterial(0.12, '#3c4048'));
    // gantry cranes along the quay
    const red = new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.5, metalness: 0.5 });
    const white = new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.5, metalness: 0.5 });
    const warn = new THREE.MeshBasicMaterial({ color: hdr('#ff2a2a', 6) });
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2 + 0.3, r = landR - 12;
      const g = new THREE.Group();
      for (const sx of [-6, 6]) for (const sz of [-5, 5]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(1.2, 34, 1.2), k % 2 ? red : white); leg.position.set(sx, 17, sz); g.add(leg); }
      const beam = new THREE.Mesh(new THREE.BoxGeometry(14, 3, 60), k % 2 ? red : white); beam.position.set(0, 36, 14); g.add(beam);
      const cab = new THREE.Mesh(new THREE.BoxGeometry(5, 4, 6), white); cab.position.set(0, 32, 20); g.add(cab);
      const lt = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 6), warn); lt.position.set(0, 38, 44); g.add(lt);
      g.position.set(cx + Math.cos(a) * r, 0, cz + Math.sin(a) * r);
      g.rotation.y = -a + Math.PI / 2;
      scene.add(g);
    }
    billboards(['APEX', 'PORT 7', 'NITRO', 'DOCKS'], ['#ffae00', '#00e5ff', '#ff2bd6', '#7cff3a'], 3);
  }

  function billboards(words, cols, k) {
    words.forEach((txt, n) => {
      const tex = canvasTex(1024, 256, (g, w, h) => {
        g.clearRect(0, 0, w, h);
        g.strokeStyle = '#fff'; g.lineWidth = 10; g.strokeRect(12, 12, w - 24, h - 24);
        g.font = `900 ${txt.length > 8 ? 120 : 150}px Orbitron, Arial Black, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillStyle = '#fff'; g.fillText(txt, w / 2, h / 2 + 6);
      });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(28, 7), new THREE.MeshBasicMaterial({ map: tex, color: hdr(cols[n % cols.length], k), transparent: true, side: THREE.DoubleSide, depthWrite: false }));
      const i = Math.floor(((n + 0.35) / words.length) * N), side = n % 2 ? 1 : -1;
      const p = P[i], l = L[i];
      m.position.set(p.x + l.x * side * (WALL + 9), p.y + 9, p.z + l.z * side * (WALL + 9));
      m.lookAt(p.x, p.y + 7, p.z);
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.4, 9 + p.y, 0.4), metal);
      post.position.set(m.position.x, (9 + p.y) / 2, m.position.z);
      scene.add(m, post);
    });
  }

  // start / finish gantry
  {
    const p = P[0], t = T[0];
    const chk = canvasTex(256, 64, (g) => { for (let x = 0; x < 256; x += 16) for (let y = 0; y < 64; y += 16) { g.fillStyle = ((x + y) / 16) % 2 ? '#111' : '#f4f4f4'; g.fillRect(x, y, 16, 16); } });
    const line = new THREE.Mesh(new THREE.PlaneGeometry(HALF_W * 2, 2.4), new THREE.MeshStandardMaterial({ map: chk, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
    line.rotation.order = 'YXZ';
    line.rotation.set(-Math.PI / 2, Math.atan2(t.x, t.z), 0);
    line.position.set(p.x, p.y + 0.07, p.z); scene.add(line);
    const g = new THREE.Group();
    const legMat = new THREE.MeshStandardMaterial({ color: 0x1e2026, metalness: 0.85, roughness: 0.35 });
    for (const s of [-1, 1]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.8, 9, 0.8), legMat); leg.position.set(s * (WALL + 0.4), 4.5, 0); g.add(leg); }
    const banner = canvasTex(1024, 128, (gc, w) => {
      gc.fillStyle = '#05060a'; gc.fillRect(0, 0, w, 128);
      for (let x = 0; x < w; x += 32) for (let y = 0; y < 32; y += 16) { gc.fillStyle = ((x + y) / 16) % 2 ? '#111' : '#eee'; gc.fillRect(x, y + (y ? 80 : 0), 16, 16); }
      gc.font = '900 60px Orbitron, Arial Black, sans-serif'; gc.textAlign = 'center'; gc.textBaseline = 'middle';
      gc.fillStyle = th.wallA; gc.fillText(`APEX // ${def.name.toUpperCase()}`, w / 2, 58);
    });
    const bm = new THREE.MeshBasicMaterial({ map: banner, color: hdr('#ffffff', 1.6) });
    const top = new THREE.Mesh(new THREE.BoxGeometry(WALL * 2 + 1.6, 2.2, 0.6), [legMat, legMat, legMat, legMat, bm, bm]);
    top.position.y = 8.6; g.add(top);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(WALL * 2 + 1.6, 0.12, 0.7), new THREE.MeshBasicMaterial({ color: hdr(th.wallB, 5) }));
    strip.position.y = 7.45; g.add(strip);
    g.position.copy(p); g.rotation.y = Math.atan2(t.x, t.z);
    scene.add(g);
  }

  // environment map for reflections, built from this theme's sky
  const env = new THREE.Scene();
  const envSky = new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide }));
  env.add(envSky);
  const envFloor = new THREE.Mesh(new THREE.CircleGeometry(100, 32), new THREE.MeshBasicMaterial({ color: def.theme === 'coast' ? 0x2a2420 : 0x0a0a0e }));
  envFloor.rotation.x = -Math.PI / 2; envFloor.position.y = -2; env.add(envFloor);
  const strips = def.theme === 'coast' ? 4 : 10;
  for (let k = 0; k < strips; k++) {
    const a = (k / strips) * Math.PI * 2;
    const s = new THREE.Mesh(new THREE.BoxGeometry(4, 0.6, 30), new THREE.MeshBasicMaterial({ color: hdr(k % 2 ? th.wallA : th.lamp, def.theme === 'coast' ? 2 : 6) }));
    s.position.set(Math.cos(a) * 40, 12 + (k % 3) * 6, Math.sin(a) * 40); s.lookAt(0, 12, 0); env.add(s);
  }
  if (th.sunDisc) { const sd = new THREE.Mesh(new THREE.SphereGeometry(8, 16, 8), new THREE.MeshBasicMaterial({ color: hdr('#ffc27a', 14) })); sd.position.copy(sun.userData.dir).multiplyScalar(80); env.add(sd); }
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envRT = pmrem.fromScene(env, 0.04);
  pmrem.dispose();
  scene.environment = envRT.texture;
  scene.environmentIntensity = th.envBoost;

  const wet = { road: roadMat };
  return {
    ...tr, scene, sun, hemi, theme: th, wet,
    setWet(on) {
      roadMat.roughness = on ? 0.18 : 0.62;
      roadMat.metalness = on ? 0.35 : 0.15;
      roadMat.envMapIntensity = on ? 1.4 : 0.5;
      roadMat.color.setScalar(on ? 0.7 : 1);
      scene.fog.near = on ? th.fog[1] * 0.5 : th.fog[1];
      scene.fog.far = on ? th.fog[2] * 0.55 : th.fog[2];
    },
    dispose() {
      envRT.dispose();
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { if (m.map && m.map !== glowTex) m.map.dispose(); if (m.emissiveMap) m.emissiveMap.dispose(); m.dispose(); });
      });
    }
  };
}
