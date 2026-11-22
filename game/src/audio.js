// Porto Azul — all sound is synthesized with WebAudio: an engine hum whose pitch follows
// the car's speed, police sirens, gunshots, pickup blips, mission jingles and a lazy
// tropical pad loop. No audio files, nothing loaded from the network.

export class GameAudio {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.musicTimer = 0;
    this.chordStep = 0;
  }

  // Must be called from a user gesture (a menu click) before anything can sound.
  start() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    // Engine: a sawtooth through a lowpass, gain driven by speed each frame.
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 420;
    this.engineOsc.connect(lp); lp.connect(this.engineGain); this.engineGain.connect(this.master);
    this.engineOsc.start();
    // Siren: a square wave whose frequency the police module wobbles.
    this.sirenOsc = this.ctx.createOscillator();
    this.sirenOsc.type = 'triangle';
    this.sirenGain = this.ctx.createGain();
    this.sirenGain.gain.value = 0;
    this.sirenOsc.connect(this.sirenGain); this.sirenGain.connect(this.master);
    this.sirenOsc.start();
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }

  setEngine(on, speedRatio) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.engineGain.gain.setTargetAtTime(on ? 0.05 + speedRatio * 0.05 : 0, t, 0.08);
    this.engineOsc.frequency.setTargetAtTime(55 + speedRatio * 165, t, 0.08);
  }

  setSiren(on, wobble) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.sirenGain.gain.setTargetAtTime(on ? 0.028 : 0, t, 0.15);
    if (on) this.sirenOsc.frequency.setTargetAtTime(660 + wobble * 240, t, 0.05);
  }

  blip(freq = 880, dur = 0.09, type = 'square', vol = 0.12) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur);
  }

  noise(dur = 0.12, vol = 0.25, freq = 1200) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
    const g = this.ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t);
  }

  shot() { this.noise(0.1, 0.3, 2600); this.blip(160, 0.06, 'square', 0.1); }
  punch() { this.noise(0.07, 0.18, 700); }
  cash() { this.blip(990, 0.08, 'square', 0.12); setTimeout(() => this.blip(1320, 0.12, 'square', 0.12), 70); }
  hurt() { this.blip(140, 0.15, 'sawtooth', 0.16); }
  crash() { this.noise(0.2, 0.3, 500); }

  jingle(win = true) {
    if (!this.ctx || this.muted) return;
    const notes = win ? [523, 659, 784, 1046] : [392, 330, 262, 196];
    notes.forEach((f, i) => setTimeout(() => this.blip(f, 0.16, 'triangle', 0.16), i * 110));
  }

  // A slow tropical pad: one soft chord every four seconds, plus a lazy bass note.
  updateMusic(dt, active) {
    if (!this.ctx || this.muted || !active) return;
    this.musicTimer -= dt;
    if (this.musicTimer > 0) return;
    this.musicTimer = 4;
    const chords = [[262, 330, 392], [220, 262, 330], [175, 220, 262], [196, 247, 294]];
    const chord = chords[this.chordStep % chords.length];
    this.chordStep++;
    for (const f of chord) {
      const t = this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.035, t + 0.8);
      g.gain.linearRampToValueAtTime(0, t + 3.9);
      o.connect(g); g.connect(this.master);
      o.start(t); o.stop(t + 4);
    }
    this.blip(chord[0] / 2, 0.5, 'sine', 0.06);
  }
}
