import Phaser from "phaser";
import { applyEliteStats, type EliteAffix, type EliteTarget } from "./EliteAffixes";

// ─────────────────────────────────────────────────────────────────────────────
// SISTEMA DE ELITES (visual) — inimigos "premiados" (staple de roguelite:
// Hades/Dead Cells). A lógica pura (afixos/roll/stats) vive em EliteAffixes.ts;
// aqui fica a parte com Phaser: aplica o afixo + cria aura pulsante e badge que
// seguem o inimigo. Zero arte nova; adiciona variedade e risco/recompensa.
//
// Decisão: NÃO usar tint no sprite (brigaria com o flash de hurt e os telegraphs).
// A leitura de "elite" vem de uma AURA colorida atrás + badge emoji acima — como
// o BossPresence faz p/ o chefão, em escala menor.
// ─────────────────────────────────────────────────────────────────────────────

export { ELITE_AFFIXES, eliteChance, rollElite } from "./EliteAffixes";
export type { EliteAffix } from "./EliteAffixes";

type EnemySprite = Phaser.GameObjects.Sprite &
  EliteTarget & { setData: (k: string, v: unknown) => void };

/**
 * Gerencia os elites de uma cena: aplica afixo + cria aura/badge e os mantém
 * grudados no inimigo. Instanciar 1× no create; `update()` no update da cena.
 */
export class EliteSystem {
  private pairs: {
    enemy: EnemySprite;
    aura: Phaser.GameObjects.Ellipse;
    badge: Phaser.GameObjects.Text;
  }[] = [];

  constructor(private scene: Phaser.Scene) {}

  get count(): number {
    return this.pairs.length;
  }

  /** Promove um inimigo a elite: aplica stats, aura, badge e marca p/ recompensa. */
  makeElite(enemy: EnemySprite, affix: EliteAffix): void {
    applyEliteStats(enemy, affix);
    enemy.setScale((enemy.scaleX || 1) * affix.scaleMult, (enemy.scaleY || 1) * affix.scaleMult);
    enemy.setData("elite", affix.id);
    enemy.setData("eliteVrBonus", affix.vrBonus); // MeleeCombat lê no kill
    if (affix.explodeDmg) enemy.setData("eliteExplode", affix.explodeDmg); // AoE na morte
    if (affix.shieldHits) enemy.setData("eliteShieldHits", affix.shieldHits); // barreira

    // Aura pulsante ATRÁS do inimigo (depth abaixo do sprite).
    const aura = this.scene.add
      .ellipse(
        enemy.x,
        enemy.y,
        enemy.displayWidth * 1.5,
        enemy.displayHeight * 1.2,
        affix.color,
        0.28,
      )
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth((enemy.depth ?? 0) - 1);
    this.scene.tweens.add({
      targets: aura,
      scaleX: 1.18,
      scaleY: 1.18,
      alpha: 0.14,
      duration: 620,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    // Badge emoji acima.
    const badge = this.scene.add
      .text(enemy.x, enemy.y, affix.badge, { fontFamily: "monospace", fontSize: "14px" })
      .setOrigin(0.5)
      .setDepth(60);

    this.pairs.push({ enemy, aura, badge });
  }

  /** Reposiciona aura/badge sobre os inimigos + limpa os mortos. Chamar no update. */
  update(): void {
    if (!this.pairs.length) return;
    this.pairs = this.pairs.filter((p) => {
      if (!p.enemy.active) {
        p.aura.destroy();
        p.badge.destroy();
        return false;
      }
      p.aura.setPosition(p.enemy.x, p.enemy.y);
      p.badge.setPosition(p.enemy.x, p.enemy.y - p.enemy.displayHeight / 2 - 10);
      return true;
    });
  }

  destroy(): void {
    for (const p of this.pairs) {
      p.aura.destroy();
      p.badge.destroy();
    }
    this.pairs = [];
  }
}
