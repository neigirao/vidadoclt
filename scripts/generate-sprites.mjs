#!/usr/bin/env node
/**
 * generate-sprites.mjs
 * Generates all pixel-art sprites for "A Vida do CLT" using jimp v1.
 * Output: /home/user/vidadoclt/public/assets/sprites/
 */

import { Jimp } from 'jimp';
import path from 'path';
import { mkdirSync, writeFileSync } from 'fs';

const OUT = '/home/user/vidadoclt/public/assets/sprites/';
mkdirSync(OUT, { recursive: true });

// ─── COLOR PALETTE ──────────────────────────────────────────────────────────
const C = {
  // Skin
  skinL:  0xd4a07aff, skinM:  0xb07848ff, skinD:  0x7a4820ff,
  // Hair
  hairD:  0x1a0c06ff, hairM:  0x3a2010ff,
  // Shirt/clothes
  shirtL: 0xe8e8e0ff, shirtM: 0xc8c8b8ff, shirtD: 0xa8a8a0ff,
  // Dark suit/pants
  suitD:  0x1a2030ff, suitM:  0x2a3040ff, suitL:  0x3a4050ff,
  // Tie
  tieB:   0x1a2a5aff, tieL:   0x2a4a8aff,
  // Glasses
  glassF: 0x111111ff, glassL: 0xaabbccff,
  // Accent colors per enemy type
  hoodie: 0x3a6a3aff, hoodieL:0x5a9a5aff,
  polo:   0x5a8abaff, poloL:  0x7ab0daff,
  vest:   0xdaa520ff, vestL:  0xf0c840ff,
  badge:  0x2255aaff, badgeL: 0x4488ddff,
  // Boss
  bossS:  0x2a1a3aff, bossSL: 0x3a2a5aff,
  // Outline
  out:    0x14100aff,
  // Transparent
  T:      0x00000000,
  // Item colors
  gold:   0xf2c14eff, goldD:  0xc8921aff,
  coffee: 0x5c3018ff, coffeeL:0x8c5030ff,
  paper:  0xf0f0e8ff, paperS: 0xd0d0c0ff,
  red:    0xcc2222ff, redL:   0xee4444ff,
  // Objects
  metal:  0x888890ff, metalL: 0xb0b8c0ff, metalD: 0x505860ff,
  blue:   0x4488ccff, blueL:  0x66aaddff,
  black:  0x1a1a22ff, blackL: 0x2a2a32ff,
  // Extras
  belt:   0x2a1a08ff,
  jeans:  0x3a5080ff, jeansL: 0x4a6090ff,
  white:  0xffffffff,
  gray:   0x888888ff, grayL:  0xbbbbbbff,
  yellow: 0xffee44ff, yellowD:0xddcc22ff,
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

function outline(img, x, y, w, h) {
  for (let px = x; px < x + w; px++) {
    if (px >= 0 && px < img.width) {
      if (y >= 0 && y < img.height) img.setPixelColor(C.out, px, y);
      if (y+h-1 >= 0 && y+h-1 < img.height) img.setPixelColor(C.out, px, y+h-1);
    }
  }
  for (let py = y; py < y + h; py++) {
    if (py >= 0 && py < img.height) {
      if (x >= 0 && x < img.width) img.setPixelColor(C.out, x, py);
      if (x+w-1 >= 0 && x+w-1 < img.width) img.setPixelColor(C.out, x+w-1, py);
    }
  }
}

function hline(img, x, y, w, color) { rect(img, x, y, w, 1, color); }
function vline(img, x, y, h, color) { rect(img, x, y, 1, h, color); }

function newImg(w, h) { return new Jimp({ width: w, height: h, color: C.T }); }

// Draw a pixel-art face (shared across humanoid sprites)
// fx,fy = top-left of face rect, fw,fh = face size
function drawFace(img, fx, fy, fw, fh, opts = {}) {
  const {
    skinColor = C.skinL,
    hairColor = C.hairD,
    hairW = fw,
    hairH = 4,
    hairX = 0,
    hasGlasses = false,
    glassStyle = 'thin', // 'thin' | 'thick'
    hasTiredEyes = false,
    hasSmile = true,
    headphonesColor = 0x333333ff,
    hasHeadphones = false,
  } = opts;

  // Hair
  rect(img, fx + hairX, fy - hairH + 1, hairW, hairH, hairColor);

  // Face fill
  rect(img, fx, fy, fw, fh, skinColor);

  // Eyes (default: 2 pixels)
  const eyeY = fy + Math.floor(fh * 0.35);
  const eyeOffL = Math.floor(fw * 0.2);
  const eyeOffR = Math.floor(fw * 0.65);

  if (hasGlasses) {
    const gw = glassStyle === 'thick' ? 6 : 5;
    const gh = glassStyle === 'thick' ? 4 : 3;
    // left lens frame
    rect(img, fx + eyeOffL - 1, eyeY - 1, gw, gh, C.glassF);
    rect(img, fx + eyeOffL, eyeY, gw - 2, gh - 2, C.glassL);
    // right lens frame
    rect(img, fx + eyeOffR - 1, eyeY - 1, gw, gh, C.glassF);
    rect(img, fx + eyeOffR, eyeY, gw - 2, gh - 2, C.glassL);
    // bridge
    rect(img, fx + eyeOffL + gw - 1, eyeY, fw - (eyeOffL + gw - 1) - (fw - eyeOffR) - 1, 1, C.glassF);
  } else {
    pixel(img, fx + eyeOffL, eyeY, C.skinD);
    pixel(img, fx + eyeOffL + 1, eyeY, C.skinD);
    pixel(img, fx + eyeOffR, eyeY, C.skinD);
    pixel(img, fx + eyeOffR + 1, eyeY, C.skinD);
  }

  // Tired eyes — dark circles
  if (hasTiredEyes) {
    hline(img, fx + eyeOffL - 1, eyeY + 2, 5, C.skinD);
    hline(img, fx + eyeOffR - 1, eyeY + 2, 5, C.skinD);
  }

  // Mouth
  const mouthY = fy + Math.floor(fh * 0.75);
  const mouthX = fx + Math.floor(fw * 0.25);
  const mouthW = Math.floor(fw * 0.5);
  if (hasSmile) {
    hline(img, mouthX, mouthY, mouthW, C.skinD);
    pixel(img, mouthX - 1, mouthY - 1, C.skinD);
    pixel(img, mouthX + mouthW, mouthY - 1, C.skinD);
  } else {
    // neutral/frown
    hline(img, mouthX, mouthY, mouthW, C.skinD);
  }

  // Ears
  pixel(img, fx - 1, eyeY, C.skinM);
  pixel(img, fx + fw, eyeY, C.skinM);

  // Headphones
  if (hasHeadphones) {
    vline(img, fx - 2, fy - 1, fh + 1, headphonesColor);
    vline(img, fx + fw + 1, fy - 1, fh + 1, headphonesColor);
    hline(img, fx - 1, fy - 2, fw + 2, 0x222222ff);
  }
}

// Draw shirt/tie body (for player and analyst-type enemies)
function drawShirtTie(img, bx, by, bw, bh, opts = {}) {
  const {
    shirtColor = C.shirtL,
    hasTie = true,
    tieColor = C.tieB,
    tieHighlight = C.tieL,
    tieW = 4,
    shadeLeft = true,
    shadeRight = true,
  } = opts;

  rect(img, bx, by, bw, bh, shirtColor);
  if (shadeLeft) rect(img, bx, by, 2, bh, C.shirtM);
  if (shadeRight) rect(img, bx + bw - 2, by, 2, bh, C.shirtD);

  if (hasTie) {
    const tx = bx + Math.floor(bw / 2) - Math.floor(tieW / 2);
    rect(img, tx, by, tieW, bh - 2, tieColor);
    rect(img, tx + 1, by, 1, bh - 4, tieHighlight);
    // Knot base wider
    rect(img, tx - 1, by + bh - 4, tieW + 2, 3, tieColor);
  }
}

// ─── PLAYER SPRITES ─────────────────────────────────────────────────────────

async function makePlayerIdle() {
  const img = newImg(32, 48);
  // Hair
  rect(img, 6, 2, 20, 4, C.hairD);
  rect(img, 4, 4, 24, 3, C.hairD);
  // Face
  rect(img, 6, 6, 20, 10, C.skinL);
  pixel(img, 7, 7, C.skinL);
  pixel(img, 24, 14, C.skinD);
  // Glasses
  rect(img, 7, 9, 7, 4, C.glassF);
  rect(img, 18, 9, 7, 4, C.glassF);
  rect(img, 14, 10, 4, 2, C.glassF);
  rect(img, 8, 10, 5, 2, C.glassL);
  rect(img, 19, 10, 5, 2, C.glassL);
  // Ears
  pixel(img, 5, 11, C.skinM);
  pixel(img, 26, 11, C.skinM);
  // Mouth
  rect(img, 12, 14, 8, 2, C.skinD);
  // Neck
  rect(img, 13, 16, 6, 3, C.skinL);
  // Shirt body
  rect(img, 6, 18, 20, 19, C.shirtL);
  rect(img, 6, 18, 3, 19, C.shirtM);
  rect(img, 23, 18, 3, 19, C.shirtD);
  // Tie
  rect(img, 13, 18, 6, 16, C.tieB);
  rect(img, 14, 18, 2, 14, C.tieL);
  rect(img, 12, 32, 8, 4, C.tieB);
  // Belt
  rect(img, 6, 37, 20, 3, C.belt);
  // Pants
  rect(img, 6, 40, 9, 8, C.suitD);
  rect(img, 17, 40, 9, 8, C.suitD);
  rect(img, 7, 40, 3, 8, C.suitM);
  rect(img, 18, 40, 3, 8, C.suitM);
  // Shoes
  rect(img, 5, 46, 10, 2, C.blackL);
  rect(img, 17, 46, 11, 2, C.blackL);
  // Add outline pixels on key edges
  outline(img, 6, 2, 20, 4);  // hair
  outline(img, 6, 6, 20, 10); // face
  outline(img, 6, 18, 20, 22); // torso
  outline(img, 6, 40, 9, 8);  // left leg
  outline(img, 17, 40, 9, 8); // right leg
  await img.write(OUT + 'player-idle.png');
  console.log('✓ player-idle.png');
}

async function makePlayerWalk0() {
  // Left foot forward
  const img = newImg(32, 48);
  // Hair
  rect(img, 6, 2, 20, 4, C.hairD);
  rect(img, 4, 4, 24, 3, C.hairD);
  // Face
  rect(img, 6, 6, 20, 10, C.skinL);
  rect(img, 7, 9, 7, 4, C.glassF);
  rect(img, 18, 9, 7, 4, C.glassF);
  rect(img, 14, 10, 4, 2, C.glassF);
  rect(img, 8, 10, 5, 2, C.glassL);
  rect(img, 19, 10, 5, 2, C.glassL);
  pixel(img, 5, 11, C.skinM);
  pixel(img, 26, 11, C.skinM);
  rect(img, 12, 14, 8, 2, C.skinD);
  rect(img, 13, 16, 6, 3, C.skinL);
  // Torso (slight lean right: offset +1)
  rect(img, 7, 18, 20, 19, C.shirtL);
  rect(img, 7, 18, 3, 19, C.shirtM);
  rect(img, 24, 18, 3, 19, C.shirtD);
  // Tie
  rect(img, 14, 18, 6, 16, C.tieB);
  rect(img, 15, 18, 2, 14, C.tieL);
  rect(img, 13, 32, 8, 4, C.tieB);
  // Belt
  rect(img, 7, 37, 20, 3, C.belt);
  // Left leg FORWARD (shifted up and forward)
  rect(img, 4, 38, 9, 10, C.suitD);
  rect(img, 5, 38, 3, 10, C.suitM);
  rect(img, 4, 46, 10, 2, C.blackL); // shoe
  // Right leg BEHIND (shifted back)
  rect(img, 18, 42, 9, 6, C.suitD);
  rect(img, 19, 42, 3, 6, C.suitM);
  rect(img, 18, 46, 9, 2, C.blackL); // shoe
  await img.write(OUT + 'player-walk0.png');
  console.log('✓ player-walk0.png');
}

async function makePlayerWalk1() {
  // Right foot forward
  const img = newImg(32, 48);
  // Hair
  rect(img, 6, 2, 20, 4, C.hairD);
  rect(img, 4, 4, 24, 3, C.hairD);
  // Face
  rect(img, 6, 6, 20, 10, C.skinL);
  rect(img, 7, 9, 7, 4, C.glassF);
  rect(img, 18, 9, 7, 4, C.glassF);
  rect(img, 14, 10, 4, 2, C.glassF);
  rect(img, 8, 10, 5, 2, C.glassL);
  rect(img, 19, 10, 5, 2, C.glassL);
  pixel(img, 5, 11, C.skinM);
  pixel(img, 26, 11, C.skinM);
  rect(img, 12, 14, 8, 2, C.skinD);
  rect(img, 13, 16, 6, 3, C.skinL);
  // Torso (slight lean left: offset -1)
  rect(img, 5, 18, 20, 19, C.shirtL);
  rect(img, 5, 18, 3, 19, C.shirtM);
  rect(img, 22, 18, 3, 19, C.shirtD);
  rect(img, 12, 18, 6, 16, C.tieB);
  rect(img, 13, 18, 2, 14, C.tieL);
  rect(img, 11, 32, 8, 4, C.tieB);
  rect(img, 5, 37, 20, 3, C.belt);
  // Right leg FORWARD
  rect(img, 19, 38, 9, 10, C.suitD);
  rect(img, 20, 38, 3, 10, C.suitM);
  rect(img, 19, 46, 10, 2, C.blackL);
  // Left leg BEHIND
  rect(img, 5, 42, 9, 6, C.suitD);
  rect(img, 6, 42, 3, 6, C.suitM);
  rect(img, 4, 46, 10, 2, C.blackL);
  await img.write(OUT + 'player-walk1.png');
  console.log('✓ player-walk1.png');
}

async function makePlayerWalk2() {
  // Mid-stride left — between idle and walk0 (less extreme)
  const img = newImg(32, 48);
  rect(img, 6, 2, 20, 4, C.hairD);
  rect(img, 4, 4, 24, 3, C.hairD);
  rect(img, 6, 6, 20, 10, C.skinL);
  rect(img, 7, 9, 7, 4, C.glassF);
  rect(img, 18, 9, 7, 4, C.glassF);
  rect(img, 14, 10, 4, 2, C.glassF);
  rect(img, 8, 10, 5, 2, C.glassL);
  rect(img, 19, 10, 5, 2, C.glassL);
  pixel(img, 5, 11, C.skinM);
  pixel(img, 26, 11, C.skinM);
  rect(img, 12, 14, 8, 2, C.skinD);
  rect(img, 13, 16, 6, 3, C.skinL);
  // Torso centered
  rect(img, 6, 18, 20, 19, C.shirtL);
  rect(img, 6, 18, 3, 19, C.shirtM);
  rect(img, 23, 18, 3, 19, C.shirtD);
  rect(img, 13, 18, 6, 16, C.tieB);
  rect(img, 14, 18, 2, 14, C.tieL);
  rect(img, 12, 32, 8, 4, C.tieB);
  rect(img, 6, 37, 20, 3, C.belt);
  // Legs — left slightly forward, right slightly back
  rect(img, 5, 39, 9, 9, C.suitD);
  rect(img, 6, 39, 3, 9, C.suitM);
  rect(img, 5, 46, 10, 2, C.blackL);
  rect(img, 18, 41, 9, 7, C.suitD);
  rect(img, 19, 41, 3, 7, C.suitM);
  rect(img, 17, 46, 10, 2, C.blackL);
  await img.write(OUT + 'player-walk2.png');
  console.log('✓ player-walk2.png');
}

async function makePlayerWalk3() {
  // Mid-stride right — between idle and walk1
  const img = newImg(32, 48);
  rect(img, 6, 2, 20, 4, C.hairD);
  rect(img, 4, 4, 24, 3, C.hairD);
  rect(img, 6, 6, 20, 10, C.skinL);
  rect(img, 7, 9, 7, 4, C.glassF);
  rect(img, 18, 9, 7, 4, C.glassF);
  rect(img, 14, 10, 4, 2, C.glassF);
  rect(img, 8, 10, 5, 2, C.glassL);
  rect(img, 19, 10, 5, 2, C.glassL);
  pixel(img, 5, 11, C.skinM);
  pixel(img, 26, 11, C.skinM);
  rect(img, 12, 14, 8, 2, C.skinD);
  rect(img, 13, 16, 6, 3, C.skinL);
  rect(img, 6, 18, 20, 19, C.shirtL);
  rect(img, 6, 18, 3, 19, C.shirtM);
  rect(img, 23, 18, 3, 19, C.shirtD);
  rect(img, 13, 18, 6, 16, C.tieB);
  rect(img, 14, 18, 2, 14, C.tieL);
  rect(img, 12, 32, 8, 4, C.tieB);
  rect(img, 6, 37, 20, 3, C.belt);
  // Legs — right slightly forward, left slightly back
  rect(img, 18, 39, 9, 9, C.suitD);
  rect(img, 19, 39, 3, 9, C.suitM);
  rect(img, 17, 46, 10, 2, C.blackL);
  rect(img, 5, 41, 9, 7, C.suitD);
  rect(img, 6, 41, 3, 7, C.suitM);
  rect(img, 5, 46, 10, 2, C.blackL);
  await img.write(OUT + 'player-walk3.png');
  console.log('✓ player-walk3.png');
}

async function makePlayerJump() {
  const img = newImg(32, 48);
  // Hair flying — extra pixels up top
  rect(img, 6, 1, 20, 5, C.hairD);
  rect(img, 4, 3, 24, 3, C.hairD);
  pixel(img, 8, 0, C.hairD);
  pixel(img, 14, 0, C.hairD);
  pixel(img, 20, 0, C.hairD);
  // Face
  rect(img, 6, 5, 20, 10, C.skinL);
  rect(img, 7, 8, 7, 4, C.glassF);
  rect(img, 18, 8, 7, 4, C.glassF);
  rect(img, 14, 9, 4, 2, C.glassF);
  rect(img, 8, 9, 5, 2, C.glassL);
  rect(img, 19, 9, 5, 2, C.glassL);
  pixel(img, 5, 10, C.skinM);
  pixel(img, 26, 10, C.skinM);
  rect(img, 12, 13, 8, 2, C.skinD);
  rect(img, 13, 15, 6, 3, C.skinL);
  // Torso
  rect(img, 6, 18, 20, 16, C.shirtL);
  rect(img, 6, 18, 3, 16, C.shirtM);
  rect(img, 23, 18, 3, 16, C.shirtD);
  rect(img, 13, 18, 6, 13, C.tieB);
  rect(img, 14, 18, 2, 11, C.tieL);
  rect(img, 12, 29, 8, 3, C.tieB);
  rect(img, 6, 34, 20, 2, C.belt);
  // Arms slightly raised
  rect(img, 2, 18, 4, 8, C.shirtL);
  rect(img, 26, 18, 4, 8, C.shirtL);
  // Legs tucked (bent upward)
  rect(img, 6, 36, 9, 8, C.suitD);   // left leg
  rect(img, 17, 36, 9, 8, C.suitD);  // right leg
  rect(img, 7, 36, 3, 8, C.suitM);
  rect(img, 18, 36, 3, 8, C.suitM);
  rect(img, 5, 43, 10, 2, C.blackL);
  rect(img, 17, 43, 10, 2, C.blackL);
  await img.write(OUT + 'player-jump.png');
  console.log('✓ player-jump.png');
}

async function makePlayerAttack() {
  // 38×48 — body same as idle but right arm extended
  const img = newImg(38, 48);
  rect(img, 6, 2, 20, 4, C.hairD);
  rect(img, 4, 4, 24, 3, C.hairD);
  rect(img, 6, 6, 20, 10, C.skinL);
  rect(img, 7, 9, 7, 4, C.glassF);
  rect(img, 18, 9, 7, 4, C.glassF);
  rect(img, 14, 10, 4, 2, C.glassF);
  rect(img, 8, 10, 5, 2, C.glassL);
  rect(img, 19, 10, 5, 2, C.glassL);
  pixel(img, 5, 11, C.skinM);
  pixel(img, 26, 11, C.skinM);
  rect(img, 12, 14, 8, 2, C.skinD);
  rect(img, 13, 16, 6, 3, C.skinL);
  // Body
  rect(img, 6, 18, 20, 19, C.shirtL);
  rect(img, 6, 18, 3, 19, C.shirtM);
  rect(img, 23, 18, 3, 19, C.shirtD);
  rect(img, 13, 18, 6, 16, C.tieB);
  rect(img, 14, 18, 2, 14, C.tieL);
  rect(img, 12, 32, 8, 4, C.tieB);
  rect(img, 6, 37, 20, 3, C.belt);
  rect(img, 6, 40, 9, 8, C.suitD);
  rect(img, 17, 40, 9, 8, C.suitD);
  rect(img, 7, 40, 3, 8, C.suitM);
  rect(img, 18, 40, 3, 8, C.suitM);
  rect(img, 5, 46, 10, 2, C.blackL);
  rect(img, 17, 46, 11, 2, C.blackL);
  // Right arm extended punching
  rect(img, 26, 20, 12, 6, C.shirtL);
  // Fist
  rect(img, 32, 20, 6, 6, C.skinM);
  rect(img, 33, 21, 4, 4, C.skinL);
  outline(img, 32, 20, 6, 6);
  await img.write(OUT + 'player-attack.png');
  console.log('✓ player-attack.png');
}

async function makePlayerDash() {
  // 38×32 — dashing, leaning forward, vertically compressed
  const img = newImg(38, 32);
  // Head leaned forward (at right side)
  rect(img, 18, 0, 16, 3, C.hairD);
  rect(img, 16, 2, 20, 3, C.hairD);
  rect(img, 17, 4, 16, 8, C.skinL);
  rect(img, 18, 6, 7, 4, C.glassF);
  rect(img, 26, 6, 7, 4, C.glassF);
  rect(img, 22, 7, 4, 2, C.glassF);
  rect(img, 19, 7, 5, 2, C.glassL);
  rect(img, 27, 7, 5, 2, C.glassL);
  rect(img, 20, 11, 6, 1, C.skinD);
  // Neck
  rect(img, 21, 12, 5, 2, C.skinL);
  // Body stretched horizontal, compressed vertical
  rect(img, 4, 12, 20, 12, C.shirtL);
  rect(img, 4, 12, 3, 12, C.shirtM);
  rect(img, 21, 12, 3, 12, C.shirtD);
  rect(img, 11, 12, 4, 10, C.tieB);
  rect(img, 12, 12, 2, 8, C.tieL);
  // Belt
  rect(img, 4, 24, 20, 2, C.belt);
  // Legs trailing behind, compressed
  rect(img, 0, 24, 10, 6, C.suitD);
  rect(img, 1, 24, 3, 6, C.suitM);
  rect(img, 10, 26, 10, 4, C.suitD);
  rect(img, 11, 26, 3, 4, C.suitM);
  // Shoes
  rect(img, 0, 28, 10, 3, C.blackL);
  rect(img, 10, 28, 10, 3, C.blackL);
  // Left arm back, right arm forward
  rect(img, 24, 14, 8, 4, C.shirtL);
  rect(img, 0, 16, 6, 4, C.shirtL);
  // Motion blur hint — faded tail
  pixel(img, 2, 14, C.shirtM);
  pixel(img, 1, 15, C.shirtM);
  await img.write(OUT + 'player-dash.png');
  console.log('✓ player-dash.png');
}

// ─── ENEMY SPRITES ──────────────────────────────────────────────────────────

async function makeEnemyEstagiario() {
  // 28×40 — young intern, green hoodie, headphones
  const img = newImg(28, 40);
  // Headphones (draw first, behind head)
  rect(img, 3, 4, 3, 9, 0x333333ff);
  rect(img, 22, 4, 3, 9, 0x333333ff);
  rect(img, 4, 2, 20, 3, 0x222222ff);
  // Hair
  rect(img, 6, 2, 16, 3, C.hairD);
  rect(img, 5, 3, 18, 3, C.hairM);
  // Face
  rect(img, 5, 4, 18, 10, C.skinL);
  // Eyes with slight bags (young but exhausted)
  pixel(img, 8, 7, C.skinD);
  pixel(img, 9, 7, C.skinD);
  pixel(img, 17, 7, C.skinD);
  pixel(img, 18, 7, C.skinD);
  // Slight dark circles
  hline(img, 8, 9, 3, C.skinM);
  hline(img, 17, 9, 3, C.skinM);
  // Mouth — neutral
  hline(img, 11, 12, 6, C.skinD);
  // Ears behind headphones
  pixel(img, 4, 9, C.skinM);
  pixel(img, 23, 9, C.skinM);
  // Neck
  rect(img, 12, 14, 4, 3, C.skinL);
  // Hoodie body
  rect(img, 4, 16, 20, 16, C.hoodie);
  rect(img, 4, 16, 3, 16, C.hoodieL);
  rect(img, 21, 16, 3, 16, 0x2a5a2aff);
  // Hood opening / neck area
  rect(img, 10, 16, 8, 5, 0x2a4a2aff);
  // Pocket
  rect(img, 8, 24, 5, 5, 0x2a4a2aff);
  outline(img, 8, 24, 5, 5);
  // Drawstring
  pixel(img, 12, 17, 0x1a3a1aff);
  pixel(img, 13, 17, 0x1a3a1aff);
  pixel(img, 14, 17, 0x1a3a1aff);
  pixel(img, 15, 17, 0x1a3a1aff);
  // Jeans
  rect(img, 5, 32, 8, 8, C.jeans);
  rect(img, 15, 32, 8, 8, C.jeans);
  rect(img, 6, 32, 3, 8, C.jeansL);
  rect(img, 16, 32, 3, 8, C.jeansL);
  // Cuff detail
  hline(img, 5, 38, 8, 0x2a4070ff);
  hline(img, 15, 38, 8, 0x2a4070ff);
  // Sneakers (white-ish soles)
  rect(img, 4, 38, 10, 2, 0xddddddff);
  rect(img, 14, 38, 10, 2, 0xddddddff);
  // Dark toe cap
  rect(img, 4, 38, 3, 2, 0x444444ff);
  rect(img, 14, 38, 3, 2, 0x444444ff);
  await img.write(OUT + 'enemy-estagiario.png');
  console.log('✓ enemy-estagiario.png');
}

async function makeEnemyAnalista() {
  // 28×38 — office analyst, white shirt, tie, thick glasses
  const img = newImg(28, 38);
  // Hair — thin, receding
  rect(img, 7, 0, 14, 3, C.hairD);
  rect(img, 5, 1, 18, 2, C.hairM);
  // Face
  rect(img, 5, 2, 18, 10, C.skinL);
  // Thick glasses
  rect(img, 6, 5, 7, 5, C.glassF);
  rect(img, 15, 5, 7, 5, C.glassF);
  rect(img, 13, 6, 2, 3, C.glassF);
  rect(img, 7, 6, 5, 3, C.glassL);
  rect(img, 16, 6, 5, 3, C.glassL);
  // Dark circles under eyes
  hline(img, 6, 10, 7, C.skinD);
  hline(img, 15, 10, 7, C.skinD);
  // Mouth — slight frown
  pixel(img, 11, 11, C.skinD);
  hline(img, 12, 12, 4, C.skinD);
  pixel(img, 16, 11, C.skinD);
  // Ears
  pixel(img, 4, 8, C.skinM);
  pixel(img, 23, 8, C.skinM);
  // Neck
  rect(img, 12, 12, 4, 3, C.skinL);
  // White shirt
  rect(img, 4, 15, 20, 16, C.shirtL);
  rect(img, 4, 15, 3, 16, C.shirtM);
  rect(img, 21, 15, 3, 16, C.shirtD);
  // Tie — narrow
  rect(img, 12, 15, 4, 14, C.tieB);
  rect(img, 13, 15, 1, 12, C.tieL);
  rect(img, 11, 27, 6, 2, C.tieB);
  // Belt
  rect(img, 4, 31, 20, 2, C.belt);
  // Pants
  rect(img, 4, 28, 9, 10, C.suitD);
  rect(img, 15, 28, 9, 10, C.suitD);
  rect(img, 5, 28, 3, 10, C.suitM);
  rect(img, 16, 28, 3, 10, C.suitM);
  // Shoes
  rect(img, 3, 36, 10, 2, C.blackL);
  rect(img, 15, 36, 10, 2, C.blackL);
  await img.write(OUT + 'enemy-analista.png');
  console.log('✓ enemy-analista.png');
}

async function makeEnemyFacilitador() {
  // 26×40 — workshop facilitator, blue polo
  const img = newImg(26, 40);
  // Hair
  rect(img, 5, 0, 16, 4, C.hairM);
  rect(img, 4, 2, 18, 3, C.hairD);
  // Face — cheerful
  rect(img, 4, 4, 18, 10, C.skinL);
  pixel(img, 7, 8, C.skinD);
  pixel(img, 8, 8, C.skinD);
  pixel(img, 16, 8, C.skinD);
  pixel(img, 17, 8, C.skinD);
  // Smile
  pixel(img, 9, 12, C.skinD);
  hline(img, 10, 13, 6, C.skinD);
  pixel(img, 16, 12, C.skinD);
  // Ears
  pixel(img, 3, 9, C.skinM);
  pixel(img, 22, 9, C.skinM);
  // Neck
  rect(img, 10, 14, 6, 3, C.skinL);
  // Blue polo shirt
  rect(img, 3, 17, 20, 18, C.polo);
  rect(img, 3, 17, 3, 18, C.poloL);
  rect(img, 20, 17, 3, 18, 0x3a6a9aff);
  // Collar
  rect(img, 9, 17, 8, 4, C.poloL);
  pixel(img, 12, 17, C.skinL);
  pixel(img, 13, 17, C.skinL);
  // Clipboard held at right side
  rect(img, 20, 19, 6, 12, C.paperS);
  outline(img, 20, 19, 6, 12);
  // Clipboard lines
  hline(img, 21, 22, 4, 0x666666ff);
  hline(img, 21, 25, 4, 0x666666ff);
  hline(img, 21, 28, 4, 0x666666ff);
  // Clipboard clip at top
  rect(img, 22, 18, 2, 3, C.metal);
  // Jeans
  rect(img, 3, 35, 9, 5, C.jeans);
  rect(img, 14, 35, 9, 5, C.jeans);
  rect(img, 4, 35, 3, 5, C.jeansL);
  rect(img, 15, 35, 3, 5, C.jeansL);
  // Shoes
  rect(img, 2, 38, 10, 2, C.blackL);
  rect(img, 14, 38, 10, 2, C.blackL);
  await img.write(OUT + 'enemy-facilitador.png');
  console.log('✓ enemy-facilitador.png');
}

async function makeEnemyScrum() {
  // 28×40 — scrum master, yellow agile vest, coffee
  const img = newImg(28, 40);
  // Hair — messy
  rect(img, 5, 0, 18, 5, C.hairM);
  // Messy sticking-up pixels
  pixel(img, 6, 0, C.hairD);
  pixel(img, 10, 0, C.hairD);
  pixel(img, 16, 0, C.hairD);
  pixel(img, 20, 0, C.hairD);
  pixel(img, 8, 0, C.hairM);
  pixel(img, 14, 0, C.hairM);
  // Face
  rect(img, 5, 4, 18, 10, C.skinL);
  pixel(img, 8, 8, C.skinD);
  pixel(img, 9, 8, C.skinD);
  pixel(img, 16, 8, C.skinD);
  pixel(img, 17, 8, C.skinD);
  // Mouth — wide grin
  pixel(img, 9, 12, C.skinD);
  hline(img, 10, 13, 8, C.skinD);
  pixel(img, 18, 12, C.skinD);
  // Ears
  pixel(img, 4, 9, C.skinM);
  pixel(img, 23, 9, C.skinM);
  // Neck
  rect(img, 12, 14, 4, 2, C.skinL);
  // Shirt underneath (white, visible at sides)
  rect(img, 5, 15, 18, 18, C.shirtL);
  // Agile vest over shirt
  rect(img, 4, 15, 5, 18, C.vest);
  rect(img, 19, 15, 5, 18, C.vest);
  // Vest highlights
  rect(img, 4, 15, 2, 18, C.vestL);
  rect(img, 22, 15, 2, 18, C.vestL);
  // Sticky notes on shirt
  rect(img, 8, 17, 6, 4, 0xffee44ff);
  outline(img, 8, 17, 6, 4);
  rect(img, 15, 20, 5, 4, 0xff9944ff);
  outline(img, 15, 20, 5, 4);
  rect(img, 9, 23, 5, 4, 0x44ddaaff);
  outline(img, 9, 23, 5, 4);
  // Coffee cup in right hand
  rect(img, 22, 24, 5, 7, C.coffeeL);
  rect(img, 23, 25, 3, 4, C.coffee);
  // Cup handle
  pixel(img, 27, 26, C.coffeeL);
  pixel(img, 27, 27, C.coffeeL);
  // Steam
  pixel(img, 24, 22, 0xddddddff);
  pixel(img, 25, 21, 0xddddddff);
  pixel(img, 23, 20, 0xddddddff);
  // Belt
  rect(img, 5, 33, 18, 2, C.belt);
  // Pants
  rect(img, 5, 30, 9, 10, C.suitD);
  rect(img, 14, 30, 9, 10, C.suitD);
  rect(img, 6, 30, 3, 10, C.suitM);
  rect(img, 15, 30, 3, 10, C.suitM);
  // Shoes
  rect(img, 4, 38, 10, 2, C.blackL);
  rect(img, 14, 38, 10, 2, C.blackL);
  await img.write(OUT + 'enemy-scrum.png');
  console.log('✓ enemy-scrum.png');
}

async function makeEnemyCoordenador() {
  // 28×40 — coordinator, full suit, badge
  const img = newImg(28, 40);
  // Hair — neat, slicked
  rect(img, 5, 0, 18, 4, C.hairD);
  rect(img, 4, 2, 20, 2, C.hairM);
  // Face — stern
  rect(img, 5, 3, 18, 10, C.skinL);
  // Narrow eyes (stern look)
  hline(img, 7, 7, 5, C.skinD);
  hline(img, 16, 7, 5, C.skinD);
  // No smile — slight frown
  hline(img, 10, 12, 8, C.skinD);
  pixel(img, 9, 11, C.skinD);
  pixel(img, 18, 11, C.skinD);
  // Ears
  pixel(img, 4, 9, C.skinM);
  pixel(img, 23, 9, C.skinM);
  // Neck
  rect(img, 12, 13, 4, 2, C.skinL);
  // Full dark suit
  rect(img, 4, 15, 20, 18, C.suitM);
  rect(img, 4, 15, 3, 18, C.suitL);
  rect(img, 21, 15, 3, 18, C.suitD);
  // Lapels
  rect(img, 10, 15, 4, 8, C.suitL);
  rect(img, 14, 15, 4, 8, C.suitL);
  // Power tie
  rect(img, 12, 15, 4, 14, 0xcc2222ff);
  rect(img, 13, 15, 1, 12, 0xee4444ff);
  // Badge/ID card with lanyard
  pixel(img, 14, 15, 0xcc0000ff);
  pixel(img, 14, 16, 0xcc0000ff);
  pixel(img, 14, 17, 0xcc0000ff);
  pixel(img, 14, 18, 0xcc0000ff);
  pixel(img, 14, 19, 0xcc0000ff);
  rect(img, 10, 20, 8, 10, C.badge);
  rect(img, 11, 21, 4, 4, C.skinM);
  hline(img, 12, 26, 5, C.badgeL);
  hline(img, 12, 28, 5, C.badgeL);
  outline(img, 10, 20, 8, 10);
  // Arms crossed
  rect(img, 4, 24, 20, 5, C.suitM);
  hline(img, 4, 24, 20, C.suitL);
  hline(img, 4, 28, 20, C.suitD);
  // Belt
  rect(img, 4, 33, 20, 2, C.belt);
  // Pants
  rect(img, 4, 30, 9, 10, C.suitD);
  rect(img, 15, 30, 9, 10, C.suitD);
  rect(img, 5, 30, 3, 10, C.suitM);
  rect(img, 16, 30, 3, 10, C.suitM);
  // Shoes
  rect(img, 3, 38, 11, 2, C.black);
  rect(img, 15, 38, 11, 2, C.black);
  await img.write(OUT + 'enemy-coordenador.png');
  console.log('✓ enemy-coordenador.png');
}

async function makeEnemySenior() {
  // 36×46 — senior analyst, bigger, exhausted
  const img = newImg(36, 46);
  // Hair — disheveled, thinning
  rect(img, 7, 0, 22, 4, C.hairM);
  rect(img, 5, 2, 26, 3, C.hairD);
  // Disheveled bits
  pixel(img, 8, 0, C.hairD);
  pixel(img, 24, 1, C.hairD);
  pixel(img, 28, 0, C.hairM);
  // Face — larger, tired
  rect(img, 6, 4, 24, 12, C.skinL);
  // Bigger glasses
  rect(img, 8, 8, 8, 5, C.glassF);
  rect(img, 20, 8, 8, 5, C.glassF);
  rect(img, 16, 9, 4, 3, C.glassF);
  rect(img, 9, 9, 6, 3, C.glassL);
  rect(img, 21, 9, 6, 3, C.glassL);
  // Bags under eyes
  hline(img, 8, 13, 8, C.skinD);
  hline(img, 20, 13, 8, C.skinD);
  // Mouth — exhausted slightly open
  hline(img, 13, 15, 10, C.skinD);
  pixel(img, 12, 14, C.skinD);
  pixel(img, 23, 14, C.skinD);
  // Ears
  pixel(img, 5, 11, C.skinM);
  pixel(img, 30, 11, C.skinM);
  // Neck
  rect(img, 16, 16, 4, 3, C.skinL);
  // Rumpled shirt — larger mid section
  rect(img, 5, 19, 26, 16, C.shirtL);
  rect(img, 5, 19, 4, 16, C.shirtM);
  rect(img, 27, 19, 4, 16, C.shirtD);
  // Belly wider
  rect(img, 4, 27, 28, 8, C.shirtM);
  // Wrinkle lines on shirt
  pixel(img, 8, 22, C.shirtD);
  pixel(img, 10, 25, C.shirtD);
  pixel(img, 22, 21, C.shirtD);
  pixel(img, 25, 24, C.shirtD);
  pixel(img, 18, 28, C.shirtD);
  pixel(img, 12, 30, C.shirtD);
  // Coffee stain on shirt
  rect(img, 14, 26, 5, 3, C.coffeeL);
  pixel(img, 13, 27, C.coffeeL);
  pixel(img, 19, 27, C.coffeeL);
  // Tie — slightly askew
  rect(img, 15, 19, 5, 15, C.tieB);
  rect(img, 16, 19, 2, 13, C.tieL);
  // Belt
  rect(img, 5, 35, 26, 2, C.belt);
  // Pants
  rect(img, 5, 34, 12, 12, C.suitD);
  rect(img, 19, 34, 12, 12, C.suitD);
  rect(img, 6, 34, 4, 12, C.suitM);
  rect(img, 20, 34, 4, 12, C.suitM);
  // Shoes
  rect(img, 4, 44, 14, 2, C.blackL);
  rect(img, 19, 44, 14, 2, C.blackL);
  await img.write(OUT + 'enemy-senior.png');
  console.log('✓ enemy-senior.png');
}

async function makeEnemyGerente() {
  // 44×56 — boss / manager, large, imposing
  const img = newImg(44, 56);
  // Hair — slicked back, neat
  rect(img, 10, 1, 24, 4, C.hairD);
  rect(img, 8, 3, 28, 3, C.hairD);
  hline(img, 10, 2, 24, C.hairM); // shine line
  // Face — large, imposing
  rect(img, 8, 5, 28, 14, C.skinL);
  // Slightly larger features
  pixel(img, 16, 10, C.skinD);
  pixel(img, 17, 10, C.skinD);
  pixel(img, 18, 10, C.skinD);
  pixel(img, 25, 10, C.skinD);
  pixel(img, 26, 10, C.skinD);
  pixel(img, 27, 10, C.skinD);
  // Frown — stern
  hline(img, 17, 17, 10, C.skinD);
  pixel(img, 15, 16, C.skinD);
  pixel(img, 28, 16, C.skinD);
  // Ears
  pixel(img, 7, 12, C.skinM);
  pixel(img, 36, 12, C.skinM);
  // Phone at ear
  rect(img, 33, 6, 6, 10, C.metal);
  rect(img, 34, 7, 4, 8, C.metalD);
  pixel(img, 34, 9, C.metalL);
  // Neck
  rect(img, 18, 19, 8, 3, C.skinL);
  // Large boss suit — dark purple
  rect(img, 6, 22, 32, 24, C.bossS);
  rect(img, 6, 22, 5, 24, C.bossSL);
  rect(img, 33, 22, 5, 24, C.bossS);
  // Wide shoulders
  rect(img, 2, 22, 6, 10, C.bossS);
  rect(img, 36, 22, 6, 10, C.bossS);
  rect(img, 2, 22, 3, 10, C.bossSL);
  // Lapels
  rect(img, 14, 22, 6, 10, C.bossSL);
  rect(img, 24, 22, 6, 10, C.bossSL);
  // Power tie — red
  rect(img, 18, 22, 8, 20, 0xcc2222ff);
  rect(img, 19, 22, 3, 18, 0xee4444ff);
  rect(img, 17, 38, 10, 4, 0xcc2222ff);
  // Multiple badges / stars
  rect(img, 7, 26, 10, 12, C.badge);
  outline(img, 7, 26, 10, 12);
  rect(img, 8, 27, 4, 4, C.skinM);
  hline(img, 9, 32, 7, C.badgeL);
  hline(img, 9, 34, 7, C.badgeL);
  // Star pixels on badge
  pixel(img, 13, 28, C.vestL);
  pixel(img, 15, 29, C.vestL);
  pixel(img, 14, 30, C.vestL);
  // Belt
  rect(img, 6, 46, 32, 2, 0x3a2008ff);
  // Pants
  rect(img, 6, 44, 14, 12, C.bossS);
  rect(img, 24, 44, 14, 12, C.bossS);
  rect(img, 7, 44, 5, 12, C.bossSL);
  rect(img, 25, 44, 5, 12, C.bossSL);
  // Shoes
  rect(img, 5, 54, 15, 2, C.black);
  rect(img, 24, 54, 16, 2, C.black);
  await img.write(OUT + 'enemy-gerente.png');
  console.log('✓ enemy-gerente.png');
}

// ─── ITEM SPRITES ────────────────────────────────────────────────────────────

async function makeItemVrCoin() {
  // 16×16 — gold coin with VR text
  const img = newImg(16, 16);
  // Circle fill
  for (let py = 0; py < 16; py++) {
    for (let px = 0; px < 16; px++) {
      const dx = px - 7.5, dy = py - 7.5;
      const d = dx*dx + dy*dy;
      if (d <= 36) {
        img.setPixelColor(d <= 25 ? C.goldD : C.gold, px, py);
      }
    }
  }
  // Inner circle highlight
  for (let py = 3; py <= 6; py++)
    for (let px = 4; px <= 7; px++) {
      const dx = px - 5, dy = py - 5;
      if (dx*dx + dy*dy <= 4) img.setPixelColor(0xffe080ff, px, py);
    }
  // "VR" pixel text — V
  pixel(img, 4, 5, C.out); pixel(img, 8, 5, C.out);
  pixel(img, 4, 6, C.out); pixel(img, 8, 6, C.out);
  pixel(img, 5, 7, C.out); pixel(img, 7, 7, C.out);
  pixel(img, 6, 8, C.out);
  // "R"
  pixel(img, 10, 5, C.out); pixel(img, 11, 5, C.out); pixel(img, 12, 5, C.out);
  pixel(img, 10, 6, C.out); pixel(img, 12, 6, C.out);
  pixel(img, 10, 7, C.out); pixel(img, 11, 7, C.out);
  pixel(img, 10, 8, C.out); pixel(img, 12, 8, C.out);
  // Coin edge outline
  for (let py = 0; py < 16; py++)
    for (let px = 0; px < 16; px++) {
      const dx = px - 7.5, dy = py - 7.5;
      const d = dx*dx + dy*dy;
      if (d > 36 && d <= 44) img.setPixelColor(C.out, px, py);
    }
  await img.write(OUT + 'item-vr-coin.png');
  console.log('✓ item-vr-coin.png');
}

async function makeItemCoffeeCup() {
  // 16×20 — coffee cup
  const img = newImg(16, 20);
  // Saucer
  rect(img, 1, 15, 14, 3, C.shirtM);
  outline(img, 1, 15, 14, 3);
  // Cup body (white)
  rect(img, 2, 6, 12, 10, C.shirtL);
  outline(img, 2, 6, 12, 10);
  // Coffee inside top
  rect(img, 3, 6, 10, 3, C.coffee);
  // Surface reflection on coffee
  pixel(img, 4, 7, C.coffeeL);
  pixel(img, 5, 7, C.coffeeL);
  // Handle (C-shape)
  pixel(img, 14, 8, C.shirtM);
  pixel(img, 14, 9, C.shirtM);
  pixel(img, 14, 10, C.shirtM);
  pixel(img, 14, 11, C.shirtM);
  pixel(img, 14, 12, C.shirtM);
  pixel(img, 13, 8, C.shirtD);
  pixel(img, 13, 12, C.shirtD);
  // Steam
  pixel(img, 5, 3, 0xddddddff);
  pixel(img, 6, 2, 0xddddddff);
  pixel(img, 7, 3, 0xddddddff);
  pixel(img, 8, 2, 0xddddddff);
  pixel(img, 9, 3, 0xddddddff);
  pixel(img, 5, 4, 0xbbbbbbff);
  pixel(img, 9, 4, 0xbbbbbbff);
  // Logo on cup (simple smile)
  pixel(img, 7, 10, 0x888888ff);
  pixel(img, 8, 10, 0x888888ff);
  pixel(img, 7, 11, 0x888888ff);
  pixel(img, 8, 11, 0x888888ff);
  await img.write(OUT + 'item-coffee-cup.png');
  console.log('✓ item-coffee-cup.png');
}

async function makeItemPostit() {
  // 14×14 — yellow sticky note
  const img = newImg(14, 14);
  // Background
  rect(img, 0, 0, 14, 14, 0xffee44ff);
  // Fold corner (top-right)
  pixel(img, 11, 0, 0xddcc22ff);
  pixel(img, 12, 0, 0xddcc22ff);
  pixel(img, 13, 0, 0xddcc22ff);
  pixel(img, 12, 1, 0xddcc22ff);
  pixel(img, 13, 1, 0xddcc22ff);
  pixel(img, 13, 2, 0xddcc22ff);
  // Shadow under fold
  pixel(img, 11, 1, 0xccbb22ff);
  pixel(img, 12, 2, 0xccbb22ff);
  // Lines
  hline(img, 2, 4, 10, 0xccbb22ff);
  hline(img, 2, 7, 10, 0xccbb22ff);
  hline(img, 2, 10, 10, 0xccbb22ff);
  // Outline
  outline(img, 0, 0, 14, 14);
  await img.write(OUT + 'item-postit.png');
  console.log('✓ item-postit.png');
}

async function makeItemVr() {
  // 16×16 — VR (Vale Refeição) card item
  const img = newImg(16, 16);
  // Card body
  rect(img, 1, 3, 14, 10, 0x2255aaff);
  outline(img, 1, 3, 14, 10);
  // Card shine
  rect(img, 2, 4, 5, 3, 0x4488ddff);
  // "VR" text in white pixels
  // V
  pixel(img, 3, 7, C.white); pixel(img, 7, 7, C.white);
  pixel(img, 3, 8, C.white); pixel(img, 7, 8, C.white);
  pixel(img, 4, 9, C.white); pixel(img, 6, 9, C.white);
  pixel(img, 5, 10, C.white);
  // R
  pixel(img, 9, 7, C.white); pixel(img, 10, 7, C.white); pixel(img, 11, 7, C.white);
  pixel(img, 9, 8, C.white); pixel(img, 11, 8, C.white);
  pixel(img, 9, 9, C.white); pixel(img, 10, 9, C.white);
  pixel(img, 9, 10, C.white); pixel(img, 11, 10, C.white);
  // Gold chip
  rect(img, 2, 6, 3, 4, C.gold);
  outline(img, 2, 6, 3, 4);
  await img.write(OUT + 'item-vr.png');
  console.log('✓ item-vr.png');
}

async function makeItemCafe() {
  // 16×20 — same as coffee cup alias
  const img = newImg(16, 20);
  rect(img, 1, 15, 14, 3, C.shirtM);
  outline(img, 1, 15, 14, 3);
  rect(img, 2, 6, 12, 10, C.shirtL);
  outline(img, 2, 6, 12, 10);
  rect(img, 3, 6, 10, 3, C.coffee);
  pixel(img, 4, 7, C.coffeeL);
  pixel(img, 14, 8, C.shirtM); pixel(img, 14, 9, C.shirtM);
  pixel(img, 14, 10, C.shirtM); pixel(img, 14, 11, C.shirtM); pixel(img, 14, 12, C.shirtM);
  pixel(img, 13, 8, C.shirtD); pixel(img, 13, 12, C.shirtD);
  pixel(img, 5, 3, 0xddddddff); pixel(img, 6, 2, 0xddddddff);
  pixel(img, 7, 3, 0xddddddff); pixel(img, 8, 2, 0xddddddff);
  pixel(img, 9, 3, 0xddddddff);
  await img.write(OUT + 'item-cafe.png');
  console.log('✓ item-cafe.png');
}

// ─── OBJECT SPRITES ──────────────────────────────────────────────────────────

async function makeObjCafeMachine() {
  // 32×40 — coffee machine, black/silver
  const img = newImg(32, 40);
  // Base
  rect(img, 2, 32, 28, 8, C.blackL);
  outline(img, 2, 32, 28, 8);
  // Body
  rect(img, 4, 4, 24, 28, C.black);
  rect(img, 5, 4, 4, 28, C.blackL);
  rect(img, 25, 4, 3, 28, 0x111118ff);
  // Water tank on top
  rect(img, 8, 0, 16, 8, 0x3366aaff);
  rect(img, 9, 1, 14, 5, 0x4488ccff);
  rect(img, 9, 1, 3, 5, 0x88ccffff); // highlight
  outline(img, 8, 0, 16, 8);
  // Control panel
  rect(img, 6, 10, 20, 14, C.metalD);
  rect(img, 7, 11, 18, 12, C.metal);
  outline(img, 6, 10, 20, 14);
  // Display
  rect(img, 8, 12, 10, 5, 0x001a00ff);
  rect(img, 9, 13, 8, 3, 0x00cc44ff);
  // Buttons
  for (let i = 0; i < 3; i++) {
    const bx = 20 + i * 0;
    const cols = [0x00cc44ff, 0xffcc00ff, 0xcc2222ff];
    // 3 buttons side by side
    rect(img, 19 + i * 4, 12, 3, 3, cols[i]);
    outline(img, 19 + i * 4, 12, 3, 3);
  }
  // Nozzle
  rect(img, 12, 22, 8, 4, C.metalD);
  rect(img, 14, 26, 4, 2, C.metal);
  // Steam above nozzle
  pixel(img, 14, 20, 0xddddddff);
  pixel(img, 16, 19, 0xddddddff);
  pixel(img, 15, 18, 0xddddddff);
  // Cup holder tray
  rect(img, 8, 28, 16, 4, C.metalL);
  rect(img, 6, 30, 20, 2, C.metalD);
  outline(img, 6, 28, 20, 4);
  await img.write(OUT + 'obj-cafe-machine.png');
  console.log('✓ obj-cafe-machine.png');
}

async function makeObjBebedouro() {
  // 28×40 — water cooler
  const img = newImg(28, 40);
  // Base
  rect(img, 4, 34, 20, 6, C.metalD);
  outline(img, 4, 34, 20, 6);
  // Feet
  rect(img, 6, 38, 4, 2, C.black);
  rect(img, 18, 38, 4, 2, C.black);
  // Body
  rect(img, 4, 12, 20, 22, C.metalL);
  rect(img, 5, 13, 4, 22, C.metalL);
  rect(img, 6, 14, 16, 18, C.metal);
  outline(img, 4, 12, 20, 22);
  // Cup shelf
  rect(img, 4, 32, 20, 2, C.metalD);
  outline(img, 4, 32, 20, 2);
  // Dispenser taps
  rect(img, 7, 28, 4, 4, C.red);
  outline(img, 7, 28, 4, 4);
  rect(img, 17, 28, 4, 4, C.blue);
  outline(img, 17, 28, 4, 4);
  // Hot/cold labels
  pixel(img, 8, 29, 0xff8888ff); // red tap highlight
  pixel(img, 18, 29, 0x88bbffff); // blue tap highlight
  // Jug (top, blue water)
  rect(img, 8, 0, 12, 14, C.blueL);
  rect(img, 9, 1, 10, 12, C.blue);
  rect(img, 9, 1, 3, 10, 0x88ccffff); // highlight
  // Jug neck
  rect(img, 11, 12, 6, 4, C.blueL);
  rect(img, 12, 12, 4, 4, C.blue);
  outline(img, 8, 0, 12, 14);
  // Brand label on body
  rect(img, 8, 18, 12, 6, C.white);
  rect(img, 9, 19, 10, 4, C.blue);
  outline(img, 8, 18, 12, 6);
  await img.write(OUT + 'obj-bebedouro.png');
  console.log('✓ obj-bebedouro.png');
}

async function makeObjElevador() {
  // 24×44 — elevator doors, metal with yellow warning stripe
  const img = newImg(24, 44);
  // Door frame
  rect(img, 0, 0, 24, 44, C.metalD);
  // Left door panel
  rect(img, 1, 1, 10, 42, C.metal);
  rect(img, 2, 1, 3, 42, C.metalL);
  // Right door panel
  rect(img, 13, 1, 10, 42, C.metal);
  rect(img, 14, 1, 3, 42, C.metalL);
  // Center gap
  rect(img, 11, 1, 2, 42, C.metalD);
  // Door handle lines
  hline(img, 3, 20, 6, C.metalD);
  hline(img, 3, 22, 6, C.metalD);
  hline(img, 15, 20, 6, C.metalD);
  hline(img, 15, 22, 6, C.metalD);
  // Warning stripe at bottom
  rect(img, 0, 36, 24, 8, 0xffcc00ff);
  // Diagonal warning lines
  for (let i = 0; i < 5; i++) {
    const sx = i * 5;
    for (let j = 0; j < 8; j++) {
      if (sx + j < 24) img.setPixelColor(0x111111ff, sx + j, 36 + j);
    }
  }
  outline(img, 0, 36, 24, 8);
  // Button panel (left side)
  rect(img, 0, 16, 2, 12, C.metalD);
  // Up/down arrows (simple pixels)
  pixel(img, 1, 17, 0xffee00ff); // up arrow tip
  pixel(img, 0, 18, 0xffee00ff);
  pixel(img, 1, 18, 0xffee00ff);
  pixel(img, 1, 24, 0xffee00ff); // down arrow tip
  pixel(img, 0, 23, 0xffee00ff);
  pixel(img, 1, 23, 0xffee00ff);
  // Reflections on door
  vline(img, 5, 2, 32, 0xaaaaaeff);
  vline(img, 17, 2, 32, 0xaaaaaeff);
  await img.write(OUT + 'obj-elevador.png');
  console.log('✓ obj-elevador.png');
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('Generating sprites...\n');

  // Player sprites
  await makePlayerIdle();
  await makePlayerWalk0();
  await makePlayerWalk1();
  await makePlayerWalk2();
  await makePlayerWalk3();
  await makePlayerJump();
  await makePlayerAttack();
  await makePlayerDash();

  // Enemy sprites
  await makeEnemyEstagiario();
  await makeEnemyAnalista();
  await makeEnemyFacilitador();
  await makeEnemyScrum();
  await makeEnemyCoordenador();
  await makeEnemySenior();
  await makeEnemyGerente();

  // Item sprites
  await makeItemVrCoin();
  await makeItemCoffeeCup();
  await makeItemPostit();
  await makeItemVr();
  await makeItemCafe();

  // Object sprites
  await makeObjCafeMachine();
  await makeObjBebedouro();
  await makeObjElevador();

  console.log('\nAll sprites generated successfully!');
}

main().catch(err => { console.error(err); process.exit(1); });
