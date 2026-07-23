import Phaser from "phaser";

import { GAME_HEIGHT, GAME_WIDTH } from "../constants";
import { Fonts } from "../systems/Fonts";
import { parseLdtk, type LdtkLevel } from "../systems/LdtkLoader";
import { resolveSprite } from "../systems/SpriteLibrary";
import { Player } from "../entities/Player";
import { EstagiarioDesesperado } from "../entities/Enemies";
import { getRun } from "../systems/PlayerState";
import { applyClassAndWeapon } from "../systems/PlayerLoadout";
import { CombatFx } from "../systems/CombatFx";
import { Hud } from "../systems/Hud";
import { ContactShadows } from "../systems/ContactShadows";

// ─────────────────────────────────────────────────────────────────────────────
// ARQUIVO MORTO — sala opcional desenhada no LDtk (https://ldtk.io), PROMOVIDA
// de POC a sala JOGÁVEL: chão/plataformas/props/spawns vêm do arquivo
// `public/assets/levels/ldtk-poc.json` (um export real do editor substitui o
// .json sem tocar neste código); combate/recompensa seguem o padrão das salas
// opcionais (SalaReuniaoScene — mini-combate de sandbox, sem BasePhaseScene).
//
// Fluxo: entra pela porta lateral da Copa (pool de salas opcionais — hoje
// DESLIGADO no alpha, `OPTIONAL_ROOMS_ENABLED` na Copa) ou por TESTAR FASE
// (dev). Limpar os inimigos abre a saída + solta a recompensa; `run.
// optionalRoomsCleared` evita repetir na mesma run. Vindo da Copa, a saída
// volta pra Copa; vindo do menu (dev), volta pro menu.
// ─────────────────────────────────────────────────────────────────────────────
const ROOM_ID = "arquivo";
const REWARD_VR = 30;

export class LdtkRoomScene extends Phaser.Scene {
  private player!: Player;
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private enemies!: Phaser.Physics.Arcade.Group;
  private drops!: Phaser.Physics.Arcade.Group;
  private level!: LdtkLevel;
  private exitZone?: Phaser.GameObjects.Zone;
  private exitLabel?: Phaser.GameObjects.Text;
  private interactKey!: Phaser.Input.Keyboard.Key;
  private combatFx!: CombatFx;
  private hud!: Hud;
  private contactShadows!: ContactShadows;
  private cleared = false;
  private hadEnemies = false;
  private fromCopa = false;

  constructor() {
    super("LdtkRoomScene");
  }

  preload() {
    this.load.json("ldtk-poc", "/assets/levels/ldtk-poc.json");
  }

