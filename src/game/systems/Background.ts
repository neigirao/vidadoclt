import Phaser from "phaser";
import { resolveSprite } from "./SpriteLibrary";

// Full level width — the background spans the entire scrollable level.
const LEVEL_WIDTH = 1920;

// Props per phase — keys match atlas frame names from the tileset extraction
const PHASE_PROP_KEYS: Record<number, string[]> = {
  1: ["prop-fase1-00", "prop-fase1-02", "tile-fase1-03", "tile-fase1-04"],
  2: ["prop-fase2-00", "prop-fase2-03", "prop-fase2-04", "tile-fase2-02", "tile-fase2-05"],
  3: ["prop-fase3-00", "prop-fase3-02", "tile-fase3-04"],
  4: ["prop-fase4-00", "prop-fase4-02", "prop-fase4-03", "tile-fase4-04", "tile-fase4-07"],
  5: ["prop-fase5-00", "prop-fase5-02", "tile-fase5-01", "tile-fase5-03", "tile-fase5-06"],
};

/**
 * Places decorative props from the phase tileset along the floor level.
 * Purely visual (depth=1, no physics body). Call after addPhaseBackground.
 */
export function addPhaseDecor(
  scene: Phaser.Scene,
  phase: 1 | 2 | 3 | 4 | 5,
  floorY: number,
): void {
  const keys = PHASE_PROP_KEYS[phase] ?? [];
  if (!keys.length) return;

  const spacing = Math.floor(LEVEL_WIDTH / (keys.length * 2 + 1));
  keys.forEach((key, i) => {
    const x = spacing + i * spacing * 2;
    const [tex, frame] = resolveSprite(`tex-${key}`);
    scene.add.image(x, floorY, tex, frame)
      .setOrigin(0.5, 1)
      .setDepth(1)
      .setAlpha(0.7);
  });
}

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
