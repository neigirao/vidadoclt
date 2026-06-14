import Phaser from "phaser";
import { applyTexture, resolveSprite } from "../systems/SpriteLibrary";
import { SpecialType } from "../systems/WeaponSystem";

const WALK_SPEED = 200;
const JUMP_VEL = -520;
const COYOTE_MS = 100;
const JUMP_BUFFER_MS = 100;
const DASH_SPEED = 600;
const DASH_MS = 150;
const DASH_COOLDOWN_MS = 1500;
const COMBO_WINDOW_MS = 250;
const HIT_INVULN_MS = 600;

export type PlayerKeys = {
  left: Phaser.Input.Keyboard.Key;
  right: Phaser.Input.Keyboard.Key;
  jump: Phaser.Input.Keyboard.Key;
  jumpAlt: Phaser.Input.Keyboard.Key;
  dash: Phaser.Input.Keyboard.Key;
  attack: Phaser.Input.Keyboard.Key;
  special: Phaser.Input.Keyboard.Key;
};

export class Player extends Phaser.Physics.Arcade.Sprite {
  energy = 100;
  maxEnergy = 100;
  sanity = 100;
  maxSanity = 100;
  vr = 0;

  facing: 1 | -1 = 1;

  autonomia = false;
  frozenUntil = 0;
  walkSpeed = WALK_SPEED;
  attackRange = 28;
  damageMult = 1.0;
  vrDropMult = 1.0;
  weaponId = "grampeador";

  doubleJump = false;
  aggroRadius = 200;
  firstStrikeReady = false;
  hitAutoRanged = false;
  isRangedPrimary = false;
  attackIntervalMs = 220;
  comboHits: 2 | 3 = 3;
  specialCooldown = 3000;
  specialType: SpecialType = "burst_ranged";
  onSpecialAttack?: (type: SpecialType, x: number, y: number, facing: 1 | -1) => void;

  onRangedAttack?: (fromX: number, fromY: number, facing: 1 | -1) => void;

  private speedMultUntil = 0;
  private speedMult = 0.4;

  private jumpsUsed = 0;
  private specialCooldownUntil = 0;
  private prevSpecialDown = false;

  private keys: PlayerKeys;
  private lastGroundedAt = 0;
  private lastJumpPressedAt = -9999;
  private dashUntil = 0;
  private dashCooldownUntil = 0;
  private comboStep = 0;
  private lastAttackAt = -9999;
  private nextAttackReadyAt = 0;
  private invulnUntil = 0;
  private prevJumpDown = false;
  private prevAttackDown = false;
  private prevDashDown = false;
  private lastSanityDrainAt = 0;
  private _frozenTintActive = false;

