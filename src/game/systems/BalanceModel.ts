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
  // Abaixo disto o especial é DECORAÇÃO: o jogador não sente diferença ao apertar
  // K, então não aprende o verbo e não perde nada por não aprender. 8% é ~1 golpe
  // a cada 12 — perceptível se acontecer, ignorável se não.
  specialMinShare: 0.08,
  ttkSpongeTrash: 10, // s — trash levando mais que isso p/ morrer = esponja/slog
  ttkSpongeMidboss: 45, // s — mid-boss acima disso = luta arrastada
  ttkTrivial: 0.3, // s — inimigo que evapora antes de ameaçar = sem propósito
  dpsSpreadRatio: 1.5, // DPS(melhor classe)/DPS(pior) acima disso = classe dominante
  timeToDownDanger: 3.5, // s — player cai mais rápido que isso a esse inimigo = swingy
  // Quanto uma arma pode superar o TETO da raridade acima antes de virar
  // problema. Alguma sobreposição é saudável (a arma tem utilidade além do
  // DPS); o que quebra a promessa é a rara ser MELHOR que a épica.
  rarityOverlapRatio: 1.1,
};

/** Ordem de raridade — a promessa de recompensa do roguelite. */
export const RARITY_ORDER = ["comum", "raro", "epico", "lendario"] as const;

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
/**
 * Dano do projétil que a arma híbrida solta a cada acerto melee. Espelha
 * `def.rangedDamage || def.hitDamages[0]` do BasePhaseScene — o modelo TEM que
 * seguir o jogo, senão vira fonte de decisão errada com cara de dado.
 */
export function autoRangedDamage(def: (typeof WEAPONS)[WeaponId]): number {
  return def.rangedDamage || def.hitDamages[0];
}

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
  // O DANO segue o mesmo fallback do jogo (BasePhaseScene.onRangedAttack):
  // `def.rangedDamage || def.hitDamages[0]`. Sem o fallback aqui, o modelo
  // multiplicava por ZERO — a lendária tem rangedDamage: 0 — e aparecia com
  // ~104 DPS, ABAIXO de armas raras. A "inversão da curva de raridade" que isso
  // sugeria era artefato do MODELO, não do jogo: o projétil real causa 18.
  if (def.hitAutoRanged) cycleDamage += hits * autoRangedDamage(def) * dmgMult;
  const cycleMs = hits * interval;
  return cycleDamage / (cycleMs / 1000);
}

// ── ESPECIAL (K) ─────────────────────────────────────────────────────────────
// POR QUE ENTROU NO MODELO: a telemetria dizia "especial = 0,0 por run" e a
// tentação era tratar isso como fato de comportamento. Era instrumento quebrado
// (a Fase 1 não contava), mas sobrou a pergunta que o dado não responde sozinho:
// **vale a pena apertar K?** Se o especial contribui 3% do dano, ninguém vai
// notar nem sentir falta; se contribui 25%, não usá-lo é perder metade do kit.
//
// O que torna isto modelável: o especial **não tem trava de ataque** (conferido
// em `Player.update` — o cooldown é a única restrição, e ele não interrompe o
// combo). Então usá-lo é dano de GRAÇA no cooldown, e a contribuição sustentada
// é `dano_do_especial / cooldown`. Não há tradeoff de recurso a modelar.
//
// LIMITE HONESTO, na mesma régua do resto deste arquivo: é 1ª ordem. Ignora
// deslocamento, stun/slow (o `emp_pulse` e o `clock_slow` valem MUITO mais que o
// dano deles — congelar a sala é utilidade, não DPS), geometria de leque e
// acerto parcial. Serve para responder "é irrelevante ou é significativo?", não
// para fechar um número.

/** Qual especial o (classe, arma) realmente dispara. A classe SOBREPÕE a arma —
 *  as 3 classes têm `classSpecial`, então o especial da arma quase nunca roda. */
