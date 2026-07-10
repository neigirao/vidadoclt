import sharp from "sharp";
import { fileURLToPath } from "url";

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

const DIR = new URL("../public/assets/sprites/", import.meta.url).pathname;

export function canvas(w, h) {
  const d = new Uint8ClampedArray(w * h * 4);
  const px = (x, y, [r, g, b, a = 255]) => {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = (y * w + x) * 4;
    const af = a / 255,
      ia = 1 - af;
    d[i] = r * af + d[i] * ia;
    d[i + 1] = g * af + d[i + 1] * ia;
    d[i + 2] = b * af + d[i + 2] * ia;
    d[i + 3] = Math.max(d[i + 3], a);
  };
  const rect = (x, y, rw, rh, c) => {
    for (let yy = 0; yy < rh; yy++) for (let xx = 0; xx < rw; xx++) px(x + xx, y + yy, c);
  };
  const hline = (x, y, len, c) => rect(x, y, len, 1, c);
  return {
    d,
    w,
    h,
    px,
    rect,
    hline,
    save: (name) =>
      sharp(Buffer.from(d.buffer), { raw: { width: w, height: h, channels: 4 } })
        .png()
        .toFile(DIR + name),
  };
}

// ── Paletas compartilhadas ────────────────────────────────────────────────────
const PAPER = [247, 214, 70],
  PAPER_D = [214, 178, 38],
  PAPER_L = [255, 233, 120];
const INK = [90, 78, 30],
  CORNER = [196, 160, 30],
  SHADOW = [0, 0, 0, 70];
const CUP = [238, 232, 222],
  CUP_D = [196, 188, 176],
  CUP_L = [252, 250, 245];
const LID = [80, 70, 62],
  LID_D = [54, 47, 41];
const SLEEVE = [150, 96, 54],
  SLEEVE_D = [110, 68, 36],
  STEAM = [220, 220, 220, 120];

// ── Post-it: nota adesiva voadora, 28x28, 3 frames (flutter) ──────────────────
function postit(frame) {
  const W = 28,
    H = 28,
    c = canvas(W, H);
  const skews = [
    (r) => Math.round(Math.sin(r / 6) * 1.2),
    (r) => Math.round((r - 11) * 0.18),
    (r) => Math.round((11 - r) * 0.18),
  ];
  const sk = skews[frame];
  const x0 = 5,
    y0 = 4,
    bw = 18,
    bh = 18;
  for (let r = 0; r < bh; r++) c.rect(x0 + sk(r) + 1, y0 + r + 1, bw, 1, SHADOW);
  for (let r = 0; r < bh; r++) {
    const sx = x0 + sk(r);
    const shade = r < 3 ? PAPER_L : r > bh - 4 ? PAPER_D : PAPER;
    c.rect(sx, y0 + r, bw, 1, shade);
  }
  for (let r = 0; r < bh; r++) {
    const sx = x0 + sk(r);
    c.px(sx, y0 + r, PAPER_L);
    c.px(sx + bw - 1, y0 + r, PAPER_D);
  }
  const fr = bh - 1,
    fsx = x0 + sk(fr);
  for (let k = 0; k < 5; k++) c.rect(fsx + bw - 5 + k, y0 + fr - 4 + k, 5 - k, 1, CORNER);
  for (let li = 0; li < 3; li++) {
    const ry = 5 + li * 4,
      sx = x0 + sk(ry);
    c.hline(sx + 3, y0 + ry, bw - 7 - (li === 2 ? 4 : 0), INK);
  }
  return c.save(`item-postit-active${frame}.png`);
}

// Desenha um copo de viagem centrado em `cx`, base em `baseY`, escala de corpo.
function drawCup(c, cx, top, cw, bodyH, sleeveAt) {
  const x0 = cx - cw / 2;
  c.rect(x0 - 1, top, cw + 2, 3, LID); // tampa
  c.rect(x0 - 1, top + 2, cw + 2, 1, LID_D);
  c.rect(cx - 2, top - 2, 4, 2, LID); // bico da tampa
  for (let r = 0; r < bodyH; r++) {
    // corpo afunilado
    const inset = Math.floor(r / 6);
    const sx = x0 + inset,
      len = cw - inset * 2;
    const shade = r < 2 ? CUP_L : r > bodyH - 3 ? CUP_D : CUP;
    c.rect(sx, top + 3 + r, len, 1, shade);
    c.px(sx, top + 3 + r, CUP_D);
    c.px(sx + len - 1, top + 3 + r, CUP_D);
  }
  for (let r = 0; r < 6; r++) {
    // cinta de papelão
    const rr = top + 3 + sleeveAt + r,
      inset = Math.floor((sleeveAt + r) / 6);
    const sx = x0 + inset,
      len = cw - inset * 2;
    c.rect(sx, rr, len, 1, r < 1 || r > 4 ? SLEEVE_D : SLEEVE);
  }
}

// ── Café (drop): copo + vapor animado, 28x36, 3 frames ────────────────────────
function coffeeDrop(frame) {
  const W = 28,
    H = 36,
    c = canvas(W, H);
  const cx = 14,
    ph = frame * 1.4;
  for (let i = 0; i < 12; i++) {
    const yy = 2 + i,
      xx = cx + Math.round(Math.sin((i + ph) / 2.2) * 3);
    if (i < 9) c.px(xx, yy, STEAM);
    if (i < 6) c.px(xx + 1, yy, STEAM);
  }
  drawCup(c, cx, 13, 16, 18, 6);
  return c.save(`item-coffee-cup-active${frame}.png`);
}

// ── Café (estático, Copa): copo maior 40x48 com vapor fixo ────────────────────
function coffeeStatic() {
  const W = 40,
    H = 48,
    c = canvas(W, H);
  const cx = 20;
  for (let i = 0; i < 9; i++) {
    // vapor estático (dois fios)
    const yy = 4 + i;
    c.px(cx - 3 + Math.round(Math.sin(i / 2) * 2), yy, STEAM);
    c.px(cx + 3 + Math.round(Math.cos(i / 2) * 2), yy, STEAM);
  }
  drawCup(c, cx, 15, 24, 28, 9);
  return c.save("item-coffee-cup.png");
}

