#!/usr/bin/env python3
"""
Extract individual enemy sprites from the two reference sprite sheets.
Sheet 1: 40d08d2f-... (21 common enemies)
Sheet 2: 4f9ff812-... (bosses, elite enemies, NPCs - handled separately)
"""

import os
import sys
import numpy as np
from PIL import Image
from scipy.ndimage import label, binary_dilation

SPRITES_DIR = "/home/user/vidadoclt/public/assets/sprites"
SHEET1_PATH = os.path.join(SPRITES_DIR, "40d08d2f-6b29-406d-b58a-d94453f11047-Photoroom.png")
SHEET2_PATH = os.path.join(SPRITES_DIR, "4f9ff812-13f4-4db7-857e-210d5c62879b-Photoroom.png")


def find_sprite_blobs(arr, y1, y2, x1, x2, alpha_threshold=80, min_pixels=900, dilation=1, min_height=30):
    """Find individual sprite blobs in a region using connected-component labeling."""
    section = arr[y1:y2, x1:x2, :]
    alpha = section[:, :, 3]
    binary = alpha > alpha_threshold

    if dilation > 0:
        dilated = binary_dilation(binary, iterations=dilation)
    else:
        dilated = binary

    labeled, num_features = label(dilated)

    blobs = []
    for i in range(1, num_features + 1):
        blob_mask = (labeled == i)
        rows = np.where(np.any(blob_mask, axis=1))[0]
        cols = np.where(np.any(blob_mask, axis=0))[0]
        orig_pixel_count = np.sum(binary[blob_mask])

        h = rows[-1] - rows[0] + 1
        w = cols[-1] - cols[0] + 1

        if orig_pixel_count >= min_pixels and h >= min_height:
            blobs.append({
                'y1': rows[0] + y1,
                'y2': rows[-1] + y1,
                'x1': cols[0] + x1,
                'x2': cols[-1] + x1,
                'h': h,
                'w': w,
                'pixels': orig_pixel_count,
            })

    blobs.sort(key=lambda b: b['x1'])
    return blobs


