import Phaser from "phaser";
import { resolveSprite, applyTexture } from "../systems/SpriteLibrary";
import { markKilled } from "../systems/BestiarySystem";
import { fxGlow, showTelegraph } from "./Enemies";

const HIT_INVULN_MS = 400;

// ── Animação de caminhada dos inimigos de fase ───────────────────────────────
// Estes inimigos renderizavam a base ESTÁTICA (liam como objeto, não ameaça).
// Cicla frames enemy-<prefix>-walkN quando em movimento; parado volta à base.
// Whitelist: só prefixos cujos frames de walk têm o MESMO tamanho da base
// (evangelista fica de fora — walk 64x64 vs base 32x48 daria "pulo" visual).
const _phaseAnimOff = new WeakMap<Phaser.GameObjects.Sprite, number>();
function animPhase(
  e: Phaser.Physics.Arcade.Sprite,
  t: number,
  prefix: string,
  frames: number, // quantos walkN ciclar (0..frames-1)
  ms = 190,
): void {
  const body = e.body as Phaser.Physics.Arcade.Body | null;
  if (!body) return;
  if (!_phaseAnimOff.has(e)) _phaseAnimOff.set(e, (Math.random() * 1500) | 0);
  const off = _phaseAnimOff.get(e)!;
  if (Math.abs(body.velocity.x) > 5 || Math.abs(body.velocity.y) > 5) {
    const f = Math.floor((t + off) / ms) % frames;
    applyTexture(e, `tex-${prefix}-walk${f}`);
  } else {
    applyTexture(e, `tex-${prefix}`);
  }
}

// ─── TelemarketerZumbi ────────────────────────────────────────────────────────
export class TelemarketerZumbi extends Phaser.Physics.Arcade.Sprite {
  hp = 160;
  speed = 70;
  contactDamage = 12;
  vrReward = 2;

  target?: Phaser.GameObjects.Sprite;
  onFire?: (x: number, y: number, tx: number, ty: number) => void;

  private _invulnUntil = 0;
  private _frozen = 0;
  private _slow = 0;
  private _nextFireAt = 0;
  private _windupUntil = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, ...resolveSprite("tex-telemarketer"));
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(10);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(26, 40);
    body.setOffset(3, 8);
    body.setCollideWorldBounds(true);
    this._nextFireAt = scene.time.now + 3000;
  }

  preUpdate(t: number, dt: number) {
    super.preUpdate(t, dt);
    if (!this.active || !this.body) return;
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (t < this._frozen) {
      return;
    }
    const speedMult = t < this._slow ? 0.4 : 1;

    if (this.target) {
      const dx = this.target.x - this.x;
      const dir = dx >= 0 ? 1 : -1;
      this.setFlipX(dir === -1);
      body.setVelocityX(dir * this.speed * speedMult);

      // Disparo telegrafado: "!" + trava 350ms antes de atirar (era instantâneo).
      if (t >= this._nextFireAt && this._windupUntil === 0) {
        this._nextFireAt = t + 3000;
        this._windupUntil = t + 350;
        fxGlow(this, 0xffdd66, 420);
        showTelegraph(this);
      }
      if (this._windupUntil > 0) {
        body.setVelocityX(0);
        if (t >= this._windupUntil) {
          this._windupUntil = 0;
          this.onFire?.(this.x, this.y - 10, this.target.x, this.target.y);
        }
      }
    }
    animPhase(this, t, "telemarketer", 4);
  }

  hit(damage: number, knockback: number): boolean {
    const now = this.scene.time.now;
    if (now < this._invulnUntil) return false;
    this.applyFreeze(75);
    this._invulnUntil = now + HIT_INVULN_MS;
    this.hp -= damage;
    fxGlow(this, 0xff8888, 130);
    this.scene.time.delayedCall(100, () => {
      if (this.active) this.clearTint();
    });
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocityX(knockback);
    if (this.hp <= 0) markKilled("telemarketer_zumbi");
    return this.hp <= 0;
  }

  applyFreeze(ms: number) {
    this._frozen = Math.max(this._frozen, this.scene.time.now + ms);
  }
  applySlowdown(ms: number) {
    this._slow = Math.max(this._slow, this.scene.time.now + ms);
  }
}

// ─── ImpressoraAssombrada ─────────────────────────────────────────────────────
export class ImpressoraAssombrada extends Phaser.Physics.Arcade.Sprite {
  hp = 400;
  contactDamage = 8;
  vrReward = 8;

  onFire?: (fx: number, fy: number, dir: number) => void;

  private _invulnUntil = 0;
  private _frozen = 0;
  private _slow = 0;
  private _nextFireAt = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, ...resolveSprite("tex-impressora"));
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(10);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(48, 40);
    body.setOffset(0, 8);
    body.setCollideWorldBounds(true);
    this._nextFireAt = scene.time.now + 4000;
  }

  preUpdate(t: number, dt: number) {
    super.preUpdate(t, dt);
    if (!this.active || !this.body) return;
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocityX(0);
    if (t < this._frozen) return;

    if (t >= this._nextFireAt) {
      this._nextFireAt = t + 4000;
      fxGlow(this, 0xff6666, 380);
      showTelegraph(this, "#ff6666");
      this.scene.time.delayedCall(320, () => {
        if (this.active) [-1, 0, 1].forEach((dir) => this.onFire?.(this.x, this.y - 10, dir));
      });
    }
  }

  hit(damage: number, knockback: number): boolean {
    const now = this.scene.time.now;
    if (now < this._invulnUntil) return false;
    this.applyFreeze(75);
    this._invulnUntil = now + HIT_INVULN_MS;
    this.hp -= damage;
    fxGlow(this, 0xff8888, 130);
    this.scene.time.delayedCall(100, () => {
      if (this.active) this.clearTint();
    });
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocityX(knockback);
    if (this.hp <= 0) markKilled("impressora_assombrada");
    return this.hp <= 0;
  }

  applyFreeze(ms: number) {
    this._frozen = Math.max(this._frozen, this.scene.time.now + ms);
  }
  applySlowdown(ms: number) {
    this._slow = Math.max(this._slow, this.scene.time.now + ms);
  }
}

// ─── GuardiaoDoCafe ───────────────────────────────────────────────────────────
export class GuardiaoDoCafe extends Phaser.Physics.Arcade.Sprite {
  hp = 280;
  speed = 90;
  contactDamage = 20;
  vrReward = 4;

  target?: Phaser.GameObjects.Sprite;

