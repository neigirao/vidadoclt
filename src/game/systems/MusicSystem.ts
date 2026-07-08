/**
 * MusicSystem — procedural ambient music via Web Audio API.
 * Generates a lo-fi office atmosphere: slow bass drone, random hi-hat ticks,
 * melodic arpeggios in a minor pentatonic scale. No external audio files.
 *
 * Usage:
 *   Music.start("office");   // play ambient office loop
 *   Music.start("boss");     // tense boss music
 *   Music.stop();            // fade out
 *   Music.setVolume(0.5);    // 0–1
 */

let _ctx: AudioContext | null = null;
let _masterGain: GainNode | null = null;
let _stopFn: (() => void) | null = null;
let _currentTheme: string | null = null;
let _volume = 0.28;
let _muted = false;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!_ctx) {
    try {
      _ctx = new AudioContext();
    } catch {
      return null;
    }
  }
  if (_ctx.state === "suspended") _ctx.resume().catch(() => {});
  return _ctx;
}

function getMaster(): GainNode | null {
  const c = getCtx();
  if (!c) return null;
  if (!_masterGain) {
    _masterGain = c.createGain();
    _masterGain.gain.value = _volume;
    _masterGain.connect(c.destination);
  }
  return _masterGain;
}

// ── Primitive helpers ──────────────────────────────────────────────────────

function scheduleOsc(
  c: AudioContext,
  dest: AudioNode,
  type: OscillatorType,
  freq: number,
  startAt: number,
  duration: number,
  gainPeak = 0.15,
  attackMs = 10,
  releaseMs = 80,
) {
  const osc = c.createOscillator();
  const env = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  env.gain.setValueAtTime(0, startAt);
  env.gain.linearRampToValueAtTime(gainPeak, startAt + attackMs / 1000);
  env.gain.setValueAtTime(gainPeak, startAt + duration - releaseMs / 1000);
  env.gain.linearRampToValueAtTime(0, startAt + duration);
  osc.connect(env);
  env.connect(dest);
  osc.start(startAt);
  osc.stop(startAt + duration + 0.02);
}

