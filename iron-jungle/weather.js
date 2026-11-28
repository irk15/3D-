// Weather that closes in as the mission goes deeper: rain and lightning, a sandstorm or a blizzard.
import * as THREE from 'three';

// fall: units per second · slant: sideways drift per unit of height · dash: the streak drawn for each drop
const KINDS = {
  rain: { color: 0x9fc0ee, fall: 26, wind: 0, slant: .18, dash: [.13, .72], base: .0, peak: .42 },
  sand: { color: 0xffcf8a, fall: 1.2, wind: -24, slant: 0, dash: [.9, .03], base: .0, peak: .5 },
  snow: { color: 0xf0f8ff, fall: 2.4, wind: -2.5, slant: .3, dash: [.07, .07], base: .45, peak: .95 }
};

export function createWeather(scene, renderer, sun, hemi, skyMat) {
  const N = 1100, pos = new Float32Array(N * 6), seeds = Array.from({ length: N }, () => [Math.random() * 56 - 28, Math.random() * 22, Math.random() * 24 - 12, .7 + Math.random() * .6]);
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
  // snow is drawn as soft flakes
  const flakes = new THREE.Points(geo, new THREE.PointsMaterial({ size: .09, transparent: true, opacity: 0, depthWrite: false }));
  for (const o of [lines, flakes]) { o.frustumCulled = false; scene.add(o); }
  const calm = new THREE.Color(), wild = new THREE.Color(), sunCalm = new THREE.Color(), sunWild = new THREE.Color();
  let flash = 0, next = 4, theme, kind;
  return {
    setTheme(t) {
      theme = t; kind = KINDS[t.precip]; flash = 0;
      calm.set(t.fog[0]); wild.set(t.fog[1]); sunCalm.set(t.sun[0]); sunWild.set(t.sun[1]);
      lines.material.color.set(kind.color); flakes.material.color.set(kind.color);
    },
    update(dt, camX, storm, onThunder) {
      if (!theme) return;
      next -= dt; if (theme.lightning && storm > .55 && next <= 0) { next = 4 + Math.random() * 7; flash = 1; onThunder(); }
      flash *= Math.exp(-dt * 7);
      const bolt = flash * (Math.random() > .35 ? 1 : .3);
      skyMat.uniforms.storm.value = storm; skyMat.uniforms.flash.value = bolt;
      scene.fog.color.copy(calm).lerp(wild, storm);
      sun.color.copy(sunCalm).lerp(sunWild, storm); sun.intensity = theme.sunPower[0] + (theme.sunPower[1] - theme.sunPower[0]) * storm + bolt * 5;
      hemi.intensity = theme.hemi[2] - storm * .12 + bolt * 1.5; scene.environmentIntensity = .55 - storm * .25;
      renderer.toneMappingExposure = theme.exposure + storm * .06;
      const amount = Math.max(theme.precipBase, storm), snow = theme.precip === 'snow';
      const opacity = (kind.base + (kind.peak - kind.base) * storm) * (theme.precipBase ? 1 : Math.min(1, storm * 1.5));
      lines.material.opacity = flakes.material.opacity = opacity;
      lines.visible = !snow && amount > .02; flakes.visible = snow && amount > .02;
      if (!lines.visible && !flakes.visible) return;
      for (let i = 0; i < N; i++) {
        const s = seeds[i]; s[1] -= dt * kind.fall * s[3]; if (s[1] < -1) s[1] += 22;
        s[0] += dt * kind.wind * s[3]; if (s[0] < -28) s[0] += 56;
        const x = camX + s[0] + s[1] * kind.slant + (snow ? Math.sin(s[1] * 2 + i) * .35 : 0), y = theme.precip === 'sand' ? s[1] * .5 : s[1];
        pos.set([x, y, s[2], x + kind.dash[0], y + kind.dash[1], s[2]], i * 6);
      }
      geo.attributes.position.needsUpdate = true;
    }
  };
}

// driving synth soundtrack generated on the fly
export function createMusic(ac, noise) {
  const out = ac.createGain(); out.gain.value = .5; out.connect(ac.destination);
  let next = ac.currentTime + .1, n = 0;
  const tone = (t, f, d, g, type, cut) => { const o = ac.createOscillator(), a = ac.createGain(), l = ac.createBiquadFilter(); o.type = type; o.frequency.setValueAtTime(f, t); l.frequency.value = cut; a.gain.setValueAtTime(g, t); a.gain.exponentialRampToValueAtTime(.001, t + d); o.connect(l).connect(a).connect(out); o.start(t); o.stop(t + d); return o; };
  const hit = (t, d, g, f) => { const s = ac.createBufferSource(), a = ac.createGain(), h = ac.createBiquadFilter(); s.buffer = noise; h.type = 'highpass'; h.frequency.value = f; a.gain.setValueAtTime(g, t); a.gain.exponentialRampToValueAtTime(.001, t + d); s.connect(h).connect(a).connect(out); s.start(t); s.stop(t + d); };
  return (playing, intense) => {
    if (!playing) { next = ac.currentTime + .1; return; }
    if (next < ac.currentTime) next = ac.currentTime + .05;
    while (next < ac.currentTime + .25) {
      const k = n % 16, root = [55, 55, 43.65, 49][Math.floor(n / 16) % 4];
      if (k % 4 === 0 || (intense && k === 14)) tone(next, 130, .16, .22, 'sine', 800).frequency.exponentialRampToValueAtTime(42, next + .13);
      if (k % 8 === 4) hit(next, .14, .09, 1500);
      if (k % 2 === 0 || intense) hit(next, .035, .025, 7000);
      if (k % 2 === 0) tone(next, root * (k === 6 || k === 14 ? 2 : 1), .2, .09, 'sawtooth', intense ? 900 : 420);
      if (intense && k % 4 === 2) tone(next, root * [4, 6, 4.75, 6][Math.floor(k / 4)], .18, .035, 'square', 1800);
      n++; next += intense ? .105 : .125;
    }
  };
}
