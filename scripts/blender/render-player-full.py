# ─────────────────────────────────────────────────────────────────────────────
# BLENDER → PLAYER COMPLETO (todos os estados)
#
# Evolução da POC (render-player.py): personagem modelado com identidade (óculos,
# gravata, cabelo, ombros largos) e TODOS os estados que o jogo cicla, nas mesmas
# contagens de frame da arte atual — para a troca ser 1:1 e a comparação no
# `audit:anim` ser maçã-com-maçã.
#
# Uso: blender -b -P scripts/blender/render-player-full.py -- <out_dir> [estado]
#      (sem estado = renderiza todos)
#
# Cada estado vira <out_dir>/<estado>/rawNN.png; o post-pixelate.mjs converte
# para a paleta/contorno da casa e nomeia player-<estado>N.png.
# ─────────────────────────────────────────────────────────────────────────────
import bpy, sys, math, os

argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
OUT = argv[0] if argv else "/tmp/player-full"
ONLY = argv[1] if len(argv) > 1 else None

# Contagens IGUAIS às da arte atual (troca 1:1, sem mexer em EnemyAnimConfig).
STATES = {
    "idle": 25,
    "walk": 16,
    "run": 16,
    "attack": 21,
    "hurt": 17,
    "jump": 6,
    "fall": 3,
    "dash": 1,
}

D = math.radians
bpy.ops.wm.read_factory_settings(use_empty=True)


def mat(name, rgb):
    m = bpy.data.materials.new(name)
    m.use_nodes = False
    m.diffuse_color = (rgb[0], rgb[1], rgb[2], 1.0)
    return m


SKIN = mat("skin", (0.75, 0.60, 0.47))
SKIN_D = mat("skin_d", (0.56, 0.41, 0.31))
SHIRT = mat("shirt", (0.72, 0.75, 0.78))
SHIRT_D = mat("shirt_d", (0.31, 0.35, 0.41))
PANTS = mat("pants", (0.22, 0.16, 0.13))
HAIR = mat("hair", (0.13, 0.09, 0.07))
SHOE = mat("shoe", (0.05, 0.04, 0.05))
DARK = mat("dark", (0.06, 0.09, 0.13))  # óculos/contorno
TIE = mat("tie", (0.28, 0.20, 0.16))


def box(name, size, loc, material, parent=None, pivot_top=True):
    """Caixa com pivô no topo (articulação). `loc` é relativo ao pai."""
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0))
    ob = bpy.context.object
    ob.name = name
    sx, sy, sz = size
    off = -sz / 2 if pivot_top else 0.0
    for v in ob.data.vertices:
        v.co.x *= sx
        v.co.y *= sy
        v.co.z = v.co.z * sz + off
    ob.data.materials.append(material)
    if parent:
        ob.parent = parent
    ob.location = loc
    return ob


# ── Personagem ───────────────────────────────────────────────────────────────
# +X = frente (direção da caminhada), +Z = cima, Y = largura dos ombros.
bpy.ops.object.empty_add(location=(0, 0, 0.98))
hip = bpy.context.object
hip.name = "hip"

torso = box("torso", (0.28, 0.50, 0.50), (0, 0, 0.25), SHIRT, hip, pivot_top=False)
collar = box("collar", (0.30, 0.46, 0.07), (0, 0, 0.52), SHIRT_D, hip, pivot_top=False)
tie = box("tie", (0.03, 0.09, 0.30), (0.15, 0, 0.34), TIE, hip, pivot_top=False)
neck = box("neck", (0.16, 0.18, 0.09), (0, 0, 0.57), SKIN_D, hip, pivot_top=False)

head = box("head", (0.30, 0.34, 0.32), (0.01, 0, 0.72), SKIN, hip, pivot_top=False)
hair = box("hair", (0.33, 0.37, 0.13), (0.0, 0, 0.86), HAIR, hip, pivot_top=False)
hairb = box("hairb", (0.10, 0.37, 0.16), (-0.13, 0, 0.76), HAIR, hip, pivot_top=False)
# óculos (a assinatura do rosto na referência) — aro escuro + lentes claras
glass = box("glass", (0.04, 0.30, 0.08), (0.16, 0, 0.74), DARK, hip, pivot_top=False)
lensL = box("lensL", (0.02, 0.10, 0.06), (0.18, -0.08, 0.74), SHIRT, hip, pivot_top=False)
lensR = box("lensR", (0.02, 0.10, 0.06), (0.18, 0.08, 0.74), SHIRT, hip, pivot_top=False)

