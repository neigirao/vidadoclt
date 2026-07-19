// ─────────────────────────────────────────────────────────────────────────────
// Slicer de FOLHAS-FONTE → frames individuais (recorte por projeção de alpha).
//
// As folhas em `_sources/` são character sheets rotuladas (IDLE/WALK/ATTACK…) com
// fundo transparente e frames numerados. O recorte automático original saiu
// torto (frames trocados/vazios). Aqui re-fatiamos de forma DETERMINÍSTICA:
//
//   1. Projeção horizontal do alpha → acha as BANDAS de conteúdo (linhas de
//      personagens), separadas por faixas vazias (texto de rótulo tem alpha baixo
//      e vira banda fina → descartada por altura mínima).
//   2. Dentro de cada banda, projeção vertical → segmenta em COLUNAS (frames) por
//      vãos vazios. Números sob cada frame ficam na mesma coluna (ok, trimados).
//   3. Cada segmento é trimado ao conteúdo e reescalado p/ o frame-alvo (fit
//      contain, alpha) alinhando os PÉS à base (baseline) — sem "flutuar".
//
// NÃO escreve nada por padrão: gera um PREVIEW (grid rotulado) p/ conferência.
// Só grava em sprites/ com --write e um MAPA de bandas→ação (config abaixo).
//
// Uso:
//   node scripts/slice-sheet.mjs <fonte.png> --preview [--minband=100] [--gap=6]
//   node scripts/slice-sheet.mjs <fonte.png> --write --map=player   (usa SHEET_MAPS)
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { PNG } from "pngjs";
import sharp from "sharp";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SPRITES = resolve(__dirname, "../public/assets/sprites");

const ALPHA_MIN = 24; // pixel conta como "conteúdo" se alpha > isto
const args = process.argv.slice(2);
const srcPath = args.find((a) => !a.startsWith("--"));
const opt = (name, def) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.split("=")[1] : def;
};
const MIN_BAND = Number(opt("minband", 100)); // altura mínima de banda de personagem
const GAP = Number(opt("gap", 5)); // linhas/colunas vazias que fecham um segmento
const WRITE = args.includes("--write");
const PREVIEW = args.includes("--preview") || !WRITE;

if (!srcPath) {
  console.error("Uso: node scripts/slice-sheet.mjs <fonte.png> [--preview|--write --map=<id>]");
  process.exit(1);
}

// ── Carrega alpha + versão LIMPA (fundo→transparente) ─────────────────────────
async function loadAlpha(path) {
  // normaliza p/ RGBA via sharp (algumas fontes são 3ch → alpha=255 em tudo,
  // então usamos luma-contra-fundo se não houver alpha real).
  const { data, info } = await sharp(path)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels } = info;
  const alpha = new Uint8Array(w * h);
  let hasRealAlpha = false;
  for (let i = 0; i < w * h; i++) {
    const a = data[i * channels + 3];
    alpha[i] = a;
    if (a < 250) hasRealAlpha = true;
  }
  // Fallback: sem alpha real → detecta o fundo por cor. Dois modos:
  //  `graymid` — fundo é cinza NEUTRO de luminância média (o "xadrez"/gradiente
  //     achatado de folhas com transparência falsa). Personagem é escuro/colorido.
  //  `dark` (default) — fundo é a cor do canto (sólido escuro); conteúdo = o que
  //     difere dela por um limiar.
  const bgMode = opt("bg", hasRealAlpha ? "alpha" : "dark");
  if (bgMode === "graymid") {
    const LO = Number(opt("glo", 95)),
      HI = Number(opt("ghi", 172)),
      NEU = Number(opt("neu", 16));
    for (let i = 0; i < w * h; i++) {
      const r = data[i * channels],
        g = data[i * channels + 1],
        b = data[i * channels + 2];
      const mx = Math.max(r, g, b),
        mn = Math.min(r, g, b);
      const lum = (r + g + b) / 3;
      const isBg = mx - mn <= NEU && lum >= LO && lum <= HI;
      alpha[i] = isBg ? 0 : 255;
    }
  } else if (bgMode === "dark") {
    const br = data[0],
      bg = data[1],
      bb = data[2];
    for (let i = 0; i < w * h; i++) {
      const dr = data[i * channels] - br;
      const dg = data[i * channels + 1] - bg;
      const db = data[i * channels + 2] - bb;
      alpha[i] = dr * dr + dg * dg + db * db > 900 ? 255 : 0;
    }
  }
  // Fonte LIMPA: aplica a máscara como alpha real (bg → transparente). É dela
  // que extraímos os frames, pra não carregar o cinza/escuro do fundo.
  const clean = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    clean[i * 4] = data[i * channels];
    clean[i * 4 + 1] = data[i * channels + 1];
    clean[i * 4 + 2] = data[i * channels + 2];
    clean[i * 4 + 3] = bgMode === "alpha" ? data[i * channels + 3] : alpha[i];
  }
  return { alpha, w, h, clean };
}

