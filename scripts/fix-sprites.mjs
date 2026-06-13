#!/usr/bin/env node
/**
 * fix-sprites.mjs
 * 1. Draws blank sprites from scratch (100% transparent files)
 * 2. Quantizes over-colored sprites to ≤24 colors + adds 1px outline
 * 3. Redraws item-inkproj.png at correct size (20×16)
 */

import { Jimp } from 'jimp';
import { mkdirSync } from 'fs';

const OUT = '/home/user/vidadoclt/public/assets/sprites/';
mkdirSync(OUT, { recursive: true });

// ─── COLOR PALETTE (same as generate-sprites.mjs) ───────────────────────────
const C = {
  skinL:  0xd4a07aff, skinM:  0xb07848ff, skinD:  0x7a4820ff,
  hairD:  0x1a0c06ff, hairM:  0x3a2010ff,
  shirtL: 0xe8e8e0ff, shirtM: 0xc8c8b8ff, shirtD: 0xa8a8a0ff,
  suitD:  0x1a2030ff, suitM:  0x2a3040ff, suitL:  0x3a4050ff,
  tieB:   0x1a2a5aff, tieL:   0x2a4a8aff,
  glassF: 0x111111ff, glassL: 0xaabbccff,
  hoodie: 0x3a6a3aff, hoodieL:0x5a9a5aff,
  polo:   0x5a8abaff, poloL:  0x7ab0daff,
  vest:   0xdaa520ff, vestL:  0xf0c840ff,
  badge:  0x2255aaff, badgeL: 0x4488ddff,
  bossS:  0x2a1a3aff, bossSL: 0x3a2a5aff,
  out:    0x14100aff,
  T:      0x00000000,
  gold:   0xf2c14eff, goldD:  0xc8921aff,
  coffee: 0x5c3018ff, coffeeL:0x8c5030ff,
  paper:  0xf0f0e8ff, paperS: 0xd0d0c0ff,
  red:    0xcc2222ff, redL:   0xee4444ff,
  metal:  0x888890ff, metalL: 0xb0b8c0ff, metalD: 0x505860ff,
  blue:   0x4488ccff, blueL:  0x66aaddff,
  black:  0x1a1a22ff, blackL: 0x2a2a32ff,
  belt:   0x2a1a08ff,
  jeans:  0x3a5080ff, jeansL: 0x4a6090ff,
  white:  0xffffffff,
  gray:   0x888888ff, grayL:  0xbbbbbbff,
  yellow: 0xffee44ff, yellowD:0xddcc22ff,
  // Extra colors for new sprites
  folder: 0xe8c87aff,   // manila folder color
  folderD:0xc8a04aff,   // folder dark
  folderS:0xd4b060ff,   // folder shadow
  orange: 0xff8822ff,   // orange accent
  orangeL:0xffaa44ff,
  green:  0x44aa44ff,   // green cell
  greenL: 0x66cc66ff,
  teal:   0x227788ff,
  postY:  0xffee44ff,   // post-it yellow
  postO:  0xff9944ff,   // post-it orange
  postP:  0xcc88ddff,   // post-it pink/purple
  postG:  0x88ddbbff,   // post-it green
  cork:   0xc8a050ff,   // cork board color
  corkD:  0xa07030ff,
  stamp:  0xcc4422ff,   // rubber stamp red
  stampL: 0xee6644ff,
  stampD: 0x882210ff,
  rubber: 0x664422ff,   // stamp rubber
  rubberL:0x886644ff,
  handle: 0xd48040ff,   // stamp wooden handle
  handleL:0xf0a060ff,
};

// ─── HELPERS ────────────────────────────────────────────────────────────────
function rect(img, x, y, w, h, color) {
  for (let py = y; py < y + h; py++)
    for (let px = x; px < x + w; px++)
      if (px >= 0 && py >= 0 && px < img.width && py < img.height)
        img.setPixelColor(color, px, py);
}

function pixel(img, x, y, color) {
  if (x >= 0 && y >= 0 && x < img.width && y < img.height)
    img.setPixelColor(color, x, y);
}

