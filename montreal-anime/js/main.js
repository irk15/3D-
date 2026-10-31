// main.js — Plateau · Montréal: boot, camera, input, interactions, the living-world systems and HUD.
import * as THREE from 'three';
import { h, U, whereIs, PARK, PLAZA, nsX, ewZ, nsHW, nsSW, ewHW, ewSW, alleyX, ALLEY_HW } from './layout.js';
import { Pipeline, makeSky, LAYER_FX } from './toon.js';
import { buildWorld } from './world.js';
import { makeCharacter, Player, Neighbours, Traffic, Pigeons, makeCat, Bagels, bikeModel } from './actors.js';
import { lookAt, fmtHour, Weather, loadSave, writeSave, Achievements, ACH, Voice, dialogue, Deliveries, OUTFITS } from './systems.js';

const $ = (s) => document.querySelector(s);
const params = new URLSearchParams(location.search);
const touch = matchMedia('(pointer: coarse)').matches;
const SEASONS = ['summer', 'autumn', 'winter'];
const JUMP_TO = [8, 13, 18.3, 19.7, 22.5];

async function boot() {
  try { await Promise.race([document.fonts.load('600 40px Fredoka'), new Promise((r) => setTimeout(r, 2500))]); } catch (e) { /* offline font */ }
  const app = window.app = { THREE, U };
  const save = app.save = params.has('fresh') ? loadSave.call(null) && Object.assign(loadSave(), { bagels: [], money: 0, deliveries: 0, met: {}, ach: {}, outfit: 0, owned: [0] }) : loadSave();
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
  if (touch) pipe.aoOn = false;

  // ---- characters
  let hero = makeCharacter(OUTFITS[save.outfit]?.o || {}); scene.add(hero.root);
  const player = app.player = new Player(world, hero);
  const npcs = app.npcs = new Neighbours(scene, world);
  const traffic = app.traffic = new Traffic(scene, world, world.glows);
  player.carBlock = (x, z) => traffic.blocks(x, z);
  const pigeons = new Pigeons(scene, world);
  const catSpot = world.spots.balcony.filter((s) => s.street === -1).sort((a, b) => Math.abs(a.z - 20) - Math.abs(b.z - 20))[0] || { x: -80, y: h(20) + 0.2, z: 20 };
  const cat = makeCat(scene, catSpot.x, catSpot.y, catSpot.z - 0.8);
  const bagels = app.bagels = new Bagels(scene, chooseSpots(world));
  bagels.list.forEach((b, i) => { if (save.bagels.includes(i)) { b.got = true; b.g.visible = false; } });
  $('#bTotal').textContent = bagels.list.length;
  const deliveries = app.deliveries = new Deliveries(scene, world);
  const weather = app.weather = new Weather();
  const voice = app.voice = new Voice(); voice.on = save.voice !== false;
  const sfx = makeAudio();
  const ach = new Achievements(save, (ic, name) => { achToast(ic, name); sfx.fanfare(0.6); });
  const burst = makeBurst(scene), puffs = makePuffs(scene);
  function setOutfit(i) {
    const keep = hero.root.position.clone(), y = hero.root.rotation.y;
    scene.remove(hero.root);
    hero = makeCharacter(OUTFITS[i].o); scene.add(hero.root); hero.root.position.copy(keep); hero.root.rotation.y = y;
    if (player.bike) { const b = player.bike; player.dismount(); player.c = hero; player.mountBike(b); } else player.c = hero;
    save.outfit = i; writeSave(save);
  }

  // ---- interactables
  const ctxNow = () => ({ hour: clockH, rain: weather.precip === 'rain', season, delivery: deliveries.job?.short, bagels: bagels.count });
  const talkables = () => {
    const out = [];
    if (player.bike) { out.push({ x: player.pos.x, z: player.pos.z, y: player.pos.y, label: 'Descendre du vélo', act: () => { player.dismount(); sfx.blip(); } }); return out; }
    for (const n of npcs.list) if (n.out) out.push({ x: n.pos.x, z: n.pos.z, y: n.pos.y, label: `Parler à ${n.name}`, act: () => talkTo(n) });
    for (const s of world.shops) out.push({ x: s.x, z: s.z, y: h(s.z), label: shopLabel(s), act: () => shopAct(s) });
    for (const d of world.docks) out.push({ x: d.x, z: d.z, y: h(d.z) + 0.15, label: 'Prendre un BIXI', act: () => { player.mountBike(bikeModel()); ach.unlock('bixi'); sfx.bell(); say(d.name, 'Bon trajet! Utilise la piste cyclable de Saint-Denis. (E pour descendre, B pour la sonnette)'); } });
    out.push({ x: cat.g.position.x, z: cat.g.position.z, y: cat.g.position.y, label: 'Flatter le chat', act: () => { say('Le chat', 'Miaou! ♥  (Il ronronne et cligne des yeux.)', 3); sfx.meow(); ach.unlock('cat'); } });
    return out;
  };
  function talkTo(n) {
    n.talk = 4.5;
    const r = dialogue(n, save, ctxNow());
    say(n.name, r.text, n.id + 1, r.hearts);
    if (Object.keys(save.met).length >= 8) ach.unlock('friends');
  }
  const special = { cafe: 1, bakery: 1, church: 1, thrift: 1 };
  function shopLabel(s) {
    if (s.kind === 'church') return 'Écouter les cloches';
    if (s.kind === 'cafe') return 'Commander un café';
    if (s.kind === 'bakery') return 'Acheter un croissant';
    if (s.kind === 'thrift') return 'Essayer des vêtements';
    return deliveries.job ? `Entrer · ${s.name}` : `📦 Livraison · ${s.name}`;
  }
  function shopAct(s) {
    if (s.kind === 'cafe') { player.boost = 30; say(s.name, 'Un allongé pour emporter! ☕ Tu cours plus vite pendant 30 secondes.'); sfx.collect(1.3); return; }
    if (s.kind === 'bakery') { player.jumpBoost = 30; say(s.name, 'Un croissant au beurre! 🥐 Tu sautes beaucoup plus haut pendant 30 secondes.'); sfx.collect(1.2); return; }
    if (s.kind === 'church') { say(s.name, s.line); sfx.bell(); return; }
    if (s.kind === 'thrift') return wardrobe(s);
    if (deliveries.job) { say(s.name, s.line); return; }
    const job = deliveries.offer(s, player.pos);
    if (!job) { say(s.name, 'Rien à livrer pour l\'instant. Repasse plus tard!'); return; }
    deliveries.start(job); player.parcel = true; sfx.collect(0.9);
    say(s.name, `Peux-tu livrer ${job.item} à ${job.who}, au ${job.addr}${job.balcony ? ' (sur le balcon)' : ''}? Tu as ${job.time} secondes. Suis la lumière bleue!`);
  }
  let wardI = save.outfit;
  function wardrobe(s) {
    wardI = (wardI + 1) % OUTFITS.length;
    const O = OUTFITS[wardI], owned = save.owned.includes(wardI);
    if (owned) { setOutfit(wardI); say(s.name, `Tu portes « ${O.name} ». Reviens pour changer encore!`); return; }
    if (save.money >= O.price) { save.money -= O.price; save.owned.push(wardI); setOutfit(wardI); ach.unlock('style'); say(s.name, `Vendu! « ${O.name} » pour ${O.price} $. Ça te va super bien.`); sfx.collect(1.1); updateMoney(); }
    else say(s.name, `« ${O.name} » coûte ${O.price} $. Fais quelques livraisons et reviens! (Tu as ${save.money} $.)`);
  }

  // ---- camera rig
  const cam = app.cam = { yaw: 0, pitch: 0.28, dist: 5.2, cur: 5.2, lastInput: -10, target: new THREE.Vector3(), fov: 52 };
  function updateCamera(dt, t) {
    const p = hero.root.position;
    cam.target.lerp(new THREE.Vector3(p.x, p.y + (player.bike ? 1.65 : 1.45), p.z), 1 - Math.exp(-dt * 12));
    if (!photoMode && t - cam.lastInput > 2.2 && player.speed > 1.2) {
      let d = (player.yaw + Math.PI) - cam.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
      cam.yaw += d * (1 - Math.exp(-dt * (player.bike ? 2.2 : 0.9)));
    }
    const dir = new THREE.Vector3(Math.sin(cam.yaw) * Math.cos(cam.pitch), Math.sin(cam.pitch), Math.cos(cam.yaw) * Math.cos(cam.pitch));
    const want = cam.dist * (player.bike ? 1.25 : 1);
    let free = want;
    for (let s = 0.4; s <= want; s += 0.2) { const q = cam.target.clone().addScaledVector(dir, s); if (world.colliders.solid(q.x, q.y, q.z)) { free = Math.max(0.6, s - 0.35); break; } }
    cam.cur += (free - cam.cur) * (free < cam.cur ? 1 - Math.exp(-dt * 25) : 1 - Math.exp(-dt * 3));
    camera.position.copy(cam.target).addScaledVector(dir, cam.cur);
    camera.lookAt(cam.target);
    // a little FOV kick with speed — the anime "whoosh"
    const fovT = 52 + Math.min(12, Math.max(0, player.speed - 5) * 1.6) + (player.dashT > 0 ? 6 : 0);
    cam.fov += (fovT - cam.fov) * (1 - Math.exp(-dt * 5));
    if (Math.abs(camera.fov - cam.fov) > 0.01) { camera.fov = cam.fov; camera.updateProjectionMatrix(); }
  }

  // ---- input
  const keys = new Set(), inp = { x: 0, y: 0, run: false, jump: false, jumpHeld: false, dash: false, rain: false };
  addEventListener('keydown', (e) => {
    if (!started) return;
    if (e.repeat && e.code !== 'Space') { keys.add(e.code); return; }
    keys.add(e.code);
    if (photoMode) {
      if (e.code === 'KeyF') cycleFilter(); if (e.code === 'Space' || e.code === 'Enter') snap(); if (e.code === 'Escape' || e.code === 'KeyP') togglePhoto();
      if (e.code === 'KeyG') pose = !pose; e.preventDefault(); return;
    }
    if (e.code === 'Space') { if (!e.repeat) inp.jump = true; e.preventDefault(); }
    if (e.code === 'KeyF' || e.code === 'KeyC') inp.dash = true;
    if (e.code === 'KeyE' || e.code === 'Enter') interact();
    if (e.code === 'KeyP') togglePhoto();
    if (e.code === 'KeyT') cycleTime();
    if (e.code === 'KeyY') cycleSeason();
    if (e.code === 'KeyR') { weather.cycle(); updateButtons(); sfx.blip(); }
    if (e.code === 'KeyB') sfx.bell(player.bike ? 2 : 1);
    if (e.code === 'KeyM') toggleSound();
    if (e.code === 'KeyJ') $('#journal').classList.toggle('show'), drawJournal();
    if (e.code === 'KeyH' || e.code === 'Slash') $('#help').classList.toggle('show');
    if (e.code === 'Escape') { $('#help').classList.remove('show'); $('#journal').classList.remove('show'); closeSay(); }
  });
  addEventListener('keyup', (e) => keys.delete(e.code));
  addEventListener('blur', () => keys.clear());
  const cv = renderer.domElement;
  let drag = null;
  cv.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') return; drag = { x: e.clientX, y: e.clientY }; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener('pointermove', (e) => { if (!drag) return; cam.yaw -= (e.clientX - drag.x) * 0.006; cam.pitch = Math.min(1.25, Math.max(-0.25, cam.pitch + (e.clientY - drag.y) * 0.005)); drag = { x: e.clientX, y: e.clientY }; cam.lastInput = clock.elapsedTime; });
  cv.addEventListener('pointerup', () => { drag = null; });
  cv.addEventListener('wheel', (e) => { cam.dist = Math.min(photoMode ? 16 : 10, Math.max(photoMode ? 1.2 : 2.4, cam.dist * (1 + Math.sign(e.deltaY) * 0.1))); e.preventDefault(); }, { passive: false });
  const joy = { id: null, ox: 0, oy: 0, x: 0, y: 0 }, lookT = { id: null, x: 0, y: 0 };
  cv.addEventListener('touchstart', (e) => {
    for (const t of e.changedTouches) {
      if (t.clientX < innerWidth * 0.45 && joy.id === null) { joy.id = t.identifier; joy.ox = t.clientX; joy.oy = t.clientY; joy.x = joy.y = 0; $('#joy').style.cssText = `display:block;left:${t.clientX}px;top:${t.clientY}px`; }
      else if (lookT.id === null) { lookT.id = t.identifier; lookT.x = t.clientX; lookT.y = t.clientY; }
    }
    e.preventDefault();
  }, { passive: false });
  cv.addEventListener('touchmove', (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === joy.id) { let dx = t.clientX - joy.ox, dy = t.clientY - joy.oy; const l = Math.hypot(dx, dy), m = 55; if (l > m) { dx *= m / l; dy *= m / l; } joy.x = dx / m; joy.y = -dy / m; $('#joyKnob').style.transform = `translate(${dx}px,${dy}px)`; }
      if (t.identifier === lookT.id) { cam.yaw -= (t.clientX - lookT.x) * 0.008; cam.pitch = Math.min(1.25, Math.max(-0.25, cam.pitch + (t.clientY - lookT.y) * 0.006)); lookT.x = t.clientX; lookT.y = t.clientY; cam.lastInput = clock.elapsedTime; }
    }
    e.preventDefault();
  }, { passive: false });
  const tEnd = (e) => { for (const t of e.changedTouches) { if (t.identifier === joy.id) { joy.id = null; joy.x = joy.y = 0; $('#joy').style.display = 'none'; $('#joyKnob').style.transform = ''; } if (t.identifier === lookT.id) lookT.id = null; } };
  cv.addEventListener('touchend', tEnd); cv.addEventListener('touchcancel', tEnd);
  let touchJump = false, touchRun = false;
  $('#tJump').addEventListener('touchstart', (e) => { inp.jump = true; touchJump = true; e.preventDefault(); });
  $('#tJump').addEventListener('touchend', () => { touchJump = false; });
  $('#tRun').addEventListener('touchstart', (e) => { touchRun = !touchRun; e.currentTarget.classList.toggle('on', touchRun); e.preventDefault(); });
  $('#tTalk').addEventListener('touchstart', (e) => { interact(); e.preventDefault(); });
  $('#tDash').addEventListener('touchstart', (e) => { inp.dash = true; e.preventDefault(); });
  let gpPrev = [];
  function readInput() {
    let x = 0, y = 0;
    if (keys.has('KeyW') || keys.has('ArrowUp') || keys.has('KeyZ')) y += 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) y -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft') || keys.has('KeyQ')) x -= 1;
    x += joy.x; y += joy.y;
    let run = keys.has('ShiftLeft') || keys.has('ShiftRight') || touchRun;
    let held = keys.has('Space') || touchJump;
    const gp = navigator.getGamepads ? [...navigator.getGamepads()].find((g) => g) : null;
    if (gp) {
      const dz = (v) => (Math.abs(v) < 0.15 ? 0 : v);
      x += dz(gp.axes[0]); y -= dz(gp.axes[1]);
      if (Math.abs(dz(gp.axes[2])) + Math.abs(dz(gp.axes[3])) > 0) { cam.yaw -= dz(gp.axes[2]) * 0.05; cam.pitch = Math.min(1.25, Math.max(-0.25, cam.pitch + dz(gp.axes[3]) * 0.04)); cam.lastInput = clock.elapsedTime; }
      const pressed = (i) => gp.buttons[i]?.pressed && !gpPrev[i];
      if (pressed(0)) inp.jump = true; held = held || gp.buttons[0]?.pressed;
      if (pressed(2)) interact(); if (pressed(3)) inp.dash = true; if (pressed(1) && player.bike) sfx.bell(2);
      run = run || gp.buttons[7]?.value > 0.4 || gp.buttons[5]?.pressed;
      gpPrev = gp.buttons.map((b) => b.pressed);
    }
    const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
    inp.x = x; inp.y = y; inp.run = run; inp.jumpHeld = held; inp.rain = weather.precip === 'rain';
  }

  // ---- dialog, prompts, toasts
  let sayT = null, near = null;
  function say(name, text, who = 0, hearts = 0) {
    $('#sayName').textContent = name; $('#sayHearts').textContent = hearts ? '♥'.repeat(hearts) + '♡'.repeat(5 - hearts) : '';
    const box = $('#say'); box.classList.add('show');
    const el = $('#sayText'); el.textContent = ''; let i = 0; clearInterval(sayT);
    sayT = setInterval(() => { el.textContent = text.slice(0, ++i); if (i % 3 === 0 && !voice.on) sfx.blip(); if (i >= text.length) clearInterval(sayT); }, 22);
    box.dataset.at = clock.elapsedTime;
    if (who) voice.speak(text, who);
  }
  function closeSay() { $('#say').classList.remove('show'); clearInterval(sayT); voice.stop(); }
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
  function achToast(ic, name) {
    const d = document.createElement('div'); d.className = 'ach'; d.innerHTML = `<i>${ic}</i><div><small>SUCCÈS DÉBLOQUÉ</small><b>${name}</b></div>`;
    $('#achs').appendChild(d); setTimeout(() => d.classList.add('out'), 3600); setTimeout(() => d.remove(), 4200);
  }
  function floatText(txt, cls = '') { const d = document.createElement('div'); d.className = 'float ' + cls; d.textContent = txt; $('#floats').appendChild(d); setTimeout(() => d.remove(), 1600); }
  function updateMoney() { $('#money').textContent = save.money + ' $'; if (save.money >= 200) ach.unlock('rich'); }
  updateMoney();

  // ---- time, seasons, weather
  let clockH = params.has('t') ? +params.get('t') : (save.hour ?? 9), timeSpeed = 1 / 60, season = params.get('season') || 'autumn';
  if (params.get('weather')) weather.set(params.get('weather'));
  function cycleTime() { const nx = JUMP_TO.find((t) => t > clockH + 0.05) ?? JUMP_TO[0]; clockH = nx; sfx.blip(); }
  function cycleSeason() { season = SEASONS[(SEASONS.indexOf(season) + 1) % SEASONS.length]; updateButtons(); sfx.blip(); }
  function updateButtons() {
    $('#btnSeason').dataset.v = season;
    $('#btnSeason').title = { summer: 'Été', autumn: 'Automne', winter: 'Hiver' }[season] + ' (Y)';
    $('#btnWeather').dataset.v = weather.state;
    $('#btnWeather').title = { clear: 'Soleil', cloudy: 'Nuageux', rain: 'Pluie / neige' }[weather.state] + ' (R)';
  }
  $('#btnTime').onclick = cycleTime; $('#btnSeason').onclick = cycleSeason; $('#btnWeather').onclick = () => { weather.cycle(); updateButtons(); sfx.blip(); };
  updateButtons();
  const particles = makeParticles(scene);
  let look = lookAt(clockH);
  function updateLook(dt) {
    look = lookAt(clockH);
    const ws = weather.state, dim = ws === 'clear' ? 1 : ws === 'cloudy' ? 0.62 : 0.4;
    const grey = new THREE.Color(0x9aa6b8).multiplyScalar(0.35 + 0.65 * (1 - look.night));
    const mixG = (c, k) => c.clone().lerp(grey, k * (1 - dim));
    sun.color.copy(look.sunC); sun.intensity = look.sunI * dim;
    hemi.color.copy(mixG(look.sky, 0.6)); hemi.groundColor.copy(look.gnd); hemi.intensity = look.hemiI * (1 + (1 - dim) * 0.35);
    const su = sky.material.uniforms;
    su.uZen.value.copy(mixG(look.zen, 0.8)); su.uHor.value.copy(mixG(look.hor, 0.7)); su.uSunCol.value.copy(look.sunC).multiplyScalar(dim); su.uSun.value.copy(look.sunDir);
    su.uCloudCol.value.copy(mixG(look.cloud, 0.6)); su.uCloudShade.value.copy(mixG(look.shade, 0.8)); su.uCloud.value = weather.cover;
    scene.fog.color.copy(mixG(look.fog, 0.75)); scene.fog.near = ws === 'rain' ? 60 : 150; scene.fog.far = ws === 'rain' ? 420 : 720;
    U.uNight.value = look.night;
    pipe.U.uInk.value.copy(look.ink); pipe.U.uSun.value.copy(look.lightDir); pipe.U.uCloud.value = (1 - look.night) * dim * (ws === 'cloudy' ? 1.3 : 1);
    const k = 1 - Math.exp(-dt * 2.2);
    const snowT = season === 'winter' ? 1 : 0, autT = season === 'autumn' ? 1 : 0;
    U.uSnow.value += (snowT - U.uSnow.value) * k; U.uAutumn.value += (autT - U.uAutumn.value) * k;
    world.trees.setWinter(U.uSnow.value > 0.5);
    world.backdrop.crossM.emissiveIntensity = look.night * 1.6;
    particles.mode(season, weather.precip);
    const p = player.pos, d = look.lightDir, S = 90 / sun.shadow.mapSize.x;
    const right = new THREE.Vector3().crossVectors(d, new THREE.Vector3(0, 1, 0)).normalize(), up = new THREE.Vector3().crossVectors(right, d).normalize();
    const c = p.clone(); const a = Math.round(c.dot(right) / S) * S - c.dot(right), b = Math.round(c.dot(up) / S) * S - c.dot(up);
    c.addScaledVector(right, a).addScaledVector(up, b);
    sun.target.position.copy(c); sun.position.copy(c).addScaledVector(d, 120);
    $('#clock').textContent = fmtHour(clockH);
    $('#btnTime').dataset.v = look.night > 0.6 ? 'night' : (clockH > 17.5 && clockH < 21) || (clockH > 5 && clockH < 7.5) ? 'golden' : 'day';
  }

  // ---- audio + settings
  function toggleSound() { const on = sfx.toggle(); $('#btnSound').classList.toggle('off', !on); }
  $('#btnSound').onclick = toggleSound;
  const setting = (id, get, set) => { const el = $(id); const upd = () => el.classList.toggle('on', get()); el.onclick = (e) => { e.stopPropagation(); set(!get()); upd(); }; upd(); };
  setting('#setVoice', () => voice.on, (v) => { voice.on = v; save.voice = v; writeSave(save); if (!v) voice.stop(); });
  setting('#setBloom', () => pipe.bloomOn, (v) => { pipe.bloomOn = v; });
  setting('#setAO', () => pipe.aoOn, (v) => { pipe.aoOn = v; });
  setting('#setFast', () => timeSpeed > 0.05, (v) => { timeSpeed = v ? 0.2 : 1 / 60; });
  setting('#setFreeze', () => timeSpeed === 0, (v) => { timeSpeed = v ? 0 : 1 / 60; });
  $('#setReset').onclick = (e) => { e.stopPropagation(); if (confirm('Effacer ta progression?')) { localStorage.removeItem('plateau-montreal-v2'); location.reload(); } };

  // ---- photo mode
  let photoMode = false, filter = 0, shot = false, pose = false;
  const FILTERS = ['Normal', 'Manga', 'Pellicule'];
  function togglePhoto() { photoMode = !photoMode; document.body.classList.toggle('photo', photoMode); if (!photoMode) { pipe.U.uFilter.value = 0; } else { pipe.U.uFilter.value = filter; } sfx.blip(); }
  function cycleFilter() { filter = (filter + 1) % FILTERS.length; pipe.U.uFilter.value = filter; $('#pfName').textContent = FILTERS[filter]; sfx.blip(); }
  function snap() { shot = true; pipe.U.uFlash.value = 1; sfx.shutter(); }
  $('#btnPhoto').onclick = togglePhoto; $('#pFilter').onclick = cycleFilter; $('#pSnap').onclick = snap; $('#pExit').onclick = togglePhoto; $('#pPose').onclick = () => { pose = !pose; };
  $('#btnHelp').onclick = () => $('#help').classList.toggle('show');
  $('#help').onclick = (e) => { if (e.target.id === 'help') $('#help').classList.remove('show'); };
  $('#btnJournal').onclick = () => { $('#journal').classList.toggle('show'); drawJournal(); };
  $('#journal').onclick = (e) => { if (e.target.id === 'journal') $('#journal').classList.remove('show'); };
  function drawJournal() {
    $('#jStats').innerHTML = `<div><b>${bagels.count}/12</b><small>bagels</small></div><div><b>${save.deliveries}</b><small>livraisons</small></div><div><b>${save.money} $</b><small>pourboires</small></div><div><b>${Object.keys(save.met).length}</b><small>voisins</small></div>`;
    $('#jAch').innerHTML = Object.entries(ACH).map(([id, [ic, name, desc]]) => `<li class="${save.ach[id] ? 'got' : ''}"><i>${ic}</i><b>${name}</b><small>${desc}</small></li>`).join('');
  }

  // ---- minimap
  const mm = makeMinimap(world);

  // ---- resize
  function resize() { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); pipe.setSize(innerWidth, innerHeight, renderer.getPixelRatio()); }
  addEventListener('resize', resize); resize();

  // ---- start screen
  let started = params.has('play');
  const begin = () => { started = true; document.body.classList.add('playing'); sfx.start(); $('#btnSound').classList.remove('off'); setTimeout(() => areaToast('Rue Saint-Denis'), 600); if (!save.deliveries && !params.has('play')) setTimeout(() => say('Tutoriel', 'Bienvenue sur le Plateau! Entre dans un commerce (E) pour prendre une livraison, cherche les 12 bagels dorés, et prends un BIXI pour aller plus vite.'), 2500); };
  $('#play').onclick = begin;
  if (save.deliveries || save.bagels.length) $('#play').textContent = 'Continuer ▸';
  if (started) document.body.classList.add('playing');

  // ---- loop
  const clock = new THREE.Clock();
  let saveT = 0;
  const onGet = (B) => {
    const i = bagels.list.indexOf(B); if (!save.bagels.includes(i)) save.bagels.push(i); writeSave(save);
    $('#bCount').textContent = bagels.count; $('#counter').classList.remove('pop'); void $('#counter').offsetWidth; $('#counter').classList.add('pop');
    sfx.collect(1 + bagels.count * 0.04); burst.at(B.g.position); floatText('+1 🥯');
    ach.unlock('firstBagel');
    if (bagels.count === bagels.list.length) { ach.unlock('allBagels'); setTimeout(() => { $('#win').classList.add('show'); sfx.fanfare(); }, 900); }
  };
  $('#bCount').textContent = bagels.count;
  $('#winClose').onclick = () => $('#win').classList.remove('show');
  const arrowV = new THREE.Vector3();
  function frame(dtOverride) {
    const dt = typeof dtOverride === 'number' ? dtOverride : Math.min(clock.getDelta(), 1 / 20);
    if (typeof dtOverride === 'number') clock.elapsedTime += dt;
    const t = clock.elapsedTime;
    U.uTime.value = t;
    clockH = (clockH + dt * timeSpeed) % 24;
    weather.update(dt, season);
    readInput();
    if (!started || photoMode) { inp.x = inp.y = 0; inp.jump = false; inp.dash = false; if (!started) cam.yaw += dt * 0.05; }
    const stepped = player.update(dt, inp, cam.yaw);
    if (photoMode && pose) hero.animate(0, 0, true, 1, { parcel: player.parcel });
    if (stepped) { sfx.step(season === 'winter' ? 'snow' : weather.wet > 0.5 ? 'wet' : 'dry'); if (player.speed > 4 || season === 'winter' || weather.wet > 0.5) puffs.at(player.pos, season === 'winter' ? 0xf2f6ff : weather.wet > 0.5 ? 0xbfd8ff : 0xd9cdb8, 3); }
    if (player.jumped) { sfx.jump(); player.jumped = false; }
    if (player.landed) { sfx.land(); puffs.ring(player.pos, season === 'winter' ? 0xf2f6ff : 0xd9cdb8); player.landed = false; }
    if (player.fx.doubled) { player.fx.doubled = false; sfx.jump(1.5); puffs.ring(player.pos, 0xffffff); ach.unlock('flip'); }
    if (player.fx.dashed) { player.fx.dashed = false; sfx.dash(); }
    if (player.fx.glide) { player.fx.glide = false; ach.unlock('glide'); }
    if (player.bumped) { player.bumped = false; if (player.speed > 4) sfx.land(); }
    npcs.update(dt, player, { hour: clockH, rain: weather.precip === 'rain' });
    traffic.update(dt, player, npcs.list.filter((n) => n.out));
    if (pigeons.update(dt, player)) sfx.flap();
    cat.update(t);
    bagels.update(dt, player, onGet);
    burst.update(dt); puffs.update(dt);
    particles.update(dt, camera.position);
    // deliveries
    const dl = deliveries.update(dt, player);
    if (dl && dl.done) {
      player.parcel = false; save.money += dl.tip; save.deliveries++; save.best = Math.max(save.best, dl.combo); writeSave(save); updateMoney();
      sfx.collect(1.25); burst.at(player.pos.clone().setY(player.pos.y + 1));
      floatText(`+${dl.tip} $`, 'money'); if (dl.combo > 1) setTimeout(() => floatText(`Combo ×${dl.combo}!`, 'combo'), 300);
      say(dl.job.who, dl.late ? 'Enfin! C\'est un peu en retard, mais merci quand même.' : dl.fast ? 'Déjà?! Wow, merci! Voici un beau pourboire.' : 'Merci beaucoup! Bonne journée!', 5);
      ach.unlock('firstDelivery'); if (save.deliveries >= 10) ach.unlock('tenDeliveries'); if (dl.fast) ach.unlock('speedy');
    }
    const job = deliveries.job;
    document.body.classList.toggle('onjob', !!job);
    if (job) {
      $('#jobWho').textContent = `${job.item} → ${job.who}`; $('#jobAddr').textContent = job.addr;
      $('#jobTime').textContent = job.left > 0 ? `${Math.ceil(job.left)} s` : 'En retard!';
      $('#jobBar').style.width = Math.max(0, job.left / job.time * 100) + '%';
      $('#jobBar').classList.toggle('late', job.left < job.time * 0.25);
      const d = Math.hypot(job.target.x - player.pos.x, job.target.z - player.pos.z);
      $('#jobDist').textContent = d < 1000 ? `${Math.round(d)} m` : '';
      // edge-of-screen arrow toward the drop-off
      arrowV.copy(job.target).setY(job.target.y + 1).project(camera);
      const behind = arrowV.z > 1;
      let ax = arrowV.x, ay = arrowV.y; if (behind) { ax = -ax; ay = -ay; }
      const on = !behind && Math.abs(ax) < 0.92 && Math.abs(ay) < 0.88;
      const a = $('#arrow');
      if (on) { a.style.transform = `translate(${(ax * 0.5 + 0.5) * innerWidth}px, ${(-ay * 0.5 + 0.5) * innerHeight}px) translate(-50%,-120%)`; a.classList.add('on'); }
      else { const ang = Math.atan2(-ay, ax), m = Math.min(innerWidth, innerHeight) * 0.42; a.style.transform = `translate(${innerWidth / 2 + Math.cos(ang) * m * innerWidth / Math.min(innerWidth, innerHeight) * 0.9}px, ${innerHeight / 2 + Math.sin(ang) * m}px) translate(-50%,-50%) rotate(${ang + Math.PI / 2}rad)`; a.classList.remove('on'); }
    }
    sfx.intensity(job ? (job.left < job.time * 0.25 ? 2 : 1) : 0);
    sfx.rain(weather.precip === 'rain' ? weather.wet : 0);
    // achievements tied to the world
    if (started && (clockH >= 22 || clockH < 4)) ach.unlock('night');
    if (started && season === 'winter' && player.speed > 1) ach.unlock('snow');
    updateLook(dt);
    updateCamera(dt, t);
    // speed lines + flash
    const sp = Math.max(player.dashT > 0 ? 1 : 0, Math.min(1, Math.max(0, (player.speed - 6.5) / 4)));
    pipe.U.uSpeed.value += (sp - pipe.U.uSpeed.value) * (1 - Math.exp(-dt * 8));
    pipe.U.uFlash.value = Math.max(0, pipe.U.uFlash.value - dt * 3);
    // nearest interactable
    let best = null, bd = 2.6;
    if (started && !photoMode) for (const o of talkables()) { const d = Math.hypot(o.x - player.pos.x, o.z - player.pos.z); if ((d < bd || o.label === 'Descendre du vélo') && Math.abs(o.y - player.pos.y) < 2.2) { bd = d; best = o; } }
    near = best;
    const prm = $('#prompt');
    if (best && !$('#say').classList.contains('show')) { $('#promptText').textContent = best.label; prm.classList.add('show'); } else prm.classList.remove('show');
    if ($('#say').classList.contains('show') && best === null && clock.elapsedTime - +$('#say').dataset.at > 2.5 && player.speed > 1) closeSay();
    const w = whereIs(player.pos.x, player.pos.z);
    if (w.name && w.name !== lastArea && started) { lastArea = w.name; areaToast(w.name); }
    $('#boostCafe').classList.toggle('show', player.boost > 0); $('#boostJump').classList.toggle('show', player.jumpBoost > 0);
    $('#onBike').classList.toggle('show', !!player.bike);
    mm.draw(player, cam.yaw, bagels.list, job?.target);
    sfx.ambience(look.night, season, weather.precip);
    saveT += dt; if (saveT > 10) { saveT = 0; save.hour = clockH; writeSave(save); }
    cullFar();
    pipe.render();
    if (shot) { shot = false; const a = document.createElement('a'); a.download = `plateau-montreal-${Date.now()}.png`; a.href = renderer.domElement.toDataURL('image/png'); a.click(); }
  }
  function cullFar() {
    const cp = camera.position;
    for (const n of npcs.list) if (n.out) n.ch.root.visible = n.ch.root.position.distanceTo(cp) < 150;
    for (const c of traffic.cars) c.m.g.visible = c.m.g.position.distanceTo(cp) < 260;
    for (const ch of world.city.children) { const s = ch.geometry.boundingSphere; ch.visible = Math.hypot(s.center.x - cp.x, s.center.z - cp.z) - s.radius < 760; }
  }
  app.frame = frame;
  Object.assign(app, { say, interact, inp, setTime: (h2) => { clockH = typeof h2 === 'number' ? h2 : { day: 13, golden: 18.4, night: 22.5, dawn: 6.5, dusk: 19.8 }[h2]; }, setSeason: (s) => { season = s; updateButtons(); }, setWeather: (s) => { weather.set(s); weather.wet = s === 'rain' && season !== 'winter' ? 1 : 0; updateButtons(); }, near: () => near, talkables, togglePhoto, cycleFilter, keys, setOutfit });
  app.stats = () => ({ calls: renderer.info.render.calls, colliders: world.colliders.list.length, bagels: bagels.list.length, hour: +clockH.toFixed(2), money: save.money });
  $('#loader').classList.add('done'); setTimeout(() => $('#loader').remove(), 900);
  window.__ready = true;
  if (!params.has('manual')) renderer.setAnimationLoop(() => frame());
}

