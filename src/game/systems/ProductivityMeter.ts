import Phaser from "phaser";
import { GAME_WIDTH } from "../constants";

/**
 * Medidor de Produtividade (Fase 1): kills encadeados dentro de uma janela
 * aumentam um streak que multiplica o VR dropado (até 2x no streak 5). Extraído
 * da OpenSpaceV2Scene para reduzir o God-scene e isolar a mecânica.
 */
export class ProductivityMeter {
  private streak = 0;
  private lastKillAt = -9999;
  private readonly meter: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;
  private static readonly WINDOW_MS = 4000;

  constructor(private scene: Phaser.Scene) {
    this.meter = scene.add.graphics().setScrollFactor(0).setDepth(908);
    this.label = scene.add
      .text(GAME_WIDTH / 2, 64, "", {
        fontFamily: "monospace",
        fontSize: "9px",
        color: "#aaffaa",
        stroke: "#000000",
        strokeThickness: 2,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(908);
  }

  /** Registra um kill; mostra o popup de streak; devolve o multiplicador de VR. */
  registerKill(x: number, y: number): number {
    const now = this.scene.time.now;
    if (now - this.lastKillAt > ProductivityMeter.WINDOW_MS) this.streak = 0;
    this.streak++;
    this.lastKillAt = now;
    const mult = 1 + Math.min(this.streak * 0.2, 1.0); // 2x já no streak 5 (alcançável)
    if (this.streak >= 2) {
      const t = this.scene.add
        .text(x, y - 34, `x${this.streak} PRODUTIVIDADE`, {
          fontFamily: "monospace",
          fontSize: this.streak >= 5 ? "13px" : "10px",
          color: this.streak >= 5 ? "#ffcc22" : "#aaffaa",
          stroke: "#000000",
          strokeThickness: 2,
        })
        .setOrigin(0.5)
        .setDepth(610);
      this.scene.tweens.add({
        targets: t,
        y: t.y - 22,
        alpha: 0,
        duration: 700,
        onComplete: () => t.destroy(),
      });
    }
    return mult;
  }

  /** Desenha a barra fixa na câmera (chamar no update da cena). */
  draw(time: number): void {
    const active = time - this.lastKillAt <= ProductivityMeter.WINDOW_MS && this.streak >= 2;
    this.meter.clear();
    if (!active) {
      this.label.setText("");
      return;
    }
    const ratio = Math.max(0, 1 - (time - this.lastKillAt) / ProductivityMeter.WINDOW_MS);
    const w = 120,
      h = 6,
      x = GAME_WIDTH / 2 - w / 2,
      y = 74;
    this.meter.fillStyle(0x000000, 0.5);
    this.meter.fillRect(x - 1, y - 1, w + 2, h + 2);
    const col = this.streak >= 5 ? 0xffcc22 : 0x66dd88;
    this.meter.fillStyle(col, 0.9);
    this.meter.fillRect(x, y, w * ratio, h);
    this.label
      .setText(
        `PRODUTIVIDADE x${this.streak}  (+${Math.round(Math.min(this.streak * 0.2, 1.0) * 100)}% VR)`,
      )
      .setColor(this.streak >= 5 ? "#ffcc22" : "#aaffaa");
  }
}
