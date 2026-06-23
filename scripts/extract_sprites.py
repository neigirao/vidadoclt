#!/usr/bin/env python3
"""
Extract sprites from sprite sheets in inimigos/ folder,
add 1px outlines, and save to the main sprites directory.
"""

from PIL import Image
import numpy as np
from scipy.ndimage import binary_erosion, binary_dilation
import os

INIMIGOS_DIR = "/home/user/vidadoclt/public/assets/sprites/inimigos/"
OUT_DIR = "/home/user/vidadoclt/public/assets/sprites/"


def add_outline(img):
    arr = np.array(img.convert('RGBA'))
    alpha = arr[:, :, 3]
    opaque = alpha > 128

    border = binary_dilation(opaque) & ~opaque
    inner_ring = binary_erosion(opaque, iterations=2) & opaque if opaque.sum() > 0 else opaque

    if inner_ring.sum() > 0:
        avg_lum = (arr[inner_ring, 0].mean() * 0.299 +
                   arr[inner_ring, 1].mean() * 0.587 +
                   arr[inner_ring, 2].mean() * 0.114)
        outline_color = (238, 228, 196, 255) if avg_lum < 140 else (24, 20, 16, 255)
    else:
        outline_color = (24, 20, 16, 255)

    result = arr.copy()
    ys, xs = np.where(border)
    result[ys, xs] = outline_color
    return Image.fromarray(result, 'RGBA')


def crop_tight(img):
    """Crop transparent padding from a sprite."""
    arr = np.array(img.convert('RGBA'))
    alpha = arr[:, :, 3]
    rows = np.any(alpha > 10, axis=1)
    cols = np.any(alpha > 10, axis=0)
    if not rows.any() or not cols.any():
        return img
    rmin, rmax = np.where(rows)[0][[0, -1]]
    cmin, cmax = np.where(cols)[0][[0, -1]]
    return img.crop((cmin, rmin, cmax + 1, rmax + 1))


def extract_grid(sheet_path, name, rows, cols, state_names, scale_to=None):
    """
    Extract a regular grid of sprites from a sheet.
    state_names: flat list of state names for frames in row-major order.
    """
    img = Image.open(sheet_path).convert('RGBA')
    W, H = img.size
    cell_w = W // cols
    cell_h = H // rows

    extracted = []
    idx = 0
    for row in range(rows):
        for col in range(cols):
            if idx >= len(state_names):
                break
            state = state_names[idx]
            idx += 1
            x0 = col * cell_w
            y0 = row * cell_h
            cell = img.crop((x0, y0, x0 + cell_w, y0 + cell_h))
            # Check if cell has meaningful content
            arr = np.array(cell)
            if arr[:, :, 3].max() < 10:
                print(f"  Skipping empty cell row={row} col={col}")
                continue
            # Crop tight and scale
            cell = crop_tight(cell)
            if scale_to:
                cell = cell.resize(scale_to, Image.LANCZOS)
            # Add outline
            cell = add_outline(cell)
            filename = f"enemy-{name}-{state}.png"
            out_path = os.path.join(OUT_DIR, filename)
            cell.save(out_path)
            extracted.append(filename)
            print(f"  Saved: {filename} ({cell.size})")
    return extracted


