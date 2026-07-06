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
}

export const DEFAULT_SETTINGS: Settings = {
  reduceSanityFx: false,
};

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
