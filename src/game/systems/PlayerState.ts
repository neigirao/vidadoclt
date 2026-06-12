import Phaser from "phaser";
import { PerkId } from "./PerkSystem";
import { WeaponId } from "./WeaponSystem";

const LS_RECNH = "vidadoclt_recnh";
const LS_FGTS  = "vidadoclt_fgts";
const LS_LOOPS = "vidadoclt_loops";

export type RunState = {
  energy: number;
  sanity: number;
  vr: number;
  reconhecimento: number;
  fgts: number;
  loopCount: number;
  autonomia: boolean;
  cameFrom?: string;
  nextScene?: string;
  characterClass?: string;
  weaponId?: string;
  perks?: PerkId[];
  extraLives?: number;
  cafeForte?: boolean;
  shopWeapons?: WeaponId[];
  shopPerks?: PerkId[];
  openSpaceCleared?: boolean;
};

function lsGet(key: string): number {
  try { return parseInt(localStorage.getItem(key) ?? "0", 10) || 0; }
  catch { return 0; }
}

function lsSet(key: string, n: number) {
  try { localStorage.setItem(key, String(n)); } catch {}
}

export function savePersisted(reconhecimento: number, fgts: number, loopCount: number) {
  lsSet(LS_RECNH, reconhecimento);
  lsSet(LS_FGTS, fgts);
  lsSet(LS_LOOPS, loopCount);
}

export function getRun(scene: Phaser.Scene): RunState {
  const r = scene.registry.get("run") as RunState | undefined;
  if (!r) {
    const fresh: RunState = {
      energy: 100, sanity: 100, vr: 0,
      reconhecimento: lsGet(LS_RECNH),
      fgts: lsGet(LS_FGTS),
      loopCount: lsGet(LS_LOOPS),
      autonomia: false,
      perks: [],
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
    energy: 100, sanity: 100, vr: 0,
    reconhecimento: old.reconhecimento,
    fgts: old.fgts,
    loopCount: old.loopCount,
    autonomia: false,
    characterClass: old.characterClass,
    perks: [],
    extraLives: 0,
    cafeForte: false,
    shopWeapons: undefined,
    shopPerks: undefined,
  };
  scene.registry.set("run", fresh);
  return fresh;
}

export function sanityBand(s: number): "ok" | "stressed" | "anxious" | "burnout" {
  if (s > 74) return "ok";
  if (s > 49) return "stressed";
  if (s > 24) return "anxious";
  return "burnout";
}
