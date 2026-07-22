import { describe, expect, test } from "bun:test";
import {
  applyEliteStats,
  ELITE_AFFIXES,
  eliteChance,
  rollElite,
  type EliteTarget,
} from "./systems/EliteAffixes";

describe("EliteSystem", () => {
  test("afixos têm mults sãos (buff, não nerf) e VR bônus", () => {
    for (const a of ELITE_AFFIXES) {
      expect(a.hpMult).toBeGreaterThanOrEqual(1);
      expect(a.dmgMult).toBeGreaterThanOrEqual(1);
      expect(a.speedMult).toBeGreaterThanOrEqual(1);
      expect(a.scaleMult).toBeGreaterThanOrEqual(1);
      expect(a.vrBonus).toBeGreaterThan(0);
      expect(a.badge.length).toBeGreaterThan(0);
    }
  });

  test("afixos comportamentais existem (explode + escudo)", () => {
    const explode = ELITE_AFFIXES.find((a) => a.explodeDmg);
    const shield = ELITE_AFFIXES.find((a) => a.shieldHits);
    expect(explode !== undefined).toBe(true);
    expect(explode!.explodeDmg!).toBeGreaterThan(0);
    expect(shield !== undefined).toBe(true);
    expect(shield!.shieldHits!).toBeGreaterThanOrEqual(1);
    // afixos de stat puro não têm comportamento
    expect(ELITE_AFFIXES.find((a) => a.id === "efetivado")!.explodeDmg === undefined).toBe(true);
  });

  test("eliteChance escala com loop/Heat e tem teto 25%", () => {
    expect(eliteChance(0, 0)).toBeCloseTo(0.09, 5);
    expect(eliteChance(2, 1)).toBeCloseTo(0.09 + 0.04 + 0.03, 5);
    expect(eliteChance(99, 99)).toBe(0.25); // teto
  });

  test("rollElite: null acima da chance, afixo abaixo", () => {
    expect(rollElite(0.5, 0, 0.09)).toBeNull(); // frac >= chance
    expect(rollElite(0.01, 0, 0.09)).toBe(ELITE_AFFIXES[0]); // frac < chance
    // pick indexa o afixo (mod len)
    expect(rollElite(0.0, 1, 1)).toBe(ELITE_AFFIXES[1]);
    expect(rollElite(0.0, ELITE_AFFIXES.length, 1)).toBe(ELITE_AFFIXES[0]);
  });

  test("applyEliteStats multiplica hp/maxHp/contactDamage/speed", () => {
    const affix = ELITE_AFFIXES.find((a) => a.id === "efetivado")!;
    const e: EliteTarget = { hp: 100, maxHp: 100, contactDamage: 10, speed: 80 };
    applyEliteStats(e, affix);
    expect(e.hp).toBe(Math.round(100 * affix.hpMult));
    expect(e.maxHp).toBe(Math.round(100 * affix.hpMult));
    expect(e.contactDamage).toBe(Math.round(10 * affix.dmgMult));
    expect(e.speed).toBe(Math.round(80 * affix.speedMult));
  });

  test("applyEliteStats tolera campos ausentes (só hp)", () => {
    const e: EliteTarget = { hp: 50 };
    applyEliteStats(e, ELITE_AFFIXES[0]);
    expect(e.hp).toBe(Math.round(50 * ELITE_AFFIXES[0].hpMult));
    expect(e.contactDamage === undefined).toBe(true);
  });
});
