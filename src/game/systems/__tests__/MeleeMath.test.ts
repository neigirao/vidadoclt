import { describe, it, expect } from "bun:test";
import { WEAPONS } from "../WeaponSystem";
import type { WeaponDef } from "../WeaponSystem";
import {
  meleeComboHits,
  meleeBaseDamage,
  meleeDamage,
  meleeIsFinisher,
  meleeKnockback,
  meleeVrDrop,
} from "../MeleeMath";

const g = WEAPONS.grampeador; // hitDamages [10,10,15], comboKnockback 320
const twoHit = { hitDamages: [12, 12, 0], comboKnockback: 200, hitSlow: 0 } as unknown as WeaponDef;

describe("MeleeMath — combo", () => {
  it("3-combo quando o 3º passo > 0", () => expect(meleeComboHits(g)).toBe(3));
  it("2-combo quando o 3º passo == 0", () => expect(meleeComboHits(twoHit)).toBe(2));
});

describe("MeleeMath — dano base por passo", () => {
  it("passo 1/2/3 usa índice 0/1/2", () => {
    expect(meleeBaseDamage(g, 1)).toBe(10);
    expect(meleeBaseDamage(g, 2)).toBe(10);
    expect(meleeBaseDamage(g, 3)).toBe(15);
  });
  it("passo além do combo capa no último índice", () => {
    expect(meleeBaseDamage(g, 4)).toBe(15);
  });
});

describe("MeleeMath — dano final (mults + arredondamento)", () => {
  it("sem mults = dano base", () => expect(meleeDamage(g, 3, 1, 1, 1)).toBe(15));
  it("damageMult dobra", () => expect(meleeDamage(g, 3, 2, 1, 1)).toBe(30));
  it("primeiro-golpe ×1.5", () => expect(meleeDamage(g, 1, 1, 1.5, 1)).toBe(15));
  it("arredonda pra cima no meio", () => expect(meleeDamage(g, 1, 1, 1, 1.35)).toBe(14));
  it("Burnout ×1.35 no dano causado", () => expect(meleeDamage(g, 3, 1, 1, 1.35)).toBe(20));
});

describe("MeleeMath — finisher & knockback", () => {
  it("finisher é o último passo do combo", () => {
    expect(meleeIsFinisher(g, 2)).toBe(false);
    expect(meleeIsFinisher(g, 3)).toBe(true);
    expect(meleeIsFinisher(twoHit, 2)).toBe(true);
  });
  it("knockback: comboKnockback no finisher, 80 senão; sinal = facing", () => {
    expect(meleeKnockback(g, 1, 1)).toBe(80);
    expect(meleeKnockback(g, 3, 1)).toBe(320);
    expect(meleeKnockback(g, 3, -1)).toBe(-320);
  });
});

describe("MeleeMath — VR drop", () => {
  it("sem mults = base", () => expect(meleeVrDrop(5, 1, 1, 1)).toBe(5));
  it("multiplica player × cena", () => expect(meleeVrDrop(5, 1.5, 2, 1)).toBe(15));
  it("Burnout ×1.5", () => expect(meleeVrDrop(4, 1, 1, 1.5)).toBe(6));
  it("clampa no mínimo 1", () => expect(meleeVrDrop(1, 0.1, 1, 1)).toBe(1));
});
