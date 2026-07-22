// ─────────────────────────────────────────────────────────────────────────────
// MODELO DE BALANCEAMENTO (puro, sem Phaser) — o núcleo da Balance Simulator.
//
// POR QUE EXISTE: os gates atuais validam ESTRUTURA (fase jogável, frames,
// paleta) mas nunca o BALANCEAMENTO. Este módulo modela, a partir das MESMAS
// fontes canônicas que o jogo usa (WEAPONS/CLASSES/ENEMIES + a matemática de
// melee em MeleeMath), o DPS de cada classe/arma, o TTK (time-to-kill) de cada
// inimigo por fase, e a PRESSÃO de cada inimigo (dano recebido → tempo até o
// player cair). Isso torna o tuning uma decisão por DADO — do jeito que Dead
// Cells/Hades são afinados — e permite flagar outliers (inimigo esponja, classe
// dominante) num diff, antes de virar sensação ruim no playtest.
//
// É um MODELO DE PRIMEIRA ORDEM, não um substituto do playtest: assume acerto
// contínuo, ignora deslocamento/telegrafia/perks/parry e trata os i-frames como
// o gargalo do dano recebido (o que na prática são). Serve para pegar
// DESPROPORÇÕES GROSSAS e REGRESSÕES, não para cravar números finos.
//
// Fonte única: reusa meleeBaseDamage/meleeComboHits (MeleeMath) e as constantes
// abaixo espelham Player.ts / PlayerLoadout.ts (comentado onde vem cada uma).
// ─────────────────────────────────────────────────────────────────────────────
import { ELITE_AFFIXES } from "./EliteAffixes";
import { ENEMIES, type EnemyDef, type EnemyId } from "./EnemyCatalog";
import { meleeBaseDamage, meleeComboHits } from "./MeleeMath";
import { CLASSES, WEAPONS, type ClassId, type WeaponId, type WeaponDef } from "./WeaponSystem";

// Constantes espelhadas do runtime (mudou lá? mudar aqui — o gate de teste trava).
const ATTACK_INTERVAL_BASE = 220; // PlayerLoadout: round(220 / attackSpeedMult)
const HIT_INVULN_MS = 350; // Player.ts: i-frames após tomar dano — gargalo do dano recebido

// Mid-bosses do catálogo (HP alto por design; TTK maior é esperado, não esponja).
export const MIDBOSS_IDS: EnemyId[] = ["brenda_rh", "diretor_resultados"];

// Limiares de flag (documentados e tunáveis — a régua do "está desbalanceado?").
export const THRESHOLDS = {
  ttkSpongeTrash: 10, // s — trash levando mais que isso p/ morrer = esponja/slog
  ttkSpongeMidboss: 45, // s — mid-boss acima disso = luta arrastada
  ttkTrivial: 0.3, // s — inimigo que evapora antes de ameaçar = sem propósito
  dpsSpreadRatio: 1.5, // DPS(melhor classe)/DPS(pior) acima disso = classe dominante
  timeToDownDanger: 3.5, // s — player cai mais rápido que isso a esse inimigo = swingy
};

/** ms entre golpes da arma (round(220 / attackSpeedMult)), igual ao PlayerLoadout. */
export function attackIntervalMs(def: WeaponDef): number {
  return Math.round(ATTACK_INTERVAL_BASE / (def.attackSpeedMult ?? 1));
}

/** Quantos hits o combo tem PARA ESTA CLASSE (o Analista sobe 3→4; ver buildPlayer). */
export function comboHitsFor(classId: ClassId, def: WeaponDef): number {
  const base = meleeComboHits(def); // 2 ou 3
  if (classId === "analista" && base === 3) return 4; // trait: combo de 4
  return base;
}

/** DPS efetivo do player para (classe, arma), modelo de acerto contínuo. */
export function playerDps(classId: ClassId, weaponId: WeaponId): number {
  const cls = CLASSES[classId];
  const def = WEAPONS[weaponId];
  const interval = attackIntervalMs(def);
  const dmgMult = cls.damageMult;

  if (def.type === "ranged") {
    // Ranged primário: cada golpe dispara 1 projétil de rangedDamage.
    // (Piercing/bounce/homing ignorados — ganho situacional, não sustentado.)
    const perHit = def.rangedDamage * dmgMult;
    return perHit / (interval / 1000);
  }

  // Melee: soma o dano dos passos do combo e divide pelo tempo do ciclo.
  const hits = comboHitsFor(classId, def);
  let cycleDamage = 0;
  for (let step = 1; step <= hits; step++) cycleDamage += meleeBaseDamage(def, step);
  cycleDamage *= dmgMult;
  // Arma híbrida (grampeador_eletrico): dispara ranged a cada acerto melee.
  if (def.hitAutoRanged) cycleDamage += hits * def.rangedDamage * dmgMult;
  const cycleMs = hits * interval;
  return cycleDamage / (cycleMs / 1000);
}

