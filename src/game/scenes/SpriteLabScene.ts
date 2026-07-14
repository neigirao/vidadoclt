import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../constants";
import { resolveSprite, isAtlasKey, ATLAS_KEY, initSpriteLibrary } from "../systems/SpriteLibrary";
import { bgUrl, uploadBg, hasBgOverride } from "../systems/BgOverrides";
import { uploadSpriteOverride } from "../systems/SpriteOverrides";
import { supabase } from "../../integrations/supabase/client";
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
  frameCount,
  type AnimState,
} from "../systems/EnemyAnimConfig";

// Contagem "padrão" almejada por estado no COMPLETAR FAMÍLIA: quando uma ação tem
// menos frames que isto, o LAB oferece gerar os que faltam por IA. Alinhado ao que
// as famílias ricas já usam (walk/idle de 4; attack de 2 na whitelist validada).
const TARGET_FRAMES: Record<AnimState, number> = { walk: 4, idle: 4, attack: 2 };

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

// Item da fila de PROBLEMAS (saída do audit, enriquecida p/ navegar/consertar).
type AuditItem = {
  subjIdx?: number;
  subj: string;
  state: string;
  frame?: number;
  atlasFrame?: string; // nome do PNG-fonte (p/ o conserto), quando é frame do atlas
  dims?: string;
  issue: string;
};

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

  // Fila de PROBLEMAS (audit clicável)
  private auditOverlay?: Phaser.GameObjects.Container;
  private auditItems: AuditItem[] = [];
  private auditTotalFrames = 0;
  private auditScroll = 0;
  private readonly AUDIT_ROWS = 15;

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
        "[ESPAÇO] pausa · [← →] passo · [ [ ] ] velocidade · [R] reset · [O] onion-skin · [A] fila PROBLEMAS · [ESC] sair",
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

    this.input.keyboard!.on("keydown-ESC", () => {
      // ESC fecha primeiro os overlays abertos; só sai do LAB se não houver nenhum.
      if (this.geminiPreview) return this.clearGeminiPreview();
      if (this.auditOverlay) return this.closeAuditQueue();
      this.scene.start("MenuScene");
    });
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
    // [A]: abre/fecha a fila de PROBLEMAS (audit clicável → pula pro frame ruim).
    this.input.keyboard!.on("keydown-A", () => this.toggleAuditQueue());
    // [C]: COMPLETAR FAMÍLIA — gera por IA o próximo frame faltante deste estado.
    this.input.keyboard!.on("keydown-C", () => void this.completeFamily());
    // Scroll do mouse rola a fila de problemas quando aberta.
    this.input.on("wheel", (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      if (!this.auditOverlay) return;
      const max = Math.max(0, this.auditItems.length - this.AUDIT_ROWS);
      this.auditScroll = Phaser.Math.Clamp(this.auditScroll + (dy > 0 ? 3 : -3), 0, max);
      this.renderAuditQueue();
    });

    this.loadState();

    // Upload (visível a todos na fase de teste). FUNDO: persiste via
    // BgOverrides (IndexedDB device-local + Supabase Storage best-effort) —
    // funciona no build publicado. SPRITE: re-empacota o atlas pelo endpoint do
    // `vite dev` (só em dev; no build estático avisa que não grava).
    this.buildUploadButton();
    this.buildFixButtons();
    this.buildBgRepoButton();
    // Ao sair do LAB, garante limpeza do modal de prévia e da textura base64
    // (senão `__gemini_preview` + o listener de ADD vazam no TextureManager global).
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.clearGeminiPreview();
      this.closeAuditQueue();
    });
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

  // ── Botões de CONSERTO do frame atual (determinístico, preserva o design) ────
  // Aplicados CONSCIENTEMENTE pelo usuário no frame que ele julgou ruim (o audit
  // só sinaliza candidatos — auto-fix cego corromperia frame de FX/pose). Só
  // grava em `vite dev` (endpoint /__frame-fix re-empacota o atlas).
  private buildFixButtons() {
    const x = 745;
    type FixMode = "rescale" | "copy-nearest" | "gemini";
    const mk = (dx: number, y: number, w: number, label: string, mode: FixMode, col: number) => {
      const bg = this.add
        .rectangle(x + dx, y, w, 24, 0x3a2e18)
        .setStrokeStyle(2, col)
        .setInteractive({ useHandCursor: true });
      this.add
        .text(x + dx, y, label, { fontFamily: "monospace", fontSize: "10px", color: "#f0e0c0" })
        .setOrigin(0.5);
      bg.on("pointerover", () => bg.setFillStyle(0x4a3a20));
      bg.on("pointerout", () => bg.setFillStyle(0x3a2e18));
      bg.on("pointerdown", () => this.postFrameFix(mode));
    };
    // Determinísticos (preservam o design): rescale (pulo de tamanho → mediana) e
    // copiar vizinho (vazio/quebrado).
    mk(-63, 462, 120, "🔧 RESCALE MEDIANA", "rescale", 0xd8a441);
    mk(65, 462, 120, "🔧 COPIAR VIZINHO", "copy-nearest", 0xc47a3a);
    // IA (Gemini): redesenha o frame seguindo os vizinhos. Precisa GEMINI_API_KEY
    // + billing. Pode destoar do estilo — confira antes de manter.
    mk(0, 490, 248, "🤖 REFAZER COM IA (GEMINI)", "gemini", 0x9966ff);
    // MULTI-FRAME: gera por IA o próximo frame FALTANTE deste estado, até o padrão.
    // Reusa o mesmo preview/guardrails do REFAZER; ao aprovar entra como frame novo
    // e o jogo passa a ciclá-lo. Label mostra a lacuna (atualizada em logDiagnostics).
    const cbg = this.add
      .rectangle(x, 436, 248, 24, 0x2a1840)
      .setStrokeStyle(2, 0x66cc99)
      .setInteractive({ useHandCursor: true });
    this.completeBtnLabel = this.add
      .text(x, 436, "🎞 COMPLETAR FAMÍLIA  [C]", {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#cfeede",
      })
      .setOrigin(0.5);
    cbg.on("pointerover", () => cbg.setFillStyle(0x3a2450));
    cbg.on("pointerout", () => cbg.setFillStyle(0x2a1840));
    cbg.on("pointerdown", () => void this.completeFamily());
  }

  // FUNDOS (dev): "promove" o override de fundo (que vive no Supabase Storage /
  // IndexedDB do navegador) para o REPO — grava public/assets/<bg-*>.png via o
  // endpoint do `vite dev`. Assim o fundo subido pelo LAB deixa de ser só um
  // override em runtime e passa a ser versionado (entra no bundle/commit).
  private buildBgRepoButton() {
    const x = 745,
      y = 518;
    const bg = this.add
      .rectangle(x, y, 250, 24, 0x24344a)
      .setStrokeStyle(2, 0x5c9ad8)
      .setInteractive({ useHandCursor: true });
    this.add
      .text(x, y, "💾 FIXAR FUNDO NO REPO (dev)", {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#cfe4ff",
      })
      .setOrigin(0.5);
    bg.on("pointerover", () => bg.setFillStyle(0x30455f));
    bg.on("pointerout", () => bg.setFillStyle(0x24344a));
    bg.on("pointerdown", () => void this.promoteBgToRepo());
  }

  private async promoteBgToRepo() {
    const cur = this.frames[this.frameIdx];
    const isBg = !!cur && !cur.frame && /^bg-/.test(cur.tex);
    if (!isBg) {
      this.uploadToast.setText("⚠ selecione um FUNDO (categoria FUNDOS)").setColor("#ffaa66");
      return;
    }
    const name = cur.tex;
    if (!hasBgOverride(name)) {
      this.uploadToast
        .setText(`⚠ ${name} não tem override subido (já é o embutido)`)
        .setColor("#ffaa66");
      return;
    }
    try {
      // O override é dataURL (local) OU URL da nuvem — o navegador do usuário tem
      // acesso ao Supabase, então busca a URL e converte pra dataURL.
      const src = bgUrl(name);
      let dataUrl: string;
      if (src.startsWith("data:")) {
        dataUrl = src;
      } else {
        this.uploadToast.setText(`buscando ${name} da nuvem…`).setColor("#cfd6e0");
        const blob = await (await fetch(src)).blob();
        dataUrl = await new Promise<string>((resolve, reject) => {
          const fr = new FileReader();
          fr.onload = () => resolve(String(fr.result));
          fr.onerror = () => reject(new Error("falha ao ler o PNG da nuvem"));
          fr.readAsDataURL(blob);
        });
      }
      if (!dataUrl.startsWith("data:image/png")) throw new Error("override não é PNG");
      const r = await fetch("/__sprite-upload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, dataUrl, kind: "background" }),
      });
      const ct = r.headers.get("content-type") ?? "";
      if (!ct.includes("application/json")) {
        this.uploadToast.setText("⚠ só grava no repo em `vite dev`").setColor("#ffaa66");
        return;
      }
      const j = (await r.json()) as { ok: boolean; error?: string; file?: string };
      if (!j.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      this.uploadToast
        .setText(`✓ gravado em ${j.file ?? `assets/${name}.png`} — commite o arquivo`)
        .setColor("#88ff88");
    } catch (e) {
      this.uploadToast.setText(`✗ falhou: ${e}`).setColor("#ff6666");
    }
  }

  private async postFrameFix(mode: "rescale" | "copy-nearest" | "gemini") {
    const cur = this.frames[this.frameIdx];
    if (!cur?.ok || !cur.frame) {
      this.uploadToast.setText("⚠ conserto só p/ frame de sprite do atlas").setColor("#ffaa66");
      return;
    }
    if (mode === "gemini") {
      // Inicializa alvo + candidatos de vizinho (frames irmãos do estado atual, os
      // mais próximos por índice selecionados por padrão) + hint vazio, e gera.
      this.geminiSeedFrame = undefined; // refaz o próprio frame (não é multi-frame)
      this.geminiTarget = { frame: cur.frame, tex: cur.tex };
      const cands = this.frames
        .map((f, i) => ({ f, i }))
        .filter(({ f, i }) => i !== this.frameIdx && f.ok && !!f.frame)
        .sort((a, b) => Math.abs(a.i - this.frameIdx) - Math.abs(b.i - this.frameIdx));
      this.geminiCandRefs = cands.map(({ f }, k) => ({ frame: f.frame as string, sel: k < 3 }));
      this.geminiHint = "";
      await this.runGemini();
      return;
    }
    this.uploadToast.setText(`consertando ${cur.frame} (${mode})…`).setColor("#cfd6e0");
    try {
      const r = await fetch("/__frame-fix", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ frame: cur.frame, mode }),
      });
      const ct = r.headers.get("content-type") ?? "";
      if (!ct.includes("application/json")) {
        this.uploadToast
          .setText("⚠ conserto só grava em `vite dev` (re-empacota o atlas).")
          .setColor("#ffaa66");
        return;
      }
      const j = (await r.json()) as {
        ok: boolean;
        error?: string;
        beforeH?: number;
        afterH?: number;
        copiedFrom?: string;
      };
      if (!j.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      const detail = mode === "rescale" ? `${j.beforeH}px → ${j.afterH}px` : `← ${j.copiedFrom}`;
      this.uploadToast.setText(`✓ ${cur.frame} refeito (${detail})`).setColor("#88ff88");
      this.reloadAtlas(() => this.loadState());
    } catch (e) {
      this.uploadToast.setText(`✗ falhou: ${e}`).setColor("#ff6666");
    }
  }

  // Quantos frames FALTAM p/ o estado atual chegar ao padrão (TARGET_FRAMES), e o
  // índice do próximo slot a preencher. null se o sujeito/estado não se aplica
  // (sem prefixo, ou estado que não é walk/idle/attack).
  private familyGap(): { state: AnimState; prefix: string; next: number; missing: number } | null {
    const subj = SUBJECTS[this.subjIdx];
    const p = subj.prefix;
    const st = this.stateName;
    if (!p || (st !== "walk" && st !== "idle" && st !== "attack")) return null;
    const state = st as AnimState;
    const current = frameCount(state, p);
    return {
      state,
      prefix: p,
      next: current,
      missing: Math.max(0, TARGET_FRAMES[state] - current),
    };
  }

  // COMPLETAR FAMÍLIA: gera por IA o PRÓXIMO frame que falta neste estado, reusando
  // o pipeline do REFAZER (preview + guardrails + transparência + APROVAR). Ao
  // aprovar, o override entra como frame NOVO (enemy-<prefixo>-<estado><n>) e o jogo
  // passa a ciclá-lo — SpriteOverrides.registerFrameSlot aumenta a contagem.
  private async completeFamily() {
    if (this.geminiPreview) return; // já há uma prévia aberta
    const gap = this.familyGap();
    if (!gap) {
      this.uploadToast
        .setText("⚠ COMPLETAR só p/ inimigo com walk/idle/attack")
        .setColor("#ffaa66");
      return;
    }
    if (gap.missing <= 0) {
      this.uploadToast
        .setText(
          `✓ ${gap.prefix}/${gap.state} já tem ${gap.next} frames (padrão ${TARGET_FRAMES[gap.state]})`,
        )
        .setColor("#88ff88");
      return;
    }
    // Irmãos válidos (no atlas) do estado → semente + referências de pose/paleta.
    const sibs = this.frames.filter((f) => f.ok && !!f.frame);
    if (!sibs.length) {
      this.uploadToast.setText("⚠ sem frame-base válido p/ referência").setColor("#ffaa66");
      return;
    }
    // Seleciona um irmão bom no preview (assim runGemini lê w/h de um frame real
    // da família) e monta o alvo VIRTUAL do próximo índice.
    const seed = sibs[sibs.length - 1];
    const seedIdx = this.frames.indexOf(seed);
    if (seedIdx >= 0) {
      this.frameIdx = seedIdx;
      this.applyFrame();
    }
    this.geminiSeedFrame = seed.frame;
    this.geminiTarget = { frame: `enemy-${gap.prefix}-${gap.state}${gap.next}`, tex: ATLAS_KEY };
    this.geminiCandRefs = sibs.map((f, k) => ({ frame: f.frame as string, sel: k < 3 }));
    this.geminiHint = `frame ${gap.next} de ${gap.state}: pose intermediária coerente com os vizinhos (completando ${gap.next}→${TARGET_FRAMES[gap.state]})`;
    this.uploadToast
      .setText(`🎞 gerando ${gap.state} #${gap.next} (faltam ${gap.missing})…`)
      .setColor("#c9a6ff");
    await this.runGemini();
  }

  // Gera (ou re-gera) a prévia da IA com os vizinhos SELECIONADOS + o hint atual.
  private async runGemini() {
    const t = this.geminiTarget;
    if (!t) return;
    const cur = this.frames[this.frameIdx];
    const w = cur?.w ?? 48,
      h = cur?.h ?? 64;
    const refFrames = this.geminiCandRefs.filter((r) => r.sel).map((r) => r.frame);
    this.uploadToast
      .setText(`🤖 redesenhando ${t.frame} com IA (pode demorar)…`)
      .setColor("#c9a6ff");
    try {
      // ONLINE: chama a Edge Function do Supabase (Gemini server-side, chave
      // secreta) — funciona no jogo publicado, sem `bun dev`.
      const { data, error } = await supabase.functions.invoke("frame-refazer", {
        body: {
          // Frame novo (multi-frame) não existe no atlas → usa a semente (irmão bom).
          frameB64: this.framePngB64(this.geminiSeedFrame ?? t.frame),
          refs: refFrames.map((f) => this.framePngB64(f)),
          w,
          h,
          hint: this.geminiHint || undefined,
        },
      });
      const res = (data ?? {}) as { ok?: boolean; error?: string; imageB64?: string };
      if (error || !res.ok || !res.imageB64) {
        throw new Error(res.error ?? error?.message ?? "Edge Function frame-refazer indisponível");
      }
      // Guardrails de pixel-art no CLIENTE (canvas): dimensão exata, halos limpos,
      // paleta travada aos vizinhos e pés alinhados à baseline mediana.
      const { dataUrl, warn } = await this.applyGuardrails(
        `data:image/png;base64,${res.imageB64}`,
        w,
        h,
        refFrames,
      );
      this.uploadToast
        .setText(
          warn.length ? `⚠ prévia com alerta: ${warn.join(", ")}` : `🤖 prévia pronta — confira`,
        )
        .setColor(warn.length ? "#ffcc66" : "#c9a6ff");
      this.showGeminiPreview(t.frame, t.tex, dataUrl, warn);
    } catch (e) {
      this.uploadToast.setText(`✗ falhou: ${e}`).setColor("#ff6666");
    }
  }

  // ── Prévia da IA: modal ANTES/DEPOIS(+animado) + refs + hint + regen/aprovar ──
  private geminiPreview?: Phaser.GameObjects.Container;
  private readonly GEMINI_PREVIEW_TEX = "__gemini_preview";
  private geminiToken = 0; // invalida listeners/timeouts de uma prévia anterior
  private geminiReady = false;
  private geminiTarget?: { frame: string; tex: string };
  private geminiCandRefs: { frame: string; sel: boolean }[] = [];
  private geminiHint = "";
  // Frame do atlas usado como SEMENTE (fonte PNG) quando o alvo é um frame NOVO
  // (multi-frame) que ainda não existe no atlas. undefined = refaz o próprio alvo.
  private geminiSeedFrame?: string;
  private completeBtnLabel?: Phaser.GameObjects.Text;
  private geminiAnim?: Phaser.Time.TimerEvent;
  private geminiPreviewDataUrl?: string; // PNG da prévia (p/ o approve subir ao Storage)

  private showGeminiPreview(frame: string, atlasTex: string, dataUrl: string, warns: string[]) {
    this.geminiPreviewDataUrl = dataUrl;
    this.clearGeminiPreview();
    const token = ++this.geminiToken;
    this.geminiReady = false;
    const W = this.scale.width,
      H = this.scale.height;
    const box = this.add.container(0, 0).setDepth(5000);
    const backdrop = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.74).setInteractive();
    const panelW = 470,
      panelH = 336;
    const panel = this.add
      .rectangle(W / 2, H / 2, panelW, panelH, 0x1a1526)
      .setStrokeStyle(2, 0x9966ff);
    const top0 = H / 2 - panelH / 2;
    const title = this.add
      .text(W / 2, top0 + 14, `PRÉVIA IA — ${frame}`, {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#c9a6ff",
      })
      .setOrigin(0.5);
    box.add([backdrop, panel, title]);
    this.geminiPreview = box;

    // Três células: ANTES · DEPOIS (estático) · ANIMADO (loop do estado c/ o DEPOIS
    // no lugar do frame-alvo → pega pulo de baseline/silhueta em movimento).
    const cur = this.frames[this.frameIdx];
    const scaleUp = Math.max(1, Math.floor(72 / Math.max(cur?.w ?? 32, cur?.h ?? 48)));
    const cellY = top0 + 74;
    const antesX = W / 2 - 130,
      depoisX = W / 2,
      animX = W / 2 + 130;
    const antes = this.add.image(antesX, cellY, atlasTex, frame).setScale(scaleUp).setOrigin(0.5);
    const mkLbl = (x: number, t: string, c: string) =>
      this.add
        .text(x, cellY + 46, t, { fontFamily: "monospace", fontSize: "9px", color: c })
        .setOrigin(0.5);
    box.add([antes, mkLbl(antesX, "ANTES", "#cfd6e0"), mkLbl(depoisX, "DEPOIS", "#88ff88")]);
    box.add(mkLbl(animX, "ANIMADO", "#9fd0ff"));
    const loading = this.add
      .text(depoisX, cellY, "…", { fontFamily: "monospace", fontSize: "20px", color: "#8a7fb0" })
      .setOrigin(0.5);
    box.add(loading);
    if (warns.length)
      box.add(
        this.add
          .text(W / 2, cellY + 62, `⚠ ${warns.join(" · ")}`, {
            fontFamily: "monospace",
            fontSize: "9px",
            color: "#ffcc66",
          })
          .setOrigin(0.5),
      );

    // Família do estado (p/ animar), com o alvo marcado p/ trocar pelo DEPOIS.
    const famIdx = this.frameIdx;
    const fam = this.frames.map((f) => ({ tex: f.tex, frame: f.frame }));

    if (this.textures.exists(this.GEMINI_PREVIEW_TEX))
      this.textures.remove(this.GEMINI_PREVIEW_TEX);
    const onAdd = (key: string) => {
      if (key !== this.GEMINI_PREVIEW_TEX) return;
      this.textures.off(Phaser.Textures.Events.ADD, onAdd);
      if (token !== this.geminiToken || !this.geminiPreview) return;
      loading.destroy();
      const depois = this.add
        .image(depoisX, cellY, this.GEMINI_PREVIEW_TEX)
        .setScale(scaleUp)
        .setOrigin(0.5);
      const animImg = this.add
        .image(animX, cellY, this.GEMINI_PREVIEW_TEX)
        .setScale(scaleUp)
        .setOrigin(0.5);
      this.geminiPreview.add([depois, animImg]);
      this.geminiReady = true;
      // Loop da animação com o DEPOIS substituído no frame-alvo.
      if (fam.length > 1) {
        let k = 0;
        const ms = this.effectiveMs();
        this.geminiAnim = this.time.addEvent({
          delay: ms,
          loop: true,
          callback: () => {
            k = (k + 1) % fam.length;
            if (k === famIdx) animImg.setTexture(this.GEMINI_PREVIEW_TEX);
            else if (fam[k].frame) animImg.setTexture(fam[k].tex, fam[k].frame);
            else animImg.setTexture(fam[k].tex);
          },
        });
      }
    };
    this.textures.on(Phaser.Textures.Events.ADD, onAdd);
    this.time.delayedCall(5000, () => {
      if (token !== this.geminiToken || this.geminiReady) return;
      this.textures.off(Phaser.Textures.Events.ADD, onAdd);
      loading.setText("⚠ falhou").setColor("#ff8866");
      this.uploadToast.setText("✗ prévia da IA inválida — descarte/regere").setColor("#ff6666");
    });
    this.textures.addBase64(this.GEMINI_PREVIEW_TEX, dataUrl);

    // Linha de REFS (vizinhos): thumbnail + borda verde quando selecionado. Clique
    // liga/desliga o vizinho enviado como referência de estilo à IA.
    const refsY = top0 + 154;
    box.add(
      this.add
        .text(W / 2 - panelW / 2 + 14, refsY - 10, "REFS (clique liga/desliga):", {
          fontFamily: "monospace",
          fontSize: "9px",
          color: "#9aa0b0",
        })
        .setOrigin(0, 0),
    );
    const cands = this.geminiCandRefs.slice(0, 7);
    const thumbScale = Math.max(1, Math.floor(28 / Math.max(cur?.w ?? 32, cur?.h ?? 48)));
    let tx0 = W / 2 - panelW / 2 + 24;
    cands.forEach((cref) => {
      const cx = tx0 + 20;
      const border = this.add
        .rectangle(cx, refsY + 22, 40, 40, 0x0d0b14)
        .setStrokeStyle(2, cref.sel ? 0x66dd66 : 0x555)
        .setInteractive({ useHandCursor: true });
      const img = this.add.image(cx, refsY + 22, atlasTex, cref.frame).setScale(thumbScale);
      border.on("pointerdown", () => {
        cref.sel = !cref.sel;
        border.setStrokeStyle(2, cref.sel ? 0x66dd66 : 0x555);
      });
      this.geminiPreview?.add([border, img]);
      tx0 += 58;
    });

    // Hint (refina o prompt) — usa prompt() do browser (dev-only, sem lib de UI).
    const hintY = top0 + 226;
    const hintTxt = this.add
      .text(
        W / 2 - panelW / 2 + 14,
        hintY,
        `HINT: ${this.geminiHint ? this.geminiHint.slice(0, 46) : "(nenhum)"}`,
        { fontFamily: "monospace", fontSize: "9px", color: "#cfd6e0" },
      )
      .setOrigin(0, 0);
    const hintBtn = this.add
      .rectangle(W / 2 + panelW / 2 - 60, hintY + 4, 96, 20, 0x2a2140)
      .setStrokeStyle(1, 0x8a7fb0)
      .setInteractive({ useHandCursor: true });
    const hintBtnT = this.add
      .text(W / 2 + panelW / 2 - 60, hintY + 4, "✏ EDITAR HINT", {
        fontFamily: "monospace",
        fontSize: "8px",
        color: "#d8cff0",
      })
      .setOrigin(0.5);
    hintBtn.on("pointerdown", () => {
      const v = window.prompt(
        "Instrução extra p/ a IA (ex.: manter camisa azul):",
        this.geminiHint,
      );
      if (v != null) {
        this.geminiHint = v.trim();
        hintTxt.setText(`HINT: ${this.geminiHint ? this.geminiHint.slice(0, 46) : "(nenhum)"}`);
      }
    });
    box.add([hintTxt, hintBtn, hintBtnT]);

    // Botões: GERAR DE NOVO · APROVAR · DESCARTAR.
    const by = H / 2 + panelH / 2 - 22;
    const mkBtn = (bx: number, w: number, label: string, col: number, onClick: () => void) => {
      const bg = this.add
        .rectangle(bx, by, w, 26, 0x2a2140)
        .setStrokeStyle(2, col)
        .setInteractive({ useHandCursor: true });
      const tt = this.add
        .text(bx, by, label, { fontFamily: "monospace", fontSize: "10px", color: "#f0e0c0" })
        .setOrigin(0.5);
      bg.on("pointerover", () => bg.setFillStyle(0x3a2e58));
      bg.on("pointerout", () => bg.setFillStyle(0x2a2140));
      bg.on("pointerdown", onClick);
      this.geminiPreview?.add([bg, tt]);
    };
    mkBtn(W / 2 - 150, 130, "🔄 GERAR DE NOVO", 0x9966ff, () => void this.runGemini());
    mkBtn(W / 2, 120, "✅ APROVAR", 0x66dd66, () => {
      if (!this.geminiReady) {
        this.uploadToast.setText("⚠ aguarde a prévia carregar").setColor("#ffaa66");
        return;
      }
      void this.approveGemini(frame);
    });
    mkBtn(W / 2 + 150, 130, "✖ DESCARTAR", 0xdd6666, () => void this.discardGemini(frame));
  }

  private clearGeminiPreview() {
    this.geminiToken++; // invalida qualquer listener/timeout pendente
    this.geminiReady = false;
    this.geminiAnim?.remove();
    this.geminiAnim = undefined;
    this.geminiPreview?.destroy(true);
    this.geminiPreview = undefined;
    this.geminiSeedFrame = undefined;
    if (this.textures.exists(this.GEMINI_PREVIEW_TEX))
      this.textures.remove(this.GEMINI_PREVIEW_TEX);
  }

  // multi-frame: se `frame` é um slot NOVO (enemy-<prefixo>-<estado><n>) além dos
  // já listados pelo sujeito atual, adiciona a chave lógica correspondente à lista
  // de estados do sujeito p/ o LAB passar a exibi-lo (o jogo já cicla via override).
  private extendSubjectForNewFrame(frame: string): void {
    const m = /^enemy-(.+)-(walk|idle|attack)(\d+)$/.exec(frame);
    if (!m) return;
    const subj = SUBJECTS[this.subjIdx];
    if (subj.prefix !== m[1]) return;
    const list = subj.states[m[2]];
    if (!list) return;
    // Respeita a convenção de chave dos irmãos (uns usam `tex-*`, outros `enemy-*`).
    const logical = `tex-${m[1]}-${m[2]}${m[3]}`;
    const key = list[0]?.startsWith("enemy-") ? frame : logical;
    if (!list.includes(key) && !list.includes(logical) && !list.includes(frame)) list.push(key);
  }

  private async approveGemini(frame: string) {
    const dataUrl = this.geminiPreviewDataUrl;
    if (!dataUrl) {
      this.uploadToast.setText("⚠ sem prévia p/ aprovar").setColor("#ffaa66");
      return;
    }
    this.uploadToast.setText(`aprovando ${frame} (aplica em produção)…`).setColor("#cfd6e0");
    try {
      // ONLINE: salva o override no Supabase Storage (+ IndexedDB) e aplica na hora
      // por cima do atlas — sem reempacotar, sem `bun dev`. Aparece em produção.
      const r = await uploadSpriteOverride(this, frame, dataUrl);
      this.extendSubjectForNewFrame(frame); // multi-frame: LAB passa a listar o novo slot
      this.uploadToast
        .setText(
          r.cloud
            ? `✓ ${frame} aprovado — no ar pra TODOS (Storage)`
            : `✓ ${frame} aplicado neste device (nuvem indisponível — só aqui)`,
        )
        .setColor(r.cloud ? "#88ff88" : "#bfe0a0");
      this.clearGeminiPreview();
      // Recarrega o estado do LAB p/ o preview mostrar o override já aplicado.
      this.reloadAtlas(() => this.loadState());
    } catch (e) {
      this.uploadToast.setText(`✗ aprovar falhou: ${e}`).setColor("#ff6666");
    }
  }

  private discardGemini(frame: string) {
    this.clearGeminiPreview();
    this.uploadToast.setText(`prévia de ${frame} descartada`).setColor("#cfd6e0");
  }

  // Extrai o PNG de um frame do atlas como base64 (sem prefixo dataURL) — p/ mandar
  // pro Gemini via Edge Function.
  private framePngB64(frame: string): string {
    const src = this.textures.get(ATLAS_KEY).getSourceImage() as CanvasImageSource;
    const fr = this.textures.getFrame(ATLAS_KEY, frame);
    const cv = document.createElement("canvas");
    cv.width = fr.cutWidth;
    cv.height = fr.cutHeight;
    const ctx = cv.getContext("2d");
    ctx?.drawImage(
      src,
      fr.cutX,
      fr.cutY,
      fr.cutWidth,
      fr.cutHeight,
      0,
      0,
      fr.cutWidth,
      fr.cutHeight,
    );
    return cv.toDataURL("image/png").split(",")[1] ?? "";
  }

  // GUARDRAILS de pixel-art no cliente (canvas): redimensiona a saída da IA p/ a
  // dimensão EXATA do frame, limpa halos semi-transparentes, trava a paleta às
  // cores dos vizinhos e alinha os pés à baseline mediana da família.
  private async applyGuardrails(
    genDataUrl: string,
    w: number,
    h: number,
    refFrames: string[],
  ): Promise<{ dataUrl: string; warn: string[] }> {
    const warn: string[] = [];
    const load = (u: string) =>
      new Promise<HTMLImageElement>((res, rej) => {
        const im = new Image();
        im.onload = () => res(im);
        im.onerror = () => rej(new Error("img inválida"));
        im.src = u;
      });
    const gen = await load(genDataUrl);
    // contain no wxh
    const scale = Math.min(w / gen.width, h / gen.height);
    const dw = Math.max(1, Math.round(gen.width * scale)),
      dh = Math.max(1, Math.round(gen.height * scale));
    const cv = document.createElement("canvas");
    cv.width = w;
    cv.height = h;
    const ctx = cv.getContext("2d", { willReadFrequently: true })!;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(gen, Math.floor((w - dw) / 2), Math.floor((h - dh) / 2), dw, dh);
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    // REMOÇÃO DE FUNDO: a IA às vezes devolve a arte sobre um fundo OPACO (sólido
    // ou quase). Sem tratar, esse fundo fica com alpha 255 e vira um bloco. Faz
    // flood-fill a partir das bordas: tudo conectado à borda E próximo da cor de
    // fundo (amostrada nos 4 cantos) vira transparente. Flood-fill (não match
    // global) preserva cores iguais que aparecem DENTRO do personagem.
    const removed = this.stripBackground(d, w, h);
    if (removed) warn.push("fundo opaco removido");
    // paleta + baseline mediana dos vizinhos
    const { palette, medFeet, medH } = this.refPalette(refFrames);
    const cache = new Map<number, [number, number, number]>();
    for (let p = 0; p < w * h; p++) {
      const i = p * 4;
      if (d[i + 3] < 40) {
        d[i + 3] = 0;
        continue;
      }
      d[i + 3] = 255;
      if (!palette.length) continue;
      const q = ((d[i] >> 3) << 10) | ((d[i + 1] >> 3) << 5) | (d[i + 2] >> 3);
      let snap = cache.get(q);
      if (!snap) {
        let best = palette[0],
          bd = Infinity;
        for (const c of palette) {
          const dr = c[0] - d[i],
            dg = c[1] - d[i + 1],
            db = c[2] - d[i + 2];
          const dist = dr * dr + dg * dg + db * db;
          if (dist < bd) {
            bd = dist;
            best = c;
          }
        }
        snap = best;
        cache.set(q, snap);
      }
      d[i] = snap[0];
      d[i + 1] = snap[1];
      d[i + 2] = snap[2];
    }
    // bbox + baseline align
    let minX = w,
      minY = h,
      maxX = -1,
      maxY = -1;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++)
        if (d[(y * w + x) * 4 + 3] > 0) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
    if (maxY < 0) {
      warn.push("output quase-vazio");
      return { dataUrl: cv.toDataURL("image/png"), warn };
    }
    const bw = maxX - minX + 1,
      bh = maxY - minY + 1;
    if (medH > 0 && Math.abs(bh - medH) / medH > 0.25)
      warn.push(`altura ${bh}px vs mediana ${medH}px`);
    // recorta o conteúdo e recompõe centrado + pés na baseline mediana
    const content = ctx.getImageData(minX, minY, bw, bh);
    ctx.clearRect(0, 0, w, h);
    const left = Math.max(0, Math.round((w - bw) / 2));
    const top = Math.max(0, h - medFeet - bh);
    ctx.putImageData(content, left, top);
    return { dataUrl: cv.toDataURL("image/png"), warn };
  }

  // Remove o fundo OPACO que a IA às vezes devolve: flood-fill (BFS) a partir de
  // todos os pixels de borda, zerando o alpha de quem está conectado à borda E
  // perto da cor de fundo amostrada nos cantos. Retorna true se removeu algo.
  // Só age se os cantos concordarem numa cor (evita apagar arte que encosta na
  // borda de propósito). Muta `d` in-place.
  private stripBackground(d: Uint8ClampedArray, w: number, h: number): boolean {
    const at = (x: number, y: number) => (y * w + x) * 4;
    // amostra os 4 cantos; só trata como fundo se pelo menos 3 concordarem.
    const corners = [
      [0, 0],
      [w - 1, 0],
      [0, h - 1],
      [w - 1, h - 1],
    ].map(([x, y]) => {
      const i = at(x, y);
      return { r: d[i], g: d[i + 1], b: d[i + 2], a: d[i + 3] };
    });
    // fundo só existe se os cantos são OPACOS (senão já é transparente = ok).
    const opaque = corners.filter((c) => c.a > 200);
    if (opaque.length < 3) return false;
    const bg = opaque[0];
    const near = (i: number, tol: number) => {
      const dr = d[i] - bg.r,
        dg = d[i + 1] - bg.g,
        db = d[i + 2] - bg.b;
      return dr * dr + dg * dg + db * db <= tol * tol * 3;
    };
    // cantos precisam ser parecidos entre si, senão não é um fundo uniforme.
    if (
      !opaque.every((c) => (c.r - bg.r) ** 2 + (c.g - bg.g) ** 2 + (c.b - bg.b) ** 2 <= 40 * 40 * 3)
    )
      return false;
    const TOL = 48; // tolerância de cor (nearest-resize borra a borda do fundo)
    const seen = new Uint8Array(w * h);
    const stack: number[] = [];
    const pushIf = (x: number, y: number) => {
      if (x < 0 || y < 0 || x >= w || y >= h) return;
      const p = y * w + x;
      if (seen[p]) return;
      seen[p] = 1;
      if (d[p * 4 + 3] > 40 && near(p * 4, TOL)) stack.push(p);
    };
    for (let x = 0; x < w; x++) {
      pushIf(x, 0);
      pushIf(x, h - 1);
    }
    for (let y = 0; y < h; y++) {
      pushIf(0, y);
      pushIf(w - 1, y);
    }
    let removed = 0;
    while (stack.length) {
      const p = stack.pop()!;
      d[p * 4 + 3] = 0;
      removed++;
      const x = p % w,
        y = (p / w) | 0;
      pushIf(x - 1, y);
      pushIf(x + 1, y);
      pushIf(x, y - 1);
      pushIf(x, y + 1);
    }
    return removed > 0;
  }

  // Paleta (cores opacas) + baseline/altura medianas dos frames vizinhos.
  private refPalette(refFrames: string[]): {
    palette: [number, number, number][];
    medFeet: number;
    medH: number;
  } {
    const palette: [number, number, number][] = [];
    const seen = new Set<number>();
    const feets: number[] = [];
    const heights: number[] = [];
    const median = (a: number[]) => {
      const s = [...a].sort((x, y) => x - y);
      return s.length ? s[s.length >> 1] : 0;
    };
    for (const frame of refFrames) {
      const fr = this.textures.getFrame(ATLAS_KEY, frame);
      if (!fr) continue;
      const src = this.textures.get(ATLAS_KEY).getSourceImage() as CanvasImageSource;
      const cv = document.createElement("canvas");
      cv.width = fr.cutWidth;
      cv.height = fr.cutHeight;
      const ctx = cv.getContext("2d", { willReadFrequently: true });
      if (!ctx) continue;
      ctx.drawImage(
        src,
        fr.cutX,
        fr.cutY,
        fr.cutWidth,
        fr.cutHeight,
        0,
        0,
        fr.cutWidth,
        fr.cutHeight,
      );
      const d = ctx.getImageData(0, 0, fr.cutWidth, fr.cutHeight).data;
      let minY = fr.cutHeight,
        maxY = -1;
      for (let y = 0; y < fr.cutHeight; y++)
        for (let x = 0; x < fr.cutWidth; x++) {
          const i = (y * fr.cutWidth + x) * 4;
          if (d[i + 3] > 40) {
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
            const q = ((d[i] >> 3) << 10) | ((d[i + 1] >> 3) << 5) | (d[i + 2] >> 3);
            if (!seen.has(q)) {
              seen.add(q);
              palette.push([d[i], d[i + 1], d[i + 2]]);
            }
          }
        }
      if (maxY >= minY) {
        heights.push(maxY - minY + 1);
        feets.push(fr.cutHeight - 1 - maxY);
      }
    }
    return { palette, medFeet: median(feets), medH: median(heights) };
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
    // Atualiza o rótulo do botão COMPLETAR FAMÍLIA com a lacuna atual do estado.
    const gap = this.familyGap();
    if (this.completeBtnLabel) {
      this.completeBtnLabel.setText(
        gap && gap.missing > 0
          ? `🎞 COMPLETAR: +${gap.missing} frame(s)  [C]`
          : `🎞 COMPLETAR FAMÍLIA  [C]`,
      );
    }
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
    return this.gameAnimFor(SUBJECTS[this.subjIdx].prefix, this.stateName);
  }

  private gameAnimFor(p: string | undefined, st: string): { frames: number; ms: number } | null {
    if (!p) return null;
    // Usa a contagem EFETIVA (base + aumentos por override de runtime), então o
    // diagnóstico reflete os frames extras adicionados pelo multi-frame.
    if (st === "walk" && p in WALK_FRAME_COUNTS)
      return { frames: frameCount("walk", p), ms: WALK_MS[p] ?? DEFAULT_WALK_MS };
    if (st === "idle" && p in IDLE_FRAME_COUNTS)
      return { frames: frameCount("idle", p), ms: IDLE_MS[p] ?? DEFAULT_IDLE_MS };
    if (st === "attack" && p in ATTACK_FRAME_COUNTS)
      return { frames: frameCount("attack", p), ms: ATTACK_MS[p] ?? DEFAULT_ATTACK_MS };
    return null;
  }

  // ── Métricas de CONTEÚDO de um frame (via canvas) p/ o audit headless ────────
  // Desenha o frame num canvas e lê os pixels: cobertura de alpha, altura do
  // conteúdo (bbox opaco) e "achatamento" (% da cor opaca dominante — pega lixo
  // de extração / bloco chapado). Reaproveita 1 canvas offscreen.
  private auditCtx?: CanvasRenderingContext2D;
  private frameMetrics(f: FrameInfo): { alphaPct: number; contentH: number; flatPct: number } {
    if (!this.auditCtx) {
      const cv = document.createElement("canvas");
      this.auditCtx = cv.getContext("2d", { willReadFrequently: true }) ?? undefined;
    }
    const ctx = this.auditCtx;
    const src = this.textures.get(f.tex).getSourceImage() as CanvasImageSource;
    if (!ctx || !src) return { alphaPct: 0, contentH: 0, flatPct: 0 };
    ctx.canvas.width = f.w;
    ctx.canvas.height = f.h;
    ctx.clearRect(0, 0, f.w, f.h);
    if (f.frame) {
      const fr = this.textures.getFrame(ATLAS_KEY, f.frame);
      ctx.drawImage(src, fr.cutX, fr.cutY, fr.cutWidth, fr.cutHeight, 0, 0, f.w, f.h);
    } else {
      ctx.drawImage(src, 0, 0, f.w, f.h);
    }
    const data = ctx.getImageData(0, 0, f.w, f.h).data;
    let opaque = 0,
      minY = f.h,
      maxY = -1;
    const colors = new Map<number, number>();
    for (let y = 0; y < f.h; y++)
      for (let x = 0; x < f.w; x++) {
        const i = (y * f.w + x) * 4;
        if (data[i + 3] > 24) {
          opaque++;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
          // quantiza a cor (5 bits/canal) p/ medir dominância
          const q = ((data[i] >> 3) << 10) | ((data[i + 1] >> 3) << 5) | (data[i + 2] >> 3);
          colors.set(q, (colors.get(q) ?? 0) + 1);
        }
      }
    const total = f.w * f.h;
    const domin = colors.size ? Math.max(...colors.values()) : 0;
    return {
      alphaPct: (opaque / total) * 100,
      contentH: maxY >= minY ? maxY - minY + 1 : 0,
      flatPct: opaque ? (domin / opaque) * 100 : 0,
    };
  }

  /**
   * AUDIT HEADLESS (1 chamada): varre todos os sujeitos/estados/frames e retorna
   * JSON dos frames RUINS com o motivo, p/ o agente localizar e consertar. Além
   * de missing/tamanho/LAB<jogo, mede conteúdo: quase-vazio, chapado (lixo), e
   * altura fora da mediana da família (pulo/encolhimento). Chamar via
   * `window.__game.scene.getScene("SpriteLabScene").runFullAudit()`.
   */
  runFullAudit(): { subjects: number; frames: number; bad: unknown[] } {
    const bad: Array<Record<string, unknown>> = [];
    let frameCount = 0;
    const median = (a: number[]) => {
      const s = [...a].sort((x, y) => x - y);
      return s.length ? s[s.length >> 1] : 0;
    };
    for (const subj of SUBJECTS) {
      const subjIdx = SUBJECTS.indexOf(subj);
      for (const st of Object.keys(subj.states)) {
        const infos = subj.states[st].map((k) => this.getInfo(k));
        const g = this.gameAnimFor(subj.prefix, st);
        if (g && infos.length < g.frames)
          bad.push({
            subjIdx,
            subj: subj.name,
            state: st,
            issue: `LAB<jogo: falta ${g.frames - infos.length}`,
          });
        const heights: number[] = [];
        infos.forEach((f, idx) => {
          frameCount++;
          const reasons: string[] = [];
          if (!f.ok) {
            bad.push({
              subjIdx,
              subj: subj.name,
              state: st,
              frame: idx,
              key: f.key,
              atlasFrame: f.frame,
              issue: "missing",
            });
            return;
          }
          const m = this.frameMetrics(f);
          heights.push(m.contentH);
          if (m.alphaPct < 2) reasons.push(`quase-vazio ${m.alphaPct.toFixed(1)}%`);
          if (m.flatPct > 90) reasons.push(`chapado ${m.flatPct.toFixed(0)}% 1cor`);
          if (reasons.length)
            bad.push({
              subjIdx,
              subj: subj.name,
              state: st,
              frame: idx,
              key: f.frame ?? f.tex,
              atlasFrame: f.frame,
              dims: `${f.w}x${f.h}`,
              issue: reasons.join(" · "),
            });
        });
        // Altura fora da mediana da família (pulo/encolhimento) — só estados com ≥3.
        if (heights.length >= 3) {
          const med = median(heights.filter((h) => h > 0));
          heights.forEach((h, idx) => {
            if (med > 0 && h > 0 && Math.abs(h - med) / med > 0.25)
              bad.push({
                subjIdx,
                subj: subj.name,
                state: st,
                frame: idx,
                atlasFrame: infos[idx]?.frame,
                issue: `altura ${h}px vs mediana ${med}px (pulo de tamanho)`,
              });
          });
        }
      }
    }
    console.log(
      `[SpriteAudit] ${SUBJECTS.length} sujeitos, ${frameCount} frames → ${bad.length} problema(s)`,
      bad,
    );
    return { subjects: SUBJECTS.length, frames: frameCount, bad };
  }

  // ── Fila de PROBLEMAS: audit clicável (achar → pular → consertar) ────────────
  private jumpTo(subjIdx: number, state: string, frameIdx: number) {
    this.subjIdx = subjIdx;
    const states = SUBJECTS[subjIdx].states;
    this.stateName = state in states ? state : Object.keys(states)[0];
    this.loadState();
    const n = this.frames.length;
    this.frameIdx = n ? Phaser.Math.Clamp(frameIdx, 0, n - 1) : 0;
    this.playing = false;
    this.applyFrame();
    this.logDiagnostics();
  }

  private toggleAuditQueue() {
    if (this.auditOverlay) {
      this.closeAuditQueue();
      return;
    }
    this.uploadToast.setText("rodando audit…").setColor("#cfd6e0");
    const rep = this.runFullAudit();
    this.auditItems = rep.bad as AuditItem[];
    this.auditTotalFrames = rep.frames;
    this.auditScroll = 0;
    this.renderAuditQueue();
  }

  private closeAuditQueue() {
    this.auditOverlay?.destroy(true);
    this.auditOverlay = undefined;
  }

  private renderAuditQueue() {
    this.auditOverlay?.destroy(true);
    const W = this.scale.width,
      H = this.scale.height;
    const box = this.add.container(0, 0).setDepth(4900);
    const backdrop = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.74).setInteractive();
    const panelW = 640,
      panelH = 470;
    const panel = this.add
      .rectangle(W / 2, H / 2, panelW, panelH, 0x14121c)
      .setStrokeStyle(2, 0xe0a441);
    const items = this.auditItems;
    const shown = `${this.auditScroll + 1}–${Math.min(this.auditScroll + this.AUDIT_ROWS, items.length)}`;
    const title = this.add
      .text(
        W / 2,
        H / 2 - panelH / 2 + 14,
        items.length
          ? `PROBLEMAS — ${items.length} em ${this.auditTotalFrames} frames · vendo ${shown} · roda p/ scroll · clique = pular`
          : `PROBLEMAS — nenhum! ${this.auditTotalFrames} frames OK · [A]/[ESC] fecha`,
        { fontFamily: "monospace", fontSize: "11px", color: "#f0d49a" },
      )
      .setOrigin(0.5);
    box.add([backdrop, panel, title]);
    this.auditOverlay = box;

    const rowH = 20;
    const top = H / 2 - panelH / 2 + 40;
    items.slice(this.auditScroll, this.auditScroll + this.AUDIT_ROWS).forEach((it, r) => {
      const y = top + r * rowH;
      const canJump = it.subjIdx != null;
      const tag = it.frame != null ? ` #${it.frame}` : "";
      const label = `${it.subj} / ${it.state}${tag} — ${it.issue}`;
      const rowBg = this.add
        .rectangle(W / 2, y, panelW - 24, rowH - 2, 0x201b2c)
        .setInteractive({ useHandCursor: canJump });
      const tx = this.add
        .text(W / 2 - panelW / 2 + 18, y - 6, label.slice(0, 92), {
          fontFamily: "monospace",
          fontSize: "10px",
          color: canJump ? "#e6dcff" : "#8a8598",
        })
        .setOrigin(0, 0);
      if (canJump) {
        rowBg.on("pointerover", () => rowBg.setFillStyle(0x2e2740));
        rowBg.on("pointerout", () => rowBg.setFillStyle(0x201b2c));
        rowBg.on("pointerdown", () => {
          this.closeAuditQueue();
          this.jumpTo(it.subjIdx!, it.state, it.frame ?? 0);
        });
      }
      this.auditOverlay!.add([rowBg, tx]);
    });

    // Batch: conserta em lote os defeitos MECÂNICOS seguros (frame do atlas com
    // vazio/chapado/missing → copiar-vizinho). rescale/altura fica de fora (pode
    // ser pose legítima) — esses o usuário resolve 1 a 1 com o gate.
    const safe = items.filter(
      (it) => it.atlasFrame && /missing|quase-vazio|chapado/.test(it.issue),
    );
    const by = H / 2 + panelH / 2 - 22;
    const has = safe.length > 0;
    const batchBg = this.add
      .rectangle(W / 2, by, 380, 26, has ? 0x243a24 : 0x24242a)
      .setStrokeStyle(2, has ? 0x66dd66 : 0x444)
      .setInteractive({ useHandCursor: has });
    const batchTx = this.add
      .text(W / 2, by, `🔧 CONSERTAR SEGUROS c/ copiar-vizinho (${safe.length})`, {
        fontFamily: "monospace",
        fontSize: "11px",
        color: has ? "#c9f0c0" : "#6a6a72",
      })
      .setOrigin(0.5);
    if (has) batchBg.on("pointerdown", () => void this.batchFixSafe(safe));
    this.auditOverlay.add([batchBg, batchTx]);
  }

  private async batchFixSafe(items: AuditItem[]) {
    this.closeAuditQueue();
    let done = 0,
      fail = 0;
    for (const it of items) {
      this.uploadToast
        .setText(`conserto em lote ${done + fail + 1}/${items.length}: ${it.atlasFrame}…`)
        .setColor("#cfd6e0");
      try {
        const r = await fetch("/__frame-fix", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ frame: it.atlasFrame, mode: "copy-nearest" }),
        });
        const ct = r.headers.get("content-type") ?? "";
        if (!ct.includes("application/json")) throw new Error("só em `vite dev`");
        const j = (await r.json()) as { ok: boolean; error?: string };
        if (!j.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
        done++;
      } catch {
        fail++;
      }
    }
    this.uploadToast
      .setText(`✓ lote: ${done} consertado(s)${fail ? `, ${fail} falha(s)` : ""}`)
      .setColor(fail ? "#ffcc66" : "#88ff88");
    this.reloadAtlas(() => this.loadState());
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
