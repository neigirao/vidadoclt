// ─────────────────────────────────────────────────────────────────────────────
// GATE de cobertura de frames por família e estado.
//
// Complementa `frame-coverage.mjs` (que só *reporta*): este script APLICA pisos
// por (categoria × ação) e sai com código 1 se algo violar — para virar checagem
// obrigatória no CI e impedir regressões (ex.: alguém dropa o walk do estagiário
// de 16 → 2 sem perceber).
//
// Pisos calibrados pela realidade atual do atlas — não são o "16 ideal" do
// coverage report, e sim o MÍNIMO abaixo do qual a animação fica ruim de ver /
// perceptível como bug. Loops que o jogo REALMENTE cicla (walk/idle) têm piso
// mais alto; hurt/death/attack ficam mais baixos porque muitos rodam single-frame
// de propósito.
//
// Exceções por família ficam em EXCEPTIONS abaixo, com JUSTIFICATIVA — nunca
// baixar o piso global só pra silenciar. Se uma família precisa relaxar, é
// intencional e documentado.
//
// Uso:
//   node scripts/frame-coverage-check.mjs           (falha se houver violação)
//   node scripts/frame-coverage-check.mjs --json    (imprime JSON, mesmo código)
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from "node:fs";

const atlas = JSON.parse(readFileSync(new URL("../public/assets/atlas.json", import.meta.url)));
const frames = atlas.textures.flatMap((t) => t.frames.map((f) => f.filename));

// Parseia frame `<subject>-<action><N>` (mesma regra do frame-coverage).
const re = /^(.*?)-([a-z]+)(\d+)$/;
const map = new Map(); // subject → Map(action → Set(index))
for (const f of frames) {
  const m = re.exec(f);
  if (!m || m[2] === "frame") continue;
  const [, subj, act, idx] = [m[0], m[1], m[2], +m[3]];
  if (!map.has(subj)) map.set(subj, new Map());
  const am = map.get(subj);
  if (!am.has(act)) am.set(act, new Set());
  am.get(act).add(idx);
}

// Categoriza (idêntico ao frame-coverage.mjs — manter em sincronia).
function cat(s) {
  if (s === "player") return "player";
  if (s.startsWith("item-") || s.startsWith("obj-")) return "item";
  if (s.startsWith("npc-")) return "npc";
  if (
    s === "boss-ceo" ||
    /-boss$|-mega$/.test(s) ||
    ["enemy-gerente", "enemy-diretor", "enemy-brenda"].includes(s)
  )
    return "boss";
  return "enemy";
}

// ── Pisos mínimos por (categoria, ação) ───────────────────────────────────────
// Ação ausente na tabela = SEM piso (não falha). Isto é intencional: ações
// customizadas (ex.: `special`, `charge`, `sprint`) não têm requisito universal.
const FLOORS = {
  player: { idle: 4, walk: 16, run: 16, attack: 4, hurt: 2, jump: 3, fall: 2, dash: 1 },
  boss: { idle: 4, walk: 8, attack: 4, hurt: 2, death: 3 },
  enemy: { idle: 4, walk: 8, attack: 4, hurt: 2, death: 3 },
  npc: { idle: 4, walk: 8 },
  item: {}, // itens não têm piso — loops curtos (3–4) são de propósito
};

// ── Exceções documentadas ─────────────────────────────────────────────────────
// Chave `<subject>/<action>` → { min, why }. Aplica piso local em vez do global.
// Adicionar exceção EXIGE justificativa — para o próximo dev saber por que existe.
const EXCEPTIONS = {
  // exemplo (deixado vazio hoje):
  // "enemy-evangelista/walk": { min: 8, why: "evangelista base 2, dobrado 3× é o máximo antes de degradar" },
};

function floorFor(subject, action) {
  const key = `${subject}/${action}`;
  if (key in EXCEPTIONS) return EXCEPTIONS[key].min;
  const c = cat(subject);
  return FLOORS[c]?.[action] ?? 0;
}

// Conta CONTÍGUOS a partir do 0 (mesma regra do AtlasFrameScan / frame-coverage).
function contiguous(set) {
  let c = 0;
  while (set.has(c)) c++;
  return c;
}

