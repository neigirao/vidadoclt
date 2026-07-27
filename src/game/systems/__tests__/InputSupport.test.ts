import { describe, expect, test } from "bun:test";
import { isTouchPrimary, type PointerCapabilities } from "../InputSupport";

const caps = (p: Partial<PointerCapabilities>): PointerCapabilities => ({
  coarsePointer: false,
  canHover: true,
  hasTouch: false,
  ...p,
});

describe("isTouchPrimary — quem precisa do aviso de teclado", () => {
  test("celular/tablet: toque, apontador grosso, sem hover → avisa", () => {
    expect(isTouchPrimary(caps({ hasTouch: true, coarsePointer: true, canHover: false }))).toBe(
      true,
    );
  });

  test("desktop com mouse → não avisa", () => {
    expect(isTouchPrimary(caps({ hasTouch: false, coarsePointer: false, canHover: true }))).toBe(
      false,
    );
  });

  test("notebook com tela de toque → NÃO avisa (tem teclado)", () => {
    // O caso que torna `hasTouch` sozinho um sinal ruim: há toque, mas também
    // apontador fino e hover — ou seja, mouse/trackpad e teclado presentes.
    expect(isTouchPrimary(caps({ hasTouch: true, coarsePointer: false, canHover: true }))).toBe(
      false,
    );
  });

  test("tablet com teclado acoplado (reporta hover) → não avisa", () => {
    expect(isTouchPrimary(caps({ hasTouch: true, coarsePointer: true, canHover: true }))).toBe(
      false,
    );
  });

  test("sem toque nenhum nunca avisa, mesmo sem hover", () => {
    // TV/quiosque sem toque: nada a avisar sobre teclado ausente por toque.
    expect(isTouchPrimary(caps({ hasTouch: false, coarsePointer: true, canHover: false }))).toBe(
      false,
    );
  });
});
