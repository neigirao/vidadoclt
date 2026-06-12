import Phaser from "phaser";
import { BootScene } from "./scenes/BootScene";
import { MenuScene } from "./scenes/MenuScene";
import { ClassSelectScene } from "./scenes/ClassSelectScene";
import { OpenSpaceScene } from "./scenes/OpenSpaceScene";
import { CopaScene } from "./scenes/CopaScene";
import { GameOverScene } from "./scenes/GameOverScene";
import { Phase2Scene } from "./scenes/Phase2Scene";
import { Phase3Scene } from "./scenes/Phase3Scene";
import { Phase4Scene } from "./scenes/Phase4Scene";
import { Phase5Scene } from "./scenes/Phase5Scene";
import { CeoScene } from "./scenes/CeoScene";
import { VitoriaScene } from "./scenes/VitoriaScene";
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
    scene: [
      BootScene, MenuScene, ClassSelectScene,
      OpenSpaceScene, CopaScene,
      Phase2Scene, Phase3Scene, Phase4Scene, Phase5Scene,
      CeoScene, VitoriaScene,
      GameOverScene,
    ],
  };
}