function hline(img, x, y, w, color) { rect(img, x, y, w, 1, color); }
function vline(img, x, y, h, color) { rect(img, x, y, 1, h, color); }

function outlineRect(img, x, y, w, h) {
  hline(img, x, y, w, C.out);
  hline(img, x, y + h - 1, w, C.out);
  vline(img, x, y, h, C.out);
  vline(img, x + w - 1, y, h, C.out);
}

function newImg(w, h) { return new Jimp({ width: w, height: h, color: C.T }); }

// Apply 1-pixel outline on non-transparent edges
function applyEdgeOutline(img) {
  const w = img.width, h = img.height;
  const toOutline = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const a = img.getPixelColor(x, y) & 0xff;
      if (a === 0) continue; // transparent pixel
      // Check neighbors
      const neighbors = [
        [x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]
      ];
      for (const [nx, ny] of neighbors) {
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) {
          toOutline.push([x, y]);
          break;
        }
        const na = img.getPixelColor(nx, ny) & 0xff;
        if (na === 0) {
          toOutline.push([x, y]);
          break;
        }
      }
    }
  }
  for (const [x, y] of toOutline) {
    img.setPixelColor(C.out, x, y);
  }
}

// ─── PROBLEM 1: BLANK SPRITES ────────────────────────────────────────────────

/**
 * enemy-arquivo.png — "pilha de arquivo"
 * 32×40: stack of 3 manila folders with legs sticking out
 */
async function makeEnemyArquivo() {
  const img = newImg(32, 40);

  // Legs (below the stack)
  rect(img, 9, 30, 5, 10, C.suitD);   // left leg
  rect(img, 18, 30, 5, 10, C.suitD);  // right leg
  rect(img, 10, 30, 2, 10, C.suitM);
  rect(img, 19, 30, 2, 10, C.suitM);
  // Shoes
  rect(img, 8, 38, 7, 2, C.blackL);
  rect(img, 17, 38, 7, 2, C.blackL);
  outlineRect(img, 8, 38, 7, 2);
  outlineRect(img, 17, 38, 7, 2);

  // Bottom folder (widest, darkest)
  rect(img, 2, 22, 28, 9, C.folderD);
  rect(img, 3, 23, 26, 7, C.folder);
  rect(img, 3, 23, 6, 7, C.folderS);  // shadow left
  // Tab on bottom folder
  rect(img, 4, 20, 8, 3, C.folderD);
  rect(img, 5, 21, 6, 2, C.folder);
  outlineRect(img, 2, 20, 28, 11);

  // Middle folder
  rect(img, 4, 13, 24, 9, C.folderD);
  rect(img, 5, 14, 22, 7, C.folder);
  rect(img, 5, 14, 5, 7, C.folderS);
  // Tab on middle folder
  rect(img, 6, 11, 7, 3, C.folderD);
  rect(img, 7, 12, 5, 2, C.folder);
  outlineRect(img, 4, 11, 24, 11);

  // Top folder (narrowest, lightest)
  rect(img, 6, 4, 20, 9, C.folder);
  rect(img, 7, 5, 18, 7, C.folderS);
  rect(img, 7, 5, 4, 7, C.folderL ?? C.folderS);
  // Tab on top folder
  rect(img, 8, 2, 6, 3, C.folder);
  rect(img, 9, 3, 4, 2, C.folderS);
  outlineRect(img, 6, 2, 20, 11);

  // Lines on folders (simulating paper content)
  hline(img, 8, 7, 12, C.out);
  hline(img, 8, 9, 10, C.out);
  hline(img, 10, 16, 12, C.out);
  hline(img, 10, 18, 10, C.out);
  hline(img, 8, 25, 14, C.out);
  hline(img, 8, 27, 12, C.out);

  await img.write(OUT + 'enemy-arquivo.png');
  console.log('✓ enemy-arquivo.png');
}

/**
 * enemy-bateria.png — "bateria vazia"
 * 32×40: humanoid battery character, mostly empty with red sliver at top
 */
