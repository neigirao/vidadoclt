// ─────────────────────────────────────────────────────────────────────────────
// Levantamento de COBERTURA DE FRAMES por sujeito/ação a partir do atlas.
// Conta frames CONTÍGUOS a partir do 0 (mesma regra do AtlasFrameScan) e o gap
// até o alvo premium de 16 (o ciclo do enemy-senior). Gera docs/FRAME_COVERAGE.md
// para dar contexto a outra IA / ao time de arte.
//
// Uso: node scripts/frame-coverage.mjs            (imprime resumo + reescreve o .md)
//      node scripts/frame-coverage.mjs --stdout   (só imprime, não grava)
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync } from "node:fs";

const TARGET = 16;
const atlas = JSON.parse(readFileSync(new URL("../public/assets/atlas.json", import.meta.url)));
const frames = atlas.textures.flatMap((t) => t.frames.map((f) => f.filename));

const re = /^(.*?)-([a-z]+)(\d+)$/;
const map = new Map();
for (const f of frames) {
  const m = re.exec(f);
  if (!m || m[2] === "frame") continue; // ignora pseudo-ação de nomeação legada
  const [, subj, act, idx] = [m[0], m[1], m[2], +m[3]];
  if (!map.has(subj)) map.set(subj, new Map());
  const am = map.get(subj);
  if (!am.has(act)) am.set(act, new Set());
  am.get(act).add(idx);
}

function cat(s) {
  if (s === "player") return "Jogador";
  if (s.startsWith("item-") || s.startsWith("obj-")) return "Objetos/Itens";
  if (s.startsWith("npc-")) return "NPC";
  if (
    s === "boss-ceo" ||
    /-boss$|-mega$/.test(s) ||
    ["enemy-gerente", "enemy-diretor", "enemy-brenda"].includes(s)
  )
    return "Bosses/Mid-boss";
  return "Inimigos";
}

const rows = [];
for (const [subj, am] of map) {
  for (const [act, set] of am) {
    let c = 0;
    while (set.has(c)) c++;
    rows.push({
      subject: subj,
      category: cat(subj),
      action: act,
      have: c,
      gap: Math.max(0, TARGET - c),
    });
  }
}
const catOrder = ["Jogador", "Bosses/Mid-boss", "Inimigos", "NPC", "Objetos/Itens"];
rows.sort(
  (a, b) =>
    catOrder.indexOf(a.category) - catOrder.indexOf(b.category) ||
    a.subject.localeCompare(b.subject) ||
    a.action.localeCompare(b.action),
);

const subjects = [...new Set(rows.map((r) => r.subject))];
const totalGap = rows.reduce((s, r) => s + r.gap, 0);
const atTarget = rows.filter((r) => r.gap === 0);

let md = `# Cobertura de frames — Corporate Escape (A Vida do CLT)

> Gerado por \`node scripts/frame-coverage.mjs\`. Não editar à mão — rodar o script.

O padrão de referência é o **ciclo de 16 frames** por ação (o \`enemy-senior/walk\`).
A contagem abaixo é **contígua a partir do 0** — a mesma regra que \`systems/AtlasFrameScan.ts\`
usa no boot — então frame-lixo solto (índice não-contíguo) **não** é contado.

- **Sujeitos:** ${subjects.length}
- **Pares sujeito×ação:** ${rows.length}
- **Já em ${TARGET}:** ${atTarget.length} (${atTarget.map((r) => `\`${r.subject}/${r.action}\``).join(", ") || "—"})
- **Frames faltando p/ TUDO a ${TARGET}:** ${totalGap.toLocaleString("pt-BR")}

## Como ler / priorizar

A maioria dos gaps é **cosmética hoje**: \`hurt\` e \`death\` rodam em 1 frame de propósito,
e várias famílias das Fases 2–5 renderizam base estática. O ganho real está no **walk**
(que o jogo cicla via \`setEnemyTex\` na Fase 1 e \`animPhase\` nas Fases 2–5) e nas ações do
**jogador**. Chegar a ${TARGET} em tudo é um objetivo de arte enorme e não desejável para
itens/objetos (loops curtos de 3–4).

Pipeline para preencher: **LAB SPRITES → slot de frame** (upload) ou o sintetizador
determinístico \`scripts/gen-inbetweens.mjs\` (dobra um ciclo por interpolação, sem IA).

| Categoria | Sujeito | Ação | Tem | Alvo | Faltam |
| --- | --- | --- | ---: | ---: | ---: |
`;
for (const r of rows) {
  md += `| ${r.category} | \`${r.subject}\` | ${r.action} | ${r.have} | ${TARGET} | ${r.gap || "✓"} |\n`;
}

if (process.argv.includes("--stdout")) {
  process.stdout.write(md);
} else {
  writeFileSync(new URL("../docs/FRAME_COVERAGE.md", import.meta.url), md);
  console.log(
    `docs/FRAME_COVERAGE.md: ${subjects.length} sujeitos, ${rows.length} ações, faltam ${totalGap} frames p/ 16.`,
  );
}
