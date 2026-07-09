import Phaser from "phaser";
import { applyTexture, resolveSprite } from "../systems/SpriteLibrary";
import { markKilled } from "../systems/BestiarySystem";

/**
 * Brenda do RH — "Clima Organizacional" — chefona da Fase 3 (RH / Endomarketing).
 *
 * Personifica o endomarketing tóxico: sorriso obrigatório e feedback que nunca
 * para. Repertório telegrafado:
 *  - "PESQUISA DE CLIMA": marca zonas de piso "sorriso obrigatório". Ficar
 *    parado numa zona fere (força movimento constante). Cena wireia via onClima.
 *  - "FEEDBACK 360": dispara um leque de post-its de feedback dirigidos ao
 *    player. Cena wireia via onFeedback.
 *  - "DINÂMICA DE GRUPO" (contato): investida curta telegrafada (swing/contato).
 *
 * Reusa o sprite `enemy-rh` (48×64).
 */
type BrendaAttack = "clima" | "feedback" | "dinamica";

const BOSS_HIT_INVULN_MS = 340;

export class BrendaDoRH extends Phaser.Physics.Arcade.Sprite {
  hp = 240;
  maxHp = 240;
  contactDamage = 12;
  dir: 1 | -1 = -1;

  private _invulnUntil = 0;
  private _dying = false;
  private _hurtUntil = 0;
  private _frozen = 0;

  private bossState: "waiting" | "enter" | "idle" | "telegraph" | "attack" | "recover" = "waiting";
  private currentAttack: BrendaAttack = "clima";
  private stateUntil = 0;
  private phase2 = false;
  private homeX: number;
  private queue: BrendaAttack[] = [];

  swingHitbox: Phaser.Geom.Rectangle | null = null;
  swingActive = false;
  swingDamage = 22;

  target?: { x: number; y: number };

