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
    // Fake mínimo de sprite: registra o tween pedido, expõe setScale e o
    // data-store (o squash cacheia a escala ORIGINAL em `juice:base*` p/ não
    // acumular drift quando chamadas empilham — ver comentário em Juice.ts).
    let added: Record<string, unknown> | null = null;
    const data: Record<string, unknown> = {};
    const sprite = {
      scaleX: 2,
      scaleY: 2, // escala base != 1 (personagem já escalado)
      scene: { tweens: { add: (cfg: Record<string, unknown>) => (added = cfg) } },
      setScale: (_x: number, _y: number) => {},
      getData: (k: string) => data[k],
      setData: (k: string, v: unknown) => {
        data[k] = v;
      },
    } as unknown as Parameters<typeof squash>[0];
    squash(sprite, JUICE.squash.land);
    expect(added).not.toBeNull();
    const cfg = added as unknown as { scaleX: number; scaleY: number; yoyo: boolean };
    // base 2 × land.sx/sy — respeita a escala corrente.
    expect(cfg.scaleX).toBeCloseTo(2 * JUICE.squash.land.sx, 5);
    expect(cfg.scaleY).toBeCloseTo(2 * JUICE.squash.land.sy, 5);
    expect(cfg.yoyo).toBe(true);
  });

  test("squash() é VISUAL: a caixa do corpo e a linha do pé não mudam com a escala", () => {
    // REGRESSÃO de um bug que TRANCAVA a run. No Arcade o corpo escala junto com
    // o sprite: ao achatar, a caixa encolhia ancorada no TOPO e o pé subia ~4px,
    // tirando o personagem do chão. Isso realimentava (sai do chão → cai →
    // aterrissa → landSquash → sai de novo) e o corpo afundava no piso até vazar
    // pela faixa de 32px — o player atravessava o cenário e ia parar no limite
    // inferior do mundo, sem alcançar mais nenhum interativo (na Copa: sem bater
    // o ponto, run travada). Aqui simulamos o tween escrevendo uma escala
    // achatada e conferimos que a geometria do corpo, EM PX DE MUNDO, não mexeu.
    const FRAME = 80;
    const BASE_SX = 0.6;
    const BASE_SY = 0.8;
    let added: Record<string, unknown> | null = null;
    const data: Record<string, unknown> = {};
    // Fake de Arcade.Body: guarda size/offset em px de FONTE, como o Phaser.
    const body = {
      sourceWidth: 22,
      sourceHeight: 44,
      offset: { x: 29, y: 34 },
      setSize(w: number, h: number, _center: boolean) {
        this.sourceWidth = w;
        this.sourceHeight = h;
      },
      setOffset(x: number, y: number) {
        this.offset = { x, y };
      },
    };
    const sprite = {
      scaleX: BASE_SX,
      scaleY: BASE_SY,
      displayOriginX: FRAME / 2,
      displayOriginY: FRAME / 2,
      body,
      scene: { tweens: { add: (cfg: Record<string, unknown>) => (added = cfg) } },
      setScale: (_x: number, _y: number) => {},
      getData: (k: string) => data[k],
      setData: (k: string, v: unknown) => {
        data[k] = v;
      },
    } as unknown as Parameters<typeof squash>[0];

    // Geometria de mundo antes: altura efetiva e pé relativo ao y do sprite.
    const worldH = () => body.sourceHeight * (sprite as unknown as { scaleY: number }).scaleY;
    const worldW = () =>
      body.sourceWidth * Math.abs((sprite as unknown as { scaleX: number }).scaleX);
    const worldFoot = () => {
      const sy = (sprite as unknown as { scaleY: number }).scaleY;
      return sy * (body.offset.y - FRAME / 2 + body.sourceHeight);
    };
    const h0 = worldH();
    const w0 = worldW();
    const foot0 = worldFoot();

    squash(sprite, JUICE.squash.land);
    const cfg = added as unknown as { onUpdate: () => void };

    // O tween escreve a escala achatada; o onUpdate do squash recompensa o corpo.
    const s = sprite as unknown as { scaleX: number; scaleY: number };
    s.scaleX = BASE_SX * JUICE.squash.land.sx;
    s.scaleY = BASE_SY * JUICE.squash.land.sy;
    cfg.onUpdate();

    expect(worldH()).toBeCloseTo(h0, 4);
    expect(worldW()).toBeCloseTo(w0, 4);
    expect(worldFoot()).toBeCloseTo(foot0, 4); // o PÉ é o que tirava do chão
  });
});

describe("G1 — variação do arco por contexto (sem sprite novo)", () => {
  test("há uma forma por passo do combo, e elas DIFEREM", () => {
    const passos = JUICE.smearByStep;
    expect(passos.length).toBe(3);
    const tilts = passos.map((p) => p.tilt);
    expect(new Set(tilts).size).toBe(passos.length);
  });

  test("1º desce e 2º sobe — o sentido invertido é o que faz ler como combo", () => {
    expect(JUICE.smearByStep[0].tilt).toBeLessThan(0);
    expect(JUICE.smearByStep[1].tilt).toBeGreaterThan(0);
    // Diferença grande o bastante p/ LER: com ±22 quase não se notava.
    expect(Math.abs(JUICE.smearByStep[1].tilt - JUICE.smearByStep[0].tilt)).toBeGreaterThanOrEqual(
      60,
    );
  });

  test("o finalizador é o mais aberto e o mais duradouro dos três", () => {
    const [a, b, fim] = JUICE.smearByStep;
    expect(fim.arcDeg).toBeGreaterThan(Math.max(a.arcDeg, b.arcDeg));
    expect(fim.ms).toBeGreaterThan(Math.max(a.ms, b.ms));
    expect(fim.arcWidth).toBeGreaterThan(Math.max(a.arcWidth, b.arcWidth));
  });

  test("no ar o arco inclina forte para baixo (cutilada) e é mais seco", () => {
    expect(JUICE.smearAir.tilt).toBeGreaterThan(40);
    expect(JUICE.smearAir.ms).toBeLessThan(JUICE.smearByStep[0].ms);
  });

  test("todas as formas ficam em faixas sãs (arco não vira círculo)", () => {
    for (const s of [...JUICE.smearByStep, JUICE.smearAir, JUICE.smear]) {
      expect(s.arcDeg).toBeGreaterThan(30);
      expect(s.arcDeg).toBeLessThanOrEqual(90); // 110° lia como CÍRCULO, não golpe
      expect(s.ms).toBeGreaterThan(40);
      expect(s.ms).toBeLessThan(200); // smear é "poucos e RÁPIDOS"
      expect(Math.abs(s.tilt)).toBeLessThanOrEqual(60);
    }
  });
});