/** Redução de dano da classe (Terceirizado tem BLINDAGEM −15%; ver buildPlayer). */
export function damageReductionMult(classId: ClassId): number {
  return classId === "terceirizado" ? 0.85 : 1.0;
}

/** Vida efetiva = Energia máx / redução (menos redução = "aguenta mais"). */
export function effectiveHp(classId: ClassId): number {
  const cls = CLASSES[classId];
  return cls.maxEnergy / damageReductionMult(classId);
}

/** Escala de HP por loop: Fase 1 +20%/loop, Fases 2–5 +15%/loop (BasePhaseScene). */
export function loopHpScale(phase: number, loop: number): number {
  if (loop <= 0) return 1;
  const perLoop = phase === 1 ? 0.2 : 0.15;
  return 1 + perLoop * loop;
}

/** HP do inimigo já escalado pelo loop. */
export function scaledHp(enemy: EnemyDef, loop: number): number {
  return enemy.hp * loopHpScale(enemy.phase, loop);
}

/**
 * Pressão do inimigo: maior golpe único / janela de i-frames (os i-frames são o
 * gargalo — o player só toma UM hit por 350ms, contato OU projétil). Retorna o
 * DPS recebido no pior caso (encostado / na linha de tiro).
 */
export function enemyIncomingDps(enemy: EnemyDef): number {
  const attackMax = (enemy.attacks ?? []).reduce((m, a) => Math.max(m, a.damage), 0);
  const biggestHit = Math.max(enemy.contactDamage, attackMax);
  if (biggestHit <= 0) return 0;
  return biggestHit / (HIT_INVULN_MS / 1000);
}

export type EnemyReport = {
  id: EnemyId;
  label: string;
  phase: number;
  archetype?: string;
  hp: number;
  ttkByClass: Record<ClassId, number>; // TTK (s) com a arma inicial de cada classe
  ttkAvg: number;
  incomingDps: number;
  timeToDownAvg: number; // s até o player médio cair (worst-case)
  isMidboss: boolean;
};

export type BalanceFlag = {
  severity: "warn" | "info";
  kind: string;
  msg: string;
};

export type BalanceReport = {
  loop: number;
  classes: { id: ClassId; startWeapon: WeaponId; dps: number; effHp: number }[];
  dpsSpread: number;
  weaponDpsAnalista: { id: WeaponId; dps: number; rarity: string }[];
  enemies: EnemyReport[];
  flags: BalanceFlag[];
};

const CLASS_IDS = Object.keys(CLASSES) as ClassId[];

