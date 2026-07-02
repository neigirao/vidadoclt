import Phaser from "phaser";
import { ParticleFactory } from "./ParticleFactory";

/**
 * CombatFx — centralises all combat-feedback effects so every scene
 * gets the same feel without copy-pasting shake/flash/hitstop logic.
 */
export class CombatFx {
  constructor(private scene: Phaser.Scene) {}

  // ── Hit feedback ──────────────────────────────────────────────────────────

  /** Light hit: short shake + white screen flash + light particles */
  hitLight(x?: number, y?: number): void {
    const cam = this.scene.cameras.main;
    cam.shake(80, 0.005);
    cam.flash(60, 255, 255, 255, false);
    if (x !== undefined && y !== undefined) {
      ParticleFactory.hitLight(this.scene, x, y);
    }
  }

  /** Heavy hit: longer shake + stronger flash + heavy particles */
  hitHeavy(x?: number, y?: number): void {
    const cam = this.scene.cameras.main;
    cam.shake(180, 0.012);
    cam.flash(90, 255, 80, 80, false);
    if (x !== undefined && y !== undefined) {
      ParticleFactory.hitHeavy(this.scene, x, y);
    }
  }

  /**
   * Combo finisher: screen-tilt + zoom pop + heavy impact.
   * Call on combo step 3 when an enemy was hit.
   */
  comboFinisher(playerX: number, enemyX: number): void {
    void playerX;
    void enemyX;
    const cam = this.scene.cameras.main;
    // NÃO rotacionar a câmera: num side-scroller preso aos limites do mundo, girar
    // a câmera na borda (onde o boss fica, x≈1820 de 1920) inclina a cena inteira
    // e joga o alvo/boss para fora do frame — lia como "o boss sumiu ao tomar hit".
    // Mantém só o zoom-pop centrado (seguro em qualquer posição).
    this.scene.tweens.add({
      targets: cam,
      zoom: cam.zoom * 1.05,
      duration: 40,
      yoyo: true,
      ease: "Quad.easeInOut",
    });
    this.finisherImpact();
  }

  /**
   * Hit-stop: pauses physics for `durationMs` (default 85ms).
   * Uses setTimeout (real time) so the resume fires even while scene time is paused.
   */
  hitStop(durationMs = 85): void {
    const phys = this.scene.physics as Phaser.Physics.Arcade.ArcadePhysics;
    phys.pause();
    // Use real-time setTimeout so the physics.resume() fires regardless of scene time scale
    setTimeout(() => {
      try {
        phys.resume();
      } catch {}
    }, durationMs);
  }

  /**
   * Finisher impact: hitStop + heavy shake + chromatic-aberration-style flash.
   * Call on the last hit of a combo or any heavy melee finisher.
   */
  finisherImpact(): void {
    this.hitStop(110);
    const cam = this.scene.cameras.main;
    cam.shake(140, 0.009);
    // Two-colour flash: white then orange — simulates chromatic split
    cam.flash(40, 255, 255, 255, false);
    this.scene.time.delayedCall(40, () => {
      if (cam.scene) cam.flash(60, 255, 140, 40, false);
    });
  }

  /**
   * Hit-stop + heavy shake combo. Use for boss slams, finishing blow on an enemy.
   */
  impactHeavy(stopMs = 85): void {
    this.hitStop(stopMs);
    this.hitHeavy();
  }

  // ── Death / big moments ───────────────────────────────────────────────────

  /** Full-screen white burst then fade — player death or boss kill. */
  deathBurst(): void {
    const cam = this.scene.cameras.main;
    cam.shake(300, 0.015);
    cam.flash(200, 255, 255, 255, true);
  }

  // ── Transitions ───────────────────────────────────────────────────────────

  /**
   * Horizontal wipe out (Phaser 4 built-in Wipe filter on the camera).
   * Calls `onComplete` when the wipe finishes.
   */
  wipeOut(onComplete?: () => void, durationMs = 600): void {
    const cam = this.scene.cameras.main;
    // Phaser 4 Wipe filter: amount 0→1 sweeps the reveal from left to right
    const wipeFilter = cam.filters.internal.addWipe(0.1, 0, 0);

    this.scene.tweens.add({
      targets: wipeFilter,
      amount: 1,
      duration: durationMs,
      ease: "Cubic.easeIn",
      onComplete: () => {
        wipeFilter.destroy();
        onComplete?.();
      },
    });
  }

  /**
   * Fade out camera to black, call `onComplete` at peak darkness.
   * The caller is responsible for starting the new scene; `cam.fadeIn` can restore.
   */
  fadeOut(onComplete?: () => void, durationMs = 400): void {
    const cam = this.scene.cameras.main;
    cam.fade(
      durationMs,
      0,
      0,
      0,
      false,
      (_cam: Phaser.Cameras.Scene2D.Camera, progress: number) => {
        if (progress === 1) onComplete?.();
      },
    );
  }

  // ── Sprite helpers (call on the sprite directly, not camera) ─────────────

  /**
   * Hit-flash on a sprite: briefly tints the sprite orange-white then clears.
   * Uses setTint (modulate mode) — setTintFill was removed in Phaser 4.
   */
  static flashSprite(
    sprite: Phaser.GameObjects.Sprite | Phaser.Physics.Arcade.Sprite,
    durationMs = 60,
  ): void {
    // Brief desaturated tint — avoids ADD blend mode which causes photosensitivity issues
    sprite.setTint(0xffe0cc);
    sprite.scene.time.delayedCall(Math.min(durationMs, 50), () => {
      if (sprite.active) sprite.clearTint();
    });
  }

  /**
   * Squash-and-stretch on landing. Call when a character just touches the ground.
   * scaleX widens, scaleY shortens, then springs back.
   */
  static landSquash(sprite: Phaser.GameObjects.Sprite | Phaser.Physics.Arcade.Sprite): void {
    sprite.scene.tweens.add({
      targets: sprite,
      scaleX: 1.15,
      scaleY: 0.85,
      duration: 55,
      yoyo: true,
      ease: "Bounce.easeOut",
    });
  }

  /**
   * Jump stretch: taller and thinner on the way up.
   */
  static jumpStretch(sprite: Phaser.GameObjects.Sprite | Phaser.Physics.Arcade.Sprite): void {
    sprite.scene.tweens.add({
      targets: sprite,
      scaleX: 0.75,
      scaleY: 1.25,
      duration: 80,
      yoyo: true,
      ease: "Quad.easeOut",
    });
  }

  /**
   * Floating damage number: spawns a text at (x, y) that rises and fades out.
   * color defaults to white; use red for player taking damage, yellow for crits.
   */
  spawnDamageNumber(x: number, y: number, amount: number, color = "#ffffff", crit = false): void {
    const label = crit ? `${amount}!` : `${amount}`;
    const fontSize = crit ? "14px" : "11px";

    const txt = this.scene.add
      .text(x, y - 10, label, {
        fontFamily: "monospace",
        fontSize,
        color,
        stroke: "#000000",
        strokeThickness: 2,
      })
      .setOrigin(0.5, 1)
      .setDepth(200)
      .setScrollFactor(1);

    const offX = Phaser.Math.Between(-14, 14);

    this.scene.tweens.add({
      targets: txt,
      x: txt.x + offX,
      y: txt.y - 42,
      alpha: 0,
      scaleX: crit ? 1.4 : 1.0,
      scaleY: crit ? 1.4 : 1.0,
      duration: crit ? 900 : 650,
      ease: "Cubic.easeOut",
      onComplete: () => txt.destroy(),
    });
  }
}