// RNG determinístico (mulberry32) — mantém a textura reproduzível byte-a-byte.
function rng(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
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
const F_BASE = [56, 62, 72],
  F_DARK = [42, 47, 56],
  F_LIGHT = [74, 82, 95],
  F_EDGE = [100, 108, 124];
function floorTile() {
  const W = 32,
    H = 16,
    c = canvas(W, H);
  const r = rng(1337);
  for (let y = 0; y < H; y++) {
    const grad = mix(F_BASE, F_DARK, (y / H) * 0.6); // escurece para baixo
    c.hline(0, y, W, grad);
  }
  c.hline(0, 0, W, F_EDGE); // linha da superfície (pés)
  c.hline(0, 1, W, mix(F_LIGHT, F_BASE, 0.4)); // bisel sutil
  for (let y = 2; y < H; y++) {
    c.px(0, y, F_DARK);
    c.px(1, y, mix(F_DARK, F_BASE, 0.5));
  } // junta de painel
  c.hline(0, 8, W, mix(F_DARK, F_BASE, 0.35)); // emenda horizontal (ladrilho)
  for (let i = 0; i < 70; i++) {
    // textura pontilhada de carpete
    const x = (r() * W) | 0,
      y = 2 + ((r() * (H - 2)) | 0);
    c.px(x, y, r() < 0.5 ? mix(F_BASE, F_LIGHT, 0.6) : mix(F_BASE, F_DARK, 0.6));
  }
  return c.save("tile-floor.png");
}

// ── Tampo de mesa (madeira), 32x16 — usado no Lab (mesas in-game são graphics) ─
const W_BASE = [96, 62, 34],
  W_DARK = [66, 41, 21],
  W_LIGHT = [126, 84, 48],
  W_EDGE = [150, 104, 62];
function platformTile() {
  const W = 32,
    H = 16,
    c = canvas(W, H);
  const r = rng(4242);
  for (let y = 0; y < H; y++) c.hline(0, y, W, mix(W_BASE, W_DARK, (y / H) * 0.5));
  c.hline(0, 0, W, W_EDGE); // quina iluminada do tampo
  c.hline(0, 1, W, W_LIGHT);
  for (let g = 0; g < 3; g++) {
    // veios de madeira horizontais
    const y = 4 + g * 4;
    for (let x = 0; x < W; x++) if (r() < 0.7) c.px(x, y, mix(W_BASE, W_DARK, 0.55));
  }
  return c.save("tile-platform.png");
}

// ── Moeda VR (drop de moeda), base 52x52 + 3 frames de giro ───────────────────
// O jogo tinta com 0xffd700 (dropVR), então desenhar CLARO (tint multiplica).
const COIN = [255, 244, 200],
  COIN_D = [216, 196, 140],
  COIN_L = [255, 255, 240],
  COIN_TXT = [150, 122, 60];
function vrCoinFrame(frame, name) {
  const W = 52,
    H = 52,
    c = canvas(W, H);
  const cx = 26,
    cy = 26,
    R = 19;
  // largura do disco por frame de giro: cheio → médio → de perfil
  const widths = [1, 0.55, 0.18];
  const k = widths[Math.min(frame, 2)];
  for (let y = -R; y <= R; y++) {
    const half = Math.sqrt(Math.max(0, R * R - y * y)) * k;
    if (half < 0.6) continue;
    const shade = y < -R * 0.4 ? COIN_L : y > R * 0.5 ? COIN_D : COIN;
    c.rect(cx - half, cy + y, half * 2, 1, shade);
    c.px(cx - half, cy + y, COIN_D);
    c.px(cx + half - 1, cy + y, COIN_D);
  }
  if (frame === 0) {
    // "R$" gravado só no frame cheio
    // R
    c.rect(cx - 8, cy - 6, 2, 12, COIN_TXT);
    c.rect(cx - 6, cy - 6, 4, 2, COIN_TXT);
    c.rect(cx - 3, cy - 4, 2, 3, COIN_TXT);
    c.rect(cx - 6, cy - 1, 3, 2, COIN_TXT);
    c.rect(cx - 4, cy + 1, 2, 5, COIN_TXT);
    // $
    c.rect(cx + 2, cy - 6, 6, 2, COIN_TXT);
    c.rect(cx + 1, cy - 4, 2, 3, COIN_TXT);
    c.rect(cx + 2, cy - 1, 6, 2, COIN_TXT);
    c.rect(cx + 7, cy + 1, 2, 3, COIN_TXT);
    c.rect(cx + 2, cy + 4, 6, 2, COIN_TXT);
    c.rect(cx + 4, cy - 8, 2, 16, COIN_TXT);
  }
  return c.save(name);
}

// ── E-mail (projétil do Gerente), 44x36, 2 frames ─────────────────────────────
const ENV = [240, 240, 248],
  ENV_D = [196, 198, 214],
  ENV_L = [255, 255, 255],
  SEAL = [204, 60, 60];
function emailFrame(frame) {
  const W = 44,
    H = 36,
    c = canvas(W, H);
  const x0 = 6,
    y0 = 9 + (frame === 1 ? 1 : 0),
    w = 32,
    h = 20;
  for (let r = 0; r < h; r++) c.rect(x0, y0 + r, w, 1, r < 2 ? ENV_L : r > h - 3 ? ENV_D : ENV);
  // contorno + aba em V
  c.hline(x0, y0, w, ENV_D);
  c.hline(x0, y0 + h - 1, w, ENV_D);
  for (let r = 0; r < h; r++) {
    c.px(x0, y0 + r, ENV_D);
    c.px(x0 + w - 1, y0 + r, ENV_D);
  }
  for (let i = 0; i <= w / 2; i++) {
    const yy = y0 + Math.round((i * (h * 0.55)) / (w / 2));
    c.px(x0 + i, yy, ENV_D);
    c.px(x0 + w - 1 - i, yy, ENV_D);
  }
  c.rect(x0 + w / 2 - 2, y0 + h * 0.5 - 1, 4, 4, SEAL); // selo "urgente"
  // linhas de velocidade (voando)
  const sl = frame === 0 ? [4, 12] : [7, 15];
  for (const yy of sl) c.hline(x0 - 5, y0 + (yy * h) / 20, 4, [255, 255, 255, 110]);
  return c.save(`item-email-idle${frame}.png`);
}

// ── Convite de reunião (armadilha), 48x36, 3 frames (pulso do "!") ────────────
const CARD = [245, 240, 228],
  CARD_D = [206, 198, 178],
  BAR = [90, 110, 200],
  ALERT = [220, 60, 50];
function conviteFrame(frame) {
  const W = 48,
    H = 36,
    c = canvas(W, H);
  const x0 = 8,
    y0 = 6,
    w = 32,
    h = 24;
  for (let r = 0; r < h; r++)
    c.rect(x0, y0 + r, w, 1, r < 2 ? [255, 255, 252] : r > h - 3 ? CARD_D : CARD);
  for (let r = 0; r < h; r++) {
    c.px(x0, y0 + r, CARD_D);
    c.px(x0 + w - 1, y0 + r, CARD_D);
  }
  c.rect(x0, y0, w, 4, BAR); // faixa de "calendário"
  c.hline(x0 + 3, y0 + 8, w - 14, CARD_D); // linhas de texto
  c.hline(x0 + 3, y0 + 12, w - 10, CARD_D);
  c.hline(x0 + 3, y0 + 16, w - 16, CARD_D);
  // "!" pulsante no canto (0=pequeno, 1=médio, 2=grande)
  const s = 1 + frame * 0.5;
  const bx = x0 + w - 7,
    by = y0 + h - 12;
  c.rect(bx, by, 2 * s > 3 ? 3 : 2, Math.round(6 * s) - 2, ALERT);
  c.rect(bx, by + Math.round(6 * s), 2, 2, ALERT);
  return c.save(`item-convite-accepted${frame}.png`);
}

// ── Fase 5: objetos-monstro (48x64, pés na base, corpo ~centro p/ física) ─────
const METAL = [120, 126, 138],
  METAL_D = [82, 87, 97],
  METAL_L = [166, 172, 184];
const INKPAD = [180, 40, 50],
  WOODB = [104, 72, 44];

// Carimbador Automático: máquina de carimbo com braço e almofada de tinta.
function carimbador() {
  const W = 48,
    H = 64,
    c = canvas(W, H);
  c.rect(10, 56, 28, 6, METAL_D); // base
  c.rect(12, 54, 24, 2, METAL);
  c.rect(30, 20, 6, 36, METAL); // coluna
  c.rect(30, 20, 2, 36, METAL_L);
  c.rect(14, 18, 24, 6, METAL); // braço horizontal
  c.hline(14, 18, 24, METAL_L);
  c.rect(14, 24, 8, 10, METAL_D); // cabeça do carimbo
  c.rect(13, 34, 10, 4, WOODB); // borracha do carimbo
  c.rect(12, 50, 14, 4, INKPAD); // almofada de tinta
  c.rect(12, 49, 14, 1, [220, 80, 90]);
  c.rect(38, 30, 4, 4, ALERT); // luz de status
  for (let i = 0; i < 3; i++) c.rect(16 + i * 6, 60, 3, 2, [40, 42, 48]); // parafusos
  addOutline(c, OBJ_OUT); // keyline preto p/ casar o estilo dos demais inimigos
  return c.save("enemy-carimbador.png");
}

// Arquivo Ambulante: arquivo de aço com gaveta aberta e pezinhos.
function arquivo() {
  const W = 48,
    H = 64,
    c = canvas(W, H);
  const x0 = 12,
    w = 24,
    y0 = 10,
    h = 46;
  for (let r = 0; r < h; r++) c.rect(x0, y0 + r, w, 1, r < 2 ? METAL_L : METAL);
  for (let r = 0; r < h; r++) {
    c.px(x0, y0 + r, METAL_D);
    c.px(x0 + w - 1, y0 + r, METAL_D);
  }
  for (let g = 0; g < 3; g++) {
    // 3 gavetas
    const gy = y0 + 4 + g * 14;
    c.hline(x0 + 1, gy + 11, w - 2, METAL_D);
    c.rect(x0 + w / 2 - 4, gy + 5, 8, 3, METAL_D); // puxador
  }
  c.rect(x0 - 6, y0 + 4, 8, 6, METAL_L); // gaveta do topo aberta
  c.rect(x0 - 6, y0 + 4, 8, 1, [255, 255, 255]);
  c.rect(x0 - 4, y0 + 1, 5, 3, [235, 232, 220]); // papel saindo
  c.rect(x0 + 3, y0 + 56 - y0, 6, 6, METAL_D); // pezinhos
  c.rect(x0 + w - 9, 56, 6, 6, METAL_D);
  c.rect(x0 + 3, 56, 6, 6, METAL_D);
  addOutline(c, OBJ_OUT);
  return c.save("enemy-arquivo.png");
}

// Bateria Social: pilha grande com barras de carga (baixa) e olhinhos.
function bateria() {
  const W = 48,
    H = 64,
    c = canvas(W, H);
  const x0 = 14,
    w = 20,
    y0 = 14,
    h = 44;
  c.rect(x0 + 6, y0 - 4, 8, 4, METAL_D); // terminal
  for (let r = 0; r < h; r++)
    c.rect(x0, y0 + r, w, 1, r < 2 ? METAL_L : r > h - 3 ? METAL_D : METAL);
  for (let r = 0; r < h; r++) {
    c.px(x0, y0 + r, METAL_D);
    c.px(x0 + w - 1, y0 + r, METAL_D);
  }
  // janela de carga: 4 células, só 1 acesa (bateria social no fim)
  for (let i = 0; i < 4; i++) {
    const cy2 = y0 + 8 + i * 9;
    c.rect(x0 + 4, cy2, 12, 6, i === 3 ? ALERT : [50, 54, 62]);
    c.hline(x0 + 4, cy2, 12, METAL_D);
  }
  c.rect(x0 + 4, y0 + 2, 3, 3, [255, 255, 255]); // olhinhos cansados
  c.rect(x0 + 13, y0 + 2, 3, 3, [255, 255, 255]);
  addOutline(c, OBJ_OUT);
  return c.save("enemy-bateria.png");
}

// ── Analista Novo: frame walk3 (64x64) ───────────────────────────────────────
// O walk3 original veio corrompido da extração de IA (era uma "explosão"
// amarela, fora do personagem). Os vizinhos (walk0/1/2/4) são o analista de
// óculos com pasta. Aqui redesenhamos a pose de meio-passo em código, casando
// a paleta amostrada dos frames bons. Side view, virado p/ a direita; pés na
// base (~y49), como os demais frames deste inimigo.
const AN_SKIN = [200, 150, 120],
  AN_SKIN_D = [160, 115, 90],
  AN_HAIR = [70, 45, 30],
  AN_HAIR_D = [48, 30, 20],
  AN_SHIRT = [228, 226, 218],
  AN_SHIRT_D = [178, 176, 170],
  AN_TIE = [42, 92, 112],
  AN_PANTS = [44, 46, 74],
  AN_PANTS_D = [28, 28, 52],
  AN_SHOE = [30, 24, 24],
  AN_CASE = [110, 70, 42],
  AN_CASE_D = [70, 45, 25],
  AN_OUT = [18, 14, 12];
function analistaNovoWalk3() {
  const W = 64,
    H = 64,
    c = canvas(W, H);
  const R = (x, y, w, h, col) => c.rect(x, y, w, h, col);
  // ── pernas em meio-passo (perna dir. à frente, esq. atrás) ──
  R(27, 38, 6, 9, AN_PANTS_D); // coxa de trás
  R(26, 45, 7, 3, AN_PANTS); // canela de trás (recuada)
  R(24, 47, 8, 3, AN_SHOE); // sapato de trás
  R(33, 38, 7, 8, AN_PANTS); // coxa da frente
  R(35, 44, 6, 4, AN_PANTS); // canela da frente (avançada)
  R(35, 47, 9, 3, AN_SHOE); // sapato da frente
  // ── torso / camisa ──
  R(25, 22, 17, 17, AN_SHIRT);
  R(25, 22, 3, 17, AN_SHIRT_D); // sombra lateral esq.
  R(39, 22, 3, 17, AN_SHIRT_D); // sombra lateral dir.
  R(32, 23, 2, 13, AN_TIE); // gravata
  R(31, 35, 4, 2, AN_TIE);
  // ── braços: de trás recuado, da frente à frente segurando pasta ──
  R(23, 24, 4, 11, AN_SHIRT_D); // braço de trás
  R(22, 34, 4, 3, AN_SKIN_D); // mão de trás
  R(40, 24, 4, 10, AN_SHIRT); // braço da frente
  R(41, 33, 4, 3, AN_SKIN); // mão da frente
  // pasta na mão da frente
  R(40, 36, 12, 9, AN_CASE);
  R(40, 36, 12, 2, AN_CASE_D);
  R(45, 34, 3, 2, AN_CASE_D); // alça
  // ── cabeça ──
  R(27, 8, 13, 14, AN_SKIN); // rosto
  R(27, 8, 13, 4, AN_HAIR); // cabelo (topo)
  R(26, 8, 3, 9, AN_HAIR); // cabelo (nuca)
  R(37, 9, 3, 3, AN_HAIR_D); // franja lateral
  R(29, 15, 9, 3, AN_SHIRT); // óculos (armação clara)
  R(30, 16, 3, 1, AN_OUT); // lente esq.
  R(34, 16, 3, 1, AN_OUT); // lente dir.
  R(38, 18, 2, 3, AN_SKIN_D); // sombra do queixo
  // contorno preto de 1px (keyline) — casa o estilo "sticker" dos frames
  // vizinhos (todo sprite de personagem tem esse contorno).
  addOutline(c, AN_OUT);
  return c.save("enemy-analista-novo-walk3.png");
}

// Pinta um contorno de 1px na COR dada em todo pixel transparente que encosta
// (8-vizinhança) num pixel opaco. Usa o alpha atual como silhueta.
function addOutline(c, col) {
  const { d, w, h } = c;
  const isOpaque = (x, y) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] > 20;
  const toPaint = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (d[(y * w + x) * 4 + 3] > 20) continue; // já opaco
      let border = false;
      for (let dx = -1; dx <= 1 && !border; dx++)
        for (let dy = -1; dy <= 1; dy++) if ((dx || dy) && isOpaque(x + dx, y + dy)) border = true;
      if (border) toPaint.push([x, y]);
    }
  for (const [x, y] of toPaint) c.px(x, y, col);
}