  private _invulnUntil = 0;
  private _frozen = 0;
  private _slow = 0;
  private _startX: number;
  private _dir: 1 | -1 = 1;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, ...resolveSprite("tex-guardiao-cafe"));
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(10);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(24, 38);
    body.setOffset(4, 10);
    body.setCollideWorldBounds(true);
    this._startX = x;
  }

  preUpdate(t: number, dt: number) {
    super.preUpdate(t, dt);
    if (!this.active || !this.body) return;
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (t < this._frozen) {
      return;
    }
    const speedMult = t < this._slow ? 0.4 : 1;

    if (this.target) {
      const dist = Math.abs(this.target.x - this.x);
      if (dist < 150) {
        // charge toward player — telegraph
        fxGlow(this, 0xffdd00, 460);
        showTelegraph(this, "#ff5533");
        const dir = this.target.x >= this.x ? 1 : -1;
        this._dir = dir;
        this.setFlipX(dir === -1);
        body.setVelocityX(dir * this.speed * 1.4 * speedMult);
        return;
      }
    }
    this.clearTint(); // cor natural da máquina (sprite já é metálico) fora da carga

    // patrol
    if (this.x < this._startX - 100) {
      this._dir = 1;
    } else if (this.x > this._startX + 100) {
      this._dir = -1;
    }
    this.setFlipX(this._dir === -1);
    body.setVelocityX(this._dir * this.speed * speedMult);
    animPhase(this, t, "guardiao-cafe", 4);
  }

  hit(damage: number, knockback: number): boolean {
    const now = this.scene.time.now;
    if (now < this._invulnUntil) return false;
    this.applyFreeze(75);
    this._invulnUntil = now + HIT_INVULN_MS;
    this.hp -= damage;
    fxGlow(this, 0xff8888, 130);
    this.scene.time.delayedCall(100, () => {
      if (this.active) this.clearTint();
    });
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocityX(knockback);
    if (this.hp <= 0) markKilled("guardiao_cafe");
    return this.hp <= 0;
  }

  applyFreeze(ms: number) {
    this._frozen = Math.max(this._frozen, this.scene.time.now + ms);
  }
  applySlowdown(ms: number) {
    this._slow = Math.max(this._slow, this.scene.time.now + ms);
  }
}

// ─── NuvemBoardSentinela ──────────────────────────────────────────────────────
export class NuvemBoardSentinela extends Phaser.Physics.Arcade.Sprite {
  hp = 250;
  vrReward = 3;

  onFire?: (x: number, y: number) => void;

  private _invulnUntil = 0;
  private _frozen = 0;
  private _slow = 0;
  private _nextFireAt = 0;
  private _driftDir: 1 | -1 = 1;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, ...resolveSprite("tex-noticeboard"));
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(10);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(32, 32);
    body.setOffset(0, 8);
    body.setAllowGravity(false);
    body.setCollideWorldBounds(true);
    this._nextFireAt = scene.time.now + 2500;
    this._driftDir = Math.random() > 0.5 ? 1 : -1;
  }

  preUpdate(t: number, dt: number) {
    super.preUpdate(t, dt);
    if (!this.active || !this.body) return;
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (t < this._frozen) {
      return;
    }
    const speedMult = t < this._slow ? 0.4 : 1;

    if (body.blocked.left) this._driftDir = 1;
    else if (body.blocked.right) this._driftDir = -1;
    body.setVelocityX(this._driftDir * 40 * speedMult);

    // Telegrafa e dispara 320ms depois (posição atual no momento do disparo).
    if (t >= this._nextFireAt) {
      this._nextFireAt = t + 2500;
      fxGlow(this, 0xffdd66, 380);
      showTelegraph(this);
      this.scene.time.delayedCall(320, () => {
        if (this.active) this.onFire?.(this.x, this.y + 16);
      });
    }
    animPhase(this, t, "noticeboard", 4);
  }

  hit(damage: number, knockback: number): boolean {
    const now = this.scene.time.now;
    if (now < this._invulnUntil) return false;
    this.applyFreeze(75);
    this._invulnUntil = now + HIT_INVULN_MS;
    this.hp -= damage;
    fxGlow(this, 0xff8888, 130);
    this.scene.time.delayedCall(100, () => {
      if (this.active) this.clearTint();
    });
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocityX(knockback);
    if (this.hp <= 0) markKilled("nuvem_board_sentinela");
    return this.hp <= 0;
  }

  applyFreeze(ms: number) {
    this._frozen = Math.max(this._frozen, this.scene.time.now + ms);
  }
  applySlowdown(ms: number) {
    this._slow = Math.max(this._slow, this.scene.time.now + ms);
  }
}

// ─── EvangelistaCorporativo ───────────────────────────────────────────────────
export class EvangelistaCorporativo extends Phaser.Physics.Arcade.Sprite {
  hp = 224;
  speed = 60;
  contactDamage = 8;
  vrReward = 3;

  target?: Phaser.GameObjects.Sprite;
  onFire?: (fx: number, fy: number, tx: number, ty: number) => void;

  private _invulnUntil = 0;
  private _frozen = 0;
  private _slow = 0;
  private _aiState: "approach" | "stop" | "fire" | "resume" = "approach";
  private _stateUntil = 0;
  private _nextFireAt = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, ...resolveSprite("tex-evangelista"));
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(10);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(24, 38);
    body.setOffset(4, 10);
    body.setCollideWorldBounds(true);
    this._nextFireAt = scene.time.now + 3500;
  }

  preUpdate(t: number, dt: number) {
    super.preUpdate(t, dt);
    if (!this.active || !this.body) return;
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (t < this._frozen) {
      return;
    }
    const speedMult = t < this._slow ? 0.4 : 1;

    if (!this.target) {
      body.setVelocityX(0);
      return;
    }

    switch (this._aiState) {
      case "approach": {
        const dx = this.target.x - this.x;
        const dir = dx >= 0 ? 1 : -1;
        this.setFlipX(dir === -1);
        body.setVelocityX(dir * this.speed * speedMult);
        if (t >= this._nextFireAt) {
          this._aiState = "stop";
          this._stateUntil = t + 400;
          body.setVelocityX(0);
        }
        break;
      }
      case "stop":
        body.setVelocityX(0);
        fxGlow(this, 0xffdd00, 460); // telegraph
        showTelegraph(this);
        if (t >= this._stateUntil) {
          this._aiState = "fire";
          this._stateUntil = t + 200;
          this.clearTint();
          this.onFire?.(this.x, this.y - 10, this.target.x, this.target.y);
        }
        break;
      case "fire":
        body.setVelocityX(0);
        if (t >= this._stateUntil) {
          this._aiState = "resume";
          this._stateUntil = t + 800;
          this._nextFireAt = t + 3500;
        }
        break;
      case "resume":
        if (t >= this._stateUntil) this._aiState = "approach";
        break;
    }
  }

  hit(damage: number, knockback: number): boolean {
    const now = this.scene.time.now;
    if (now < this._invulnUntil) return false;
    this.applyFreeze(75);
    this._invulnUntil = now + HIT_INVULN_MS;
    this.hp -= damage;
    fxGlow(this, 0xff8888, 130);
    this.scene.time.delayedCall(100, () => {
      if (this.active) this.clearTint();
    });
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocityX(knockback);
    if (this.hp <= 0) markKilled("evangelista_corporativo");
    return this.hp <= 0;
  }

  applyFreeze(ms: number) {
    this._frozen = Math.max(this._frozen, this.scene.time.now + ms);
  }
  applySlowdown(ms: number) {
    this._slow = Math.max(this._slow, this.scene.time.now + ms);
  }
}

