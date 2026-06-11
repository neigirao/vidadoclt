import Phaser from "phaser";
import { BootScene } from "./scenes/BootScene";
import { MenuScene } from "./scenes/MenuScene";
import { ClassSelectScene } from "./scenes/ClassSelectScene";
import { OpenSpaceScene } from "./scenes/OpenSpaceScene";
import { CopaScene } from "./scenes/CopaScene";
import { GameOverScene } from "./scenes/GameOverScene";
import { GAME_WIDTH, GAME_HEIGHT } from "./constants";

export { GAME_WIDTH, GAME_HEIGHT, COLORS } from "./constants";

export function buildGameConfig(parent: HTMLElement): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: "#2a2d33",
    pixelArt: true,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    physics: {
      default: "arcade",
      arcade: {
        gravity: { x: 0, y: 1200 },
        debug: false,
      },
    },
    scene: [BootScene, MenuScene, ClassSelectScene, OpenSpaceScene, CopaScene, GameOverScene],
  };
}