  onActivate?: () => void;
  onHpChange?: (hp: number, maxHp: number) => void;
  onDied?: () => void;
  /** Pesquisa de Clima: cena marca zonas de sorriso obrigatório ao redor do player. */
  onClima?: (playerX: number) => void;
  /** Feedback 360: cena dispara o leque de post-its dirigidos. */
  onFeedback?: (bx: number, by: number) => void;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, ...resolveSprite("tex-rh-idle0"));
    this.homeX = x;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(10);
    this.setDisplaySize(52, 70);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(30, 52);
    body.setOffset(9, 12); // sprite 48×64
    body.setCollideWorldBounds(true);
  }

  preUpdate(t: number, dt: number) {
    super.preUpdate(t, dt);
    const body = this.body as Phaser.Physics.Arcade.Body;

    if (this._dying) {
      this.updateTexture(t);
      return;
    }
    if (t < this._frozen) {
      body.setVelocityX(0);
      this.updateTexture(t);
      return;
    }

    if (this.target) this.dir = this.target.x < this.x ? -1 : 1;
    this.setFlipX(this.dir === 1);

    if (!this.phase2 && this.hp <= this.maxHp * 0.35) {
      this.phase2 = true;
      this.setTint(0xff88cc);
      this.scene.time.delayedCall(400, () => {
        if (this.active) this.clearTint();
      });
    }

    switch (this.bossState) {
      case "waiting":
        body.setVelocityX(0);
        if (this.target && Math.abs(this.target.x - this.x) < 480) {
          this.bossState = "enter";
          this.onActivate?.();
          this.showIntroText();
          this.stateUntil = t + 2400;
        }
        break;

      case "enter":
        body.setVelocityX(0);
        if (t >= this.stateUntil) {
          this.bossState = "idle";
          this.stateUntil = t + 260;
        }
        break;

      case "idle": {
        if (!this.engaged()) {
          const homeDx = this.homeX - this.x;
          body.setVelocityX(Math.abs(homeDx) > 16 ? Math.sign(homeDx) * 90 : 0);
          this.stateUntil = t + 240;
          break;
        }
        const dx = this.target ? this.target.x - this.x : 0;
        body.setVelocityX(Math.abs(dx) > 140 ? Math.sign(dx) * 95 : 0);
        if (t >= this.stateUntil) this.startTelegraph(t);
        break;
      }

      case "telegraph": {
        body.setVelocityX(0);
        if (t >= this.stateUntil) this.doAttack(t);
        break;
      }

      case "attack":
        if (this.currentAttack === "dinamica") {
          if (this.swingActive) {
            this.swingHitbox = new Phaser.Geom.Rectangle(
              this.dir === 1 ? this.x + 8 : this.x - 52,
              this.y - 22,
              52,
              52,
            );
          }
          if (t >= this.stateUntil) this.endAttack(t);
        } else {
          body.setVelocityX(0);
          if (t >= this.stateUntil) this.endAttack(t);
        }
        break;

      case "recover": {
        const dx = this.engaged() ? this.target!.x - this.x : this.homeX - this.x;
        body.setVelocityX(Math.abs(dx) > 120 ? Math.sign(dx) * 80 : 0);
        if (t >= this.stateUntil) {
          this.bossState = "idle";
          this.stateUntil = t + (this.phase2 ? 340 : 560);
        }
        break;
      }
    }

    this.updateTexture(t);
  }

  private engaged(): boolean {
    return !!this.target && Math.abs(this.target.x - this.x) < 580;
  }

  private showIntroText() {
    const worldW = this.scene.physics.world.bounds.width || 1920;
    const tx = Math.min(this.x, worldW - 140);
    const txt = this.scene.add
      .text(tx, this.y - 84, '"Aqui a gente é\numa família! Agora\nsorri pro clima."', {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#ff99cc",
        stroke: "#000000",
        strokeThickness: 3,
        align: "center",
        wordWrap: { width: 250 },
      })
      .setOrigin(0.5)
      .setDepth(600);
    this.scene.tweens.add({
      targets: txt,
      alpha: 0,
      duration: 700,
      delay: 2000,
      onComplete: () => txt.destroy(),
    });
  }

  private buildQueue() {
    const pool: BrendaAttack[] = ["clima", "feedback", "dinamica", "feedback"];
    if (this.phase2) pool.push("clima");
    this.queue = Phaser.Utils.Array.Shuffle([...pool]) as BrendaAttack[];
  }

  private nextAttack(): BrendaAttack {
    if (!this.queue.length) this.buildQueue();
    return this.queue.pop()!;
  }

  private startTelegraph(t: number) {
    this.currentAttack = this.nextAttack();
    const durations: Record<BrendaAttack, number> = {
      clima: 620,
      feedback: 540,
      dinamica: 460,
    };
    const colors: Record<BrendaAttack, number> = {
      clima: 0xff66aa,
      feedback: 0xffcc33,
      dinamica: 0xff3322,
    };
    const names: Record<BrendaAttack, string> = {
      clima: "PESQUISA DE CLIMA",
      feedback: "FEEDBACK 360",
      dinamica: "DINÂMICA DE GRUPO!",
    };

    const factor = this.phase2 ? 0.82 : 1;
    this.bossState = "telegraph";
    this.stateUntil = t + durations[this.currentAttack] * factor;
    this.setTint(colors[this.currentAttack]);

    const lbl = this.scene.add
      .text(this.x, this.y - 66, names[this.currentAttack], {
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
      delay: 260,
      onComplete: () => lbl.destroy(),
    });
  }

  private doAttack(t: number) {
    this.bossState = "attack";
    this.clearTint();

    switch (this.currentAttack) {
      case "clima":
        if (this.target) this.onClima?.(this.target.x);
        this.stateUntil = t + 500;
        break;

      case "feedback":
        this.onFeedback?.(this.x, this.y - 14);
        this.stateUntil = t + 420;
        break;

      case "dinamica": {
        if (this.target) this.dir = this.target.x < this.x ? -1 : 1;
        this.setFlipX(this.dir === 1);
        const body = this.body as Phaser.Physics.Arcade.Body;
        body.setVelocityX(this.dir * 440);
        this.setTint(0xff5533);
        this.swingActive = true;
        this.stateUntil = t + 360;
        this.scene.time.delayedCall(300, () => {
          if (!this.active) return;
          this.swingActive = false;
          this.swingHitbox = null;
          (this.body as Phaser.Physics.Arcade.Body).setVelocityX(0);
          this.clearTint();
        });
        break;
      }
    }
  }

  private endAttack(t: number) {
    this.bossState = "recover";
    this.stateUntil = t + (this.phase2 ? 620 : 860);
    this.swingActive = false;
    this.swingHitbox = null;
    this.clearTint();
  }

  hit(damage: number, knockback: number): boolean {
    if (this.bossState === "waiting" || this._dying) return false;
    const now = this.scene.time.now;
    if (now < this._invulnUntil) return false;
    this._invulnUntil = now + BOSS_HIT_INVULN_MS;
    this.hp -= damage;
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocityX(knockback * 0.06);
    body.setVelocityY(-28);
    this.setTint(0xff4444);
    this._hurtUntil = now + 320;
    this.scene.time.delayedCall(170, () => {
      if (this.active && !this._dying) this.clearTint();
    });
    this.onHpChange?.(this.hp, this.maxHp);
    if (this.hp <= 0) {
      this._dying = true;
      markKilled("brenda_rh");
      body.setVelocity(0, 0);
      const fn = this.onDied;
      this.onDied = undefined;
      this.scene.time.delayedCall(700, () => fn?.());
      return true;
    }
    return false;
  }

  applyFreeze(ms: number) {
    this._frozen = Math.max(this._frozen, this.scene.time.now + ms);
  }

  private updateTexture(now: number) {
    let key: string;
    if (this._dying) {
      const f = Math.floor(now / 200) % 3;
      key = `tex-rh-death${f}`;
    } else if (now < this._hurtUntil) {
      key = `tex-rh-hurt0`;
    } else if (this.bossState === "telegraph" || this.bossState === "attack") {
      const f = Math.floor(now / 140) % 2;
      key = `tex-rh-attack${f}`;
    } else if (this.bossState === "enter" || this.bossState === "recover") {
      const f = Math.floor(now / 150) % 4;
      key = `tex-rh-walk${f}`;
    } else {
      const f = Math.floor(now / 500) % 3;
      key = `tex-rh-idle${f}`;
    }
    applyTexture(this, key);
  }
}
