import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// ─────────────────────────────────────────────────────────────────────────────
// PARIDADE Fase 1 ↔ Fases 2–5
//
// POR QUE EXISTE: `OpenSpaceV2Scene` estende `BasePhaseScene` mas tem `create()`
// próprio e NÃO chama `super.create()` — decisão deliberada (a Fase 1 tem
// escalonamento de HP, eventos de sala e colliders que a Base não conhece). O
// preço é que todo bloco novo adicionado ao `create()` da Base simplesmente NÃO
// EXISTE na Fase 1, e ninguém percebe: o jogo compila, os testes passam, o smoke
// boota, o validador aprova. O sintoma chega ao jogador como "as coisas mudam
// quando eu troco de sala".
//
// Esse padrão já produziu QUATRO bugs neste projeto:
//   • o relógio das 18h congelado a run inteira (`startRunClock` não chamado);
//   • `this.rng is undefined` a cada inimigo morto (`rollSanityDrop`);
//   • HUD mostrando "GRAMPEADOR"/"CAFÉ TURBO" com outra arma na mão, para 2 das
//     3 classes, a Fase 1 inteira;
//   • marcadores de ameaça e drop de arma que só existiam da Fase 2 em diante.
//
// Nenhum gate pegou nenhum dos quatro. Este teste pega o quinto.
//
// COMO FUNCIONA: varre os símbolos que o `create()` da Base aciona e exige que
// cada um esteja OU presente na Fase 1, OU declarado em `DIVERGENCIA_INTENCIONAL`
// com o motivo. Um bloco novo na Base que a Fase 1 não receba reprova aqui e
// obriga uma decisão explícita — replicar, ou documentar por que não.
//
// LIMITE: é análise estática de texto, não execução (o `import "phaser"` não
// sobe no bun:test). Ele garante que o símbolo é MENCIONADO na Fase 1, não que
// esteja sendo chamado na ordem certa. Isso já teria pego os quatro bugs acima.
// ─────────────────────────────────────────────────────────────────────────────

const CENAS = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "scenes");
const base = readFileSync(join(CENAS, "BasePhaseScene.ts"), "utf8");
const fase1 = readFileSync(join(CENAS, "OpenSpaceV2Scene.ts"), "utf8");

/** Corpo de um método, por contagem de chaves a partir da assinatura. */
function corpoDoMetodo(src: string, assinatura: string): string {
  const ini = src.indexOf(assinatura);
  if (ini < 0) throw new Error(`assinatura não encontrada: ${assinatura}`);
  const abre = src.indexOf("{", ini);
  let nivel = 0;
  for (let i = abre; i < src.length; i++) {
    if (src[i] === "{") nivel++;
    else if (src[i] === "}" && --nivel === 0) return src.slice(abre, i + 1);
  }
  throw new Error(`chave não fechou: ${assinatura}`);
}

/** Remove comentários — um símbolo citado em comentário não é fiação. */
const semComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

const createBase = semComentarios(corpoDoMetodo(base, "\n  create()"));

/**
 * Símbolos que a Base aciona no create() e que a Fase 1 NÃO tem — de propósito.
 * Cada entrada precisa de um motivo: é o que separa "decisão" de "esquecimento".
 */
