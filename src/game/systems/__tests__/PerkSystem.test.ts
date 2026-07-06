import { describe, it, expect } from "bun:test";
import { PERKS, PerkId, SYNERGIES, applyPerk } from "../PerkSystem";
import type { Player } from "../../entities/Player";
import type { RunState } from "../PlayerState";

const fakePlayer = () =>
  ({
    autonomia: false,
    damageMult: 1,
    walkSpeed: 200,
    vrDropMult: 1,
    doubleJump: false,
    firstStrikeReady: false,
    dashCooldownBonus: 0,
    specialCooldownMult: 1,
    healOnKill: 0,
    sanityFloor: 0,
  }) as unknown as Player & Record<string, number | boolean>;

const fakeRun = () =>
  ({ perks: [], extraLives: 0, cafeForte: false }) as unknown as RunState & {
    extraLives: number;
    cafeForte: boolean;
  };

describe("PerkSystem — catálogo de perks", () => {
  it("cada perk tem id == chave, name/description/icon e shopCost > 0", () => {
    for (const [key, def] of Object.entries(PERKS)) {
      expect(def.id).toBe(key as PerkId);
      expect(def.name.length).toBeGreaterThan(0);
      expect(def.description.length).toBeGreaterThan(0);
      expect(def.icon.length).toBeGreaterThan(0);
      expect(def.shopCost).toBeGreaterThan(0);
    }
  });
});

describe("PerkSystem — catálogo de sinergias", () => {
  it("cada sinergia combina >= 2 perks válidos e tem name/desc", () => {
    for (const def of Object.values(SYNERGIES)) {
      expect(def.perks.length).toBeGreaterThanOrEqual(2);
      for (const p of def.perks) expect(PERKS[p]).toBeDefined();
      expect(def.name.length).toBeGreaterThan(0);
      expect(def.desc.length).toBeGreaterThan(0);
    }
  });
});

describe("PerkSystem — applyPerk efeitos", () => {
  it("registra o perk na run", () => {
    const p = fakePlayer();
    const r = fakeRun();
    applyPerk("hora_extra", p, r);
    expect(r.perks).toContain("hora_extra");
  });

  it("é idempotente: aplicar 2x não duplica nem re-aplica o efeito", () => {
    const p = fakePlayer();
    const r = fakeRun();
    applyPerk("hora_extra", p, r);
    applyPerk("hora_extra", p, r);
    expect(r.perks).toEqual(["hora_extra"]);
    expect(p.damageMult).toBeCloseTo(1.2); // aplicado só 1x
  });

  it("efeitos no player", () => {
    const p = fakePlayer();
    const r = fakeRun();
    applyPerk("hora_extra", p, r);
    applyPerk("vale_transporte", p, r);
    applyPerk("plr", p, r);
    applyPerk("piso_de_vidro", p, r);
    applyPerk("sindrome_impostor", p, r);
    applyPerk("reuniao_cancelada", p, r);
    applyPerk("clt_flexivel", p, r);
    applyPerk("banco_de_horas", p, r);
    applyPerk("plano_de_saude", p, r);
    applyPerk("autonomia", p, r);
    expect(p.damageMult).toBeCloseTo(1.2);
    expect(p.walkSpeed).toBeCloseTo(230); // 200 x1.15
    expect(p.vrDropMult).toBeCloseTo(1.25);
    expect(p.doubleJump).toBe(true);
    expect(p.firstStrikeReady).toBe(true);
    expect(p.dashCooldownBonus).toBe(380);
    expect(p.specialCooldownMult).toBeCloseTo(0.6);
    expect(p.healOnKill).toBe(1);
    expect(p.sanityFloor).toBe(25);
    expect(p.autonomia).toBe(true);
  });

  it("efeitos na run: seguro_de_vida (+1 vida) e cafe_forte", () => {
    const p = fakePlayer();
    const r = fakeRun();
    applyPerk("seguro_de_vida", p, r);
    applyPerk("cafe_forte", p, r);
    expect(r.extraLives).toBe(1);
    expect(r.cafeForte).toBe(true);
  });
});
