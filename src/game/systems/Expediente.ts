// ─────────────────────────────────────────────────────────────────────────────
// EXPEDIENTE — o relógio das 18h vira MECÂNICA.
//
// POR QUE EXISTE: o jogo se chama "escapar do escritório às 18h" e o relógio do
// HUD era decorativo — pior, era um cronômetro POR FASE (`startTimeMs` reiniciava
// em cada `create()`), então o expediente voltava no tempo a cada porta. A
// premissa central do jogo não existia mecanicamente. O campo `heatFastClock` já
// estava no RunState desde sempre, declarado e nunca lido: o relógio sempre foi
// planejado como pressão e nunca foi construído.
//
// DESENHO (A + C, decidido com o dono):
//   A) PRAZO BRANDO — passando das 20h o escritório entra em HORA EXTRA: o dano
//      recebido sobe por hora vencida (com teto) e a Copa para de curar sanidade.
//      Encarece, não mata. Quem ignora o relógio ainda termina a run.
//   B) (descartado) prazo duro que mata — puniria exploração vertical, salas
//      opcionais e Bestiário, três sistemas feitos pra o jogador DEMORAR.
//   C) TEMPO COMO MOEDA — o bônus de fim de run escala com quanto do expediente
//      sobrou até as 22h. Sair cedo paga; enrolar não mata, só rende menos.
//
// O relógio NUNCA mata. Ele encarece (A) e reduz recompensa (C).
//
// PURO: sem Phaser, sem estado global — tudo entra por parâmetro. Testável.
// ─────────────────────────────────────────────────────────────────────────────

/** Minuto de jogo por milissegundo real. 1 min de jogo a cada 3s reais. */
export const MS_PER_GAME_MIN = 3000;

/** O expediente começa às 18:00. */
export const START_HOUR = 18;

/** A partir daqui é HORA EXTRA (prazo brando começa a cobrar). */
export const HORA_EXTRA_MIN = 2 * 60; // 20:00

/** Depois disto o bônus de tempo zerou de vez. */
export const DEADLINE_MIN = 4 * 60; // 22:00

/** Dano recebido adicional por HORA vencida além das 20h. */
const PRESSURE_PER_HOUR = 0.15;

/** Teto do agravo — hora extra encarece, mas não vira morte instantânea. */
const PRESSURE_CAP = 1.6;

/** Bônus máximo de fim de run por sair cedo (100% do expediente restante). */
const MAX_TIME_BONUS = 0.5;

export type ExpedienteBand = "normal" | "hora_extra";

/**
 * Converte o tempo REAL acumulado da run em minutos de expediente.
 * `rateMult > 1` acelera o relógio (usado pelo Heat — `heatFastClock`).
 */
export function elapsedToGameMinutes(elapsedMs: number, rateMult = 1): number {
  if (!(elapsedMs > 0)) return 0;
  return Math.floor((elapsedMs * Math.max(0, rateMult)) / MS_PER_GAME_MIN);
}

/** Rótulo de relógio ("18:00", "20:47") a partir dos minutos de expediente. */
export function formatClock(gameMinutes: number): string {
  const m = Math.max(0, Math.floor(gameMinutes));
  const hh = START_HOUR + Math.floor(m / 60);
  const mm = m % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/** Faixa atual do expediente. */
export function expedienteBand(gameMinutes: number): ExpedienteBand {
  return gameMinutes >= HORA_EXTRA_MIN ? "hora_extra" : "normal";
}

/**
 * (A) Multiplicador de DANO RECEBIDO pela hora extra. 1.0 antes das 20h; sobe
 * 15% por hora vencida, com teto — a pressão é real mas não vira one-shot.
 */
export function overtimePressureMult(gameMinutes: number): number {
  const over = gameMinutes - HORA_EXTRA_MIN;
  if (over <= 0) return 1;
  const hours = over / 60;
  return Math.min(PRESSURE_CAP, 1 + hours * PRESSURE_PER_HOUR);
}

/**
 * (A) A Copa só cura sanidade dentro do expediente normal. Depois das 20h o
 * café não resolve mais — é a virada de tom da hora extra.
 */
export function copaHealsSanity(gameMinutes: number): boolean {
  return expedienteBand(gameMinutes) === "normal";
}

/**
 * (C) Fração do expediente que SOBROU até as 22h (1 = saiu 18h em ponto, 0 =
 * passou das 22h). É a "moeda" de tempo.
 */
export function timeLeftRatio(gameMinutes: number): number {
  const left = (DEADLINE_MIN - gameMinutes) / DEADLINE_MIN;
  return Math.max(0, Math.min(1, left));
}

/**
 * (C) Multiplicador do prêmio de fim de run (VR → Reconhecimento). 1.5× saindo
 * às 18h em ponto, 1.0× das 22h em diante. Nunca penaliza abaixo de 1: enrolar
 * custa o BÔNUS, não o que o jogador já ganhou.
 */
export function timeBonusMult(gameMinutes: number): number {
  return 1 + MAX_TIME_BONUS * timeLeftRatio(gameMinutes);
}

/** Resumo pronto pra HUD/telas de fim de run. */
export type ExpedienteStatus = {
  gameMinutes: number;
  clock: string;
  band: ExpedienteBand;
  pressureMult: number;
  timeBonusMult: number;
  timeLeftRatio: number;
};

export function expedienteStatus(elapsedMs: number, rateMult = 1): ExpedienteStatus {
  const gameMinutes = elapsedToGameMinutes(elapsedMs, rateMult);
  return {
    gameMinutes,
    clock: formatClock(gameMinutes),
    band: expedienteBand(gameMinutes),
    pressureMult: overtimePressureMult(gameMinutes),
    timeBonusMult: timeBonusMult(gameMinutes),
    timeLeftRatio: timeLeftRatio(gameMinutes),
  };
}
