import Phaser from "phaser";

/**
 * TextureFactory — runtime-generated pixel-art textures.
 * All keys are stable so scenes don't need to know origin.
 *
 * Style: 3-tone ramps, 1px warm-dark outlines, top-edge highlights.
 */

const OUTLINE = 0x14100a;

// ─── Platform definition (exported so all scenes share the same sizes) ─────────
export interface PlatDef {
  surf: string;
  body: string;
  height: number; // total height from floor to top surface (includes 14px surface tile)
}
export const PLAT_DEFS: PlatDef[] = [
  { surf: "tex-mesa",       body: "tex-mesa-body",       height: 30 }, // desk
  { surf: "tex-estante",    body: "tex-estante-body",    height: 72 }, // bookshelf
  { surf: "tex-armario",    body: "tex-armario-body",    height: 50 }, // filing cabinet
  { surf: "tex-impressora", body: "tex-impressora-body", height: 30 }, // printer stand
];

// ─── Office background themes ─────────────────────────────────────────────────
interface OfficeTheme {
  wall: number;
  wallDark: number;
  sky: number;
  skyLight: number;
  accent: number;
  floorDark: number;
  ceilingColor: number;
  lightColor: number;
}

const OFFICE_THEMES: Record<string, OfficeTheme> = {
  openspace:   { wall: 0x3a4150, wallDark: 0x282f3c, sky: 0x6478a0, skyLight: 0x88a0c8, accent: 0x3a5a8a, floorDark: 0x181e28, ceilingColor: 0x18202c, lightColor: 0xd0e4f8 },
  atendimento: { wall: 0x4a4038, wallDark: 0x342c26, sky: 0x7a6858, skyLight: 0x9a8878, accent: 0x8a4a2a, floorDark: 0x1c1510, ceilingColor: 0x1c1610, lightColor: 0xf0e0c8 },
  comercial:   { wall: 0x384840, wallDark: 0x28342e, sky: 0x5a8070, skyLight: 0x7aa898, accent: 0x286848, floorDark: 0x141c1a, ceilingColor: 0x141c18, lightColor: 0xc8f0e0 },
  tecnologia:  { wall: 0x262e3e, wallDark: 0x18202e, sky: 0x304070, skyLight: 0x4060a8, accent: 0x3050d0, floorDark: 0x0e121e, ceilingColor: 0x0e1018, lightColor: 0xc0d4ff },
  diretoria:   { wall: 0x3a2e44, wallDark: 0x281e32, sky: 0x584898, skyLight: 0x7868b8, accent: 0x5840b8, floorDark: 0x14101c, ceilingColor: 0x14101c, lightColor: 0xe8d8ff },
  cobertura:   { wall: 0x4c3e2a, wallDark: 0x38291a, sky: 0xd07820, skyLight: 0xf0a840, accent: 0xc89820, floorDark: 0x1a1008, ceilingColor: 0x1a1008, lightColor: 0xffe8a0 },
};

// ─── public API ───────────────────────────────────────────────────────────────

/** Generate pixel-art office backgrounds for each gameplay phase (1280×400). */
export function makeOfficeBackgrounds(scene: Phaser.Scene): void {
  Object.entries(OFFICE_THEMES).forEach(([name, theme]) => {
    drawOffice(scene, `pxbg-${name}`, theme);
  });
}

/** Furniture surfaces + bodies for platform tiles. */
export function makeFurnitureTextures(scene: Phaser.Scene): void {
  makeMesaSurf(scene, "tex-mesa");
  // tex-platform loaded from tile-platform.png in BootScene — do NOT regenerate here
  makeEstanteSurf(scene);
  makeImpressoraSurf(scene);
  makeVasoSurf(scene);

  makeMesaBody(scene);
  makeEstanteBody(scene);
  makeImpressoraBody(scene);
  makeVasoBody(scene);

  makeArmarioSurf(scene);
  makeArmarioBody(scene);
  makeCadeira(scene);
  // tex-planta-deco, tex-bebedouro-deco replaced by real sprites loaded in BootScene
  // tex-floor loaded from tile-floor.png in BootScene — do NOT regenerate here
}

/** UI / debug textures. */
export function makeUiTextures(scene: Phaser.Scene): void {
  const gr = scene.add.graphics();
  gr.fillStyle(0xffffff, 0.35);
  gr.fillRect(0, 0, 28, 24);
  gr.lineStyle(1, 0xffffff, 0.6);
  gr.strokeRect(0, 0, 28, 24);
  gr.generateTexture("tex-hitbox", 28, 24);
  gr.destroy();
}

