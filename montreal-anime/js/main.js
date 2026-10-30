// main.js — Plateau · Montréal: boot, camera, input, interactions, time & seasons, audio, HUD.
import * as THREE from 'three';
import { h, U, whereIs, PARK, PLAZA, DETAIL, nsX, ewZ, nsHW, nsSW, ewHW, ewSW, alleyX, ALLEY_HW } from './layout.js';
import { Pipeline, makeSky, LAYER_FX } from './toon.js';
import { buildWorld } from './world.js';
import { makeCharacter, Player, Neighbours, Traffic, Pigeons, makeCat, Bagels } from './actors.js';

const $ = (s) => document.querySelector(s);
const params = new URLSearchParams(location.search);
const touch = matchMedia('(pointer: coarse)').matches;

// ---------------------------------------------------------------- looks for each time of day
const PRESETS = {
  day: { sun: [0.42, 0.78, 0.46], sunC: '#fff2dc', sunI: 2.7, sky: '#bfe0ff', gnd: '#dcc8a6', hemiI: 1.35, zen: '#3c9be8', hor: '#c4e9ff', fog: '#cfeaf8', cloud: '#ffffff', shade: '#b6c4ec', ink: '#1b1640', night: 0, cover: 0.42 },
  golden: { sun: [-0.78, 0.2, 0.42], sunC: '#ffad66', sunI: 3.0, sky: '#f7b9a4', gnd: '#6b5a8a', hemiI: 1.05, zen: '#6c84d8', hor: '#ffcf96', fog: '#f4c8a2', cloud: '#ffe6c8', shade: '#c886a8', ink: '#2a1638', night: 0.15, cover: 0.48 },
  night: { sun: [0.3, 0.62, -0.5], sunC: '#a9bcff', sunI: 1.0, sky: '#7088dc', gnd: '#34306a', hemiI: 1.7, zen: '#0f1d52', hor: '#3d5aa8', fog: '#2a3c78', cloud: '#4a5a92', shade: '#24306a', ink: '#070514', night: 1, cover: 0.35 },
};
const ORDER = ['day', 'golden', 'night'];
const SEASONS = ['summer', 'autumn', 'winter'];

