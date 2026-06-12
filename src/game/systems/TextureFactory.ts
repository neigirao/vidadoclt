import Phaser from "phaser";

/**
 * TextureFactory — runtime-generated placeholder textures.
 *
 * Pure functions: each takes a Phaser.Scene and registers textures in the
 * global texture manager. Keys are kept stable (`tex-*`) so scenes never
 * need to know whether a texture is generated or loaded from disk.
 *
 * Style guide for generated furniture:
 *  - 3-tone ramps (highlight / base / shadow)
 *  - 1px dark outline around silhouettes
 *  - subtle bright highlight on top edges
 */

const OUTLINE = 0x14100a; // near-black warm outline

/** Furniture surfaces (32×14) + furniture bodies used as platforms. */
export function makeFurnitureTextures(scene: Phaser.Scene): void {
  makeMesaSurface(scene, "tex-mesa");
  makeMesaSurface(scene, "tex-platform"); // backward-compat alias
  makeEstanteSurface(scene);
  makeImpressoraSurface(scene);
  makeVasoSurface(scene);

  makeMesaBody(scene);
  makeEstanteBody(scene);
  makeImpressoraBody(scene);
  makeVasoBody(scene);
}

/** UI / debug textures (currently only the semi-transparent hitbox rect). */
export function makeUiTextures(scene: Phaser.Scene): void {
  makeRect(scene, "tex-hitbox", 28, 24, 0xffffff);
}

/** Set LINEAR filtering on photo backgrounds so they don't look pixelated. */
export function applyBackgroundFilters(scene: Phaser.Scene): void {
  const bgKeys = [
    "bg-menu", "bg-openspace", "bg-atendimento", "bg-comercial", "bg-produto",
    "bg-tecnologia", "bg-rh", "bg-compliance", "bg-diretoria", "bg-presidencia",
    "bg-cobertura", "bg-copa",
  ];
  bgKeys.forEach((key) => {
    const tex = scene.textures.get(key);
    if (tex) (tex as any).setFilter(1); // 1 = Phaser LINEAR filter
  });
}

// ─── private drawing helpers ──────────────────────────────────────

function g(scene: Phaser.Scene): Phaser.GameObjects.Graphics {
  return scene.add.graphics();
}

function outlineRect(gr: Phaser.GameObjects.Graphics, w: number, h: number) {
  gr.fillStyle(OUTLINE, 1);
  gr.fillRect(0, 0, w, 1);          // top
  gr.fillRect(0, h - 1, w, 1);      // bottom
  gr.fillRect(0, 0, 1, h);          // left
  gr.fillRect(w - 1, 0, 1, h);      // right
}

/** Desk surface — light wood, 3-tone ramp + bright top edge. */
function makeMesaSurface(scene: Phaser.Scene, key: string) {
  const gr = g(scene);
  // highlight / base / shadow ramp
  gr.fillStyle(0xf2dca0, 1); gr.fillRect(0, 0, 32, 2);   // top highlight
  gr.fillStyle(0xd8b468, 1); gr.fillRect(0, 2, 32, 3);   // light wood
  gr.fillStyle(0xa87838, 1); gr.fillRect(0, 5, 32, 4);   // base wood
  gr.fillStyle(0x6a4818, 1); gr.fillRect(0, 9, 32, 5);   // under-edge shadow
  // wood grain hints
  gr.fillStyle(0xc09850, 1);
  gr.fillRect(5, 6, 8, 1); gr.fillRect(19, 7, 9, 1);
  outlineRect(gr, 32, 14);
  gr.generateTexture(key, 32, 14);
  gr.destroy();
}

