// main.js — boot, quality tiers, render loop. Montréal in Three.js, desktop + Meta Quest 3.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { loadMasks, MASK, U, floorAt, terrainH, ll2g, BOXES } from './core.js';
import './shaders.js';
import { buildTerrain } from './terrain.js';
import { generateCity, finalizeCity, STATS } from './city.js';
import { Atmosphere, sunDirection } from './atmosphere.js';
import { buildLandmarks, registerExclusions, LANDMARKS, standPoint } from './landmarks.js';
import { Vegetation } from './vegetation.js';
import { Life } from './life.js';
import { Controls, TOURS } from './controls.js';
import { XR } from './xr.js';
import { UI, Sound } from './ui.js';
import { WaterMirror } from './reflect.js';

const dpr = Math.min(window.devicePixelRatio || 1, 2);
const isQuest = /OculusBrowser|Quest/i.test(navigator.userAgent);
const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent) && !isQuest;
export const QUALITY = {
  low: { pr: 1, shadowMap: 2048, shadowSize: 220, bloom: false, cars: 320, buses: 14, peds: 380, bridgeCars: 60, lifeRadius: 650, parkRadius: 220, propRadius: 200, treeFade: [650, 900], forestFade: [380, 560], nearTrees: 70 },
  high: { pr: Math.min(dpr, 1.5), shadowMap: 4096, shadowSize: 320, bloom: true, cars: 720, buses: 28, peds: 850, bridgeCars: 140, lifeRadius: 900, parkRadius: 330, propRadius: 320, treeFade: [1100, 1500], forestFade: [520, 720], nearTrees: 125, mirror: true },
  ultra: { pr: dpr, shadowMap: 4096, shadowSize: 420, bloom: true, cars: 900, buses: 40, peds: 1100, bridgeCars: 160, lifeRadius: 1100, parkRadius: 380, propRadius: 420, treeFade: [1500, 2000], forestFade: [700, 950], nearTrees: 170, mirror: true },
  vr: { pr: 1, shadowMap: 2048, shadowSize: 140, bloom: false, cars: 260, buses: 12, peds: 300, bridgeCars: 60, lifeRadius: 520, parkRadius: 170, propRadius: 170, treeFade: [600, 800], forestFade: [320, 470], nearTrees: 80 },
};
const params = new URLSearchParams(location.search);
const $ = (s) => document.querySelector(s);
const step = (msg, p) => { $('#loadMsg').textContent = msg; $('#loadBar').style.width = (p * 100).toFixed(0) + '%'; return new Promise((r) => setTimeout(r, 16)); };

