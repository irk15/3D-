// xr.js — Meta Quest 3 / WebXR: teleport, smooth locomotion, snap turn, wrist menu, map tablet,
// landmark info cards and hand tracking. No screen-space post-processing is ever used in XR.
import * as THREE from 'three';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';
import { XRHandModelFactory } from 'three/addons/webxr/XRHandModelFactory.js';
import { floorAt, terrainH, waterSDF, DOM, MASK, district, D } from './core.js';
import { LANDMARKS, standPoint } from './landmarks.js';

function panelCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return { c, x: c.getContext('2d'), t }; }

export class XR {
  constructor(renderer, scene, opts) {
    this.renderer = renderer; this.scene = scene; this.opts = opts;   // opts: {atmo, onEnter, onExit, setTime, setSeason, setWeather, state}
    this.rig = new THREE.Group(); this.rig.name = 'xr-rig';
    this.cam = new THREE.PerspectiveCamera(70, 1, 0.15, 6000);
    this.rig.add(this.cam); scene.add(this.rig);
    this.active = false; this.fast = false; this.vignetteOn = true; this.snapReady = true; this.blink = 0; this.pendingTeleport = null;
    this.hands = {}; this.ctrl = [];
    const cmf = new XRControllerModelFactory(), hmf = new XRHandModelFactory();
    for (let i = 0; i < 2; i++) {
      const c = renderer.xr.getController(i), g = renderer.xr.getControllerGrip(i), hnd = renderer.xr.getHand(i);
      try { g.add(cmf.createControllerModel(g)); } catch (e) { /* offline */ }
      try { hnd.add(hmf.createHandModel(hnd, 'mesh')); } catch (e) { /* offline */ }
      const info = { c, g, h: hnd, hand: null, gp: null, select: false };
      c.addEventListener('connected', (e) => { info.hand = e.data.handedness; info.src = e.data; this.hands[info.hand] = info; this.attachUI(); });
      c.addEventListener('disconnected', () => { if (this.hands[info.hand] === info) delete this.hands[info.hand]; info.hand = null; });
      c.addEventListener('selectstart', () => { info.select = true; this.onSelect(info); });
      c.addEventListener('selectend', () => { info.select = false; });
      this.rig.add(c, g, hnd); this.ctrl.push(info);
      // pointer ray
      const rg = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]);
      const ray = new THREE.Line(rg, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false }));
      ray.scale.z = 4; ray.visible = false; c.add(ray); info.ray = ray;
    }
    // teleport arc + target ring
    const ag = new THREE.BufferGeometry(); ag.setAttribute('position', new THREE.BufferAttribute(new Float32Array(60 * 3), 3));
    this.arc = new THREE.Line(ag, new THREE.LineBasicMaterial({ color: 0x7fd4ff, transparent: true, opacity: 0.9, depthWrite: false }));
    this.arc.frustumCulled = false; this.arc.visible = false; scene.add(this.arc);
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.28, 0.4, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x7fd4ff, transparent: true, opacity: 0.85, depthWrite: false }));
    this.ring.visible = false; scene.add(this.ring);
    // blink + comfort vignette (attached to the head)
    this.fade = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, side: THREE.BackSide, depthTest: false, depthWrite: false }));
    this.fade.renderOrder = 1000; this.cam.add(this.fade);
    this.vig = new THREE.Mesh(new THREE.RingGeometry(0.11, 0.5, 48), new THREE.ShaderMaterial({
      uniforms: { uA: { value: 0 } }, transparent: true, depthTest: false, depthWrite: false,
      vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform float uA; varying vec2 vP; void main(){ float r = length(vP); gl_FragColor = vec4(0.0, 0.0, 0.0, smoothstep(0.12, 0.2, r) * uA); }',
    }));
    this.vig.position.z = -0.12; this.vig.renderOrder = 999; this.cam.add(this.vig);
    // wrist menu + map + info card
    this.menu = this.makeMenu(); this.map = this.makeMap(); this.card = this.makeCard();
    this.page = 0; this.showMap = false;
    this.tmp = new THREE.Vector3(); this.tmp2 = new THREE.Vector3(); this.rc = new THREE.Raycaster();
    renderer.xr.addEventListener('sessionstart', () => this.start());
    renderer.xr.addEventListener('sessionend', () => this.end());
  }
  // ---------------------------------------------------------------- session
  async enter(scale) {
    if (!navigator.xr) throw new Error('WebXR not available');
    this.renderer.xr.setFramebufferScaleFactor(scale || 1.1);
    const session = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking', 'layers'] });
    this.renderer.xr.setReferenceSpaceType('local-floor');
    await this.renderer.xr.setSession(session);
  }
  start() {
    this.active = true;
    this.renderer.xr.setFoveation(0.6);
    this.opts.onEnter?.();
    const L = LANDMARKS.find((l) => l.id === 'belvedere') || LANDMARKS[0];
    this.teleportTo(...standPoint(L));
  }
  end() { this.active = false; this.opts.onExit?.(); this.arc.visible = this.ring.visible = false; }
  teleportTo(u, v, yawDeg = null) {
    const y = floorAt(u, -v, 1e9);
    this.rig.position.set(u, y, -v);
    if (yawDeg !== null) this.rig.rotation.y = -yawDeg * Math.PI / 180;
    this.floorY = y;
  }
  // ---------------------------------------------------------------- UI panels
  attachUI() {
    const L = this.hands.left;
    if (L && this.menu.mesh.parent !== L.g) { L.g.add(this.menu.mesh); L.g.add(this.map.mesh); }
  }
  makeMenu() {
    const P = panelCanvas(1024, 768);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.30, 0.225), new THREE.MeshBasicMaterial({ map: P.t, transparent: true, depthWrite: true }));
    mesh.position.set(0.02, 0.07, -0.08); mesh.rotation.set(-0.9, 0, 0.0);
    mesh.visible = true;
    return Object.assign(P, { mesh, buttons: [] });
  }
  drawMenu(hover) {
    const { x, c } = this.menu, s = this.opts.state();
    const B = this.menu.buttons = [];
    x.clearRect(0, 0, c.width, c.height);
    x.fillStyle = 'rgba(10,16,30,.92)'; roundRect(x, 6, 6, c.width - 12, c.height - 12, 36); x.fill();
    x.strokeStyle = 'rgba(255,255,255,.18)'; x.lineWidth = 3; x.stroke();
    x.fillStyle = '#fff'; x.font = '600 50px Georgia, serif'; x.fillText('Montréal', 40, 74);
    x.font = '500 30px system-ui, sans-serif'; x.fillStyle = '#9fb4d6';
    x.fillText(`${fmtHour(s.hour)} · ${s.season} · ${s.weather}`, 330, 70);
    const btn = (id, label, bx, by, bw, bh, on) => {
      B.push({ id, x: bx, y: by, w: bw, h: bh });
      x.fillStyle = on ? '#e4002b' : (hover === id ? 'rgba(255,255,255,.22)' : 'rgba(255,255,255,.08)');
      roundRect(x, bx, by, bw, bh, 16); x.fill();
      x.fillStyle = '#fff'; x.font = '600 28px system-ui, sans-serif'; x.textAlign = 'center'; x.fillText(label, bx + bw / 2, by + bh / 2 + 10); x.textAlign = 'left';
    };
    const row = (label, y) => { x.fillStyle = '#7f93b5'; x.font = '600 22px system-ui, sans-serif'; x.fillText(label.toUpperCase(), 40, y); };
    row('Time', 120);
    [['dawn', 'Dawn', 6.2], ['day', 'Day', 12.5], ['golden', 'Golden', 'golden'], ['blue', 'Blue hr', 'blue'], ['night', 'Night', 22.5]].forEach(([id, l], i) => btn('t:' + id, l, 40 + i * 190, 134, 175, 62, s.timePreset === id));
    row('Season', 228);
    ['spring', 'summer', 'autumn', 'winter'].forEach((id, i) => btn('s:' + id, id[0].toUpperCase() + id.slice(1), 40 + i * 238, 242, 222, 62, s.season === id));
    row('Weather', 336);
    ['clear', 'cloudy', 'rain', 'snow', 'fog'].forEach((id, i) => btn('w:' + id, id[0].toUpperCase() + id.slice(1), 40 + i * 190, 350, 175, 62, s.weather === id));
    row('Teleport', 444);
    const per = 6, list = LANDMARKS.slice(this.page * per, this.page * per + per);
    list.forEach((L, i) => btn('l:' + L.id, L.name.length > 22 ? L.name.slice(0, 21) + '…' : L.name, 40 + (i % 2) * 476, 458 + Math.floor(i / 2) * 70, 460, 60, false));
    btn('prev', '‹', 40, 676, 90, 62, false); btn('next', '›', 140, 676, 90, 62, false);
    btn('map', this.showMap ? 'Hide map' : 'Map', 260, 676, 220, 62, this.showMap);
    btn('vig', this.vignetteOn ? 'Comfort on' : 'Comfort off', 490, 676, 160, 62, false);
    btn('fast', this.fast ? 'Detail: fast' : 'Detail: full', 660, 676, 180, 62, this.fast);
    btn('exit', 'Exit', 850, 676, 134, 62, false);
    this.menu.t.needsUpdate = true;
  }
  makeMap() {
    const P = panelCanvas(1024, 1024);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.34), new THREE.MeshBasicMaterial({ map: P.t, transparent: true }));
    mesh.position.set(0.02, 0.33, -0.12); mesh.rotation.set(-0.35, 0, 0); mesh.visible = false;
    // base map from the baked masks
    const base = document.createElement('canvas'); base.width = base.height = 512; const bx = base.getContext('2d'); const img = bx.createImageData(512, 512);
    const N = DOM.N, st = N / 512;
    for (let j = 0; j < 512; j++) for (let i = 0; i < 512; i++) {
      const k = (Math.floor(j * st) * N + Math.floor(i * st)), o = (j * 512 + i) * 4;
      let r = 52, g = 50, b = 56;
      const d = MASK.dist[k] >> 4;
      if (d === D.DOWNTOWN) { r = 92; g = 88; b = 100; } else if (d === D.OLD) { r = 120; g = 96; b = 78; } else if (d === D.PLAZA) { r = 150; g = 145; b = 140; }
      if (MASK.park[k] > 128) { r = 58; g = 104; b = 52; } if (MASK.forest[k] > 128) { r = 34; g = 74; b = 38; }
      if (MASK.road[k] > 128) { r = 150; g = 150; b = 150; }
      if (MASK.water[k] < 128) { r = 24; g = 54; b = 92; }
      img.data[o] = r; img.data[o + 1] = g; img.data[o + 2] = b; img.data[o + 3] = 255;
    }
    bx.putImageData(img, 0, 0);
    return Object.assign(P, { mesh, base });
  }
  drawMap(hoverUV) {
    const { x, c, base } = this.map;
    x.clearRect(0, 0, c.width, c.height);
    x.fillStyle = 'rgba(10,16,30,.92)'; roundRect(x, 0, 0, 1024, 1024, 40); x.fill();
    x.drawImage(base, 32, 32, 960, 960);
    const toPx = (u, v) => [32 + (u - DOM.U0) / (DOM.U1 - DOM.U0) * 960, 32 + (DOM.V1 - v) / (DOM.V1 - DOM.V0) * 960];
    x.font = '600 22px system-ui, sans-serif';
    for (const L of LANDMARKS) { const [px, py] = toPx(L.u, L.v); x.fillStyle = '#ffcc4d'; x.beginPath(); x.arc(px, py, 7, 0, 7); x.fill(); x.fillStyle = 'rgba(255,255,255,.85)'; x.fillText(L.name.split(' ').slice(0, 2).join(' '), px + 10, py + 7); }
    const p = this.rig.position; const [qx, qy] = toPx(p.x, -p.z);
    x.fillStyle = '#e4002b'; x.beginPath(); x.arc(qx, qy, 12, 0, 7); x.fill(); x.strokeStyle = '#fff'; x.lineWidth = 4; x.stroke();
    if (hoverUV) { x.strokeStyle = '#7fd4ff'; x.lineWidth = 4; x.beginPath(); x.arc(hoverUV[0] * 1024, (1 - hoverUV[1]) * 1024, 18, 0, 7); x.stroke(); }
    x.fillStyle = '#fff'; x.font = '600 30px system-ui'; x.fillText('Point and pull the trigger to teleport', 40, 1010);
    this.map.t.needsUpdate = true;
  }
  makeCard() {
    const P = panelCanvas(1024, 512);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.6), new THREE.MeshBasicMaterial({ map: P.t, transparent: true, depthTest: true }));
    mesh.visible = false; this.scene.add(mesh);
    return Object.assign(P, { mesh, until: 0 });
  }
  showCard(L) {
    const { x, c } = this.card;
    x.clearRect(0, 0, c.width, c.height);
    x.fillStyle = 'rgba(10,16,30,.9)'; roundRect(x, 0, 0, c.width, c.height, 36); x.fill();
    x.fillStyle = '#e4002b'; x.fillRect(40, 44, 8, 92);
    x.fillStyle = '#fff'; x.font = '600 54px Georgia, serif'; x.fillText(L.name, 66, 92);
    x.fillStyle = '#9fb4d6'; x.font = 'italic 30px Georgia, serif'; x.fillText(`${L.fr} · ${L.year}`, 66, 132);
    x.fillStyle = '#e7ecf5'; x.font = '400 30px system-ui, sans-serif';
    let y = 196; for (const f of L.facts) for (const line of wrap(x, f, 920)) { x.fillText(line, 50, y); y += 42; }
    this.card.t.needsUpdate = true;
    const head = this.cam.getWorldPosition(this.tmp), dir = this.cam.getWorldDirection(this.tmp2);
    this.card.mesh.position.copy(head).addScaledVector(dir, 1.8); this.card.mesh.position.y = head.y - 0.1;
    this.card.mesh.lookAt(head.x, this.card.mesh.position.y, head.z);
    this.card.mesh.visible = true; this.card.until = performance.now() + 9000;
  }
  // ---------------------------------------------------------------- input
  rayFrom(info) {
    const m = info.c.matrixWorld;
    const o = new THREE.Vector3().setFromMatrixPosition(m), d = new THREE.Vector3(0, 0, -1).transformDirection(m);
    return [o, d];
  }
  hitPanels(info) {
    const [o, d] = this.rayFrom(info); this.rc.set(o, d); this.rc.far = 3;
    const targets = []; if (this.menu.mesh.parent && this.menu.mesh.visible) targets.push(this.menu.mesh); if (this.map.mesh.visible && this.map.mesh.parent) targets.push(this.map.mesh);
    if (this.card.mesh.visible) targets.push(this.card.mesh);
    const h = this.rc.intersectObjects(targets, false)[0];
    return h || null;
  }
  onSelect(info) {
    if (info.hand === 'left' && this.hands.right) return;  // the right hand points; left holds the menu
    const h = this.hitPanels(info);
    if (h && h.object === this.menu.mesh) {
      const px = h.uv.x * 1024, py = (1 - h.uv.y) * 768;
      const b = this.menu.buttons.find((b) => px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h);
      if (b) this.press(b.id);
      return;
    }
    if (h && h.object === this.map.mesh) {
      const fx = (h.uv.x * 1024 - 32) / 960, fy = ((1 - h.uv.y) * 1024 - 32) / 960;
      if (fx >= 0 && fx <= 1 && fy >= 0 && fy <= 1) {
        const u = DOM.U0 + fx * (DOM.U1 - DOM.U0), v = DOM.V1 - fy * (DOM.V1 - DOM.V0);
        if (waterSDF(u, v) > 1) this.blinkTo(u, v, null);
      }
      return;
    }
    if (h && h.object === this.card.mesh) { this.card.mesh.visible = false; return; }
    // point at a landmark -> info card
    const [o, d] = this.rayFrom(info);
    let best = null, bestA = 0.05;
    for (const L of LANDMARKS) {
      const p = new THREE.Vector3(L.u, terrainH(L.u, L.v) + (L.h || 30) * 0.5, -L.v);
      const to = p.sub(o); const dist = to.length(); if (dist > 4000) continue;
      const a = to.normalize().angleTo(d) - Math.min(0.08, (L.h || 30) / Math.max(dist, 1) * 0.4);
      if (a < bestA) { bestA = a; best = L; }
    }
    if (best) this.showCard(best);
  }
  press(id) {
    const o = this.opts;
    if (id.startsWith('t:')) o.setTime(id.slice(2));
    else if (id.startsWith('s:')) o.setSeason(id.slice(2));
    else if (id.startsWith('w:')) o.setWeather(id.slice(2));
    else if (id.startsWith('l:')) { const L = LANDMARKS.find((l) => l.id === id.slice(2)); if (L) { const [u, v, yaw] = standPoint(L); this.blinkTo(u, v, yaw); } }
    else if (id === 'prev') this.page = (this.page + Math.ceil(LANDMARKS.length / 6) - 1) % Math.ceil(LANDMARKS.length / 6);
    else if (id === 'next') this.page = (this.page + 1) % Math.ceil(LANDMARKS.length / 6);
    else if (id === 'map') { this.showMap = !this.showMap; this.map.mesh.visible = this.showMap; }
    else if (id === 'vig') this.vignetteOn = !this.vignetteOn;
    else if (id === 'fast') this.fast = !this.fast;
    else if (id === 'exit') this.renderer.xr.getSession()?.end();
    this.menuDirty = true;
  }
  blinkTo(u, v, yaw) { this.pendingTeleport = [u, v, yaw]; this.blink = 0.0001; }
  // ---------------------------------------------------------------- per frame
  update(dt) {
    if (!this.active) return;
    const R = this.hands.right, Lh = this.hands.left;
    // blink transition
    if (this.blink > 0) {
      this.blink += dt / 0.28;
      const a = this.blink < 0.5 ? this.blink * 2 : 2 - this.blink * 2;
      this.fade.material.opacity = Math.max(0, Math.min(1, a));
      if (this.blink >= 0.5 && this.pendingTeleport) { this.teleportTo(...this.pendingTeleport); this.pendingTeleport = null; }
      if (this.blink >= 1) { this.blink = 0; this.fade.material.opacity = 0; }
    }
    const head = this.cam.getWorldPosition(this.tmp);
    // left stick: smooth locomotion (head-relative)
    let speed = 0;
    if (Lh?.src?.gamepad) {
      const ax = Lh.src.gamepad.axes; const sx = ax[2] || 0, sy = ax[3] || 0;
      if (Math.hypot(sx, sy) > 0.15) {
        const dir = this.cam.getWorldDirection(this.tmp2); dir.y = 0; dir.normalize();
        const right = new THREE.Vector3(-dir.z, 0, dir.x);
        const sprint = Lh.src.gamepad.buttons[1]?.pressed ? 3.2 : 1;
        const mv = dir.multiplyScalar(-sy).add(right.multiplyScalar(sx)).multiplyScalar(2.6 * sprint * dt);
        const nx = head.x + mv.x, nz = head.z + mv.z;
        const f = floorAt(nx, nz, this.rig.position.y + 0.6);
        if (f <= this.rig.position.y + 0.6 && waterSDF(nx, -nz) > -1) { this.rig.position.x += mv.x; this.rig.position.z += mv.z; }
        speed = Math.hypot(sx, sy) * sprint;
      }
      const yb = Lh.src.gamepad.buttons[5] || Lh.src.gamepad.buttons[4];
      if (yb?.pressed && !this.ybWas) { this.menu.mesh.visible = !this.menu.mesh.visible; if (!this.menu.mesh.visible) this.map.mesh.visible = false; }
      this.ybWas = !!yb?.pressed;
    }
    // follow the floor (terrain or rooftops) smoothly
    const fl = floorAt(head.x, head.z, this.rig.position.y + 0.8);
    this.rig.position.y += (fl - this.rig.position.y) * Math.min(1, dt * 8);
    this.vig.material.uniforms.uA.value += ((this.vignetteOn ? Math.min(0.85, speed * 0.6) : 0) - this.vig.material.uniforms.uA.value) * Math.min(1, dt * 6);
    // right stick: snap turn (x) and teleport (push forward, release)
    if (R?.src?.gamepad) {
      const ax = R.src.gamepad.axes, sx = ax[2] || 0, sy = ax[3] || 0;
      if (Math.abs(sx) > 0.7 && this.snapReady) {
        this.snapReady = false;
        const ang = (sx > 0 ? -1 : 1) * Math.PI / 6;
        const hp = head.clone();
        this.rig.position.sub(hp).applyAxisAngle(new THREE.Vector3(0, 1, 0), ang).add(hp);
        this.rig.rotation.y += ang;
      }
      if (Math.abs(sx) < 0.3) this.snapReady = true;
      if (sy < -0.7) { this.aiming = true; this.updateArc(R); }
      else if (this.aiming) {
        this.aiming = false; this.arc.visible = this.ring.visible = false;
        if (this.arcHit) this.blinkTo(this.arcHit.x, -this.arcHit.z, null);
      }
    }
    // pointer rays + hover on panels
    for (const info of Object.values(this.hands)) {
      const isPointer = info.hand === 'right' || !this.hands.right;
      info.ray.visible = isPointer && !this.aiming;
      if (!isPointer) continue;
      const h = this.hitPanels(info);
      info.ray.scale.z = h ? h.distance : 4;
      let hover = null;
      if (h && h.object === this.menu.mesh) { const px = h.uv.x * 1024, py = (1 - h.uv.y) * 768; hover = this.menu.buttons.find((b) => px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h)?.id || null; }
      if (hover !== this.lastHover) { this.lastHover = hover; this.menuDirty = true; }
      if (h && h.object === this.map.mesh) this.mapHover = [h.uv.x, h.uv.y]; else this.mapHover = null;
    }
    this.uiTimer = (this.uiTimer || 0) - dt;
    if (this.menuDirty || this.uiTimer < 0) { this.drawMenu(this.lastHover); this.menuDirty = false; this.uiTimer = 1; }
    if (this.map.mesh.visible) { this.mapTimer = (this.mapTimer || 0) - dt; if (this.mapTimer < 0 || this.mapHover) { this.drawMap(this.mapHover); this.mapTimer = 0.5; } }
    if (this.card.mesh.visible && performance.now() > this.card.until) this.card.mesh.visible = false;
  }
  updateArc(info) {
    const [o, d] = this.rayFrom(info);
    const pos = this.arc.geometry.attributes.position.array;
    const v = d.clone().multiplyScalar(11), p = o.clone(), prev = o.clone();
    let hit = null, n = 0;
    for (let i = 0; i < 60; i++) {
      pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z; n = i + 1;
      prev.copy(p); p.addScaledVector(v, 0.06); v.y -= 9.8 * 0.06;
      const f = floorAt(p.x, p.z, prev.y);
      if (p.y <= f) { p.y = f; hit = p.clone(); pos[(i + 1) * 3] = p.x; pos[(i + 1) * 3 + 1] = p.y; pos[(i + 1) * 3 + 2] = p.z; n = i + 2; break; }
    }
    for (let i = n; i < 60; i++) { pos[i * 3] = pos[(n - 1) * 3]; pos[i * 3 + 1] = pos[(n - 1) * 3 + 1]; pos[i * 3 + 2] = pos[(n - 1) * 3 + 2]; }
    this.arc.geometry.attributes.position.needsUpdate = true; this.arc.visible = true;
    const ok = hit && (waterSDF(hit.x, -hit.z) > 0.5 || hit.y > 1.5);
    this.arcHit = ok ? hit : null;
    this.arc.material.color.set(ok ? 0x7fd4ff : 0xff5a5a);
    this.ring.visible = !!ok; if (ok) this.ring.position.set(hit.x, hit.y + 0.03, hit.z);
  }
}
function roundRect(x, a, b, w, h, r) { x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r); x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath(); }
function wrap(x, text, w) { const words = text.split(' '), out = []; let line = ''; for (const wd of words) { const t = line ? line + ' ' + wd : wd; if (x.measureText(t).width > w) { out.push(line); line = wd; } else line = t; } if (line) out.push(line); return out; }
export function fmtHour(h) { h = ((h % 24) + 24) % 24; const H = Math.floor(h), M = Math.floor((h - H) * 60); return `${String(H).padStart(2, '0')}:${String(M).padStart(2, '0')}`; }