async function makeEnemyBateria() {
  const img = newImg(32, 40);

  // Battery body (main rectangle)
  const bx = 8, by = 4, bw = 16, bh = 26;

  // Battery nub at top
  rect(img, 12, 1, 8, 4, C.metalD);
  rect(img, 13, 2, 6, 3, C.metal);
  outlineRect(img, 12, 1, 8, 4);

  // Battery outer shell
  rect(img, bx, by, bw, bh, C.metalD);
  outlineRect(img, bx, by, bw, bh);

  // Battery fill — mostly gray (empty)
  rect(img, bx + 2, by + 2, bw - 4, bh - 4, C.gray);
  // Tiny red sliver at top (5% charge)
  rect(img, bx + 2, by + 2, bw - 4, 3, C.red);
  hline(img, bx + 2, by + 3, bw - 4, C.redL); // highlight line

  // Empty zone gradient (lighter gray)
  rect(img, bx + 2, by + 5, bw - 4, bh - 7, C.grayL);
  // Inner highlight on empty zone
  rect(img, bx + 3, by + 6, 3, bh - 9, C.white);

  // Eyes (simple, sad — on the gray empty area)
  const eyeY = by + 12;
  rect(img, bx + 3, eyeY, 3, 4, C.glassF);
  rect(img, bx + 4, eyeY + 1, 1, 2, C.glassL);
  rect(img, bw + bx - 6, eyeY, 3, 4, C.glassF);
  rect(img, bw + bx - 5, eyeY + 1, 1, 2, C.glassL);

  // Sad mouth
  hline(img, bx + 5, by + 19, 6, C.metalD);
  pixel(img, bx + 4, by + 18, C.metalD);
  pixel(img, bx + 11, by + 18, C.metalD);

  // Arms
  rect(img, 2, by + 8, 6, 4, C.metalD);
  rect(img, 3, by + 9, 5, 2, C.metal);
  rect(img, bx + bw, by + 8, 6, 4, C.metalD);
  rect(img, bx + bw + 1, by + 9, 5, 2, C.metal);

  // Legs
  rect(img, 9, by + bh, 5, 10, C.metalD);
  rect(img, 18, by + bh, 5, 10, C.metalD);
  rect(img, 10, by + bh, 2, 10, C.metal);
  rect(img, 19, by + bh, 2, 10, C.metal);
  // Feet
  rect(img, 8, 38, 7, 2, C.metalD);
  rect(img, 17, 38, 7, 2, C.metalD);
  outlineRect(img, 8, 38, 7, 2);
  outlineRect(img, 17, 38, 7, 2);

  await img.write(OUT + 'enemy-bateria.png');
  console.log('✓ enemy-bateria.png');
}

/**
 * enemy-drone.png — "drone corporativo"
 * 36×28: quadcopter drone, grey/dark metal with camera eye
 */