/**
 * Generate pixel-art textures for interactive office objects
 * that don't have PNG sprites yet.
 */
export function makeObjectTextures(scene: Phaser.Scene): void {
  makeExtintor(scene);
  // tex-quadro-motivacional, tex-pilha-docs, tex-caixa-papel,
  // tex-planta-deco, tex-bebedouro-deco now loaded from PNG sprites in BootScene
}

/** tex-quadro-motivacional (48×56): motivational poster on wall */
function makeQuadroMotivacional(scene: Phaser.Scene) {
  const gr = scene.add.graphics();
  // Dark frame border (4px all sides)
  gr.fillStyle(0x1a1a1a, 1);
  gr.fillRect(0, 0, 48, 56);
  // Cream background inside
  gr.fillStyle(0xf0ead0, 1);
  gr.fillRect(4, 4, 40, 48);
  // Blue bar — "FOCO"
  gr.fillStyle(0x2a3a8a, 1);
  gr.fillRect(4, 8, 40, 10);
  // Red bar — "DISCIPLINA"
  gr.fillStyle(0x8a2a2a, 1);
  gr.fillRect(4, 22, 40, 10);
  // Green bar — "EXECUÇÃO"
  gr.fillStyle(0x2a8a2a, 1);
  gr.fillRect(4, 36, 40, 10);
  // White pixel-art text-like dots on each bar
  gr.fillStyle(0xffffff, 0.8);
  // FOCO bar stripes
  for (let x = 7; x < 41; x += 6) { gr.fillRect(x, 10, 3, 5); }
  // DISCIPLINA bar stripes
  for (let x = 7; x < 41; x += 4) { gr.fillRect(x, 24, 2, 5); }
  // EXECUÇÃO bar stripes
  for (let x = 7; x < 41; x += 5) { gr.fillRect(x, 38, 3, 5); }
  // Thin lines between sections (decorative)
  gr.fillStyle(0xc8c0a8, 1);
  gr.fillRect(4, 18, 40, 2);
  gr.fillRect(4, 32, 40, 2);
  gr.fillRect(4, 46, 40, 2);
  gr.generateTexture("tex-quadro-motivacional", 48, 56);
  gr.destroy();
}

/** tex-extintor (20×44): red fire extinguisher */
function makeExtintor(scene: Phaser.Scene) {
  const gr = scene.add.graphics();
  // Head/valve (gray, 10×8 centered at top)
  gr.fillStyle(0x888888, 1);
  gr.fillRect(5, 2, 10, 8);
  gr.fillStyle(0xaaaaaa, 1);
  gr.fillRect(6, 2, 4, 2); // valve highlight
  // Nozzle hose (dark, offset right)
  gr.fillStyle(0x333333, 1);
  gr.fillRect(14, 4, 4, 10);
  // Body (red, 16×28 centered)
  gr.fillStyle(0xdd2222, 1);
  gr.fillRect(2, 8, 16, 28);
  // Body highlight
  gr.fillStyle(0xee5555, 1);
  gr.fillRect(3, 9, 4, 24);
  // Black band
  gr.fillStyle(0x111111, 1);
  gr.fillRect(2, 22, 16, 4);
  // Base
  gr.fillStyle(0xaa1111, 1);
  gr.fillRect(2, 36, 16, 6);
  gr.fillStyle(0xcc3333, 1);
  gr.fillRect(3, 36, 4, 5); // base highlight
  // Outline
  gr.fillStyle(OUTLINE, 1);
  gr.fillRect(2, 8, 1, 34);   // left
  gr.fillRect(17, 8, 1, 34);  // right
  gr.fillRect(2, 41, 16, 1);  // bottom
  gr.fillRect(5, 2, 1, 6);    // valve left
  gr.fillRect(14, 2, 1, 6);   // valve right
  gr.generateTexture("tex-extintor", 20, 44);
  gr.destroy();
}