// ================================================================= dust, snow and splash puffs
function makePuffs(scene) {
  const N = 120, g = new THREE.IcosahedronGeometry(0.12, 0);
  const mesh = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false }), N);
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3); mesh.count = 0; mesh.layers.set(LAYER_FX); mesh.frustumCulled = false; scene.add(mesh);
  const parts = [], m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color(), sc = new THREE.Vector3();
  const add = (p, v, c, life) => { parts.push({ p, v, c, t: 0, life }); if (parts.length > N) parts.shift(); };
  return {
    at(pos, c, n) { for (let i = 0; i < n; i++) add(pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.3, 0.05, (Math.random() - 0.5) * 0.3)), new THREE.Vector3((Math.random() - 0.5) * 0.8, 0.6 + Math.random() * 0.6, (Math.random() - 0.5) * 0.8), c, 0.5); },
    ring(pos, c) { for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; add(pos.clone().add(new THREE.Vector3(0, 0.08, 0)), new THREE.Vector3(Math.cos(a) * 2.6, 0.4, Math.sin(a) * 2.6), c, 0.45); } },
    update(dt) {
      let n = 0;
      for (const p of parts) {
        p.t += dt; if (p.t > p.life) continue;
        p.v.multiplyScalar(1 - dt * 4); p.p.addScaledVector(p.v, dt);
        const s = (1 - p.t / p.life) * (0.6 + p.t * 3);
        m4.compose(p.p, q, sc.set(s, s, s)); mesh.setMatrixAt(n, m4); mesh.setColorAt(n, col.set(p.c)); n++;
      }
      mesh.count = n; mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    },
  };
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
void main(){ vS = aSeed; float fall = uMode > 2.5 ? 14.0 : uMode > 1.5 ? 1.1 : 0.7;
  vec3 p = position; p.y = mod(p.y - uTime * fall * (0.6 + aSeed), 30.0); p.x += sin(uTime * 0.8 + aSeed * 30.0) * (uMode > 1.5 ? 0.6 : 1.4);
  p.xz = mod(p.xz - uCam.xz + 30.0, 60.0) - 30.0 + uCam.xz; p.y += uCam.y - 10.0;
  vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
  gl_PointSize = (uMode > 2.5 ? 160.0 : uMode > 1.5 ? 70.0 : 90.0) * (0.5 + aSeed) / -mv.z; vA = smoothstep(0.5, 3.0, -mv.z) * (1.0 - smoothstep(22.0, 30.0, -mv.z)); }`,
    fragmentShader: `uniform float uMode, uNight; varying float vS; varying float vA;
