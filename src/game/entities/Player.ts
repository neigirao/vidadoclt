import Phaser from "phaser";
import { applyTexture, resolveSprite } from "../systems/SpriteLibrary";
import { SpecialType } from "../systems/WeaponSystem";
import { CombatFx } from "../systems/CombatFx";
import { Sfx } from "../systems/AudioSystem";
import { sanityBand } from "../systems/PlayerState";

const WALK_SPEED = 200;
const JUMP_VEL = -520;
const COYOTE_MS = 100;
const JUMP_BUFFER_MS = 100;
const DASH_SPEED = 600;
const DASH_MS = 150;
const DASH_COOLDOWN_MS = 950;
const COMBO_WINDOW_MS = 450;
const HIT_INVULN_MS = 350;
const MELEE_ACTIVE_MS = 120; // janela ativa da hitbox do golpe corpo-a-corpo
const PARRY_WINDOW_MS = 200; // janela ativa do parry
const PARRY_COOLDOWN_MS = 1000; // cooldown após parry bem-sucedido
const PARRY_SANITY_RESTORE = 12; // sanidade restaurada num parry bem-sucedido
const PARRY_WHIFF_ENERGY_COST = 6; // energia perdida ao errar o parry

export type PlayerKeys = {
  left: Phaser.Input.Keyboard.Key;
  right: Phaser.Input.Keyboard.Key;
  jump: Phaser.Input.Keyboard.Key;
  jumpAlt: Phaser.Input.Keyboard.Key;
  dash: Phaser.Input.Keyboard.Key;
  attack: Phaser.Input.Keyboard.Key;
  special: Phaser.Input.Keyboard.Key;
  parry: Phaser.Input.Keyboard.Key;
  consumivel: Phaser.Input.Keyboard.Key;
  secondary: Phaser.Input.Keyboard.Key;
};

export class Player extends Phaser.Physics.Arcade.Sprite {
  energy = 100;
  maxEnergy = 100;
  sanity = 100;
  maxSanity = 100;
  vr = 0;

  facing: 1 | -1 = 1;
  baseWalkSpeed = WALK_SPEED;

  autonomia = false;
  frozenUntil = 0;
  walkSpeed = WALK_SPEED;
  attackRange = 28;
  damageMult = 1.0;
  vrDropMult = 1.0;
  weaponId = "grampeador";

  consumivel: string | null = null;
  consumivelUses = 0;
  consumivelSanityBonus = 0;
  secondaryWeaponId: string | null = null;
  // Synergy fields
  airAttackBonus = 0;
  dashResetOnKill = false;
  firstStrikeStun = false;
  dashDamage = 0;

  parryWindowBonus = 0; // ms adicionais ao PARRY_WINDOW_MS via upgrade
  dashCooldownBonus = 0; // ms subtraídos do cooldown do dash
  specialCooldownMult = 1.0; // multiplicador do cooldown do especial
  damageReductionMult = 1.0; // multiplicador de dano recebido (0.9^n)
  parryEnergyRestore = 0; // energia restaurada num parry bem-sucedido
  parryVrDrop = 0; // VR ganho num parry bem-sucedido
  doubleJump = false;
  aggroRadius = 200;
  firstStrikeReady = false;
  healOnKill = 0; // energy restored per kill (banco_de_horas perk)
  sanityFloor = 0; // minimum sanity (plano_de_saude perk)
  onKill?: () => void; // called when this player kills an enemy
  hitAutoRanged = false;
  isRangedPrimary = false;
  attackIntervalMs = 220;
  comboHits: 2 | 3 | 4 = 3;
  specialCooldown = 3000;
  specialType: SpecialType = "burst_ranged";
  onSpecialAttack?: (type: SpecialType, x: number, y: number, facing: 1 | -1) => void;

  onRangedAttack?: (fromX: number, fromY: number, facing: 1 | -1) => void;

