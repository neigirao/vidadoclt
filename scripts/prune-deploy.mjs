// ─────────────────────────────────────────────────────────────────────────────
// PODA DO DEPLOY — remove do build publicado os PNGs-FONTE do atlas.
//
// `public/assets/sprites/` guarda ~3900 PNGs individuais que são a FONTE do
// atlas (o pack-atlas.mjs os empacota em atlas.png + atlas.json). O jogo em
// runtime NÃO carrega nenhum deles em massa: carrega o atlas + os poucos
// soltos listados em KEEP (texturas que precisam ser próprias — tileSprite,
// partícula, projétil). Mas o Vite copia `public/` inteiro pro output, então
// 17MB de arte-fonte iam pro deploy sem serem lidos por ninguém.
//
// Este script roda DEPOIS do build (script `build` do package.json) e apaga
// `<output>/assets/sprites/` preservando os KEEP. A pasta-fonte no repo fica
// intacta — dev, LAB de sprites e os scripts de arte continuam iguais.
//
// A lista KEEP é VERIFICADA contra o código: `bun test` (PruneDeploy.test.ts)
// varre src/ atrás de "/assets/sprites/<x>.png" e reprova se alguém carregar
// um solto que não esteja aqui — senão a poda apagaria uma textura viva e o
// jogo quebraria só em produção.
// ─────────────────────────────────────────────────────────────────────────────
import { existsSync, readdirSync, rmSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** PNGs soltos de `assets/sprites/` que o jogo carrega em runtime (via load.image). */
export const KEEP = [
  "item-coffee-cup.png",
  "item-inkproj.png",
  "item-vr-coin.png",
  "obj-door.png",
  "obj-ponto.png",
  "tile-floor.png",
];

/** Diretórios de saída possíveis (nitro `.output/public` e/ou `dist`). */
const OUT_DIRS = [join(ROOT, ".output", "public"), join(ROOT, "dist")];

function prune(outDir) {
  const dir = join(outDir, "assets", "sprites");
  if (!existsSync(dir)) return null;
  const keep = new Set(KEEP);
  let removed = 0;
  let bytes = 0;
  for (const name of readdirSync(dir)) {
    if (keep.has(name)) continue;
    const p = join(dir, name);
    bytes += statSync(p).size;
    rmSync(p, { recursive: true, force: true });
    removed++;
  }
  return { dir, removed, bytes, kept: readdirSync(dir).length };
}

if (import.meta.main) {
  let any = false;
  for (const out of OUT_DIRS) {
    const r = prune(out);
    if (!r) continue;
    any = true;
    const mb = (r.bytes / 1024 / 1024).toFixed(1);
    console.log(`✓ poda: ${r.removed} arquivos (${mb}MB) de ${r.dir} · mantidos ${r.kept}`);
  }
  if (!any) console.log("· poda: nenhum diretório de saída encontrado (build não rodou?)");
}