// ─── ColetorDeDados ───────────────────────────────────────────────────────────
export class ColetorDeDados extends Phaser.Physics.Arcade.Sprite {
  hp = 150;
  speed = 130;
  vrReward = 1;

  target?: Phaser.GameObjects.Sprite;
  onStealVR?: () => void;

  private _invulnUntil = 0;
  private _frozen = 0;
  private _slow = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, ...resolveSprite("tex-coletor"));
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(10);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(20, 16);
    body.setOffset(6, 16);
    body.setAllowGravity(false);
    body.setCollideWorldBounds(true);
  }

  preUpdate(t: number, dt: number) {
    super.preUpdate(t, dt);
    if (!this.active || !this.body) return;
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (t < this._frozen) {
      return;
    }
    const speedMult = t < this._slow ? 0.4 : 1;

    if (this.target) {
      const angle = Phaser.Math.Angle.Between(this.x, this.y, this.target.x, this.target.y);
      const spd = this.speed * speedMult;
      body.setVelocity(Math.cos(angle) * spd, Math.sin(angle) * spd);
      this.setFlipX(this.target.x < this.x);
    }
    animPhase(this, t, "coletor", 4);
  }

  hit(damage: number, knockback: number): boolean {
    const now = this.scene.time.now;
    if (now < this._invulnUntil) return false;
    this.applyFreeze(75);
    this._invulnUntil = now + HIT_INVULN_MS;
    this.hp -= damage;
    fxGlow(this, 0xff8888, 130);
    this.scene.time.delayedCall(100, () => {
      if (this.active) this.clearTint();
    });
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocityX(knockback);
    if (this.hp <= 0) markKilled("coletor_dados");
    return this.hp <= 0;
  }

  applyFreeze(ms: number) {
    this._frozen = Math.max(this._frozen, this.scene.time.now + ms);
  }
  applySlowdown(ms: number) {
    this._slow = Math.max(this._slow, this.scene.time.now + ms);
  }
}

// ─── PlanilhaViva ─────────────────────────────────────────────────────────────
export class PlanilhaViva extends Phaser.Physics.Arcade.Sprite {
  hp = 400;
  maxHp = 400;
  speed = 40;
  contactDamage = 10;
  vrReward = 6;
  split = false;

  target?: Phaser.GameObjects.Sprite;
  onSplit?: (x: number, y: number) => void;
  onFire?: (x: number, y: number) => void;

  private _invulnUntil = 0;
  private _frozen = 0;
  private _slow = 0;
  private _nextFireAt = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, ...resolveSprite("tex-planilha"));
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(10);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(30, 38);
    body.setOffset(1, 10);
    body.setCollideWorldBounds(true);
    this._nextFireAt = scene.time.now + 3000;
  }

  preUpdate(t: number, dt: number) {
    super.preUpdate(t, dt);
    if (!this.active || !this.body) return;
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (t < this._frozen) {
      return;
    }
    const speedMult = t < this._slow ? 0.4 : 1;

    if (this.target) {
      const dx = this.target.x - this.x;
      const dir = dx >= 0 ? 1 : -1;
      this.setFlipX(dir === -1);
      body.setVelocityX(dir * this.speed * speedMult);
    }

    if (t >= this._nextFireAt) {
      this._nextFireAt = t + 3000;
      fxGlow(this, 0x88ff88, 380);
      showTelegraph(this, "#88ff88");
      this.scene.time.delayedCall(320, () => {
        if (this.active) this.onFire?.(this.x, this.y);
      });
    }
    animPhase(this, t, "planilha", 4);
  }

  hit(damage: number, knockback: number): boolean {
    const now = this.scene.time.now;
    if (now < this._invulnUntil) return false;
    this.applyFreeze(75);
    this._invulnUntil = now + HIT_INVULN_MS;
    this.hp -= damage;
    fxGlow(this, 0xff8888, 130);
    this.scene.time.delayedCall(100, () => {
      if (this.active) this.clearTint();
    });
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocityX(knockback);
    if (this.hp <= this.maxHp * 0.5 && !this.split) {
      this.split = true;
      this.onSplit?.(this.x, this.y);
    }
    if (this.hp <= 0) markKilled("planilha_viva");
    return this.hp <= 0;
  }

  applyFreeze(ms: number) {
    this._frozen = Math.max(this._frozen, this.scene.time.now + ms);
  }
  applySlowdown(ms: number) {
    this._slow = Math.max(this._slow, this.scene.time.now + ms);
  }
}

// ─── CaboDeRede ───────────────────────────────────────────────────────────────
export class CaboDeRede extends Phaser.Physics.Arcade.Sprite {
  hp = 176;
  speed = 80;
  contactDamage = 10;
  vrReward = 2;
  cableUsed = false;

  target?: Phaser.Physics.Arcade.Sprite;
  onCable?: (player: Phaser.Physics.Arcade.Sprite) => void;

