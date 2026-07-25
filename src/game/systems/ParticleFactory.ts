import Phaser from "phaser";

// ─────────────────────────────────────────────────────────────────────────────
// PALETA DE VFX — fonte única das cores dos efeitos corporativos. Antes cada
// método tinha o seu array inline (fácil divergir: um "azul de papel" diferente
// por efeito). Centralizado aqui e consumido abaixo + pelo catálogo (Vfx.ts).
// ─────────────────────────────────────────────────────────────────────────────
export const VFX_PALETTE = {
  spark: 0xffffff, // faísca de hit leve
  ink: [0x4a90d9, 0xd0e4f8, 0x2a5a9a, 0xffffff, 0x1a3a6a], // hit pesado (tinta/papel)
  death: [0xffffff, 0x4a90d9, 0xd0e4f8, 0xaaaaaa, 0x2a3a5a], // morte (papel + café)
  gold: 0xffd766, // pickup (VR/dourado)
  dust: 0xc9c2b3, // poeira de pouso
  // ─── Especiais de classe ────────────────────────────────────────────────────
  // Estagiário: verde-neon (crachá/energia jovem) + amarelo post-it.
  estagiarioSpecial: [0x88ffcc, 0x3affb0, 0xffee66, 0xffffff],
  // Analista: azul planilha + números caindo (excel/relatório).
  analistaSpecial: [0x3a7ad9, 0x88b8ff, 0xd0e4f8, 0xffffff],
  // Terceirizado: âmbar/café + vermelho-boleto (motor bruto).
  terceirizadoSpecial: [0xffcc44, 0xff8844, 0xd94a2a, 0x6b3a2a],
} as const;