async function boot() {
  try { await Promise.race([document.fonts.load('600 40px Fredoka'), new Promise((r) => setTimeout(r, 2500))]); } catch (e) { /* offline font */ }
  const app = window.app = { THREE, U };
  const pr = Math.min(window.devicePixelRatio || 1, touch ? 1.5 : 1.75);
  const renderer = new THREE.WebGLRenderer({ canvas: $('#gl'), antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(pr); renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.NoToneMapping;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(52, innerWidth / innerHeight, 0.25, 2600);
  camera.layers.enable(LAYER_FX);
  scene.fog = new THREE.Fog(0xcfeaf8, 150, 720);
  const sky = makeSky(); scene.add(sky);
  const sun = new THREE.DirectionalLight(0xffffff, 2.7); sun.castShadow = true;
  const SM = touch ? 2048 : 4096; sun.shadow.mapSize.set(SM, SM); Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 260 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.05;
  const hemi = new THREE.HemisphereLight(0xbfe0ff, 0xdcc8a6, 1.3);
  scene.add(sun, sun.target, hemi);
  Object.assign(app, { renderer, scene, camera, sun, hemi, sky });

  $('#loadMsg').textContent = 'On construit le Plateau…';
  await new Promise((r) => setTimeout(r, 30));
  const world = app.world = buildWorld(scene);
  const pipe = app.pipe = new Pipeline(renderer, scene, camera);

  // ---- characters
  const hero = makeCharacter({}); scene.add(hero.root);
  const player = app.player = new Player(world, hero);
  const npcs = app.npcs = new Neighbours(scene, world);
  const traffic = app.traffic = new Traffic(scene, world, world.glows);
  player.carBlock = (x, z) => traffic.blocks(x, z);
  const pigeons = new Pigeons(scene, world);
  // the cat waits on a balcony staircase landing on Rue Drolet
  const catSpot = world.spots.balcony.filter((s) => s.street === -1).sort((a, b) => Math.abs(a.z - 20) - Math.abs(b.z - 20))[0] || { x: -80, y: h(20) + 0.2, z: 20 };
  const cat = makeCat(scene, catSpot.x, catSpot.y, catSpot.z - 0.8);
  const bagelSpots = chooseSpots(world);
  const bagels = app.bagels = new Bagels(scene, bagelSpots);
  $('#bTotal').textContent = bagels.list.length;

  // ---- interactables
  const talkables = () => {
    const out = [];
    for (const n of npcs.list) out.push({ x: n.pos.x, z: n.pos.z, y: n.pos.y, label: `Parler à ${n.name}`, act: () => { n.talk = 4.5; say(n.name, n.line); } });
    for (const s of world.shops) out.push({ x: s.x, z: s.z, y: h(s.z), label: s.kind === 'church' ? 'Écouter les cloches' : `Entrer · ${s.name}`, act: () => shopAct(s) });
    out.push({ x: cat.g.position.x, z: cat.g.position.z, y: cat.g.position.y, label: 'Flatter le chat', act: () => { say('Le chat', 'Miaou! ♥  (Il ronronne et cligne des yeux.)'); sfx.meow(); } });
    return out;
  };
  function shopAct(s) {
    if (s.kind === 'cafe') { player.boost = 30; say(s.name, 'Un allongé pour emporter! ☕  Tu cours plus vite pendant 30 secondes.'); sfx.collect(1.3); return; }
    if (s.kind === 'bakery') { player.jumpBoost = 30; say(s.name, 'Un croissant au beurre! 🥐  Tu sautes beaucoup plus haut pendant 30 secondes.'); sfx.collect(1.2); return; }
    if (s.kind === 'church') { say(s.name, s.line); sfx.bell(); return; }
    say(s.name, s.line);
  }

  // ---- camera rig
  const cam = app.cam = { yaw: 0, pitch: 0.28, dist: 5.2, cur: 5.2, lastInput: -10, target: new THREE.Vector3() };
  function updateCamera(dt, t) {
    const p = hero.root.position;
    cam.target.lerp(new THREE.Vector3(p.x, p.y + 1.45, p.z), 1 - Math.exp(-dt * 12));
    if (t - cam.lastInput > 2.2 && player.speed > 1.2) {
      let d = (player.yaw + Math.PI) - cam.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
      cam.yaw += d * (1 - Math.exp(-dt * 0.9));
    }
    const dir = new THREE.Vector3(Math.sin(cam.yaw) * Math.cos(cam.pitch), Math.sin(cam.pitch), Math.cos(cam.yaw) * Math.cos(cam.pitch));
    let free = cam.dist;
    for (let s = 0.4; s <= cam.dist; s += 0.2) {
      const q = cam.target.clone().addScaledVector(dir, s);
      if (world.colliders.solid(q.x, q.y, q.z)) { free = Math.max(0.6, s - 0.35); break; }
    }
    cam.cur += (free - cam.cur) * (free < cam.cur ? 1 - Math.exp(-dt * 25) : 1 - Math.exp(-dt * 3));
    camera.position.copy(cam.target).addScaledVector(dir, cam.cur);
    camera.lookAt(cam.target);
  }

  // ---- input
  const keys = new Set(), inp = { x: 0, y: 0, run: false, jump: false };
  addEventListener('keydown', (e) => {
    if (!started) return;
    keys.add(e.code);
    if (e.code === 'Space') { inp.jump = true; e.preventDefault(); }
    if (e.code === 'KeyE' || e.code === 'Enter') interact();
    if (e.code === 'KeyP') photo();
    if (e.code === 'KeyT') cycleTime();
    if (e.code === 'KeyY') cycleSeason();
    if (e.code === 'KeyM') toggleSound();
    if (e.code === 'KeyH' || e.code === 'Slash') $('#help').classList.toggle('show');
    if (e.code === 'Escape') { $('#help').classList.remove('show'); closeSay(); }
  });
  addEventListener('keyup', (e) => keys.delete(e.code));
  addEventListener('blur', () => keys.clear());
  const cv = renderer.domElement;
  let drag = null;
  cv.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') return; drag = { x: e.clientX, y: e.clientY }; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener('pointermove', (e) => { if (!drag) return; cam.yaw -= (e.clientX - drag.x) * 0.006; cam.pitch = Math.min(1.25, Math.max(-0.2, cam.pitch + (e.clientY - drag.y) * 0.005)); drag = { x: e.clientX, y: e.clientY }; cam.lastInput = clock.elapsedTime; });
  cv.addEventListener('pointerup', () => { drag = null; });
  cv.addEventListener('wheel', (e) => { cam.dist = Math.min(10, Math.max(2.4, cam.dist * (1 + Math.sign(e.deltaY) * 0.1))); e.preventDefault(); }, { passive: false });
  // touch: left side joystick, right side look
  const joy = { id: null, ox: 0, oy: 0, x: 0, y: 0 }, look = { id: null, x: 0, y: 0 };
  cv.addEventListener('touchstart', (e) => {
    for (const t of e.changedTouches) {
      if (t.clientX < innerWidth * 0.45 && joy.id === null) { joy.id = t.identifier; joy.ox = t.clientX; joy.oy = t.clientY; joy.x = joy.y = 0; $('#joy').style.cssText = `display:block;left:${t.clientX}px;top:${t.clientY}px`; }
      else if (look.id === null) { look.id = t.identifier; look.x = t.clientX; look.y = t.clientY; }
    }
    e.preventDefault();
  }, { passive: false });
  cv.addEventListener('touchmove', (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === joy.id) { let dx = t.clientX - joy.ox, dy = t.clientY - joy.oy; const l = Math.hypot(dx, dy), m = 55; if (l > m) { dx *= m / l; dy *= m / l; } joy.x = dx / m; joy.y = -dy / m; $('#joyKnob').style.transform = `translate(${dx}px,${dy}px)`; }
      if (t.identifier === look.id) { cam.yaw -= (t.clientX - look.x) * 0.008; cam.pitch = Math.min(1.25, Math.max(-0.2, cam.pitch + (t.clientY - look.y) * 0.006)); look.x = t.clientX; look.y = t.clientY; cam.lastInput = clock.elapsedTime; }
    }
    e.preventDefault();
  }, { passive: false });
  const tEnd = (e) => { for (const t of e.changedTouches) { if (t.identifier === joy.id) { joy.id = null; joy.x = joy.y = 0; $('#joy').style.display = 'none'; $('#joyKnob').style.transform = ''; } if (t.identifier === look.id) look.id = null; } };
  cv.addEventListener('touchend', tEnd); cv.addEventListener('touchcancel', tEnd);
  $('#tJump').addEventListener('touchstart', (e) => { inp.jump = true; e.preventDefault(); });
  $('#tRun').addEventListener('touchstart', (e) => { touchRun = !touchRun; e.currentTarget.classList.toggle('on', touchRun); e.preventDefault(); });
  $('#tTalk').addEventListener('touchstart', (e) => { interact(); e.preventDefault(); });
  let touchRun = false;
  function readInput() {
    let x = 0, y = 0;
    if (keys.has('KeyW') || keys.has('ArrowUp') || keys.has('KeyZ')) y += 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) y -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft') || keys.has('KeyQ')) x -= 1;
    x += joy.x; y += joy.y;
    let run = keys.has('ShiftLeft') || keys.has('ShiftRight') || touchRun;
    const gp = navigator.getGamepads ? [...navigator.getGamepads()].find((g) => g) : null;
    if (gp) {
      const dz = (v) => (Math.abs(v) < 0.15 ? 0 : v);
      x += dz(gp.axes[0]); y -= dz(gp.axes[1]);
      if (Math.abs(dz(gp.axes[2])) + Math.abs(dz(gp.axes[3])) > 0) { cam.yaw -= dz(gp.axes[2]) * 0.05; cam.pitch = Math.min(1.25, Math.max(-0.2, cam.pitch + dz(gp.axes[3]) * 0.04)); cam.lastInput = clock.elapsedTime; }
      if (gp.buttons[0]?.pressed && !gpPrev[0]) inp.jump = true;
      if (gp.buttons[2]?.pressed && !gpPrev[2]) interact();
      run = run || gp.buttons[1]?.pressed || gp.buttons[7]?.value > 0.4;
      gpPrev = gp.buttons.map((b) => b.pressed);
    }
    const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
    inp.x = x; inp.y = y; inp.run = run;
  }
  let gpPrev = [];

  // ---- dialog, prompts, toasts
  let sayT = null, near = null;
  function say(name, text) {
    $('#sayName').textContent = name; const box = $('#say'); box.classList.add('show');
    const el = $('#sayText'); el.textContent = ''; let i = 0; clearInterval(sayT);
    sayT = setInterval(() => { el.textContent = text.slice(0, ++i); if (i % 2 === 0) sfx.blip(); if (i >= text.length) clearInterval(sayT); }, 22);
    box.dataset.at = clock.elapsedTime;
  }
  function closeSay() { $('#say').classList.remove('show'); clearInterval(sayT); }
  $('#say').addEventListener('click', closeSay);
  function interact() {
    if ($('#say').classList.contains('show') && clock.elapsedTime - +$('#say').dataset.at > 0.3) { closeSay(); return; }
    if (near) near.act();
  }
  let lastArea = null, toastT = null;
  function areaToast(name) {
    const t = $('#area'); $('#areaName').textContent = name; t.classList.remove('show'); void t.offsetWidth; t.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 3200);
  }

  // ---- time of day + seasons
  const cur = {}; let preset = params.get('time') || 'day'; let season = params.get('season') || 'autumn';
  const col = (hx) => new THREE.Color(hx);
  function snapLook() { const P = PRESETS[preset]; for (const k of Object.keys(P)) cur[k] = Array.isArray(P[k]) ? new THREE.Vector3(...P[k]).normalize() : typeof P[k] === 'string' ? col(P[k]) : P[k]; }
  snapLook();
  function cycleTime() { preset = ORDER[(ORDER.indexOf(preset) + 1) % ORDER.length]; updateButtons(); sfx.blip(); }
  function cycleSeason() { season = SEASONS[(SEASONS.indexOf(season) + 1) % SEASONS.length]; updateButtons(); sfx.blip(); }
  function updateButtons() {
    $('#btnTime').dataset.v = preset; $('#btnSeason').dataset.v = season;
    $('#btnTime').title = { day: 'Jour', golden: 'Heure dorée', night: 'Nuit' }[preset] + ' (T)';
    $('#btnSeason').title = { summer: 'Été', autumn: 'Automne', winter: 'Hiver' }[season] + ' (Y)';
  }
  $('#btnTime').onclick = cycleTime; $('#btnSeason').onclick = cycleSeason; updateButtons();
  const particles = makeParticles(scene);
  function updateLook(dt) {
    const P = PRESETS[preset], k = 1 - Math.exp(-dt * 2.2);
    for (const key of Object.keys(P)) {
      const v = P[key];
      if (Array.isArray(v)) cur[key].lerp(new THREE.Vector3(...v).normalize(), k).normalize();
      else if (typeof v === 'string') cur[key].lerp(col(v), k);
      else cur[key] += (v - cur[key]) * k;
    }
    sun.color.copy(cur.sunC); sun.intensity = cur.sunI; hemi.color.copy(cur.sky); hemi.groundColor.copy(cur.gnd); hemi.intensity = cur.hemiI;
    const su = sky.material.uniforms; su.uZen.value.copy(cur.zen); su.uHor.value.copy(cur.hor); su.uSunCol.value.copy(cur.sunC); su.uSun.value.copy(cur.sun); su.uCloudCol.value.copy(cur.cloud); su.uCloudShade.value.copy(cur.shade); su.uCloud.value = cur.cover;
    scene.fog.color.copy(cur.fog);
    U.uNight.value = cur.night;
    pipe.quad.material.uniforms.uInk.value.copy(cur.ink);
    const tw = season === 'winter' ? 1 : 0, ta = season === 'autumn' ? 1 : 0;
    U.uSnow.value += (tw - U.uSnow.value) * k; U.uAutumn.value += (ta - U.uAutumn.value) * k;
    world.trees.setWinter(U.uSnow.value > 0.5);
    world.backdrop.crossM.emissiveIntensity = cur.night * 1.6;
    particles.mode(season);
    // shadow frustum follows the player, snapped to texels so shadows never crawl
    const p = player.pos, d = cur.sun, S = 90 / sun.shadow.mapSize.x;
    const right = new THREE.Vector3().crossVectors(d, new THREE.Vector3(0, 1, 0)).normalize(), up = new THREE.Vector3().crossVectors(right, d).normalize();
    const c = p.clone(); const a = Math.round(c.dot(right) / S) * S - c.dot(right), b = Math.round(c.dot(up) / S) * S - c.dot(up);
    c.addScaledVector(right, a).addScaledVector(up, b);
    sun.target.position.copy(c); sun.position.copy(c).addScaledVector(d, 120);
  }

  // ---- audio
  const sfx = makeAudio();
  function toggleSound() { const on = sfx.toggle(); $('#btnSound').classList.toggle('off', !on); }
  $('#btnSound').onclick = toggleSound;

  // ---- photo mode
  let shot = false;
  function photo() { shot = true; document.body.classList.add('flash'); setTimeout(() => document.body.classList.remove('flash'), 400); sfx.shutter(); }
  $('#btnPhoto').onclick = photo;
  $('#btnHelp').onclick = () => $('#help').classList.toggle('show');
  $('#help').onclick = () => $('#help').classList.remove('show');
  $('#btnCam').onclick = () => { cam.yaw = player.yaw + Math.PI; cam.pitch = 0.28; cam.dist = 5.2; };

  // ---- minimap
  const mm = makeMinimap(world);

  // ---- resize
  function resize() { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); pipe.setSize(innerWidth, innerHeight, renderer.getPixelRatio()); }
  addEventListener('resize', resize); resize();

  // ---- start screen
  let started = params.has('play');
  $('#play').onclick = () => { started = true; document.body.classList.add('playing'); sfx.start(); $('#btnSound').classList.remove('off'); setTimeout(() => areaToast('Rue Saint-Denis'), 600); };
  if (started) document.body.classList.add('playing');

  // ---- loop
  const clock = new THREE.Clock();
  let got = 0, done = false, t0 = null;
  const onGet = (B) => {
    got++; $('#bCount').textContent = got; $('#counter').classList.remove('pop'); void $('#counter').offsetWidth; $('#counter').classList.add('pop');
    sfx.collect(1 + got * 0.04); burst.at(B.g.position);
    if (got === 1) t0 = clock.elapsedTime;
    if (got === bagels.list.length && !done) { done = true; const s = Math.round(clock.elapsedTime - (t0 || 0)); setTimeout(() => { $('#winTime').textContent = `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s`; $('#win').classList.add('show'); sfx.fanfare(); }, 900); }
  };
  $('#winClose').onclick = () => $('#win').classList.remove('show');
  const burst = makeBurst(scene);
  function frame(dtOverride) {
    const dt = typeof dtOverride === 'number' ? dtOverride : Math.min(clock.getDelta(), 1 / 20);
    if (typeof dtOverride === 'number') clock.elapsedTime += dt;
    const t = clock.elapsedTime;
    U.uTime.value = t;
    readInput();
    if (!started) { inp.x = inp.y = 0; inp.jump = false; cam.yaw += dt * 0.05; }
    const stepped = player.update(dt, inp, cam.yaw);
    if (stepped) sfx.step(season === 'winter');
    if (player.jumped) { sfx.jump(); player.jumped = false; }
    if (player.landed) { sfx.land(); player.landed = false; }
    npcs.update(dt, player);
    traffic.update(dt, player, npcs.list);
    if (pigeons.update(dt, player)) sfx.flap();
    cat.update(t);
    bagels.update(dt, player, onGet);
    burst.update(dt);
    particles.update(dt, camera.position);
    updateLook(dt);
    updateCamera(dt, t);
    // nearest interactable
    let best = null, bd = 2.6;
    if (started) for (const o of talkables()) { const d = Math.hypot(o.x - player.pos.x, o.z - player.pos.z); if (d < bd && Math.abs(o.y - player.pos.y) < 2.2) { bd = d; best = o; } }
    near = best;
    const pr = $('#prompt');
    if (best && !$('#say').classList.contains('show')) { $('#promptText').textContent = best.label; pr.classList.add('show'); } else pr.classList.remove('show');
    if ($('#say').classList.contains('show') && best === null && clock.elapsedTime - +$('#say').dataset.at > 1.5) closeSay();
    // area names
    const w = whereIs(player.pos.x, player.pos.z);
    if (w.name && w.name !== lastArea && started) { lastArea = w.name; areaToast(w.name); }
    $('#boostCafe').classList.toggle('show', player.boost > 0); $('#boostJump').classList.toggle('show', player.jumpBoost > 0);
    mm.draw(player, cam.yaw, bagels.list);
    sfx.ambience(cur.night, season);
    cullFar();
    pipe.render();
    if (shot) { shot = false; const a = document.createElement('a'); a.download = 'plateau-montreal.png'; a.href = renderer.domElement.toDataURL('image/png'); a.click(); }
  }
  function cullFar() {
    const cp = camera.position;
    for (const n of npcs.list) n.ch.root.visible = n.ch.root.position.distanceTo(cp) < 150;
    for (const c of traffic.cars) c.m.g.visible = c.m.g.position.distanceTo(cp) < 260;
    for (const ch of world.city.children) { const s = ch.geometry.boundingSphere; ch.visible = Math.hypot(s.center.x - cp.x, s.center.z - cp.z) - s.radius < 760; }
  }
  app.frame = frame;
  app.say = say; app.interact = interact; app.inp = inp; app.setTime = (p) => { preset = p; snapLook(); updateButtons(); }; app.setSeason = (s) => { season = s; updateButtons(); };
  app.near = () => near;
  // stats for the curious
  app.stats = () => ({ tris: renderer.info.render.triangles, calls: renderer.info.render.calls, colliders: world.colliders.list.length, bagels: bagels.list.length });
  $('#loader').classList.add('done'); setTimeout(() => $('#loader').remove(), 900);
  window.__ready = true;
  if (!params.has('manual')) renderer.setAnimationLoop(() => frame());
}

