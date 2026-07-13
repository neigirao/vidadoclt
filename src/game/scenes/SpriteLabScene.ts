import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../constants";
import { resolveSprite, isAtlasKey, ATLAS_KEY, initSpriteLibrary } from "../systems/SpriteLibrary";
import { bgUrl, uploadBg } from "../systems/BgOverrides";
import {
  WALK_FRAME_COUNTS,
  IDLE_FRAME_COUNTS,
  ATTACK_FRAME_COUNTS,
  WALK_MS,
  IDLE_MS,
  ATTACK_MS,
  DEFAULT_WALK_MS,
  DEFAULT_IDLE_MS,
  DEFAULT_ATTACK_MS,
} from "../systems/EnemyAnimConfig";

// ── Lab de Sprites: valida TODOS os assets da Fase 1 (personagens, inimigos,
// bosses, objetos, drops, projéteis) com botões clicáveis que tocam a animação
// em loop, preview com bounding box / linha dos pés, e diagnóstico + logs.

type Subject = {
  name: string;
  cat: string;
  states: Record<string, string[]>; // estado -> lista de chaves lógicas (tex-* ou frame do atlas)
  prefix?: string; // prefixo do atlas (p/ cruzar com a config real de animação do jogo)
};

// Constrói estados de personagem a partir de [frameInicial, quantidade].
function mkChar(
  name: string,
  cat: string,
  prefix: string,
  defs: Record<string, [number, number]>,
): Subject {
  const states: Record<string, string[]> = {};
  for (const [st, [start, count]] of Object.entries(defs)) {
    states[st] = Array.from({ length: count }, (_, i) => `tex-${prefix}-${st}${start + i}`);
  }
  return { name, cat, states, prefix };
}
function mkItem(name: string, cat: string, states: Record<string, string[]>): Subject {
  return { name, cat, states };
}
// Frames de caminhada de um inimigo de fase (enemy-<prefix>-walkN, direto do atlas).
function walk(prefix: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => `enemy-${prefix}-walk${i}`);
}

