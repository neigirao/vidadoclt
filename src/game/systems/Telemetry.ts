// Telemetria local-first do jogo. Registra os eventos de game design que
// importam (progressão, mortes, economia, desfecho) num buffer em memória +
// localStorage. NÃO envia nada pela rede e não guarda PII — é privacy-safe e
// serve para o dev/designer inspecionar (window.__telemetry em DEV) ou exportar
// os dados e, no futuro, plugar num backend (Supabase/PostHog) com consentimento.
//
// Módulo puro (sem Phaser) → testável em bun:test.

export type TelemetryEvent = {
  t: number; // timestamp (ms)
  sid: string; // id de sessão (aleatório, não-identificável)
  type: string; // ex.: "run_start", "phase_enter", "death", "purchase"...
  scene?: string; // cena atual quando o evento ocorreu
  [k: string]: unknown;
};

const LS_KEY = "vidaclt:telemetry";
const MAX_EVENTS = 3000; // ring buffer — descarta os mais antigos

const hasLS = () => typeof localStorage !== "undefined";

function randId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function load(): TelemetryEvent[] {
  if (!hasLS()) return [];
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as TelemetryEvent[]) : [];
  } catch {
    return [];
  }
}

function save() {
  if (!hasLS()) return;
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(_events));
  } catch {
    /* storage cheio/indisponível — ignora */
  }
}

let _sid = randId();
let _events: TelemetryEvent[] = load();
let _currentScene = "";
let _runActive = false;

function push(type: string, props: Record<string, unknown> = {}) {
  _events.push({ t: Date.now(), sid: _sid, type, scene: _currentScene, ...props });
  if (_events.length > MAX_EVENTS) _events.splice(0, _events.length - MAX_EVENTS);
  save();
}

export type TelemetrySummary = {
  runs: number;
  victories: number;
  deaths: number;
  quits: number;
  reachedPhase: Record<string, number>; // funil: quantas runs alcançaram cada cena
  deathsByScene: Record<string, number>;
  deathsByCause: Record<string, number>;
  purchases: Record<string, number>;
};

export const Telemetry = {
  /** Nova sessão (chame no boot). Renova o id de sessão. */
  newSession() {
    _sid = randId();
  },

  /** Início de uma run (Fase 1). */
  runStart(cls?: string, culturas?: string[]) {
    _runActive = true;
    push("run_start", { cls, culturas });
  },

  /** Entrada numa fase/cena de gameplay — vira a "cena atual" dos eventos. */
  phaseEnter(scene: string) {
    _currentScene = scene;
    push("phase_enter", {});
  },

  /** Morte do jogador (fim da run por rescisão). */
  death(cause: string, vr: number) {
    push("death", { cause, vr });
    _runActive = false;
  },

  /** Boss de fase derrotado. */
  bossDefeat(scene: string) {
    push("boss_defeat", { bossScene: scene });
  },

  /** Vitória final (escapou às 18h). */
  victory(vr: number, loops: number) {
    push("victory", { vr, loops });
    _runActive = false;
  },

  /** Compra na loja da Copa (decisão de economia). */
  purchase(key: string, cost: number) {
    push("purchase", { key, cost });
  },

  /** Fecha a run como "quit" se saiu sem morrer/vencer (chamado no unload). */
  markQuitIfActive() {
    if (_runActive) {
      push("quit", {});
      _runActive = false;
    }
  },

  events(): TelemetryEvent[] {
    return _events.slice();
  },

  /** Agrega os eventos num resumo de game design. */
  summary(): TelemetrySummary {
    const s: TelemetrySummary = {
      runs: 0,
      victories: 0,
      deaths: 0,
      quits: 0,
      reachedPhase: {},
      deathsByScene: {},
      deathsByCause: {},
      purchases: {},
    };
    for (const e of _events) {
      if (e.type === "run_start") s.runs++;
      else if (e.type === "victory") s.victories++;
      else if (e.type === "quit") s.quits++;
      else if (e.type === "phase_enter" && e.scene) {
        s.reachedPhase[e.scene] = (s.reachedPhase[e.scene] ?? 0) + 1;
      } else if (e.type === "death") {
        s.deaths++;
        const sc = (e.scene as string) || "?";
        const cause = (e.cause as string) || "?";
        s.deathsByScene[sc] = (s.deathsByScene[sc] ?? 0) + 1;
        s.deathsByCause[cause] = (s.deathsByCause[cause] ?? 0) + 1;
      } else if (e.type === "purchase") {
        const k = (e.key as string) || "?";
        s.purchases[k] = (s.purchases[k] ?? 0) + 1;
      }
    }
    return s;
  },

  /** Exporta todos os eventos como JSON (para análise externa / backend). */
  exportJSON(): string {
    return JSON.stringify(_events);
  },

  /** Zera o buffer local. */
  clear() {
    _events = [];
    save();
  },
};

// Detecção de abandono: se a aba fechar no meio de uma run, marca "quit" com a
// cena atual → sinal de "onde o jogador desiste".
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => Telemetry.markQuitIfActive());
  // Exposto em DEV para inspeção: window.__telemetry.summary()
  if (import.meta.env?.DEV) {
    (window as unknown as { __telemetry: typeof Telemetry }).__telemetry = Telemetry;
  }
}