// Remove componentes conexos PEQUENOS de um buffer RGBA (bg transparente).
// Serve pra tirar números/rótulos soltos que sobram no recorte de uma célula:
// mantém o maior componente (personagem) + qualquer outro com área >= frac do
// maior (itens presos como maleta/arma). Zera o alpha do resto. Genérico → vale
// pra qualquer folha, sem calibrar Y célula a célula.
function keepLargeComponents(buf, w, h, frac = 0.12) {
  const N = w * h;
  const label = new Int32Array(N).fill(-1);
  const stack = [];
  const comps = []; // {id, area}
  for (let start = 0; start < N; start++) {
    if (buf[start * 4 + 3] <= 24 || label[start] !== -1) continue;
    const id = comps.length;
    let area = 0,
      x0 = w,
      y0 = h,
      x1 = 0,
      y1 = 0;
    stack.push(start);
    label[start] = id;
    while (stack.length) {
      const p = stack.pop();
      area++;
      const px = p % w,
        py = (p - px) / w;
      if (px < x0) x0 = px;
      if (px > x1) x1 = px;
      if (py < y0) y0 = py;
      if (py > y1) y1 = py;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nx = px + dx,
          ny = py + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const q = ny * w + nx;
        if (label[q] === -1 && buf[q * 4 + 3] > 24) {
          label[q] = id;
          stack.push(q);
        }
      }
    }
    comps.push({ id, area, bw: x1 - x0 + 1, bh: y1 - y0 + 1 });
  }
  if (!comps.length) return buf;
  const maxArea = Math.max(...comps.map((c) => c.area));
  const keep = new Set(
    comps
      .filter((c) => {
        if (c.area < maxArea * frac) return false; // muito pequeno (glifo/ponto)
        // régua/separador: traço fino que atravessa quase toda a largura/altura
        if (c.bh <= 8 && c.bw >= w * 0.55) return false; // linha horizontal
        if (c.bw <= 8 && c.bh >= h * 0.55) return false; // linha vertical
        return true;
      })
      .map((c) => c.id),
  );
  for (let p = 0; p < N; p++) if (!keep.has(label[p])) buf[p * 4 + 3] = 0;
  return buf;
}

// Segmenta um índice 1D (perfil) em intervalos [start,end) onde valor>0,
// fechando quando há `gap` zeros consecutivos.
function segments(profile, gap, minRun) {
  const out = [];
  let start = -1,
    zeros = 0;
  for (let i = 0; i < profile.length; i++) {
    if (profile[i] > 0) {
      if (start < 0) start = i;
      zeros = 0;
    } else if (start >= 0) {
      if (++zeros >= gap) {
        out.push([start, i - zeros + 1]);
        start = -1;
      }
    }
  }
  if (start >= 0) out.push([start, profile.length]);
  return out.filter(([s, e]) => e - s >= minRun);
}

