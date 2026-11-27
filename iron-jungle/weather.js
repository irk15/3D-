// Dusk turns into a storm night as the mission goes deeper: rain, lightning and darker light.
import * as THREE from 'three';

export function createWeather(scene, renderer, sun, hemi, skyMat) {
  const N = 900, pos = new Float32Array(N * 6), seeds = Array.from({ length: N }, () => [Math.random() * 56 - 28, Math.random() * 22, Math.random() * 24 - 12, .7 + Math.random() * .6]);
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const rain = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x9fc0ee, transparent: true, opacity: 0, depthWrite: false }));
  rain.frustumCulled = false; scene.add(rain);
  const dusk = new THREE.Color(0x7a5560), night = new THREE.Color(0x14223a), sunDusk = new THREE.Color(0xffa860), sunNight = new THREE.Color(0x7f9cff);
  let flash = 0, next = 4;
  return {
    update(dt, camX, storm, onThunder) {
      next -= dt; if (storm > .55 && next <= 0) { next = 4 + Math.random() * 7; flash = 1; onThunder(); }
      flash *= Math.exp(-dt * 7);
      const bolt = flash * (Math.random() > .35 ? 1 : .3);
      skyMat.uniforms.storm.value = storm; skyMat.uniforms.flash.value = bolt;
      scene.fog.color.copy(dusk).lerp(night, storm);
      sun.color.copy(sunDusk).lerp(sunNight, storm); sun.intensity = 3.9 - storm * 2.3 + bolt * 5;
      hemi.intensity = .55 - storm * .12 + bolt * 1.5; scene.environmentIntensity = .55 - storm * .3;
      renderer.toneMappingExposure = 1.08 + storm * .08;
      rain.material.opacity = storm * .42; rain.visible = storm > .02;
      if (!rain.visible) return;
      for (let i = 0; i < N; i++) {
        const s = seeds[i]; s[1] -= dt * 26 * s[3]; if (s[1] < -1) s[1] += 22;
        const x = camX + s[0] + s[1] * .18;
        pos.set([x, s[1], s[2], x + .13, s[1] + .72, s[2]], i * 6);
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
