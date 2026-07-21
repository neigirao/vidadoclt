import type { Player } from "../entities/Player";
import type { RunState } from "./PlayerState";
import { CLASSES, WEAPONS, type ClassId, type WeaponId } from "./WeaponSystem";

/**
 * Aplica no Player o "loadout" DETERMINÍSTICO da run: stats da classe + da arma
 * equipada + upgrades permanentes (Reconhecimento). É a fonte ÚNICA de verdade
 * desse bloco — antes ele estava DUPLICADO em BasePhaseScene.buildPlayer, Copa,
 * SalaReuniao e SalaBonus, e as salas esqueciam `walkSpeed`/arma → o boneco
 * andava/atacava diferente das fases.
 *
 * NÃO mexe em energy/sanity/vr/perks/2ª-arma — isso varia por cena (a fase
 * reaplica perks e cura; a sala herda o estado da run) e fica com o chamador.
 */
export function applyClassAndWeapon(player: Player, run: RunState): void {
  const classDef = CLASSES[(run.characterClass ?? "analista") as ClassId];
  const weaponId = (run.weaponId ?? classDef.startWeapon) as WeaponId;
  const weaponDef = WEAPONS[weaponId] ?? WEAPONS[classDef.startWeapon];

  player.maxEnergy = classDef.maxEnergy + (run.upgMaxEnergy ?? 0);
  player.maxSanity = classDef.maxSanity + (run.upgMaxSanity ?? 0);
  player.walkSpeed = 200 * classDef.speedMult;
  player.damageMult = classDef.damageMult;
  player.vrDropMult = classDef.vrMult + (run.upgVrDropMult ?? 0);
  player.parryWindowBonus = run.upgParryWindowBonus ?? 0;
  player.specialCooldownMult = run.upgSpecialCooldownMult ?? 1.0;
  player.dashCooldownBonus = run.upgDashCooldownBonus ?? 0;
  player.damageReductionMult = run.upgDamageReductionMult ?? 1.0;
  player.parryEnergyRestore = run.upgParryEnergyRestore ?? 0;
  player.parryVrDrop = run.upgParryVrDrop ?? 0;

  player.weaponId = weaponId;
  player.attackRange = weaponDef.attackRange;
  player.specialCooldown = weaponDef.specialCooldown;
  player.specialType = weaponDef.specialType;
  // Override de especial POR CLASSE (identidade de estilo). Guardamos no player p/
  // sobreviver a trocas de arma (applyWeaponStats reaplica): o especial (K) da
  // classe melee é sempre o redemoinho, não o da arma.
  player.classSpecialType = classDef.classSpecial ?? null;
  player.classSpecialName = classDef.classSpecialName ?? null;
  if (classDef.classSpecial) player.specialType = classDef.classSpecial;
  player.hitAutoRanged = weaponDef.hitAutoRanged;
  player.isRangedPrimary = weaponDef.type === "ranged";
  player.comboHits = weaponDef.type === "melee" && weaponDef.hitDamages[2] === 0 ? 2 : 3;
  player.attackIntervalMs = Math.round(220 / (weaponDef.attackSpeedMult ?? 1));
  if ((run.upgComboHitsBonus ?? 0) >= 1) player.comboHits = 4;
}