function main() {
  return loadAlpha(srcPath).then(async ({ alpha, w, h, clean }) => {
    // sharp source já limpo (bg transparente) p/ extração
    const cleanSharp = () => sharp(clean, { raw: { width: w, height: h, channels: 4 } });
    // Corta um bloco em N frames INDIVIDUAIS: parte da divisão uniforme (chute)
    // e desliza cada fronteira para o VALE mais próximo da projeção de coluna (a
    // emenda entre dois personagens, onde há menos pixels) — assim o corte encaixa
    // na costura e nunca fatia um personagem no meio, mesmo com espaçamento irregular.
    const frameRanges = (blk) => {
      // Projeção de coluna do bloco.
      const colSum = new Int32Array(w);
      for (let x = 0; x < w; x++) {
        let s = 0;
        for (let y = blk.y0; y < blk.y1; y++) s += alpha[y * w + x] > ALPHA_MIN ? 1 : 0;
        colSum[x] = s;
      }
      // AUTO-TRIM horizontal: acha a 1ª/última coluna com conteúdo real dentro do
      // x0..x1 declarado → remove o espaço morto do chute manual (a causa do drift
      // que fatiava frames). A divisão uniforme parte das bordas VERDADEIRAS.
      let lo = blk.x1,
        hi = blk.x0;
      for (let x = blk.x0; x < blk.x1; x++)
        if (colSum[x] > 2) {
          if (x < lo) lo = x;
          if (x > hi) hi = x;
        }
      if (hi <= lo) return Array.from({ length: blk.n }, (_, i) => [blk.x0 + i, blk.x0 + i + 1]);
      hi += 1;
      const cellW = (hi - lo) / blk.n;
      // Divisão uniforme dentro das bordas reais + snap GENTIL ao vale (só corrige
      // desalinho fino; janela pequena não pula pro vão interno corpo×maleta).
      const win = Math.min(10, Math.round(cellW * 0.12));
      const bounds = [lo];
      for (let i = 1; i < blk.n; i++) {
        const guess = Math.round(lo + i * cellW);
        let best = guess,
          bestVal = Infinity;
        for (let x = Math.max(lo + 2, guess - win); x <= Math.min(hi - 2, guess + win); x++) {
          if (colSum[x] < bestVal) {
            bestVal = colSum[x];
            best = x;
          }
        }
        bounds.push(best);
      }
      bounds.push(hi);
      return Array.from({ length: blk.n }, (_, i) => [bounds[i], bounds[i + 1]]);
    };
    // Extrai uma célula do grid, remove números/rótulos soltos (CC) e trima ao
    // personagem. Devolve um PNG buffer (ou null se vazio).
    const cellPng = async (left, top, cw, ch) => {
      const raw = await cleanSharp()
        .extract({ left, top, width: cw, height: ch })
        .raw()
        .toBuffer()
        .catch(() => null);
      if (!raw) return null;
      keepLargeComponents(raw, cw, ch, Number(opt("frac", 0.12)));
      return sharp(raw, { raw: { width: cw, height: ch, channels: 4 } })
        .trim({ threshold: 10 })
        .png()
        .toBuffer()
        .catch(() => null);
    };
    // Perfil horizontal: soma de alpha por linha, binarizada por um limiar de
    // COBERTURA (fração da largura) — separadores finos e texto esparso ficam
    // abaixo do limiar e viram "vazio", só linhas de personagem passam.
    const rowThresh = Math.max(6, Math.round(w * Number(opt("rowcov", 0.03))));
    const rowSum = new Int32Array(h);
    for (let y = 0; y < h; y++) {
      let s = 0;
      for (let x = 0; x < w; x++) s += alpha[y * w + x] > ALPHA_MIN ? 1 : 0;
      rowSum[y] = s > rowThresh ? s : 0;
    }
    const bands = segments(rowSum, GAP * 3, MIN_BAND);

    // Para cada banda, segmenta colunas.
    const frames = []; // {band, col, x0,y0,x1,y1}
    bands.forEach((band, bi) => {
      const [y0, y1] = band;
      const colThresh = Math.max(2, Math.round((y1 - y0) * Number(opt("colcov", 0.04))));
      const colSum = new Int32Array(w);
      for (let x = 0; x < w; x++) {
        let s = 0;
        for (let y = y0; y < y1; y++) s += alpha[y * w + x] > ALPHA_MIN ? 1 : 0;
        colSum[x] = s > colThresh ? s : 0;
      }
      const cols = segments(colSum, GAP, 12);
      cols.forEach(([x0, x1], ci) => {
        // trim vertical dentro do segmento
        let ty0 = y1,
          ty1 = y0;
        for (let y = y0; y < y1; y++)
          for (let x = x0; x < x1; x++)
            if (alpha[y * w + x] > ALPHA_MIN) {
              if (y < ty0) ty0 = y;
              if (y > ty1) ty1 = y;
            }
        if (ty1 >= ty0) frames.push({ band: bi, col: ci, x0, y0: ty0, x1, y1: ty1 + 1 });
      });
    });

    console.log(`${bands.length} bandas, ${frames.length} frames detectados:`);
    bands.forEach((b, i) => {
      const n = frames.filter((f) => f.band === i).length;
      console.log(`  banda ${i}: y=${b[0]}..${b[1]} (h=${b[1] - b[0]})  →  ${n} frames`);
    });

    if (PREVIEW && !opt("map", "")) {
      const SP = resolve(process.cwd(), "scratchpad_preview");
      mkdirSync(SP, { recursive: true });
      const cell = 96;
      const perRow = Math.max(...bands.map((_, i) => frames.filter((f) => f.band === i).length));
      const rows = bands.length;
      const comps = [];
      for (const f of frames) {
        const buf = await cleanSharp()
          .extract({ left: f.x0, top: f.y0, width: f.x1 - f.x0, height: f.y1 - f.y0 })
          .resize(cell - 6, cell - 6, {
            fit: "contain",
            background: { r: 0, g: 0, b: 0, alpha: 0 },
          })
          .png()
          .toBuffer();
        comps.push({ input: buf, top: f.band * cell + 3, left: f.col * cell + 3 });
      }
      const outPng = resolve(SP, "slice_preview.png");
      await sharp({
        create: {
          width: perRow * cell,
          height: rows * cell,
          channels: 4,
          background: { r: 25, g: 25, b: 35, alpha: 1 },
        },
      })
        .composite(comps)
        .png()
        .toFile(outPng);
      console.log(`\nPREVIEW → ${outPng}  (${perRow * cell}x${rows * cell})`);
    }

    // Grid-preview a partir do MAPA (sem gravar): confere geometria dos blocos.
    if (!WRITE && opt("map", "")) {
      const map = SHEET_MAPS[opt("map", "")];
      const SP = resolve(process.cwd(), "scratchpad_preview");
      mkdirSync(SP, { recursive: true });
      const cell = 90;
      const maxN = Math.max(...map.blocks.map((b) => b.n));
      const comps = [];
      for (let r = 0; r < map.blocks.length; r++) {
        const blk = map.blocks[r];
        const ranges = frameRanges(blk);
        for (let i = 0; i < blk.n; i++) {
          const [rx0, rx1] = ranges[i];
          const png = await cellPng(rx0, blk.y0, rx1 - rx0, blk.y1 - blk.y0);
          if (!png) continue;
          const buf = await sharp(png)
            .resize(cell - 6, cell - 6, {
              fit: "contain",
              background: { r: 0, g: 0, b: 0, alpha: 0 },
            })
            .png()
            .toBuffer();
          comps.push({ input: buf, top: r * cell + 3, left: i * cell + 3 });
        }
      }
      await sharp({
        create: {
          width: maxN * cell,
          height: map.blocks.length * cell,
          channels: 4,
          background: { r: 25, g: 25, b: 35, alpha: 1 },
        },
      })
        .composite(comps)
        .png()
        .toFile(resolve(SP, "grid_preview.png"));
      console.log(`GRID PREVIEW → ${resolve(SP, "grid_preview.png")}`);
      return;
    }

    if (WRITE) {
      const mapId = opt("map", "");
      const map = SHEET_MAPS[mapId];
      if (!map) {
        console.error(
          `--map=${mapId} não encontrado em SHEET_MAPS. IDs: ${Object.keys(SHEET_MAPS).join(", ")}`,
        );
        process.exit(1);
      }
      const onlyAction = opt("action", ""); // limita a gravação a 1 bloco
      let written = 0;
      // GRID FIXO: cada bloco {action,x0,y0,x1,y1,n} é dividido em n células
      // iguais (frames empacotados lado-a-lado sem vão → projeção não separa).
      // Cada célula é trimada ao conteúdo e ancorada nos pés (south).
      for (const blk of map.blocks) {
        if (onlyAction && blk.action !== onlyAction) continue;
        const [FW, FH] = blk.frame || map.frame; // override por bloco (ex.: death)
        const prefix = blk.prefix || map.prefix; // override por bloco (multi-sujeito)
        const ranges = frameRanges(blk);
        for (let i = 0; i < blk.n; i++) {
          const [rx0, rx1] = ranges[i];
          const name = `${prefix}-${blk.action}${i}`;
          // extrai a célula, remove números/rótulos (CC), trima e ancora nos pés
          const cell = await cellPng(rx0, blk.y0, rx1 - rx0, blk.y1 - blk.y0);
          if (!cell) continue;
          const inner = await sharp(cell)
            .resize(FW, FH - 2, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
            .png()
            .toBuffer();
          await sharp({
            create: {
              width: FW,
              height: FH,
              channels: 4,
              background: { r: 0, g: 0, b: 0, alpha: 0 },
            },
          })
            .composite([{ input: inner, gravity: "south" }])
            .png()
            .toFile(resolve(SPRITES, `${name}.png`));
          written++;
        }
        console.log(`  ${prefix}-${blk.action}: ${blk.n} frames`);
      }
      console.log(`\n${written} frames gravados em sprites/. Rode: node scripts/pack-atlas.mjs`);
    }
  });
}

// ── MAPAS de banda→ação por folha (preenchidos após conferir o --preview) ─────
// `band` = índice da banda no preview; `action` = prefixo do estado; `take` =
// limitar nº de frames (descarta rótulos/sobras à direita).
const SHEET_MAPS = {
  // Player sheet expandido (s31). Coordenadas lidas do ruler sobre a fonte 2750×1536.
  // Frames empacotados lado-a-lado → grid fixo (x0..x1 dividido em n).
  player: {
    prefix: "player",
    frame: [80, 80],
    // Contagens casadas com o que Player.updateTexture CICLA (walk/run 16,
    // idle 3, attack 3, jump 6, fall 3, dash 1). Extraímos sub-faixas LIMPAS
    // (antes da lacuna do "08" no idle, e com y0 abaixo do rótulo no attack).
    // O corte é individual (snap no vale) → nunca fatia personagem no meio.
    blocks: [
      { action: "idle", x0: 25, y0: 200, x1: 590, y1: 340, n: 6 },
      { action: "walk", x0: 1230, y0: 200, x1: 2725, y1: 340, n: 16 },
      { action: "run", x0: 25, y0: 412, x1: 2725, y1: 592, n: 16 },
      { action: "jump", x0: 25, y0: 660, x1: 612, y1: 800, n: 6 },
      { action: "fall", x0: 960, y0: 660, x1: 1270, y1: 800, n: 3 },
      { action: "dash", x0: 1490, y0: 660, x1: 2110, y1: 800, n: 3 },
      { action: "attack", x0: 28, y0: 872, x1: 520, y1: 1035, n: 4 },
      { action: "hurt", x0: 28, y0: 1108, x1: 250, y1: 1282, n: 2 },
    ],
  },

  // Inimigos comuns (s7) — 5 sujeitos da Fase 1, fundo escuro sólido, frames COM
  // espaçamento. Cada linha tem colunas idle/walk/attack/hurt/death (ordem varia:
  // no Estagiário HURT vem antes do ATTACK; nos demais, depois). Cada bloco leva
  // seu próprio `prefix`. death → 64×64 (personagem caído é largo/baixo).
  // Coordenadas lidas do ruler sobre a fonte 1536×1024. Rodar com --bg=dark.
  inimigos1: {
    prefix: "enemy",
    frame: [48, 64],
    blocks: [
      // 1. Estagiário  (y ~158..246, pés ~245)
      { prefix: "enemy-estagiario", action: "idle", x0: 175, y0: 158, x1: 515, y1: 246, n: 4 },
      { prefix: "enemy-estagiario", action: "walk", x0: 520, y0: 158, x1: 735, y1: 246, n: 4 },
      { prefix: "enemy-estagiario", action: "hurt", x0: 740, y0: 158, x1: 855, y1: 246, n: 1 },
      { prefix: "enemy-estagiario", action: "attack", x0: 865, y0: 158, x1: 1085, y1: 246, n: 2 },
      {
        prefix: "enemy-estagiario",
        action: "death",
        x0: 1175,
        y0: 158,
        x1: 1480,
        y1: 250,
        n: 3,
        frame: [64, 64],
      },
      // 2. Analista  (y ~328..448)
      { prefix: "enemy-analista", action: "idle", x0: 175, y0: 328, x1: 515, y1: 448, n: 4 },
      { prefix: "enemy-analista", action: "walk", x0: 520, y0: 328, x1: 735, y1: 448, n: 4 },
      { prefix: "enemy-analista", action: "attack", x0: 740, y0: 328, x1: 1010, y1: 448, n: 3 },
      { prefix: "enemy-analista", action: "hurt", x0: 1040, y0: 328, x1: 1150, y1: 448, n: 1 },
      {
        prefix: "enemy-analista",
        action: "death",
        x0: 1175,
        y0: 328,
        x1: 1480,
        y1: 452,
        n: 3,
        frame: [64, 64],
      },
      // 3. Facilitador  (y ~528..618)
      { prefix: "enemy-facilitador", action: "idle", x0: 175, y0: 528, x1: 515, y1: 618, n: 4 },
      { prefix: "enemy-facilitador", action: "walk", x0: 520, y0: 528, x1: 735, y1: 618, n: 4 },
      { prefix: "enemy-facilitador", action: "attack", x0: 740, y0: 528, x1: 900, y1: 618, n: 2 },
      { prefix: "enemy-facilitador", action: "hurt", x0: 1030, y0: 528, x1: 1150, y1: 618, n: 1 },
      {
        prefix: "enemy-facilitador",
        action: "death",
        x0: 1175,
        y0: 528,
        x1: 1480,
        y1: 622,
        n: 3,
        frame: [64, 64],
      },
      // 4. Scrum  (y ~705..800)
      { prefix: "enemy-scrum", action: "idle", x0: 175, y0: 705, x1: 515, y1: 800, n: 4 },
      { prefix: "enemy-scrum", action: "walk", x0: 520, y0: 705, x1: 735, y1: 800, n: 4 },
      { prefix: "enemy-scrum", action: "attack", x0: 740, y0: 705, x1: 835, y1: 800, n: 2 },
      { prefix: "enemy-scrum", action: "hurt", x0: 1030, y0: 705, x1: 1150, y1: 800, n: 1 },
      {
        prefix: "enemy-scrum",
        action: "death",
        x0: 1175,
        y0: 705,
        x1: 1480,
        y1: 804,
        n: 3,
        frame: [64, 64],
      },
      // 5. Coordenador  (y ~875..958)
      { prefix: "enemy-coordenador", action: "idle", x0: 175, y0: 875, x1: 515, y1: 958, n: 4 },
      { prefix: "enemy-coordenador", action: "walk", x0: 520, y0: 875, x1: 735, y1: 958, n: 4 },
      { prefix: "enemy-coordenador", action: "attack", x0: 740, y0: 875, x1: 900, y1: 958, n: 2 },
      { prefix: "enemy-coordenador", action: "hurt", x0: 1030, y0: 875, x1: 1150, y1: 958, n: 1 },
      {
        prefix: "enemy-coordenador",
        action: "death",
        x0: 1175,
        y0: 875,
        x1: 1480,
        y1: 962,
        n: 3,
        frame: [64, 64],
      },
    ],
  },
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
