// ─────────────────────────────────────────────────────────────────────────────
// Cinemática PURA de alcançabilidade de fase — SEM Phaser, para ser testável
// isolada. É o coração do LevelValidator: decide se dá pra pular de uma
// superfície para outra respeitando o arco do pulo (apex + alcance horizontal) e
// sem atravessar um móvel sólido. Um veredito errado aqui deixa passar um layout
// injogável (plataforma inalcançável), então vale travar com teste.
// ─────────────────────────────────────────────────────────────────────────────

export interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** Vão horizontal entre dois intervalos [aL,aR] e [bL,bR] (0 se sobrepõem em x). */
export function gapX(aL: number, aR: number, bL: number, bR: number): number {
  if (aR >= bL && bR >= aL) return 0;
  return aR < bL ? bL - aR : aL - bR;
}

// Dá pra pular da superfície A para a B? Modelo cinemático:
//   rise = yA - yB  (>0 se B mais alta). Precisa rise ≤ apex.
//   tempo até estar na altura de B (raiz maior = descendo): t = (v0 + √(v0²-2g·rise))/g
//   alcance horizontal = walkSpeed · t  (+ dashBonus opcional)
// Além do alcance, o arco do pulo não pode atravessar um móvel sólido (mesa
// alta) que fique entre A e B — senão o pulo estaria bloqueado na prática.
export function canJump(
  aY: number,
  aL: number,
  aR: number,
  bY: number,
  bL: number,
  bR: number,
  jumpVel: number,
  gravity: number,
  walk: number,
  dashBonus: number,
  margin: number,
  furniture: Box[],
): boolean {
  const v0 = -jumpVel; // jumpVel é negativo → v0 > 0
  const apex = (v0 * v0) / (2 * gravity);
  const rise = aY - bY; // subir para B
  if (rise > apex - margin) return false; // não alcança a altura
  const disc = v0 * v0 - 2 * gravity * rise;
  if (disc < 0) return false;
  const tLand = (v0 + Math.sqrt(disc)) / gravity;
  const gap = gapX(aL, aR, bL, bR);
  const reach = walk * tLand + dashBonus + margin;
  if (gap > reach) return false;

  // Obstrução: amostra o arco (borda de A mais próxima de B → borda de B) e
  // rejeita se algum ponto cai dentro de um corpo sólido (excluindo o próprio
  // topo, com folga de 4px). vx constante que pousa em B no tempo tLand.
  const goingRight = (bL + bR) / 2 >= (aL + aR) / 2;
  const startX = goingRight ? aR : aL;
  const endX = goingRight ? bL : bR;
  const vx = (endX - startX) / (tLand || 1);
  for (let i = 1; i < 16; i++) {
    const t = (i / 16) * tLand;
    const x = startX + vx * t;
    const y = aY + jumpVel * t + 0.5 * gravity * t * t;
    for (const f of furniture) {
      if (x > f.left && x < f.right && y > f.top + 4 && y < f.bottom) return false;
    }
  }
  return true;
}
