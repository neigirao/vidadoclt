import { Player } from "../entities/Player";
import { RunState } from "./PlayerState";

export type PerkId =
  | "autonomia"
  | "hora_extra"
  | "vale_transporte"
  | "seguro_de_vida"
  | "plr"
  | "cafe_forte"
  | "piso_de_vidro"
  | "sindrome_impostor";

export type PerkDef = {
  id: PerkId;
  name: string;
  description: string;
  flavor: string;
  shopCost: number;
  icon: string;
};

export const PERKS: Record<PerkId, PerkDef> = {
  autonomia:          { id: "autonomia",          name: "Autonomia",             description: "Congelamentos e ralentamentos duram 50% menos.",       flavor: "Você não precisa de permissão pra sair cedo.",                   shopCost: 10, icon: "⚡" },
  hora_extra:         { id: "hora_extra",          name: "Hora Extra",            description: "+20% de dano em todos os ataques.",                    flavor: "Sem adicional. Como sempre.",                                    shopCost: 12, icon: "💢" },
  vale_transporte:    { id: "vale_transporte",     name: "Vale Transporte",       description: "+15% de velocidade de movimento.",                     flavor: "Só funciona de segunda a sexta, claro.",                         shopCost: 10, icon: "🚌" },
  seguro_de_vida:     { id: "seguro_de_vida",      name: "Seguro de Vida",        description: "Revive uma vez por run com 30 de Energia.",            flavor: "A franquia é a alma da sua autoestima.",                         shopCost: 18, icon: "❤️" },
  plr:                { id: "plr",                 name: "PLR",                   description: "Inimigos dropam 25% mais VR.",                         flavor: "Meta batida. Pagamento: parcialmente.",                          shopCost: 12, icon: "💰" },
  cafe_forte:         { id: "cafe_forte",          name: "Café Forte",            description: "Consumíveis de Energia e Sanidade curam 50% mais.",    flavor: "A torneira da copa vive entupida mas esse daí funciona.",        shopCost: 10, icon: "☕" },
  piso_de_vidro:      { id: "piso_de_vidro",       name: "Piso de Vidro",         description: "Permite um segundo pulo no ar.",                       flavor: "Voar é mais fácil que pedir aumento.",                           shopCost: 15, icon: "🪟" },
  sindrome_impostor:  { id: "sindrome_impostor",   name: "Síndrome do Impostor",  description: "Primeiro golpe de cada área causa +50% de dano.",      flavor: "Na dúvida, chega primeiro. Pergunte depois.",                    shopCost: 10, icon: "👤" },
};

export function applyPerk(id: PerkId, player: Player, run: RunState) {
  run.perks = [...(run.perks ?? [])];
  if (run.perks.includes(id)) return; // already have it
  run.perks.push(id);

  switch (id) {
    case "autonomia":
      player.autonomia = true;
      break;
    case "hora_extra":
      player.damageMult *= 1.2;
      break;
    case "vale_transporte":
      player.walkSpeed *= 1.15;
      break;
    case "seguro_de_vida":
      run.extraLives = (run.extraLives ?? 0) + 1;
      break;
    case "plr":
      player.vrDropMult *= 1.25;
      break;
    case "cafe_forte":
      run.cafeForte = true;
      break;
    case "piso_de_vidro":
      player.doubleJump = true;
      break;
    case "sindrome_impostor":
      player.firstStrikeReady = true;
      break;
  }
}

// ── Synergy system ────────────────────────────────────────────────────────────

export type SynergyId =
  | "valkyria" | "overtime_rush" | "workflow" | "deep_work"
  | "procrastination" | "impostor_strike" | "barista" | "golden_hour";

type SynergyDef = {
  perks: PerkId[];
  name: string;
  desc: string;
  icon: string;
  apply: (player: Player, run: RunState) => void;
};

