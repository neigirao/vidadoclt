import Phaser from "phaser";

/**
 * CombatFx — centralises all combat-feedback effects so every scene
 * gets the same feel without copy-pasting shake/flash/hitstop logic.
 *
 * Usage:
 *   this.combatFx = new CombatFx(this);
 *   this.combatFx.hitLight();   // on regular hit
 *   this.combatFx.hitHeavy();   // on boss hit / player near death
 *   this.combatFx.hitStop(60);  // freeze frame on strong impact
 *   this.combatFx.deathBurst(); // on player or boss death
 *   this.combatFx.wipeOut(cb);  // door/transition wipe
 */
export class CombatFx {
  constructor(private scene: Phaser.Scene) {}

  // ── Hit feedback ──────────────────────────────────────────────────────────

  /** Light hit: short shake + white screen flash */
  hitLight(): void {
    const cam = this.scene.cameras.main;
    cam.shake(80, 0.005);
    cam.flash(60, 255, 255, 255, false);
  }

  /** Heavy hit: longer shake + stronger flash. Use when player hp < 25% or boss phase change. */
  hitHeavy(): void {
    const cam = this.scene.cameras.main;
    cam.shake(180, 0.012);
    cam.flash(90, 255, 80, 80, false);
  }

  /**
   * Hit-stop: pauses physics for `durationMs` (default 60ms).
   * Creates the "freeze frame" feel on a heavy impact without stopping tweens or timers.
   */
  hitStop(durationMs = 60): void {
    const phys = this.scene.physics as Phaser.Physics.Arcade.ArcadePhysics;
    phys.pause();
    this.scene.time.delayedCall(durationMs, () => phys.resume());
  }

  /**
   * Hit-stop + heavy shake combo. Use for boss slams, finishing blow on an enemy.
   */
  impactHeavy(stopMs = 60): void {
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
    const wipeFilter = cam.filters.internal.addWipe({ direction: 0, axis: 0 });

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
    cam.fade(durationMs, 0, 0, 0, false, (_cam: Phaser.Cameras.Scene2D.Camera, progress: number) => {
      if (progress === 1) onComplete?.();
    });
  }

  // ── Sprite helpers (call on the sprite directly, not camera) ─────────────

  /**
   * White hit-flash on a sprite: fill white for `durationMs` then restore.
   * More impactful than a tint because it fills every pixel regardless of colour.
   */
  static flashSprite(sprite: Phaser.GameObjects.Sprite | Phaser.Physics.Arcade.Sprite, durationMs = 60): void {
    sprite.setTintFill(0xffffff);
    sprite.scene.time.delayedCall(durationMs, () => sprite.clearTint());
  }

  /**
   * Squash-and-stretch on landing. Call when a character just touches the ground.
   * scaleX widens, scaleY shortens, then springs back.
   */
  static landSquash(sprite: Phaser.GameObjects.Sprite | Phaser.Physics.Arcade.Sprite): void {
    sprite.scene.tweens.add({
      targets: sprite,
      scaleX: 1.35,
      scaleY: 0.72,
      duration: 60,
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
      scaleX: 0.82,
      scaleY: 1.22,
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

    const txt = this.scene.add.text(x, y - 10, label, {
      fontFamily: "monospace",
      fontSize,
      color,
      stroke: "#000000",
      strokeThickness: 2,
    }).setOrigin(0.5, 1).setDepth(200).setScrollFactor(1);

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
