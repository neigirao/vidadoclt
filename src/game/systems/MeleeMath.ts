// ─────────────────────────────────────────────────────────────────────────────
// Núcleo NUMÉRICO do golpe corpo-a-corpo — SEM Phaser, para ser testável isolado
// (o resto de MeleeCombat.ts é 100% FX/física/Phaser). É a matemática de dano/
// combo/knockback/VR que já teve bug (o golpe processado ~8× por falta de dedup)
// e por isso vale travar com teste. MeleeCombat delega a estas funções.
// ─────────────────────────────────────────────────────────────────────────────
import type { WeaponDef } from "./WeaponSystem";

/** Quantos hits o combo da arma tem: 2 se o 3º passo é 0, senão 3. */
export function meleeComboHits(def: WeaponDef): 2 | 3 {
  return def.hitDamages[2] === 0 ? 2 : 3;
}

/** Dano-base do passo do combo (índice capado ao tamanho; fallback ao 1º hit). */
export function meleeBaseDamage(def: WeaponDef, step: number): number {
  const idx = Math.min(step - 1, def.hitDamages.length - 1);
  return def.hitDamages[idx] || def.hitDamages[0];
}

/** Dano final = base × mult da arma/perks × primeiro-golpe × Burnout, arredondado. */
export function meleeDamage(
  def: WeaponDef,
  step: number,
  damageMult: number,
  strikeMult: number,
  burnoutDealtMult: number,
): number {
  return Math.round(meleeBaseDamage(def, step) * damageMult * strikeMult * burnoutDealtMult);
}

/** O passo é o finalizador do combo? */
export function meleeIsFinisher(def: WeaponDef, step: number): boolean {
  return step >= meleeComboHits(def);
}

/** Knockback: comboKnockback no finalizador, 80 nos demais; sinal = direção. */
export function meleeKnockback(def: WeaponDef, step: number, facing: 1 | -1): number {
  return (meleeIsFinisher(def, step) ? def.comboKnockback : 80) * facing;
}

/** VR dropado por kill: base × mult do player × mult da cena × Burnout, mín. 1. */
export function meleeVrDrop(
  vrDrop: number,
  vrDropMult: number,
  killMult: number,
  burnoutVrMult: number,
): number {
  return Math.max(1, Math.round(vrDrop * vrDropMult * killMult * burnoutVrMult));
}
