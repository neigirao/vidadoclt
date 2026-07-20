import Phaser from "phaser";
import { atlasFrames } from "./AtlasFrames";

// ─────────────────────────────────────────────────────────────────────────────
// Animação de MORTE dos inimigos — faz a arte de `death` REFLETIR no jogo.
//
// Antes o inimigo morto só dava um "squish + fade" (scaleY 0.5, alpha 0) e os
// frames `enemy-<x>-deathN` (recortados da folha-fonte) nunca apareciam. Aqui,
// ao morrer, tocamos death0→deathN (parado → caindo → no chão) e só então
// somem. Se o inimigo não tem frames de death no atlas, cai no squish antigo.
// ─────────────────────────────────────────────────────────────────────────────

// Duração-alvo da sequência de morte (ms). Dividida pelo nº de frames → com death
// dobrado p/ 16 (in-betweens) o passo encolhe p/ manter a morte SNAPPY (~720ms)
// em vez de arrastar 1,8s (16×110). Piso de 34ms/frame p/ deaths curtas.
const DEATH_TARGET_MS = 720;
const DEATH_MIN_FRAME_MS = 34;
const ATLAS = "sprites";

/** Deriva o prefixo (`enemy-estagiario`) a partir do frame atual do sprite. */
function prefixOf(sprite: Phaser.GameObjects.Sprite): string | null {
  const name = sprite.frame?.name ?? "";
  const m = /^(.+)-(?:idle|walk|run|attack|hurt|death)\d+$/.exec(name);
  return m ? m[1] : null;
}

/** Índices de death presentes no atlas (gap-aware, fonte única em AtlasFrames). */
function deathFrames(scene: Phaser.Scene, prefix: string): number[] {
  return atlasFrames(scene.textures.get(ATLAS), prefix, "death");
}

/**
 * Toca a animação de morte e destrói o sprite ao fim. O corpo de física já deve
 * estar desativado pelo chamador (o inimigo já está `setActive(false)`), então
 * não causa mais dano nem colide durante a queda.
 */
export function playEnemyDeath(scene: Phaser.Scene, sprite: Phaser.Physics.Arcade.Sprite): void {
  const prefix = prefixOf(sprite);
  const frames = prefix ? deathFrames(scene, prefix) : [];
  const n = frames.length;

  // Sem frames de death → mantém o squish+fade histórico.
  if (!prefix || n === 0) {
    scene.tweens.add({
      targets: sprite,
      y: sprite.y - 18,
      scaleY: 0.5,
      alpha: 0,
      duration: 200,
      ease: "Quad.easeOut",
      onComplete: () => sprite.destroy(),
    });
    return;
  }

  // Sequência de death frames (cada um DEATH_FRAME_MS), segurando o último, e
  // depois fade + destroy. delayedCall é seguro contra shutdown da cena.
  const body = sprite.body as Phaser.Physics.Arcade.Body | null;
  if (body) body.setVelocity(0, 0);
  const stepMs = Math.max(DEATH_MIN_FRAME_MS, Math.round(DEATH_TARGET_MS / n));
  for (let i = 0; i < n; i++) {
    const idx = frames[i]; // gap-aware: usa o índice presente, não a posição
    scene.time.delayedCall(i * stepMs, () => {
      if (sprite.active === false && sprite.scene) sprite.setFrame(`${prefix}-death${idx}`);
    });
  }
  const holdUntil = n * stepMs + 260; // segura o "no chão" um tico
  scene.time.delayedCall(holdUntil, () => {
    if (!sprite.scene) return;
    scene.tweens.add({
      targets: sprite,
      alpha: 0,
      duration: 240,
      ease: "Quad.easeIn",
      onComplete: () => sprite.destroy(),
    });
  });
}
