import type { Player } from "../entities/Player";
import type { RunState } from "./PlayerState";
import type { WeaponId } from "./WeaponSystem";
import { WEAPONS } from "./WeaponSystem";

export type PerkId =
  | "autonomia"
  | "hora_extra"
  | "vale_transporte"
  | "seguro_de_vida"
  | "plr"
  | "cafe_forte"
  | "piso_de_vidro"
  | "sindrome_impostor"
  | "reuniao_cancelada"
  | "clt_flexivel"
  | "banco_de_horas"
  | "plano_de_saude";

export type PerkDef = {
  id: PerkId;
  name: string;
  description: string;
  flavor: string;
  shopCost: number;
  icon: string;
};

export const PERKS: Record<PerkId, PerkDef> = {
  autonomia: {
    id: "autonomia",
    name: "Autonomia",
    description: "Congelamentos e ralentamentos duram 50% menos.",
    flavor: "Você não precisa de permissão pra sair cedo.",
    shopCost: 16,
    icon: "⚡",
  },
  hora_extra: {
    id: "hora_extra",
    name: "Hora Extra",
    description: "+20% de dano em todos os ataques.",
    flavor: "Sem adicional. Como sempre.",
    shopCost: 19,
    icon: "💢",
  },
  vale_transporte: {
    id: "vale_transporte",
    name: "Vale Transporte",
    description: "+15% de velocidade de movimento.",
    flavor: "Só funciona de segunda a sexta, claro.",
    shopCost: 16,
    icon: "🚌",
  },
  seguro_de_vida: {
    id: "seguro_de_vida",
    name: "Seguro de Vida",
    description: "Revive uma vez por run com 30 de Energia.",
    flavor: "A franquia é a alma da sua autoestima.",
    shopCost: 29,
    icon: "❤️",
  },
  plr: {
    id: "plr",
    name: "PLR",
    description: "Inimigos dropam 25% mais VR.",
    flavor: "Meta batida. Pagamento: parcialmente.",
    shopCost: 19,
    icon: "💰",
  },
  cafe_forte: {
    id: "cafe_forte",
    name: "Café Forte",
    description: "Consumíveis de Energia e Sanidade curam 50% mais.",
    flavor: "A torneira da copa vive entupida mas esse daí funciona.",
    shopCost: 16,
    icon: "☕",
  },
  piso_de_vidro: {
    id: "piso_de_vidro",
    name: "Piso de Vidro",
    description: "Permite um segundo pulo no ar.",
    flavor: "Voar é mais fácil que pedir aumento.",
    shopCost: 24,
    icon: "🪟",
  },
  sindrome_impostor: {
    id: "sindrome_impostor",
    name: "Síndrome do Impostor",
    description: "Primeiro golpe de cada área causa +50% de dano.",
    flavor: "Na dúvida, chega primeiro. Pergunte depois.",
    shopCost: 16,
    icon: "👤",
  },
  reuniao_cancelada: {
    id: "reuniao_cancelada",
    name: "Reunião Cancelada",
    description: "Dash recarrega 40% mais rápido.",
    flavor: "A melhor reunião é a que não acontece.",
    shopCost: 19,
    icon: "📅",
  },
  clt_flexivel: {
    id: "clt_flexivel",
    name: "CLT Flexível",
    description: "Cooldown do especial 40% menor.",
    flavor: "Flexível pra empresa. Nunca pro funcionário.",
    shopCost: 16,
    icon: "🕐",
  },
  banco_de_horas: {
    id: "banco_de_horas",
    name: "Banco de Horas",
    description: "Cada inimigo morto restaura 1 de Energia.",
    flavor: "Acumulou tanto que até virou cura.",
    shopCost: 22,
    icon: "🏦",
  },
  plano_de_saude: {
    id: "plano_de_saude",
    name: "Plano de Saúde",
    description: "Sanidade nunca cai abaixo de 25.",
    flavor: "Carência de 90 dias. Mas pelo menos existe.",
    shopCost: 26,
    icon: "🏥",
  },
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
    case "reuniao_cancelada":
      player.dashCooldownBonus += 380; // 950 * 0.4 = 380ms less cooldown
      break;
    case "clt_flexivel":
      player.specialCooldownMult *= 0.6;
      break;
    case "banco_de_horas":
      player.healOnKill += 1;
      break;
    case "plano_de_saude":
      player.sanityFloor = Math.max(player.sanityFloor, 25);
      break;
  }
}

