import Phaser from "phaser";
import { applyTexture, resolveSprite } from "../systems/SpriteLibrary";
import { generateCorporateSpeak } from "../systems/CorporateAI";
import { fxGlow } from "./Enemies";

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
    scene.time.delayedCall(3800, () => {
      if (this.active) {
        this.setActive(false).setVisible(false);
        (this.body as Phaser.Physics.Arcade.Body).enable = false;
      }
    });
  }

  fire(toX: number, toY: number) {
    const angle = Phaser.Math.Angle.Between(this.x, this.y, toX, toY);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(Math.cos(angle) * 215, Math.sin(angle) * 215);
  }
}

// ─── Gerente Microgestor ─────────────────────────────────────────────────────
type BossAttack = "follow_up" | "alinhamento" | "atualizacao" | "reuniao" | "freeze" | "deadline";

const BOSS_HIT_INVULN_MS = 350;

export class GerenteMicrogestor extends Phaser.Physics.Arcade.Sprite {
  hp = 500;
  maxHp = 500;
  private _invulnUntil = 0;
  private _dying = false;
  contactDamage = 10;
  dir: 1 | -1 = -1;

  private bossState: "waiting" | "enter" | "idle" | "telegraph" | "attack" | "recover" = "waiting";
  private _hurtUntil = 0;
  private currentAttack: BossAttack = "follow_up";
  private stateUntil = 0;
  private phase2 = false;
  /** Âncora da arena: se o player fugir, o boss volta para cá em vez de vagar
   *  pelo mapa (e encalhar atrás de um móvel fora da câmera — "o boss sumiu"). */
  private homeX: number;
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
    this.homeX = x;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(10);
    const body = this.body as Phaser.Physics.Arcade.Body;
    // sprite full-body 56×72 (arte nova); corpo centrado, pés ~y70
    body.setSize(32, 58);
    body.setOffset(12, 14); // sprite 56×72: x=(56-32)/2, y=72-58
    body.setCollideWorldBounds(true);
    this.setTint(0x666666);
  }

  preUpdate(t: number, dt: number) {
    super.preUpdate(t, dt);
    const body = this.body as Phaser.Physics.Arcade.Body;

    if (this._dying) {
      this.updateTexture(t);
      return;
    }

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
        if (t >= this.stateUntil) {
          this.bossState = "idle";
          this.stateUntil = t + 200;
        }
        break;

      case "idle": {
        // Leash: player fugiu da arena → volta para casa em vez de persegui-lo
        // pelo mapa (encalhava atrás de móvel fora da câmera = "boss sumiu").
        if (!this.engaged()) {
          const homeDx = this.homeX - this.x;
          body.setVelocityX(Math.abs(homeDx) > 16 ? Math.sign(homeDx) * 90 : 0);
          this.stateUntil = t + 200; // não ataca enquanto retorna
          break;
        }
        const idleDx = this.target ? this.target.x - this.x : 0;
        body.setVelocityX(Math.abs(idleDx) > 120 ? Math.sign(idleDx) * 90 : 0);
        if (t >= this.stateUntil) this.startTelegraph(t);
        break;
      }

      case "telegraph": {
        const telDx = this.target ? this.target.x - this.x : 0;
        body.setVelocityX(Math.abs(telDx) > 160 ? Math.sign(telDx) * 60 : 0);
        if (t >= this.stateUntil) this.doAttack(t);
        break;
      }

      case "attack":
        if (this.currentAttack === "atualizacao") {
          this.tickDash(t, body);
        } else {
          body.setVelocityX(0);
          if (t >= this.stateUntil) this.endAttack(t);
        }
        break;

      case "recover": {
        const recDx = this.engaged()
          ? this.target!.x - this.x
          : Math.abs(this.homeX - this.x) > 16
            ? this.homeX - this.x
            : 0;
        body.setVelocityX(Math.abs(recDx) > 120 || !this.engaged() ? Math.sign(recDx) * 70 : 0);
        if (t >= this.stateUntil) {
          this.bossState = "idle";
          this.stateUntil = t + (this.phase2 ? 320 : 520);
        }
        break;
      }
    }

    this.updateTexture(t);
  }

  /** Player dentro do alcance de combate da arena? (ativação é <480) */
  private engaged(): boolean {
    return !!this.target && Math.abs(this.target.x - this.x) < 560;
  }

  private showIntroText() {
    const speak = generateCorporateSpeak();
    // Clampa X e usa wordWrap: o corporate-speak pode ser longo e o boss fica
    // encostado na parede direita — sem isso o balão transbordava a tela.
    const worldW = this.scene.physics.world.bounds.width || 1920;
    const tx = Math.min(this.x, worldW - 130);
    const txt = this.scene.add
      .text(tx, this.y - 80, `"Antes de voce sair\nprecisamos ${speak}."`, {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#f2c14e",
        stroke: "#000000",
        strokeThickness: 3,
        align: "center",
        wordWrap: { width: 240 },
      })
      .setOrigin(0.5)
      .setDepth(600);
    this.scene.tweens.add({
      targets: txt,
      alpha: 0,
      duration: 700,
      delay: 2400,
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
      follow_up: 500,
      alinhamento: 680,
      atualizacao: 380,
      reuniao: 780,
      freeze: 880,
      deadline: 480,
    };
    const colors: Record<BossAttack, number> = {
      follow_up: 0xffaa00,
      alinhamento: 0x4488ff,
      atualizacao: 0xff3300,
      reuniao: 0xaa00aa,
      freeze: 0xf0f0ff,
      deadline: 0xff0000,
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
        fontFamily: "monospace",
        fontSize: "12px",
        fontStyle: "bold",
        color: "#ffffff",
        stroke: "#000000",
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(600);
    this.scene.tweens.add({
      targets: lbl,
      alpha: 0,
      y: lbl.y - 24,
      duration: 480,
      delay: 280,
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
        // 1500 (era 2500) + i-frames concedidos pela cena: freeze é negação de
        // tempo, não combo de dano (o player não apanha congelado).
        this.onFreeze?.(1500);
        this.stateUntil = t + 320;
        break;

      case "deadline":
        this.onPull?.(this.x);
        this.onFreeze?.(800);
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
      fxGlow(this, 0xff4400, 220);
      this.swingActive = true;
      this.swingHitbox = new Phaser.Geom.Rectangle(
        this.dir === 1 ? this.x + 8 : this.x - 52,
        this.y - 22,
        52,
        52,
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
    if (this._dying) return false;
    const now = this.scene.time.now;
    if (now < this._invulnUntil) return false;
    this._invulnUntil = now + BOSS_HIT_INVULN_MS;
    this.hp -= damage;
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocityX(knockback * 0.08);
    body.setVelocityY(-30);
    fxGlow(this, 0xff4444, 220);
    this._hurtUntil = now + 330;
    this.scene.time.delayedCall(180, () => {
      if (this.active) this.clearTint();
    });
    this.onHpChange?.(this.hp, this.maxHp);
    if (this.hp <= 0) {
      this._dying = true;
      const body2 = this.body as Phaser.Physics.Arcade.Body;
      body2.setVelocity(0, 0);
      const fn = this.onDied;
      this.onDied = undefined;
      this.scene.time.delayedCall(700, () => {
        fn?.();
      });
      return true;
    }
    return false;
  }

  private updateTexture(now?: number) {
    if (now === undefined) now = this.scene.time.now;
    let key: string;
    if (this._dying) {
      const f = Math.floor(now / 230) % 3;
      key = `tex-gerente-death${f}`;
      applyTexture(this, key);
      return;
    }
    if (now < this._hurtUntil) {
      const f = Math.floor((now % 330) / 110) % 3;
      key = `tex-gerente-hurt${f}`;
    } else if (this.bossState === "attack" && this.currentAttack === "atualizacao") {
      // Dash charge — use run-charge frames for aggressive pose
      const body = this.body as Phaser.Physics.Arcade.Body;
      if (Math.abs(body.velocity.x) > 150) {
        const f = Math.floor(now / 100) % 3;
        key = `tex-gerente-run-charge${f}`;
      } else {
        key = `tex-gerente-run0`;
      }
    } else if (this.bossState === "telegraph" || this.bossState === "attack") {
      // Explicit mapping for all 6 attack types
      const f4 = Math.floor(now / 100) % 4;
      const f2 = Math.floor(now / 200) % 2;
      switch (this.currentAttack) {
        case "deadline":
          key = `tex-gerente-attack-deadline${f4}`;
          break;
        case "alinhamento":
          key = `tex-gerente-attack-escopo${f4}`;
          break;
        case "atualizacao":
          key = `tex-gerente-attack-sprint${f4}`;
          break;
        case "follow_up":
          key = `tex-gerente-attack${f2}`;
          break;
        case "reuniao":
          key = `tex-gerente-attack${f2}`;
          break;
        case "freeze":
          key = `tex-gerente-idle${f2}`;
          break;
        default:
          key = `tex-gerente-attack0`;
      }
    } else if (this.bossState === "enter" || this.bossState === "recover") {
      const f = Math.floor(now / 140) % 4;
      key = `tex-gerente-walk${f}`;
    } else {
      const f = Math.floor(now / 600) % 2;
      key = f === 0 ? `tex-gerente-idle0` : `tex-gerente-idle1`;
    }
    applyTexture(this, key);
  }
}
