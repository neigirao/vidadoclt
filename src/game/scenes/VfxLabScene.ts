import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "../constants";
import { Fonts } from "../systems/Fonts";
import { addSprite } from "../systems/SpriteLibrary";
import { VFX_CATALOG, VfxEntry } from "../systems/Vfx";

// ─────────────────────────────────────────────────────────────────────────────
// LAB VFX (DEV) — catálogo visual de TODOS os efeitos canônicos (Vfx.ts). Cada
// entrada vira um botão; clicar roda o efeito no palco central. É o análogo do
// LAB SPRITES para partículas/juice: um lugar para VER e AFINAR os VFX sem ter
// que provocá-los no jogo. Auto-replay opcional ([L]), replay manual ([ESPAÇO]).
//
// DEV-only: filtrado do build publicado (spread condicional em config.ts +
// item `dev:true` no MenuScene).
// ─────────────────────────────────────────────────────────────────────────────
export class VfxLabScene extends Phaser.Scene {
  private stageX = GAME_WIDTH / 2;
  private stageY = 210;
  private dummy!: Phaser.GameObjects.Sprite;
  private selected: VfxEntry = VFX_CATALOG[0];
  private autoLoop = true;
  private loopEvt?: Phaser.Time.TimerEvent;
  private nameLabel!: Phaser.GameObjects.Text;

  constructor() {
    super("VfxLabScene");
  }

  create() {
    // Fundo escuro com grade (contraste neutro p/ ler qualquer paleta de efeito).
    this.cameras.main.setBackgroundColor("#141821");
    const grid = this.add.graphics().setDepth(0);
    grid.lineStyle(1, 0x252b38, 1);
    for (let x = 0; x <= GAME_WIDTH; x += 32) grid.lineBetween(x, 0, x, GAME_HEIGHT);
    for (let y = 0; y <= GAME_HEIGHT; y += 32) grid.lineBetween(0, y, GAME_WIDTH, y);

    this.add
      .text(GAME_WIDTH / 2, 24, "LAB VFX — catálogo de efeitos", {
        fontFamily: Fonts.display,
        fontSize: "12px",
        color: "#ffd766",
      })
      .setOrigin(0.5);

    // Palco: um sprite dummy (alvo dos efeitos de sprite: flash/squash) + marca
    // do ponto (alvo dos efeitos de ponto: partículas).
    this.add.circle(this.stageX, this.stageY + 26, 3, 0x445066).setDepth(1);
    this.dummy = addSprite(this, this.stageX, this.stageY, "tex-estagiario-idle0").setDepth(2);

    this.nameLabel = this.add
      .text(this.stageX, this.stageY + 54, this.selected.label, {
        fontFamily: Fonts.body,
        fontSize: "18px",
        color: "#d0e4f8",
      })
      .setOrigin(0.5);

    // Botões do catálogo (grade embaixo).
    const cols = 5;
    const bw = 168,
      bh = 30,
      gap = 8;
    const totalW = cols * bw + (cols - 1) * gap;
    const startX = (GAME_WIDTH - totalW) / 2 + bw / 2;
    const startY = 320;
    VFX_CATALOG.forEach((e, i) => {
      const cx = startX + (i % cols) * (bw + gap);
      const cy = startY + Math.floor(i / cols) * (bh + gap);
      const bg = this.add
        .rectangle(cx, cy, bw, bh, 0x212838)
        .setStrokeStyle(1, 0x3a4556)
        .setInteractive({ useHandCursor: true });
      const txt = this.add
        .text(cx, cy, `${e.label}`, {
          fontFamily: Fonts.body,
          fontSize: "16px",
          color: e.kind === "sprite" ? "#9fd0a0" : "#cfe0f5",
        })
        .setOrigin(0.5);
      bg.on("pointerdown", () => {
        this.selected = e;
        this.nameLabel.setText(`${e.label}  ·  ${e.kind}`);
        this.play();
      });
      bg.on("pointerover", () => bg.setFillStyle(0x2c3547));
      bg.on("pointerout", () => bg.setFillStyle(0x212838));
      void txt;
    });

    this.add
      .text(
        GAME_WIDTH / 2,
        GAME_HEIGHT - 20,
        "[ESPAÇO] rodar de novo · [L] auto-loop (on) · [ESC] sair",
        { fontFamily: Fonts.body, fontSize: "15px", color: "#8894a8" },
      )
      .setOrigin(0.5);

    this.input.keyboard!.on("keydown-SPACE", () => this.play());
    this.input.keyboard!.on("keydown-L", () => this.toggleLoop());
    this.input.keyboard!.on("keydown-ESC", () => this.scene.start("MenuScene"));

    this.startLoop();
  }

  private play() {
    const e = this.selected;
    if (e.kind === "point") e.point?.(this, this.stageX, this.stageY);
    else e.sprite?.(this, this.dummy);
  }

  private startLoop() {
    this.loopEvt?.remove();
    if (this.autoLoop) {
      this.loopEvt = this.time.addEvent({ delay: 900, loop: true, callback: () => this.play() });
    }
  }

  private toggleLoop() {
    this.autoLoop = !this.autoLoop;
    this.startLoop();
  }
}
