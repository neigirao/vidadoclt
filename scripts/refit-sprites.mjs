#!/usr/bin/env node
/**
 * refit-sprites.mjs
 *
 * Corrige sprites cujo desenho está mal posicionado dentro do próprio canvas
 * (resíduo de scripts de extração com coordenadas levemente erradas).
 *
 * Estratégia segura — não regera arte, apenas reposiciona:
 *   1) Detecta a bounding box dos pixels opacos (alpha > 32).
 *   2) Se a bbox é menor que ~85% do canvas E está descentralizada
 *      (offset > 2 px do centro horizontal ou >2px da base), re-cola
 *      o recorte centralizado horizontalmente, alinhado à base vertical.
 *   3) Frames com cobertura alpha < 2% (quase vazios) são substituídos
 *      por uma cópia do irmão `-idle0` da mesma entidade — com tint
 *      vermelho (hurt) ou cinza (death) quando aplicável.
 *
 * Escopo: só PNGs ≤ 200x200 dentro de public/assets/sprites/ (ignora _sources).
 */
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

const ROOT = "public/assets/sprites";

function loadPng(p) {
  return PNG.sync.read(fs.readFileSync(p));
}
function savePng(p, png) {
  fs.writeFileSync(p, PNG.sync.write(png));
}

/** bounding box dos pixels opacos (alpha > 32). null se vazio. */
function bbox(png) {
  const { width: w, height: h, data } = png;
  let minX = w, minY = h, maxX = -1, maxY = -1, opaque = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const a = data[(y * w + x) * 4 + 3];
      if (a > 32) {
        opaque++;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return { empty: true, opaque: 0, coverage: 0 };
  return {
    empty: false,
    minX, minY, maxX, maxY,
    bw: maxX - minX + 1,
    bh: maxY - minY + 1,
    opaque,
    coverage: opaque / (w * h),
  };
}

/** copia região (sx,sy,sw,sh) do src para (dx,dy) no dst. */
function blit(src, dst, sx, sy, sw, sh, dx, dy) {
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      const ssx = sx + x, ssy = sy + y;
      const ddx = dx + x, ddy = dy + y;
      if (ddx < 0 || ddy < 0 || ddx >= dst.width || ddy >= dst.height) continue;
      const si = (ssy * src.width + ssx) * 4;
      const di = (ddy * dst.width + ddx) * 4;
      dst.data[di] = src.data[si];
      dst.data[di + 1] = src.data[si + 1];
      dst.data[di + 2] = src.data[si + 2];
      dst.data[di + 3] = src.data[si + 3];
    }
  }
}

function makeEmpty(w, h) {
  const png = new PNG({ width: w, height: h });
  png.data.fill(0);
  return png;
}

/** Aplica tint multiplicativo + redução de saturação. */
function tintCopy(src, mode /* "hurt" | "death" */) {
  const out = new PNG({ width: src.width, height: src.height });
  out.data = Buffer.from(src.data);
  for (let i = 0; i < out.data.length; i += 4) {
    const a = out.data[i + 3];
    if (a === 0) continue;
    let r = out.data[i], g = out.data[i + 1], b = out.data[i + 2];
    if (mode === "hurt") {
      // empurra para vermelho
      r = Math.min(255, r * 1.3 + 60);
      g = Math.floor(g * 0.4);
      b = Math.floor(b * 0.4);
    } else if (mode === "death") {
      const gray = (r * 0.3 + g * 0.59 + b * 0.11) | 0;
      r = (gray * 0.7) | 0;
      g = (gray * 0.7) | 0;
      b = (gray * 0.7) | 0;
      out.data[i + 3] = Math.floor(a * 0.85);
    }
    out.data[i] = r; out.data[i + 1] = g; out.data[i + 2] = b;
  }
  return out;
}

const files = fs.readdirSync(ROOT)
  .filter((f) => f.endsWith(".png"))
  .filter((f) => fs.statSync(path.join(ROOT, f)).isFile());

let refit = 0, replaced = 0, skipped = 0, untouched = 0;
const log = [];

// indexa siblings por entidade para fallback
const byEntity = new Map();
for (const f of files) {
  const base = f.replace(/\.png$/, "");
  const m = base.match(/^(.*?)-(idle|walk|attack|hurt|death|run|special)\d*$/);
  if (!m) continue;
  const ent = m[1];
  if (!byEntity.has(ent)) byEntity.set(ent, {});
  const states = byEntity.get(ent);
  if (!states[m[2]]) states[m[2]] = [];
  states[m[2]].push(f);
}

for (const f of files) {
  const full = path.join(ROOT, f);
  let png;
  try { png = loadPng(full); } catch { continue; }
  const { width: w, height: h } = png;
  if (w > 200 || h > 200) { skipped++; continue; }  // ignora sheets

  const bb = bbox(png);
  if (bb.empty || bb.coverage < 0.02) {
    // tenta substituir por idle0 do mesmo grupo
    const base = f.replace(/\.png$/, "");
    const m = base.match(/^(.*?)-(idle|walk|attack|hurt|death|run|special)\d*$/);
    if (m) {
      const ent = m[1], state = m[2];
      const idleList = byEntity.get(ent)?.idle;
      const idle0 = idleList?.find((n) => n === `${ent}-idle0.png`) || idleList?.[0];
      if (idle0 && idle0 !== f) {
        const idlePng = loadPng(path.join(ROOT, idle0));
        if (idlePng.width === w && idlePng.height === h) {
          const tinted = state === "hurt"
            ? tintCopy(idlePng, "hurt")
            : state === "death"
            ? tintCopy(idlePng, "death")
            : idlePng;
          savePng(full, tinted);
          replaced++;
          log.push(`REPLACED ${f} <- ${idle0} (${state})`);
          continue;
        }
      }
    }
    skipped++;
    log.push(`SKIP-EMPTY ${f} cov=${bb.coverage?.toFixed(3)}`);
    continue;
  }

  // Refit se a bbox é pequena demais OU significativamente descentralizada
  const fillW = bb.bw / w;
  const fillH = bb.bh / h;
  const cx = (bb.minX + bb.maxX) / 2;
  const cy = (bb.minY + bb.maxY) / 2;
  const offX = Math.abs(cx - w / 2);
  const baseGap = h - bb.maxY - 1;       // distância da base do desenho ao fundo do canvas
  const needCenter = offX > 3;
  const needBase   = baseGap > 4 && bb.bh < h * 0.85;

  if (!needCenter && !needBase && fillW > 0.4 && fillH > 0.5) {
    untouched++;
    continue;
  }

  // Constrói novo canvas centralizando horizontalmente, alinhando à base
  const out = makeEmpty(w, h);
  const targetX = Math.floor((w - bb.bw) / 2);
  // mantém alinhamento à base do canvas (chão), padding de 2 px
  const targetY = h - bb.bh - 2;
  blit(png, out, bb.minX, bb.minY, bb.bw, bb.bh, targetX, Math.max(0, targetY));
  savePng(full, out);
  refit++;
  log.push(`REFIT ${f} bbox=${bb.bw}x${bb.bh} off=(${offX.toFixed(0)},${baseGap})`);
}

console.log(`\nRefit done: ${refit} refitted, ${replaced} replaced (sibling), ${untouched} untouched, ${skipped} skipped/sheets.`);
if (process.argv.includes("--verbose")) {
  console.log("\n--- log ---");
  for (const l of log) console.log(l);
}
