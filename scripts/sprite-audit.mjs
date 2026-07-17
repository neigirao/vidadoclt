// ─────────────────────────────────────────────────────────────────────────────
// Auditoria de QUALIDADE dos sprites (não só contagem — ver frame-coverage.mjs).
// Varre public/assets/sprites/*.png e sinaliza os defeitos que estragam a
// animação/leitura no jogo, agrupando por FAMÍLIA de animação:
//
//   • vazio        — < MIN_OPAQUE px opacos (extração ruim / frame em branco).
//   • chapado      — 1 cor domina > FLAT_PCT dos px opacos (bloco/lixo de recorte).
//   • tamanho      — dimensões divergem dentro da família (causa "encolhimento").
//   • outlier-alt  — altura do conteúdo fora da mediana da família (pulo de escala).
//
// Gera docs/SPRITE_AUDIT.md. Uso:
//   node scripts/sprite-audit.mjs            (grava o .md)
//   node scripts/sprite-audit.mjs --stdout   (só imprime)
// ─────────────────────────────────────────────────────────────────────────────
import { readdirSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const DIR = "public/assets/sprites";
const MIN_OPAQUE = 25; // < isto = vazio (mesma regra do pack-atlas / AtlasFrameScan)
const FLAT_PCT = 0.92; // > isto de 1 cor só = chapado (lixo)
const OPAQUE_A = 30; // alpha p/ considerar opaco
const HEIGHT_TOL = 0.25; // ±25% da mediana de altura de conteúdo → outlier

const files = readdirSync(DIR)
  .filter((f) => f.endsWith(".png"))
  .sort();

// família = nome sem os dígitos finais (enemy-x-walk3 → enemy-x-walk).
const famKey = (name) => name.replace(/\d+$/, "");

async function analyze(name) {
  const { data, info } = await sharp(`${DIR}/${name}.png`)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  let opaque = 0;
  let minY = h;
  let maxY = -1;
  const colors = new Map();
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (data[i + 3] > OPAQUE_A) {
        opaque++;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        const key = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
        colors.set(key, (colors.get(key) ?? 0) + 1);
      }
    }
  }
  const dominant = opaque ? Math.max(0, ...colors.values()) / opaque : 0;
  const contentH = maxY >= minY ? maxY - minY + 1 : 0;
  return { name, w, h, opaque, flat: dominant, contentH };
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};

const stats = [];
for (const file of files) stats.push(await analyze(file.replace(/\.png$/, "")));

// agrupa por família p/ tamanho + altura mediana
const fams = new Map();
for (const s of stats) {
  const k = famKey(s.name);
  (fams.get(k) ?? fams.set(k, []).get(k)).push(s);
}

const findings = [];
for (const [fam, arr] of fams) {
  const dims = new Set(arr.map((s) => `${s.w}x${s.h}`));
  const medH = median(arr.filter((s) => s.contentH > 0).map((s) => s.contentH));
  for (const s of arr) {
    const issues = [];
    if (s.opaque < MIN_OPAQUE) issues.push("vazio");
    else if (s.flat > FLAT_PCT) issues.push(`chapado ${(s.flat * 100) | 0}%`);
    if (dims.size > 1) issues.push(`tamanho ${s.w}x${s.h}`);
    if (medH > 0 && s.contentH > 0 && Math.abs(s.contentH - medH) / medH > HEIGHT_TOL)
      issues.push(`altura ${s.contentH} vs mediana ${medH}`);
    if (issues.length) findings.push({ fam, name: s.name, issues });
  }
}

const total = stats.length;
const byType = { vazio: 0, chapado: 0, tamanho: 0, altura: 0 };
for (const f of findings)
  for (const i of f.issues) {
    if (i.startsWith("vazio")) byType.vazio++;
    else if (i.startsWith("chapado")) byType.chapado++;
    else if (i.startsWith("tamanho")) byType.tamanho++;
    else if (i.startsWith("altura")) byType.altura++;
  }

let md = `# Auditoria de sprites — Corporate Escape (A Vida do CLT)

> Gerado por \`node scripts/sprite-audit.mjs\`. Não editar à mão — rodar o script.

Varre \`public/assets/sprites/*.png\` (a FONTE do atlas) e sinaliza defeitos de
qualidade que estragam a animação/leitura. Complementa \`FRAME_COVERAGE.md\` (que
só conta frames). Regras: vazio < ${MIN_OPAQUE} px opacos; chapado > ${FLAT_PCT * 100}% de 1 cor;
tamanho divergente na família; altura de conteúdo fora de ±${HEIGHT_TOL * 100}% da mediana.

- **Sprites analisados:** ${total}
- **Com algum problema:** ${findings.length}
- **Vazios:** ${byType.vazio} · **Chapados:** ${byType.chapado} · **Tamanho inconsistente:** ${byType.tamanho} · **Altura outlier:** ${byType.altura}

> ⚠️ Nem todo flag é bug: frames de FX/impacto (ex.: \`*-hurt2\` explosão) podem ser
> "chapados"/"altura" legítimos, e famílias com frames idle/walk não-usados podem
> ter tamanho divergente sem afetar o jogo. Conferir no LAB SPRITES antes de mexer.

`;

if (!findings.length) {
  md += `\n✅ Nenhum problema encontrado.\n`;
} else {
  md += `| Família | Frame | Problemas |\n| --- | --- | --- |\n`;
  findings.sort((a, b) => a.fam.localeCompare(b.fam) || a.name.localeCompare(b.name));
  for (const f of findings) md += `| \`${f.fam}\` | \`${f.name}\` | ${f.issues.join(" · ")} |\n`;
}

if (process.argv.includes("--stdout")) {
  process.stdout.write(md);
} else {
  writeFileSync("docs/SPRITE_AUDIT.md", md);
  console.log(
    `docs/SPRITE_AUDIT.md: ${total} sprites, ${findings.length} com problema ` +
      `(vazio ${byType.vazio}, chapado ${byType.chapado}, tamanho ${byType.tamanho}, altura ${byType.altura}).`,
  );
}