thighL = box("thighL", (0.17, 0.18, 0.40), (0, -0.12, 0.0), PANTS, hip)
calfL = box("calfL", (0.15, 0.16, 0.38), (0, 0, -0.40), PANTS, thighL)
footL = box("footL", (0.27, 0.16, 0.10), (0.06, 0, -0.38), SHOE, calfL)

thighR = box("thighR", (0.17, 0.18, 0.40), (0, 0.12, 0.0), PANTS, hip)
calfR = box("calfR", (0.15, 0.16, 0.38), (0, 0, -0.40), PANTS, thighR)
footR = box("footR", (0.27, 0.16, 0.10), (0.06, 0, -0.38), SHOE, calfR)

armL = box("armL", (0.15, 0.15, 0.34), (0, -0.30, 0.70), SHIRT, hip)
foreL = box("foreL", (0.13, 0.13, 0.32), (0, 0, -0.34), SKIN, armL)
armR = box("armR", (0.15, 0.15, 0.34), (0, 0.30, 0.70), SHIRT, hip)
foreR = box("foreR", (0.13, 0.13, 0.32), (0, 0, -0.34), SKIN, armR)

# crachá no cordão (o acessório-assinatura do CLT)
badge = box("badge", (0.03, 0.11, 0.14), (0.15, 0.05, 0.30), SHIRT, hip, pivot_top=False)

RIG = [
    hip, torso, head, thighL, calfL, footL, thighR, calfR, footR,
    armL, foreL, armR, foreR,
]

BODY_YAW = -34.0  # 3/4 → silhueta larga (a referência tem 34px de largura)


def key(ob, frame, rot=None, loc=None):
    if rot is not None:
        ob.rotation_euler = (D(rot[0]), D(rot[1]), D(rot[2]))
        ob.keyframe_insert("rotation_euler", frame=frame)
    if loc is not None:
        ob.location = loc
        ob.keyframe_insert("location", frame=frame)


def clear_anim():
    for ob in RIG:
        ob.animation_data_clear()


S = math.sin
C = math.cos


def pose_locomotion(f, ph, amp, lean, bobh):
    """Base de caminhada/corrida — amp/lean/bob mudam o caráter."""
    a = ph * 2 * math.pi
    sw = math.degrees(S(a)) * amp
    sw2 = math.degrees(S(a + math.pi)) * amp
    knL = max(0, math.degrees(S(a - 0.9))) * (amp * 1.5)
    knR = max(0, math.degrees(S(a + math.pi - 0.9))) * (amp * 1.5)
    bob = abs(S(a * 2)) * bobh
    key(hip, f, loc=(0, 0, 0.98 + bob), rot=(0, 0, BODY_YAW))
    key(thighL, f, rot=(0, sw, 0))
    key(thighR, f, rot=(0, sw2, 0))
    key(calfL, f, rot=(0, knL, 0))
    key(calfR, f, rot=(0, knR, 0))
    key(footL, f, rot=(0, -knL * 0.4, 0))
    key(footR, f, rot=(0, -knR * 0.4, 0))
    key(armL, f, rot=(0, sw2 * 0.75, 0))
    key(armR, f, rot=(0, sw * 0.75, 0))
    key(foreL, f, rot=(0, -abs(sw2) * 0.5 - 12, 0))
    key(foreR, f, rot=(0, -abs(sw) * 0.5 - 12, 0))
    key(torso, f, rot=(0, lean, math.degrees(S(a)) * 0.05))
    key(head, f, rot=(0, -lean * 0.5, 0))