const SUBJECTS: Subject[] = [
  mkChar("PLAYER", "Personagem", "player", {
    idle: [1, 4],
    walk: [0, 8],
    run: [0, 8],
    jump: [0, 6],
    fall: [0, 3],
    attack: [0, 3],
    hurt: [0, 1],
    dash: [0, 1],
  }),
  mkChar("Estagiário", "Inimigo", "estagiario", {
    idle: [0, 4],
    walk: [0, 4],
    attack: [0, 1],
    hurt: [0, 1],
  }),
  mkChar("Estagiário B", "Inimigo", "estagiario-b", { idle: [0, 4], walk: [0, 5], hurt: [0, 1] }),
  mkChar("Analista", "Inimigo", "analista", {
    idle: [0, 4],
    walk: [0, 4],
    attack: [0, 2], // o jogo cicla 2 (attack2 é lixo, fora)
    hurt: [0, 1],
  }),
  mkChar("Analista Novo", "Inimigo", "analista-novo", { idle: [0, 4], walk: [0, 5], hurt: [0, 1] }),
  mkChar("RH", "Inimigo", "rh", { idle: [0, 4], walk: [0, 4], attack: [0, 2], hurt: [0, 1] }),
  mkChar("Facilitador", "Inimigo", "facilitador", {
    idle: [0, 4],
    walk: [0, 2],
    attack: [0, 2], // o jogo cicla 2 (attack2 é lixo, fora)
    hurt: [0, 1],
  }),
  mkChar("Scrum", "Inimigo", "scrum", { idle: [0, 4], walk: [0, 6], attack: [0, 1], hurt: [0, 1] }),
  mkChar("Coordenador", "Inimigo", "coordenador", {
    idle: [0, 4],
    walk: [0, 4],
    attack: [0, 1],
    hurt: [0, 1],
  }),
  mkChar("Sênior", "Inimigo", "senior", {
    idle: [0, 4],
    walk: [0, 16], // ciclo premium de 16 frames (folha fatiada)
    attack: [0, 3],
    hurt: [0, 1],
  }),
  // Bosses recolor (asBoss) — arte 48×64 dedicada; o LAB cruza c/ a config real
  // do jogo (foi aqui que 2 de 6 walk ficavam parados).
  mkChar("Scrum (boss)", "Boss", "scrum-boss", {
    idle: [0, 4],
    walk: [0, 6],
    attack: [0, 3],
    hurt: [0, 1],
  }),
  mkChar("Coordenador (boss)", "Boss", "coord-boss", {
    idle: [0, 4],
    walk: [0, 4],
    attack: [0, 3],
    hurt: [0, 1],
  }),
  mkChar("Gerente (boss)", "Boss", "gerente", {
    idle: [0, 2],
    walk: [0, 4],
    run: [0, 4],
    hurt: [0, 3],
    death: [0, 3],
    attack: [0, 2],
    "attack-deadline": [0, 4], // eram "atk-*" → chave não resolvia (frames são "attack-*")
    "attack-escopo": [0, 4],
    "attack-sprint": [0, 4],
    "run-charge": [0, 3],
  }),
  mkChar("CEO (boss)", "Boss", "boss-ceo", {
    idle: [0, 2],
    walk: [0, 2],
    run: [0, 6],
    attack: [0, 4],
    special: [0, 4],
    hurt: [0, 1],
    death: [0, 2],
  }),
  // ── Fase 2 ── (render estático da base; walk quando animado no jogo)
  mkItem("Telemarketer", "Fase 2", { base: ["tex-telemarketer"], walk: walk("telemarketer", 4) }),
  mkItem("Reunião", "Fase 2", { base: ["tex-reuniao"], walk: walk("reuniao", 4) }),
  mkItem("Impressora", "Fase 2", { base: ["tex-impressora"] }),
  mkItem("Guardião Café", "Fase 2", { base: ["tex-guardiao-cafe"] }),
  mkItem("Mural", "Fase 2", { base: ["tex-noticeboard"] }),
  // ── Fase 3 ──
  mkItem("Impressora Verm.", "Fase 3", {
    base: ["enemy-impressora-b-idle0"],
    walk: walk("impressora-b", 6),
  }),
  mkItem("Evangelista", "Fase 3", { base: ["tex-evangelista"] }),
  mkItem("Coletor de Dados", "Fase 3", { base: ["tex-coletor"] }),
  mkItem("Planilha Viva", "Fase 3", { base: ["tex-planilha"] }),
  // ── Fase 4 ──
  mkItem("Impressora Fant.", "Fase 4", {
    base: ["enemy-impressora-c-idle0"],
    walk: walk("impressora-c", 6),
  }),
  mkItem("Evangelista Boss", "Fase 4", {
    base: ["enemy-evangelista-boss-idle0"],
    walk: walk("evangelista-boss", 3),
  }),
  mkItem("Cabo de Rede", "Fase 4", { base: ["tex-cabo"] }),
  mkItem("TI Suporte", "Fase 4", { base: ["tex-ti-suporte"] }),
  mkItem("Drone", "Fase 4", { base: ["tex-drone"] }),
  mkItem("Segurança", "Fase 4", { base: ["tex-seguranca"] }),
  // Objetos
  mkItem("Baía", "Objeto", { idle: ["tex-baia"] }),
  mkItem("Bebedouro", "Objeto", { idle: ["tex-bebedouro"] }),
  mkItem("Máq. Café", "Objeto", { idle: ["tex-cafe-machine"] }),
  mkItem("Porta", "Objeto", { idle: ["tex-door"] }),
  mkItem("Monitor", "Objeto", { idle: ["tex-monitor"] }),
  mkItem("Ponto", "Objeto", { idle: ["tex-ponto"] }),
  mkItem("Quadro Motiv.", "Objeto", { idle: ["tex-quadro-motivacional"] }),
  // Drops
  mkItem("VR (moeda)", "Drop", {
    spin: ["item-vr-coin-active0", "item-vr-coin-active1", "item-vr-coin-active2"],
  }),
  mkItem("Café (drop)", "Drop", {
    vapor: ["item-coffee-cup-active0", "item-coffee-cup-active1", "item-coffee-cup-active2"],
  }),
  // Projéteis
  mkItem("Post-it", "Projétil", {
    active: ["item-postit-active0", "item-postit-active1", "item-postit-active2"],
  }),
  mkItem("Tinta (Bic)", "Projétil", { idle: ["item-inkproj", "tex-inkproj"] }),
  mkItem("Convite", "Projétil", {
    idle: ["item-convite-accepted0", "item-convite-accepted1", "item-convite-accepted2"],
  }),
  mkItem("E-mail", "Projétil", { idle: ["item-email-idle0", "item-email-idle1"] }),
  // ── Cenário (Fase 1): tiles de chão/plataforma + fundo gerado ──
  mkItem("Chão (tile)", "Cenário", { idle: ["tile-floor"] }),
  mkItem("Plataforma", "Cenário", { idle: ["tile-platform"] }),
  mkItem("Fundo Open Space", "Cenário", { idle: ["pxbg-openspace"] }),
  // ── Fundos de fase (imagens soltas em assets/bg-*.png). Aceitam upload de
  // alta-res via o mesmo botão (sem regra de dimensão — o fundo é esticado). ──
  mkItem("Fundo F2 Atendimento", "Fundos", { idle: ["bg-atendimento"] }),
  mkItem("Fundo F3 Comercial", "Fundos", { idle: ["bg-comercial"] }),
  mkItem("Fundo F4 Tecnologia", "Fundos", { idle: ["bg-tecnologia"] }),
  mkItem("Fundo F5 Diretoria", "Fundos", { idle: ["bg-diretoria"] }),
  mkItem("Fundo CEO Cobertura", "Fundos", { idle: ["bg-cobertura"] }),
];

