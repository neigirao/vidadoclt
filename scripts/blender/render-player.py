# ─────────────────────────────────────────────────────────────────────────────
# BLENDER → SPRITES (prova de conceito) — o caminho que o Dead Cells usa e que
# ataca a raiz do problema medido em docs/ANIM_POLICY.md: a interpolação passa a
# acontecer no RIG (curvas de transformação), não nos PIXELS. Sem imagem-dupla,
# e o loop fecha EXATO (a pose do frame N+1 é, por construção, a do frame 1).
#
# Uso:  blender -b -P scripts/blender/render-player.py -- <out_dir> <frames>
#
# Constrói um boneco low-poly por hierarquia de objetos (quadril → torso → cabeça,
# quadril → coxas → canelas, torso → braços), anima um ciclo de caminhada por
# keyframes de rotação e renderiza em ORTOGRÁFICA com Workbench (flat, sem AA)
# no canvas do jogo. O pós-processo (paleta + contorno) é feito em Node
# (post-pixelate.mjs) para reusar a paleta real da arte da casa.
# ─────────────────────────────────────────────────────────────────────────────
import bpy, sys, math, os

argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
OUT = argv[0] if argv else "/tmp/player-render"
FRAMES = int(argv[1]) if len(argv) > 1 else 16
os.makedirs(OUT, exist_ok=True)

# limpa a cena default
bpy.ops.wm.read_factory_settings(use_empty=True)

D = math.radians

# ── Materiais chapados (o Workbench usa a cor do objeto) ─────────────────────
def mat(name, rgb):
    m = bpy.data.materials.new(name)
    m.use_nodes = False
    m.diffuse_color = (rgb[0], rgb[1], rgb[2], 1.0)
    return m

SKIN = mat("skin", (0.75, 0.60, 0.47))
SHIRT = mat("shirt", (0.72, 0.75, 0.78))
PANTS = mat("pants", (0.22, 0.16, 0.13))
HAIR = mat("hair", (0.13, 0.09, 0.07))
SHOE = mat("shoe", (0.06, 0.05, 0.06))


def box(name, size, loc, material, parent=None, pivot_top=True):
    """Caixa com ORIGEM no topo (a articulação), p/ girar como osso.
    `loc` é SEMPRE relativo ao pai (não usamos matrix_parent_inverse — com ele o
    Blender compensa a transform do pai e as coordenadas virariam absolutas)."""
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0))
    ob = bpy.context.object
    ob.name = name
    sx, sy, sz = size
    # desloca a malha p/ que o pivô fique no topo (ombro/quadril) ou no centro
    off = -sz / 2 if pivot_top else 0.0
    for v in ob.data.vertices:
        v.co.x *= sx
        v.co.y *= sy
        v.co.z = v.co.z * sz + off
    ob.data.materials.append(material)
    if parent:
        ob.parent = parent  # sem parent_inverse → loc é relativa ao pai
    ob.location = loc
    return ob


# ── Corpo ────────────────────────────────────────────────────────────────────
# Convenção: +X = frente (direção da caminhada, direita da tela), +Z = cima,
# Y = largura dos ombros (profundidade da tela). A câmera olha de -Y, e o quadril
# gira ~28° no Z → vista de 3/4, que é o que dá a silhueta LARGA da referência
# (34x53); vista de perfil puro sairia estreita demais.
bpy.ops.object.empty_add(location=(0, 0, 0.98))
hip = bpy.context.object
hip.name = "hip"

torso = box("torso", (0.26, 0.44, 0.50), (0, 0, 0.25), SHIRT, hip, pivot_top=False)
head = box("head", (0.28, 0.30, 0.30), (0.01, 0, 0.66), SKIN, hip, pivot_top=False)
hair = box("hair", (0.31, 0.33, 0.12), (0.0, 0, 0.80), HAIR, hip, pivot_top=False)

thighL = box("thighL", (0.16, 0.16, 0.40), (0, -0.11, 0.0), PANTS, hip)
calfL = box("calfL", (0.14, 0.14, 0.38), (0, 0, -0.40), PANTS, thighL)
footL = box("footL", (0.26, 0.15, 0.10), (0.06, 0, -0.38), SHOE, calfL)

thighR = box("thighR", (0.16, 0.16, 0.40), (0, 0.11, 0.0), PANTS, hip)
calfR = box("calfR", (0.14, 0.14, 0.38), (0, 0, -0.40), PANTS, thighR)
footR = box("footR", (0.26, 0.15, 0.10), (0.06, 0, -0.38), SHOE, calfR)

armL = box("armL", (0.13, 0.13, 0.36), (0, -0.26, 0.70), SHIRT, hip)
foreL = box("foreL", (0.12, 0.12, 0.32), (0, 0, -0.36), SKIN, armL)
armR = box("armR", (0.13, 0.13, 0.36), (0, 0.26, 0.70), SHIRT, hip)
foreR = box("foreR", (0.12, 0.12, 0.32), (0, 0, -0.36), SKIN, armR)