  private _invulnUntil = 0;
  private _frozen = 0;
  private _slow = 0;
  private _retreatUntil = 0;
  private _cableResetAt = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, ...resolveSprite("tex-cabo"));
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(10);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(22, 32);
    body.setOffset(5, 16);
    body.setCollideWorldBounds(true);
  }

  preUpdate(t: number, dt: number) {
    super.preUpdate(t, dt);
    if (!this.active || !this.body) return;
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (t < this._frozen) {
      return;
    }
    const speedMult = t < this._slow ? 0.4 : 1;

    if (this.cableUsed && t >= this._cableResetAt) {
      this.cableUsed = false;
      this._retreatUntil = 0;
    }

    if (t < this._retreatUntil) {
      // retreat: run away from player
      if (this.target) {
        const dir = this.x >= this.target.x ? 1 : -1;
        this.setFlipX(dir === -1);
        body.setVelocityX(dir * this.speed * speedMult);
      }
      return;
    }

    if (this.target) {
      const dx = this.target.x - this.x;
      const dist = Math.abs(dx);
      const dir = dx >= 0 ? 1 : -1;
      this.setFlipX(dir === -1);

      if (dist < 40 && !this.cableUsed) {
        this.cableUsed = true;
        this._cableResetAt = t + 3000;
        this._retreatUntil = t + 1200;
        this.onCable?.(this.target);
      } else {
        body.setVelocityX(dir * this.speed * speedMult);
      }
    }
    animPhase(this, t, "cabo", 4);
  }

  hit(damage: number, knockback: number): boolean {
    const now = this.scene.time.now;
    if (now < this._invulnUntil) return false;
    this.applyFreeze(75);
    this._invulnUntil = now + HIT_INVULN_MS;
    this.hp -= damage;
    fxGlow(this, 0xff8888, 130);
    this.scene.time.delayedCall(100, () => {
      if (this.active) this.clearTint();
    });
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocityX(knockback);
    if (this.hp <= 0) markKilled("cabo_rede");
    return this.hp <= 0;
  }

  applyFreeze(ms: number) {
    this._frozen = Math.max(this._frozen, this.scene.time.now + ms);
  }
  applySlowdown(ms: number) {
    this._slow = Math.max(this._slow, this.scene.time.now + ms);
  }
}

// ─── TiSuporte ────────────────────────────────────────────────────────────────
export class TiSuporte extends Phaser.Physics.Arcade.Sprite {
  hp = 300;
  speed = 90;
  contactDamage = 12;
  vrReward = 3;

  target?: Phaser.GameObjects.Sprite;
  onSpawnError?: (x: number, y: number) => void;

  private _invulnUntil = 0;
  private _frozen = 0;
  private _slow = 0;
  private _nextSpawnAt = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, ...resolveSprite("tex-ti-suporte"));
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(10);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(22, 36);
    body.setOffset(5, 12);
    body.setCollideWorldBounds(true);
    this._nextSpawnAt = scene.time.now + 4000;
  }

  preUpdate(t: number, dt: number) {
    super.preUpdate(t, dt);
    if (!this.active || !this.body) return;
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (t < this._frozen) {
      return;
    }
    const speedMult = t < this._slow ? 0.4 : 1;

    if (this.target) {
      const dx = this.target.x - this.x;
      const dir = dx >= 0 ? 1 : -1;
      this.setFlipX(dir === -1);
      body.setVelocityX(dir * this.speed * speedMult);
    }

    if (t >= this._nextSpawnAt) {
      this._nextSpawnAt = t + 4000;
      fxGlow(this, 0x66ccff, 380);
      showTelegraph(this, "#66ccff");
      this.scene.time.delayedCall(320, () => {
        if (this.active) this.onSpawnError?.(this.x, this.y - 30);
      });
    }
    animPhase(this, t, "ti-suporte", 3);
  }

  hit(damage: number, knockback: number): boolean {
    const now = this.scene.time.now;
    if (now < this._invulnUntil) return false;
    this.applyFreeze(75);
    this._invulnUntil = now + HIT_INVULN_MS;
    this.hp -= damage;
    fxGlow(this, 0xff8888, 130);
    this.scene.time.delayedCall(100, () => {
      if (this.active) this.clearTint();
    });
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocityX(knockback);
    if (this.hp <= 0) markKilled("ti_suporte");
    return this.hp <= 0;
  }

  applyFreeze(ms: number) {
    this._frozen = Math.max(this._frozen, this.scene.time.now + ms);
  }
  applySlowdown(ms: number) {
    this._slow = Math.max(this._slow, this.scene.time.now + ms);
  }
}

// ─── DroneDeVigilancia ────────────────────────────────────────────────────────
export class DroneDeVigilancia extends Phaser.Physics.Arcade.Sprite {
  hp = 144;
  vrReward = 3;
  private _floatY: number;

  target?: Phaser.GameObjects.Sprite;
  onBomb?: (x: number, y: number) => void;

  private _invulnUntil = 0;
  private _frozen = 0;
  private _slow = 0;
  private _nextBombAt = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, ...resolveSprite("tex-drone"));
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(10);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(28, 20);
    body.setOffset(2, 14);
    body.setAllowGravity(false);
    body.setCollideWorldBounds(true);
    this._floatY = y;
    this._nextBombAt = scene.time.now + 3000;
  }

  preUpdate(t: number, dt: number) {
    super.preUpdate(t, dt);
    if (!this.active || !this.body) return;
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (t < this._frozen) {
      return;
    }
    const speedMult = t < this._slow ? 0.4 : 1;

    // Track player X, maintain float Y
    const targetX = this.target ? this.target.x : this.x;
    const dx = targetX - this.x;
    const dy = this._floatY - this.y;
    body.setVelocity(
      Math.sign(dx) * Math.min(Math.abs(dx) * 2, 80) * speedMult,
      Math.sign(dy) * Math.min(Math.abs(dy) * 2, 40),
    );

    if (t >= this._nextBombAt) {
      this._nextBombAt = t + 3000;
      fxGlow(this, 0xff8844, 380);
      showTelegraph(this, "#ff8844");
      this.scene.time.delayedCall(320, () => {
        if (this.active) this.onBomb?.(this.x, this.y + 10);
      });
    }
    animPhase(this, t, "drone", 4, 130);
  }

  hit(damage: number, knockback: number): boolean {
    const now = this.scene.time.now;
    if (now < this._invulnUntil) return false;
    this.applyFreeze(75);
    this._invulnUntil = now + HIT_INVULN_MS;
    this.hp -= damage;
    fxGlow(this, 0xff8888, 130);
    this.scene.time.delayedCall(100, () => {
      if (this.active) this.clearTint();
    });
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocityX(knockback);
    if (this.hp <= 0) markKilled("drone_vigilancia");
    return this.hp <= 0;
  }

  applyFreeze(ms: number) {
    this._frozen = Math.max(this._frozen, this.scene.time.now + ms);
  }
  applySlowdown(ms: number) {
    this._slow = Math.max(this._slow, this.scene.time.now + ms);
  }
}

