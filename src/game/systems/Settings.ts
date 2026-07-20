// Configurações do jogador persistidas em localStorage. Módulo puro (sem
// Phaser) → testável em bun:test. Hoje só guarda acessibilidade; cresce à
// medida que novas opções entram (remap de teclas, daltônico, etc.).

const KEY = "vidaclt:settings";

export interface Settings {
  /**
   * Reduz os efeitos visuais de Sanidade (barrel/vinheta/cromática/tremor/
   * chiado). Acessibilidade — fotossensibilidade. Não altera o gameplay: a
   * Sanidade e suas penalidades sistêmicas continuam iguais.
   */
  reduceSanityFx: boolean;
  /** Volume geral (0–1) — multiplica música e SFX. */
  masterVolume: number;
  /** Volume da música (0–1). */
  musicVolume: number;
  /** Volume dos efeitos sonoros (0–1). */
  sfxVolume: number;
  /** Mudo total (música + SFX). */
  muted: boolean;
  /**
   * Modo assistido (acessibilidade / onboarding): reduz o dano recebido e dá uma
   * vida de segurança por fase. NÃO estigmatizado na UI — é opção, não "fácil".
   * Diferente de reduceSanityFx (visual): este MEXE no gameplay de propósito.
   */
  assistMode: boolean;
  /**
   * Paleta daltônica-segura para os telegraphs. O par padrão é vermelho (investida)
   * × amarelo (projétil) — justo o mais confundível por deuteranopia/protanopia
   * (~8% dos homens). Ligado, o projétil vira AZUL (vermelho×azul é distinguível
   * por todos os tipos comuns). A codificação por FORMA (`!!` vs `!`) segue ativa
   * dos dois jeitos — a cor é reforço, não a única pista.
   */
  colorBlindSafe: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  reduceSanityFx: false,
  masterVolume: 1,
  musicVolume: 1,
  sfxVolume: 1,
  muted: false,
  assistMode: false,
  colorBlindSafe: false,
};

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** Ajusta um volume, persiste e devolve o valor aplicado. */
export function setVolume(which: "masterVolume" | "musicVolume" | "sfxVolume", v: number): number {
  const s = loadSettings();
  s[which] = clamp01(v);
  saveSettings(s);
  return s[which];
}

/** Alterna o mudo total, persiste e devolve o novo valor. */
export function toggleMuted(): boolean {
  const s = loadSettings();
  s.muted = !s.muted;
  saveSettings(s);
  return s.muted;
}

export function loadSettings(): Settings {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(KEY) : null;
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: Settings): void {
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // storage indisponível (modo privado / SSR) — ignora.
  }
}

/** Alterna `reduceSanityFx`, persiste e devolve o novo valor. */
export function toggleReduceSanityFx(): boolean {
  const s = loadSettings();
  s.reduceSanityFx = !s.reduceSanityFx;
  saveSettings(s);
  return s.reduceSanityFx;
}

/** Alterna o modo assistido, persiste e devolve o novo valor. */
export function toggleAssistMode(): boolean {
  const s = loadSettings();
  s.assistMode = !s.assistMode;
  saveSettings(s);
  return s.assistMode;
}

/** Alterna a paleta daltônica-segura, persiste e devolve o novo valor. */
export function toggleColorBlindSafe(): boolean {
  const s = loadSettings();
  s.colorBlindSafe = !s.colorBlindSafe;
  saveSettings(s);
  return s.colorBlindSafe;
}

// Parâmetros do modo assistido (fonte única — reusados pelo buildPlayer e testes).
export const ASSIST_DAMAGE_TAKEN_MULT = 0.7; // recebe 30% menos dano
export const ASSIST_MIN_LIVES = 1; // piso de vidas por fase (rede de segurança)
