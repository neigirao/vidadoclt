import Phaser from "phaser";
import { GAME_WIDTH } from "../constants";

/** Cover-scaled, slightly desaturated parallax background between HUD bands. */
export function addPhaseBackground(
  scene: Phaser.Scene, key: string, topY: number, bottomY: number,
) {
  const midY = (topY + bottomY) / 2;
  const targetH = bottomY - topY;
  const bg = scene.add.image(GAME_WIDTH / 2, midY, key)
    .setScrollFactor(0.25, 0)
    .setAlpha(0.85)
    .setTint(0xb8c0cc)
    .setDepth(0);
  // Wider than the screen so the 0.25 scrollFactor parallax never exposes
  // the edges: camera scrolls up to 960px → bg shifts up to 240px, so the
  // image needs ≥ GAME_WIDTH + 240 width; 1.6 × 960 = 1536 covers it.
  const scaleX = (GAME_WIDTH * 1.6) / (bg.width || GAME_WIDTH);
  const scaleY = targetH / (bg.height || targetH);
  bg.setScale(Math.max(scaleX, scaleY));
  // dark gradient strip at the bottom so floor/characters pop
  scene.add.rectangle(GAME_WIDTH / 2, bottomY - 30, GAME_WIDTH, 60, 0x000000, 0.25)
    .setScrollFactor(0).setDepth(0);
  return bg;
}