// ── Objetos-monstro procedurais (Fase 2) ─────────────────────────────────────
// reuniao/guardiao-cafe vinham de extração de IA embaralhada (sem silhueta
// legível). Redesenhados como objetos-monstro simples e legíveis, no mesmo
// estilo procedural + contorno preto dos objetos da Fase 5.
const OBJ_OUT = [16, 14, 18];
const MACH = [92, 96, 108],
  MACH_D = [58, 62, 72],
  MACH_L = [132, 138, 152],
  STEEL = [150, 156, 168],
  SCREEN = [34, 52, 48],
  REYE = [255, 74, 62],
  BREW = [74, 46, 26],
  STEAMC = [220, 220, 220, 150];

// Guardião do Café (32x48): máquina de café raivosa. `ph` varia pernas+vapor.
function guardiaoCafeFrame(name, ph) {
  const W = 32,
    H = 48,
    c = canvas(W, H);
  const R = (x, y, w, h, col) => c.rect(x, y, w, h, col);
  const lp = ph % 2 ? 2 : 0; // passada
  R(9, 42, 5, 5, MACH_D);
  R(18, 42, 5, 5, MACH_D); // coxas
  R(9 + lp, 45, 5, 3, [40, 42, 48]);
  R(18 - lp, 45, 5, 3, [40, 42, 48]); // pés alternando
  R(6, 12, 20, 30, MACH); // corpo
  R(6, 12, 20, 3, MACH_L);
  R(6, 12, 3, 30, MACH_D);
  R(23, 12, 3, 30, MACH_D);
  R(9, 6, 14, 7, STEEL); // reservatório topo
  R(9, 6, 14, 2, MACH_L);
  R(10, 17, 12, 8, SCREEN); // "tela"
  R(12, 19, 3, 3, REYE);
  R(18, 19, 3, 3, REYE); // olhos raivosos
  R(12, 18, 3, 1, OBJ_OUT);
  R(18, 18, 3, 1, OBJ_OUT); // sobrancelhas
  R(14, 27, 4, 3, MACH_D); // bico
  R(11, 31, 10, 2, BREW); // café escorrendo
  const sy = ph % 2 ? 1 : 3;
  R(15, sy, 1, 3, STEAMC);
  R(16, sy + 1, 1, 2, STEAMC); // vapor
  addOutline(c, OBJ_OUT);
  return c.save(name);
}