// ================================================================= the twelve bagels
function chooseSpots(world) {
  const S = world.spots, out = [];
  const nearest = (arr, x, z, f = () => true) => arr.filter(f).sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z))[0];
  out.push({ x: 9.6, y: h(98) + 0.15, z: 98 });                                   // 1 · right in front of you
  out.push(nearest(S.balcony, -80, -100, (s) => s.street === -1));                  // 2 · a balcony on Drolet
  out.push(nearest(S.balcony, 80, 140, (s) => s.street === 1));                     // 3 · a balcony on Saint-Hubert
  const ga = S.alley.find((a) => a.green) || S.alley[0]; out.push({ x: ga.x, y: ga.y, z: ga.z });   // 4 · the green alley
  out.push(S.fountain); out.push(S.gazebo); out.push(S.pavilion); out.push(S.church);              // 5-8
  out.push(nearest(S.back, 40, -90));                                               // 9 · a back balcony
  out.push(nearest(S.shed, 40, 210));                                               // 10 · a shed roof
  out.push(S.truck); out.push(S.shelter);                                           // 11-12
  return out.filter(Boolean);
}

// ================================================================= snow / falling leaves
function makeParticles(scene) {
  const N = 2400, pos = new Float32Array(N * 3), seed = new Float32Array(N);
  for (let i = 0; i < N; i++) { pos[i * 3] = Math.random() * 60 - 30; pos[i * 3 + 1] = Math.random() * 30; pos[i * 3 + 2] = Math.random() * 60 - 30; seed[i] = Math.random(); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const m = new THREE.ShaderMaterial({
    uniforms: { uTime: U.uTime, uCam: { value: new THREE.Vector3() }, uMode: { value: 0 }, uNight: U.uNight },
    vertexShader: `attribute float aSeed; uniform float uTime, uMode; uniform vec3 uCam; varying float vS; varying float vA;
void main(){ vS = aSeed; float fall = uMode > 1.5 ? 1.1 : 0.7;
  vec3 p = position; p.y = mod(p.y - uTime * fall * (0.6 + aSeed), 30.0); p.x += sin(uTime * 0.8 + aSeed * 30.0) * (uMode > 1.5 ? 0.6 : 1.4);
  p.xz = mod(p.xz - uCam.xz + 30.0, 60.0) - 30.0 + uCam.xz; p.y += uCam.y - 10.0;
  vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
  gl_PointSize = (uMode > 1.5 ? 70.0 : 90.0) * (0.5 + aSeed) / -mv.z; vA = smoothstep(0.5, 3.0, -mv.z) * (1.0 - smoothstep(22.0, 30.0, -mv.z)); }`,
    fragmentShader: `uniform float uMode, uNight; varying float vS; varying float vA;
void main(){ vec2 c = gl_PointCoord - 0.5; float a;
  vec3 col;
  if (uMode > 1.5) { a = 1.0 - smoothstep(0.2, 0.5, length(c)); col = mix(vec3(1.0), vec3(0.6, 0.7, 0.95), uNight * 0.6); }
  else { float r = abs(c.x) + abs(c.y) * 1.6; a = 1.0 - smoothstep(0.35, 0.45, r); col = vS < 0.5 ? vec3(0.9, 0.4, 0.15) : vec3(0.96, 0.7, 0.2); col *= 1.0 - uNight * 0.6; }
  if (a < 0.05) discard; gl_FragColor = vec4(col, a * vA); }`,
    transparent: true, depthWrite: false,
  });
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.layers.set(LAYER_FX); scene.add(pts);
  return {
    mode(s) { m.uniforms.uMode.value = s === 'winter' ? 2 : s === 'autumn' ? 1 : 0; pts.visible = s !== 'summer'; g.setDrawRange(0, s === 'winter' ? N : 260); },
    update(dt, cam) { m.uniforms.uCam.value.copy(cam); },
  };
}

// ================================================================= sparkle burst
function makeBurst(scene) {
  const N = 40, g = new THREE.OctahedronGeometry(0.09, 0);
  const mesh = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({ color: 0xffd36a }), N); mesh.count = 0; mesh.layers.set(LAYER_FX); mesh.frustumCulled = false; scene.add(mesh);
  const parts = [], m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
  return {
    update(dt) {
      let n = 0;
      for (const p of parts) { p.t += dt; if (p.t > 0.9) continue; p.v.y -= 6 * dt; p.p.addScaledVector(p.v, dt); const s = 1 - p.t / 0.9; q.setFromEuler(new THREE.Euler(p.t * 6, p.t * 4, 0)); m4.compose(p.p, q, new THREE.Vector3(s, s, s)); mesh.setMatrixAt(n++, m4); }
      mesh.count = n; mesh.instanceMatrix.needsUpdate = true;
      if (parts.length > 200) parts.splice(0, parts.length - 200);
    },
    at(pos) { for (let i = 0; i < N; i++) parts.push({ p: pos.clone(), v: new THREE.Vector3((Math.random() - 0.5) * 6, 2 + Math.random() * 5, (Math.random() - 0.5) * 6), t: 0 }); },
  };
}

