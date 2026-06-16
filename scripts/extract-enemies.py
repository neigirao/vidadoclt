#!/usr/bin/env python3
"""Extract enemy sprites from the 284d41d1 spritesheet."""
from PIL import Image
import numpy as np
import os

OUT = "/home/user/vidadoclt/public/assets/sprites"
SPRITE_START_X = 170  # portrait/info block is before this x

def bg_mask(arr, threshold=50):
    r,g,b = arr[:,:,0], arr[:,:,1], arr[:,:,2]
    return (r < threshold) & (g < threshold) & (b < threshold)

def find_segments(vals, min_run=2, gap_thresh=8):
    segs = []
    in_seg = False
    start = 0
    last_nonzero = -1
    for i, v in enumerate(vals):
        if v > min_run:
            if not in_seg:
                start = i
                in_seg = True
            last_nonzero = i
        elif in_seg and (i - last_nonzero) > gap_thresh:
            segs.append((start, last_nonzero))
            in_seg = False
    if in_seg:
        segs.append((start, last_nonzero))
    return segs

def split_wide_blob(row_arr, x0, x1, min_gap_h=2):
    col_fg = (~bg_mask(row_arr[:, x0:x1+1])).sum(axis=0)
    result = []
    in_frame = False
    fs = x0
    for xi, v in enumerate(col_fg):
        x = x0 + xi
        if v >= min_gap_h and not in_frame:
            fs = x
            in_frame = True
        elif v < min_gap_h and in_frame:
            result.append((fs, x - 1))
            in_frame = False
    if in_frame:
        result.append((fs, x1))
    # Merge very close sub-segments
    merged = []
    for seg in result:
        if merged and seg[0] - merged[-1][1] <= 3:
            merged[-1] = (merged[-1][0], seg[1])
        else:
            merged.append(list(seg))
    return [tuple(s) for s in merged]

def extract_frames_from_row(arr, y0, y1, prefix, states):
    row = arr[y0:y1+1, :]
    bg = bg_mask(row)
    fg = ~bg
    col_sums = fg.sum(axis=0)
    
    # Find column segments
    raw_segs = find_segments(col_sums, min_run=2, gap_thresh=8)
    
    # Filter: only blobs that start after the portrait block and are >=20px wide
    blobs = [(x0s, x1s) for (x0s, x1s) in raw_segs 
             if x0s >= SPRITE_START_X and x1s - x0s + 1 >= 20]
    
    # Split wide blobs (>65px might be 2 frames)
    all_frames = []
    for (bx0, bx1) in blobs:
        w = bx1 - bx0 + 1
        if w > 65:
            subs = split_wide_blob(row, bx0, bx1, min_gap_h=2)
            subs = [(s0, s1) for (s0, s1) in subs if s1 - s0 + 1 >= 18]
            all_frames.extend(subs)
        else:
            all_frames.append((bx0, bx1))
    
    total_expected = sum(c for _, c in states)
    print(f"  {prefix}: {len(all_frames)} blobs, expected {total_expected}")
    
    # Compute sprite center Y within the row
    row_h = y1 - y0 + 1
    cy_abs = y0 + row_h // 2
    
    saved = []
    fi = 0
    for state_name, state_count in states:
        for si in range(state_count):
            if fi >= len(all_frames):
                print(f"  WARNING: ran out of frames at {state_name}{si}")
                break
            bx0, bx1 = all_frames[fi]
            cx = (bx0 + bx1) // 2
            
            # 48×64 crop centered on the frame
            crop_x0 = max(0, cx - 24)
            crop_x1 = min(arr.shape[1]-1, cx + 24)
            crop_y0 = max(0, cy_abs - 32)
            crop_y1 = min(arr.shape[0]-1, cy_abs + 32)
            
            crop = arr[crop_y0:crop_y1+1, crop_x0:crop_x1+1].copy()
            img_crop = Image.fromarray(crop).convert("RGBA")
            
            # Make dark background transparent
            d = img_crop.load()
            w_c, h_c = img_crop.size
            for py in range(h_c):
                for px in range(w_c):
                    r, g, b, a = d[px, py]
                    if r < 50 and g < 50 and b < 50:
                        d[px, py] = (0, 0, 0, 0)
            
            img_crop = img_crop.resize((48, 64), Image.NEAREST)
            fname = f"{prefix}-{state_name}{si}.png"
            img_crop.save(os.path.join(OUT, fname))
            saved.append(fname)
            fi += 1
    
    return saved

def main():
    img = Image.open("/home/user/vidadoclt/284d41d1-db6e-4309-83b2-43c7cdf4a786.png")
    arr = np.array(img)
    
    enemies = [
        ("enemy-estagiario", (146, 245), [("idle", 4), ("walk", 4), ("attack", 2), ("hurt", 1), ("death", 3)]),
        ("enemy-analista",   (331, 433), [("idle", 4), ("walk", 4), ("attack", 3), ("hurt", 1), ("death", 3)]),
        ("enemy-facilitador",(518, 618), [("idle", 4), ("walk", 4), ("attack", 2), ("hurt", 1), ("death", 3)]),
        ("enemy-scrum",      (692, 799), [("idle", 4), ("walk", 4), ("attack", 3), ("hurt", 1), ("death", 3)]),
        ("enemy-coordenador",(866, 962), [("idle", 4), ("walk", 4), ("attack", 3), ("hurt", 1), ("death", 3)]),
    ]
    
    all_saved = []
    for name, (y0, y1), states in enemies:
        print(f"\nProcessing {name} (y={y0}-{y1})")
        saved = extract_frames_from_row(arr, y0, y1, name, states)
        all_saved.extend(saved)
    
    print(f"\nTotal: {len(all_saved)} frames saved")

if __name__ == "__main__":
    main()
