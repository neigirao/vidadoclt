import Phaser from "phaser";
import { PreloadScene } from "./scenes/PreloadScene";
import { BootScene } from "./scenes/BootScene";
import { MenuScene } from "./scenes/MenuScene";
import { ClassSelectScene } from "./scenes/ClassSelectScene";
import { OpenSpaceV2Scene } from "./scenes/OpenSpaceV2Scene";
import { CopaScene } from "./scenes/CopaScene";
import { GameOverScene } from "./scenes/GameOverScene";
import { Phase2Scene } from "./scenes/Phase2Scene";
import { Phase3Scene } from "./scenes/Phase3Scene";
import { Phase4Scene } from "./scenes/Phase4Scene";
import { Phase5Scene } from "./scenes/Phase5Scene";
import { CeoScene } from "./scenes/CeoScene";
import { VitoriaScene } from "./scenes/VitoriaScene";
import { RankingScene } from "./scenes/RankingScene";
import { PauseScene } from "./scenes/PauseScene";
import { CulturaSelectScene } from "./scenes/CulturaSelectScene";
import { BestiaryScene } from "./scenes/BestiaryScene";
import { ReconhecimentoScene } from "./scenes/ReconhecimentoScene";
import { GAME_WIDTH, GAME_HEIGHT } from "./constants";

export { GAME_WIDTH, GAME_HEIGHT, COLORS } from "./constants";

const _debugMode = new URLSearchParams(
  typeof location !== "undefined" ? location.search : ""
).has("debug");

export function buildGameConfig(parent: HTMLElement): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: "#2a2d33",
    pixelArt: true,
    render: {
      roundPixels: true,
      antialias: false,
    },
    input: {
      gamepad: true,
      keyboard: true,
    },
    audio: {
      disableWebAudio: false,
    },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    physics: {
      default: "arcade",
      arcade: {
        gravity: { x: 0, y: 1200 },
        debug: _debugMode,
        debugBodyColor: 0x00ff00,
        debugVelocityColor: 0xffff00,
      },
    },
    scene: [
      PreloadScene, BootScene, MenuScene, ClassSelectScene,
      OpenSpaceV2Scene, CopaScene,
      Phase2Scene, Phase3Scene, Phase4Scene, Phase5Scene,
      CeoScene, VitoriaScene,
      GameOverScene, RankingScene, PauseScene, CulturaSelectScene, BestiaryScene,
      ReconhecimentoScene,
    ],
  };
}
