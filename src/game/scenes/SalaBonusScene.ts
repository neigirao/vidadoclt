import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../constants";
import { HUD_BOT_Y } from "../systems/Hud";
import { Player } from "../entities/Player";
import { getRun } from "../systems/PlayerState";
import { WEAPONS, WeaponId } from "../systems/WeaponSystem";
import { applyClassAndWeapon } from "../systems/PlayerLoadout";
import { SanityFx } from "../systems/SanityFx";
import { Hud } from "../systems/Hud";
import { Music } from "../systems/MusicSystem";
import { Sfx } from "../systems/AudioSystem";

const LEVEL_WIDTH = 960;
const FLOOR_Y = HUD_BOT_Y - 32;

export type BonusRoomType = "banheiro" | "ti" | "rh" | "financeiro";

interface RoomMeta {
  title: string;
  bg: number;
  hint: string;
  floor: number; // cor do chão TEMÁTICA por sala (antes todas usavam copaFloor)
}

const ROOMS: Record<BonusRoomType, RoomMeta> = {
  // Piso azulejado frio (banheiro), técnico cinza-azul (TI), carpete morno (RH),
  // carpete verde-escuro de banco (Financeiro) — matiz por tema, mesma escala.
  banheiro: {
    title: "BANHEIRO — RESPIRO",
    bg: 0x18242a,
    hint: "Um instante de paz. +Sanidade.",
    floor: 0x243036,
  },
  ti: {
    title: "TI — ABRIR CHAMADO",
    bg: 0x1a1622,
    hint: "Pegue um equipamento novo.",
    floor: 0x22262f,
  },
  rh: {
    title: "RH — ROLETA DA CULTURA",
    bg: 0x221a1a,
    hint: "Gire a roleta. Pode dar bom... ou não.",
    floor: 0x2a2018,
  },
  financeiro: {
    title: "FINANCEIRO — COFRE",
    bg: 0x14200f,
    hint: "Pegue o VR. Cuidado com as armadilhas.",
    floor: 0x1a2410,
  },
};

/**
 * Salas opcionais #3 (restantes): Banheiro (+sanidade), TI (arma grátis), RH
 * (roleta de evento) e Financeiro (VR + armadilhas). Parametrizada por `type`.
 * Autocontida (padrão leve, sem inimigos exceto armadilhas do Financeiro).
 * Marca `run.optionalRoomsCleared` ao concluir.
 */
export class SalaBonusScene extends Phaser.Scene {
  private player!: Player;
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private drops!: Phaser.Physics.Arcade.Group;
  private fx!: SanityFx;
  private hud!: Hud;
  private interactKey!: Phaser.Input.Keyboard.Key;
  private type: BonusRoomType = "banheiro";
  private used = false;
  private exitDoor?: Phaser.GameObjects.Image;
  private pedestal?: Phaser.GameObjects.Rectangle;
  private startTimeMs = 0;
  private traps: Phaser.GameObjects.Rectangle[] = [];

  constructor() {
    super("SalaBonusScene");
  }

