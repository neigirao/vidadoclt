import Phaser from "phaser";
import { applyTexture, resolveSprite } from "../systems/SpriteLibrary";
import { fxGlow } from "./Enemies";

const HIT_INVULN_MS = 400;

export class CeoBoss extends Phaser.Physics.Arcade.Sprite {
  hp = 500;
  maxHp = 500;
  contactDamage = 18;
  speed = 60;
  phase: 1 | 2 | 3 = 1;

  target?: Phaser.Physics.Arcade.Sprite;
  onDeath?: () => void;
  onSummon?: (x: number, y: number) => void;
  onGoldenParachute?: (x: number, y: number) => void;
  onDemissao?: () => void;
  onSpread?: (x: number, y: number, facing: number) => void;
  onMelee?: (hb: Phaser.Geom.Rectangle) => void;
  onHpChange?: (hp: number, maxHp: number) => void;

  swingHitbox: Phaser.Geom.Rectangle | null = null;
  swingActive = false;
  swingDamage = 25;

  private _invulnUntil = 0;
  private _dying = false;
  private _frozen = 0;
  private _slow = 0;
  private _dir: 1 | -1 = -1;

  // Phase 1 timers
  private _nextMeleeAt = 0;
  private _nextSummonAt = 0;
  // Phase 2 timers
  private _nextChargeAt = 0;
  private _nextParachuteAt = 0;
  private _chargeUntil = 0;
  private _charging = false;
  // Phase 3 timers
  private _nextDemissaoAt = 0;
  private _nextSpreadAt = 0;