// Reunião Corporativa (32x48): monitor-monstro de call, com alerta vermelho.
function reuniaoFrame(name) {
  const W = 32,
    H = 48,
    c = canvas(W, H);
  const R = (x, y, w, h, col) => c.rect(x, y, w, h, col);
  R(4, 8, 24, 22, MACH_D); // moldura do monitor
  R(6, 10, 20, 18, [232, 234, 240]); // tela
  R(6, 10, 20, 4, REYE); // barra de "reunião agora"
  for (let gx = 0; gx < 3; gx++)
    for (let gy = 0; gy < 2; gy++) R(9 + gx * 6, 17 + gy * 6, 4, 4, [198, 204, 214]); // grade de participantes
  R(11, 20, 3, 3, OBJ_OUT);
  R(18, 20, 3, 3, OBJ_OUT); // olhos
  R(1, 17, 4, 3, MACH);
  R(27, 17, 4, 3, MACH); // bracinhos
  R(14, 30, 4, 8, MACH); // haste
  R(9, 38, 14, 4, MACH_D); // base
  addOutline(c, OBJ_OUT);
  return c.save(name);
}

// Bebedouro / garrafão (32x48): o sprite extraído era um borrão azul com texto
// "CLARINHA" cravado. Redesenhado limpo — garrafão azul invertido sobre gabinete
// branco com duas torneiras (quente/fria) e bandeja de pingo. Contorno preto.
const WATER = [96, 156, 206],
  WATER_L = [156, 200, 236],
  WATER_D = [58, 108, 158],
  CABINET = [222, 226, 230],
  CAB_D = [168, 174, 182],
  CAB_SH = [138, 144, 152],
  BOTTLE_CAP = [70, 88, 108],
  TAP_HOT = [204, 74, 62],
  TAP_COLD = [72, 122, 202],
  TRAY = [150, 156, 164];