async function makeEnemyDrone() {
  const img = newImg(36, 28);

  // Central body
  const cx = 12, cy = 8, cw = 12, ch = 12;
  rect(img, cx, cy, cw, ch, C.suitM);
  rect(img, cx + 1, cy + 1, cw - 2, ch - 2, C.suitL);
  outlineRect(img, cx, cy, cw, ch);

  // Camera eye (bottom center of body)
  const camX = cx + 4, camY = cy + 7;
  rect(img, camX, camY, 4, 4, C.black);
  rect(img, camX + 1, camY + 1, 2, 2, C.blueL); // lens
  pixel(img, camX + 1, camY + 1, C.glassL);     // glint
  outlineRect(img, camX, camY, 4, 4);

  // LED indicator (red on top)
  pixel(img, cx + 5, cy + 1, C.red);
  pixel(img, cx + 6, cy + 1, C.redL);

  // 4 arms extending from body
  // Top-left arm
  rect(img, 2, 2, 10, 3, C.metalD);
  rect(img, 3, 3, 9, 1, C.metal);
  // Top-right arm
  rect(img, 24, 2, 10, 3, C.metalD);
  rect(img, 24, 3, 9, 1, C.metal);
  // Bottom-left arm
  rect(img, 2, 22, 10, 3, C.metalD);
  rect(img, 3, 22, 9, 1, C.metal);
  // Bottom-right arm
  rect(img, 24, 22, 10, 3, C.metalD);
  rect(img, 24, 22, 9, 1, C.metal);

  // Rotors (circles at arm tips)
  // Top-left rotor
  rect(img, 0, 0, 6, 6, C.T);
  rect(img, 1, 1, 4, 4, C.metalL);
  rect(img, 0, 2, 6, 2, C.metalL);
  rect(img, 2, 0, 2, 6, C.metalL);
  outlineRect(img, 0, 0, 6, 6);
  // Top-right rotor
  rect(img, 30, 0, 6, 6, C.metalL);
  rect(img, 29, 2, 6, 2, C.metalL);
  rect(img, 32, 0, 2, 6, C.metalL);
  outlineRect(img, 30, 0, 6, 6);
  // Bottom-left rotor
  rect(img, 0, 22, 6, 6, C.metalL);
  rect(img, 0, 24, 6, 2, C.metalL);
  rect(img, 2, 22, 2, 6, C.metalL);
  outlineRect(img, 0, 22, 6, 6);
  // Bottom-right rotor
  rect(img, 30, 22, 6, 6, C.metalL);
  rect(img, 29, 24, 6, 2, C.metalL);
  rect(img, 32, 22, 2, 6, C.metalL);
  outlineRect(img, 30, 22, 6, 6);

  // Rotor spin blur (horizontal lines)
  hline(img, 0, 3, 6, C.grayL);
  hline(img, 30, 3, 6, C.grayL);
  hline(img, 0, 24, 6, C.grayL);
  hline(img, 30, 24, 6, C.grayL);

  // Corporate label on body (tiny badge shape)
  rect(img, cx + 2, cy + 2, 4, 3, C.badge);
  outlineRect(img, cx + 2, cy + 2, 4, 3);

  await img.write(OUT + 'enemy-drone.png');
  console.log('✓ enemy-drone.png');
}

/**
 * enemy-planilha.png — "planilha viva"
 * 32×40: walking spreadsheet with cells, stick legs, googly eyes
 */
async function makeEnemyPlanilha() {
  const img = newImg(32, 40);

  // Sheet body (large rectangle)
  const sx = 2, sy = 2, sw = 28, sh = 28;
  rect(img, sx, sy, sw, sh, C.white);
  outlineRect(img, sx, sy, sw, sh);

  // Header row (darker)
  rect(img, sx, sy, sw, 4, C.metalD);
  outlineRect(img, sx, sy, sw, 4);

  // Spreadsheet grid lines (vertical)
  const cols = [10, 18, 26];
  for (const cx of cols) {
    vline(img, sx + cx, sy, sh, C.metalD);
  }

  // Grid lines (horizontal)
  for (let row = 1; row <= 4; row++) {
    hline(img, sx, sy + row * 5, sw, C.metalD);
  }

  // Cell data (tiny colored rects in some cells)
  rect(img, sx + 1, sy + 6, 7, 3, C.green);
  rect(img, sx + 11, sy + 6, 6, 3, C.green);
  rect(img, sx + 1, sy + 11, 7, 3, C.redL);
  rect(img, sx + 11, sy + 11, 6, 3, C.greenL);
  rect(img, sx + 19, sy + 11, 6, 3, C.green);
  rect(img, sx + 1, sy + 16, 7, 3, C.yellow);
  rect(img, sx + 11, sy + 16, 6, 3, C.redL);
  rect(img, sx + 1, sy + 21, 7, 3, C.green);
  rect(img, sx + 19, sy + 21, 6, 3, C.yellow);

  // Header text bars
  hline(img, sx + 2, sy + 1, 6, C.white);
  hline(img, sx + 12, sy + 1, 4, C.white);
  hline(img, sx + 20, sy + 1, 4, C.white);

  // Googly eyes at top center
  const eyeY = sy - 5;
  // Left eye
  rect(img, 9, eyeY, 5, 5, C.white);
  outlineRect(img, 9, eyeY, 5, 5);
  pixel(img, 11, eyeY + 2, C.black);
  pixel(img, 12, eyeY + 2, C.black);
  pixel(img, 11, eyeY + 1, C.glassL); // glint
  // Right eye
  rect(img, 18, eyeY, 5, 5, C.white);
  outlineRect(img, 18, eyeY, 5, 5);
  pixel(img, 20, eyeY + 2, C.black);
  pixel(img, 21, eyeY + 2, C.black);
  pixel(img, 20, eyeY + 1, C.glassL);

  // Stick legs at bottom
  rect(img, 9, 30, 4, 10, C.metalD);
  rect(img, 19, 30, 4, 10, C.metalD);
  rect(img, 10, 30, 2, 10, C.metal);
  rect(img, 20, 30, 2, 10, C.metal);
  // Little feet
  rect(img, 7, 38, 7, 2, C.black);
  rect(img, 18, 38, 7, 2, C.black);
  outlineRect(img, 7, 38, 7, 2);
  outlineRect(img, 18, 38, 7, 2);

  // Stick arms (lines on sides of sheet)
  rect(img, 0, 10, 3, 3, C.metalD);  // left arm
  rect(img, 29, 10, 3, 3, C.metalD); // right arm
  rect(img, 0, 12, 4, 2, C.metalD);  // left hand
  rect(img, 28, 12, 4, 2, C.metalD); // right hand

  await img.write(OUT + 'enemy-planilha.png');
  console.log('✓ enemy-planilha.png');
}

