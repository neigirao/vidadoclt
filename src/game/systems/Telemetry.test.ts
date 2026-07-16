import { describe, expect, it, beforeEach } from "bun:test";

import { Telemetry } from "./Telemetry";

// Telemetria é módulo puro (guarda window/localStorage) → testável em bun:test.
// Cobrimos a NOVA agregação de tuning: verbos por run, tempo/dano por fase e
// taxa de burnout. O buffer é compartilhado no módulo → clear() antes de cada.

describe("Telemetry — agregação de tuning", () => {
  beforeEach(() => Telemetry.clear());

  it("média de verbos por run terminada", () => {
    // Run 1: 4 dash, 1 especial, 2 parry → morre.
    Telemetry.runStart("analista", ["padrao_clt"], "grampeador");
    Telemetry.phaseEnter("OpenSpaceV2Scene");
    Telemetry.verb("dash");
    Telemetry.verb("dash");
    Telemetry.verb("dash");
    Telemetry.verb("dash");
    Telemetry.verb("special");
    Telemetry.verb("parry");
    Telemetry.verb("parry");
    Telemetry.death("energy", 10);

    // Run 2: 0 dash, 1 especial, 0 parry → vitória.
    Telemetry.runStart("estagiario", ["padrao_clt"], "chaveiro");
    Telemetry.phaseEnter("OpenSpaceV2Scene");
    Telemetry.verb("special");
    Telemetry.victory(50, 1);

    const s = Telemetry.summary();
    expect(s.runs).toBe(2);
    expect(s.deaths).toBe(1);
    expect(s.victories).toBe(1);
    // dash: (4+0)/2 = 2.0 ; special: (1+1)/2 = 1.0 ; parry: (2+0)/2 = 1.0
    expect(s.avgVerbsPerRun).toEqual({ dash: 2, special: 1, parry: 1 });
  });

  it("acumula os verbos SÓ até o fim da run (reseta no runStart seguinte)", () => {
    Telemetry.runStart();
    Telemetry.verb("dash");
    Telemetry.verb("dash");
    Telemetry.death("energy", 0); // run 1: 2 dash

    Telemetry.runStart(); // reseta acumuladores
    Telemetry.death("burnout", 0); // run 2: 0 dash

    const s = Telemetry.summary();
    expect(s.avgVerbsPerRun.dash).toBe(1); // (2+0)/2
  });

  it("tempo e dano médios por fase vêm do boss_defeat", () => {
    Telemetry.runStart();
    Telemetry.phaseEnter("OpenSpaceV2Scene");
    Telemetry.damageTaken(30);
    Telemetry.damageTaken(20);
    Telemetry.bossDefeat("OpenSpaceV2Scene"); // 50 de dano na fase

    const s = Telemetry.summary();
    expect(s.avgPhaseDmgByScene["OpenSpaceV2Scene"]).toBe(50);
    expect(s.avgClearMsByScene["OpenSpaceV2Scene"]).toBeGreaterThanOrEqual(0);
  });

  it("dano reseta a cada phase_enter (é POR fase, não acumulado da run)", () => {
    Telemetry.runStart();
    Telemetry.phaseEnter("OpenSpaceV2Scene");
    Telemetry.damageTaken(40);
    Telemetry.bossDefeat("OpenSpaceV2Scene");
    Telemetry.phaseEnter("Phase2Scene"); // reseta o dano da fase
    Telemetry.damageTaken(10);
    Telemetry.bossDefeat("Phase2Scene");

    const s = Telemetry.summary();
    expect(s.avgPhaseDmgByScene["OpenSpaceV2Scene"]).toBe(40);
    expect(s.avgPhaseDmgByScene["Phase2Scene"]).toBe(10);
  });

  it("conta runs que entraram em Burnout", () => {
    Telemetry.runStart();
    Telemetry.burnoutEnter();
    Telemetry.burnoutEnter(); // 2 entradas, mas conta como 1 RUN com burnout
    Telemetry.death("burnout", 0);

    Telemetry.runStart();
    Telemetry.victory(0, 1); // sem burnout

    const s = Telemetry.summary();
    expect(s.burnoutRuns).toBe(1);
  });
});