# crachá (o acessório-assinatura do CLT) — no peito
badge = box("badge", (0.03, 0.11, 0.14), (0.14, 0.02, 0.34), SHIRT, hip, pivot_top=False)
badge.data.materials.clear()
badge.data.materials.append(mat("badge", (0.92, 0.92, 0.86)))


# ── Ciclo de caminhada: 4 poses-chave espelhadas = loop perfeito ─────────────
# (contato, passagem, contato espelhado, passagem espelhada, volta ao contato)
def key(ob, frame, rot=None, loc=None):
    if rot is not None:
        ob.rotation_euler = (D(rot[0]), D(rot[1]), D(rot[2]))
        ob.keyframe_insert("rotation_euler", frame=frame)
    if loc is not None:
        ob.location = loc
        ob.keyframe_insert("location", frame=frame)


N = FRAMES
q = N / 4.0  # um quarto do ciclo


BODY_YAW = -28.0  # vista de 3/4 (silhueta larga como a referência)


def walk_pose(f, phase):
    """phase 0..1 no ciclo. As pernas balançam em torno de Y (plano da marcha:
    frente/trás = X). Perna dianteira/traseira trocam em 0.5."""
    a = phase * 2 * math.pi
    swing = math.degrees(math.sin(a)) * 0.40  # amplitude da coxa (graus)
    swing2 = math.degrees(math.sin(a + math.pi)) * 0.40
    kneeL = max(0, math.degrees(math.sin(a - 0.9))) * 0.60
    kneeR = max(0, math.degrees(math.sin(a + math.pi - 0.9))) * 0.60
    bob = abs(math.sin(a * 2)) * 0.030  # sobe/desce 2x por ciclo

    key(hip, f, loc=(0, 0, 0.98 + bob), rot=(0, 0, BODY_YAW))
    key(thighL, f, rot=(0, swing, 0))
    key(thighR, f, rot=(0, swing2, 0))
    key(calfL, f, rot=(0, kneeL, 0))
    key(calfR, f, rot=(0, kneeR, 0))
    key(footL, f, rot=(0, -kneeL * 0.4, 0))
    key(footR, f, rot=(0, -kneeR * 0.4, 0))
    # braços contrabalançam as pernas
    key(armL, f, rot=(0, swing2 * 0.7, 0))
    key(armR, f, rot=(0, swing * 0.7, 0))
    key(foreL, f, rot=(0, -abs(swing2) * 0.5 - 10, 0))
    key(foreR, f, rot=(0, -abs(swing) * 0.5 - 10, 0))
    # torso com leve inclinação p/ frente + contra-rotação do tronco
    key(torso, f, rot=(0, -5, math.degrees(math.sin(a)) * 0.05))
    key(head, f, rot=(0, 3, 0))


# LOOP EXATO: keyframa 1..N e mais um frame N+1 idêntico ao 1 → a curva fecha.
for i in range(N + 1):
    walk_pose(i + 1, (i % N) / float(N))

# interpolação suave nas curvas (é AQUI que a suavidade nasce — não nos pixels)
for act in bpy.data.actions:
    for fc in act.fcurves:
        for kp in fc.keyframe_points:
            kp.interpolation = "BEZIER"

# ── Câmera ortográfica lateral + render flat sem AA ──────────────────────────
# Câmera olha de -Y (lateral). O quadril já está girado em Z → vista de 3/4.
# ortho_scale/altura calibrados p/ o personagem cair em ~53px de altura com os
# pés na MESMA baseline da arte existente (y=69 no canvas 80) — se a baseline
# divergir, o check:frames acusa "pulo de tamanho" e o jogo "flutua".
bpy.ops.object.camera_add(location=(0, -6.0, 1.054), rotation=(D(90), 0, 0))
cam = bpy.context.object
cam.data.type = "ORTHO"
cam.data.ortho_scale = 2.61

sc = bpy.context.scene
sc.camera = cam
sc.render.engine = "BLENDER_WORKBENCH"
sc.display.shading.light = "FLAT"  # cor chapada = base de pixel-art
sc.display.shading.color_type = "MATERIAL"
sc.display.shading.show_object_outline = False
sc.render.film_transparent = True
sc.render.filter_size = 0.01  # mata o anti-aliasing (pixel duro)
sc.render.resolution_x = 80
sc.render.resolution_y = 80
sc.render.resolution_percentage = 100
sc.render.image_settings.file_format = "PNG"
sc.render.image_settings.color_mode = "RGBA"
sc.frame_start = 1
sc.frame_end = N

for i in range(1, N + 1):
    sc.frame_set(i)
    sc.render.filepath = os.path.join(OUT, "raw%02d" % (i - 1))
    bpy.ops.render.render(write_still=True)

print("BLENDER_OK frames=%d out=%s" % (N, OUT))
