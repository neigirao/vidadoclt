import Phaser from "phaser";
import { ParticleFactory } from "./ParticleFactory";
import { CombatFx } from "./CombatFx";

// ─────────────────────────────────────────────────────────────────────────────
// CATÁLOGO DE VFX — inventário único e nomeado de TODOS os efeitos canônicos do
// jogo (partículas + juice de câmera/sprite). Serve dois propósitos:
//
//  1. Fonte-de-verdade legível do que o jogo TEM de efeito (evita reinventar um
//     burst ad-hoc quando já existe um canônico → paleta/timing consistentes).
//  2. Alimenta o LAB VFX (VfxLabScene, DEV): cada entrada vira um botão que roda
//     o efeito num ponto fixo → dá pra ver/afinar todos num lugar só, como o LAB
//     SPRITES faz pros sprites.
//
// Efeitos que precisam de um SPRITE-alvo (flash/squash/shake de câmera) recebem
// um sprite dummy montado pelo LAB. Efeitos de PONTO (partículas) usam (x,y).
// ─────────────────────────────────────────────────────────────────────────────

export type VfxKind = "point" | "sprite" | "camera";

export interface VfxEntry {
  id: string;
  label: string;
  kind: VfxKind;
  /** Ponto (partículas): recebe cena + posição. */
  point?: (scene: Phaser.Scene, x: number, y: number) => void;
  /** Sprite-alvo (flash/squash): recebe a cena + o sprite. */
  sprite?: (scene: Phaser.Scene, target: Phaser.GameObjects.Sprite) => void;
}

export const VFX_CATALOG: VfxEntry[] = [
  {
    id: "hitLight",
    label: "Hit leve",
    kind: "point",
    point: (s, x, y) => ParticleFactory.hitLight(s, x, y),
  },
  {
    id: "hitHeavy",
    label: "Hit pesado (tinta)",
    kind: "point",
    point: (s, x, y) => ParticleFactory.hitHeavy(s, x, y),
  },
  {
    id: "enemyDeath",
    label: "Morte (papel+café)",
    kind: "point",
    point: (s, x, y) => ParticleFactory.enemyDeath(s, x, y),
  },
  {
    id: "landDust",
    label: "Poeira de pouso",
    kind: "point",
    point: (s, x, y) => ParticleFactory.landDust(s, x, y),
  },
  {
    id: "pickupSparkle",
    label: "Pickup (dourado)",
    kind: "point",
    point: (s, x, y) => ParticleFactory.pickupSparkle(s, x, y),
  },
  {
    id: "ringPulse",
    label: "Aro de AoE",
    kind: "point",
    point: (s, x, y) => ParticleFactory.ringPulse(s, x, y),
  },
  {
    id: "flash",
    label: "Flash (dano)",
    kind: "sprite",
    sprite: (s, t) => CombatFx.flashSprite(t, 0xff5544),
  },
  {
    id: "hitSquash",
    label: "Squash (tomar hit)",
    kind: "sprite",
    sprite: (_s, t) => CombatFx.hitSquash(t),
  },
  {
    id: "landSquash",
    label: "Squash (pouso)",
    kind: "sprite",
    sprite: (_s, t) => CombatFx.landSquash(t),
  },
  {
    id: "jumpStretch",
    label: "Stretch (pulo)",
    kind: "sprite",
    sprite: (_s, t) => CombatFx.jumpStretch(t),
  },
];
