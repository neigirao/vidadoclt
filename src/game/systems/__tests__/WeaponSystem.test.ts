import { describe, it, expect } from "bun:test";
import { WEAPONS, CLASSES } from "../WeaponSystem";

const all = Object.values(WEAPONS);

describe("WeaponSystem — arsenal", () => {
  it("são 12 armas, todas com stats válidos", () => {
    // (CLAUDE.md dizia 15 — o teste travou o número real do catálogo.)
    expect(all.length).toBe(12);
    for (const w of all) {
      expect(w.hitDamages.length).toBe(3);
      expect(w.hitDamages[0]).toBeGreaterThan(0);
      expect(w.attackRange).toBeGreaterThan(0);
      expect(w.comboKnockback).toBeGreaterThan(0);
      expect(["melee", "ranged"]).toContain(w.type);
    }
  });

  it("grampeador (arma inicial) mantém a baseline do balanceamento", () => {
    // Todos os TTKs dos playtests foram calculados sobre 10/10/15, range 32.
    const g = WEAPONS.grampeador;
    expect(g.hitDamages).toEqual([10, 10, 15]);
    expect(g.attackRange).toBe(32);
    expect(g.comboKnockback).toBe(320);
  });

  it("combo de 2 hits é sinalizado por hitDamages[2] === 0", () => {
    // Convenção usada por Player.comboHits e pelo MeleeCombat.
    for (const w of all) {
      if (w.hitDamages[2] === 0) expect(w.hitDamages[1]).toBeGreaterThan(0);
    }
  });
});

describe("WeaponSystem — classes", () => {
  it("3 classes, cada uma com arma inicial existente e multiplicadores sãos", () => {
    const ids = Object.keys(CLASSES);
    expect(ids.length).toBe(3);
    for (const c of Object.values(CLASSES)) {
      expect(WEAPONS[c.startWeapon]).toBeDefined();
      expect(c.maxEnergy).toBeGreaterThan(0);
      expect(c.maxSanity).toBeGreaterThan(0);
      expect(c.speedMult).toBeGreaterThan(0);
      expect(c.damageMult).toBeGreaterThan(0);
    }
  });
});
