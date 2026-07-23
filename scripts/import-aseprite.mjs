// ─────────────────────────────────────────────────────────────────────────────
// Import de export do ASEPRITE/LibreSprite — a ponte para uma FONTE DE ANIMAÇÃO
// EDITÁVEL. Hoje os 3.8k PNGs de `public/assets/sprites/` são frames soltos sem
// source (sem timeline/tags) — foi isso que empurrou o projeto pro in-between
// por blend (ver docs/ANIM_POLICY.md). Este script fecha o novo fluxo:
//
//   1. O artista anima num .aseprite (timeline + tags walk/idle/attack/hurt/death).
//   2. Exporta por CLI (ou File > Export Sprite Sheet):
//        aseprite -b personagem.aseprite \
//          --sheet sheet.png --data sheet.json \
//          --format json-array --list-tags
//   3. Aqui: node scripts/import-aseprite.mjs sheet.json <prefixo> [--dry] [--out=DIR]
//      → fatia cada tag em `<prefixo>-<tag><N>.png` (a convenção do atlas),
//        grava em public/assets/sprites/ e re-empacota o atlas 1×.
//
// Também IMPRIME os `duration` por tag como sugestão de MS (o timing é design e
// vive em EnemyAnimConfig.ts — o script NÃO o edita; só sugere).
//
// Guardrails: exige json-array com frameTags; valida que todos os frames de uma
// tag têm o MESMO canvas (regra do check:frames); `--dry` só imprime o plano;
// `--out=DIR` grava noutro diretório (teste) e NÃO re-empacota.
// ─────────────────────────────────────────────────────────────────────────────
import sharp from "sharp";
import { readFileSync, mkdirSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const dry = process.argv.includes("--dry");
const outArg = process.argv.find((a) => a.startsWith("--out="));
const OUT = outArg ? resolve(outArg.split("=")[1]) : resolve("public/assets/sprites");
const isRepoOut = !outArg;

const [jsonPath, prefix] = args;
if (!jsonPath || !prefix) {
  console.error(
    "uso: node scripts/import-aseprite.mjs <sheet.json> <prefixo> [--dry] [--out=DIR]\n" +
      "  ex.: node scripts/import-aseprite.mjs export/estagiario.json enemy-estagiario\n" +
      "  (o JSON deve ser export do Aseprite: --format json-array --list-tags)",
  );
  process.exit(2);
}

const data = JSON.parse(readFileSync(jsonPath, "utf8"));
const frames = Array.isArray(data.frames) ? data.frames : null;
const tags = data.meta?.frameTags;
if (!frames || !Array.isArray(tags) || tags.length === 0) {
  console.error(
    "✖ JSON não parece export do Aseprite em json-array com tags.\n" +
      "  Exporte com: aseprite -b arte.aseprite --sheet s.png --data s.json --format json-array --list-tags",
  );
  process.exit(1);
}
const sheetPath = resolve(dirname(resolve(jsonPath)), data.meta?.image ?? "");
console.log(`sheet: ${sheetPath}`);
console.log(`tags:  ${tags.map((t) => `${t.name}[${t.from}..${t.to}]`).join("  ")}`);

let wrote = 0;
const suggestions = [];
for (const tag of tags) {
  const tagFrames = frames.slice(tag.from, tag.to + 1);
  // Canvas consistente por tag (regra do check:frames — evita "inchar/encolher").
  const sizes = new Set(tagFrames.map((f) => `${f.sourceSize.w}x${f.sourceSize.h}`));
  if (sizes.size > 1) {
    console.error(
      `✖ tag "${tag.name}": canvas inconsistente entre frames (${[...sizes].join(", ")}).`,
    );
    console.error("  No Aseprite, exporte SEM trim (ou com padding fixo) p/ canvas uniforme.");
    process.exit(1);
  }
  const durations = tagFrames.map((f) => f.duration ?? 100);
  const medianMs = durations.sort((a, b) => a - b)[Math.floor(durations.length / 2)];
  suggestions.push(
    `  ${tag.name}: ${tagFrames.length} frames · ~${medianMs}ms/frame (timeline do artista)`,
  );

  for (let i = 0; i < tagFrames.length; i++) {
    const f = tagFrames[i];
    const name = `${prefix}-${tag.name}${i}.png`;
    const dest = join(OUT, name);
    if (dry) {
      console.log(
        `  (dry) ${name}  ← frame ${tag.from + i} @${f.frame.x},${f.frame.y} ${f.frame.w}x${f.frame.h}`,
      );
      continue;
    }
    mkdirSync(OUT, { recursive: true });
    // Recorta do sheet e recompõe no canvas cheio (sourceSize) respeitando o
    // offset do trim (spriteSourceSize) — mesmo comportamento do atlas da casa.
    const cut = await sharp(sheetPath)
      .extract({ left: f.frame.x, top: f.frame.y, width: f.frame.w, height: f.frame.h })
      .toBuffer();
    await sharp({
      create: {
        width: f.sourceSize.w,
        height: f.sourceSize.h,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([
        { input: cut, left: f.spriteSourceSize?.x ?? 0, top: f.spriteSourceSize?.y ?? 0 },
      ])
      .png()
      .toFile(dest);
    wrote++;
  }
}

console.log(
  `\n${dry ? "(dry) plano acima — nada gravado." : `${wrote} frame(s) gravado(s) em ${OUT}`}`,
);
console.log("\nSugestão de MS por estado (aplicar À MÃO em EnemyAnimConfig.ts — timing é design):");
for (const s of suggestions) console.log(s);

if (!dry && isRepoOut) {
  console.log("\nre-empacotando atlas…");
  const r = spawnSync("node", ["scripts/pack-atlas.mjs"], { stdio: "inherit" });
  process.exit(r.status ?? 0);
}
