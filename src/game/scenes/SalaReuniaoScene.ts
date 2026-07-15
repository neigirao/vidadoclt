import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH, COLORS } from "../constants";
import { HUD_BOT_Y } from "../systems/Hud";
import { Player } from "../entities/Player";
import { EstagiarioDesesperado, AnalistaJunior } from "../entities/Enemies";
import { getRun } from "../systems/PlayerState";
import { applyClassAndWeapon } from "../systems/PlayerLoadout";
import { SanityFx } from "../systems/SanityFx";
import { Hud } from "../systems/Hud";
import { Music } from "../systems/MusicSystem";
import { CombatFx } from "../systems/CombatFx";

const LEVEL_WIDTH = 960;
const FLOOR_Y = HUD_BOT_Y - 32;

// Onda: nº de estagiários + nº de analistas juniores.
const WAVES: Array<{ estag: number; junior: number }> = [
  { estag: 4, junior: 0 },
  { estag: 4, junior: 2 },
  { estag: 6, junior: 3 },
];

const ROOM_ID = "reuniao";
const REWARD_VR = 40;

/**
 * Sala opcional #3 — SALA DE REUNIÃO: uma horda por recompensa. Fundação do
 * sistema de salas opcionais (acessível pela Copa). Autocontida (padrão de
 * combate do CopaScene, sem BasePhaseScene): player + ondas de trash + reward.
 * Ao limpar, marca `run.optionalRoomsCleared` para não repetir na mesma run.
 */
export class SalaReuniaoScene extends Phaser.Scene {
  private player!: Player;
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private enemies!: Phaser.Physics.Arcade.Group;
  private drops!: Phaser.Physics.Arcade.Group;
  private fx!: SanityFx;
  private combatFx!: CombatFx;
  private hud!: Hud;
  private interactKey!: Phaser.Input.Keyboard.Key;
  private startTimeMs = 0;
  private waveIdx = 0;
  private waveActive = false;
  private cleared = false;
  private exitDoor?: Phaser.GameObjects.Image;

  constructor() {
    super("SalaReuniaoScene");
  }

