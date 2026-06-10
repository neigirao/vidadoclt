import Phaser from "phaser";
import { BootScene } from "./scenes/BootScene";
import { OpenSpaceScene } from "./scenes/OpenSpaceScene";
import { GameOverScene } from "./scenes/GameOverScene";

export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 540;

export const COLORS = {
  bg: 0x2a2d33,
  bgDark: 0x1c1e22,
  floor: 0x3a3f47,
  platform: 0x4a5260,
  baia: 0x5a6270,
  player: 0xeaeaea,
  playerAccent: 0x3b6fb6,
  estagiario: 0xc94f4f,
  analista: 0x8a5a3c,
  vr: 0xf2c14e,
  energyBar: 0xd14545,
  sanityBar: 0x3b8fd1,
  hudBg: 0x000000,
  hitFlash: 0xffffff,
};

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
    scene: [BootScene, OpenSpaceScene, GameOverScene],
  };
}
