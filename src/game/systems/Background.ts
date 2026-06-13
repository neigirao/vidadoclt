import Phaser from "phaser";

// Full level width — the background spans the entire scrollable level.
const LEVEL_WIDTH = 1920;

/**
 * Displays a full-width phase background image.
 *
 * The image is placed at the horizontal centre of the level (LEVEL_WIDTH/2)
 * and vertically centred between topY and bottomY. displaySize is set to fill
 * the full LEVEL_WIDTH × available height so the image always covers the
 * playfield regardless of the source image resolution.
 *
 * A subtle parallax (scrollFactor 0.2) adds depth without needing an
 * oversized texture — at scrollFactor 0.2 the image drifts only 384 px as
 * the camera travels the full 1920 px level, well within the displayed width.
 */
export function addPhaseBackground(
  scene: Phaser.Scene,
  key: string,
  topY: number,
  bottomY: number,
): void {
  const midY = (topY + bottomY) / 2;
  const availableH = bottomY - topY;
  scene.add
    .image(LEVEL_WIDTH / 2, midY, key)
    .setDisplaySize(LEVEL_WIDTH, availableH)
    .setScrollFactor(0.2, 0)
    .setDepth(0);
}