  create(data: { type?: BonusRoomType }) {
    const run = getRun(this);
    this.type = data?.type ?? "banheiro";
    this.used = false;
    this.traps = [];
    this.startTimeMs = this.time.now;
    const meta = ROOMS[this.type];
    Music.start("copa");

    this.physics.world.setBounds(0, 0, LEVEL_WIDTH, GAME_HEIGHT);
    this.cameras.main.setBounds(0, 0, LEVEL_WIDTH, GAME_HEIGHT);
    this.cameras.main.setBackgroundColor(meta.bg);

    // Fundo procedural com detalhe (antes era um retângulo quase preto → parecia
    // "nada carregado"). Parede em faixas + azulejo + janela + luminárias.
    const wallTop = 40;
    const wallBot = GAME_HEIGHT - 64;
    const bg = this.add.graphics().setDepth(0);
    for (let i = 0; i < 5; i++) {
      const y = wallTop + ((wallBot - wallTop) / 5) * i;
      bg.fillStyle(meta.bg + i * 0x040404, 1);
      bg.fillRect(0, y, LEVEL_WIDTH, (wallBot - wallTop) / 5 + 1);
    }
    // faixa de azulejo na base da parede
    bg.fillStyle(meta.bg + 0x101010, 1);
    bg.fillRect(0, wallBot - 60, LEVEL_WIDTH, 60);
    bg.lineStyle(1, 0x000000, 0.35);
    for (let x = 0; x <= LEVEL_WIDTH; x += 36) bg.lineBetween(x, wallBot - 60, x, wallBot);
    bg.lineBetween(0, wallBot - 30, LEVEL_WIDTH, wallBot - 30);
    // janela com brilho frio
    bg.fillStyle(0x2a3648, 0.5);
    bg.fillRect(LEVEL_WIDTH / 2 - 70, 70, 140, 96);
    bg.fillStyle(0x9ab0d0, 0.14);
    bg.fillRect(LEVEL_WIDTH / 2 - 62, 76, 124, 46);
    bg.lineStyle(3, 0x141820, 1);
    bg.strokeRect(LEVEL_WIDTH / 2 - 70, 70, 140, 96);
    // luminárias do teto
    bg.fillStyle(0xd0e0f0, 0.16);
    for (let x = 80; x < LEVEL_WIDTH; x += 240) bg.fillRect(x, wallTop, 120, 6);

    // ── Decoração temática: dá "cara" à sala (depth 0, atrás do gameplay) ──────
    if (this.type === "banheiro") {
      // azulejos da parede
      bg.lineStyle(1, 0x2e4048, 0.5);
      for (let x = 0; x <= LEVEL_WIDTH; x += 26) bg.lineBetween(x, wallTop, x, wallBot - 60);
      for (let y = wallTop; y < wallBot - 60; y += 26) bg.lineBetween(0, y, LEVEL_WIDTH, y);
      // cabines à direita (divisória + porta + trinco + indicador livre/ocupado)
      bg.fillStyle(0x24333a, 1);
      bg.fillRect(LEVEL_WIDTH - 366, FLOOR_Y - 128, 372, 8); // travessa superior
      for (let i = 0; i < 3; i++) {
        const bx = LEVEL_WIDTH - 360 + i * 120;
        bg.fillStyle(0x24333a, 1);
        bg.fillRect(bx, FLOOR_Y - 120, 6, 120); // divisória
        bg.fillStyle(0x1a262c, 1);
        bg.fillRect(bx + 6, FLOOR_Y - 118, 100, 118); // porta
        bg.fillStyle(0x3a5560, 1);
        bg.fillRect(bx + 92, FLOOR_Y - 66, 6, 10); // trinco
        bg.fillStyle(i === 1 ? 0xcc4444 : 0x66bb66, 1);
        bg.fillRect(bx + 88, FLOOR_Y - 110, 10, 4); // ocupado / livre
      }
      // pias + espelhos à esquerda
      for (let i = 0; i < 3; i++) {
        const px = 110 + i * 108;
        bg.fillStyle(0x9fb0b6, 1);
        bg.fillRect(px, FLOOR_Y - 54, 70, 14); // bancada
        bg.fillStyle(0x6d7c82, 1);
        bg.fillEllipse(px + 35, FLOOR_Y - 47, 42, 12); // cuba
        bg.fillStyle(0xc8d8dc, 0.5);
        bg.fillRect(px + 12, FLOOR_Y - 128, 46, 54); // espelho
        bg.lineStyle(2, 0x2e4048, 1);
        bg.strokeRect(px + 12, FLOOR_Y - 128, 46, 54);
        bg.fillStyle(0xb0c0c4, 1);
        bg.fillRect(px + 33, FLOOR_Y - 60, 4, 8); // torneira
      }
    }

    // ── TI — ABRIR CHAMADO: racks de servidor (LEDs), bandeja de cabos, monitor ─
    if (this.type === "ti") {
      for (let r = 0; r < 3; r++) {
        const rx = LEVEL_WIDTH - 300 + r * 96;
        bg.fillStyle(0x14121c, 1);
        bg.fillRect(rx, FLOOR_Y - 150, 76, 150); // gabinete
        bg.fillStyle(0x0c0b12, 1);
        bg.fillRect(rx + 6, FLOOR_Y - 144, 64, 138); // painel interno
        const leds = [0x66ff88, 0xffbb44, 0xff5555];
        for (let row = 0; row < 12; row++) {
          for (let c = 0; c < 4; c++) {
            bg.fillStyle(leds[(r + row + c) % 3], 0.9);
            bg.fillRect(rx + 12 + c * 14, FLOOR_Y - 138 + row * 11, 5, 5);
          }
        }
      }
      bg.fillStyle(0x1a1826, 1);
      bg.fillRect(0, wallTop + 30, LEVEL_WIDTH, 8); // bandeja de cabos
      bg.lineStyle(2, 0x3a5a8a, 0.5);
      for (let x = 20; x < LEVEL_WIDTH; x += 60)
        bg.lineBetween(x, wallTop + 38, x + 30, wallTop + 58);
      bg.fillStyle(0x2a2436, 1);
      bg.fillRect(90, FLOOR_Y - 40, 120, 40); // mesa do chamado
      bg.fillStyle(0x0b1420, 1);
      bg.fillRect(120, FLOOR_Y - 92, 64, 46); // tela
      bg.fillStyle(0x66ccff, 0.8);
      for (let i = 0; i < 3; i++) bg.fillRect(126, FLOOR_Y - 84 + i * 10, 52 - i * 10, 4);
      bg.fillStyle(0xff4444, 1);
      bg.fillCircle(176, FLOOR_Y - 86, 4); // alerta
      bg.fillStyle(0x1a1a1a, 1);
      bg.fillRect(146, FLOOR_Y - 46, 12, 6); // pescoço
    }

    // ── RH — ROLETA DA CULTURA: roda de segmentos + mesa/plaquinha + cartazes ───
    if (this.type === "rh") {
      const wx = LEVEL_WIDTH / 2 + 120;
      const wy = FLOOR_Y - 74;
      const wr = 46;
      bg.fillStyle(0x3a2a1a, 1);
      bg.fillRect(wx - 6, wy, 12, 74); // pedestal
      bg.fillStyle(0x0e0a08, 1);
      bg.fillCircle(wx, wy, wr + 4); // aro
      bg.fillStyle(0x2a2018, 1);
      bg.fillCircle(wx, wy, wr); // disco
      bg.lineStyle(2, 0x0e0a08, 0.8);
      const segCol = [0x66aa66, 0xccaa44, 0xaa5555, 0x5577aa, 0xaa7755, 0x888888];
      for (let i = 0; i < 6; i++) {
        const a = Phaser.Math.DegToRad(i * 60);
        bg.lineBetween(wx, wy, wx + Math.cos(a) * wr, wy + Math.sin(a) * wr);
        const am = Phaser.Math.DegToRad(i * 60 + 30);
        bg.fillStyle(segCol[i], 0.9);
        bg.fillCircle(wx + Math.cos(am) * wr * 0.6, wy + Math.sin(am) * wr * 0.6, 7);
      }
      bg.fillStyle(0x1a1410, 1);
      bg.fillCircle(wx, wy, 8); // cubo
      bg.fillStyle(0xf2c14e, 1);
      bg.fillTriangle(wx, wy - wr - 8, wx - 6, wy - wr + 2, wx + 6, wy - wr + 2); // ponteiro
      bg.fillStyle(0x3a2a1a, 1);
      bg.fillRect(100, FLOOR_Y - 34, 110, 34); // mesa
      bg.fillStyle(0xd8c8a0, 1);
      bg.fillRect(130, FLOOR_Y - 46, 50, 14); // plaquinha
      for (let i = 0; i < 3; i++) {
        const cx = 110 + i * 150;
        bg.fillStyle(0x2e2620, 1);
        bg.fillRect(cx, wallTop + 40, 70, 50); // cartaz
        bg.fillStyle(0x88bb66, 0.85);
        bg.fillTriangle(cx + 35, wallTop + 50, cx + 22, wallTop + 72, cx + 48, wallTop + 72); // seta ↑
      }
    }

    // ── FINANCEIRO — COFRE: cofre com dial, gaveteiro de arquivos, maços de VR ──
    if (this.type === "financeiro") {
      const cx = LEVEL_WIDTH - 220;
      const cy = FLOOR_Y - 130;
      bg.fillStyle(0x1a1a14, 1);
      bg.fillRect(cx, cy, 150, 130); // corpo
      bg.lineStyle(3, 0x3a3a2a, 1);
      bg.strokeRect(cx, cy, 150, 130);
      bg.fillStyle(0x22221a, 1);
      bg.fillCircle(cx + 75, cy + 65, 44); // porta
      bg.lineStyle(2, 0xc8a94a, 0.9);
      bg.strokeCircle(cx + 75, cy + 65, 44);
      bg.fillStyle(0xc8a94a, 1);
      bg.fillCircle(cx + 75, cy + 65, 10); // dial
      bg.lineStyle(2, 0x1a1a14, 1);
      for (let i = 0; i < 4; i++) {
        const a = Phaser.Math.DegToRad(i * 45);
        bg.lineBetween(cx + 75, cy + 65, cx + 75 + Math.cos(a) * 10, cy + 65 + Math.sin(a) * 10);
      }
      bg.fillStyle(0xc8a94a, 1);
      bg.fillRect(cx + 122, cy + 58, 16, 14); // maçaneta
      bg.fillStyle(0x2a2a1e, 1);
      bg.fillRect(100, FLOOR_Y - 90, 60, 90); // gaveteiro
      for (let i = 0; i < 3; i++) {
        bg.fillStyle(0x1c1c14, 1);
        bg.fillRect(106, FLOOR_Y - 84 + i * 28, 48, 22);
        bg.fillStyle(0x8a8a6a, 1);
        bg.fillRect(124, FLOOR_Y - 76 + i * 28, 12, 4); // puxador
      }
      bg.fillStyle(0x3a2a1a, 1);
      bg.fillRect(210, FLOOR_Y - 30, 90, 30); // mesa
      for (let i = 0; i < 3; i++) {
        bg.fillStyle(0x4a7a3a, 1);
        bg.fillRect(220 + i * 22, FLOOR_Y - 44, 18, 12); // maço
        bg.fillStyle(0xc8e0a0, 0.8);
        bg.fillRect(224 + i * 22, FLOOR_Y - 40, 10, 4); // faixa
      }
    }

    // Chão — cor TEMÁTICA por sala (meta.floor)
    this.platforms = this.physics.add.staticGroup();
    const floor = this.add.rectangle(LEVEL_WIDTH / 2, FLOOR_Y + 16, LEVEL_WIDTH, 32, meta.floor);
    this.physics.add.existing(floor, true);
    this.platforms.add(floor);

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

    this.drops = this.physics.add.group();
    this.physics.add.collider(this.drops, this.platforms);
    this.physics.add.overlap(this.player, this.drops, (_p, dObj) => {
      this.player.addVR(1);
      (dObj as Phaser.Physics.Arcade.Sprite).destroy();
    });

    this.fx = new SanityFx(this);
    this.hud = new Hud(this, LEVEL_WIDTH);
    this.hud.setPhaseTitle(meta.title);
    this.hud.setObjective(`${meta.hint}  •  Saia pela porta → (E)`);

    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC).on("down", () => {
      this.scene.pause();
      this.scene.launch("PauseScene", { caller: "SalaBonusScene" });
    });
    this.interactKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E);

    if (this.type === "financeiro") this.setupFinanceiro();
    else this.setupPedestal();

    // Saída SEMPRE visível (antes só aparecia após usar o pedestal → jogador
    // ficava preso achando que a sala travou). A porta da Copa fica no canto
    // direito com uma seta guiando; o pedestal é bônus opcional.
    this.spawnExit();

    const title = this.add
      .text(GAME_WIDTH / 2, 90, meta.title + "\n" + meta.hint, {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#ffd98a",
        align: "center",
        stroke: "#000000",
        strokeThickness: 3,
      })
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
  }

  // Banheiro / TI / RH: pedestal central; E aplica o efeito 1×.
  private setupPedestal() {
    this.pedestal = this.add
      .rectangle(LEVEL_WIDTH / 2, FLOOR_Y - 24, 40, 48, 0xffcc66, 0.9)
      .setStrokeStyle(2, 0xffee99);
    this.add
      .text(LEVEL_WIDTH / 2, FLOOR_Y - 70, "[ E ]", {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#ffee99",
      })
      .setOrigin(0.5);
  }

  private setupFinanceiro() {
    // VR espalhado
    for (let i = 0; i < 8; i++) {
      const x = 240 + i * 80;
      const d = this.drops.create(x, FLOOR_Y - 120, "tex-vr") as Phaser.Physics.Arcade.Sprite;
      d.setDepth(8);
      const body = d.body as Phaser.Physics.Arcade.Body;
      body.setBounce(0.3);
    }
    // Armadilhas (zonas de dano no chão)
    [360, 620].forEach((x) => {
      const trap = this.add.rectangle(x, FLOOR_Y - 4, 60, 10, 0xff3333, 0.6).setDepth(6);
      this.traps.push(trap);
    });
    // Sai a qualquer momento (porta já aberta)
    this.spawnExit();
  }

  private applyPedestalEffect() {
    if (this.used) return;
    this.used = true;
    const run = getRun(this);
    let msg = "";
    if (this.type === "banheiro") {
      this.player.sanity = Math.min(this.player.maxSanity, this.player.sanity + 40);
      msg = "+40 SANIDADE";
    } else if (this.type === "ti") {
      const wid = this.rollWeapon(run.weaponId as WeaponId | undefined);
      run.weaponId = wid;
      msg = `NOVO: ${WEAPONS[wid].name}`;
    } else if (this.type === "rh") {
      msg = this.spinRoulette(run);
    }
    Sfx.buy();
    const t = this.add
      .text(this.player.x, this.player.y - 50, msg, {
        fontFamily: "monospace",
        fontSize: "14px",
        fontStyle: "bold",
        color: "#ffe08a",
        stroke: "#000000",
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(500);
    this.tweens.add({
      targets: t,
      y: t.y - 30,
      alpha: 0,
      duration: 1100,
      onComplete: () => t.destroy(),
    });
    this.pedestal?.setFillStyle(0x445544, 0.6);
    this.spawnExit();
  }

  private rollWeapon(current?: WeaponId): WeaponId {
    const pool = (Object.entries(WEAPONS) as [WeaponId, (typeof WEAPONS)[WeaponId]][])
      .filter(([id, def]) => def.shopCost > 0 && id !== current)
      .map(([id]) => id);
    return pool[Phaser.Math.Between(0, pool.length - 1)] ?? "regua";
  }

  private spinRoulette(run: ReturnType<typeof getRun>): string {
    const roll = Phaser.Math.Between(0, 3);
    switch (roll) {
      case 0:
        this.player.addVR(20);
        return "SORTE: +20 VR";
      case 1:
        this.player.sanity = Math.min(this.player.maxSanity, this.player.sanity + 25);
        return "CLIMA OK: +25 SANIDADE";
      case 2:
        run.extraLives = (run.extraLives ?? 0) + 1;
        return "ESTABILIDADE: +1 VIDA";
      default:
        this.player.energy = Math.max(10, this.player.energy - 20);
        return "AZAR: -20 ENERGIA";
    }
  }

  private spawnExit() {
    if (this.exitDoor) return;
    const run = getRun(this);
    if (!(run.optionalRoomsCleared ?? []).includes(this.type)) {
      run.optionalRoomsCleared = [...(run.optionalRoomsCleared ?? []), this.type];
    }
    this.exitDoor = this.add.image(LEVEL_WIDTH - 60, FLOOR_Y - 30, "tex-door").setDepth(6);
    this.add
      .text(LEVEL_WIDTH - 60, FLOOR_Y - 70, "COPA →", {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#c9a36a",
      })
      .setOrigin(0.5);
    // seta piscante acima da porta p/ guiar (a sala parecia "travada")
    const arrow = this.add
      .text(LEVEL_WIDTH - 60, FLOOR_Y - 92, "▼", {
        fontFamily: "monospace",
        fontSize: "16px",
        color: "#f2c14e",
      })
      .setOrigin(0.5)
      .setDepth(6);
    this.tweens.add({
      targets: arrow,
      y: arrow.y - 8,
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }

  private persist() {
    const r = getRun(this);
    r.energy = this.player.energy;
    r.sanity = this.player.sanity;
    r.vr = this.player.vr;
  }

  private returnToCopa() {
    this.persist();
    getRun(this).cameFrom = "bonus";
    this.cameras.main.fadeOut(260, 0, 0, 0);
    this.cameras.main.once("camerafadeoutcomplete", () => this.scene.start("CopaScene"));
  }

  update(time: number, delta: number) {
    this.player.update(time, delta);
    this.player.tickPassive(time);

    const interact =
      Phaser.Input.Keyboard.JustDown(this.interactKey) || this.player.gamepadInteractJustPressed;

    // Armadilhas do Financeiro
    if (this.type === "financeiro" && !this.player.isInvulnerable(time)) {
      for (const trap of this.traps) {
        if (
          Phaser.Geom.Intersects.RectangleToRectangle(trap.getBounds(), this.player.getBounds())
        ) {
          this.player.takeDamage(10, 6, trap.x);
        }
      }
    }

    // Pedestal (banheiro/ti/rh)
    if (this.pedestal && !this.used && interact) {
      if (
        Phaser.Math.Distance.Between(
          this.player.x,
          this.player.y,
          this.pedestal.x,
          this.pedestal.y,
        ) < 60
      ) {
        this.applyPedestalEffect();
      }
    }

    // Saída
    if (this.exitDoor && interact) {
      if (
        Phaser.Math.Distance.Between(
          this.player.x,
          this.player.y,
          this.exitDoor.x,
          this.exitDoor.y,
        ) < 48
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
      interactHint:
        this.exitDoor &&
        Phaser.Math.Distance.Between(
          this.player.x,
          this.player.y,
          this.exitDoor.x,
          this.exitDoor.y,
        ) < 48
          ? "[ E ]  Voltar à Copa"
          : undefined,
      burnoutMods: this.player.getBurnoutMods(),
      tremoring: this.player.isTremoring(time),
      tremorWarnMs: this.player.getTremorWarnMs(time),
    });
  }
}
