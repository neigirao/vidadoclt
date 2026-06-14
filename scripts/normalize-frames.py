#!/usr/bin/env python3
"""Re-anchor each sprite frame: crop to its own opaque bbox, then paste
centered-horizontally and bottom-aligned (with PAD) on the original canvas.
This eliminates per-frame jitter where the silhouette shifts between frames."""
import os, re
from PIL import Image
from collections import defaultdict

SPRITES = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'public', 'assets', 'sprites'))
ALPHA_THRESHOLD = 20
PAD_BOTTOM = 2

GROUP_RE = re.compile(r'^(.*?)(\d+)\.png$')

def group_of(fname):
    m = GROUP_RE.match(fname)
    if not m: return None
    base = m.group(1)
    if not (base.startswith('player-') or base.startswith('enemy-') or base.startswith('boss-')):
        return None
    return base

def bbox_alpha(im):
    a = im.split()[-1]
    mask = a.point(lambda p: 255 if p > ALPHA_THRESHOLD else 0)
    return mask.getbbox()

def main():
    files = sorted(os.listdir(SPRITES))
    # group per-character-state (e.g. "player-walk", "enemy-analista-walk")
    # but to keep idle/walk/attack visually consistent at the feet line,
    # we anchor ALL frames of a CHARACTER (everything sharing the same prefix
    # up to last '-state') to the same baseline. Simpler: just bottom-align
    # every frame individually using its own bbox. Works because feet are
    # always the bottom-most opaque pixels.
    groups = defaultdict(list)
    for f in files:
        if not f.endswith('.png'): continue
        g = group_of(f)
        if g: groups[g].append(f)

    processed = 0
    for g, frames in sorted(groups.items()):
        if len(frames) < 2: continue
        # Determine the per-character target baseline so that idle/walk/attack
        # all sit on the same line. Use the LARGEST opaque height across all
        # frames in this group, place baseline at H - PAD_BOTTOM.
        ims = []
        for f in frames:
            im = Image.open(os.path.join(SPRITES, f)).convert('RGBA')
            ims.append((f, im))
        W, H = ims[0][1].size
        if any(im.size != (W, H) for _, im in ims):
            print(f'  SKIP {g}: mixed sizes')
            continue
        target_baseline_y = H - PAD_BOTTOM  # bottom row where feet should land

        any_changes = 0
        for f, im in ims:
            b = bbox_alpha(im)
            if b is None: continue
            l, t, r, btm = b
            crop = im.crop(b)
            cw, ch = crop.size
            # center horizontally, align bottom to target_baseline_y
            dx = (W - cw) // 2
            dy = target_baseline_y - ch
            if dy < 0: dy = 0
            out = Image.new('RGBA', (W, H), (0,0,0,0))
            out.paste(crop, (dx, dy))
            out.save(os.path.join(SPRITES, f), 'PNG', optimize=True)
            any_changes += 1
        processed += 1
        print(f'  OK  {g}: re-anchored {any_changes}/{len(frames)} frames')

    print(f'\nDone. {processed} groups re-anchored.')

if __name__ == '__main__':
    main()
