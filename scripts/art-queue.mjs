// ─────────────────────────────────────────────────────────────────────────────
// FILA DE ARTE por PRIORIDADE = defeito × EXPOSIÇÃO REAL (`bun art:queue`)
//
// POR QUE EXISTE: o `audit:anim` ordena por qualidade, e ordenar por qualidade
// pura leva a gastar arte no lugar errado. Medido na telemetria já limpa
// (docs/TELEMETRIA.md): a Fase 1 é vista por 62 sessões humanas e o CEO por 3.
// Uma animação horrível que 5% dos jogadores veem vale menos que uma medíocre
// que todos veem. Esta fila multiplica o defeito pela exposição, então a ordem
// que sai daqui é "onde a próxima hora de arte rende mais", não "o que está pior".
//
// A EXPOSIÇÃO é dado, não palpite — vem da tabela em docs/TELEMETRIA.md. Quando
// houver mais tráfego, reler o banco e atualizar PESO_FASE.
//
// Uso: node scripts/art-queue.mjs [--top=N] [--json]
// ─────────────────────────────────────────────────────────────────────────────
import { spawnSync } from "node:child_process";

// Sessões humanas que entram em cada fase (docs/TELEMETRIA.md).
const PESO_FASE = { 1: 62, 2: 46, 3: 41, 4: 41, 5: 41, ceo: 3, copa: 17 };

// Prefixo do atlas → fase onde o inimigo aparece.
const FASE = {
  estagiario: 1,
  analista: 1,
  "analista-novo": 1,
  facilitador: 1,
  scrum: 1,
  coordenador: 1,
  senior: 1,
  rh: 1,
  gerente: 1, // boss da Fase 1
  "scrum-boss": 4,
  "coord-boss": 2,
  telemarketer: 2,
  reuniao: 2,
  impressora: 2,
  "guardiao-cafe": 2,
  noticeboard: 2,
  bateria: 2,
  evangelista: 3,
  "impressora-b": 3,
  coletor: 3,
  planilha: 3,
  "impressora-c": 4,
  "ti-suporte": 4,
  cabo: 4,
  drone: 4,
  seguranca: 4,
  "evangelista-boss": 4,
  "impressora-d": 5,
  "evangelista-mega": 5,
  brenda: 5,
  diretor: 5,
  ceo: "ceo",
  "boss-ceo": "ceo",
  faxineiro: "copa",
  player: 1, // o player está em TODAS as cenas → peso máximo
};

// Quanto cada AÇÃO aparece dentro de uma sessão. `walk` roda o tempo todo em
// todo inimigo; `death` acontece uma vez por inimigo; `hurt` é um flash.
const PESO_ACAO = { walk: 1.0, idle: 0.8, attack: 0.7, run: 0.5, death: 0.35, hurt: 0.2 };

const PESO_DEFEITO = { dead: 45, "loop-pop": 30, jerk: 22, dim: 25, padded: 10 };

// ── O que o motor REALMENTE renderiza ────────────────────────────────────────
// Prioridade de arte só faz sentido para animação que chega à TELA. Duas fatias
// do atlas nunca chegam, e sem esta checagem a fila mandava trabalhar nelas:
//
//   • Fases 2–5 (`animPhase` em PhaseEnemies.ts) NÃO ciclam `attack` — esses
//     inimigos renderizam a pose estática de propósito (decisão do dono).
//   • Fase 1 (`setEnemyTex`) cicla `attack`, mas limitado por `ATTACK_SAFE_FRAMES`;
//     analista/facilitador/coordenador estão em 0 porque a arte é OUTRO
//     PERSONAGEM, então mostram o próprio idle.
//
// Medido antes do conserto: 19 das 96 animações da fila (23% da prioridade)
// apontavam para arte invisível — incluindo 4 das 10 primeiras.
const PREFIXOS_FASE1 = [
  "estagiario",
  "analista",
  "facilitador",
  "scrum",
  "coordenador",
  "senior",
  "rh",
  "scrum-boss",
  "coord-boss",
];
/** Prefixos da Fase 1 com teto 0 em ATTACK_SAFE_FRAMES (mostram o idle). */
const ATTACK_VETADO = ["analista", "facilitador", "coordenador"];

function renderiza(prefix, state) {
  if (state !== "attack") return true;
  const p = prefix.replace(/^(enemy|boss|npc)-/, "");
  if (!PREFIXOS_FASE1.includes(p)) return false; // Fases 2–5 não ciclam attack
  return !ATTACK_VETADO.includes(p);
}

const audit = spawnSync("node", ["scripts/audit-anim.mjs", "--json"], {
  encoding: "utf8",
  maxBuffer: 64 * 1024 * 1024,
});
const { reports } = JSON.parse(audit.stdout);

function fase(prefix) {
  const p = prefix.replace(/^(enemy|boss|npc)-/, "");
  if (FASE[p] !== undefined) return FASE[p];
  // Mais específico primeiro (impressora-b antes de impressora).
  const k = Object.keys(FASE)
    .filter((x) => p.startsWith(x))
    .sort((a, b) => b.length - a.length)[0];
  return k ? FASE[k] : 3; // desconhecido: peso do meio, não some da fila
}

const linhas = [];
const invisiveis = [];
for (const r of reports) {
  const defeito = r.flags.reduce((a, f) => a + (PESO_DEFEITO[f.kind] ?? 5), 0);
  if (!defeito) continue;
  if (!renderiza(r.prefix, r.state)) {
    invisiveis.push(`${r.prefix}|${r.state}`);
    continue;
  }
  const f = fase(r.prefix);
  const exp = PESO_FASE[f] ?? 41;
  const prioridade = defeito * (PESO_ACAO[r.state] ?? 0.5) * exp;
  linhas.push({
    prefix: r.prefix,
    state: r.state,
    frames: r.frames,
    fase: f,
    defeito,
    exposicao: exp,
    prioridade: Math.round(prioridade),
    flags: r.flags.map((x) => x.kind),
  });
}
linhas.sort((a, b) => b.prioridade - a.prioridade);

if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ fila: linhas }, null, 2));
} else {
  const topArg = process.argv.find((a) => a.startsWith("--top="));
  const top = topArg ? +topArg.split("=")[1] : 20;
  console.log("FILA DE ARTE — prioridade = defeito × peso da ação × exposição da fase\n");
  console.log(
    `${"#".padStart(3)}  ${"prio".padStart(6)}  ${"fase".padStart(4)}  ${"animação".padEnd(34)}${"f".padStart(4)}  defeitos`,
  );
  linhas.slice(0, top).forEach((l, i) => {
    console.log(
      `${String(i + 1).padStart(3)}  ${String(l.prioridade).padStart(6)}  ${String(l.fase).padStart(4)}  ${`${l.prefix}|${l.state}`.padEnd(34)}${String(l.frames).padStart(4)}  ${l.flags.join(",")}`,
    );
  });
  const porFase = {};
  for (const l of linhas) porFase[l.fase] = (porFase[l.fase] ?? 0) + l.prioridade;
  console.log("\nPRIORIDADE ACUMULADA POR FASE (onde a arte rende mais)");
  for (const [f, p] of Object.entries(porFase).sort((a, b) => b[1] - a[1]))
    console.log(`  fase ${String(f).padEnd(5)} ${Math.round(p)}`);
  console.log(`\n${linhas.length} animações com defeito na fila.`);
  if (invisiveis.length)
    console.log(
      `(${invisiveis.length} fora da fila: o motor não renderiza esse attack — ver renderiza())`,
    );
}