/** tex-pilha-docs (40×24): stack of documents/papers */
function makePilhaDocs(scene: Phaser.Scene) {
  const gr = scene.add.graphics();
  // Bottom layer — slightly offset, slightly yellow
  gr.fillStyle(0xf0f0e8, 1);
  gr.fillRect(1, 18, 38, 6);
  gr.fillStyle(OUTLINE, 1);
  gr.fillRect(1, 18, 38, 1); gr.fillRect(1, 23, 38, 1);
  gr.fillRect(1, 18, 1, 6); gr.fillRect(38, 18, 1, 6);
  // Middle layer
  gr.fillStyle(0xfafaf2, 1);
  gr.fillRect(1, 12, 38, 6);
  gr.fillStyle(OUTLINE, 1);
  gr.fillRect(1, 12, 38, 1); gr.fillRect(1, 17, 38, 1);
  gr.fillRect(1, 12, 1, 6); gr.fillRect(38, 12, 1, 6);
  // Top layer (white with blue/red text lines)
  gr.fillStyle(0xffffff, 1);
  gr.fillRect(1, 6, 38, 6);
  gr.fillStyle(0x5080c0, 1);
  gr.fillRect(4, 8, 28, 2);   // blue text line
  gr.fillRect(4, 10, 20, 2);  // blue text line shorter
  gr.fillStyle(OUTLINE, 1);
  gr.fillRect(1, 6, 38, 1); gr.fillRect(1, 11, 38, 1);
  gr.fillRect(1, 6, 1, 6); gr.fillRect(38, 6, 1, 6);
  // Staple (gray rectangle top-left corner)
  gr.fillStyle(0x808080, 1);
  gr.fillRect(3, 7, 4, 2);
  gr.generateTexture("tex-pilha-docs", 40, 24);
  gr.destroy();
}

/** tex-caixa-papel (44×36): cardboard paper box (ream) */
function makeCaixaPapel(scene: Phaser.Scene) {
  const gr = scene.add.graphics();
  // Lid/top (slightly wider, lighter cardboard)
  gr.fillStyle(0xe8b860, 1);
  gr.fillRect(0, 0, 44, 10);
  gr.fillStyle(0xf0cc80, 1);
  gr.fillRect(1, 1, 42, 2); // lid highlight
  gr.fillStyle(OUTLINE, 1);
  gr.fillRect(0, 0, 44, 1); gr.fillRect(0, 9, 44, 1);
  gr.fillRect(0, 0, 1, 10); gr.fillRect(43, 0, 1, 10);
  // Box body (darker cardboard)
  gr.fillStyle(0xd4a050, 1);
  gr.fillRect(2, 10, 38, 26);
  // Side shadow
  gr.fillStyle(0xa07830, 1);
  gr.fillRect(34, 10, 6, 26); // right-side darker
  gr.fillStyle(0xd4a050, 1);
  // Label (white rectangle centered)
  gr.fillStyle(0xffffff, 1);
  gr.fillRect(8, 14, 28, 14);
  // Text lines on label
  gr.fillStyle(0x333333, 1);
  gr.fillRect(10, 17, 24, 2);
  gr.fillRect(10, 21, 20, 2);
  gr.fillRect(10, 25, 16, 2);
  // Box body outline
  gr.fillStyle(OUTLINE, 1);
  gr.fillRect(2, 10, 1, 26);  // left
  gr.fillRect(39, 10, 1, 26); // right
  gr.fillRect(2, 35, 38, 1);  // bottom
  gr.generateTexture("tex-caixa-papel", 44, 36);
  gr.destroy();
}

/** Apply LINEAR filter to photo backgrounds so they don't appear blocky. */
export function applyBackgroundFilters(scene: Phaser.Scene): void {
  const keys = [
    "bg-menu", "bg-openspace", "bg-atendimento", "bg-comercial", "bg-produto",
    "bg-tecnologia", "bg-rh", "bg-compliance", "bg-diretoria", "bg-presidencia",
    "bg-cobertura", "bg-copa",
  ];
  keys.forEach(k => {
    const tex = scene.textures.get(k);
    if (tex) (tex as any).setFilter(1);
  });
}

// ─── Background drawing ───────────────────────────────────────────────────────

