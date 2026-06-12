import Phaser from "phaser";

/**
 * Pixel-art office background helper.
 *
 * The generated `pxbg-*` textures are 1280×400, authored to sit back visually.
 * We use a mild parallax (scrollFactor 0.25) which shifts the image ≤240px
 * as the camera travels its 960px range — the 1280px width covers it exactly.
 *
 * worldX = 640 ensures the texture is flush with the left viewport edge at
 * camera position 0, and still covers at camera position 960:
 *   left edge @ cx=0:   640 - 640 - 0*0.25   = 0   ✓
 *   left edge @ cx=960: 640 - 640 - 960*0.25  = -240  (off-screen left) ✓
 *   right edge @ cx=960: 640 + 640 - 240 = 1040 > 960  ✓
 */
export function addPhaseBackground(
  scene: Phaser.Scene,
  key: string,
  topY: number,
  bottomY: number,
): void {
  const midY = (topY + bottomY) / 2;
  scene.add.image(640, midY, key)
    .setScrollFactor(0.25, 0)
    .setDepth(0);
}
