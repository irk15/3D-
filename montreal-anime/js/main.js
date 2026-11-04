// main.js — Plateau · Montréal: boot, camera, input, interactions, the living-world systems and HUD.
import * as THREE from 'three';
import { h, U, WATERS, whereIs, PARK, PLAZA, WATER_Y, RIVER_Z, nsX, ewZ, nsHW, nsSW, ewHW, ewSW, alleyX, ALLEY_HW } from './layout.js';
import { Pipeline, makeSky, LAYER_FX, REAL, realifyScene } from './toon.js';
import { buildWorld } from './world.js';
import { makeCharacter, Player, Neighbours, Traffic, Pigeons, makeCat, Bagels, bikeModel } from './actors.js';
import { lookAt, fmtHour, Weather, loadSave, writeSave, Achievements, ACH, Voice, dialogue, Deliveries, OUTFITS } from './systems.js';
import { Net, Offline, randomCode } from './net.js';
import { loadRigs, MODELS } from './rig.js';
import { Missions, COLORS, KINDS } from './missions.js';
import { findRoofs, roofProps, makeClouds, Trail } from './sky.js';
import { buildDowntown } from './downtown.js';
import { Props } from './physics.js';
import { Vehicle } from './vehicle.js';
import { Crowd } from './crowd.js';
import { Combat, WEAPONS } from './combat.js';
import { Police } from './police.js';
import { Pickups } from './pickups.js';
import { buildCities, CITIES, cityAt } from './cities.js';
import { Walkers } from './population.js';
import { Activities } from './activities.js';
import { Breakables } from './breakables.js';
import { carDrivable } from './cars.js';

const $c = {};
const $ = (s) => $c[s] || ($c[s] = document.querySelector(s));   // HUD elements are looked up once
const params = new URLSearchParams(location.search);
const touch = matchMedia('(pointer: coarse)').matches;
const SEASONS = ['summer', 'autumn', 'winter'];
const JUMP_TO = [8, 13, 18.3, 19.7, 22.5];

