import { describe, it, expect } from "bun:test";
import { CULTURAS, CulturaId, reapplyAllCulturas, selectableCulturaIds } from "../CulturaSystem";
import type { Player } from "../../entities/Player";
import type { RunState } from "../PlayerState";

// Player fake com só os campos que reapplyAllCulturas toca (sem Phaser).
const fakePlayer = () =>
  ({
    walkSpeed: 200,
    damageMult: 1,
    damageReductionMult: 1,
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

  it("happy_hour (tradeoff): +35 maxEnergy, -10 maxSanity", () => {
    const p = fakePlayer();
    reapplyAllCulturas(p, run(["happy_hour"]));
    expect(p.maxEnergy).toBe(135);
    expect(p.maxSanity).toBe(90);
  });

  it("gestao_burnout (tradeoff): +40 maxSanity, -10 maxEnergy", () => {
    const p = fakePlayer();
    reapplyAllCulturas(p, run(["gestao_burnout"]));
    expect(p.maxSanity).toBe(140);
    expect(p.maxEnergy).toBe(90);
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

  it("tradeoffs: alinhamento/overtime/meta/feedback aplicam presa E custo", () => {
    const p = fakePlayer();
    reapplyAllCulturas(
      p,
      run(["alinhamento_total", "overtime_bonus", "meta_batida", "feedback_semanal"]),
    );
    // alinhamento (x1.25 vel, x0.85 alcance) + feedback (x1.35 alcance, x0.88 vel)
    expect(p.walkSpeed).toBeCloseTo(200 * 1.25 * 0.88); // 220
    expect(p.attackRange).toBeCloseTo(32 * 0.85 * 1.35); // 36.72
    // overtime: +30% dano causado, +20% dano recebido (custo)
    expect(p.damageMult).toBeCloseTo(1.3);
    expect(p.damageReductionMult).toBeCloseTo(1.2);
    // meta: +60% VR, -20% energia máx (custo)
    expect(p.vrDropMult).toBeCloseTo(1.6);
    expect(p.maxEnergy).toBe(80);
  });

  it("tradeoffs de cooldown: daily_scrum e pdi_completo (presa + custo)", () => {
    const p = fakePlayer();
    reapplyAllCulturas(p, run(["daily_scrum"]));
    expect(p.specialCooldown).toBe(500); // round(1000*0.5)
    expect(p.maxSanity).toBe(80); // custo: -20 sanidade
    const q = fakePlayer();
    reapplyAllCulturas(q, run(["pdi_completo"]));
    expect(q.attackIntervalMs).toBe(143); // round(220*0.65)
    expect(q.damageMult).toBeCloseTo(0.8); // custo: -20% dano/golpe
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
    expect(p.maxEnergy).toBe(100 + 35 + 20); // happy_hour agora +35
    expect(p.maxSanity).toBe(100 - 10 + 20); // custo do happy_hour + bônus refeição
  });

  it("padrao_clt é no-op (primeira run, sem modificadores)", () => {
    const p = fakePlayer();
    const before = { ...p };
    reapplyAllCulturas(p, run(["padrao_clt"]));
    expect(p).toEqual(before);
  });
});

describe("CulturaSystem — roleta de seleção", () => {
  it("selectableCulturaIds exclui o no-op padrao_clt", () => {
    const ids = selectableCulturaIds();
    expect(ids).not.toContain("padrao_clt");
    expect(ids.length).toBe(Object.keys(CULTURAS).length - 1);
  });
});