/** Shelf top board. */
function makeEstanteSurface(scene: Phaser.Scene) {
  const gr = g(scene);
  gr.fillStyle(0xa06830, 1); gr.fillRect(0, 0, 32, 14);  // base
  gr.fillStyle(0xd09858, 1); gr.fillRect(0, 1, 32, 2);   // top highlight
  gr.fillStyle(0xc08848, 1); gr.fillRect(0, 3, 32, 3);   // light tone
  gr.fillStyle(0x6a4018, 1); gr.fillRect(0, 10, 32, 3);  // shadow tone
  // side posts
  gr.fillStyle(0x7a4c20, 1); gr.fillRect(1, 4, 3, 10); gr.fillRect(28, 4, 3, 10);
  outlineRect(gr, 32, 14);
  gr.generateTexture("tex-estante", 32, 14);
  gr.destroy();
}

/** Printer top — plastic ramp + lid + status LED. */
function makeImpressoraSurface(scene: Phaser.Scene) {
  const gr = g(scene);
  gr.fillStyle(0xb8b8b0, 1); gr.fillRect(0, 0, 32, 14);  // base plastic
  gr.fillStyle(0xf0f0e8, 1); gr.fillRect(1, 1, 30, 2);   // top highlight
  gr.fillStyle(0xd8d8d0, 1); gr.fillRect(1, 3, 30, 3);   // light tone
  gr.fillStyle(0x888880, 1); gr.fillRect(0, 11, 32, 3);  // shadow tone
  // scanner lid glass
  gr.fillStyle(0x2060c0, 1); gr.fillRect(8, 4, 16, 5);
  gr.fillStyle(0x5090e0, 1); gr.fillRect(9, 4, 6, 2);    // glass shine
  // status LED
  gr.fillStyle(0x00cc44, 1); gr.fillRect(26, 5, 3, 3);
  outlineRect(gr, 32, 14);
  gr.generateTexture("tex-impressora", 32, 14);
  gr.destroy();
}

/** Plant pot top — soil + leaves spilling over. */
function makeVasoSurface(scene: Phaser.Scene) {
  const gr = g(scene);
  gr.fillStyle(0x3a2008, 1); gr.fillRect(0, 0, 32, 14);  // dark soil base
  gr.fillStyle(0x5a3010, 1); gr.fillRect(2, 3, 28, 7);   // lighter soil
  // leaves: shadow / base / highlight
  gr.fillStyle(0x1e5824, 1); gr.fillRect(3, 2, 26, 5);
  gr.fillStyle(0x288030, 1); gr.fillRect(5, 0, 22, 5);
  gr.fillStyle(0x48b050, 1); gr.fillRect(9, 0, 14, 3);
  outlineRect(gr, 32, 14);
  gr.generateTexture("tex-vaso", 32, 14);
  gr.destroy();
}

/** Desk body (32×72): drawers + legs, 3-tone wood. */
function makeMesaBody(scene: Phaser.Scene) {
  const gr = g(scene);
  // drawer bank — base
  gr.fillStyle(0x8c6030, 1); gr.fillRect(0, 0, 32, 40);
  // left-edge highlight + right-edge shadow (3-tone)
  gr.fillStyle(0xa87848, 1); gr.fillRect(1, 1, 2, 38);
  gr.fillStyle(0x6a4420, 1); gr.fillRect(29, 1, 2, 38);
  // drawer separators
  gr.fillStyle(OUTLINE, 1);
  gr.fillRect(2, 0, 28, 1);
  gr.fillRect(2, 18, 28, 1);
  gr.fillRect(2, 36, 28, 1);
  // drawer top highlights
  gr.fillStyle(0xb08850, 1);
  gr.fillRect(3, 1, 26, 1); gr.fillRect(3, 19, 26, 1);
  // handles (highlight + shadow)
  gr.fillStyle(0xe8c878, 1); gr.fillRect(8, 7, 16, 2);
  gr.fillStyle(0xb89040, 1); gr.fillRect(8, 9, 16, 2);
  gr.fillStyle(0xe8c878, 1); gr.fillRect(8, 25, 16, 2);
  gr.fillStyle(0xb89040, 1); gr.fillRect(8, 27, 16, 2);
  // leg pillars with side shading + outline
  gr.fillStyle(0x5a3818, 1); gr.fillRect(0, 38, 10, 34); gr.fillRect(22, 38, 10, 34);
  gr.fillStyle(0x7a5028, 1); gr.fillRect(1, 38, 2, 33);  gr.fillRect(23, 38, 2, 33);
  gr.fillStyle(OUTLINE, 1);
  gr.fillRect(0, 38, 1, 34); gr.fillRect(9, 38, 1, 34);
  gr.fillRect(22, 38, 1, 34); gr.fillRect(31, 38, 1, 34);
  // floor shadow
  gr.fillStyle(0x1c0e04, 1);
  gr.fillRect(0, 68, 10, 4); gr.fillRect(22, 68, 10, 4);
  // body outline (sides)
  gr.fillStyle(OUTLINE, 1);
  gr.fillRect(0, 0, 1, 40); gr.fillRect(31, 0, 1, 40);
  gr.generateTexture("tex-mesa-body", 32, 72);
  gr.destroy();
}

