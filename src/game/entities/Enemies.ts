import Phaser from "phaser";

export class EstagiarioDesesperado extends Phaser.Physics.Arcade.Sprite {
  hp = 1;
  contactDamage = 15;
  speed = 200;
  dir: 1 | -1;

  constructor(scene: Phaser.Scene, x: number, y: number, dir: 1 | -1 = -1) {
    super(scene, x, y, "tex-estagiario");
    scene.add.existing(this);
    scene.physics.add.existing(this);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(20, 28);
    body.setOffset(1, 1);
    body.setCollideWorldBounds(true);
    this.dir = dir;
    this.setFlipX(dir === -1);
  }

  preUpdate(t: number, dt: number) {
    super.preUpdate(t, dt);
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (body.blocked.left) {
      this.dir = 1;
      this.setFlipX(false);
    } else if (body.blocked.right) {
      this.dir = -1;
      this.setFlipX(true);
    }
    body.setVelocityX(this.dir * this.speed);
  }

  hit(damage: number, knockback: number) {
    this.hp -= damage;
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocityX(knockback);
    body.setVelocityY(-200);
    this.setTint(0xffffff);
    this.scene.time.delayedCall(80, () => this.clearTint());
    return this.hp <= 0;
  }
}

export class AnalistaJunior extends Phaser.Physics.Arcade.Sprite {
  hp = 3;
  contactDamage = 0;
  swingDamage = 20;
  speed = 80;
  dir: 1 | -1 = -1;
  private state: "walk" | "telegraph" | "swing" | "recover" = "walk";
  private stateUntil = 0;
  swingHitbox: Phaser.Geom.Rectangle | null = null;
  swingActive = false;
  private lastSeenAt = 0;

  target?: Phaser.GameObjects.GameObject & { x: number; y: number };

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, "tex-analista");
    scene.add.existing(this);
    scene.physics.add.existing(this);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(24, 36);
    body.setOffset(2, 1);
    body.setCollideWorldBounds(true);
  }

  preUpdate(t: number, dt: number) {
    super.preUpdate(t, dt);
    const body = this.body as Phaser.Physics.Arcade.Body;

    if (this.target) {
      const dx = this.target.x - this.x;
      if (Math.abs(dx) < 280) {
        this.dir = dx >= 0 ? 1 : -1;
      }
    }
    this.setFlipX(this.dir === -1);

    switch (this.state) {
      case "walk": {
        body.setVelocityX(this.dir * this.speed);
        if (this.target && Math.abs(this.target.x - this.x) < 44) {
          this.state = "telegraph";
          this.stateUntil = t + 400;
          this.setTint(0xffdd66);
          body.setVelocityX(0);
        }
        break;
      }
      case "telegraph": {
        body.setVelocityX(0);
        if (t >= this.stateUntil) {
          this.state = "swing";
          this.stateUntil = t + 140;
          this.clearTint();
          this.setTint(0xff5555);
          this.swingHitbox = new Phaser.Geom.Rectangle(
            this.dir === 1 ? this.x + 8 : this.x - 36,
            this.y - 8,
            28,
            28,
          );
          this.swingActive = true;
          this.lastSeenAt = t;
        }
        break;
      }
      case "swing": {
        body.setVelocityX(0);
        if (t >= this.stateUntil) {
          this.state = "recover";
          this.stateUntil = t + 400;
          this.swingActive = false;
          this.swingHitbox = null;
          this.clearTint();
        }
        break;
      }
      case "recover": {
        body.setVelocityX(0);
        if (t >= this.stateUntil) {
          this.state = "walk";
        }
        break;
      }
    }
  }

  hit(damage: number, knockback: number) {
    this.hp -= damage;
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocityX(knockback);
    body.setVelocityY(-180);
    this.setTint(0xffffff);
    this.scene.time.delayedCall(80, () => this.clearTint());
    if (this.state === "swing" || this.state === "telegraph") {
      this.state = "recover";
      this.stateUntil = this.scene.time.now + 300;
      this.swingActive = false;
      this.swingHitbox = null;
    }
    return this.hp <= 0;
  }
}
