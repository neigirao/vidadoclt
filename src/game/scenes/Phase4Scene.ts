import { bgUrl } from "../systems/BgOverrides";
import Phaser from "phaser";
import { BasePhaseScene, FLOOR_Y, LEVEL_WIDTH } from "./BasePhaseScene";
import { BossPresence } from "../systems/BossPresence";
import { ScrumMasterCaotico } from "../entities/Enemies";
import { GameEnemy } from "../entities/types";
import {
  CaboDeRede,
  TiSuporte,
  DroneDeVigilancia,
  SegurancaCorporativa,
  ImpressoraFantasma,
  EvangelistaAvancado,
} from "../entities/PhaseEnemies";

export class Phase4Scene extends BasePhaseScene {
  private cabos!: Phaser.Physics.Arcade.Group;
  private tiSuportes!: Phaser.Physics.Arcade.Group;
  private drones!: Phaser.Physics.Arcade.Group;
  private segurancas!: Phaser.Physics.Arcade.Group;
  private impressorasF!: Phaser.Physics.Arcade.Group;
  private evangelistasA!: Phaser.Physics.Arcade.Group;

  constructor() {
    super("Phase4Scene");
  }

  preload() {
    this.load.image("bg-tecnologia", bgUrl("bg-tecnologia"));
  }

  protected getBgKey() {
    return "bg-tecnologia";
  }
  protected getPhaseNumber(): 4 {
    return 4;
  }
  protected getPhaseTitle() {
    return "FASE 4 — TI / SERVIDORES";
  }
  protected getInitialObjective() {
    return "Derrote o Scrum Master e avance";
  }

  protected getPlatSurface() {
    return { surf: "tex-rack", body: "tex-rack-body" };
  }

  // Identidade "Torres de Servidor": pares empilhados (degrau baixo + topo alto)
  // separados por vãos largos — pilares de rack no data center. O firewall do
  // Scrum ("Sprint Review") corta o chão entre as torres.
  protected getPlatformLayout(): Array<[number, number, number]> {
    return [
      [220, FLOOR_Y - 42, 3],
      [360, FLOOR_Y - 82, 3],
      [720, FLOOR_Y - 42, 3],
      [860, FLOOR_Y - 82, 3],
      [1160, FLOOR_Y - 42, 3],
      [1300, FLOOR_Y - 82, 3],
      [1600, FLOOR_Y - 48, 4],
    ];
  }

  protected getDoorConfig() {
    return {
      x: LEVEL_WIDTH - 60,
      tint: 0x8a8a8a,
      label: "COPA\n[BLOQUEADO]",
      cameFrom: "phase4",
      destScene: "CopaScene",
      nextScene: "Phase5Scene",
      nearLabel: "Entrar na Copa",
    };
  }

  protected getBossName() {
    return "Scrum Master Caótico";
  }

