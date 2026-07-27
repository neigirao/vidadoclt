import Phaser from "phaser";
import { getRun } from "./PlayerState";
import { expedienteStatus, type ExpedienteStatus } from "./Expediente";

// ─────────────────────────────────────────────────────────────────────────────
// RUN CLOCK — a fiação Phaser do relógio do expediente. O núcleo de regras é
// puro (systems/Expediente.ts); aqui só se resolve "quanto tempo desta run já
// passou", atravessando as trocas de cena.
//
// POR QUE NÃO SOMAR NO persist(): `persist()` é chamado VÁRIAS vezes por cena
// (cada porta, cada morte, cada saída) — somar ali contaria o mesmo intervalo
// repetido e o expediente correria mais rápido quanto mais o jogador
// interagisse. O commit acontece UMA vez, no `shutdown` da cena.
// ─────────────────────────────────────────────────────────────────────────────

const KEY_T0 = "runclock:t0";

/**
 * Liga o relógio nesta cena: marca o instante de entrada e agenda o commit do
 * intervalo no `shutdown`. Chamar uma vez no `create()`.
 */
export function startRunClock(scene: Phaser.Scene): void {
  scene.data.set(KEY_T0, scene.time.now);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    const run = getRun(scene);
    const t0 = (scene.data.get(KEY_T0) as number | undefined) ?? scene.time.now;
    const dt = Math.max(0, scene.time.now - t0);
    run.clockMs = (run.clockMs ?? 0) + dt;
    // Evita commit duplo se a cena for derrubada mais de uma vez.
    scene.data.set(KEY_T0, scene.time.now);
  });
}

/** Tempo REAL acumulado da run, incluindo o trecho em andamento nesta cena. */
export function runClockMs(scene: Phaser.Scene): number {
  const run = getRun(scene);
  const t0 = scene.data.get(KEY_T0) as number | undefined;
  const emAndamento = t0 === undefined ? 0 : Math.max(0, scene.time.now - t0);
  return (run.clockMs ?? 0) + emAndamento;
}

/** Heat "relógio acelerado" — aperta a janela até a hora extra. */
export function clockRateMult(scene: Phaser.Scene): number {
  return getRun(scene).heatFastClock ? 1.5 : 1;
}

/** Status do expediente agora (relógio, faixa, pressão, bônus). */
export function expediente(scene: Phaser.Scene): ExpedienteStatus {
  return expedienteStatus(runClockMs(scene), clockRateMult(scene));
}