function drawOffice(scene: Phaser.Scene, key: string, t: OfficeTheme): void {
  const W = 1280, H = 400;
  const gr = scene.add.graphics();

  // 1. Base wall
  gr.fillStyle(t.wall, 1);
  gr.fillRect(0, 0, W, H);

  // 2. Ceiling strip
  const CEIL = 22;
  gr.fillStyle(t.ceilingColor, 1);
  gr.fillRect(0, 0, W, CEIL);
  gr.fillStyle(t.wallDark, 1);
  gr.fillRect(0, CEIL, W, 3);

  // 3. Fluorescent lights along ceiling (every 160px)
  for (let lx = 80; lx < W; lx += 160) {
    gr.fillStyle(0x606070, 1);
    gr.fillRect(lx - 30, 12, 60, 10);      // fixture body
    gr.fillStyle(t.lightColor, 1);
    gr.fillRect(lx - 28, 13, 56, 8);       // bulb
    // downward glow (3 fading rects)
    gr.fillStyle(t.lightColor, 0.14);
    gr.fillRect(lx - 44, CEIL + 3, 88, 14);
    gr.fillStyle(t.lightColor, 0.07);
    gr.fillRect(lx - 64, CEIL + 17, 128, 12);
    gr.fillStyle(t.lightColor, 0.03);
    gr.fillRect(lx - 80, CEIL + 29, 160, 10);
  }

  // 4. Vertical structural columns (every 320px)
  for (let cx = 0; cx <= W; cx += 320) {
    gr.fillStyle(t.wallDark, 1);
    gr.fillRect(cx - 1, CEIL, 15, H - CEIL);
    // highlight inner edge
    gr.fillStyle(t.wall, 0.45);
    gr.fillRect(cx + 1, CEIL + 6, 3, H - CEIL - 80);
    // column cap
    gr.fillStyle(t.wallDark, 1);
    gr.fillRect(cx - 4, CEIL, 21, 7);
  }

  // 5. Windows (5 windows)
  const WW = 96, WH = 158, WT = 40;
  [68, 308, 548, 788, 1028].forEach(wx => {
    // outer shadow frame
    gr.fillStyle(t.wallDark, 1);
    gr.fillRect(wx - 7, WT - 7, WW + 14, WH + 14);
    // 4 sky panes
    const pw = WW / 2 - 5, ph = WH / 2 - 5;
    gr.fillStyle(t.sky, 1);
    gr.fillRect(wx + 3, WT + 3, pw, ph);
    gr.fillRect(wx + WW / 2 + 2, WT + 3, pw, ph);
    gr.fillRect(wx + 3, WT + WH / 2 + 2, pw, ph);
    gr.fillRect(wx + WW / 2 + 2, WT + WH / 2 + 2, pw, ph);
    // sky gradient (lighter at top)
    gr.fillStyle(t.skyLight, 0.35);
    gr.fillRect(wx + 3, WT + 3, WW - 6, WH * 0.38 | 0);
    // glare strip (top-left pane only)
    gr.fillStyle(0xffffff, 0.18);
    gr.fillRect(wx + 5, WT + 5, 14, ph * 0.65 | 0);
    // window sill
    gr.fillStyle(t.wallDark, 1);
    gr.fillRect(wx - 9, WT + WH, WW + 18, 9);
    gr.fillStyle(t.wall, 0.35);
    gr.fillRect(wx - 8, WT + WH, WW + 16, 2);
  });

  // 6. Wall decorations between windows
  [188, 428, 668, 908, 1148].forEach((px, i) => {
    if (i % 2 === 0) {
      // Framed poster (corporate / motivational)
      gr.fillStyle(t.wallDark, 1);
      gr.fillRect(px - 24, 55, 48, 66);
      gr.fillStyle(t.accent, 0.55);
      gr.fillRect(px - 20, 59, 40, 58);
      // scan-line stripes
      for (let sl = 0; sl < 58; sl += 8) {
        gr.fillStyle(0xffffff, 0.07);
        gr.fillRect(px - 20, 59 + sl, 40, 3);
      }
      // text-like bars
      gr.fillStyle(0x000000, 0.22);
      gr.fillRect(px - 16, 94, 32, 4);
      gr.fillRect(px - 12, 102, 24, 4);
    } else {
      // Wall clock
      gr.fillStyle(t.wallDark, 1);
      gr.fillEllipse(px, 76, 34, 34);
      gr.fillStyle(t.wall, 1);
      gr.fillEllipse(px, 76, 28, 28);
      // hour + minute hand
      gr.fillStyle(t.wallDark, 1);
      gr.fillRect(px - 1, 62, 2, 11);  // 12-hand
      gr.fillRect(px + 1, 75, 9, 2);   // 3-hand
    }
  });

  // 7. Lower/baseboard zone (darker strip at bottom 80px)
  const BASE_Y = H - 80;
  gr.fillStyle(t.wallDark, 1);
  gr.fillRect(0, BASE_Y, W, 80);
  gr.fillStyle(t.wall, 0.28);
  gr.fillRect(0, BASE_Y, W, 2); // separation highlight

  // 8. Back-floor silhouette furniture
  const SF_Y = BASE_Y + 6;
  const DESK_H = 32, DESK_W = 68;
  for (let sx = 20; sx < W - 60; sx += 110) {
    // desk silhouette
    gr.fillStyle(t.floorDark, 1);
    gr.fillRect(sx, SF_Y + 40 - DESK_H, DESK_W, DESK_H);
    // monitor
    gr.fillStyle(t.floorDark, 1);
    gr.fillRect(sx + 12, SF_Y + 40 - DESK_H - 26, 26, 22);
    gr.fillRect(sx + 23, SF_Y + 40 - DESK_H - 4, 4, 4);
  }

  // 9. Floor/ground line
  gr.fillStyle(t.floorDark, 1);
  gr.fillRect(0, H - 16, W, 16);
  gr.fillStyle(t.wall, 0.18);
  gr.fillRect(0, H - 16, W, 1);

  gr.generateTexture(key, W, H);
  gr.destroy();
}

