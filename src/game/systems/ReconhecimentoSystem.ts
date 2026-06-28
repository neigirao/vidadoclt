/**
 * ReconhecimentoSystem — meta-progressão permanente entre runs.
 * Reconhecimento acumulado pode ser gasto para desbloquear upgrades
 * que persistem no localStorage e se aplicam a todas as runs seguintes.
 */

export type UpgradeId =
  | "cafe"
  | "sindicalismo"
  | "hora_extra"
  | "plr"
  | "resiliencia"
  | "networking"
  | "autonomia_base"
  | "carteira_assinada"
  | "banco_de_horas"
  | "insalubridade"
  | "vale_alimentacao"
  | "inss"
  | "participacao_lucros"
  | "beneficios_clt"
  | "processei_empresa";

export type UpgradeDef = {
  name: string;
  desc: string;
  maxLevel: number;
  costs: number[]; // costs[i] = custo para comprar o nível i+1
  icon: string;
  color: string;
};

export const UPGRADES: Record<UpgradeId, UpgradeDef> = {
  cafe: {
    name: "Café Reforçado",
    desc: "+10 Energia máxima por nível",
    maxLevel: 3,
    costs: [20, 50, 100],
    icon: "☕",
    color: "#c4813a",
  },
  sindicalismo: {
    name: "Sindicalismo",
    desc: "+10 Sanidade máxima por nível",
    maxLevel: 3,
    costs: [30, 70, 140],
    icon: "✊",
    color: "#4aafff",
  },
  hora_extra: {
    name: "Hora Extra Remunerada",
    desc: "+25% VR nos drops por nível",
    maxLevel: 2,
    costs: [50, 120],
    icon: "💰",
    color: "#f2c14e",
  },
  plr: {
    name: "PLR Garantido",
    desc: "Começa cada run com +5 VR",
    maxLevel: 1,
    costs: [60],
    icon: "📄",
    color: "#88ff88",
  },
  resiliencia: {
    name: "Resiliência CLT",
    desc: "+1 vida extra por run (máx. 1)",
    maxLevel: 1,
    costs: [80],
    icon: "💪",
    color: "#ff8888",
  },
  networking: {
    name: "Networking",
    desc: "Janela de Parry +80ms",
    maxLevel: 1,
    costs: [100],
    icon: "🤝",
    color: "#00ffdd",
  },
  autonomia_base: {
    name: "Autonomia Interna",
    desc: "Começa cada run com Autonomia ativa",
    maxLevel: 1,
    costs: [150],
    icon: "⭐",
    color: "#ffdd00",
  },
  carteira_assinada: {
    name: "Carteira Assinada",
    desc: "Parry bem-sucedido restaura 15 Energia",
    maxLevel: 1,
    costs: [90],
    icon: "📋",
    color: "#88ff88",
  },
  banco_de_horas: {
    name: "Banco de Horas",
    desc: "Cooldown do especial -15% por nível",
    maxLevel: 2,
    costs: [60, 130],
    icon: "⏱",
    color: "#ff88cc",
  },
  insalubridade: {
    name: "Insalubridade",
    desc: "Cooldown do dash -150ms por nível",
    maxLevel: 2,
    costs: [40, 90],
    icon: "⚗",
    color: "#aaffaa",
  },
  vale_alimentacao: {
    name: "Vale Alimentação",
    desc: "+3 VR no início de cada run por nível",
    maxLevel: 3,
    costs: [25, 55, 110],
    icon: "🍱",
    color: "#ffaa44",
  },
  inss: {
    name: "INSS Garantido",
    desc: "Combo de 4 hits (golpe extra no final)",
    maxLevel: 1,
    costs: [200],
    icon: "🏛",
    color: "#ff6666",
  },
  participacao_lucros: {
    name: "Participação nos Lucros",
    desc: "+50% VR em drops de inimigos",
    maxLevel: 1,
    costs: [110],
    icon: "📈",
    color: "#f2c14e",
  },
  beneficios_clt: {
    name: "Benefícios CLT",
    desc: "-10% dano recebido por nível",
    maxLevel: 3,
    costs: [45, 95, 180],
    icon: "🛡",
    color: "#88aaff",
  },
  processei_empresa: {
    name: "Processei a Empresa",
    desc: "Parry bem-sucedido dropa 2 VR",
    maxLevel: 1,
    costs: [75],
    icon: "⚖",
    color: "#ffdd44",
  },
};

const LS_KEY = "vidadoclt_upgrades";

export type UpgradeLevels = Partial<Record<UpgradeId, number>>;

export function loadUpgrades(): UpgradeLevels {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as UpgradeLevels) : {};
  } catch {
    return {};
  }
}

export function saveUpgrades(levels: UpgradeLevels) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(levels)); } catch {}
}

export function getLevel(levels: UpgradeLevels, id: UpgradeId): number {
  return levels[id] ?? 0;
}

export function nextCost(levels: UpgradeLevels, id: UpgradeId): number | null {
  const def = UPGRADES[id];
  const lvl = getLevel(levels, id);
  if (lvl >= def.maxLevel) return null;
  return def.costs[lvl];
}

/** Aplica os upgrades comprados ao RunState antes de iniciar a run. */
export function applyUpgradesToRun(
  levels: UpgradeLevels,
  run: {
    vr: number;
    extraLives?: number;
    autonomia: boolean;
  },
  playerMods: {
    maxEnergy: number;
    maxSanity: number;
    vrDropMult: number;
    parryWindowBonus: number;
    specialCooldownMult: number;   // multiplicador de cooldown (0.85^n)
    dashCooldownBonus: number;     // ms a subtrair do dash cooldown
    damageReductionMult: number;   // multiplicador de dano recebido (0.90^n)
    parryEnergyRestore: number;    // energia restaurada no parry bem-sucedido
    parryVrDrop: number;           // VR dropado no parry bem-sucedido
    comboHitsBonus: number;        // +1 hit no combo
  }
) {
  playerMods.maxEnergy       += getLevel(levels, "cafe") * 10;
  playerMods.maxSanity       += getLevel(levels, "sindicalismo") * 10;
  playerMods.vrDropMult      += getLevel(levels, "hora_extra") * 0.25;
  playerMods.vrDropMult      += getLevel(levels, "participacao_lucros") >= 1 ? 0.5 : 0;

  if (getLevel(levels, "plr") >= 1)            run.vr += 5;
  run.vr += getLevel(levels, "vale_alimentacao") * 3;
  if (getLevel(levels, "resiliencia") >= 1)    run.extraLives = (run.extraLives ?? 0) + 1;
  if (getLevel(levels, "networking") >= 1)     playerMods.parryWindowBonus += 80;
  if (getLevel(levels, "autonomia_base") >= 1) run.autonomia = true;
  if (getLevel(levels, "carteira_assinada") >= 1) playerMods.parryEnergyRestore = 15;
  if (getLevel(levels, "processei_empresa") >= 1) playerMods.parryVrDrop = 2;
  if (getLevel(levels, "inss") >= 1)           playerMods.comboHitsBonus = 1;

  const bancoLvl = getLevel(levels, "banco_de_horas");
  if (bancoLvl > 0) playerMods.specialCooldownMult = Math.pow(0.85, bancoLvl);

  const insalLvl = getLevel(levels, "insalubridade");
  playerMods.dashCooldownBonus += insalLvl * 150;

  const beneLvl = getLevel(levels, "beneficios_clt");
  if (beneLvl > 0) playerMods.damageReductionMult = Math.pow(0.90, beneLvl);
}
