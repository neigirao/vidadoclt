// ─────────────────────────────────────────────────────────────────────────────
// MATA A ASSINATURA DE IA: quantiza paleta + endurece alpha (`bun palette:fix`)
//
// O DIAGNÓSTICO (medido, não suposto): geradores de imagem produzem uma
// ilustração grande e REDUZEM. O resultado tem quase uma cor por pixel e bordas
// com halo semi-transparente — o oposto de pixel art, que é paleta curta e borda
// dura. Dá pra medir com uma razão simples:
//
//     ratio = cores_únicas / pixels_opacos
//
// Varredura do atlas (2970 frames): 86% está em ratio <= 0.15 (pixel art de
// verdade, 19–29 cores) e 14% (402 frames) está acima de 0.5. Exemplos:
//     player-idle1        19 cores / 1483 px  = 0.01  ✓ pixel art
//     player-attack0     974 cores / 1049 px  = 0.93  ✗ ilustração reduzida
//     enemy-senior-walk0 1308 cores / 1556 px = 0.84  ✗
//     boss-ceo-idle0     1127 cores / 1144 px = 0.98  ✗
//
// Ou seja: o golpe do player e o andar do Sênior — duas das animações mais
// vistas — não são pixel art. É por isso que "parece IA" mesmo com 86% do atlas
// sendo bom. O defeito é CONCENTRADO, e o conserto é determinístico.
//
// COMO CONSERTA: deriva UMA paleta por família (median-cut determinístico sobre
// os frames inchados dela) e mapeia cada pixel para a cor mais próxima, com peso
// de luminância. A paleta é COMPARTILHADA entre os frames da família — é isso que
// evita cintilação de cor de um frame para o outro. Depois passa um de-speckle
// (nenhum pixel órfão, regra de ouro de pixel art), porque mapear gradiente para
// paleta curta espalha pixel avulso, e isso lê como sujeira.
//
// ALPHA: pixel semi-transparente vira opaco ou some (limiar). Halo de
// reamostragem é a segunda assinatura de downscale — medido, os suspeitos têm
// 6.0% de semi-transparência contra 3.9% do resto, e os frames feitos à mão
// (player-idle1, tile-floor) têm 0.0%.
//
// SEGURANÇA: só toca em frames acima de BLOATED (não mexe nos 86% que já estão
// bons), preserva o formato/dimensão, e é determinístico (mesmo input = mesmo
// byte). `--dry` mostra o plano sem gravar.
//
// Uso: node scripts/palette-fix.mjs [--dry] [--only=prefixo] [--colors=N] [--ref]
// ─────────────────────────────────────────────────────────────────────────────
import sharp from "sharp";
import { readdirSync } from "node:fs";

const SPRITES = "public/assets/sprites";
const dry = process.argv.includes("--dry");
const onlyArg = process.argv.find((a) => a.startsWith("--only="));
const only = onlyArg ? onlyArg.split("=")[1] : null;
const colorsArg = process.argv.find((a) => a.startsWith("--colors="));
// --ref usa a paleta canônica dos frames LIMPOS da família em vez da paleta
// derivada dos próprios frames inchados. NÃO é o padrão: testado lado a lado, o
// golpe do player forçado à paleta do walk ficou com as pernas embarradas — um
// golpe é iluminado diferente de um andar, e importar o tom de outra pose troca
// um defeito por outro. O padrão preserva a iluminação da pose e só ACHATA a
// paleta, que é o que mata a assinatura de IA. Medido no player-attack:
//   ratio 0.78–0.93 → 0.02–0.03 (o limiar de "pixel art" é 0.15; o idle1 é 0.01)
//   semi-transparência 23–25% → 0.0% (igual aos frames feitos à mão)
const usarRef = process.argv.includes("--ref");