// ─── Furniture surfaces (32×14) ───────────────────────────────────────────────

function makeMesaSurf(scene: Phaser.Scene, key: string) {
  const gr = scene.add.graphics();
  gr.fillStyle(0xf0d898, 1); gr.fillRect(0, 0, 32, 2);  // highlight
  gr.fillStyle(0xd4a860, 1); gr.fillRect(0, 2, 32, 3);  // light wood
  gr.fillStyle(0xa87838, 1); gr.fillRect(0, 5, 32, 5);  // base wood
  gr.fillStyle(0x684818, 1); gr.fillRect(0, 10, 32, 4); // under-edge
  // grain hints
  gr.fillStyle(0xbc9050, 1);
  gr.fillRect(4, 5, 9, 1); gr.fillRect(20, 7, 8, 1);
  outline(gr, 32, 14);
  gr.generateTexture(key, 32, 14);
  gr.destroy();
}

function makeEstanteSurf(scene: Phaser.Scene) {
  const gr = scene.add.graphics();
  gr.fillStyle(0x9a6028, 1); gr.fillRect(0, 0, 32, 14);
  gr.fillStyle(0xcf9050, 1); gr.fillRect(0, 1, 32, 2);  // highlight
  gr.fillStyle(0xb87840, 1); gr.fillRect(0, 3, 32, 4);  // mid
  gr.fillStyle(0x643a14, 1); gr.fillRect(0, 11, 32, 3); // shadow
  // side posts
  gr.fillStyle(0x784820, 1);
  gr.fillRect(1, 4, 3, 10); gr.fillRect(28, 4, 3, 10);
  outline(gr, 32, 14);
  gr.generateTexture("tex-estante", 32, 14);
  gr.destroy();
}

function makeImpressoraSurf(scene: Phaser.Scene) {
  const gr = scene.add.graphics();
  gr.fillStyle(0xb8b8b0, 1); gr.fillRect(0, 0, 32, 14);
  gr.fillStyle(0xeeeeea, 1); gr.fillRect(1, 1, 30, 2);  // highlight
  gr.fillStyle(0xd0d0c8, 1); gr.fillRect(1, 3, 30, 4);  // mid
  gr.fillStyle(0x808078, 1); gr.fillRect(0, 11, 32, 3); // shadow
  gr.fillStyle(0x2058b8, 1); gr.fillRect(8, 4, 16, 5);  // scanner lid
  gr.fillStyle(0x4888e0, 1); gr.fillRect(9, 4, 7, 2);   // glare
  gr.fillStyle(0x00cc44, 1); gr.fillRect(26, 5, 3, 3);  // LED
  outline(gr, 32, 14);
  gr.generateTexture("tex-impressora", 32, 14);
  gr.destroy();
}

function makeVasoSurf(scene: Phaser.Scene) {
  const gr = scene.add.graphics();
  gr.fillStyle(0x3a2008, 1); gr.fillRect(0, 0, 32, 14); // soil base
  gr.fillStyle(0x582e10, 1); gr.fillRect(2, 4, 28, 7);  // lighter soil
  // foliage on top
  gr.fillStyle(0x1c5020, 1); gr.fillRect(3, 2, 26, 6);
  gr.fillStyle(0x267828, 1); gr.fillRect(5, 0, 22, 5);
  gr.fillStyle(0x40a848, 1); gr.fillRect(9, 0, 14, 3);
  outline(gr, 32, 14);
  gr.generateTexture("tex-vaso", 32, 14);
  gr.destroy();
}

// ─── Furniture bodies (narrow — proportional to 32×48 player) ─────────────────

/**
 * Mesa body (32×14): desk apron + leg stumps.
 * Total desk height = surface(14) + body(14) = 28px ≈ 60% player height ✓
 */
