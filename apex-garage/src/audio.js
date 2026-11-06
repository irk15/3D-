// Synthesised engine sound (Web Audio API) — no audio files needed.
export class EngineAudio {
  constructor() {
    this.ctx = null;
    this.on = false;
    this.muted = false;
    this.cfg = { cyl: 8, tone: 1 };
  }

  _build() {
    const ctx = (this.ctx = new (window.AudioContext || window.webkitAudioContext)());
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor();
    this.master.connect(comp).connect(ctx.destination);

    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.Q.value = 4;

    const shaper = ctx.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) {
      const x = (i / 1023) * 2 - 1;
      curve[i] = Math.tanh(x * 3.2);
    }
    shaper.curve = curve;
    shaper.connect(this.filter).connect(this.master);

    const mk = (type, gain) => {
      const o = ctx.createOscillator();
      o.type = type;
      const g = ctx.createGain();
      g.gain.value = gain;
      o.connect(g).connect(shaper);
      o.start();
      return o;
    };
    this.o1 = mk('sawtooth', 0.55);
    this.o2 = mk('square', 0.35);
    this.o3 = mk('sawtooth', 0.18);

    // exhaust rumble noise
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const n = ctx.createBufferSource();
    n.buffer = buf;
    n.loop = true;
    this.noiseBand = ctx.createBiquadFilter();
    this.noiseBand.type = 'bandpass';
    this.noiseBand.Q.value = 1.2;
    this.noiseGain = ctx.createGain();
    this.noiseGain.gain.value = 0.12;
    n.connect(this.noiseBand).connect(this.noiseGain).connect(this.master);
    n.start();
  }

  async start(cfg) {
    if (cfg) this.cfg = cfg;
    if (!this.ctx) this._build();
    if (this.ctx.state === 'suspended') await Promise.race([this.ctx.resume(), new Promise((r) => setTimeout(r, 300))]);
    this.on = true;
    this._applyGain(0.32);
  }

  stop() {
    this.on = false;
    if (this.ctx) this._applyGain(0);
  }

  setCar(cfg) { this.cfg = cfg; }

  setMuted(m) {
    this.muted = m;
    if (this.ctx) this._applyGain(this.on ? 0.32 : 0);
  }

  _applyGain(v) {
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(this.muted ? 0 : v, t, 0.08);
  }

  // rpm: engine speed, load: 0..1 throttle
  update(rpm, load = 0) {
    if (!this.ctx || !this.on) return;
    const t = this.ctx.currentTime;
    const fire = (rpm / 60) * (this.cfg.cyl / 2) * 0.5 * this.cfg.tone;
    this.o1.frequency.setTargetAtTime(fire, t, 0.03);
    this.o2.frequency.setTargetAtTime(fire * 0.5, t, 0.03);
    this.o3.frequency.setTargetAtTime(fire * 2.01, t, 0.03);
    this.filter.frequency.setTargetAtTime(280 + rpm * 0.32 + load * 900, t, 0.05);
    this.noiseBand.frequency.setTargetAtTime(120 + rpm * 0.08, t, 0.05);
    this.noiseGain.gain.setTargetAtTime(0.06 + load * 0.18, t, 0.05);
    if (!this.muted) this.master.gain.setTargetAtTime(0.26 + load * 0.2, t, 0.1);
  }
}