// ─── SegurancaCorporativa ─────────────────────────────────────────────────────
export class SegurancaCorporativa extends Phaser.Physics.Arcade.Sprite {
  hp = 280;
  speed = 120;
  contactDamage = 10;
  vrReward = 4;
  taseUsed = false;

  target?: Phaser.Physics.Arcade.Sprite;
  onTase?: (player: Phaser.Physics.Arcade.Sprite) => void;

  private _invulnUntil = 0;
  private _frozen = 0;
  private _slow = 0;
  private _retreatUntil = 0;
  private _taseResetAt = 0;
  private _patrolDir: 1 | -1 = 1;
  private _startX: number;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, ...resolveSprite("tex-seguranca"));
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(10);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(22, 38);
    body.setOffset(5, 10);
    body.setCollideWorldBounds(true);
    this._startX = x;
  }

  preUpdate(t: number, dt: number) {
    super.preUpdate(t, dt);
    if (!this.active || !this.body) return;
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (t < this._frozen) {
      return;
    }
    const speedMult = t < this._slow ? 0.4 : 1;

    if (this.taseUsed && t >= this._taseResetAt) {
      this.taseUsed = false;
    }

    if (t < this._retreatUntil) {
      if (this.target) {
        const dir = this.x >= this.target.x ? 1 : -1;
        this.setFlipX(dir === -1);
        body.setVelocityX(dir * this.speed * speedMult);
      }
      return;
    }

    if (this.target) {
      const dx = this.target.x - this.x;
      const dist = Math.abs(dx);

      if (dist < 120) {
        // charge toward player
        const dir = dx >= 0 ? 1 : -1;
        this.setFlipX(dir === -1);
        body.setVelocityX(dir * this.speed * speedMult);

        if (dist < 60 && !this.taseUsed) {
          this.taseUsed = true;
          this._taseResetAt = t + 4000;
          this._retreatUntil = t + 1000;
          this.onTase?.(this.target);
        }
        return;
      }
    }

    // patrol
    if (this.x < this._startX - 80) this._patrolDir = 1;
    else if (this.x > this._startX + 80) this._patrolDir = -1;
    this.setFlipX(this._patrolDir === -1);
    body.setVelocityX(this._patrolDir * (this.speed * 0.5) * speedMult);
    animPhase(this, t, "seguranca", 6);
  }

  hit(damage: number, knockback: number): boolean {
    const now = this.scene.time.now;
    if (now < this._invulnUntil) return false;
    this.applyFreeze(75);
    this._invulnUntil = now + HIT_INVULN_MS;
    this.hp -= damage;
    fxGlow(this, 0xff8888, 130);
    this.scene.time.delayedCall(100, () => {
      if (this.active) this.clearTint();
    });
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocityX(knockback);
    if (this.hp <= 0) markKilled("seguranca_corporativa");
    return this.hp <= 0;
  }

  applyFreeze(ms: number) {
    this._frozen = Math.max(this._frozen, this.scene.time.now + ms);
  }
  applySlowdown(ms: number) {
    this._slow = Math.max(this._slow, this.scene.time.now + ms);
  }
}

// ─── CarimbadorAutomatico ─────────────────────────────────────────────────────
export class CarimbadorAutomatico extends Phaser.Physics.Arcade.Sprite {
  hp = 256;
  speed = 50;
  contactDamage = 8;
  vrReward = 4;

  target?: Phaser.GameObjects.Sprite;
  onStamp?: (x: number, y: number) => void;

  private _invulnUntil = 0;
  private _frozen = 0;
  private _slow = 0;
  private _nextStampAt = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, ...resolveSprite("tex-carimbador"));
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(10);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(22, 38);
    body.setOffset(5, 10);
    body.setCollideWorldBounds(true);
    this._nextStampAt = scene.time.now + 3500;
  }

  preUpdate(t: number, dt: number) {
    super.preUpdate(t, dt);
    if (!this.active || !this.body) return;
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (t < this._frozen) {
      return;
    }
    const speedMult = t < this._slow ? 0.4 : 1;

    if (this.target) {
      const dx = this.target.x - this.x;
      const dir = dx >= 0 ? 1 : -1;
      this.setFlipX(dir === -1);
      body.setVelocityX(dir * this.speed * speedMult);
    }

    if (t >= this._nextStampAt) {
      this._nextStampAt = t + 3500;
      this.onStamp?.(this.x, this.y);
    }
  }

  hit(damage: number, knockback: number): boolean {
    const now = this.scene.time.now;
    if (now < this._invulnUntil) return false;
    this.applyFreeze(75);
    this._invulnUntil = now + HIT_INVULN_MS;
    this.hp -= damage;
    fxGlow(this, 0xff8888, 130);
    this.scene.time.delayedCall(100, () => {
      if (this.active) this.clearTint();
    });
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocityX(knockback);
    if (this.hp <= 0) markKilled("carimbador_automatico");
    return this.hp <= 0;
  }

  applyFreeze(ms: number) {
    this._frozen = Math.max(this._frozen, this.scene.time.now + ms);
  }
  applySlowdown(ms: number) {
    this._slow = Math.max(this._slow, this.scene.time.now + ms);
  }
}

// ─── ArquivoAmbulante ─────────────────────────────────────────────────────────
export class ArquivoAmbulante extends Phaser.Physics.Arcade.Sprite {
  // Rebalance (playtest): 800 HP era esponja (69 golpes base) e contato 35
  // tirava 1/3 da energia num toque — o pior do jogo, acima do CEO (18).
  hp = 500;
  speed = 30;
  contactDamage = 14;
  vrReward = 15;

  target?: Phaser.GameObjects.Sprite;

  private _invulnUntil = 0;
  private _frozen = 0;
  private _slow = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, ...resolveSprite("tex-arquivo"));
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(10);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(34, 44);
    body.setOffset(0, 4);
    body.setCollideWorldBounds(true);
  }

  preUpdate(t: number, dt: number) {
    super.preUpdate(t, dt);
    if (!this.active || !this.body) return;
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (t < this._frozen) {
      return;
    }
    const speedMult = t < this._slow ? 0.4 : 1;

    if (this.target) {
      const dx = this.target.x - this.x;
      const dir = dx >= 0 ? 1 : -1;
      this.setFlipX(dir === -1);
      body.setVelocityX(dir * this.speed * speedMult);
    }
  }

  hit(damage: number, knockback: number): boolean {
    const now = this.scene.time.now;
    if (now < this._invulnUntil) return false;
    this.applyFreeze(75);
    this._invulnUntil = now + HIT_INVULN_MS;
    this.hp -= damage;
    fxGlow(this, 0xff8888, 130);
    this.scene.time.delayedCall(100, () => {
      if (this.active) this.clearTint();
    });
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocityX(knockback * 0.3); // very heavy
    if (this.hp <= 0) markKilled("arquivo_ambulante");
    return this.hp <= 0;
  }

  applyFreeze(ms: number) {
    this._frozen = Math.max(this._frozen, this.scene.time.now + ms);
  }
  applySlowdown(ms: number) {
    this._slow = Math.max(this._slow, this.scene.time.now + ms);
  }
}