// ── Synergy system ────────────────────────────────────────────────────────────

export type SynergyId =
  | "valkyria"
  | "overtime_rush"
  | "workflow"
  | "deep_work"
  | "procrastination"
  | "impostor_strike"
  | "barista"
  | "golden_hour";

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
    apply: (player) => {
      player.airAttackBonus = 0.4;
    },
  },
  overtime_rush: {
    perks: ["hora_extra", "vale_transporte"],
    name: "Overtime Rush",
    desc: "Dano e velocidade ao mesmo tempo: +25% dano extra, +20% velocidade.",
    icon: "🚀",
    apply: (player) => {
      player.damageMult *= 1.25;
      player.walkSpeed *= 1.2;
    },
  },
  workflow: {
    perks: ["cafe_forte", "autonomia"],
    name: "Workflow Otimizado",
    desc: "Café + Autonomia = dash recarrega ao matar inimigos.",
    icon: "☕",
    apply: (player) => {
      player.dashResetOnKill = true;
    },
  },
  deep_work: {
    perks: ["vale_transporte", "autonomia"],
    name: "Deep Work",
    desc: "Velocidade + Autonomia = pulo duplo desbloqueado.",
    icon: "🧠",
    apply: (player) => {
      player.doubleJump = true;
    },
  },
  procrastination: {
    perks: ["sindrome_impostor", "hora_extra"],
    name: "Procrastinação Estratégica",
    desc: "First strike + Dano = 1º hit de cada sala causa stun de 1s.",
    icon: "⏳",
    apply: (player) => {
      player.firstStrikeStun = true;
    },
  },
  impostor_strike: {
    perks: ["sindrome_impostor", "vale_transporte"],
    name: "Impostorzinho Veloz",
    desc: "Velocidade + First strike = dash causa 15 de dano por contato.",
    icon: "👻",
    apply: (player) => {
      player.dashDamage = 15;
    },
  },
  barista: {
    perks: ["cafe_forte", "seguro_de_vida"],
    name: "Barista Corporativo",
    desc: "Café + Seguro = consumíveis restauram também +12 sanidade.",
    icon: "☕",
    apply: (player) => {
      player.consumivelSanityBonus = 12;
    },
  },
  golden_hour: {
    perks: ["plr", "hora_extra"],
    name: "Golden Hour",
    desc: "PLR + Dano = VR dobrado ao matar inimigo em 3 hits ou menos.",
    icon: "💰",
    apply: (_player, run) => {
      run.goldenHourActive = true;
    },
  },
};

export function checkAndApplySynergies(player: Player, run: RunState): SynergyId[] {
  const perks = run.perks ?? [];
  const activated: SynergyId[] = [];
  for (const [id, syn] of Object.entries(SYNERGIES) as [SynergyId, SynergyDef][]) {
    if (syn.perks.every((p) => perks.includes(p))) {
      syn.apply(player, run);
      activated.push(id);
    }
  }
  run.activeSynergies = activated;
  return activated;
}

// ── Sinergias ARMA×PERK ───────────────────────────────────────────────────────
// Eixo novo (além de perk×perk): a arma equipada interage com um perk. Dá ao
// veterano um motivo pra casar arma + perk específico, não só empilhar perks.
// Reusa APENAS campos já consumidos (specialCooldownMult, airAttackBonus,
// firstStrikeStun, vrDropMult) — sem wiring morto. Avaliadas no buildPlayer,
// junto das perk×perk (player recriado a cada cena → 1× sobre stats limpos).
export type WeaponSynergyId =
  | "cafeina_pura"
  | "queda_produtividade"
  | "choque_termico"
  | "planilha_infinita";

type WeaponSynergyDef = {
  weapon: WeaponId;
  perk: PerkId;
  name: string;
  desc: string;
  icon: string;
  apply: (player: Player, run: RunState) => void;
};

