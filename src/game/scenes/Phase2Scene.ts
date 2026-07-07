import Phaser from "phaser";
import { BasePhaseScene, FLOOR_Y, LEVEL_WIDTH } from "./BasePhaseScene";
import { CoordenadorDeSinergia } from "../entities/Enemies";
import {
  TelemarketerZumbi,
  ImpressoraAssombrada,
  GuardiaoDoCafe,
  NuvemBoardSentinela,
  ReuniaoCorportiva,
} from "../entities/PhaseEnemies";

export class Phase2Scene extends BasePhaseScene {
  private telemarketers!: import("phaser").Physics.Arcade.Group;
  private impressoras!: import("phaser").Physics.Arcade.Group;
  private guardioes!: import("phaser").Physics.Arcade.Group;
  private nuvens!: import("phaser").Physics.Arcade.Group;
  private reunioes!: import("phaser").Physics.Arcade.Group;
  private coordenadores!: import("phaser").Physics.Arcade.Group;

  constructor() {
    super("Phase2Scene");
  }

  preload() {
    this.load.image("bg-atendimento", "/assets/bg-atendimento.png");
  }

  protected getBgKey() {
    return "bg-atendimento";
  }
  protected getPhaseNumber(): 2 {
    return 2;
  }
  protected getPhaseTitle() {
    return "FASE 2 — REUNIAO INFINITA";
  }
  protected getInitialObjective() {
    return "Derrote o Coordenador e avance";
  }

  protected getPlatformLayout(): Array<[number, number, number]> {
    return [
      [200, FLOOR_Y - 30, 5],
      [460, FLOOR_Y - 72, 4],
      [700, FLOOR_Y - 30, 5],
      [1000, FLOOR_Y - 72, 6],
      [1350, FLOOR_Y - 30, 5],
      [1620, FLOOR_Y - 72, 4],
    ];
  }

  protected getDoorConfig() {
    return {
      x: LEVEL_WIDTH - 60,
      tint: 0x555555,
      label: "COPA\n[BLOQUEADO]",
      cameFrom: "phase2",
      destScene: "CopaScene",
      nextScene: "Phase3Scene",
      nearLabel: "Entrar na Copa",
    };
  }

  protected getBossName() {
    return "Coordenador de Sinergia";
  }

  protected setupEnemiesAndGroups() {
    this.telemarketers = this.physics.add.group({ runChildUpdate: false });
    this.impressoras = this.physics.add.group({ runChildUpdate: false });
    this.guardioes = this.physics.add.group({ runChildUpdate: false });
    this.nuvens = this.physics.add.group({ runChildUpdate: false });
    this.reunioes = this.physics.add.group({ runChildUpdate: false });
    this.coordenadores = this.physics.add.group({ runChildUpdate: false });

    // Encontros por seed: mesma CONTAGEM, posições/densidade variam por run.
    this.pickPositions([280, 380, 480, 580, 680, 780, 880], 5).forEach((x) => {
      const e = new TelemarketerZumbi(this, x, FLOOR_Y - 60);
      e.target = this.player;
      e.onFire = (fx, fy, tx, ty) => this.spawnEnemyProjectile(fx, fy, tx, ty, 10);
      this.telemarketers.add(e);
    });

    [1050, 1250].forEach((x) => {
      const e = new ImpressoraAssombrada(this, x, FLOOR_Y - 60);
      e.onFire = (fx, fy, dir) => {
        const angle = dir === 0 ? 0 : dir < 0 ? -0.3 : 0.3;
        const tx = fx + Math.cos(angle) * 200;
        const ty = fy + Math.sin(angle) * 200;
        this.spawnEnemyProjectile(fx, fy, tx, ty, 8);
      };
      this.impressoras.add(e);
    });

    const guardiao = new GuardiaoDoCafe(this, 1550, FLOOR_Y - 60);
    guardiao.target = this.player;
    this.guardioes.add(guardiao);

    [620, 1380].forEach((x) => {
      const e = new NuvemBoardSentinela(this, x, FLOOR_Y - 200);
      e.onFire = (fx, fy) => this.spawnEnemyProjectile(fx, fy, fx, fy + 300, 12, 0xff4444, 200);
      this.nuvens.add(e);
    });

    this.pickPositions([900, 1030, 1130, 1240, 1340], 3).forEach((x) => {
      const r = new ReuniaoCorportiva(this, x, FLOOR_Y - 60);
      r.target = this.player;
      r.onAura = () => {
        if (!this.player.isInvulnerable(this.time.now)) {
          this.player.applyFreeze(600);
          this.player.takeDamage(8, 0);
        }
      };
      this.reunioes.add(r);
    });

    // Boss — stored in this.boss, NOT in coordenadores group (prevents double-damage)
    const boss = new CoordenadorDeSinergia(this, 1800, FLOOR_Y - 60);
    boss.target = this.player;
    // Rebalance (playtest): 80 HP deixava o boss 5x mais fraco que o lixo da
    // fase (Impressora 400). Boss deve ser a maior luta da própria fase.
    boss.hp = 380;
    this.boss = boss;

    this.enemyGroups.push(
      { group: this.telemarketers, vrDrop: 2 },
      { group: this.impressoras, vrDrop: 8 },
      { group: this.guardioes, vrDrop: 4 },
      { group: this.nuvens, vrDrop: 3, aerial: true },
      { group: this.reunioes, vrDrop: 5 },
      { group: this.coordenadores, vrDrop: 4 },
    );
  }

  // Especial telegrafado do boss (#23), dirigido pela cena (a classe de inimigo
  // não tem repertório próprio). "REUNIÃO DE ALINHAMENTO": a cada ~7s com o boss
  // engajado, telegrafa uma onda de choque ao redor do Coordenador; após 600ms
  // puxa e fere quem estiver no raio (+freeze).
  private nextSpecialAt = 0;

  protected onPhaseUpdate(time: number, _delta: number) {
    const boss = this.boss;
    if (!boss || !boss.active) return;
    const dist = Math.abs(this.player.x - boss.x);
    if (dist > 520) return; // só engajado
    if (this.nextSpecialAt === 0) this.nextSpecialAt = time + 4000;
    if (time < this.nextSpecialAt) return;
    this.nextSpecialAt = time + 7000;
    this.coordenadorSpecial(boss.x, boss.y);
  }

  private coordenadorSpecial(bx: number, by: number) {
    const range = 200;
    const warn = this.add.circle(bx, by, range, 0xffaa33, 0.16).setDepth(180);
    const ring = this.add.circle(bx, by, 20, 0x000000, 0).setStrokeStyle(3, 0xffcc44).setDepth(181);
    this.tweens.add({ targets: ring, radius: range, duration: 560 });
    const label = this.add
      .text(bx, by - 70, "REUNIÃO DE ALINHAMENTO!", {
        fontFamily: "monospace",
        fontSize: "12px",
        fontStyle: "bold",
        color: "#ffcc44",
        stroke: "#000000",
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(400);
    this.time.delayedCall(600, () => {
      warn.destroy();
      ring.destroy();
      label.destroy();
      this.cameras.main.shake(200, 0.012);
      const shock = this.add.circle(bx, by, range, 0xaa66ff, 0.4).setDepth(180);
      this.tweens.add({
        targets: shock,
        alpha: 0,
        duration: 400,
        onComplete: () => shock.destroy(),
      });
      if (
        !this.player.isInvulnerable(this.time.now) &&
        Phaser.Math.Distance.Between(this.player.x, this.player.y, bx, by) < range
      ) {
        this.player.takeDamage(16, 12, bx);
        this.player.applyFreeze(700);
      }
    });
  }
}