  protected setupEnemiesAndGroups() {
    this.cabos = this.physics.add.group({ runChildUpdate: false });
    this.tiSuportes = this.physics.add.group({ runChildUpdate: false });
    this.drones = this.physics.add.group({ runChildUpdate: false });
    this.segurancas = this.physics.add.group({ runChildUpdate: false });
    this.impressorasF = this.physics.add.group({ runChildUpdate: false });
    this.evangelistasA = this.physics.add.group({ runChildUpdate: false });

    // Encontros por seed: contagem fixa, posições variam por run.
    this.pickPositions([300, 400, 500, 600], 3).forEach((x) => {
      const e = new CaboDeRede(this, x, FLOOR_Y - 60);
      e.target = this.player;
      e.onCable = () => {
        if (!this.player.isInvulnerable(this.time.now)) {
          this.player.applyFreeze(700);
          this.player.takeDamage(8, 5, e.x);
        }
      };
      this.cabos.add(e);
    });

    this.pickPositions([700, 820, 940, 1060], 3).forEach((x) => {
      const e = new TiSuporte(this, x, FLOOR_Y - 60);
      e.target = this.player;
      e.onSpawnError = (ex, ey) => {
        const err = this.add
          .text(ex, ey - 20, "ERRO 404", {
            fontFamily: "monospace",
            fontSize: "11px",
            color: "#ff4444",
            stroke: "#000000",
            strokeThickness: 2,
          })
          .setOrigin(0.5)
          .setDepth(400);
        this.tweens.add({
          targets: err,
          y: err.y - 30,
          alpha: 0,
          duration: 800,
          onComplete: () => err.destroy(),
        });
        if (
          !this.player.isInvulnerable(this.time.now) &&
          Phaser.Math.Distance.Between(this.player.x, this.player.y, ex, ey) < 60
        ) {
          this.player.takeDamage(10, 4);
        }
      };
      this.tiSuportes.add(e);
    });

    [500, 1000, 1450].forEach((x) => {
      const drone = new DroneDeVigilancia(this, x, FLOOR_Y - 180);
      drone.target = this.player;
      drone.onBomb = (bx, by) => {
        const bomb = this.enemyProjectiles.create(
          bx,
          by,
          "tex-inkproj",
        ) as Phaser.Physics.Arcade.Sprite;
        const bbody = bomb.body as Phaser.Physics.Arcade.Body;
        bbody.setVelocity(0, 200);
        bomb.setData("damage", 14);
        bomb.setTint(0xffaa00);
        this.time.delayedCall(2000, () => {
          if (bomb.active) bomb.destroy();
        });
      };
      this.drones.add(drone);
    });

    [1280, 1430].forEach((x) => {
      const seg = new SegurancaCorporativa(this, x, FLOOR_Y - 60);
      seg.target = this.player;
      seg.onTase = () => {
        if (!this.player.isInvulnerable(this.time.now)) {
          this.player.applyFreeze(1200);
          this.player.takeDamage(6, 8, seg.x);
        }
      };
      this.segurancas.add(seg);
    });

    [900, 1140].forEach((x) => {
      const imf = new ImpressoraFantasma(this, x, FLOOR_Y - 60);
      imf.target = this.player;
      imf.onFire = (fx, fy, dir) =>
        this.spawnEnemyProjectile(fx, fy, fx + dir * 200, fy, 14, 0x8822cc, 230);
      this.impressorasF.add(imf);
    });

    [1520, 1640].forEach((x) => {
      const ev = new EvangelistaAvancado(this, x, FLOOR_Y - 60);
      ev.target = this.player;
      ev.onFire = (fx, fy, tx, ty) => this.spawnEnemyProjectile(fx, fy, tx, ty, 10, 0xff6600, 190);
      ev.onHeal = () => {
        [
          this.cabos,
          this.tiSuportes,
          this.segurancas,
          this.impressorasF,
          this.evangelistasA,
        ].forEach((g) =>
          g.getChildren().forEach((c) => {
            const en = c as GameEnemy;
            if (en.active && en.hp !== undefined) en.hp = Math.min(en.hp + 30, en.hp + 30);
          }),
        );
      };
      this.evangelistasA.add(ev);
    });

    // Boss — stored in this.boss, NOT in scrums group (prevents double-damage)
    const boss = new ScrumMasterCaotico(this, 1800, FLOOR_Y - 60, true);
    boss.target = this.player;
    // Rebalance v2 (rampa suave): trash da Fase 4 caiu p/ 60-130; boss desce junto.
    boss.hp = 280;
    boss.isBoss = true;
    boss.onShout = (bx, by) => {
      if (
        !this.player.isInvulnerable(this.time.now) &&
        Phaser.Math.Distance.Between(this.player.x, this.player.y, bx, by) < 160
      ) {
        this.player.takeDamage(12, 10, bx);
        this.player.applyFreeze(600);
      }
    };
    boss.onRetrospectiva = (bx, by) => {
      const aoeW = 300;
      this.cameras.main.shake(220, 0.014);
      const shockwave = this.add.rectangle(bx, FLOOR_Y + 4, aoeW, 18, 0xaa44ff, 0.75);
      this.tweens.add({
        targets: shockwave,
        scaleX: 1.4,
        alpha: 0,
        duration: 550,
        onComplete: () => shockwave.destroy(),
      });
      if (
        !this.player.isInvulnerable(this.time.now) &&
        Math.abs(this.player.x - bx) < aoeW / 2 &&
        this.player.y > by - 80
      ) {
        this.player.takeDamage(20, 9);
        this.player.applyFreeze(900);
      }
    };
    this.boss = boss;
    this.bossPresence = new BossPresence(this, boss, 0xaa66ff);

    this.enemyGroups.push(
      { group: this.cabos, vrDrop: 2 },
      { group: this.tiSuportes, vrDrop: 3 },
      { group: this.drones, vrDrop: 3, aerial: true },
      { group: this.segurancas, vrDrop: 4 },
      { group: this.impressorasF, vrDrop: 12 },
      { group: this.evangelistasA, vrDrop: 6 },
    );
  }