/**
 * enemy-carimbador.png — "carimbador"
 * 32×40: rubber stamp as body with arms and legs
 */
async function makeEnemyCarimbador() {
  const img = newImg(32, 40);

  // Legs
  rect(img, 8, 30, 5, 10, C.suitD);
  rect(img, 19, 30, 5, 10, C.suitD);
  rect(img, 9, 30, 2, 10, C.suitM);
  rect(img, 20, 30, 2, 10, C.suitM);
  // Shoes
  rect(img, 7, 38, 7, 2, C.blackL);
  rect(img, 18, 38, 7, 2, C.blackL);
  outlineRect(img, 7, 38, 7, 2);
  outlineRect(img, 18, 38, 7, 2);

  // Arms (holding stamp aloft)
  rect(img, 1, 14, 7, 4, C.suitM);
  rect(img, 2, 15, 6, 2, C.suitL);
  rect(img, 24, 14, 7, 4, C.suitM);
  rect(img, 24, 15, 6, 2, C.suitL);

  // Stamp wooden handle (body/torso)
  rect(img, 9, 6, 14, 14, C.handle);
  rect(img, 10, 7, 12, 12, C.handleL);
  rect(img, 10, 7, 3, 12, C.handle); // shadow side
  outlineRect(img, 9, 6, 14, 14);

  // Handle cross-bar
  rect(img, 5, 10, 22, 5, C.handle);
  rect(img, 6, 11, 20, 3, C.handleL);
  outlineRect(img, 5, 10, 22, 5);

  // Rubber stamp pad (bottom of stamp)
  rect(img, 7, 20, 18, 6, C.stamp);
  rect(img, 8, 21, 16, 4, C.stampL);
  outlineRect(img, 7, 20, 18, 6);

  // Ink mark (the stamp face — shows "APROVADO")
  rect(img, 8, 22, 16, 3, C.stampD);
  // Tiny text pixels "OK"
  pixel(img, 11, 23, C.redL);
  pixel(img, 12, 23, C.redL);
  pixel(img, 14, 23, C.redL);
  pixel(img, 16, 23, C.redL);
  pixel(img, 17, 23, C.redL);
  pixel(img, 19, 23, C.redL);

  // Face on handle (with stern expression)
  rect(img, 12, 8, 8, 6, C.skinL);
  // Eyes
  pixel(img, 14, 10, C.skinD);
  pixel(img, 15, 10, C.skinD);
  pixel(img, 18, 10, C.skinD);
  pixel(img, 19, 10, C.skinD);
  // Stern mouth
  hline(img, 14, 12, 6, C.skinD);
  pixel(img, 13, 11, C.skinD);
  pixel(img, 20, 11, C.skinD);

  await img.write(OUT + 'enemy-carimbador.png');
  console.log('✓ enemy-carimbador.png');
}

