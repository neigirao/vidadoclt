import Phaser from "phaser";
import { PerkId } from "./PerkSystem";
import { WeaponId } from "./WeaponSystem";
import { generateSeed } from "./RNG";
import { resetRunKills } from "./BestiarySystem";
import type { CulturaId } from "./CulturaSystem";

const LS_RECNH = "vidadoclt_recnh";
const LS_FGTS = "vidadoclt_fgts";
const LS_LOOPS = "vidadoclt_loops";
const LS_RECORD_VR = "vidadoclt_record_vr";

export type RunState = {
  energy: number;
  sanity: number;
  vr: number;
  reconhecimento: number;
  fgts: number;
  loopCount: number;
  autonomia: boolean;
  seed: string;
  cameFrom?: string;
  sourcePhase?: string;
  nextScene?: string;
  characterClass?: string;
  weaponId?: string;
  secondaryWeaponId?: string | null; // 2ª arma carregada (troca com Q)
  perks?: PerkId[];
  culturas?: CulturaId[];
  extraLives?: number;
  cafeForte?: boolean;
  shopWeapons?: WeaponId[];
  shopPerks?: PerkId[];
  openSpaceCleared?: boolean;
  lastDeathCause?: "burnout" | "energy";
  // Ramificação de rotas (#1): escolha pós-Fase 1. Persiste na run e aplica um
  // modificador leve no buildPlayer (fundação — as fases divergem no futuro).
  route?: "comercial" | "atendimento";
  route2?: "produto" | "tecnologia";
  // Salas opcionais (#3): ids de salas-bônus já limpas nesta run (não repetir).
  optionalRoomsCleared?: string[];
  // New Game+ "Quinta-feira": run mais difícil (inimigos +40% HP). Persistência
  // do desbloqueio fica no localStorage (ngPlusUnlocked), não na run.
  ngPlus?: boolean;
  // NPC Veterano (#26): favor de atalho já usado nesta run.
  veteranoFavor?: boolean;
  // Upgrade mods (applied once at run start by ReconhecimentoSystem)
  upgMaxEnergy?: number;
  upgMaxSanity?: number;
  upgVrDropMult?: number;
  upgParryWindowBonus?: number;
  upgSpecialCooldownMult?: number;
  upgDashCooldownBonus?: number;
  upgDamageReductionMult?: number;
  upgParryEnergyRestore?: number;
  upgParryVrDrop?: number;
  upgComboHitsBonus?: number;
  heatLevel?: number;
  heatMods?: string[];
  heatBossHpMult?: number;
  heatSanityDrainMult?: number;
  heatNoConsumibles?: boolean;
  heatFastClock?: boolean;
  heatEnemySpeedMult?: number;
  heatBonus?: number;
  activeSynergies?: string[];
  goldenHourActive?: boolean;
};

function lsGet(key: string): number {
  try {
    return parseInt(localStorage.getItem(key) ?? "0", 10) || 0;
  } catch {
    return 0;
  }
}

function lsSet(key: string, n: number) {
  try {
    localStorage.setItem(key, String(n));
  } catch {
    /* storage/áudio indisponível — ignorar */
  }
}

export function savePersisted(reconhecimento: number, fgts: number, loopCount: number) {
  lsSet(LS_RECNH, reconhecimento);
  lsSet(LS_FGTS, fgts);
  lsSet(LS_LOOPS, loopCount);
}

/** Recorde de VR coletado numa única run (persistido). Mostrado no death recap. */
export function getRecordVr(): number {
  return lsGet(LS_RECORD_VR);
}
/** Atualiza o recorde se `vr` for maior; retorna true se bateu recorde. */
export function bumpRecordVr(vr: number): boolean {
  if (vr > getRecordVr()) {
    lsSet(LS_RECORD_VR, vr);
    return true;
  }
  return false;
}

const LS_NGPLUS = "vidaclt:ngPlusUnlocked";

/** Marca o New Game+ "Quinta-feira" como desbloqueado (após a 1ª vitória). */
export function unlockNgPlus() {
  lsSet(LS_NGPLUS, 1);
}

/** True se o jogador já venceu ao menos uma vez (Quinta-feira disponível). */
export function isNgPlusUnlocked(): boolean {
  return lsGet(LS_NGPLUS) === 1;
}

export function getRun(scene: Phaser.Scene): RunState {
  const r = scene.registry.get("run") as RunState | undefined;
  if (!r) {
    const fresh: RunState = {
      energy: 100,
      sanity: 100,
      vr: 0,
      reconhecimento: lsGet(LS_RECNH),
      fgts: lsGet(LS_FGTS),
      loopCount: lsGet(LS_LOOPS),
      autonomia: false,
      seed: generateSeed(),
      perks: [],
      culturas: [],
      extraLives: 0,
      cafeForte: false,
      shopWeapons: undefined,
      shopPerks: undefined,
    };
    scene.registry.set("run", fresh);
    return fresh;
  }
  return r;
}

export function resetRun(scene: Phaser.Scene): RunState {
  const old = getRun(scene);
  const fresh: RunState = {
    energy: 100,
    sanity: 100,
    vr: 0,
    reconhecimento: old.reconhecimento,
    fgts: old.fgts,
    loopCount: old.loopCount,
    autonomia: false,
    seed: generateSeed(),
    characterClass: old.characterClass,
    perks: [],
    culturas: [],
    extraLives: 0,
    cafeForte: false,
    shopWeapons: undefined,
    shopPerks: undefined,
  };
  scene.registry.set("run", fresh);
  resetRunKills(); // zera o contador de kills da run (death recap)
  return fresh;
}

// sanityBand foi movida para ./sanity (módulo puro, testável) e é re-exportada
// aqui para não quebrar os importadores existentes.
export { sanityBand, type SanityBand } from "./sanity";
