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
  // ── garrafão de água (invertido), com ombro e volume ──
  for (let r = 0; r < 20; r++) {
    // silhueta: pescoço estreito embaixo, corpo largo, topo arredondado
    const round = r < 2 ? 2 - r : r > 16 ? r - 16 : 0;
    R(8 + round, 4 + r, 16 - round * 2, 1, WATER);
  }
  R(8, 4, 16, 2, WATER_L); // linha do ar (topo claro)
  R(8, 4, 1, 20, WATER_D);
  R(23, 4, 1, 20, WATER_D); // laterais em sombra
  R(10, 7, 2, 14, WATER_L); // realce vertical (vidro)
  R(20, 9, 1, 10, [200, 230, 250, 120]); // segundo realce fino
  // bolhas subindo (dá vida ao objeto parado)
  R(14, 12, 1, 1, WATER_L);
  R(17, 16, 1, 1, WATER_L);
  R(13, 19, 1, 1, WATER_L);
  R(12, 24, 8, 2, BOTTLE_CAP); // gargalo/colarinho
  R(12, 24, 8, 1, [110, 130, 152]);
  // ── gabinete ──
  R(6, 26, 20, 20, CABINET);
  R(6, 26, 20, 1, [244, 246, 248]); // tampo iluminado
  R(6, 26, 2, 20, CAB_D);
  R(24, 26, 2, 20, CAB_D); // laterais
  R(6, 44, 20, 2, CAB_SH); // rodapé em sombra
  R(7, 46, 3, 2, CAB_SH);
  R(22, 46, 3, 2, CAB_SH); // pezinhos
  // nicho de serviço (recuo escuro onde ficam as torneiras)
  R(9, 31, 14, 10, [196, 200, 206]);
  R(9, 31, 14, 1, CAB_SH);
  R(9, 31, 1, 10, CAB_SH);
  // ── torneiras (fria/quente), com bico e pingo ──
  R(11, 33, 4, 3, TAP_COLD);
  R(11, 33, 4, 1, [140, 180, 240]);
  R(17, 33, 4, 3, TAP_HOT);
  R(17, 33, 4, 1, [240, 140, 130]);
  R(12, 36, 2, 3, [80, 84, 92]);
  R(18, 36, 2, 3, [80, 84, 92]); // bicos
  R(12, 39, 1, 1, WATER_L); // pingo
  // grelha da bandeja de pingo
  R(10, 41, 12, 2, TRAY);
  for (let i = 0; i < 5; i++) R(11 + i * 2, 41, 1, 2, [110, 116, 124]);
  // suporte de copinhos na lateral
  R(25, 30, 3, 9, CAB_D);
  R(26, 31, 1, 7, CUP);
  addOutline(c, OBJ_OUT);
  c.save("obj-bebedouro.png");
  return c.save("obj-bebedouro-idle.png");
}

// ── Baia / divisória de open space (64×40) ───────────────────────────────────
// O sprite anterior era dois retângulos cinzas hachurados + uma barra bege: lia
// como "placeholder", sem profundidade nem leitura de escritório. Redesenhado
// como divisória de tecido com trama, montante metálico, tampo de mesa saindo
// à frente e um monitorzinho + papéis espiando por cima.
const FAB = [104, 116, 132],
  FAB_D = [76, 86, 100],
  FAB_L = [128, 142, 160],
  RAIL = [176, 182, 192],
  RAIL_D = [120, 126, 136],
  DESK = [178, 142, 92],
  DESK_D = [132, 100, 60],
  SCRN_OFF = [40, 48, 58];
