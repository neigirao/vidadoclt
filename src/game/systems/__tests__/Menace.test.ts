import { describe, it, expect } from "bun:test";
import { menaceEnrageThreshold } from "../Menace";

describe("Menace — limiar de enrage por ameaça", () => {
  it("dificuldade normal = base 0.35", () => {
    expect(menaceEnrageThreshold(0, false, 0)).toBeCloseTo(0.35);
  });
  it("cada loop soma 0.05 (até 3 loops)", () => {
    expect(menaceEnrageThreshold(1, false, 0)).toBeCloseTo(0.4);
    expect(menaceEnrageThreshold(3, false, 0)).toBeCloseTo(0.5);
    expect(menaceEnrageThreshold(10, false, 0)).toBeCloseTo(0.5); // capa em 3 loops
  });
  it("New Game+ soma 0.10", () => {
    expect(menaceEnrageThreshold(0, true, 0)).toBeCloseTo(0.45);
  });
  it("Heat soma 0.02 por nível (0–5)", () => {
    expect(menaceEnrageThreshold(0, false, 5)).toBeCloseTo(0.45);
    expect(menaceEnrageThreshold(0, false, 99)).toBeCloseTo(0.45); // capa em 5
  });
  it("soma tudo mas capa em 0.60", () => {
    // 0.35 + 0.15 (loop) + 0.10 (ng) + 0.10 (heat) = 0.70 → capado
    expect(menaceEnrageThreshold(3, true, 5)).toBeCloseTo(0.6);
  });
  it("valores negativos não abaixam a base", () => {
    expect(menaceEnrageThreshold(-5, false, -3)).toBeCloseTo(0.35);
  });
});
