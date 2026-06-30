import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../constants";
import { resolveSprite, isAtlasKey, ATLAS_KEY } from "../systems/SpriteLibrary";

// ── Subjects: cada um com prefixo lógico (estilo tex-<prefix>-<state><n>) e os
// estados de animação com [frameInicial, quantidade]. Espelha exatamente o que
// o jogo renderiza, para validarmos animação por animação.
type StateDef = Record<string, [number, number]>;
type Subject = { name: string; prefix: string; states: StateDef };

const SUBJECTS: Subject[] = [
  { name: "PLAYER", prefix: "player", states: {
    idle: [1, 4], walk: [0, 8], run: [0, 8], jump: [0, 6], fall: [0, 3], attack: [0, 3], hurt: [0, 1], dash: [0, 1],
  } },
  { name: "Estagiário", prefix: "estagiario", states: { idle: [0, 4], walk: [0, 4], attack: [0, 1], hurt: [0, 1] } },
  { name: "Estagiário B", prefix: "estagiario-b", states: { idle: [0, 4], walk: [0, 5], hurt: [0, 1] } },
  { name: "Analista", prefix: "analista", states: { idle: [0, 4], walk: [0, 4], attack: [0, 1], hurt: [0, 1] } },
  { name: "Analista Novo", prefix: "analista-novo", states: { idle: [0, 4], walk: [0, 5], hurt: [0, 1] } },
  { name: "RH", prefix: "rh", states: { idle: [0, 4], walk: [0, 4], attack: [0, 1], hurt: [0, 1] } },
  { name: "Facilitador", prefix: "facilitador", states: { idle: [0, 4], walk: [0, 2], attack: [0, 1], hurt: [0, 1] } },
  { name: "Scrum", prefix: "scrum", states: { idle: [0, 4], walk: [0, 6], attack: [0, 1], hurt: [0, 1] } },
  { name: "Coordenador", prefix: "coordenador", states: { idle: [0, 4], walk: [0, 4], attack: [0, 1], hurt: [0, 1] } },
  { name: "Sênior", prefix: "senior", states: { idle: [0, 4], walk: [0, 4], attack: [0, 1], hurt: [0, 1] } },
  { name: "Gerente (boss)", prefix: "gerente", states: {
    idle: [0, 2], walk: [0, 4], run: [0, 4], hurt: [0, 3], death: [0, 3], attack: [0, 2],
    "attack-deadline": [0, 4], "attack-escopo": [0, 4], "attack-sprint": [0, 3], "run-charge": [0, 3],
  } },
  { name: "CEO (boss)", prefix: "boss-ceo", states: {
    idle: [0, 2], walk: [0, 2], run: [0, 6], attack: [0, 4], special: [0, 4], hurt: [0, 1], death: [0, 2],
  } },
];

