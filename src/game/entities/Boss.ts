import Phaser from "phaser";
import { applyTexture, resolveSprite } from "../systems/SpriteLibrary";

// ─── Email projectile (Follow-Up attack) ────────────────────────────────────
export class EmailProjectil extends Phaser.Physics.Arcade.Sprite {
  damage = 18;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, ...resolveSprite("tex-email"));
    scene.add.existing(this);
    scene.physics.add.existing(this);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setSize(20, 14);
    scene.time.delayedCall(3800, () => { if (this.active) this.destroy(); });
  }

  fire(toX: number, toY: number) {
    const angle = Phaser.Math.Angle.Between(this.x, this.y, toX, toY);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(Math.cos(angle) * 215, Math.sin(angle) * 215);
  }
}

// ─── Gerente Microgestor ─────────────────────────────────────────────────────
type BossAttack = "follow_up" | "alinhamento" | "atualizacao" | "reuniao" | "freeze" | "deadline";

export class GerenteMicrogestor extends Phaser.Physics.Arcade.Sprite {
  hp = 300;
  maxHp = 300;
  contactDamage = 10;
  dir: 1 | -1 = -1;

  private bossState: "waiting" | "enter" | "idle" | "telegraph" | "attack" | "recover" = "waiting";
  private currentAttack: BossAttack = "follow_up";
  private stateUntil = 0;
  private phase2 = false;
  private attackQueue: BossAttack[] = [];
  private dashCount = 0;
  private nextDashAt = 0;

  swingHitbox: Phaser.Geom.Rectangle | null = null;
  swingActive = false;
  swingDamage = 28;

  target?: { x: number; y: number };

