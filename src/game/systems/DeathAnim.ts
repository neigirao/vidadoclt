import Phaser from "phaser";

// ─────────────────────────────────────────────────────────────────────────────
// Animação de MORTE dos inimigos — faz a arte de `death` REFLETIR no jogo.
//
// Antes o inimigo morto só dava um "squish + fade" (scaleY 0.5, alpha 0) e os
// frames `enemy-<x>-deathN` (recortados da folha-fonte) nunca apareciam. Aqui,
// ao morrer, tocamos death0→deathN (parado → caindo → no chão) e só então
// somem. Se o inimigo não tem frames de death no atlas, cai no squish antigo.
// ─────────────────────────────────────────────────────────────────────────────

const DEATH_FRAME_MS = 110; // por frame da sequência de morte
const ATLAS = "sprites";

/** Deriva o prefixo (`enemy-estagiario`) a partir do frame atual do sprite. */
function prefixOf(sprite: Phaser.GameObjects.Sprite): string | null {
  const name = sprite.frame?.name ?? "";
  const m = /^(.+)-(?:idle|walk|run|attack|hurt|death)\d+$/.exec(name);
  return m ? m[1] : null;
}

/** Conta frames contíguos `<prefix>-death0..N` presentes no atlas. */
function deathFrameCount(scene: Phaser.Scene, prefix: string): number {
  const tex = scene.textures.get(ATLAS);
  if (!tex) return 0;
  let n = 0;
  while (tex.has(`${prefix}-death${n}`)) n++;
  return n;
}

/**
 * Toca a animação de morte e destrói o sprite ao fim. O corpo de física já deve
 * estar desativado pelo chamador (o inimigo já está `setActive(false)`), então
 * não causa mais dano nem colide durante a queda.
 */
export function playEnemyDeath(scene: Phaser.Scene, sprite: Phaser.Physics.Arcade.Sprite): void {
  const prefix = prefixOf(sprite);
  const n = prefix ? deathFrameCount(scene, prefix) : 0;

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
  for (let i = 0; i < n; i++) {
    scene.time.delayedCall(i * DEATH_FRAME_MS, () => {
      if (sprite.active === false && sprite.scene) sprite.setFrame(`${prefix}-death${i}`);
    });
  }
  const holdUntil = n * DEATH_FRAME_MS + 260; // segura o "no chão" um tico
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