function baia() {
  const W = 64,
    H = 40,
    c = canvas(W, H);
  const R = (x, y, w, h, col) => c.rect(x, y, w, h, col);
  // painel de tecido com trama (dither 2px) — dá textura sem virar hachura chapada
  R(2, 8, 60, 24, FAB);
  for (let y = 8; y < 32; y++)
    for (let x = 2; x < 62; x++) if ((x + y) % 4 === 0) c.px(x, y, FAB_D);
  R(2, 8, 60, 1, FAB_L); // topo do tecido pega a luz
  R(2, 30, 60, 2, FAB_D); // base em sombra
  // trilho de alumínio do topo
  R(1, 5, 62, 3, RAIL);
  R(1, 5, 62, 1, [206, 212, 220]);
  R(1, 7, 62, 1, RAIL_D);
  // montantes verticais (divide em dois postos de trabalho)
  R(31, 5, 2, 27, RAIL_D);
  R(1, 8, 1, 24, RAIL_D);
  R(62, 8, 1, 24, RAIL_D);
  // monitor espiando por cima do painel esquerdo
  R(9, 0, 14, 6, SCRN_OFF);
  R(10, 1, 12, 4, [58, 70, 84]);
  R(15, 6, 2, 2, RAIL_D);
  // papéis pregados no painel direito
  R(40, 13, 7, 8, [238, 236, 226]);
  for (let i = 0; i < 3; i++) R(41, 15 + i * 2, 5, 1, [176, 174, 166]);
  R(50, 16, 5, 6, [246, 216, 96]); // post-it
  // tampo da mesa saindo à frente + sombra no chão
  R(0, 32, 64, 4, DESK);
  R(0, 32, 64, 1, [206, 172, 120]);
  R(0, 35, 64, 1, DESK_D);
  R(4, 36, 56, 2, [0, 0, 0, 60]);
  addOutline(c, OBJ_OUT);
  return c.save("obj-baia.png");
}

// ── Máquina de café (40×48) ──────────────────────────────────────────────────
// O frame do atlas estava quase vazio (borrão semitransparente = lixo de
// extração). Redesenhada como máquina de bebidas de escritório legível.
function cafeMachine() {
  const W = 40,
    H = 48,
    c = canvas(W, H);
  const R = (x, y, w, h, col) => c.rect(x, y, w, h, col);
  const BODY = [92, 96, 108],
    BODY_L = [132, 138, 150],
    BODY_D = [58, 62, 72],
    PANEL = [34, 40, 46];
  R(6, 2, 28, 44, BODY); // corpo
  R(6, 2, 28, 2, BODY_L);
  R(6, 2, 2, 44, BODY_L);
  R(32, 2, 2, 44, BODY_D);
  R(6, 44, 28, 2, BODY_D);
  R(7, 46, 4, 2, BODY_D);
  R(29, 46, 4, 2, BODY_D); // pés
  // painel superior com display e botões de bebida
  R(9, 6, 22, 9, PANEL);
  R(11, 8, 10, 5, [34, 70, 56]); // display
  R(12, 10, 6, 1, [120, 240, 150]);
  R(24, 8, 2, 2, [230, 190, 90]);
  R(27, 8, 2, 2, [200, 90, 80]);
  R(24, 11, 2, 2, [120, 190, 230]);
  R(27, 11, 2, 2, [180, 180, 190]);
  // seleção de canecas (adesivo)
  R(9, 17, 22, 8, [216, 214, 206]);
  for (let i = 0; i < 3; i++) {
    R(11 + i * 7, 19, 4, 4, CUP);
    R(11 + i * 7, 19, 4, 1, LID);
  }
  // nicho de dispensa (fundo escuro dá profundidade)
  R(9, 27, 22, 14, [26, 28, 34]);
  R(9, 27, 22, 1, BODY_D);
  R(16, 28, 8, 3, BODY_D); // bico
  R(19, 31, 2, 2, BREW); // café caindo
  R(15, 34, 10, 6, CUP); // copo na bandeja
  R(15, 34, 10, 1, CUP_L);
  R(16, 36, 8, 3, BREW);
  R(10, 40, 20, 2, [150, 156, 164]); // grelha
  for (let i = 0; i < 9; i++) R(11 + i * 2, 40, 1, 2, [96, 100, 108]);
  addOutline(c, OBJ_OUT);
  c.save("obj-cafe-machine.png");
  return c.save("obj-cafe-machine-idle.png");
}

