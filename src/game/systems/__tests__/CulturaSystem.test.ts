import { describe, it, expect } from "bun:test";
import { CULTURAS, CulturaId, reapplyAllCulturas } from "../CulturaSystem";
import type { Player } from "../../entities/Player";
import type { RunState } from "../PlayerState";

// Player fake com só os campos que reapplyAllCulturas toca (sem Phaser).
const fakePlayer = () =>
  ({
    walkSpeed: 200,
    damageMult: 1,
    vrDropMult: 1,
    maxSanity: 100,
    maxEnergy: 100,
    specialCooldown: 1000,
    attackIntervalMs: 220,
    attackRange: 32,
    autonomia: false,
  }) as unknown as Player & Record<string, number | boolean>;

const run = (culturas: CulturaId[]) => ({ culturas }) as unknown as RunState;

describe("CulturaSystem — catálogo", () => {
  it("cada cultura tem id == chave, name e description não-vazios", () => {
    for (const [key, def] of Object.entries(CULTURAS)) {
      expect(def.id).toBe(key as CulturaId);
      expect(def.name.length).toBeGreaterThan(0);
      expect(def.description.length).toBeGreaterThan(0);
    }
  });
});

describe("CulturaSystem — efeitos aplicados na run", () => {
  it("lista vazia não altera nada", () => {
    const p = fakePlayer();
    const before = { ...p };
    reapplyAllCulturas(p, run([]));
    expect(p).toEqual(before);
  });

  it("happy_hour: +25 maxEnergy", () => {
    const p = fakePlayer();
    reapplyAllCulturas(p, run(["happy_hour"]));
    expect(p.maxEnergy).toBe(125);
  });

  it("gestao_burnout: +30 maxSanity", () => {
    const p = fakePlayer();
    reapplyAllCulturas(p, run(["gestao_burnout"]));
    expect(p.maxSanity).toBe(130);
  });

  it("plano_imediato: +40 maxEnergy, -20 maxSanity", () => {
    const p = fakePlayer();
    reapplyAllCulturas(p, run(["plano_imediato"]));
    expect(p.maxEnergy).toBe(140);
    expect(p.maxSanity).toBe(80);
  });

  it("refeicao_executiva: +20 energia e +20 sanidade", () => {
    const p = fakePlayer();
    reapplyAllCulturas(p, run(["refeicao_executiva"]));
    expect(p.maxEnergy).toBe(120);
    expect(p.maxSanity).toBe(120);
  });

  it("multiplicadores: alinhamento/overtime/meta/feedback", () => {
    const p = fakePlayer();
    reapplyAllCulturas(
      p,
      run(["alinhamento_total", "overtime_bonus", "meta_batida", "feedback_semanal"]),
    );
    expect(p.walkSpeed).toBeCloseTo(240); // x1.2
    expect(p.damageMult).toBeCloseTo(1.2);
    expect(p.vrDropMult).toBeCloseTo(1.5);
    expect(p.attackRange).toBeCloseTo(40); // 32 x1.25
  });

  it("cooldowns: daily_scrum e pdi_completo arredondam", () => {
    const p = fakePlayer();
    reapplyAllCulturas(p, run(["daily_scrum", "pdi_completo"]));
    expect(p.specialCooldown).toBe(600); // round(1000*0.6)
    expect(p.attackIntervalMs).toBe(165); // round(220*0.75)
  });

  it("autonomia_total liga a flag", () => {
    const p = fakePlayer();
    reapplyAllCulturas(p, run(["autonomia_total"]));
    expect(p.autonomia).toBe(true);
  });

  it("banco_horas NÃO é aplicado aqui (só na seleção)", () => {
    const p = fakePlayer();
    const before = { ...p };
    reapplyAllCulturas(p, run(["banco_horas"]));
    expect(p).toEqual(before);
  });

  it("empilha aditivamente múltiplas culturas de energia", () => {
    const p = fakePlayer();
    reapplyAllCulturas(p, run(["happy_hour", "refeicao_executiva"]));
    expect(p.maxEnergy).toBe(100 + 25 + 20);
  });
});