def run():
    # Mapping: file prefix -> (name, rows, cols, state_names)
    # All extracted to 48x64 or similar pixel art size

    sheets = {
        # 9aqvva: analista-novo — 2 rows x 6 cols = 12 frames
        "9aqvva9aqvva9aqv": (
            "analista-novo", 2, 6,
            ["idle0", "walk0", "walk1", "walk2", "walk3", "walk4",
             "attack0", "attack1", "hurt0", "death0", "death1", "death2"]
        ),

        # dgym6f: evangelista — 4 rows x 4 cols = 16 frames
        "dgym6fdgym6fdgym": (
            "evangelista", 4, 4,
            ["idle0", "idle1", "walk0", "walk1",
             "attack0", "attack1", "attack2", "attack3",
             "hurt0", "death0", "death1", "death2",
             "frame12", "frame13", "frame14", "frame15"]
        ),

        # fgs000: impressora — 2 rows x 7 cols = 14 frames  (2400x560, cell=342x280)
        "fgs000fgs000fgs0": (
            "impressora", 2, 7,
            ["idle0", "walk0", "walk1", "walk2", "walk3", "walk4", "walk5",
             "attack0", "attack1", "hurt0", "death0", "death1", "death2", "death3"]
        ),

        # hgnzts: senior — 4 rows x 3 cols = 12 frames (2048x2048, cell=682x512)
        "hgnztshgnztshgnz": (
            "senior", 4, 3,
            ["idle0", "walk0", "walk1",
             "attack0", "attack1", "attack2",
             "hurt0", "hurt1", "death0",
             "death1", "death2", "death3"]
        ),

        # m2ejsl: estagiario — 2 rows x 7 cols = 14 frames (2400x736, cell=342x368)
        "m2ejslm2ejslm2ej": (
            "estagiario", 2, 7,
            ["idle0", "walk0", "walk1", "walk2", "walk3", "walk4", "walk5",
             "attack0", "attack1", "hurt0", "death0", "death1", "death2", "death3"]
        ),

        # mi9kis: analista — 2 rows x 6 cols = 12 frames (2400x1601, cell=400x800)
        "mi9kismi9kismi9k": (
            "analista", 2, 6,
            ["idle0", "walk0", "walk1", "walk2", "walk3", "walk4",
             "attack0", "attack1", "hurt0", "death0", "death1", "death2"]
        ),

        # mil5to: facilitador — 2 rows x 7 cols = 14 frames (1264x843, 2-row)
        "mil5tomil5tomil5": (
            "facilitador", 2, 7,
            ["idle0", "walk0", "walk1", "walk2", "walk3", "walk4", "walk5",
             "attack0", "attack1", "hurt0", "death0", "death1", "death2", "death3"]
        ),

        # nrajoz: ti-suporte — 4 rows x 3-4 cols (2048x2048, treat as 4x4=16)
        "nrajoznrajoznraj": (
            "ti-suporte", 4, 4,
            ["idle0", "walk0", "walk1", "walk2",
             "attack0", "attack1", "attack2", "attack3",
             "hurt0", "death0", "death1", "death2",
             "frame12", "frame13", "frame14", "frame15"]
        ),

        # pkt5vm: evangelista-boss — 3 rows x 5 cols = 15 frames (2400x1599, cell=480x533)
        "pkt5vmpkt5vmpkt5": (
            "evangelista-boss", 3, 5,
            ["idle0", "idle1", "walk0", "walk1", "walk2",
             "attack0", "attack1", "attack2", "hurt0", "hurt1",
             "death0", "death1", "death2", "death3", "death4"]
        ),

        # ra7c2a: rh — 1 row x 11 cols (2400x678, cell=218x678)
        "ra7c2ara7c2ara7c": (
            "rh", 1, 11,
            ["idle0", "walk0", "walk1", "walk2", "walk3",
             "attack0", "attack1", "hurt0", "death0", "death1", "death2"]
        ),

        # tb2y6g: impressora-b — 2 rows x 7 cols (2400x560)
        "tb2y6gtb2y6gtb2y": (
            "impressora-b", 2, 7,
            ["idle0", "walk0", "walk1", "walk2", "walk3", "walk4", "walk5",
             "attack0", "attack1", "hurt0", "death0", "death1", "death2", "death3"]
        ),

        # thwmcc: estagiario-b — 2 rows x 6 cols (1264x843)
        "thwmccthwmccthwm": (
            "estagiario-b", 2, 6,
            ["idle0", "walk0", "walk1", "walk2", "walk3", "walk4",
             "attack0", "attack1", "hurt0", "death0", "death1", "death2"]
        ),

        # ttvc6b: impressora-c — 2 rows x 7 cols (2400x560)
        "ttvc6bttvc6bttvc": (
            "impressora-c", 2, 7,
            ["idle0", "walk0", "walk1", "walk2", "walk3", "walk4", "walk5",
             "attack0", "attack1", "hurt0", "death0", "death1", "death2", "death3"]
        ),

        # xvimyt: impressora-d — 2 rows x 7 cols (2400x560)
        "xvimytxvimytxvim": (
            "impressora-d", 2, 7,
            ["idle0", "walk0", "walk1", "walk2", "walk3", "walk4", "walk5",
             "attack0", "attack1", "hurt0", "death0", "death1", "death2", "death3"]
        ),

        # yhl1fw: seguranca — 2 rows x 7 cols (2400x756, cell=342x378)
        "yhl1fwyhl1fwyhl1": (
            "seguranca", 2, 7,
            ["idle0", "walk0", "walk1", "walk2", "walk3", "walk4", "walk5",
             "attack0", "attack1", "hurt0", "death0", "death1", "death2", "death3"]
        ),

        # yzzcq7: evangelista-mega — 4 rows x 4 cols = 16 frames (2048x2048)
        "yzzcq7yzzcq7yzzc": (
            "evangelista-mega", 4, 4,
            ["idle0", "idle1", "walk0", "walk1",
             "attack0", "attack1", "attack2", "attack3",
             "hurt0", "death0", "death1", "death2",
             "frame12", "frame13", "frame14", "frame15"]
        ),
    }

    for prefix, (name, rows, cols, states) in sheets.items():
        filename = f"Gemini_Generated_Image_{prefix}-Photoroom.png"
        path = os.path.join(INIMIGOS_DIR, filename)
        if not os.path.exists(path):
            print(f"MISSING: {filename}")
            continue
        print(f"\nProcessing: {name} ({rows}x{cols}) from {filename}")
        extract_grid(path, name, rows, cols, states)

    print("\nDone!")


if __name__ == "__main__":
    run()
