import { describe, expect, test } from "bun:test";
import {
  copaHealsSanity,
  DEADLINE_MIN,
  elapsedToGameMinutes,
  expedienteBand,
  expedienteStatus,
  formatClock,
  HORA_EXTRA_MIN,
  MS_PER_GAME_MIN,
  overtimePressureMult,
  timeBonusMult,
  timeLeftRatio,
} from "../Expediente";

const MIN = MS_PER_GAME_MIN; // ms reais por minuto de jogo

describe("relógio do expediente", () => {
  test("começa às 18:00 e anda", () => {
    expect(formatClock(0)).toBe("18:00");
    expect(formatClock(47)).toBe("18:47");
    expect(formatClock(HORA_EXTRA_MIN)).toBe("20:00");
    expect(formatClock(DEADLINE_MIN)).toBe("22:00");
  });

  test("tempo real vira minuto de jogo", () => {
    expect(elapsedToGameMinutes(0)).toBe(0);
    expect(elapsedToGameMinutes(MIN)).toBe(1);
    expect(elapsedToGameMinutes(60 * MIN)).toBe(60); // 1h de expediente
  });

  test("tempo negativo/inválido não anda o relógio", () => {
    expect(elapsedToGameMinutes(-1)).toBe(0);
    expect(elapsedToGameMinutes(NaN)).toBe(0);
  });

  test("rateMult acelera (é o que dá sentido ao heatFastClock)", () => {
    expect(elapsedToGameMinutes(60 * MIN, 1.5)).toBe(90);
  });
});

describe("(A) prazo brando — hora extra encarece", () => {
  test("antes das 20h nada muda", () => {
    expect(expedienteBand(HORA_EXTRA_MIN - 1)).toBe("normal");
    expect(overtimePressureMult(HORA_EXTRA_MIN - 1)).toBe(1);
    expect(copaHealsSanity(HORA_EXTRA_MIN - 1)).toBe(true);
  });

  test("a partir das 20h entra hora extra e a Copa para de curar sanidade", () => {
    expect(expedienteBand(HORA_EXTRA_MIN)).toBe("hora_extra");
    expect(copaHealsSanity(HORA_EXTRA_MIN)).toBe(false);
  });

  test("o dano recebido sobe por hora vencida", () => {
    const umaHora = overtimePressureMult(HORA_EXTRA_MIN + 60);
    const duasHoras = overtimePressureMult(HORA_EXTRA_MIN + 120);
    expect(umaHora).toBeGreaterThan(1);
    expect(duasHoras).toBeGreaterThan(umaHora);
  });

  test("a pressão tem TETO — hora extra encarece, não vira one-shot", () => {
    // Uma run absurdamente longa não pode virar morte instantânea: o desenho é
    // "encarece", e o relógio nunca mata.
    const absurdo = overtimePressureMult(HORA_EXTRA_MIN + 100 * 60);
    expect(absurdo).toBeLessThanOrEqual(1.6);
    expect(absurdo).toBe(overtimePressureMult(HORA_EXTRA_MIN + 500 * 60));
  });
});

describe("(C) tempo como moeda — bônus de fim de run", () => {
  test("sair às 18h em ponto paga o bônus cheio", () => {
    expect(timeLeftRatio(0)).toBe(1);
    expect(timeBonusMult(0)).toBeCloseTo(1.5, 5);
  });

  test("o bônus decai conforme o expediente passa", () => {
    const cedo = timeBonusMult(60);
    const tarde = timeBonusMult(180);
    expect(cedo).toBeGreaterThan(tarde);
    expect(tarde).toBeGreaterThan(1);
  });

  test("das 22h em diante o bônus zera — mas NUNCA penaliza", () => {
    // Enrolar custa o BÔNUS, não o que o jogador já ganhou: o multiplicador
    // fica em 1.0 e não desce, senão o relógio viraria punição (desenho B,
    // descartado).
    expect(timeBonusMult(DEADLINE_MIN)).toBe(1);
    expect(timeBonusMult(DEADLINE_MIN + 999)).toBe(1);
    expect(timeLeftRatio(DEADLINE_MIN + 999)).toBe(0);
  });
});

describe("expedienteStatus — resumo pra HUD", () => {
  test("run curta: expediente normal, bônus alto", () => {
    const s = expedienteStatus(30 * MIN);
    expect(s.clock).toBe("18:30");
    expect(s.band).toBe("normal");
    expect(s.pressureMult).toBe(1);
    expect(s.timeBonusMult).toBeGreaterThan(1.3);
  });

  test("run longa: hora extra, pressão > 1 e bônus menor", () => {
    const s = expedienteStatus(200 * MIN);
    expect(s.clock).toBe("21:20");
    expect(s.band).toBe("hora_extra");
    expect(s.pressureMult).toBeGreaterThan(1);
    expect(s.timeBonusMult).toBeLessThan(1.2);
  });
});
