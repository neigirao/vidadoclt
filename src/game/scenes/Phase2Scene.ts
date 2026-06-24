import { BasePhaseScene, FLOOR_Y, LEVEL_WIDTH } from "./BasePhaseScene";
import { CoordenadorDeSinergia } from "../entities/Enemies";
import {
  TelemarketerZumbi,
  ImpressoraAssombrada,
  GuardiaoDoCafe,
  NuvemBoardSentinela,
} from "../entities/PhaseEnemies";

export class Phase2Scene extends BasePhaseScene {
  private telemarketers!: import("phaser").Physics.Arcade.Group;
  private impressoras!: import("phaser").Physics.Arcade.Group;
  private guardioes!: import("phaser").Physics.Arcade.Group;
  private nuvens!: import("phaser").Physics.Arcade.Group;
  private coordenadores!: import("phaser").Physics.Arcade.Group;

  constructor() {
    super("Phase2Scene");
  }

  preload() {
    this.load.image("bg-atendimento", "/assets/bg-atendimento.png");
  }

  protected getBgKey() { return "bg-atendimento"; }
  protected getPhaseTitle() { return "FASE 2 — REUNIAO INFINITA"; }
  protected getInitialObjective() { return "Derrote o Coordenador e avance"; }

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

  protected getBossName() { return "Coordenador de Sinergia"; }

  protected setupEnemiesAndGroups() {
    this.telemarketers  = this.physics.add.group({ runChildUpdate: false });
    this.impressoras    = this.physics.add.group({ runChildUpdate: false });
    this.guardioes      = this.physics.add.group({ runChildUpdate: false });
    this.nuvens         = this.physics.add.group({ runChildUpdate: false });
    this.coordenadores  = this.physics.add.group({ runChildUpdate: false });

    [300, 550, 800, 1100, 1400].forEach((x) => {
      const e = new TelemarketerZumbi(this, x, FLOOR_Y - 60);
      e.target = this.player;
      e.onFire = (fx, fy, tx, ty) => this.spawnEnemyProjectile(fx, fy, tx, ty, 10);
      this.telemarketers.add(e);
    });

    [600, 1200].forEach((x) => {
      const e = new ImpressoraAssombrada(this, x, FLOOR_Y - 60);
      e.onFire = (fx, fy, dir) => {
        const angle = dir === 0 ? 0 : (dir < 0 ? -0.3 : 0.3);
        const tx = fx + Math.cos(angle) * 200;
        const ty = fy + Math.sin(angle) * 200;
        this.spawnEnemyProjectile(fx, fy, tx, ty, 8);
      };
      this.impressoras.add(e);
    });

    const guardiao = new GuardiaoDoCafe(this, 900, FLOOR_Y - 60);
    guardiao.target = this.player;
    this.guardioes.add(guardiao);

    [400, 1500].forEach((x) => {
      const e = new NuvemBoardSentinela(this, x, FLOOR_Y - 200);
      e.onFire = (fx, fy) => this.spawnEnemyProjectile(fx, fy, fx, fy + 300, 12, 0xff4444, 200);
      this.nuvens.add(e);
    });

    // Boss — stored in this.boss, NOT in coordenadores group (prevents double-damage)
    const boss = new CoordenadorDeSinergia(this, 1800, FLOOR_Y - 60);
    boss.target = this.player;
    boss.hp = 80;
    this.boss = boss as any;

    this.enemyGroups.push(
      { group: this.telemarketers, vrDrop: 2 },
      { group: this.impressoras,   vrDrop: 8 },
      { group: this.guardioes,     vrDrop: 4 },
      { group: this.nuvens,        vrDrop: 3, aerial: true },
      { group: this.coordenadores, vrDrop: 4 },
    );
  }
}
