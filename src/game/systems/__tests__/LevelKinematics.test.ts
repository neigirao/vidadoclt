import { describe, it, expect } from "bun:test";
import { gapX, canJump, type Box } from "../LevelKinematics";

describe("LevelKinematics — gapX", () => {
  it("0 quando os intervalos se sobrepõem em x", () => {
    expect(gapX(0, 100, 50, 150)).toBe(0);
    expect(gapX(0, 100, 100, 200)).toBe(0); // encostam
  });
  it("distância entre bordas quando separados", () => {
    expect(gapX(0, 100, 150, 200)).toBe(50); // B à direita
    expect(gapX(150, 200, 0, 100)).toBe(50); // B à esquerda
  });
});

describe("LevelKinematics — canJump", () => {
  // Parâmetros reais do jogo: JUMP_VEL=-520, GRAVITY=1200, walk=200, dash=90, margin=12.
  // apex = 520²/(2·1200) ≈ 112.7px.
  const JV = -520,
    G = 1200,
    W = 200,
    D = 90,
    M = 12;
  const NO_FURN: Box[] = [];
  const jump = (aL: number, aR: number, bL: number, bR: number, aY = 400, bY = 400, f = NO_FURN) =>
    canJump(aY, aL, aR, bY, bL, bR, JV, G, W, D, M, f);

  it("pulo curto no mesmo nível é alcançável", () => {
    expect(jump(0, 100, 150, 250)).toBe(true); // gap 50
  });
  it("vão horizontal grande demais é inalcançável", () => {
    expect(jump(0, 100, 900, 1000)).toBe(false); // gap 800 >> alcance
  });
  it("subida acima do apex é inalcançável", () => {
    expect(jump(0, 100, 120, 220, 400, 200)).toBe(false); // subir 200 > apex
  });
  it("subida dentro do apex com gap curto é alcançável", () => {
    expect(jump(0, 100, 120, 220, 400, 320)).toBe(true); // subir 80 < apex
  });
  it("móvel sólido no meio do arco bloqueia o pulo", () => {
    const furn: Box[] = [{ left: 110, right: 140, top: 300, bottom: 400 }];
    expect(jump(0, 100, 150, 250, 400, 400, furn)).toBe(false);
  });
  it("o mesmo pulo SEM o móvel é alcançável (controle)", () => {
    expect(jump(0, 100, 150, 250, 400, 400)).toBe(true);
  });
});