export const WEAPON_SYNERGIES: Record<WeaponSynergyId, WeaponSynergyDef> = {
  cafeina_pura: {
    weapon: "caneca",
    perk: "cafe_forte",
    name: "Cafeína Pura",
    desc: "Caneca + Café Forte = especial recarrega 30% mais rápido.",
    icon: "☕",
    apply: (player) => {
      player.specialCooldownMult *= 0.7;
    },
  },
  queda_produtividade: {
    weapon: "furador",
    perk: "piso_de_vidro",
    name: "Queda de Produtividade",
    desc: "Furador + Piso de Vidro = +50% dano em ataques no ar.",
    icon: "🪂",
    apply: (player) => {
      player.airAttackBonus += 0.5;
    },
  },
  choque_termico: {
    weapon: "extintor",
    perk: "sindrome_impostor",
    name: "Choque Térmico",
    desc: "Extintor + Síndrome do Impostor = 1º hit de cada sala congela (stun).",
    icon: "🧊",
    apply: (player) => {
      player.firstStrikeStun = true;
    },
  },
  planilha_infinita: {
    weapon: "impressora",
    perk: "plr",
    name: "Planilha Infinita",
    desc: "Impressora + PLR = +30% VR por inimigo derrotado.",
    icon: "🖨️",
    apply: (player) => {
      player.vrDropMult *= 1.3;
    },
  },
};

/** Aplica sinergias arma×perk e retorna os rótulos (ícone + nome) p/ o badge. */
/** Telegrafia de sinergia (recomendação de GD): se ESCOLHER `candidate` agora
 *  completaria uma sinergia ainda não ativa — perk×perk (o outro perk já está no
 *  build) ou arma×perk (a arma equipada casa) — devolve o rótulo p/ a UI destacar
 *  ("★ Valkyria CLT · c/ Hora Extra"). Puro/testável. null se não forma sinergia. */
export function synergyPreview(
  candidate: PerkId,
  owned: PerkId[],
  weapon: WeaponId,
): { name: string; icon: string; with: string } | null {
  if (owned.includes(candidate)) return null;
  for (const syn of Object.values(SYNERGIES)) {
    if (!syn.perks.includes(candidate)) continue;
    const other = syn.perks.find((p) => p !== candidate);
    if (other && owned.includes(other))
      return { name: syn.name, icon: syn.icon, with: PERKS[other].name };
  }
  for (const ws of Object.values(WEAPON_SYNERGIES)) {
    if (ws.perk === candidate && ws.weapon === weapon)
      return { name: ws.name, icon: ws.icon, with: WEAPONS[weapon].name };
  }
  return null;
}

export function checkAndApplyWeaponSynergies(player: Player, run: RunState): string[] {
  const weapon = player.weaponId as WeaponId | undefined;
  const perks = run.perks ?? [];
  const labels: string[] = [];
  if (!weapon) return labels;
  for (const syn of Object.values(WEAPON_SYNERGIES)) {
    if (syn.weapon === weapon && perks.includes(syn.perk)) {
      syn.apply(player, run);
      labels.push(`${syn.icon} ${syn.name}`);
    }
  }
  return labels;
}

export function reapplyAllPerks(player: Player, run: RunState) {
  // Reset multiplicative stats to base before stacking perks to prevent
  // exponential growth when called multiple times (e.g. Copa → next phase)
  player.damageMult = 1.0;
  player.walkSpeed = player.baseWalkSpeed ?? 200;
  player.vrDropMult = 1.0;
  player.autonomia = false;
  player.doubleJump = false;

  for (const id of run.perks ?? []) {
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
        /* run.extraLives already persisted */ break;
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
      case "reuniao_cancelada":
        player.dashCooldownBonus += 380;
        break;
      case "clt_flexivel":
        player.specialCooldownMult *= 0.6;
        break;
      case "banco_de_horas":
        player.healOnKill += 1;
        break;
      case "plano_de_saude":
        player.sanityFloor = Math.max(player.sanityFloor, 25);
        break;
    }
  }
}