// ================================================================= minimap
function makeMinimap(world) {
  const cv = document.querySelector('#mini'), x = cv.getContext('2d');
  const S = 2, X0 = -150, X1 = 150, Z0 = -285, Z1 = 295;
  const base = document.createElement('canvas'); base.width = (X1 - X0) * S; base.height = (Z1 - Z0) * S;
  const b = base.getContext('2d');
  const R = (x0, x1, z0, z1, c) => { b.fillStyle = c; b.fillRect((x0 - X0) * S, (z0 - Z0) * S, (x1 - x0) * S, (z1 - z0) * S); };
  R(X0, X1, Z0, Z1, '#cfe6b6');
  for (let k = -2; k <= 2; k++) { const sx = nsX(k); R(sx - nsHW(k) - nsSW(k), sx + nsHW(k) + nsSW(k), Z0, Z1, '#fbf6ec'); }
  for (let m = -3; m <= 3; m++) { const sz = ewZ(m); R(X0, X1, sz - ewHW(m) - ewSW(m), sz + ewHW(m) + ewSW(m), '#fbf6ec'); }
  for (let k = -2; k <= 1; k++) R(alleyX(k) - ALLEY_HW, alleyX(k) + ALLEY_HW, Z0, Z1, '#e6dccb');
  R(PARK.x0, PARK.x1, PARK.z0, PARK.z1, '#9ed07e'); R(PLAZA.x0, PLAZA.x1, PLAZA.z0, PLAZA.z1, '#f3dcbc');
  for (let k = -2; k <= 2; k++) { const sx = nsX(k); R(sx - nsHW(k), sx + nsHW(k), Z0, Z1, '#aab3c8'); }
  for (let m = -3; m <= 3; m++) { const sz = ewZ(m); R(X0, X1, sz - ewHW(m), sz + ewHW(m), '#aab3c8'); }
  for (const [a, c, z0, z1] of world.foot) R(a, c, z0, z1, '#eba98c');
  const W = cv.width, H = cv.height;
  return {
    draw(player, yaw, bagels) {
      x.clearRect(0, 0, W, H);
      x.save(); x.beginPath(); x.arc(W / 2, H / 2, W / 2 - 3, 0, 7); x.clip();
      x.fillStyle = '#cfe6b6'; x.fillRect(0, 0, W, H);
      x.translate(W / 2, H / 2); x.rotate(yaw); const sc = 1.1;
      x.scale(sc / S, sc / S); x.translate(-(player.pos.x - X0) * S, -(player.pos.z - Z0) * S);
      x.drawImage(base, 0, 0);
      for (const B of bagels) if (!B.got) { x.fillStyle = '#f2a93b'; x.strokeStyle = '#7a3d14'; x.lineWidth = 3; x.beginPath(); x.arc((B.g.position.x - X0) * S, (B.g.position.z - Z0) * S, 7, 0, 7); x.fill(); x.stroke(); }
      x.restore();
      x.save(); x.translate(W / 2, H / 2); x.rotate(yaw - player.yaw + Math.PI);
      x.fillStyle = '#e4402b'; x.strokeStyle = '#fff'; x.lineWidth = 2.5; x.beginPath(); x.moveTo(0, -10); x.lineTo(7, 7); x.lineTo(0, 3); x.lineTo(-7, 7); x.closePath(); x.fill(); x.stroke(); x.restore();
      // north marker: the mountain (-z)
      const r = W / 2 - 13; x.save(); x.translate(W / 2 + Math.sin(yaw) * r, H / 2 - Math.cos(yaw) * r); x.fillStyle = '#2b2550'; x.beginPath(); x.arc(0, 0, 9, 0, 7); x.fill(); x.fillStyle = '#fff'; x.font = '700 10px Fredoka, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('N', 0, 1); x.restore();
    },
  };
}