// ─── BateriaSocial ────────────────────────────────────────────────────────────
export class BateriaSocial extends Phaser.Physics.Arcade.Sprite {
  hp = 200;
  speed = 60;
  contactDamage = 8;
  vrReward = 4;

  target?: Phaser.GameObjects.Sprite;
  onDeath?: () => void;

  private _invulnUntil = 0;
  private _frozen = 0;
  private _slow = 0;
  private _patrolDir: 1 | -1 = 1;
  private _startX: number;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, ...resolveSprite("tex-bateria"));
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(10);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(22, 36);
    body.setOffset(5, 12);
    body.setCollideWorldBounds(true);
    this._startX = x;
  }

  getAuraRange(): number {
    return 200;
  }

  preUpdate(t: number, dt: number) {
    super.preUpdate(t, dt);
    if (!this.active || !this.body) return;
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (t < this._frozen) {
      return;
    }
    const speedMult = t < this._slow ? 0.4 : 1;

    if (this.x < this._startX - 100) this._patrolDir = 1;
    else if (this.x > this._startX + 100) this._patrolDir = -1;
    this.setFlipX(this._patrolDir === -1);
    body.setVelocityX(this._patrolDir * this.speed * speedMult);
  }

  hit(damage: number, knockback: number): boolean {
    const now = this.scene.time.now;
    if (now < this._invulnUntil) return false;
    this.applyFreeze(75);
    this._invulnUntil = now + HIT_INVULN_MS;
    this.hp -= damage;
    fxGlow(this, 0xff8888, 130);
    this.scene.time.delayedCall(100, () => {
      if (this.active) this.clearTint();
    });
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocityX(knockback);
    if (this.hp <= 0) {
      this.onDeath?.();
      markKilled("bateria_social");
    }
    return this.hp <= 0;
  }

  applyFreeze(ms: number) {
    this._frozen = Math.max(this._frozen, this.scene.time.now + ms);
  }
  applySlowdown(ms: number) {
    this._slow = Math.max(this._slow, this.scene.time.now + ms);
  }
}

// ─── ReuniaoCorportiva ─────────────────────────────────────────────────────────
// Fase 2 — Anda devagar; quando player entra em range dispara "pauta infinita"
// (callback onAura → cena aplica freeze/slow no player por 600ms).
export class ReuniaoCorportiva extends Phaser.Physics.Arcade.Sprite {
  hp = 320;
  speed = 45;
  contactDamage = 0;
  vrReward = 5;

  target?: Phaser.GameObjects.Sprite;
  onAura?: (tx: number, ty: number) => void;

  private _invulnUntil = 0;
  private _frozen = 0;
  private _slow = 0;
  private _auraAt = 0;
  private _patrolDir: 1 | -1 = 1;
  private _startX: number;
  private _animOffset: number;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, "sprites", "enemy-reuniao-idle0");
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(10);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(40, 52);
    body.setOffset(4, 8);
    body.setCollideWorldBounds(true);
    this._startX = x;
    this._animOffset = (Math.random() * 2000) | 0;
    this._auraAt = scene.time.now + 5000;
  }

  preUpdate(t: number, dt: number) {
    super.preUpdate(t, dt);
    if (!this.active || !this.body) return;
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (t < this._frozen) return;
    const speedMult = t < this._slow ? 0.4 : 1;

    if (this.x < this._startX - 120) this._patrolDir = 1;
    else if (this.x > this._startX + 120) this._patrolDir = -1;
    this.setFlipX(this._patrolDir === -1);
    body.setVelocityX(this._patrolDir * this.speed * speedMult);

    const walkFrame = Math.floor((t + this._animOffset) / 220) % 4;
    this.setTexture("sprites", `enemy-reuniao-walk${walkFrame}`);

    if (this.target && t >= this._auraAt && Math.abs(this.target.x - this.x) < 200) {
      this._auraAt = t + 3000;
      this.onAura?.(this.target.x, this.target.y);
    }
  }

  hit(damage: number, knockback: number): boolean {
    const now = this.scene.time.now;
    if (now < this._invulnUntil) return false;
    this.applyFreeze(75);
    this._invulnUntil = now + HIT_INVULN_MS;
    this.hp -= damage;
    fxGlow(this, 0xff8888, 130);
    this.scene.time.delayedCall(100, () => {
      if (this.active) this.clearTint();
    });
    (this.body as Phaser.Physics.Arcade.Body).setVelocityX(knockback);
    if (this.hp <= 0) markKilled("reuniao_corporativa");
    return this.hp <= 0;
  }

  applyFreeze(ms: number) {
    this._frozen = Math.max(this._frozen, this.scene.time.now + ms);
  }
  applySlowdown(ms: number) {
    this._slow = Math.max(this._slow, this.scene.time.now + ms);
  }
}

// ─── ImpressoraVermelha ────────────────────────────────────────────────────────
// Fase 3 — Move-se lentamente, atira toner em cadência regular.
export class ImpressoraVermelha extends Phaser.Physics.Arcade.Sprite {
  hp = 480;
  contactDamage = 12;
  vrReward = 10;

  target?: Phaser.GameObjects.Sprite;
  onFire?: (fx: number, fy: number, dir: number) => void;