export function specialTypeFor(classId: ClassId, weaponId: WeaponId): string {
  return CLASSES[classId].classSpecial ?? WEAPONS[weaponId].specialType;
}

/** ms de cooldown do especial para (classe, arma), como o PlayerLoadout monta. */
export function specialCooldownMs(classId: ClassId, weaponId: WeaponId): number {
  void classId; // upgSpecialCooldownMult é meta-progressão; o modelo usa a base
  return WEAPONS[weaponId].specialCooldown;
}

/**
 * Dano do especial por USO, em N alvos. Espelha `BasePhaseScene.handleSpecial`.
 * `golpes` = quantas instâncias de dano caem em UM alvo; `alcanca` = quantos
 * alvos a forma cobre. Especiais de puro controle têm dano 0 de propósito.
 */
export function specialDamagePerUse(
  classId: ClassId,
  weaponId: WeaponId,
  alvos = 1,
): { dano: number; nota?: string } {
  const def = WEAPONS[weaponId];
  const type = specialTypeFor(classId, weaponId);
  const mult = CLASSES[classId].damageMult;
  const step3 = meleeBaseDamage(def, 3); // especiais de AoE usam o passo 3 do combo
  const ranged = def.rangedDamage || def.hitDamages[0];
  const um = (d: number) => d * mult;
  switch (type) {
    // ── Especiais de CLASSE (os que realmente rodam no jogo) ──
    case "ranged_barrage": {
      // Leque de 5 projéteis PERFURANTES. Contra um alvo só, a abertura do leque
      // faz apenas os centrais acertarem — 2 é a leitura conservadora; com a
      // horda alinhada, os 5 atravessam.
      const perProj = Math.max(ranged, 12);
      const acertos = alvos <= 1 ? 2 : 5;
      return { dano: um(perProj * acertos), nota: `${acertos} projéteis perfurantes` };
    }
    case "planilha_slam":
      return { dano: um(step3 * alvos), nota: "AoE frontal 110×60" };
    case "melee_sweep":
      return { dano: um(step3 * alvos), nota: "redemoinho 360°" };
    // ── Especiais de ARMA (só rodariam sem classSpecial) ──
    case "burst_ranged":
      return { dano: um(ranged * 2), nota: "2 projéteis" };
    case "paper_spread":
      return { dano: um(ranged * (alvos <= 1 ? 1 : 3)), nota: "leque de 3" };
    case "throw_weapon":
      return { dano: um(def.hitDamages[1] * 2), nota: "arremesso" };
    case "caneca_arc":
      return { dano: um(def.hitDamages[2]), nota: "parábola" };
    case "chain_lightning":
      return { dano: um(def.hitDamages[2] * alvos), nota: "cadeia" };
    case "wide_sweep":
    case "aerial_spike":
    case "dash_strike":
    case "spray_knockback":
    case "wide_beam":
      return { dano: um(step3 * alvos), nota: "AoE" };
    case "emp_pulse":
      return { dano: 0, nota: "CONTROLE: congela 900ms (utilidade, não dano)" };
    case "clock_slow":
      return { dano: 0, nota: "CONTROLE: lentidão (utilidade, não dano)" };
    case "heal_pulse":
      return { dano: 0, nota: "SUPORTE: cura (utilidade, não dano)" };
    default:
      return { dano: 0, nota: "não modelado" };
  }
}