function bebedouro() {
  const W = 32,
    H = 48,
    c = canvas(W, H);
  const R = (x, y, w, h, col) => c.rect(x, y, w, h, col);
  // ── garrafão de água (invertido) ──
  for (let r = 0; r < 18; r++) {
    const round = r < 2 ? 2 - r : 0; // arredonda o topo
    R(9 + round, 6 + r, 14 - round * 2, 1, WATER);
  }
  R(9, 6, 14, 3, WATER_L); // topo (linha do ar/água)
  R(9, 6, 1, 18, WATER_D);
  R(22, 6, 1, 18, WATER_D); // laterais escuras
  R(11, 8, 2, 13, WATER_L); // brilho vertical
  R(13, 23, 6, 3, BOTTLE_CAP); // gargalo entrando no gabinete
  // ── gabinete (base branca) ──
  R(8, 26, 16, 20, CABINET);
  R(8, 26, 2, 20, CAB_D);
  R(22, 26, 2, 20, CAB_D); // laterais
  R(8, 44, 16, 2, CAB_SH); // sombra da base
  R(15, 30, 1, 14, CAB_D); // fresta da portinha
  // ── torneiras (fria/quente) + bicos ──
  R(11, 33, 4, 2, TAP_COLD);
  R(17, 33, 4, 2, TAP_HOT);
  R(12, 35, 1, 2, [80, 80, 90]);
  R(19, 35, 1, 2, [80, 80, 90]);
  R(11, 39, 10, 2, TRAY); // bandeja de pingo
  addOutline(c, OBJ_OUT);
  c.save("obj-bebedouro.png");
  return c.save("obj-bebedouro-idle.png");
}

// ── Brenda do RH (boss da Fase 3) — sprite DEDICADO ───────────────────────────
// Antes reusava o inimigo comum `enemy-rh`. Aqui ela ganha "cara de chefão":
// silhueta frontal imponente, paleta magenta de RH, coque alto, óculos, crachá
// e a PRANCHETA de feedback/PDI como arma-tema. 48×64, pés na base (~y61),
// pose quase frontal (mirror-safe: a cena espelha por dir). addOutline dá o
// contorno "sticker" que casa com os demais personagens.
// Paleta amostrada do HERÓI (player-idle0) p/ coesão: contorno navy-escuro,
// pele quente, cabelo marrom, camisa off-white fria, tudo dessaturado ~4 tons.
// O magenta chapado da v2 vira um rosa-mauve DESSATURADO no mesmo mundo.
const BR_OUT = [16, 16, 32]; // contorno navy do herói (não preto)
const BR_SKIN = [192, 144, 112],
  BR_SKIN_D = [144, 96, 80],
  BR_SKIN_DD = [112, 72, 60],
  BR_SKIN_L = [224, 192, 160];