const LAB_BGS = [
  "bg-openspace",
  "bg-atendimento",
  "bg-comercial",
  "bg-tecnologia",
  "bg-diretoria",
  "bg-cobertura",
];

type FrameInfo = { key: string; ok: boolean; tex: string; frame?: string; w: number; h: number };

export class SpriteLabScene extends Phaser.Scene {
  private subjIdx = 0;
  private stateName = "idle";
  private frameIdx = 0;
  private playing = true;
  private nextAt = 0;
  private frameMs = 150; // fallback quando não há config de jogo p/ o estado
  private speedOverride: number | null = null; // ms manual ([ ]); null = usa o ms do jogo

  private preview!: Phaser.GameObjects.Image;
  private onion!: Phaser.GameObjects.Image; // fantasma do idle0 p/ comparar tamanho
  private onionOn = false;
  private bbox!: Phaser.GameObjects.Graphics;
  private feetLine!: Phaser.GameObjects.Graphics;
  private info!: Phaser.GameObjects.Text;
  private stripG!: Phaser.GameObjects.Container;
  private stateBtns!: Phaser.GameObjects.Container;
  private subjBtns: { idx: number; bg: Phaser.GameObjects.Rectangle }[] = [];
  private frames: FrameInfo[] = [];

  private readonly SCALE = 4;
  private readonly CX = 350;
  private readonly FEET_Y = 430;

  constructor() {
    super("SpriteLabScene");
  }

  preload() {
    // Fundos de fase não estão no atlas — carrega os que faltam pra o Lab poder
    // mostrar/substituir (bg-openspace/menu já vêm do BootScene).
    for (const b of LAB_BGS) if (!this.textures.exists(b)) this.load.image(b, bgUrl(b));
  }

  create() {
    this.cameras.main.setBackgroundColor("#15171c");

    this.add
      .text(GAME_WIDTH / 2, 8, "LAB DE SPRITES", {
        fontFamily: "monospace",
        fontSize: "15px",
        color: "#f2c14e",
        stroke: "#000",
        strokeThickness: 2,
      })
      .setOrigin(0.5, 0);
    this.add
      .text(
        GAME_WIDTH / 2,
        28,
        "[ESPAÇO] pausa · [← →] passo · [ [ ] ] velocidade · [R] reset · [O] onion-skin (comparar tamanho) · [ESC] sair",
        {
          fontFamily: "monospace",
          fontSize: "9px",
          color: "#8a93a0",
        },
      )
      .setOrigin(0.5, 0);

    // Checkerboard do preview
    const chk = this.add.graphics().setDepth(0);
    for (let y = 110; y < 460; y += 16)
      for (let x = 195; x < 545; x += 16) {
        chk.fillStyle((x / 16 + y / 16) & 1 ? 0x2a2d35 : 0x20232a, 1);
        chk.fillRect(x, y, 16, 16);
      }

    this.feetLine = this.add.graphics().setDepth(1);
    // Onion-skin: fantasma azul do frame de referência (idle0) ATRÁS do preview,
    // mesmo scale + mesma linha dos pés → pulo de tamanho entre estados fica óbvio.
    this.onion = this.add
      .image(this.CX, this.FEET_Y, ATLAS_KEY)
      .setOrigin(0.5, 1)
      .setDepth(1.5)
      .setAlpha(0.3)
      .setTint(0x66ccff)
      .setVisible(false);
    this.bbox = this.add.graphics().setDepth(3);
    this.preview = this.add.image(this.CX, this.FEET_Y, ATLAS_KEY).setOrigin(0.5, 1).setDepth(2);

    // Painel de diagnóstico
    this.add.rectangle(745, 230, 390, 230, 0x0d0f13, 0.92).setStrokeStyle(1, 0x333a44);
    this.info = this.add.text(560, 122, "", {
      fontFamily: "monospace",
      fontSize: "11px",
      color: "#cfd6e0",
      lineSpacing: 4,
      wordWrap: { width: 372 },
    });

    this.stripG = this.add.container(0, 0).setDepth(4);
    this.stateBtns = this.add.container(0, 0).setDepth(5);

    this.buildSubjectButtons();

    this.input.keyboard!.on("keydown-ESC", () => this.scene.start("MenuScene"));
    this.input.keyboard!.on("keydown-SPACE", () => {
      this.playing = !this.playing;
    });
    // Passo a passo (pausa e anda 1 frame) — QA de pixel por frame.
    this.input.keyboard!.on("keydown-LEFT", () => this.stepFrame(-1));
    this.input.keyboard!.on("keydown-RIGHT", () => this.stepFrame(1));
    // Velocidade manual (override do ms do jogo) — julgar cadência.
    this.input.keyboard!.on("keydown-OPEN_BRACKET", () => this.nudgeSpeed(20)); // + lento
    this.input.keyboard!.on("keydown-CLOSED_BRACKET", () => this.nudgeSpeed(-20)); // + rápido
    this.input.keyboard!.on("keydown-R", () => {
      this.speedOverride = null; // volta ao ms do jogo
      this.logDiagnostics();
    });
    // Onion-skin: liga/desliga o fantasma de referência (pega pulo de tamanho).
    this.input.keyboard!.on("keydown-O", () => {
      this.onionOn = !this.onionOn;
      this.applyFrame();
    });

    this.loadState();

    // Upload (visível a todos na fase de teste). FUNDO: persiste via
    // BgOverrides (IndexedDB device-local + Supabase Storage best-effort) —
    // funciona no build publicado. SPRITE: re-empacota o atlas pelo endpoint do
    // `vite dev` (só em dev; no build estático avisa que não grava).
    this.buildUploadButton();
  }

