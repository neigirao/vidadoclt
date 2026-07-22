import Phaser from "phaser";
import { Player } from "../entities/Player";
import { WEAPONS, WeaponId } from "./WeaponSystem";
import { meleeComboHits, meleeDamage, meleeKnockback, meleeVrDrop } from "./MeleeMath";
import { CombatFx } from "./CombatFx";
import { Sfx } from "./AudioSystem";
import { ParticleFactory } from "./ParticleFactory";
import { playEnemyDeath } from "./DeathAnim";

// ─────────────────────────────────────────────────────────────────────────────
// Núcleo ÚNICO do golpe corpo-a-corpo do player.
//
// Antes existiam 4 cópias divergentes de resolveAttack (OpenSpaceV2, Base,
// Ceo, Copa) — e a divergência já virou bug real: a janela ativa da hitbox
// (Player re-dispara onAttack por frame) ganhou dedup só na Fase 1, e as
// outras cenas processavam o golpe ~8x. Este módulo é a implementação
// canônica (a mais rica, da Fase 1): dedup por swingId, juice 1x por golpe,
// hit sparks, slow de arma, healOnKill/onKill, e hooks para o que é
// específico de cada fase (multiplicador de VR, segredo do extintor, etc).
// ─────────────────────────────────────────────────────────────────────────────

export interface MeleeEnemy extends Phaser.Physics.Arcade.Sprite {
  hit: (damage: number, knockback: number) => boolean;
  applySlowdown?: (ms: number) => void;
}

export interface MeleeGroupDef {
  group: Phaser.Physics.Arcade.Group;
  vrDrop: number;
}

export interface MeleeHost {
  scene: Phaser.Scene;
  player: Player;
  combatFx: CombatFx;
  /** Grupos vivos de inimigos (lidos a cada golpe — a lista pode mudar). */
  getGroups: () => MeleeGroupDef[];
  getBoss: () =>
    | (Phaser.Physics.Arcade.Sprite & {
        hit: (d: number, k: number) => boolean;
        active: boolean;
      })
    | undefined;
  dropVR: (x: number, y: number, count: number) => void;
  /** Boss morreu por melee. */
  onBossDied: () => void;
  /** Multiplicador de VR por kill (Fase 1: produtividade × evento). Default 1. */
  killVrMult?: (x: number, y: number) => number;
  /** 1º frame de cada golpe (Fase 1: segredo do extintor). */
  onSwingStart?: (hb: Phaser.Geom.Rectangle) => void;
  /** Kill de inimigo por melee (Fase 5 usa p/ contagem de gauntlet etc). */
  onEnemyKilled?: (e: MeleeEnemy) => void;
}

// Estado por host (ids de golpe avulso + juice por golpe), sem poluir a cena.
const _hostState = new WeakMap<MeleeHost, { oneShot: number; juiceDone: number }>();