/** DPS sustentado que o especial adiciona, se apertado a cada cooldown. */
export function specialDps(classId: ClassId, weaponId: WeaponId, alvos = 1): number {
  const { dano } = specialDamagePerUse(classId, weaponId, alvos);
  const cd = specialCooldownMs(classId, weaponId);
  return cd > 0 ? dano / (cd / 1000) : 0;
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

/** O especial (K) de uma classe: quanto ele soma ao dano, e se vale o botão. */
export type SpecialReport = {
  classId: ClassId;
  weaponId: WeaponId;
  type: string;
  nome: string;
  cooldownMs: number;
  danoPorUso1: number; // num alvo só
  danoPorUso3: number; // em 3 alvos (horda)
  dps1: number;
  dps3: number;
  fracaoDoDps1: number; // dps1 / (dps básico + dps1) — quanto do dano total ele é
  fracaoDoDps3: number;
  nota?: string;
};

export type BalanceReport = {
  loop: number;
  classes: { id: ClassId; startWeapon: WeaponId; dps: number; effHp: number }[];
  specials: SpecialReport[];
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

  // ESPECIAL (K) por classe, com a arma inicial dela. Responde "vale o botão?".
  const specials: SpecialReport[] = CLASS_IDS.map((cid) => {
    const wid = CLASSES[cid].startWeapon;
    const basico = playerDps(cid, wid);
    const u1 = specialDamagePerUse(cid, wid, 1);
    const u3 = specialDamagePerUse(cid, wid, 3);
    const d1 = specialDps(cid, wid, 1);
    const d3 = specialDps(cid, wid, 3);
    return {
      classId: cid,
      weaponId: wid,
      type: specialTypeFor(cid, wid),
      nome: CLASSES[cid].classSpecialName ?? WEAPONS[wid].specialName,
      cooldownMs: specialCooldownMs(cid, wid),
      danoPorUso1: u1.dano,
      danoPorUso3: u3.dano,
      dps1: d1,
      dps3: d3,
      fracaoDoDps1: basico + d1 > 0 ? d1 / (basico + d1) : 0,
      fracaoDoDps3: basico + d3 > 0 ? d3 / (basico + d3) : 0,
      nota: u1.nota,
    };
  });

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
  // Curva de raridade: achar a lendária tem que ser o momento alto de uma run.
  // Se uma arma de raridade BAIXA bate acima do teto da raridade acima, a cor
  // deixa de significar e o jogador aprende a ignorá-la — perde-se um canal de
  // recompensa inteiro que já existe e só está mal calibrado.
  for (let i = 0; i < RARITY_ORDER.length - 1; i++) {
    const abaixo = weaponDpsAnalista.filter((w) => w.rarity === RARITY_ORDER[i]);
    const acima = weaponDpsAnalista.filter((w) => w.rarity === RARITY_ORDER[i + 1]);
    if (!abaixo.length || !acima.length) continue;
    const tetoAcima = Math.max(...acima.map((w) => w.dps));
    for (const w of abaixo) {
      if (w.dps > tetoAcima * THRESHOLDS.rarityOverlapRatio) {
        flags.push({
          severity: "warn",
          kind: "rarity-inversion",
          msg: `${w.id} (${w.rarity}) ${w.dps.toFixed(0)} DPS supera o teto de ${RARITY_ORDER[i + 1]} (${tetoAcima.toFixed(0)}) — a raridade deixa de significar`,
        });
      }
    }
  }

  // ESPECIAL DECORATIVO: se apertar K muda pouco o dano, o verbo não se paga.
  // Não vale para especiais de CONTROLE (freeze/slow/cura) — o valor deles não é
  // DPS e o modelo não os mede; flagá-los seria o modelo mentindo com confiança.
  for (const sp of specials) {
    if (sp.danoPorUso1 === 0) continue; // utilidade, fora da régua de dano
    if (sp.fracaoDoDps3 < THRESHOLDS.specialMinShare) {
      flags.push({
        severity: "warn",
        kind: "special-decorativo",
        msg: `especial de ${sp.classId} ("${sp.nome}") soma só ${(sp.fracaoDoDps3 * 100).toFixed(1)}% do dano mesmo em 3 alvos (< ${(THRESHOLDS.specialMinShare * 100).toFixed(0)}%) — apertar K quase não muda nada, então o verbo não se paga`,
      });
    }
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

  return { loop, classes, specials, dpsSpread, weaponDpsAnalista, enemies, flags };
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