  // ── Upload do frame atual (DEV) ──────────────────────────────────────────────
  private uploadToast!: Phaser.GameObjects.Text;
  private confirmBtn!: Phaser.GameObjects.Rectangle;
  private confirmLabel!: Phaser.GameObjects.Text;
  // Upload preparado (escolhido, aguardando ENVIAR). null = nada pendente.
  private pending: {
    name: string;
    expW: number;
    expH: number;
    dataUrl: string;
    isBg: boolean;
  } | null = null;

  private buildUploadButton() {
    const x = 745,
      y = 372;
    const bg = this.add
      .rectangle(x, y, 250, 30, 0x2a3d2a)
      .setStrokeStyle(2, 0x66bb66)
      .setInteractive({ useHandCursor: true });
    this.add
      .text(x, y, "⬆  ESCOLHER PNG PARA ESTE FRAME", {
        fontFamily: "monospace",
        fontSize: "11px",
        color: "#bfe6bf",
      })
      .setOrigin(0.5);
    this.uploadToast = this.add
      .text(x, y + 22, "", {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#8a93a0",
        align: "center",
        wordWrap: { width: 300 },
      })
      .setOrigin(0.5, 0);
    bg.on("pointerover", () => bg.setFillStyle(0x38513a));
    bg.on("pointerout", () => bg.setFillStyle(0x2a3d2a));
    bg.on("pointerdown", () => this.pickAndUpload());

    // Botão ENVIAR — só aparece depois de escolher um PNG (2 passos: escolher →
    // conferir a prévia no toast → ENVIAR). Some após enviar/cancelar.
    this.confirmBtn = this.add
      .rectangle(x, y + 62, 250, 28, 0x2a3040)
      .setStrokeStyle(2, 0x66aaff)
      .setInteractive({ useHandCursor: true })
      .setVisible(false);
    this.confirmLabel = this.add
      .text(x, y + 62, "✓  ENVIAR", {
        fontFamily: "monospace",
        fontSize: "12px",
        fontStyle: "bold",
        color: "#cfe0ff",
      })
      .setOrigin(0.5)
      .setVisible(false);
    this.confirmBtn.on("pointerover", () => this.confirmBtn.setFillStyle(0x3a4256));
    this.confirmBtn.on("pointerout", () => this.confirmBtn.setFillStyle(0x2a3040));
    this.confirmBtn.on("pointerdown", () => this.sendPending());
  }

  private showConfirm(show: boolean) {
    this.confirmBtn.setVisible(show);
    this.confirmLabel.setVisible(show);
  }

  private sendPending() {
    if (!this.pending) return;
    const p = this.pending;
    this.pending = null;
    this.showConfirm(false);
    this.validateAndSend(p.name, p.expW, p.expH, p.dataUrl, p.isBg);
  }