  private speedMultUntil = 0;
  private speedMult = 0.4;
  private dashTrailTimer = 0;
  private djRing: Phaser.GameObjects.Graphics | null = null;
  private djRingPulse = 0;
  private marker!: Phaser.GameObjects.Graphics;

  private jumpsUsed = 0;
  private specialCooldownUntil = 0;
  private prevSpecialDown = false;

  private keys: PlayerKeys;
  private pad: Phaser.Input.Gamepad.Gamepad | null = null;
  private lastGroundedAt = 0;
  private prevOnGround = false;
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
  private prevPadInteractDown = false;
  private prevParryDown = false;
  private prevConsumivelDown = false;
  private prevSecondaryDown = false;

  onConsumivelUsed?: () => void;
  onSecondarySwap?: () => void;

  // Parry "Reclamar"
  private parryActiveUntil = 0;
  private parryCooldownUntil = 0;
  onParrySuccess?: (fromX: number) => void;
  private lastSanityDrainAt = 0;
  private _frozenTintActive = false;

  // ─── Sintomas do Burnout ─────────────────────────────────────────────────
  // Penalidades sistêmicas escalonadas por faixa de Sanidade. Aplicadas todo
  // frame em applyBurnoutSymptoms() e consultadas em takeDamage/parry/special.
  //   ok       (75-100): sem efeitos
  //   distraido(50-74):  velocidade -10%, parry -40ms
  //   ansioso  (25-49):  +cooldown especial +30%, VR drop -20%, tremor 6s/400ms
  //   colapso  ( 0-24):  +parry DESABILITADO, +30% dano recebido, tremor 3s/700ms,
  //                      drena Sanidade 60% mais rápido
  private _tremorUntil = 0;
  private _nextTremorAt = 0;
  private _lastBurnoutBand: ReturnType<typeof sanityBand> = "ok";
  private tremorLabel: Phaser.GameObjects.Text | null = null;

  /** True for exactly one frame when the gamepad B button is pressed (interact).
   *  Scenes that use keyboard E for interact can check this alongside JustDown. */
  gamepadInteractJustPressed = false;

  onAttack?: (
    hitbox: Phaser.Geom.Rectangle,
    step: number,
    swingId?: number,
    firstFrame?: boolean,
  ) => void;
  onDeath?: (cause: "burnout" | "energy") => void;
  onHit?: () => void;

