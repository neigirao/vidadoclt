import Phaser from "phaser";
import { applyTexture, resolveSprite } from "../systems/SpriteLibrary";
import { noise2d } from "../systems/CorporateAI";
import { markKilled } from "../systems/BestiarySystem";

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
    super(scene, x, y, "sprites", "item-postit-active0");
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(8);
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
    const tween = this.scene.tweens.add({ targets: this, angle: 360, duration: 600, repeat: -1 });
    this.scene.time.delayedCall(3200, () => {
      tween.stop();
      if (this.active) {
        this.setActive(false).setVisible(false);
        (this.body as Phaser.Physics.Arcade.Body).enable = false;
      }
    });
  }
}

export class EstagiarioDesesperado extends Phaser.Physics.Arcade.Sprite {
  hp = 12;
  contactDamage = 15;
  speed = 200;
  dir: 1 | -1;
  private _frozen = 0;
  private _hurtUntil = 0;
  // Unique noise offset so each instance wanders independently
  private _noiseOffset: number;

  constructor(scene: Phaser.Scene, x: number, y: number, dir: 1 | -1 = -1) {
    super(scene, x, y, ...resolveSprite("tex-estagiario-idle0"));
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(10);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(20, 28);
    body.setOffset(14, 36); // sprite 48×64: x=(48-20)/2, y=64-28
    body.setCollideWorldBounds(true);
    this.dir = dir;
    this.setFlipX(dir === -1);
    this._noiseOffset = Math.random() * 1000;
  }

  preUpdate(t: number, dt: number) {
    super.preUpdate(t, dt);
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (t < this._frozen) {
      setEnemyTex(this, t, "estagiario", "hurt");
      return;
    }

    // Organic wandering via Simplex noise:
    // x-axis: slow spatial variation → speed multiplier (0.6–1.4)
    // y-axis: time → spontaneous direction flips when noise dips below -0.8
    const n = noise2d(this._noiseOffset + this.x * 0.004, t * 0.00025);
    const speedMult = 0.7 + (n + 1) * 0.35; // maps [-1,1] → [0.7, 1.4]

    if (body.blocked.left) {
      this.dir = 1;
      this.setFlipX(false);
    } else if (body.blocked.right) {
      this.dir = -1;
      this.setFlipX(true);
    } else if (n < -0.82) {
      // Noise-driven spontaneous turn (feels like second-guessing)
      this.dir = this.dir === 1 ? -1 : 1;
      this.setFlipX(this.dir === -1);
    }

    body.setVelocityX(this.dir * this.speed * speedMult);

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
    if (this.hp <= 0) markKilled("estagiario_desesperado");
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
    body.setOffset(12, 28); // sprite 48×64: x=(48-24)/2, y=64-36
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
    if (this.hp <= 0) markKilled("facilitador_workshop");
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
    body.setOffset(11, 30); // sprite 48×64: x=(48-26)/2, y=64-34
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
          if (dist < 300 && t >= this.retrospectivaCooldown) {
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
    if (this.hp <= 0) markKilled("scrum_master_caotico");
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

  isBuffing = false;
  private nextBuffAt = 0;
  /** Callback disparado quando o buff ativa — cena injeta lógica de heal nos aliados próximos */
  onBuff?: (cx: number, cy: number, radius: number) => void;

  target?: { x: number; y: number };
  onHpChange?: (hp: number, maxHp: number) => void;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    // Band-aid: usa sprites limpos do enemy-coordenador até ter arte nova do boss
    super(scene, x, y, ...resolveSprite("tex-coordenador-idle0"));
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(10);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(32, 48);
    body.setOffset(8, 16); // sprite 48×64: x=(48-32)/2, y=64-48
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
      this.onBuff?.(this.x, this.y, 160);
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
    this._frozen = Math.max(this._frozen, now + 110);
    this._hurtUntil = now + 180;
    this.hp -= damage;
    this.onHpChange?.(this.hp, this.hp + damage);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocityX(knockback * 0.6);
    body.setVelocityY(-150);
    if (this.hp <= 0) markKilled("coordenador_sinergia");
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
  onHpChange?: (hp: number, maxHp: number) => void;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, ...resolveSprite("tex-senior-idle0"));
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(10);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(22, 36);
    body.setOffset(13, 26); // sprite 48×64: x=(48-22)/2, y=64-36-2
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
    this._frozen = Math.max(this._frozen, now + 110);
    this._hurtUntil = now + 180;
    this.hp -= damage;
    this.onHpChange?.(this.hp, this.hp + damage);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocityX(knockback * 0.25);
    body.setVelocityY(-60);
    if (this.aiState === "telegraph") {
      this.aiState = "exhausted";
      this.stateUntil = now + 700;
      this.swingActive = false;
      this.swingHitbox = null;
    }
    if (this.hp <= 0) markKilled("analista_senior_exausto");
    return this.hp <= 0;
  }