  private pickAndUpload() {
    const cur = this.frames[this.frameIdx];
    if (!cur || !cur.ok) {
      this.uploadToast.setText("⚠ frame inválido").setColor("#ffaa66");
      return;
    }
    // Três casos de destino:
    //  • frame do atlas (sprite/objeto atlas-backed): grava sprites/<frame>.png.
    //  • fundo bg-* (textura solta): grava assets/<bg>.png.
    //  • objeto GERADO em código (tex-*, sem frame no atlas): cria
    //    sprites/obj-<nome>.png — o resolveSprite passa a preferir o frame do
    //    atlas, então o upload substitui a textura procedural.
    const isBg = !cur.frame && /^bg-/.test(cur.tex);
    let name = cur.frame;
    if (!name) {
      if (isBg) name = cur.tex;
      else if (/^tex-/.test(cur.tex)) name = `obj-${cur.tex.slice(4)}`;
    }
    if (!name) {
      this.uploadToast.setText("⚠ este frame não tem PNG-fonte").setColor("#ffaa66");
      return;
    }
    const expW = cur.w,
      expH = cur.h;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      if (file.type !== "image/png") {
        this.uploadToast.setText("⚠ envie um arquivo PNG").setColor("#ffaa66");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        // Passo 1: prepara (não envia). Mostra prévia no toast + botão ENVIAR.
        this.pending = { name, expW, expH, dataUrl: String(reader.result), isBg };
        this.uploadToast
          .setText(`escolhido: ${file.name}\n→ clique ENVIAR p/ ${name}.png`)
          .setColor("#cfe0ff");
        this.showConfirm(true);
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }

  // Sprite: REGRA de dimensão (mesmo tamanho do frame, senão quebra a família de
  // animação). Fundo: sem regra (é esticado p/ preencher a fase) — só confere PNG.
  private validateAndSend(
    name: string,
    expW: number,
    expH: number,
    dataUrl: string,
    isBg: boolean,
  ) {
    if (!dataUrl.startsWith("data:image/png;base64,")) {
      this.uploadToast.setText("⚠ envie um PNG").setColor("#ffaa66");
      return;
    }
    const img = new Image();
    img.onload = () => {
      if (!isBg && (img.naturalWidth !== expW || img.naturalHeight !== expH)) {
        this.uploadToast
          .setText(
            `⚠ ${img.naturalWidth}×${img.naturalHeight} ≠ frame ${expW}×${expH} — mantenha o tamanho do frame`,
          )
          .setColor("#ffaa66");
        return;
      }
      void this.postUpload(name, dataUrl, isBg);
    };
    img.onerror = () => this.uploadToast.setText("⚠ PNG inválido").setColor("#ffaa66");
    img.src = dataUrl;
  }

  private async postUpload(name: string, dataUrl: string, isBg: boolean) {
    this.uploadToast.setText(`enviando ${name}.png…`).setColor("#cfd6e0");
    // FUNDO: persiste no Supabase Storage (funciona no build publicado também —
    // não depende do `vite dev`). O jogo carrega o override de lá em todas as
    // fases. É o "subir e salvar" de verdade.
    if (isBg) {
      try {
        const r = await uploadBg(name, dataUrl);
        this.uploadToast
          .setText(
            r.cloud
              ? `✓ SALVO na nuvem: ${name}.png — aparece p/ TODOS no jogo`
              : `✓ SALVO neste device: ${name}.png (nuvem indisponível — só aqui)`,
          )
          .setColor(r.cloud ? "#88ff88" : "#bfe0a0");
        this.reloadImage(name, () => this.loadState());
      } catch (e) {
        this.uploadToast.setText(`✗ falhou: ${e}`).setColor("#ff6666");
      }
      return;
    }
    // SPRITE: precisa re-empacotar o atlas → só o endpoint do `vite dev`.
    try {
      const r = await fetch("/__sprite-upload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, dataUrl, kind: "sprite" }),
      });
      const ct = r.headers.get("content-type") ?? "";
      if (!ct.includes("application/json")) {
        this.uploadToast
          .setText("⚠ upload de sprite só grava em `vite dev` (re-empacota o atlas).")
          .setColor("#ffaa66");
        return;
      }
      const j = (await r.json()) as { ok: boolean; error?: string };
      if (!j.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      this.uploadToast.setText(`✓ salvo ${name}.png — atlas re-empacotado`).setColor("#88ff88");
      this.reloadAtlas(() => this.loadState());
    } catch (e) {
      this.uploadToast.setText(`✗ falhou: ${e}`).setColor("#ff6666");
    }
  }

  private reloadAtlas(onDone: () => void) {
    const t = Date.now();
    this.textures.remove(ATLAS_KEY);
    this.load.atlas(ATLAS_KEY, `/assets/atlas.png?t=${t}`, `/assets/atlas.json?t=${t}`);
    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      // Re-registra os frames (inclui NOVOS, ex.: obj-<nome> de objeto gerado) e
      // limpa o cache do resolveSprite, senão a chave tex-* segue na textura antiga.
      initSpriteLibrary(this);
      onDone();
    });
    this.load.start();
  }

  private reloadImage(name: string, onDone: () => void) {
    const t = Date.now();
    this.textures.remove(name);
    // Fundo: recarrega do override (bgUrl traz dataURL local OU URL da nuvem);
    // demais imagens, do asset embutido.
    const src = /^bg-/.test(name) ? bgUrl(name) : `/assets/${name}.png?t=${t}`;
    if (src.startsWith("data:")) {
      // override device-local (base64) — addBase64 em vez do loader de URL.
      this.textures.once(Phaser.Textures.Events.ADD, (key: string) => {
        if (key === name) onDone();
      });
      this.textures.addBase64(name, src);
      return;
    }
    this.load.image(name, src);
    this.load.once(Phaser.Loader.Events.COMPLETE, onDone);
    this.load.start();
  }

  // ── Botões de personagem (2 colunas à esquerda, agrupados por categoria) ─────
  private buildSubjectButtons() {
    const COL_W = 90,
      ROW_H = 13,
      TOP = 46,
      MAX_Y = 528;
    const cols = [6, 98];
    let col = 0,
      y = TOP,
      lastCat = "";
    SUBJECTS.forEach((s, i) => {
      if (s.cat !== lastCat) {
        if (y + 12 + ROW_H > MAX_Y && col === 0) {
          col = 1;
          y = TOP;
        } // quebra p/ 2ª coluna
        this.add.text(cols[col], y, s.cat.toUpperCase(), {
          fontFamily: "monospace",
          fontSize: "7px",
          color: "#5f6a78",
        });
        y += 10;
        lastCat = s.cat;
      }
      if (y + ROW_H > MAX_Y && col === 0) {
        col = 1;
        y = TOP;
      }
      const bg = this.add
        .rectangle(cols[col], y, COL_W - 4, ROW_H - 1, 0x1a1d23)
        .setOrigin(0, 0)
        .setStrokeStyle(1, 0x2a2f3a)
        .setInteractive({ useHandCursor: true });
      this.add.text(cols[col] + 3, y + 2, s.name, {
        fontFamily: "monospace",
        fontSize: "8px",
        color: "#cfd6e0",
      });
      bg.on("pointerover", () => {
        if (this.subjIdx !== i) bg.setFillStyle(0x252a36);
      });
      bg.on("pointerout", () => {
        if (this.subjIdx !== i) bg.setFillStyle(0x1a1d23);
      });
      bg.on("pointerdown", () => {
        this.subjIdx = i;
        this.stateName = Object.keys(s.states)[0];
        this.loadState();
      });
      this.subjBtns.push({ idx: i, bg });
      y += ROW_H;
    });
  }

  private refreshSubjectButtons() {
    this.subjBtns.forEach(({ idx, bg }) => {
      bg.setFillStyle(idx === this.subjIdx ? 0x3a4250 : 0x1a1d23).setStrokeStyle(
        1,
        idx === this.subjIdx ? 0xf2c14e : 0x2a2f3a,
      );
    });
  }

  // ── Botões de ação (embaixo), clique = loop daquela animação ────────────────
  private buildStateButtons() {
    this.stateBtns.removeAll(true);
    const states = Object.keys(SUBJECTS[this.subjIdx].states);
    let x = 200;
    const y = 478;
    states.forEach((st) => {
      const w = 18 + st.length * 7;
      const active = st === this.stateName;
      const bg = this.add
        .rectangle(x, y, w, 22, active ? 0x2a6b3a : 0x222834)
        .setOrigin(0, 0)
        .setStrokeStyle(1, active ? 0x55ff99 : 0x39404e)
        .setInteractive({ useHandCursor: true });
      const t = this.add
        .text(x + w / 2, y + 11, st, {
          fontFamily: "monospace",
          fontSize: "10px",
          color: active ? "#ffffff" : "#aab3c0",
        })
        .setOrigin(0.5);
      bg.on("pointerover", () => {
        if (st !== this.stateName) bg.setFillStyle(0x2c3340);
      });
      bg.on("pointerout", () => {
        if (st !== this.stateName) bg.setFillStyle(0x222834);
      });
      bg.on("pointerdown", () => {
        this.stateName = st;
        this.playing = true;
        this.loadState();
      });
      this.stateBtns.add(bg);
      this.stateBtns.add(t);
      x += w + 6;
      if (x > GAME_WIDTH - 120) {
        x = 200;
      }
    });
  }

  private getInfo(key: string): FrameInfo {
    const [tex, frame] = resolveSprite(key);
    let ok = false,
      w = 0,
      h = 0;
    if (isAtlasKey(key) && frame) {
      ok = true;
      const f = this.textures.get(ATLAS_KEY).get(frame);
      w = f.cutWidth;
      h = f.cutHeight;
    } else if (this.textures.exists(tex)) {
      ok = true;
      const src = this.textures.get(tex).getSourceImage() as { width: number; height: number };
      w = src.width;
      h = src.height;
    }
    return { key, ok, tex, frame, w, h };
  }

  private loadState() {
    const subj = SUBJECTS[this.subjIdx];
    const keys = subj.states[this.stateName] ?? [];
    this.frames = keys.map((k) => this.getInfo(k));
    this.frameIdx = 0;
    this.refreshSubjectButtons();
    this.buildStateButtons();
    this.buildStrip();
    this.applyFrame();
    this.logDiagnostics();
  }

  private applyFrame() {
    const f = this.frames[this.frameIdx];
    this.bbox.clear();
    this.feetLine.clear();
    if (f && f.ok) {
      if (f.frame) this.preview.setTexture(f.tex, f.frame);
      else this.preview.setTexture(f.tex);
      // Escala 4x para sprites pequenos; encolhe para caber assets grandes
      // (backgrounds/tiles largos) na janela de preview (~340x300).
      const scale = Math.min(this.SCALE, 340 / f.w, 300 / f.h);
      this.preview.setVisible(true).setScale(scale).setPosition(this.CX, this.FEET_Y);
      const dw = f.w * scale,
        dh = f.h * scale;
      this.bbox.lineStyle(1, 0x44ff88, 0.85).strokeRect(this.CX - dw / 2, this.FEET_Y - dh, dw, dh);
      this.feetLine.lineStyle(1, 0xff8844, 0.55).lineBetween(195, this.FEET_Y, 545, this.FEET_Y);
    } else {
      this.preview.setVisible(false);
      this.feetLine.lineStyle(2, 0xff3333, 1).strokeRect(this.CX - 40, this.FEET_Y - 80, 80, 80);
    }
    this.applyOnion(f);
    this.highlightStrip();
  }

  /** Frame de referência p/ o onion-skin: idle0 do sujeito (a pose de repouso). */
  private referenceFrame(): FrameInfo | null {
    const subj = SUBJECTS[this.subjIdx];
    const refKeys = subj.states["idle"] ?? Object.values(subj.states)[0];
    if (!refKeys?.length) return null;
    const info = this.getInfo(refKeys[0]);
    return info.ok ? info : null;
  }

  private applyOnion(cur: FrameInfo | undefined) {
    const ref = this.onionOn ? this.referenceFrame() : null;
    // Não mostra se: desligado, sem referência, frame atual quebrado, ou a
    // referência É o frame atual (idle0 vendo a si mesmo → nada a comparar).
    if (!ref || !cur?.ok || ref.frame === cur.frame) {
      this.onion.setVisible(false);
      return;
    }
    const rscale = Math.min(this.SCALE, 340 / ref.w, 300 / ref.h);
    if (ref.frame) this.onion.setTexture(ref.tex, ref.frame);
    else this.onion.setTexture(ref.tex);
    this.onion.setScale(rscale).setPosition(this.CX, this.FEET_Y).setVisible(true);
  }

  private buildStrip() {
    this.stripG.removeAll(true);
    const y = 525,
      cell = 44,
      total = this.frames.length;
    const startX = this.CX - (total * cell) / 2 + cell / 2;
    // Frames além do que o jogo cicla ficam laranja + esmaecidos ("no atlas mas
    // o jogo não usa") — surge quando o LAB tem mais frames que a config real.
    const gameFrames = this.gameAnim()?.frames ?? Infinity;
    this.frames.forEach((f, i) => {
      const x = startX + i * cell;
      const unused = i >= gameFrames;
      const border = this.add
        .rectangle(x, y, cell - 4, cell - 4, 0x1a1d23)
        .setStrokeStyle(2, !f.ok ? 0xff3333 : unused ? 0xffaa33 : 0x44ff88);
      border.setData("idx", i);
      this.stripG.add(border);
      if (f.ok) {
        const img = f.frame ? this.add.image(x, y, f.tex, f.frame) : this.add.image(x, y, f.tex);
        img.setScale(Math.min((cell - 8) / f.w, (cell - 8) / f.h)).setAlpha(unused ? 0.4 : 1);
        this.stripG.add(img);
      } else {
        this.stripG.add(
          this.add
            .text(x, y, "✗", { fontFamily: "monospace", fontSize: "16px", color: "#ff5555" })
            .setOrigin(0.5),
        );
      }
      this.stripG.add(
        this.add
          .text(x, y + 20, String(i), {
            fontFamily: "monospace",
            fontSize: "8px",
            color: "#8a93a0",
          })
          .setOrigin(0.5),
      );
    });
  }

  private highlightStrip() {
    const gameFrames = this.gameAnim()?.frames ?? Infinity;
    (this.stripG.list as Phaser.GameObjects.GameObject[]).forEach((o) => {
      if (o instanceof Phaser.GameObjects.Rectangle) {
        const idx = o.getData("idx") as number | undefined;
        if (idx == null) return;
        const f = this.frames[idx];
        if (!f) return;
        const base = !f.ok ? 0xff3333 : idx >= gameFrames ? 0xffaa33 : 0x44ff88;
        o.setStrokeStyle(idx === this.frameIdx ? 3 : 2, idx === this.frameIdx ? 0xffdd44 : base);
      }
    });
  }

  private logDiagnostics() {
    const subj = SUBJECTS[this.subjIdx];
    const missing = this.frames.filter((f) => !f.ok).map((f) => f.key);
    const sizes = [...new Set(this.frames.filter((f) => f.ok).map((f) => `${f.w}x${f.h}`))];
    const cur = this.frames[this.frameIdx];
    // Cruza com a config REAL do jogo (fonte única): quantos frames ele cicla e
    // a que ms. Flag de divergência = o LAB mostra N mas o jogo toca M.
    const g = this.gameAnim();
    const labN = this.frames.length;
    const labFewer = !!g && labN < g.frames; // LAB não mostra arte que o jogo USA → BUG do LAB
    const labMore = !!g && labN > g.frames; // LAB mostra extras que o jogo PULA → info (ex.: idle corrompido)
    const speedTag = this.speedOverride != null ? " (manual)" : g ? " (jogo)" : "";
    const gameLine = !g
      ? `JOGO:  — (estado sem config de setEnemyTex)`
      : labFewer
        ? `JOGO cicla:  ${g.frames} @ ${g.ms}ms   ⚠ LAB FALTA ${g.frames - labN} que o jogo usa`
        : labMore
          ? `JOGO cicla:  ${g.frames} @ ${g.ms}ms   ℹ jogo pula ${labN - g.frames} (extra/corrompido)`
          : `JOGO cicla:  ${g.frames} @ ${g.ms}ms  ✓`;
    const lines = [
      `${subj.cat.toUpperCase()}:  ${subj.name}`,
      `ANIMAÇÃO:  ${this.stateName}   (${labN} frames no atlas)`,
      gameLine,
      `velocidade:  ${this.effectiveMs()}ms${speedTag}`,
      ...(this.onionOn ? [`onion-skin:  👻 fantasma azul = idle0 (compara tamanho)`] : []),
      `tamanhos:  ${sizes.join(", ") || "—"}` + (sizes.length > 1 ? "  ⚠ INCONSISTENTE" : "  ✓"),
      `faltando:  ${missing.length ? "⚠ " + missing.length : "✓ 0"}`,
      ...missing.map((m) => `   ✗ ${m}`),
      ``,
      `frame atual: ${cur ? (cur.frame ?? cur.tex) : "—"}  (${cur ? cur.w + "x" + cur.h : "—"})`,
    ];
    this.info.setText(lines.join("\n"));
    const status = missing.length || sizes.length > 1 || labFewer ? "⚠ PROBLEMA" : "OK";

    console.log(
      `[SpriteLab] ${subj.name}/${this.stateName}: ${labN}f sizes=${sizes.join("|")} missing=${missing.length}` +
        (g
          ? ` game=${g.frames}f@${g.ms}ms${labFewer ? "(LAB<JOGO)" : labMore ? "(lab>jogo)" : ""}`
          : "") +
        ` → ${status}`,
      missing.length ? missing : "",
    );
  }

  update(time: number) {
    if (this.playing && this.frames.length > 1 && time >= this.nextAt) {
      this.nextAt = time + this.effectiveMs();
      this.frameIdx = (this.frameIdx + 1) % this.frames.length;
      this.applyFrame();
    }
  }

  // ── Config REAL do jogo p/ o estado atual (fonte única EnemyAnimConfig) ──────
  // Retorna o que o jogo cicla (frames + ms) p/ um sujeito com prefixo mapeado;
  // null se o estado/sujeito não usa setEnemyTex (bosses próprios, fase 2+, etc.).
  private gameAnim(): { frames: number; ms: number } | null {
    const p = SUBJECTS[this.subjIdx].prefix;
    if (!p) return null;
    const st = this.stateName;
    if (st === "walk" && p in WALK_FRAME_COUNTS)
      return { frames: WALK_FRAME_COUNTS[p], ms: WALK_MS[p] ?? DEFAULT_WALK_MS };
    if (st === "idle" && p in IDLE_FRAME_COUNTS)
      return { frames: IDLE_FRAME_COUNTS[p], ms: IDLE_MS[p] ?? DEFAULT_IDLE_MS };
    if (st === "attack" && p in ATTACK_FRAME_COUNTS)
      return { frames: ATTACK_FRAME_COUNTS[p], ms: ATTACK_MS[p] ?? DEFAULT_ATTACK_MS };
    return null;
  }

  /** ms do loop: override manual > ms do jogo p/ o estado > fallback. */
  private effectiveMs(): number {
    return this.speedOverride ?? this.gameAnim()?.ms ?? this.frameMs;
  }

  private stepFrame(dir: number) {
    this.playing = false;
    const n = this.frames.length;
    if (n > 0) this.frameIdx = (this.frameIdx + dir + n) % n;
    this.applyFrame();
    this.logDiagnostics();
  }

  private nudgeSpeed(deltaMs: number) {
    const base = this.speedOverride ?? this.effectiveMs();
    this.speedOverride = Phaser.Math.Clamp(base + deltaMs, 20, 600);
    this.logDiagnostics();
  }
}