// ── Monitor de mesa (48×40) ──────────────────────────────────────────────────
// O `obj-monitor-idle` era uma cena de mesa inteira em 97×70 desenhada em outra
// escala; o jogo a espremia p/ 34×26 e virava borrão. Redesenhado no tamanho da
// própria família (48×40) como monitor limpo com planilha na tela.
function monitorMesa() {
  const W = 48,
    H = 40,
    c = canvas(W, H);
  const R = (x, y, w, h, col) => c.rect(x, y, w, h, col);
  const CASE = [58, 62, 72],
    CASE_L = [92, 98, 110],
    CASE_D = [34, 36, 44],
    SCR = [96, 148, 180],
    SCR_D = [58, 104, 138];
  R(4, 2, 40, 28, CASE); // carcaça
  R(4, 2, 40, 1, CASE_L);
  R(4, 2, 1, 28, CASE_L);
  R(43, 2, 1, 28, CASE_D);
  R(4, 29, 40, 1, CASE_D);
  R(7, 5, 34, 20, SCR); // tela
  R(7, 5, 34, 1, [150, 200, 226]);
  // planilha: cabeçalho + linhas + coluna destacada
  R(8, 6, 32, 3, [222, 230, 238]);
  for (let i = 0; i < 4; i++) R(9, 11 + i * 3, 30, 1, SCR_D);
  for (let i = 0; i < 5; i++) R(11 + i * 6, 6, 1, 19, [70, 120, 152]);
  R(30, 17, 8, 6, [96, 200, 140, 160]); // célula "meta batida"
  R(8, 22, 6, 2, [230, 120, 100, 180]); // célula vermelha
  R(9, 6, 3, 2, [255, 255, 255, 60]); // reflexo
  R(20, 30, 8, 4, CASE_D); // pescoço
  R(14, 34, 20, 3, CASE); // base
  R(14, 34, 20, 1, CASE_L);
  R(12, 37, 24, 1, [0, 0, 0, 70]); // sombra de contato
  addOutline(c, OBJ_OUT);
  return c.save("obj-monitor-idle.png");
}

// ── Quadro motivacional (48×56) ──────────────────────────────────────────────
// O frame era 132×81 com texto falso ilegível, espremido pelo jogo p/ 48×56.
// Redesenhado no tamanho REAL de exibição, com pictograma (gráfico subindo)
// em vez de texto fake — lê à distância e não vira borrão.
function quadroMotivacional() {
  const W = 48,
    H = 56,
    c = canvas(W, H);
  const R = (x, y, w, h, col) => c.rect(x, y, w, h, col);
  const FR = [96, 70, 40],
    FR_L = [138, 102, 58],
    FR_D = [62, 44, 24],
    MAT = [238, 234, 222],
    SKY = [58, 92, 128],
    SKY_L = [96, 138, 176],
    BAR = [232, 190, 84],
    ARROW = [236, 96, 72];
  R(1, 2, 46, 50, FR); // moldura
  R(1, 2, 46, 2, FR_L);
  R(1, 2, 2, 50, FR_L);
  R(45, 2, 2, 50, FR_D);
  R(1, 50, 46, 2, FR_D);
  R(4, 5, 40, 44, MAT); // passe-partout
  R(6, 7, 36, 30, SKY); // "arte": céu
  R(6, 7, 36, 8, SKY_L);
  // barras crescentes + seta (pictograma de meta)
  for (let i = 0; i < 5; i++) R(9 + i * 6, 33 - i * 4, 4, 4 + i * 4, BAR);
  for (let i = 0; i < 10; i++) c.px(9 + i * 3, 31 - i * 2, ARROW);
  R(34, 10, 4, 4, ARROW); // ponta da seta
  R(36, 10, 2, 6, ARROW);
  // "legenda" abstrata (blocos, não texto fake ilegível)
  R(10, 40, 28, 2, [150, 146, 138]);
  R(15, 44, 18, 2, [186, 182, 174]);
  R(3, 52, 42, 1, [0, 0, 0, 60]); // sombra sob a moldura
  addOutline(c, OBJ_OUT);
  return c.save("obj-quadro-motivacional-idle.png");
}