function scheduleNoise(
  c: AudioContext,
  dest: AudioNode,
  startAt: number,
  duration: number,
  gainPeak = 0.04,
  lpFreq = 3000,
) {
  const bufLen = Math.ceil(c.sampleRate * (duration + 0.05));
  const buf = c.createBuffer(1, bufLen, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;

  const src = c.createBufferSource();
  src.buffer = buf;
  const filt = c.createBiquadFilter();
  filt.type = "lowpass";
  filt.frequency.value = lpFreq;

  const env = c.createGain();
  env.gain.setValueAtTime(gainPeak, startAt);
  env.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

  src.connect(filt);
  filt.connect(env);
  env.connect(dest);
  src.start(startAt);
  src.stop(startAt + duration + 0.05);
}

// ── Scales ──────────────────────────────────────────────────────────────────

// A minor pentatonic: A2, C3, D3, E3, G3 (and octave equivalents)
const PENTA_FREQS = [110, 130.8, 146.8, 164.8, 196, 220, 261.6, 293.7, 329.6, 392];

// Tense tritone / diminished for boss: D, Ab, C, F# (chromatic tension)
const BOSS_FREQS = [146.8, 185, 207.7, 185, 174.6, 146.8];

// ── Themes ──────────────────────────────────────────────────────────────────

function startOffice(c: AudioContext, master: AudioNode): () => void {
  let alive = true;
  const BEAT = 0.5; // 120 BPM, 1 beat = 0.5s
  const BAR = BEAT * 4;

  // Slow bass drone: root A2 + fifth E2, quiet sine
  const droneDest = c.createGain();
  droneDest.gain.value = 0.07;
  droneDest.connect(master);

  const drone1 = c.createOscillator();
  drone1.type = "sine";
  drone1.frequency.value = 110; // A2
  drone1.connect(droneDest);
  drone1.start();

  const drone2 = c.createOscillator();
  drone2.type = "sine";
  drone2.frequency.value = 164.8; // E3
  const droneEnv2 = c.createGain();
  droneEnv2.gain.value = 0.4;
  drone2.connect(droneEnv2);
  droneEnv2.connect(droneDest);
  drone2.start();

  // Melodic arpeggio scheduler
  let nextBeat = c.currentTime + 0.1;
  let patternIdx = 0;

  const arpDest = c.createGain();
  arpDest.gain.value = 0.9;
  arpDest.connect(master);

  const hihatDest = c.createGain();
  hihatDest.gain.value = 0.6;
  hihatDest.connect(master);

  function scheduleBar() {
    if (!alive) return;
    const barStart = nextBeat;

    // 4 arpeggiated notes per bar, chosen from pentatonic
    for (let b = 0; b < 4; b++) {
      const noteIdx = (patternIdx * 4 + b) % PENTA_FREQS.length;
      const freq = PENTA_FREQS[noteIdx];
      const skip = Math.random() < 0.25; // occasional gap for rhythm
      if (!skip) {
        scheduleOsc(c, arpDest, "triangle", freq, barStart + b * BEAT, BEAT * 0.55, 0.1, 15, 200);
      }
    }
    patternIdx++;

    // Hi-hat: noise on beats 2 and 4
    scheduleNoise(c, hihatDest, barStart + BEAT, 0.05, 0.05, 6000);
    scheduleNoise(c, hihatDest, barStart + 3 * BEAT, 0.05, 0.05, 6000);

    // Occasional kick: low thump on beat 1
    if (Math.random() < 0.7) {
      scheduleOsc(c, arpDest, "sine", 55, barStart, 0.18, 0.18, 5, 150);
    }

    nextBeat += BAR;

    // Schedule next bar 1 bar ahead
    const delay = (nextBeat - c.currentTime - BAR * 0.5) * 1000;
    setTimeout(
      () => {
        if (alive) scheduleBar();
      },
      Math.max(0, delay),
    );
  }

  scheduleBar();

  return () => {
    alive = false;
    try {
      drone1.stop();
    } catch {
      /* storage/áudio indisponível — ignorar */
    }
    try {
      drone2.stop();
    } catch {
      /* storage/áudio indisponível — ignorar */
    }
  };
}

function startBoss(c: AudioContext, master: AudioNode): () => void {
  let alive = true;
  const BEAT = 0.35; // ~170 BPM for urgency
  const BAR = BEAT * 4;

  const dest = c.createGain();
  dest.gain.value = 1.0;
  dest.connect(master);

  // Pulsing bass
  const bassDest = c.createGain();
  bassDest.gain.value = 0.12;
  bassDest.connect(master);

  let nextBeat = c.currentTime + 0.05;
  let step = 0;

  function scheduleBar() {
    if (!alive) return;
    const barStart = nextBeat;

    // Repeating tension motif
    for (let b = 0; b < 4; b++) {
      const freq = BOSS_FREQS[(step * 4 + b) % BOSS_FREQS.length];
      scheduleOsc(c, dest, "sawtooth", freq, barStart + b * BEAT, BEAT * 0.4, 0.08, 5, 100);
      // kick on all beats
      scheduleOsc(c, bassDest, "sine", 50, barStart + b * BEAT, 0.12, 0.2, 4, 100);
    }
    // hi-hat every 8th note
    for (let b = 0; b < 8; b++) {
      scheduleNoise(c, dest, barStart + (b * BEAT) / 2, 0.04, 0.04, 8000);
    }
    step++;

    nextBeat += BAR;
    const delay = (nextBeat - c.currentTime - BAR * 0.5) * 1000;
    setTimeout(
      () => {
        if (alive) scheduleBar();
      },
      Math.max(0, delay),
    );
  }

  scheduleBar();
  return () => {
    alive = false;
  };
}

// ── Public API ──────────────────────────────────────────────────────────────

export const Music = {
  start(theme: "office" | "boss" | "copa") {
    if (_currentTheme === theme) return;
    this.stop();

    const c = getCtx();
    const master = getMaster();
    if (!c || !master) return;

    _currentTheme = theme;

    if (theme === "boss") {
      _stopFn = startBoss(c, master);
    } else {
      // "office" and "copa" both use office music (copa is quieter via volume)
      _stopFn = startOffice(c, master);
    }
  },

  stop() {
    if (_stopFn) {
      _stopFn();
      _stopFn = null;
    }
    _currentTheme = null;
  },

  setVolume(v: number) {
    _volume = Math.max(0, Math.min(1, v));
    const target = _muted ? 0 : _volume;
    if (_masterGain) _masterGain.gain.setTargetAtTime(target, getCtx()?.currentTime ?? 0, 0.1);
  },

  setMuted(m: boolean) {
    _muted = m;
    if (_masterGain)
      _masterGain.gain.setTargetAtTime(m ? 0 : _volume, getCtx()?.currentTime ?? 0, 0.1);
  },

  fadeOut(durationMs = 800) {
    const c = getCtx();
    if (!c || !_masterGain) return;
    _masterGain.gain.setTargetAtTime(0, c.currentTime, durationMs / 1000 / 3);
    setTimeout(() => {
      this.stop();
      if (_masterGain) _masterGain.gain.setValueAtTime(_volume, c.currentTime);
    }, durationMs + 100);
  },

  fadeIn(durationMs = 800) {
    const c = getCtx();
    if (!c || !_masterGain) return;
    _masterGain.gain.setValueAtTime(0, c.currentTime);
    _masterGain.gain.setTargetAtTime(_volume, c.currentTime, durationMs / 1000 / 3);
  },
};