function makeMesaBody(scene: Phaser.Scene) {
  const gr = scene.add.graphics();
  // front apron
  gr.fillStyle(0x8c6030, 1); gr.fillRect(0, 0, 32, 10);
  gr.fillStyle(0xa87848, 1); gr.fillRect(1, 0, 2, 9);   // left highlight
  gr.fillStyle(0x664420, 1); gr.fillRect(29, 0, 2, 10); // right shadow
  // drawer line
  gr.fillStyle(OUTLINE, 1);
  gr.fillRect(2, 5, 28, 1);
  // drawer handle
  gr.fillStyle(0xe0c070, 1); gr.fillRect(9, 2, 14, 2);
  gr.fillStyle(0xb09040, 1); gr.fillRect(9, 4, 14, 2);
  // leg stumps
  gr.fillStyle(0x583818, 1);
  gr.fillRect(1, 10, 6, 4); gr.fillRect(25, 10, 6, 4);
  gr.fillStyle(0x764a22, 1);
  gr.fillRect(2, 10, 2, 3); gr.fillRect(26, 10, 2, 3); // leg highlights
  // outline
  gr.fillStyle(OUTLINE, 1);
  gr.fillRect(0, 0, 1, 14); gr.fillRect(31, 0, 1, 14);
  gr.fillRect(0, 13, 32, 1);
  gr.generateTexture("tex-mesa-body", 32, 14);
  gr.destroy();
}

/**
 * Estante body (32×34): one book row + shelf + base.
 * Total = surface(14) + body(34) = 48px ≈ player height ✓
 */
function makeEstanteBody(scene: Phaser.Scene) {
  const bkColors = [0x3060c0, 0xb03020, 0x308040, 0xb09020, 0x703090, 0x208060, 0x804020, 0x205090, 0xb03060];
  const gr = scene.add.graphics();
  // back wall (dark recess)
  gr.fillStyle(0x3a2208, 1); gr.fillRect(6, 0, 20, 34);
  // side panels
  gr.fillStyle(0x7a4c20, 1);
  gr.fillRect(0, 0, 6, 34); gr.fillRect(26, 0, 6, 34);
  gr.fillStyle(0x9a6630, 1);
  gr.fillRect(4, 0, 2, 34); gr.fillRect(26, 0, 2, 34);
  // books (one row, each 2-4px wide)
  let bx = 7;
  bkColors.forEach((col, i) => {
    const bw = 2 + (i % 2);
    const bh = 20 + (i % 3) * 2;
    gr.fillStyle(col, 1);
    gr.fillRect(bx, 0, bw, bh);
    gr.fillStyle(0xffffff, 0.22);
    gr.fillRect(bx, 0, 1, bh); // spine highlight
    bx += bw + 1;
    if (bx > 23) return;
  });
  // shelf board
  gr.fillStyle(0xb07838, 1); gr.fillRect(0, 26, 32, 2);
  gr.fillStyle(0x8c5828, 1); gr.fillRect(0, 28, 32, 2);
  gr.fillStyle(0x4a2c10, 1); gr.fillRect(0, 30, 32, 1);
  // base
  gr.fillStyle(0x7a4c20, 1); gr.fillRect(0, 31, 32, 3);
  // outline
  gr.fillStyle(OUTLINE, 1);
  gr.fillRect(0, 0, 1, 34); gr.fillRect(31, 0, 1, 34);
  gr.fillRect(0, 33, 32, 1);
  gr.generateTexture("tex-estante-body", 32, 34);
  gr.destroy();
}

/**
 * Impressora body (32×14): lower housing.
 * Total = 14 + 14 = 28px ≈ 58% player height ✓
 */
function makeImpressoraBody(scene: Phaser.Scene) {
  const gr = scene.add.graphics();
  gr.fillStyle(0xb8b8b0, 1); gr.fillRect(0, 0, 32, 11);
  gr.fillStyle(0xe0e0d8, 1); gr.fillRect(1, 0, 30, 2);  // top highlight
  gr.fillStyle(0x888880, 1); gr.fillRect(0, 8, 32, 3);  // shadow
  // paper tray
  gr.fillStyle(0x909088, 1); gr.fillRect(4, 8, 24, 6);
  gr.fillStyle(0xf0f0e8, 1); gr.fillRect(6, 9, 20, 3);  // paper
  // base
  gr.fillStyle(0x606060, 1); gr.fillRect(0, 11, 32, 3);
  gr.fillStyle(OUTLINE, 1);
  gr.fillRect(0, 0, 1, 14); gr.fillRect(31, 0, 1, 14);
  gr.fillRect(0, 13, 32, 1);
  gr.generateTexture("tex-impressora-body", 32, 14);
  gr.destroy();
}

/**
 * Vaso body (32×18): terracotta pot.
 * Total = 14 + 18 = 32px ≈ 67% player height ✓
 */
