import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ENEMIES, type EnemyId } from "../EnemyCatalog";

// ─────────────────────────────────────────────────────────────────────────────
// O CATÁLOGO TEM QUE CONCORDAR COM AS CLASSES QUE O JOGO INSTANCIA
//
// POR QUE EXISTE: o `EnemyCatalog` é metadado (bestiário, `sim:balance`,
// `art:queue`), mas o HP que o JOGO usa mora em `hp = N` dentro de cada classe
// de inimigo. São duas cópias do mesmo número, e elas divergiram: 24 dos 28
// inimigos, em fatores de 1,2× a 5,3×.
//
// O estrago não foi no jogo — foi na DECISÃO. O `bun sim:balance` lê o catálogo,
// então a auditoria de design mediu a curva de dificuldade errada e concluiu que
// havia um "degrau de 11,2× entre a Fase 1 e a Fase 2". O degrau real é 3,0×, e
// o piso da Fase 2 (42) é mais BAIXO que o teto da Fase 1 (80). A recomendação
// que saiu dali (subir o fim da F1, baixar o começo da F2) teria mexido no
// balanceamento do jogo para corrigir um problema que só existia na planilha.
//
// É o QUARTO instrumento quebrado desta sequência de PRs — depois das 486
// vitórias falsas, do filtro de bot que vazava 97% e dos verbos não contados. Os
// quatro tinham a mesma cara: um número plausível, preciso, sobre a coisa errada.
//
// Este teste lê `hp = N` das classes por análise estática (o `import "phaser"`
// não sobe no bun:test) e cruza com o catálogo. O mapa id→classe é EXPLÍCITO de
// propósito: casar por semelhança de nome erraria em silêncio, e errar aqui move
// balanceamento.
// ─────────────────────────────────────────────────────────────────────────────

const ENTIDADES = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "entities");

/** id do catálogo → nome da classe que o jogo instancia. */
const CLASSE_DE: Partial<Record<EnemyId, string>> = {
  estagiario_desesperado: "EstagiarioDesesperado",
  analista_onboarding: "AnalistaOnboarding",
  estagiario_sobrecarregado: "EstagiarioSobrecarregado",
  analista_junior: "AnalistaJunior",
  facilitador_workshop: "FacilitadorDeWorkshop",
  scrum_master_caotico: "ScrumMasterCaotico",
  coordenador_sinergia: "CoordenadorDeSinergia",
  enemy_rh: "EnemyRH",
  analista_senior_exausto: "AnalistaSeniorExausto",
  telemarketer_zumbi: "TelemarketerZumbi",
  nuvem_board_sentinela: "NuvemBoardSentinela",
  reuniao_corporativa: "ReuniaoCorportiva",
  guardiao_cafe: "GuardiaoDoCafe",
  impressora_assombrada: "ImpressoraAssombrada",
  coletor_dados: "ColetorDeDados",
  evangelista_corporativo: "EvangelistaCorporativo",
  planilha_viva: "PlanilhaViva",
  drone_vigilancia: "DroneDeVigilancia",
  cabo_rede: "CaboDeRede",
  ti_suporte: "TiSuporte",
  seguranca_corporativa: "SegurancaCorporativa",
  bateria_social: "BateriaSocial",
  carimbador_automatico: "CarimbadorAutomatico",
  arquivo_ambulante: "ArquivoAmbulante",
};

/** `hp = N` de cada `export class` das entidades (comentários entre os dois ok). */
function hpDasClasses(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const arquivo of ["Enemies.ts", "PhaseEnemies.ts"]) {
    const src = readFileSync(join(ENTIDADES, arquivo), "utf8");
    const re = /export class (\w+)[^{]*\{\s*\n(?:\s*\/\/[^\n]*\n)*\s*hp = (\d+)/g;
    for (const m of src.matchAll(re)) out[m[1]] = Number(m[2]);
  }
  return out;
}

describe("EnemyCatalog ↔ classes de inimigo", () => {
  test("o mapa aponta para classes que existem (senão o gate vira decoração)", () => {
    const hp = hpDasClasses();
    const orfas = Object.values(CLASSE_DE).filter((c) => c && !(c in hp));
    expect(orfas).toEqual([]);
  });

  test("o HP do catálogo é IGUAL ao da classe que o jogo instancia", () => {
    const hp = hpDasClasses();
    const divergentes: string[] = [];
    for (const [id, classe] of Object.entries(CLASSE_DE)) {
      if (!classe) continue;
      const real = hp[classe];
      const doCatalogo = ENEMIES[id as EnemyId]?.hp;
      if (real !== doCatalogo) divergentes.push(`${id}: catálogo ${doCatalogo} ≠ classe ${real}`);
    }
    // Mudou o `hp` de uma classe? Atualize o catálogo junto. É a MESMA decisão de
    // design nos dois lugares — o catálogo é o que o simulador e o bestiário leem.
    expect(divergentes).toEqual([]);
  });
});