const DIVERGENCIA_INTENCIONAL: Record<string, string> = {
  // A Fase 1 monta o cenário à mão (baias, mesas desenhadas, parallax denso
  // próprio) em vez do pipeline temático das Fases 2–5.
  addPhaseDecor: "Fase 1 desenha o próprio cenário (baias/mesas), não usa decor temático",
  addThemedFloorDecor: "idem — prop de chão próprio",
  addPhaseAmbience: "Fase 1 tem spawnDustParticles() próprio",
  addPhaseParticles: "idem",
  // Iluminação: a Fase 1 usa o evento APAGÃO (lanterna radial) como mecânica.
  // PRESETS de setupPhaseLighting nem tem chave 1 — chamá-lo seria no-op.
  setupPhaseLighting: "Fase 1 usa o sistema Apagao (lanterna) em vez de penumbra ambiente",
  // A Fase 1 não tem boss por design (é onboarding).
  playBossEntryBeat: "Fase 1 não tem boss (onboarding)",
  getBossName: "idem",
  menaceEnrageThreshold: "idem — sem boss, não há enrage a antecipar",
  handleBossDefeat: "idem",
  // Escalonamento por loop: a Fase 1 tem o próprio (+20% com inimigos TRAVADOS),
  // diferente do +15% da Base. Aplicar os dois dobraria o balanceamento.
  sprinkleElites: "presente na Fase 1, mas fora do bloco de loop scaling da Base",
  // Layout: a Fase 1 tem 4 variantes próprias (default/elevado/denso/escada) em
  // vez das 3 genéricas (original/espelhado/alturas).
  getPlatformLayout: "Fase 1 tem 4 variantes de layout próprias",
  getDoorConfig: "Fase 1 monta a porta da Copa à mão (spawnMemo/checkExtintor por perto)",
  getPhaseNumber: "Fase 1 passa 1 literal nos helpers de cenário",
  getBgKey: "Fase 1 passa 'bg-openspace' literal",
  getInitialObjective: "Fase 1 escreve o objetivo direto no hud.setObjective",
  showPhaseIntroCard: "Fase 1 é a abertura da run — não há transição a anunciar",
  rollPhaseEvent: "Fase 1 tem rollRoomEvent() próprio (6 eventos + APAGÃO)",
  spawnPhaseVerticalReward: "Fase 1 tem spawnVerticalReward() próprio",
  setupEnemiesAndGroups: "Fase 1 popula os grupos direto no create()",
  onEnemyKilledByProjectile: "Fase 1 tem host de melee próprio (getMeleeHost)",
  showBoss: "Fase 1 não tem boss — não há barra de boss a mostrar",
  // As duas abaixo NÃO são "a Fase 1 não faz isso": ela faz, com código PRÓPRIO
  // que duplica o da Base. É dívida técnica declarada, não ausência de
  // comportamento — e é justamente o tipo de duplicata que DERIVA. Conferido
  // uma a uma ao escrever este teste; a divergência de elites no caminho do
  // projétil (barreira/bônus/explode faltando) saiu daqui e foi corrigida.
  handleSpecial: "Fase 1 tem switch de especial próprio dentro do onSpecialAttack (duplicado)",
  killEnemyAnimated: "Fase 1 inlina a morte animada no overlap de projétil (duplicado)",
};