  create() {
    const run = getRun(this);
    this.fromCopa = run.cameFrom === "copa";
    this.cleared = false;

    const raw = this.cache.json.get("ldtk-poc");
    this.level = parseLdtk(raw);
    const W = this.level.widthPx;
    const grid = this.level.gridSize;

    this.physics.world.setBounds(0, 0, W, GAME_HEIGHT);
    this.cameras.main.setBounds(0, 0, W, GAME_HEIGHT);
    this.cameras.main.setBackgroundColor(0x14100c);

    // Fundo NEUTRO (sem arte pintada) — degradê discreto p/ não ficar chapado.
    const bg = this.add.graphics().setScrollFactor(0.2, 0).setDepth(0);
    for (let i = 0; i < 24; i++) {
      const t = i / 23;
      const c = Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.ValueToColor(0x1c1710),
        Phaser.Display.Color.ValueToColor(0x0d0a07),
        100,
        Math.round(t * 100),
      );
      bg.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b), 1);
      bg.fillRect(0, (GAME_HEIGHT * i) / 24, W, GAME_HEIGHT / 24 + 1);
    }

    // TILES do LDtk desenhados como "caixas de arquivo morto" (o visual da sala).
    const tileG = this.add.graphics().setDepth(4);
    for (const { cx, cy } of this.level.solids) {
      const x = cx * grid,
        y = cy * grid;
      tileG.fillStyle(0x5a4326, 1);
      tileG.fillRect(x, y, grid, grid); // corpo da caixa
      tileG.fillStyle(0x6e5230, 1);
      tileG.fillRect(x + 2, y + 2, grid - 4, 8); // tampa clara
      tileG.lineStyle(1, 0x2e2213, 1);
      tileG.strokeRect(x, y, grid, grid);
      tileG.fillStyle(0x8a7a55, 0.5);
      tileG.fillRect(x + grid / 2 - 5, y + 14, 10, 4); // etiqueta
    }

    // Plataformas (corpos físicos invisíveis) a partir dos runs do IntGrid.
    this.platforms = this.physics.add.staticGroup();
    for (const [px, surfY, tiles] of this.level.platforms) {
      const w = tiles * grid;
      const body = this.add.rectangle(px + w / 2, surfY + grid / 2, w, grid, 0x000000, 0);
      this.physics.add.existing(body, true);
      this.platforms.add(body);
    }

    // PROPS de cenário posicionados no LDtk (camada Entities).
    for (const e of this.level.entities) {
      if (e.id === "Desk") this.addObjectSprite(e.x, e.y, "tex-baia", 1);
      else if (e.id === "Computer") this.addObjectSprite(e.x, e.y, "tex-monitor", 2);
      else if (e.id === "Lamp") this.addLamp(e.x, e.y);
    }

    // Player com loadout REAL (classe/arma/energia da run — igual às salas opcionais).
    const start = this.level.entities.find((e) => e.id === "PlayerStart") ?? { x: 80, y: 380 };
    this.player = new Player(this, start.x, start.y);
    applyClassAndWeapon(this.player, run);
    this.player.energy = run.energy ?? this.player.maxEnergy;
    this.player.sanity = run.sanity ?? this.player.maxSanity;
    this.player.vr = run.vr ?? 0;
    this.player.setDepth(10);
    this.physics.add.collider(this.player, this.platforms);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.player.onDeath = (cause) => {
      this.persist();
      this.scene.start("GameOverScene", {
        vr: this.player.vr,
        cause,
        sanity: Math.max(0, Math.round(this.player.sanity)),
      });
    };
    this.player.onAttack = (hb, step, _swingId, firstFrame) => {
      if (firstFrame !== false) this.resolveAttack(hb, step);
    };

    // Grupos + colliders + contato (padrão SalaReuniao).
    this.enemies = this.physics.add.group({ runChildUpdate: false });
    this.physics.add.collider(this.enemies, this.platforms);
    this.drops = this.physics.add.group();
    this.physics.add.collider(this.drops, this.platforms);
    this.physics.add.overlap(this.player, this.drops, (_p, dObj) => {
      this.player.addVR(1);
      (dObj as Phaser.Physics.Arcade.Sprite).destroy();
    });
    this.physics.add.overlap(this.player, this.enemies, (_p, eObj) => {
      const e = eObj as Phaser.Physics.Arcade.Sprite & { contactDamage?: number };
      if (!e.active) return;
      if (!this.player.isInvulnerable(this.time.now)) {
        this.player.takeDamage(e.contactDamage ?? 6, 6, e.x);
      }
    });

    // Inimigos REAIS nos marcadores Enemy do LDtk (a POC só mostrava losangos).
    const alreadyCleared = (run.optionalRoomsCleared ?? []).includes(ROOM_ID);
    if (!alreadyCleared) {
      for (const e of this.level.entities.filter((e) => e.id === "Enemy")) {
        const en = new EstagiarioDesesperado(this, e.x, e.y - 10, Math.random() < 0.5 ? 1 : -1);
        en.target = this.player;
        this.enemies.add(en);
      }
    }
    this.hadEnemies = this.enemies.getLength() > 0;

    // Sombras de contato (mesma leitura espacial das fases).
    this.contactShadows = new ContactShadows(this);
    this.contactShadows.add(this.player, 0.55);
    this.enemies.getChildren().forEach((obj) => {
      this.contactShadows.add(obj as Parameters<ContactShadows["add"]>[0]);
    });

    // Saída (Exit do LDtk) — bloqueada até limpar; TESTAR FASE entra já limpa.
    const exit = this.level.entities.find((e) => e.id === "Exit");
    if (exit) {
      this.add.rectangle(exit.x, exit.y - 24, 36, 60, 0x2a6b4a).setDepth(5);
      this.exitLabel = this.add
        .text(exit.x, exit.y - 60, "SAÍDA\n[BLOQUEADO]", {
          fontFamily: Fonts.mono,
          fontSize: "9px",
          color: "#7a8a80",
          align: "center",
        })
        .setOrigin(0.5)
        .setDepth(6);
      this.exitZone = this.add.zone(exit.x, exit.y - 24, 44, 70);
      this.physics.add.existing(this.exitZone, true);
    }

    this.combatFx = new CombatFx(this);
    this.hud = new Hud(this, W);
    this.hud.setPhaseTitle("ARQUIVO MORTO");
    this.hud.setObjective(
      alreadyCleared ? "Sala já limpa — saia por [E]" : "Limpe o arquivo morto e pegue o VR",
    );

    this.interactKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC).on("down", () => {
      this.scene.pause();
      this.scene.launch("PauseScene", { caller: "LdtkRoomScene" });
    });

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 18, "← → mover · Espaço pular · J atacar · [E] sair", {
        fontFamily: Fonts.body,
        fontSize: "13px",
        color: "#8a93a0",
      })
      .setOrigin(0.5, 1)
      .setScrollFactor(0)
      .setDepth(1000);

    if (alreadyCleared) this.unlockExit();
    this.cameras.main.fadeIn(280, 0, 0, 0);
  }

  /** Renderiza um sprite de objeto do jogo (tex-*) ancorado pela base (nos pés). */
  private addObjectSprite(x: number, y: number, texKey: string, depth: number) {
    const [tex, frame] = resolveSprite(texKey);
    this.add.image(x, y, tex, frame).setOrigin(0.5, 1).setDepth(depth);
  }

  /** Lâmpada de teto procedural (luminária + cone de luz quente). */
  private addLamp(x: number, y: number) {
    const g = this.add.graphics().setDepth(3);
    g.fillStyle(0x2a2e34, 1);
    g.fillRect(x - 3, y - 8, 6, 12); // haste
    g.fillStyle(0x3a4048, 1);
    g.fillRect(x - 14, y + 2, 28, 6); // calha
    g.fillStyle(0xffe08a, 1);
    g.fillRect(x - 12, y + 6, 24, 3); // tubo aceso
    const glow = this.add.graphics().setDepth(2).setBlendMode(Phaser.BlendModes.ADD);
    glow.fillStyle(0xffcf6a, 0.1);
    glow.fillTriangle(x - 10, y + 8, x + 10, y + 8, x + 70, y + 260);
    glow.fillTriangle(x - 10, y + 8, x + 10, y + 8, x - 70, y + 260);
  }

  /** Mini-combate de sandbox (padrão SalaReuniao — sem BasePhaseScene/MeleeHost). */
  private resolveAttack(hb: Phaser.Geom.Rectangle, step: number) {
    const isFinisher = step >= 3;
    const damage = (isFinisher ? 15 : 10) * this.player.damageMult;
    const knockback = (isFinisher ? 320 : 120) * this.player.facing;

    this.enemies.getChildren().forEach((c) => {
      const e = c as Phaser.Physics.Arcade.Sprite & { hit?: (d: number, k: number) => boolean };
      if (!e.active || !e.hit) return;
      if (Phaser.Geom.Intersects.RectangleToRectangle(hb, e.getBounds())) {
        CombatFx.flashSprite(e, 55);
        if (isFinisher) {
          this.combatFx.hitStop(80);
          this.combatFx.comboFinisher(this.player.x, e.x);
        } else {
          this.combatFx.hitLight(e.x, e.y - 10);
        }
        if (e.hit(Math.round(damage), knockback)) {
          this.dropVR(e.x, e.y, 2);
          e.destroy();
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

  private onCleared() {
    this.cleared = true;
    const run = getRun(this);
    run.optionalRoomsCleared = [...(run.optionalRoomsCleared ?? []), ROOM_ID];
    this.hud.setObjective(`Arquivo limpo! +${REWARD_VR} VR — saia por [E]`);
    for (let i = 0; i < REWARD_VR / 5; i++) {
      this.time.delayedCall(i * 60, () =>
        this.dropVR(this.player.x + Phaser.Math.Between(-70, 70), this.player.y - 20, 5),
      );
    }
    this.unlockExit();
  }

  private unlockExit() {
    this.cleared = true;
    this.exitLabel?.setText(this.fromCopa ? "COPA\n[E]" : "SAÍDA\n[E]").setColor("#9fe0c0");
  }

  private persist() {
    const r = getRun(this);
    r.energy = this.player.energy;
    r.sanity = this.player.sanity;
    r.vr = this.player.vr;
  }

  update(time: number, delta: number) {
    if (!this.player) return;
    this.player.update(time, delta);
    this.contactShadows.update();
    this.hud.update({
      energy: Math.ceil(this.player.energy),
      maxEnergy: this.player.maxEnergy,
      sanity: Math.ceil(this.player.sanity),
      maxSanity: this.player.maxSanity,
      vr: this.player.vr,
      reconhecimento: getRun(this).reconhecimento,
      time,
      startTime: 0,
      playerX: this.player.x,
      dashCooldown: this.player.getDashCooldownRatio(time),
    });

    // Vitória da sala: começou com inimigos e todos morreram.
    if (!this.cleared && this.hadEnemies && this.enemies.countActive() === 0) this.onCleared();
    // Sala sem inimigos (ex.: export sem marcadores) → saída livre.
    if (!this.cleared && !this.hadEnemies) this.unlockExit();

    if (
      this.cleared &&
      this.exitZone &&
      Phaser.Input.Keyboard.JustDown(this.interactKey) &&
      Phaser.Geom.Intersects.RectangleToRectangle(
        this.player.getBounds(),
        this.exitZone.getBounds(),
      )
    ) {
      this.persist();
      this.cameras.main.fadeOut(250, 0, 0, 0);
      this.cameras.main.once("camerafadeoutcomplete", () => {
        if (this.fromCopa) {
          getRun(this).cameFrom = ROOM_ID; // não altera sourcePhase (fora do phaseBackMap)
          this.scene.start("CopaScene");
        } else {
          this.scene.start("MenuScene");
        }
      });
    }
  }
}
