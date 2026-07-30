import { describe, expect, test } from "bun:test";
import { Cheats, SequenceMatcher } from "../Cheats";

describe("SequenceMatcher (IDDQD)", () => {
  test("dispara ao completar o código", () => {
    const m = new SequenceMatcher();
    expect("IDDQ".split("").map((c) => m.push(c))).toEqual([null, null, null, null]);
    expect(m.push("D")).toBe("godMode");
  });

  test("é case-insensitive (ninguém digita cheat com Caps Lock)", () => {
    const m = new SequenceMatcher();
    for (const c of "iddq") m.push(c);
    expect(m.push("d")).toBe("godMode");
  });

  test("casa o SUFIXO: lixo antes do código não invalida", () => {
    // Este é o comportamento que separa "cheat que funciona" de "cheat que o
    // jogador jura estar quebrado". Com um índice de progresso em vez de janela,
    // errar uma tecla obrigaria a recomeçar do zero — e não há feedback nenhum
    // de que errou. O DOOM casava sufixo; as pessoas esperam isso.
    const m = new SequenceMatcher();
    for (const c of "IDKFAWASD") m.push(c);
    for (const c of "IDDQ") m.push(c);
    expect(m.push("D")).toBe("godMode");
  });

  test("teclas não-alfanuméricas são IGNORADAS, não quebram a sequência", () => {
    // Andar enquanto digita é normal — setas e Shift não podem zerar o progresso.
    const m = new SequenceMatcher();
    m.push("I");
    m.push("ArrowLeft");
    m.push("D");
    m.push("Shift");
    m.push("D");
    m.push(" ");
    m.push("Q");
    expect(m.push("D")).toBe("godMode");
  });

  test("não redispara na tecla seguinte", () => {
    const m = new SequenceMatcher();
    for (const c of "IDDQ") m.push(c);
    expect(m.push("D")).toBe("godMode");
    expect(m.push("D")).toBe(null);
  });

  test("a janela não cresce sem limite", () => {
    const m = new SequenceMatcher();
    for (const c of "ABCDEFGHIJKLMNOP") m.push(c);
    expect(m.janela.length).toBeLessThanOrEqual(5); // tamanho de "IDDQD"
  });
});

describe("Cheats — estado e contaminação", () => {
  test("alternar liga e desliga (toggle, como no DOOM)", () => {
    Cheats._reset();
    expect(Cheats.ativo("godMode")).toBe(false);
    expect(Cheats.alternar("godMode")).toBe(true);
    expect(Cheats.ativo("godMode")).toBe(true);
    expect(Cheats.alternar("godMode")).toBe(false);
    expect(Cheats.ativo("godMode")).toBe(false);
  });

  test("a sessão fica SUJA para sempre — desligar não limpa", () => {
    // O ponto todo do guard: uma run imortal já inflou tempo de sessão, fases
    // alcançadas e kills. Desligar o cheat depois não devolve a sessão à
    // condição de amostra honesta, e permitir isso seria uma porta aberta para
    // exatamente o tipo de dado envenenado que os PRs #133–#136 consertaram.
    Cheats._reset();
    expect(Cheats.sessaoSuja).toBe(false);
    Cheats.alternar("godMode");
    Cheats._marcarSuja();
    expect(Cheats.sessaoSuja).toBe(true);
    Cheats.alternar("godMode"); // desligou
    expect(Cheats.ativo("godMode")).toBe(false);
    expect(Cheats.sessaoSuja).toBe(true); // e continua suja
  });

  test("marcar suja levanta a flag que o Telemetry lê para cortar o envio", () => {
    // O acoplamento é por `globalThis` de propósito: o Telemetry é módulo PURO
    // (sem Phaser) para rodar no bun:test, e importar Cheats o quebraria.
    Cheats._reset();
    Cheats._marcarSuja();
    expect((globalThis as { __cheatSujo?: boolean }).__cheatSujo).toBe(true);
  });
});