const violations = [];
const passes = [];
for (const [subj, am] of map) {
  for (const [act, set] of am) {
    const min = floorFor(subj, act);
    if (min <= 0) continue; // sem piso → não avalia
    const have = contiguous(set);
    const row = { subject: subj, action: act, have, min, category: cat(subj) };
    if (have < min) violations.push(row);
    else passes.push(row);
  }
}

// ── Cruzamento de COERÊNCIA com o que o jogo REALMENTE cicla ──────────────────
// O gate de piso conta frames, mas é cego para o caso PERIGOSO: o código cicla
// MAIS frames do que o atlas tem (setEnemyTex faz `% count` → pede um índice
// inexistente → frame faltando / erro em runtime). Aqui parseamos as contagens
// hardcoded de EnemyAnimConfig.ts e exigimos atlas contíguo >= o que o jogo cicla.
const coherenceViolations = [];
try {
  const cfg = readFileSync(
    new URL("../src/game/systems/EnemyAnimConfig.ts", import.meta.url),
    "utf8",
  );
  const parseCounts = (constName) => {
    const block = new RegExp(
      `${constName}\\s*:\\s*Record<[^>]*>\\s*=\\s*\\{([\\s\\S]*?)\\n\\};`,
    ).exec(cfg);
    const out = {};
    if (!block) return out;
    for (const m of block[1].matchAll(/["']?([a-z0-9-]+)["']?\s*:\s*(\d+)/gi))
      out[m[1]] = Number(m[2]);
    return out;
  };
  const cycled = {
    walk: parseCounts("WALK_FRAME_COUNTS"),
    idle: parseCounts("IDLE_FRAME_COUNTS"),
    attack: parseCounts("ATTACK_FRAME_COUNTS"),
  };
  for (const [state, counts] of Object.entries(cycled)) {
    for (const [prefix, n] of Object.entries(counts)) {
      const subj = `enemy-${prefix}`;
      const have = contiguous(map.get(subj)?.get(state) ?? new Set());
      if (have < n)
        coherenceViolations.push({
          subject: subj,
          action: state,
          have,
          cycles: n,
          category: cat(subj),
        });
    }
  }
} catch {
  /* EnemyAnimConfig ausente/ilegível — pula o cruzamento (não falha o gate) */
}
for (const cv of coherenceViolations) violations.push({ ...cv, min: cv.cycles, coherence: true });

// Sanity extra: pisos declarados para famílias que NÃO existem no atlas =
// provável typo no FLOORS/EXCEPTIONS. Sinaliza mas não falha o CI.
const declaredExceptionsMissing = Object.keys(EXCEPTIONS).filter((k) => {
  const [subj, act] = k.split("/");
  return !map.get(subj)?.has(act);
});

const wantJson = process.argv.includes("--json");
if (wantJson) {
  process.stdout.write(
    JSON.stringify(
      {
        ok: violations.length === 0,
        checked: passes.length,
        violations,
        declaredExceptionsMissing,
      },
      null,
      2,
    ) + "\n",
  );
} else {
  const total = passes.length + violations.length;
  if (violations.length === 0) {
    console.log(`✅ frame-coverage-check: ${total} pares (categoria×ação) checados, 0 violações.`);
  } else {
    console.error(`❌ frame-coverage-check: ${violations.length} violação(ões) de ${total} pares:`);
    console.error("");
    for (const v of violations) {
      const tag = v.coherence
        ? " [COERÊNCIA: o jogo cicla mais do que existe → frame faltando]"
        : "";
      console.error(
        `  · ${v.category.padEnd(6)} ${v.subject}/${v.action}: tem ${v.have}, mínimo ${v.min} (falta ${v.min - v.have})${tag}`,
      );
    }
    console.error("");
    console.error(
      "Como corrigir: `node scripts/gen-inbetweens.mjs <subject>-<action>` para dobrar o ciclo (determinístico)",
    );
    console.error(
      "OU o LAB SPRITES para subir arte à mão. Se o piso não faz sentido para essa família, adicione uma EXCEPTION documentada.",
    );
  }
  if (declaredExceptionsMissing.length) {
    console.warn(
      `⚠ ${declaredExceptionsMissing.length} EXCEPTION(s) apontam para família/ação inexistente: ${declaredExceptionsMissing.join(", ")}`,
    );
  }
}

process.exit(violations.length > 0 ? 1 : 0);
