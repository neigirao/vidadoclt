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
  sky: number; // cor do "vidro" (céu) quando a fase tem janela desenhada
};
// Janela DESENHADA (vidro+céu+skyline+caixilho) só nas fases de bg fraco/baixa-res
// (3 RH, 4 TI) — melhora onde a arte é pobre. Fase 5 (bg já é céu) recebe só o
// CAIXILHO por cima. Fases 1/2 (bg pintado rico) ficam intocadas, com o skyline
// distante sutil atrás. Assim o parallax respeita a arte boa e reforça a fraca.
const WINDOW_GLASS = new Set([3, 4]);
const WINDOW_FRAME_ONLY = new Set([5]);
// `buildH` decresce da Fase 1→5: quanto mais alto o andar, mais céu e prédios
// menores/distantes lá fora — o jogador "sente" que subiu o prédio.
const PARALLAX: Record<number, ParallaxCfg> = {
  1: { silh: 0x161b26, lamp: 0xd0e4f8, beam: 0x10151e, glow: 0x88a0c8, build: 0x2a3550, win: 0x9fd0ff, buildH: 64, sky: 0x2c3e5a }, // prettier-ignore
  2: { silh: 0x1a1510, lamp: 0xf0e0c8, beam: 0x140f0a, glow: 0x9a8878, build: 0x3a2f24, win: 0xffcf8a, buildH: 55, sky: 0x40342a }, // prettier-ignore
  3: { silh: 0x181c18, lamp: 0xffe0f0, beam: 0x101410, glow: 0xff88bb, build: 0x352838, win: 0xffb0e0, buildH: 47, sky: 0x412a3e }, // prettier-ignore
  4: { silh: 0x101820, lamp: 0x9becff, beam: 0x0a1016, glow: 0x66ddff, build: 0x18303c, win: 0x7fffea, buildH: 39, sky: 0x0e2130 }, // prettier-ignore
  5: { silh: 0x1c160e, lamp: 0xffe8b0, beam: 0x140f08, glow: 0xe8cf95, build: 0x2e2740, win: 0xffd890, buildH: 30, sky: 0x2a2038 }, // prettier-ignore
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

  // ── FAR: skyline distante (prédios + janelas acesas na linha do horizonte) ──
  const horizonY = topY + band * 0.36;
  const drawSkyline = (g: Phaser.GameObjects.Graphics) => {
    g.fillStyle(cfg.glow, 0.1);
    g.fillRect(0, horizonY - 1, levelWidth, 2); // haze do horizonte
    for (let x = -30; x < levelWidth + 60; x += rng.between(46, 84)) {
      const w = rng.between(30, 58);
      const h = rng.between(Math.round(cfg.buildH * 0.5), cfg.buildH);
      g.fillStyle(cfg.build, 1);
      g.fillRect(x, horizonY - h, w, h);
      g.fillStyle(cfg.win, 0.85);
      for (let wy = horizonY - h + 4; wy < horizonY - 3; wy += 7)
        for (let wx = x + 3; wx < x + w - 3; wx += 7)
          if (rng.frac() < 0.45) g.fillRect(wx, wy, 3, 4);
    }
  };
  // Caixilho de janela (montantes + travessas + peitoril) — sf 0.2 p/ casar com
  // o plano do bg; dá a leitura de "olhando pela janela".
  const drawFrame = (winTop: number, winBot: number) => {
    const fr = scene.add.graphics().setScrollFactor(0.2, 0).setDepth(4);
    fr.fillStyle(cfg.beam, 1);
    fr.fillRect(0, winTop - 5, levelWidth, 6); // travessa superior
    fr.fillRect(0, winBot, levelWidth, 7); // peitoril
    fr.fillRect(0, (winTop + winBot) / 2 - 2, levelWidth, 4); // travessa do meio
    for (let x = 0; x <= levelWidth; x += 210)
      fr.fillRect(x - 3, winTop - 5, 6, winBot - winTop + 12); // montantes
  };

  if (WINDOW_GLASS.has(phase)) {
    // Janela DESENHADA (bg fraco/baixa-res): vidro (céu) cobre o topo + skyline
    // + caixilho. Tudo em sf 0.2 (plano do bg) — vira uma janela limpa e coesa.
    // ANTES o céu era chapado (fill sólido + faixa escura) → destoava dos fundos
    // PINTADOS das Fases 1/2. Agora: GRADIENTE de céu (topo escuro → horizonte com
    // brilho da fase) + faixa de glow no horizonte + uma camada de prédios DISTANTE
    // e desbotada atrás da principal. Dá profundidade "pintada" sem arte nova.
    const shade = (c: number, f: number) => {
      const r = Math.min(255, Math.round(((c >> 16) & 0xff) * f));
      const g2 = Math.min(255, Math.round(((c >> 8) & 0xff) * f));
      const bl = Math.min(255, Math.round((c & 0xff) * f));
      return (r << 16) | (g2 << 8) | bl;
    };
    const winTop = topY + 6;
    const winBot = topY + band * 0.44;
    const glass = scene.add.graphics().setScrollFactor(0.2, 0).setDepth(2);
    const skyTop = shade(cfg.sky, 0.5); // topo mais escuro
    const skyHorizon = shade(cfg.sky, 1.22); // horizonte mais claro
    glass.fillGradientStyle(skyTop, skyTop, skyHorizon, skyHorizon, 1);
    glass.fillRect(0, winTop, levelWidth, winBot - winTop);
    // Brilho do horizonte (cor da fase) — "hora dourada"/neon suave.
    const glowBand = (winBot - winTop) * 0.32;
    glass.fillStyle(cfg.glow, 0.18);
    glass.fillRect(0, winBot - glowBand, levelWidth, glowBand);
    // Camada de prédios DISTANTE (parallax mais lento + desbotada) → profundidade.
    const far = scene.add.graphics().setScrollFactor(0.13, 0).setDepth(2).setAlpha(0.45);
    drawSkyline(far);
    drawSkyline(glass);
    drawFrame(winTop, winBot);
  } else if (WINDOW_FRAME_ONLY.has(phase)) {
    // Fase 5: o bg JÁ é um pôr do sol/skyline — só reforça com skyline sutil
    // atrás + o caixilho por cima (janela de canto executiva).
    const sky = scene.add.graphics().setScrollFactor(0.12, 0).setDepth(3).setAlpha(0.5);
    drawSkyline(sky);
    drawFrame(topY + 6, topY + band * 0.44);
  }
  // Fases 1/2 (bg pintado rico com janela própria): NADA de skyline/janela — a
  // arte já fala por si; só o teto (foreground) entra, sem competir com o fundo.

  // ── FOREGROUND: só a VIGA do teto — sf 1.12, depth 900 ─────────────────────
  // As luminárias/hastes pendentes (versão anterior) desciam do teto em sf 1.12
  // e, por passarem NA FRENTE (depth 900), cruzavam o campo de jogo como "postes"
  // sobre o player — reportado em playtest. Mantido só a viga fina COLADA no
  // topo (nunca invade o gameplay) + um leve glow de luminária embutido nela,
  // sem nada pendurado. Respeita reduceSanityFx (acessibilidade).
  const reduce = loadSettings().reduceSanityFx;
  if (reduce) return;

  const ceilY = topY + 2;
  const fgTop = scene.add.graphics().setScrollFactor(1.12, 0).setDepth(900);
  fgTop.fillStyle(cfg.beam, 0.92);
  fgTop.fillRect(0, ceilY, levelWidth, 10); // viga contínua do teto (só o topo)
  // Halos de luminária EMBUTIDOS na viga (sem haste descendo) — profundidade
  // sem nenhum elemento vertical cruzando a ação.
  for (let x = rng.between(120, 200); x < levelWidth; x += rng.between(280, 420)) {
    scene.add
      .ellipse(x + 1, ceilY + 12, 54, 14, cfg.lamp, 0.09)
      .setScrollFactor(1.12, 0)
      .setDepth(899)
      .setBlendMode(Phaser.BlendModes.ADD);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Parallax DENSO da Fase 1 (Open Space) — 6 planos com scrollFactors distintos
// para dar profundidade REAL de escritório: parede distante → baias → estações
// → divisórias próximas → plantas → coluna de frente nas bordas.
//
// Alphas baixos e canto central do gameplay (120..GAME_WIDTH-120) intocado no
// plano de frente — nada cruza a linha de tiro. Respeita reduceSanityFx.
// Palette casa com bg-openspace (tons frios azul-acinzentado). Chame DEPOIS
// de addPhaseBackground/addParallaxLayers.
// ─────────────────────────────────────────────────────────────────────────────
export function addDenseOpenSpaceParallax(
  scene: Phaser.Scene,
  topY: number,
  floorY: number,
  levelWidth = LEVEL_WIDTH,
): void {
  const reduce = loadSettings().reduceSanityFx;
  const rng = new Phaser.Math.RandomDataGenerator(["dense-openspace"]);
  const band = floorY - topY;

  // ── Plano 1 (sf 0.08) — parede distante com listras horizontais sutis ─────
  const wall = scene.add.graphics().setScrollFactor(0.08, 0).setDepth(0.5);
  wall.fillStyle(0x1b2432, 0.35);
  for (let y = topY + 40; y < floorY - 80; y += 34) {
    wall.fillRect(0, y, levelWidth, 1); // linhas de piso do fundo
  }
  // Manchas de luz difusa vindas das janelas laterais
  for (let i = 0; i < 4; i++) {
    const gx = (levelWidth / 4) * i + rng.between(60, 180);
    scene.add
      .ellipse(gx, topY + band * 0.35, 260, 90, 0x9fd0ff, 0.05)
      .setScrollFactor(0.08, 0)
      .setDepth(0.5)
      .setBlendMode(Phaser.BlendModes.ADD);
  }

  // ── Plano 2 (sf 0.18) — baias MUITO distantes (silhueta borrada) ──────────
  const far = scene.add.graphics().setScrollFactor(0.18, 0).setDepth(0.6);
  for (let x = -20; x < levelWidth + 40; x += rng.between(72, 96)) {
    const h = rng.between(28, 40);
    far.fillStyle(0x141a25, 0.55);
    far.fillRect(x, floorY - 90 - h, 60, h);
    // luzinha de monitor
    far.fillStyle(0x6c8ec4, 0.28);
    far.fillRect(x + 22, floorY - 90 - h + 8, 12, 8);
  }

  // ── Plano 3 (sf 0.32) — fileira de estações intermediárias ────────────────
  const mid1 = scene.add.graphics().setScrollFactor(0.32, 0).setDepth(0.8);
  for (let x = 30; x < levelWidth; x += 130) {
    mid1.fillStyle(0x121924, 0.7);
    mid1.fillRect(x, floorY - 72, 92, 72); // divisória média
    mid1.fillStyle(0x1a2432, 0.7);
    mid1.fillRect(x + 6, floorY - 66, 80, 8); // topo
    mid1.fillStyle(0x0d131c, 0.75);
    mid1.fillRect(x + 34, floorY - 58, 26, 18); // monitor
    mid1.fillStyle(0x88a0c8, 0.22);
    mid1.fillRect(x + 36, floorY - 56, 22, 14); // brilho do monitor
  }

  // ── Plano 4 (sf 0.65) — plantas de escritório perto do chão ───────────────
  // Silhueta baixa, entre a linha do gameplay e as divisórias — não cobre nada
  // acima da altura do player.
  const plants = scene.add.graphics().setScrollFactor(0.65, 0).setDepth(1.2);
  for (let x = 90; x < levelWidth; x += rng.between(210, 320)) {
    // vaso
    plants.fillStyle(0x2a1e14, 0.55);
    plants.fillRect(x - 8, floorY - 18, 16, 18);
    // folhagem
    plants.fillStyle(0x1a3826, 0.55);
    plants.fillCircle(x, floorY - 26, 10);
    plants.fillCircle(x - 6, floorY - 32, 8);
    plants.fillCircle(x + 6, floorY - 30, 7);
  }

  // ── Plano 5 (sf 1.35) — coluna de frente nas BORDAS (nunca no centro) ─────
  // Sensação de "passando por corredor" — se move mais rápido que o gameplay.
  // Só nas 90px de cada margem para não ocluir combate.
  if (!reduce) {
    const fg = scene.add.graphics().setScrollFactor(1.35, 0).setDepth(950);
    // faixa esquerda
    fg.fillStyle(0x0a0e14, 0.35);
    fg.fillRect(0, topY + 20, 30, floorY - topY - 30);
    // faixa direita
    fg.fillRect(GAME_WIDTH - 30, topY + 20, 30, floorY - topY - 30);
    // brilho sutil no canto (reforça vinheta natural)
    scene.add
      .rectangle(0, (topY + floorY) / 2, 60, floorY - topY, 0x000000, 0.18)
      .setOrigin(0, 0.5)
      .setScrollFactor(1.35, 0)
      .setDepth(949);
    scene.add
      .rectangle(GAME_WIDTH, (topY + floorY) / 2, 60, floorY - topY, 0x000000, 0.18)
      .setOrigin(1, 0.5)
      .setScrollFactor(1.35, 0)
      .setDepth(949);
  }

  // ── Plano 6 (sf 1.6) — motes de poeira NA FRENTE (foreground dust) ────────
  // Camera-space rápido: passa "voando" pelo player, reforçando velocidade.
  if (!reduce) {
    for (let i = 0; i < 10; i++) {
      const x = Phaser.Math.Between(0, GAME_WIDTH);
      const y = Phaser.Math.Between(topY + 40, floorY - 40);
      const mote = scene.add
        .circle(x, y, Phaser.Math.FloatBetween(0.8, 1.6), 0xffffff, 0.14)
        .setScrollFactor(0)
        .setDepth(948)
        .setBlendMode(Phaser.BlendModes.ADD);
      scene.tweens.add({
        targets: mote,
        x: x - Phaser.Math.Between(80, 160), // "vento" pra esquerda
        duration: Phaser.Math.Between(2400, 4200),
        repeat: -1,
        onRepeat: () => {
          mote.x = GAME_WIDTH + Phaser.Math.Between(0, 60);
          mote.y = Phaser.Math.Between(topY + 40, floorY - 40);
        },
      });
      scene.tweens.add({
        targets: mote,
        alpha: 0,
        duration: Phaser.Math.Between(1400, 2400),
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    }
  }
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

  const reduce = loadSettings().reduceSanityFx;
  const spacing = Math.floor(LEVEL_WIDTH / (keys.length * 2 + 1));
  keys.forEach((key, i) => {
    const x = spacing + i * spacing * 2;
    const [tex, frame] = resolveSprite(`tex-${key}`);
    const prop = scene.add.image(x, floorY, tex, frame).setOrigin(0.5, 1).setDepth(1).setAlpha(0.7);
    // Vida ambiente: um balanço/respiração idle sutil (ancorado nos pés, então a
    // base fica no chão). Fase de cada prop dessincroniza o conjunto. Desligado
    // por reduceSanityFx (acessibilidade / fotossensibilidade / motion sickness).
    if (reduce) return;
    const phase0 = (i * 777) % 1000;
    scene.tweens.add({
      targets: prop,
      scaleY: { from: 1, to: 1.018 }, // "respira" (topo sobe ~1.8%, pés fixos)
      angle: { from: -0.6, to: 0.6 }, // balanço quase imperceptível
      duration: 2200 + (i % 3) * 260,
      delay: phase0,
      yoyo: true,
      repeat: -1,
      ease: "Sine.InOut",
    });
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
  const bg = scene.add
    .image(LEVEL_WIDTH / 2, midY, key)
    .setDisplaySize(LEVEL_WIDTH, availableH)
    .setScrollFactor(0.2, 0)
    .setDepth(0);
  // Vida ambiente no fundo: um "respiro" de luz muito lento (brilho pulsando ±6%)
  // + micro-zoom (±0,8%) — dá movimento orgânico sem gerar frames full-res por IA
  // (que seriam pesados/propensos a flicker). Desligado por reduceSanityFx.
  if (loadSettings().reduceSanityFx) return;
  const baseW = LEVEL_WIDTH,
    baseH = availableH;
  scene.tweens.add({
    targets: bg,
    duration: 7000,
    yoyo: true,
    repeat: -1,
    ease: "Sine.InOut",
    displayWidth: { from: baseW, to: baseW * 1.008 },
    displayHeight: { from: baseH, to: baseH * 1.008 },
  });
  // Pulso de brilho independente (período diferente → nunca "bate" com o zoom,
  // evitando padrão perceptível). tint branco→levemente mais claro via alpha de um
  // overlay seria custoso; aqui variamos o próprio tint entre branco e um cinza
  // quente muito sutil, o que o Phaser interpola como leve escurecer/clarear.
  const glow = { v: 0 };
  scene.tweens.add({
    targets: glow,
    v: 1,
    duration: 5200,
    yoyo: true,
    repeat: -1,
    ease: "Sine.InOut",
    onUpdate: () => {
      const c = 230 + Math.round(glow.v * 25); // 230..255 (respiro de luz sutil)
      bg.setTint(Phaser.Display.Color.GetColor(c, c, c));
    },
  });
}
