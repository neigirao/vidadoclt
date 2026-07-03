import { describe, it, expect } from "bun:test";
import { ENEMIES, EnemyId } from "../EnemyCatalog";

// Rede de regressão do balanceamento — trava os invariantes descobertos nos
// playtests instrumentados desta base. Se um merge reverter os números, estes
// testes acusam antes de alguém precisar jogar.

const all = Object.values(ENEMIES);
const byPhase = (p: 1 | 2 | 3 | 4 | 5) => all.filter((e) => e.phase === p);

describe("EnemyCatalog — sanidade estrutural", () => {
  it("todo inimigo tem stats válidos", () => {
    for (const e of all) {
      expect(e.hp).toBeGreaterThan(0);
      expect(e.speed).toBeGreaterThanOrEqual(0);
      expect(e.contactDamage).toBeGreaterThanOrEqual(0);
      expect(e.vrReward).toBeGreaterThanOrEqual(1);
      expect(e.spritePrefix ?? "").not.toBe("");
    }
  });

  it("toda fase tem elenco mínimo (≥3 inimigos)", () => {
    for (const p of [1, 2, 3, 4, 5] as const) {
      expect(byPhase(p).length).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("EnemyCatalog — dano de contato por tier (fim da inversão, Fase 1)", () => {
  const c = (id: EnemyId) => ENEMIES[id].contactDamage;

  it("trash inicial bate MENOS que os elites guarda-boss", () => {
    // Regressão histórica: Estagiário batia 15 (o maior da fase) e o Sênior 5.
    expect(c("estagiario_desesperado")).toBeLessThan(c("coordenador_sinergia"));
    expect(c("estagiario_desesperado")).toBeLessThan(c("analista_senior_exausto"));
    expect(c("estagiario_sobrecarregado")).toBeLessThan(c("analista_senior_exausto"));
  });

  it("Sênior (tank elite) é o toque mais pesado da Fase 1", () => {
    const maxF1 = Math.max(...byPhase(1).map((e) => e.contactDamage));
    expect(c("analista_senior_exausto")).toBe(maxF1);
  });
});

describe("EnemyCatalog — outliers travados (playtest Fases 2-5)", () => {
  it("Arquivo Ambulante não volta a ser esponja com toque de 35", () => {
    const a = ENEMIES.arquivo_ambulante;
    expect(a.hp).toBeLessThanOrEqual(500);
    expect(a.contactDamage).toBeLessThanOrEqual(14);
  });

  it("nenhum inimigo comum bate mais forte que 22 de contato", () => {
    // CEO (boss final) bate 18; lixo acima disso quebra a leitura de ameaça.
    for (const e of all) expect(e.contactDamage).toBeLessThanOrEqual(22);
  });
});
