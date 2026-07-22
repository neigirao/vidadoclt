// ─────────────────────────────────────────────────────────────────────────────
// Núcleo PURO do sistema de Elites (sem Phaser) — afixos, roll e mutação de stats.
// Separado de EliteSystem.ts (a parte visual, com Phaser) p/ ser testável isolado,
// como MeleeMath/sanity. O EliteSystem importa daqui.
// ─────────────────────────────────────────────────────────────────────────────

export type EliteAffix = {
  id: string;
  label: string; // nome corporativo (aparece no badge/threat)
  color: number; // cor da aura
  badge: string; // emoji
  hpMult: number;
  dmgMult: number;
  speedMult: number;
  scaleMult: number;
  vrBonus: number; // VR extra dropado na morte
  // Comportamentais (opcionais):
  explodeDmg?: number; // AoE de dano no player ao morrer (0/undefined = não explode)
  shieldHits?: number; // absorve os N primeiros golpes (barreira sindical) antes de tomar dano
};

export const ELITE_AFFIXES: EliteAffix[] = [
  {
    id: "efetivado",
    label: "Efetivado",
    color: 0x4488ff,
    badge: "🛡️",
    hpMult: 2.2,
    dmgMult: 1.2,
    speedMult: 1.0,
    scaleMult: 1.18,
    vrBonus: 8,
  }, // BLINDADO — estável no emprego, aguenta pancada
  {
    id: "cafeinado",
    label: "Cafeinado",
    color: 0xff5533,
    badge: "⚡",
    hpMult: 1.35,
    dmgMult: 1.4,
    speedMult: 1.5,
    scaleMult: 1.0,
    vrBonus: 6,
  }, // FRENÉTICO — 5 cafés no sangue, rápido e agressivo
  {
    id: "bonificado",
    label: "Bonificado",
    color: 0xffcc33,
    badge: "💰",
    hpMult: 1.5,
    dmgMult: 1.1,
    speedMult: 1.1,
    scaleMult: 1.06,
    vrBonus: 18,
  }, // RICO — bateu a meta, dá muito mais VR
  {
    id: "homologado",
    label: "Homologado",
    color: 0xff8822,
    badge: "🧨",
    hpMult: 1.3,
    dmgMult: 1.1,
    speedMult: 1.05,
    scaleMult: 1.04,
    vrBonus: 10,
    explodeDmg: 16,
  }, // EXPLODE ao morrer — a rescisão sai cara; mate e AFASTE-SE
  {
    id: "sindicalizado",
    label: "Sindicalizado",
    color: 0x33ddcc,
    badge: "🛡️",
    hpMult: 1.4,
    dmgMult: 1.15,
    speedMult: 1.0,
    scaleMult: 1.08,
    vrBonus: 10,
    shieldHits: 2,
  }, // ESCUDO — o sindicato blinda os 2 primeiros golpes
];

/** Chance de um inimigo virar elite, escalando com loop e Heat (teto 25%). */
export function eliteChance(loop: number, heat: number): number {
  return Math.min(0.25, 0.09 + loop * 0.02 + heat * 0.03);
}

/** Sorteia um afixo (ou null) para um inimigo. `frac` ∈ [0,1) da RNG da cena. */
export function rollElite(frac: number, pick: number, chance: number): EliteAffix | null {
  if (frac >= chance) return null;
  return ELITE_AFFIXES[pick % ELITE_AFFIXES.length];
}

/** Campos que um inimigo elite tem (subset dos sprites de inimigo). */
export type EliteTarget = {
  hp: number;
  maxHp?: number;
  contactDamage?: number;
  speed?: number;
};

/** Aplica os stats do afixo no inimigo (mutação pura, sem Phaser). */
export function applyEliteStats(e: EliteTarget, affix: EliteAffix): void {
  e.hp = Math.round(e.hp * affix.hpMult);
  if (typeof e.maxHp === "number") e.maxHp = Math.round(e.maxHp * affix.hpMult);
  if (typeof e.contactDamage === "number")
    e.contactDamage = Math.round(e.contactDamage * affix.dmgMult);
  if (typeof e.speed === "number") e.speed = Math.round(e.speed * affix.speedMult);
}