const BR_HAIR = [48, 32, 32],
  BR_HAIR_D = [28, 20, 22],
  BR_HAIR_MID = [72, 50, 42],
  BR_HAIR_L = [100, 68, 52],
  BR_HAIR_RIM = [140, 104, 78]; // luz de contorno quente (keyline da casa)
const BR_SUIT = [150, 84, 104], // blazer rosa-mauve dessaturado
  BR_SUIT_D = [104, 54, 72],
  BR_SUIT_DD = [70, 34, 48],
  BR_SUIT_L = [186, 120, 140];
const BR_BLOUSE = [202, 206, 208], // blusa off-white fria (= camisa do herói)
  BR_BLOUSE_D = [150, 152, 162];
const BR_SKIRT = [62, 46, 54], // saia plum-marrom escura
  BR_SKIRT_D = [40, 30, 36],
  BR_SKIRT_L = [86, 66, 78];
const BR_STOCK = [178, 140, 118],
  BR_STOCK_D = [140, 104, 86];
const BR_CLIP = [204, 208, 210],
  BR_CLIP_D = [156, 158, 168],
  BR_CLIP_DD = [112, 112, 124];
const BR_SHOE = [40, 30, 30],
  BR_SHOE_L = [84, 66, 58];
const BR_RED = [176, 60, 60],
  BR_GOLD = [200, 166, 80],
  BR_GOLD_D = [150, 120, 50],
  BR_GLASS = [38, 38, 52],
  BR_GLASS_L = [120, 146, 166],
  BR_LENS = [206, 216, 224],
  BR_LIP = [160, 70, 84],
  BR_BLUSH = [200, 120, 120, 120],
  BR_PEN = [38, 38, 52];