def split_wide_blob(arr, blob, alpha_threshold=80, min_gap=8):
    """
    Split a wide blob into individual frames.
    Only splits if there is a CLEAR gap (zero or near-zero pixel count) between frames.
    This is used for death animations where 2 sprites lie side by side.

    IMPORTANT: Many wide blobs are actually single frames with particles/effects
    (e.g. drone laser, carimbador stamp, noticeboard papers, cabo tentacles).
    We only split if there's a very clear gap in the column density.
    """
    y1, y2, x1, x2 = blob['y1'], blob['y2'], blob['x1'], blob['x2']
    section = arr[y1:y2 + 1, x1:x2 + 1, :]
    alpha = section[:, :, 3]
    col_profile = np.sum(alpha > alpha_threshold, axis=0)

    # Find CLEAR gaps (columns where very few pixels exist — must be < 5% of peak)
    peak = max(col_profile) if len(col_profile) > 0 else 1
    gap_threshold = max(2, peak * 0.05)  # Only 5% of peak = very clear gap

    # Find gap regions - must be continuous clear gaps
    in_gap = False
    gaps = []
    gap_start = None
    for x in range(len(col_profile)):
        if col_profile[x] <= gap_threshold and not in_gap:
            gap_start = x
            in_gap = True
        elif col_profile[x] > gap_threshold and in_gap:
            gap_width = x - gap_start
            if gap_width >= min_gap:
                gaps.append((gap_start, x - 1))
            in_gap = False

    if not gaps:
        return [blob]

    # Additional check: each resulting frame should be at least 30px wide and have significant content
    split_points = [0] + [(g[0] + g[1]) // 2 for g in gaps] + [x2 - x1 + 1]
    frames = []
    for i in range(len(split_points) - 1):
        fx1 = x1 + split_points[i]
        fx2 = x1 + split_points[i + 1] - 1

        # Verify the segment has enough width
        if fx2 - fx1 < 20:
            # Too narrow — don't split, return original blob
            return [blob]

        # Find actual content bounds within this frame slice
        frame_slice = arr[y1:y2 + 1, fx1:fx2 + 1, :]
        alpha_slice = frame_slice[:, :, 3]
        rows_with_content = np.any(alpha_slice > alpha_threshold, axis=1)
        cols_with_content = np.any(alpha_slice > alpha_threshold, axis=0)

        r_idx = np.where(rows_with_content)[0]
        c_idx = np.where(cols_with_content)[0]

        if len(r_idx) == 0 or len(c_idx) == 0:
            continue

        frame_pixel_count = np.sum(alpha_slice > alpha_threshold)
        if frame_pixel_count < 500:
            # Too few pixels — probably just particles, don't split
            return [blob]

        frames.append({
            'y1': y1 + r_idx[0],
            'y2': y1 + r_idx[-1],
            'x1': fx1 + c_idx[0],
            'x2': fx1 + c_idx[-1],
            'h': r_idx[-1] - r_idx[0] + 1,
            'w': c_idx[-1] - c_idx[0] + 1,
            'pixels': frame_pixel_count,
        })

    return frames if len(frames) >= 2 else [blob]


def extract_sprite(arr, blob, padding=2):
    """Extract a sprite from the image array with some padding."""
    y1 = max(0, blob['y1'] - padding)
    y2 = min(arr.shape[0] - 1, blob['y2'] + padding)
    x1 = max(0, blob['x1'] - padding)
    x2 = min(arr.shape[1] - 1, blob['x2'] + padding)

    # Extract the region
    region = arr[y1:y2 + 1, x1:x2 + 1, :]

    # Create image with transparent background
    img = Image.fromarray(region, 'RGBA')
    return img


def assign_animation_states(blobs, char_name):
    """
    Assign animation state names to blobs based on their order.

    The animation order in the reference sheet is always left-to-right:
    IDLE -> WALK (optional, 1-3 frames) -> ATTACK -> HURT -> DEATH

    We detect WALK frames by checking if the character has multiple similar-sized
    frames in sequence before the ATTACK section.

    Characters with no WALK: impressora, noticeboard, cabo, drone, carimbador,
    planilha, arquivo, bateria, reuniao, ti-suporte, coletor

    Characters with WALK: estagiario, analista, facilitador, scrum, senior,
    coordenador, telemarketer, guardiao-cafe, evangelista, seguranca
    """
    # Characters that have no WALK animation (stationary enemies)
    NO_WALK = {
        'impressora', 'noticeboard', 'cabo', 'drone', 'carimbador',
        'planilha', 'arquivo', 'bateria', 'reuniao', 'ti-suporte', 'coletor'
    }

    # Characters where we see 3 WALK frames (estagiario-style)
    THREE_WALK = {'estagiario', 'analista', 'facilitador'}

    # Characters where we see 2 WALK frames (scrum-style)
    TWO_WALK = {'scrum', 'senior', 'coordenador', 'telemarketer', 'guardiao-cafe', 'evangelista', 'seguranca'}

    n = len(blobs)

    if char_name in NO_WALK:
        # Pattern: IDLE, ATTACK, HURT, DEATH (4 blobs)
        # Or: IDLE, IDLE1, ATTACK, HURT, DEATH (5 blobs for some)
        if n == 4:
            states = ['idle0', 'attack0', 'hurt0', 'death0']
        elif n == 5:
            states = ['idle0', 'idle1', 'attack0', 'hurt0', 'death0']
        elif n == 3:
            states = ['idle0', 'attack0', 'death0']
        else:
            # Fallback: label sequentially
            states = []
            for i in range(n):
                if i == 0:
                    states.append('idle0')
                elif i == n - 1:
                    states.append('death0')
                elif i == n - 2:
                    states.append('hurt0')
                else:
                    states.append(f'attack{i-1}')
    elif char_name in THREE_WALK:
        # Pattern: IDLE, WALK0, WALK1, WALK2, ATTACK, HURT, DEATH (7 blobs)
        if n == 7:
            states = ['idle0', 'walk0', 'walk1', 'walk2', 'attack0', 'hurt0', 'death0']
        elif n == 6:
            states = ['idle0', 'walk0', 'walk1', 'attack0', 'hurt0', 'death0']
        else:
            states = _fallback_states(n)
    elif char_name in TWO_WALK:
        # Pattern: IDLE, WALK0, WALK1, ATTACK, HURT, DEATH (6 blobs)
        if n == 6:
            states = ['idle0', 'walk0', 'walk1', 'attack0', 'hurt0', 'death0']
        elif n == 5:
            states = ['idle0', 'walk0', 'attack0', 'hurt0', 'death0']
        elif n == 7:
            states = ['idle0', 'walk0', 'walk1', 'walk2', 'attack0', 'hurt0', 'death0']
        else:
            states = _fallback_states(n)
    else:
        states = _fallback_states(n)

    return states


def _fallback_states(n):
    """Generate fallback state names for n blobs."""
    if n == 4:
        return ['idle0', 'attack0', 'hurt0', 'death0']
    elif n == 5:
        return ['idle0', 'walk0', 'attack0', 'hurt0', 'death0']
    elif n == 6:
        return ['idle0', 'walk0', 'walk1', 'attack0', 'hurt0', 'death0']
    elif n == 7:
        return ['idle0', 'walk0', 'walk1', 'walk2', 'attack0', 'hurt0', 'death0']
    elif n == 3:
        return ['idle0', 'attack0', 'death0']
    else:
        states = []
        for i in range(n):
            states.append(f'frame{i}')
        return states


def process_character(arr, y1, y2, x1, x2, char_name, output_dir, dry_run=False):
    """Extract all sprites for one character and save them."""
    print(f"\n  Processing {char_name} (y={y1}-{y2}, x={x1}-{x2})...")

    blobs = find_sprite_blobs(arr, y1, y2, x1, x2)
    if not blobs:
        print(f"    WARNING: No blobs found for {char_name}")
        return []

    print(f"    Found {len(blobs)} raw blobs")

    # Check if any blob needs splitting.
    # DEATH frames sometimes show 2 sprites lying side by side (wide, low height).
    # We only split blobs that are:
    # - Very wide (> 150px)
    # - Short height (< 65px) relative to width — indicates a "lying down" death pose
    # - And have a clear internal gap
    final_blobs = []
    for blob in blobs:
        aspect = blob['w'] / max(blob['h'], 1)
        # Only try to split: very wide AND short (death pose), not just wide due to particles
        if blob['w'] > 150 and blob['h'] < 60 and aspect > 2.2:
            sub_blobs = split_wide_blob(arr, blob)
            if len(sub_blobs) > 1:
                print(f"    Split wide blob (w={blob['w']},h={blob['h']}) into {len(sub_blobs)} frames")
                final_blobs.extend(sub_blobs)
            else:
                final_blobs.append(blob)
        else:
            final_blobs.append(blob)

    states = assign_animation_states(final_blobs, char_name)

    if len(states) < len(final_blobs):
        # More blobs than expected - truncate
        print(f"    WARNING: {len(final_blobs)} blobs but only {len(states)} states defined, truncating")
        final_blobs = final_blobs[:len(states)]
    elif len(states) > len(final_blobs):
        # Fewer blobs than expected - pad states
        states = states[:len(final_blobs)]

    saved_files = []
    for blob, state in zip(final_blobs, states):
        filename = f"enemy-{char_name}-{state}.png"
        filepath = os.path.join(output_dir, filename)

        if dry_run:
            print(f"    [DRY RUN] Would save: {filename} (from x={blob['x1']}-{blob['x2']}, y={blob['y1']}-{blob['y2']})")
        else:
            sprite = extract_sprite(arr, blob, padding=3)
            sprite.save(filepath)
            print(f"    Saved: {filename} ({sprite.size[0]}x{sprite.size[1]})")
            saved_files.append(filepath)

    return saved_files


def extract_sheet1(dry_run=False):
    """Extract all sprites from sheet 1 (21 common enemies)."""
    print("\n=== Extracting Sheet 1 (INIMIGOS COMUNS) ===")

    sheet = Image.open(SHEET1_PATH)
    arr = np.array(sheet)

    # Character definitions: (y1, y2, x_slot, char_name)
    # y ranges are the sprite content areas (excluding sheet title at top)
    # x slots: 0=left, 1=center, 2=right (each slot is 511px wide)
    CHAR_SLOT_WIDTH = 511

    # (row_y1, row_y2, [char_names left to right])
    CHARACTER_ROWS = [
        (60, 192, ["estagiario", "analista", "facilitador"]),
        (215, 335, ["scrum", "senior", "coordenador"]),
        (360, 480, ["telemarketer", "impressora", "guardiao-cafe"]),
        (505, 620, ["cabo", "evangelista", "seguranca"]),
        (643, 738, ["ti-suporte", "coletor", "noticeboard"]),
        (762, 855, ["drone", "carimbador", "planilha"]),
        (879, 975, ["arquivo", "bateria", "reuniao"]),
    ]

    all_saved = []
    for y1, y2, char_names in CHARACTER_ROWS:
        for slot_idx, char_name in enumerate(char_names):
            x1 = slot_idx * CHAR_SLOT_WIDTH
            x2 = (slot_idx + 1) * CHAR_SLOT_WIDTH
            saved = process_character(arr, y1, y2, x1, x2, char_name, SPRITES_DIR, dry_run)
            all_saved.extend(saved)

    return all_saved


def extract_sheet2_bosses(dry_run=False):
    """
    Extract bosses from sheet 2.
    Sheet 2 has a more complex layout - bosses, elite enemies, NPCs.
    We'll handle the main boss entries.
    """
    print("\n=== Extracting Sheet 2 (BOSSES / ELITES) ===")

    sheet = Image.open(SHEET2_PATH)
    arr = np.array(sheet)

    # Sheet 2 structure (from visual inspection):
    # Section 1 (y=0-400): Bosses - Auditor Fantasma, Analista Senior Elite,
    #   Scrum Master Supreme, Coordenador Bureaucratico, Evangelista Premium,
    #   Gerente-Robo Klaxon-5000
    # Section 2 (y=400-530): Extra states for some enemies
    # Section 3 (y=535-660): Props de Apoio (background objects - skip)
    # Section 4 (y=660-910): Player with weapons, environmental effects
    # Section 5 (y=905-1024): Environmental effects, UI/icons, misc

    # For now, let's just extract the clearly identifiable boss characters
    # from the top section (section 1: y=0-400)

    # The boss section has a different layout than sheet 1
    # Let me identify the boss characters more carefully

    # Section 1 top area: "MINI BOSSES"
    # y=0-155: Boss row 1 (Auditor Fantasma - appears left side)
    # The layout is 2 columns for bigger bosses

    # Let me try automatic blob detection on the boss section
    # and name them appropriately

    boss_section_top = (8, 400)

    # Left half: mini bosses column 1
    left_blobs = find_sprite_blobs(arr, boss_section_top[0], boss_section_top[1],
                                    0, 400, min_pixels=1500, min_height=50)
    right_blobs = find_sprite_blobs(arr, boss_section_top[0], boss_section_top[1],
                                     400, 800, min_pixels=1500, min_height=50)

    print(f"\n  Sheet2 top-left blobs ({len(left_blobs)}):")
    for b in left_blobs:
        print(f"    x={b['x1']}-{b['x2']} y={b['y1']}-{b['y2']} h={b['h']} w={b['w']}")

    print(f"\n  Sheet2 top-right blobs ({len(right_blobs)}):")
    for b in right_blobs:
        print(f"    x={b['x1']}-{b['x2']} y={b['y1']}-{b['y2']} h={b['h']} w={b['w']}")

    return []


def main():
    dry_run = '--dry-run' in sys.argv
    sheet2_only = '--sheet2' in sys.argv
    sheet1_only = '--sheet1' in sys.argv

    if dry_run:
        print("DRY RUN MODE - no files will be saved")

    saved_all = []

    if not sheet2_only:
        saved = extract_sheet1(dry_run)
        saved_all.extend(saved)

    if not sheet1_only:
        saved = extract_sheet2_bosses(dry_run)
        saved_all.extend(saved)

    print(f"\n=== Done! Saved {len(saved_all)} sprite files ===")
    return saved_all


if __name__ == '__main__':
    main()