  private nextSprintAt = 0;

  // "SPRINT REVIEW": a cada ~8s com o Scrum engajado, sobem 2 grades de firewall
  // que dividem a arena. Telegrafadas (aviso ciano) antes de fechar; ficar na
  // coluna quando ela sela → dano + freeze (deploy travado). Personalidade de TI:
  // o firewall que separa você do objetivo bem na hora errada.
  private sprintReview(time: number) {
    const boss = this.boss;
    if (!boss || !boss.active) return;
    if (Math.abs(this.player.x - boss.x) > 560) return;
    if (this.nextSprintAt === 0) this.nextSprintAt = time + 5000;
    if (time < this.nextSprintAt) return;
    // Enrage: cadência aperta na 2ª metade (8s → ~5s) — a arena fecha mais vezes.
    this.nextSprintAt = time + (this.bossEnraged ? 5000 : 8000);

    // 2 grades entre o player e o boss (posições fixas relativas à arena)
    // Enrage (assinatura F4): o Sprint Review fecha MAIS a arena — 3 grades de
    // firewall em vez de 2, apertando os corredores. Gear-shift na 2ª metade.
    const colXs = this.bossEnraged
      ? [boss.x - 400, boss.x - 260, boss.x - 120]
      : [boss.x - 360, boss.x - 180];
    const cols = colXs.map((x) => Phaser.Math.Clamp(x, 200, LEVEL_WIDTH - 200));
    const label = this.add
      .text(boss.x, boss.y - 74, "SPRINT REVIEW!", {
        fontFamily: "monospace",
        fontSize: "12px",
        fontStyle: "bold",
        color: "#33ddff",
        stroke: "#000000",
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(400);
    this.time.delayedCall(900, () => label.destroy());

    cols.forEach((cx) => {
      const h = 190;
      const warn = this.add.rectangle(cx, FLOOR_Y - h / 2, 14, h, 0x33ddff, 0.18).setDepth(180);
      this.time.delayedCall(620, () => {
        warn.destroy();
        // grade "firewall" fecha por 900ms
        const wall = this.add.rectangle(cx, FLOOR_Y - h / 2, 14, h, 0x33ddff, 0.55).setDepth(200);
        const grid = this.add
          .text(cx, FLOOR_Y - h / 2, "▦\n▦\n▦\n▦", {
            fontFamily: "monospace",
            fontSize: "13px",
            color: "#66eeff",
          })
          .setOrigin(0.5)
          .setDepth(201);
        const sealedUntil = this.time.now + 900;
        const dmgEvt = this.time.addEvent({
          delay: 60,
          loop: true,
          callback: () => {
            if (this.time.now >= sealedUntil) {
              dmgEvt.remove();
              this.tweens.add({
                targets: [wall, grid],
                alpha: 0,
                duration: 200,
                onComplete: () => {
                  wall.destroy();
                  grid.destroy();
                },
              });
              return;
            }
            if (!this.player.isInvulnerable(this.time.now) && Math.abs(this.player.x - cx) < 18) {
              this.player.takeDamage(12, this.player.x < cx ? -10 : 10, cx);
              this.player.applyFreeze(400);
            }
          },
        });
      });
    });
  }

  protected onPhaseUpdate(time: number, _delta: number) {
    this.sprintReview(time);
  }

  /** Virada aos 35% HP: fecha a arena com um Sprint Review imediato. */
  protected override onBossEnrage() {
    this.nextSprintAt = this.time.now; // força disparo no próximo tick
  }

  protected onEnemyKilledByMelee(e: GameEnemy) {
    this.tweens.add({
      targets: e,
      scaleX: 1.6,
      scaleY: 0.2,
      alpha: 0,
      duration: 120,
      onComplete: () => e.destroy(),
    });
    e.setActive(false);
  }

  protected onEnemyKilledByProjectile(e: GameEnemy) {
    this.tweens.add({
      targets: e,
      scaleX: 1.6,
      scaleY: 0.2,
      alpha: 0,
      duration: 120,
      onComplete: () => e.destroy(),
    });
    e.setActive(false);
  }
}