  applyFreeze(ms: number) { this._frozen = Math.max(this._frozen, this.scene.time.now + ms); }
}

// ─── EnemyRH (Analista de RH) ─────────────────────────────────────────────────
export class EnemyRH extends Phaser.Physics.Arcade.Sprite {
  hp = 55;
  contactDamage = 8;
  speed = 85;
  dir: 1 | -1 = -1;
  private aiState: "walk" | "telegraph" | "swing" | "recover" = "walk";
  private stateUntil = 0;
  private _frozen = 0;
  private _hurtUntil = 0;
  swingHitbox: Phaser.Geom.Rectangle | null = null;
  swingActive = false;
  swingDamage = 18;

  target?: Phaser.GameObjects.GameObject & { x: number; y: number };

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, ...resolveSprite("tex-rh-idle0"));
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(10);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(22, 34);
    body.setOffset(11, 30); // sprite ~48×64: x=(48-22)/2, y=64-34
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
        if (this.target && Math.abs(this.target.x - this.x) < 48) {
          this.aiState = "telegraph";
          this.stateUntil = t + 380;
          this.setTint(0xff88bb);
          body.setVelocityX(0);
        }
        break;
      }
      case "telegraph": {
        body.setVelocityX(0);
        if (t >= this.stateUntil) {
          this.aiState = "swing";
          this.stateUntil = t + 150;
          this.clearTint();
          this.setTint(0xff3377);
          this.swingHitbox = new Phaser.Geom.Rectangle(
            this.dir === 1 ? this.x + 6 : this.x - 38,
            this.y - 10,
            32,
            30,
          );
          this.swingActive = true;
        }
        break;
      }
      case "swing": {
        body.setVelocityX(0);
        if (t >= this.stateUntil) {
          this.aiState = "recover";
          this.stateUntil = t + 500;
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
    // Animate texture
    if (t < this._hurtUntil) {
      setEnemyTex(this, t, "rh", "hurt");
    } else if (this.aiState === "telegraph" || this.aiState === "swing") {
      setEnemyTex(this, t, "rh", "attack");
    } else if (this.aiState === "walk") {
      setEnemyTex(this, t, "rh", "walk");
    } else {
      setEnemyTex(this, t, "rh", "idle");
    }
  }

  hit(damage: number, knockback: number) {
    const now = this.scene.time.now;
    this._frozen = Math.max(this._frozen, now + 75);
    this._hurtUntil = now + 180;
    this.hp -= damage;
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocityX(knockback);
    body.setVelocityY(-190);
    if (this.aiState === "swing" || this.aiState === "telegraph") {
      this.aiState = "recover";
      this.stateUntil = now + 350;
      this.swingActive = false;
      this.swingHitbox = null;
    }
    if (this.hp <= 0) markKilled("enemy_rh");
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
    body.setOffset(12, 28); // sprite 48×64: x=(48-24)/2, y=64-36
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
    if (this.hp <= 0) markKilled("analista_junior");
    return this.hp <= 0;
  }

  applyFreeze(ms: number) { this._frozen = Math.max(this._frozen, this.scene.time.now + ms); }
}

// ─── EstagiarioSobrecarregado ─────────────────────────────────────────────────
// Variante B do estagiário: carrega mais tarefas, persegue o player ativamente,
// animação de 5 frames de walk.
export class EstagiarioSobrecarregado extends Phaser.Physics.Arcade.Sprite {
  hp = 22;
  contactDamage = 12;
  speed = 180;
  dir: 1 | -1 = -1;
  private _frozen = 0;
  private _hurtUntil = 0;
  private _animOffset: number;

  target?: Phaser.GameObjects.GameObject & { x: number; y: number };