function makeVasoBody(scene: Phaser.Scene) {
  const gr = scene.add.graphics();
  // rim
  gr.fillStyle(0xb85c28, 1); gr.fillRect(4, 0, 24, 5);
  gr.fillStyle(0xd87840, 1); gr.fillRect(4, 0, 24, 2);  // rim highlight
  // pot body (tapered slightly)
  gr.fillStyle(0x984420, 1); gr.fillRect(6, 5, 20, 10);
  gr.fillStyle(0xba5e32, 1); gr.fillRect(7, 5, 4, 9);   // left highlight
  gr.fillStyle(0x703018, 1); gr.fillRect(21, 5, 5, 10); // right shadow
  // foot
  gr.fillStyle(0x5c2810, 1); gr.fillRect(8, 14, 16, 4);
  gr.fillStyle(OUTLINE, 1);
  gr.fillRect(4, 0, 1, 5); gr.fillRect(27, 0, 1, 5);
  gr.fillRect(6, 5, 1, 9); gr.fillRect(25, 5, 1, 9);
  gr.fillRect(8, 17, 16, 1);
  gr.generateTexture("tex-vaso-body", 32, 18);
  gr.destroy();
}

// ─── Armario textures (32×14 surf, 32×36 body) ───────────────────────────────

function makeArmarioSurf(scene: Phaser.Scene) {
  const gr = scene.add.graphics();
  // Grey metal top
  gr.fillStyle(0xb0b4b8, 1); gr.fillRect(0, 0, 32, 14);
  gr.fillStyle(0xd0d4d8, 1); gr.fillRect(0, 0, 32, 2);   // highlight top 2px
  gr.fillStyle(0x808488, 1); gr.fillRect(0, 11, 32, 3);  // shadow bottom 3px
  // Thin handle strip in center
  gr.fillStyle(0x707478, 1); gr.fillRect(8, 6, 16, 2);   // 2px handle
  gr.fillStyle(0xd8dce0, 1); gr.fillRect(8, 6, 16, 1);   // glare
  outline(gr, 32, 14);
  gr.generateTexture("tex-armario", 32, 14);
  gr.destroy();
}

function makeArmarioBody(scene: Phaser.Scene) {
  const gr = scene.add.graphics();
  // Dark steel sides
  gr.fillStyle(0x808488, 1); gr.fillRect(0, 0, 4, 36);   // left 4px
  gr.fillStyle(0x808488, 1); gr.fillRect(28, 0, 4, 36);  // right 4px
  gr.fillStyle(0xa0a4a8, 1); gr.fillRect(4, 0, 1, 36);   // left inner highlight
  gr.fillStyle(0xa0a4a8, 1); gr.fillRect(27, 0, 1, 36);  // right inner highlight
  // 3 drawer rows (each 10px high)
  for (let row = 0; row < 3; row++) {
    const y = row * 10 + (row > 0 ? row * 2 : 0);
    gr.fillStyle(0x909498, 1); gr.fillRect(5, y, 22, 10);      // drawer body
    gr.fillStyle(0xb0b4b8, 1); gr.fillRect(5, y, 22, 2);       // lighter top
    gr.fillStyle(0x606468, 1); gr.fillRect(5, y + 8, 22, 2);   // darker bottom
    // Drawer handle: 16×2px centered, shadow below
    gr.fillStyle(0xe0e4e8, 1); gr.fillRect(8, y + 4, 16, 2);   // handle
    gr.fillStyle(0xb8bcc0, 1); gr.fillRect(8, y + 6, 16, 1);   // shadow below
  }
  // Outline left, right, bottom
  gr.fillStyle(OUTLINE, 1);
  gr.fillRect(0, 0, 1, 36); gr.fillRect(31, 0, 1, 36);
  gr.fillRect(0, 35, 32, 1);
  gr.generateTexture("tex-armario-body", 32, 36);
  gr.destroy();
}

// ─── Decorative objects (no physics) ─────────────────────────────────────────

/** tex-cadeira (32×28): office chair, decorative only */
function makeCadeira(scene: Phaser.Scene) {
  const gr = scene.add.graphics();
  // Chair back (dark blue, 28px wide, 18px tall)
  gr.fillStyle(0x1a3a6a, 1); gr.fillRect(2, 0, 28, 18);
  // Highlight on back
  gr.fillStyle(0x2a5aaa, 1); gr.fillRect(2, 0, 26, 2);
  // Seat (24px wide, 6px, centered, at y=18)
  gr.fillStyle(0x1a3a6a, 1); gr.fillRect(4, 18, 24, 6);
  // Base/wheel strip
  gr.fillStyle(0x303030, 1); gr.fillRect(6, 24, 20, 4);
  // Outline key parts
  gr.fillStyle(OUTLINE, 1);
  gr.fillRect(2, 0, 1, 18); gr.fillRect(29, 0, 1, 18);
  gr.fillRect(2, 17, 28, 1);
  gr.generateTexture("tex-cadeira", 32, 28);
  gr.destroy();
}

