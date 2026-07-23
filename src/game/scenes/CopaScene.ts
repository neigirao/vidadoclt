import Phaser from "phaser";
import { Telemetry } from "../systems/Telemetry";
import { TutorialPrompts } from "../systems/TutorialPrompts";
import { GAME_HEIGHT, GAME_WIDTH, COLORS } from "../constants";
import { HUD_BOT_Y } from "../systems/Hud";
import { Player } from "../entities/Player";
import { Faxineiro } from "../entities/Faxineiro";
import { getRun, savePersisted } from "../systems/PlayerState";
import { WEAPONS, WeaponId } from "../systems/WeaponSystem";
import { applyClassAndWeapon } from "../systems/PlayerLoadout";
import { SanityFx } from "../systems/SanityFx";
import { ShopUI } from "../systems/Shop";
import { Hud } from "../systems/Hud";
import { Music } from "../systems/MusicSystem";
import { CombatFx } from "../systems/CombatFx";
import { resolveSprite } from "../systems/SpriteLibrary";
import { Sfx } from "../systems/AudioSystem";

const LEVEL_WIDTH = 1280;
const FLOOR_Y = HUD_BOT_Y - 32;

export class CopaScene extends Phaser.Scene {
  private player!: Player;
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private faxineiros!: Phaser.Physics.Arcade.Group;
  private drops!: Phaser.Physics.Arcade.Group;
  private fx!: SanityFx;
  private combatFx!: CombatFx;
  private hud!: Hud;
  private shop!: ShopUI;
  private ponto!: Phaser.GameObjects.Image;
  private coffee!: Phaser.GameObjects.Image;
  private coffeeReadyAt = 0;
  private interactKey!: Phaser.Input.Keyboard.Key;
  private hintText!: Phaser.GameObjects.Text;
  private startTimeMs = 0;
  private lastHealAt = 0;
  private npcs: Array<{
    x: number;
    lines: string[];
    idx: number;
    bubble?: Phaser.GameObjects.Text;
    action?: () => string; // se presente, E executa a ação e mostra o texto retornado
  }> = [];

  constructor() {
    super("CopaScene");
  }

