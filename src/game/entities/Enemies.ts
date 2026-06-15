import Phaser from "phaser";
import { applyTexture, resolveSprite } from "../systems/SpriteLibrary";

// ─── Animation helper ─────────────────────────────────────────────────────────
// Per-enemy random offset so all sprites don't flip frames in sync (global flicker).
const _animOffsets = new WeakMap<Phaser.Physics.Arcade.Sprite, number>();

function setEnemyTex(
  e: Phaser.Physics.Arcade.Sprite,
  t: number,
  prefix: string,
  state: "idle" | "walk" | "attack" | "hurt",
) {
  if (!_animOffsets.has(e)) _animOffsets.set(e, Math.random() * 2000 | 0);
  const offset = _animOffsets.get(e)!;
  // Source frames are inconsistent (not a coherent cycle). Use 1 frame for
  // idle/attack/hurt, and slow 2-frame alternation for walk so motion reads
  // without flicker.
  let frame = 0;
  if (state === "walk") frame = Math.floor((t + offset) / 220) % 2;
  const key = `tex-${prefix}-${state}${frame}`;
  applyTexture(e, key);
}


// ─── InkProjectile (Caneta Bic ranged attack) ────────────────────────────────
export class InkProjectile extends Phaser.Physics.Arcade.Sprite {
  damage = 12;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, ...resolveSprite("tex-inkproj"));
    scene.add.existing(this);
    scene.physics.add.existing(this);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setSize(10, 5);
    scene.time.delayedCall(1800, () => { if (this.active) this.destroy(); });
  }

  fire(facing: 1 | -1) {
    (this.body as Phaser.Physics.Arcade.Body).setVelocityX(facing * 380);
  }
}

// ─── Convite de Reunião (trap) ───────────────────────────────────────────────
export class ConviteReuniao extends Phaser.GameObjects.Sprite {
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, ...resolveSprite("tex-convite"));
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
    super(scene, x, y, ...resolveSprite("tex-postit"));
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDisplaySize(20, 20);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(14, 14);
    body.setAllowGravity(false);
  }

  fire(toX: number, toY: number) {
    const angle = Phaser.Math.Angle.Between(this.x, this.y, toX, toY);
    const speed = 190;
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
    this.scene.tweens.add({ targets: this, angle: 360, duration: 600, repeat: -1 });
    this.scene.time.delayedCall(3200, () => { if (this.active) this.destroy(); });
  }
}

export class EstagiarioDesesperado extends Phaser.Physics.Arcade.Sprite {
  hp = 12;
  contactDamage = 15;
  speed = 200;
  dir: 1 | -1;
  private _frozen = 0;
  private _hurtUntil = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, dir: 1 | -1 = -1) {
    super(scene, x, y, ...resolveSprite("tex-estagiario-idle0"));
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(10);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(20, 28);
    body.setOffset(1, 20); // offset.y = spriteH(48) - bodyH(28)
    body.setCollideWorldBounds(true);
    this.dir = dir;
    this.setFlipX(dir === -1);
  }

  preUpdate(t: number, dt: number) {
    super.preUpdate(t, dt);
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (t < this._frozen) {
      setEnemyTex(this, t, "estagiario", "hurt");
      return;
    }
    if (body.blocked.left) {
      this.dir = 1;
      this.setFlipX(false);
    } else if (body.blocked.right) {
      this.dir = -1;
      this.setFlipX(true);
    }
    body.setVelocityX(this.dir * this.speed);
    if (t < this._hurtUntil) {
      setEnemyTex(this, t, "estagiario", "hurt");
    } else {
      setEnemyTex(this, t, "estagiario", "walk");
    }
  }

  hit(damage: number, knockback: number) {
    const now = this.scene.time.now;
    this._frozen = Math.max(this._frozen, now + 75);
    this._hurtUntil = now + 180;
    this.hp -= damage;
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocityX(knockback);
    body.setVelocityY(-200);
    return this.hp <= 0;
  }

  applyFreeze(ms: number) { this._frozen = Math.max(this._frozen, this.scene.time.now + ms); }
}

