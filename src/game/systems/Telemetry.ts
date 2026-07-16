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

// ── Sink remoto (Supabase) ───────────────────────────────────────────────────
// Além do buffer local, cada evento é enviado ao banco (tabela public.
// playtest_events) no MESMO padrão fire-and-forget do Ranking: se o banco cair
// ou a tabela não existir, o jogo não trava e a telemetria local segue intacta.
// O import é DINÂMICO (só no browser) para o módulo continuar puro/testável em
// bun:test. Sem PII — só id de sessão aleatório + eventos de game design.
async function sendRemote(ev: TelemetryEvent) {
  if (typeof window === "undefined") return;
  try {
    // Import dinâmico do client dedicado (só no browser → módulo puro/testável).
    const { telemetryClient } = await import("./telemetryClient");
    const sb = telemetryClient();
    if (!sb) return;
    await sb.from("playtest_events").insert({
      session_id: ev.sid,
      type: ev.type,
      scene: ev.scene ?? null,
      payload: ev,
    });
  } catch {
    /* offline / tabela ausente / RLS — ignora silenciosamente */
  }
}

// Entropia NÃO-semeada (capturada antes de qualquer applyRunSeed clobbar o global).
// Sem isso o id de sessão herda o PRNG da run (dois jogadores na mesma seed → mesmo
// id) e colidem na telemetria. Inline aqui p/ não acoplar Telemetry ao RNG/Phaser.
const nativeRandom: () => number =
  typeof crypto !== "undefined" && crypto.getRandomValues
    ? () => crypto.getRandomValues(new Uint32Array(1))[0] / 0x100000000
    : Math.random.bind(Math);

