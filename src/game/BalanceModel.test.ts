import { describe, expect, test } from "bun:test";
import {
  analyzeBalance,
  analyzeElites,
  attackIntervalMs,
  comboHitsFor,
  effectiveHp,
  enemyIncomingDps,
  loopHpScale,
  playerDps,
  scaledHp,
} from "./systems/BalanceModel";
import { ENEMIES } from "./systems/EnemyCatalog";
import { CLASSES, WEAPONS } from "./systems/WeaponSystem";

describe("BalanceModel", () => {
  test("attackIntervalMs = round(220/attackSpeedMult), igual ao PlayerLoadout", () => {
    expect(attackIntervalMs(WEAPONS.grampeador)).toBe(220); // mult 1.0
    expect(attackIntervalMs(WEAPONS.teclado)).toBe(Math.round(220 / 1.4)); // mult 1.4
  });

  test("Analista sobe combo 3→4; outras classes mantêm o base da arma", () => {
    expect(comboHitsFor("analista", WEAPONS.grampeador)).toBe(4); // base 3 → 4
    expect(comboHitsFor("estagiario", WEAPONS.grampeador)).toBe(3);
    // Arma de 2 hits (teclado: hitDamages[2]===0) não vira 4 nem no Analista.
    expect(comboHitsFor("analista", WEAPONS.teclado)).toBe(2);
  });

  test("playerDps é positivo e finito p/ toda combinação classe×arma", () => {
    for (const cid of Object.keys(CLASSES) as (keyof typeof CLASSES)[]) {
      for (const wid of Object.keys(WEAPONS) as (keyof typeof WEAPONS)[]) {
        const dps = playerDps(cid, wid);
        expect(dps).toBeGreaterThan(0);
        expect(Number.isFinite(dps)).toBe(true);
      }
    }
  });

  test("Terceirizado tem mais vida efetiva (blindagem −15%) que o Analista", () => {
    expect(effectiveHp("terceirizado")).toBeGreaterThan(effectiveHp("analista"));
    // 130 / 0.85 ≈ 152.9
    expect(effectiveHp("terceirizado")).toBeCloseTo(130 / 0.85, 1);
  });

  test("escala de HP por loop: F1 +20%/loop, F2–5 +15%/loop", () => {
    expect(loopHpScale(1, 0)).toBe(1);
    expect(loopHpScale(1, 2)).toBeCloseTo(1.4, 5);
    expect(loopHpScale(3, 2)).toBeCloseTo(1.3, 5);
    const e = ENEMIES.estagiario_desesperado; // F1, hp 12
    expect(scaledHp(e, 1)).toBeCloseTo(12 * 1.2, 5);
  });

  test("pressão do inimigo usa o maior golpe / janela de i-frames; 0 se inofensivo", () => {
    // Facilitador: contactDamage 0 e sem attacks → pressão 0.
    expect(enemyIncomingDps(ENEMIES.facilitador_workshop)).toBe(0);
    // Estagiário Desesperado: lunge 15 domina o contato 6 → 15 / 0.35s.
    expect(enemyIncomingDps(ENEMIES.estagiario_desesperado)).toBeCloseTo(15 / 0.35, 3);
  });

  test("analyzeBalance: TTK cresce com HP escalado do loop", () => {
    const base = analyzeBalance(0);
    const looped = analyzeBalance(3);
    const id = "impressora_necromorfa";
    const t0 = base.enemies.find((e) => e.id === id)!.ttkAvg;
    const t3 = looped.enemies.find((e) => e.id === id)!.ttkAvg;
    expect(t3).toBeGreaterThan(t0);
  });

  test("analyzeBalance retorna as 3 classes e todos os inimigos do catálogo", () => {
    const r = analyzeBalance(0);
    expect(r.classes.length).toBe(3);
    expect(r.enemies.length).toBe(Object.keys(ENEMIES).length);
    expect(r.dpsSpread).toBeGreaterThanOrEqual(1);
  });

  test("analyzeElites: TTK do elite escala com hpMult; comportamentais têm rótulo", () => {
    const er = analyzeElites(0);
    expect(er.affixes.length).toBeGreaterThanOrEqual(5);
    for (const a of er.affixes) {
      expect(a.ttk).toBeGreaterThan(0);
      expect(a.ttkVsBase).toBeCloseTo(a.hpMult, 5); // TTK ∝ hpMult (mesmo DPS)
    }
    const explode = er.affixes.find((a) => a.behavior.startsWith("explode"));
    const escudo = er.affixes.find((a) => a.behavior.startsWith("escudo"));
    expect(explode !== undefined).toBe(true);
    expect(escudo !== undefined).toBe(true);
  });
});
