import Phaser from "phaser";
import { resolveSprite } from "./SpriteLibrary";
import { GAME_WIDTH } from "../constants";
import { loadSettings } from "./Settings";

// Full level width — the background spans the entire scrollable level.
const LEVEL_WIDTH = 1920;

// ─────────────────────────────────────────────────────────────────────────────
// Parallax multi-camada — comunica PROFUNDIDADE (o escritório tem planos).
//
// O fundo de fase (addPhaseBackground) é uma imagem opaca a scrollFactor 0.2
// (plano do MEIO). Aqui adicionamos:
//   • NEAR-BACK  (sf 0.6, depth 5): silhuetas de baias distantes ENTRE o bg e o
//     gameplay — separa o palco do papel de parede, "assenta" os personagens.
//   • FOREGROUND (sf 1.12–1.2, depth 900): vigas/luminárias no topo e silhuetas
//     de baia nas BORDAS inferiores — passam mais rápido que a ação (cue de
//     profundidade forte) SEM cobrir a faixa central de combate.
//
// Legibilidade: o foreground fica só no topo (teto) e nos cantos, em quase-preto
// e translúcido. Acessibilidade: o plano de frente respeita `reduceSanityFx`
// (quem marca "reduzir efeitos" não recebe o plano que se move rápido).
// ─────────────────────────────────────────────────────────────────────────────
type ParallaxCfg = {
  silh: number;
  lamp: number;
  beam: number;
  glow: number;
  build: number; // silhueta dos prédios distantes
  win: number; // janelas acesas dos prédios
  buildH: number; // altura máx. dos prédios — MENOR = andar mais alto (mais céu)
};
// `buildH` decresce da Fase 1→5: quanto mais alto o andar, mais céu e prédios
// menores/distantes lá fora — o jogador "sente" que subiu o prédio.
const PARALLAX: Record<number, ParallaxCfg> = {
  1: { silh: 0x161b26, lamp: 0xd0e4f8, beam: 0x10151e, glow: 0x88a0c8, build: 0x2a3550, win: 0x9fd0ff, buildH: 64 }, // prettier-ignore
  2: { silh: 0x1a1510, lamp: 0xf0e0c8, beam: 0x140f0a, glow: 0x9a8878, build: 0x3a2f24, win: 0xffcf8a, buildH: 55 }, // prettier-ignore
  3: { silh: 0x181c18, lamp: 0xffe0f0, beam: 0x101410, glow: 0xff88bb, build: 0x352838, win: 0xffb0e0, buildH: 47 }, // prettier-ignore
  4: { silh: 0x101820, lamp: 0x9becff, beam: 0x0a1016, glow: 0x66ddff, build: 0x18303c, win: 0x7fffea, buildH: 39 }, // prettier-ignore
  5: { silh: 0x1c160e, lamp: 0xffe8b0, beam: 0x140f08, glow: 0xe8cf95, build: 0x2e2740, win: 0xffd890, buildH: 30 }, // prettier-ignore
};

