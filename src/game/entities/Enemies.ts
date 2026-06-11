import Phaser from "phaser";

// ─── Convite de Reunião (trap) ───────────────────────────────────────────────
export class ConviteReuniao extends Phaser.GameObjects.Sprite {
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, "tex-convite");
    scene.add.existing(this);
    scene.tweens.add({
      targets: this, y: y + 14,
      duration: Phaser.Math.Between(850, 1150),
      yoyo: true, repeat: -1, ease: "Sine.easeInOut",
    });
  }
}

// ─── PostIt projectile (used by FacilitadorDeWorkshop) ────────────────────────
export class PostIt extends Phaser.Physics.Arcade.Sprite {
  sanityDamage = 12;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, "tex-postit");
    scene.add.existing(this);
    scene.physics.add.existing(this);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(14, 14);
    body.setAllowGravity(false);
  }

  fire(toX: number, toY: number) {
    const angle = Phaser.Math.Angle.Between(this.x, this.y, toX, toY);
    const speed = 190;
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
    this.scene.time.delayedCall(3200, () => { if (this.active) this.destroy(); });
  }
}

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

// ─── Facilitador de Workshop ─────────────────────────────────────────────────
export class FacilitadorDeWorkshop extends Phaser.Physics.Arcade.Sprite {
  hp = 2;
  contactDamage = 0;
  speed = 100;
  dir: 1 | -1 = -1;
  private aiState: "walk" | "telegraph" | "shoot" | "cooldown" = "walk";
  private stateUntil = 0;

  target?: Phaser.GameObjects.GameObject & { x: number; y: number };
  onShoot?: (fx: number, fy: number, tx: number, ty: number) => void;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, "tex-facilitador");
    scene.add.existing(this);
    scene.physics.add.existing(this);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(24, 36);
    body.setCollideWorldBounds(true);
  }

  preUpdate(t: number, dt: number) {
    super.preUpdate(t, dt);
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (this.target) {
      const dx = this.target.x - this.x;
      if (Math.abs(dx) < 300) this.dir = dx >= 0 ? 1 : -1;
    }
    this.setFlipX(this.dir === -1);

    switch (this.aiState) {
      case "walk": {
        body.setVelocityX(this.dir * this.speed);
        const dist = this.target ? Math.abs(this.target.x - this.x) : 9999;
        if (dist > 70 && dist < 280) {
          this.aiState = "telegraph";
          this.stateUntil = t + 350;
          this.setTint(0xffee22);
          body.setVelocityX(0);
        }
        break;
      }
      case "telegraph": {
        body.setVelocityX(0);
        if (t >= this.stateUntil) {
          this.aiState = "shoot";
          this.clearTint();
          if (this.target && this.onShoot) {
            this.onShoot(this.x, this.y - 10, this.target.x, this.target.y);
          }
          this.stateUntil = t + 180;
        }
        break;
      }
      case "shoot": {
        body.setVelocityX(0);
        if (t >= this.stateUntil) {
          this.aiState = "cooldown";
          this.stateUntil = t + 1600;
        }
        break;
      }
      case "cooldown": {
        body.setVelocityX(this.dir * this.speed * 0.6);
        if (t >= this.stateUntil) this.aiState = "walk";
        break;
      }
    }
  }

  hit(damage: number, knockback: number) {
    this.hp -= damage;
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocityX(knockback);
    body.setVelocityY(-170);
    this.setTint(0xffffff);
    this.scene.time.delayedCall(80, () => this.clearTint());
    if (this.aiState === "telegraph") {
      this.aiState = "cooldown";
      this.stateUntil = this.scene.time.now + 500;
    }
    return this.hp <= 0;
  }
}

// ─── Scrum Master Caótico ────────────────────────────────────────────────────
export class ScrumMasterCaotico extends Phaser.Physics.Arcade.Sprite {
  hp = 2;
  contactDamage = 8;
  speed = 130;
  dir: 1 | -1 = -1;
  private aiState: "walk" | "charge" | "shout" | "recover" = "walk";
  private stateUntil = 0;

