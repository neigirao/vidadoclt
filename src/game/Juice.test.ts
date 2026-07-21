import { describe, expect, test } from "bun:test";
import { JUICE, squash } from "./systems/Juice";

describe("JUICE — tabela de game feel", () => {
  test("land alarga e achata (impacto no chão)", () => {
    expect(JUICE.squash.land.sx).toBeGreaterThan(1); // alarga
    expect(JUICE.squash.land.sy).toBeLessThan(1); // achata
    expect(JUICE.squash.land.ms).toBeGreaterThan(0);
  });

  test("jump estica e afina (subida)", () => {
    expect(JUICE.squash.jump.sy).toBeGreaterThan(1); // estica
    expect(JUICE.squash.jump.sx).toBeLessThan(1); // afina
  });

  test("hit é um recuo curto (achata levemente, rápido)", () => {
    expect(JUICE.squash.hit.sy).toBeLessThan(1);
    expect(JUICE.squash.hit.ms).toBeLessThanOrEqual(JUICE.squash.land.ms + 20);
  });

  test("hitStop e shake em faixas sãs (não travam nem enjoam)", () => {
    expect(JUICE.hitStop.light).toBeGreaterThan(0);
    expect(JUICE.hitStop.light).toBeLessThan(200);
    expect(JUICE.hitStop.finisher).toBeGreaterThanOrEqual(JUICE.hitStop.light);
    for (const s of Object.values(JUICE.shake)) {
      expect(s.ms).toBeGreaterThan(0);
      expect(s.amp).toBeGreaterThan(0);
      expect(s.amp).toBeLessThan(0.05); // shake forte demais enjoa
    }
  });

  test("squash() multiplica a escala BASE e agenda retorno exato", () => {
    // Fake mínimo de sprite: registra o tween pedido e expõe setScale.
    let added: Record<string, unknown> | null = null;
    const sprite = {
      scaleX: 2,
      scaleY: 2, // escala base != 1 (personagem já escalado)
      scene: { tweens: { add: (cfg: Record<string, unknown>) => (added = cfg) } },
      setScale: (_x: number, _y: number) => {},
    } as unknown as Parameters<typeof squash>[0];
    squash(sprite, JUICE.squash.land);
    expect(added).not.toBeNull();
    const cfg = added as unknown as { scaleX: number; scaleY: number; yoyo: boolean };
    // base 2 × land.sx/sy — respeita a escala corrente.
    expect(cfg.scaleX).toBeCloseTo(2 * JUICE.squash.land.sx, 5);
    expect(cfg.scaleY).toBeCloseTo(2 * JUICE.squash.land.sy, 5);
    expect(cfg.yoyo).toBe(true);
  });
});
