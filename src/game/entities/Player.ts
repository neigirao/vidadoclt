import Phaser from "phaser";

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
};

export class Player extends Phaser.Physics.Arcade.Sprite {
  energy = 100;
  sanity = 100;
  vr = 0;

  facing: 1 | -1 = 1;

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

  onAttack?: (hitbox: Phaser.Geom.Rectangle, step: number) => void;
  onDeath?: (cause: "burnout" | "energy") => void;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, "tex-player");
    scene.add.existing(this);
    scene.physics.add.existing(this);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(20, 34);
    body.setOffset(2, 2);
    body.setMaxVelocity(800, 1400);

    const kb = scene.input.keyboard!;
    this.keys = {
      left: kb.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
      right: kb.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
      jump: kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      jumpAlt: kb.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      dash: kb.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT),
      attack: kb.addKey(Phaser.Input.Keyboard.KeyCodes.J),
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

  takeDamage(amount: number, sanityHit = 0) {
    const now = this.scene.time.now;
    if (this.isInvulnerable(now)) return;
    this.energy = Math.max(0, this.energy - amount);
    if (sanityHit) this.sanity = Math.max(0, this.sanity - sanityHit);
    this.invulnUntil = now + HIT_INVULN_MS;
    this.setTint(0xff8888);
    this.scene.time.delayedCall(120, () => this.clearTint());
    // knockback
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocityY(-200);
    body.setVelocityX(-this.facing * 220);

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
    if (onGround) this.lastGroundedAt = time;

    const left = this.keys.left.isDown || this.holdA;
    const right = this.keys.right.isDown || this.holdD;
    const jumpDown = this.keys.jump.isDown || this.keys.jumpAlt.isDown;
    const attackDown = this.keys.attack.isDown;
    const dashDown = this.keys.dash.isDown;

    const jumpPressed = jumpDown && !this.prevJumpDown;
    const attackPressed = attackDown && !this.prevAttackDown;
    const dashPressed = dashDown && !this.prevDashDown;

    // Horizontal movement (locked during dash)
    if (time < this.dashUntil) {
      body.setVelocityX(this.facing * DASH_SPEED);
    } else {
      if (left && !right) {
        body.setVelocityX(-WALK_SPEED);
        this.facing = -1;
        this.setFlipX(true);
      } else if (right && !left) {
        body.setVelocityX(WALK_SPEED);
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
      this.comboStep = (this.comboStep % 3) + 1;
      this.lastAttackAt = time;
      this.nextAttackReadyAt = time + 220;
      const hb = new Phaser.Geom.Rectangle(
        this.facing === 1 ? this.x + 6 : this.x - 34,
        this.y - 12,
        28,
        28,
      );
      this.onAttack?.(hb, this.comboStep);
    }

    this.prevJumpDown = jumpDown;
    this.prevAttackDown = attackDown;
    this.prevDashDown = dashDown;
  }
}
