/**
 * AudioSystem — SFX procedural via Web Audio API.
 * Não depende de arquivos externos. Cada método gera um som sintético
 * diretamente no AudioContext do navegador.
 */

let _ctx: AudioContext | null = null;

function ctx(): AudioContext | null {
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

// Ganho-mestre PERSISTENTE dos SFX. Antes master() criava um GainNode NOVO a
// cada som → não havia ponto único p/ controlar volume. Agora todos os SFX
// roteiam por _sfxGain, cujo ganho reflete volume × mudo.
const SFX_BASE = 0.18;
let _sfxGain: GainNode | null = null;
let _sfxVolume = 1;
let _muted = false;

function applySfxGain() {
  if (_sfxGain) _sfxGain.gain.value = _muted ? 0 : SFX_BASE * _sfxVolume;
}

function master(): GainNode | null {
  const c = ctx();
  if (!c) return null;
  if (!_sfxGain) {
    _sfxGain = c.createGain();
    applySfxGain();
    _sfxGain.connect(c.destination);
  }
  return _sfxGain;
}

/** Volume dos SFX em 0–1 (multiplica o ganho-base). */
export function setSfxVolume(v: number) {
  _sfxVolume = Math.max(0, Math.min(1, v));
  applySfxGain();
}

/** Muta/desmuta apenas os SFX. */
export function setSfxMuted(m: boolean) {
  _muted = m;
  applySfxGain();
}

/** Tom simples: onda, freq, duração, envelope. */
function tone(
  type: OscillatorType,
  freq: number,
  duration: number,
  attack = 0.003,
  decay = duration * 0.7,
  vol = 1,
  freqEnd?: number,
) {
  const c = ctx();
  const m = master();
  if (!c || !m) return;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, c.currentTime);
  if (freqEnd !== undefined)
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), c.currentTime + duration);
  gain.gain.setValueAtTime(0, c.currentTime);
  gain.gain.linearRampToValueAtTime(vol, c.currentTime + attack);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + attack + decay);
  osc.connect(gain);
  gain.connect(m);
  osc.start(c.currentTime);
  osc.stop(c.currentTime + duration + 0.02);
}