/** tex-planta-deco (24×40): office plant, decorative only */
function makePlantaDeco(scene: Phaser.Scene) {
  const gr = scene.add.graphics();
  // Foliage layers (bottom to top)
  gr.fillStyle(0x1c5020, 1); gr.fillRect(2, 12, 20, 10);   // bottom layer at y=12
  gr.fillStyle(0x267828, 1); gr.fillRect(4, 6, 16, 8);     // mid layer at y=6
  gr.fillStyle(0x40a848, 1); gr.fillRect(6, 2, 12, 6);     // upper layer at y=2
  gr.fillStyle(0x5acc5c, 1); gr.fillRect(8, 0, 8, 4);      // top layer at y=0
  // Soil
  gr.fillStyle(0x3c2010, 1); gr.fillRect(3, 18, 18, 4);    // soil at y=18
  // Pot rim
  gr.fillStyle(0xa85a28, 1); gr.fillRect(1, 22, 22, 6);    // rim at y=22
  // Pot bottom
  gr.fillStyle(0x8c4418, 1); gr.fillRect(2, 28, 20, 12);   // pot bottom at y=28
  gr.generateTexture("tex-planta-deco", 24, 40);
  gr.destroy();
}

/** tex-bebedouro-deco (20×48): water cooler, decorative only */
function makeBebedouro(scene: Phaser.Scene) {
  const gr = scene.add.graphics();
  // Water jug (14px wide, 16px, starting at y=0, centered)
  gr.fillStyle(0x6bb8e0, 1); gr.fillRect(3, 0, 14, 16);
  // Blue tint on jug water
  gr.fillStyle(0x4090c0, 1); gr.fillRect(4, 2, 12, 12);
  // Machine body (18px wide, 24px, at y=14)
  gr.fillStyle(0xe0e4e8, 1); gr.fillRect(1, 14, 18, 24);
  // Front panel (14px wide, 20px, at y=16)
  gr.fillStyle(0xd0d4d8, 1); gr.fillRect(3, 16, 14, 20);
  // Tap/dispenser (8px wide, 4px, centered, at y=32)
  gr.fillStyle(0x909498, 1); gr.fillRect(6, 32, 8, 4);
  // Base (18px wide, 6px, at y=38)
  gr.fillStyle(0x707478, 1); gr.fillRect(1, 38, 18, 6);
  gr.generateTexture("tex-bebedouro-deco", 20, 48);
  gr.destroy();
}

// ─── Floor tile (32×16): office carpet ───────────────────────────────────────

function makeFloorTile(scene: Phaser.Scene) {
  const gr = scene.add.graphics();
  gr.fillStyle(0x2a303c, 1); gr.fillRect(0, 0, 32, 16);
  // grout lines
  gr.fillStyle(0x1e242e, 1);
  gr.fillRect(0, 0, 32, 1);   // top
  gr.fillRect(0, 15, 32, 1);  // bottom
  gr.fillRect(0, 0, 1, 16);   // left
  gr.fillRect(15, 0, 1, 16);  // mid vertical (tiles are 16px each in pattern)
  // subtle carpet texture speckles
  gr.fillStyle(0x34404e, 1);
  gr.fillRect(3, 4, 2, 1); gr.fillRect(10, 8, 2, 1);
  gr.fillRect(18, 3, 2, 1); gr.fillRect(25, 10, 2, 1);
  gr.fillRect(6, 12, 2, 1); gr.fillRect(21, 6, 2, 1);
  // top highlight line (where floor meets wall)
  gr.fillStyle(0x3c4a58, 1); gr.fillRect(0, 1, 32, 1);
  gr.generateTexture("tex-floor", 32, 16);
  gr.destroy();
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function outline(gr: Phaser.GameObjects.Graphics, w: number, h: number) {
  gr.fillStyle(OUTLINE, 1);
  gr.fillRect(0, 0, w, 1);
  gr.fillRect(0, h - 1, w, 1);
  gr.fillRect(0, 0, 1, h);
  gr.fillRect(w - 1, 0, 1, h);
}