/** Bookshelf body (32×90): 3 rows of books, shaded panels. */
function makeEstanteBody(scene: Phaser.Scene) {
  const gr = g(scene);
  const bkColors = [0x3060c0, 0xb03020, 0x308040, 0xb09020, 0x703090, 0x208060, 0x804020, 0x205090];
  // back wall (dark recess)
  gr.fillStyle(0x3a2208, 1); gr.fillRect(6, 0, 20, 90);
  // side panels with inner highlight
  gr.fillStyle(0x7a4c20, 1); gr.fillRect(0, 0, 6, 90); gr.fillRect(26, 0, 6, 90);
  gr.fillStyle(0x9a6630, 1); gr.fillRect(4, 0, 2, 90); gr.fillRect(26, 0, 2, 90);
  // three shelf rows of books
  [0, 30, 60].forEach((sy, rowIdx) => {
    let bx = 7;
    for (let bi = 0; bi < 5; bi++) {
      const bw = 3 + (bi % 2) * 2;
      const bh = 20 + (bi % 3) * 3;
      const col = bkColors[(rowIdx * 5 + bi) % bkColors.length];
      // book base
      gr.fillStyle(col, 1);
      gr.fillRect(bx, sy + 26 - bh, bw, bh);
      // spine highlight (left) + shadow (right)
      gr.fillStyle(0xffffff, 0.25);
      gr.fillRect(bx, sy + 26 - bh, 1, bh);
      gr.fillStyle(0x000000, 0.3);
      gr.fillRect(bx + bw - 1, sy + 26 - bh, 1, bh);
      bx += bw + 2;
    }
    // shelf board: highlight / base / shadow
    gr.fillStyle(0xb07838, 1); gr.fillRect(0, sy + 26, 32, 1);
    gr.fillStyle(0x8c5828, 1); gr.fillRect(0, sy + 27, 32, 2);
    gr.fillStyle(0x4a2c10, 1); gr.fillRect(0, sy + 29, 32, 1);
  });
  // base board
  gr.fillStyle(0x7a4c20, 1); gr.fillRect(0, 84, 32, 6);
  gr.fillStyle(0x4a2c10, 1); gr.fillRect(0, 88, 32, 2);
  // silhouette outline
  gr.fillStyle(OUTLINE, 1);
  gr.fillRect(0, 0, 1, 90); gr.fillRect(31, 0, 1, 90); gr.fillRect(0, 89, 32, 1);
  gr.generateTexture("tex-estante-body", 32, 90);
  gr.destroy();
}

