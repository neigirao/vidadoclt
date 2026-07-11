import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../constants";
import { resolveSprite, isAtlasKey, ATLAS_KEY } from "../systems/SpriteLibrary";

// ── Lab de Sprites: valida TODOS os assets da Fase 1 (personagens, inimigos,
// bosses, objetos, drops, projéteis) com botões clicáveis que tocam a animação
// em loop, preview com bounding box / linha dos pés, e diagnóstico + logs.

type Subject = {
  name: string;
  cat: string;
  states: Record<string, string[]>; // estado -> lista de chaves lógicas (tex-* ou frame do atlas)
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
  return { name, cat, states };
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
    attack: [0, 1],
    hurt: [0, 1],
  }),
  mkChar("Analista Novo", "Inimigo", "analista-novo", { idle: [0, 4], walk: [0, 5], hurt: [0, 1] }),
  mkChar("RH", "Inimigo", "rh", { idle: [0, 4], walk: [0, 4], attack: [0, 1], hurt: [0, 1] }),
  mkChar("Facilitador", "Inimigo", "facilitador", {
    idle: [0, 4],
    walk: [0, 2],
    attack: [0, 1],
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
    walk: [0, 4],
    attack: [0, 1],
    hurt: [0, 1],
  }),
  mkChar("Gerente (boss)", "Boss", "gerente", {
    idle: [0, 2],
    walk: [0, 4],
    run: [0, 4],
    hurt: [0, 3],
    death: [0, 3],
    attack: [0, 2],
    "atk-deadline": [0, 4],
    "atk-escopo": [0, 4],
    "atk-sprint": [0, 3],
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
];

type FrameInfo = { key: string; ok: boolean; tex: string; frame?: string; w: number; h: number };

export class SpriteLabScene extends Phaser.Scene {
  private subjIdx = 0;
  private stateName = "idle";
  private frameIdx = 0;
  private playing = true;
  private nextAt = 0;
  private frameMs = 150;

  private preview!: Phaser.GameObjects.Image;
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

  create() {
    this.cameras.main.setBackgroundColor("#15171c");

    this.add
      .text(GAME_WIDTH / 2, 8, "LAB DE SPRITES — FASE 1", {
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
        "clique nos botões (personagem à esquerda, ação embaixo) — a ação roda em loop   ·   [ESC] sair",
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

    this.loadState();

    // Upload de sprite (só DEV): substitui o PNG-fonte do frame atual e
    // re-empacota o atlas via o middleware do Vite.
    if (import.meta.env.DEV) this.buildUploadButton();
  }

  // ── Upload do frame atual (DEV) ──────────────────────────────────────────────
  private uploadToast!: Phaser.GameObjects.Text;

  private buildUploadButton() {
    const x = 745,
      y = 372;
    const bg = this.add
      .rectangle(x, y, 250, 30, 0x2a3d2a)
      .setStrokeStyle(2, 0x66bb66)
      .setInteractive({ useHandCursor: true });
    this.add
      .text(x, y, "⬆  SUBIR PNG NESTE FRAME", {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#bfe6bf",
      })
      .setOrigin(0.5);
    this.uploadToast = this.add
      .text(x, y + 24, "", {
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
  }

  private pickAndUpload() {
    const cur = this.frames[this.frameIdx];
    const name = cur?.frame; // nome do frame no atlas = nome do PNG-fonte
    if (!name || !cur) {
      this.uploadToast.setText("⚠ este frame não tem PNG-fonte no atlas").setColor("#ffaa66");
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
      reader.onload = () => this.validateAndSend(name, expW, expH, String(reader.result));
      reader.readAsDataURL(file);
    };
    input.click();
  }

  // REGRA: o PNG novo tem que ter a MESMA dimensão do frame que substitui — senão
  // quebra a família de animação (frames de tamanhos diferentes "encolhem" no
  // atlas). Valida no cliente (feedback na hora); o servidor re-valida por segurança.
  private validateAndSend(name: string, expW: number, expH: number, dataUrl: string) {
    if (!dataUrl.startsWith("data:image/png;base64,")) {
      this.uploadToast.setText("⚠ envie um PNG").setColor("#ffaa66");
      return;
    }
    const img = new Image();
    img.onload = () => {
      if (img.naturalWidth !== expW || img.naturalHeight !== expH) {
        this.uploadToast
          .setText(
            `⚠ ${img.naturalWidth}×${img.naturalHeight} ≠ frame ${expW}×${expH} — mantenha o tamanho do frame`,
          )
          .setColor("#ffaa66");
        return;
      }
      void this.postUpload(name, dataUrl);
    };
    img.onerror = () => this.uploadToast.setText("⚠ PNG inválido").setColor("#ffaa66");
    img.src = dataUrl;
  }

  private async postUpload(name: string, dataUrl: string) {
    this.uploadToast.setText(`enviando ${name}.png…`).setColor("#cfd6e0");
    try {
      const r = await fetch("/__sprite-upload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, dataUrl }),
      });
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
    this.highlightStrip();
  }

  private buildStrip() {
    this.stripG.removeAll(true);
    const y = 525,
      cell = 44,
      total = this.frames.length;
    const startX = this.CX - (total * cell) / 2 + cell / 2;
    this.frames.forEach((f, i) => {
      const x = startX + i * cell;
      const border = this.add
        .rectangle(x, y, cell - 4, cell - 4, 0x1a1d23)
        .setStrokeStyle(2, f.ok ? 0x44ff88 : 0xff3333);
      this.stripG.add(border);
      if (f.ok) {
        const img = f.frame ? this.add.image(x, y, f.tex, f.frame) : this.add.image(x, y, f.tex);
        img.setScale(Math.min((cell - 8) / f.w, (cell - 8) / f.h));
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
    const cell = 44,
      total = this.frames.length;
    const startX = this.CX - (total * cell) / 2 + cell / 2;
    (this.stripG.list as Phaser.GameObjects.GameObject[]).forEach((o) => {
      if (o instanceof Phaser.GameObjects.Rectangle) {
        const idx = Math.round((o.x - startX) / cell);
        const f = this.frames[idx];
        if (f)
          o.setStrokeStyle(
            idx === this.frameIdx ? 3 : 2,
            idx === this.frameIdx ? 0xffdd44 : f.ok ? 0x44ff88 : 0xff3333,
          );
      }
    });
  }

  private logDiagnostics() {
    const subj = SUBJECTS[this.subjIdx];
    const missing = this.frames.filter((f) => !f.ok).map((f) => f.key);
    const sizes = [...new Set(this.frames.filter((f) => f.ok).map((f) => `${f.w}x${f.h}`))];
    const cur = this.frames[this.frameIdx];
    const lines = [
      `${subj.cat.toUpperCase()}:  ${subj.name}`,
      `ANIMAÇÃO:  ${this.stateName}   (${this.frames.length} frames)`,
      `tamanhos:  ${sizes.join(", ") || "—"}` + (sizes.length > 1 ? "  ⚠ INCONSISTENTE" : "  ✓"),
      `faltando:  ${missing.length ? "⚠ " + missing.length : "✓ 0"}`,
      ...missing.map((m) => `   ✗ ${m}`),
      ``,
      `frame atual: ${cur ? (cur.frame ?? cur.tex) : "—"}  (${cur ? cur.w + "x" + cur.h : "—"})`,
    ];
    this.info.setText(lines.join("\n"));
    const status = missing.length || sizes.length > 1 ? "⚠ PROBLEMA" : "OK";

    console.log(
      `[SpriteLab] ${subj.name}/${this.stateName}: ${this.frames.length}f sizes=${sizes.join("|")} missing=${missing.length} → ${status}`,
      missing.length ? missing : "",
    );
  }

  update(time: number) {
    if (this.playing && this.frames.length > 1 && time >= this.nextAt) {
      this.nextAt = time + this.frameMs;
      this.frameIdx = (this.frameIdx + 1) % this.frames.length;
      this.applyFrame();
    }
  }
}
