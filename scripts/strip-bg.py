#!/usr/bin/env python3
"""Remove fundo opaco residual de PNGs específicos amostrando a cor dos cantos."""
from PIL import Image
import os, sys

FILES = [
    "boss-ceo-special0.png",
    "boss-diretor-death0.png",
    "obj-baia.png",
    "obj-door.png",
    "obj-monitor-active.png",
    "obj-monitor-broken.png",
    "obj-monitor-use.png",
    "obj-ponto.png",
    "enemy-analista-death2.png",
    "enemy-coordenador-attack0.png",
    "enemy-facilitador-attack0.png",
    "enemy-gerente-attack-escopo3.png",
    "enemy-gerente-death1.png",
    "enemy-scrum-attack0.png",
    "enemy-scrum-idle1.png",
    "enemy-scrum-idle3.png",
    "enemy-senior-attack1.png",
]
DIR = "public/assets/sprites"
TOL2 = 30 * 30  # tolerância de cor (distância euclidiana ao quadrado)

def color_dist2(a, b):
    return (a[0]-b[0])**2 + (a[1]-b[1])**2 + (a[2]-b[2])**2

def median_corner(im):
    w, h = im.size
    cs = [im.getpixel(p) for p in [(0,0),(w-1,0),(0,h-1),(w-1,h-1)]]
    cs.sort(key=lambda c: (c[0], c[1], c[2]))
    return cs[len(cs)//2]

def flood_from_edges(im, bg, tol2):
    """Remove BG conectado às bordas — preserva pixels internos da mesma cor."""
    w, h = im.size
    px = im.load()
    visited = [[False]*h for _ in range(w)]
    stack = []
    for x in range(w):
        for y in (0, h-1):
            stack.append((x, y))
    for y in range(h):
        for x in (0, w-1):
            stack.append((x, y))
    while stack:
        x, y = stack.pop()
        if x < 0 or y < 0 or x >= w or y >= h or visited[x][y]:
            continue
        visited[x][y] = True
        p = px[x, y]
        if p[3] == 0:
            # já transparente, continua flood
            stack.extend([(x+1,y),(x-1,y),(x,y+1),(x,y-1)])
            continue
        if color_dist2(p, bg) <= tol2:
            px[x, y] = (p[0], p[1], p[2], 0)
            stack.extend([(x+1,y),(x-1,y),(x,y+1),(x,y-1)])

def main():
    for fn in FILES:
        path = os.path.join(DIR, fn)
        if not os.path.exists(path):
            print(f"skip (missing): {fn}")
            continue
        im = Image.open(path).convert("RGBA")
        bg = median_corner(im)
        flood_from_edges(im, bg, TOL2)
        im.save(path)
        print(f"stripped: {fn}  bg={bg}")

if __name__ == "__main__":
    main()