def build(state, n):
    clear_anim()
    for i in range(n + 1):  # +1 fecha o loop exato nos cíclicos
        f = i + 1
        ph = (i % n) / float(n)
        a = ph * 2 * math.pi

        if state == "walk":
            pose_locomotion(f, ph, 0.40, -5, 0.030)
        elif state == "run":
            pose_locomotion(f, ph, 0.62, -14, 0.045)
        elif state == "idle":
            # respiração: peito sobe, ombros caem, cabeça oscila de leve
            br = S(a) * 0.014
            key(hip, f, loc=(0, 0, 0.98 + br), rot=(0, 0, BODY_YAW))
            for t, s_ in ((thighL, 0), (thighR, 0)):
                key(t, f, rot=(0, s_, 0))
            key(calfL, f, rot=(0, 0, 0))
            key(calfR, f, rot=(0, 0, 0))
            key(footL, f, rot=(0, 0, 0))
            key(footR, f, rot=(0, 0, 0))
            key(armL, f, rot=(0, S(a) * 2.5, 0))
            key(armR, f, rot=(0, -S(a) * 2.5, 0))
            key(foreL, f, rot=(0, -14 - S(a) * 3, 0))
            key(foreR, f, rot=(0, -14 + S(a) * 3, 0))
            key(torso, f, rot=(0, -2 + S(a) * 1.5, 0))
            key(head, f, rot=(0, S(a + 1.0) * 3, C(a) * 2))
        elif state == "attack":
            # antecipação → golpe → recuperação (não cíclico: para no fim)
            p = i / float(n)
            if p < 0.25:  # recua o braço (antecipação)
                k = p / 0.25
                sh, el, tw = -55 * k, -30 * k, 12 * k
            elif p < 0.45:  # golpe rápido pra frente
                k = (p - 0.25) / 0.20
                sh, el, tw = -55 + 145 * k, -30 + 45 * k, 12 - 34 * k
            else:  # recuperação
                k = (p - 0.45) / 0.55
                sh, el, tw = 90 - 90 * k, 15 - 15 * k, -22 + 22 * k
            key(hip, f, loc=(0, 0, 0.98), rot=(0, 0, BODY_YAW + tw * 0.4))
            key(armR, f, rot=(0, sh, 0))
            key(foreR, f, rot=(0, el, 0))
            key(armL, f, rot=(0, -sh * 0.3, 0))
            key(foreL, f, rot=(0, -18, 0))
            key(torso, f, rot=(0, -6 - tw * 0.2, tw))
            key(head, f, rot=(0, 4, tw * 0.5))
            for t in (thighL, thighR, calfL, calfR, footL, footR):
                key(t, f, rot=(0, 0, 0))
            key(thighL, f, rot=(0, -14, 0))
            key(thighR, f, rot=(0, 10, 0))
        elif state == "hurt":
            # recuo + tremor amortecido (não cíclico)
            p = i / float(n)
            damp = math.exp(-3.2 * p)
            r = S(p * 22) * 14 * damp
            key(hip, f, loc=(0, 0, 0.98 - 0.03 * damp), rot=(0, 0, BODY_YAW))
            key(torso, f, rot=(0, 16 * damp, r * 0.5))
            key(head, f, rot=(0, 20 * damp, r))
            key(armL, f, rot=(0, -30 * damp, 0))
            key(armR, f, rot=(0, -34 * damp, 0))
            key(foreL, f, rot=(0, -40 * damp - 12, 0))
            key(foreR, f, rot=(0, -44 * damp - 12, 0))
            key(thighL, f, rot=(0, -18 * damp, 0))
            key(thighR, f, rot=(0, 12 * damp, 0))
            key(calfL, f, rot=(0, 14 * damp, 0))
            key(calfR, f, rot=(0, 8 * damp, 0))
            key(footL, f, rot=(0, 0, 0))
            key(footR, f, rot=(0, 0, 0))
        elif state == "jump":
            # agacha → estende → apex (pose-hold curta, não cicla)
            p = i / float(max(1, n - 1))
            crouch = max(0.0, 1 - p * 3.0)
            ext = min(1.0, max(0.0, (p - 0.2) / 0.8))
            key(hip, f, loc=(0, 0, 0.98 - 0.10 * crouch + 0.03 * ext), rot=(0, 0, BODY_YAW))
            key(thighL, f, rot=(0, 30 * crouch - 22 * ext, 0))
            key(thighR, f, rot=(0, 26 * crouch - 10 * ext, 0))
            key(calfL, f, rot=(0, 45 * crouch + 30 * ext, 0))
            key(calfR, f, rot=(0, 40 * crouch + 18 * ext, 0))
            key(footL, f, rot=(0, -10 * ext, 0))
            key(footR, f, rot=(0, -8 * ext, 0))
            key(armL, f, rot=(0, -20 * crouch - 60 * ext, 0))
            key(armR, f, rot=(0, -16 * crouch - 54 * ext, 0))
            key(foreL, f, rot=(0, -20, 0))
            key(foreR, f, rot=(0, -18, 0))
            key(torso, f, rot=(0, -14 * crouch - 4, 0))
            key(head, f, rot=(0, 6 * ext, 0))
        elif state == "fall":
            p = i / float(max(1, n - 1))
            key(hip, f, loc=(0, 0, 0.98), rot=(0, 0, BODY_YAW))
            key(thighL, f, rot=(0, -26 - 8 * p, 0))
            key(thighR, f, rot=(0, 16 + 8 * p, 0))
            key(calfL, f, rot=(0, 40, 0))
            key(calfR, f, rot=(0, 20, 0))
            key(footL, f, rot=(0, -6, 0))
            key(footR, f, rot=(0, -6, 0))
            key(armL, f, rot=(0, -70 - 10 * p, 0))
            key(armR, f, rot=(0, -64 - 10 * p, 0))
            key(foreL, f, rot=(0, -24, 0))
            key(foreR, f, rot=(0, -22, 0))
            key(torso, f, rot=(0, 6, 0))
            key(head, f, rot=(0, -4, 0))
        elif state == "dash":
            key(hip, f, loc=(0, 0, 0.94), rot=(0, 0, BODY_YAW))
            key(thighL, f, rot=(0, -46, 0))
            key(thighR, f, rot=(0, 34, 0))
            key(calfL, f, rot=(0, 30, 0))
            key(calfR, f, rot=(0, 46, 0))
            key(footL, f, rot=(0, -10, 0))
            key(footR, f, rot=(0, -10, 0))
            key(armL, f, rot=(0, 44, 0))
            key(armR, f, rot=(0, -52, 0))
            key(foreL, f, rot=(0, -30, 0))
            key(foreR, f, rot=(0, -26, 0))
            key(torso, f, rot=(0, -26, 0))
            key(head, f, rot=(0, 14, 0))

        if state in ("attack", "hurt", "jump", "fall", "dash") and i >= n - 1:
            break

    for act in bpy.data.actions:
        for fc in act.fcurves:
            for kp in fc.keyframe_points:
                kp.interpolation = "BEZIER"


