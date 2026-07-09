import Phaser from "phaser";
import { resolveSprite } from "./SpriteLibrary";
import { GAME_WIDTH } from "../constants";

// Full level width — the background spans the entire scrollable level.
const LEVEL_WIDTH = 1920;

/**
 * Vida ambiente da cena (o cenário "respira"). Puramente visual, depth baixo,
 * não interfere no gameplay. Duas camadas:
 *  1. Poeira no ar — motes que flutuam de leve (camera-space, sempre visíveis).
 *  2. Luzes fluorescentes falhando — glows que piscam de vez em quando
 *     (world-space no scrollFactor do fundo, evoca escritório decadente).
 * Chamar após addPhaseBackground/addPhaseDecor.
 */
export function addPhaseAmbience(
  scene: Phaser.Scene,
  topY: number,
  floorY: number,
  levelWidth = LEVEL_WIDTH,
): void {
  // ── 1. Poeira flutuante (camera-space) ──────────────────────────────────
  const bandTop = topY + 6;
  const bandH = floorY - topY - 12;
  for (let i = 0; i < 26; i++) {
    const x = Phaser.Math.Between(0, GAME_WIDTH);
    const y = Phaser.Math.Between(bandTop, bandTop + bandH);
    const r = Phaser.Math.FloatBetween(0.6, 1.8);
    const mote = scene.add
      .circle(x, y, r, 0xffffff, Phaser.Math.FloatBetween(0.04, 0.12))
      .setScrollFactor(0)
      .setDepth(2);
    // deriva vertical suave + balanço horizontal, tempos aleatórios (yoyo)
    scene.tweens.add({
      targets: mote,
      y: y + Phaser.Math.Between(-22, 22),
      duration: Phaser.Math.Between(3200, 6400),
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
      delay: Phaser.Math.Between(0, 2000),
    });
    scene.tweens.add({
      targets: mote,
      x: x + Phaser.Math.Between(-14, 14),
      duration: Phaser.Math.Between(4000, 7000),
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
    scene.tweens.add({
      targets: mote,
      alpha: 0,
      duration: Phaser.Math.Between(1800, 3600),
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
      delay: Phaser.Math.Between(0, 2500),
    });
  }

  // ── 2. Luzes fluorescentes falhando (world-space, tracking o fundo) ─────
  for (let lx = 300; lx < levelWidth; lx += Phaser.Math.Between(360, 520)) {
    const glow = scene.add
      .ellipse(lx, topY + 24, 120, 40, 0xfff4d0, 0.06)
      .setScrollFactor(0.2, 0)
      .setDepth(1)
      .setBlendMode(Phaser.BlendModes.ADD);
    const scheduleFlicker = () => {
      scene.time.delayedCall(Phaser.Math.Between(2600, 8000), () => {
        if (!glow.active) return;
        // rajada curta de piscadas (lâmpada morrendo)
        const blinks = Phaser.Math.Between(2, 5);
        let n = 0;
        const blink = () => {
          if (!glow.active) return;
          glow.setAlpha(n % 2 === 0 ? 0.01 : 0.06);
          if (++n < blinks * 2) scene.time.delayedCall(Phaser.Math.Between(40, 110), blink);
          else {
            glow.setAlpha(0.06);
            scheduleFlicker();
          }
        };
        blink();
      });
    };
    scheduleFlicker();
  }
}

// Props por fase — CURADO. A extração do tileset trouxe muitas chaves que são
// "folhas de contato" (tiras com vários itens + texto de label) ou personagens
// mal catalogados como props; renderizadas como decor de chão viravam faixas
// borradas/texto flutuante. Aqui ficam só OBJETOS ÚNICOS limpos (móveis).
// Fases sem prop limpo próprio (ex.: Fase 3) reusam móveis genéricos de
// escritório — props de escritório são intercambiáveis entre andares.
const PHASE_PROP_KEYS: Record<number, string[]> = {
  1: ["tile-fase1-03", "tile-fase1-04"], // lixeira, arquivo
  2: ["tile-fase2-02", "tile-fase2-05", "tile-fase1-03"], // servidor, torre, lixeira
  3: ["tile-fase1-04", "tile-fase5-03", "tile-fase2-05"], // arquivo, vaso, torre
  4: ["tile-fase4-04", "tile-fase1-04", "tile-fase5-03"], // caneca, arquivo, vaso
  5: ["tile-fase5-03", "tile-fase2-05", "tile-fase1-04"], // vaso, torre, arquivo
};

/**
 * Places decorative props from the phase tileset along the floor level.
 * Purely visual (depth=1, no physics body). Call after addPhaseBackground.
 */
export function addPhaseDecor(scene: Phaser.Scene, phase: 1 | 2 | 3 | 4 | 5, floorY: number): void {
  const keys = PHASE_PROP_KEYS[phase] ?? [];
  if (!keys.length) return;

  const spacing = Math.floor(LEVEL_WIDTH / (keys.length * 2 + 1));
  keys.forEach((key, i) => {
    const x = spacing + i * spacing * 2;
    const [tex, frame] = resolveSprite(`tex-${key}`);
    scene.add.image(x, floorY, tex, frame).setOrigin(0.5, 1).setDepth(1).setAlpha(0.7);
  });
}

// Partículas ambientes TEMÁTICAS por fase — camada leve camera-space que
// complementa a poeira branca genérica com cor + movimento próprios da fase.
type PhaseFx = {
  color: number;
  count: number;
  dir: "fall" | "rise" | "drift"; // sentido dominante da deriva
  size: [number, number];
  alpha: [number, number];
  square?: boolean; // partícula quadrada (papel/confete) vs. redonda (faísca)
};
const PHASE_FX: Record<number, PhaseFx> = {
  // Call center: papéis/roteiros à deriva no ar.
  2: {
    color: 0xe8e0c8,
    count: 14,
    dir: "drift",
    size: [1.4, 2.6],
    alpha: [0.06, 0.16],
    square: true,
  },
  // RH/Endomarketing: confete de "campanha motivacional" caindo devagar.
  3: { color: 0xff88bb, count: 18, dir: "fall", size: [1.5, 3], alpha: [0.1, 0.24], square: true },
  // TI: faíscas elétricas subindo (equipamento estressado).
  4: { color: 0x66ddff, count: 16, dir: "rise", size: [0.8, 1.8], alpha: [0.12, 0.3] },
  // Diretoria: poeira dourada de luxo pairando.
  5: { color: 0xe8cf95, count: 14, dir: "drift", size: [1, 2.2], alpha: [0.08, 0.2] },
};

/**
 * Adiciona a camada de partículas temáticas da fase (camera-space, depth 2).
 * Cor e sentido de movimento variam por fase. Puramente decorativo.
 */
export function addPhaseParticles(
  scene: Phaser.Scene,
  phase: 1 | 2 | 3 | 4 | 5,
  topY: number,
  floorY: number,
): void {
  const fx = PHASE_FX[phase];
  if (!fx) return;
  const bandTop = topY + 6;
  const bandH = floorY - topY - 12;
  for (let i = 0; i < fx.count; i++) {
    const x = Phaser.Math.Between(0, GAME_WIDTH);
    const y = Phaser.Math.Between(bandTop, bandTop + bandH);
    const s = Phaser.Math.FloatBetween(fx.size[0], fx.size[1]);
    const a = Phaser.Math.FloatBetween(fx.alpha[0], fx.alpha[1]);
    const p = fx.square
      ? scene.add.rectangle(x, y, s * 2, s * 2, fx.color, a)
      : scene.add.circle(x, y, s, fx.color, a);
    p.setScrollFactor(0).setDepth(2);
    if (fx.dir !== "drift") p.setBlendMode(Phaser.BlendModes.ADD);
    // deriva vertical dominante (queda/subida) OU vai-e-vem (drift)
    const vy = fx.dir === "fall" ? bandH + 20 : fx.dir === "rise" ? -(bandH + 20) : 0;
    if (vy !== 0) {
      const travel = () => {
        p.y = fx.dir === "fall" ? bandTop - 10 : bandTop + bandH + 10;
        p.x = Phaser.Math.Between(0, GAME_WIDTH);
        scene.tweens.add({
          targets: p,
          y: p.y + vy,
          x: p.x + Phaser.Math.Between(-30, 30),
          duration: Phaser.Math.Between(4200, 8000),
          ease: "Sine.easeInOut",
          onComplete: travel,
        });
      };
      scene.time.delayedCall(Phaser.Math.Between(0, 4000), travel);
    } else {
      scene.tweens.add({
        targets: p,
        y: y + Phaser.Math.Between(-24, 24),
        x: x + Phaser.Math.Between(-18, 18),
        duration: Phaser.Math.Between(3600, 7000),
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
        delay: Phaser.Math.Between(0, 2500),
      });
    }
    // cintila
    scene.tweens.add({
      targets: p,
      alpha: 0,
      duration: Phaser.Math.Between(1800, 3600),
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
      delay: Phaser.Math.Between(0, 2500),
    });
  }
}

// Prop de chão TEMÁTICO por fase (desenhado no TextureFactory). Reforça a
// identidade visual junto com a superfície de plataforma. Puramente decorativo.
const PHASE_THEMED_DECOR: Record<number, { key: string; xs: number[] }> = {
  2: { key: "tex-decor-headset", xs: [520, 1080, 1500] },
  3: { key: "tex-decor-standee", xs: [420, 900, 1360] },
  4: { key: "tex-decor-cabos", xs: [560, 980, 1440] },
  5: { key: "tex-decor-trofeu", xs: [440, 940, 1420] },
};

/**
 * Espalha o prop de chão temático da fase ao longo do piso (depth 1, atrás do
 * gameplay). Complementa addPhaseDecor com a arte procedural própria da fase.
 */
export function addThemedFloorDecor(
  scene: Phaser.Scene,
  phase: 1 | 2 | 3 | 4 | 5,
  floorY: number,
): void {
  const def = PHASE_THEMED_DECOR[phase];
  if (!def || !scene.textures.exists(def.key)) return;
  def.xs.forEach((x) => {
    scene.add.image(x, floorY, def.key).setOrigin(0.5, 1).setDepth(1).setAlpha(0.85);
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