describe("paridade Fase 1 ↔ BasePhaseScene", () => {
  test("todo sistema acionado no create() da Base existe na Fase 1 ou é divergência declarada", () => {
    // `this.foo(` e `foo(this` — cobre método da cena e helper de módulo.
    const simbolos = new Set<string>();
    for (const m of createBase.matchAll(/this\.([a-zA-Z_$][\w$]*)\s*\(/g)) simbolos.add(m[1]);
    for (const m of createBase.matchAll(/\b([a-zA-Z_$][\w$]*)\s*\(\s*this\b/g)) simbolos.add(m[1]);

    // Ruído: chamadas do Phaser/JS que não são "sistema do jogo".
    const IGNORAR = new Set(["add", "on", "map", "filter", "getChildren", "forEach", "slice"]);

    const faltando = [...simbolos]
      .filter((s) => !IGNORAR.has(s))
      .filter((s) => !new RegExp(`\\b${s}\\b`).test(semComentarios(fase1)))
      .filter((s) => !(s in DIVERGENCIA_INTENCIONAL));

    expect(faltando).toEqual([]);
  });

  test("as divergências declaradas ainda existem na Base (a lista não apodrece)", () => {
    // Sem isto a lista vira cemitério: um sistema removido da Base seguiria
    // "justificado" para sempre, e a próxima pessoa acreditaria na justificativa.
    const orfas = Object.keys(DIVERGENCIA_INTENCIONAL).filter(
      (s) => !new RegExp(`\\b${s}\\b`).test(semComentarios(base)),
    );
    expect(orfas).toEqual([]);
  });

  test("a Fase 1 conta o especial na telemetria (a Base conta dentro de handleSpecial)", () => {
    // Divergência que NÃO aparece no jogo, só no banco — e por isso é a mais
    // perigosa: a Fase 1 tem handler de especial próprio e não chamava
    // `Telemetry.verb("special")`. Como 23 das 26 sessões humanas jogam a Fase 1,
    // a telemetria dizia "especial = 0,0 por run" e isso foi lido como "o verbo
    // está morto". Instrumento quebrado leva a decisão de design errada com ar
    // de evidência — o mesmo erro das 486 vitórias falsas (#120).
    const handler = corpoDoMetodo(fase1, "this.player.onSpecialAttack =");
    expect(semComentarios(handler)).toContain('Telemetry.verb("special")');
  });

  test("fecharExpediente zera o VR na RUN, não só no player (farm de Reconhecimento)", () => {
    // `persist()` roda ANTES de `fecharExpediente()` e copia `player.vr → run.vr`.
    // Zerando apenas o player, `run.vr` sobrevive e o `buildPlayer` da fase
    // seguinte devolve o mesmo VR — que é convertido DE NOVO. Farm infinito de
    // Reconhecimento, sem erro nenhum aparecendo. Pego dirigindo a cadeia de
    // fases: 20 VR viravam 10, 20, 30, 40 de Reconhecimento em 4 portas.
    const corpo = semComentarios(corpoDoMetodo(base, "protected fecharExpediente("));
    expect(corpo).toContain("r.vr = 0");
    expect(corpo).toContain("Math.floor(r.vr * 0.5)");
  });

  test("as portas de saída travam o DUPLO DISPARO (fadeOut de 300ms)", () => {
    // A cena SEGUE RODANDO durante o fadeOut de 300ms da transição: o overlap da
    // porta continua a ser avaliado e `JustDown` volta a ser verdadeiro se o
    // jogador tocar E outra vez (duplo-toque leva ~150ms). Medido sem a trava:
    // +50 de Sanidade em vez de +25. Mesma falha do farm de VR, na dimensão do
    // TEMPO em vez do estado — e a Fase 1 tem porta própria, então precisa das
    // duas metades (a guarda e o reset no create).
    for (const [nome, src] of [
      ["BasePhaseScene", base],
      ["OpenSpaceV2Scene", fase1],
    ] as const) {
      const limpo = semComentarios(src);
      // O nome do arquivo entra na string comparada para a falha apontar QUAL
      // dos dois quebrou (bun:test não aceita mensagem no expect).
      expect(`${nome}: ${limpo.includes("this.saindoDaFase) return")}`).toBe(`${nome}: true`);
      expect(`${nome}: ${limpo.includes("this.saindoDaFase = true")}`).toBe(`${nome}: true`);
      expect(`${nome}: ${limpo.includes("this.saindoDaFase = false")}`).toBe(`${nome}: true`);
    }
  });

  test("a Fase 1 dá entrada às salas opcionais (elas ficaram órfãs sem a Copa)", () => {
    // As 4 salas LDtk só eram alcançáveis pela porta do meio da Copa. A Fase 1
    // tem create() próprio, então precisa chamar por conta — senão a fase mais
    // jogada do jogo é justamente a que não oferece o desvio.
    expect(semComentarios(fase1)).toContain("spawnSalaOpcional");
  });

  test("os quatro bugs de paridade já corrigidos não voltam", () => {
    const f1 = semComentarios(fase1);
    // Relógio do expediente (senão a run inteira fica 18:00 congelado).
    expect(f1).toContain("startRunClock");
    // Seed do RNG (senão rollSanityDrop quebra a cada kill).
    expect(f1).toContain("RandomDataGenerator");
    // HUD de arma/especial (senão mostra o placeholder do Hud.ts).
    expect(f1).toContain("setWeapon");
    expect(f1).toContain("setSpecial");
    // Marcadores de ameaça e drop de arma por kill.
    expect(f1).toContain("ThreatMarkers");
    expect(f1).toContain("rollWeaponDrop");
  });
});
