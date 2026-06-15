import Phaser from "phaser";
import { resolveSprite } from "../systems/SpriteLibrary";

/**
 * Faxineiro Noturno — patrulha lenta, swing largo de vassoura, drena sanidade ao acertar.
 */
export class Faxineiro extends Phaser.Physics.Arcade.Sprite {
  hp = 5;
  speed = 60;
  swingDamage = 25;
  sanityDamage = 15;
  dir: 1 | -1 = -1;
  private aiState: "walk" | "telegraph" | "swing" | "recover" = "walk";
  private stateUntil = 0;
  swingHitbox: Phaser.Geom.Rectangle | null = null;
  swingActive = false;

  target?: { x: number; y: number };

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, ...resolveSprite("tex-faxineiro"));
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(10);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(28, 42);
    body.setOffset(2, 6);
    body.setCollideWorldBounds(true);
  }

  preUpdate(t: number, dt: number) {
    super.preUpdate(t, dt);
    const body = this.body as Phaser.Physics.Arcade.Body;

    if (this.target) {
      const dx = this.target.x - this.x;
      if (Math.abs(dx) < 360) this.dir = dx >= 0 ? 1 : -1;
    }
    this.setFlipX(this.dir === -1);

    switch (this.aiState) {
      case "walk": {
        body.setVelocityX(this.dir * this.speed);
        if (this.target && Math.abs(this.target.x - this.x) < 60) {
          this.aiState = "telegraph";
          this.stateUntil = t + 550;
          this.setTint(0xffdd66);
          body.setVelocityX(0);
        }
        break;
      }
      case "telegraph": {
        body.setVelocityX(0);
        if (t >= this.stateUntil) {
          this.aiState = "swing";
          this.stateUntil = t + 180;
          this.clearTint();
          this.setTint(0x88ddff);
          this.swingHitbox = new Phaser.Geom.Rectangle(
            this.dir === 1 ? this.x + 10 : this.x - 52,
            this.y - 10,
            44,
            34,
          );
          this.swingActive = true;
        }
        break;
      }
      case "swing": {
        body.setVelocityX(0);
        if (t >= this.stateUntil) {
          this.aiState = "recover";
          this.stateUntil = t + 600;
          this.swingActive = false;
          this.swingHitbox = null;
          this.clearTint();
        }
        break;
      }
      case "recover": {
        body.setVelocityX(0);
        if (t >= this.stateUntil) this.aiState = "walk";
        break;
      }
    }
  }

  hit(damage: number, knockback: number) {
    this.hp -= damage;
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocityX(knockback * 0.4);
    body.setVelocityY(-140);
    this.setTint(0xffffff);
    this.scene.time.delayedCall(80, () => this.clearTint());
    if (this.aiState === "swing" || this.aiState === "telegraph") {
      this.aiState = "recover";
      this.stateUntil = this.scene.time.now + 400;
      this.swingActive = false;
      this.swingHitbox = null;
    }
    return this.hp <= 0;
  }
}