async function boot() {
  const app = window.app = {}; app.THREE = THREE; app.U = U;
  app.qualityName = params.get('q') || (isQuest || isMobile ? 'low' : 'high');
  const Qs = QUALITY[app.qualityName] || QUALITY.high;
  // ---- renderer: MSAA on, logarithmic depth OFF (tight near/far instead), ACES, sRGB
  const renderer = new THREE.WebGLRenderer({ canvas: $('#gl'), antialias: true, powerPreference: 'high-performance', stencil: false });
  renderer.setPixelRatio(Qs.pr); renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.xr.enabled = true;
  renderer.info.autoReset = false;
  app.renderer = renderer;
  const scene = new THREE.Scene(); app.scene = scene;
  const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.5, 40000); app.camera = camera;
  scene.add(camera);

  await step('Reading the map of the island…', 0.05);
  await loadMasks('data/');
  U.uMaskA.value = MASK.texA; U.uMaskB.value = MASK.texB;
  await step('Shaping Mount Royal and the Saint Lawrence…', 0.15);
  registerExclusions();
  app.terrain = buildTerrain(scene);
  await step('Raising the city block by block…', 0.3);
  generateCity(scene);
  await step('Placing the landmarks and bridges…', 0.55);
  app.landmarks = buildLandmarks(scene); app.landmarksList = LANDMARKS;
  app.city = finalizeCity(scene);
  console.log('[mtl] city tris', app.city.tris, 'terrain tris', app.terrain.tris, 'buildings', STATS.buildings, 'boxes', STATS.boxes, 'overlaps', STATS.overlaps);
  await step('Planting the trees of Mount Royal…', 0.7);
  app.veg = new Vegetation(scene, Object.assign({ forestStep: app.qualityName === 'low' ? 9 : 7.5 }, Qs));
  console.log('[mtl] trees', JSON.stringify(app.veg.counts), 'lamps', app.veg.lampPts.length);
  await step('Waking up the streets…', 0.85);
  app.life = new Life(scene, app.landmarks.paths, Qs);
  app.atmo = new Atmosphere(renderer, scene);
  app.mirror = new WaterMirror(renderer, scene, [...app.terrain.waters, app.atmo.weatherFx.mesh]);
  { // reflection layer + no stars in the mirror (they would sparkle on the waves)
    const su = app.atmo.sky.material.uniforms; let ns = 0;
    app.mirror.before = () => { ns = su.uNightSky.value; su.uNightSky.value = 0; };
    app.mirror.after = () => { su.uNightSky.value = ns; };
    const big = [app.city.group, app.terrain.root, app.landmarks.root, app.atmo.sky, app.veg.lampGlow.mesh, app.life.glow.mesh];
    for (const g of big) g.traverse((o) => o.layers.enable(6));
    for (const w of app.terrain.waters) w.layers.disable(6);
    for (const c of app.terrain.canopies) c.layers.enable(6);
    for (const L of [app.atmo.sun, app.atmo.hemi]) L.layers.enable(6);   // lights are layer-filtered too
  }
  app.atmo.season = params.get('season') || 'autumn';
  app.atmo.weather = params.get('weather') || 'clear';
  app.atmo.hour = params.has('t') ? +params.get('t') : 16.9;
  app.controls = new Controls(camera, renderer.domElement);
  app.sound = new Sound();
  // starting view: downtown from over the river, the mountain behind
  const [pu, pv] = ll2g(45.4970, -73.5520);
  camera.position.set(pu - 160, 330, -pv + 260);
  app.controls.orbit.target.set(-60, 90, -260);
  app.controls.orbit.update();

  // ---- post-processing (desktop only; never used while presenting in XR)
  const rt = new THREE.WebGLRenderTarget(innerWidth * Qs.pr, innerHeight * Qs.pr, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.55, 0.5, 1.6);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  composer.addPass(new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uV: { value: 0.22 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform sampler2D tDiffuse; uniform float uV; varying vec2 vUv; void main(){ vec4 c = texture2D(tDiffuse, vUv); vec2 d = vUv - 0.5; c.rgb *= 1.0 - uV * dot(d, d) * 2.2; gl_FragColor = c; }',
  }));
  app.composer = composer; app.bloom = bloom;

  function onResize() {
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight); composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(innerWidth, innerHeight);
    app.mirror.setSize(innerWidth * renderer.getPixelRatio(), innerHeight * renderer.getPixelRatio());
    bloom.setSize(innerWidth, innerHeight);
  }
  // ---- app API used by the UI and XR
  app.state = () => ({ hour: app.atmo.hour, season: app.atmo.season, weather: app.atmo.weather, timePreset: app.timePreset });
  const presetHour = (k) => {
    const decl = { spring: 6, summer: 21, autumn: -9, winter: -21 }[app.atmo.season];
    const find = (target, from, to) => { let best = from, bd = 1e9; const v = new THREE.Vector3(); for (let h = from; h <= to; h += 0.02) { const e = Math.asin(sunDirection(h, decl, v).y) * 57.3; if (Math.abs(e - target) < bd) { bd = Math.abs(e - target); best = h; } } return best; };
    if (k === 'dawn') return find(1.5, 4, 10);
    if (k === 'day') return 12.4;
    if (k === 'golden') return find(6, 13, 21);
    if (k === 'blue') return find(-5, 15, 22);
    if (k === 'sunset') return find(1.2, 13, 21);
    if (k === 'night') return 22.4;
    return +k;
  };
  app.setTime = (k) => { app.timePreset = k; app.live = false; app.atmo.hour = presetHour(k); app.atmo.update(0, null, true); };
  app.setHour = (h) => { app.timePreset = null; app.live = false; app.atmo.hour = h; };
  app.setSeason = (s) => { app.atmo.season = s; if (app.timePreset) app.atmo.hour = presetHour(app.timePreset); };
  app.setWeather = (w) => { app.atmo.weather = w; };
  app.startTour = (i) => {
    const T = TOURS[i];
    app.saved = { hour: app.atmo.hour };
    if (T.hour === 'sunset') app.atmo.hour = presetHour('sunset'); else app.atmo.hour = T.hour;
    app.timePreset = null; app.atmo.update(0, null, true);
    document.body.classList.add('touring');
    app.controls.startTour(i, app.atmo, () => document.body.classList.remove('touring'));
  };
  app.walkTo = (L) => {
    const [u, v, yaw] = standPoint(L);
    app.controls.setMode('walk');
    camera.position.set(u, floorAt(u, -v, 1e9) + 1.7, -v);
    app.controls.yaw = -yaw * Math.PI / 180; app.controls.pitch = 0.12;
  };
  app.setQuality = (name) => {
    const q = QUALITY[name]; app.qualityName = name; app.Q = q;
    renderer.setPixelRatio(q.pr); app.mirror.enabled = !!q.mirror; onResize();
    app.atmo.setShadowQuality(q.shadowSize, q.shadowMap);
    app.veg.setQuality(q); app.life.setQuality(q);
  };
  app.enterVR = async () => { await app.xr.enter(app.qualityName === 'ultra' ? 1.2 : app.qualityName === 'low' ? 0.95 : 1.05); };
  app.xr = new XR(renderer, scene, {
    state: app.state, setTime: (k) => app.setTime(k), setSeason: app.setSeason, setWeather: app.setWeather,
    onEnter: () => {
      document.body.classList.add('vr');
      app.prevQuality = app.qualityName; app.applyQ(QUALITY.vr); app.mirror.enabled = false; U.uMirrorOn.value = 0;
      app.atmo.fogMul = 1.9; app.atmo.vr = true; app.atmo.update(0, null, true);
    },
    onExit: () => { document.body.classList.remove('vr'); app.atmo.fogMul = 1; app.atmo.vr = false; app.uncull(); app.setQuality(app.prevQuality || 'high'); },
  });
  app.applyQ = (q) => { app.atmo.setShadowQuality(q.shadowSize, q.shadowMap); app.veg.setQuality(q); app.life.setQuality(q); };
  app.ui = new UI(app);
  app.setQuality(app.qualityName);
  app.atmo.update(0, app.controls.focus, true);

  // ---- events
  addEventListener('resize', onResize); onResize();
  let downAt = null;
  renderer.domElement.addEventListener('pointerdown', (e) => { downAt = [e.clientX, e.clientY]; });
  renderer.domElement.addEventListener('pointerup', (e) => { if (downAt && Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) < 4 && app.controls.mode === 'orbit') app.ui.pick(e.clientX, e.clientY, camera); downAt = null; });

  // ---- render loop
  const clock = new THREE.Clock();
  let acc = 0, frames = 0, statT = 0, slow = 0, lastBellHour = -1;
  const fpsHist = [];
  app.timeLapse = params.has('lapse'); app.live = params.has('live');
  await step('Ready', 1);
  $('#loader').classList.add('done');
  setTimeout(() => $('#loader').remove(), 1200);
  window.__ready = true;
  const audit = STATS.overlaps;
  const frame = (dtOverride) => {
    const dt = typeof dtOverride === 'number' ? dtOverride : Math.min(clock.getDelta(), 0.1);
    U.uTime.value += dt;
    const xrOn = renderer.xr.isPresenting;
    if (app.live) { const d = new Date(); app.atmo.hour = d.getHours() + d.getMinutes() / 60; }
    else if (app.timeLapse) app.atmo.hour = (app.atmo.hour + dt / 60) % 24;
    let eye;
    if (xrOn) { app.xr.update(dt); eye = app.xr.cam.getWorldPosition(new THREE.Vector3()); app.atmo.update(dt, eye); cullVR(eye, dt); }
    else {
      app.controls.update(dt); eye = camera.position;
      // tight, altitude-aware depth range: near grows with height so depth precision stays high
      const alt = Math.max(0.5, eye.y - floorAt(eye.x, eye.z, eye.y));
      const near = app.controls.mode === 'walk' ? 0.2 : Math.min(40, Math.max(0.35, alt * 0.012));
      if (Math.abs(near - camera.near) > camera.near * 0.08) { camera.near = near; camera.updateProjectionMatrix(); }
      app.atmo.update(dt, app.controls.focus);
    }
    app.veg.update(eye);
    app.life.update(dt, eye);
    app.landmarks.update(U.uTime.value, dt);
    app.atmo.weatherFx.mesh.position.set(0, 0, 0);
    renderer.info.reset();
    if (!xrOn) app.mirror.update(camera);
    if (xrOn) renderer.render(scene, app.xr.cam);
    else if ((app.Q || QUALITY.high).bloom) composer.render(); else renderer.render(scene, camera);
    // sound + bells on the hour near the basilica
    const alt = eye.y - terrainH(eye.x, -eye.z);
    app.sound.update(alt, app.atmo.weather, U.uNight.value);
    const hr = Math.floor(app.atmo.hour);
    if (hr !== lastBellHour) { if (lastBellHour >= 0) app.sound.bell(); lastBellHour = hr; }
    // stats + adaptive quality (desktop): steps down resolution / bloom, never the anti-flicker rules
    frames++; acc += dt; statT += dt;
    if (statT > 0.5) {
      const fps = frames / acc, ms = 1000 * acc / frames; frames = 0; acc = 0; statT = 0;
      fpsHist.push(fps); if (fpsHist.length > 6) fpsHist.shift();
      const info = renderer.info.render;
      $('#fps').textContent = fps.toFixed(0);
      app.ui.stats({
        FPS: fps.toFixed(0), 'Frame': ms.toFixed(1) + ' ms', 'Draw calls': info.calls, Triangles: (info.triangles / 1e6).toFixed(2) + ' M',
        Buildings: STATS.buildings.toLocaleString(), 'Boxes': STATS.boxes.toLocaleString(), Trees: app.veg.counts.total.toLocaleString(),
        Cars: (app.life.cars.length + app.life.bridgeCars.length), People: app.life.pedMesh.count, Stairs: STATS.stairs.toLocaleString(),
        'Overlap audit': audit === 0 ? '0 ✓' : audit + ' ✗', 'Depth range': `${camera.near.toFixed(2)} – ${camera.far.toFixed(0)} m`,
        Quality: app.qualityName + (xrOn ? ' (VR)' : ''),
      });
      if (!xrOn && !app.controls.tour && fpsHist.length === 6) {
        const avg = fpsHist.reduce((a, b) => a + b) / 6;
        if (avg < 38) { slow++; if (slow > 3) { slow = 0; fpsHist.length = 0; adaptDown(); } } else slow = 0;
      }
    }
    if (!xrOn) app.ui.frame(camera, app.state());
  };
  app.frame = frame;
  renderer.setAnimationLoop(params.has('manual') ? null : frame);
  // VR: tiles beyond the fog wall are not drawn at all (the fog is fully opaque there)
  let cullT = 0;
  const cullSets = () => [...app.city.group.children, ...app.terrain.tiles, ...app.terrain.canopies];
  function cullVR(eye, dt) {
    cullT -= dt; if (cullT > 0) return; cullT = 0.4;
    const D = app.xr.fast ? 2600 : 4200;
    app.atmo.fogMul = app.xr.fast ? 3.2 : 2.1;
    for (const m of cullSets()) {
      const s = m.geometry.boundingSphere; if (!s) continue;
      const dx = m.position.x + s.center.x - eye.x, dz = m.position.z + s.center.z - eye.z;
      m.visible = Math.hypot(dx, dz) - s.radius < D;
    }
    app.atmo.sun.castShadow = app.atmo.sun.castShadow && !app.xr.fast;
  }
  app.uncull = () => { for (const m of cullSets()) m.visible = true; };
  function adaptDown() {
    const pr = renderer.getPixelRatio();
    if (pr > 1.01) { renderer.setPixelRatio(Math.max(1, pr * 0.8)); onResize(); app.ui.toast('Lowering resolution to keep it smooth'); return; }
    if (app.qualityName === 'ultra') { app.setQuality('high'); app.ui.markSeg('#qualSeg', 'high'); app.ui.toast('Switched to High quality for smoother frames'); return; }
    if (app.qualityName === 'high') { app.setQuality('low'); app.ui.markSeg('#qualSeg', 'low'); app.ui.toast('Switched to Low quality for smoother frames'); }
  }
  if (params.has('tour')) app.startTour(+params.get('tour') || 0);
}
boot().catch((e) => { console.error(e); const m = document.querySelector('#loadMsg'); if (m) m.textContent = 'Error: ' + e.message; });
