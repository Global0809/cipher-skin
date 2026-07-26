// ═══════════════════════════════════════════════════
// cipher.skin — procedural soundscape
// Luxury-spa × cleanroom. Synthesized live: zero assets,
// zero latency, perfect loops.
// ═══════════════════════════════════════════════════

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.assemblyBus = null;
    // storage can throw in privacy modes / in-app browsers — never let it brick the page
    try { this.muted = localStorage.getItem('cs-muted') === '1'; } catch { this.muted = false; }
    this.started = false;
    this._assemblyNoise = null;
    this._lastAssemblyFinal = -Infinity;
  }

  /* Must be called from a user gesture (BEGIN button). */
  init() {
    if (this.started) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(this.ctx.destination);
    this.assemblyBus = this.ctx.createGain();
    this.assemblyBus.gain.value = 0.78;
    const assemblyLimiter = this.ctx.createDynamicsCompressor();
    assemblyLimiter.threshold.value = -20;
    assemblyLimiter.knee.value = 8;
    assemblyLimiter.ratio.value = 5;
    assemblyLimiter.attack.value = 0.004;
    assemblyLimiter.release.value = 0.12;
    this.assemblyBus.connect(assemblyLimiter).connect(this.master);
    this.started = true;
    this._assemblyNoise = this._noiseBuffer(0.18);
    this._resume();
    // iOS suspends/interrupts the context on app-switch or lock — recover on return
    this.ctx.onstatechange = () => this._resume();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') this._resume();
    });
    this._ambient();
    if (!this.muted) this._ramp(0.85, 2.5);
  }

  _resume() {
    if (this.ctx && this.ctx.state !== 'running' && !this.muted) {
      this.ctx.resume().catch(() => {});
    }
  }

  _ramp(v, t) {
    if (!this.master) return;
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(v, now, t / 3);
  }

  setMuted(m) {
    this.muted = m;
    try { localStorage.setItem('cs-muted', m ? '1' : '0'); } catch {}
    if (this.started) {
      if (!m) this._resume();
      this._ramp(m ? 0 : 0.85, 0.6);
    }
  }

  _noiseBuffer(seconds = 2) {
    const len = Math.floor(this.ctx.sampleRate * seconds);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  /* ── continuous bed: warm hum + filtered air ── */
  _ambient() {
    const c = this.ctx;
    // detuned low sines — the "machine at rest" hum
    [[54, 0.045], [54.4, 0.04], [108.1, 0.012]].forEach(([f, g]) => {
      const o = c.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      const og = c.createGain();
      og.gain.value = g;
      o.connect(og).connect(this.master);
      o.start();
    });
    // low airflow
    const noise = c.createBufferSource();
    noise.buffer = this._noiseBuffer(4);
    noise.loop = true;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 220;
    const ng = c.createGain();
    ng.gain.value = 0.014;
    noise.connect(lp).connect(ng).connect(this.master);
    noise.start();
    // slow LFO breathing on the airflow filter
    const lfo = c.createOscillator();
    lfo.frequency.value = 0.06;
    const lfoG = c.createGain();
    lfoG.gain.value = 90;
    lfo.connect(lfoG).connect(lp.frequency);
    lfo.start();
    // cleanroom air shimmer, barely there
    const hiss = c.createBufferSource();
    hiss.buffer = this._noiseBuffer(3);
    hiss.loop = true;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2600;
    bp.Q.value = 9;
    const hg = c.createGain();
    hg.gain.value = 0.004;
    hiss.connect(bp).connect(hg).connect(this.master);
    hiss.start();
  }

  _env(gainNode, peak, attack, decay, at = this.ctx.currentTime) {
    gainNode.gain.cancelScheduledValues(at);
    gainNode.gain.setValueAtTime(0.0001, at);
    gainNode.gain.exponentialRampToValueAtTime(peak, at + attack);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
  }

  /* restrained magnetic/glass lock for each assembling component */
  assemblySnap({ kind = 'shell', weight = 1, pan = 0, index = 0, total = 1 } = {}) {
    if (!this.started || this.muted) return;
    this._resume();
    const c = this.ctx;
    if (c.state !== 'running') return;

    const at = c.currentTime;
    const profiles = {
      structure: { body: 245, click: 1450, decay: 0.065, gain: 0.034 },
      shell: { body: 355, click: 2150, decay: 0.06, gain: 0.026 },
      optic: { body: 510, click: 3050, decay: 0.07, gain: 0.031 },
      jade: { body: 620, click: 3550, decay: 0.075, gain: 0.029 },
      final: { body: 185, click: 1850, decay: 0.11, gain: 0.045 },
    };
    const profile = profiles[kind] || profiles.shell;
    const drift = 1 + ((((index * 17) % 9) - 4) * 0.008);
    const peak = Math.min(0.052, profile.gain * weight);
    const output = typeof c.createStereoPanner === 'function' ? c.createStereoPanner() : c.createGain();
    if ('pan' in output) output.pan.setValueAtTime(Math.max(-0.45, Math.min(0.45, pan)), at);
    output.connect(this.assemblyBus || this.master);

    // A short, low mechanical body replaces the previous ascending musical ping.
    const body = c.createOscillator();
    body.type = 'triangle';
    body.frequency.setValueAtTime(profile.body * drift * 1.12, at);
    body.frequency.exponentialRampToValueAtTime(profile.body * drift, at + 0.032);
    const bodyGain = c.createGain();
    this._env(bodyGain, peak, 0.0018, profile.decay, at);
    body.connect(bodyGain).connect(output);
    body.start(at);
    body.stop(at + (kind === 'final' ? 0.2 : profile.decay + 0.045));

    // A tightly filtered steel transient gives each lock a dry, precise edge.
    const click = c.createBufferSource();
    click.buffer = this._assemblyNoise || (this._assemblyNoise = this._noiseBuffer(0.18));
    const clickFilter = c.createBiquadFilter();
    clickFilter.type = 'bandpass';
    clickFilter.frequency.setValueAtTime(profile.click * drift, at);
    clickFilter.Q.value = kind === 'structure' ? 2.8 : 4.4;
    const clickGain = c.createGain();
    this._env(clickGain, peak * 0.92, 0.001, kind === 'final' ? 0.058 : 0.038, at);
    click.connect(clickFilter).connect(clickGain).connect(output);
    click.start(at);

    if (kind === 'final') {
      this._lastAssemblyFinal = at;
      const lock = c.createOscillator();
      lock.type = 'sine';
      lock.frequency.setValueAtTime(240, at);
      lock.frequency.exponentialRampToValueAtTime(145, at + 0.12);
      const lockGain = c.createGain();
      this._env(lockGain, 0.032, 0.0025, 0.13, at);
      lock.connect(lockGain).connect(output);
      lock.start(at);
      lock.stop(at + 0.18);
    }
    body.onended = () => {
      try { output.disconnect(); } catch {}
    };
  }

  /* magnetic N52 snap — heavy, satisfying */
  thud() {
    if (!this.started || this.muted) return;
    this._resume();
    const c = this.ctx;
    if (c.currentTime - this._lastAssemblyFinal < 0.28) return;
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(74, c.currentTime);
    o.frequency.exponentialRampToValueAtTime(36, c.currentTime + 0.22);
    const og = c.createGain();
    this._env(og, 0.5, 0.006, 0.3);
    o.connect(og).connect(this.master);
    o.start();
    o.stop(c.currentTime + 0.42);
    const n = c.createBufferSource();
    n.buffer = this._noiseBuffer(0.3);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 150;
    const ng = c.createGain();
    this._env(ng, 0.32, 0.004, 0.16);
    n.connect(lp).connect(ng).connect(this.master);
    n.start();
  }

  /* cinematic light-mode transition */
  whoosh() {
    if (!this.started || this.muted) return;
    this._resume();
    const c = this.ctx;
    const n = c.createBufferSource();
    n.buffer = this._noiseBuffer(1);
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.4;
    bp.frequency.setValueAtTime(260, c.currentTime);
    bp.frequency.exponentialRampToValueAtTime(3600, c.currentTime + 0.32);
    bp.frequency.exponentialRampToValueAtTime(700, c.currentTime + 0.65);
    const ng = c.createGain();
    this._env(ng, 0.16, 0.18, 0.5);
    n.connect(bp).connect(ng).connect(this.master);
    n.start();
  }

  /* clinical shutter — two crisp ticks */
  shutter() {
    if (!this.started || this.muted) return;
    this._resume();
    const c = this.ctx;
    [0, 0.055].forEach((dt, i) => {
      const n = c.createBufferSource();
      n.buffer = this._noiseBuffer(0.05);
      const hp = c.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 2600;
      const g = c.createGain();
      const t = c.currentTime + dt;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(i === 0 ? 0.22 : 0.15, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
      n.connect(hp).connect(g).connect(this.master);
      n.start(t);
    });
  }

  /* 365nm ignition shimmer */
  uvShimmer() {
    if (!this.started || this.muted) return;
    this._resume();
    const c = this.ctx;
    [6400, 8300].forEach((f, i) => {
      const o = c.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      const g = c.createGain();
      this._env(g, 0.028 - i * 0.01, 0.05, 0.9);
      o.connect(g).connect(this.master);
      o.start();
      o.stop(c.currentTime + 1.1);
    });
    this.whoosh();
  }

  /* micro hover blip */
  blip() {
    if (!this.started || this.muted) return;
    this._resume();
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.value = 1350;
    const g = c.createGain();
    this._env(g, 0.035, 0.004, 0.06);
    o.connect(g).connect(this.master);
    o.start();
    o.stop(c.currentTime + 0.1);
  }
}
