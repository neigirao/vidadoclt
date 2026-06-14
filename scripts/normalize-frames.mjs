#!/usr/bin/env python3
"""Normalize sprite frame groups so all frames share the same bounding box
and are anchored at the feet (centered horizontally, bottom-aligned with 2px pad).
Eliminates per-frame jitter that looks like flicker in-game."""
import os, re, sys
from PIL import Image
from collections import defaultdict

SPRITES = os.path.join(os.path.dirname(__file__), '..', 'public', 'assets', 'sprites')
SPRITES = os.path.abspath(SPRITES)

ALPHA_THRESHOLD = 20
PAD = 2

# Group key = filename with trailing digits stripped (before .png).
# e.g. player-walk3.png -> player-walk ; enemy-analista-attack2.png -> enemy-analista-attack
GROUP_RE = re.compile(r'^(.*?)(\d+)\.png$')

def group_of(fname):
    m = GROUP_RE.match(fname)
    if not m: return None
    base = m.group(1)
    # Only group player-*, enemy-*, boss-* (and only when there are siblings)
    if not (base.startswith('player-') or base.startswith('enemy-') or base.startswith('boss-')):
        return None
    return base

def bbox_alpha(im):
    # returns (l,t,r,b) of opaque region or None
    a = im.split()[-1]
    # Threshold alpha
    mask = a.point(lambda p: 255 if p > ALPHA_THRESHOLD else 0)
    return mask.getbbox()

def main():
    files = sorted(os.listdir(SPRITES))
    groups = defaultdict(list)
    for f in files:
        if not f.endswith('.png'): continue
        g = group_of(f)
        if g: groups[g].append(f)

    # only process groups with >=2 frames
    processed = 0
    skipped = 0
    for g, frames in sorted(groups.items()):
        if len(frames) < 2:
            skipped += 1
            continue
        # Compute target canvas: original size of frame 0 (all frames in a group should be same size)
        first = Image.open(os.path.join(SPRITES, frames[0])).convert('RGBA')
        W, H = first.size
        # Verify uniform size
        sizes = set()
        ims = []
        for f in frames:
            im = Image.open(os.path.join(SPRITES, f)).convert('RGBA')
            sizes.add(im.size)
            ims.append((f, im))
        if len(sizes) > 1:
            print(f'  SKIP {g}: mixed sizes {sizes}')
            skipped += 1
            continue

        # Compute union bbox across all frames
        union = None
        for _, im in ims:
            b = bbox_alpha(im)
            if b is None: continue
            if union is None:
                union = list(b)
            else:
                union[0] = min(union[0], b[0])
                union[1] = min(union[1], b[1])
                union[2] = max(union[2], b[2])
                union[3] = max(union[3], b[3])
        if union is None:
            print(f'  SKIP {g}: all frames empty')
            skipped += 1
            continue

        cw = union[2] - union[0]
        ch = union[3] - union[1]
        if cw > W or ch > H:
            # shouldn't happen but guard
            print(f'  SKIP {g}: union {cw}x{ch} > canvas {W}x{H}')
            skipped += 1
            continue

        dx = (W - cw) // 2
        dy = H - ch - PAD
        if dy < 0: dy = 0

        for f, im in ims:
            crop = im.crop(tuple(union))
            out = Image.new('RGBA', (W, H), (0,0,0,0))
            out.paste(crop, (dx, dy))
            out.save(os.path.join(SPRITES, f), 'PNG', optimize=True)
        processed += 1
        print(f'  OK   {g}: {len(frames)} frames, bbox={tuple(union)}, anchor=({dx},{dy})')

    print(f'\nDone. Processed {processed} groups, skipped {skipped}.')

if __name__ == '__main__':
    main()