/** Acima disto o frame é ilustração reduzida, não pixel art → consertar. */
const BLOATED = 0.5;
/** Abaixo disto o frame é pixel art de verdade → serve de REFERÊNCIA. */
const CLEAN = 0.15;
/** Alvo de cores quando a família não tem nenhum frame limpo (caminho b). */
const TARGET_COLORS = colorsArg ? +colorsArg.split("=")[1] : 24;
/** Alpha: >= vira opaco, < some. Borda dura é o que define pixel art. */
const ALPHA_CUT = 128;
/** Frame com menos opacos que isto é pequeno/vazio demais p/ julgar — não toca. */
const MIN_OPACOS = 40;
/** Se endurecer o alpha apagaria mais que isto dos pixels opacos, o asset é
 *  SUAVE de propósito (brilho, fantasma, sombra) e não é pixel art de borda dura.
 *  Endurecer destruiria conteúdo. Pego na prática: `tile-fase5-01` tem 32 pixels
 *  opacos e 44% deles abaixo do limiar — virou tile vazio e o pack-atlas acusou. */
const MAX_PERDA_ALPHA = 0.2;

async function load(file) {
  const { data, info } = await sharp(`${SPRITES}/${file}`)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
}

/** cores únicas / pixels opacos — a medida que separa pixel art de downscale. */
function stats({ data }) {
  const s = new Set();
  let op = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 16) continue;
    op++;
    s.add((data[i] << 16) | (data[i + 1] << 8) | data[i + 2]);
  }
  return { cores: s.size, op, ratio: op ? s.size / op : 0 };
}

/** Median cut determinístico: divide o espaço de cor pelo canal de maior faixa,
 *  sempre na mediana, até ter `n` caixas. A cor de cada caixa é a média dela.
 *  Determinístico de propósito — o mesmo atlas tem que dar o mesmo byte. */
function medianCut(pixels, n) {
  let boxes = [pixels];
  while (boxes.length < n) {
    // Divide a caixa com a maior faixa de cor (a que mais "cabe" ser dividida).
    let bi = -1;
    let best = -1;
    for (let i = 0; i < boxes.length; i++) {
      if (boxes[i].length < 2) continue;
      const r = range(boxes[i]);
      if (r.span > best) {
        best = r.span;
        bi = i;
      }
    }
    if (bi < 0) break;
    const ch = range(boxes[bi]).ch;
    const sorted = [...boxes[bi]].sort((a, b) => a[ch] - b[ch]);
    const mid = sorted.length >> 1;
    boxes.splice(bi, 1, sorted.slice(0, mid), sorted.slice(mid));
  }
  return boxes
    .filter((b) => b.length)
    .map((b) => {
      const s = [0, 0, 0];
      for (const p of b) {
        s[0] += p[0];
        s[1] += p[1];
        s[2] += p[2];
      }
      return [
        Math.round(s[0] / b.length),
        Math.round(s[1] / b.length),
        Math.round(s[2] / b.length),
      ];
    });
}

function range(box) {
  const lo = [255, 255, 255];
  const hi = [0, 0, 0];
  for (const p of box)
    for (let c = 0; c < 3; c++) {
      if (p[c] < lo[c]) lo[c] = p[c];
      if (p[c] > hi[c]) hi[c] = p[c];
    }
  let ch = 0;
  let span = -1;
  for (let c = 0; c < 3; c++)
    if (hi[c] - lo[c] > span) {
      span = hi[c] - lo[c];
      ch = c;
    }
  return { ch, span };
}

/** DE-SPECKLE: tira pixel órfão (regra de ouro de pixel art — nenhum pixel solto
 *  no meio de uma área chapada). Mapear um gradiente suave para uma paleta curta
 *  espalha pixels avulsos, e isso lê como SUJEIRA, não como dithering. Um pixel
 *  cuja cor não aparece em nenhum vizinho, mas tem uma cor dominante em volta,
 *  vira essa dominante. Só age em pixel ISOLADO, então detalhe legítimo de 2+
 *  pixels (olho, botão, brilho) sobrevive. Iterativo: 2 passadas bastam. */