/** Roda o modelo completo e retorna o relatório + flags de outlier. */
export function analyzeBalance(loop = 0): BalanceReport {
  // DPS/effHP por classe (com a arma inicial de cada uma — o default honesto).
  const classes = CLASS_IDS.map((id) => ({
    id,
    startWeapon: CLASSES[id].startWeapon,
    dps: playerDps(id, CLASSES[id].startWeapon),
    effHp: effectiveHp(id),
  }));
  const dpsValues = classes.map((c) => c.dps);
  const dpsSpread = Math.max(...dpsValues) / Math.min(...dpsValues);

  // DPS de TODAS as armas com o Analista (classe neutra) — checa progressão.
  const weaponDpsAnalista = (Object.keys(WEAPONS) as WeaponId[])
    .map((id) => ({ id, dps: playerDps("analista", id), rarity: WEAPONS[id].rarity }))
    .sort((a, b) => a.dps - b.dps);

  // TTK e pressão por inimigo.
  const enemies: EnemyReport[] = (Object.keys(ENEMIES) as EnemyId[]).map((id) => {
    const e = ENEMIES[id];
    const hp = scaledHp(e, loop);
    const ttkByClass = {} as Record<ClassId, number>;
    for (const cid of CLASS_IDS) ttkByClass[cid] = hp / playerDps(cid, CLASSES[cid].startWeapon);
    const ttkAvg = CLASS_IDS.reduce((s, c) => s + ttkByClass[c], 0) / CLASS_IDS.length;
    const incomingDps = enemyIncomingDps(e);
    const effHpAvg = CLASS_IDS.reduce((s, c) => s + effectiveHp(c), 0) / CLASS_IDS.length;
    const timeToDownAvg = incomingDps > 0 ? effHpAvg / incomingDps : Infinity;
    return {
      id,
      label: e.label,
      phase: e.phase,
      archetype: e.archetype,
      hp,
      ttkByClass,
      ttkAvg,
      incomingDps,
      timeToDownAvg,
      isMidboss: MIDBOSS_IDS.includes(id),
    };
  });

  // Flags.
  const flags: BalanceFlag[] = [];
  if (dpsSpread > THRESHOLDS.dpsSpreadRatio) {
    const best = classes.reduce((a, b) => (a.dps > b.dps ? a : b));
    const worst = classes.reduce((a, b) => (a.dps < b.dps ? a : b));
    flags.push({
      severity: "warn",
      kind: "class-dps-spread",
      msg: `DPS entre classes desbalanceado: ${best.id} ${best.dps.toFixed(0)} vs ${worst.id} ${worst.dps.toFixed(0)} (razão ${dpsSpread.toFixed(2)} > ${THRESHOLDS.dpsSpreadRatio})`,
    });
  }
  for (const er of enemies) {
    const sponge = er.isMidboss ? THRESHOLDS.ttkSpongeMidboss : THRESHOLDS.ttkSpongeTrash;
    if (er.ttkAvg > sponge) {
      flags.push({
        severity: "warn",
        kind: "enemy-sponge",
        msg: `${er.label} (F${er.phase}) é esponja: TTK médio ${er.ttkAvg.toFixed(1)}s > ${sponge}s`,
      });
    }
    if (!er.isMidboss && er.ttkAvg < THRESHOLDS.ttkTrivial) {
      flags.push({
        severity: "info",
        kind: "enemy-trivial",
        msg: `${er.label} (F${er.phase}) evapora: TTK médio ${er.ttkAvg.toFixed(2)}s < ${THRESHOLDS.ttkTrivial}s`,
      });
    }
    if (er.timeToDownAvg < THRESHOLDS.timeToDownDanger) {
      flags.push({
        severity: "info",
        kind: "enemy-lethal",
        msg: `${er.label} (F${er.phase}) é letal: derruba o player em ${er.timeToDownAvg.toFixed(1)}s (pressão ${er.incomingDps.toFixed(0)} DPS)`,
      });
    }
  }

  return { loop, classes, dpsSpread, weaponDpsAnalista, enemies, flags };
}

// ─────────────────────────────────────────────────────────────────────────────
// ELITES — impacto dos afixos no TTK/pressão sobre um inimigo de referência (a
// mediana de HP do trash, sem mid-boss). Mostra quanto mais o elite AGUENTA
// (TTK) e BATE (pressão) que a versão comum, + a recompensa (VR bônus). É de 1ª
// ordem como o resto: mede a desproporção, não substitui playtest.
// ─────────────────────────────────────────────────────────────────────────────
export type EliteReport = {
  refLabel: string;
  refHp: number;
  avgDps: number;
  affixes: {
    id: string;
    label: string;
    hpMult: number;
    dmgMult: number;
    ttk: number; // s p/ matar a versão elite
    ttkVsBase: number; // ×base
    threatMult: number; // pressão ×base (escala com dano)
    vrBonus: number;
    behavior: string; // explode/escudo/—
  }[];
};

export function analyzeElites(loop = 0): EliteReport {
  const trash = (Object.keys(ENEMIES) as EnemyId[])
    .map((id) => ENEMIES[id])
    .filter((e) => !MIDBOSS_IDS.includes(e.id));
  const hps = trash.map((e) => scaledHp(e, loop)).sort((a, b) => a - b);
  const refHp = hps[Math.floor(hps.length / 2)];
  const refEnemy = trash.reduce((a, b) =>
    Math.abs(scaledHp(a, loop) - refHp) < Math.abs(scaledHp(b, loop) - refHp) ? a : b,
  );
  const avgDps =
    CLASS_IDS.reduce((s, c) => s + playerDps(c, CLASSES[c].startWeapon), 0) / CLASS_IDS.length;
  const baseTtk = refHp / avgDps;

  const affixes = ELITE_AFFIXES.map((a) => {
    const ttk = (refHp * a.hpMult) / avgDps;
    const behavior = a.explodeDmg
      ? `explode ${a.explodeDmg}`
      : a.shieldHits
        ? `escudo ${a.shieldHits}`
        : "—";
    return {
      id: a.id,
      label: a.label,
      hpMult: a.hpMult,
      dmgMult: a.dmgMult,
      ttk,
      ttkVsBase: ttk / baseTtk,
      threatMult: a.dmgMult,
      vrBonus: a.vrBonus,
      behavior,
    };
  });

  return { refLabel: refEnemy.label, refHp, avgDps, affixes };
}