// ================================================================= audio (all synthesised, nothing to download)
function makeAudio() {
  let A = null, master, music, on = false, musicT = null, nextBird = 0;
  const env = (node, t, a, d, peak) => { node.gain.setValueAtTime(0.0001, t); node.gain.exponentialRampToValueAtTime(peak, t + a); node.gain.exponentialRampToValueAtTime(0.0001, t + a + d); };
  const tone = (f, t, d, peak, type = 'sine', dest = master) => { const o = A.createOscillator(), g = A.createGain(); o.type = type; o.frequency.value = f; env(g, t, 0.01, d, peak); o.connect(g).connect(dest); o.start(t); o.stop(t + d + 0.05); };
  const noise = (t, d, peak, f, q = 1) => { const len = Math.floor(A.sampleRate * d), buf = A.createBuffer(1, len, A.sampleRate), ch = buf.getChannelData(0); for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1; const s = A.createBufferSource(); s.buffer = buf; const fl = A.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.value = f; fl.Q.value = q; const g = A.createGain(); env(g, t, 0.005, d, peak); s.connect(fl).connect(g).connect(master); s.start(t); };
  // a gentle lo-fi loop: Fmaj7 – Em7 – Dm7 – Cmaj7
  const CH = [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]];
  const mf = (n) => 440 * Math.pow(2, (n - 69) / 12);
  function bar(i, t) {
    const c = CH[i % 4], beat = 60 / 76;
    for (const n of c) { const o = A.createOscillator(), g = A.createGain(), fl = A.createBiquadFilter(); o.type = 'triangle'; o.frequency.value = mf(n); fl.type = 'lowpass'; fl.frequency.value = 900; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.022, t + 0.4); g.gain.linearRampToValueAtTime(0.0001, t + beat * 4); o.connect(fl).connect(g).connect(music); o.start(t); o.stop(t + beat * 4 + 0.1); }
    tone(mf(c[0] - 12), t, beat * 3.5, 0.05, 'sine', music);
    const arp = [c[0] + 12, c[2] + 12, c[1] + 12, c[3] + 12, c[2] + 12, c[1] + 12, c[3] + 12, c[2] + 24];
    arp.forEach((n, j) => { if (Math.random() < 0.85) tone(mf(n), t + j * beat / 2, 0.5, 0.018, 'sine', music); });
  }
  function schedule() { let i = 0, t = A.currentTime + 0.1; const loop = () => { while (t < A.currentTime + 2) { bar(i++, t); t += 4 * 60 / 76; } }; loop(); musicT = setInterval(loop, 500); }
  return {
    start() { if (A) return; A = new (window.AudioContext || window.webkitAudioContext)(); master = A.createGain(); master.gain.value = 0.9; master.connect(A.destination); music = A.createGain(); music.gain.value = 1; music.connect(master); on = true; schedule(); },
    toggle() { if (!A) { this.start(); return true; } on = !on; master.gain.setTargetAtTime(on ? 0.9 : 0, A.currentTime, 0.1); return on; },
    step(snow) { if (!A || !on) return; noise(A.currentTime, 0.06, snow ? 0.12 : 0.07, snow ? 900 : 1600, 0.8); },
    jump() { if (!A || !on) return; const t = A.currentTime; const o = A.createOscillator(), g = A.createGain(); o.frequency.setValueAtTime(320, t); o.frequency.exponentialRampToValueAtTime(640, t + 0.12); env(g, t, 0.01, 0.12, 0.05); o.connect(g).connect(master); o.start(t); o.stop(t + 0.2); },
    land() { if (!A || !on) return; noise(A.currentTime, 0.1, 0.12, 400, 0.7); },
    blip() { if (!A || !on) return; tone(880 + Math.random() * 120, A.currentTime, 0.04, 0.025, 'square'); },
    collect(p = 1) { if (!A || !on) return; const t = A.currentTime; [0, 4, 7, 12].forEach((s, i) => tone(mf(72 + s) * p, t + i * 0.07, 0.3, 0.07, 'triangle')); },
    fanfare() { if (!A || !on) return; const t = A.currentTime; [0, 4, 7, 12, 7, 12, 16].forEach((s, i) => tone(mf(67 + s), t + i * 0.12, 0.5, 0.08, 'triangle')); },
    bell() { if (!A || !on) return; const t = A.currentTime; for (const [f, a] of [[196, 0.12], [392, 0.06], [494, 0.04], [588, 0.03]]) tone(f, t, 4, a); },
    meow() { if (!A || !on) return; const t = A.currentTime, o = A.createOscillator(), g = A.createGain(); o.type = 'sawtooth'; o.frequency.setValueAtTime(620, t); o.frequency.linearRampToValueAtTime(880, t + 0.15); o.frequency.linearRampToValueAtTime(520, t + 0.45); const fl = A.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.value = 1400; fl.Q.value = 3; env(g, t, 0.05, 0.45, 0.06); o.connect(fl).connect(g).connect(master); o.start(t); o.stop(t + 0.6); },
    flap() { if (!A || !on) return; for (let i = 0; i < 6; i++) noise(A.currentTime + i * 0.05, 0.05, 0.05, 700, 0.6); },
    shutter() { if (!A || !on) return; noise(A.currentTime, 0.05, 0.2, 3000, 0.5); noise(A.currentTime + 0.08, 0.05, 0.15, 2000, 0.5); },
    ambience(night, season) {
      if (!A || !on) return;
      if (A.currentTime > nextBird) {
        nextBird = A.currentTime + 2 + Math.random() * 5;
        const t = A.currentTime;
        if (night > 0.6 && season !== 'winter') for (let i = 0; i < 6; i++) tone(4200, t + i * 0.09, 0.03, 0.006);
        else if (night < 0.5 && season !== 'winter') { const base = 2400 + Math.random() * 1600; for (let i = 0; i < 3; i++) { const o = A.createOscillator(), g = A.createGain(); o.frequency.setValueAtTime(base, t + i * 0.13); o.frequency.exponentialRampToValueAtTime(base * 1.4, t + i * 0.13 + 0.08); env(g, t + i * 0.13, 0.01, 0.08, 0.012); o.connect(g).connect(master); o.start(t + i * 0.13); o.stop(t + i * 0.13 + 0.12); } }
      }
    },
  };
}

boot().catch((e) => { console.error(e); const m = document.querySelector('#loadMsg'); if (m) m.textContent = 'Erreur: ' + e.message; });