type FrameInfo = { key: string; ok: boolean; w: number; h: number };

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
  private frames: FrameInfo[] = [];

  private readonly SCALE = 4;
  private readonly CX = 300;
  private readonly CY = 300;

  constructor() { super("SpriteLabScene"); }

  create() {
    this.cameras.main.setBackgroundColor("#15171c");

    // Checkerboard atrás do preview
    const chk = this.add.graphics().setDepth(0);
    for (let y = 120; y < 480; y += 16) for (let x = 60; x < 540; x += 16) {
      chk.fillStyle(((x / 16 + y / 16) & 1) ? 0x2a2d35 : 0x20232a, 1);
      chk.fillRect(x, y, 16, 16);
    }

    this.add.text(GAME_WIDTH / 2, 10, "LAB DE SPRITES / ANIMAÇÕES", {
      fontFamily: "monospace", fontSize: "16px", color: "#f2c14e", stroke: "#000", strokeThickness: 2,
    }).setOrigin(0.5, 0);
    this.add.text(GAME_WIDTH / 2, 32,
      "← →  troca personagem    ↑ ↓  troca animação    [ESPAÇO] play/pause    [ , . ] passo frame    [ESC] sair", {
      fontFamily: "monospace", fontSize: "10px", color: "#8a93a0",
    }).setOrigin(0.5, 0);

    this.feetLine = this.add.graphics().setDepth(1);
    this.bbox = this.add.graphics().setDepth(3);
    this.preview = this.add.image(this.CX, this.CY, ATLAS_KEY).setDepth(2);

    // Painel de diagnóstico
    this.add.rectangle(750, 300, 380, 360, 0x0d0f13, 0.9).setStrokeStyle(1, 0x333a44);
    this.info = this.add.text(572, 130, "", {
      fontFamily: "monospace", fontSize: "11px", color: "#cfd6e0", lineSpacing: 4, wordWrap: { width: 360 },
    });

    // Tira de frames embaixo
    this.stripG = this.add.container(0, 0).setDepth(4);

    const kb = this.input.keyboard!;
    kb.on("keydown-LEFT",  () => this.changeSubject(-1));
    kb.on("keydown-RIGHT", () => this.changeSubject(1));
    kb.on("keydown-A",     () => this.changeSubject(-1));
    kb.on("keydown-D",     () => this.changeSubject(1));
    kb.on("keydown-UP",    () => this.changeState(-1));
    kb.on("keydown-DOWN",  () => this.changeState(1));
    kb.on("keydown-W",     () => this.changeState(-1));
    kb.on("keydown-S",     () => this.changeState(1));
    kb.on("keydown-SPACE", () => { this.playing = !this.playing; });
    kb.on("keydown-COMMA", () => { this.playing = false; this.stepFrame(-1); });
    kb.on("keydown-PERIOD",() => { this.playing = false; this.stepFrame(1); });
    kb.on("keydown-ESC",   () => this.scene.start("MenuScene"));

    this.loadState();
  }

  private changeSubject(d: number) {
    this.subjIdx = (this.subjIdx + d + SUBJECTS.length) % SUBJECTS.length;
    const states = Object.keys(SUBJECTS[this.subjIdx].states);
    if (!states.includes(this.stateName)) this.stateName = states[0];
    this.loadState();
  }

  private changeState(d: number) {
    const states = Object.keys(SUBJECTS[this.subjIdx].states);
    let i = states.indexOf(this.stateName);
    i = (i + d + states.length) % states.length;
    this.stateName = states[i];
    this.loadState();
  }

  private stepFrame(d: number) {
    if (!this.frames.length) return;
    this.frameIdx = (this.frameIdx + d + this.frames.length) % this.frames.length;
    this.applyFrame();
  }

  // Resolve todos os frames do estado atual e detecta problemas.
  private loadState() {
    const subj = SUBJECTS[this.subjIdx];
    const [start, count] = subj.states[this.stateName];
    this.frames = [];
    for (let i = 0; i < count; i++) {
      const n = start + i;
      const key = `tex-${subj.prefix}-${this.stateName}${n}`;
      const ok = isAtlasKey(key);
      let w = 0, h = 0;
      if (ok) {
        const [, frame] = resolveSprite(key);
        const f = this.textures.get(ATLAS_KEY).get(frame!);
        w = f.cutWidth; h = f.cutHeight;
      }
      this.frames.push({ key, ok, w, h });
    }
    this.frameIdx = 0;
    this.buildStrip();
    this.applyFrame();
    this.logDiagnostics();
  }

  private applyFrame() {
    const f = this.frames[this.frameIdx];
    if (!f) return;
    this.bbox.clear(); this.feetLine.clear();
    if (f.ok) {
      const [, frame] = resolveSprite(f.key);
      this.preview.setTexture(ATLAS_KEY, frame!).setVisible(true);
      this.preview.setScale(this.SCALE);
      // base nos pés: ancora a parte de baixo do frame numa linha fixa
      const dw = f.w * this.SCALE, dh = f.h * this.SCALE;
      const feetY = this.CY + 120;
      this.preview.setOrigin(0.5, 1).setPosition(this.CX, feetY);
      // bounding box
      this.bbox.lineStyle(1, 0x44ff88, 0.8).strokeRect(this.CX - dw / 2, feetY - dh, dw, dh);
      // feet line
      this.feetLine.lineStyle(1, 0xff8844, 0.6).lineBetween(80, feetY, 520, feetY);
    } else {
      this.preview.setVisible(false);
      this.feetLine.lineStyle(2, 0xff3333, 1).strokeRect(this.CX - 40, this.CY - 40, 80, 80);
    }
    this.highlightStrip();
  }

  private buildStrip() {
    this.stripG.removeAll(true);
    const y = 500, cell = 46, total = this.frames.length;
    const startX = GAME_WIDTH / 2 - (total * cell) / 2 + cell / 2;
    this.frames.forEach((f, i) => {
      const x = startX + i * cell;
      const border = this.add.rectangle(x, y, cell - 4, cell - 4, 0x1a1d23)
        .setStrokeStyle(2, f.ok ? 0x44ff88 : 0xff3333);
      this.stripG.add(border);
      if (f.ok) {
        const [, frame] = resolveSprite(f.key);
        const img = this.add.image(x, y, ATLAS_KEY, frame!);
        const s = Math.min((cell - 8) / f.w, (cell - 8) / f.h);
        img.setScale(s);
        this.stripG.add(img);
      } else {
        this.stripG.add(this.add.text(x, y, "✗", { fontFamily: "monospace", fontSize: "16px", color: "#ff5555" }).setOrigin(0.5));
      }
      this.stripG.add(this.add.text(x, y + 22, String(i), { fontFamily: "monospace", fontSize: "8px", color: "#8a93a0" }).setOrigin(0.5));
    });
  }

  private highlightStrip() {
    // realça o frame atual na tira
    const y = 500, cell = 46, total = this.frames.length;
    const startX = GAME_WIDTH / 2 - (total * cell) / 2 + cell / 2;
    (this.stripG.list as Phaser.GameObjects.GameObject[]).forEach(o => {
      if (o instanceof Phaser.GameObjects.Rectangle) {
        const idx = Math.round((o.x - startX) / cell);
        const f = this.frames[idx];
        if (f) o.setStrokeStyle(idx === this.frameIdx ? 3 : 2, idx === this.frameIdx ? 0xffdd44 : (f.ok ? 0x44ff88 : 0xff3333));
      }
    });
  }

  private logDiagnostics() {
    const subj = SUBJECTS[this.subjIdx];
    const missing = this.frames.filter(f => !f.ok).map(f => f.key);
    const sizes = [...new Set(this.frames.filter(f => f.ok).map(f => `${f.w}x${f.h}`))];
    const lines = [
      `PERSONAGEM:  ${subj.name}   (${this.subjIdx + 1}/${SUBJECTS.length})`,
      `prefixo:     tex-${subj.prefix}-*`,
      ``,
      `ANIMAÇÃO:    ${this.stateName}   (${this.frames.length} frames)`,
      `tamanhos:    ${sizes.join(", ") || "—"}` + (sizes.length > 1 ? "  ⚠ INCONSISTENTE" : "  ✓"),
      `faltando:    ${missing.length ? "⚠ " + missing.length : "✓ 0"}`,
      ...missing.map(m => `   ✗ ${m}`),
      ``,
      `estados:     ${Object.keys(subj.states).join(" · ")}`,
    ];
    this.info.setText(lines.join("\n"));
    // log no console também (para você abrir o devtools e ver o histórico)
    const status = missing.length || sizes.length > 1 ? "⚠ PROBLEMA" : "OK";
    // eslint-disable-next-line no-console
    console.log(`[SpriteLab] ${subj.name} / ${this.stateName}: ${this.frames.length}f, sizes=${sizes.join("|")}, missing=${missing.length} → ${status}`,
      missing.length ? missing : "");
  }

  update(time: number) {
    if (this.playing && this.frames.length > 1 && time >= this.nextAt) {
      this.nextAt = time + this.frameMs;
      this.frameIdx = (this.frameIdx + 1) % this.frames.length;
      this.applyFrame();
    }
  }
}