  // Janela ativa do golpe de melee: a hitbox fica "viva" por alguns ms, então
  // inimigos que entram no alcance logo depois do input ainda são acertados
  // (mata o "bati e não acertou" de hitscan de 1 frame). O swingId + dedup na
  // cena garantem 1 hit por inimigo por golpe.
  private _swingActive = false;
  private _swingEndAt = 0;
  private _swingId = 0;
  private _swingStep = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    // idle1 (pose parada real). idle0 é o busto/portrait — usá-lo aqui mostrava
    // um "boneco estranho" no 1º instante do spawn até o updateTexture corrigir.
    super(scene, x, y, ...resolveSprite("tex-player-idle1"));
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(10);
    this.setDisplaySize(48, 64); // taller than wide — matches character sprite proportions and stands out from enemies
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(22, 44);
    body.setOffset(29, 34); // 80×80 sprite: x=(80-22)/2, y=80-44-2
    body.setCollideWorldBounds(true);
    // O corpo (22px) é bem mais estreito que a arte (~48px visíveis): encostado
    // no limite do mundo, o sprite vazava ~14px pra fora da tela e aparecia
    // "cortado" numa linha vertical. Bounds custom recuados mantêm a arte
    // inteira dentro do canvas.
    this.scene.events.once("update", () => {
      const wb = this.scene.physics.world.bounds;
      body.setBoundsRectangle(new Phaser.Geom.Rectangle(wb.x + 14, wb.y, wb.width - 28, wb.height));
    });
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
      parry: kb.addKey(Phaser.Input.Keyboard.KeyCodes.F),
      consumivel: kb.addKey(Phaser.Input.Keyboard.KeyCodes.C),
      secondary: kb.addKey(Phaser.Input.Keyboard.KeyCodes.Q),
    };
    // A/D
    kb.addKey(Phaser.Input.Keyboard.KeyCodes.A).on("down", () => (this.holdA = true));
    kb.addKey(Phaser.Input.Keyboard.KeyCodes.A).on("up", () => (this.holdA = false));
    kb.addKey(Phaser.Input.Keyboard.KeyCodes.D).on("down", () => (this.holdD = true));
    kb.addKey(Phaser.Input.Keyboard.KeyCodes.D).on("up", () => (this.holdD = false));

    // Gamepad: listen for connection and capture already-connected pad
    scene.input.gamepad?.on("connected", (pad: Phaser.Input.Gamepad.Gamepad) => {
      this.pad = pad;
    });
    this.pad = scene.input.gamepad?.pad1 ?? null;

    // Marcador do jogador: chevron ciano flutuante acima da cabeça, para
    // distinguir o player dos inimigos (vários usam arte parecida de office worker).
    this.marker = scene.add.graphics().setDepth(this.depth + 5);
  }

  /** Desenha o chevron indicador acima da cabeça do player. */
  // Hitbox do golpe corpo-a-corpo — recalculada a cada frame para seguir o
  // player durante a janela ativa. Margem de perdão: começa levemente atrás do
  // centro (pega inimigo colado), alcance +18 e altura 44 (não "passa por cima").
  private buildMeleeHitbox(): Phaser.Geom.Rectangle {
    // Margens de perdão contra o "bati e não acertou": alcance = attackRange + 24,
    // altura 52 (pega inimigo em degrau/plataforma baixa logo acima/abaixo) e a
    // hitbox começa 8px atrás do centro (pega o inimigo colado nas costas/frente).
    const reach = this.attackRange + 24;
    return new Phaser.Geom.Rectangle(
      this.facing === 1 ? this.x - 8 : this.x + 8 - reach,
      this.y - 26,
      reach,
      52,
    );
  }

  private drawMarker(time: number) {
    if (!this.marker) return;
    const bob = Math.sin(time / 220) * 2;
    const cy = this.y - this.displayHeight * 0.5 - 12 + bob;
    this.marker.clear();
    this.marker.fillStyle(0x000000, 0.35);
    this.marker.fillTriangle(this.x - 6, cy - 1, this.x + 6, cy - 1, this.x, cy + 7);
    this.marker.fillStyle(0x35e0ff, 0.95);
    this.marker.fillTriangle(this.x - 5, cy, this.x + 5, cy, this.x, cy + 6);
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

  /** Concede i-frames por `ms` (usado p/ o freeze do boss não virar combo de dano). */
  grantInvulnerability(ms: number) {
    this.invulnUntil = Math.max(this.invulnUntil, this.scene.time.now + ms);
  }

  applySlowdown(ms: number) {
    const dur = this.autonomia ? Math.ceil(ms * 0.5) : ms;
    this.speedMultUntil = Math.max(this.speedMultUntil, this.scene.time.now + dur);
  }

  getDashCooldownRatio(now: number): number {
    if (now >= this.dashCooldownUntil) return 0;
    const effectiveDashCooldown = Math.max(200, DASH_COOLDOWN_MS - this.dashCooldownBonus);
    return (this.dashCooldownUntil - now) / effectiveDashCooldown;
  }

  getParryState(now: number): "active" | "cooldown" | "low_sanity" | undefined {
    if (now < this.parryActiveUntil) return "active";
    if (now < this.parryCooldownUntil) return "cooldown";
    if (this.getBurnoutMods().parryDisabled) return "low_sanity";
    return undefined;
  }

  /** Returns true if the hit was parried. */
  takeDamage(amount: number, sanityHit = 0, fromX?: number): boolean {
    const now = this.scene.time.now;
    if (this.isInvulnerable(now)) return false;

    // Parry "Reclamar": absorve o hit se a janela estiver ativa
    if (now < this.parryActiveUntil) {
      this.parryActiveUntil = 0;
      this.parryCooldownUntil = now + PARRY_COOLDOWN_MS;
      this.invulnUntil = now + 400; // pequena i-frame pós-parry
      this.sanity = Math.min(this.maxSanity, this.sanity + PARRY_SANITY_RESTORE);
      if (this.parryEnergyRestore > 0)
        this.energy = Math.min(this.maxEnergy, this.energy + this.parryEnergyRestore);
      if (this.parryVrDrop > 0) this.vr += this.parryVrDrop;
      Sfx.parrySuccess();
      this.setTint(0xffdd00);
      this.scene.time.delayedCall(180, () => this.clearTint());
      this.scene.cameras?.main?.shake(60, 0.01);
      this.onParrySuccess?.(fromX ?? this.x);
      return true;
    }

    const burnoutMods = this.getBurnoutMods();
    const reducedAmount = Math.round(
      amount * this.damageReductionMult * burnoutMods.damageTakenMult,
    );
    this.energy = Math.max(0, this.energy - reducedAmount);
    if (sanityHit) this.sanity = Math.max(this.sanityFloor, this.sanity - sanityHit);
    this.invulnUntil = now + HIT_INVULN_MS;
    Sfx.playerHit();
    CombatFx.flashSprite(this, 55);
    this.scene.time.delayedCall(55, () => this.setTint(0xff8888));
    this.scene.time.delayedCall(175, () => this.clearTint());
    this.onHit?.();
    // knockback — push away from hit source (or away from facing if no source given)
    const pushDir = fromX !== undefined ? (this.x < fromX ? -1 : 1) : -this.facing;
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocityY(-200);
    body.setVelocityX(pushDir * 280);

    // Camera shake on hit — stronger when low on energy
    const cam = this.scene.cameras?.main;
    if (cam) {
      const intensity = this.energy < 25 ? 0.008 : 0.005;
      cam.shake(80, intensity);
    }

    if (this.energy <= 0) {
      if (cam) cam.shake(300, 0.015);
      this.onDeath?.("energy");
    } else if (this.sanity <= 0) {
      if (cam) cam.shake(300, 0.015);
      this.onDeath?.("burnout");
    }
    return false;
  }

  drainSanity(amount: number) {
    this.sanity = Math.max(this.sanityFloor, this.sanity - amount);
    if (this.sanity <= 0) this.onDeath?.("burnout");
  }

  addVR(n: number) {
    this.vr += n;
  }

  /** Passive sanity drain to simulate the long shift. */
  tickPassive(time: number) {
    // Colapso drena Sanidade 60% mais rápido (a espiral acelera sozinha).
    const interval = sanityBand(this.sanity) === "burnout" ? 2500 : 4000;
    if (time - this.lastSanityDrainAt > interval) {
      this.lastSanityDrainAt = time;
      this.drainSanity(1);
    }
  }

  /** Sintomas do Burnout — mods derivados da faixa de Sanidade. */
  getBurnoutMods(): {
    speedMult: number;
    parryWindowDelta: number; // ms adicionados (negativo = penalidade)
    parryDisabled: boolean;
    specialCooldownMult: number;
    damageTakenMult: number;
    vrDropMult: number;
  } {
    const band = sanityBand(this.sanity);
    switch (band) {
      case "stressed":
        return {
          speedMult: 0.9,
          parryWindowDelta: -40,
          parryDisabled: false,
          specialCooldownMult: 1.0,
          damageTakenMult: 1.0,
          vrDropMult: 1.0,
        };
      case "anxious":
        return {
          speedMult: 0.9,
          parryWindowDelta: -40,
          parryDisabled: false,
          specialCooldownMult: 1.3,
          damageTakenMult: 1.0,
          vrDropMult: 0.8,
        };
      case "burnout":
        return {
          speedMult: 0.85,
          parryWindowDelta: -40,
          parryDisabled: true,
          specialCooldownMult: 1.3,
          damageTakenMult: 1.3,
          vrDropMult: 0.8,
        };
      default:
        return {
          speedMult: 1.0,
          parryWindowDelta: 0,
          parryDisabled: false,
          specialCooldownMult: 1.0,
          damageTakenMult: 1.0,
          vrDropMult: 1.0,
        };
    }
  }

  /** Retorna true se os controles L/R devem inverter agora (tremor de ansiedade). */
  isTremoring(time: number): boolean {
    return time < this._tremorUntil;
  }

  /**
   * Retorna quantos ms restam até o próximo tremor SE já estivermos na janela
   * de aviso (últimos 500ms antes do surto). Só na faixa "burnout". 0 caso
   * contrário — permite ao HUD mostrar contagem regressiva e ao player
   * planejar contra-jogo.
   */
  getTremorWarnMs(time: number): number {
    if (sanityBand(this.sanity) !== "burnout") return 0;
    if (this._nextTremorAt <= 0) return 0;
    const delta = this._nextTremorAt - time;
    if (delta <= 0 || delta > 500) return 0;
    return delta;
  }

  /**
   * Roda a cada frame para gerenciar os tremores (surtos que invertem
   * controles). Só age nas faixas "ansioso" e "burnout".
   */
  private tickBurnoutTremor(time: number) {
    const band = sanityBand(this.sanity);
    // Mudança de faixa: reagenda próximo tremor
    if (band !== this._lastBurnoutBand) {
      this._lastBurnoutBand = band;
      this._tremorUntil = 0;
      if (band === "anxious") this._nextTremorAt = time + 6000;
      else if (band === "burnout") this._nextTremorAt = time + 3000;
      else this._nextTremorAt = 0;
    }
    if (band !== "anxious" && band !== "burnout") return;
    // Telegrafo do tremor: 500ms antes, pulsa outline magenta (só na banda
    // burnout — a ansiosa mantém o susto como incômodo leve).
    if (band === "burnout" && this._nextTremorAt > 0 && time < this._nextTremorAt) {
      const warn = this._nextTremorAt - time;
      if (warn <= 500 && !this._frozenTintActive && time > this._tremorUntil) {
        const pulse = Math.sin(time / 60) > 0;
        this.setTint(pulse ? 0xff88cc : 0xff44aa);
      }
    }
    if (time < this._nextTremorAt) return;
    // Dispara tremor
    const dur = band === "burnout" ? 700 : 400;
    const interval = band === "burnout" ? 3000 : 6000;
    this._tremorUntil = time + dur;
    this._nextTremorAt = time + interval + dur;
    // Feedback visual
    this.setTint(0xff44aa);
    this.scene.time.delayedCall(dur, () => {
      if (!this._frozenTintActive && this.scene?.time && time >= this._tremorUntil - 10)
        this.clearTint();
    });
    this.showTremorLabel();
  }

  private showTremorLabel() {
    if (this.tremorLabel && this.tremorLabel.scene) this.tremorLabel.destroy();
    const label = this.scene.add
      .text(this.x, this.y - this.displayHeight * 0.55 - 18, "TREMOR!", {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#ff88cc",
        stroke: "#000000",
        strokeThickness: 3,
      })
      .setOrigin(0.5, 1)
      .setDepth(this.depth + 20);
    this.tremorLabel = label;
    this.scene.tweens.add({
      targets: label,
      y: label.y - 12,
      alpha: 0,
      duration: 700,
      ease: "Quad.easeOut",
      onComplete: () => label.destroy(),
    });
  }

  update(time: number, _delta: number) {
    const body = this.body as Phaser.Physics.Arcade.Body;
    const onGround = body.blocked.down || body.touching.down;
    if (onGround) {
      this.lastGroundedAt = time;
      this.jumpsUsed = 0;
    }
    // Land squash: fire on the frame we first touch the ground
    if (onGround && !this.prevOnGround) {
      CombatFx.landSquash(this);
    }
    this.prevOnGround = onGround;

    // Freeze: no input, only gravity
    if (time < this.frozenUntil) {
      body.setVelocityX(0);
      if (!this._frozenTintActive) {
        this.setTint(0xaaaaff);
        this._frozenTintActive = true;
      }
      this.prevJumpDown = false;
      this.prevAttackDown = false;
      this.prevDashDown = false;
      return;
    }
    if (this._frozenTintActive) {
      this.clearTint();
      this._frozenTintActive = false;
    }

    // Sintomas do burnout: aplica penalidade de velocidade e atualiza tremor
    this.tickBurnoutTremor(time);
    const burnout = this.getBurnoutMods();
    const slowFromWeapon = time < this.speedMultUntil ? this.speedMult : 1;
    const curSpeed = this.walkSpeed * slowFromWeapon * burnout.speedMult;

    // Gamepad input — prefer cached pad, fall back to pad1 if hot-plugged
    const pad = this.pad ?? this.scene.input.gamepad?.pad1 ?? null;
    const STICK_THRESHOLD = 0.3;
    const stickLeft = (pad?.axes[0]?.getValue() ?? 0) < -STICK_THRESHOLD;
    const stickRight = (pad?.axes[0]?.getValue() ?? 0) > STICK_THRESHOLD;

    let left = this.keys.left.isDown || this.holdA || stickLeft || (pad?.left ?? false);
    let right = this.keys.right.isDown || this.holdD || stickRight || (pad?.right ?? false);
    // Tremor de ansiedade: inverte L/R durante o surto
    if (this.isTremoring(time)) {
      const tmp = left;
      left = right;
      right = tmp;
    }
    const jumpDown = this.keys.jump.isDown || this.keys.jumpAlt.isDown || (pad?.A ?? false);
    const attackDown = this.keys.attack.isDown || (pad?.X ?? false);
    const dashDown = this.keys.dash.isDown || !!pad?.R1;
    const specialDown = this.keys.special.isDown || (pad?.Y ?? false);
    const parryDown = this.keys.parry.isDown || !!pad?.L1;
    // Gatilhos analógicos do pad p/ as duas ações que faltavam no controle:
    // L2 = consumível (café), R2 = troca de arma (Q). Threshold 0.5 evita
    // disparo por curso morto do gatilho.
    const consumivelDown = this.keys.consumivel.isDown || (pad ? (pad.L2 ?? 0) > 0.5 : false);
    const secondaryDown = this.keys.secondary.isDown || (pad ? (pad.R2 ?? 0) > 0.5 : false);

    const jumpPressed = jumpDown && !this.prevJumpDown;
    const attackPressed = attackDown && !this.prevAttackDown;
    const dashPressed = dashDown && !this.prevDashDown;
    const specialPressed = specialDown && !this.prevSpecialDown;
    const parryPressed = parryDown && !this.prevParryDown;

    // Horizontal movement (locked during dash)
    if (time < this.dashUntil) {
      body.setVelocityX(this.facing * DASH_SPEED);
      body.setVelocityY(0); // freeze Y during dash so player doesn't fall
      // Ghost trail: one afterimage every 35ms
      if (time >= this.dashTrailTimer) {
        this.dashTrailTimer = time + 35;
        const ghost = this.scene.add
          .image(this.x, this.y, this.texture.key, this.frame.name)
          .setDepth(this.depth - 1)
          .setAlpha(0.45)
          .setFlipX(this.flipX)
          .setDisplaySize(this.displayWidth, this.displayHeight)
          .setTint(0x88ccff);
        this.scene.tweens.add({
          targets: ghost,
          alpha: 0,
          duration: 160,
          onComplete: () => ghost.destroy(),
        });
      }
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
      CombatFx.jumpStretch(this);
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
      Sfx.jump();
      // Burst the ring on use
      if (this.djRing) {
        this.djRing.destroy();
        this.djRing = null;
      }
    }

    // Double jump indicator ring: visible while in air with jump still available
    if (this.doubleJump && !onGround && this.jumpsUsed < 1) {
      if (!this.djRing) {
        this.djRing = this.scene.add
          .graphics()
          .setDepth(this.depth - 1)
          .setScrollFactor(1);
      }
      this.djRingPulse += 0.08;
      const pulse = Math.sin(this.djRingPulse) * 2;
      this.djRing.clear();
      this.djRing.lineStyle(1, 0x88ddff, 0.7);
      this.djRing.strokeCircle(this.x, this.y + this.displayHeight * 0.45, 10 + pulse);
    } else {
      if (this.djRing) {
        this.djRing.destroy();
        this.djRing = null;
      }
    }

    // Parry "Reclamar" — abre janela de absorção (F / LB)
    // Gratuito para ativar; se a janela expirar sem absorver, custa energia.
    // Em Colapso (Sanidade < 25) o parry fica DESABILITADO — sem fôlego pra reclamar.
    if (parryPressed && time >= this.parryCooldownUntil) {
      if (burnout.parryDisabled) {
        // Feedback claro: flash vermelho + sfx de whiff, sem abrir janela
        this.setTint(0x883333);
        this.scene.time.delayedCall(140, () => this.clearTint());
        Sfx.parryWhiff();
        this.parryCooldownUntil = time + 400;
      } else {
        const windowMs = Math.max(
          80,
          PARRY_WINDOW_MS + this.parryWindowBonus + burnout.parryWindowDelta,
        );
        this.parryActiveUntil = time + windowMs;
        this.setTint(0x00ffdd);
        const windowEnd = this.parryActiveUntil;
        this.scene.time.delayedCall(windowMs + 10, () => {
          if (!this.scene?.time) return;
          if (this.parryActiveUntil >= windowEnd) {
            this.energy = Math.max(0, this.energy - PARRY_WHIFF_ENERGY_COST);
            this.clearTint();
            Sfx.parryWhiff();
          }
        });
      }
    }

    // Dash
    if (dashPressed && time >= this.dashCooldownUntil) {
      const effectiveDashCooldown = Math.max(200, DASH_COOLDOWN_MS - this.dashCooldownBonus);
      this.dashUntil = time + DASH_MS;
      this.dashCooldownUntil = time + effectiveDashCooldown;
      Sfx.dash();
      body.setVelocityY(0);
      this.setAlpha(0.6);
      this.scene.time.delayedCall(DASH_MS, () => this.setAlpha(1));
    }

    // Tick da janela ativa do golpe: re-aplica a hitbox (que segue o player)
    // a cada frame até expirar. A dedup por swingId (na cena) evita hit duplo.
    if (this._swingActive) {
      if (time >= this._swingEndAt) {
        this._swingActive = false;
      } else {
        this.onAttack?.(this.buildMeleeHitbox(), this._swingStep, this._swingId, false);
      }
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
        // Abre a janela ativa do golpe e dispara o 1º frame já.
        this._swingId++;
        this._swingStep = this.comboStep;
        this._swingActive = true;
        this._swingEndAt = time + MELEE_ACTIVE_MS;
        this.onAttack?.(this.buildMeleeHitbox(), this.comboStep, this._swingId, true);
        if (this.hitAutoRanged) this.onRangedAttack?.(this.x, this.y, this.facing);
      }
    }

    // Special attack (K)
    if (specialPressed && time >= this.specialCooldownUntil) {
      this.specialCooldownUntil =
        time +
        Math.round(this.specialCooldown * this.specialCooldownMult * burnout.specialCooldownMult);
      // Charge flash: tint white briefly before firing
      this.setTint(0xffffff);
      this.scene.time.delayedCall(120, () => {
        this.setTint(0xffffaa);
        this.scene.time.delayedCall(120, () => {
          this.clearTint();
          this.onSpecialAttack?.(this.specialType, this.x, this.y, this.facing);
          Sfx.special();
        });
      });
    }
    this.prevSpecialDown = specialDown;

    // Consumível (C) — use coffee/consumable
    const consumivelPressed = consumivelDown && !this.prevConsumivelDown;
    if (consumivelPressed && this.consumivel && this.consumivelUses > 0) {
      this.consumivelUses--;
      const restore = this.consumivel === "cafe" ? 25 : 20;
      this.energy = Math.min(this.maxEnergy, this.energy + restore);
      if (this.consumivelSanityBonus > 0) {
        this.sanity = Math.min(this.maxSanity, this.sanity + this.consumivelSanityBonus);
      }
      this.setTint(0xffee88);
      this.scene.time.delayedCall(200, () => this.clearTint());
      this.onConsumivelUsed?.();
      if (this.consumivelUses <= 0) this.consumivel = null;
    }
    this.prevConsumivelDown = consumivelDown;

    // Secondary weapon (Q) — swap active weapon
    const secondaryPressed = secondaryDown && !this.prevSecondaryDown;
    if (secondaryPressed && this.secondaryWeaponId) {
      const tmp = this.secondaryWeaponId;
      this.secondaryWeaponId = this.weaponId;
      this.weaponId = tmp;
      this.onSecondarySwap?.();
    }
    this.prevSecondaryDown = secondaryDown;

    this.prevJumpDown = jumpDown;
    this.prevAttackDown = attackDown;
    this.prevDashDown = dashDown;
    this.prevParryDown = parryDown;

    // Gamepad interact (B button) — edge detection for scenes to consume
    const padInteractDown = pad?.B ?? false;
    this.gamepadInteractJustPressed = padInteractDown && !this.prevPadInteractDown;
    this.prevPadInteractDown = padInteractDown;

    this.drawMarker(time);
    this.updateTexture(time);
  }

  private updateTexture(time: number) {
    const body = this.body as Phaser.Physics.Arcade.Body;
    const onGround = body.blocked.down || body.touching.down;
    const speed = Math.abs(body.velocity.x);
    const now = time;

    // Frames re-extraídos do spritesheet com grade correta (escala uniforme +
    // alinhados pelos pés), então agora podemos tocar os ciclos completos sem a
    // "troca de pose brusca". idle usa idle1..idle4 (idle0 é o busto/portrait).
    let key: string;
    if (now < this.parryActiveUntil) {
      key = "tex-player-attack0"; // pose de "mão estendida" durante parry
    } else if (now < this.invulnUntil && now >= this.dashUntil) {
      key = "tex-player-hurt0";
    } else if (now < this.dashUntil) {
      key = "tex-player-dash0";
    } else if (now - this.lastAttackAt < 300) {
      const f = Math.min(2, Math.floor((now - this.lastAttackAt) / 100));
      key = `tex-player-attack${f}`; // attack0 → 1 → 2
    } else if (!onGround) {
      if (body.velocity.y < -60) {
        key = `tex-player-jump${Math.floor(now / 80) % 6}`; // subindo (6 frames)
      } else {
        key = `tex-player-fall${Math.floor(now / 100) % 3}`; // caindo (3 frames)
      }
    } else if (speed > 300) {
      key = `tex-player-run${Math.floor(now / 90) % 8}`; // ciclo de corrida (8)
    } else if (speed > 60) {
      key = `tex-player-walk${Math.floor(now / 100) % 8}`; // ciclo de caminhada (8)
    } else {
      // idle SÓ usa idle1/idle2 (poses paradas de respiração). idle3/idle4 são
      // poses de passada (extração ruim, quase iguais ao walk) e faziam o parado
      // "correr no lugar". Cadência lenta (450ms) = respiração calma.
      key = `tex-player-idle${1 + (Math.floor(now / 450) % 2)}`; // idle1↔idle2
    }

    applyTexture(this, key);
  }
}