// ─── Facilitador de Workshop ─────────────────────────────────────────────────
export class FacilitadorDeWorkshop extends Phaser.Physics.Arcade.Sprite {
  hp = 20;
  contactDamage = 0;
  speed = 100;
  dir: 1 | -1 = -1;
  private aiState: "walk" | "telegraph" | "shoot" | "cooldown" = "walk";
  private stateUntil = 0;
  private _frozen = 0;
  private _hurtUntil = 0;

  target?: Phaser.GameObjects.GameObject & { x: number; y: number };
  onShoot?: (fx: number, fy: number, tx: number, ty: number) => void;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, ...resolveSprite("tex-facilitador-idle0"));
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(10);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(24, 36);
    body.setOffset(0, 12); // offset.y = spriteH(48) - bodyH(36)
    body.setCollideWorldBounds(true);
  }

  preUpdate(t: number, dt: number) {
    super.preUpdate(t, dt);
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (t < this._frozen) { return; }
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
    // Animate texture
    if (t < this._hurtUntil) {
      setEnemyTex(this, t, "facilitador", "hurt");
    } else if (this.aiState === "telegraph" || this.aiState === "shoot") {
      setEnemyTex(this, t, "facilitador", "attack");
    } else if (this.aiState === "walk" || this.aiState === "cooldown") {
      setEnemyTex(this, t, "facilitador", "walk");
    } else {
      setEnemyTex(this, t, "facilitador", "idle");
    }
  }

  hit(damage: number, knockback: number) {
    const now = this.scene.time.now;
    this._frozen = Math.max(this._frozen, now + 75);
    this._hurtUntil = now + 180;
    this.hp -= damage;
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocityX(knockback);
    body.setVelocityY(-170);
    if (this.aiState === "telegraph") {
      this.aiState = "cooldown";
      this.stateUntil = now + 500;
    }
    return this.hp <= 0;
  }

  applyFreeze(ms: number) { this._frozen = Math.max(this._frozen, this.scene.time.now + ms); }
}

// ─── Scrum Master Caótico ────────────────────────────────────────────────────
export class ScrumMasterCaotico extends Phaser.Physics.Arcade.Sprite {
  hp = 25;
  contactDamage = 8;
  speed = 130;
  dir: 1 | -1 = -1;
  private aiState: "walk" | "charge" | "shout" | "recover" | "retro_tele" | "retro_slam" = "walk";
  private stateUntil = 0;
  private _frozen = 0;
  private _hurtUntil = 0;
  private retrospectivaCooldown = 0;