  private _invulnUntil = 0;
  private _frozen = 0;
  private _slow = 0;
  private _nextFireAt = 0;
  private _animOffset: number;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, "sprites", "enemy-impressora-b-idle0");
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(10);
    this.setTint(0xff6644); // tier vermelha: vermelho quente
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(44, 40);
    body.setOffset(2, 16);
    body.setCollideWorldBounds(true);
    this._nextFireAt = scene.time.now + 3500;
    this._animOffset = (Math.random() * 2000) | 0;
  }

  preUpdate(t: number, dt: number) {
    super.preUpdate(t, dt);
    if (!this.active || !this.body) return;
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (t < this._frozen) return;
    const speedMult = t < this._slow ? 0.4 : 1;

    if (this.target) {
      const dx = this.target.x - this.x;
      const dir = dx >= 0 ? 1 : -1;
      this.setFlipX(dir === -1);
      body.setVelocityX(dir * 30 * speedMult);

      if (t >= this._nextFireAt) {
        this._nextFireAt = t + 2000;
        this.onFire?.(this.x, this.y - 8, dir);
      }
    }

    const walkFrame = Math.floor((t + this._animOffset) / 250) % 6;
    this.setTexture("sprites", `enemy-impressora-b-walk${walkFrame}`);
  }

  hit(damage: number, knockback: number): boolean {
    const now = this.scene.time.now;
    if (now < this._invulnUntil) return false;
    this.applyFreeze(75);
    this._invulnUntil = now + HIT_INVULN_MS;
    this.hp -= damage;
    fxGlow(this, 0xff8888, 130);
    this.scene.time.delayedCall(100, () => {
      if (this.active) this.setTint(0xff6644); // restaura o tint do tier após o flash
    });
    (this.body as Phaser.Physics.Arcade.Body).setVelocityX(knockback);
    if (this.hp <= 0) markKilled("impressora_vermelha");
    return this.hp <= 0;
  }

  applyFreeze(ms: number) {
    this._frozen = Math.max(this._frozen, this.scene.time.now + ms);
  }
  applySlowdown(ms: number) {
    this._slow = Math.max(this._slow, this.scene.time.now + ms);
  }
}

// ─── ImpressoraFantasma ────────────────────────────────────────────────────────
// Fase 4 — Burst de 2 tiros seguidos, depois pausa longa.
export class ImpressoraFantasma extends Phaser.Physics.Arcade.Sprite {
  hp = 560;
  contactDamage = 15;
  vrReward = 12;

  target?: Phaser.GameObjects.Sprite;
  onFire?: (fx: number, fy: number, dir: number) => void;

  private _invulnUntil = 0;
  private _frozen = 0;
  private _slow = 0;
  private _nextFireAt = 0;
  private _burstCount = 0;
  private _animOffset: number;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, "sprites", "enemy-impressora-c-idle0");
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(10);
    this.setTint(0x88ddff); // tier fantasma: azul-espectral
    this.setAlpha(0.78); // translúcido, "assombrado"
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(44, 40);
    body.setOffset(2, 16);
    body.setCollideWorldBounds(true);
    this._nextFireAt = scene.time.now + 3000;
    this._animOffset = (Math.random() * 2000) | 0;
  }

  preUpdate(t: number, dt: number) {
    super.preUpdate(t, dt);
    if (!this.active || !this.body) return;
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (t < this._frozen) return;
    const speedMult = t < this._slow ? 0.4 : 1;

    if (this.target) {
      const dx = this.target.x - this.x;
      const dir = dx >= 0 ? 1 : -1;
      this.setFlipX(dir === -1);
      body.setVelocityX(dir * 50 * speedMult);

      if (t >= this._nextFireAt) {
        this._burstCount++;
        this.onFire?.(this.x, this.y - 8, dir);
        this._nextFireAt = this._burstCount % 2 === 0 ? t + 2400 : t + 350;
      }
    }

    const walkFrame = Math.floor((t + this._animOffset) / 230) % 6;
    this.setTexture("sprites", `enemy-impressora-c-walk${walkFrame}`);
  }

  hit(damage: number, knockback: number): boolean {
    const now = this.scene.time.now;
    if (now < this._invulnUntil) return false;
    this.applyFreeze(75);
    this._invulnUntil = now + HIT_INVULN_MS;
    this.hp -= damage;
    fxGlow(this, 0xff8888, 130);
    this.scene.time.delayedCall(100, () => {
      if (this.active) this.setTint(0x88ddff); // restaura o tint do tier após o flash
    });
    (this.body as Phaser.Physics.Arcade.Body).setVelocityX(knockback);
    if (this.hp <= 0) markKilled("impressora_fantasma");
    return this.hp <= 0;
  }

  applyFreeze(ms: number) {
    this._frozen = Math.max(this._frozen, this.scene.time.now + ms);
  }
  applySlowdown(ms: number) {
    this._slow = Math.max(this._slow, this.scene.time.now + ms);
  }
}

// ─── ImpressoraNecromorfa ──────────────────────────────────────────────────────
// Fase 5 — Mais rápida, dispara dobrado quando HP < 50%.
export class ImpressoraNecromorfa extends Phaser.Physics.Arcade.Sprite {
  hp = 720;
  contactDamage = 22;
  vrReward = 16;

  target?: Phaser.GameObjects.Sprite;
  onFire?: (fx: number, fy: number, dir: number) => void;
  onDeath?: () => void;

  private _invulnUntil = 0;
  private _frozen = 0;
  private _slow = 0;
  private _nextFireAt = 0;
  private _animOffset: number;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, "sprites", "enemy-impressora-d-idle0");
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(10);
    this.setTint(0x99ff88); // tier necromorfa: verde-doente
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(44, 40);
    body.setOffset(2, 16);
    body.setCollideWorldBounds(true);
    this._nextFireAt = scene.time.now + 2500;
    this._animOffset = (Math.random() * 2000) | 0;
  }

  preUpdate(t: number, dt: number) {
    super.preUpdate(t, dt);
    if (!this.active || !this.body) return;
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (t < this._frozen) return;
    const speedMult = t < this._slow ? 0.4 : 1;

    if (this.target) {
      const dx = this.target.x - this.x;
      const dir = dx >= 0 ? 1 : -1;
      this.setFlipX(dir === -1);
      body.setVelocityX(dir * 65 * speedMult);

      if (t >= this._nextFireAt) {
        this._nextFireAt = t + 1800;
        this.onFire?.(this.x, this.y - 8, dir);
        if (this.hp < 360) {
          this.scene.time.delayedCall(300, () => {
            if (this.active) this.onFire?.(this.x, this.y - 8, dir);
          });
        }
      }
    }

    const walkFrame = Math.floor((t + this._animOffset) / 210) % 6;
    this.setTexture("sprites", `enemy-impressora-d-walk${walkFrame}`);
  }

  hit(damage: number, knockback: number): boolean {
    const now = this.scene.time.now;
    if (now < this._invulnUntil) return false;
    this.applyFreeze(75);
    this._invulnUntil = now + HIT_INVULN_MS;
    this.hp -= damage;
    fxGlow(this, 0xff8888, 130);
    this.scene.time.delayedCall(100, () => {
      if (this.active) this.setTint(0x99ff88); // restaura o tint do tier após o flash
    });
    (this.body as Phaser.Physics.Arcade.Body).setVelocityX(knockback);
    if (this.hp <= 0) {
      this.onDeath?.();
      markKilled("impressora_necromorfa");
    }
    return this.hp <= 0;
  }

  applyFreeze(ms: number) {
    this._frozen = Math.max(this._frozen, this.scene.time.now + ms);
  }
  applySlowdown(ms: number) {
    this._slow = Math.max(this._slow, this.scene.time.now + ms);
  }
}

