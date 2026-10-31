/* Zenou City — all audio is synthesized at runtime with the Web Audio API. */
export class Audio {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.engine = null;
    this.siren = null;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    this.noiseBuffer = this.makeNoise();
  }

  makeNoise() {
    const len = this.ctx.sampleRate * 1.2;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.5;
  }

  noiseBurst({ duration = 0.1, gain = 0.4, freq = 1400, q = 1, type = 'lowpass' } = {}) {
    if (!this.ctx || this.muted) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const g = this.ctx.createGain();
    const now = this.ctx.currentTime;
    g.gain.setValueAtTime(gain, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    src.connect(filter).connect(g).connect(this.master);
    src.start(now);
    src.stop(now + duration + 0.02);
  }

  gunshot(volume = 1, distant = false) {
    if (!this.ctx) return;
    this.noiseBurst({ duration: distant ? 0.16 : 0.22, gain: 0.5 * volume, freq: distant ? 700 : 1900, q: 0.8 });
    if (!distant) this.noiseBurst({ duration: 0.05, gain: 0.35 * volume, freq: 3200, type: 'highpass' });
  }

  impact() {
    this.noiseBurst({ duration: 0.12, gain: 0.3, freq: 420, q: 1.4 });
  }

  boom() {
    this.noiseBurst({ duration: 0.9, gain: 0.75, freq: 260, q: 0.7 });
  }

  pickup() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    [660, 880, 1180].forEach((f, i) => {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t + i * 0.07);
      g.gain.exponentialRampToValueAtTime(0.18, t + i * 0.07 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.07 + 0.22);
      o.connect(g).connect(this.master);
      o.start(t + i * 0.07);
      o.stop(t + i * 0.07 + 0.25);
    });
  }

  ensureEngine() {
    if (!this.ctx || this.engine) return;
    const osc = this.ctx.createOscillator();
    const sub = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    sub.type = 'triangle';
    osc.frequency.value = 60;
    sub.frequency.value = 30;
    filter.type = 'lowpass';
    filter.frequency.value = 520;
    filter.Q.value = 3;
    gain.gain.value = 0.0001;
    osc.connect(filter);
    sub.connect(filter);
    filter.connect(gain).connect(this.master);
    osc.start();
    sub.start();
    this.engine = { osc, sub, filter, gain };
  }

  engineSound(speed, throttle, active) {
    if (!this.ctx) return;
    this.ensureEngine();
    if (!this.engine) return;
    const { osc, sub, filter, gain } = this.engine;
    const now = this.ctx.currentTime;
    const rpm = 42 + Math.abs(speed) * 8.5 + Math.max(0, throttle) * 22;
    osc.frequency.setTargetAtTime(rpm, now, 0.08);
    sub.frequency.setTargetAtTime(rpm * 0.5, now, 0.08);
    filter.frequency.setTargetAtTime(420 + Math.abs(speed) * 42, now, 0.1);
    gain.gain.setTargetAtTime(active ? 0.09 + Math.min(0.1, Math.abs(speed) * 0.004) : 0.0001, now, 0.12);
  }

  sirenSound(active) {
    if (!this.ctx) return;
    if (!active) {
      if (this.siren) {
        this.siren.gain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.2);
      }
      return;
    }
    if (!this.siren) {
      const osc = this.ctx.createOscillator();
      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();
      osc.type = 'square';
      osc.frequency.value = 720;
      lfo.type = 'triangle';
      lfo.frequency.value = 0.9;
      lfoGain.gain.value = 210;
      filter.type = 'lowpass';
      filter.frequency.value = 1400;
      gain.gain.value = 0.0001;
      lfo.connect(lfoGain).connect(osc.frequency);
      osc.connect(filter).connect(gain).connect(this.master);
      osc.start();
      lfo.start();
      this.siren = { osc, lfo, gain };
    }
    this.siren.gain.gain.setTargetAtTime(0.03, this.ctx.currentTime, 0.2);
  }

  footstep() {
    this.noiseBurst({ duration: 0.06, gain: 0.09, freq: 260, q: 2 });
  }
}