  isBoss = false;
  target?: Phaser.GameObjects.GameObject & { x: number; y: number };
  onShout?: (fromX: number, fromY: number) => void;
  onRetrospectiva?: (fromX: number, fromY: number) => void;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, ...resolveSprite("tex-scrum-idle0"));
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(10);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(26, 34);
    body.setOffset(0, 14); // offset.y = spriteH(48) - bodyH(34)
    body.setCollideWorldBounds(true);
  }

  preUpdate(t: number, dt: number) {
    super.preUpdate(t, dt);
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (t < this._frozen) { return; }
    if (this.target) {
      const dx = this.target.x - this.x;
      if (Math.abs(dx) < 340) this.dir = dx >= 0 ? 1 : -1;
    }
    this.setFlipX(this.dir === -1);

    switch (this.aiState) {
      case "walk": {
        body.setVelocityX(this.dir * this.speed);
        if (this.target) {
          const dist = Math.abs(this.target.x - this.x);
          if (this.isBoss && dist < 300 && t >= this.retrospectivaCooldown) {
            this.aiState = "retro_tele";
            this.stateUntil = t + 700;
            this.setTint(0xaa44ff);
            body.setVelocityX(0);
            const label = this.scene.add.text(this.x, this.y - 36, "RETROSPECTIVA!", {
              fontFamily: "monospace", fontSize: "14px", fontStyle: "bold",
              color: "#cc44ff", stroke: "#000000", strokeThickness: 3,
            }).setOrigin(0.5).setDepth(500);
            this.scene.tweens.add({
              targets: label, y: label.y - 30, alpha: 0, duration: 900,
              onComplete: () => label.destroy(),
            });
          } else if (dist < 320) {
            this.aiState = "charge";
            this.stateUntil = t + 500;
            this.setTint(0xff8800);
            body.setVelocityX(0);
          }
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
      case "retro_tele": {
        body.setVelocityX(0);
        if (t >= this.stateUntil) {
          this.aiState = "retro_slam";
          this.clearTint();
          this.setTint(0xff66ff);
          if (this.onRetrospectiva) this.onRetrospectiva(this.x, this.y);
          this.retrospectivaCooldown = t + 7000;
          this.stateUntil = t + 200;
        }
        break;
      }
      case "retro_slam": {
        body.setVelocityX(0);
        if (t >= this.stateUntil) {
          this.aiState = "recover";
          this.stateUntil = t + 1400;
          this.clearTint();
        }
        break;
      }
    }
    // Animate texture
    if (t < this._hurtUntil) {
      setEnemyTex(this, t, "scrum", "hurt");
    } else if (this.aiState === "charge" || this.aiState === "shout" || this.aiState === "retro_tele" || this.aiState === "retro_slam") {
      setEnemyTex(this, t, "scrum", "attack");
    } else if (this.aiState === "walk") {
      setEnemyTex(this, t, "scrum", "walk");
    } else {
      setEnemyTex(this, t, "scrum", "idle");
    }
  }

  hit(damage: number, knockback: number) {
    const now = this.scene.time.now;
    this._frozen = Math.max(this._frozen, now + 75);
    this._hurtUntil = now + 180;
    this.hp -= damage;
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocityX(knockback);
    body.setVelocityY(-160);
    if (this.aiState === "charge") {
      this.aiState = "recover";
      this.stateUntil = now + 500;
    }
    return this.hp <= 0;
  }

  applyFreeze(ms: number) { this._frozen = Math.max(this._frozen, this.scene.time.now + ms); }
}

// ─── Coordenador de Sinergia ─────────────────────────────────────────────────
export class CoordenadorDeSinergia extends Phaser.Physics.Arcade.Sprite {
  hp = 40;
  contactDamage = 5;
  speed = 60;
  dir: 1 | -1 = -1;
  private _frozen = 0;
  private _hurtUntil = 0;

  // Buff aura: set by preUpdate, consumed by OpenSpaceScene
  isBuffing = false;
  private nextBuffAt = 0;

  target?: { x: number; y: number };

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, ...resolveSprite("tex-coordenador-idle0"));
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(10);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(28, 40);
    body.setOffset(0, 8); // offset.y = spriteH(48) - bodyH(40)
    body.setCollideWorldBounds(true);
  }

  preUpdate(t: number, dt: number) {
    super.preUpdate(t, dt);
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (t < this._frozen) { return; }
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
    // Animate texture (tint override during buff is fine — keeps aura signal)
    if (t < this._hurtUntil) {
      setEnemyTex(this, t, "coordenador", "hurt");
    } else if (Math.abs((this.body as Phaser.Physics.Arcade.Body).velocity.x) > 10) {
      setEnemyTex(this, t, "coordenador", "walk");
    } else {
      setEnemyTex(this, t, "coordenador", "idle");
    }
  }

  hit(damage: number, knockback: number) {
    const now = this.scene.time.now;
    this._frozen = Math.max(this._frozen, now + 75);
    this._hurtUntil = now + 180;
    this.hp -= damage;
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocityX(knockback * 0.6);
    body.setVelocityY(-150);
    return this.hp <= 0;
  }

  applyFreeze(ms: number) { this._frozen = Math.max(this._frozen, this.scene.time.now + ms); }
}

