import sharp from 'sharp';
import { fileURLToPath } from 'url';

// ─────────────────────────────────────────────────────────────────────────────
// Gerador procedural de sprites de pixel-art.
//
// POR QUE ISTO EXISTE: vários assets do jogo vieram de extrações de IA mal
// recortadas (frames vazios, "blocos" chapados, respingos). Em vez de depender
// de uma fonte externa, desenhamos os assets simples DIRETO em código — fica
// versionado, reproduzível e fácil de ajustar (cor/tamanho/animação) num PR.
//
// COMO USAR:
//   node scripts/gen-sprites.mjs            # regenera todos os sprites abaixo
//   node scripts/gen-sprites.mjs postit     # só os que casam com o filtro
//   depois:  node scripts/pack-atlas.mjs    # re-empacota o atlas
//
// COMO ADICIONAR UM SPRITE: escreva uma função que recebe um `canvas(w,h)`,
// pinta com px/rect/hline e chama `.save("item-xxx.png")`. Registre em SPRITES.
// O helper usa composição alpha-over e clampa fora dos limites — origem (0,0)
// no topo-esquerdo, como os PNGs do atlas.
// ─────────────────────────────────────────────────────────────────────────────

const DIR = new URL('../public/assets/sprites/', import.meta.url).pathname;

export function canvas(w, h) {
  const d = new Uint8ClampedArray(w * h * 4);
  const px = (x, y, [r, g, b, a = 255]) => {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = (y * w + x) * 4;
    const af = a / 255, ia = 1 - af;
    d[i] = r * af + d[i] * ia; d[i + 1] = g * af + d[i + 1] * ia;
    d[i + 2] = b * af + d[i + 2] * ia; d[i + 3] = Math.max(d[i + 3], a);
  };
  const rect = (x, y, rw, rh, c) => { for (let yy = 0; yy < rh; yy++) for (let xx = 0; xx < rw; xx++) px(x + xx, y + yy, c); };
  const hline = (x, y, len, c) => rect(x, y, len, 1, c);
  return {
    d, w, h, px, rect, hline,
    save: (name) => sharp(Buffer.from(d.buffer), { raw: { width: w, height: h, channels: 4 } }).png().toFile(DIR + name),
  };
}

// ── Paletas compartilhadas ────────────────────────────────────────────────────
const PAPER = [247, 214, 70], PAPER_D = [214, 178, 38], PAPER_L = [255, 233, 120];
const INK = [90, 78, 30], CORNER = [196, 160, 30], SHADOW = [0, 0, 0, 70];
const CUP = [238, 232, 222], CUP_D = [196, 188, 176], CUP_L = [252, 250, 245];
const LID = [80, 70, 62], LID_D = [54, 47, 41];
const SLEEVE = [150, 96, 54], SLEEVE_D = [110, 68, 36], STEAM = [220, 220, 220, 120];

// ── Post-it: nota adesiva voadora, 28x28, 3 frames (flutter) ──────────────────
function postit(frame) {
  const W = 28, H = 28, c = canvas(W, H);
  const skews = [
    (r) => Math.round(Math.sin(r / 6) * 1.2),
    (r) => Math.round((r - 11) * 0.18),
    (r) => Math.round((11 - r) * 0.18),
  ];
  const sk = skews[frame];
  const x0 = 5, y0 = 4, bw = 18, bh = 18;
  for (let r = 0; r < bh; r++) c.rect(x0 + sk(r) + 1, y0 + r + 1, bw, 1, SHADOW);
  for (let r = 0; r < bh; r++) {
    const sx = x0 + sk(r);
    const shade = r < 3 ? PAPER_L : (r > bh - 4 ? PAPER_D : PAPER);
    c.rect(sx, y0 + r, bw, 1, shade);
  }
  for (let r = 0; r < bh; r++) { const sx = x0 + sk(r); c.px(sx, y0 + r, PAPER_L); c.px(sx + bw - 1, y0 + r, PAPER_D); }
  const fr = bh - 1, fsx = x0 + sk(fr);
  for (let k = 0; k < 5; k++) c.rect(fsx + bw - 5 + k, y0 + fr - 4 + k, 5 - k, 1, CORNER);
  for (let li = 0; li < 3; li++) {
    const ry = 5 + li * 4, sx = x0 + sk(ry);
    c.hline(sx + 3, y0 + ry, bw - 7 - (li === 2 ? 4 : 0), INK);
  }
  return c.save(`item-postit-active${frame}.png`);
}

// Desenha um copo de viagem centrado em `cx`, base em `baseY`, escala de corpo.
function drawCup(c, cx, top, cw, bodyH, sleeveAt) {
  const x0 = cx - cw / 2;
  c.rect(x0 - 1, top, cw + 2, 3, LID);            // tampa
  c.rect(x0 - 1, top + 2, cw + 2, 1, LID_D);
  c.rect(cx - 2, top - 2, 4, 2, LID);             // bico da tampa
  for (let r = 0; r < bodyH; r++) {               // corpo afunilado
    const inset = Math.floor(r / 6);
    const sx = x0 + inset, len = cw - inset * 2;
    const shade = r < 2 ? CUP_L : (r > bodyH - 3 ? CUP_D : CUP);
    c.rect(sx, top + 3 + r, len, 1, shade);
    c.px(sx, top + 3 + r, CUP_D); c.px(sx + len - 1, top + 3 + r, CUP_D);
  }
  for (let r = 0; r < 6; r++) {                   // cinta de papelão
    const rr = top + 3 + sleeveAt + r, inset = Math.floor((sleeveAt + r) / 6);
    const sx = x0 + inset, len = cw - inset * 2;
    c.rect(sx, rr, len, 1, r < 1 || r > 4 ? SLEEVE_D : SLEEVE);
  }
}