// pose: { drop, tilt, step, arm:"rest"|"point"|"up", mouth:bool }
// 80×80 (mesma grade do HERÓI), pés na base (~y78). Proporção "chibi" do
// protagonista: cabeça+cabelo grandes (~1/3), corpo pequeno; sombreamento por
// tom (luz na esq., sombra na dir. + AO), contorno navy, óculos redondos.
// Mantém a identidade de RH: coque, blazer mauve, blusa, prancheta de feedback.
function brendaFrame(name, pose = {}) {
  const W = 80,
    H = 80,
    c = canvas(W, H);
  const drop = pose.drop || 0;
  const tilt = pose.tilt || 0;
  const step = pose.step || 0;
  const arm = pose.arm || "rest";
  const R = (x, y, w, h, col) => c.rect(x, Math.round(y + drop), w, h, col);
  const P = (x, y, col) => c.px(x, Math.round(y + drop), col);
  // retângulo de cantos aparados (suaviza cabeça/ombros — evita o look "bloco")
  const RR = (x, y, w, h, col, r = 0) => {
    for (let j = 0; j < h; j++) {
      let ins = 0;
      if (j < r) ins = r - j;
      else if (j >= h - r) ins = r - (h - 1 - j);
      R(x + ins, y + j, w - 2 * ins, 1, col);
    }
  };

  // ===== PERNAS + SALTOS (feet ~y78) =====
  const legY = 63;
  const lo = step < 0 ? 2 : 0,
    ro = step > 0 ? 2 : 0;
  R(35 + lo, legY, 5, 12, BR_STOCK);
  R(35 + lo, legY, 2, 12, BR_STOCK_D);
  R(34 + lo, legY + 12, 7, 3, BR_SHOE);
  P(34 + lo, legY + 12, BR_SHOE_L);
  R(42 - ro, legY, 5, 12, BR_STOCK);
  R(45 - ro, legY, 2, 12, BR_STOCK_D);
  R(41 - ro, legY + 12, 7, 3, BR_SHOE);
  P(47 - ro, legY + 12, BR_SHOE_L);

  // ===== SAIA LÁPIS =====
  RR(29, 50, 22, 15, BR_SKIRT, 2);
  R(29, 50, 4, 15, BR_SKIRT_D);
  R(47, 50, 4, 15, BR_SKIRT_D);
  R(39, 51, 2, 12, BR_SKIRT_L); // vinco (luz)
  R(30, 62, 20, 2, BR_SKIRT_D); // barra

  // ===== BLAZER / TORSO (ombros arredondados) =====
  RR(28, 42, 24, 16, BR_SUIT, 3);
  R(28, 42, 24, 2, BR_SUIT_L); // ombros (luz)
  R(28, 43, 2, 11, BR_SUIT_L); // rim de luz na lateral esq.
  R(49, 44, 3, 13, BR_SUIT_D); // sombra lateral dir.
  R(50, 46, 2, 11, BR_SUIT_DD);
  R(31, 47, 1, 9, BR_SUIT_DD); // vinco/dobra esq.
  R(47, 47, 1, 9, BR_SUIT_DD); // vinco/dobra dir.
  R(29, 55, 22, 3, BR_SUIT_DD); // AO inferior
  // blusa em V + lapelas
  R(36, 43, 8, 13, BR_BLOUSE);
  R(36, 43, 8, 2, BR_BLOUSE_D);
  R(33, 43, 4, 12, BR_SUIT_L);
  R(43, 43, 4, 12, BR_SUIT_L);
  R(33, 43, 1, 12, BR_SUIT_DD);
  R(46, 43, 1, 12, BR_SUIT_DD);
  // colar discreto + botões
  P(37, 45, BR_GOLD);
  P(39, 46, BR_GOLD);
  P(41, 46, BR_GOLD);
  P(43, 45, BR_GOLD);
  P(40, 49, BR_GOLD);
  P(40, 53, BR_GOLD);
  // crachá/lanyard
  R(45, 47, 5, 6, BR_CLIP);
  R(45, 47, 5, 1, BR_GOLD_D);
  R(46, 48, 3, 3, BR_SKIN_D);

  // ===== BRAÇOS =====
  if (arm === "point") {
    R(52, 46, 14, 5, BR_SUIT);
    R(52, 46, 14, 1, BR_SUIT_L);
    R(52, 50, 14, 1, BR_SUIT_DD);
    R(64, 46, 5, 5, BR_SKIN);
    R(67, 47, 3, 2, BR_SKIN_D);
    P(64, 46, BR_SKIN_L);
    R(24, 48, 5, 10, BR_SUIT);
    R(24, 48, 2, 10, BR_SUIT_D);
    R(24, 57, 5, 3, BR_SKIN);
  } else if (arm === "up") {
    R(26, 30, 5, 14, BR_SUIT);
    R(26, 30, 2, 14, BR_SUIT_D);
    R(26, 26, 5, 5, BR_SKIN);
    R(49, 30, 5, 14, BR_SUIT);
    R(52, 30, 2, 14, BR_SUIT_D);
    R(49, 26, 5, 5, BR_SKIN);
  } else {
    // braços mais cheios (6px) com rim de luz + punho + mão
    R(24, 44, 6, 13, BR_SUIT);
    R(24, 44, 2, 13, BR_SUIT_L); // rim (luz vem da esq.)
    R(28, 45, 2, 12, BR_SUIT_D); // sombra interna
    R(24, 54, 6, 2, BR_BLOUSE); // punho
    R(25, 56, 5, 3, BR_SKIN);
    P(26, 57, BR_GOLD); // anel
    R(50, 44, 6, 13, BR_SUIT);
    R(54, 44, 2, 13, BR_SUIT_D); // sombra
    R(50, 44, 1, 12, BR_SUIT_DD);
    R(50, 54, 6, 2, BR_BLOUSE);
    R(51, 56, 5, 3, BR_SKIN);
  }

  // ===== PRANCHETA (arma-tema) =====
  if (arm !== "up") {
    const cy = arm === "point" ? 52 : 48;
    RR(31, cy, 18, 16, BR_CLIP, 1);
    R(31, cy, 18, 2, BR_CLIP_D);
    R(31, cy, 2, 16, BR_CLIP_D);
    R(47, cy, 2, 16, BR_CLIP_DD);
    R(35, cy - 2, 9, 3, BR_RED); // clipe
    R(35, cy - 2, 9, 1, [220, 120, 120]);
    R(34, cy + 4, 12, 1, BR_CLIP_DD);
    R(34, cy + 7, 12, 1, BR_CLIP_DD);
    R(34, cy + 10, 8, 1, BR_CLIP_DD);
    R(34, cy + 3, 2, 2, BR_CLIP_DD); // checkbox
    P(34, cy + 4, BR_RED);
    P(35, cy + 3, BR_RED);
    R(45, cy - 3, 2, 9, BR_PEN); // caneta
    R(45, cy - 4, 2, 2, BR_GOLD);
  }

  // ===== CABEÇA (grande, estilo herói) =====
  const fx = 40 + tilt;
  R(37, 40, 6, 4, BR_SKIN_D); // pescoço
  R(37, 40, 2, 4, BR_SKIN_DD); // AO do pescoço
  // ── cabelo de trás: silhueta escura + corpo + mechas (3 tons, não bloco) ──
  RR(fx - 16, 5, 32, 35, BR_HAIR_D, 8);
  RR(fx - 15, 6, 30, 32, BR_HAIR, 7);
  R(fx - 12, 8, 3, 13, BR_HAIR_L); // mecha de brilho esq.
  R(fx - 8, 7, 2, 9, BR_HAIR_L);
  R(fx + 7, 9, 2, 11, BR_HAIR_MID); // mecha lateral dir.
  R(fx + 11, 12, 2, 10, BR_HAIR_D);
  // ── rosto (bochecha cheia, luz esq. / sombra dir.) ──
  RR(fx - 11, 20, 22, 22, BR_SKIN, 4);
  R(fx + 5, 22, 6, 18, BR_SKIN_D); // sombra lado dir.
  R(fx + 8, 25, 3, 12, BR_SKIN_DD); // AO mais profundo
  R(fx - 10, 21, 5, 3, BR_SKIN_L); // luz testa
  R(fx - 10, 25, 2, 11, BR_SKIN_L); // rim de luz na bochecha esq.
  P(fx - 8, 33, [232, 200, 170]); // brilho da bochecha
  // nariz
  R(fx - 1, 31, 2, 4, BR_SKIN_D);
  P(fx - 1, 35, BR_SKIN_DD);
  P(fx + 1, 34, BR_SKIN_DD);
  // ── franja + costeletas sobre o rosto ──
  RR(fx - 12, 13, 24, 11, BR_HAIR, 5);
  R(fx - 12, 13, 11, 3, BR_HAIR_L); // brilho da franja
  R(fx - 6, 14, 4, 2, BR_HAIR_MID);
  R(fx - 12, 19, 3, 19, BR_HAIR); // costeleta esq.
  R(fx + 9, 19, 3, 19, BR_HAIR); // costeleta dir.
  R(fx + 10, 19, 2, 19, BR_HAIR_D);
  R(fx - 12, 22, 1, 14, BR_HAIR_MID); // mecha na costeleta
  // ── coque alto ──
  RR(fx - 5, 0, 13, 9, BR_HAIR, 4);
  R(fx - 3, 1, 6, 2, BR_HAIR_L);
  R(fx - 5, 6, 13, 1, BR_HAIR_D); // base do coque (sombra)
  R(fx - 6, 5, 2, 3, BR_HAIR_D); // presilha
  // ── brincos (argola) ──
  P(fx - 11, 33, BR_GOLD);
  P(fx - 11, 35, BR_GOLD_D);
  P(fx - 12, 34, BR_GOLD_D);
  P(fx + 10, 33, BR_GOLD);
  P(fx + 10, 35, BR_GOLD_D);
  // ── sobrancelhas ──
  R(fx - 7, 25, 4, 1, BR_HAIR_D);
  R(fx + 3, 25, 4, 1, BR_HAIR_D);
  // ── óculos REDONDOS (aro + lente + reflexo diagonal + olho) ──
  const lens = (lx, ly) => {
    RR(lx, ly, 7, 7, BR_GLASS, 2);
    RR(lx + 1, ly + 1, 5, 5, BR_LENS, 1);
    P(lx + 1, ly + 1, BR_GLASS_L); // reflexo (canto sup-esq.)
    P(lx + 2, ly + 1, BR_GLASS_L);
    R(lx + 3, ly + 3, 2, 2, BR_HAIR_D); // olho
    P(lx + 3, ly + 3, [30, 24, 30]);
  };
  lens(fx - 8, 27);
  lens(fx + 2, 27);
  R(fx - 1, 29, 2, 1, BR_GLASS); // ponte
  // ── blush + batom ──
  R(fx - 8, 36, 3, 2, BR_BLUSH);
  R(fx + 6, 36, 3, 2, BR_BLUSH);
  if (pose.mouth) {
    R(fx - 2, 38, 5, 3, [120, 40, 50]); // boca aberta
    R(fx - 2, 38, 5, 1, BR_LIP);
    P(fx - 1, 40, [90, 30, 38]);
  } else {
    R(fx - 2, 38, 5, 1, BR_LIP);
    P(fx - 2, 39, BR_LIP);
    P(fx + 2, 39, BR_LIP);
  }
  // ── RIM LIGHT quente no topo-esq. do cabelo (keyline da casa) ──
  R(fx - 5, 0, 8, 1, BR_HAIR_RIM); // topo do coque
  R(fx - 16, 6, 2, 4, BR_HAIR_RIM); // ombro-esq. do cabelo
  P(fx - 15, 10, BR_HAIR_RIM);
  P(fx - 14, 13, BR_HAIR_RIM);

  addOutline(c, BR_OUT);
  return c.save(name);
}