// ─── EvangelistaAvancado ───────────────────────────────────────────────────────
// Fase 4 — Mais agressivo; cura inimigos próximos via onHeal callback a cada 6s.
export class EvangelistaAvancado extends Phaser.Physics.Arcade.Sprite {
  hp = 400;
  speed = 80;
  contactDamage = 12;
  vrReward = 6;

  target?: Phaser.GameObjects.Sprite;
  onFire?: (fx: number, fy: number, tx: number, ty: number) => void;
  onHeal?: () => void;

  private _invulnUntil = 0;
  private _frozen = 0;
  private _slow = 0;
  private _nextFireAt = 0;
  private _nextHealAt = 0;
  private _animOffset: number;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, "sprites", "enemy-evangelista-boss-idle0");
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(10);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(34, 56);
    body.setOffset(7, 8);
    body.setCollideWorldBounds(true);
    this._nextFireAt = scene.time.now + 2500;
    this._nextHealAt = scene.time.now + 6000;
    this._animOffset = (Math.random() * 2000) | 0;
  }

  preUpdate(t: number, dt: number) {
    super.preUpdate(t, dt);
    if (!this.active || !this.body) return;
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (t < this._frozen) return;
    const speedMult = t < this._slow ? 0.4 : 1;

    if (this.target) {
      const dx = this.target.x - this.x;
      const dir = dx >= 0 ? 1 : -1;
      this.setFlipX(dir === -1);
      body.setVelocityX(dir * this.speed * speedMult);

      if (t >= this._nextFireAt && Math.abs(dx) < 350) {
        this._nextFireAt = t + 1800;
        this.onFire?.(this.x, this.y - 12, this.target.x, this.target.y);
      }
      if (t >= this._nextHealAt) {
        this._nextHealAt = t + 6000;
        this.onHeal?.();
      }
    }

    const walkFrame = Math.floor((t + this._animOffset) / 240) % 3;
    this.setTexture("sprites", `enemy-evangelista-boss-walk${walkFrame}`);
  }

  hit(damage: number, knockback: number): boolean {
    const now = this.scene.time.now;
    if (now < this._invulnUntil) return false;
    this.applyFreeze(75);
    this._invulnUntil = now + HIT_INVULN_MS;
    this.hp -= damage;
    fxGlow(this, 0xff8888, 130);
    this.scene.time.delayedCall(100, () => {
      if (this.active) this.clearTint();
    });
    (this.body as Phaser.Physics.Arcade.Body).setVelocityX(knockback);
    if (this.hp <= 0) markKilled("evangelista_avancado");
    return this.hp <= 0;
  }

  applyFreeze(ms: number) {
    this._frozen = Math.max(this._frozen, this.scene.time.now + ms);
  }
  applySlowdown(ms: number) {
    this._slow = Math.max(this._slow, this.scene.time.now + ms);
  }
}

// ─── EvangelistaMegaCorp ───────────────────────────────────────────────────────
// Fase 5 — Forma final: dispara 3 PostIts em leque, cura inimigos a cada 4s.
export class EvangelistaMegaCorp extends Phaser.Physics.Arcade.Sprite {
  hp = 600;
  speed = 100;
  contactDamage = 16;
  vrReward = 9;

  target?: Phaser.GameObjects.Sprite;
  onFire?: (fx: number, fy: number, tx: number, ty: number) => void;
  onHeal?: () => void;

  private _invulnUntil = 0;
  private _frozen = 0;
  private _slow = 0;
  private _nextFireAt = 0;
  private _nextHealAt = 0;
  private _animOffset: number;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, "sprites", "enemy-evangelista-mega-idle0");
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(10);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(38, 60);
    body.setOffset(5, 4);
    body.setCollideWorldBounds(true);
    this._nextFireAt = scene.time.now + 2000;
    this._nextHealAt = scene.time.now + 4000;
    this._animOffset = (Math.random() * 2000) | 0;
  }

  preUpdate(t: number, dt: number) {
    super.preUpdate(t, dt);
    if (!this.active || !this.body) return;
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (t < this._frozen) return;
    const speedMult = t < this._slow ? 0.4 : 1;

    if (this.target) {
      const dx = this.target.x - this.x;
      const dir = dx >= 0 ? 1 : -1;
      this.setFlipX(dir === -1);
      body.setVelocityX(dir * this.speed * speedMult);

      if (t >= this._nextFireAt && Math.abs(dx) < 400) {
        this._nextFireAt = t + 1400;
        // leque de 3 PostIts: centro, acima, abaixo
        this.onFire?.(this.x, this.y - 12, this.target.x, this.target.y);
        this.onFire?.(this.x, this.y - 12, this.target.x, this.target.y - 30);
        this.onFire?.(this.x, this.y - 12, this.target.x, this.target.y + 30);
      }
      if (t >= this._nextHealAt) {
        this._nextHealAt = t + 4000;
        this.onHeal?.();
      }
    }

    const walkFrame = Math.floor((t + this._animOffset) / 220) % 2;
    this.setTexture("sprites", `enemy-evangelista-mega-walk${walkFrame}`);
  }

  hit(damage: number, knockback: number): boolean {
    const now = this.scene.time.now;
    if (now < this._invulnUntil) return false;
    this.applyFreeze(75);
    this._invulnUntil = now + HIT_INVULN_MS;
    this.hp -= damage;
    fxGlow(this, 0xff8888, 130);
    this.scene.time.delayedCall(100, () => {
      if (this.active) this.clearTint();
    });
    (this.body as Phaser.Physics.Arcade.Body).setVelocityX(knockback);
    if (this.hp <= 0) markKilled("evangelista_megacorp");
    return this.hp <= 0;
  }

  applyFreeze(ms: number) {
    this._frozen = Math.max(this._frozen, this.scene.time.now + ms);
  }
  applySlowdown(ms: number) {
    this._slow = Math.max(this._slow, this.scene.time.now + ms);
  }
}