// ── Brenda do RH (boss da Fase 3) — DERIVADA do enemy-rh ──────────────────────
// Máxima fidelidade: em vez de redesenhar em código (fica chapado), derivamos a
// Brenda da ARTE pintada à mão do inimigo `enemy-rh` e só RECOLORIMOS o blazer
// (vermelho → magenta) — herda cabelo/óculos/rosto/sombreamento/animação da casa.
// O mob vermelho de RH só aparece na Fase 1/Copa, então não conflita com ela.

// Recolore frames-fonte `enemy-${src}-*.png` p/ `enemy-${out}-*.png` trocando a
// cor da roupa via remap(r,g,b,a) -> [r,g,b] | null (null = mantém o pixel).
async function recolorFrames(src, out, frames, remap) {
  await Promise.all(
    frames.map(async (fr) => {
      const { data, info } = await sharp(DIR + `enemy-${src}-${fr}.png`)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      for (let p = 0; p < data.length; p += 4) {
        const o = remap(data[p], data[p + 1], data[p + 2], data[p + 3]);
        if (o) {
          data[p] = o[0];
          data[p + 1] = o[1];
          data[p + 2] = o[2];
        }
      }
      await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
        .png()
        .toFile(DIR + `enemy-${out}-${fr}.png`);
    }),
  );
}
// blazer vermelho → magenta (preserva luminância/sombreamento)
const remapRedToMagenta = (r, g, b, a) =>
  a >= 8 && r > 70 && r > g * 1.6 && r > b * 1.4
    ? [
        Math.min(255, Math.round(r * 0.96)),
        Math.round(g * 0.75),
        Math.min(255, Math.round(r * 0.66)),
      ]
    : null;
const BRENDA_FRAMES = [
  "idle0",
  "idle1",
  "idle2",
  "walk0",
  "walk1",
  "walk2",
  "walk3",
  "attack0",
  "attack1",
  "hurt0",
  "death0",
  "death1",
  "death2",
];

// Tinge pixels médio-escuros (roupa/cabelo) por luminância p/ um alvo, preservando
// pele/realces claros e o contorno. Deriva bosses de fontes de roupa ESCURA
// (evangelista/coordenador/scrum), onde recolor por matiz não isola a roupa.
const tintDark = (mr, mg, mb) => (r, g, b, a) => {
  if (a < 8) return null;
  const L = (r + g + b) / 3;
  if (L < 20 || L > 120) return null; // contorno/preto e pele/realce: mantém
  return [
    Math.min(255, Math.round(L * mr)),
    Math.min(255, Math.round(L * mg)),
    Math.min(255, Math.round(L * mb)),
  ];
};
// prettier-ignore
const EVANG_FRAMES = ["attack0","attack1","attack2","death0","death1","death2","death3","hurt0","hurt1","idle0","idle1","walk0","walk1","walk2"];
// prettier-ignore
const COORD_FRAMES = ["attack0","attack1","attack2","death0","death1","death2","hurt0","idle0","idle1","idle2","idle3","walk0","walk1","walk2","walk3"];
// prettier-ignore
const SCRUM_FRAMES = ["attack0","attack1","attack2","death0","death1","death2","hurt0","idle0","idle1","idle2","idle3","walk0","walk1","walk2","walk3","walk4","walk5"];

