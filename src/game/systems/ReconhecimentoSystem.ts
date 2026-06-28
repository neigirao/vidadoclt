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
  | "autonomia_base";

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
    _upgradesApplied?: boolean;
  },
  playerMods: {
    maxEnergy: number;
    maxSanity: number;
    vrDropMult: number;
    parryWindowBonus: number;
  }
) {
  const cafeLvl = getLevel(levels, "cafe");
  playerMods.maxEnergy += cafeLvl * 10;

  const sindLvl = getLevel(levels, "sindicalismo");
  playerMods.maxSanity += sindLvl * 10;

  const horaLvl = getLevel(levels, "hora_extra");
  playerMods.vrDropMult += horaLvl * 0.25;

  if (getLevel(levels, "plr") >= 1) run.vr += 5;
  if (getLevel(levels, "resiliencia") >= 1) run.extraLives = (run.extraLives ?? 0) + 1;
  if (getLevel(levels, "networking") >= 1) playerMods.parryWindowBonus += 80;
  if (getLevel(levels, "autonomia_base") >= 1) run.autonomia = true;
}