  target?: Phaser.GameObjects.GameObject & { x: number; y: number };
  onShout?: (fromX: number, fromY: number) => void;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, "tex-scrum");
    scene.add.existing(this);
    scene.physics.add.existing(this);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(26, 34);
    body.setCollideWorldBounds(true);
  }

  preUpdate(t: number, dt: number) {
    super.preUpdate(t, dt);
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (this.target) {
      const dx = this.target.x - this.x;
      if (Math.abs(dx) < 340) this.dir = dx >= 0 ? 1 : -1;
    }
    this.setFlipX(this.dir === -1);

    switch (this.aiState) {
      case "walk": {
        body.setVelocityX(this.dir * this.speed);
        if (this.target && Math.abs(this.target.x - this.x) < 320) {
          this.aiState = "charge";
          this.stateUntil = t + 500;
          this.setTint(0xff8800);
          body.setVelocityX(0);
        }
        break;
      }
      case "charge": {
        body.setVelocityX(0);
        if (t >= this.stateUntil) {
          this.aiState = "shout";
          this.clearTint();
          this.setTint(0xff3300);
          if (this.onShout) this.onShout(this.x, this.y);
          // spawn floating "DAILY!" text
          const label = this.scene.add.text(this.x, this.y - 30, "DAILY!", {
            fontFamily: "monospace", fontSize: "16px", fontStyle: "bold",
            color: "#ff4400", stroke: "#000000", strokeThickness: 3,
          }).setOrigin(0.5).setDepth(500);
          this.scene.tweens.add({
            targets: label, y: label.y - 40, alpha: 0, duration: 800,
            onComplete: () => label.destroy(),
          });
          this.stateUntil = t + 120;
        }
        break;
      }
      case "shout": {
        body.setVelocityX(0);
        if (t >= this.stateUntil) {
          this.aiState = "recover";
          this.stateUntil = t + 900;
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
    body.setVelocityX(knockback);
    body.setVelocityY(-160);
    this.setTint(0xffffff);
    this.scene.time.delayedCall(80, () => this.clearTint());
    if (this.aiState === "charge") {
      this.aiState = "recover";
      this.stateUntil = this.scene.time.now + 500;
    }
    return this.hp <= 0;
  }
}

// ─── Coordenador de Sinergia ─────────────────────────────────────────────────
export class CoordenadorDeSinergia extends Phaser.Physics.Arcade.Sprite {
  hp = 4;
  contactDamage = 5;
  speed = 60;
  dir: 1 | -1 = -1;

  // Buff aura: set by preUpdate, consumed by OpenSpaceScene
  isBuffing = false;
  private nextBuffAt = 0;

  target?: { x: number; y: number };

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, "tex-coordenador");
    scene.add.existing(this);
    scene.physics.add.existing(this);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(28, 40);
    body.setCollideWorldBounds(true);
  }

  preUpdate(t: number, dt: number) {
    super.preUpdate(t, dt);
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (this.target) {
      const dx = this.target.x - this.x;
      if (Math.abs(dx) < 420) this.dir = dx >= 0 ? 1 : -1;
    }
    this.setFlipX(this.dir === -1);
    body.setVelocityX(this.dir * this.speed);

    if (t >= this.nextBuffAt) {
      this.nextBuffAt = t + 3200;
      this.isBuffing = true;
      this.setTint(0x44ff88);
      // Spawn aura ring visual
      const ring = this.scene.add.graphics().setDepth(400);
      ring.lineStyle(2, 0x44ff88, 0.8);
      ring.strokeCircle(this.x, this.y, 160);
      this.scene.tweens.add({
        targets: ring, alpha: 0, scaleX: 1.4, scaleY: 1.4,
        duration: 700, onComplete: () => { this.isBuffing = false; this.clearTint(); ring.destroy(); },
      });
    }
  }

  hit(damage: number, knockback: number) {
    this.hp -= damage;
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocityX(knockback * 0.6);
    body.setVelocityY(-150);
    this.setTint(0xffffff);
    this.scene.time.delayedCall(80, () => this.clearTint());
    return this.hp <= 0;
  }
}

// ─── Analista Sênior Exausto ─────────────────────────────────────────────────
export class AnalistaSeniorExausto extends Phaser.Physics.Arcade.Sprite {
  hp = 8;
  contactDamage = 5;
  speed = 45;
  dir: 1 | -1 = -1;
  private aiState: "walk" | "telegraph" | "slam" | "exhausted" = "walk";
  private stateUntil = 0;