// Registro: [nome-para-filtro, função]
// ── Porta da Copa (Fase 1) — 36×60 ───────────────────────────────────────────
// Era um retângulo tintado + texto "[BLOQUEADO]". Vira uma porta de escritório
// legível: batente, dois painéis, janela de vidro aramado com luz quente, maçaneta
// e uma plaquinha. A cena usa tint cinza p/ o estado BLOQUEADO e clearTint p/ o
// DESBLOQUEADO — então desenho a versão "acesa" (quente), que o tint escurece.
function copaDoor() {
  const W = 36,
    H = 60,
    c = canvas(W, H);
  const FRAME = [70, 52, 34],
    FRAME_D = [48, 34, 20],
    FRAME_L = [104, 78, 50];
  const PANEL = [150, 108, 66],
    PANEL_D = [120, 84, 48],
    PANEL_L = [178, 134, 86];
  const GLASS = [120, 196, 210],
    GLASS_L = [190, 236, 240],
    GLOW = [255, 226, 150];
  const HANDLE = [212, 196, 120],
    HANDLE_D = [150, 132, 70];

  // batente externo
  c.rect(2, 1, 32, 58, FRAME);
  c.rect(2, 1, 32, 2, FRAME_L); // topo iluminado
  c.rect(2, 1, 2, 58, FRAME_L); // lateral esq iluminada
  c.rect(32, 1, 2, 58, FRAME_D); // lateral dir sombra
  c.rect(2, 57, 32, 2, FRAME_D);

  // folha da porta (recuo do batente)
  c.rect(5, 3, 26, 54, PANEL);
  c.rect(5, 3, 26, 1, PANEL_L);
  c.rect(5, 3, 1, 54, PANEL_L);
  c.rect(30, 3, 1, 54, PANEL_D);

  // janela de vidro aramado (parte de cima) com luz quente vazando
  c.rect(9, 8, 18, 16, GLASS);
  c.rect(9, 8, 18, 1, GLASS_L);
  for (let i = 0; i < 3; i++) c.hline(9, 11 + i * 4, 18, [90, 150, 168, 120]); // grade h
  for (let i = 0; i < 3; i++) c.rect(14 + i * 5, 8, 1, 16, [90, 150, 168, 120]); // grade v
  // brilho quente da Copa vazando pelo vidro
  c.rect(11, 18, 14, 5, GLOW);
  c.rect(13, 20, 10, 3, [255, 240, 190]);
  c.rect(9, 7, 18, 1, FRAME_D); // moldura da janela
  c.rect(9, 24, 18, 1, FRAME_D);

  // painel inferior (almofadado)
  c.rect(9, 30, 18, 22, PANEL_D);
  c.rect(11, 32, 14, 18, PANEL);
  c.rect(11, 32, 14, 1, PANEL_L);
  c.rect(11, 32, 1, 18, PANEL_L);

  // maçaneta
  c.rect(26, 38, 3, 3, HANDLE);
  c.px(26, 40, HANDLE_D);
  c.rect(27, 41, 1, 4, HANDLE_D);

  // plaquinha da Copa (☕) acima da janela
  c.rect(13, 4, 10, 3, [60, 60, 66]);
  c.rect(14, 5, 8, 1, [200, 200, 210]);

  addOutline(c, OBJ_OUT);
  return c.save("obj-door.png");
}