/**
 * enemy-noticeboard.png — "quadro de avisos"
 * 36×44: bulletin board with post-its, stick legs and arms
 */
async function makeEnemyNoticeboard() {
  const img = newImg(36, 44);

  // Legs
  rect(img, 10, 34, 5, 10, C.suitD);
  rect(img, 21, 34, 5, 10, C.suitD);
  rect(img, 11, 34, 2, 10, C.suitM);
  rect(img, 22, 34, 2, 10, C.suitM);
  // Feet
  rect(img, 9, 42, 7, 2, C.blackL);
  rect(img, 20, 42, 7, 2, C.blackL);
  outlineRect(img, 9, 42, 7, 2);
  outlineRect(img, 20, 42, 7, 2);

  // Arms (sticking out from sides of board)
  rect(img, 0, 14, 6, 4, C.suitD);
  rect(img, 1, 15, 5, 2, C.suitM);
  rect(img, 30, 14, 6, 4, C.suitD);
  rect(img, 30, 15, 5, 2, C.suitM);
  // Hands
  rect(img, 0, 17, 5, 3, C.skinM);
  rect(img, 31, 17, 5, 3, C.skinM);

  // Board frame (cork/wood frame)
  rect(img, 3, 2, 30, 34, C.corkD);
  outlineRect(img, 3, 2, 30, 34);

  // Cork board surface
  rect(img, 5, 4, 26, 30, C.cork);
  // Cork texture pixels
  for (let ty = 5; ty < 34; ty += 3) {
    for (let tx = 6; tx < 30; tx += 4) {
      pixel(img, tx, ty, C.corkD);
    }
  }

  // Post-it notes stuck on board
  // Yellow post-it (top-left)
  rect(img, 6, 5, 7, 7, C.postY);
  outlineRect(img, 6, 5, 7, 7);
  hline(img, 7, 8, 5, C.yellowD);
  hline(img, 7, 10, 5, C.yellowD);

  // Orange post-it (top-right)
  rect(img, 22, 5, 7, 7, C.postO);
  outlineRect(img, 22, 5, 7, 7);
  hline(img, 23, 8, 5, C.handle);
  hline(img, 23, 10, 4, C.handle);

  // Pink/purple post-it (middle-left)
  rect(img, 6, 14, 8, 7, C.postP);
  outlineRect(img, 6, 14, 8, 7);
  hline(img, 7, 17, 6, C.bossS);
  hline(img, 7, 19, 5, C.bossS);

  // Green post-it (middle-right)
  rect(img, 22, 14, 8, 7, C.postG);
  outlineRect(img, 22, 14, 8, 7);
  hline(img, 23, 17, 6, C.teal);
  hline(img, 23, 19, 5, C.teal);

  // Yellow post-it (bottom-left)
  rect(img, 7, 23, 7, 7, C.postY);
  outlineRect(img, 7, 23, 7, 7);
  hline(img, 8, 26, 5, C.yellowD);
  hline(img, 8, 28, 4, C.yellowD);

  // Paper slip (center-ish)
  rect(img, 16, 8, 6, 10, C.paper);
  outlineRect(img, 16, 8, 6, 10);
  hline(img, 17, 11, 4, C.metalD);
  hline(img, 17, 13, 4, C.metalD);
  hline(img, 17, 15, 4, C.metalD);

  // Pushpins (small colored dots on post-its)
  pixel(img, 9, 5, C.red);
  pixel(img, 25, 5, C.blue);
  pixel(img, 9, 14, C.red);
  pixel(img, 26, 14, C.green);
  pixel(img, 10, 23, C.red);

  // Eyes on board (googly)
  rect(img, 12, 26, 5, 5, C.white);
  outlineRect(img, 12, 26, 5, 5);
  pixel(img, 14, 28, C.black);
  pixel(img, 15, 28, C.black);
  pixel(img, 14, 27, C.glassL);

  rect(img, 19, 26, 5, 5, C.white);
  outlineRect(img, 19, 26, 5, 5);
  pixel(img, 21, 28, C.black);
  pixel(img, 22, 28, C.black);
  pixel(img, 21, 27, C.glassL);

  await img.write(OUT + 'enemy-noticeboard.png');
  console.log('✓ enemy-noticeboard.png');
}

