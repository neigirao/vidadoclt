import Phaser from "phaser";

import { GAME_HEIGHT } from "../constants";
import { Fonts } from "../systems/Fonts";
import { parseLdtk, type LdtkLevel } from "../systems/LdtkLoader";
import { Player } from "../entities/Player";

// ─────────────────────────────────────────────────────────────────────────────
// POC do pipeline LDtk (https://ldtk.io): uma sala DESENHADA à mão no formato
// LDtk (public/assets/levels/ldtk-poc.json) que o CÓDIGO monta em runtime —
// chão + plataformas dos tiles do IntGrid, spawns da camada Entities. Aplicado
// numa parte SEM FUNDO PINTADO próprio: aqui os TILES do LDtk são o visual (uma
// sala de arquivo morto), sem conflitar com a arte pintada das outras fases.
//
// Cena enxuta de propósito (não estende BasePhaseScene): o objetivo é provar o
// pipeline "arquivo desenhado → fase jogável", não reimplementar combate/boss.
// Alcançável via TESTAR FASE (dev). Um export real do editor LDtk substitui o
// .json sem tocar neste código.
// ─────────────────────────────────────────────────────────────────────────────
export class LdtkRoomScene extends Phaser.Scene {
  private player!: Player;
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private level!: LdtkLevel;
  private exitZone?: Phaser.GameObjects.Zone;
  private interactKey!: Phaser.Input.Keyboard.Key;

  constructor() {
    super("LdtkRoomScene");
  }

  preload() {
    this.load.json("ldtk-poc", "/assets/levels/ldtk-poc.json");
  }

  create() {
    const raw = this.cache.json.get("ldtk-poc");
    this.level = parseLdtk(raw);
    const W = this.level.widthPx;
    const grid = this.level.gridSize;

    this.physics.world.setBounds(0, 0, W, GAME_HEIGHT);
    this.cameras.main.setBounds(0, 0, W, GAME_HEIGHT);
    this.cameras.main.setBackgroundColor(0x14100c);

    // Fundo NEUTRO (sem arte pintada) — só um degradê discreto p/ não ficar chapado.
    const bg = this.add.graphics().setScrollFactor(0.2, 0).setDepth(0);
    for (let i = 0; i < 24; i++) {
      const t = i / 23;
      const c = Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.ValueToColor(0x1c1710),
        Phaser.Display.Color.ValueToColor(0x0d0a07),
        100,
        Math.round(t * 100),
      );
      bg.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b), 1);
      bg.fillRect(0, (GAME_HEIGHT * i) / 24, W, GAME_HEIGHT / 24 + 1);
    }

    // TILES do LDtk desenhados como "caixas de arquivo morto" (o visual da sala).
    const tileG = this.add.graphics().setDepth(4);
    for (const { cx, cy } of this.level.solids) {
      const x = cx * grid,
        y = cy * grid;
      tileG.fillStyle(0x5a4326, 1);
      tileG.fillRect(x, y, grid, grid); // corpo da caixa
      tileG.fillStyle(0x6e5230, 1);
      tileG.fillRect(x + 2, y + 2, grid - 4, 8); // tampa clara
      tileG.lineStyle(1, 0x2e2213, 1);
      tileG.strokeRect(x, y, grid, grid);
      tileG.fillStyle(0x8a7a55, 0.5);
      tileG.fillRect(x + grid / 2 - 5, y + 14, 10, 4); // etiqueta
    }

    // Plataformas (corpos físicos invisíveis) a partir dos runs do IntGrid.
    this.platforms = this.physics.add.staticGroup();
    for (const [px, surfY, tiles] of this.level.platforms) {
      const w = tiles * grid;
      const body = this.add.rectangle(px + w / 2, surfY + grid / 2, w, grid, 0x000000, 0);
      this.physics.add.existing(body, true);
      this.platforms.add(body);
    }

    // Entities: PlayerStart, Enemy (marcadores), Exit.
    const start = this.level.entities.find((e) => e.id === "PlayerStart") ?? { x: 80, y: 380 };
    this.player = new Player(this, start.x, start.y);
    this.physics.add.collider(this.player, this.platforms);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);

    for (const e of this.level.entities.filter((e) => e.id === "Enemy")) {
      // Marcador de spawn (POC não instancia combate) — losango + rótulo.
      const m = this.add.star(e.x, e.y - 8, 4, 6, 12, 0xd14545).setDepth(6);
      this.tweens.add({ targets: m, y: m.y - 6, duration: 700, yoyo: true, repeat: -1 });
      this.add
        .text(e.x, e.y - 30, "spawn", {
          fontFamily: Fonts.mono,
          fontSize: "8px",
          color: "#e0a0a0",
        })
        .setOrigin(0.5)
        .setDepth(6);
    }

    const exit = this.level.entities.find((e) => e.id === "Exit");
    if (exit) {
      this.add.rectangle(exit.x, exit.y - 24, 36, 60, 0x2a6b4a).setDepth(5);
      this.add
        .text(exit.x, exit.y - 60, "SAÍDA\n[E]", {
          fontFamily: Fonts.mono,
          fontSize: "9px",
          color: "#9fe0c0",
          align: "center",
        })
        .setOrigin(0.5)
        .setDepth(6);
      this.exitZone = this.add.zone(exit.x, exit.y - 24, 44, 70);
      this.physics.add.existing(this.exitZone, true);
    }

    this.interactKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E);

    // Legenda (fixa na câmera).
    this.add
      .text(
        this.cameras.main.width / 2,
        14,
        "POC LDtk — ARQUIVO MORTO   ·   sala desenhada no LDtk, montada por código",
        { fontFamily: Fonts.body, fontSize: "14px", color: "#cfd6de" },
      )
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(1000);
    this.add
      .text(this.cameras.main.width / 2, GAME_HEIGHT - 18, "← → mover · Espaço pular · [E] sair", {
        fontFamily: Fonts.body,
        fontSize: "13px",
        color: "#8a93a0",
      })
      .setOrigin(0.5, 1)
      .setScrollFactor(0)
      .setDepth(1000);
  }

  update(time: number, delta: number) {
    if (!this.player) return;
    this.player.update(time, delta);
    if (
      this.exitZone &&
      Phaser.Input.Keyboard.JustDown(this.interactKey) &&
      Phaser.Geom.Intersects.RectangleToRectangle(
        this.player.getBounds(),
        this.exitZone.getBounds(),
      )
    ) {
      this.cameras.main.fadeOut(250, 0, 0, 0);
      this.cameras.main.once("camerafadeoutcomplete", () => this.scene.start("MenuScene"));
    }
  }
}