// ── Ponto Eletrônico (Copa) — 28×40 ──────────────────────────────────────────
// Era um retângulo branco chapado com dígitos verdes soltos (lia como "erro de
// extração", não como objeto). Vira um relógio de ponto de parede: carcaça
// bege-industrial com chanfro, visor LCD escuro com 18:00 em verde, LED de
// status, fenda do cartão, leitor de crachá e parafusos.
function pontoEletronico() {
  const W = 28,
    H = 40,
    c = canvas(W, H);
  const CASE = [176, 172, 160],
    CASE_L = [214, 210, 198],
    CASE_D = [116, 112, 104],
    CASE_DD = [78, 75, 70];
  const BEZEL = [46, 48, 52],
    LCD = [16, 34, 26],
    LED = [96, 230, 120],
    LED_D = [40, 140, 66];
  const RED = [232, 72, 56],
    SLOT = [30, 30, 34],
    SCREW = [140, 136, 128];

  // carcaça (com chanfro nos cantos → não parece bloco)
  c.rect(3, 1, 22, 37, CASE);
  c.rect(3, 1, 22, 2, CASE_L); // topo iluminado
  c.rect(3, 1, 2, 37, CASE_L); // lateral esq
  c.rect(23, 1, 2, 37, CASE_D); // lateral dir
  c.rect(3, 36, 22, 2, CASE_DD); // base em sombra
  c.px(3, 1, [0, 0, 0, 0]);
  c.px(24, 1, [0, 0, 0, 0]);
  c.px(3, 37, [0, 0, 0, 0]);
  c.px(24, 37, [0, 0, 0, 0]);

  // visor: moldura + LCD
  c.rect(4, 5, 20, 11, BEZEL);
  c.rect(5, 6, 18, 9, LCD);
  // "18:00" em segmentos de 3px (dois dígitos, dois pontos, dois dígitos)
  const digit = (x, seg) => {
    // seg: [topo, cima-esq, cima-dir, meio, baixo-esq, baixo-dir, base]
    if (seg[0]) c.hline(x, 7, 3, LED);
    if (seg[3]) c.hline(x, 10, 3, LED);
    if (seg[6]) c.hline(x, 13, 3, LED);
    if (seg[1]) c.rect(x, 8, 1, 2, LED);
    if (seg[2]) c.rect(x + 2, 8, 1, 2, LED);
    if (seg[4]) c.rect(x, 11, 1, 2, LED);
    if (seg[5]) c.rect(x + 2, 11, 1, 2, LED);
  };
  const ONE = [0, 0, 1, 0, 0, 1, 0],
    EIGHT = [1, 1, 1, 1, 1, 1, 1],
    ZERO = [1, 1, 1, 0, 1, 1, 1];
  digit(6, ONE);
  digit(10, EIGHT);
  c.px(14, 9, LED_D);
  c.px(14, 12, LED_D);
  digit(16, ZERO);
  digit(20, ZERO);
  // reflexo diagonal no vidro
  c.px(6, 14, [255, 255, 255, 40]);
  c.px(7, 13, [255, 255, 255, 30]);

  // LED de status + rótulo gravado
  c.rect(6, 18, 2, 2, RED);
  c.px(6, 18, [255, 160, 150]);
  c.rect(10, 18, 12, 1, CASE_D); // linha "PONTO" gravada
  c.rect(10, 20, 8, 1, CASE_D);

  // fenda do cartão (com relevo)
  c.rect(6, 24, 16, 3, SLOT);
  c.hline(6, 23, 16, CASE_DD);
  c.hline(6, 27, 16, CASE_L);

  // leitor de crachá (área fosca) + parafusos
  c.rect(8, 30, 12, 5, CASE_D);
  c.rect(9, 31, 10, 3, [150, 146, 138]);
  c.px(5, 32, SCREW);
  c.px(22, 32, SCREW);
  c.px(5, 4, SCREW);
  c.px(22, 4, SCREW);

  addOutline(c, OBJ_OUT);
  return c.save("obj-ponto.png");
}

const SPRITES = [
  ["door", copaDoor],
  ["ponto", pontoEletronico],
  ["brenda", () => recolorFrames("rh", "brenda", BRENDA_FRAMES, remapRedToMagenta)],
  // Diretor (F5): fonte evangelista-boss → aço/navy (executivo frio)
  [
    "diretor",
    () => recolorFrames("evangelista-boss", "diretor", EVANG_FRAMES, tintDark(0.75, 0.9, 1.25)),
  ],
  // Coordenador boss (F2): fonte coordenador → teal (casa com a aura)
  [
    "coord-boss",
    () => recolorFrames("coordenador", "coord-boss", COORD_FRAMES, tintDark(0.55, 1.05, 1.2)),
  ],
  // Scrum boss (F4): fonte scrum → roxo (casa com a aura)
  [
    "scrum-boss",
    () => recolorFrames("scrum", "scrum-boss", SCRUM_FRAMES, tintDark(1.0, 0.6, 1.35)),
  ],
  ["analista-novo", analistaNovoWalk3],
  ["bebedouro", bebedouro],
  ["baia", baia],
  ["cafe-machine", cafeMachine],
  ["monitor", monitorMesa],
  ["quadro", quadroMotivacional],
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
