import Phaser from "phaser";
import { applyTexture, resolveSprite } from "../systems/SpriteLibrary";
import { markKilled } from "../systems/BestiarySystem";

/**
 * Diretor de Resultados — chefão da Fase 5 (Diretoria).
 *
 * Personifica a meta inalcançável e a reestruturação. Repertório telegrafado:
 *  - "META INALCANÇÁVEL": ergue uma barra de meta que sobe sozinha; enquanto ela
 *    não estoura, o Diretor fica exposto (janela de dano). Se estourar, dispara
 *    uma cobrança (projétil rápido). A cena wireia via onMeta/onCobranca.
 *  - "REESTRUTURAÇÃO": telegrafa, some e reaparece no lado oposto da arena
 *    (troca de lado), forçando o player a reposicionar. Wireada via onReestrutura.
 *  - "PDI" (contato de dash): investida curta telegrafada (swingHitbox), padrão
 *    pesado da casa.
 *
 * Reusa o sprite `enemy-evangelista-boss-*` (64×64) — figura de terno já pronta.
 */
type DiretorAttack = "meta" | "reestrutura" | "pdi";

const BOSS_HIT_INVULN_MS = 340;

export class DiretorDeResultados extends Phaser.Physics.Arcade.Sprite {
  hp = 620;
  maxHp = 620;
  contactDamage = 14;
  dir: 1 | -1 = -1;

  private _invulnUntil = 0;
  private _dying = false;
  private _hurtUntil = 0;
  private _frozen = 0;

  private bossState: "waiting" | "enter" | "idle" | "telegraph" | "attack" | "recover" = "waiting";
  private currentAttack: DiretorAttack = "meta";
  private stateUntil = 0;
  private phase2 = false;
  private homeX: number;
  private queue: DiretorAttack[] = [];

  swingHitbox: Phaser.Geom.Rectangle | null = null;
  swingActive = false;
  swingDamage = 26;

  target?: { x: number; y: number };

  onActivate?: () => void;
  onHpChange?: (hp: number, maxHp: number) => void;
  onDied?: () => void;
  /** Meta Inalcançável: cena desenha barra que sobe; chama onCobranca ao estourar. */
  onMeta?: (bx: number, by: number) => void;
  /** Reestruturação: cena faz o flash/teleporte de feedback; retorna o novo X. */
  onReestrutura?: (fromX: number) => void;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, ...resolveSprite("tex-evangelista-boss-idle0"));
    this.homeX = x;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(10);
    this.setDisplaySize(64, 76); // presença de chefe
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(34, 56);
    body.setOffset(15, 8); // sprite 64×64
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
    this.setFlipX(this.dir === 1); // sprite olha p/ esquerda por padrão

    if (!this.phase2 && this.hp <= this.maxHp * 0.35) {
      this.phase2 = true;
      this.setTint(0xffcc66);
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
        body.setVelocityX(Math.abs(dx) > 140 ? Math.sign(dx) * 100 : 0);
        if (t >= this.stateUntil) this.startTelegraph(t);
        break;
      }

      case "telegraph": {
        body.setVelocityX(0);
        if (t >= this.stateUntil) this.doAttack(t);
        break;
      }

      case "attack":
        if (this.currentAttack === "pdi") {
          // durante a investida a hitbox segue o corpo
          if (this.swingActive) {
            this.swingHitbox = new Phaser.Geom.Rectangle(
              this.dir === 1 ? this.x + 8 : this.x - 56,
              this.y - 24,
              56,
              54,
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
      .text(tx, this.y - 90, '"Os números não\nfecham. Isso é\nresponsabilidade sua."', {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#ffcc66",
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
    const pool: DiretorAttack[] = ["meta", "pdi", "reestrutura", "pdi"];
    if (this.phase2) pool.push("meta");
    this.queue = Phaser.Utils.Array.Shuffle([...pool]) as DiretorAttack[];
  }

  private nextAttack(): DiretorAttack {
    if (!this.queue.length) this.buildQueue();
    return this.queue.pop()!;
  }

  private startTelegraph(t: number) {
    this.currentAttack = this.nextAttack();
    const durations: Record<DiretorAttack, number> = {
      meta: 620,
      reestrutura: 560,
      pdi: 460,
    };
    const colors: Record<DiretorAttack, number> = {
      meta: 0xffaa22,
      reestrutura: 0x9966ff,
      pdi: 0xff3322,
    };
    const names: Record<DiretorAttack, string> = {
      meta: "META INALCANÇÁVEL",
      reestrutura: "REESTRUTURAÇÃO",
      pdi: "PDI INVOLUNTÁRIO!",
    };

    const factor = this.phase2 ? 0.82 : 1;
    this.bossState = "telegraph";
    this.stateUntil = t + durations[this.currentAttack] * factor;
    this.setTint(colors[this.currentAttack]);

    const lbl = this.scene.add
      .text(this.x, this.y - 70, names[this.currentAttack], {
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
      case "meta":
        this.onMeta?.(this.x, this.y);
        // fica exposto durante a subida da barra (janela de dano)
        this.stateUntil = t + 1500;
        break;

      case "reestrutura": {
        const newX = this.homeX; // fallback
        this.onReestrutura?.(this.x);
        void newX;
        this.stateUntil = t + 300;
        break;
      }

      case "pdi": {
        if (this.target) this.dir = this.target.x < this.x ? -1 : 1;
        this.setFlipX(this.dir === 1);
        const body = this.body as Phaser.Physics.Arcade.Body;
        body.setVelocityX(this.dir * 460);
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
    this.stateUntil = t + (this.phase2 ? 620 : 880);
    this.swingActive = false;
    this.swingHitbox = null;
    this.clearTint();
  }

  /** Chamada pela cena p/ reposicionar no lado oposto (Reestruturação). */
  teleportTo(x: number) {
    this.x = Phaser.Math.Clamp(x, 80, (this.scene.physics.world.bounds.width || 1920) - 80);
    this.homeX = this.x;
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
      markKilled("diretor_resultados");
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
      const f = Math.floor(now / 200) % 4;
      key = `tex-evangelista-boss-death${f}`;
    } else if (now < this._hurtUntil) {
      const f = Math.floor(now / 110) % 2;
      key = `tex-evangelista-boss-hurt${f}`;
    } else if (this.bossState === "telegraph" || this.bossState === "attack") {
      const f = Math.floor(now / 130) % 3;
      key = `tex-evangelista-boss-attack${f}`;
    } else if (this.bossState === "enter" || this.bossState === "recover") {
      const f = Math.floor(now / 150) % 3;
      key = `tex-evangelista-boss-walk${f}`;
    } else {
      const f = Math.floor(now / 560) % 2;
      key = `tex-evangelista-boss-idle${f}`;
    }
    applyTexture(this, key);
  }
}