function despeckle(d, w, h, passes = 2) {
  const at = (x, y) => (y * w + x) * 4;
  for (let p = 0; p < passes; p++) {
    const src = Buffer.from(d);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = at(x, y);
        if (src[i + 3] === 0) continue;
        const me = (src[i] << 16) | (src[i + 1] << 8) | src[i + 2];
        const cont = new Map();
        let iguais = 0;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            const j = at(x + dx, y + dy);
            if (src[j + 3] === 0) continue;
            const k = (src[j] << 16) | (src[j + 1] << 8) | src[j + 2];
            if (k === me) iguais++;
            cont.set(k, (cont.get(k) ?? 0) + 1);
          }
        if (iguais > 0) continue; // não está isolado → é detalhe, preserva
        let dom = -1;
        let n = 0;
        for (const [k, c] of cont) if (c > n) ((n = c), (dom = k));
        if (dom < 0 || n < 5) continue; // sem maioria clara → preserva
        d[i] = (dom >> 16) & 255;
        d[i + 1] = (dom >> 8) & 255;
        d[i + 2] = dom & 255;
      }
    }
  }
}

function nearest(pal, r, g, b) {
  let bi = 0;
  let bd = Infinity;
  for (let i = 0; i < pal.length; i++) {
    const dr = pal[i][0] - r;
    const dg = pal[i][1] - g;
    const db = pal[i][2] - b;
    // Pesos de luminância: o olho é mais sensível ao verde. Casar por distância
    // RGB crua trocava tons de pele por tons de roupa em sprites escuros.
    const d = dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11;
    if (d < bd) {
      bd = d;
      bi = i;
    }
  }
  return pal[bi];
}

// ── Agrupa os PNGs por PERSONAGEM (prefixo sem estado/índice) ────────────────
const files = readdirSync(SPRITES).filter((f) => f.endsWith(".png"));
const fam = {};
const soltos = [];
for (const f of files) {
  const m = f.match(/^(.*?)-(idle|walk|run|attack|hurt|death|special|jump|fall|dash)\d+\.png$/);
  if (m) {
    (fam[m[1]] = fam[m[1]] || []).push(f);
    continue;
  }
  soltos.push(f);
}

// Objetos de cenário usam estado NOMEADO e livre (`obj-porta-saida-aberta`,
// `obj-elevador-subindo`, `obj-relogio-late`). Enumerar as palavras de estado não
// escala. Regra: tira o ÚLTIMO segmento; se o prefixo resultante é compartilhado
// por 2+ arquivos, ele é a família (e os estados dividem a paleta, que é o que
// evita o objeto mudar de cor ao trocar de estado). Senão, o arquivo é família de
// 1 — ainda perde o inchaço, só não compartilha paleta com irmãos.
const cand = {};
for (const f of soltos) {
  const base = f.replace(/\.png$/, "");
  const seg = base.split("-");
  if (seg.length >= 3)
    cand[seg.slice(0, -1).join("-")] = (cand[seg.slice(0, -1).join("-")] ?? 0) + 1;
}
for (const f of soltos) {
  const base = f.replace(/\.png$/, "");
  const seg = base.split("-");
  const pref = seg.slice(0, -1).join("-");
  const key = seg.length >= 3 && cand[pref] >= 2 ? pref : base;
  (fam[key] = fam[key] || []).push(f);
}

let tocados = 0;
const avisos = [];
let familias = 0;
const relatorio = [];

