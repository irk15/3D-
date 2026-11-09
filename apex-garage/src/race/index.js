// APEX // RACE: orchestrates tracks, vehicles, physics, AI, effects, HUD, replays and online play.
import * as THREE from 'three';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { TRACKS, buildTrack, glowTex, hdr } from './tracks.js';
import { createParams, newState, bodyMotion, HANDLING } from './physics.js';
import { makeBrain, aiInput, mulberry } from './ai.js';
import { placeOnGrid, advance, contact, draftFactor, standings, resetToTrack } from './sim.js';
import { createFx } from './fx.js';
import { createSfx } from './sfx.js';
import { createHud, fmt } from './hud.js';
import * as Input from './input.js';
import { createGradePass, createReflections, contactShadow } from './post.js';
import { registerScreen } from '../ui/focus.js';

const STEP = 1 / 240;
const clamp = THREE.MathUtils.clamp, lerp = THREE.MathUtils.lerp;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const COLORS = ['#ff4d6d', '#ffd23f', '#7cff3a', '#b28dff', '#ff8a3d', '#4dd2ff', '#ff66c4', '#c6ff1a'];
const CAMS = ['Chase', 'Far chase', 'Hood', 'Bumper', 'TV'];
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* full or blocked */ } }
};

const RadialBlur = {
  uniforms: { tDiffuse: { value: null }, strength: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float strength; varying vec2 vUv;
    void main(){ vec2 d = vec2(0.5, 0.52) - vUv; float w = smoothstep(0.12, 0.7, length(d)) * strength;
      vec4 c = vec4(0.0); for (int i = 0; i < 8; i++) { c += texture2D(tDiffuse, vUv + d * w * float(i) / 8.0); }
      gl_FragColor = c / 8.0; }`
};

export function createRace(ctx) {
  const { renderer, composer, renderPass, bloom, audio, CARS, loadCar, computeStats, onExit, openOptions } = ctx;
  const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.25, 2400);
  const blur = new ShaderPass(RadialBlur);
  blur.enabled = false;
  composer.insertPass(blur, 1);
  const grade = createGradePass();
  composer.addPass(grade);
  const refl = createReflections(renderer);
  const sfx = createSfx(audio);
  const hud = createHud(onAction, Input.touch);
  const api = { active: false, start, stop, update, resize, camera, autopilot: false, debug };
  api._dbg = { get grade() { return grade; }, get refl() { return refl; }, get hud() { return hud; } };

  let W = null; // world: { track, scene, fx }
  let racers = [], me = null, opts = null, room = null;
  const race = { phase: 'idle', time: 0, countStart: 0, paused: false, endT: 0, lastBeep: 9, finishOrder: [] };
  let camMode = store.get('apex-cam', 0), trauma = 0, shakeT = 0, quality = 2, acc = 0, alpha = 1, hitStop = 0, flash = 0, fovKick = 0, prevNitro = false;
  const S = Input.settings;
  const addTrauma = (x) => { trauma = Math.min(1, trauma + x); };

  /* ───────── input (action map + rebinding live in input.js) ───────── */
  const rumble = (a, b, ms) => Input.rumble(a, b, ms);
  // free-look: right stick or mouse drag orbits the chase camera, springs back on release
  const freeLook = { yaw: 0, pitch: 0, drag: false, lx: 0, ly: 0 };
  renderer.domElement.addEventListener('pointerdown', (e) => { if (api.active && e.pointerType === 'mouse') { freeLook.drag = true; freeLook.lx = e.clientX; freeLook.ly = e.clientY; } });
  addEventListener('pointermove', (e) => { if (!freeLook.drag) return; freeLook.yaw = clamp(freeLook.yaw - (e.clientX - freeLook.lx) * 0.006, -Math.PI, Math.PI); freeLook.pitch = clamp(freeLook.pitch + (e.clientY - freeLook.ly) * 0.004, -0.3, 0.6); freeLook.lx = e.clientX; freeLook.ly = e.clientY; });
  addEventListener('pointerup', () => { freeLook.drag = false; });
  const keysLine = () => {
    const P = Input.prompt;
    return me?.p.bike
      ? `${P('throttle')} throttle · ${P('brake')} brake · ${P('left')}/${P('right')} lean · ${P('hand')} rear brake · ${P('nitro')} nitro · ${P('camera')} camera · ${P('back')} look back · ${P('reset')} reset · ${P('pause')} pause`
      : `${P('throttle')} gas · ${P('brake')} brake · ${P('left')}/${P('right')} steer · ${P('hand')} handbrake/drift · ${P('nitro')} nitro${opts?.transmission === 'manual' ? ` · ${P('down')}/${P('up')} shift` : ''} · ${P('camera')} camera · ${P('back')} look back · ${P('pause')} pause`;
  };
  Input.onDevice(() => { if (api.active) hud.setKeys(keysLine()); });
  registerScreen({ el: () => hud.el.querySelector('#rPause'), open: () => api.active && hud.el.querySelector('#rPause').classList.contains('show'), back: () => setPaused(false) });
  registerScreen({ el: () => hud.el.querySelector('#rResult'), open: () => api.active && hud.el.querySelector('#rResult').classList.contains('show'), back: () => {} });
  function cycleCam() { camMode = (camMode + 1) % CAMS.length; store.set('apex-cam', camMode); hud.camName(CAMS[camMode]); hud.msg(CAMS[camMode].toUpperCase(), 0.7); }

  /* ───────── vehicles ───────── */
  const ghostMat = new THREE.MeshBasicMaterial({ color: hdr('#5fd8ff', 0.9), transparent: true, opacity: 0.22, depthWrite: false });

  function makeVisual(entry, { ghost = false, paintColor: color = null, headlight = false } = {}) {
    const root = new THREE.Group(), body = new THREE.Group();
    const model = entry.group.clone(true);
    model.position.set(0, 0, 0); model.rotation.set(0, 0, 0);
    let paint = entry.paint;
    if (color && !ghost && color.toLowerCase() !== '#' + entry.paint.color.getHexString()) { paint = entry.paint.clone(); paint.color.set(color); }
    model.traverse((o) => {
      if (!o.isMesh) return;
      if (ghost) { o.material = ghostMat; o.castShadow = false; return; }
      if (paint !== entry.paint) o.material = Array.isArray(o.material) ? o.material.map((m) => (m === entry.paint ? paint : m)) : o.material === entry.paint ? paint : o.material;
    });
    body.add(model); root.add(body);
    const sz = entry.size, bike = entry.cfg.type === 'bike';
    if (!ghost) root.add(contactShadow(sz, bike));
    const brakes = [], flames = [];
    if (!ghost) {
      // no glow cards: real lights only (road beam + brake glow), so nothing floats in front of the bodywork
      const fm = new THREE.SpriteMaterial({ map: glowTex, color: hdr('#4fb4ff', 5), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
      for (const s of bike ? [0.12] : [-1, 1]) {
        const f = new THREE.Sprite(fm); f.position.set(s * sz.x * (bike ? 1 : 0.18), sz.y * (bike ? 0.4 : 0.28), -sz.z * 0.53); f.scale.set(0.6, 0.6, 1); body.add(f); flames.push(f);
      }
      if (headlight) {
        // beam starts just ahead of the bumper so it lights the road, not the car's own bonnet
        const spot = new THREE.SpotLight(0xeaf1ff, 260, 120, 0.46, 0.6, 1.25);
        spot.position.set(0, bike ? 0.9 : 0.62, sz.z * 0.5 + 0.35); spot.target.position.set(0, 0, sz.z * 0.5 + 28);
        body.add(spot, spot.target);
        const brake = new THREE.PointLight(0xff1a1a, 0, 7, 1.6);
        brake.position.set(0, 0.55, -sz.z * 0.5 - 0.6);
        body.add(brake);
        brakes.push(brake);
      }
    }
    const wheels = [];
    model.traverse((o) => { if (/^wheel_(fl|fr|rl|rr)$/.test(o.name)) { o.rotation.order = 'YXZ'; wheels.push(o); } });
    return { root, body, brakes, flames, wheels };
  }

  function makeRacer(entry, o) {
    const cfg = entry.cfg;
    const stats = computeStats(cfg);
    const vis = makeVisual(entry, o);
    const r = {
      id: o.id, label: o.label, name: o.name || `${cfg.make} ${cfg.name}`, cfg, entry, sz: entry.size,
      isPlayer: !!o.isPlayer, isBot: !!o.isBot, isRemote: !!o.isRemote, ghost: !!o.ghost, color: o.color || COLORS[0],
      st: newState(),
      p: createParams(cfg, stats, { handling: o.isPlayer ? opts.handling : 'sport', wet: opts.weather === 'rain', auto: o.isPlayer ? opts.transmission !== 'manual' : true, ai: !o.isPlayer }),
      brain: o.isBot || o.isPlayer ? makeBrain(o.seed || 1, o.isPlayer ? 'hard' : opts.difficulty) : null,
      ...vis, buf: [], nitro: 1, lastSend: 0, idx: 0, lap: 0, progress: -1e9, lapTimes: [], bestLap: Infinity, lapStartT: 0
    };
    W.scene.add(r.root);
    return r;
  }

  /* ───────── world ───────── */
  async function start(o) {
    opts = { mode: 'race', track: 'downtown', laps: 3, bots: 5, difficulty: 'normal', weather: 'clear', handling: 'sport', transmission: 'auto', ...o };
    if (opts.mode !== 'race') opts.bots = 0;
    room = opts.mp?.room || null;
    const vIndex = opts.vehicle;
    const def = TRACKS.find((t) => t.id === opts.track) || TRACKS[0];
    // build or reuse track
    if (!W || W.track.def.id !== def.id) {
      if (W) { W.track.dispose(); }
      const track = buildTrack(def, renderer);
      W = { track, scene: track.scene, fx: createFx(track.scene) };
    }
    for (const r of racers) W.scene.remove(r.root);
    racers = [];
    W.track.setWet(opts.weather === 'rain');
    W.fx.clear();
    W.fx.setRain(opts.weather === 'rain');
    const seed = opts.mp?.seed || (Math.random() * 1e9) | 0;
    const rnd = mulberry(seed);

    // grid
    const entries = new Map();
    const need = new Set([vIndex]);
    let grid;
    if (room) {
      grid = opts.mp.grid; // [{id, veh, name, bot, color}]
      grid.forEach((g) => need.add(g.veh));
    } else {
      const pool = CARS.map((_, i) => i).filter((i) => i !== vIndex);
      for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
      const bots = Array.from({ length: Math.min(opts.bots, 7) }, (_, i) => pool[i % pool.length]);
      grid = bots.map((v, i) => ({ id: 'bot' + i, veh: v, bot: true }));
      grid.push({ id: 'me', veh: vIndex, me: true });
      bots.forEach((v) => need.add(v));
    }
    await Promise.all([...need].map(async (i) => entries.set(i, await loadCar(i))));
    const myId = room ? room.myId : 'me';
    grid.forEach((g, slot) => {
      const isMe = g.id === myId;
      const isBot = !!g.bot;
      const local = isMe || (isBot && (!room || room.isHost));
      const cfg = CARS[g.veh];
      const r = makeRacer(entries.get(g.veh), {
        id: g.id, isPlayer: isMe, isBot: isBot && local, isRemote: !local, color: isMe ? '#00e5ff' : COLORS[slot % COLORS.length],
        label: isMe ? 'YOU' : g.name || cfg.name.toUpperCase(), name: g.name, seed: seed + slot * 131, headlight: isMe,
        paintColor: g.color
      });
      r.slot = slot;
      placeOnGrid(r, W.track, slot);
      racers.push(r);
      if (isMe) me = r;
    });
    // ghost (time trial)
    ghost = null;
    if (opts.mode === 'tt') {
      const g = store.get(ghostKey(), null);
      if (g?.d?.length) {
        const gr = makeRacer(me.entry, { id: 'ghost', ghost: true, label: 'GHOST', color: '#5fd8ff' });
        gr.ghostData = g; ghost = gr; racers.push(gr);
      }
    }
    bestSplits = store.get(splitKey(), null);
    // HUD + state
    const humans = racers.filter((r) => !r.ghost).length;
    hud.setup({
      track: W.track, mode: opts.mode, laps: opts.laps, total: humans,
      keys: keysLine(),
      assists: `${HANDLING[opts.handling].label.toUpperCase()} · ${opts.transmission === 'manual' ? 'MANUAL' : 'AUTO'}${opts.weather === 'rain' ? ' · WET' : ''}`
    });
    hud.camName(CAMS[camMode]);
    hud.setRestartAllowed(!room);
    hud.help(me.p.bike, opts.transmission === 'manual');
    Object.assign(race, { phase: 'countdown', time: 0, paused: false, endT: 0, lastBeep: 9, finishOrder: [], countStart: performance.now() });
    race.startAt = room ? opts.mp.startAt : null;
    lapTrace = new Float32Array(W.track.N).fill(-1);
    rec.length = 0; recT = 0; ghostRec = [];
    score = { total: 0, chain: 0, combo: 1, gap: 0, lastEnd: -9, cleanLap: true };
    drafting = 0; lastPos = 99;
    api.active = true;
    hud.show(true);
    renderPass.scene = W.scene;
    renderPass.camera = camera;
    camera.fov = 62;
    resize();
    camOff.set(0, 0, 0);
    W.envStatic ||= W.scene.environment;
    grade.setTheme(W.track.def.theme); grade.enabled = true;
    applySettings();
    race.introDur = room ? 1.6 : 2.8; race.countLen = room ? 3.5 : 6.2; race.intro = 0;
    trauma = 0; hitStop = 0; flash = 0; freeLook.yaw = freeLook.pitch = 0;
    updateCamera(0, true);
    audio.setCar(me.cfg.engine);
    if (room) bindRoom();
  }

  function stop(toLobby = false) {
    if (!api.active) return;
    api.active = false;
    hud.show(false);
    hud.replay(false);
    blur.enabled = false;
    grade.enabled = false;
    W.scene.environment = W.envStatic;
    sfx.silence();
    document.getElementById('speedlines').style.opacity = 0;
    for (const r of racers) W.scene.remove(r.root);
    racers = [];
    if (room) unbindRoom();
    race.phase = 'idle';
    onExit({ toLobby, room });
  }

  /* ───────── online ───────── */
  let roomOff = [];
  function bindRoom() {
    const on = (t, f) => { room.on(t, f); roomOff.push([t, f]); };
    on('st', (pk) => {
      for (const s of pk.list || [pk]) {
        const r = racers.find((q) => q.id === s.id);
        if (!r || !r.isRemote) continue;
        r.buf.push(s);
        if (r.buf.length > 40) r.buf.shift();
      }
    });
    on('fin', (m) => {
      const r = racers.find((q) => q.id === m.id);
      if (r && !r.finished) { r.finished = true; r.finishTime = m.time; r.bestLap = m.best || Infinity; race.finishOrder.push(r); if (r !== me) hud.pop(`${r.label} FINISHED P${race.finishOrder.length}`, 'info'); }
    });
    on('end', () => { if (api.active) stop(true); });
    on('closed', () => { if (api.active) { hud.msg('HOST LEFT THE ROOM', 3); setTimeout(() => stop(false), 2500); } });
    on('left-player', (p) => { const r = racers.find((q) => q.id === p.id); if (r) { r.root.visible = false; r.left = true; hud.pop(`${p.name} LEFT`, 'info'); } });
  }
  function unbindRoom() {
    for (const [t, f] of roomOff) room.handlers[t] = (room.handlers[t] || []).filter((x) => x !== f);
    roomOff = [];
  }
  const pack = (r) => {
    const s = r.st;
    return { id: r.id, t: +race.time.toFixed(3), d: [+s.x.toFixed(2), +s.y.toFixed(2), +s.z.toFixed(2), +s.h.toFixed(4), +s.u.toFixed(2), +s.vx.toFixed(2), +s.vz.toFixed(2), +s.steer.toFixed(2), +(s.lean || s.rollV || 0).toFixed(3), +s.pitch.toFixed(3), Math.round(s.rpm), s.gear, s.nitroOn ? 1 : 0, r.lap, r.idx, s.crashT > 0 ? 1 : 0, +s.slip.toFixed(2)] };
  };
  let sendT = 0;
  function netSend(dt) {
    if (!room) return;
    sendT += dt;
    if (sendT < 0.05) return;
    sendT = 0;
    const list = [pack(me)];
    if (room.isHost) for (const r of racers) if (r.isBot) list.push(pack(r));
    room.sendState({ list });
  }
  function netInterp(r) {
    const b = r.buf; if (!b.length) return;
    const tRender = race.time - 0.12;
    let i = b.length - 1;
    while (i > 0 && b[i - 1].t > tRender) i--;
    const B = b[i], A = b[Math.max(0, i - 1)];
    const s = r.st;
    let k = 0, ext = 0;
    if (B.t > A.t) k = clamp((tRender - A.t) / (B.t - A.t), 0, 1);
    if (tRender > B.t) ext = Math.min(tRender - B.t, 0.25);
    const a = A.d, d = B.d;
    s.x = lerp(a[0], d[0], k) + d[5] * ext; s.y = lerp(a[1], d[1], k); s.z = lerp(a[2], d[2], k) + d[6] * ext;
    s.h = a[3] + wrap(d[3] - a[3]) * k;
    s.u = d[4]; s.vx = d[5]; s.vz = d[6]; s.steer = d[7];
    if (r.p.bike) s.lean = lerp(a[8], d[8], k); else s.rollV = lerp(a[8], d[8], k);
    s.pitch = d[9]; s.rpm = d[10]; s.gear = d[11]; s.nitroOn = !!d[12]; s.slip = d[16];
    r.lap = d[13]; r.idx = d[14]; r.progress = r.lap * W.track.N + r.idx - W.track.N;
    s.wheelRot += (s.u / 0.34) * (1 / 60);
  }

  /* ───────── laps, splits, ghosts ───────── */
  let lapTrace, bestSplits = null, ghost = null, ghostRec = [], ghostT = 0;
  const trackKey = () => `${opts.track}-${me.cfg.id}-${opts.handling}`;
  const ghostKey = () => `apex-ghost-${trackKey()}`;
  const splitKey = () => `apex-split-${trackKey()}`;
  const bestKey = () => `apex-best-${trackKey()}`;
  function onLap(r) {
    const t = race.time;
    if (r.lap > 1) {
      const lt = t - r.lapStartT;
      r.lapTimes.push(lt);
      r.bestLap = Math.min(r.bestLap, lt);
      if (r === me) {
        const prevBest = store.get(bestKey(), Infinity) ?? Infinity;
        const isBest = lt < prevBest;
        if (isBest) {
          store.set(bestKey(), lt);
          bestSplits = Array.from(lapTrace);
          store.set(splitKey(), bestSplits.map((x) => +x.toFixed(2)));
          if (opts.mode === 'tt' && ghostRec.length) { store.set(ghostKey(), { lap: lt, d: ghostRec }); }
        }
        const left = opts.laps - r.lap + 1;
        hud.msg(`${isBest ? 'NEW BEST ' : ''}LAP ${fmt(lt)}${left === 1 ? ' · FINAL LAP' : ''}`, 2.2);
        if (score.cleanLap && opts.mode === 'race') { hud.pop('CLEAN LAP +NITRO', 'nos'); me.nitro = Math.min(1, me.nitro + 0.3); }
        sfx.beep(isBest ? 1320 : 990, 0.18, 0.15);
      }
    }
    r.lapStartT = t;
    if (r === me) {
      lapTrace.fill(-1); ghostRec = []; ghostT = 0; score.cleanLap = true;
      if (ghost) ghost.ghostData = store.get(ghostKey(), ghost.ghostData);
    }
    if (r.lap > opts.laps && !r.finished && opts.mode !== 'tt') {
      r.finished = true; r.finishTime = t;
      race.finishOrder.push(r);
      if (r === me) finish();
    }
  }
  const hooks = {
    onLap,
    onRespawn: (r) => { if (r === me) hud.msg('BACK ON TRACK', 0.8); }
  };

  /* ───────── scoring (drifts, drafting, overtakes) ───────── */
  let score, drafting = 0, lastPos = 99;
  function scoreStep(dt) {
    const s = me.st;
    const ang = Math.abs(s.beta), spd = Math.abs(s.u);
    if (ang > 0.2 && spd > 14 && !me.p.bike) {
      score.chain += dt * (ang * 57) * spd * 0.9 * score.combo;
      score.gap = 0;
    } else if (score.chain > 0) {
      score.gap += dt;
      if (score.gap > 0.7) {
        const pts = Math.round(score.chain);
        score.total += pts;
        if (pts > 150) {
          hud.pop(`DRIFT +${pts.toLocaleString()}${score.combo > 1 ? ` ×${score.combo.toFixed(1)}` : ''}`, 'drift');
          me.nitro = Math.min(1, me.nitro + Math.min(0.35, pts / 9000));
          score.combo = Math.min(5, score.combo + 0.5);
          score.lastEnd = race.time;
        }
        score.chain = 0;
      }
    }
    if (race.time - score.lastEnd > 3 && score.chain === 0) score.combo = 1;
    // drafting
    if (s.draft > 0.45) { drafting += dt; me.nitro = Math.min(1, me.nitro + dt * 0.05); if (drafting > 0.8 && !score.draftShown) { hud.pop('SLIPSTREAM', 'draft'); score.draftShown = true; } }
    else { drafting = 0; score.draftShown = false; }
    // wheelies
    if (me.p.bike && s.wheelie > 0.15 && spd > 10) { score.wheelie = (score.wheelie || 0) + dt; if (score.wheelie > 1.2 && !score.wShown) { hud.pop('WHEELIE +NITRO', 'drift'); me.nitro = Math.min(1, me.nitro + 0.08); score.wShown = true; } }
    else { score.wheelie = 0; score.wShown = false; }
  }

  /* ───────── replay ───────── */
  const rec = []; let recT = 0;
  const replay = { t: 0, speed: 1, playing: true, focus: 0, tv: true, end: 0 };
  function record(dt) {
    recT += dt;
    if (recT < 1 / 30) return;
    recT = 0;
    if (rec.length > 30 * 60 * 12) return;
    rec.push({ t: race.time, s: racers.map((r) => [r.st.x, r.st.y, r.st.z, r.st.h, r.st.pitch, r.p.bike ? r.st.lean : r.st.rollV || 0, r.st.steer, r.st.wheelRot, r.st.nitroOn ? 1 : 0, r.st.u]) });
  }
  function replayApply() {
    let i = 0;
    while (i < rec.length - 2 && rec[i + 1].t < replay.t) i++;
    const A = rec[i], B = rec[Math.min(i + 1, rec.length - 1)];
    const k = B.t > A.t ? clamp((replay.t - A.t) / (B.t - A.t), 0, 1) : 0;
    racers.forEach((r, j) => {
      const a = A.s[j], b = B.s[j]; if (!a) return;
      const s = r.st;
      s.x = lerp(a[0], b[0], k); s.y = lerp(a[1], b[1], k); s.z = lerp(a[2], b[2], k);
      s.h = a[3] + wrap(b[3] - a[3]) * k; s.pitch = lerp(a[4], b[4], k);
      if (r.p.bike) s.lean = lerp(a[5], b[5], k); else s.rollV = lerp(a[5], b[5], k);
      s.steer = b[6]; s.wheelRot = lerp(a[7], b[7], k); s.nitroOn = !!b[8]; s.u = b[9];
      r.idx = W.track.nearest(s.x, s.z, r.idx, 80);
    });
  }

  /* ───────── race flow ───────── */
  function setPaused(p) {
    if (race.phase === 'idle') return;
    race.paused = p && !room; // online races keep running
    hud.pause(p);
    if (p) sfx.silence();
  }
  function finish() {
    race.phase = 'finished';
    race.endT = 0;
    const place = standings(racers).indexOf(me) + 1;
    if (opts.mode === 'race') hud.msg(place === 1 ? 'YOU WIN!' : `FINISHED P${place}`, 3);
    else if (opts.mode === 'drift') hud.msg(`SCORE ${Math.round(score.total + score.chain).toLocaleString()}`, 3);
    sfx.beep(880, 0.4, 0.25);
    if (room) room.sendFinish({ id: me.id, time: me.finishTime, best: isFinite(me.bestLap) ? me.bestLap : 0 });
    rumble(0.4, 0.6, 400);
  }
  function showResults() {
    const st = standings(racers);
    if (opts.mode === 'drift') {
      const total = Math.round(score.total);
      const best = store.get(`apex-drift-${opts.track}`, 0);
      if (total > best) store.set(`apex-drift-${opts.track}`, total);
      hud.results({ title: 'DRIFT ATTACK', sub: total > best ? 'NEW RECORD!' : `Record: ${best.toLocaleString()}`, cols: ['', 'SCORE'], rows: [{ me: true, cells: ['Total', total.toLocaleString()] }, { cells: ['Best lap', fmt(me.bestLap)] }], canRestart: true });
      return;
    }
    if (opts.mode === 'tt') {
      hud.results({ title: 'TIME TRIAL', sub: `Personal best: ${fmt(store.get(bestKey(), Infinity))}`, cols: ['LAP', 'TIME'], rows: me.lapTimes.map((t, i) => ({ me: t === me.bestLap, cells: [`Lap ${i + 1}`, fmt(t)] })), canRestart: true });
      return;
    }
    const place = st.indexOf(me) + 1;
    hud.results({
      title: place === 1 ? '🏆 VICTORY' : `FINISHED P${place}`,
      sub: `${W.track.def.name} · ${opts.laps} laps · ${HANDLING[opts.handling].label}`,
      cols: ['POS', 'DRIVER', 'VEHICLE', 'TIME', 'BEST LAP'],
      rows: st.map((r, i) => ({ me: r === me, cells: [i + 1, r === me ? 'YOU' : r.label, `${r.cfg.make} ${r.cfg.name}`, r.finished ? fmt(r.finishTime) : r.left ? 'LEFT' : 'RACING…', fmt(r.bestLap)] })),
      canRestart: !room
    });
  }
  function onAction(a, el) {
    if (a === 'resume') setPaused(false);
    if (a === 'restart' && !room) { hud.hideResults(); hud.pause(false); start({ ...opts }); }
    if (a === 'camera') cycleCam();
    if (a === 'options') openOptions?.();
    if (a === 'exit') {
      if (room && room.isHost && race.phase === 'finished') room.endRace();
      stop(!!room);
    }
    if (a === 'replay') { if (rec.length < 10) return; race.phase = 'replay'; replay.t = 0; replay.end = rec[rec.length - 1].t; replay.playing = true; replay.speed = 1; replay.focus = racers.indexOf(me); hud.hideResults(); hud.replay(true); }
    if (a === 'rp-exit') { hud.replay(false); race.phase = 'finished'; race.endT = 99; showResults(); }
    if (a === 'rp-play') { replay.playing = !replay.playing; el.textContent = replay.playing ? '❚❚' : '▶'; }
    if (a === 'rp-slow') replay.speed = replay.speed === 0.5 ? 1 : 0.5;
    if (a === 'rp-fast') replay.speed = replay.speed === 2 ? 1 : 2;
    if (a === 'rp-focus') { do { replay.focus = (replay.focus + 1) % racers.length; } while (racers[replay.focus].ghost); }
    if (a === 'rp-cam') { replay.tv = !replay.tv; el.textContent = replay.tv ? 'TV cam' : 'Chase cam'; }
    if (a === 'rp-seek') replay.t = (el.value / 1000) * replay.end;
  }

  /* ───────── camera ───────── */
  const camOff = new THREE.Vector3(), look = new THREE.Vector3(), dir = new THREE.Vector3(), want = new THREE.Vector3(), up = new THREE.Vector3();
  let tvSpot = null;
  const camState = {};
  function updateCamera(dt, snap = false, target = me, forceMode = null) {
    const r = target, s = r.vis && race.phase !== 'replay' ? Object.assign(camState, r.st, r.vis) : r.st;
    const sh = Math.sin(s.h), ch = Math.cos(s.h);
    const spd = Math.hypot(s.vx, s.vz);
    const intro = race.phase === 'countdown' && race.intro < race.introDur && !forceMode;
    const mode = forceMode ?? (intro ? 'intro' : race.phase === 'finished' && race.endT < 3.2 ? 'orbit' : CAMS[camMode]);
    dir.set(sh, 0, ch);
    if (spd > 5 && s.u > 0) { want.set(s.vx / spd, 0, s.vz / spd); dir.lerp(want, r.p.bike ? 0.15 : 0.32).normalize(); }
    // look-ahead: lead the camera into the corner using the yaw rate (+ free-look)
    const lead = clamp((s.r || 0) * 0.17, -0.22, 0.22) + freeLook.yaw;
    if (lead) { const c = Math.cos(lead), n = Math.sin(lead), x = dir.x; dir.x = x * c + dir.z * n; dir.z = dir.z * c - x * n; }
    let roll = 0, fovBase = 62;
    const back = !!lastInp?.back;
    if (mode === 'intro') {
      // cinematic grid flyby: sweep from a high front-quarter shot down to the chase position
      const k = clamp(race.intro / race.introDur, 0, 1), e = k * k * (3 - 2 * k);
      const th = lerp(Math.PI * 0.8, 0, e), rad = lerp(18, 6.3, e), hgt = lerp(8, 2.0, e);
      const bx = -dir.x, bz = -dir.z, c = Math.cos(th), n = Math.sin(th);
      camera.position.set(s.x + (bx * c + bz * n) * rad, s.y + hgt, s.z + (bz * c - bx * n) * rad);
      look.set(s.x + dir.x * lerp(0, 6, e), s.y + 1, s.z + dir.z * lerp(0, 6, e));
      fovBase = lerp(48, 62, e);
      camOff.set(camera.position.x - s.x, camera.position.y - s.y, camera.position.z - s.z);
    } else if (mode === 'orbit') {
      const a = race.time * 0.3;
      want.set(s.x + Math.cos(a) * 8.5, s.y + 2.4, s.z + Math.sin(a) * 8.5);
      look.set(s.x, s.y + 0.9, s.z);
      camera.position.copy(want);
    } else if (mode === 'TV') {
      const spots = W.track.camSpots;
      if (!tvSpot || snap || tvSpot.pos.distanceTo(want.set(s.x, s.y, s.z)) > 70) {
        let best = spots[0], bd = Infinity;
        for (const sp of spots) {
          const di = ((sp.i - r.idx + W.track.N) % W.track.N) * W.track.SEG;
          if (di > 8 && di < bd) { bd = di; best = sp; }
        }
        tvSpot = best;
      }
      camera.position.copy(tvSpot.pos);
      look.set(s.x, s.y + 0.7, s.z);
      const dist = camera.position.distanceTo(look);
      fovBase = clamp(1400 / Math.max(dist, 8), 16, 55);
    } else if (mode === 'Hood' || mode === 'Bumper') {
      const fwd = mode === 'Hood' ? (r.p.bike ? -0.05 : 0.22) : 0.5;
      const hgt = mode === 'Hood' ? (r.p.bike ? 1.12 : r.sz.y * 0.82) : 0.55;
      if (r.p.bike) {
        // helmet cam: leans with the bike
        const ln = s.lean || 0;
        camera.position.set(s.x + sh * r.sz.z * fwd - ch * Math.sin(ln) * hgt * 0.9, s.y + hgt * Math.cos(ln), s.z + ch * r.sz.z * fwd + sh * Math.sin(ln) * hgt * 0.9);
        roll = ln * 0.85;
      } else camera.position.set(s.x + sh * r.sz.z * fwd, s.y + hgt, s.z + ch * r.sz.z * fwd);
      look.set(camera.position.x + sh * 30 * (back ? -1 : 1), camera.position.y - 0.4, camera.position.z + ch * 30 * (back ? -1 : 1));
      fovBase = mode === 'Hood' ? 72 : 78;
    } else {
      const far = mode === 'Far chase';
      const dist = (far ? 10.5 : r.p.bike ? 4.6 : 6.3) + spd * 0.022 + (s.nitroOn ? 0.8 : 0);
      const hgt = far ? 3.6 : r.p.bike ? 1.7 : 2.0;
      const dd = back ? -1 : 1;
      want.set(s.x - dir.x * dist * dd, s.y + hgt + freeLook.pitch * dist, s.z - dir.z * dist * dd);
      look.set(s.x + dir.x * 6 * dd, s.y + 1.0, s.z + dir.z * 6 * dd);
      const ox = want.x - s.x, oz = want.z - s.z;
      if (snap) camOff.set(ox, want.y - s.y, oz);
      else {
        const k = 1 - Math.exp(-(back ? 30 : 6.5) * dt);
        camOff.x = lerp(camOff.x, ox, k); camOff.z = lerp(camOff.z, oz, k);
        camOff.y = lerp(camOff.y, want.y - s.y, 1 - Math.exp(-4 * dt));
      }
      camera.position.set(s.x + camOff.x, s.y + camOff.y, s.z + camOff.z);
      if (r.p.bike) roll = (s.lean || 0) * 0.28;
    }
    // trauma shake: smooth sin-noise, quadratic falloff (impacts + a little speed/nitro rumble)
    const onCar = mode !== 'TV' && mode !== 'orbit' && mode !== 'intro';
    const tr = Math.min(1, trauma + (onCar ? clamp((spd * 3.6 - 230) / 200, 0, 0.2) + (s.nitroOn ? 0.14 : 0) : 0)) * S.shake;
    if (tr > 0.001) {
      const k = tr * tr; shakeT += dt * 30;
      camera.position.x += (Math.sin(shakeT * 1.7) * 0.2 + Math.sin(shakeT * 4.3) * 0.05) * k;
      camera.position.y += (Math.sin(shakeT * 2.3) * 0.14 + Math.sin(shakeT * 5.1) * 0.04) * k;
      roll += Math.sin(shakeT * 1.1) * 0.03 * k;
    }
    trauma = Math.max(0, trauma - dt * 1.3);
    // roll the camera (bike lean)
    up.set(0, 1, 0);
    if (roll) { const fx = look.x - camera.position.x, fz = look.z - camera.position.z, fl = Math.hypot(fx, fz) || 1; up.set((fz / fl) * Math.sin(roll), Math.cos(roll), (-fx / fl) * Math.sin(roll)); }
    camera.up.copy(up);
    camera.lookAt(look);
    if (s.nitroOn && !prevNitro) fovKick = 7;
    prevNitro = s.nitroOn; fovKick = Math.max(0, fovKick - dt * 9);
    const fov = !onCar ? fovBase : fovBase + (clamp(spd / r.p.vmax, 0, 1.1) * 14 + (s.nitroOn ? 6 : 0) + fovKick) * S.fovKick;
    camera.fov = snap ? fov : lerp(camera.fov, fov, 1 - Math.exp(-(mode === 'TV' ? 10 : 3) * dt));
    camera.updateProjectionMatrix();
    const sun = W.track.sun;
    sun.position.set(s.x + sun.userData.dir.x * 120, s.y + sun.userData.dir.y * 120, s.z + sun.userData.dir.z * 120);
    sun.target.position.set(s.x, s.y, s.z);
  }

  /* ───────── visuals ───────── */
  function syncVisual(r, dt) {
    const s = r.st;
    r.root.visible = r.ghost ? !!r.ghostVisible && race.phase === 'racing' : !r.left;
    let x = s.x, y = s.y, z = s.z, h = s.h;
    if (!r.isRemote && !r.ghost && race.phase !== 'replay' && r.px !== undefined) {
      // render between the last two physics steps (removes 240 Hz/display-rate beat jitter)
      x = lerp(r.px, s.x, alpha); y = lerp(r.py, s.y, alpha); z = lerp(r.pz, s.z, alpha); h = r.ph + wrap(s.h - r.ph) * alpha;
    }
    (r.vis ||= {}).x = x; r.vis.y = y; r.vis.z = z; r.vis.h = h;
    r.root.position.set(x, y, z);
    const slope = W.track.slope[r.idx] || 0;
    r.root.rotation.set(0, h, 0);
    let pitch, roll;
    if (!r.isRemote && race.phase !== 'replay') [pitch, roll] = bodyMotion(s, r.p, dt);
    else { pitch = s.pitch; roll = r.p.bike ? s.lean : s.rollV || 0; }
    const along = Math.cos(wrap(Math.atan2(W.track.T[r.idx].x, W.track.T[r.idx].z) - s.h));
    const trackPitch = -Math.atan(slope) * along;
    if (r.p.bike) {
      r.body.rotation.set(trackPitch - pitch, 0, -roll, 'YXZ');
      r.body.position.set(0, Math.sin(Math.abs(pitch)) * r.sz.z * 0.45, 0);
    } else {
      r.body.rotation.set(trackPitch + pitch, 0, -roll, 'YXZ');
      r.body.position.y = 0.03 + Math.abs(roll) * r.sz.x * 0.25;
    }
    for (const w of r.wheels) {
      w.rotation.x = (r.cfg.rotY ? -1 : 1) * s.wheelRot;
      if (/f[lr]$/.test(w.name)) w.rotation.y = s.delta || -s.steer * 0.4;
    }
    const nitro = s.nitroOn ? 1 : 0;
    for (const f of r.flames) { f.material.opacity = lerp(f.material.opacity, nitro, 0.35); const k = 0.55 + Math.random() * 0.5 * nitro; f.scale.set(k, k, 1); }
    const brk = r.isPlayer ? (lastInp?.brake || 0) : s.ax < -6 ? 1 : 0;
    for (const b of r.brakes) b.intensity = lerp(b.intensity, brk * 9, 0.4);
  }

  function effects(r, dt) {
    const s = r.st;
    if (r.ghost) return;
    const sh = Math.sin(s.h), ch = Math.cos(s.h);
    if (s.slip > 0.12 && Math.abs(s.u) > 3) {
      const heading = Math.atan2(s.vx, s.vz);
      const wheels = r.p.bike ? [0] : [-1, 1];
      for (const w of wheels) {
        const x = s.x - sh * r.sz.z * 0.32 - ch * w * r.sz.x * 0.4, z = s.z - ch * r.sz.z * 0.32 + sh * w * r.sz.x * 0.4;
        W.fx.skid(x, s.y, z, heading, r.p.bike ? 0.22 : 0.3);
        if (Math.random() < (r.isPlayer ? 0.3 : 0.1) * Math.min(1, (s.slip - 0.1) * 2.5) * (r.p.bike ? 0.4 : 1)) W.fx.smoke(x, s.y, z, s.vx, s.vz, (r.p.bike ? 0.4 : 0.6) + s.slip * 0.6);
      }
    }
    if (s.events) {
      const ex = s.x - sh * r.sz.z * 0.53, ez = s.z - ch * r.sz.z * 0.53;
      if (s.events & 1) { W.fx.flash(ex, s.y + r.sz.y * 0.3, ez, true); if (r.isPlayer) sfx.pop(true); }
      s.events = 0;
    }
    // lift-off crackle
    if (r.isPlayer) {
      if (s.throttle < 0.1 && (r.prevThrottle || 0) > 0.6 && s.rpm > r.p.redline * 0.6) r.crackle = 0.6;
      r.prevThrottle = s.throttle;
      if (r.crackle > 0) { r.crackle -= dt; if (Math.random() < dt * 14) { sfx.pop(false); W.fx.flash(s.x - sh * r.sz.z * 0.53, s.y + r.sz.y * 0.3, s.z - ch * r.sz.z * 0.53); } }
    }
  }

  /* ───────── quality ───────── */
  let fpsAcc = 0, fpsN = 0, lowFor = 0, highFor = 0;
  function setQuality(q) {
    quality = q;
    const pr = [0.85, 1, Math.min(devicePixelRatio, 1.5)][q];
    renderer.setPixelRatio(pr); composer.setPixelRatio(pr); composer.setSize(innerWidth, innerHeight);
    bloom.enabled = q > 0;
    if (W) W.track.sun.castShadow = q > 0;
  }
  function applySettings() {
    audio.setVolume(S.master * S.engine);
    sfx.setVolume(S.master * S.sfx);
    const fixed = { high: 2, medium: 1, low: 0 }[S.quality];
    setQuality(fixed ?? 2);
    if (api.active) hud.setKeys(keysLine());
  }
  api.applySettings = applySettings;
  function watchFps(dt) {
    fpsAcc += dt; fpsN++;
    if (S.quality !== 'auto') { if (fpsAcc >= 1) { api.fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; } return; }
    if (fpsAcc < 1) return;
    const fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0;
    api.fps = fps;
    if (fps < 48) { lowFor++; highFor = 0; } else if (fps > 58) { highFor++; lowFor = 0; } else { lowFor = highFor = 0; }
    if (lowFor >= 2 && quality > 0) { setQuality(quality - 1); lowFor = 0; }
    if (highFor >= 8 && quality < 2) { setQuality(quality + 1); highFor = 0; }
  }

  /* ───────── main update ───────── */
  let lastInp = null, tagT = 0;
  function update(dt) {
    if (!api.active) return;
    watchFps(dt);
    const inp = Input.poll();
    lastInp = inp;
    // edge-triggered actions
    if (inp.pressed.pause) {
      if (race.phase === 'replay') onAction('rp-exit');
      else if (!race.paused && race.phase !== 'finished') setPaused(true);
      else if (race.paused && Input.getDevice() === 'pad') setPaused(false);
    }
    if (race.phase === 'replay') return updateReplay(dt);
    if (race.paused) { updateCamera(0); return; }
    if (inp.pressed.camera) cycleCam();
    if (inp.pressed.reset && race.phase === 'racing') { resetToTrack(me, W.track, 0); me.px = undefined; hud.msg('RESET', 0.8); }
    // free-look from the right stick; springs back when released
    if (inp.look[0] || inp.look[1]) { freeLook.yaw = lerp(freeLook.yaw, -inp.look[0] * 2.6, 1 - Math.exp(-10 * dt)); freeLook.pitch = lerp(freeLook.pitch, inp.look[1] * 0.45, 1 - Math.exp(-10 * dt)); }
    else if (!freeLook.drag) { freeLook.yaw = lerp(freeLook.yaw, 0, 1 - Math.exp(-3.5 * dt)); freeLook.pitch = lerp(freeLook.pitch, 0, 1 - Math.exp(-3.5 * dt)); }
    // hit-stop: a few frames of slow motion on big impacts (real-time timer)
    const realDt = dt;
    if (hitStop > 0) { hitStop -= realDt; dt *= 0.12; }
    flash = Math.max(0, flash - realDt * 2.2);

    // steering smoothing (keyboard ramps, analog follows)
    const s = me.st;
    if (race.phase === 'finished' || api.autopilot) { /* autopilot steers */ }
    else if (inp.analog) s.steer = lerp(s.steer, inp.steer, 1 - Math.exp(-18 * dt));
    else {
      const toward = inp.steer !== 0 && Math.sign(inp.steer) === Math.sign(s.steer || inp.steer);
      const rate = ((inp.steer === 0 ? 12 : toward ? 7.5 : 14) * S.steerSpeed) / (1 + Math.max(0, s.u) / (me.p.bike ? 60 : 85));
      s.steer += clamp(inp.steer - s.steer, -rate * dt, rate * dt);
    }

    // countdown
    if (race.phase === 'countdown') {
      const left = race.startAt ? (race.startAt - room.hostNow()) / 1000 : race.countLen - (performance.now() - race.countStart) / 1000;
      race.intro = race.countLen - left;
      hud.title(race.intro < race.introDur ? W.track.def : null, opts);
      // F1-style start lights: five reds over the last 3 seconds, lights out = GO
      const lights = left > 3 ? 0 : Math.min(5, Math.floor((3 - left) / 0.6) + 1);
      if (lights !== race.lastBeep && lights > 0) { hud.lights(lights); sfx.beep(440, 0.12, 0.18); race.lastBeep = lights; }
      // free revving + launch control window
      const e = me.p;
      s.rpm = lerp(s.rpm, inp.gas ? e.redline * 0.95 : e.idle, 1 - Math.exp(-(inp.gas ? 1.6 : 4) * dt));
      for (const r of racers) if (r !== me && !r.isRemote) r.st.rpm = r.p.idle;
      if (left <= 0) {
        race.phase = 'racing'; race.time = 0;
        hud.lights('go'); hud.title(null); hud.count('GO!'); sfx.beep(880, 0.35); rumble(0.2, 0.4, 150);
        const k = s.rpm / e.redline;
        if (inp.gas && k > 0.6 && k < 0.82) { s.boostT = 1.4; hud.pop('PERFECT START', 'nos'); rumble(0.3, 0.8, 300); }
        else if (inp.gas && k >= 0.82) hud.pop('WHEELSPIN START', 'bad');
        setTimeout(() => hud.count(''), 800);
        setTimeout(() => hud.help(false, false, false), 2500);
      }
    } else race.time += dt;

    // physics (fixed step)
    if (race.phase === 'racing' || race.phase === 'finished') {
      acc = Math.min(acc + dt, 0.1);
      const lead = Math.max(...racers.filter((r) => !r.isBot && !r.ghost).map((r) => r.progress));
      while (acc >= STEP) {
        for (const r of racers) {
          if (r.isRemote || r.ghost) continue;
          let i;
          if (r === me) i = race.phase === 'finished' || api.autopilot ? aiInput(r, W.track, racers, race.time, lead, STEP, race.phase === 'finished') : inp;
          else i = r.finished ? aiInput(r, W.track, racers, race.time, lead, STEP, true) : aiInput(r, W.track, racers, race.time, lead, STEP);
          if (r !== me || race.phase === 'finished' || api.autopilot) r.st.steer += (i.steer - r.st.steer) * (1 - Math.exp(-12 * STEP));
          // nitro
          const wantN = i.nitro && r.nitro > 0.02 && r.st.u > 5 && r.st.crashT <= 0;
          r.st.nitroOn = wantN;
          if (wantN) r.nitro = Math.max(0, r.nitro - STEP * 0.2); else r.nitro = Math.min(1, r.nitro + STEP * 0.012);
          // unstick AI (and autopilot) cars that get pinned against a wall or another car
          if (r !== me || race.phase === 'finished' || api.autopilot) {
            r.stuckT = race.phase === 'racing' && Math.abs(r.st.u) < 2 && r.st.crashT <= 0 ? (r.stuckT || 0) + STEP : 0;
            if (r.stuckT > 3) { resetToTrack(r, W.track, 6); r.stuckT = 0; }
          }
          r.px = r.st.x; r.py = r.st.y; r.pz = r.st.z; r.ph = r.st.h;
          const ev = advance(r, W.track, i, STEP, hooks);
          if (ev && r === me) {
            const v = r.lastImpact || 0;
            if (ev === 2) { hud.msg('CRASH!', 1.6); sfx.impact(14); rumble(1, 1, 500); addTrauma(1); hitStop = 0.14; flash = 0.35; }
            else if (v > 2) { addTrauma(v * 0.045); if (v > 11) { hitStop = 0.07; flash = 0.12; } sfx.impact(v); rumble(v / 15, v / 10); score.cleanLap = false; if (score.chain > 0) { hud.pop('CHAIN LOST', 'bad'); score.chain = 0; score.combo = 1; } }
            if (v > 3) W.fx.sparks(r.st.x, r.st.y, r.st.z, r.st.vx, r.st.vz, Math.min(30, v * 2));
          }
          if (ev && r !== me && (r.lastImpact || 0) > 4) W.fx.sparks(r.st.x, r.st.y, r.st.z, r.st.vx, r.st.vz, 6);
        }
        // contact
        for (let a = 0; a < racers.length; a++) {
          const A = racers[a]; if (A.ghost || A.isRemote || A.left) continue;
          for (let b = 0; b < racers.length; b++) {
            const B = racers[b]; if (b === a || B.ghost || B.left) continue;
            if (!B.isRemote && b < a) continue;
            const hit = contact(A, B, B.isRemote);
            if (hit > 2) {
              if (A === me || B === me) { addTrauma(hit * 0.055); if (hit > 10) hitStop = 0.06; sfx.impact(hit); rumble(hit / 12, hit / 8); score.cleanLap = false; }
              W.fx.sparks((A.st.x + B.st.x) / 2, A.st.y, (A.st.z + B.st.z) / 2, A.st.vx, A.st.vz, Math.min(20, hit * 2));
              for (const R of [A, B]) if (R.p.bike && !R.isRemote && hit > 9 * R.p.H.crash && R.st.crashT <= 0) { R.st.crashT = 2; if (R === me) { hud.msg('CRASH!', 1.6); rumble(1, 1, 500); } }
            }
          }
        }
        acc -= STEP;
      }
      alpha = acc / STEP;
      for (const r of racers) if (!r.ghost && !r.isRemote) r.st.draft = draftFactor(r, racers);
      if (race.phase === 'racing') { scoreStep(dt); lapTrace[me.idx] = lapTrace[me.idx] < 0 ? race.time - me.lapStartT : lapTrace[me.idx]; }
      record(dt);
    }
    for (const r of racers) if (r.isRemote) netInterp(r);
    // ghost playback
    if (ghost && ghost.ghostData && race.phase === 'racing') {
      ghostT = race.time - me.lapStartT;
      const d = ghost.ghostData.d, i = Math.min(d.length - 1, Math.floor(ghostT / 0.05));
      const a = d[i], b = d[Math.min(d.length - 1, i + 1)], k = (ghostT / 0.05) - i;
      if (a && me.lap >= 1) {
        const g = ghost.st;
        g.x = lerp(a[0], b[0], k); g.y = lerp(a[1], b[1], k); g.z = lerp(a[2], b[2], k); g.h = a[3] + wrap(b[3] - a[3]) * k; g.rollV = a[4]; g.lean = a[4];
        ghost.idx = W.track.nearest(g.x, g.z, ghost.idx, 60);
        ghost.ghostVisible = ghostT < ghost.ghostData.lap;
      }
    }
    if (opts.mode === 'tt' && race.phase === 'racing' && me.lap >= 1) {
      if ((ghostRec.lastT ?? -1) + 0.05 <= race.time - me.lapStartT) { ghostRec.push([+s.x.toFixed(2), +s.y.toFixed(2), +s.z.toFixed(2), +s.h.toFixed(3), +((me.p.bike ? s.lean : s.rollV) || 0).toFixed(3)]); ghostRec.lastT = race.time - me.lapStartT; }
    }
    // standings + gaps
    const st = standings(racers);
    const pos = st.indexOf(me) + 1;
    if (race.phase === 'racing' && opts.mode === 'race') {
      if (pos < lastPos && lastPos !== 99 && race.time > 3) { hud.pop('OVERTAKE +NITRO', 'nos'); me.nitro = Math.min(1, me.nitro + 0.1); }
      lastPos = pos;
    }
    const leader = st[0];
    for (const r of st) {
      if (r === leader) { r.gapText = ''; continue; }
      const dLap = leader.lap - r.lap;
      r.gapText = r.finished ? fmt(r.finishTime) : dLap > 1 || (dLap === 1 && r.idx > leader.idx) ? `+${dLap}L` : `+${(((leader.progress - r.progress) * W.track.SEG) / Math.max(15, Math.abs(r.st.u))).toFixed(1)}`;
    }
    // finished: results after a beat
    if (race.phase === 'finished') { race.endT += dt; if (race.endT > 3.2 && !race.shown) { race.shown = true; showResults(); } if (race.shown && (tagT += dt) > 1 && standings(racers).some((r) => !r.finished && !r.left)) { tagT = 0; showResults(); } }
    else race.shown = false;
    // time trial / drift: end after laps
    if (opts.mode !== 'race' && race.phase === 'racing' && me.lap > opts.laps) { me.finished = true; me.finishTime = race.time; score.total += Math.round(score.chain); score.chain = 0; finish(); }

    for (const r of racers) { syncVisual(r, dt); effects(r, dt); }
    W.fx.update(dt, camera);
    updateCamera(dt);
    netSend(dt);
    updateTags();

    // audio
    const load = race.phase === 'countdown' ? (inp.gas ? 1 : 0.1) : me.st.throttle;
    audio.update(me.st.rpm, s.nitroOn ? 1 : load);
    sfx.update({ slip: s.slip, speed: Math.hypot(s.vx, s.vz), rain: opts.weather === 'rain', nitro: s.nitroOn });
    if (s.limiter && Math.random() < 0.3) rumble(0.05, 0.25, 60);

    // effects strength
    const kmh = Math.abs(s.u) * 3.6;
    blur.enabled = quality === 2 && S.blur > 0;
    blur.uniforms.strength.value = (clamp((kmh - 140) / 220, 0, 0.55) * 0.09 + (s.nitroOn ? 0.035 : 0)) * S.blur;
    const gu = grade.uniforms;
    gu.time.value = (gu.time.value + realDt) % 100;
    gu.ca.value = (clamp((kmh - 170) / 180, 0, 1) * 0.012 + (s.nitroOn ? 0.01 : 0)) * S.blur;
    gu.flash.value = flash;
    gu.grain.value = quality === 0 ? 0 : 0.03;
    // live reflections of the track on the cars (high quality)
    refl.enabled = quality === 2;
    if (refl.enabled) { refl.update(W.scene, me.root.position, racers.map((r) => r.root), W.envStatic); W.scene.environment = refl.texture; }
    else W.scene.environment = W.envStatic;
    document.getElementById('speedlines').style.opacity = clamp((kmh - 170) / 160, 0, 0.5) + (s.nitroOn ? 0.25 : 0);

    // HUD
    let delta = null;
    if (bestSplits && race.phase === 'racing' && me.lap >= 1) {
      const b = bestSplits[me.idx];
      if (b >= 0) delta = race.time - me.lapStartT - b;
    }
    const red = me.p.redline;
    const shiftLight = race.phase === 'countdown' ? (s.rpm / red > 0.6 && s.rpm / red < 0.82 ? 1 : s.rpm / red > 0.82 ? 0.99 : clamp((s.rpm / red) / 0.6 * 0.4, 0, 0.4)) : clamp((s.rpm / red - 0.72) / 0.24, 0, 1);
    hud.frame(dt, {
      mode: opts.mode, pos, lap: me.lap, laps: opts.laps, time: race.phase === 'countdown' ? 0 : me.finished ? me.finishTime : race.time,
      best: isFinite(me.bestLap) ? me.bestLap : store.get(bestKey(), Infinity), delta,
      kmh: S.units === 'mph' ? kmh * 0.621 : kmh, units: S.units, gear: race.phase === 'countdown' ? 'N' : s.gear === -1 ? 'R' : s.gear, rpm: s.rpm, redline: red, shiftLight, accent: '#00e5ff',
      nitro: me.nitro, nitroOn: s.nitroOn, score: score.total + score.chain, combo: score.combo, chain: score.chain,
      racers, me, standings: st,
      net: room ? `ROOM ${room.code} · ${room.isHost ? 'HOST' : `${Math.round(room.rtt || 0)} ms`}` : ''
    });
    // wrong way
    const t = W.track.T[me.idx];
    if (race.phase === 'racing' && s.u > 6 && t.x * Math.sin(s.h) + t.z * Math.cos(s.h) < -0.4) hud.msg('WRONG WAY', 0.3);
  }

  function updateReplay(dt) {
    if (replay.playing) replay.t = Math.min(replay.end, replay.t + dt * replay.speed);
    if (replay.t >= replay.end) replay.playing = false;
    replayApply();
    for (const r of racers) syncVisual(r, dt);
    W.fx.update(dt, camera);
    const f = racers[replay.focus] || me;
    updateCamera(dt, false, f, replay.tv ? 'TV' : 'Chase');
    hud.replayTime(replay.t, replay.t / replay.end);
    audio.update(f.st.rpm || f.p.idle, 0.3);
    blur.enabled = false;
  }

  /* ───────── name tags (online) ───────── */
  const tagPool = [];
  const tagWrap = document.createElement('div');
  tagWrap.id = 'nameTags';
  document.body.appendChild(tagWrap);
  const tv = new THREE.Vector3();
  function updateTags() {
    const show = !!room && race.phase !== 'replay';
    let n = 0;
    if (show) for (const r of racers) {
      if (r === me || r.ghost || r.left) continue;
      tv.set(r.st.x, r.st.y + r.sz.y + 0.7, r.st.z);
      const d = tv.distanceTo(camera.position);
      if (d > 140) continue;
      tv.project(camera);
      if (tv.z > 1) continue;
      const el = tagPool[n] || (tagPool[n] = tagWrap.appendChild(document.createElement('div')));
      el.textContent = r.label; el.style.display = 'block';
      el.style.transform = `translate(${(tv.x * 0.5 + 0.5) * innerWidth}px, ${(-tv.y * 0.5 + 0.5) * innerHeight}px) translate(-50%, -100%)`;
      el.style.borderColor = r.color; el.style.opacity = clamp(1.4 - d / 120, 0.3, 1);
      n++;
    }
    for (let i = n; i < tagPool.length; i++) tagPool[i].style.display = 'none';
  }

  function resize() { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
  function debug() {
    return { phase: race.phase, time: +race.time.toFixed(2), fps: api.fps, quality, score: Math.round(score?.total || 0),
      racers: racers.map((r) => ({ id: r.id, v: r.cfg.id, lap: r.lap, kmh: Math.round(r.st.u * 3.6), fin: r.finished ? +r.finishTime.toFixed(2) : 0, remote: r.isRemote, x: +r.st.x.toFixed(1), z: +r.st.z.toFixed(1) })) };
  }
  return api;
}
