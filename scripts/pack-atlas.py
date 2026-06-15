#!/usr/bin/env python3
"""Reempacota o atlas com PIL (substitui scripts/pack-atlas.mjs quando sharp não está disponível)."""
from PIL import Image
import os, json, glob

SPRITES_DIR = "public/assets/sprites"
OUT_PNG = "public/assets/atlas.png"
OUT_JSON = "public/assets/atlas.json"
PAD = 2
ATLAS_W = 512

files = sorted(glob.glob(os.path.join(SPRITES_DIR, "*.png")))
sprites = []
for f in files:
    im = Image.open(f).convert("RGBA")
    if im.size[0] > ATLAS_W:
        continue
    sprites.append({"name": os.path.splitext(os.path.basename(f))[0], "im": im, "w": im.size[0], "h": im.size[1]})

sprites.sort(key=lambda s: -s["h"])

x, y, row_h = PAD, PAD, 0
for s in sprites:
    if x + s["w"] + PAD > ATLAS_W:
        x = PAD
        y += row_h + PAD
        row_h = 0
    s["x"], s["y"] = x, y
    x += s["w"] + PAD
    row_h = max(row_h, s["h"])

ATLAS_H = y + row_h + PAD
atlas = Image.new("RGBA", (ATLAS_W, ATLAS_H), (0, 0, 0, 0))
for s in sprites:
    atlas.paste(s["im"], (s["x"], s["y"]), s["im"])
atlas.save(OUT_PNG, optimize=True)

frames = []
for s in sprites:
    frames.append({
        "filename": s["name"],
        "rotated": False,
        "trimmed": False,
        "sourceSize": {"w": s["w"], "h": s["h"]},
        "spriteSourceSize": {"x": 0, "y": 0, "w": s["w"], "h": s["h"]},
        "frame": {"x": s["x"], "y": s["y"], "w": s["w"], "h": s["h"]},
    })

atlas_json = {
    "textures": [{
        "image": "atlas.png",
        "format": "RGBA8888",
        "size": {"w": ATLAS_W, "h": ATLAS_H},
        "scale": 1,
        "frames": frames,
    }],
    "meta": {"app": "pack-atlas.py", "version": "1.0", "scale": "1"},
}
with open(OUT_JSON, "w") as f:
    json.dump(atlas_json, f, indent=2)

print(f"Packed {len(sprites)} sprites → atlas.png ({ATLAS_W}×{ATLAS_H})")
