import Phaser from "phaser";
import { PreloadScene } from "./scenes/PreloadScene";
import { BootScene } from "./scenes/BootScene";
import { MenuScene } from "./scenes/MenuScene";
import { ClassSelectScene } from "./scenes/ClassSelectScene";
import { SpriteLabScene } from "./scenes/SpriteLabScene";
import { VfxLabScene } from "./scenes/VfxLabScene";
import { IntroScene } from "./scenes/IntroScene";
import { LdtkRoomScene } from "./scenes/LdtkRoomScene";
import { OpenSpaceV2Scene } from "./scenes/OpenSpaceV2Scene";
import { CopaScene } from "./scenes/CopaScene";
import { SalaReuniaoScene } from "./scenes/SalaReuniaoScene";
import { SalaBonusScene } from "./scenes/SalaBonusScene";
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
import { RouteSelectScene } from "./scenes/RouteSelectScene";
import { BestiaryScene } from "./scenes/BestiaryScene";
import { ReconhecimentoScene } from "./scenes/ReconhecimentoScene";
import { HoraExtraScene } from "./scenes/HoraExtraScene";
import { GAME_WIDTH, GAME_HEIGHT } from "./constants";

export { GAME_WIDTH, GAME_HEIGHT, COLORS } from "./constants";

const _debugMode = new URLSearchParams(typeof location !== "undefined" ? location.search : "").has(
  "debug",
);

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
    // Trava o loop em 60fps independente da taxa de atualização do monitor.
    // Sem isto, em telas de 120/144Hz o jogo rodava acelerado até o navegador
    // re-sincronizar (ex: ao trocar de aba) — daí "começa rápido e normaliza".
    // forceSetTimeOut usa setTimeout(~16.6ms) em vez de requestAnimationFrame.
    fps: {
      target: 60,
      forceSetTimeOut: true,
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
        fps: 60,
        fixedStep: true,
        debug: _debugMode,
        debugBodyColor: 0x00ff00,
        debugVelocityColor: 0xffff00,
      },
    },
    scene: [
      PreloadScene,
      BootScene,
      MenuScene,
      ClassSelectScene,
      IntroScene,
      LdtkRoomScene,
      OpenSpaceV2Scene,
      CopaScene,
      SalaReuniaoScene,
      SalaBonusScene,
      Phase2Scene,
      Phase3Scene,
      Phase4Scene,
      Phase5Scene,
      CeoScene,
      VitoriaScene,
      GameOverScene,
      RankingScene,
      PauseScene,
      CulturaSelectScene,
      RouteSelectScene,
      BestiaryScene,
      ReconhecimentoScene,
      HoraExtraScene,
      // SpriteLabScene é ferramenta DEV: só entra no bundle do `bun dev` (e do
      // smoke/audit, que rodam contra o dev server). No build PUBLICADO
      // `import.meta.env.DEV` é false → a cena sai do array e o Rollup dropa o
      // import por tree-shaking (menor bundle, sem ferramenta de teste no jogo).
      ...(import.meta.env.DEV ? [SpriteLabScene, VfxLabScene] : []),
    ],
  };
}