void main(){ vec2 c = gl_PointCoord - 0.5; float a;
  vec3 col;
  if (uMode > 2.5) { a = (1.0 - smoothstep(0.0, 0.05, abs(c.x))) * 0.55; col = mix(vec3(0.85, 0.9, 1.0), vec3(0.5, 0.6, 0.85), uNight); }
  else if (uMode > 1.5) { a = 1.0 - smoothstep(0.2, 0.5, length(c)); col = mix(vec3(1.0), vec3(0.6, 0.7, 0.95), uNight * 0.6); }
  else { float r = abs(c.x) + abs(c.y) * 1.6; a = 1.0 - smoothstep(0.35, 0.45, r); col = vS < 0.5 ? vec3(0.9, 0.4, 0.15) : vec3(0.96, 0.7, 0.2); col *= 1.0 - uNight * 0.6; }
  if (a < 0.05) discard; gl_FragColor = vec4(col, a * vA); }`,
    transparent: true, depthWrite: false,
  });
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.layers.set(LAYER_FX); scene.add(pts);
  return {
    mode(s, precip) {
      const md = precip === 'rain' ? 3 : (precip === 'snow' || precip === 'flurries') ? 2 : s === 'autumn' ? 1 : 0;
      m.uniforms.uMode.value = md; pts.visible = md > 0;
      g.setDrawRange(0, md === 3 ? N : md === 2 ? (precip === 'snow' ? N : 700) : 260);
    },
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
    draw(player, yaw, bagels, target) {
      x.clearRect(0, 0, W, H);
      x.save(); x.beginPath(); x.arc(W / 2, H / 2, W / 2 - 3, 0, 7); x.clip();
      x.fillStyle = '#cfe6b6'; x.fillRect(0, 0, W, H);
      x.translate(W / 2, H / 2); x.rotate(yaw); const sc = 1.1;
      x.scale(sc / S, sc / S); x.translate(-(player.pos.x - X0) * S, -(player.pos.z - Z0) * S);
      x.drawImage(base, 0, 0);
      if (target) { const tx = (target.x - X0) * S, tz = (target.z - Z0) * S; x.strokeStyle = 'rgba(40,200,230,.9)'; x.lineWidth = 5; x.setLineDash([10, 8]); x.beginPath(); x.moveTo((player.pos.x - X0) * S, (player.pos.z - Z0) * S); x.lineTo(tx, tz); x.stroke(); x.setLineDash([]); x.fillStyle = '#2fd0ee'; x.strokeStyle = '#fff'; x.lineWidth = 4; x.beginPath(); x.arc(tx, tz, 11, 0, 7); x.fill(); x.stroke(); }
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
  let drums = null, drumT = null, level = 0, rainG = null;
  function drumLoop() {
    const beat = 60 / 76 / 2; let t = A.currentTime + 0.05, i = 0;
    drumT = setInterval(() => { while (t < A.currentTime + 0.6) { if (level > 0) { if (i % 4 === 0) { const o = A.createOscillator(), g = A.createGain(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12); env(g, t, 0.003, 0.18, 0.12 * level); o.connect(g).connect(drums); o.start(t); o.stop(t + 0.25); } if (i % 2 === 1 || level > 1) noiseTo(drums, t, 0.03, 0.025 * level, 8000); } t += beat; i++; } }, 150);
  }
  const noiseTo = (dest, t, d, peak, f) => { const len = Math.floor(A.sampleRate * d), buf = A.createBuffer(1, len, A.sampleRate), ch = buf.getChannelData(0); for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1; const s = A.createBufferSource(); s.buffer = buf; const fl = A.createBiquadFilter(); fl.type = 'highpass'; fl.frequency.value = f; const g = A.createGain(); env(g, t, 0.002, d, peak); s.connect(fl).connect(g).connect(dest); s.start(t); };
  return {
    intensity(l) { level = l; },
    rain(v) { if (!A) return; if (!rainG) { const len = A.sampleRate * 2, buf = A.createBuffer(1, len, A.sampleRate), ch = buf.getChannelData(0); for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1; const s = A.createBufferSource(); s.buffer = buf; s.loop = true; const fl = A.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 2600; rainG = A.createGain(); rainG.gain.value = 0; s.connect(fl).connect(rainG).connect(master); s.start(); } rainG.gain.setTargetAtTime(on ? v * 0.09 : 0, A.currentTime, 0.5); },
    dash() { if (!A || !on) return; noise(A.currentTime, 0.18, 0.12, 1200, 0.5); },
    start() { if (A) return; A = new (window.AudioContext || window.webkitAudioContext)(); master = A.createGain(); master.gain.value = 0.9; master.connect(A.destination); music = A.createGain(); music.gain.value = 1; music.connect(master); drums = A.createGain(); drums.connect(master); on = true; schedule(); drumLoop(); },
    toggle() { if (!A) { this.start(); return true; } on = !on; master.gain.setTargetAtTime(on ? 0.9 : 0, A.currentTime, 0.1); return on; },
    step(kind) { if (!A || !on) return; noise(A.currentTime, 0.06, kind === 'snow' ? 0.12 : kind === 'wet' ? 0.1 : 0.07, kind === 'snow' ? 900 : kind === 'wet' ? 2600 : 1600, 0.8); },
    jump(p = 1) { if (!A || !on) return; const t = A.currentTime; const o = A.createOscillator(), g = A.createGain(); o.frequency.setValueAtTime(320 * p, t); o.frequency.exponentialRampToValueAtTime(640 * p, t + 0.12); env(g, t, 0.01, 0.12, 0.05); o.connect(g).connect(master); o.start(t); o.stop(t + 0.2); },
    land() { if (!A || !on) return; noise(A.currentTime, 0.1, 0.12, 400, 0.7); },
    blip() { if (!A || !on) return; tone(880 + Math.random() * 120, A.currentTime, 0.04, 0.025, 'square'); },
    collect(p = 1) { if (!A || !on) return; const t = A.currentTime; [0, 4, 7, 12].forEach((s, i) => tone(mf(72 + s) * p, t + i * 0.07, 0.3, 0.07, 'triangle')); },
    fanfare(v = 1) { if (!A || !on) return; const t = A.currentTime; [0, 4, 7, 12, 7, 12, 16].forEach((s, i) => tone(mf(67 + s), t + i * 0.12, 0.5, 0.08 * v, 'triangle')); },
    bell(kind = 0) { if (!A || !on) return; const t = A.currentTime; if (kind) { for (let i = 0; i < kind; i++) { tone(2100, t + i * 0.16, 0.5, 0.05); tone(2650, t + i * 0.16, 0.4, 0.03); } return; } for (const [f, a] of [[196, 0.12], [392, 0.06], [494, 0.04], [588, 0.03]]) tone(f, t, 4, a); },
    meow() { if (!A || !on) return; const t = A.currentTime, o = A.createOscillator(), g = A.createGain(); o.type = 'sawtooth'; o.frequency.setValueAtTime(620, t); o.frequency.linearRampToValueAtTime(880, t + 0.15); o.frequency.linearRampToValueAtTime(520, t + 0.45); const fl = A.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.value = 1400; fl.Q.value = 3; env(g, t, 0.05, 0.45, 0.06); o.connect(fl).connect(g).connect(master); o.start(t); o.stop(t + 0.6); },
    flap() { if (!A || !on) return; for (let i = 0; i < 6; i++) noise(A.currentTime + i * 0.05, 0.05, 0.05, 700, 0.6); },
    shutter() { if (!A || !on) return; noise(A.currentTime, 0.05, 0.2, 3000, 0.5); noise(A.currentTime + 0.08, 0.05, 0.15, 2000, 0.5); },
    ambience(night, season, precip) {
      if (!A || !on || precip) return;
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