  create() {
    Telemetry.phaseEnter(this.scene.key);
    const run = getRun(this);
    this.startTimeMs = this.time.now;
    Music.start("copa");

    if (run.cameFrom === "openspace") {
      run.fgts += 10;
      savePersisted(run.reconhecimento, run.fgts, run.loopCount);
    }

    this.physics.world.setBounds(0, 0, LEVEL_WIDTH, GAME_HEIGHT);
    this.cameras.main.setBounds(0, 0, LEVEL_WIDTH, GAME_HEIGHT);
    this.cameras.main.setBackgroundColor(COLORS.copaBg);

    // Copa background: copa aconchegante (tons quentes, azulejo, bancada, plantas).
    const wallTop = 60;
    const wallBot = GAME_HEIGHT - 64;
    const bg = this.add.graphics().setScrollFactor(0.6).setDepth(0);
    // Parede — gradiente quente (bege/marrom) em faixas
    for (let i = 0; i < 6; i++) {
      const y = wallTop + ((wallBot - wallTop) / 6) * i;
      const shade = 0x2c241c + i * 0x030302;
      bg.fillStyle(shade, 1);
      bg.fillRect(0, y, LEVEL_WIDTH, (wallBot - wallTop) / 6 + 1);
    }
    // Faixa de azulejo (parede da bancada) — creme com rejunte
    const tileTop = wallBot - 96;
    bg.fillStyle(0x6b5a3f, 1);
    bg.fillRect(0, tileTop, LEVEL_WIDTH, 96);
    bg.fillStyle(0x7d6a4c, 1);
    bg.fillRect(0, tileTop, LEVEL_WIDTH, 4); // topo iluminado
    bg.lineStyle(1, 0x4a3d2a, 0.7);
    for (let x = 0; x <= LEVEL_WIDTH; x += 40) bg.lineBetween(x, tileTop, x, wallBot);
    for (let y = tileTop; y <= wallBot; y += 32) bg.lineBetween(0, y, LEVEL_WIDTH, y);
    // Rodapé
    bg.fillStyle(0x3a2e20, 1);
    bg.fillRect(0, wallBot, LEVEL_WIDTH, 6);
    // Janelas com luz quente de fim de tarde
    [220, 640, 1040, 1500].forEach((wx) => {
      bg.fillStyle(0x1a2230, 1);
      bg.fillRect(wx, 74, 96, 118); // vidro escuro
      bg.fillStyle(0xf2b45a, 0.28);
      bg.fillRect(wx + 6, 80, 84, 60); // brilho quente
      bg.lineStyle(3, 0x2a2018, 1);
      bg.strokeRect(wx, 74, 96, 118); // caixilho
      bg.lineBetween(wx + 48, 74, wx + 48, 192);
      bg.lineBetween(wx, 133, wx + 96, 133);
    });
    // Luminárias do teto (glow quente)
    bg.fillStyle(0xffe0a0, 0.22);
    for (let x = 100; x < LEVEL_WIDTH; x += 260) bg.fillRect(x, wallTop, 140, 8);
    // Plantinhas decorativas na base da parede
    [120, 560, 900, 1400, 1780].forEach((px) => {
      bg.fillStyle(0x2a1c10, 1);
      bg.fillRect(px - 8, wallBot - 22, 16, 22); // vaso
      bg.fillStyle(0x3a6a2e, 1);
      bg.fillCircle(px, wallBot - 26, 11); // folhagem
      bg.fillStyle(0x4e8a3c, 1);
      bg.fillCircle(px - 4, wallBot - 30, 6);
    });

    this.platforms = this.physics.add.staticGroup();
    const floor = this.add.rectangle(
      LEVEL_WIDTH / 2,
      FLOOR_Y + 16,
      LEVEL_WIDTH,
      32,
      COLORS.copaFloor,
    );
    this.physics.add.existing(floor, true);
    this.platforms.add(floor);
    (
      [
        [320, FLOOR_Y - 90, 4],
        [720, FLOOR_Y - 90, 4],
        [1000, FLOOR_Y - 140, 3],
      ] as [number, number, number][]
    ).forEach(([x, y, t]) => {
      const w = t * 32;
      const plat = this.add.rectangle(x + w / 2, y, w, 14, COLORS.copaAccent);
      this.physics.add.existing(plat, true);
      this.platforms.add(plat);
    });

    // Coffee machine
    this.coffee = this.add.image(180, FLOOR_Y - 20, "tex-coffee");
    this.add
      .text(180, FLOOR_Y - 56, "CAFE", {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#eac08a",
      })
      .setOrigin(0.5);

    // Ponto eletrônico
    this.ponto = this.add.image(LEVEL_WIDTH - 140, FLOOR_Y - 20, "tex-ponto");
    this.add
      .text(LEVEL_WIDTH - 140, FLOOR_Y - 56, "PONTO", {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#f2c14e",
      })
      .setOrigin(0.5);

    // Door back to OpenSpace
    const doorBack = this.add.image(40, FLOOR_Y - 30, "tex-door");
    this.add
      .text(40, FLOOR_Y - 70, "VOLTAR", {
        fontFamily: "monospace",
        fontSize: "9px",
        color: "#c9a36a",
      })
      .setOrigin(0.5);
    doorBack.setData("door", "back");

    // Player
    this.player = new Player(this, 80, FLOOR_Y - 60);
    // Loadout igual às fases (classe + arma + upgrades) — fonte única.
    applyClassAndWeapon(this.player, run);
    this.player.energy = run.energy;
    this.player.sanity = run.sanity;
    this.player.vr = run.vr;
    this.physics.add.collider(this.player, this.platforms);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);

    this.player.onDeath = (cause) => {
      this.persist();
      this.scene.start("GameOverScene", {
        vr: this.player.vr,
        cause,
        sanity: Math.max(0, Math.round(this.player.sanity)),
      });
    };
    // Janela ativa do golpe re-dispara onAttack por frame; sem dedup aqui,
    // processa só o 1º frame (evita slash/SFX 8x por golpe).
    this.player.onAttack = (hb, step, _swingId, firstFrame) => {
      if (firstFrame !== false) this.resolveAttack(hb, step);
    };

    // Faxineiros
    this.faxineiros = this.physics.add.group({ classType: Faxineiro, runChildUpdate: false });
    [520, 880].forEach((x) => {
      const f = new Faxineiro(this, x, FLOOR_Y - 80);
      f.target = this.player;
      this.faxineiros.add(f);
    });

    // Faxineiro dialogue — loop-count progression + cause overlay
    const loopCount = run.loopCount ?? 0;
    const cause = run.lastDeathCause;