/** Ruído branco filtrado — bom para impactos. */
function noise(duration: number, filterFreq: number, vol = 1) {
  const c = ctx();
  const m = master();
  if (!c || !m) return;
  const bufSize = Math.ceil(c.sampleRate * duration);
  const buffer = c.createBuffer(1, bufSize, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buffer;
  const filter = c.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = filterFreq;
  filter.Q.value = 1.2;
  const gain = c.createGain();
  gain.gain.setValueAtTime(vol, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(m);
  src.start(c.currentTime);
  src.stop(c.currentTime + duration);
}

export const Sfx = {
  /** Ataque de melee leve (passos do combo 1 e 2). */
  meleeLight() {
    noise(0.06, 1800, 0.8);
    tone("square", 320, 0.05, 0.002, 0.04, 0.4, 180);
  },

  /** Ataque de melee pesado (hit final do combo). */
  meleeHeavy() {
    noise(0.12, 900, 1.2);
    tone("sawtooth", 180, 0.12, 0.003, 0.09, 0.6, 80);
  },

  /** Player tomou dano. */
  playerHit() {
    noise(0.15, 400, 1);
    tone("square", 260, 0.1, 0.004, 0.08, 0.5, 120);
  },

  /** Player pulou. */
  jump() {
    tone("sine", 200, 0.12, 0.003, 0.09, 0.5, 480);
  },

  /** Player deu dash. */
  dash() {
    noise(0.08, 3200, 0.5);
    tone("sine", 600, 0.07, 0.002, 0.06, 0.4, 1200);
  },

  /** Projétil de tinta disparado. */
  inkShot() {
    tone("square", 520, 0.07, 0.002, 0.06, 0.35, 280);
  },

  /** Inimigo tomou dano. */
  enemyHit() {
    noise(0.06, 1200, 0.6);
    tone("square", 380, 0.05, 0.002, 0.04, 0.3, 200);
  },

  /** Inimigo morreu. */
  enemyDeath() {
    noise(0.18, 600, 0.7);
    tone("sawtooth", 280, 0.15, 0.003, 0.12, 0.4, 60);
  },

  /** VR coletado. */
  vrPickup() {
    tone("sine", 880, 0.07, 0.002, 0.06, 0.4);
    tone("sine", 1320, 0.07, 0.005, 0.055, 0.25);
  },

  /** Item / perk selecionado. */
  perkSelect() {
    tone("sine", 660, 0.08, 0.002, 0.07, 0.4);
    tone("sine", 990, 0.08, 0.01, 0.065, 0.3);
    tone("sine", 1320, 0.08, 0.018, 0.06, 0.2);
  },

  /** Cultura Corporativa selecionada. */
  culturaSelect() {
    [0, 0.07, 0.14].forEach((delay, i) => {
      const c = ctx();
      if (!c) return;
      const freqs = [440, 660, 880];
      setTimeout(() => tone("sine", freqs[i], 0.18, 0.003, 0.15, 0.35 - i * 0.05), delay * 1000);
    });
  },

  /** Boss apareceu (entrada dramática). */
  bossAppear() {
    noise(0.4, 300, 1.5);
    tone("sawtooth", 80, 0.4, 0.01, 0.35, 0.8, 40);
    tone("square", 160, 0.3, 0.02, 0.25, 0.5, 80);
  },

  /** Boss tomou dano. */
  bossHit() {
    noise(0.1, 700, 0.9);
    tone("sawtooth", 220, 0.1, 0.003, 0.08, 0.5, 110);
  },

  /** Boss derrotado. */
  bossDefeat() {
    noise(0.5, 200, 1.8);
    [0, 0.1, 0.2, 0.35].forEach((delay, i) => {
      const freqs = [200, 160, 280, 400];
      setTimeout(
        () => tone("sawtooth", freqs[i], 0.3, 0.005, 0.25, 0.7 - i * 0.1, 60),
        delay * 1000,
      );
    });
  },

  /** Porta desbloqueada / interação com porta. */
  doorOpen() {
    tone("sine", 440, 0.15, 0.005, 0.12, 0.4, 660);
  },

  /** Game over / rescisão. */
  gameOver() {
    tone("sawtooth", 300, 0.6, 0.01, 0.55, 0.7, 60);
    tone("square", 150, 0.8, 0.02, 0.7, 0.5, 40);
  },

  /** Vitória / escape às 18h. */
  victory() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => {
      setTimeout(() => tone("sine", f, 0.3, 0.003, 0.25, 0.5 - i * 0.05), i * 120);
    });
  },

  /** Ataque especial do player (K). */
  special() {
    noise(0.1, 2000, 0.8);
    tone("sawtooth", 400, 0.15, 0.004, 0.12, 0.6, 800);
  },

  /** Congelamento aplicado no player. */
  freeze() {
    tone("sine", 1200, 0.2, 0.003, 0.16, 0.4, 600);
    tone("sine", 800, 0.2, 0.008, 0.16, 0.25, 400);
  },

  /** Compra na loja da Copa. */
  buy() {
    tone("sine", 660, 0.06, 0.002, 0.05, 0.35);
    tone("sine", 880, 0.06, 0.006, 0.05, 0.3);
  },

  /** Stinger no hit final do combo. */
  comboFinisher() {
    noise(0.08, 600, 1.0);
    tone("square", 240, 0.08, 0.002, 0.07, 0.6, 120);
    tone("sine", 960, 0.12, 0.005, 0.1, 0.4, 480);
  },

  /** Parry "Reclamar" bem-sucedido — soco metálico + acorde ascendente. */
  parrySuccess() {
    noise(0.05, 2400, 1.2);
    tone("square", 600, 0.06, 0.001, 0.05, 0.7, 900);
    tone("sine", 1320, 0.14, 0.002, 0.12, 0.6, 1760);
  },

  /** Parry ativado mas sem inimigo — clique seco. */
  parryWhiff() {
    tone("square", 300, 0.04, 0.001, 0.035, 0.2, 260);
  },

  /** Drone ambiente de sanidade — intensidade 0..1. Chamado quando muda de faixa. */
  sanityDrone(intensity: number) {
    if (intensity <= 0) return;
    const c = ctx();
    const m = master();
    if (!c || !m) return;
    // Low rumble that intensifies with stress
    const osc = c.createOscillator();
    const lfo = c.createOscillator();
    const lfoGain = c.createGain();
    const gain = c.createGain();
    osc.type = "sawtooth";
    osc.frequency.value = 55 + intensity * 40;
    lfo.type = "sine";
    lfo.frequency.value = 0.8 + intensity * 2.5;
    lfoGain.gain.value = 8 * intensity;
    gain.gain.setValueAtTime(0, c.currentTime);
    gain.gain.linearRampToValueAtTime(0.12 * intensity, c.currentTime + 0.3);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 2.5);
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    osc.connect(gain);
    gain.connect(m);
    osc.start(c.currentTime);
    lfo.start(c.currentTime);
    osc.stop(c.currentTime + 2.5);
    lfo.stop(c.currentTime + 2.5);
  },

  /** Entrada dramática do boss — câmera travando + sting musical. */
  bossEntry() {
    // Deep impact + rising tension
    noise(0.3, 120, 2.0);
    tone("sawtooth", 55, 1.2, 0.02, 1.0, 1.0, 30);
    setTimeout(() => tone("square", 110, 0.5, 0.01, 0.45, 0.6, 55), 400);
    setTimeout(() => {
      tone("sine", 220, 0.3, 0.005, 0.25, 0.4, 440);
      tone("sine", 330, 0.3, 0.01, 0.25, 0.3, 660);
    }, 900);
  },
};
