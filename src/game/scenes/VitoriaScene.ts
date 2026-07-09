import Phaser from "phaser";
import { Telemetry } from "../systems/Telemetry";
import { GAME_WIDTH, GAME_HEIGHT } from "../constants";
import { getRun, savePersisted, unlockNgPlus } from "../systems/PlayerState";
import { Sfx } from "../systems/AudioSystem";

export class VitoriaScene extends Phaser.Scene {
  constructor() {
    super("VitoriaScene");
  }

  create(data: { vr?: number; reconhecimento?: number; loopCount?: number }) {
    const run = getRun(this);
    const reconhecimento = data.reconhecimento ?? run.reconhecimento;
    const loopCount = data.loopCount ?? run.loopCount ?? 1;
    Telemetry.victory(data.vr ?? run.vr, loopCount);

    Sfx.victory();
    // Desbloqueia o New Game+ "Quinta-feira" (disponível no menu e no botão abaixo).
    unlockNgPlus();
    this.cameras.main.setBackgroundColor("#0a0c10");

    // Gold shimmer — motes que cintilam (antes eram círculos estáticos)
    for (let i = 0; i < 34; i++) {
      const cx = Phaser.Math.Between(0, GAME_WIDTH);
      const cy = Phaser.Math.Between(0, GAME_HEIGHT);
      const mote = this.add
        .circle(cx, cy, Phaser.Math.Between(2, 7), 0xf2c14e, Phaser.Math.FloatBetween(0.05, 0.2))
        .setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: mote,
        alpha: 0,
        y: cy - Phaser.Math.Between(10, 40),
        duration: Phaser.Math.Between(1800, 4200),
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
        delay: Phaser.Math.Between(0, 2500),
      });
    }

    // Ilustração de fundo: porta de saída aberta com luz do dia entrando
    // (a fuga às 18h). Fica ATRÁS do texto (depth baixo), como vinheta.
    this.drawExitDoor(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 20);

    // Title
    const title = this.add
      .text(GAME_WIDTH / 2, 80, "VOCÊ ESCAPOU!", {
        fontFamily: "monospace",
        fontSize: "32px",
        fontStyle: "bold",
        color: "#f2c14e",
        stroke: "#000000",
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setAlpha(0);

    this.tweens.add({ targets: title, alpha: 1, duration: 1200, delay: 200 });

    const subtitle = this.add
      .text(GAME_WIDTH / 2, 130, "O relógio marcou 18:00 — e você viu a saída.", {
        fontFamily: "monospace",
        fontSize: "13px",
        color: "#cccccc",
      })
      .setOrigin(0.5)
      .setAlpha(0);
    this.tweens.add({ targets: subtitle, alpha: 1, duration: 800, delay: 1000 });

    // Stats
    const statsY = 200;
    const lines = [
      `Reconhecimento total:  ${reconhecimento}`,
      `Loops completos:       ${loopCount}`,
      `VR acumulado:          ${data.vr ?? run.vr}`,
    ];

    lines.forEach((line, i) => {
      const t = this.add
        .text(GAME_WIDTH / 2, statsY + i * 36, line, {
          fontFamily: "monospace",
          fontSize: "15px",
          color: "#eaeaea",
        })
        .setOrigin(0.5)
        .setAlpha(0);
      this.tweens.add({ targets: t, alpha: 1, duration: 700, delay: 1600 + i * 300 });
    });

    // Flavor
    const flavor = this.add
      .text(
        GAME_WIDTH / 2,
        370,
        '"Amanhã é segunda-feira. O ciclo recomeça.\nMas hoje — hoje você foi livre."',
        {
          fontFamily: "monospace",
          fontSize: "12px",
          color: "#888888",
          align: "center",
        },
      )
      .setOrigin(0.5)
      .setAlpha(0);
    this.tweens.add({ targets: flavor, alpha: 1, duration: 900, delay: 2800 });

    // Loop counter bonus note
    if (loopCount > 1) {
      const bonus = this.add
        .text(
          GAME_WIDTH / 2,
          430,
          `Bônus de Reconhecimento por ${loopCount} loops: +${(loopCount - 1) * 50}`,
          { fontFamily: "monospace", fontSize: "11px", color: "#44cc88" },
        )
        .setOrigin(0.5)
        .setAlpha(0);
      this.tweens.add({ targets: bonus, alpha: 1, duration: 700, delay: 3200 });

      const r = getRun(this);
      r.reconhecimento += (loopCount - 1) * 50;
      savePersisted(r.reconhecimento, r.fgts, r.loopCount);
    }

    // Buttons
    const btnY = 480;

    const btnAgain = this.add
      .text(GAME_WIDTH / 2 - 120, btnY, "[ R ]  Quinta-feira (NG+)", {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#f2c14e",
        backgroundColor: "#1a1c22",
        padding: { x: 12, y: 8 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .setAlpha(0);

    const btnMenu = this.add
      .text(GAME_WIDTH / 2 + 120, btnY, "[ M ]  Menu principal", {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#aaaaaa",
        backgroundColor: "#1a1c22",
        padding: { x: 12, y: 8 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .setAlpha(0);

    this.tweens.add({ targets: [btnAgain, btnMenu], alpha: 1, duration: 700, delay: 3500 });

    btnAgain.on("pointerover", () => btnAgain.setColor("#ffffff"));
    btnAgain.on("pointerout", () => btnAgain.setColor("#f2c14e"));
    btnAgain.on("pointerdown", () => this.startNewLoop());

    btnMenu.on("pointerover", () => btnMenu.setColor("#ffffff"));
    btnMenu.on("pointerout", () => btnMenu.setColor("#aaaaaa"));
    btnMenu.on("pointerdown", () => this.scene.start("MenuScene"));

    // Keyboard
    const rKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.R);
    const mKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.M);

    this.time.delayedCall(3500, () => {
      rKey.on("down", () => this.startNewLoop());
      mKey.on("down", () => this.scene.start("MenuScene"));
    });
  }

  /** Vinheta de fundo: batente de porta com feixe de luz do dia + silhueta saindo. */
  private drawExitDoor(cx: number, cy: number) {
    const g = this.add.graphics().setDepth(-1);
    const dw = 150; // largura do vão
    const dh = 300; // altura do vão
    const top = cy - dh / 2;
    // feixe de luz (trapézio que abre para baixo), aditivo e suave
    g.setBlendMode(Phaser.BlendModes.ADD);
    for (let i = 0; i < 5; i++) {
      const spread = i * 26;
      const a = 0.05 - i * 0.008;
      g.fillStyle(0xf2e0a0, a);
      g.fillRect(cx - dw / 2 - spread, top, dw + spread * 2, dh);
    }
    // batente da porta (linhas escuras nas laterais), depth normal
    const frame = this.add.graphics().setDepth(-1);
    frame.fillStyle(0x1a1c22, 0.9);
    frame.fillRect(cx - dw / 2 - 8, top - 8, 8, dh + 8);
    frame.fillRect(cx + dw / 2, top - 8, 8, dh + 8);
    frame.fillRect(cx - dw / 2 - 8, top - 8, dw + 16, 8);
    // núcleo claro do vão
    const core = this.add
      .rectangle(cx, cy, dw, dh, 0xfff4d0, 0.14)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(-1);
    this.tweens.add({
      targets: core,
      alpha: 0.24,
      duration: 2200,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
    // silhueta do CLT caminhando para a luz (pequena, na base do vão)
    const s = this.add.graphics().setDepth(-1);
    s.fillStyle(0x0a0b0e, 0.85);
    const px = cx + 10;
    const py = cy + dh / 2 - 6;
    s.fillRect(px - 6, py - 40, 12, 26); // tronco
    s.fillCircle(px, py - 44, 6); // cabeça
    s.fillRect(px - 6, py - 15, 5, 15); // perna tras
    s.fillRect(px + 2, py - 15, 5, 15); // perna frente
    s.fillRect(px - 12, py - 34, 6, 14); // braço/pasta
  }

  private startNewLoop() {
    const run = getRun(this);
    // Keep reconhecimento + fgts, reset run state
    const reconhecimento = run.reconhecimento;
    const fgts = run.fgts;
    const loopCount = (run.loopCount ?? 1) + 1;

    // Reset run via registry
    this.registry.set("run", undefined);
    const freshRun = getRun(this); // reinitializes
    freshRun.reconhecimento = reconhecimento;
    freshRun.fgts = fgts;
    freshRun.loopCount = loopCount;
    // Venceu → o próximo loop é a "Quinta-feira" (New Game+): mais difícil.
    freshRun.ngPlus = true;
    savePersisted(reconhecimento, fgts, loopCount);

    this.scene.start("ClassSelectScene");
  }
}