export function resolveMeleeAttack(
  host: MeleeHost,
  hb: Phaser.Geom.Rectangle,
  step: number,
  swingId?: number,
  firstFrame = true,
): void {
  const st = _hostState.get(host) ?? { oneShot: 0, juiceDone: 0 };
  _hostState.set(host, st);
  // Um golpe = um swingId; frames seguintes da janela ativa reusam o id.
  // Golpes avulsos (especial K) chegam sem id → recebem um único descartável.
  const sid = swingId ?? (st.oneShot -= 1);

  const { scene, player, combatFx } = host;
  const def = WEAPONS[player.weaponId as WeaponId] ?? WEAPONS.grampeador;
  const comboHits = meleeComboHits(def);
  let strikeMult = 1.0;
  if (firstFrame && player.firstStrikeReady) {
    player.firstStrikeReady = false;
    strikeMult = 1.5;
    scene.cameras.main.flash(180, 255, 215, 0, false);
  }
  // VAI NA RAÇA: no Burnout o dano causado sobe (glass-cannon opt-in).
  const burnoutDealtMult = player.getBurnoutMods().damageDealtMult;
  const damage = meleeDamage(def, step, player.damageMult, strikeMult, burnoutDealtMult);
  const knockback = meleeKnockback(def, step, player.facing);
  const slowMs = def.hitSlow;
  const isFinisher = step >= comboHits;

  // Arco de slash + SFX + hook de segredo: só no 1º frame do golpe.
  if (firstFrame) {
    const slash = scene.add.graphics().setDepth(15);
    const cx = hb.x + hb.width / 2;
    const cy = hb.y + hb.height / 2;
    const r = Math.max(hb.width, hb.height) * 0.6;
    const a0 = player.facing > 0 ? -Math.PI * 0.6 : Math.PI * 0.4;
    const a1 = player.facing > 0 ? Math.PI * 0.6 : Math.PI * 1.6;
    slash.lineStyle(3, 0xffffff, 0.75);
    slash.beginPath();
    slash.arc(cx, cy, r, a0, a1, false);
    slash.strokePath();
    scene.tweens.add({
      targets: slash,
      alpha: 0,
      scaleX: 1.2,
      scaleY: 1.2,
      duration: 140,
      ease: "Quad.easeOut",
      onComplete: () => slash.destroy(),
    });
    if (isFinisher) {
      Sfx.meleeHeavy();
      Sfx.comboFinisher();
    } else Sfx.meleeLight();
    host.onSwingStart?.(hb);
  }

  let hitAnything = false;

  const tryHit = (s: Phaser.Physics.Arcade.Sprite) =>
    Phaser.Geom.Intersects.RectangleToRectangle(hb, s.getBounds());
  // Já acertado neste golpe? (dedup da janela ativa)
  const freshHit = (s: Phaser.GameObjects.GameObject) => {
    if (s.getData("hitSwing") === sid) return false;
    s.setData("hitSwing", sid);
    return true;
  };
  const sparks = (x: number, y: number) => spawnHitSparks(scene, x, y, isFinisher);

  for (const { group, vrDrop } of host.getGroups()) {
    group.getChildren().forEach((c) => {
      const e = c as MeleeEnemy;
      if (!e.active || typeof e.hit !== "function" || !tryHit(e) || !freshHit(e)) return;
      // Elite Sindicalizado: barreira absorve os N primeiros golpes (spark, sem dano).
      const shield = (e.getData?.("eliteShieldHits") as number) ?? 0;
      if (shield > 0) {
        e.setData("eliteShieldHits", shield - 1);
        hitAnything = true;
        Sfx.enemyHit();
        sparks(e.x, e.y - 10);
        CombatFx.flashSprite(e, 90);
        combatFx.spawnDamageNumber(e.x, e.y - 20, 0, "#33ddcc", false);
        return;
      }
      hitAnything = true;
      if (slowMs > 0 && e.applySlowdown) e.applySlowdown(slowMs);
      Sfx.enemyHit();
      sparks(e.x, e.y - 10);
      CombatFx.flashSprite(e, 55);
      if (isFinisher) ParticleFactory.hitHeavy(scene, e.x, e.y - 20);
      else ParticleFactory.hitLight(scene, e.x, e.y - 20);
      combatFx.spawnDamageNumber(
        e.x,
        e.y - 20,
        damage,
        isFinisher ? "#ff4444" : "#ffcc44",
        isFinisher,
      );
      if (e.hit(damage, knockback)) {
        Sfx.enemyDeath();
        ParticleFactory.enemyDeath(scene, e.x, e.y - 10);
        const mult = host.killVrMult?.(e.x, e.y) ?? 1;
        const burnout = player.getBurnoutMods();
        host.dropVR(e.x, e.y, meleeVrDrop(vrDrop, player.vrDropMult, mult, burnout.vrDropMult));
        // Elite: bônus de VR dropado por cima (o "funcionário premiado" vale mais).
        const eliteBonus = (e.getData?.("eliteVrBonus") as number) ?? 0;
        if (eliteBonus > 0) host.dropVR(e.x, e.y - 12, Math.round(eliteBonus * player.vrDropMult));
        if (player.healOnKill > 0)
          player.energy = Math.min(player.maxEnergy, player.energy + player.healOnKill);
        // VAI NA RAÇA: matar de dentro do Burnout devolve sanidade — a saída
        // por agressão. Transforma o espiral num fio de faca escalável.
        if (burnout.sanityHealOnKill > 0)
          player.sanity = Math.min(player.maxSanity, player.sanity + burnout.sanityHealOnKill);
        player.onKill?.();
        host.onEnemyKilled?.(e);
        // MORTE ANIMADA: toca death0→N (arte da folha-fonte) e some. Desativa o
        // corpo antes p/ o "cadáver" não colidir/ferir durante a queda. Fallback
        // ao squish quando o inimigo não tem frames de death (ver DeathAnim).
        e.setActive(false);
        const eb = e.body as Phaser.Physics.Arcade.Body | null;
        if (eb) eb.enable = false;
        playEnemyDeath(scene, e);
      }
    });
  }

  const boss = host.getBoss();
  if (boss && boss.active && tryHit(boss) && freshHit(boss)) {
    hitAnything = true;
    Sfx.bossHit();
    sparks(boss.x, boss.y - 10);
    CombatFx.flashSprite(boss, 55);
    if (isFinisher) {
      ParticleFactory.hitHeavy(scene, boss.x, boss.y - 20);
      combatFx.hitHeavy();
    } else {
      ParticleFactory.hitLight(scene, boss.x, boss.y - 20);
    }
    combatFx.spawnDamageNumber(
      boss.x,
      boss.y - 20,
      damage,
      isFinisher ? "#ff4444" : "#ffcc44",
      isFinisher,
    );
    const died = boss.hit(damage, knockback);
    if (died) {
      Sfx.bossDefeat();
      host.onBossDied();
      return;
    }
  }

  // Juice (hitStop/finisher/shake) 1x por golpe — mesmo acertando inimigos em
  // frames diferentes da janela ativa.
  if (hitAnything && st.juiceDone !== sid) {
    st.juiceDone = sid;
    const hitPauseMs = Math.min(120, 30 + damage * 3);
    combatFx.hitStop(hitPauseMs);
    if (isFinisher) combatFx.comboFinisher(player.x, hb.x + hb.width / 2);
    else combatFx.hitLight();
  }
}

export function spawnHitSparks(scene: Phaser.Scene, x: number, y: number, finisher: boolean): void {
  const count = finisher ? 10 : 5;
  const tints = finisher ? [0xff4444, 0xff8800] : [0xffcc44, 0xffffff];
  const emitter = scene.add
    .particles(x, y, "__WHITE", {
      lifespan: finisher ? 300 : 200,
      speed: { min: 60, max: finisher ? 200 : 130 },
      angle: { min: -160, max: -20 },
      scale: { start: finisher ? 1.1 : 0.7, end: 0 },
      alpha: { start: 1, end: 0 },
      tint: tints,
      gravityY: 600,
    })
    .setDepth(600);
  emitter.explode(count);
  scene.time.delayedCall(400, () => {
    if (emitter.scene) emitter.destroy();
  });
}
