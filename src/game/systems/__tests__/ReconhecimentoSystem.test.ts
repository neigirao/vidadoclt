import { describe, it, expect } from "bun:test";
import {
  UPGRADES,
  UpgradeId,
  UpgradeLevels,
  getLevel,
  isLocked,
  nextCost,
  applyUpgradesToRun,
} from "../ReconhecimentoSystem";

const freshMods = () => ({
  maxEnergy: 0,
  maxSanity: 0,
  vrDropMult: 0,
  parryWindowBonus: 0,
  specialCooldownMult: 1.0,
  dashCooldownBonus: 0,
  damageReductionMult: 1.0,
  parryEnergyRestore: 0,
  parryVrDrop: 0,
  comboHitsBonus: 0,
});

describe("ReconhecimentoSystem — catálogo de upgrades", () => {
  it("todo upgrade tem custos crescentes cobrindo o maxLevel", () => {
    for (const def of Object.values(UPGRADES)) {
      expect(def.costs.length).toBe(def.maxLevel);
      for (let i = 0; i < def.costs.length; i++) {
        expect(def.costs[i]).toBeGreaterThan(0);
        if (i > 0) expect(def.costs[i]).toBeGreaterThan(def.costs[i - 1]);
      }
    }
  });

  it("exclusões mútuas são simétricas (A tranca B ⇒ B tranca A)", () => {
    for (const [id, def] of Object.entries(UPGRADES) as [
      UpgradeId,
      (typeof UPGRADES)[UpgradeId],
    ][]) {
      for (const other of def.excludes ?? []) {
        expect(UPGRADES[other].excludes ?? []).toContain(id);
      }
    }
  });
});

describe("ReconhecimentoSystem — progressão de compra", () => {
  it("nextCost avança pela tabela e retorna null no teto", () => {
    const levels: UpgradeLevels = {};
    expect(nextCost(levels, "cafe")).toBe(20);
    levels.cafe = 2;
    expect(nextCost(levels, "cafe")).toBe(100);
    levels.cafe = 3;
    expect(nextCost(levels, "cafe")).toBeNull();
  });

  it("isLocked trava quando o exclusivo foi comprado", () => {
    for (const [id, def] of Object.entries(UPGRADES) as [
      UpgradeId,
      (typeof UPGRADES)[UpgradeId],
    ][]) {
      if (!def.excludes?.length) continue;
      const levels: UpgradeLevels = { [id]: 1 };
      expect(isLocked(levels, def.excludes[0])).toBe(id);
      return; // um par basta — a simetria é testada acima
    }
  });
});

describe("ReconhecimentoSystem — aplicação na run", () => {
  it("níveis zerados não alteram nada", () => {
    const run = { vr: 0, autonomia: false };
    const mods = freshMods();
    applyUpgradesToRun({}, run, mods);
    expect(run.vr).toBe(0);
    expect(run.autonomia).toBe(false);
    expect(mods).toEqual(freshMods());
  });

  it("café/sindicalismo/hora_extra/plr somam como o anunciado", () => {
    const run = { vr: 0, autonomia: false };
    const mods = freshMods();
    applyUpgradesToRun({ cafe: 3, sindicalismo: 2, hora_extra: 2, plr: 1 }, run, mods);
    expect(mods.maxEnergy).toBe(30); // +10/nível
    expect(mods.maxSanity).toBe(20);
    expect(mods.vrDropMult).toBeCloseTo(0.5); // +25%/nível
    expect(run.vr).toBe(5); // PLR: começa com +5 VR
  });

  it("resiliência concede exatamente 1 vida extra", () => {
    const run = { vr: 0, autonomia: false, extraLives: 0 };
    applyUpgradesToRun({ resiliencia: 1 }, run, freshMods());
    expect(run.extraLives).toBe(1);
  });

  it("getLevel default é 0", () => {
    expect(getLevel({}, "cafe")).toBe(0);
  });
});