// ── Café (drop): copo + vapor animado, 28x36, 3 frames ────────────────────────
function coffeeDrop(frame) {
  const W = 28, H = 36, c = canvas(W, H);
  const cx = 14, ph = frame * 1.4;
  for (let i = 0; i < 12; i++) {
    const yy = 2 + i, xx = cx + Math.round(Math.sin((i + ph) / 2.2) * 3);
    if (i < 9) c.px(xx, yy, STEAM);
    if (i < 6) c.px(xx + 1, yy, STEAM);
  }
  drawCup(c, cx, 13, 16, 18, 6);
  return c.save(`item-coffee-cup-active${frame}.png`);
}

// ── Café (estático, Copa): copo maior 40x48 com vapor fixo ────────────────────
function coffeeStatic() {
  const W = 40, H = 48, c = canvas(W, H);
  const cx = 20;
  for (let i = 0; i < 9; i++) {                   // vapor estático (dois fios)
    const yy = 4 + i;
    c.px(cx - 3 + Math.round(Math.sin(i / 2) * 2), yy, STEAM);
    c.px(cx + 3 + Math.round(Math.cos(i / 2) * 2), yy, STEAM);
  }
  drawCup(c, cx, 15, 24, 28, 9);
  return c.save('item-coffee-cup.png');
}

// RNG determinístico (mulberry32) — mantém a textura reproduzível byte-a-byte.
function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const mix = (a, b, k) => a.map((v, i) => Math.round(v + (b[i] - v) * k));

// ── Chão de escritório (carpete comercial), 32x16, ladrilha na horizontal ─────
// tex-floor é usado como tileSprite no rodapé das fases. Uma emenda vertical
// escura em x=0 vira "junta de painel" a cada 32px; topo tem a linha da
// superfície (onde os pés pisam) + textura de carpete pontilhada.
const F_BASE = [56, 62, 72], F_DARK = [42, 47, 56], F_LIGHT = [74, 82, 95], F_EDGE = [100, 108, 124];
function floorTile() {
  const W = 32, H = 16, c = canvas(W, H);
  const r = rng(1337);
  for (let y = 0; y < H; y++) {
    const grad = mix(F_BASE, F_DARK, y / H * 0.6); // escurece para baixo
    c.hline(0, y, W, grad);
  }
  c.hline(0, 0, W, F_EDGE);                 // linha da superfície (pés)
  c.hline(0, 1, W, mix(F_LIGHT, F_BASE, 0.4)); // bisel sutil
  for (let y = 2; y < H; y++) { c.px(0, y, F_DARK); c.px(1, y, mix(F_DARK, F_BASE, 0.5)); } // junta de painel
  c.hline(0, 8, W, mix(F_DARK, F_BASE, 0.35)); // emenda horizontal (ladrilho)
  for (let i = 0; i < 70; i++) {            // textura pontilhada de carpete
    const x = (r() * W) | 0, y = 2 + ((r() * (H - 2)) | 0);
    c.px(x, y, r() < 0.5 ? mix(F_BASE, F_LIGHT, 0.6) : mix(F_BASE, F_DARK, 0.6));
  }
  return c.save('tile-floor.png');
}

// ── Tampo de mesa (madeira), 32x16 — usado no Lab (mesas in-game são graphics) ─
const W_BASE = [96, 62, 34], W_DARK = [66, 41, 21], W_LIGHT = [126, 84, 48], W_EDGE = [150, 104, 62];
function platformTile() {
  const W = 32, H = 16, c = canvas(W, H);
  const r = rng(4242);
  for (let y = 0; y < H; y++) c.hline(0, y, W, mix(W_BASE, W_DARK, y / H * 0.5));
  c.hline(0, 0, W, W_EDGE);                 // quina iluminada do tampo
  c.hline(0, 1, W, W_LIGHT);
  for (let g = 0; g < 3; g++) {             // veios de madeira horizontais
    const y = 4 + g * 4;
    for (let x = 0; x < W; x++) if (r() < 0.7) c.px(x, y, mix(W_BASE, W_DARK, 0.55));
  }
  return c.save('tile-platform.png');
}

// Registro: [nome-para-filtro, função]
const SPRITES = [
  ['postit', () => postit(0)], ['postit', () => postit(1)], ['postit', () => postit(2)],
  ['coffee', () => coffeeDrop(0)], ['coffee', () => coffeeDrop(1)], ['coffee', () => coffeeDrop(2)],
  ['coffee', coffeeStatic],
  ['tile', floorTile], ['tile', platformTile],
];

async function main() {
  const filter = process.argv[2];
  const todo = SPRITES.filter(([tag]) => !filter || tag.includes(filter));
  await Promise.all(todo.map(([, fn]) => fn()));
  console.log(`Gerados ${todo.length} sprite(s)${filter ? ` (filtro: ${filter})` : ''}. Rode 'node scripts/pack-atlas.mjs' para re-empacotar.`);
}

// Só executa se chamado direto (permite importar canvas() em outros scripts).
if (process.argv[1] === fileURLToPath(import.meta.url)) main().catch((e) => { console.error(e); process.exit(1); });
