// Race sound effects on top of the engine synth: tyres, wind, rain, pops, impacts, nitro, beeps.
export function createSfx(audio) {
  let built = false, ctx, out, noise, squeal, wind, rainG, nitroG;
  function build() {
    ctx = audio.ctx; if (!ctx) return false;
    out = ctx.createGain(); out.gain.value = vol; out.connect(ctx.destination);
    const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    noise = buf;
    const loop = (type, f, q, g0) => {
      const src = ctx.createBufferSource(); src.buffer = noise; src.loop = true;
      const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
      const g = ctx.createGain(); g.gain.value = g0;
      src.connect(fl).connect(g).connect(out); src.start();
      return { g, fl };
    };
    squeal = loop('bandpass', 1100, 7, 0);
    wind = loop('lowpass', 500, 0.7, 0);
    rainG = loop('highpass', 2500, 0.5, 0);
    nitroG = loop('bandpass', 400, 0.8, 0);
    built = true;
    return true;
  }
  const ok = () => (built || build()) && !audio.muted;
  let vol = 0.9;
  const burst = (dur, f, q, gain, type = 'bandpass') => {
    if (!ok()) return;
    const src = ctx.createBufferSource(); src.buffer = noise;
    const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f * (0.85 + Math.random() * 0.3); fl.Q.value = q;
    src.playbackRate.value = 0.9 + Math.random() * 0.2;
    const g = ctx.createGain(); const t = ctx.currentTime; gain *= 0.85 + Math.random() * 0.3;
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(fl).connect(g).connect(out); src.start(t, Math.random()); src.stop(t + dur + 0.05);
  };
  return {
    setVolume(v) { vol = v; if (built) out.gain.setTargetAtTime(v, ctx.currentTime, 0.05); },
    update({ slip = 0, speed = 0, rain = false, nitro = false, paused = false }) {
      if (!ok()) { if (built) [squeal, wind, rainG, nitroG].forEach((n) => n.g.gain.setTargetAtTime(0, ctx.currentTime, 0.05)); return; }
      const t = ctx.currentTime, k = paused ? 0 : 1;
      squeal.g.gain.setTargetAtTime(k * Math.min(0.32, Math.max(0, slip - 0.12) * 0.9), t, 0.05);
      squeal.fl.frequency.setTargetAtTime(900 + Math.min(speed, 60) * 8, t, 0.1);
      wind.g.gain.setTargetAtTime(k * Math.min(0.28, (speed / 90) ** 2 * 0.28), t, 0.1);
      wind.fl.frequency.setTargetAtTime(300 + speed * 12, t, 0.1);
      rainG.g.gain.setTargetAtTime(k * (rain ? 0.07 : 0), t, 0.3);
      nitroG.g.gain.setTargetAtTime(k * (nitro ? 0.16 : 0), t, 0.08);
    },
    pop(big) { burst(big ? 0.09 : 0.05, big ? 260 : 420, 1.5, big ? 0.9 : 0.5); },
    impact(strength) { burst(0.25, 120, 0.7, Math.min(1.2, strength * 0.08), 'lowpass'); burst(0.12, 2400, 1, Math.min(0.4, strength * 0.03)); },
    scrape() { burst(0.08, 3200, 2, 0.12); },
    beep(f, d = 0.15, v = 0.22) {
      if (!ok()) return;
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'square'; o.frequency.value = f; g.gain.value = v;
      g.gain.setTargetAtTime(0, ctx.currentTime + d * 0.6, 0.04);
      o.connect(g).connect(out); o.start(); o.stop(ctx.currentTime + d + 0.25);
    },
    silence() { if (built) [squeal, wind, rainG, nitroG].forEach((n) => n.g.gain.setTargetAtTime(0, ctx.currentTime, 0.05)); }
  };
}