export function addParallaxLayers(
  scene: Phaser.Scene,
  phase: 1 | 2 | 3 | 4 | 5,
  topY: number,
  floorY: number,
  levelWidth = LEVEL_WIDTH,
): void {
  const cfg = PARALLAX[phase];
  if (!cfg) return;
  const rng = new Phaser.Math.RandomDataGenerator([`parallax-${phase}`]);
  const band = floorY - topY;
  const midBand = topY + band * 0.42; // linha dos "ombros" das baias

  // ── FAR: skyline distante lá fora (sf 0.12, depth 3) ────────────────────────
  // Prédios em silhueta com janelas acesas, na altura da janela do escritório.
  // Perspectiva atmosférica: alpha baixo + tinta de haze → "recua" no fundo.
  const horizonY = topY + band * 0.36;
  const sky = scene.add.graphics().setScrollFactor(0.12, 0).setDepth(3).setAlpha(0.55);
  // linha de haze do horizonte
  sky.fillStyle(cfg.glow, 0.1);
  sky.fillRect(0, horizonY - 1, levelWidth, 2);
  for (let x = -30; x < levelWidth + 60; x += rng.between(46, 84)) {
    const w = rng.between(30, 58);
    const h = rng.between(Math.round(cfg.buildH * 0.5), cfg.buildH);
    sky.fillStyle(cfg.build, 1);
    sky.fillRect(x, horizonY - h, w, h);
    // janelas acesas (grade esparsa)
    sky.fillStyle(cfg.win, 0.5);
    for (let wy = horizonY - h + 4; wy < horizonY - 3; wy += 7)
      for (let wx = x + 3; wx < x + w - 3; wx += 7)
        if (rng.frac() < 0.45) sky.fillRect(wx, wy, 3, 4);
  }

  // ── NEAR-BACK: baias distantes entre bg e gameplay (sf 0.6, depth 5) ────────
  const back = scene.add.graphics().setScrollFactor(0.6, 0).setDepth(5).setAlpha(0.55);
  for (let x = -40; x < levelWidth + 80; x += rng.between(110, 168)) {
    const w = rng.between(70, 120);
    const h = rng.between(28, 50);
    back.fillStyle(cfg.silh, 1);
    back.fillRect(x, midBand - h, w, h); // topo da baia
    back.fillRect(x + w * 0.5 - 3, midBand - h - rng.between(8, 18), 6, 18); // monitor/haste
    back.fillStyle(cfg.glow, 0.12); // brilho fraco de tela (assenta o plano)
    back.fillRect(x + 8, midBand - h + 6, w - 16, 6);
  }

  // ── FOREGROUND (sf ≥ 1.12): só topo/cantos — respeita reduceSanityFx ────────
  const reduce = loadSettings().reduceSanityFx;
  if (reduce) return; // acessibilidade: sem o plano que se move rápido

  const ceilY = topY + 2;
  const fgTop = scene.add.graphics().setScrollFactor(1.12, 0).setDepth(900);
  fgTop.fillStyle(cfg.beam, 0.92);
  fgTop.fillRect(0, ceilY, levelWidth, 10); // viga contínua do teto (mais grossa)
  for (let x = rng.between(120, 200); x < levelWidth; x += rng.between(280, 420)) {
    // haste + luminária pendente (silhueta) com glow reforçado
    const stalk = rng.between(16, 30);
    fgTop.fillStyle(cfg.beam, 0.96);
    fgTop.fillRect(x - 1, ceilY + 10, 3, stalk);
    const ly = ceilY + 10 + stalk;
    fgTop.fillRect(x - 14, ly, 30, 7); // corpo da luminária (maior)
    const g = scene.add
      .ellipse(x + 1, ly + 10, 60, 20, cfg.lamp, 0.1)
      .setScrollFactor(1.12, 0)
      .setDepth(899)
      .setBlendMode(Phaser.BlendModes.ADD);
    void g;
  }

  // ── FOREGROUND: silhuetas de baia nos CANTOS inferiores (sf 1.2) ────────────
  // Só nas bordas esquerda/direita — o centro (faixa de combate) fica livre.
  const fgEdge = scene.add.graphics().setScrollFactor(1.2, 0).setDepth(901).setAlpha(0.94);
  const drawCubicle = (cx: number) => {
    const w = 128;
    const topH = floorY - rng.between(76, 104);
    fgEdge.fillStyle(cfg.silh, 1);
    fgEdge.fillRect(cx - w / 2, topH, w, floorY - topH); // corpo da baia
    fgEdge.fillStyle(cfg.beam, 1);
    fgEdge.fillRect(cx - w / 2 + 16, topH + 10, 44, 28); // monitor escuro
    fgEdge.fillStyle(cfg.glow, 0.14);
    fgEdge.fillRect(cx - w / 2 + 18, topH + 12, 40, 6); // brilho da tela
  };
  drawCubicle(64);
  drawCubicle(levelWidth - 64);

  // ── FOREGROUND: planta pendente do teto num canto (silhueta, sf 1.2) ────────
  const plantX = rng.between(0, 1) ? 150 : levelWidth - 150;
  fgEdge.fillStyle(cfg.beam, 0.95);
  for (let i = 0; i < 7; i++) {
    const fx = plantX + rng.between(-16, 16);
    fgEdge.fillRect(fx, ceilY + 8, 2, rng.between(16, 34)); // folhas caídas
  }
  fgEdge.fillRect(plantX - 12, ceilY + 6, 24, 8); // vaso suspenso
}

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
