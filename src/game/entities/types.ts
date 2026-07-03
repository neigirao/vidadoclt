import Phaser from "phaser";

/**
 * Superfícies estruturais comuns de inimigos e bosses, para o código genérico
 * de cena (loops sobre grupos, specials em área, scaling de loop) não precisar
 * de `as any`. Os campos são opcionais porque nem todo membro de grupo tem
 * todos (ex.: projéteis num grupo de inimigos não têm hit()).
 */
export type GameEnemy = Phaser.Physics.Arcade.Sprite & {
  hp?: number;
  maxHp?: number;
  contactDamage?: number;
  hit?: (damage: number, knockback: number) => boolean;
  applyFreeze?: (ms: number) => void;
  applySlowdown?: (ms: number) => void;
};

/** Contrato mínimo de um boss de fase (BasePhaseScene.boss / CeoScene.boss). */
export type BossEntity = Phaser.Physics.Arcade.Sprite & {
  hp: number;
  maxHp?: number;
  contactDamage: number;
  hit: (damage: number, knockback: number) => boolean;
  onHpChange?: (hp: number, maxHp: number) => void;
  applyFreeze?: (ms: number) => void;
  applySlowdown?: (ms: number) => void;
};