// ─── Analista Sênior Exausto ─────────────────────────────────────────────────
export class AnalistaSeniorExausto extends Phaser.Physics.Arcade.Sprite {
  hp = 80;
  contactDamage = 5;
  speed = 45;

  dir: 1 | -1 = -1;
  private aiState: "walk" | "telegraph" | "slam" | "exhausted" = "walk";
  private stateUntil = 0;
  private _frozen = 0;
  private _hurtUntil = 0;

  swingHitbox: Phaser.Geom.Rectangle | null = null;
  swingActive = false;
  swingDamage = 35;

  target?: Phaser.GameObjects.GameObject & { x: number; y: number };

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, ...resolveSprite("tex-senior-idle0"));
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(10);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(30, 44);
    body.setOffset(0, 4); // offset.y = spriteH(48) - bodyH(44)
    body.setCollideWorldBounds(true);
  }

  preUpdate(t: number, dt: number) {
    super.preUpdate(t, dt);
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (t < this._frozen) { return; }
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
    // Animate texture
    if (t < this._hurtUntil) {
      setEnemyTex(this, t, "senior", "hurt");
    } else if (this.aiState === "telegraph" || this.aiState === "slam") {
      setEnemyTex(this, t, "senior", "attack");
    } else if (this.aiState === "walk") {
      setEnemyTex(this, t, "senior", "walk");
    } else {
      setEnemyTex(this, t, "senior", "idle");
    }
  }

  hit(damage: number, knockback: number) {
    const now = this.scene.time.now;
    this._frozen = Math.max(this._frozen, now + 75);
    this._hurtUntil = now + 180;
    this.hp -= damage;
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocityX(knockback * 0.25);
    body.setVelocityY(-60);
    if (this.aiState === "telegraph") {
      this.aiState = "exhausted";
      this.stateUntil = now + 700;
      this.swingActive = false;
      this.swingHitbox = null;
    }
    return this.hp <= 0;
  }

  applyFreeze(ms: number) { this._frozen = Math.max(this._frozen, this.scene.time.now + ms); }
}

export class AnalistaJunior extends Phaser.Physics.Arcade.Sprite {
  hp = 30;
  contactDamage = 0;
  swingDamage = 20;
  speed = 80;
  dir: 1 | -1 = -1;
  private aiState: "walk" | "telegraph" | "swing" | "recover" = "walk";
  private stateUntil = 0;
  private _frozen = 0;
  private _hurtUntil = 0;
  swingHitbox: Phaser.Geom.Rectangle | null = null;
  swingActive = false;
  private lastSeenAt = 0;

  target?: Phaser.GameObjects.GameObject & { x: number; y: number };

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, ...resolveSprite("tex-analista-idle0"));
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(10);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(24, 36);
    body.setOffset(2, 12); // offset.y = spriteH(48) - bodyH(36)
    body.setCollideWorldBounds(true);
  }

  preUpdate(t: number, dt: number) {
    super.preUpdate(t, dt);
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (t < this._frozen) { return; }

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
    // Animate texture
    if (t < this._hurtUntil) {
      setEnemyTex(this, t, "analista", "hurt");
    } else if (this.aiState === "telegraph" || this.aiState === "swing") {
      setEnemyTex(this, t, "analista", "attack");
    } else if (this.aiState === "walk") {
      setEnemyTex(this, t, "analista", "walk");
    } else {
      setEnemyTex(this, t, "analista", "idle");
    }
  }

  hit(damage: number, knockback: number) {
    const now = this.scene.time.now;
    this._frozen = Math.max(this._frozen, now + 75);
    this._hurtUntil = now + 180;
    this.hp -= damage;
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocityX(knockback);
    body.setVelocityY(-180);
    if (this.aiState === "swing" || this.aiState === "telegraph") {
      this.aiState = "recover";
      this.stateUntil = now + 300;
      this.swingActive = false;
      this.swingHitbox = null;
    }
    return this.hp <= 0;
  }

  applyFreeze(ms: number) { this._frozen = Math.max(this._frozen, this.scene.time.now + ms); }
}