for (const [prefix, lista] of Object.entries(fam)) {
  if (only && !prefix.includes(only)) continue;

  const carregados = [];
  for (const f of lista) {
    const img = await load(f);
    carregados.push({ f, img, st: stats(img) });
  }

  // Guardas: nunca deixar o conserto DESTRUIR conteúdo.
  const pulados = [];
  const inchados = carregados.filter((c) => {
    if (c.st.ratio <= BLOATED) return false;
    if (c.st.op < MIN_OPACOS) {
      pulados.push(`${c.f} (só ${c.st.op} px opacos)`);
      return false;
    }
    let perde = 0;
    for (let i = 0; i < c.img.data.length; i += 4) {
      const a = c.img.data[i + 3];
      if (a >= 16 && a < ALPHA_CUT) perde++;
    }
    if (perde / c.st.op > MAX_PERDA_ALPHA) {
      pulados.push(`${c.f} (asset suave: ${Math.round((perde / c.st.op) * 100)}% sumiria)`);
      return false;
    }
    return true;
  });
  if (pulados.length) for (const p of pulados) avisos.push(`  ⚠ pulado ${p}`);
  if (!inchados.length) continue;
  const limpos = carregados.filter((c) => c.st.ratio <= CLEAN);

  // (a) paleta canônica dos frames limpos | (b) median-cut da família inteira
  let pal;
  let via;
  if (limpos.length && usarRef) {
    const set = new Map();
    for (const c of limpos)
      for (let i = 0; i < c.img.data.length; i += 4) {
        if (c.img.data[i + 3] < ALPHA_CUT) continue;
        const k = (c.img.data[i] << 16) | (c.img.data[i + 1] << 8) | c.img.data[i + 2];
        set.set(k, (set.get(k) ?? 0) + 1);
      }
    // Ordena por frequência: descarta ruído de 1 pixel, mantém as cores que
    // realmente desenham o personagem.
    pal = [...set.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 48)
      .map(([k]) => [(k >> 16) & 255, (k >> 8) & 255, k & 255]);
    via = `--ref: paleta de ${limpos.length} frame(s) limpo(s) → ${pal.length} cores`;
  } else {
    // Amostra de TODOS os frames da família, não só dos inchados. Se um estado
    // limpo ficar de fora, a paleta nova não conhece as cores dele e a família
    // DIVERGE: pego na prática — quantizar idle/walk do CEO sem olhar o `run`
    // (que já estava limpo) fez o `run` virar "cor estrangeira" no audit:palette.
    // Os frames limpos ainda dominam a amostra por volume, o que ancora a paleta
    // na arte boa. A ESCRITA continua só nos inchados.
    const amostra = [];
    for (const c of carregados)
      for (let i = 0; i < c.img.data.length; i += 4) {
        if (c.img.data[i + 3] < ALPHA_CUT) continue;
        amostra.push([c.img.data[i], c.img.data[i + 1], c.img.data[i + 2]]);
      }
    pal = medianCut(amostra, TARGET_COLORS);
    via = `median-cut da própria família → ${pal.length} cores`;
  }
  if (!pal.length) continue;

  familias++;
  const antes = inchados.reduce((a, c) => a + c.st.cores, 0) / inchados.length;
  relatorio.push(
    `  • ${prefix.padEnd(24)} ${String(inchados.length).padStart(3)} frame(s)  ${Math.round(antes)} cores → ${pal.length}  (${via})`,
  );

  if (dry) {
    tocados += inchados.length;
    continue;
  }

  for (const c of inchados) {
    const d = Buffer.from(c.img.data);
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < ALPHA_CUT) {
        d[i + 3] = 0; // borda dura: sem halo semi-transparente
        continue;
      }
      d[i + 3] = 255;
      const [r, g, b] = nearest(pal, d[i], d[i + 1], d[i + 2]);
      d[i] = r;
      d[i + 1] = g;
      d[i + 2] = b;
    }
    despeckle(d, c.img.w, c.img.h);
    await sharp(d, { raw: { width: c.img.w, height: c.img.h, channels: 4 } })
      .png()
      .toFile(`${SPRITES}/${c.f}`);
    tocados++;
  }
}

console.log(`Famílias com frames inchados (ratio > ${BLOATED}): ${familias}\n`);
for (const l of relatorio) console.log(l);
if (avisos.length) {
  console.log(`\nPulados por guarda (${avisos.length}) — conserto destruiria conteúdo:`);
  for (const a of avisos.slice(0, 12)) console.log(a);
}
console.log(`\n${tocados} frame(s) ${dry ? "seriam quantizados" : "quantizados"}.`);
if (dry) console.log("(--dry) nada foi gravado.");
else if (tocados) console.log("Rode: node scripts/pack-atlas.mjs");