  create() {
    const run = getRun(this);
    this.startTimeMs = this.time.now;
    this.waveIdx = 0;
    this.waveActive = false;
    this.cleared = false;
    Music.start("office");

    this.physics.world.setBounds(0, 0, LEVEL_WIDTH, GAME_HEIGHT);
    this.cameras.main.setBounds(0, 0, LEVEL_WIDTH, GAME_HEIGHT);
    this.cameras.main.setBackgroundColor(0x14110c);

    // Fundo: sala de reunião — telão com slide, whiteboard, relógio e cadeiras.
    const bg = this.add.graphics().setDepth(0);
    // parede em painéis + rodapé
    bg.fillStyle(0x241d14, 1);
    bg.fillRect(0, 40, LEVEL_WIDTH, GAME_HEIGHT - 72);
    bg.fillStyle(0x2c2418, 1);
    for (let x = 0; x < LEVEL_WIDTH; x += 200) bg.fillRect(x, 40, 4, GAME_HEIGHT - 112); // ripas
    bg.fillStyle(0x1c160f, 1);
    bg.fillRect(0, GAME_HEIGHT - 120, LEVEL_WIDTH, 8); // moldura/rodapé

    // TELÃO com slide (título + bullets + gráfico de "metas" + apontador laser)
    const sx = GAME_WIDTH / 2 - 150,
      sy = 58;
    bg.fillStyle(0x0b1420, 1);
    bg.fillRect(sx, sy, 300, 122);
    bg.lineStyle(3, 0x3a5a7a, 1);
    bg.strokeRect(sx, sy, 300, 122);
    bg.fillStyle(0x9fc4e6, 0.9);
    bg.fillRect(sx + 16, sy + 14, 150, 7); // título
    bg.fillStyle(0x6a8aa8, 0.7);
    for (let i = 0; i < 3; i++) bg.fillRect(sx + 16, sy + 36 + i * 13, 120 - i * 22, 4); // bullets
    const bars = [22, 34, 18, 42];
    bg.fillStyle(0x66bb88, 0.9);
    bars.forEach((h, i) => bg.fillRect(sx + 196 + i * 22, sy + 100 - h, 14, h)); // barras
    bg.fillStyle(0xff4444, 1);
    bg.fillCircle(sx + 214, sy + 62, 2); // ponto do laser

    // WHITEBOARD lateral com rabiscos
    bg.fillStyle(0xe8e8e0, 0.85);
    bg.fillRect(90, 76, 150, 92);
    bg.lineStyle(2, 0x888888, 1);
    bg.strokeRect(90, 76, 150, 92);
    bg.lineStyle(2, 0x3366aa, 0.7);
    bg.lineBetween(104, 98, 216, 98);
    bg.lineBetween(104, 120, 190, 120);
    bg.lineStyle(2, 0xaa3333, 0.7);
    bg.lineBetween(104, 142, 210, 142);

    // relógio de parede
    bg.fillStyle(0xcfcfc0, 1);
    bg.fillCircle(LEVEL_WIDTH - 140, 96, 16);
    bg.lineStyle(2, 0x222222, 1);
    bg.strokeCircle(LEVEL_WIDTH - 140, 96, 16);
    bg.lineBetween(LEVEL_WIDTH - 140, 96, LEVEL_WIDTH - 140, 85);
    bg.lineBetween(LEVEL_WIDTH - 140, 96, LEVEL_WIDTH - 131, 100);

    // cadeiras de escritório encostadas na parede de fundo (silhueta ASSENTADA)
    bg.fillStyle(0x1a1510, 1);
    for (let x = 70; x < LEVEL_WIDTH; x += 150) {
      bg.fillRect(x, FLOOR_Y - 42, 34, 26); // encosto
      bg.fillRect(x + 6, FLOOR_Y - 18, 22, 12); // assento
      bg.fillRect(x + 14, FLOOR_Y - 6, 6, 8); // haste
    }

    // Chão + duas plataformas
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
        [230, FLOOR_Y - 96, 4],
        [560, FLOOR_Y - 96, 4],
      ] as [number, number, number][]
    ).forEach(([x, y, t]) => {
      const w = t * 32;
      const plat = this.add.rectangle(x + w / 2, y, w, 14, COLORS.copaAccent);
      this.physics.add.existing(plat, true);
      this.platforms.add(plat);
    });

    // Player — loadout igual às fases (classe + arma + upgrades) via fonte única
    this.player = new Player(this, 80, FLOOR_Y - 60);
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
    this.player.onAttack = (hb, step, _swingId, firstFrame) => {
      if (firstFrame !== false) this.resolveAttack(hb, step);
    };

    // Grupos
    this.enemies = this.physics.add.group({ runChildUpdate: false });
    this.physics.add.collider(this.enemies, this.platforms);
    this.drops = this.physics.add.group();
    this.physics.add.collider(this.drops, this.platforms);
    this.physics.add.overlap(this.player, this.drops, (_p, dObj) => {
      this.player.addVR(1);
      (dObj as Phaser.Physics.Arcade.Sprite).destroy();
    });
    // Contato inimigo → dano (i-frames do próprio takeDamage evitam spam)
    this.physics.add.overlap(this.player, this.enemies, (_p, eObj) => {
      const e = eObj as Phaser.Physics.Arcade.Sprite & { contactDamage?: number };
      if (!e.active) return;
      if (!this.player.isInvulnerable(this.time.now)) {
        this.player.takeDamage(e.contactDamage ?? 6, 6, e.x);
      }
    });

    // FX + HUD
    this.combatFx = new CombatFx(this);
    this.fx = new SanityFx(this);
    this.hud = new Hud(this, LEVEL_WIDTH);
    this.hud.setPhaseTitle("SALA DE REUNIÃO — HORDA");
    this.hud.setObjective(`Onda 1/${WAVES.length} — sobreviva e limpe a sala`);

    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC).on("down", () => {
      this.scene.pause();
      this.scene.launch("PauseScene", { caller: "SalaReuniaoScene" });
    });
    this.interactKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E);

    const title = this.add
      .text(
        GAME_WIDTH / 2,
        90,
        `SALA DE REUNIÃO\nHorda de ${WAVES.length} ondas. Recompensa: ${REWARD_VR} VR.`,
        {
          fontFamily: "monospace",
          fontSize: "14px",
          color: "#ffcc66",
          align: "center",
          stroke: "#000000",
          strokeThickness: 3,
        },
      )
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(900);
    this.tweens.add({
      targets: title,
      alpha: 0,
      delay: 2200,
      duration: 700,
      onComplete: () => title.destroy(),
    });

    this.cameras.main.fadeIn(280, 0, 0, 0);
    // Aviso durante a preparação — a sala não fica "vazia e sem o que fazer".
    this.hud.setObjective("A reunião vai começar... prepare-se!");
    this.time.delayedCall(900, () => this.spawnWave());
  }

  private spawnWave() {
    const w = WAVES[this.waveIdx];
    this.waveActive = true;
    // Spawn concentrado na área visível a partir do player (evita nascer fora da
    // tela à direita numa arena de 1920 — dava sensação de "sumiram/nada a fazer").
    for (let i = 0; i < w.estag; i++) {
      const x = Phaser.Math.Between(300, 880);
      const e = new EstagiarioDesesperado(this, x, FLOOR_Y - 60, Math.random() < 0.5 ? 1 : -1);
      e.target = this.player;
      this.enemies.add(e);
    }
    for (let i = 0; i < w.junior; i++) {
      const x = Phaser.Math.Between(340, 900);
      const e = new AnalistaJunior(this, x, FLOOR_Y - 60);
      e.target = this.player;
      this.enemies.add(e);
    }
    this.hud.setObjective(`Onda ${this.waveIdx + 1}/${WAVES.length} — limpe os inimigos`);
    this.flashBanner(`ONDA ${this.waveIdx + 1}`);
  }

  private flashBanner(text: string) {
    const t = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 60, text, {
        fontFamily: "monospace",
        fontSize: "22px",
        fontStyle: "bold",
        color: "#ffaa33",
        stroke: "#000000",
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(950);
    this.tweens.add({
      targets: t,
      alpha: 0,
      scaleX: 1.4,
      scaleY: 1.4,
      duration: 900,
      onComplete: () => t.destroy(),
    });
  }

  private resolveAttack(hb: Phaser.Geom.Rectangle, step: number) {
    const isFinisher = step >= 3;
    const damage = (isFinisher ? 15 : 10) * this.player.damageMult;
    const knockback = (isFinisher ? 320 : 120) * this.player.facing;

    const slash = this.add.graphics().setDepth(15);
    const cx = hb.x + hb.width / 2;
    const cy = hb.y + hb.height / 2;
    const r = Math.max(hb.width, hb.height) * 0.6;
    slash.lineStyle(3, 0xffffff, 0.7);
    slash.beginPath();
    slash.arc(cx, cy, r, -Math.PI * 0.5, Math.PI * 0.5, false);
    slash.strokePath();
    this.tweens.add({
      targets: slash,
      alpha: 0,
      scaleX: 1.2,
      scaleY: 1.2,
      duration: 130,
      onComplete: () => slash.destroy(),
    });

    this.enemies.getChildren().forEach((c) => {
      const e = c as Phaser.Physics.Arcade.Sprite & {
        hit?: (d: number, k: number) => boolean;
      };
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
    this.hud.setObjective("Sala limpa! Pegue o VR e volte à Copa [ E ]");

    for (let i = 0; i < REWARD_VR / 5; i++) {
      this.time.delayedCall(i * 60, () =>
        this.dropVR(this.player.x + Phaser.Math.Between(-80, 80), FLOOR_Y - 60, 5),
      );
    }

    // Porta de saída (volta à Copa)
    this.exitDoor = this.add.image(LEVEL_WIDTH - 60, FLOOR_Y - 30, "tex-door").setDepth(6);
    this.add
      .text(LEVEL_WIDTH - 60, FLOOR_Y - 70, "COPA", {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#c9a36a",
      })
      .setOrigin(0.5);
    this.flashBanner("SALA LIMPA!");
  }

  private persist() {
    const r = getRun(this);
    r.energy = this.player.energy;
    r.sanity = this.player.sanity;
    r.vr = this.player.vr;
  }

  private returnToCopa() {
    this.persist();
    const r = getRun(this);
    r.cameFrom = "reuniao"; // não altera sourcePhase (fora do phaseBackMap da Copa)
    this.cameras.main.fadeOut(280, 0, 0, 0);
    this.cameras.main.once("camerafadeoutcomplete", () => this.scene.start("CopaScene"));
  }

  update(time: number, delta: number) {
    this.player.update(time, delta);
    this.player.tickPassive(time);

    // AnalistaJunior swing check (ataque telegrafado com hitbox)
    this.enemies.getChildren().forEach((c) => {
      const jr = c as AnalistaJunior;
      if (jr.swingActive && jr.swingHitbox) {
        if (
          !this.player.isInvulnerable(time) &&
          Phaser.Geom.Intersects.RectangleToRectangle(jr.swingHitbox, this.player.getBounds())
        ) {
          this.player.takeDamage(jr.swingDamage ?? 10, 4, jr.x);
          jr.swingActive = false;
          jr.swingHitbox = null;
        }
      }
    });

    // Progressão de ondas: só avança quando a onda ATUAL foi limpa de fato
    // (waveActive foi ligado no spawn e a contagem zerou). Sem race de timer.
    if (!this.cleared && this.waveActive && this.enemies.countActive() === 0) {
      this.waveActive = false;
      if (this.waveIdx < WAVES.length - 1) {
        this.waveIdx++;
        this.time.delayedCall(700, () => this.spawnWave());
      } else {
        this.onCleared();
      }
    }

    // Saída pela porta
    if (this.cleared && this.exitDoor) {
      const near =
        Phaser.Math.Distance.Between(
          this.player.x,
          this.player.y,
          this.exitDoor.x,
          this.exitDoor.y,
        ) < 44;
      if (
        near &&
        (Phaser.Input.Keyboard.JustDown(this.interactKey) || this.player.gamepadInteractJustPressed)
      ) {
        this.returnToCopa();
      }
    }

    this.fx.update(time, this.player.sanity);

    const run = getRun(this);
    this.hud.update({
      energy: Math.ceil(this.player.energy),
      maxEnergy: this.player.maxEnergy,
      sanity: Math.ceil(this.player.sanity),
      maxSanity: this.player.maxSanity,
      vr: this.player.vr,
      reconhecimento: run.reconhecimento,
      time,
      startTime: this.startTimeMs,
      playerX: this.player.x,
      burnoutMods: this.player.getBurnoutMods(),
      tremoring: this.player.isTremoring(time),
      tremorWarnMs: this.player.getTremorWarnMs(time),
    });
  }
}