export class ParticleFactory {
  static hitLight(scene: Phaser.Scene, x: number, y: number) {
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const speed = 48 + Math.floor(Math.random() * 3) * 16; // multiples of 16 for pixel grid
      const g = scene.add.graphics().setDepth(50);
      g.fillStyle(VFX_PALETTE.spark, 1);
      g.fillRect(-2, -2, 4, 4);
      g.setPosition(Math.round(x), Math.round(y));
      scene.tweens.add({
        targets: g,
        x: Math.round(x + Math.cos(angle) * speed),
        y: Math.round(y + Math.sin(angle) * speed),
        alpha: 0,
        scaleX: 0.25,
        scaleY: 0.25,
        duration: 176, // multiple of 16ms
        ease: "Quad.easeOut",
        onUpdate: () => {
          g.setPosition(Math.round(g.x), Math.round(g.y));
        },
        onComplete: () => g.destroy(),
      });
    }
  }

  // Corporate-themed heavy hit: paper/ink blue palette
  static hitHeavy(scene: Phaser.Scene, x: number, y: number) {
    const corpColors = VFX_PALETTE.ink;
    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
      const speed = 64 + Math.floor(Math.random() * 4) * 16; // 64,80,96,112
      const color = corpColors[Math.floor(Math.random() * corpColors.length)];
      const g = scene.add.graphics().setDepth(50);
      g.fillStyle(color, 1);
      const size = 2 + Math.floor(Math.random() * 3);
      g.fillRect(-size / 2, -size / 2, size, size);
      g.setPosition(Math.round(x), Math.round(y));
      scene.tweens.add({
        targets: g,
        x: Math.round(x + Math.cos(angle) * speed),
        y: Math.round(y + Math.sin(angle) * speed - 16),
        alpha: 0,
        duration: 320,
        ease: "Quad.easeOut",
        onUpdate: () => {
          g.setPosition(Math.round(g.x), Math.round(g.y));
        },
        onComplete: () => g.destroy(),
      });
    }
  }

  // Poeira do pouso — leve, cinza, dispara nos dois lados do sprite.
  static landDust(scene: Phaser.Scene, x: number, y: number) {
    for (let i = 0; i < 6; i++) {
      const side = i < 3 ? -1 : 1;
      const g = scene.add.graphics().setDepth(9);
      g.fillStyle(VFX_PALETTE.dust, 0.75);
      const s = 2 + Math.floor(Math.random() * 2);
      g.fillRect(-s / 2, -s / 2, s, s);
      g.setPosition(Math.round(x + side * (2 + Math.random() * 4)), Math.round(y));
      scene.tweens.add({
        targets: g,
        x: Math.round(g.x + side * (10 + Math.random() * 14)),
        y: Math.round(g.y - 2 - Math.random() * 6),
        alpha: 0,
        duration: 260,
        ease: "Quad.easeOut",
        onComplete: () => g.destroy(),
      });
    }
  }

  // Faísca de pickup — brilho dourado radial, curto, sem gravidade.
  static pickupSparkle(
    scene: Phaser.Scene,
    x: number,
    y: number,
    color: number = VFX_PALETTE.gold,
  ) {
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2;
      const speed = 30 + Math.floor(Math.random() * 4) * 8;
      const g = scene.add.graphics().setDepth(60);
      g.fillStyle(color, 1);
      g.fillRect(-1.5, -1.5, 3, 3);
      g.setPosition(Math.round(x), Math.round(y));
      scene.tweens.add({
        targets: g,
        x: Math.round(x + Math.cos(angle) * speed),
        y: Math.round(y + Math.sin(angle) * speed),
        alpha: 0,
        scaleX: 0.3,
        scaleY: 0.3,
        duration: 260,
        ease: "Quad.easeOut",
        onComplete: () => g.destroy(),
      });
    }
    // Aro rápido no centro reforça o "peguei"
    const ring = scene.add.graphics().setDepth(60);
    ring.lineStyle(2, color, 0.9);
    ring.strokeCircle(0, 0, 6);
    ring.setPosition(Math.round(x), Math.round(y));
    scene.tweens.add({
      targets: ring,
      scaleX: 2.2,
      scaleY: 2.2,
      alpha: 0,
      duration: 240,
      ease: "Cubic.easeOut",
      onComplete: () => ring.destroy(),
    });
  }

  // Corporate-themed death: paper shreds + coffee spill
  static enemyDeath(scene: Phaser.Scene, x: number, y: number) {
    const corpColors = VFX_PALETTE.death;
    for (let i = 0; i < 22; i++) {
      const angle = (i / 22) * Math.PI * 2 + Math.random() * 0.3;
      const speed = 48 + Math.floor(Math.random() * 5) * 16; // 48,64,80,96,112
      const color = corpColors[Math.floor(Math.random() * corpColors.length)];
      const g = scene.add.graphics().setDepth(50);
      g.fillStyle(color, 1);
      const size = 1 + Math.floor(Math.random() * 4);
      g.fillRect(-size / 2, -size / 2, size, size);
      const jx = Math.round(x + (Math.random() - 0.5) * 16);
      const jy = Math.round(y + (Math.random() - 0.5) * 12);
      g.setPosition(jx, jy);
      scene.tweens.add({
        targets: g,
        x: Math.round(jx + Math.cos(angle) * speed),
        y: Math.round(jy + Math.sin(angle) * speed),
        alpha: 0,
        scaleX: 0.25,
        scaleY: 0.25,
        duration: 384 + Math.floor(Math.random() * 14) * 16, // 384-608, multiples of 16
        ease: "Quad.easeOut",
        onUpdate: () => {
          g.setPosition(Math.round(g.x), Math.round(g.y));
        },
        onComplete: () => g.destroy(),
      });
    }
  }

  // Aro que expande e desbota — telegrafia de AoE / impacto / choque. Padrão
  // reusado ad-hoc em várias cenas (extintor, enrage, parry, choques). Canônico
  // aqui p/ 1 timing/estilo só.
  static ringPulse(
    scene: Phaser.Scene,
    x: number,
    y: number,
    radius = 40,
    color = VFX_PALETTE.gold,
    duration = 320,
  ) {
    const ring = scene.add.graphics().setDepth(55);
    ring.lineStyle(2, color, 0.9);
    ring.strokeCircle(0, 0, radius);
    ring.setPosition(Math.round(x), Math.round(y)).setScale(0.2);
    scene.tweens.add({
      targets: ring,
      scaleX: 1,
      scaleY: 1,
      alpha: 0,
      duration,
      ease: "Cubic.easeOut",
      onComplete: () => ring.destroy(),
    });
  }

  // ─── FX de especiais de classe ────────────────────────────────────────────
  // Cada método é chamado no ponto de origem do especial (x,y = player). O
  // desenho reforça a IDENTIDADE da classe (post-its para estagiário, planilha
  // para analista, motor+boleto para terceirizado) — o mecânico já roda em
  // BasePhaseScene.handleSpecial; isto é só a assinatura visual.

  /** Leque de post-its verdes voando na direção do facing (Estagiário). */
  static estagiarioBurst(scene: Phaser.Scene, x: number, y: number, facing: 1 | -1 = 1) {
    const palette = VFX_PALETTE.estagiarioSpecial;
    // 12 papéis quadrados voando num leque com dispersão vertical.
    for (let i = 0; i < 12; i++) {
      const spread = -0.35 + (i / 11) * 0.7;
      const speed = 140 + Math.floor(Math.random() * 4) * 20;
      const color = palette[Math.floor(Math.random() * palette.length)];
      const g = scene.add.graphics().setDepth(55);
      g.fillStyle(color, 1);
      g.fillRect(-3, -3, 6, 6);
      g.setPosition(Math.round(x + facing * 12), Math.round(y - 4));
      const dx = facing * Math.cos(spread) * speed;
      const dy = Math.sin(spread) * speed;
      scene.tweens.add({
        targets: g,
        x: Math.round(g.x + dx),
        y: Math.round(g.y + dy),
        angle: 180 + Math.random() * 360,
        alpha: 0,
        duration: 420,
        ease: "Quad.easeOut",
        onComplete: () => g.destroy(),
      });
    }
    // Flash verde neon curto no ponto de emissão.
    const flash = scene.add.circle(x + facing * 16, y - 4, 8, 0x88ffcc, 0.85);
    flash.setDepth(56);
    scene.tweens.add({
      targets: flash,
      scaleX: 4,
      scaleY: 2.2,
      alpha: 0,
      duration: 240,
      onComplete: () => flash.destroy(),
    });
  }

  /** AoE frontal de planilha azul com números caindo (Analista). */
  static analistaSlam(scene: Phaser.Scene, x: number, y: number, facing: 1 | -1 = 1) {
    const palette = VFX_PALETTE.analistaSpecial;
    // Grid retangular pulsando (planilha).
    const grid = scene.add.rectangle(x + facing * 55, y - 4, 110, 60, 0x3a7ad9, 0.22);
    grid.setStrokeStyle(2, 0x88b8ff, 0.9);
    grid.setDepth(45);
    scene.tweens.add({
      targets: grid,
      scaleX: 1.15,
      scaleY: 1.1,
      alpha: 0,
      duration: 380,
      ease: "Cubic.easeOut",
      onComplete: () => grid.destroy(),
    });
    // Linhas internas da planilha (2 horizontais, 3 verticais).
    for (let i = 1; i < 3; i++) {
      const ln = scene.add.rectangle(x + facing * 55, y - 4 - 20 + i * 20, 108, 1, 0x88b8ff, 0.7);
      ln.setDepth(46);
      scene.tweens.add({ targets: ln, alpha: 0, duration: 380, onComplete: () => ln.destroy() });
    }
    // Números caindo dentro da AoE (14 células).
    for (let i = 0; i < 14; i++) {
      const col = palette[Math.floor(Math.random() * palette.length)];
      const g = scene.add.graphics().setDepth(50);
      g.fillStyle(col, 1);
      g.fillRect(-1.5, -3, 3, 6); // barra vertical curta = dígito estilizado
      const px = x + facing * (10 + Math.random() * 100);
      const py = y - 26 + Math.random() * 8;
      g.setPosition(Math.round(px), Math.round(py));
      scene.tweens.add({
        targets: g,
        y: Math.round(py + 40 + Math.random() * 20),
        alpha: 0,
        duration: 420,
        ease: "Quad.easeIn",
        onComplete: () => g.destroy(),
      });
    }
  }

  /** Redemoinho quente 360° com boletos e faíscas de café (Terceirizado). */
  static terceirizadoSweep(scene: Phaser.Scene, x: number, y: number, radius = 92) {
    const palette = VFX_PALETTE.terceirizadoSpecial;
    // Aro âmbar principal.
    const ring = scene.add.graphics().setDepth(55);
    ring.lineStyle(3, 0xffcc44, 0.9);
    ring.strokeCircle(0, 0, 12);
    ring.setPosition(Math.round(x), Math.round(y));
    scene.tweens.add({
      targets: ring,
      scaleX: radius / 12,
      scaleY: radius / 12,
      alpha: 0,
      duration: 360,
      ease: "Cubic.easeOut",
      onComplete: () => ring.destroy(),
    });
    // Aro secundário vermelho-boleto (defasado).
    scene.time.delayedCall(80, () => {
      const r2 = scene.add.graphics().setDepth(55);
      r2.lineStyle(2, 0xd94a2a, 0.7);
      r2.strokeCircle(0, 0, 10);
      r2.setPosition(Math.round(x), Math.round(y));
      scene.tweens.add({
        targets: r2,
        scaleX: (radius * 0.9) / 10,
        scaleY: (radius * 0.9) / 10,
        alpha: 0,
        duration: 300,
        ease: "Cubic.easeOut",
        onComplete: () => r2.destroy(),
      });
    });
    // 16 "boletos" voando radialmente.
    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * Math.PI * 2 + Math.random() * 0.2;
      const speed = radius * 0.9 + Math.random() * 20;
      const col = palette[Math.floor(Math.random() * palette.length)];
      const g = scene.add.graphics().setDepth(55);
      g.fillStyle(col, 1);
      g.fillRect(-3, -2, 6, 4);
      g.setPosition(Math.round(x), Math.round(y));
      scene.tweens.add({
        targets: g,
        x: Math.round(x + Math.cos(angle) * speed),
        y: Math.round(y + Math.sin(angle) * speed),
        angle: Math.random() * 720,
        alpha: 0,
        duration: 380,
        ease: "Quad.easeOut",
        onComplete: () => g.destroy(),
      });
    }
  }
}

