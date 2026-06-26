#!/usr/bin/env python3
"""
Extrai tiles e props de escritório do tileset de fases (1536×1024).
Cada linha do sheet corresponde a uma fase do jogo.
Saída: 32×32px para tiles de chão/parede, 48×64px para props.

Layout visual do sheet (7 linhas):
  Row 0: Tiles + Props padrão (fase 1 — Open Space)
  Row 1: Tiles + Props (fase 2 — Reunião Infinita)
  Row 2: Tiles + Props (fase 3 — Dados/Analytics)
  Row 3: Tiles + Props (fase 4 — TI/Segurança)
  Row 4: Tiles + Props (fase 5 — Diretoria)
  Row 5: Tileset extra (transparente, TANQUE)
  Row 6: Tiles extras/UI

Extraímos apenas linhas 0-4 com prefixo tile-fase-N-* e prop-fase-N-*
"""
from PIL import Image
import numpy as np
from scipy.ndimage import label as ndi_label, binary_dilation
import os

SRC = "public/assets/ChatGPT Image 14 de jun. de 2026, 13_47_28 (1).png"
OUT_DIR = "public/assets/sprites"

TILE_SIZE = 32
PROP_SIZE = (48, 64)
ALPHA_T = 20


def auto_split_row(row_arr, max_sprites=12, tile_w=32, tile_h=32):
    """Divide uma linha do sheet em sprites individuais usando projeção de alpha."""
    alpha = row_arr[:, :, 3].astype(float)
    vproj = alpha.sum(axis=0)

    in_sprite = False
    sprites = []
    start = 0
    min_gap = 4

    i = 0
    while i < len(vproj):
        if not in_sprite and vproj[i] > 50:
            in_sprite = True
            start = i
        elif in_sprite:
            # Check if this is end of sprite (gap)
            gap_end = i
            while gap_end < len(vproj) and vproj[gap_end] < 10:
                gap_end += 1
            gap_len = gap_end - i
            if gap_len >= min_gap:
                sprites.append((start, i))
                in_sprite = False
                i = gap_end
                continue
        i += 1

    if in_sprite:
        sprites.append((start, len(vproj)))

    return sprites


def extract_sprite(row_arr, x0, x1, target_w, target_h):
    """Extrai sprite do intervalo [x0,x1] e redimensiona para target_w×target_h."""
    cell = row_arr[:, x0:x1].copy()
    alpha = cell[:, :, 3]

    # Find content bbox
    rows_with_content = np.any(alpha > ALPHA_T, axis=1)
    cols_with_content = np.any(alpha > ALPHA_T, axis=0)

    if not rows_with_content.any():
        return None

    r0 = np.where(rows_with_content)[0][0]
    r1 = np.where(rows_with_content)[0][-1] + 1
    c0 = np.where(cols_with_content)[0][0]
    c1 = np.where(cols_with_content)[0][-1] + 1

    content = cell[r0:r1, c0:c1]
    ch, cw = content.shape[:2]

    if cw < 4 or ch < 4:
        return None

    # Scale to fit within target while preserving aspect ratio
    scale = min(target_w / cw, target_h / ch)
    if scale < 1:
        new_w = max(1, int(cw * scale))
        new_h = max(1, int(ch * scale))
        img = Image.fromarray(content, 'RGBA').resize((new_w, new_h), Image.NEAREST)
        content = np.array(img)
        ch, cw = content.shape[:2]

    canvas = np.zeros((target_h, target_w, 4), dtype=np.uint8)
    dx = (target_w - cw) // 2
    dy = target_h - 4 - ch  # align to bottom
    if dy < 0:
        dy = 0
    canvas[dy:dy+ch, dx:dx+cw] = content
    return canvas


def main():
    img = Image.open(SRC).convert('RGBA')
    arr = np.array(img)
    H, W = arr.shape[:2]
    print(f"Sheet: {W}×{H}")

    # Find row boundaries by horizontal projection
    alpha = arr[:, :, 3].astype(float)
    hproj = alpha.sum(axis=1)

    # Find row gaps (very low alpha bands)
    in_row = hproj > 200
    rows = []
    r_start = None
    for y in range(H):
        if in_row[y] and r_start is None:
            r_start = y
        elif not in_row[y] and r_start is not None:
            if y - r_start > 20:  # minimum row height
                rows.append((r_start, y))
            r_start = None
    if r_start is not None and H - r_start > 20:
        rows.append((r_start, H))

    print(f"Found {len(rows)} rows")

    # Phase labels (0-indexed rows → phase numbers)
    phase_map = {0: 1, 1: 2, 2: 3, 3: 4, 4: 5}

    total = 0
    for row_idx, (r0, r1) in enumerate(rows[:5]):  # only first 5 rows
        phase = phase_map.get(row_idx, row_idx + 1)
        row_arr = arr[r0:r1]
        print(f"\nRow {row_idx} (Phase {phase}): y={r0}-{r1}")

        sprites = auto_split_row(row_arr)
        print(f"  Found {len(sprites)} sprites")

        for sp_idx, (x0, x1) in enumerate(sprites):
            w = x1 - x0
            # Heuristic: narrow sprites are tiles (floor/wall), wide are props
            if w <= 52:
                target_w, target_h = TILE_SIZE, TILE_SIZE
                prefix = f"tile-fase{phase}"
            else:
                target_w, target_h = PROP_SIZE
                prefix = f"prop-fase{phase}"

            frame = extract_sprite(row_arr, x0, x1, target_w, target_h)
            if frame is None:
                print(f"  SKIP {prefix}-{sp_idx:02d}")
                continue

            fname = f"{prefix}-{sp_idx:02d}.png"
            path = os.path.join(OUT_DIR, fname)
            Image.fromarray(frame, 'RGBA').save(path, optimize=True)
            total += 1
            print(f"  OK   {fname}  ({target_w}×{target_h})")

    print(f"\nTotal extracted: {total} sprites")


if __name__ == "__main__":
    main()