  // Animation
  private _animState: "run" | "attack" | "special" = "run";
  private _animFrame = 0;
  private _animNextAt = 0;
  private _animLockUntil = 0;
  private _hurtUntil = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, ...resolveSprite("tex-ceo"));
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(10);
    const body = this.body as Phaser.Physics.Arcade.Body;
    // sprite 128×128; body cobre torso/pernas, centrado horizontalmente
    body.setSize(52, 90);
    body.setOffset(38, 30);
    body.setCollideWorldBounds(true);

    const now = scene.time.now;
    this._nextMeleeAt = now + 2500;
    this._nextSummonAt = now + 5000;
    this._nextChargeAt = now + 2000;
    this._nextParachuteAt = now + 4000;
    this._nextDemissaoAt = now + 6000;
    this._nextSpreadAt = now + 3000;
  }

  private _applyAnimFrame(t: number) {
    // Death animation takes highest priority
    if (this._dying) {
      const f = Math.floor(t / 380) % 2;
      applyTexture(this, `tex-boss-ceo-death${f}`);
      return;
    }
    // Hurt takes priority
    if (t < this._hurtUntil) {
      applyTexture(this, "tex-boss-ceo-hurt0");
      return;
    }

    let prefix: string;
    let count: number;
    let interval: number;
    if (this._animState === "attack") { prefix = "boss-ceo-attack"; count = 4; interval = 80; }
    else if (this._animState === "special") { prefix = "boss-ceo-special"; count = 4; interval = 90; }
    else {
      const body = this.body as Phaser.Physics.Arcade.Body;
      const moving = body && Math.abs(body.velocity.x) > 10;
      if (!moving && !this._charging) { prefix = "boss-ceo-idle"; count = 2; interval = 500; }
      else if (this._charging) { prefix = "boss-ceo-run"; count = 6; interval = 60; }
      else { prefix = "boss-ceo-walk"; count = 2; interval = 180; }
    }

    if (t >= this._animNextAt) {
      this._animNextAt = t + interval;
      if (this._animState !== "run") {
        // play once, then return to run
        this._animFrame++;
        if (this._animFrame >= count) {
          this._animFrame = 0;
          this._animState = "run";
          this._animLockUntil = 0;
        }
      } else {
        this._animFrame = (this._animFrame + 1) % count;
      }
    }
    const key = `tex-${prefix}${this._animFrame}`;
    applyTexture(this, key);
  }

  private _triggerAnim(state: "attack" | "special") {
    if (this.scene.time.now < this._animLockUntil) return;
    this._animState = state;
    this._animFrame = 0;
    this._animNextAt = 0;
    this._animLockUntil = this.scene.time.now + (state === "attack" ? 320 : 360);
  }

  preUpdate(t: number, dt: number) {
    super.preUpdate(t, dt);
    if (!this.active || !this.body) return;
    if (this._dying) {
      this._applyAnimFrame(t);
      return;
    }
    const body = this.body as Phaser.Physics.Arcade.Body;

    // Phase transitions
    if (this.phase === 1 && this.hp <= 350) {
      this.phase = 2;
      this.speed = 100;
      fxGlow(this, 0xff8800, 220);
      this.scene.time.delayedCall(400, () => { if (this.active) this.clearTint(); });
      this._nextChargeAt = t + 500;
      this._nextParachuteAt = t + 2000;
    }
    if (this.phase === 2 && this.hp <= 150) {
      this.phase = 3;
      this.speed = 130;
      fxGlow(this, 0xff0000, 220);
      this.scene.time.delayedCall(600, () => { if (this.active) this.clearTint(); });
      this._nextDemissaoAt = t + 1000;
      this._nextSpreadAt = t + 1500;
    }

    if (t < this._frozen) { body.setVelocityX(0); this._applyAnimFrame(t); return; }
    const speedMult = t < this._slow ? 0.4 : 1;

    if (this.target) {
      this._dir = this.target.x < this.x ? -1 : 1;
    }
    this.setFlipX(this._dir === -1);

    // Charging (phase 2)
    if (this._charging) {
      if (t >= this._chargeUntil) {
        this._charging = false;
        body.setVelocityX(0);
      }
      this._applyAnimFrame(t);
      return;
    }

    // Walk toward target
    body.setVelocityX(this._dir * this.speed * speedMult);

    // Phase 1 attacks
    if (this.phase >= 1) {
      if (t >= this._nextMeleeAt) {
        this._nextMeleeAt = t + 2500;
        this._triggerAnim("attack");
        const hbX = this._dir === 1 ? this.x + 4 : this.x - 60;
        const hb = new Phaser.Geom.Rectangle(hbX, this.y - 20, 60, 40);
        this.swingHitbox = hb;
        this.swingActive = true;
        this.scene.time.delayedCall(200, () => { this.swingActive = false; this.swingHitbox = null; });
        this.onMelee?.(hb);
      }
      if (t >= this._nextSummonAt) {
        this._nextSummonAt = t + 5000;
        this._triggerAnim("special");
        const spawnX = this.x + (Math.random() > 0.5 ? 200 : -200);
        this.onSummon?.(spawnX, this.y);
      }
    }

    // Phase 2 attacks
    if (this.phase >= 2) {
      if (t >= this._nextChargeAt) {
        this._nextChargeAt = t + 2000;
        this._charging = true;
        this._chargeUntil = t + 300;
        this._triggerAnim("attack");
        body.setVelocityX(this._dir * 400);
      }
      if (t >= this._nextParachuteAt) {
        this._nextParachuteAt = t + 4000;
        this._triggerAnim("special");
        this.onGoldenParachute?.(this.x, this.y - 20);
      }
    }

    // Phase 3 attacks
    if (this.phase >= 3) {
      if (t >= this._nextDemissaoAt) {
        this._nextDemissaoAt = t + 6000;
        this._triggerAnim("special");
        this.onDemissao?.();
      }
      if (t >= this._nextSpreadAt) {
        this._nextSpreadAt = t + 3000;
        this._triggerAnim("special");
        this.onSpread?.(this.x, this.y - 10, this._dir);
      }
    }

    this._applyAnimFrame(t);
  }

  hit(damage: number, knockback: number): boolean {
    if (this._dying) return false;
    const now = this.scene.time.now;
    if (now < this._invulnUntil) return false;
    this._invulnUntil = now + HIT_INVULN_MS;
    this.hp -= damage;
    this.onHpChange?.(this.hp, this.maxHp);
    fxGlow(this, 0xff8888, 130);
    this._hurtUntil = now + 150;
    this.scene.time.delayedCall(150, () => { if (this.active) this.clearTint(); });
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocityX(knockback * 0.2); // resistant to knockback
    if (this.hp <= 0) {
      this._dying = true;
      body.setVelocity(0, 0);
      this.scene.time.delayedCall(800, () => { this.onDeath?.(); });
      return true;
    }
    return false;
  }

  applyFreeze(ms: number) { this._frozen = Math.max(this._frozen, this.scene.time.now + ms); }
  applySlowdown(ms: number) { this._slow = Math.max(this._slow, this.scene.time.now + ms); }
}