  swingHitbox: Phaser.Geom.Rectangle | null = null;
  swingActive = false;
  swingDamage = 35;

  target?: Phaser.GameObjects.GameObject & { x: number; y: number };

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, "tex-senior");
    scene.add.existing(this);
    scene.physics.add.existing(this);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(30, 44);
    body.setCollideWorldBounds(true);
  }

  preUpdate(t: number, dt: number) {
    super.preUpdate(t, dt);
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (this.target) {
      const dx = this.target.x - this.x;
      if (Math.abs(dx) < 380) this.dir = dx >= 0 ? 1 : -1;
    }
    this.setFlipX(this.dir === -1);

    switch (this.aiState) {
      case "walk": {
        body.setVelocityX(this.dir * this.speed);
        if (this.target && Math.abs(this.target.x - this.x) < 58) {
          this.aiState = "telegraph";
          this.stateUntil = t + 650;
          this.setTint(0xdd3333);
          body.setVelocityX(0);
        }
        break;
      }
      case "telegraph": {
        body.setVelocityX(0);
        if (t >= this.stateUntil) {
          this.aiState = "slam";
          this.clearTint();
          this.setTint(0xff1111);
          this.swingHitbox = new Phaser.Geom.Rectangle(
            this.dir === 1 ? this.x + 4 : this.x - 46,
            this.y - 18, 46, 38,
          );
          this.swingActive = true;
          this.stateUntil = t + 200;
          // slam impact text
          const txt = this.scene.add.text(this.x + this.dir * 30, this.y - 20, "SLAM!", {
            fontFamily: "monospace", fontSize: "14px", fontStyle: "bold",
            color: "#ff2222", stroke: "#000000", strokeThickness: 3,
          }).setOrigin(0.5).setDepth(500);
          this.scene.tweens.add({
            targets: txt, y: txt.y - 30, alpha: 0, duration: 600,
            onComplete: () => txt.destroy(),
          });
        }
        break;
      }
      case "slam": {
        body.setVelocityX(0);
        if (t >= this.stateUntil) {
          this.aiState = "exhausted";
          this.swingActive = false;
          this.swingHitbox = null;
          this.clearTint();
          this.setTint(0x888888);
          this.stateUntil = t + 1600;
        }
        break;
      }
      case "exhausted": {
        body.setVelocityX(0);
        if (t >= this.stateUntil) {
          this.aiState = "walk";
          this.clearTint();
        }
        break;
      }
    }
  }

  hit(damage: number, knockback: number) {
    this.hp -= damage;
    const body = this.body as Phaser.Physics.Arcade.Body;
    // Tanky: muito resistente a knockback
    body.setVelocityX(knockback * 0.25);
    body.setVelocityY(-60);
    this.setTint(0xffffff);
    this.scene.time.delayedCall(80, () => this.clearTint());
    if (this.aiState === "telegraph") {
      this.aiState = "exhausted";
      this.stateUntil = this.scene.time.now + 700;
      this.swingActive = false;
      this.swingHitbox = null;
    }
    return this.hp <= 0;
  }
}

export class AnalistaJunior extends Phaser.Physics.Arcade.Sprite {
  hp = 3;
  contactDamage = 0;
  swingDamage = 20;
  speed = 80;
  dir: 1 | -1 = -1;
  private aiState: "walk" | "telegraph" | "swing" | "recover" = "walk";
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

    switch (this.aiState) {
      case "walk": {
        body.setVelocityX(this.dir * this.speed);
        if (this.target && Math.abs(this.target.x - this.x) < 44) {
          this.aiState = "telegraph";
          this.stateUntil = t + 400;
          this.setTint(0xffdd66);
          body.setVelocityX(0);
        }
        break;
      }
      case "telegraph": {
        body.setVelocityX(0);
        if (t >= this.stateUntil) {
          this.aiState = "swing";
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
          this.aiState = "recover";
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
          this.aiState = "walk";
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
    if (this.aiState === "swing" || this.aiState === "telegraph") {
      this.aiState = "recover";
      this.stateUntil = this.scene.time.now + 300;
      this.swingActive = false;
      this.swingHitbox = null;
    }
    return this.hp <= 0;
  }
}