    let fala: string;
    if (loopCount <= 1) {
      fala =
        cause === "burnout"
          ? "Bom dia! Parece cansado... O café tá fresquinho."
          : "Bom dia! A copa é sua. Café tá fresquinho.";
    } else if (loopCount <= 3) {
      fala =
        cause === "burnout"
          ? "De novo com a cabeça pesada? Eu conheço esse olho."
          : "De novo? Você parece familiar... Café?";
    } else if (loopCount <= 6) {
      fala =
        cause === "energy"
          ? `Cara... você tá bem? Já te vi sair machucado umas ${loopCount} vezes hoje.`
          : `Cara... você tá bem? Já te vi sair daqui umas ${loopCount} vezes hoje.`;
    } else if (loopCount <= 10) {
      fala = "Olha, entre nós... eu também não consigo sair daqui. Só finjo que limpo.";
    } else {
      fala = "Talvez a saída não seja às 18h. Talvez a saída seja... dentro de você.";
    }
    this.time.delayedCall(1200, () => {
      const bubble = this.add
        .text(520, FLOOR_Y - 130, fala, {
          fontFamily: "monospace",
          fontSize: "11px",
          color: "#c9e8c9",
          backgroundColor: "#1a2a1a",
          padding: { x: 6, y: 4 },
        })
        .setOrigin(0.5)
        .setDepth(500);
      this.tweens.add({
        targets: bubble,
        alpha: 0,
        delay: 2800,
        duration: 600,
        onComplete: () => bubble.destroy(),
      });
    });
    this.physics.add.collider(this.faxineiros, this.platforms);

    this.drops = this.physics.add.group();
    this.physics.add.collider(this.drops, this.platforms);
    this.physics.add.overlap(this.player, this.drops, (_p, dObj) => {
      this.player.addVR(1);
      (dObj as Phaser.Physics.Arcade.Sprite).destroy();
    });

    // ── NPCs de narrativa (#25) — falas por proximidade + E ───────────────────
    this.setupNpcs(loopCount);

    // ── Eventos de RH/Cultura (#26) — evento aleatório na Copa (exceto a 1ª) ───
    if (run.cameFrom !== "openspace") this.rollCopaEvent();

    // FX + HUD + Shop
    this.combatFx = new CombatFx(this);
    this.fx = new SanityFx(this);
    this.hud = new Hud(this, LEVEL_WIDTH);
    this.hud.setPhaseTitle("COPA — AREA DE DESCANSO");
    // Dica 1ª sessão: como funciona a Copa.
    this.time.delayedCall(1200, () =>
      TutorialPrompts.maybeShow(
        this,
        "copa",
        "Copa: descanse, compre no Ponto (1–7) e bata o ponto (E) pra avançar.",
      ),
    );
    this.hud.setObjective("Descanse, compre no Ponto e volte ao escritorio");

