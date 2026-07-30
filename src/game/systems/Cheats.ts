// ─────────────────────────────────────────────────────────────────────────────
// CHEATS por sequência de teclas (estilo DOOM). Hoje só um: IDDQD → GOD MODE.
//
// O núcleo é PURO (sem Phaser) para ser testável em bun:test: `SequenceMatcher`
// só recebe letras e diz quando um código fechou. A fiação Phaser fica em
// `installCheats`, no fim do arquivo.
//
// ⚠ REGRA QUE NÃO PODE SER QUEBRADA: run com cheat NÃO ALIMENTA DADO.
//
// Esta sessão inteira foi gasta consertando telemetria envenenada — 486 vitórias
// falsas do `bun smoke`, um filtro de bot que deixava passar 97% da automação, e
// verbos que "ninguém usava" porque não eram contados. Um god mode que continuasse
// gravando `playtest_events` e submetendo ao ranking recriaria o problema por
// dentro, e desta vez sem assinatura óbvia: uma run imortal parece uma run
// excelente. O `Telemetry` corta o envio na origem lendo a flag `__cheatSujo`
// (mesmo mecanismo do guard de `navigator.webdriver`) e o `GameOverScene` não
// oferece o ranking.
//
// O buffer LOCAL continua gravando: serve para o dono inspecionar em DEV, e nunca
// sai da máquina.
// ─────────────────────────────────────────────────────────────────────────────
import type Phaser from "phaser";

/** Códigos reconhecidos. A chave é o que o jogador digita (maiúsculas). */
export const CHEAT_CODES = {
  IDDQD: "godMode",
} as const;

export type CheatId = (typeof CHEAT_CODES)[keyof typeof CHEAT_CODES];

/**
 * Casador de sequência de teclas. Mantém uma janela do tamanho do maior código
 * e reporta o cheat assim que ele fecha.
 *
 * Por que uma JANELA e não um índice de progresso: com índice, digitar "IDID QD"
 * quebra o casamento e o jogador precisa recomeçar do zero — e ele não tem
 * feedback nenhum de que errou, então acha que o cheat não existe. A janela
 * deslizante casa o sufixo, que é o comportamento que as pessoas esperam de
 * cheat de jogo (e o que o DOOM fazia).
 */
export class SequenceMatcher {
  private buffer = "";
  private readonly maxLen: number;

  constructor(private readonly codes: Record<string, CheatId> = CHEAT_CODES) {
    this.maxLen = Math.max(...Object.keys(codes).map((c) => c.length));
  }

  /** Alimenta uma tecla. Devolve o cheat se a sequência fechou agora, senão null. */
  push(key: string): CheatId | null {
    const c = (key ?? "").toUpperCase();
    if (!/^[A-Z0-9]$/.test(c)) return null; // ignora setas, shift, espaço...
    this.buffer = (this.buffer + c).slice(-this.maxLen);
    for (const [code, id] of Object.entries(this.codes)) {
      if (this.buffer.endsWith(code)) {
        this.buffer = ""; // não redispara na tecla seguinte
        return id;
      }
    }
    return null;
  }

  /** Só para teste/diagnóstico. */
  get janela(): string {
    return this.buffer;
  }
}

/** Estado de cheats da SESSÃO (não da run) — morrer não desliga o god mode. */
const _ativos = new Set<CheatId>();

export const Cheats = {
  ativo(id: CheatId): boolean {
    return _ativos.has(id);
  },
  /** Liga/desliga (IDDQD é toggle, como no DOOM). Devolve o estado novo. */
  alternar(id: CheatId): boolean {
    if (_ativos.has(id)) {
      _ativos.delete(id);
      return false;
    }
    _ativos.add(id);
    return true;
  },
  /** Alguma trapaça foi usada nesta sessão? Uma vez true, fica true. */
  get sessaoSuja(): boolean {
    return _sujou;
  },
  _marcarSuja() {
    _sujou = true;
    // Bandeira em `globalThis` porque o `Telemetry` é um módulo PURO (sem
    // Phaser, testável em bun:test) e importar `Cheats` o acoplaria. Ele lê esta
    // flag para cortar o envio na origem — ver `cheatUsado()` lá.
    (globalThis as { __cheatSujo?: boolean }).__cheatSujo = true;
  },
  /** Só para teste. */
  _reset() {
    _ativos.clear();
    _sujou = false;
    (globalThis as { __cheatSujo?: boolean }).__cheatSujo = false;
  },
};

let _sujou = false;

/**
 * Liga o detector de cheats numa cena. Chamar no `create()`.
 * `onGodMode` recebe o estado novo para a cena aplicar (tint, toast, etc).
 */
export function installCheats(scene: Phaser.Scene, onGodMode: (ligado: boolean) => void): void {
  const matcher = new SequenceMatcher();
  const handler = (ev: KeyboardEvent) => {
    const cheat = matcher.push(ev.key);
    if (cheat !== "godMode") return;
    const ligado = Cheats.alternar("godMode");
    if (ligado) Cheats._marcarSuja(); // suja a SESSÃO, não só a run
    onGodMode(ligado);
  };
  scene.input.keyboard?.on("keydown", handler);
  // Sem isto o listener sobrevive à troca de cena e acumula um por fase.
  scene.events.once("shutdown", () => scene.input.keyboard?.off("keydown", handler));
}
