import { describe, it, expect } from "bun:test";
import {
  PERKS,
  PerkId,
  SYNERGIES,
  WEAPON_SYNERGIES,
  applyPerk,
  checkAndApplyWeaponSynergies,
  synergyPreview,
} from "../PerkSystem";
import { WEAPONS } from "../WeaponSystem";
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
    airAttackBonus: 0,
    firstStrikeStun: false,
    weaponId: undefined,
  }) as unknown as Player & Record<string, number | boolean | undefined>;

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

describe("PerkSystem — sinergias arma×perk", () => {
  it("cada sinergia referencia arma e perk válidos + name/desc/icon", () => {
    for (const def of Object.values(WEAPON_SYNERGIES)) {
      expect(WEAPONS[def.weapon]).toBeDefined();
      expect(PERKS[def.perk]).toBeDefined();
      expect(def.name.length).toBeGreaterThan(0);
      expect(def.desc.length).toBeGreaterThan(0);
      expect(def.icon.length).toBeGreaterThan(0);
    }
  });

  it("ativa só quando a arma equipada E o perk estão presentes", () => {
    const p = fakePlayer();
    p.weaponId = "caneca";
    const r = fakeRun();
    r.perks = ["cafe_forte"];
    const labels = checkAndApplyWeaponSynergies(p, r);
    expect(labels.length).toBe(1);
    expect(p.specialCooldownMult).toBeCloseTo(0.7); // Cafeína Pura
  });

  it("não ativa se a arma não bate (mesmo com o perk)", () => {
    const p = fakePlayer();
    p.weaponId = "grampeador";
    const r = fakeRun();
    r.perks = ["cafe_forte"];
    const labels = checkAndApplyWeaponSynergies(p, r);
    expect(labels.length).toBe(0);
    expect(p.specialCooldownMult).toBeCloseTo(1);
  });

  it("não ativa sem arma equipada", () => {
    const p = fakePlayer();
    const r = fakeRun();
    r.perks = ["plr"];
    expect(checkAndApplyWeaponSynergies(p, r).length).toBe(0);
  });

  it("Planilha Infinita: impressora + plr → vrDropMult ×1.3", () => {
    const p = fakePlayer();
    p.weaponId = "impressora";
    const r = fakeRun();
    r.perks = ["plr"];
    checkAndApplyWeaponSynergies(p, r);
    expect(p.vrDropMult).toBeCloseTo(1.3);
  });
});

describe("PerkSystem — synergyPreview (telegrafia de sinergia)", () => {
  it("perk×perk: candidato fecha sinergia quando o outro perk já é do build", () => {
    // valkyria = piso_de_vidro + hora_extra
    const r = synergyPreview("hora_extra", ["piso_de_vidro"], "grampeador");
    expect(r?.name).toBe("Valkyria CLT");
    expect(r?.with).toBe(PERKS.piso_de_vidro.name);
  });
  it("não sinaliza se o outro perk do par não está no build", () => {
    expect(synergyPreview("hora_extra", [], "grampeador")).toBeNull();
  });
  it("arma×perk: candidato + arma equipada fecham sinergia", () => {
    // cafeina_pura = caneca + cafe_forte
    const r = synergyPreview("cafe_forte", [], "caneca");
    expect(r?.name).toBe("Cafeína Pura");
  });
  it("arma×perk não sinaliza com arma errada", () => {
    expect(synergyPreview("cafe_forte", [], "grampeador")).toBeNull();
  });
  it("perk já possuído não sinaliza (null)", () => {
    expect(synergyPreview("hora_extra", ["hora_extra", "piso_de_vidro"], "grampeador")).toBeNull();
  });
});