export const SYNERGIES: Record<SynergyId, SynergyDef> = {
  valkyria: {
    perks: ["piso_de_vidro", "hora_extra"],
    name: "Valkyria CLT",
    desc: "Pulo duplo + Hora Extra = +40% dano em ataques no ar.",
    icon: "⚡",
    apply: (player) => { player.airAttackBonus = 0.4; },
  },
  overtime_rush: {
    perks: ["hora_extra", "vale_transporte"],
    name: "Overtime Rush",
    desc: "Dano e velocidade ao mesmo tempo: +25% dano extra, +20% velocidade.",
    icon: "🚀",
    apply: (player) => { player.damageMult *= 1.25; player.walkSpeed *= 1.2; },
  },
  workflow: {
    perks: ["cafe_forte", "autonomia"],
    name: "Workflow Otimizado",
    desc: "Café + Autonomia = dash recarrega ao matar inimigos.",
    icon: "☕",
    apply: (player) => { player.dashResetOnKill = true; },
  },
  deep_work: {
    perks: ["vale_transporte", "autonomia"],
    name: "Deep Work",
    desc: "Velocidade + Autonomia = pulo duplo desbloqueado.",
    icon: "🧠",
    apply: (player) => { player.doubleJump = true; },
  },
  procrastination: {
    perks: ["sindrome_impostor", "hora_extra"],
    name: "Procrastinação Estratégica",
    desc: "First strike + Dano = 1º hit de cada sala causa stun de 1s.",
    icon: "⏳",
    apply: (player) => { player.firstStrikeStun = true; },
  },
  impostor_strike: {
    perks: ["sindrome_impostor", "vale_transporte"],
    name: "Impostorzinho Veloz",
    desc: "Velocidade + First strike = dash causa 15 de dano por contato.",
    icon: "👻",
    apply: (player) => { player.dashDamage = 15; },
  },
  barista: {
    perks: ["cafe_forte", "seguro_de_vida"],
    name: "Barista Corporativo",
    desc: "Café + Seguro = consumíveis restauram também +12 sanidade.",
    icon: "☕",
    apply: (player) => { player.consumivelSanityBonus = 12; },
  },
  golden_hour: {
    perks: ["plr", "hora_extra"],
    name: "Golden Hour",
    desc: "PLR + Dano = VR dobrado ao matar inimigo em 3 hits ou menos.",
    icon: "💰",
    apply: (_player, run) => { run.goldenHourActive = true; },
  },
};

export function checkAndApplySynergies(player: Player, run: RunState): SynergyId[] {
  const perks = run.perks ?? [];
  const activated: SynergyId[] = [];
  for (const [id, syn] of Object.entries(SYNERGIES) as [SynergyId, SynergyDef][]) {
    if (syn.perks.every(p => perks.includes(p))) {
      syn.apply(player, run);
      activated.push(id);
    }
  }
  run.activeSynergies = activated;
  return activated;
}

export function reapplyAllPerks(player: Player, run: RunState) {
  // Reset multiplicative stats to base before stacking perks to prevent
  // exponential growth when called multiple times (e.g. Copa → next phase)
  player.damageMult  = 1.0;
  player.walkSpeed   = player.baseWalkSpeed ?? 200;
  player.vrDropMult  = 1.0;
  player.autonomia   = false;
  player.doubleJump  = false;

  for (const id of (run.perks ?? [])) {
    switch (id) {
      case "autonomia":       player.autonomia = true; break;
      case "hora_extra":      player.damageMult *= 1.2; break;
      case "vale_transporte": player.walkSpeed  *= 1.15; break;
      case "seguro_de_vida":  /* run.extraLives already persisted */ break;
      case "plr":             player.vrDropMult *= 1.25; break;
      case "cafe_forte":      run.cafeForte = true; break;
      case "piso_de_vidro":   player.doubleJump = true; break;
      case "sindrome_impostor": player.firstStrikeReady = true; break;
    }
  }
}
