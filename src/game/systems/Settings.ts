// Configurações do jogador persistidas em localStorage. Módulo puro (sem
// Phaser) → testável em bun:test. Hoje só guarda acessibilidade; cresce à
// medida que novas opções entram (remap de teclas, daltônico, etc.).

const KEY = "vidaclt:settings";

// ── Remap de teclas (acessibilidade) ─────────────────────────────────────────
// Os 7 VERBOS de combate são rebindáveis. Movimento fica em setas + WASD (dois
// esquemas fixos, já flexível). Guardamos o KeyCode NUMÉRICO (padrão JS/Phaser,
// estável) para não precisar importar Phaser aqui (o módulo tem que rodar no
// bun:test sem browser). Interact (E) é de cena, fora do remap por ora.
export type BindAction =
  | "jump"
  | "dash"
  | "attack"
  | "special"
  | "parry"
  | "consumivel"
  | "secondary";

export const DEFAULT_KEYBINDS: Record<BindAction, number> = {
  jump: 32, // SPACE
  dash: 16, // SHIFT
  attack: 74, // J
  special: 75, // K
  parry: 70, // F
  consumivel: 67, // C
  secondary: 81, // Q
};

// Rótulo humano por ação (ordem de exibição no menu).
export const BIND_LABELS: [BindAction, string][] = [
  ["jump", "Pular"],
  ["dash", "Dash"],
  ["attack", "Atacar"],
  ["special", "Especial"],
  ["parry", "Parry"],
  ["consumivel", "Consumível"],
  ["secondary", "Trocar arma"],
];

// Nome legível de um KeyCode (para a UI). Cobre os comuns; letras/números caem
// no fromCharCode; o resto vira "#<code>".
export function keyName(code: number): string {
  const NAMED: Record<number, string> = {
    32: "ESPAÇO",
    16: "SHIFT",
    17: "CTRL",
    18: "ALT",
    9: "TAB",
    13: "ENTER",
    8: "⌫",
    37: "←",
    38: "↑",
    39: "→",
    40: "↓",
    188: ",",
    190: ".",
    186: ";",
    191: "/",
    219: "[",
    221: "]",
  };
  if (NAMED[code]) return NAMED[code];
  if ((code >= 48 && code <= 57) || (code >= 65 && code <= 90)) return String.fromCharCode(code);
  if (code >= 96 && code <= 105) return "Num" + (code - 96); // teclado numérico
  return "#" + code;
}

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
  /** Remap de teclas dos 7 verbos de combate (KeyCode numérico por ação). */
  keybinds: Record<BindAction, number>;
  /**
   * Escala do texto informativo transiente (dicas de tutorial + toasts de
   * feedback). Acessibilidade — baixa visão. 1 = Normal, 1.25 = Grande, 1.5 =
   * Enorme. NÃO mexe no HUD (posicionamento pixel-tunado) nem em sprites.
   */
  uiTextScale: number;
}

export const DEFAULT_SETTINGS: Settings = {
  reduceSanityFx: false,
  masterVolume: 1,
  musicVolume: 1,
  sfxVolume: 1,
  muted: false,
  assistMode: false,
  colorBlindSafe: false,
  keybinds: { ...DEFAULT_KEYBINDS },
  uiTextScale: 1,
};

// Passos de escala de texto (Normal / Grande / Enorme) — o toggle cicla entre eles.
export const UI_TEXT_SCALES = [1, 1.25, 1.5] as const;
export const UI_TEXT_SCALE_LABELS: Record<number, string> = {
  1: "Normal",
  1.25: "Grande",
  1.5: "Enorme",
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
    // keybinds é aninhado → merge com os defaults (uma tecla nova no jogo entra
    // sem apagar as rebindadas pelo jogador).
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      keybinds: { ...DEFAULT_KEYBINDS, ...(parsed.keybinds ?? {}) },
    };
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

/** Rebinda uma ação a um KeyCode; se a tecla já estava em outra ação, TROCA
 *  (swap) p/ não deixar duas ações na mesma tecla. Persiste. */
export function setKeybind(action: BindAction, code: number): void {
  const s = loadSettings();
  const prev = s.keybinds[action];
  const clash = (Object.keys(s.keybinds) as BindAction[]).find((a) => s.keybinds[a] === code);
  if (clash && clash !== action) s.keybinds[clash] = prev; // swap
  s.keybinds[action] = code;
  saveSettings(s);
}

/** Restaura todos os keybinds ao padrão. Persiste. */
export function resetKeybinds(): void {
  const s = loadSettings();
  s.keybinds = { ...DEFAULT_KEYBINDS };
  saveSettings(s);
}

/** Cicla a escala de texto (Normal→Grande→Enorme→Normal), persiste e devolve o novo valor. */
export function cycleUiTextScale(): number {
  const s = loadSettings();
  const i = UI_TEXT_SCALES.indexOf(s.uiTextScale as (typeof UI_TEXT_SCALES)[number]);
  s.uiTextScale = UI_TEXT_SCALES[(i + 1) % UI_TEXT_SCALES.length];
  saveSettings(s);
  return s.uiTextScale;
}

// Parâmetros do modo assistido (fonte única — reusados pelo buildPlayer e testes).
export const ASSIST_DAMAGE_TAKEN_MULT = 0.7; // recebe 30% menos dano
export const ASSIST_MIN_LIVES = 1; // piso de vidas por fase (rede de segurança)
