import { describe, it, expect } from "bun:test";
import {
  frameCount,
  walkFrames,
  idleFrames,
  attackFrames,
  registerFrameAddition,
  resetFrameAdditions,
  runtimeFrameAddition,
  hasAnimConfig,
  WALK_FRAME_COUNTS,
  DEFAULT_WALK_FRAMES,
  DEFAULT_IDLE_FRAMES,
} from "../EnemyAnimConfig";

// Contagem EFETIVA de frames = max(base do atlas, aumentos por override de
// runtime). É o que faz o multi-frame do LAB de fato animar no jogo: um frame
// novo (enemy-<prefixo>-walk2) sobe a contagem e o setEnemyTex cicla até ele.
describe("EnemyAnimConfig frameCount", () => {
  it("usa a base do atlas quando não há override", () => {
    resetFrameAdditions();
    expect(walkFrames("estagiario")).toBe(WALK_FRAME_COUNTS.estagiario); // 4
    expect(walkFrames("facilitador")).toBe(WALK_FRAME_COUNTS.facilitador); // 2
  });

  it("cai no default quando o prefixo é desconhecido", () => {
    resetFrameAdditions();
    expect(walkFrames("desconhecido")).toBe(DEFAULT_WALK_FRAMES); // 2
    expect(idleFrames("desconhecido")).toBe(DEFAULT_IDLE_FRAMES); // 4
  });

  it("um override ALÉM da base aumenta a contagem", () => {
    resetFrameAdditions();
    // facilitador walk base 16 (dobrado 2×) → override ALÉM da base sobe a conta.
    registerFrameAddition("walk", "facilitador", 17);
    expect(walkFrames("facilitador")).toBe(17);
    registerFrameAddition("walk", "facilitador", 18);
    expect(walkFrames("facilitador")).toBe(18);
  });

  it("nunca REDUZ abaixo da base (substituir frame existente não encolhe)", () => {
    resetFrameAdditions();
    // estagiario walk base 8 (dobrado); um override baixo (conta 2) não reduz.
    registerFrameAddition("walk", "estagiario", 2);
    expect(walkFrames("estagiario")).toBe(WALK_FRAME_COUNTS.estagiario);
  });

  it("mantém o MAIOR aumento visto (idempotente, não retrocede)", () => {
    resetFrameAdditions();
    // rh idle base 8; registra ACIMA da base p/ exercitar o max. (scrum não serve
    // mais: idle base subiu p/ 16 com o re-corte da s7 dobrado a 16 frames.)
    registerFrameAddition("idle", "rh", 10);
    registerFrameAddition("idle", "rh", 9); // menor → ignorado
    expect(idleFrames("rh")).toBe(10);
  });

  it("separa os estados (walk/idle/attack não se contaminam)", () => {
    resetFrameAdditions();
    registerFrameAddition("attack", "rh", 5);
    expect(attackFrames("rh")).toBe(5);
    expect(walkFrames("rh")).toBe(WALK_FRAME_COUNTS.rh); // intacto
    expect(frameCount("idle", "rh")).toBe(8); // idle base do rh (dobrado), intacto
  });

  it("reset limpa os aumentos", () => {
    registerFrameAddition("walk", "facilitador", 8);
    resetFrameAdditions();
    expect(walkFrames("facilitador")).toBe(WALK_FRAME_COUNTS.facilitador);
  });

  // runtimeFrameAddition = só o aumento cru (0 se nenhum). É o que o animPhase das
  // Fases 2–5 usa como max(base hardcoded, aumento) — o prefixo não está nos consts.
  it("runtimeFrameAddition devolve só o aumento (Fase 2–5 via animPhase)", () => {
    resetFrameAdditions();
    expect(runtimeFrameAddition("walk", "telemarketer")).toBe(0);
    registerFrameAddition("walk", "telemarketer", 5); // aprovou enemy-telemarketer-walk4
    expect(runtimeFrameAddition("walk", "telemarketer")).toBe(5);
    // animPhase(prefix, frames=4) passaria a ciclar max(4, 5) = 5.
    expect(Math.max(4, runtimeFrameAddition("walk", "telemarketer"))).toBe(5);
  });

  it("hasAnimConfig separa setEnemyTex (Fase 1 + recolor) de mkItem (Fase 2–5)", () => {
    expect(hasAnimConfig("facilitador")).toBe(true); // Fase 1 (setEnemyTex)
    expect(hasAnimConfig("scrum-boss")).toBe(true); // recolor boss
    expect(hasAnimConfig("telemarketer")).toBe(false); // Fase 2 (animPhase, sem const)
  });
});
