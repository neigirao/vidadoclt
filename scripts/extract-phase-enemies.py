#!/usr/bin/env python3
"""
Re-extrai inimigos das fases 2-5 do ChatGPT spritesheet (1717×916, fundo #040608).
Layout: 2 colunas (L x=0-858, R x=858-1717), 10 linhas de 2 inimigos cada.
Saída: 48×64px (maior que os 32×48 anteriores — mais legível).
"""
from PIL import Image
import numpy as np
from scipy import ndimage
from scipy.ndimage import binary_dilation
import os

SRC   = "public/assets/sprites/ChatGPT Image 12 de jun. de 2026, 22_10_45.png"
OUT   = "public/assets/sprites"
CANVAS_W, CANVAS_H = 48, 64
PAD_BOTTOM = 4
MAX_W, MAX_H = 42, 56
ALPHA_T = 30

# X frames dentro de cada coluna (coluna L base=0, coluna R base=858)
IDLE_XS   = [60, 100, 140, 180]
WALK_XS   = [240, 280, 320, 360]
ATTACK_XS = [430, 470, 510]
HURT_XS   = [580, 620]
DEATH_XS  = [650, 690, 730]

ANIM_SECTIONS = [
    ("idle",   IDLE_XS),
    ("walk",   WALK_XS),
    ("attack", ATTACK_XS),
    ("hurt",   HURT_XS),
    ("death",  DEATH_XS),
]

# Inimigos ilegíveis: (prefix, y_center, x_base)
# y_center e x_base derivados da análise visual do sheet
TARGETS = [
    ("enemy-telemarketer", 292, 858),   # row3 right
    ("enemy-cabo",         472,   0),   # row5 left
    ("enemy-coletor",      640,   0),   # row7 left
    ("enemy-noticeboard",  640, 858),   # row7 right
    ("enemy-drone",        730,   0),   # row8 left (shifted down away from labels)
    ("enemy-carimbador",   730, 858),   # row8 right
    ("enemy-planilha",     808,   0),   # row9 left
    ("enemy-arquivo",      808, 858),   # row9 right
    ("enemy-bateria",      877,   0),   # row10 left (shifted down away from labels)
]

CROP_W = 70
CROP_H = 60   # narrow enough to not bleed into adjacent rows
LABEL_SKIP_TOP = 18  # ignorar top N px do crop (região de labels de texto)


def remove_dark_bg(arr):
    """Remove background escuro (#040608 ± margem)."""
    r, g, b = arr[:,:,0], arr[:,:,1], arr[:,:,2]
    is_bg = (r < 40) & (g < 40) & (b < 40)
    result = arr.copy()
    result[is_bg, 3] = 0
    return result


def isolate_center(cell_rgba):
    """Retorna bbox do maior componente conectado próximo ao centro horizontal."""
    a = cell_rgba[:,:,3].copy()
    # Ignorar região de labels no topo
    a[:LABEL_SKIP_TOP, :] = 0
    mask = a > ALPHA_T
    if not mask.any():
        return None
    closed = binary_dilation(mask, iterations=5,
                             structure=np.array([[0,1,0],[0,1,0],[0,1,0]]))
    lbl, n = ndimage.label(closed)
    if n == 0:
        return None
    H, W = mask.shape
    cx = W // 2
    best = None
    best_score = -1
    for i in range(1, n + 1):
        comp = (lbl == i) & mask
        ys, xs = np.where(comp)
        if len(ys) < 50:
            continue
        x0_, x1_ = xs.min(), xs.max()
        y0_, y1_ = ys.min(), ys.max()
        if x1_ - x0_ < 6 or y1_ - y0_ < 8:
            continue
        size = len(ys)
        dist = abs((x0_ + x1_) // 2 - cx)
        score = size - dist * 3
        if score > best_score:
            best_score = score
            best = (x0_, y0_, x1_ + 1, y1_ + 1)
    return best


def extract_frame(src_arr, cx, cy):
    x0 = max(0, cx - CROP_W // 2)
    y0 = max(0, cy - CROP_H // 2)
    x1 = min(src_arr.shape[1], x0 + CROP_W)
    y1 = min(src_arr.shape[0], y0 + CROP_H)
    cell = src_arr[y0:y1, x0:x1].copy()
    cell = remove_dark_bg(cell)
    bbox = isolate_center(cell)
    if bbox is None:
        return None
    bx0, by0, bx1, by1 = bbox
    crop = cell[by0:by1, bx0:bx1]
    ch, cw = crop.shape[:2]
    scale = min(MAX_W / cw, MAX_H / ch)
    if scale < 1:
        new_w = max(1, int(cw * scale))
        new_h = max(1, int(ch * scale))
        img = Image.fromarray(crop, 'RGBA')
        img = img.resize((new_w, new_h), Image.NEAREST)
        crop = np.array(img)
        ch, cw = crop.shape[:2]
    canvas = np.zeros((CANVAS_H, CANVAS_W, 4), dtype=np.uint8)
    dx = (CANVAS_W - cw) // 2
    dy = CANVAS_H - PAD_BOTTOM - ch
    if dy < 0: dy = 0
    canvas[dy:dy+ch, dx:dx+cw] = crop
    return canvas


def main():
    src_img = Image.open(SRC).convert("RGBA")
    src_arr = np.array(src_img)
    print(f"Sheet: {src_arr.shape[1]}×{src_arr.shape[0]}")

    total = 0
    for prefix, cy, x_base in TARGETS:
        print(f"\n  [{prefix}] cy={cy} x_base={x_base}")
        for anim, rel_xs in ANIM_SECTIONS:
            for i, rx in enumerate(rel_xs):
                cx = x_base + rx
                frame = extract_frame(src_arr, cx, cy)
                fname = f"{prefix}-{anim}{i}.png"
                if frame is None:
                    print(f"    SKIP {fname}")
                    continue
                path = os.path.join(OUT, fname)
                Image.fromarray(frame, 'RGBA').save(path, optimize=True)
                total += 1
                print(f"    OK   {fname}")
    print(f"\nTotal: {total} frames")


if __name__ == "__main__":
    main()
