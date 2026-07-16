import Phaser from "phaser";

import { GAME_HEIGHT, GAME_WIDTH } from "../constants";
import { Fonts } from "../systems/Fonts";

type IntroData = { nextScene?: string; nextData?: Record<string, unknown> };

// Enquadramento da PREMISSA (P0 do alpha): o jogador de 1ª sessão caía direto
// na Fase 1 sem contexto do loop temporal / sátira CLT — o tema (o gancho do
// jogo) só aparecia no Game Over/Vitória, tarde demais. Esta cena curta abre a
// run com o clima "relógio de ponto que nunca chega às 18h". Procedural (sem
// arte), pulável, e só entra na 1ª run (o Menu roteia); depois o jogador já
// conhece a premissa.
const LINES = [
  "Segunda-feira. Ou terça. Já perdeu a conta.",
  "São 18h. Você junta suas coisas para ir embora.",
  "A porta da saída range. A luz pisca.",
  "E de novo você acorda na sua mesa. 09h. Segunda.",
  "O escritório não vai te deixar bater o ponto de saída.",
];

const PUNCH = "ESCAPE DO EXPEDIENTE";
const SUBTITLE = "Sobreviva ao dia. Chegue às 18h. Saia — se conseguir.";

export class IntroScene extends Phaser.Scene {
  private nextScene = "OpenSpaceV2Scene";
  private nextData: Record<string, unknown> = {};
  private advancing = false;

  constructor() {
    super("IntroScene");
  }

  create(data: IntroData) {
    this.nextScene = data?.nextScene ?? "OpenSpaceV2Scene";
    this.nextData = data?.nextData ?? {};
    this.advancing = false;

    const cx = GAME_WIDTH / 2;

    // Fundo escuro com uma "veia" de monitor CRT (scanlines sutis).
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x0d0f13).setOrigin(0);
    const scan = this.add.graphics();
    scan.lineStyle(1, 0x1a2028, 0.35);
    for (let y = 0; y < GAME_HEIGHT; y += 3) scan.lineBetween(0, y, GAME_WIDTH, y);

    // Relógio de ponto piscando 18:00 (o clima da premissa).
    const clock = this.add
      .text(cx, 70, "18:00", {
        fontFamily: Fonts.display,
        fontSize: "34px",
        color: "#f2c14e",
      })
      .setOrigin(0.5)
      .setAlpha(0.9);
    this.tweens.add({
      targets: clock,
      alpha: 0.25,
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: "Sine.inOut",
    });
    this.add
      .text(cx, 104, "PONTO ELETRÔNICO — SAÍDA BLOQUEADA", {
        fontFamily: Fonts.body,
        fontSize: "16px",
        color: "#8a93a0",
      })
      .setOrigin(0.5);

    // Linhas da premissa, reveladas uma a uma (fade in encadeado).
    const startY = 190;
    const lineH = 34;
    const lineObjs = LINES.map((txt, i) =>
      this.add
        .text(cx, startY + i * lineH, txt, {
          fontFamily: Fonts.body,
          fontSize: "20px",
          color: "#cfd6de",
          align: "center",
          wordWrap: { width: GAME_WIDTH - 120 },
        })
        .setOrigin(0.5)
        .setAlpha(0),
    );
    lineObjs.forEach((obj, i) => {
      this.tweens.add({
        targets: obj,
        alpha: 1,
        duration: 420,
        delay: 500 + i * 750,
        ease: "Sine.out",
      });
    });

    // Punchline (título) + subtítulo, entram depois das linhas.
    const punchDelay = 500 + LINES.length * 750 + 300;
    const punch = this.add
      .text(cx, startY + LINES.length * lineH + 40, PUNCH, {
        fontFamily: Fonts.display,
        fontSize: "22px",
        color: "#e8503a",
      })
      .setOrigin(0.5)
      .setAlpha(0);
    const sub = this.add
      .text(cx, startY + LINES.length * lineH + 74, SUBTITLE, {
        fontFamily: Fonts.body,
        fontSize: "18px",
        color: "#9aa4b0",
      })
      .setOrigin(0.5)
      .setAlpha(0);
    this.tweens.add({ targets: [punch, sub], alpha: 1, duration: 500, delay: punchDelay });

    // Prompt de continuar (piscando), aparece junto da punchline.
    const prompt = this.add
      .text(cx, GAME_HEIGHT - 34, "[ESPAÇO] começar   ·   [ESC] pular", {
        fontFamily: Fonts.body,
        fontSize: "17px",
        color: "#66aaff",
      })
      .setOrigin(0.5)
      .setAlpha(0);
    this.tweens.add({
      targets: prompt,
      alpha: 1,
      duration: 400,
      delay: punchDelay,
      onComplete: () => {
        this.tweens.add({
          targets: prompt,
          alpha: 0.3,
          duration: 650,
          yoyo: true,
          repeat: -1,
        });
      },
    });

    // Avança com ESPAÇO/ENTER/E ou ESC (pular). Clique também avança.
    this.input.keyboard?.on("keydown-SPACE", () => this.advance());
    this.input.keyboard?.on("keydown-ENTER", () => this.advance());
    this.input.keyboard?.on("keydown-E", () => this.advance());
    this.input.keyboard?.on("keydown-ESC", () => this.advance());
    this.input.on("pointerdown", () => this.advance());
  }

  private advance() {
    if (this.advancing) return;
    this.advancing = true;
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once("camerafadeoutcomplete", () => {
      this.scene.start(this.nextScene, this.nextData);
    });
  }
}
