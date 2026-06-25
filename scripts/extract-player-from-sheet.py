#!/usr/bin/env python3
"""
Extrai frames do player a partir de Gemini_Generated_Image_iiu1fniiu1fniiu1-Photoroom.png
Saída: 80×80 (mesmo tamanho dos sprites atuais do player).

Seções calibradas na Photoroom 2400×1341.
"""
from PIL import Image
import numpy as np
from scipy import ndimage
from scipy.ndimage import binary_dilation
import os

SRC = "public/assets/sprites/Gemini_Generated_Image_iiu1fniiu1fniiu1-Photoroom.png"
OUT = "public/assets/sprites"
CANVAS_W, CANVAS_H = 80, 80
PAD_BOTTOM = 10   # margem inferior (pés)
MAX_W, MAX_H = 60, 60  # deixa ~10px de margem em cada lado
ALPHA_T = 32

# Coords calibradas no sheet Photoroom 2400×1341.
# (y0, y1, x0, x1, count)
SECTIONS = {
    "idle":    (165, 295,   30, 1290, 12),
    "walk":    (165, 295, 1310, 2380, 16),
    "run":     (365, 515,   30, 2380, 16),
    "jump":    (560, 720,   30, 1180, 10),
    "fall":    (560, 720, 1200, 1610,  3),  # 3 frames de queda visíveis no sheet
    "dash":    (560, 720, 1640, 2400,  6),  # 6 frames de dash
    "attack":  (775, 905,   30, 2170, 13),
    "hurt":    (950, 1095,  30,  760,  6),
    "burnout": (1180, 1300,  30, 1470,  6),
}

# Quantos frames o código usa por animação
KEEP = {
    "idle": 6, "walk": 8, "run": 8, "jump": 6, "fall": 3,
    "dash": 1, "attack": 3, "hurt": 1, "burnout": 4,
}


def sample_indices(total, keep):
    if keep >= total:
        return list(range(total))
    if keep == 1:
        return [0]
    return [round(i * (total - 1) / (keep - 1)) for i in range(keep)]


def isolate_center_component(cell_rgba):
    """Devolve bbox do componente conectado mais próximo do centro horizontal."""
    a = np.array(cell_rgba)
    mask = a[:, :, 3] > ALPHA_T
    if not mask.any():
        return None
    closed = binary_dilation(mask, iterations=6,
                             structure=np.array([[0, 1, 0], [0, 1, 0], [0, 1, 0]]))
    lbl, n = ndimage.label(closed)
    if n == 0:
        return None
    H, W = mask.shape
    cx = W // 2
    best = None
    best_dist = 10 ** 9
    for i in range(1, n + 1):
        ys, xs = np.where(lbl == i)
        if len(ys) < 100:
            continue
        x0_, x1_ = xs.min(), xs.max()
        if x1_ - x0_ < 10:
            continue
        comp_cx = (x0_ + x1_) // 2
        dist = abs(comp_cx - cx)
        if dist < best_dist:
            best_dist = dist
            comp_mask = (lbl == i) & mask
            ys2, xs2 = np.where(comp_mask)
            if len(ys2) == 0:
                continue
            best = (xs2.min(), ys2.min(), xs2.max() + 1, ys2.max() + 1)
    return best


def extract_frame(src_im, x0, y0, x1, y1):
    cell = src_im.crop((x0, y0, x1, y1))
    bbox = isolate_center_component(cell)
    if bbox is None:
        return None
    crop = cell.crop(bbox)
    cw, ch = crop.size
    scale = min(MAX_W / cw, MAX_H / ch)
    if scale < 1:
        nw, nh = max(1, int(cw * scale)), max(1, int(ch * scale))
        crop = crop.resize((nw, nh), Image.NEAREST)
        cw, ch = nw, nh
    canvas = Image.new("RGBA", (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
    dx = (CANVAS_W - cw) // 2
    dy = CANVAS_H - PAD_BOTTOM - ch
    if dy < 0:
        dy = 0
    canvas.paste(crop, (dx, dy), crop)
    return canvas


def main():
    src = Image.open(SRC).convert("RGBA")
    # Remove frames antigos
    for f in os.listdir(OUT):
        if f.startswith("player-") and f.endswith(".png"):
            os.remove(os.path.join(OUT, f))
    total = 0
    for anim, (y0, y1, x0, x1, count) in SECTIONS.items():
        slot_w = (x1 - x0) / count
        keep = KEEP[anim]
        indices = sample_indices(count, keep)
        out_i = 0
        for src_i in indices:
            cx0 = int(x0 + src_i * slot_w)
            cx1 = int(x0 + (src_i + 1) * slot_w)
            frame = extract_frame(src, cx0, y0, cx1, y1)
            if frame is None:
                print(f"  SKIP {anim}{out_i}")
                continue
            frame.save(os.path.join(OUT, f"player-{anim}{out_i}.png"), "PNG", optimize=True)
            out_i += 1
            total += 1
        print(f"  OK  player-{anim}: {out_i}/{keep}")
    print(f"\nTotal: {total} frames")


if __name__ == "__main__":
    main()