  onActivate?: () => void;
  onShoot?: (fx: number, fy: number, tx: number, ty: number) => void;
  onPull?: (targetX: number) => void;
  onFreeze?: (ms: number) => void;
  onSpawn?: (x: number, y: number) => void;
  onPhase2?: () => void;
  onDied?: () => void;
  onHpChange?: (hp: number, maxHp: number) => void;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, ...resolveSprite("tex-gerente"));
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(10);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(32, 50);
    body.setOffset(2, 6); // offset.y = spriteH(56) - bodyH(50)
    body.setCollideWorldBounds(true);
    this.setTint(0x666666);
  }

  preUpdate(t: number, dt: number) {
    super.preUpdate(t, dt);
    const body = this.body as Phaser.Physics.Arcade.Body;

    if (this.target) this.dir = this.target.x < this.x ? -1 : 1;
    this.setFlipX(this.dir === -1);

    if (!this.phase2 && this.hp <= this.maxHp * 0.3) {
      this.phase2 = true;
      this.onPhase2?.();
    }

    switch (this.bossState) {
      case "waiting":
        body.setVelocityX(0);
        if (this.target && Math.abs(this.target.x - this.x) < 480) {
          this.bossState = "enter";
          this.clearTint();
          this.onActivate?.();
          this.showIntroText();
          this.stateUntil = t + 2800;
        }
        break;

      case "enter":
        body.setVelocityX(0);
        if (t >= this.stateUntil) { this.bossState = "idle"; this.stateUntil = t + 200; }
        break;

      case "idle":
        body.setVelocityX(0);
        if (t >= this.stateUntil) this.startTelegraph(t);
        break;

      case "telegraph":
        body.setVelocityX(0);
        if (t >= this.stateUntil) this.doAttack(t);
        break;

      case "attack":
        if (this.currentAttack === "atualizacao") {
          this.tickDash(t, body);
        } else {
          body.setVelocityX(0);
          if (t >= this.stateUntil) this.endAttack(t);
        }
        break;

      case "recover":
        body.setVelocityX(0);
        if (t >= this.stateUntil) {
          this.bossState = "idle";
          this.stateUntil = t + (this.phase2 ? 320 : 520);
        }
        break;
    }

    this.updateTexture();
  }

  private showIntroText() {
    const txt = this.scene.add
      .text(this.x, this.y - 80,
        '"Antes de voce sair\nprecisamos alinhar\nalgumas coisas."',
        { fontFamily: "monospace", fontSize: "13px", color: "#f2c14e",
          stroke: "#000000", strokeThickness: 3, align: "center" })
      .setOrigin(0.5).setDepth(600);
    this.scene.tweens.add({
      targets: txt, alpha: 0, duration: 700, delay: 1900,
      onComplete: () => txt.destroy(),
    });
  }

  private buildQueue() {
    const pool: BossAttack[] = ["follow_up", "alinhamento", "atualizacao", "reuniao", "freeze"];
    if (this.phase2) pool.push("deadline");
    this.attackQueue = Phaser.Utils.Array.Shuffle([...pool]) as BossAttack[];
  }

  private nextAttack(): BossAttack {
    if (!this.attackQueue.length) this.buildQueue();
    return this.attackQueue.pop()!;
  }

  private startTelegraph(t: number) {
    this.currentAttack = this.nextAttack();

    const durations: Record<BossAttack, number> = {
      follow_up: 500, alinhamento: 680, atualizacao: 380,
      reuniao: 780, freeze: 880, deadline: 480,
    };
    const colors: Record<BossAttack, number> = {
      follow_up: 0xffaa00, alinhamento: 0x4488ff, atualizacao: 0xff3300,
      reuniao: 0xaa00aa, freeze: 0xf0f0ff, deadline: 0xff0000,
    };
    const names: Record<BossAttack, string> = {
      follow_up: "Follow-Up!",
      alinhamento: "ALINHAMENTO",
      atualizacao: "ATUALIZACAO RAPIDA!",
      reuniao: "REUNIAO EMERGENCIAL",
      freeze: "VOCE TEM 5 MINUTOS?",
      deadline: "DEADLINE INADIAVEL!",
    };

    const factor = this.phase2 ? 0.82 : 1;
    this.bossState = "telegraph";
    this.stateUntil = t + durations[this.currentAttack] * factor;
    this.setTint(colors[this.currentAttack]);

    const lbl = this.scene.add
      .text(this.x, this.y - 62, names[this.currentAttack], {
        fontFamily: "monospace", fontSize: "12px", fontStyle: "bold",
        color: "#ffffff", stroke: "#000000", strokeThickness: 3,
      })
      .setOrigin(0.5).setDepth(600);
    this.scene.tweens.add({
      targets: lbl, alpha: 0, y: lbl.y - 24, duration: 480, delay: 280,
      onComplete: () => lbl.destroy(),
    });
  }

  private doAttack(t: number) {
    this.bossState = "attack";
    this.clearTint();

    switch (this.currentAttack) {
      case "follow_up":
        if (this.target) this.onShoot?.(this.x, this.y - 14, this.target.x, this.target.y);
        this.stateUntil = t + 260;
        break;

      case "alinhamento":
        this.onPull?.(this.x);
        this.stateUntil = t + 320;
        break;

      case "atualizacao":
        this.dashCount = 0;
        this.nextDashAt = t;
        this.stateUntil = t + 1700;
        break;

      case "reuniao":
        this.onSpawn?.(this.x - 90, this.y);
        this.onSpawn?.(this.x + 90, this.y);
        this.stateUntil = t + 460;
        break;

      case "freeze":
        this.onFreeze?.(2500);
        this.stateUntil = t + 320;
        break;

      case "deadline":
        this.onPull?.(this.x);
        this.onFreeze?.(1100);
        this.stateUntil = t + 360;
        break;
    }
  }

  private tickDash(t: number, body: Phaser.Physics.Arcade.Body) {
    if (this.dashCount >= 3 || t >= this.stateUntil) {
      this.endAttack(t);
      return;
    }
    if (t >= this.nextDashAt) {
      this.dashCount++;
      this.nextDashAt = t + 490;
      if (this.target) this.dir = this.target.x < this.x ? -1 : 1;
      this.setFlipX(this.dir === -1);
      body.setVelocityX(this.dir * 430);
      this.setTint(0xff4400);
      this.swingActive = true;
      this.swingHitbox = new Phaser.Geom.Rectangle(
        this.dir === 1 ? this.x + 8 : this.x - 52,
        this.y - 22, 52, 52,
      );
      this.scene.time.delayedCall(180, () => {
        if (!this.active) return;
        body.setVelocityX(0);
        this.swingActive = false;
        this.swingHitbox = null;
        this.clearTint();
      });
    }
  }

  private endAttack(t: number) {
    this.bossState = "recover";
    this.stateUntil = t + (this.phase2 ? 680 : 920);
    this.swingActive = false;
    this.swingHitbox = null;
    this.clearTint();
  }

  hit(damage: number, knockback: number): boolean {
    if (this.bossState === "waiting") return false;
    this.hp -= damage;
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocityX(knockback * 0.08);
    body.setVelocityY(-30);
    this.setTint(0xffffff);
    this.scene.time.delayedCall(100, () => { if (this.active) this.clearTint(); });
    this.onHpChange?.(this.hp, this.maxHp);
    if (this.hp <= 0) { this.onDied?.(); return true; }
    return false;
  }

  private updateTexture() {
    // Source frames are inconsistent poses — use one frame per state to avoid flicker.
    let key: string;
    if (this.bossState === "waiting" || this.bossState === "idle") {
      key = `tex-gerente-idle0`;
    } else if (this.bossState === "enter" || this.bossState === "recover") {
      key = `tex-gerente-walk0`;
    } else if (this.bossState === "telegraph" || this.bossState === "attack") {
      const atkFrames: Record<BossAttack, string> = {
        follow_up:   `tex-gerente-attack-sprint0`,
        alinhamento: `tex-gerente-attack-deadline0`,
        atualizacao: `tex-gerente-run0`,
        reuniao:     `tex-gerente-attack-escopo0`,
        freeze:      `tex-gerente-attack-sprint0`,
        deadline:    `tex-gerente-attack-deadline0`,
      };
      key = atkFrames[this.currentAttack] ?? `tex-gerente-idle0`;
    } else {
      key = `tex-gerente-idle0`;
    }
    applyTexture(this, key);
  }
}