async function boot() {
  try { await Promise.race([document.fonts.load('600 40px Fredoka'), new Promise((r) => setTimeout(r, 2500))]); } catch (e) { /* offline font */ }
  const app = window.app = { THREE, U };
  const save = app.save = params.has('fresh') ? loadSave.call(null) && Object.assign(loadSave(), { bagels: [], money: 0, deliveries: 0, met: {}, ach: {}, outfit: 0, owned: [0] }) : loadSave();
  const pr = Math.min(window.devicePixelRatio || 1, touch ? 1.25 : 1.5);
  const renderer = new THREE.WebGLRenderer({ canvas: $('#gl'), antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(pr); renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.NoToneMapping;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = !touch && !new URLSearchParams(location.search).has('anime') ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
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

  $('#loadMsg').textContent = 'Building the Plateau…';
  await new Promise((r) => setTimeout(r, 30));
  const world = app.world = buildWorld(scene);
  const roofs = app.roofs = findRoofs(world);
  roofProps(scene, world, roofs);
  const clouds = makeClouds(scene);
  $('#loadMsg').textContent = 'Downtown, the Stadium, the river…';
  await new Promise((r) => setTimeout(r, 20));
  const downtown = app.downtown = buildDowntown(scene, world);
  $('#loadMsg').textContent = 'Toronto and Ottawa…';
  await new Promise((r) => setTimeout(r, 20));
  const cities = app.cities = buildCities(scene, world);
  const pipe = app.pipe = new Pipeline(renderer, scene, camera);
  const _white = new THREE.Color(1, 0.98, 0.95), _warm = new THREE.Color(0.55, 0.5, 0.45);
  // realistic mode: a sky-only scene feeds the reflections (PMREM), refreshed as the day goes by
  const pmrem = new THREE.PMREMGenerator(renderer), envScene = new THREE.Scene(), envSky = new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), null);
  envScene.add(envSky); let envRT = null, envT = 0, realFr = 0;
  if (REAL) document.body.classList.add('real');
  if (touch) pipe.aoOn = false;

  // ---- characters: Mixamo models (falls back to the procedural ones if the files can't load)
  if (!params.has('procedural')) {
    $('#loadMsg').textContent = 'Characters arriving…';
    try { await loadRigs('models/', (f) => { $('#loadMsg').textContent = `Characters arriving… ${Math.round(f * 100)}%`; }); } catch (e) { console.warn('[rig] Mixamo models unavailable, using procedural characters', e); }
  }
  if (!MODELS[save.model]) save.model = 'bot';
  const optsFor = (outfit, color, model = 'bot') => { const o = { ...(OUTFITS[outfit]?.o || {}) }; const c = COLORS[color | 0] || COLORS[0]; o.pack = c; if (o.scarf !== null) o.scarf = c; o.model = MODELS[model] ? model : 'bot'; o.top = c; o.pants = '#2b2550'; return o; };
  let hero = makeCharacter(optsFor(save.outfit, save.color, save.model)); scene.add(hero.root);
  const player = app.player = new Player(world, hero);
  const npcs = app.npcs = new Neighbours(scene, world);
  const lanes = [];
  { const T = CITIES.toronto, O = CITIES.ottawa, ns = (k, n, span, o = {}) => { for (const d of [-1, 1]) lanes.push({ axis: 'z', c: nsX(k) + d * 2.3, dir: -d, n, k, span, ...o }); }, ew = (m, n, span, o = {}) => { for (const d of [-1, 1]) lanes.push({ axis: 'x', c: ewZ(m) + d * 2.3, dir: d, n, m, span, ...o }); };
    const tz = [ewZ(T.m0) - 30, ewZ(T.m1) + 30], tx = [nsX(T.k0) - 20, nsX(T.k1) + 20];
    for (const k of [36, 39, 40, 41, 43, 45]) ns(k, 3, tz);
    for (const m of [-4, 0, 3, 4]) ew(m, 3, tx);
    for (const m of [1, 2]) ew(m, 2, tx, { bus: '#d8262b', vmax: 9 });   // red TTC streetcars on Queen and King
    const oz = [ewZ(O.m0) - 30, ewZ(O.m1) - 4], ox = [nsX(O.k0) - 20, nsX(O.k1) + 20];
    for (const k of [-43, -42, -40, -36]) ns(k, 2, oz);
    for (const m of [-3, 0, 2]) ew(m, 2, ox);
    ew(-1, 2, ox, { bus: '#c8102e', vmax: 9 }); }
  const traffic = app.traffic = new Traffic(scene, world, world.glows, lanes);
  { const L2 = []; for (const c of [CITIES.toronto, CITIES.ottawa]) for (let k = c.k0; k <= c.k1; k++) for (let m = c.m0; m <= c.m1; m++) L2.push({ x: nsX(k), z: ewZ(m), k, m }); traffic.cityLights(scene, L2); }
  player.carBlock = (x, z) => traffic.blocks(x, z) || app.vehicles.some((v) => v.hitCircle(x, z, 0.3));
  world.glows.commit();   // traffic head/tail-light glows were added after the world was built
  // ---- physics props, the crowd, and cars you can drive
  const props = app.props = new Props(scene, world);
  let jetT = 0;
  const breakables = app.breakables = new Breakables(scene, world, world.breakList, {
    hit: (it, sp) => { sfx.crash(Math.min(0.5, 0.15 + sp / 60)); puffs.at(new THREE.Vector3(it.x, it.y + 0.4, it.z), 0xd9cdb8, 4); },
    thud: (it) => { sfx.thud?.(0.35); },
    jet: (x, y, z, left) => { jetT -= 1 / 60; if (jetT > 0) return; jetT = 0.04; puffs.at(new THREE.Vector3(x + (Math.random() - 0.5) * 0.2, y + 0.6 + Math.random() * 1.6 * Math.min(1, left), z + (Math.random() - 0.5) * 0.2), 0xcfe8ff, 2); },
  });
  const crowd = app.crowd = new Crowd(scene, world);
  const walkers = app.walkers = new Walkers(scene, world, params.has('fewpeople') ? 8 : touch ? 14 : 28);
  const vehicles = app.vehicles = [];
  let screamT = 0; walkers.onScream = (p) => { const now = performance.now(); if (now - screamT < 700 || Math.random() < 0.5) return; screamT = now; const d = Math.hypot(p.pos.x - player.pos.x, p.pos.z - player.pos.z); if (d < 45) sfx.scream?.(Math.max(0.2, 1 - d / 45)); };
  walkers.carBlock = (x, z) => traffic.blocks(x, z) || vehicles.some((v) => v.hitCircle(x, z, 0.3));
  walkers.carNear = (x, z, r) => traffic.cars.some((c) => !c.taken && c.x !== undefined && Math.abs(c.x - x) < r && Math.abs(c.z - z) < r && c.v > 1) || vehicles.some((v) => v.speed > 1 && Math.abs(v.pos.x - x) < r && Math.abs(v.pos.z - z) < r);
  traffic.vehicles = vehicles;
  const spawnCar = (kind, col, x, z, yaw) => { const v = new Vehicle(scene, world, kind, col, x, z, yaw); for (let i = 0; i < 12 && v.blockedAt(v.pos.x, v.pos.z, v.yaw, vehicles); i++) { v.pos.x += 1.5; v.place(); } vehicles.push(v); return v; };
  { const px = (PLAZA.x0 + PLAZA.x1) / 2, pz = PLAZA.z0 + 18;
    spawnCar('sport', '#d0312d', px - 4, pz, 0); spawnCar('suv', '#2f3a44', px + 4, pz + 2, 0);
    spawnCar('sedan', '#2f7fbf', PARK.x1 - 4, PARK.z0 - 10, Math.PI / 2);
    if (world.pvmBeacon) spawnCar('sport', '#f2b43c', world.pvmBeacon.x + 52, world.pvmBeacon.z + 8, 0);
    for (const c of [CITIES.toronto, CITIES.ottawa]) { const [x, z] = c.spawn, k = Math.round(x / 90), sx = nsX(k) + 2.4; spawnCar('sport', c.key === 'toronto' ? '#1d4fa3' : '#c8102e', sx, z - 14, 0); spawnCar('suv', '#2f3a44', sx, z - 24, 0); spawnCar('sedan', '#e8e4dc', nsX(k + 1) - 2.4, z + 10, Math.PI); } }
  let car = null, carView = 'chase', carCam = { yaw: 0, look: 0 }, combat = null;
  function enterCar(v) {
    if (v.wreck) { areaToast('It\'s a burnt-out wreck'); return; }
    if (player.bike) player.dismount();
    player.flying = false; car = v; v.driver = hero; player.driving = true; player.vel.set(0, 0, 0);
    carCam.yaw = v.yaw + Math.PI; cam.yaw = carCam.yaw; sfx.door(); closeSay(); areaToast(v.kind === 'sport' ? '🏎️ Let\'s roll!' : '🚗 Let\'s roll!');
    $('#drive').classList.add('show'); ach.unlock('driver');
  }
  function exitCar() {
    if (!car) return;
    const v = car; car = null; v.driver = null; player.driving = false; sfx.door();
    const d = v.doorPos(); player.pos.set(d.x, world.colliders.ground(d.x, d.z, v.pos.y + 1.5, 0.15), d.z); player.visY = player.pos.y; player.grounded = true; player.vy = 0;
    player.unstick(); hero.root.position.copy(player.pos); player.yaw = v.yaw;
    $('#drive').classList.remove('show');
  }
  function takeParked(r) {
    world.parked.take(r);
    const v = new Vehicle(scene, world, r.kind, r.col, r.x, r.z, r.ry); vehicles.push(v); enterCar(v);
  }
  function takeTraffic(c) {
    traffic.take(c);
    const yaw = c.L.axis === 'z' ? (c.L.dir > 0 ? 0 : Math.PI) : (c.L.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    const v = new Vehicle(scene, world, c.kind, c.col, c.x, c.z, yaw); v.vF = c.v || 0; vehicles.push(v);
    // carjacking: the driver is dragged out and runs off; the police hear about it
    const sx = Math.cos(yaw), sz = -Math.sin(yaw), dx = c.x - sx * 2, dz = c.z - sz * 2, dr = crowd.add(dx, dz, yaw, 'stand', { y: world.colliders.ground(dx, dz, h(dz) + 2, 0.1) });
    dr.scare(c.x, c.z); dr.flee = 7; sfx.door(); police.crime(0.65, 'carjack', player.pos); floatText('Carjacked!', 'combo');
    say('Driver', ['Hey! That\'s my car!', 'Somebody call the police!', 'Not again… not on Saint-Denis!'][Math.random() * 3 | 0], 2); enterCar(v);
  }
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
    hero = makeCharacter(optsFor(i, save.color, save.model)); scene.add(hero.root); hero.root.position.copy(keep); hero.root.rotation.y = y;
    if (player.bike) { const b = player.bike; player.dismount(); player.c = hero; player.mountBike(b); } else player.c = hero;
    save.outfit = i; writeSave(save);
  }

  // ---- interactables
  const ctxNow = () => ({ hour: clockH, rain: weather.precip === 'rain', season, delivery: deliveries.job?.short, bagels: bagels.count });
  const talkables = () => {
    const out = [];
    if (car) { out.push({ x: player.pos.x, z: player.pos.z, y: player.pos.y, label: 'Get out of the car', act: exitCar }); return out; }
    for (const v of vehicles) { const d = v.doorPos(); out.push({ x: d.x, z: d.z, y: v.pos.y, label: v.kind === 'sport' ? '🏎️ Drive' : '🚗 Drive', act: () => enterCar(v) }); }
    { const tc = traffic.nearest(player.pos.x, player.pos.z); if (tc) out.push({ x: tc.x, z: tc.z, y: player.pos.y, label: '🚕 Take this car', act: () => takeTraffic(tc) }); }
    { const pc = world.parked.nearest(player.pos.x, player.pos.z); if (pc) out.push({ x: pc.x, z: pc.z, y: player.pos.y, label: '🚙 Drive this car', act: () => takeParked(pc) }); }
    for (const c of Object.values(CITIES)) { const [sx1, sz1] = c.station; if (Math.abs(sx1 - player.pos.x) < 30 && Math.abs(sz1 - player.pos.z) < 30) out.push({ x: sx1, z: sz1, y: world.colliders.ground(sx1, sz1, h(sz1) + 3, 0.1), label: '🚆 VIA Rail · travel to another city', act: () => openTravel() }); }
    if (player.bike) { out.push({ x: player.pos.x, z: player.pos.z, y: player.pos.y, label: 'Get off the bike', act: () => { player.dismount(); sfx.blip(); } }); return out; }
    for (const n of npcs.list) if (n.out) out.push({ x: n.pos.x, z: n.pos.z, y: n.pos.y, label: `Talk to ${n.name}`, act: () => talkTo(n) });
    for (const s of world.shops) out.push({ x: s.x, z: s.z, y: h(s.z), label: shopLabel(s), act: () => shopAct(s) });
    for (const d of world.docks) out.push({ x: d.x, z: d.z, y: h(d.z) + 0.15, label: 'Take a BIXI', act: () => { player.mountBike(bikeModel()); ach.unlock('bixi'); sfx.bell(); say(d.name, (isTouch ? 'Enjoy the ride! Use the Saint-Denis bike lane. Tap the bubble to get off, 🔔 for the bell.' : 'Enjoy the ride! Use the Saint-Denis bike lane. (E to get off, B for the bell)')); } });
    out.push({ x: cat.g.position.x, z: cat.g.position.z, y: cat.g.position.y, label: 'Pet the cat', act: () => { say('The cat', 'Meow! ♥  (It purrs and blinks slowly.)', 3); sfx.meow(); ach.unlock('cat'); } });
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
    if (s.kind === 'church') return 'Listen to the bells';
    if (s.kind === 'cafe') return 'Order a coffee';
    if (s.kind === 'bakery') return 'Buy a croissant';
    if (s.kind === 'thrift') return 'Try on clothes';
    return deliveries.job ? `Enter · ${s.name}` : `📦 Delivery · ${s.name}`;
  }
  function shopAct(s) {
    if (s.kind === 'cafe') { player.boost = 30; say(s.name, 'One long black to go! ☕ You run faster for 30 seconds.'); sfx.collect(1.3); return; }
    if (s.kind === 'bakery') { player.jumpBoost = 30; say(s.name, 'A butter croissant! 🥐 You jump much higher for 30 seconds.'); sfx.collect(1.2); return; }
    if (s.kind === 'church') { say(s.name, s.line); sfx.bell(); return; }
    if (s.kind === 'thrift') return wardrobe(s);
    if (deliveries.job) { say(s.name, s.line); return; }
    const job = deliveries.offer(s, player.pos);
    if (!job) { say(s.name, 'Nothing to deliver right now. Come back later!'); return; }
    deliveries.start(job); player.parcel = true; sfx.collect(0.9);
    say(s.name, `Can you deliver ${job.item} to ${job.who}, at ${job.addr}${job.balcony ? ' (on the balcony)' : ''}? You have ${job.time} seconds. Follow the blue light!`);
  }
  let wardI = save.outfit;
  function wardrobe(s) {
    wardI = (wardI + 1) % OUTFITS.length;
    const O = OUTFITS[wardI], owned = save.owned.includes(wardI);
    if (owned) { setOutfit(wardI); say(s.name, `You\'re wearing "${O.name}". Come back to switch again!`); return; }
    if (save.money >= O.price) { save.money -= O.price; save.owned.push(wardI); setOutfit(wardI); ach.unlock('style'); say(s.name, `Sold! "${O.name}" for $${O.price}. It suits you.`); sfx.collect(1.1); updateMoney(); }
    else say(s.name, `"${O.name}" costs $${O.price}. Do a few deliveries and come back! (You have $${save.money}.)`);
  }

  // ---- camera rig
  const cam = app.cam = { yaw: 0, pitch: 0.28, dist: 5.2, cur: 5.2, lastInput: -10, target: new THREE.Vector3(), fov: 52, flyK: 0 };
  const pitchMin = () => (player.flying ? -0.9 : combat?.armed ? -0.7 : -0.25);
  function updateCamera(dt, t) {
    if (car) return carCamera(dt, t);
    if (camera.near < 0.2) { camera.near = 0.25; camera.updateProjectionMatrix(); }
    const p = hero.root.position;
    cam.target.lerp(new THREE.Vector3(p.x, p.y + (player.bike ? 1.65 : player.flying ? 1.3 : 1.45), p.z), 1 - Math.exp(-dt * (player.flying ? 8 : 12)));
    if (!photoMode && !player.flying && t - cam.lastInput > 2.2 && player.speed > 1.2) {
      let d = (player.yaw + Math.PI) - cam.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
      cam.yaw += d * (1 - Math.exp(-dt * (player.bike ? 2.2 : 0.9)));
    }
    if (!player.flying && !combat?.armed && cam.pitch < -0.25) cam.pitch += (-0.25 - cam.pitch) * (1 - Math.exp(-dt * 4));
    const dir = new THREE.Vector3(Math.sin(cam.yaw) * Math.cos(cam.pitch), Math.sin(cam.pitch), Math.cos(cam.yaw) * Math.cos(cam.pitch));
    cam.flyK += ((player.flying ? 1 : 0) - cam.flyK) * (1 - Math.exp(-dt * 2.5));
    cam.armK = (cam.armK || 0) + ((combat?.armed ? 1 : 0) - (cam.armK || 0)) * (1 - Math.exp(-dt * 8));
    const want = Math.min(cam.dist * (player.bike ? 1.25 : 1) * (1 + cam.flyK * (0.55 + Math.min(0.5, player.speed / 40))), 6 - cam.armK * 2.6 - (combat?.aiming ? cam.armK * 1.1 : 0));
    let free = want;
    const shX = Math.cos(cam.yaw) * 0.95 * (cam.armK || 0), shZ = -Math.sin(cam.yaw) * 0.95 * (cam.armK || 0);
    for (let s = 0.4; s <= want; s += 0.2) { const q = cam.target.clone().addScaledVector(dir, s); q.x += shX * Math.min(1, s / 1.5); q.z += shZ * Math.min(1, s / 1.5); if (world.colliders.solid(q.x, q.y, q.z) || world.colliders.solid(q.x + dir.z * 0.25, q.y, q.z - dir.x * 0.25) || world.colliders.solid(q.x - dir.z * 0.25, q.y, q.z + dir.x * 0.25)) { free = Math.max(0.6, s - 0.4); break; } }
    cam.cur += (free - cam.cur) * (free < cam.cur ? 1 - Math.exp(-dt * 25) : 1 - Math.exp(-dt * 3));
    camera.position.copy(cam.target).addScaledVector(dir, cam.cur);
    if (cam.armK > 0.01) { const sh = (combat?.aiming ? 0.95 : 0.75) * cam.armK; camera.position.x += Math.cos(cam.yaw) * sh; camera.position.z -= Math.sin(cam.yaw) * sh; camera.lookAt(cam.target.x + Math.cos(cam.yaw) * sh, cam.target.y, cam.target.z - Math.sin(cam.yaw) * sh); } else camera.lookAt(cam.target);
    cam.shake = Math.max(0, (cam.shake || 0) - dt * 2.5);
    if (cam.shake > 0 && !car) camera.position.add(new THREE.Vector3((Math.random() - 0.5), (Math.random() - 0.5), (Math.random() - 0.5)).multiplyScalar(cam.shake * 0.25));
    // a little FOV kick with speed — the anime "whoosh"
    const fovT = 52 + Math.min(12, Math.max(0, player.speed - 5) * 1.6) + (player.dashT > 0 ? 6 : 0) - (combat?.aiming && combat.armed ? 16 : 0);
    cam.fov += (fovT - cam.fov) * (1 - Math.exp(-dt * 5));
    if (Math.abs(camera.fov - cam.fov) > 0.01) { camera.fov = cam.fov; camera.updateProjectionMatrix(); }
  }

  function carCamera(dt, t) {
    const f = car.forward();
    if (carView === 'cabin') {
      const eye = car.eyePos(); camera.position.copy(eye);
      carCam.look += (0 - carCam.look) * (t - cam.lastInput > 1.5 ? 1 - Math.exp(-dt * 2) : 0);
      const yaw = car.yaw + carCam.look - (cam.yaw - carCam.yaw0 || 0) * 0;
      const tgt = eye.clone().add(new THREE.Vector3(Math.sin(yaw), -0.08 - car.pitch, Math.cos(yaw)).multiplyScalar(10));
      camera.up.set(Math.sin(car.roll) * Math.cos(car.yaw), 1, -Math.sin(car.roll) * Math.sin(car.yaw)).normalize();
      camera.lookAt(tgt); camera.up.set(0, 1, 0);
      if (Math.abs(camera.fov - 72) > 0.01 || camera.near > 0.06) { camera.fov = 72; camera.near = 0.05; camera.updateProjectionMatrix(); }
      return;
    }
    if (camera.near < 0.2) { camera.near = 0.25; camera.updateProjectionMatrix(); }
    // chase cam: swings behind the car, pulls back and widens with speed, shakes on impacts
    if (t - cam.lastInput > 1.2) { let d = (car.yaw + Math.PI) - cam.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); cam.yaw += d * (1 - Math.exp(-dt * (2 + car.speed * 0.08))); }
    const big = Math.max(0, ((car.m?.S?.L) || 4.5) - 4.5), roofH = (car.m?.S?.roof) || 1.5;   // buses and trucks: frame the whole vehicle
    const tgt = car.pos.clone().add(new THREE.Vector3(0, Math.max(1.35, roofH * 0.75), 0)).addScaledVector(f, Math.min(4, car.speed * 0.12));
    cam.target.lerp(tgt, 1 - Math.exp(-dt * 10));
    const pitch = Math.max(0.08, Math.min(0.9, cam.pitch * 0.6 + 0.06)), dist = 6.8 + big * 1.05 + Math.min(4, car.speed * 0.09);
    const dir = new THREE.Vector3(Math.sin(cam.yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(cam.yaw) * Math.cos(pitch));
    let free = dist;
    for (let s2 = 1; s2 <= dist; s2 += 0.4) { const q = cam.target.clone().addScaledVector(dir, s2); if (world.colliders.solid(q.x, q.y, q.z)) { free = Math.max(1.5, s2 - 0.4); break; } }
    camera.position.copy(cam.target).addScaledVector(dir, free);
    cam.shake = Math.max(0, (cam.shake || 0) - dt * 2.5);
    if (cam.shake > 0) camera.position.add(new THREE.Vector3((Math.random() - 0.5), (Math.random() - 0.5), (Math.random() - 0.5)).multiplyScalar(cam.shake * 0.35));
    camera.lookAt(cam.target);
    const fovT = 56 + Math.min(16, car.speed * 0.35);
    cam.fov += (fovT - cam.fov) * (1 - Math.exp(-dt * 4)); if (Math.abs(camera.fov - cam.fov) > 0.01) { camera.fov = cam.fov; camera.updateProjectionMatrix(); }
  }

  // ---- input
  const keys = new Set(), inp = { x: 0, y: 0, run: false, jump: false, jumpHeld: false, dash: false, rain: false };
  addEventListener('keydown', (e) => {
    if (!started) return;
    if (document.activeElement === $('#chatIn')) return;
    if (e.repeat && e.code !== 'Space') { keys.add(e.code); return; }
    keys.add(e.code);
    if (photoMode) {
      if (e.code === 'KeyF') cycleFilter(); if (e.code === 'Space' || e.code === 'Enter') snap(); if (e.code === 'Escape' || e.code === 'KeyP') togglePhoto();
      if (e.code === 'KeyG') pose = !pose; e.preventDefault(); return;
    }
    if (e.code === 'Space') { if (!e.repeat) inp.jump = true; e.preventDefault(); }
    if (e.code === 'KeyF' || (e.code === 'KeyC' && !player.flying)) inp.dash = true;
    if (e.code === 'KeyV') inp.fly = true;
    if (e.code === 'KeyE') interact();
    if (e.code === 'Enter') { if (multi) { openChat(); e.preventDefault(); } else interact(); }
    if (e.code === 'KeyN') missionButton();
    if (/^Digit[1-4]$/.test(e.code)) emote(+e.code.slice(5) - 1);
    if (e.code === 'KeyP') togglePhoto();
    if (e.code === 'KeyT') cycleTime();
    if (e.code === 'KeyY') cycleSeason();
    if (e.code === 'Tab') { openWheel(); e.preventDefault(); return; }
    if (e.code === 'KeyO' || (e.code === 'Period' && car)) { radio(); return; }
    if (combat && combat.key(e.code)) { e.preventDefault(); return; }
    if (e.code === 'KeyR') { weather.cycle(); updateButtons(); sfx.blip(); }
    if (e.code === 'KeyB') { if (car) sfx.horn(); else sfx.bell(player.bike ? 2 : 1); }
    if (e.code === 'KeyX' && car) { carView = carView === 'chase' ? 'cabin' : 'chase'; carCam.look = 0; }
    if (e.code === 'KeyM') toggleSound();
    if (e.code === 'KeyJ') $('#journal').classList.toggle('show'), drawJournal();
    if (e.code === 'KeyH' || e.code === 'Slash') $('#help').classList.toggle('show');
    if (e.code === 'Escape') { $('#invite').classList.remove('show'); $('#results').classList.remove('show'); $('#help').classList.remove('show'); $('#journal').classList.remove('show'); closeSay(); }
  });
  addEventListener('keyup', (e) => keys.delete(e.code));
  addEventListener('blur', () => keys.clear());
  const cv = renderer.domElement;
  let drag = null, mouseFire = false;
  // armed on desktop: the mouse is captured (pointer lock) so it aims like a shooter; right button = aim / lock on
  const locked = () => document.pointerLockElement === cv;
  cv.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch') return;
    if (combat?.armed) {
      if (!locked() && !isTouch) { try { cv.requestPointerLock?.(); } catch (err) { /* not allowed */ } }
      if (e.button === 2) combat.aiming = true; else if (e.button === 0) mouseFire = true;
      if (locked()) return;
    }
    drag = { x: e.clientX, y: e.clientY }; cv.setPointerCapture(e.pointerId);
  });
  document.addEventListener('mousemove', (e) => {
    if (!locked()) return;
    const sens = combat?.aiming ? 0.0013 : 0.0024;
    cam.yaw -= e.movementX * sens; cam.pitch = Math.min(1.1, Math.max(pitchMin(), cam.pitch + e.movementY * sens * 0.8)); cam.lastInput = clock.elapsedTime;
    combat?.flick(Math.abs(e.movementX) + Math.abs(e.movementY));
  });
  document.addEventListener('pointerlockchange', () => { if (!locked()) { mouseFire = false; if (combat) combat.aiming = false; } });
  addEventListener('mouseup', (e) => { if (e.button === 2 && combat) combat.aiming = false; if (e.button === 0) mouseFire = false; });
  cv.addEventListener('pointermove', (e) => { if (!drag) return; cam.yaw -= (e.clientX - drag.x) * 0.006; cam.pitch = Math.min(1.25, Math.max(pitchMin(), cam.pitch + (e.clientY - drag.y) * 0.005)); drag = { x: e.clientX, y: e.clientY }; cam.lastInput = clock.elapsedTime; });
  cv.addEventListener('pointerup', (e) => { drag = null; if (e.button === 0) mouseFire = false; if (e.button === 2 && combat) combat.aiming = false; });
  cv.addEventListener('contextmenu', (e) => e.preventDefault());
  cv.addEventListener('wheel', (e) => { cam.dist = Math.min(photoMode ? 16 : 10, Math.max(photoMode ? 1.2 : 2.4, cam.dist * (1 + Math.sign(e.deltaY) * 0.1))); e.preventDefault(); }, { passive: false });
  // ---- touch: floating joystick on the left (push to the edge to run), swipe to look and pinch to zoom
  // on the right, and a button pad that changes with what you're doing (walking, flying, biking, driving)
  const isTouch = app.isTouch = touch || params.has('touch') || (navigator.maxTouchPoints > 0 && matchMedia('(hover: none)').matches);
  const B = document.body;
  B.classList.toggle('touch', isTouch);
  if (document.fullscreenEnabled || document.webkitFullscreenEnabled) B.classList.add('canfs');
  const buzz = (ms = 10) => { if (isTouch) try { navigator.vibrate?.(ms); } catch (e) { /* not supported */ } };
  const joy = { id: null, ox: 0, oy: 0, x: 0, y: 0, run: false }, looks = new Map(), tHeld = {};
  let pinch = 0;
  const joyEl = $('#joy'), knob = $('#joyKnob');
  const camDist = (v) => Math.min(photoMode ? 16 : 10, Math.max(photoMode ? 1.2 : 2.4, v));
  const joyRelease = () => { joy.id = null; joy.x = joy.y = 0; joy.run = false; joyEl.classList.remove('live', 'run'); joyEl.style.left = joyEl.style.top = ''; knob.style.transform = ''; };
  cv.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (B.classList.contains('menu')) { B.classList.remove('menu'); return; }
    for (const t of e.changedTouches) {
      if (t.clientX < innerWidth * 0.42 && joy.id === null && !photoMode) {
        joy.id = t.identifier; joy.ox = t.clientX; joy.oy = t.clientY; joy.x = joy.y = 0;
        joyEl.classList.add('live'); joyEl.style.left = t.clientX + 'px'; joyEl.style.top = t.clientY + 'px';
      } else looks.set(t.identifier, { x: t.clientX, y: t.clientY });
    }
    if (looks.size === 2) { const [a, b] = [...looks.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); }
  }, { passive: false });
  cv.addEventListener('touchmove', (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier === joy.id) {
        let dx = t.clientX - joy.ox, dy = t.clientY - joy.oy; const l = Math.hypot(dx, dy), m = 56;
        if (l > m) { dx *= m / l; dy *= m / l; }
        const k = l < 7 ? 0 : 1;   // small dead zone so a resting thumb doesn't creep
        joy.x = k * dx / m; joy.y = -k * dy / m; joy.run = !car && l > m * 0.92;
        knob.style.transform = `translate(${dx}px,${dy}px)`; joyEl.classList.toggle('run', joy.run);
        continue;
      }
      const lk = looks.get(t.identifier); if (!lk) continue;
      const mx = t.clientX - lk.x, my = t.clientY - lk.y; lk.x = t.clientX; lk.y = t.clientY;
      if (looks.size >= 2) { const [a, b] = [...looks.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); if (pinch > 0 && d > 0) cam.dist = camDist(cam.dist * pinch / d); pinch = d; continue; }
      const sens = 0.0085 * Math.min(1.25, Math.max(0.8, 700 / Math.min(innerWidth, innerHeight * 1.6)));
      cam.yaw -= mx * sens; cam.pitch = Math.min(1.25, Math.max(pitchMin(), cam.pitch + my * sens * 0.75)); cam.lastInput = clock.elapsedTime;
    }
  }, { passive: false });
  const tEnd = (e) => { for (const t of e.changedTouches) { if (t.identifier === joy.id) joyRelease(); looks.delete(t.identifier); } if (looks.size < 2) pinch = 0; };
  cv.addEventListener('touchend', tEnd); cv.addEventListener('touchcancel', tEnd);
  // pad buttons: pointer events so several can be held at once (gas + handbrake while steering)
  const pad = (id, on) => {
    const b = $('#' + id);
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch (err) { /* ok */ } b.classList.add('on'); tHeld[id] = true; buzz(); on?.(); });
    const up = () => { tHeld[id] = false; b.classList.remove('on'); };
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(ev, up);
    b.addEventListener('contextmenu', (e) => e.preventDefault());
  };
  pad('tJump', () => { inp.jump = true; });
  pad('tDash', () => { inp.dash = true; });
  pad('tFly', () => { inp.fly = true; });
  pad('tLand', () => { inp.fly = true; });
  pad('tBell', () => sfx.bell(2));
  pad('tHorn', () => sfx.horn());
  pad('tShoot'); pad('tAim'); pad('tDraw', () => combat?.toggle()); pad('tReload', () => combat?.key('KeyR')); pad('tSwap', () => app.openWheel?.());
  pad('tView', () => { carView = carView === 'chase' ? 'cabin' : 'chase'; carCam.look = 0; });
  for (const id of ['tUp', 'tDown', 'tBoost', 'tGas', 'tBrake', 'tHand']) pad(id);
  addEventListener('blur', () => { for (const k in tHeld) tHeld[k] = false; joyRelease(); looks.clear(); });
  $('#tChat').addEventListener('click', () => openChat());
  let emoI = 0; $('#tEmo').addEventListener('click', () => { emote(emoI); emoI = (emoI + 1) % 4; $('#tEmo').textContent = ['👋', '❤️', '😂', '🏆'][emoI]; });
  // the interaction bubble is the button on touch screens
  $('#prompt').addEventListener('pointerdown', (e) => { if (!isTouch) return; e.preventDefault(); buzz(15); interact(); });
  // menu: the icon column becomes a bottom sheet with labels
  const LBL = { btnMission: 'Mission', btnInvite: 'Friends', btnHelp: 'Help', btnTime: 'Time', btnWeather: 'Weather', btnSeason: 'Season', btnJournal: 'Journal', btnCam: 'Camera', btnPhoto: 'Photo', btnFull: 'Fullscreen', btnSound: 'Music' };
  for (const [id, l] of Object.entries(LBL)) $('#' + id)?.setAttribute('data-l', l);
  $('#tMenu').addEventListener('click', () => { B.classList.toggle('menu'); buzz(); });
  document.querySelector('.icons').addEventListener('click', (e) => { if (isTouch && e.target.closest('.ic') && e.target.closest('.ic').id !== 'btnSound') setTimeout(() => B.classList.remove('menu'), 120); });
  addEventListener('pointerdown', (e) => { if (e.target === B || e.target === document.documentElement || e.target.classList?.contains('hud')) B.classList.remove('menu'); });
  const goFull = () => { const d = document.documentElement; if (document.fullscreenElement || document.webkitFullscreenElement) return; try { const r = (d.requestFullscreen || d.webkitRequestFullscreen)?.call(d, { navigationUI: 'hide' }); r?.catch?.(() => {}); } catch (e) { /* iPhone Safari has no fullscreen for pages */ } };
  $('#btnFull').addEventListener('click', () => { if (document.fullscreenElement) document.exitFullscreen?.(); else goFull(); });
  for (const id of ['play', 'host', 'join']) $('#' + id)?.addEventListener('click', () => {
    if (!isTouch) return;
    if (B.classList.contains('canfs') && innerWidth < 1100) goFull();
    let seen = false; try { seen = localStorage.getItem('rotOk') === '1'; } catch (e) { /* private mode */ }
    if (!seen && innerHeight > innerWidth) setTimeout(() => $('#rotate').classList.add('show'), 1500);
  });
  $('#rotOk').addEventListener('click', () => { $('#rotate').classList.remove('show'); try { localStorage.setItem('rotOk', '1'); } catch (e) { /* ok */ } });
  addEventListener('resize', () => { if (innerWidth > innerHeight) $('#rotate').classList.remove('show'); joyRelease(); });
  let gpPrev = [];
  function readInput() {
    let x = 0, y = 0;
    if (keys.has('KeyW') || keys.has('ArrowUp') || keys.has('KeyZ')) y += 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) y -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft') || keys.has('KeyQ')) x -= 1;
    const ctl = car ? 'car' : player.flying ? 'fly' : player.bike ? 'bike' : 'walk';
    if (B.dataset.ctl !== ctl) { B.dataset.ctl = ctl; for (const k in tHeld) tHeld[k] = false; document.querySelectorAll('#tc .on').forEach((b) => b.classList.remove('on')); }
    x += joy.x;
    if (car) y += (tHeld.tGas ? 1 : 0) - (tHeld.tBrake ? 1 : 0); else y += joy.y;   // driving: thumb steers, pedals do gas and brake
    let run = keys.has('ShiftLeft') || keys.has('ShiftRight') || joy.run || !!tHeld.tBoost;
    let held = keys.has('Space') || !!tHeld.tJump || !!tHeld.tUp || !!tHeld.tHand;
    const gp = navigator.getGamepads ? [...navigator.getGamepads()].find((g) => g) : null;
    if (gp) {
      const dz = (v) => (Math.abs(v) < 0.15 ? 0 : v);
      x += dz(gp.axes[0]); y -= dz(gp.axes[1]);
      if (Math.abs(dz(gp.axes[2])) + Math.abs(dz(gp.axes[3])) > 0) { cam.yaw -= dz(gp.axes[2]) * 0.05; cam.pitch = Math.min(1.25, Math.max(pitchMin(), cam.pitch + dz(gp.axes[3]) * 0.04)); cam.lastInput = clock.elapsedTime; }
      const pressed = (i) => gp.buttons[i]?.pressed && !gpPrev[i];
      if (pressed(0)) inp.jump = true; held = held || gp.buttons[0]?.pressed;
      if (pressed(2)) interact(); if (pressed(3)) inp.dash = true; if (pressed(4)) inp.fly = true; if (pressed(1) && player.bike) sfx.bell(2);
      run = run || gp.buttons[7]?.value > 0.4 || gp.buttons[5]?.pressed;
      gpPrev = gp.buttons.map((b) => b.pressed);
    }
    const l = Math.hypot(x, y); if (l > 1 && !car) { x /= l; y /= l; }
    x = Math.max(-1, Math.min(1, x)); y = Math.max(-1, Math.min(1, y));
    inp.x = x; inp.y = y; inp.run = run; inp.jumpHeld = held; inp.rain = weather.precip === 'rain';
    inp.down = keys.has('KeyC') || keys.has('ControlLeft') || !!tHeld.tDown || (gp && gp.buttons[6]?.value > 0.4); inp.camPitch = cam.pitch;
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
    const t = $('#area'); $('#areaName').textContent = name; $('#area small').textContent = Math.abs(player.pos.x) > 2500 ? cityAt(player.pos.x).tag : player.pos.x < -80 && player.pos.z > 520 ? 'Downtown Montréal' : player.pos.z > 1200 ? 'Old Port' : 'Plateau-Mont-Royal'; t.classList.remove('show'); void t.offsetWidth; t.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 3200);
  }
  function achToast(ic, name) {
    const d = document.createElement('div'); d.className = 'ach'; d.innerHTML = `<i>${ic}</i><div><small>ACHIEVEMENT UNLOCKED</small><b>${name}</b></div>`;
    $('#achs').appendChild(d); setTimeout(() => d.classList.add('out'), 3600); setTimeout(() => d.remove(), 4200);
  }
  function floatText(txt, cls = '') { const d = document.createElement('div'); d.className = 'float ' + cls; d.textContent = txt; d.style.marginTop = ($('#floats').children.length * 38) + 'px'; $('#floats').appendChild(d); setTimeout(() => d.remove(), 1600); }
  let passT = 0;
  function passed(title, sub = '') { $('#passedTxt').textContent = title; $('#passedSub').textContent = sub; $('#passed').classList.add('show'); sfx.fanfare?.(0.8); clearTimeout(passT); passT = setTimeout(() => $('#passed').classList.remove('show'), 3200); }
  function updateMoney() { $('#money').textContent = '$' + Math.max(0, save.money | 0).toLocaleString('en-US'); if (save.money >= 200) ach.unlock('rich'); }
  updateMoney();

  // ---- time, seasons, weather
  let clockH = params.has('t') ? +params.get('t') : (save.hour ?? 9), timeSpeed = 1 / 60, season = params.get('season') || 'autumn';
  if (params.get('weather')) weather.set(params.get('weather'));
  function cycleTime() { const nx = JUMP_TO.find((t) => t > clockH + 0.05) ?? JUMP_TO[0]; clockH = nx; sfx.blip(); }
  function cycleSeason() { season = SEASONS[(SEASONS.indexOf(season) + 1) % SEASONS.length]; updateButtons(); sfx.blip(); }
  function updateButtons() {
    $('#btnSeason').dataset.v = season;
    $('#btnSeason').title = { summer: 'Summer', autumn: 'Autumn', winter: 'Winter' }[season] + ' (Y)';
    $('#btnWeather').dataset.v = weather.state;
    $('#btnWeather').title = { clear: 'Sunny', cloudy: 'Cloudy', rain: 'Rain / snow' }[weather.state] + ' (R)';
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
    sun.color.copy(look.sunC); sun.intensity = look.sunI * dim * (REAL ? 1.05 : 1);
    hemi.color.copy(mixG(look.sky, 0.6)); hemi.groundColor.copy(look.gnd); hemi.intensity = look.hemiI * (1 + (1 - dim) * 0.35) * (REAL ? 0.42 : 1); if (REAL) { hemi.color.lerp(_white, 0.55); hemi.groundColor.lerp(_warm, 0.5); hemi.intensity *= 1.5; }
    const su = sky.material.uniforms;
    su.uZen.value.copy(mixG(look.zen, 0.8)); su.uHor.value.copy(mixG(look.hor, 0.7)); su.uSunCol.value.copy(look.sunC).multiplyScalar(dim); su.uSun.value.copy(look.sunDir);
    su.uCloudCol.value.copy(mixG(look.cloud, 0.6)); su.uCloudShade.value.copy(mixG(look.shade, 0.8)); su.uCloud.value = weather.cover;
    scene.fog.color.copy(mixG(look.fog, 0.75)); const altF = Math.max(0, player.pos.y - h(player.pos.z)); scene.fog.near = (ws === 'rain' ? 60 : 180) + altF * 1.5; scene.fog.far = (ws === 'rain' ? 450 : 1150) + altF * 3;
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
  $('#setReset').onclick = (e) => { e.stopPropagation(); if (confirm('Erase your progress?')) { localStorage.removeItem('plateau-montreal-v2'); location.reload(); } };

  // ---- photo mode
  let photoMode = false, filter = 0, shot = false, pose = false;
  const FILTERS = ['Normal', 'Manga', 'Film'];
  function togglePhoto() { photoMode = !photoMode; document.body.classList.toggle('photo', photoMode); if (!photoMode) { pipe.U.uFilter.value = 0; } else { pipe.U.uFilter.value = filter; } sfx.blip(); }
  function cycleFilter() { filter = (filter + 1) % FILTERS.length; pipe.U.uFilter.value = filter; $('#pfName').textContent = FILTERS[filter]; sfx.blip(); }
  function snap() { shot = true; pipe.U.uFlash.value = 1; sfx.shutter(); }
  $('#btnPhoto').onclick = togglePhoto; $('#pFilter').onclick = cycleFilter; $('#pSnap').onclick = snap; $('#pExit').onclick = togglePhoto; $('#pPose').onclick = () => { pose = !pose; };
  $('#btnHelp').onclick = () => $('#help').classList.toggle('show');
  $('#help').onclick = (e) => { if (e.target.id === 'help') $('#help').classList.remove('show'); };
  $('#btnJournal').onclick = () => { $('#journal').classList.toggle('show'); drawJournal(); };
  $('#journal').onclick = (e) => { if (e.target.id === 'journal') $('#journal').classList.remove('show'); };
  function drawJournal() {
    $('#jStats').innerHTML = `<div><b>${bagels.count}/12</b><small>bagels</small></div><div><b>${save.deliveries}</b><small>deliveries</small></div><div><b>$${save.money}</b><small>tips</small></div><div><b>${Object.keys(save.met).length}</b><small>neighbours</small></div>`;
    $('#jAch').innerHTML = Object.entries(ACH).map(([id, [ic, name, desc]]) => `<li class="${save.ach[id] ? 'got' : ''}"><i>${ic}</i><b>${name}</b><small>${desc}</small></li>`).join('');
  }

  // ---- minimap
  const mm = makeMinimap(world);
  for (const c of Object.values(cities.cities)) mm.addBase(c.map);

  // ---- resize
  function resize() { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); pipe.setSize(innerWidth, innerHeight, renderer.getPixelRatio()); }
  addEventListener('resize', resize); resize();

  // ================================================================ v3: friends, rooms and missions
  let multi = false, roomCode = null;
  let net = app.net = new Offline({ name: '', color: 0 });
  const myName = () => save.name || 'Moi';
  const EMO = ['👋', '❤️', '😂', '🏆'];
  const missions = app.missions = new Missions(scene, world, roofs, net, {
    myName, myColor: () => COLORS[save.color | 0], player,
    posOf: (id) => (id === net.id ? player.pos : remotes.get(id)?.pos || null),
    isDown: () => !!combat?.pd,
    onBag: (on) => { player.parcel = on; if (on) police.crime(4.2, 'heist', player.pos); },
    sfx: (k, n) => sfx.mission(k, n), burst: (p) => burst.at(p), float: (t) => floatText(t), toast: (t) => areaToast(t),
    onBegin: (c) => { closeSay(); $('#marr span').textContent = ''; },
    onEnd: (c, m) => { if (c.kind === 'courier' && !deliveries.job) player.parcel = false; if (m.winner === net.id) { ach.unlock('mwin'); passed('mission passed', 'Respect +'); burst.at(player.pos.clone().setY(player.pos.y + 1.2)); hero.gesture?.('dance', 5); } else hero.gesture?.('shake', 2.4); },
  });
  function missionButton() {
    if (!started) return;
    if (missions.active) { if (!multi) { missions.stop(); floatText('Mission cancelled'); } return; }
    if (net.isHost) { $('#results').classList.remove('show'); missions.auto = true; missions.nextAt = 0; missions.start(); }
    else chatLine('', 'Only the host can start a mission.');
  }
  $('#btnMission').onclick = missionButton;
  $('#resNext').onclick = () => { $('#results').classList.remove('show'); if (net.isHost) { missions.nextAt = 0; missions.auto = true; missions.start(); } };
  $('#resClose').onclick = () => { $('#results').classList.remove('show'); if (!multi) missions.auto = false; };

  // ---- other players: interpolated avatars with name tags and speech bubbles
  const remotes = app.remotes = new Map();
  const meTag = document.createElement('div'); meTag.className = 'tag'; $('#tags').appendChild(meTag);
  function remoteFor(p, m) {
    let r = remotes.get(p.id);
    const outfit = (m?.o ?? p.outfit ?? 0) % OUTFITS.length, model = MODELS[m?.md ?? p.model] ? (m?.md ?? p.model) : 'bot';
    if (r && (r.outfit !== outfit || r.color !== (p.color | 0) || r.model !== model)) { dropRemote(p.id); r = null; }
    if (!r) {
      const ch = makeCharacter(optsFor(outfit, p.color, model)); scene.add(ch.root);
      const tag = document.createElement('div'); tag.className = 'tag'; tag.innerHTML = '<b></b>'; $('#tags').appendChild(tag);
      r = { id: p.id, ch, buf: [], tag, outfit, model, color: p.color | 0, wave: 0, bike: null, pos: new THREE.Vector3(), yaw: 0, flags: 0, speed: 0, trails: [new Trail(scene, COLORS[p.color | 0]), new Trail(scene, COLORS[p.color | 0])] };
      remotes.set(p.id, r);
    }
    const b = r.tag.querySelector('b'); b.textContent = p.name; b.style.background = COLORS[p.color | 0];
    return r;
  }
  function dropRemote(id) { const r = remotes.get(id); if (!r) return; scene.remove(r.ch.root); if (r.car) scene.remove(r.car.g); for (const t of r.trails) scene.remove(t.mesh); r.tag.remove(); remotes.delete(id); }
  const netF = { get peers() { return net.peers; }, get id() { return net.id; }, send: (m) => net.send(m), on: (t, f) => net.on(t, f) };
  combat = app.combat = new Combat({
    scene, camera, world, player, getHero: () => hero, getCar: () => car, cam, npcs, crowd, walkers, traffic, vehicles, props, remotes, net: netF, sfx, puffs, burst,
    ui: { isTouch, pitchMin, buzz, floatText: (t, c) => floatText(t, c), exitCar: () => exitCar(), updateMoney: () => updateMoney(),
      getMoney: () => save.money, addMoney: (v) => { save.money = Math.max(0, save.money + v); writeSave(save); updateMoney(); },
      setArmed: (on) => { document.body.classList.toggle('armed', on); if (!on && document.pointerLockElement) document.exitPointerLock?.(); },
      respawn: () => { const [sx0, z] = cityAt(player.pos.x).spawn; player.pos.set(sx0, world.colliders.ground(sx0, z, h(z) + 30, 0.2), z); player.visY = player.pos.y; player.vel.set(0, 0, 0); player.vy = 0; player.grounded = true; player.unstick(); hero.root.position.copy(player.pos); } },
  });
  const police = app.police = new Police({ scene, world, player, getCar: () => car, combat, sfx, ui: combat.ui });
  combat.police = police; traffic.extra = police.carVs; police.mkctx = () => ({ breakables, vehicles: vehicles.concat(police.carVs), traffic, props, peds: null, night: look.night, clock: '' });
  // ---- travel between Montréal, Toronto and Ottawa (VIA Rail stations, the ✈ button, or the lobby)
  function travelTo(key, quick = false) {
    const c = CITIES[key]; if (!c) return;
    $('#travel').classList.remove('show');
    if (car) exitCar(); if (player.bike) player.dismount(); player.flying = false;
    const go = () => {
      const [x, z] = c.spawn; player.pos.set(x, world.colliders.ground(x, z, h(z) + 30, 0.2), z); player.visY = player.pos.y; player.vel.set(0, 0, 0); player.vy = 0; player.grounded = true; player.unstick();
      hero.root.position.copy(player.pos); player.yaw = c.yaw; cam.yaw = c.yaw + Math.PI; cam.pitch = 0.22; cam.target.set(x, player.pos.y + 1.45, z);
      police.clear(); walkers.reset(x, z, cam.yaw); save.city = key; writeSave(save); lastArea = null;
      areaToast(c.key === 'montreal' ? 'Saint-Denis Street' : whereIs(x, z).name || c.name);
    };
    if (quick) { go(); return; }
    const f = $('#fade'); $('#fadeCity').textContent = c.name; f.classList.add('show'); sfx.whoosh?.();
    setTimeout(() => { go(); setTimeout(() => f.classList.remove('show'), 500); }, 1100);
  }
  function openTravel() { const here = cityAt(player.pos.x).key; document.querySelectorAll('#travel [data-c]').forEach((b) => b.classList.toggle('here', b.dataset.c === here)); $('#travel').classList.add('show'); }
  document.querySelectorAll('#travel [data-c]').forEach((b) => b.addEventListener('click', () => travelTo(b.dataset.c)));
  $('#travelClose').onclick = () => $('#travel').classList.remove('show');
  $('#btnTravel').onclick = openTravel;
  app.travelTo = travelTo;
  const pickups = app.pickups = new Pickups(scene, world, (type) => {
    if (type === 'health') { if (combat.hp >= 100) return false; combat.hp = Math.min(100, combat.hp + 45); floatText('+ Health', 'money'); }
    else if (type === 'armour') { if ((combat.armour || 0) >= 100) return false; combat.armour = Math.min(100, (combat.armour || 0) + 50); floatText('+ Armour', 'money'); }
    else if (type === 'cash') { const v = 20 + (Math.random() * 60 | 0); save.money += v; writeSave(save); updateMoney(); floatText(`+$${v}`, 'money'); }
    else { for (const k of [1, 2, 3]) combat.ammo[k].res += WEAPONS[k].mag * 2; floatText('+ Ammo', 'money'); }
    sfx.collect(1.2); combat.refreshHud(); return true;
  });
  const activities = app.activities = new Activities(scene, world, save, { toast: (t) => areaToast(t), float: (t) => floatText(t, 'combo'), sfx: (k) => sfx.mission(k), passed: (a, b) => passed(a, b) });
  const STATIONS = ['Plateau Lo-Fi 96.3', 'Neon 88 FM', 'Mile End Beats', 'Radio Off'];
  let radioT = 0;
  function radio(step = 1) { const n = sfx.radio(sfx.station + step); $('#radioTxt').textContent = STATIONS[n]; $('#radioName').classList.add('show'); clearTimeout(radioT); radioT = setTimeout(() => $('#radioName').classList.remove('show'), 2600); sfx.blip?.(); }
  pad('tRadio', () => radio());
  // weapon wheel (Tab / the ⇄ button): time slows while it's open
  let slowmo = 1;
  const wheel = $('#wheel');
  function openWheel(on = !wheel.classList.contains('show')) {
    wheel.classList.toggle('show', on); slowmo = on ? 0.25 : 1;
    if (on) { for (const k of [1, 2, 3]) $('#ww' + k).textContent = `${combat.ammo[k].mag + combat.ammo[k].res}`; wheel.querySelectorAll('button').forEach((b) => b.classList.toggle('on', +b.dataset.w === (combat.drawn ? combat.cur : 0))); }
  }
  wheel.querySelectorAll('button').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); combat.select(+b.dataset.w); openWheel(false); }));
  wheel.addEventListener('click', () => openWheel(false));
  app.openWheel = openWheel;
  // cars: smoke when damaged, fire when badly hurt, then a GTA-style explosion
  const charMat = new THREE.MeshLambertMaterial({ color: 0x1c1b1a });
  function carFx(v, dt) {
    const d = v.dmg || 0;
    if (v.wreck) { v.wreckT = (v.wreckT || 0) + dt; if (v.wreckT < 25 && Math.random() < dt * 3) puffs.at(v.pos.clone().setY(v.pos.y + 1.1), 0x3a3a3a, 1); return; }
    if (d < 0.45) return;
    v.fxT = (v.fxT || 0) - dt;
    if (v.fxT <= 0) { v.fxT = d > 0.8 ? 0.05 : 0.16; const f = v.forward(), p = v.pos.clone().addScaledVector(f, v.S.L * 0.36); p.y += 1.0; puffs.at(p, d > 0.8 ? (Math.random() < 0.5 ? 0xff7a2a : 0xffc040) : 0x777777, 1); }
    if (d > 0.8) { v.burn = (v.burn || 0) + dt; if (car === v && v.burn > 0.1 && !v.warned) { v.warned = true; areaToast('🔥 Get out — it\'s going to blow!'); } }
    if (d >= 1 || v.burn > 7) explode(v);
  }
  function explode(v) {
    v.wreck = true; v.dmg = 1; v.vF = 0; v.vR = 0; v.vy = 4; v.pos.y += 0.05;
    const p = v.pos.clone(); p.y += 1;
    burst.at(p); puffs.ring(p, 0xff8a30); puffs.ring(p.clone().setY(p.y + 0.8), 0x555555); puffs.at(p, 0xffd060, 8); puffs.at(p, 0x444444, 8);
    const near = p.distanceTo(camera.position);
    sfx.crash(1); sfx.thud?.(1); sfx.shot?.(3, Math.max(0.2, 1 - near / 120)); cam.shake = Math.max(cam.shake || 0, Math.max(0.2, 1.2 - near / 60)); if (near < 60) pipe.U.uFlash.value = Math.max(pipe.U.uFlash.value, 0.3 * (1 - near / 60)); buzz(120);
    v.m.g.traverse((o) => { if (o.isMesh && o.material && o.material.type !== 'MeshBasicMaterial') o.material = charMat; });
    for (const n of [...npcs.list.filter((q) => q.out), ...crowd.list]) { const dx = n.pos.x - v.pos.x, dz = n.pos.z - v.pos.z, dd = Math.hypot(dx, dz); if (dd < 8 && !n.rag) combat.floor(n, dx / (dd || 1) * 9, dz / (dd || 1) * 9, 5, 6, false); else if (dd < 30) n.scare?.(v.pos.x, v.pos.z); }
    if (car === v) { exitCar(); combat.knockMe(Math.sin(v.yaw + 1.6) * 9, Math.cos(v.yaw + 1.6) * 9, 6, 3, 'self'); combat.damage(75, 'self'); }
    else { const dx = player.pos.x - v.pos.x, dz = player.pos.z - v.pos.z, dd = Math.hypot(dx, dz); if (dd < 7 && !car) { combat.knockMe(dx / (dd || 1) * 10, dz / (dd || 1) * 10, 6, 2.8, 'self'); combat.damage(60 * (1 - dd / 7), 'self'); } }
    for (const o of vehicles.concat(police.carVs)) if (o !== v && !o.wreck && o.pos.distanceTo(v.pos) < 7) o.dmg = Math.min(1, (o.dmg || 0) + 0.35);
    police.crime(v.cop ? 2 : 1.2, 'boom', player.pos);
  }
  $('#pvpTag')?.addEventListener('click', () => combat.key('KeyK'));
  const DELAY = 150;
  function updateRemotes(dt) {
    const now = performance.now() - DELAY;
    for (const r of remotes.values()) {
      const B = r.buf; if (!B.length) continue;
      let a = B[B.length - 1], b = a;
      for (let i = B.length - 1; i > 0; i--) if (B[i - 1].t <= now) { a = B[i - 1]; b = B[i]; break; }
      const k = b.t === a.t ? 1 : Math.max(0, Math.min(1.4, (now - a.t) / (b.t - a.t)));
      r.pos.set(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k, a.z + (b.z - a.z) * k);
      let dy = b.r - a.r; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); r.yaw = a.r + dy * Math.min(1, k);
      r.flags = b.f; r.speed = a.s + (b.s - a.s) * Math.min(1, k);
      const ch = r.ch; ch.root.position.copy(r.pos); ch.root.rotation.y = r.yaw;
      const fly = !!(r.flags & 2), bike = !!(r.flags & 4), drv = !!(r.flags & 64);
      // a friend driving: show their car with them in the driver's seat
      if (drv && r.vk && (!r.car || r.carKey !== r.vk + r.vc)) { if (r.car) scene.remove(r.car.g); r.car = carDrivable(r.vc || '#d0312d', r.vk); r.carKey = r.vk + r.vc; scene.add(r.car.g); }
      if (!drv && r.car) { scene.remove(r.car.g); r.car = null; }
      if (r.car) {
        r.car.g.position.copy(r.pos); r.car.g.rotation.set(0, r.yaw, 0); r.car.wheel.rotation.z = -(r.vst || 0) * 5.5;
        for (const w of r.car.wheels) { w.spin.rotation.x += r.speed * dt / r.car.S.wr; if (w.front) w.g.rotation.y = r.vst || 0; }
        const seat = r.car.seat.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), r.yaw).add(r.pos);
        ch.root.position.set(seat.x, seat.y - 0.47, seat.z); ch.root.rotation.y = r.yaw;
        ch.animate(dt, 0, true, 0, { drive: true, steer: r.vst || 0 });
        ch.root.visible = r.pos.distanceTo(camera.position) < 420; r.car.g.visible = ch.root.visible;
        wingTrails(r.trails, ch, r.yaw, false, dt);
        continue;
      }
      if (bike && !r.bike) { r.bike = bikeModel(); ch.root.add(r.bike.g); } else if (!bike && r.bike) { ch.root.remove(r.bike.g); r.bike = null; }
      if (r.bike) r.bike.spin(r.speed * dt);
      r.wave = Math.max(0, r.wave - dt);
      ch.animate(dt, fly ? 0 : bike ? r.speed * 0.45 : r.speed, !!(r.flags & 1) || bike, r.wave > 0 ? 1 : 0, { wings: fly, fly: fly ? Math.min(1, r.speed / 14) : 0, flap: (r.flags & 32) ? 2 : 1, bike, parcel: !!(r.flags & 8), umbrella: !!(r.flags & 16), gun: !fly && !bike && r.gw ? WEAPONS[r.gw]?.id : null, aimPitch: r.ap });
      ch.root.rotation.order = 'YXZ'; r.tlS = (r.tlS || 0) + ((r.tl || 0) - (r.tlS || 0)) * Math.min(1, dt * 10);
      if (Math.abs(r.tlS) > 0.02) { const lie = Math.min(1, Math.abs(r.tlS) / 1.5708), s2 = Math.sign(r.tlS); ch.root.rotation.x = r.tlS; ch.root.position.x -= Math.sin(r.yaw) * s2 * 0.8 * lie; ch.root.position.z -= Math.cos(r.yaw) * s2 * 0.8 * lie; ch.root.position.y += 0.1 * lie; } else ch.root.rotation.x = 0;
      ch.root.visible = r.pos.distanceTo(camera.position) < 420;
      wingTrails(r.trails, ch, r.yaw, fly && r.speed > 4, dt);
      r.tag.classList.toggle('idle', performance.now() - B[B.length - 1].t > 5000);   // their tab is in the background: keep them visible, dim the name
    }
  }
  const tagV = new THREE.Vector3();
  function placeTag(el, pos, hgt) {
    tagV.copy(pos); tagV.y += hgt; const d = tagV.distanceTo(camera.position); tagV.project(camera);
    if (tagV.z > 1 || d > 260 || Math.abs(tagV.x) > 1.15 || Math.abs(tagV.y) > 1.15) { el.style.display = 'none'; return; }
    el.style.display = ''; const sc = Math.max(0.6, Math.min(1, 12 / d + 0.45));
    el.style.transform = `translate(${(tagV.x * 0.5 + 0.5) * innerWidth}px,${(-tagV.y * 0.5 + 0.5) * innerHeight}px) translate(-50%,-100%) scale(${sc})`;
  }
  function bubble(id, text, emo = false) {
    const el = id === 'me' ? meTag : remotes.get(id)?.tag; if (!el) return;
    el.querySelector('.bub')?.remove();
    const d = document.createElement('div'); d.className = 'bub' + (emo ? ' emo' : ''); d.textContent = text; el.prepend(d);
    setTimeout(() => d.remove(), emo ? 2600 : 5000);
  }
  // ---- wing ribbons
  const myTrails = [new Trail(scene, '#ffffff'), new Trail(scene, '#ffffff')];
  const tipV = new THREE.Vector3(), upV = new THREE.Vector3(0, 1, 0);
  function wingTrails(trails, ch, yaw, on, dt) {
    const a = 0.15 + 1.2 * (ch.st.fly || 0), cy = Math.cos(yaw), sy = Math.sin(yaw);
    trails.forEach((tr, i) => {
      const x = i ? -0.8 : 0.8, y = 0.6 * Math.cos(a) + 0.2 * Math.sin(a) + 0.8, z = 0.6 * Math.sin(a) - 0.2 * Math.cos(a);
      tipV.set(x * cy + z * sy, y, -x * sy + z * cy).add(ch.root.position);
      tr.push(tipV, upV, on, dt);
    });
  }

  // ---- chat + emotes
  function chatLine(name, text, col) {
    const d = document.createElement('div');
    if (name) { const b = document.createElement('b'); b.style.color = col || '#ffe066'; b.textContent = name; d.appendChild(b); } else d.style.fontStyle = 'italic';
    d.appendChild(document.createTextNode(text)); $('#chatLog').appendChild(d);
    while ($('#chatLog').children.length > 6) $('#chatLog').firstChild.remove();
    setTimeout(() => d.classList.add('old'), 9000); setTimeout(() => d.remove(), 10200);
  }
  function openChat() { document.body.classList.add('chatting'); const i = $('#chatIn'); i.value = ''; keys.clear(); setTimeout(() => i.focus(), 0); }
  function closeChat() { document.body.classList.remove('chatting'); $('#chatIn').blur(); renderer.domElement.focus(); }
  $('#chatIn').addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') { const t = $('#chatIn').value.trim().slice(0, 120); if (t) { net.send({ t: 'chat', text: t }); chatLine(myName(), t, COLORS[save.color | 0]); bubble('me', t); } closeChat(); }
    if (e.key === 'Escape') closeChat();
  });
  const GEST = [null, 'nod', 'shake', 'dance'];
  function emote(i) { net.send({ t: 'emo', i }); bubble('me', EMO[i], true); sfx.blip(); if (i === 0) player.waveT = 2.5; else hero.gesture?.(GEST[i], i === 3 ? 5 : 2.2); }

  // ---- connecting
  function bindNet(n) {
    combat?.bind(n);
    n.on('join', (p) => { if (n !== net) return; chatLine('', `${p.name} joined the game! 👋`); sfx.mission('join'); ach.unlock('online'); updRoom(); sendState(); if (n.isHost && !missions.active) setTimeout(() => chatLine('', 'You\'re the host: press N (or ⚑) to start a mission!'), 1200); });
    n.on('status', () => { if (n === net) updRoom(); });
    n.on('leave', (p) => { if (n !== net) return; dropRemote(p.id); chatLine('', `${p.name} left.`); updRoom(); });
    n.on('st', (m, p) => { if (n !== net || typeof m.x !== 'number') return; const r = remoteFor(p, m); r.buf.push({ t: performance.now(), x: m.x, y: m.y, z: m.z, r: m.r || 0, s: m.s || 0, f: m.f | 0 }); r.vk = m.vk; r.vc = m.vc; r.vst = m.st || 0; r.gw = m.gw | 0; r.ap = m.ap || 0; r.pvp = m.pv !== 0; r.tl = m.tl || 0; r.down = Math.abs(r.tl) > 0.8; r.hp = m.hp; if (r.buf.length > 30) r.buf.shift(); });
    n.on('chat', (m, p) => { if (n !== net) return; const t = String(m.text || '').slice(0, 120); chatLine(p.name, t, COLORS[p.color | 0]); bubble(p.id, t); sfx.blip(); });
    n.on('emo', (m, p) => { if (n !== net) return; const i = (m.i | 0) % 4; bubble(p.id, EMO[i], true); const r = remotes.get(p.id); if (r && i === 0) r.wave = 2.5; else r?.ch.gesture?.(GEST[i], i === 3 ? 5 : 2.2); });
  }
  function updRoom() {
    const el = $('#room');
    if (!multi) { el.innerHTML = ''; return; }
    el.innerHTML = `<span class="dot"></span>${roomCode} · 👥 ${net.count}`;
    el.classList.toggle('local', net.status !== 'online');
    const d = net.diag?.();
    if (d) {
      const via = { relais: 'relais', direct: 'direct', onglet: 'onglet' };
      $('#invNet').innerHTML = `<b>Connexion</b> · relais ${d.brokers}/${d.brokerTotal} ${d.brokers ? '✅' : '❌'} · Nostr ${d.nostr ? '✅' : '❌'} · direct ${d.direct}` +
        (d.peers.length ? `<br>${d.peers.map((p) => `${esc(p.name)} (${via[p.via] || p.via})`).join(' · ')}` : '<br>Waiting for friends… share the code!') +
        (!d.brokers && !d.nostr ? '<br>⚠️ No public server reachable from this network (firewall?). Try another Wi-Fi or mobile data.' : '');
    }
  }
  setInterval(() => { if (multi && ($('#invite').classList.contains('show') || net.status !== lastSt)) { lastSt = net.status; updRoom(); } }, 1000);
  let lastSt = '';
  const esc = (x) => String(x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  async function goOnline(code) {
    if (roomCode === code) return;
    missions.stop(); net.leave?.();
    for (const id of [...remotes.keys()]) dropRemote(id);
    roomCode = code; multi = true; document.body.classList.add('multi');
    net = app.net = new Net(code, { name: myName(), color: save.color | 0, outfit: save.outfit, model: save.model });
    bindNet(net); missions.setNet(net); missions.pts = {}; missions.auto = true;
    try { const u = new URL(location.href); u.searchParams.set('room', code); history.replaceState(null, '', u); } catch (e) { /* file:// */ }
    updRoom(); chatLine('', `Room ${code} · connecting…`);
    await net.connect();
    updRoom(); chatLine('', net.status === 'online' ? 'Online! Share the code with your friends. Press Enter to chat.' : 'Local mode only.');
  }
  const linkFor = (code) => `${location.origin}${location.pathname}?room=${code}`;
  function showInvite() {
    if (!multi) goOnline(randomCode());
    $('#invCode').textContent = roomCode; $('#invLink').textContent = linkFor(roomCode);
    $('#invShare').style.display = navigator.share ? '' : 'none';
    $('#invite').classList.add('show'); updRoom();
  }
  $('#btnInvite').onclick = showInvite; $('#room').onclick = showInvite;
  $('#invClose').onclick = () => $('#invite').classList.remove('show');
  $('#invite').onclick = (e) => { if (e.target.id === 'invite') $('#invite').classList.remove('show'); };
  $('#invCopy').onclick = () => { const l = linkFor(roomCode); (navigator.clipboard?.writeText(l) || Promise.reject()).then(() => { $('#invCopy').textContent = 'Copied ✓'; setTimeout(() => { $('#invCopy').textContent = 'Copy link'; }, 1800); }).catch(() => prompt('Copy this link:', l)); };
  $('#invShare').onclick = () => navigator.share?.({ title: 'Plateau · Montréal', text: `Come play with me! Code: ${roomCode}`, url: linkFor(roomCode) }).catch(() => {});
  let stT = 0;
  // a hidden tab stops animating, so keep reporting our position from a timer as well
  setInterval(() => { if (document.hidden) sendState(); }, 1000);
  function sendState() {
    if (!multi || !net.peers.size) return;
    const p = hero.root.position;
    const f = (player.grounded ? 1 : 0) | (player.flying ? 2 : 0) | (player.bike ? 4 : 0) | (player.parcel ? 8 : 0) | ((inp.rain || player.gliding) && !player.bike && !player.flying && !car ? 16 : 0) | (player.flying && inp.run ? 32 : 0) | (car ? 64 : 0);
    if (car) { const c = car.pos; net.send({ t: 'st', x: +c.x.toFixed(2), y: +c.y.toFixed(2), z: +c.z.toFixed(2), r: +car.yaw.toFixed(3), s: +car.speed.toFixed(2), f, o: save.outfit, md: save.model, vk: car.kind, vc: car.color, st: +car.steer.toFixed(2), pv: combat?.pvp ? 1 : 0, hp: Math.round(combat?.hp ?? 100) }); return; }
    net.send({ t: 'st', x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2), r: +player.yaw.toFixed(3), s: +player.speed.toFixed(2), f, o: save.outfit, md: save.model, ...(combat ? combat.stateFields() : {}) });
  }

  // ---- lobby on the title screen
  const NAMES = ['Squirrel', 'Raton', 'Huard', 'Castor', 'Orignal', 'Bernache', 'Mouffette', 'Harfang'];
  const cols = $('#pCols');
  COLORS.forEach((c, i) => { const b = document.createElement('button'); b.style.background = c; b.setAttribute('aria-label', 'Couleur ' + (i + 1)); b.onclick = () => { save.color = i; writeSave(save); updCols(); setOutfit(save.outfit); }; cols.appendChild(b); });
  const updCols = () => [...cols.children].forEach((b, i) => b.classList.toggle('on', i === (save.color | 0)));
  updCols();
  const chars = [...document.querySelectorAll('#pChars button')];
  const updChars = () => chars.forEach((b) => b.classList.toggle('on', b.dataset.m === save.model));
  chars.forEach((b) => { b.onclick = () => { save.model = b.dataset.m; writeSave(save); updChars(); setOutfit(save.outfit); hero.gesture?.('dance', 2.5); }; });
  updChars();
  $('#pName').value = save.name || '';
  $('#pName').addEventListener('input', () => { save.name = $('#pName').value.trim().slice(0, 16); writeSave(save); });
  const invited = (params.get('room') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
  if (invited) { $('#pCode').value = invited; $('#lobby').classList.add('invited'); $('#join').textContent = 'Join ▸'; }
  let started = params.has('play');
  const begin = (room) => {
    if (!save.name) { save.name = NAMES[Math.floor(Math.random() * NAMES.length)] + ' ' + (10 + Math.floor(Math.random() * 89)); $('#pName').value = save.name; writeSave(save); }
    started = true; document.body.classList.add('playing'); if (save.city && save.city !== 'montreal') travelTo(save.city, true); sfx.start(); $('#btnSound').classList.remove('off');
    if (room) { goOnline(room); if (!invited) setTimeout(showInvite, 900); }
    setTimeout(() => areaToast('Saint-Denis Street'), 600);
    if (!save.deliveries && !params.has('play')) setTimeout(() => say('Tutorial', room ? (isTouch ? 'Welcome! When your friends join, the host starts a mission from the ☰ menu. First to finish wins! Tap 🕊 Fly to take off.' : 'Welcome! When your friends join, the host starts a mission (N). First to finish wins! Press V (or jump three times) to fly.') : (isTouch ? 'Welcome to the Plateau! Left thumb to move, swipe right to look. Tap 🕊 Fly to take off, and the 👆 bubble to talk or deliver. Find the 12 golden bagels!' : 'Welcome to the Plateau! Press V (or jump three times) to fly. N starts a mission. Step into a shop (E) for a delivery, and look for the 12 golden bagels.')), 2500);
  };
  const cityBtns = [...document.querySelectorAll('#pCity button')];
  const updCity = () => cityBtns.forEach((b) => b.classList.toggle('on', b.dataset.c === (save.city || 'montreal')));
  cityBtns.forEach((b) => { b.onclick = () => { save.city = b.dataset.c; writeSave(save); updCity(); }; }); updCity();
  $('#play').onclick = () => begin();
  $('#host').onclick = () => begin(randomCode());
  $('#join').onclick = () => { const c = $('#pCode').value.toUpperCase().replace(/[^A-Z0-9]/g, ''); if (c.length < 4) { $('#pCode').focus(); $('#pCode').animate([{ transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'none' }], 250); return; } begin(c); };
  $('#pCode').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#join').click(); });
  if (save.deliveries || save.bagels.length) $('#play').textContent = 'Continue solo ▸';
  if (started) document.body.classList.add('playing');
  if (params.has('play') && params.get('room')) goOnline(invited);
  app.goOnline = goOnline; app.emote = emote; app.chat = (t) => { net.send({ t: 'chat', text: t }); chatLine(myName(), t, COLORS[save.color | 0]); bubble('me', t); };

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
  let boardT = 0, mmT = 0; const amb = { siren: 40, gull: 2, metro: false, hour: undefined };
  // dynamic resolution: only when the GPU can't keep up, the render scale steps down a little
  // (never below 1.0 on desktop), and it climbs back to full sharpness as soon as there is headroom
  const prMax = renderer.getPixelRatio(), prMin = Math.min(prMax, touch ? 0.7 : 0.8);
  let frameAvg = 1 / 60, slowT = 0, fastT = 0;
  function adaptResolution(raw) {
    if (params.has('manual')) return;
    frameAvg += (raw - frameAvg) * 0.05;
    const pr = renderer.getPixelRatio();
    if (frameAvg > 1 / 48) { slowT += raw; fastT = 0; } else if (frameAvg < 1 / 58) { fastT += raw; slowT = 0; } else { slowT = fastT = 0; }
    if (slowT > 1.2 && pr > prMin + 0.01) { renderer.setPixelRatio(Math.max(prMin, pr - 0.15)); resize(); slowT = 0; }
    if (fastT > 4 && pr < prMax - 0.01) { renderer.setPixelRatio(Math.min(prMax, pr + 0.1)); resize(); fastT = 0; }
  }
  function pointArrow(a, target) {
    arrowV.copy(target).setY(target.y + 1).project(camera);
    const behind = arrowV.z > 1;
    let ax = arrowV.x, ay = arrowV.y; if (behind) { ax = -ax; ay = -ay; }
    const on = !behind && Math.abs(ax) < 0.92 && Math.abs(ay) < 0.88;
    if (on) { a.style.transform = `translate(${(ax * 0.5 + 0.5) * innerWidth}px, ${(-ay * 0.5 + 0.5) * innerHeight}px) translate(-50%,-120%)`; a.classList.add('on'); }
    else { const ang = Math.atan2(-ay, ax), m = Math.min(innerWidth, innerHeight) * 0.42; a.style.transform = `translate(${innerWidth / 2 + Math.cos(ang) * m * innerWidth / Math.min(innerWidth, innerHeight) * 0.9}px, ${innerHeight / 2 + Math.sin(ang) * m * (Math.sin(ang) < 0 ? 0.62 : 1)}px) translate(-50%,-50%) rotate(${ang + Math.PI / 2}rad)`; a.classList.remove('on'); }
  }
  function frame(dtOverride) {
    const rawDt = typeof dtOverride === 'number' ? dtOverride : Math.min(clock.getDelta(), 1);
    const dt = (typeof dtOverride === 'number' ? dtOverride : Math.min(rawDt, 1 / 20)) * (slowmo || 1) * (combat?.pd?.dead ? 0.6 : 1) * (activities?.slow || 1);
    if (typeof dtOverride === 'number') clock.elapsedTime += dt;
    const t = clock.elapsedTime;
    U.uTime.value = t;
    clockH = (clockH + dt * timeSpeed) % 24;
    weather.update(dt, season);
    readInput();
    if (!started || photoMode) { inp.x = inp.y = 0; inp.jump = false; inp.dash = false; if (!started) cam.yaw += dt * 0.05; }
    let stepped = false;
    combat.trigger = !!(tHeld.tShoot || mouseFire); if (car) combat.trigger = false;
    if (isTouch) combat.aiming = !!tHeld.tAim || !!tHeld.tShoot;
    const vctx = { breakables, police, vehicles: police.carVs.length ? vehicles.concat(police.carVs) : vehicles, hitPed: (n, vx, vz, sp) => combat.hitByCar(n, vx, vz, sp), traffic, props, peds: [...npcs.list.filter((n) => n.out), ...crowd.list, ...walkers.list.filter((p) => p.live), ...police.foot.filter((c) => !c.gone)], night: look.night, clock: fmtHour(clockH) };
    if (car) {
      inp.fly = false; inp.dash = false;
      car.update(dt, started && !photoMode ? inp : null, vctx);
      player.pos.copy(car.pos); player.yaw = car.yaw; player.speed = car.speed; player.vel.set(Math.sin(car.yaw) * car.vF, 0, Math.cos(car.yaw) * car.vF); player.grounded = true; player.flying = false;
      const seat = car.seatPos(); hero.root.position.set(seat.x, seat.y - 0.47, seat.z); hero.root.rotation.y = car.yaw;
      hero.animate(dt, 0, true, 0, { drive: true, steer: car.steer });
      if (car.impact > 3.5) { sfx.crash(Math.min(1, car.impact / 18)); buzz(Math.min(60, 15 + car.impact * 3)); cam.shake = Math.min(1, car.impact / 15); puffs.ring(car.pos.clone().setY(car.pos.y + 0.4), 0xd9cdb8); if (car.impact > 12) ach.unlock('crash'); }
      car.impact = 0;
      sfx.engine(car.rpm, Math.max(0, inp.y), car.speed);
      $('#driveSpd').textContent = Math.round(car.speed * 3.6); $('#driveGear').textContent = car.gear;
    } else {
      combat.lockInput(inp); player.gun = combat.armed ? combat.weapon.id : null; player.aimPitch = combat.aimPitch();
      stepped = player.update(dt, inp, cam.yaw); sfx.engine(0, 0, 0); combat.afterPlayer(dt);
    }
    if (car && car.speed > 5) for (const r of remotes.values()) { if (r.car || !r.ch.root.visible) continue; for (const [cx, cz, cr] of car.circles(car.pos.x, car.pos.z, car.yaw)) if ((r.pos.x - cx) ** 2 + (r.pos.z - cz) ** 2 < (cr + 0.5) ** 2 && Math.abs(r.pos.y - car.pos.y) < 1.8) { combat.carHitRemote(r, car.vF * Math.sin(car.yaw), car.vF * Math.cos(car.yaw), car.speed); break; } }
    for (const v of vehicles) if (v !== car) { if (v.speed > 0.05) v.update(dt, null, vctx); else v.place(0, vctx); }
    for (const v of vehicles) v.m.lod(v === car ? 0 : v.pos.distanceTo(camera.position));
    // fell into the St. Lawrence: splash, swim back to the quay
    if (!car && !player.flying) for (const W of WATERS) {
      if (player.pos.x < W.x0 || player.pos.x > W.x1 || player.pos.z < W.z0 || player.pos.z > W.z1) continue;
      const wy = W.y ?? h(player.pos.z) + W.slope; if (W.y == null && player.pos.y > wy + 0.2) continue;   // the lake and river are deep right from the quay
      puffs.ring(player.pos.clone().setY(wy), 0xbfe3ff); sfx.land(); areaToast(W.side !== undefined ? 'Splash! The Rideau Canal' : cityAt(player.pos.x).key === 'toronto' ? 'Splash! Lake Ontario' : 'Splash! The Ottawa River');
      const x = W.side ?? player.pos.x, z = W.side !== undefined ? player.pos.z : W.back; player.pos.set(x, world.colliders.ground(x, z, h(z) + 30, 0.2), z); player.visY = player.pos.y; player.vy = 0; player.grounded = true; player.unstick(); break;
    }
    if (car) for (const W of WATERS) { if (car.pos.x > W.x0 && car.pos.x < W.x1 && car.pos.z > W.z0 && car.pos.z < W.z1 && W.y != null) { car.dmg = 1; } }
    if (!car && !player.flying && player.pos.z > RIVER_Z - 6 && player.pos.y < WATER_Y + 0.2) {
      puffs.ring(player.pos.clone().setY(WATER_Y), 0xbfe3ff); sfx.land(); areaToast('Splash! The Saint Lawrence River');
      const z = RIVER_Z - 12; player.pos.set(player.pos.x, world.colliders.ground(player.pos.x, z, h(z) + 30, 0.2), z); player.visY = player.pos.y; player.vy = 0; player.grounded = true; player.unstick();
    }
    if (!car && player.speed > 0.5) props.push(player.pos.x, player.pos.z, player.pos.y, player.pos.y + 1.7, player.bike ? 0.55 : 0.35, player.vel.x, player.vel.z, player.bike ? 95 : 70);
    props.update(dt);
    crowd.update(dt, player, camera.position); walkers.update(dt, player, camera, cam.yaw); cities.update(t, scene.fog);
    combat.update(dt, t); police.update(dt, t); pickups.update(dt, player, combat); breakables.update(dt, look.night);
    activities.update(dt, player, car, (v) => { save.money += v; writeSave(save); updateMoney(); sfx.collect(1.3); });
    for (const v of vehicles) carFx(v, dt); for (const v of police.carVs) carFx(v, dt);
    if (car && car.wreck) exitCar();
    // nobody walks through you: nudge people out of your way
    if (!car) for (const n of vctx.peds) { if (n.rag || n.mode === 'sit') continue; const dx = n.pos.x - player.pos.x, dz = n.pos.z - player.pos.z, d2 = dx * dx + dz * dz; if (d2 < 0.5 && d2 > 1e-5 && Math.abs(n.pos.y - player.pos.y) < 1.2) { const d = Math.sqrt(d2), k = (0.71 - d) * 0.6; if (n.offX !== undefined) { n.offX += dx / d * k; n.offZ += dz / d * k; } else { n.pos.x += dx / d * k; n.pos.z += dz / d * k; if (n.home) n.home.set(n.pos.x, n.pos.y, n.pos.z); } } }
    pipe.U.uDesat.value += ((document.body.classList.contains('dead') ? 1 : 0) - pipe.U.uDesat.value) * Math.min(1, dt * 3 / (slowmo || 1));
    pipe.U.uHurt.value = Math.min(1, (combat.hurt || 0) * 0.8 + (combat.hp < 30 ? 0.35 + Math.sin(t * 6) * 0.1 : 0));
    document.body.classList.toggle('driving', !!car);
    if (photoMode && pose) hero.animate(0, 0, true, 1, { parcel: player.parcel });
    if (stepped) { sfx.step(season === 'winter' ? 'snow' : weather.wet > 0.5 ? 'wet' : 'dry'); if (player.speed > 4 || season === 'winter' || weather.wet > 0.5) puffs.at(player.pos, season === 'winter' ? 0xf2f6ff : weather.wet > 0.5 ? 0xbfd8ff : 0xd9cdb8, 3); }
    if (player.jumped) { sfx.jump(); player.jumped = false; }
    if (player.landed) { sfx.land(); puffs.ring(player.pos, season === 'winter' ? 0xf2f6ff : 0xd9cdb8); player.landed = false; }
    if (player.fx.doubled) { player.fx.doubled = false; sfx.jump(1.5); puffs.ring(player.pos, 0xffffff); ach.unlock('flip'); }
    if (player.fx.dashed) { player.fx.dashed = false; sfx.dash(); }
    if (player.fx.glide) { player.fx.glide = false; ach.unlock('glide'); }
    if (player.bumped) { player.bumped = false; if (player.speed > 4) sfx.land(); }
    if (player.fx.takeoff) { player.fx.takeoff = false; sfx.whoosh(); puffs.ring(player.pos, 0xffffff); ach.unlock('fly'); }
    const alt = player.pos.y - h(player.pos.z);
    if (player.flying) { if (alt > 100) ach.unlock('summit'); if (clouds.inside(camera.position)) { ach.unlock('cloud'); pipe.U.uFlash.value = Math.max(pipe.U.uFlash.value, 0.18); } }
    sfx.wind(player.flying ? Math.min(1, player.speed / 20) : 0);
    wingTrails(myTrails, hero, player.yaw, player.flying && player.speed > 4, dt);
    document.body.classList.toggle('flying', player.flying); document.body.classList.toggle('tired', !player.flying && player.energy < 99);
    $('#energy').style.width = player.energy + '%'; $('#energy').classList.toggle('low', player.energy < 25); $('#alt').textContent = Math.max(0, Math.round(alt)) + ' m';
    clouds.update(dt, look);
    downtown.update(t, look.night);
    missions.update(rawDt, player, t);   // real seconds, so every player's countdown agrees
    updateRemotes(dt);
    stT += dt; if (stT > 1 / 12) { stT = 0; sendState(); }
    boardT -= dt; if (boardT < 0) { boardT = 0.25; if (multi || missions.cur) missions.drawBoard(); }
    npcs.update(dt, player, { hour: clockH, rain: weather.precip === 'rain' });
    traffic.update(dt, player, vctx.peds);
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
      passed('delivery complete', `$${dl.tip}`); floatText(`+$${dl.tip}`, 'money'); if (dl.combo > 1) setTimeout(() => floatText(`Combo ×${dl.combo}!`, 'combo'), 300);
      say(dl.job.who, dl.late ? 'Finally! A bit late, but thanks anyway.' : dl.fast ? 'Already?! Wow, thanks! Here\'s a nice tip.' : 'Thank you so much! Have a great day!', 5);
      ach.unlock('firstDelivery'); if (save.deliveries >= 10) ach.unlock('tenDeliveries'); if (dl.fast) ach.unlock('speedy');
    }
    const job = deliveries.job;
    document.body.classList.toggle('onjob', !!job);
    if (job) {
      $('#jobWho').textContent = `${job.item} → ${job.who}`; $('#jobAddr').textContent = job.addr;
      $('#jobTime').textContent = job.left > 0 ? `${Math.ceil(job.left)} s` : 'Late!';
      $('#jobBar').style.width = Math.max(0, job.left / job.time * 100) + '%';
      $('#jobBar').classList.toggle('late', job.left < job.time * 0.25);
      const d = Math.hypot(job.target.x - player.pos.x, job.target.z - player.pos.z);
      $('#jobDist').textContent = d < 1000 ? `${Math.round(d)} m` : '';
      pointArrow($('#arrow'), job.target);   // edge-of-screen arrow toward the drop-off
    }
    sfx.intensity(job ? (job.left < job.time * 0.25 ? 2 : 1) : 0);
    sfx.rain(weather.precip === 'rain' ? weather.wet : 0);
    // achievements tied to the world
    if (started && (clockH >= 22 || clockH < 4)) ach.unlock('night');
    if (started && season === 'winter' && player.speed > 1) ach.unlock('snow');
    updateLook(dt);
    combat.updateAim(dt); updateCamera(dt, t);
    sky.position.copy(camera.position);   // the sky dome follows you (it's only 1.5 km across and the cities are far apart)
    if (REAL) {
      // PBR: convert any new toon materials, and re-light reflections from the current sky every few seconds
      if ((++realFr) % 150 === 1) realifyScene(scene);
      envT -= dt; if (envT <= 0) { envT = touch ? 45 : 20; envSky.material = sky.material; const rt = pmrem.fromScene(envScene, 0, 0.1, 200); if (envRT) envRT.dispose(); envRT = rt; scene.environment = rt.texture; }
    }
    // speed lines + flash
    const sp = car ? Math.min(1, Math.max(0, (car.speed - 16) / 14)) : Math.max(player.dashT > 0 ? 1 : 0, Math.min(1, Math.max(0, (player.speed - 6.5) / 4)));
    pipe.U.uSpeed.value += (sp - pipe.U.uSpeed.value) * (1 - Math.exp(-dt * 8));
    pipe.U.uFlash.value = Math.max(0, pipe.U.uFlash.value - dt * 3);
    // nearest interactable
    let best = null, bd = 2.6;
    if (started && !photoMode && !player.flying) for (const o of talkables()) { const d = Math.hypot(o.x - player.pos.x, o.z - player.pos.z); if ((d < bd || o.label === 'Get off the bike') && Math.abs(o.y - player.pos.y) < 2.2) { bd = d; best = o; } }
    near = best;
    const prm = $('#prompt');
    if (best && !$('#say').classList.contains('show')) { $('#promptText').textContent = best.label; prm.classList.add('show'); } else prm.classList.remove('show');
    if ($('#say').classList.contains('show') && best === null && clock.elapsedTime - +$('#say').dataset.at > 2.5 && player.speed > 1) closeSay();
    const w = whereIs(player.pos.x, player.pos.z);
    if (w.name && w.name !== lastArea && started) { lastArea = w.name; areaToast(w.name); }
    $('#boostCafe').classList.toggle('show', player.boost > 0); $('#boostJump').classList.toggle('show', player.jumpBoost > 0);
    $('#onBike').classList.toggle('show', !!player.bike);
    const mt = activities.target() || missions.target(), ma = $('#marr');
    ma.classList.toggle('has', !!mt);
    if (mt) { pointArrow(ma, mt); ma.querySelector('span').textContent = Math.round(mt.distanceTo(player.pos)) + ' m'; }
    if ((mmT = (mmT + 1) % 2) === 0) mm.draw(player, cam.yaw, bagels.list, job?.target, missions.marks(), [...remotes.values()].map((r) => ({ x: r.pos.x, z: r.pos.z, c: COLORS[r.color] })).concat(pickups.marks(), activities.marks(), police.marks(t)));
    placeTag(meTag, hero.root.position, 2.2);
    for (const r of remotes.values()) placeTag(r.tag, r.pos, 2.25);
    sfx.ambience(look.night, season, weather.precip);
    // city ambience: hum louder near busy streets, sirens now and then, gulls by the river, metro chime, church bells on the hour
    { const P = player.pos; let near = 0; for (const c of traffic.cars) if (!c.taken && c.x !== undefined) near += Math.max(0, 1 - Math.hypot(c.x - P.x, c.z - P.z) / 60);
      sfx.city(Math.min(1, 0.3 + near * 0.25) * (started ? 1 : 0));
      amb.siren -= dt; if (amb.siren < 0) { amb.siren = 70 + Math.random() * 90; sfx.siren(0.6 + Math.random() * 0.4); }
      if (P.z > 950) { amb.gull -= dt; if (amb.gull < 0) { amb.gull = 3 + Math.random() * 6; sfx.gull(); } }
      const inMetro = P.x > PLAZA.x0 && P.x < PLAZA.x1 && P.z > PLAZA.z0 && P.z < PLAZA.z1;
      if (inMetro && !amb.metro) sfx.metro(); amb.metro = inMetro;
      const hr = Math.floor(clockH); if (amb.hour !== undefined && hr !== amb.hour && Math.hypot(P.x - 26, P.z + 14) < 320) for (let i = 0; i < Math.min(3, (hr % 12) || 12); i++) setTimeout(() => sfx.bell(), i * 1300); amb.hour = hr; }
    saveT += dt; if (saveT > 10) { saveT = 0; save.hour = clockH; writeSave(save); }
    cullFar();
    pipe.render();
    adaptResolution(rawDt);
    if (shot) { shot = false; const a = document.createElement('a'); a.download = `plateau-montreal-${Date.now()}.png`; a.href = renderer.domElement.toDataURL('image/png'); a.click(); }
  }
  function cullFar() {
    const cp = camera.position;
    for (const n of npcs.list) if (n.out) n.ch.root.visible = n.ch.root.position.distanceTo(cp) < 150;
    for (const c of traffic.cars) c.m.g.visible = !c.taken && c.m.g.position.distanceTo(cp) < 260;   // a car you took stays hidden (it used to reappear: the "duplicate")
    for (const ch of world.city.children) { const s = ch.geometry.boundingSphere; ch.visible = Math.hypot(s.center.x - cp.x, s.center.z - cp.z) - s.radius < 1200; }
    // parked cars: a few pixels tall past ~260 m (and in the fog) — skip those chunks in every pass
    const carR = 260 + Math.max(0, cp.y - 30) * 1.5;
    for (const ch of world.parkedCars.children) { const s = ch.geometry.boundingSphere; ch.visible = Math.hypot(s.center.x - cp.x, s.center.z - cp.z) - s.radius < carR; }
  }
  app.frame = frame;
  Object.assign(app, { say, interact, inp, setTime: (h2) => { clockH = typeof h2 === 'number' ? h2 : { day: 13, golden: 18.4, night: 22.5, dawn: 6.5, dusk: 19.8 }[h2]; }, setSeason: (s) => { season = s; updateButtons(); }, setWeather: (s) => { weather.set(s); weather.wet = s === 'rain' && season !== 'winter' ? 1 : 0; updateButtons(); }, near: () => near, talkables, togglePhoto, cycleFilter, keys, setOutfit });
  app.flyTo = (x, y, z) => { player.takeOff(); player.pos.set(x, y, z); };
  Object.assign(app, { makeBike: bikeModel, enterCar, exitCar, setCarView: (v) => { carView = v; } }); Object.defineProperty(app, 'car', { get: () => car });
  app.stats = () => ({ flying: player.flying, energy: +player.energy.toFixed(1), alt: +(player.pos.y - h(player.pos.z)).toFixed(1), peers: net.count, mission: missions.cur && { kind: missions.cur.kind, phase: missions.cur.phase, step: missions.cur.step, awarded: missions.cur.awarded.size }, pts: missions.pts, calls: renderer.info.render.calls, colliders: world.colliders.list.length, bagels: bagels.list.length, hour: +clockH.toFixed(2), money: save.money });
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
  R(X0, X1, Z0, Z1, '#3d454d');
  for (let k = -2; k <= 2; k++) { const sx = nsX(k); R(sx - nsHW(k) - nsSW(k), sx + nsHW(k) + nsSW(k), Z0, Z1, '#59626b'); }
  for (let m = -3; m <= 3; m++) { const sz = ewZ(m); R(X0, X1, sz - ewHW(m) - ewSW(m), sz + ewHW(m) + ewSW(m), '#59626b'); }
  for (let k = -2; k <= 1; k++) R(alleyX(k) - ALLEY_HW, alleyX(k) + ALLEY_HW, Z0, Z1, '#4c545c');
  R(PARK.x0, PARK.x1, PARK.z0, PARK.z1, '#4f7a4c'); R(PLAZA.x0, PLAZA.x1, PLAZA.z0, PLAZA.z1, '#6b6f73');
  for (let k = -2; k <= 2; k++) { const sx = nsX(k); R(sx - nsHW(k), sx + nsHW(k), Z0, Z1, '#a9b0b6'); }
  for (let m = -3; m <= 3; m++) { const sz = ewZ(m); R(X0, X1, sz - ewHW(m), sz + ewHW(m), '#a9b0b6'); }
  for (const [a, c, z0, z1] of world.foot) R(a, c, z0, z1, '#2c3238');
  const W = cv.width, H = cv.height, extra = [];
  return {
    addBase(e) { extra.push(e); },
    draw(player, yaw, bagels, target, marks = [], others = []) {
      x.clearRect(0, 0, W, H);
      const CY = H * 0.6;   // like the game's radar: you sit a little below the middle, more road ahead
      x.save(); x.beginPath(); x.rect(0, 0, W, H); x.clip();
      x.fillStyle = '#262c32'; x.fillRect(0, 0, W, H);
      x.translate(W / 2, CY); x.rotate(yaw); const sc = 1.1;
      x.scale(sc / S, sc / S); x.translate(-(player.pos.x - X0) * S, -(player.pos.z - Z0) * S);
      x.drawImage(base, 0, 0);
      for (const e of extra) if (Math.abs(player.pos.x - (e.X0 + e.cv.width / 2)) < 1700) x.drawImage(e.cv, (e.X0 - X0) * S, (e.Z0 - Z0) * S, e.cv.width * S, e.cv.height * S);
      if (target) { const tx = (target.x - X0) * S, tz = (target.z - Z0) * S; x.strokeStyle = 'rgba(40,200,230,.9)'; x.lineWidth = 5; x.setLineDash([10, 8]); x.beginPath(); x.moveTo((player.pos.x - X0) * S, (player.pos.z - Z0) * S); x.lineTo(tx, tz); x.stroke(); x.setLineDash([]); x.fillStyle = '#2fd0ee'; x.strokeStyle = '#fff'; x.lineWidth = 4; x.beginPath(); x.arc(tx, tz, 11, 0, 7); x.fill(); x.stroke(); }
      for (const m of marks) { x.beginPath(); x.arc((m.x - X0) * S, (m.z - Z0) * S, m.r, 0, 7); if (m.ring) { x.fillStyle = m.c; x.fill(); x.strokeStyle = 'rgba(230,140,20,.9)'; x.lineWidth = 4; x.setLineDash([8, 6]); x.stroke(); x.setLineDash([]); } else { x.fillStyle = m.c; x.strokeStyle = '#2b2550'; x.lineWidth = 3; x.fill(); x.stroke(); } }
      for (const o of others) { x.beginPath(); x.arc((o.x - X0) * S, (o.z - Z0) * S, o.r || 10, 0, 7); x.fillStyle = o.c; x.strokeStyle = o.s || '#fff'; x.lineWidth = 4; x.fill(); x.stroke(); }
      for (const B of bagels) if (!B.got) { x.fillStyle = '#f2a93b'; x.strokeStyle = '#7a3d14'; x.lineWidth = 3; x.beginPath(); x.arc((B.g.position.x - X0) * S, (B.g.position.z - Z0) * S, 7, 0, 7); x.fill(); x.stroke(); }
      x.restore();
      x.save(); x.translate(W / 2, CY); x.rotate(yaw - player.yaw + Math.PI);
      x.fillStyle = '#f4f4f4'; x.strokeStyle = '#111'; x.lineWidth = 2.5; x.beginPath(); x.moveTo(0, -10); x.lineTo(7, 7); x.lineTo(0, 3); x.lineTo(-7, 7); x.closePath(); x.fill(); x.stroke(); x.restore();
      // north marker: the mountain (-z)
      const ex = W / 2 - 14, ey = H / 2 - 14, nx = Math.sin(yaw), ny = -Math.cos(yaw), kk = Math.min(ex / Math.max(1e-3, Math.abs(nx)), ey / Math.max(1e-3, Math.abs(ny))); x.save(); x.translate(W / 2 + nx * kk, H / 2 + ny * kk); x.fillStyle = '#111'; x.beginPath(); x.arc(0, 0, 9, 0, 7); x.fill(); x.fillStyle = '#fff'; x.font = '700 12px Oswald, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('N', 0, 1); x.restore();
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
  let station = 0;
  // Neon 88: driving synthwave (Am – F – C – G), saw bass in eighths, square arps in sixteenths, gated snare
  function synth(i, t) {
    const beat = 60 / 76, C2 = [[57, 60, 64, 69], [53, 57, 60, 65], [48, 52, 55, 60], [55, 59, 62, 67]][i % 4];
    for (let j = 0; j < 8; j++) { const o = A.createOscillator(), g = A.createGain(), fl = A.createBiquadFilter(); o.type = 'sawtooth'; o.frequency.value = mf(C2[0] - 24); fl.type = 'lowpass'; fl.frequency.value = 520; env(g, t + j * beat / 2, 0.005, beat / 2 * 0.8, 0.05); o.connect(fl).connect(g).connect(music); o.start(t + j * beat / 2); o.stop(t + j * beat / 2 + beat / 2); }
    for (const n of C2) { const o = A.createOscillator(), g = A.createGain(), fl = A.createBiquadFilter(); o.type = 'sawtooth'; o.detune.value = (Math.random() - 0.5) * 14; o.frequency.value = mf(n); fl.type = 'lowpass'; fl.frequency.value = 1300; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.009, t + 0.6); g.gain.linearRampToValueAtTime(0.0001, t + beat * 4); o.connect(fl).connect(g).connect(music); o.start(t); o.stop(t + beat * 4 + 0.1); }
    for (let j = 0; j < 16; j++) tone(mf(C2[j % 4] + 12 + (j % 8 > 3 ? 12 : 0)), t + j * beat / 4, 0.12, 0.012, 'square', music);
    for (let j = 0; j < 4; j++) { const tk = t + j * beat, o = A.createOscillator(), g = A.createGain(); o.frequency.setValueAtTime(130, tk); o.frequency.exponentialRampToValueAtTime(42, tk + 0.14); env(g, tk, 0.002, 0.2, 0.22); o.connect(g).connect(music); o.start(tk); o.stop(tk + 0.25); if (j % 2) noiseTo(music, tk, 0.18, 0.12, 1200); noiseTo(music, tk + beat / 2, 0.04, 0.04, 6000); }
  }
  // Mile End Beats: lazy boom-bap (Dm9 – G13)
  function boom(i, t) {
    const beat = 60 / 76, C3 = [[50, 53, 57, 60, 64], [43, 53, 57, 59, 64]][i % 2];
    for (const n of C3) { const o = A.createOscillator(), g = A.createGain(), fl = A.createBiquadFilter(); o.type = 'triangle'; o.frequency.value = mf(n + 12); fl.type = 'lowpass'; fl.frequency.value = 1500; env(g, t, 0.02, beat * 1.6, 0.02); env(g, t + beat * 2.5, 0.02, beat, 0.016); o.connect(fl).connect(g).connect(music); o.start(t); o.stop(t + beat * 4); }
    tone(mf(C3[0] - 12), t, beat * 1.2, 0.09, 'sine', music); tone(mf(C3[0] - 12), t + beat * 2.5, beat, 0.07, 'sine', music);
    for (const [k, v] of [[0, 1], [1.5, 0.7], [2.5, 1]]) { const tk = t + k * beat, o = A.createOscillator(), g = A.createGain(); o.frequency.setValueAtTime(110, tk); o.frequency.exponentialRampToValueAtTime(40, tk + 0.18); env(g, tk, 0.002, 0.28, 0.3 * v); o.connect(g).connect(music); o.start(tk); o.stop(tk + 0.32); }
    for (const k of [1, 3]) noiseTo(music, t + k * beat, 0.22, 0.14, 900);
    for (let j = 0; j < 8; j++) noiseTo(music, t + j * beat / 2 + (j % 2 ? 0.04 : 0), 0.03, 0.03, 7000);
  }
  function bar(i, t) {
    if (station === 3) return; if (station === 1) return synth(i, t); if (station === 2) return boom(i, t);
    const c = CH[i % 4], beat = 60 / 76;
    for (const n of c) { const o = A.createOscillator(), g = A.createGain(), fl = A.createBiquadFilter(); o.type = 'triangle'; o.frequency.value = mf(n); fl.type = 'lowpass'; fl.frequency.value = 900; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.022, t + 0.4); g.gain.linearRampToValueAtTime(0.0001, t + beat * 4); o.connect(fl).connect(g).connect(music); o.start(t); o.stop(t + beat * 4 + 0.1); }
    tone(mf(c[0] - 12), t, beat * 3.5, 0.05, 'sine', music);
    const arp = [c[0] + 12, c[2] + 12, c[1] + 12, c[3] + 12, c[2] + 12, c[1] + 12, c[3] + 12, c[2] + 24];
    arp.forEach((n, j) => { if (Math.random() < 0.85) tone(mf(n), t + j * beat / 2, 0.5, 0.018, 'sine', music); });
  }
  function schedule() { let i = 0, t = A.currentTime + 0.1; const loop = () => { while (t < A.currentTime + 2) { bar(i++, t); t += 4 * 60 / 76; } }; loop(); musicT = setInterval(loop, 500); }
  let cityG = null, drums = null, drumT = null, level = 0, rainG = null, windG = null, windF = null, eng = null, eng2 = null, engF = null, engG = null;
  function drumLoop() {
    const beat = 60 / 76 / 2; let t = A.currentTime + 0.05, i = 0;
    drumT = setInterval(() => { while (t < A.currentTime + 0.6) { if (level > 0) { if (i % 4 === 0) { const o = A.createOscillator(), g = A.createGain(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12); env(g, t, 0.003, 0.18, 0.12 * level); o.connect(g).connect(drums); o.start(t); o.stop(t + 0.25); } if (i % 2 === 1 || level > 1) noiseTo(drums, t, 0.03, 0.025 * level, 8000); } t += beat; i++; } }, 150);
  }
  const noiseTo = (dest, t, d, peak, f) => { const len = Math.floor(A.sampleRate * d), buf = A.createBuffer(1, len, A.sampleRate), ch = buf.getChannelData(0); for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1; const s = A.createBufferSource(); s.buffer = buf; const fl = A.createBiquadFilter(); fl.type = 'highpass'; fl.frequency.value = f; const g = A.createGain(); env(g, t, 0.002, d, peak); s.connect(fl).connect(g).connect(dest); s.start(t); };
  return {
    intensity(l) { level = l; },
    radio(n) { station = ((n % 4) + 4) % 4; return station; }, get station() { return station; },
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
    engine(rpm, thr, speed) {
      if (!A) return;
      if (!eng) { eng = A.createOscillator(); eng.type = 'sawtooth'; eng2 = A.createOscillator(); eng2.type = 'square'; const lp = A.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700; engF = lp; engG = A.createGain(); engG.gain.value = 0; eng.connect(lp); eng2.connect(lp); lp.connect(engG).connect(master); eng.start(); eng2.start(); }
      const t = A.currentTime, f = 28 + rpm / 60 * 1.2;
      eng.frequency.setTargetAtTime(f, t, 0.05); eng2.frequency.setTargetAtTime(f * 0.5, t, 0.05); engF.frequency.setTargetAtTime(380 + thr * 900 + rpm * 0.08, t, 0.08);
      engG.gain.setTargetAtTime(on && rpm > 0 ? 0.035 + thr * 0.04 : 0, t, 0.1);
    },
    // the city itself: a low traffic hum, far-off sirens, gulls by the river, the STM metro chime
    city(v) {
      if (!A) return;
      if (!cityG) { const len = A.sampleRate * 3, buf = A.createBuffer(1, len, A.sampleRate), ch = buf.getChannelData(0); let l = 0; for (let i = 0; i < len; i++) { l = l * 0.995 + (Math.random() * 2 - 1) * 0.005; ch[i] = l * 9; } const src = A.createBufferSource(); src.buffer = buf; src.loop = true; const lp = A.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260; cityG = A.createGain(); cityG.gain.value = 0; src.connect(lp).connect(cityG).connect(master); src.start(); }
      cityG.gain.setTargetAtTime(on ? v * 0.11 : 0, A.currentTime, 0.8);
    },
    siren(far = 1) { if (!A || !on) return; const t = A.currentTime, o = A.createOscillator(), g = A.createGain(), lp = A.createBiquadFilter(); o.type = 'triangle'; lp.type = 'lowpass'; lp.frequency.value = 1400; for (let i = 0; i < 6; i++) { o.frequency.setValueAtTime(700, t + i * 1.1); o.frequency.linearRampToValueAtTime(1150, t + i * 1.1 + 0.55); o.frequency.linearRampToValueAtTime(700, t + i * 1.1 + 1.1); } g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.03 * far, t + 2); g.gain.linearRampToValueAtTime(0.0001, t + 6.6); o.connect(lp).connect(g).connect(master); o.start(t); o.stop(t + 6.8); },
    gull() { if (!A || !on) return; const t = A.currentTime; for (let i = 0; i < 3; i++) { const o = A.createOscillator(), g = A.createGain(); o.type = 'sawtooth'; const b = 1500 + Math.random() * 400; o.frequency.setValueAtTime(b, t + i * 0.22); o.frequency.exponentialRampToValueAtTime(b * 0.62, t + i * 0.22 + 0.18); const bp = A.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1700; bp.Q.value = 4; env(g, t + i * 0.22, 0.02, 0.18, 0.025); o.connect(bp).connect(g).connect(master); o.start(t + i * 0.22); o.stop(t + i * 0.22 + 0.25); } },
    metro() { if (!A || !on) return; const t = A.currentTime; [[0, 523.25], [0.32, 659.25], [0.64, 783.99]].forEach(([d, f]) => tone(f, t + d, 0.6, 0.06, 'sine')); },
    horn() { if (!A || !on) return; const t = A.currentTime; for (const f of [392, 494]) tone(f, t, 0.5, 0.07, 'square'); },
    crash(v = 1) { if (!A || !on) return; noise(A.currentTime, 0.35, 0.3 * v, 220, 0.5); noise(A.currentTime + 0.03, 0.25, 0.18 * v, 1800, 0.8); },
    shot(k = 1, v = 1) { if (!A || !on) return; const t = A.currentTime, f = [0, 900, 1300, 650][k] || 900; noise(t, 0.12 + k * 0.03, 0.34 * v, f, 0.7); noise(t, 0.28, 0.2 * v, 220, 0.5); tone(120 - k * 12, t, 0.14, 0.18 * v, 'sine'); },
    hit(hs) { if (!A || !on) return; const t = A.currentTime; tone(hs ? 1500 : 900, t, 0.06, 0.07, 'square'); noise(t, 0.05, 0.08, 2400, 1); },
    thud(v = 1) { if (!A || !on) return; const t = A.currentTime; tone(85, t, 0.22, 0.34 * v, 'sine'); noise(t, 0.12, 0.2 * v, 320, 0.6); },
    reload(v = 1) { if (!A || !on) return; const t = A.currentTime; noise(t, 0.04, 0.12, 2200, 2); noise(t + 0.22 * v, 0.05, 0.14, 1400, 2); },
    empty() { if (!A || !on) return; noise(A.currentTime, 0.03, 0.1, 3000, 2); },
    ping() { if (!A || !on) return; const t = A.currentTime; tone(2100, t, 0.1, 0.05, 'triangle'); noise(t, 0.04, 0.06, 3200, 3); },
    hurt() { if (!A || !on) return; const t = A.currentTime; tone(180, t, 0.18, 0.12, 'sawtooth'); noise(t, 0.1, 0.12, 500, 1); },
    wasted() { if (!A || !on) return; const t = A.currentTime; [330, 247, 196, 147].forEach((f, i) => tone(f, t + i * 0.28, 0.9, 0.07, 'triangle')); },
    star(n = 1) { if (!A || !on) return; const t = A.currentTime; tone(880 + n * 120, t, 0.12, 0.05, 'square'); tone(1175 + n * 120, t + 0.12, 0.16, 0.05, 'square'); },
    scream(v = 1) { if (!A || !on) return; const t = A.currentTime, o = A.createOscillator(), g = A.createGain(), f = A.createBiquadFilter(), b0 = 520 + Math.random() * 420; o.type = 'sawtooth'; o.frequency.setValueAtTime(b0, t); o.frequency.linearRampToValueAtTime(b0 * 1.7, t + 0.12); o.frequency.linearRampToValueAtTime(b0 * 1.25, t + 0.55); const lfo = A.createOscillator(), lg = A.createGain(); lfo.frequency.value = 7; lg.gain.value = 30; lfo.connect(lg).connect(o.frequency); f.type = 'bandpass'; f.frequency.value = 1600; f.Q.value = 1.2; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.05 * v, t + 0.05); g.gain.linearRampToValueAtTime(0.0001, t + 0.62); o.connect(f).connect(g).connect(master); o.start(t); lfo.start(t); o.stop(t + 0.65); lfo.stop(t + 0.65); },
    copSiren(far = 1) { if (!A || !on) return; const t = A.currentTime, o = A.createOscillator(), g = A.createGain(); o.type = 'square'; for (let i = 0; i < 6; i++) o.frequency.setValueAtTime(i % 2 ? 960 : 720, t + i * 0.3); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.025 * far, t + 0.1); g.gain.linearRampToValueAtTime(0.0001, t + 1.8); o.connect(g).connect(master); o.start(t); o.stop(t + 1.9); },
    door() { if (!A || !on) return; noise(A.currentTime, 0.08, 0.2, 500, 1.2); noise(A.currentTime + 0.09, 0.05, 0.12, 900, 1.2); },
    whoosh() { if (!A || !on) return; noise(A.currentTime, 0.45, 0.16, 700, 0.4); noise(A.currentTime + 0.1, 0.35, 0.1, 1500, 0.6); },
    wind(v) { if (!A) return; if (!windG) { const len = A.sampleRate * 2, buf = A.createBuffer(1, len, A.sampleRate), ch = buf.getChannelData(0); let l = 0; for (let i = 0; i < len; i++) { l = l * 0.97 + (Math.random() * 2 - 1) * 0.03; ch[i] = l * 6; } const s = A.createBufferSource(); s.buffer = buf; s.loop = true; windF = A.createBiquadFilter(); windF.type = 'bandpass'; windF.Q.value = 0.7; windF.frequency.value = 500; windG = A.createGain(); windG.gain.value = 0; s.connect(windF).connect(windG).connect(master); s.start(); } windG.gain.setTargetAtTime(on ? v * 0.18 : 0, A.currentTime, 0.3); windF.frequency.setTargetAtTime(400 + v * 900, A.currentTime, 0.3); },
    mission(k, n = 0) {
      if (!A || !on) return; const t = A.currentTime;
      if (k === 'tick') tone(660, t, 0.15, 0.08, 'square');
      if (k === 'go') { tone(990, t, 0.4, 0.09, 'square'); tone(1320, t + 0.05, 0.4, 0.05, 'triangle'); }
      if (k === 'ring') { tone(mf(72 + n * 2), t, 0.25, 0.08, 'triangle'); tone(mf(79 + n * 2), t + 0.06, 0.3, 0.06, 'triangle'); }
      if (k === 'star') [0, 7, 12].forEach((s2, i) => tone(mf(79 + s2 + Math.min(n, 12)), t + i * 0.05, 0.25, 0.06, 'triangle'));
      if (k === 'win') [0, 4, 7, 12, 16, 19, 24].forEach((s2, i) => tone(mf(64 + s2), t + i * 0.09, 0.6, 0.08, 'triangle'));
      if (k === 'lose') [7, 4, 0, -5].forEach((s2, i) => tone(mf(64 + s2), t + i * 0.16, 0.4, 0.06, 'triangle'));
      if (k === 'join') [0, 7].forEach((s2, i) => tone(mf(76 + s2), t + i * 0.1, 0.3, 0.06, 'sine'));
    },
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
