#!/usr/bin/env python3
"""
Extrai frames do player a partir de Gemini_Generated_Image_iiu1fniiu1fniiu1-Photoroom.png
usando uma grade forçada (coordenadas calibradas a olho — opção 1 do plano).

Pipeline por frame:
  1. recortar slot retangular bruto
  2. achar bbox de pixels com alpha > 32
  3. reduzir proporcionalmente para caber em 48x64 (margem 1px)
  4. colar centrado horizontalmente, base alinhada (PAD_BOTTOM=2)
  5. salvar como public/assets/sprites/player-<anim><i>.png

Contagens de saída batem com o que Player.ts indexa (idle1..4 ainda funciona).
"""
from PIL import Image
import os

SRC = "public/assets/sprites/Gemini_Generated_Image_iiu1fniiu1fniiu1-Photoroom.png"
OUT = "public/assets/sprites"
CANVAS_W, CANVAS_H = 48, 64
PAD_BOTTOM = 2
MAX_W, MAX_H = 46, 60
ALPHA_T = 32

# (y0, y1, x0, x1, count) — coordenadas calibradas no sheet 2400x1341
SECTIONS = {
    # row 1
    "idle":    (160, 292,   45, 1100, 12),
    "walk":    (160, 292, 1140, 2380, 16),
    # row 2
    "run":     (363, 519,   45, 2380, 16),
    # row 3
    "jump":    (523, 721,   45, 1180, 10),
    "fall":    (523, 721, 1220, 1990,  5),
    "dash":    (523, 721, 2020, 2390,  6),
    # row 4
    "attack":  (727, 911,   30, 1790,  9),
    # row 5a (HURT + INTERACT)
    "hurt":    (920,1100,   24,  760,  6),
    "interact":(920,1100,  860, 1900, 11),
    # row 5b (BURNOUT)
    "burnout":(1130,1327,   24, 1900, 10),
}

# Quantos frames manter por anim (amostragem uniforme).
KEEP = {
    "idle": 6, "walk": 8, "run": 8, "jump": 4, "fall": 3,
    "dash": 4, "attack": 6, "hurt": 2, "interact": 3, "burnout": 4,
}

def sample_indices(total, keep):
    if keep >= total: return list(range(total))
    return [round(i * (total - 1) / (keep - 1)) for i in range(keep)]

def extract_frame(src_im, x0, y0, x1, y1):
    cell = src_im.crop((x0, y0, x1, y1))
    bbox = cell.getbbox_alpha() if hasattr(cell, "getbbox_alpha") else None
    if bbox is None:
        # manual alpha bbox
        px = cell.load(); w,h = cell.size
        minx, miny, maxx, maxy = w, h, -1, -1
        for y in range(h):
            for x in range(w):
                if px[x,y][3] > ALPHA_T:
                    if x<minx: minx=x
                    if y<miny: miny=y
                    if x>maxx: maxx=x
                    if y>maxy: maxy=y
        if maxx < 0: return None
        bbox = (minx, miny, maxx+1, maxy+1)
    crop = cell.crop(bbox)
    cw, ch = crop.size
    scale = min(MAX_W / cw, MAX_H / ch)
    if scale < 1:
        nw, nh = max(1, int(cw * scale)), max(1, int(ch * scale))
        crop = crop.resize((nw, nh), Image.NEAREST)
        cw, ch = nw, nh
    canvas = Image.new("RGBA", (CANVAS_W, CANVAS_H), (0,0,0,0))
    dx = (CANVAS_W - cw) // 2
    dy = CANVAS_H - PAD_BOTTOM - ch
    if dy < 0: dy = 0
    canvas.paste(crop, (dx, dy), crop)
    return canvas

def main():
    src = Image.open(SRC).convert("RGBA")
    total_written = 0
    # Remove old player-* sprites
    for f in os.listdir(OUT):
        if f.startswith("player-") and f.endswith(".png"):
            os.remove(os.path.join(OUT, f))
    for anim, (y0, y1, x0, x1, count) in SECTIONS.items():
        cell_w = (x1 - x0) / count
        cell_h = y1 - y0
        keep = KEEP[anim]
        indices = sample_indices(count, keep)
        out_i = 0
        for src_i in indices:
            cx0 = int(x0 + src_i * cell_w)
            cx1 = int(x0 + (src_i + 1) * cell_w)
            frame = extract_frame(src, cx0, y0, cx1, y1)
            if frame is None:
                print(f"  SKIP {anim}{out_i} (frame vazio em cell {src_i})")
                continue
            out_path = os.path.join(OUT, f"player-{anim}{out_i}.png")
            frame.save(out_path, "PNG", optimize=True)
            out_i += 1
            total_written += 1
        print(f"  OK  player-{anim}: {out_i} frames (de {count} no sheet)")
    print(f"\nTotal: {total_written} frames escritos em {OUT}/player-*.png")

if __name__ == "__main__":
    main()
