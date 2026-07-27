# ─────────────────────────────────────────────────────────────────────────────
# BLENDER → FUNDO DE FASE (prova de conceito: cobertura do CEO).
#
# POR QUE: o fundo do clímax é o pior asset do jogo (skyline chapado de 42 KB) e
# a rota de geração de imagem está bloqueada. Um fundo 3D renderizado resolve sem
# API nenhuma: dá PROFUNDIDADE real (perspectiva, oclusão, névoa por distância)
# que um tileset chapado não tem — e é determinístico/versionado como o resto.
#
# Uso: blender -b -P scripts/blender/render-bg-ceo.py -- <out.png> [W] [H]
#
# Cena: sala de cobertura à noite — janelão com a cidade lá fora (torres em
# várias distâncias + luzes de janela), piso reflexivo escuro e névoa vermelha
# (a cor-assinatura do CEO, casando com applyBiomePalette).
#
# ⚠ ESTADO: NÃO adotado. O render ganha do fundo chapado em PROFUNDIDADE (três
# planos de torres com oclusão, perspectiva atmosférica, brilho de janela), mas
# perde no que mais importa numa arena de chefe: o céu sai LAVADO (lilás pálido
# no lugar do pôr do sol saturado) e o CONTRASTE cai — o player e o CEO param de
# recortar contra o fundo. Bonito de olhar, pior de jogar.
#
# Sabido e não resolvido: escurecer a paleta do céu e forçar
# `view_transform = "Standard"` (contra o AgX do Blender 4) quase NÃO mudam a
# saída. Há algo no pipeline de cor que não foi isolado — o que falta aqui é
# direção de arte, não ajuste de parâmetro.
# ─────────────────────────────────────────────────────────────────────────────
import bpy, sys, math, os, random

argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
OUT = argv[0] if argv else "/tmp/bg-ceo.png"
W = int(argv[1]) if len(argv) > 1 else 960
H = int(argv[2]) if len(argv) > 2 else 540

bpy.ops.wm.read_factory_settings(use_empty=True)
random.seed(4)  # determinístico
D = math.radians