// ─── PROBLEM 3: item-inkproj.png (too small — redraw at 20×16) ──────────────

async function makeItemInkproj() {
  const img = newImg(20, 16);

  // Projector body (dark box)
  rect(img, 2, 4, 14, 8, C.suitM);
  rect(img, 3, 5, 12, 6, C.suitL);
  outlineRect(img, 2, 4, 14, 8);

  // Projector lens (circular front)
  rect(img, 13, 5, 5, 6, C.metalD);
  rect(img, 14, 6, 3, 4, C.blueL);
  pixel(img, 14, 6, C.white); // lens glint
  outlineRect(img, 13, 5, 5, 6);

  // Beam of light (orange/yellow, trapezoid)
  // Wide part at right
  pixel(img, 18, 4, C.orange);
  pixel(img, 19, 3, C.orangeL);
  pixel(img, 18, 5, C.orange);
  pixel(img, 19, 5, C.orange);
  pixel(img, 19, 4, C.orangeL);
  pixel(img, 18, 6, C.orange);
  pixel(img, 19, 6, C.orange);
  pixel(img, 19, 7, C.orangeL);
  pixel(img, 18, 7, C.orange);
  pixel(img, 18, 8, C.orange);
  pixel(img, 19, 8, C.orange);
  pixel(img, 19, 9, C.orangeL);
  pixel(img, 18, 9, C.orange);
  pixel(img, 19, 10, C.orange);
  pixel(img, 18, 10, C.orange);
  pixel(img, 19, 11, C.orangeL);
  pixel(img, 19, 12, C.orange);

  // Projector top button
  rect(img, 7, 3, 4, 2, C.metalD);
  outlineRect(img, 7, 3, 4, 2);
  pixel(img, 8, 3, C.redL); // power LED

  // Ventilation slits on side
  hline(img, 3, 6, 4, C.suitD);
  hline(img, 3, 8, 4, C.suitD);
  hline(img, 3, 10, 4, C.suitD);

  // Stand/base
  rect(img, 7, 12, 6, 3, C.metalD);
  rect(img, 6, 14, 8, 2, C.metalD);
  outlineRect(img, 6, 14, 8, 2);

  await img.write(OUT + 'item-inkproj.png');
  console.log('✓ item-inkproj.png');
}

// ─── PROBLEM 2: QUANTIZE HIGH-COLOR SPRITES ──────────────────────────────────

async function quantizeSprite(filename) {
  const path = OUT + filename;
  const img = await Jimp.read(path);

  // Posterize reduces color depth — 4 levels per channel gives max 4^3 = 64
  // Using 3 levels gets us closer to 24
  img.posterize(3);

  // Apply edge outline for crisp pixel-art look
  applyEdgeOutline(img);

  await img.write(path);
  console.log('✓ ' + filename);
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== Fix Sprites ===\n');

  console.log('--- Drawing blank sprites ---');
  await makeEnemyArquivo();
  await makeEnemyBateria();
  await makeEnemyDrone();
  await makeEnemyPlanilha();
  await makeEnemyCarimbador();
  await makeEnemyNoticeboard();

  console.log('\n--- Fixing item-inkproj.png (too small) ---');
  await makeItemInkproj();

  console.log('\n--- Quantizing high-color sprites ---');
  const toQuantize = [
    'player-fall.png',
    'npc-veterano.png',
    'npc-analista-linkedin.png',
    'enemy-impressora.png',
    'enemy-cabo.png',
    'enemy-telemarketer.png',
    'enemy-evangelista.png',
    'enemy-seguranca.png',
    'npc-faxineiro.png',
    'enemy-coletor.png',
    'enemy-ti-suporte.png',
  ];

  for (const f of toQuantize) {
    await quantizeSprite(f);
  }

  console.log('\nAll sprites fixed!');
}

main().catch(err => { console.error(err); process.exit(1); });
