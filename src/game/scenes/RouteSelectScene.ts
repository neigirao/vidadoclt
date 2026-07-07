import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "../constants";
import { getRun } from "../systems/PlayerState";
import { Sfx } from "../systems/AudioSystem";

type RouteId = "comercial" | "atendimento" | "produto" | "tecnologia";
type RouteStage = "dept" | "area";

interface RouteDef {
  id: RouteId;
  tag: string; // "2A"/"2B" ou "3A"/"3B"
  name: string;
  desc: string;
  perk: string; // modificador legível (aplicado no buildPlayer)
  color: number;
}

// Fundação da ramificação (GDD): após a Fase 1 o jogador escolhe o departamento.
// Hoje as duas rotas seguem para a mesma Fase 2, mas cada uma aplica um
// modificador de run distinto (via buildPlayer) e grava `run.route` — quando as
// fases divergentes (2A/2B com bosses próprios) forem criadas, é só rotear por
// `run.route`.
const ROUTE_DEFS: Record<RouteId, RouteDef> = {
  comercial: {
    id: "comercial",
    tag: "2A",
    name: "COMERCIAL",
    desc: "Metas, gongos de venda e dashboards. Pressão por resultado.",
    perk: "+20% de VR (bater meta)",
    color: 0xff8844,
  },
  atendimento: {
    id: "atendimento",
    tag: "2B",
    name: "ATENDIMENTO",
    desc: "Headsets, filas e chamados. Paciência a toda prova.",
    perk: "+25 Sanidade máxima",
    color: 0x44aaff,
  },
  produto: {
    id: "produto",
    tag: "3A",
    name: "PRODUTO",
    desc: "Post-its, roadmaps e Kanban. Foco no que entrega valor.",
    perk: "+15% de dano",
    color: 0x66cc88,
  },
  tecnologia: {
    id: "tecnologia",
    tag: "3B",
    name: "TECNOLOGIA",
    desc: "Servidores, cabos e logs. Reação rápida a incidentes.",
    perk: "Dash recarrega mais rápido",
    color: 0x9977ee,
  },
};

const STAGE_OPTIONS: Record<RouteStage, RouteId[]> = {
  dept: ["comercial", "atendimento"],
  area: ["produto", "tecnologia"],
};

// Compat: alguns imports antigos referenciam ROUTES.
export const ROUTES = ROUTE_DEFS;

export class RouteSelectScene extends Phaser.Scene {
  constructor() {
    super("RouteSelectScene");
  }

  // `scene.start` com { nextScene, stage } → grava a rota do estágio e inicia nextScene.
  //  • stage "dept" (pós-Fase 1): 2A Comercial / 2B Atendimento → run.route
  //  • stage "area" (pós-Fase 2): 3A Produto / 3B Tecnologia   → run.route2
  create(data: { nextScene: string; stage?: RouteStage }) {
    const run = getRun(this);
    const nextScene = data?.nextScene ?? "Phase2Scene";
    const stage: RouteStage = data?.stage ?? "dept";
    const optionIds = STAGE_OPTIONS[stage];

    this.cameras.main.setBackgroundColor(0x0b0d12);
    this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.55)
      .setDepth(0);

    this.add
      .text(GAME_WIDTH / 2, 70, "BIFURCAÇÃO DE CARREIRA", {
        fontFamily: "monospace",
        fontSize: "20px",
        fontStyle: "bold",
        color: "#f2c14e",
        stroke: "#000000",
        strokeThickness: 4,
      })
      .setOrigin(0.5);
    this.add
      .text(
        GAME_WIDTH / 2,
        100,
        stage === "dept"
          ? "Para onde te realocam depois do Open Space?"
          : "Depois do Comercial/Atendimento, qual squad te absorve?",
        { fontFamily: "monospace", fontSize: "11px", color: "#aaaacc" },
      )
      .setOrigin(0.5);

    const options = optionIds.map((id) => ROUTE_DEFS[id]);
    const cardW = 300;
    const cardH = 260;
    const gap = 60;
    const startX = GAME_WIDTH / 2 - (cardW + gap / 2);
    const cardY = GAME_HEIGHT / 2 + 20;

    options.forEach((def, i) => {
      const cx = startX + i * (cardW + gap) + cardW / 2;
      const card = this.add
        .rectangle(cx, cardY, cardW, cardH, 0x14171f, 1)
        .setStrokeStyle(2, def.color)
        .setInteractive({ useHandCursor: true });
      card.on("pointerover", () => card.setFillStyle(0x1c2130, 1));
      card.on("pointerout", () => card.setFillStyle(0x14171f, 1));
      card.on("pointerdown", () => this.select(def.id, nextScene, stage, run));

      // Header stripe
      this.add.rectangle(cx, cardY - cardH / 2 + 20, cardW, 40, def.color, 0.9);
      this.add
        .text(cx, cardY - cardH / 2 + 20, `FASE ${def.tag} — ${def.name}`, {
          fontFamily: "monospace",
          fontSize: "14px",
          fontStyle: "bold",
          color: "#ffffff",
          stroke: "#000000",
          strokeThickness: 2,
        })
        .setOrigin(0.5);

      this.add
        .text(cx, cardY - 30, `[ ${i + 1} ]`, {
          fontFamily: "monospace",
          fontSize: "13px",
          fontStyle: "bold",
          color: "#88ccff",
        })
        .setOrigin(0.5);

      this.add
        .text(cx, cardY + 20, def.desc, {
          fontFamily: "monospace",
          fontSize: "10px",
          color: "#c8c8d8",
          align: "center",
          wordWrap: { width: cardW - 36 },
        })
        .setOrigin(0.5);

      this.add
        .text(cx, cardY + cardH / 2 - 34, def.perk, {
          fontFamily: "monospace",
          fontSize: "11px",
          fontStyle: "bold",
          color: "#88ff88",
          align: "center",
          wordWrap: { width: cardW - 24 },
        })
        .setOrigin(0.5);
    });

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 24, "[ 1 ] / [ 2 ] ou clique  —  a escolha vale a run", {
        fontFamily: "monospace",
        fontSize: "9px",
        color: "#666677",
      })
      .setOrigin(0.5);

    const kb = this.input.keyboard!;
    kb.once("keydown-ONE", () => this.select(options[0].id, nextScene, stage, run));
    kb.once("keydown-TWO", () => this.select(options[1].id, nextScene, stage, run));

    this.cameras.main.fadeIn(280, 0, 0, 0);
  }

  private select(
    id: RouteId,
    nextScene: string,
    stage: RouteStage,
    run: ReturnType<typeof getRun>,
  ) {
    Sfx.culturaSelect();
    if (stage === "dept") run.route = id as "comercial" | "atendimento";
    else run.route2 = id as "produto" | "tecnologia";
    this.cameras.main.fadeOut(260, 0, 0, 0);
    this.cameras.main.once("camerafadeoutcomplete", () => this.scene.start(nextScene));
  }
}
