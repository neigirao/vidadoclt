import Phaser from "phaser";
import type { Player } from "../entities/Player";

// ─────────────────────────────────────────────────────────────────────────────
// DebugOverlay — visualiza AO VIVO o estado que costuma quebrar animações do
// player: escala corrente (X/Y) + escala base cacheada em Juice, tweens ativos,
// tween de squash em curso, velocidade, flags de body e caixa do body/hitbox
// de melee. Toggle em F3. Só liga em DEV (não pesa o build publicado).
//
// Foi escrito depois do bug do "player virando linha" (squashes empilhados
// multiplicando scaleY até 0) — expõe exatamente os dados que fizeram falta
// pra diagnosticar: base cacheada (juice:baseX/Y), tween ativo, escala atual.
// ─────────────────────────────────────────────────────────────────────────────

type ScaleSample = { t: number; sx: number; sy: number };

export class DebugOverlay {
  private enabled = false;
  private g!: Phaser.GameObjects.Graphics;
  private txt!: Phaser.GameObjects.Text;
  private samples: ScaleSample[] = [];
  private readonly SAMPLE_MAX = 120; // ~2s @60fps

  constructor(
    private scene: Phaser.Scene,
    private player: Player,
  ) {
    this.g = scene.add.graphics().setDepth(9998).setScrollFactor(0).setVisible(false);
    this.txt = scene.add
      .text(8, 8, "", {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#00ff88",
        backgroundColor: "#000000cc",
        padding: { x: 6, y: 4 },
      })
      .setDepth(9999)
      .setScrollFactor(0)
      .setVisible(false);

    scene.input.keyboard?.on("keydown-F3", () => this.toggle());
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
    scene.events.once(Phaser.Scenes.Events.DESTROY, () => this.destroy());
  }

  toggle(): void {
    this.enabled = !this.enabled;
    this.g.setVisible(this.enabled);
    this.txt.setVisible(this.enabled);
    if (!this.enabled) this.samples.length = 0;
  }

  update(time: number): void {
    if (!this.enabled || !this.player.active) return;

    const p = this.player as Player & {
      getData(k: string): unknown;
    };
    const body = p.body as Phaser.Physics.Arcade.Body | null;
    const cam = this.scene.cameras.main;

    // ── amostra de escala para o mini-gráfico
    this.samples.push({ t: time, sx: p.scaleX, sy: p.scaleY });
    if (this.samples.length > this.SAMPLE_MAX) this.samples.shift();

    // ── caixas em coords de tela (não scroll)
    this.g.clear();

    // Body do player (verde)
    if (body) {
      const bx = body.x - cam.scrollX;
      const by = body.y - cam.scrollY;
      this.g.lineStyle(1, 0x00ff88, 0.9).strokeRect(bx, by, body.width, body.height);
      // Origem/centro
      this.g.fillStyle(0xffff00, 1).fillCircle(p.x - cam.scrollX, p.y - cam.scrollY, 2);
    }

    // Hitbox de melee ativa (amarelo pulsante)
    const activeUntil = p.getData("meleeActiveUntil") as number | undefined;
    const hb = p.getData("meleeHitbox") as Phaser.Geom.Rectangle | undefined;
    if (activeUntil && time < activeUntil && hb) {
      this.g
        .lineStyle(2, 0xffcc00, 1)
        .strokeRect(hb.x - cam.scrollX, hb.y - cam.scrollY, hb.width, hb.height);
    }

    // ── gráfico de scaleY (canto sup direito): pega o "esmagamento" na hora
    const gx = cam.width - 132;
    const gy = 8;
    this.g.fillStyle(0x000000, 0.6).fillRect(gx, gy, 124, 40);
    this.g.lineStyle(1, 0x333333, 1).strokeRect(gx, gy, 124, 40);
    // linha da escala base (1.0)
    this.g.lineStyle(1, 0x444444, 1).lineBetween(gx, gy + 20, gx + 124, gy + 20);
    // path do scaleY normalizado (0.5..1.5 → 40..0)
    this.g.lineStyle(1, 0x00ff88, 1);
    for (let i = 1; i < this.samples.length; i++) {
      const a = this.samples[i - 1];
      const b = this.samples[i];
      const ax = gx + ((i - 1) / this.SAMPLE_MAX) * 124;
      const bx = gx + (i / this.SAMPLE_MAX) * 124;
      const ay = gy + 40 - Phaser.Math.Clamp(a.sy - 0.5, 0, 1) * 40;
      const by = gy + 40 - Phaser.Math.Clamp(b.sy - 0.5, 0, 1) * 40;
      this.g.lineBetween(ax, ay, bx, by);
    }

    // ── painel de texto
    const baseX = p.getData("juice:baseX") as number | undefined;
    const baseY = p.getData("juice:baseY") as number | undefined;
    const squashTw = p.getData("juice:squashTween") as Phaser.Tweens.Tween | undefined;
    const squashing = squashTw && squashTw.isPlaying();
    const activeTweens = this.scene.tweens.getTweensOf(this.player).length;
    const totalTweens = this.scene.tweens.getTweens().length;
    const invuln = p.isInvulnerable(time);
    const state = (p as unknown as { getStateLabel?: () => string }).getStateLabel?.() ?? "";

    const lines = [
      `[F3] DEBUG PLAYER  ·  t=${(time / 1000).toFixed(1)}s`,
      `pos     (${p.x.toFixed(0)}, ${p.y.toFixed(0)})   facing=${(p as unknown as { facing: number }).facing}`,
      `scale   x=${p.scaleX.toFixed(3)}  y=${p.scaleY.toFixed(3)}   display=${p.displayWidth.toFixed(0)}×${p.displayHeight.toFixed(0)}`,
      `base    x=${baseX !== undefined ? baseX.toFixed(3) : "—"}  y=${baseY !== undefined ? baseY.toFixed(3) : "—"}   ${squashing ? "◆ SQUASH ATIVO" : "· parado"}`,
      `tweens  player=${activeTweens}  global=${totalTweens}${squashing ? "  · squashTw playing" : ""}`,
      body
        ? `body    ${body.width.toFixed(0)}×${body.height.toFixed(0)}   vel=(${body.velocity.x.toFixed(0)}, ${body.velocity.y.toFixed(0)})`
        : `body    —`,
      body
        ? `flags   ${body.blocked.down ? "▼" : "·"}${body.blocked.up ? "▲" : "·"}${body.blocked.left ? "◀" : "·"}${body.blocked.right ? "▶" : "·"}   onGround=${body.blocked.down || body.touching.down}`
        : `flags   —`,
      `combat  ${activeUntil && time < activeUntil ? "◆ MELEE ATIVA" : "·"}   invuln=${invuln ? "SIM" : "não"}   ${state}`,
      `hp/energy  E=${p.energy.toFixed(0)}/${p.maxEnergy}  S=${p.sanity.toFixed(0)}/${p.maxSanity}  VR=${p.vr}`,
    ];
    this.txt.setText(lines.join("\n"));

    // Alerta visível se a escala se afasta demais da base (sintoma do bug antigo).
    if (baseY !== undefined && Math.abs(p.scaleY - baseY) / baseY > 0.35) {
      this.txt.setColor("#ff4444");
    } else if (squashing) {
      this.txt.setColor("#ffcc00");
    } else {
      this.txt.setColor("#00ff88");
    }
  }

  destroy(): void {
    this.g?.destroy();
    this.txt?.destroy();
    this.samples.length = 0;
  }
}