  constructor(scene: Phaser.Scene, x: number, y: number, dir: 1 | -1 = -1) {
    super(scene, x, y, ...resolveSprite("tex-estagiario-b-idle0"));
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(10);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(20, 28);
    body.setOffset(14, 36);
    body.setCollideWorldBounds(true);
    this.dir = dir;
    this.setFlipX(dir === -1);
    this._animOffset = Math.random() * 2000 | 0;
  }

  preUpdate(t: number, dt: number) {
    super.preUpdate(t, dt);
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (t < this._frozen) {
      applyTexture(this, "tex-estagiario-b-hurt0");
      return;
    }

    if (this.target) {
      const dx = this.target.x - this.x;
      this.dir = dx >= 0 ? 1 : -1;
    } else {
      if (body.blocked.left) this.dir = 1;
      else if (body.blocked.right) this.dir = -1;
    }
    this.setFlipX(this.dir === -1);
    body.setVelocityX(this.dir * this.speed);

    if (t < this._hurtUntil) {
      applyTexture(this, "tex-estagiario-b-hurt0");
    } else {
      const frame = Math.floor((t + this._animOffset) / 180) % 5;
      applyTexture(this, `tex-estagiario-b-walk${frame}`);
    }
  }

  hit(damage: number, knockback: number): boolean {
    const now = this.scene.time.now;
    this._frozen = Math.max(this._frozen, now + 75);
    this._hurtUntil = now + 180;
    this.hp -= damage;
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocityX(knockback);
    body.setVelocityY(-180);
    if (this.hp <= 0) markKilled("estagiario_sobrecarregado");
    return this.hp <= 0;
  }

  applyFreeze(ms: number) { this._frozen = Math.max(this._frozen, this.scene.time.now + ms); }
}

// ─── AnalistaOnboarding ───────────────────────────────────────────────────────
// Analista Novo: mantém distância, dispara PostIts nervosos, 5 frames de walk.
export class AnalistaOnboarding extends Phaser.Physics.Arcade.Sprite {
  hp = 18;
  contactDamage = 0;
  speed = 90;
  dir: 1 | -1 = -1;
  private _frozen = 0;
  private _hurtUntil = 0;
  private _nextFireAt = 0;
  private _animOffset: number;

  target?: Phaser.GameObjects.GameObject & { x: number; y: number };
  onShoot?: (fx: number, fy: number, tx: number, ty: number) => void;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, ...resolveSprite("tex-analista-novo-idle0"));
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(10);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(24, 36);
    body.setOffset(12, 28);
    body.setCollideWorldBounds(true);
    this._animOffset = Math.random() * 2000 | 0;
    this._nextFireAt = scene.time.now + 2000 + Math.random() * 1000;
  }

  preUpdate(t: number, dt: number) {
    super.preUpdate(t, dt);
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (t < this._frozen) {
      applyTexture(this, "tex-analista-novo-hurt0");
      return;
    }

    if (this.target) {
      const dx = this.target.x - this.x;
      const dist = Math.abs(dx);
      if (dist < 100) {
        this.dir = dx >= 0 ? -1 : 1; // foge se muito perto
      } else if (dist > 220) {
        this.dir = dx >= 0 ? 1 : -1;
      }
      body.setVelocityX(this.dir * this.speed);
      this.setFlipX(this.dir === -1);

      if (t >= this._nextFireAt && dist < 300) {
        this._nextFireAt = t + 1200;
        this.onShoot?.(this.x, this.y - 10, this.target.x, (this.target as any).y ?? this.y);
      }
    } else {
      if (body.blocked.left) this.dir = 1;
      else if (body.blocked.right) this.dir = -1;
      body.setVelocityX(this.dir * this.speed * 0.5);
      this.setFlipX(this.dir === -1);
    }

    if (t < this._hurtUntil) {
      applyTexture(this, "tex-analista-novo-hurt0");
    } else {
      const frame = Math.floor((t + this._animOffset) / 190) % 5;
      applyTexture(this, `tex-analista-novo-walk${frame}`);
    }
  }

  hit(damage: number, knockback: number): boolean {
    const now = this.scene.time.now;
    this._frozen = Math.max(this._frozen, now + 75);
    this._hurtUntil = now + 180;
    this.hp -= damage;
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocityX(knockback);
    body.setVelocityY(-150);
    if (this.hp <= 0) markKilled("analista_onboarding");
    return this.hp <= 0;
  }

  applyFreeze(ms: number) { this._frozen = Math.max(this._frozen, this.scene.time.now + ms); }
}