// Registro: [nome-para-filtro, função]
const SPRITES = [
  ["brenda", () => brendaFrame("enemy-brenda-idle0.png", { drop: 0 })],
  ["brenda", () => brendaFrame("enemy-brenda-idle1.png", { drop: 1 })],
  ["brenda", () => brendaFrame("enemy-brenda-idle2.png", { drop: 0, tilt: 1 })],
  ["brenda", () => brendaFrame("enemy-brenda-walk0.png", { step: 1 })],
  ["brenda", () => brendaFrame("enemy-brenda-walk1.png", { step: 0, drop: 1 })],
  ["brenda", () => brendaFrame("enemy-brenda-walk2.png", { step: -1 })],
  ["brenda", () => brendaFrame("enemy-brenda-walk3.png", { step: 0, drop: 1 })],
  ["brenda", () => brendaFrame("enemy-brenda-attack0.png", { arm: "point", mouth: true })],
  ["brenda", () => brendaFrame("enemy-brenda-attack1.png", { arm: "point", mouth: true, tilt: 1 })],
  [
    "brenda",
    () => brendaFrame("enemy-brenda-hurt0.png", { arm: "up", drop: 1, tilt: -1, mouth: true }),
  ],
  ["brenda", () => brendaFrame("enemy-brenda-death0.png", { arm: "up", drop: 4, mouth: true })],
  ["brenda", () => brendaFrame("enemy-brenda-death1.png", { arm: "up", drop: 9 })],
  ["brenda", () => brendaFrame("enemy-brenda-death2.png", { arm: "rest", drop: 14 })],

  ["analista-novo", analistaNovoWalk3],
  ["bebedouro", bebedouro],
  ["guardiao-cafe", () => guardiaoCafeFrame("enemy-guardiao-cafe.png", 0)],
  ["guardiao-cafe", () => guardiaoCafeFrame("enemy-guardiao-cafe-walk0.png", 0)],
  ["guardiao-cafe", () => guardiaoCafeFrame("enemy-guardiao-cafe-walk1.png", 1)],
  ["guardiao-cafe", () => guardiaoCafeFrame("enemy-guardiao-cafe-walk2.png", 2)],
  ["guardiao-cafe", () => guardiaoCafeFrame("enemy-guardiao-cafe-walk3.png", 3)],
  ["reuniao", () => reuniaoFrame("enemy-reuniao.png")],
  ["reuniao", () => reuniaoFrame("enemy-reuniao-idle0.png")],
  ["postit", () => postit(0)],
  ["postit", () => postit(1)],
  ["postit", () => postit(2)],
  ["coffee", () => coffeeDrop(0)],
  ["coffee", () => coffeeDrop(1)],
  ["coffee", () => coffeeDrop(2)],
  ["coffee", coffeeStatic],
  ["tile", floorTile],
  ["tile", platformTile],
  ["vr", () => vrCoinFrame(0, "item-vr-coin.png")],
  ["vr", () => vrCoinFrame(0, "item-vr-coin-active0.png")],
  ["vr", () => vrCoinFrame(1, "item-vr-coin-active1.png")],
  ["vr", () => vrCoinFrame(2, "item-vr-coin-active2.png")],
  ["email", () => emailFrame(0)],
  ["email", () => emailFrame(1)],
  ["convite", () => conviteFrame(0)],
  ["convite", () => conviteFrame(1)],
  ["convite", () => conviteFrame(2)],
  ["fase5", carimbador],
  ["fase5", arquivo],
  ["fase5", bateria],
];

async function main() {
  const filter = process.argv[2];
  const todo = SPRITES.filter(([tag]) => !filter || tag.includes(filter));
  await Promise.all(todo.map(([, fn]) => fn()));
  console.log(
    `Gerados ${todo.length} sprite(s)${filter ? ` (filtro: ${filter})` : ""}. Rode 'node scripts/pack-atlas.mjs' para re-empacotar.`,
  );
}

// Só executa se chamado direto (permite importar canvas() em outros scripts).
if (process.argv[1] === fileURLToPath(import.meta.url))
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