function randId(): string {
  return nativeRandom().toString(36).slice(2, 10);
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

// Acumuladores POR-RUN de tuning (não geram evento por si — são anexados aos
// eventos de marco: boss_defeat/death/victory). Evita floodar o ring buffer com
// um evento por dash/hit e ainda responde às perguntas de design abertas
// (verbos subutilizados? qual fase machuca mais? burnout é usado?).
const _verb = { dash: 0, special: 0, parry: 0 };
let _burnouts = 0; // quantas vezes entrou no Burnout/VAI NA RAÇA nesta run
let _phaseStartT = 0; // início da fase atual (p/ tempo de conclusão)
let _phaseDmg = 0; // dano tomado NA fase atual (dificuldade p/ quem sobrevive)

function resetRunStats() {
  _verb.dash = _verb.special = _verb.parry = 0;
  _burnouts = 0;
  _phaseDmg = 0;
  _phaseStartT = Date.now();
}

function push(type: string, props: Record<string, unknown> = {}) {
  const ev: TelemetryEvent = { t: Date.now(), sid: _sid, type, scene: _currentScene, ...props };
  _events.push(ev);
  if (_events.length > MAX_EVENTS) _events.splice(0, _events.length - MAX_EVENTS);
  save();
  void sendRemote(ev);
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
  // Tuning: verbos por run terminada (dash/especial/parry subutilizados?),
  // tempo médio + dano médio por fase (curva de dificuldade), e taxa de burnout.
  avgVerbsPerRun: { dash: number; special: number; parry: number };
  avgClearMsByScene: Record<string, number>;
  avgPhaseDmgByScene: Record<string, number>;
  burnoutRuns: number; // runs terminadas que entraram em Burnout ≥1×
};

export const Telemetry = {
  /** Nova sessão (chame no boot). Renova o id de sessão. */
  newSession() {
    _sid = randId();
  },

  /** Início de uma run (Fase 1). */
  runStart(cls?: string, culturas?: string[], weapon?: string) {
    _runActive = true;
    resetRunStats();
    push("run_start", { cls, culturas, weapon });
  },

  /** Entrada numa fase/cena de gameplay — vira a "cena atual" dos eventos. */
  phaseEnter(scene: string) {
    _currentScene = scene;
    _phaseStartT = Date.now();
    _phaseDmg = 0;
    push("phase_enter", {});
  },

  /** Uso de verbo (dash/especial/parry) — acumulado, anexado aos marcos. */
  verb(kind: "dash" | "special" | "parry") {
    if (kind in _verb) _verb[kind]++;
  },

  /** Dano tomado (acumula na fase atual → dificuldade p/ quem sobrevive). */
  damageTaken(amount: number) {
    if (amount > 0) _phaseDmg += amount;
  },

  /** Entrada no Burnout/VAI NA RAÇA (glass-cannon) — 1 incremento por entrada. */
  burnoutEnter() {
    _burnouts++;
  },

  /** Morte do jogador (fim da run por rescisão). */
  death(cause: string, vr: number) {
    push("death", { cause, vr, ...this._runStatsSnapshot() });
    _runActive = false;
  },

  /** Boss de fase derrotado. Anexa tempo de conclusão + dano tomado NA fase. */
  bossDefeat(scene: string) {
    push("boss_defeat", {
      bossScene: scene,
      clearMs: _phaseStartT ? Date.now() - _phaseStartT : 0,
      phaseDmg: Math.round(_phaseDmg),
    });
  },

  /** Vitória final (escapou às 18h). */
  victory(vr: number, loops: number) {
    push("victory", { vr, loops, ...this._runStatsSnapshot() });
    _runActive = false;
  },

  /** Snapshot dos acumuladores da run (verbos + burnout) p/ anexar num marco. */
  _runStatsSnapshot() {
    return {
      dash: _verb.dash,
      special: _verb.special,
      parry: _verb.parry,
      burnouts: _burnouts,
    };
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
      avgVerbsPerRun: { dash: 0, special: 0, parry: 0 },
      avgClearMsByScene: {},
      avgPhaseDmgByScene: {},
      burnoutRuns: 0,
    };
    // Somatórios auxiliares p/ as médias.
    let terminatedRuns = 0;
    const verbSum = { dash: 0, special: 0, parry: 0 };
    const clearSum: Record<string, { ms: number; dmg: number; n: number }> = {};
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
      } else if (e.type === "boss_defeat") {
        const sc = (e.bossScene as string) || (e.scene as string) || "?";
        const c = (clearSum[sc] ??= { ms: 0, dmg: 0, n: 0 });
        c.ms += (e.clearMs as number) || 0;
        c.dmg += (e.phaseDmg as number) || 0;
        c.n++;
      }
      // Verbos/burnout vêm anexados aos marcos de FIM de run (death/victory).
      if (e.type === "death" || e.type === "victory") {
        terminatedRuns++;
        verbSum.dash += (e.dash as number) || 0;
        verbSum.special += (e.special as number) || 0;
        verbSum.parry += (e.parry as number) || 0;
        if (((e.burnouts as number) || 0) > 0) s.burnoutRuns++;
      }
    }
    if (terminatedRuns > 0) {
      s.avgVerbsPerRun = {
        dash: +(verbSum.dash / terminatedRuns).toFixed(1),
        special: +(verbSum.special / terminatedRuns).toFixed(1),
        parry: +(verbSum.parry / terminatedRuns).toFixed(1),
      };
    }
    for (const [sc, c] of Object.entries(clearSum)) {
      s.avgClearMsByScene[sc] = Math.round(c.ms / c.n);
      s.avgPhaseDmgByScene[sc] = Math.round(c.dmg / c.n);
    }
    return s;
  },

  /** Exporta todos os eventos como JSON (para análise externa / backend). */
  exportJSON(): string {
    return JSON.stringify(_events);
  },

  /** Quantos eventos há no buffer (para UI mostrar se há dados). */
  count(): number {
    return _events.length;
  },

  /**
   * Baixa a telemetria como arquivo .json no navegador — para playtesters
   * exportarem sem console/DEV. Funciona no build publicado. Devolve `false`
   * se não houver dados ou o ambiente não suportar download.
   */
  download(): boolean {
    if (typeof document === "undefined" || _events.length === 0) return false;
    try {
      const blob = new Blob([this.exportJSON()], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      a.href = url;
      a.download = `vidaclt-telemetria-${stamp}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return true;
    } catch {
      return false;
    }
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