def emissive(name, rgb, strength=1.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs[0].default_value = (rgb[0], rgb[1], rgb[2], 1)
    em.inputs[1].default_value = strength
    nt.links.new(em.outputs[0], out.inputs[0])
    return m


def cube(name, size, loc, material):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    ob = bpy.context.object
    ob.name = name
    ob.scale = (size[0], size[1], size[2])
    ob.data.materials.append(material)
    return ob


# ── Céu: gradiente de fim de tarde ATRÁS de tudo ─────────────────────────────
# O 1º render perdeu isto e virou "cidade à noite" genérica. O fundo chapado que
# ele deveria substituir acertava justamente o pôr do sol — a profundidade só
# vale se o clima vier junto.
def ceu(name, loc, size):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs[1].default_value = 1.0
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    mapr = nt.nodes.new("ShaderNodeMapRange")
    mapr.inputs[1].default_value = -0.5  # extremos do plano em coord de objeto
    mapr.inputs[2].default_value = 0.5
    coord = nt.nodes.new("ShaderNodeTexCoord")
    # topo roxo-noite -> horizonte laranja-brasa (assinatura quente do CEO)
    ramp.color_ramp.elements[0].position = 0.0
    ramp.color_ramp.elements[0].color = (0.42, 0.11, 0.05, 1)   # brasa no horizonte
    ramp.color_ramp.elements[1].position = 1.0
    ramp.color_ramp.elements[1].color = (0.025, 0.012, 0.05, 1) # quase preto no topo
    meio = ramp.color_ramp.elements.new(0.42)
    meio.color = (0.20, 0.05, 0.10, 1)                          # vermelho-vinho
    nt.links.new(coord.outputs["Object"], sep.inputs[0])
    nt.links.new(sep.outputs["Y"], mapr.inputs[0])
    nt.links.new(mapr.outputs[0], ramp.inputs[0])
    nt.links.new(ramp.outputs[0], em.inputs[0])
    nt.links.new(em.outputs[0], out.inputs[0])
    bpy.ops.mesh.primitive_plane_add(size=1, location=loc, rotation=(D(90), 0, 0))
    ob = bpy.context.object
    ob.name = name
    ob.scale = (size[0], size[1], 1)
    ob.data.materials.append(m)
    return ob


ceu("sky", (0, -78, 6), (200, 90))

# ── Cidade: torres em 3 planos de profundidade (a perspectiva faz o trabalho) ──
FAR = emissive("far", (0.10, 0.05, 0.08), 1.0)   # mais claro = mais longe (névoa)
MID = emissive("mid", (0.06, 0.03, 0.05), 1.0)
NEAR = emissive("near", (0.04, 0.02, 0.03), 1.0)  # quase preto = silhueta na frente
WIN_WARM = emissive("win_warm", (1.0, 0.72, 0.32), 6.0)
WIN_COLD = emissive("win_cold", (0.55, 0.72, 1.0), 4.0)

# Alturas reduzidas de propósito: o 1º render tinha torres cobrindo o quadro
# inteiro e sem céu não há "cobertura" — o jogador precisa ver que está no alto.
HORIZONTE = -8.0  # base comum de TODAS as torres: sem isto elas boiam
planes = [(-46, 16, 17, FAR, 0.5), (-30, 12, 13, MID, 0.7), (-18, 8, 9, NEAR, 0.9)]
for depth, count, maxh, mat_, wchance in planes:
    for i in range(count):
        w = random.uniform(1.6, 3.4)
        h = random.uniform(maxh * 0.35, maxh)
        x = random.uniform(-26, 26)
        cube("tower", (w, 2.2, h), (x, depth, h / 2 + HORIZONTE), mat_)
        # janelas acesas (o que dá "vida" ao skyline)
        rows = int(h / 1.5)
        for r in range(rows):
            if random.random() > wchance:
                continue
            for c in range(int(w)):
                if random.random() < 0.45:
                    continue
                wm = WIN_WARM if random.random() < 0.78 else WIN_COLD
                cube(
                    "win",
                    (0.34, 0.06, 0.30),
                    (x - w / 2 + 0.6 + c * 1.1, depth + 1.16, HORIZONTE + 0.8 + r * 1.5),
                    wm,
                )

# ── Interior: piso, teto e as colunas do janelão (moldura de perspectiva) ─────
FLOOR = emissive("floor", (0.10, 0.05, 0.06), 1.0)
WALL = emissive("wall", (0.06, 0.03, 0.04), 1.0)
cube("floor", (60, 26, 0.6), (0, 2, -6.4), FLOOR)
cube("ceiling", (60, 26, 0.6), (0, 2, 8.6), WALL)
for mx in (-13.5, -4.5, 4.5, 13.5):  # montantes do janelão
    cube("mullion", (0.5, 0.5, 15), (mx, -6.5, 1), WALL)
cube("sill", (60, 0.8, 0.6), (0, -6.5, -6.0), WALL)

# luminárias quentes do teto (dão o "escritório" e ancoram a leitura)
LAMP = emissive("lamp", (1.0, 0.62, 0.28), 9.0)
for lx in (-16, -8, 0, 8, 16):
    cube("lamp", (3.2, 1.0, 0.18), (lx, 3.5, 8.0), LAMP)

# ── Névoa vermelha (a cor-assinatura do CEO) ─────────────────────────────────
world = bpy.data.worlds.new("W")
bpy.context.scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes["Background"]
bg.inputs[0].default_value = (0.035, 0.012, 0.02, 1)
bg.inputs[1].default_value = 1.0

# ── Câmera: altura de olho, leve perspectiva (o que o tileset não tem) ────────
bpy.ops.object.camera_add(location=(0, 14, 2.6), rotation=(D(86), 0, D(180)))
cam = bpy.context.object
cam.data.lens = 34  # levemente wide → sensação de sala grande

sc = bpy.context.scene
sc.camera = cam
# O Blender 4 usa AgX como view transform padrão: ele comprime e DESSATURA as
# cores para look fotográfico. Num fundo estilizado isso lavava o pôr do sol e
# fazia qualquer ajuste de paleta "não surtir efeito" — as cores autorais
# precisam sair como foram escritas.
sc.view_settings.view_transform = "Standard"
sc.view_settings.look = "None"
sc.render.engine = "BLENDER_EEVEE"
sc.eevee.use_bloom = True
sc.eevee.bloom_intensity = 0.10
sc.eevee.bloom_threshold = 0.85
sc.eevee.use_gtao = True
sc.render.resolution_x = W
sc.render.resolution_y = H
sc.render.resolution_percentage = 100
sc.render.image_settings.file_format = "PNG"
sc.render.filepath = OUT
bpy.ops.render.render(write_still=True)
print("BG_OK -> %s" % OUT)