  onAttack?: (hitbox: Phaser.Geom.Rectangle, step: number) => void;
  onDeath?: (cause: "burnout" | "energy") => void;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, ...resolveSprite("tex-player-idle"));
    scene.add.existing(this);
    scene.physics.add.existing(this);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(20, 34);
    body.setOffset(6, 14); // 32×48 sprite — skip head, align feet
    body.setMaxVelocity(800, 1400);

    const kb = scene.input.keyboard!;
    this.keys = {
      left: kb.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
      right: kb.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
      jump: kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      jumpAlt: kb.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      dash: kb.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT),
      attack: kb.addKey(Phaser.Input.Keyboard.KeyCodes.J),
      special: kb.addKey(Phaser.Input.Keyboard.KeyCodes.K),
    };
    // A/D
    kb.addKey(Phaser.Input.Keyboard.KeyCodes.A).on("down", () => (this.holdA = true));
    kb.addKey(Phaser.Input.Keyboard.KeyCodes.A).on("up", () => (this.holdA = false));
    kb.addKey(Phaser.Input.Keyboard.KeyCodes.D).on("down", () => (this.holdD = true));
    kb.addKey(Phaser.Input.Keyboard.KeyCodes.D).on("up", () => (this.holdD = false));
  }

  private holdA = false;
  private holdD = false;

  isInvulnerable(now: number) {
    return now < this.invulnUntil || now < this.dashUntil;
  }

  applyFreeze(ms: number) {
    const dur = this.autonomia ? Math.ceil(ms * 0.5) : ms;
    this.frozenUntil = Math.max(this.frozenUntil, this.scene.time.now + dur);
  }

  applySlowdown(ms: number) {
    const dur = this.autonomia ? Math.ceil(ms * 0.5) : ms;
    this.speedMultUntil = Math.max(this.speedMultUntil, this.scene.time.now + dur);
  }

  getDashCooldownRatio(now: number): number {
    if (now >= this.dashCooldownUntil) return 0;
    return (this.dashCooldownUntil - now) / DASH_COOLDOWN_MS;
  }

  takeDamage(amount: number, sanityHit = 0, fromX?: number) {
    const now = this.scene.time.now;
    if (this.isInvulnerable(now)) return;
    this.energy = Math.max(0, this.energy - amount);
    if (sanityHit) this.sanity = Math.max(0, this.sanity - sanityHit);
    this.invulnUntil = now + HIT_INVULN_MS;
    this.setTint(0xff8888);
    this.scene.time.delayedCall(120, () => this.clearTint());
    // knockback — push away from hit source (or away from facing if no source given)
    const pushDir = fromX !== undefined ? (this.x < fromX ? -1 : 1) : -this.facing;
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocityY(-200);
    body.setVelocityX(pushDir * 280);

    if (this.energy <= 0) this.onDeath?.("energy");
    else if (this.sanity <= 0) this.onDeath?.("burnout");
  }

  drainSanity(amount: number) {
    this.sanity = Math.max(0, this.sanity - amount);
    if (this.sanity <= 0) this.onDeath?.("burnout");
  }

  addVR(n: number) {
    this.vr += n;
  }

  /** Passive sanity drain to simulate the long shift. */
  tickPassive(time: number) {
    if (time - this.lastSanityDrainAt > 4000) {
      this.lastSanityDrainAt = time;
      this.drainSanity(1);
    }
  }

  update(time: number, _delta: number) {
    const body = this.body as Phaser.Physics.Arcade.Body;
    const onGround = body.blocked.down || body.touching.down;
    if (onGround) {
      this.lastGroundedAt = time;
      this.jumpsUsed = 0;
    }

    // Freeze: no input, only gravity
    if (time < this.frozenUntil) {
      body.setVelocityX(0);
      if (!this._frozenTintActive) { this.setTint(0xaaaaff); this._frozenTintActive = true; }
      this.prevJumpDown = false;
      this.prevAttackDown = false;
      this.prevDashDown = false;
      return;
    }
    if (this._frozenTintActive) { this.clearTint(); this._frozenTintActive = false; }

    const curSpeed = time < this.speedMultUntil ? this.walkSpeed * this.speedMult : this.walkSpeed;

    const left = this.keys.left.isDown || this.holdA;
    const right = this.keys.right.isDown || this.holdD;
    const jumpDown = this.keys.jump.isDown || this.keys.jumpAlt.isDown;
    const attackDown = this.keys.attack.isDown;
    const dashDown = this.keys.dash.isDown;
    const specialDown = this.keys.special.isDown;

    const jumpPressed = jumpDown && !this.prevJumpDown;
    const attackPressed = attackDown && !this.prevAttackDown;
    const dashPressed = dashDown && !this.prevDashDown;
    const specialPressed = specialDown && !this.prevSpecialDown;

    // Horizontal movement (locked during dash)
    if (time < this.dashUntil) {
      body.setVelocityX(this.facing * DASH_SPEED);
      body.setVelocityY(0); // freeze Y during dash so player doesn't fall
    } else {
      if (left && !right) {
        body.setVelocityX(-curSpeed);
        this.facing = -1;
        this.setFlipX(true);
      } else if (right && !left) {
        body.setVelocityX(curSpeed);
        this.facing = 1;
        this.setFlipX(false);
      } else {
        body.setVelocityX(0);
      }
    }

    // Jump with coyote + buffer
    if (jumpPressed) this.lastJumpPressedAt = time;
    const canCoyote = time - this.lastGroundedAt <= COYOTE_MS;
    const bufferActive = time - this.lastJumpPressedAt <= JUMP_BUFFER_MS;
    if (bufferActive && canCoyote) {
      body.setVelocityY(JUMP_VEL);
      this.lastJumpPressedAt = -9999;
      this.lastGroundedAt = -9999;
    }
    // variable jump cut
    if (!jumpDown && body.velocity.y < -200) {
      body.setVelocityY(body.velocity.y * 0.5);
    }

    // Air jump (double jump perk)
    if (jumpPressed && !canCoyote && !onGround && this.doubleJump && this.jumpsUsed < 1) {
      body.setVelocityY(JUMP_VEL);
      this.jumpsUsed++;
      this.lastJumpPressedAt = -9999;
    }

    // Dash
    if (dashPressed && time >= this.dashCooldownUntil) {
      this.dashUntil = time + DASH_MS;
      this.dashCooldownUntil = time + DASH_COOLDOWN_MS;
      body.setVelocityY(0);
      this.setAlpha(0.6);
      this.scene.time.delayedCall(DASH_MS, () => this.setAlpha(1));
    }

    // Attack combo
    if (attackPressed && time >= this.nextAttackReadyAt) {
      if (time - this.lastAttackAt > COMBO_WINDOW_MS + 200) {
        this.comboStep = 0;
      }
      this.comboStep = (this.comboStep % this.comboHits) + 1;
      this.lastAttackAt = time;
      this.nextAttackReadyAt = time + this.attackIntervalMs;
      if (this.isRangedPrimary) {
        this.onRangedAttack?.(this.x, this.y, this.facing);
      } else {
        const hb = new Phaser.Geom.Rectangle(
          this.facing === 1 ? this.x + 6 : this.x - 6 - this.attackRange,
          this.y - 12,
          this.attackRange,
          28,
        );
        this.onAttack?.(hb, this.comboStep);
        if (this.hitAutoRanged) this.onRangedAttack?.(this.x, this.y, this.facing);
      }
    }

    // Special attack (K)
    if (specialPressed && time >= this.specialCooldownUntil) {
      this.specialCooldownUntil = time + this.specialCooldown;
      this.onSpecialAttack?.(this.specialType, this.x, this.y, this.facing);
    }
    this.prevSpecialDown = specialDown;

    this.prevJumpDown = jumpDown;
    this.prevAttackDown = attackDown;
    this.prevDashDown = dashDown;

    this.updateTexture(time);
  }

  private updateTexture(time: number) {
    const body = this.body as Phaser.Physics.Arcade.Body;
    const onGround = body.blocked.down || body.touching.down;
    const speed = Math.abs(body.velocity.x);
    const now = time;

    // NOTE: source frames are inconsistent poses (not a coherent cycle),
    // so we pick ONE representative frame per state to avoid visual flicker.
    let key: string;
    if (now < this.invulnUntil && now >= this.dashUntil) {
      key = 'tex-player-hurt0';
    } else if (now < this.dashUntil) {
      key = 'tex-player-dash0';
    } else if (now - this.lastAttackAt < 330) {
      // Attack: 3-step swing using only well-aligned frames
      const f = Math.min(2, Math.floor((now - this.lastAttackAt) / 110));
      key = `tex-player-attack${f}`;
    } else if (!onGround) {
      key = body.velocity.y < -80 ? 'tex-player-jump1' : 'tex-player-fall0';
    } else if (speed > 300) {
      // Run: alternate 2 frames slowly for sense of motion
      key = `tex-player-run${(Math.floor(now / 150) % 2) * 4}`;
    } else if (speed > 60) {
      key = `tex-player-walk${(Math.floor(now / 180) % 2) * 4}`;
    } else {
      key = 'tex-player-idle0';
    }

    applyTexture(this, key);
  }
}