/** Printer lower body (32×52): panel + paper tray, plastic shading. */
function makeImpressoraBody(scene: Phaser.Scene) {
  const gr = g(scene);
  // main body — 3-tone plastic
  gr.fillStyle(0xc0c0b8, 1); gr.fillRect(0, 0, 32, 34);
  gr.fillStyle(0xe0e0d8, 1); gr.fillRect(1, 0, 30, 2);   // top highlight
  gr.fillStyle(0x888880, 1); gr.fillRect(0, 22, 32, 12); // lower shadow band
  // front control panel
  gr.fillStyle(0x444448, 1); gr.fillRect(2, 2, 28, 20);
  gr.fillStyle(0x606068, 1); gr.fillRect(3, 3, 26, 1);   // bezel highlight
  gr.fillStyle(0x2040a0, 1); gr.fillRect(6, 6, 20, 10);  // screen
  gr.fillStyle(0x4070d0, 1); gr.fillRect(7, 7, 8, 3);    // screen glare
  // buttons
  gr.fillStyle(0x00cc44, 1); gr.fillRect(6, 18, 4, 2);
  gr.fillStyle(0xcc4422, 1); gr.fillRect(12, 18, 4, 2);
  // paper tray with stacked paper
  gr.fillStyle(0x909088, 1); gr.fillRect(4, 34, 24, 10);
  gr.fillStyle(0xf4f4ec, 1); gr.fillRect(6, 35, 20, 3);
  gr.fillStyle(0xd8d8d0, 1); gr.fillRect(6, 38, 20, 3);
  // base with shadow
  gr.fillStyle(0x707068, 1); gr.fillRect(0, 44, 32, 8);
  gr.fillStyle(0x4a4a44, 1); gr.fillRect(0, 50, 32, 2);
  // silhouette outline
  gr.fillStyle(OUTLINE, 1);
  gr.fillRect(0, 0, 1, 52); gr.fillRect(31, 0, 1, 52); gr.fillRect(0, 51, 32, 1);
  gr.generateTexture("tex-impressora-body", 32, 52);
  gr.destroy();
}

/** Plant pot body (32×50): foliage crown + terracotta pot. */
function makeVasoBody(scene: Phaser.Scene) {
  const gr = g(scene);
  // foliage — shadow / base / highlight ellipses
  gr.fillStyle(0x18501e, 1); gr.fillEllipse(16, 8, 32, 20);
  gr.fillStyle(0x206828, 1); gr.fillEllipse(16, 6, 30, 18);
  gr.fillStyle(0x288838, 1); gr.fillEllipse(8, 2, 20, 14); gr.fillEllipse(24, 2, 20, 14);
  gr.fillStyle(0x48b050, 1); gr.fillEllipse(16, 0, 20, 10);
  // pot — terracotta 3-tone
  gr.fillStyle(0x9a4820, 1); gr.fillRect(6, 16, 20, 30);  // base
  gr.fillStyle(0xc06838, 1); gr.fillRect(7, 16, 4, 28);   // left highlight
  gr.fillStyle(0x703818, 1); gr.fillRect(22, 16, 4, 30);  // right shadow
  // rim: highlight band
  gr.fillStyle(0xba6030, 1); gr.fillRect(4, 16, 24, 6);
  gr.fillStyle(0xd88048, 1); gr.fillRect(4, 16, 24, 2);
  // foot
  gr.fillStyle(0x602c10, 1); gr.fillRect(8, 42, 16, 4);
  // soil line
  gr.fillStyle(0x2a1008, 1); gr.fillRect(7, 17, 18, 4);
  // pot outline
  gr.fillStyle(OUTLINE, 1);
  gr.fillRect(4, 16, 1, 6); gr.fillRect(27, 16, 1, 6);
  gr.fillRect(6, 22, 1, 24); gr.fillRect(25, 22, 1, 24);
  gr.fillRect(8, 45, 16, 1);
  gr.generateTexture("tex-vaso-body", 32, 50);
  gr.destroy();
}

/** Simple bordered rectangle (debug / placeholder). */
function makeRect(
  scene: Phaser.Scene,
  key: string, w: number, h: number,
  fill: number, accent?: number,
) {
  const gr = g(scene);
  gr.fillStyle(fill, 1);
  gr.fillRect(0, 0, w, h);
  if (accent !== undefined) {
    gr.fillStyle(accent, 1);
    gr.fillRect(0, Math.floor(h * 0.45), w, Math.floor(h * 0.2));
  }
  gr.lineStyle(2, 0x000000, 0.4);
  gr.strokeRect(1, 1, w - 2, h - 2);
  gr.generateTexture(key, w, h);
  gr.destroy();
}