# ── Câmera + render (mesma calibração da POC: 53px de alto, pés em y=69) ─────
bpy.ops.object.camera_add(location=(0, -6.0, 1.054), rotation=(D(90), 0, 0))
cam = bpy.context.object
cam.data.type = "ORTHO"
cam.data.ortho_scale = 2.61

sc = bpy.context.scene
sc.camera = cam
sc.render.engine = "BLENDER_WORKBENCH"
sc.display.shading.light = "FLAT"
sc.display.shading.color_type = "MATERIAL"
sc.display.shading.show_object_outline = False
sc.render.film_transparent = True
sc.render.filter_size = 0.01
sc.render.resolution_x = 80
sc.render.resolution_y = 80
sc.render.image_settings.file_format = "PNG"
sc.render.image_settings.color_mode = "RGBA"

todo = {ONLY: STATES[ONLY]} if ONLY else STATES
for state, n in todo.items():
    build(state, n)
    d = os.path.join(OUT, state)
    os.makedirs(d, exist_ok=True)
    for i in range(1, n + 1):
        sc.frame_set(i)
        sc.render.filepath = os.path.join(d, "raw%02d" % (i - 1))
        bpy.ops.render.render(write_still=True)
    print("STATE_OK %s frames=%d" % (state, n))

print("PLAYER_FULL_OK out=%s" % OUT)