    // Item 7 — emergency low-sanity heal: if player arrives with < 25 sanity,
    // offer a free sanity restore (sanidade como decisão de gameplay)
    if (this.player.sanity < 25) {
      this.time.delayedCall(400, () => {
        const overlay = this.add
          .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH * 0.7, 110, 0x0a1f0a, 0.93)
          .setScrollFactor(0)
          .setDepth(990)
          .setAlpha(0);
        const msg = this.add
          .text(
            GAME_WIDTH / 2,
            GAME_HEIGHT / 2 - 28,
            "BURNOUT IMINENTE\nO Faxineiro oferece um chá de camomila gratuito.\n[ ESPAÇO ] Aceitar  —  restaura +40 Sanidade",
            {
              fontFamily: "monospace",
              fontSize: "12px",
              color: "#44ffaa",
              align: "center",
              lineSpacing: 4,
            },
          )
          .setOrigin(0.5)
          .setScrollFactor(0)
          .setDepth(991)
          .setAlpha(0);
        this.tweens.add({ targets: [overlay, msg], alpha: 1, duration: 300 });
        const accept = () => {
          this.player.sanity = Math.min(100, this.player.sanity + 40);
          const fxt = this.add
            .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 20, "+40 SANIDADE", {
              fontFamily: "monospace",
              fontSize: "15px",
              color: "#44ffaa",
              stroke: "#000000",
              strokeThickness: 3,
            })
            .setOrigin(0.5)
            .setScrollFactor(0)
            .setDepth(992);
          this.tweens.add({
            targets: fxt,
            y: fxt.y - 30,
            alpha: 0,
            duration: 900,
            onComplete: () => fxt.destroy(),
          });
          this.tweens.add({
            targets: [overlay, msg],
            alpha: 0,
            duration: 300,
            onComplete: () => {
              overlay.destroy();
              msg.destroy();
            },
          });
          this.input.keyboard!.off("keydown-SPACE", accept);
        };
        this.input.keyboard!.once("keydown-SPACE", accept);
        // auto-dismiss after 6s if ignored
        this.time.delayedCall(6000, () => {
          if (overlay.active) {
            this.tweens.add({
              targets: [overlay, msg],
              alpha: 0,
              duration: 400,
              onComplete: () => {
                overlay.destroy();
                msg.destroy();
              },
            });
          }
        });
      });
    }

    // Remember which phase the player came from (set by phase scenes via cameFrom).
    // Persist into sourcePhase so it survives subsequent transitions.
    const phaseBackMap: Record<string, string> = {
      openspace: "OpenSpaceV2Scene",
      phase2: "Phase2Scene",
      phase3: "Phase3Scene",
      phase4: "Phase4Scene",
      phase5: "Phase5Scene",
    };
    if (run.cameFrom && phaseBackMap[run.cameFrom]) {
      run.sourcePhase = run.cameFrom;
    }

    this.shop = new ShopUI(this);
    this.shop.setPlayer(this.player);
    this.shop.onWeaponChange = (id) => {
      const r = getRun(this);
      r.weaponId = id;
    };
    this.shop.onAdvance = () => {
      this.persist();
      const r = getRun(this);
      r.reconhecimento += Math.floor(r.vr * 0.5);
      r.vr = 0;
      const dest = r.nextScene ?? "OpenSpaceV2Scene";
      r.cameFrom = "copa"; // preserve energy/sanity on the next phase
      r.nextScene = undefined;
      // FLUXO LINEAR (decisão do dono): sem TELA de escolha de rota. O jogo segue
      // fixo 1→2→3→4→5→CEO. Mas as Fases 2/3 têm DUAS variantes autoradas cada
      // (fundo/título/objetivo/layout/inimigos + modificador de stat). Em vez de
      // fixar uma e jogar a outra fora, escolhemos a variante por SEED (por run):
      // recicla todo o conteúdo autorado e revive os modificadores de rota, sem
      // reintroduzir a bifurcação. `??=` fixa por run (persiste na visita seguinte).
      const seedNum = r.seed ? parseInt(r.seed.replace(/\D/g, "").slice(0, 6) || "0", 10) : 0;
      if (dest === "Phase2Scene") r.route ??= seedNum % 2 === 0 ? "comercial" : "atendimento";
      if (dest === "Phase3Scene")
        r.route2 ??= Math.floor(seedNum / 2) % 2 === 0 ? "produto" : "tecnologia";
      this.scene.start(dest);
    };

    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC).on("down", () => {
      // Se a loja está aberta, ESC fecha a loja (não abre o pause por cima).
      if (this.shop?.isOpen()) {
        this.shop.close();
        return;
      }
      this.scene.pause();
      this.scene.launch("PauseScene", { caller: "CopaScene" });
    });
    this.interactKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E);

    this.hintText = this.add
      .text(
        GAME_WIDTH / 2,
        GAME_HEIGHT - 18,
        "E para interagir  •  Cafe restaura Energia  •  Ponto abre a loja",
        { fontFamily: "monospace", fontSize: "11px", color: "#aaaaaa" },
      )
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(1000);

    // ── Salas opcionais (#3): a porta lateral oferece UMA sala-bônus aleatória
    // ainda não limpa nesta run (roguelite). Reunião → horda; as demais →
    // SalaBonusScene. Determinístico pela seed + nº de salas já limpas.
    //
    // DESLIGADO para o ALPHA (decisão de simplificação — Opção B): o fluxo fica
    // linear Fase→Copa→Fase, sem os desvios opcionais (que confundiam: "não tem
    // pra onde ir"). As cenas e a lógica ficam no repo (reversível: virar `true`);
    // continuam alcançáveis por TESTAR FASE / LAB. Religam quando ganharem
    // fundos próprios (hoje são cor sólida).
    const OPTIONAL_ROOMS_ENABLED = false;
    // "arquivo"/"deposito" = salas LDtk (LdtkRoomScene) — desenhadas em ASCII
    // (gen-ldtk-rooms.mjs) ou por export do editor; entram no sorteio quando o
    // pool religar.
    const ALL_ROOMS = [
      "reuniao",
      "banheiro",
      "ti",
      "rh",
      "financeiro",
      "arquivo",
      "deposito",
    ] as const;
    const cleared = new Set(run.optionalRoomsCleared ?? []);
    const available = ALL_ROOMS.filter((r) => !cleared.has(r));
    if (OPTIONAL_ROOMS_ENABLED && available.length > 0) {
      const seedNum = run.seed ? parseInt(run.seed.replace(/\D/g, "").slice(0, 6) || "0", 10) : 0;
      const pick = available[(seedNum + cleared.size) % available.length];
      const LABELS: Record<string, string> = {
        reuniao: "SALA DE\nREUNIÃO",
        banheiro: "BANHEIRO",
        ti: "TI\n(CHAMADO)",
        rh: "RH\n(ROLETA)",
        financeiro: "FINANCEIRO",
        arquivo: "ARQUIVO\nMORTO",
        deposito: "DEPÓSITO",
      };
      const salaDoor = this.add.image(LEVEL_WIDTH / 2, FLOOR_Y - 30, "tex-door").setTint(0xffaa55);
      this.add
        .text(LEVEL_WIDTH / 2, FLOOR_Y - 72, LABELS[pick], {
          fontFamily: "monospace",
          fontSize: "9px",
          color: "#ffbb66",
          align: "center",
        })
        .setOrigin(0.5);
      const salaZone = this.add.zone(LEVEL_WIDTH / 2, FLOOR_Y - 30, 44, 64);
      this.physics.add.existing(salaZone, true);
      this.physics.add.overlap(this.player, salaZone, () => {
        if (
          Phaser.Input.Keyboard.JustDown(this.interactKey) ||
          this.player.gamepadInteractJustPressed
        ) {
          this.persist();
          getRun(this).cameFrom = "copa";
          if (pick === "reuniao") this.scene.start("SalaReuniaoScene");
          else if (pick === "arquivo" || pick === "deposito")
            this.scene.start("LdtkRoomScene", { room: pick });
          else this.scene.start("SalaBonusScene", { type: pick });
        }
        salaDoor.setTint(0xffdd99);
      });
    }

    // Door back trigger — returns to the phase the player came from
    const doorBackZone = this.add.zone(40, FLOOR_Y - 30, 40, 60);
    this.physics.add.existing(doorBackZone, true);
    this.physics.add.overlap(this.player, doorBackZone, () => {
      if (
        Phaser.Input.Keyboard.JustDown(this.interactKey) ||
        this.player.gamepadInteractJustPressed
      ) {
        this.persist();
        const r = getRun(this);
        const src = r.sourcePhase ?? "openspace";
        const dest = phaseBackMap[src] ?? "OpenSpaceScene";
        r.cameFrom = "copa";
        this.scene.start(dest);
      }
    });

    const title = this.add
      .text(GAME_WIDTH / 2, 80, "COPA — 18:14\nLuz fluorescente piscando.", {
        fontFamily: "monospace",
        fontSize: "16px",
        color: "#eaeaea",
        align: "center",
      })
      .setOrigin(0.5)
      .setScrollFactor(0);
    this.tweens.add({
      targets: title,
      alpha: 0,
      duration: 800,
      delay: 2000,
      onComplete: () => title.destroy(),
    });
  }

  private setupNpcs(loopCount: number) {
    this.npcs = [];
    // Estagiário Conspiracionista — teorias sobre o CEO que evoluem por loop.
    const conspira =
      loopCount <= 2
        ? [
            "Psiu... você já reparou que o relógio nunca passa das 18h?",
            "Dizem que o CEO não tem rosto. Ninguém nunca viu.",
          ]
        : loopCount <= 6
          ? [
              "Eu contei: são sempre os mesmos inimigos. É um LOOP, cara.",
              "O 'CEO' é o loop. A gente é o produto. Pensa nisso.",
            ]
          : [
              "Já morri tantas vezes que decorei o carpete da diretoria.",
              "Talvez sair não seja vencer o CEO. Talvez seja parar de tentar.",
            ];
    // Analista LinkedIn — jargão corporativo (lojista de vaidade).
    const linkedin = [
      "Fechei mais um ciclo de aprendizados hoje! #blessed #hustle",
      "Não é burnout, é 'entrega com paixão'. Bora ressignificar!",
      "Networking é tudo. Aceita meu convite? A gente sinergiza.",
    ];

    const mk = (x: number, texKey: string, tint: number, lines: string[], label: string) => {
      const spr = this.add.image(x, FLOOR_Y - 30, ...resolveSprite(texKey)).setTint(tint);
      spr.setDepth(9);
      this.add
        .text(x, FLOOR_Y - 78, label, {
          fontFamily: "monospace",
          fontSize: "8px",
          color: "#99bbcc",
          align: "center",
        })
        .setOrigin(0.5);
      this.npcs.push({ x, lines, idx: 0 });
    };
    mk(700, "tex-estagiario-idle0", 0x88ccff, conspira, "?");
    mk(1050, "tex-analista-idle0", 0xffcc88, linkedin, "in");

    // Veterano (35 anos de casa) — desbloqueia um "atalho" mediante favor (VR).
    const vetLines =
      loopCount <= 3
        ? [
            "35 anos de casa. Já vi esse loop mil vezes.",
            "Me faz um favor e eu te ensino um atalho.",
          ]
        : ["Você aprende rápido, moleque.", "Um favor pelo outro. É assim que sobrevive aqui."];
    const vetSpr = this.add
      .image(420, FLOOR_Y - 30, ...resolveSprite("tex-rh-idle0"))
      .setTint(0xccaa88);
    vetSpr.setDepth(9);
    this.add
      .text(420, FLOOR_Y - 78, "VETERANO", {
        fontFamily: "monospace",
        fontSize: "8px",
        color: "#ccaa88",
        align: "center",
      })
      .setOrigin(0.5);
    this.npcs.push({
      x: 420,
      lines: vetLines,
      idx: 0,
      action: () => this.veteranoFavor(),
    });
  }

  private copaHazard?: Phaser.GameObjects.Rectangle;
  private lastHazardAt = 0;

  // Evento de RH/Cultura sorteado ao entrar na Copa. 3 tipos autocontidos.
  private rollCopaEvent() {
    if (Math.random() > 0.45) return;
    const roll = Phaser.Math.Between(0, 2);
    let name = "";
    let desc = "";
    if (roll === 0) {
      // Amigo Secreto — ganha um café grátis (consumível).
      name = "AMIGO SECRETO";
      desc = "Alguém deixou um café na sua mesa. +Consumível.";
      this.player.consumivel = "cafe";
      this.player.consumivelUses = 2;
    } else if (roll === 1) {
      // Happy Hour Obrigatório — +20 VR (a firma pagou... com seu tempo).
      name = "HAPPY HOUR OBRIGATÓRIO";
      desc = "Confraternização forçada. +20 VR de 'networking'.";
      this.player.addVR(20);
    } else {
      // Colega esquentou peixe no micro-ondas — nuvem de dano de Sanidade.
      name = "PEIXE NO MICRO-ONDAS";
      desc = "O cheiro é uma arma química. Evite a nuvem.";
      this.copaHazard = this.add
        .rectangle(640, FLOOR_Y - 30, 160, 90, 0x88aa44, 0.22)
        .setDepth(180);
    }
    const banner = this.add
      .text(GAME_WIDTH / 2, 130, `EVENTO: ${name}\n${desc}`, {
        fontFamily: "monospace",
        fontSize: "12px",
        fontStyle: "bold",
        color: "#ffcc66",
        align: "center",
        stroke: "#000000",
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(960);
    this.tweens.add({
      targets: banner,
      alpha: 0,
      delay: 3200,
      duration: 700,
      onComplete: () => banner.destroy(),
    });
  }

  private veteranoFavor(): string {
    const run = getRun(this);
    if (run.veteranoFavor) return "Já te dei o atalho hoje. Amanhã tem mais.";
    const COST = 20;
    if (this.player.vr < COST) return `O favor custa ${COST} VR. Volta quando tiver.`;
    this.player.vr -= COST;
    run.veteranoFavor = true;
    run.extraLives = (run.extraLives ?? 0) + 1;
    Sfx.buy();
    return "Atalho pela burocracia: +1 vida. Não conta pra ninguém.";
  }

  private talkTo(npc: (typeof this.npcs)[number]) {
    npc.bubble?.destroy();
    // NPC transacional (Veterano): 1ª fala é diálogo; as próximas executam a ação.
    let line: string;
    if (npc.action && npc.idx > 0) {
      line = npc.action();
    } else {
      line = npc.lines[npc.idx % npc.lines.length];
    }
    npc.idx++;
    npc.bubble = this.add
      .text(npc.x, FLOOR_Y - 110, line, {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#e8f0ff",
        backgroundColor: "#12202a",
        padding: { x: 6, y: 4 },
        wordWrap: { width: 220 },
        align: "center",
      })
      .setOrigin(0.5)
      .setDepth(600);
    const b = npc.bubble;
    this.tweens.add({
      targets: b,
      alpha: 0,
      delay: 3200,
      duration: 500,
      onComplete: () => b.destroy(),
    });
  }

  private persist() {
    const r = getRun(this);
    r.energy = this.player.energy;
    r.sanity = this.player.sanity;
    r.vr = this.player.vr;
  }

  private resolveAttack(hb: Phaser.Geom.Rectangle, step: number) {
    const isFinisher = step >= 3;
    const damage = isFinisher ? 15 : 10;
    const knockback = (isFinisher ? 320 : 120) * this.player.facing;

    // Som do golpe (a mini-versão da Copa não passa pelo MeleeCombat canônico,
    // então tocamos aqui — 1×/golpe, o onAttack já veio gated por firstFrame).
    if (isFinisher) Sfx.meleeHeavy();
    else Sfx.meleeLight();

    // Arc slash visual
    const slash = this.add.graphics().setDepth(15);
    const cx = hb.x + hb.width / 2;
    const cy = hb.y + hb.height / 2;
    const r = Math.max(hb.width, hb.height) * 0.6;
    const startAngle = this.player.facing > 0 ? -Math.PI * 0.6 : Math.PI * 0.4;
    const endAngle = this.player.facing > 0 ? Math.PI * 0.6 : Math.PI * 1.6;
    slash.lineStyle(3, 0xffffff, 0.75);
    slash.beginPath();
    slash.arc(cx, cy, r, startAngle, endAngle, false);
    slash.strokePath();
    this.tweens.add({
      targets: slash,
      alpha: 0,
      scaleX: 1.2,
      scaleY: 1.2,
      duration: 140,
      ease: "Quad.easeOut",
      onComplete: () => slash.destroy(),
    });

    this.faxineiros.getChildren().forEach((c) => {
      const f = c as Faxineiro;
      if (!f.active) return;
      if (Phaser.Geom.Intersects.RectangleToRectangle(hb, f.getBounds())) {
        CombatFx.flashSprite(f as unknown as Phaser.Physics.Arcade.Sprite, 55);
        if (isFinisher) {
          this.combatFx.hitStop(85);
          this.combatFx.comboFinisher(this.player.x, f.x);
        } else {
          this.combatFx.hitLight(f.x, f.y - 10);
        }
        if (f.hit(damage, knockback)) {
          this.dropVR(f.x, f.y, 5);
          this.tweens.add({
            targets: f,
            y: f.y - 18,
            scaleY: 0.5,
            alpha: 0,
            duration: 200,
            ease: "Quad.easeOut",
            onComplete: () => f.destroy(),
          });
          f.setActive(false);
        }
      }
    });
  }

  private dropVR(x: number, y: number, count = 1) {
    for (let i = 0; i < count; i++) {
      const d = this.drops.create(
        x + (i - count / 2) * 8,
        y - 10,
        "tex-vr",
      ) as Phaser.Physics.Arcade.Sprite;
      d.setDepth(8);
      const body = d.body as Phaser.Physics.Arcade.Body;
      body.setVelocity(Phaser.Math.Between(-120, 120), Phaser.Math.Between(-260, -160));
      body.setBounce(0.4);
      body.setDrag(120, 0);
    }
  }

  update(time: number, delta: number) {
    this.player.update(time, delta);
    this.player.tickPassive(time);

    // Faxineiro swings check
    this.faxineiros.getChildren().forEach((c) => {
      const f = c as Faxineiro;
      if (f.swingActive && f.swingHitbox) {
        const pb = this.player.getBounds();
        if (Phaser.Geom.Intersects.RectangleToRectangle(f.swingHitbox, pb)) {
          // nonLethal: a Copa é hub seguro. O Faxineiro pune (não bata no
          // zelador!) mas NÃO mata — piso de 1. Morrer no lugar seguro por
          // esbarrar no healer é o anti-padrão que a telemetria pegou.
          this.player.takeDamage(f.swingDamage, f.sanityDamage, undefined, true);
          f.swingActive = false;
          f.swingHitbox = null;
        }
      }
    });

    // Faxineiro proximity healing (+5 Sanidade a cada 2s quando perto e em paz)
    if (time - this.lastHealAt > 2000) {
      this.faxineiros.getChildren().forEach((c) => {
        const f = c as Faxineiro;
        if (!f.active || f.swingActive) return;
        const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, f.x, f.y);
        if (dist < 90) {
          this.lastHealAt = time;
          this.player.sanity = Math.min(100, this.player.sanity + 5);
          const fx = this.add
            .text(f.x, f.y - 40, "+5 SANIDADE", {
              fontFamily: "monospace",
              fontSize: "11px",
              color: "#44ffaa",
            })
            .setOrigin(0.5)
            .setDepth(500);
          this.tweens.add({
            targets: fx,
            y: fx.y - 28,
            alpha: 0,
            duration: 750,
            onComplete: () => fx.destroy(),
          });
        }
      });
    }

    // Interact: coffee and ponto
    const nearCoffee =
      Phaser.Math.Distance.Between(this.player.x, this.player.y, this.coffee.x, this.coffee.y) < 40;
    const nearPonto =
      Phaser.Math.Distance.Between(this.player.x, this.player.y, this.ponto.x, this.ponto.y) < 40;

    // Nuvem do micro-ondas (evento): drena Sanidade enquanto o player está nela.
    if (this.copaHazard && time - this.lastHazardAt > 700) {
      if (
        Phaser.Geom.Intersects.RectangleToRectangle(
          this.copaHazard.getBounds(),
          this.player.getBounds(),
        )
      ) {
        this.lastHazardAt = time;
        this.player.drainSanity(5, "peixe no micro-ondas");
      }
    }

    const nearNpc = this.npcs.find(
      (n) => Math.abs(this.player.x - n.x) < 44 && Math.abs(this.player.y - (FLOOR_Y - 30)) < 80,
    );

    if (
      Phaser.Input.Keyboard.JustDown(this.interactKey) ||
      this.player.gamepadInteractJustPressed
    ) {
      if (nearNpc) {
        this.talkTo(nearNpc);
      } else if (nearCoffee && time >= this.coffeeReadyAt && this.player.vr >= 2) {
        this.player.vr -= 2;
        this.player.energy = Math.min(100, this.player.energy + 25);
        this.player.sanity = Math.max(0, this.player.sanity - 5);
        this.coffeeReadyAt = time + 3000;
        const fxt = this.add
          .text(this.coffee.x, this.coffee.y - 50, "+25 ENERGIA  -5 SANIDADE", {
            fontFamily: "monospace",
            fontSize: "11px",
            color: "#eac08a",
          })
          .setOrigin(0.5);
        this.tweens.add({
          targets: fxt,
          y: fxt.y - 24,
          alpha: 0,
          duration: 700,
          onComplete: () => fxt.destroy(),
        });
      } else if (nearPonto) {
        this.persist();
        this.shop.toggle();
      }
    }
    this.shop.update();

    this.fx.update(time, this.player.sanity);

    const run = getRun(this);
    this.hud.update({
      energy: Math.ceil(this.player.energy),
      maxEnergy: 100,
      sanity: Math.ceil(this.player.sanity),
      maxSanity: 100,
      vr: this.player.vr,
      reconhecimento: run.reconhecimento,
      time,
      startTime: this.startTimeMs,
      playerX: this.player.x,
      interactHint: nearCoffee
        ? time < this.coffeeReadyAt
          ? "Cafeteira recarregando..."
          : "[ E ]  Cafe Triplo (2 VR)"
        : nearPonto
          ? "[ E ]  Ponto Eletronico (loja)"
          : undefined,
      burnoutMods: this.player.getBurnoutMods(),
      tremoring: this.player.isTremoring(time),
      tremorWarnMs: this.player.getTremorWarnMs(time),
    });

    this.hintText.setText(
      nearCoffee
        ? time < this.coffeeReadyAt
          ? "Cafeteira recarregando..."
          : "E: Cafe Triplo (2 VR  +25 Energia  -5 Sanidade)"
        : nearPonto
          ? "E: abrir Ponto Eletronico (loja)"
          : "E para interagir  •  <- voltar pelo escritorio",
    );
  }
}
