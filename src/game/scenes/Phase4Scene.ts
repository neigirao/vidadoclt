import Phaser from "phaser";
import { BasePhaseScene, FLOOR_Y, LEVEL_WIDTH } from "./BasePhaseScene";
import { ScrumMasterCaotico } from "../entities/Enemies";
import {
  CaboDeRede,
  TiSuporte,
  DroneDeVigilancia,
  SegurancaCorporativa,
} from "../entities/PhaseEnemies";

export class Phase4Scene extends BasePhaseScene {
  private cabos!: Phaser.Physics.Arcade.Group;
  private tiSuportes!: Phaser.Physics.Arcade.Group;
  private drones!: Phaser.Physics.Arcade.Group;
  private segurancas!: Phaser.Physics.Arcade.Group;

  constructor() {
    super("Phase4Scene");
  }

  preload() {
    this.load.image("bg-tecnologia", "/assets/bg-tecnologia.png");
  }

  protected getBgKey() { return "bg-tecnologia"; }
  protected getPhaseNumber(): 4 { return 4; }
  protected getPhaseTitle() { return "FASE 4 — TI / SERVIDORES"; }
  protected getInitialObjective() { return "Derrote o Scrum Master e avance"; }

  protected getPlatformLayout(): Array<[number, number, number]> {
    return [
      [180, FLOOR_Y - 30, 5],
      [450, FLOOR_Y - 72, 4],
      [750, FLOOR_Y - 30, 6],
      [1080, FLOOR_Y - 72, 5],
      [1380, FLOOR_Y - 30, 6],
      [1660, FLOOR_Y - 72, 4],
    ];
  }

  protected getDoorConfig() {
    return {
      x: LEVEL_WIDTH - 60,
      tint: 0x555555,
      label: "COPA\n[BLOQUEADO]",
      cameFrom: "phase4",
      destScene: "CopaScene",
      nextScene: "Phase5Scene",
      nearLabel: "Entrar na Copa",
    };
  }

  protected getBossName() { return "Scrum Master Caótico"; }

  protected setupEnemiesAndGroups() {
    this.cabos      = this.physics.add.group({ runChildUpdate: false });
    this.tiSuportes = this.physics.add.group({ runChildUpdate: false });
    this.drones     = this.physics.add.group({ runChildUpdate: false });
    this.segurancas = this.physics.add.group({ runChildUpdate: false });

    [280, 700, 1200].forEach((x) => {
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

    [450, 900, 1450].forEach((x) => {
      const e = new TiSuporte(this, x, FLOOR_Y - 60);
      e.target = this.player;
      e.onSpawnError = (ex, ey) => {
        const err = this.add.text(ex, ey - 20, "ERRO 404", {
          fontFamily: "monospace", fontSize: "11px", color: "#ff4444",
          stroke: "#000000", strokeThickness: 2,
        }).setOrigin(0.5).setDepth(400);
        this.tweens.add({ targets: err, y: err.y - 30, alpha: 0, duration: 800, onComplete: () => err.destroy() });
        if (!this.player.isInvulnerable(this.time.now) &&
          Phaser.Math.Distance.Between(this.player.x, this.player.y, ex, ey) < 60) {
          this.player.takeDamage(10, 4);
        }
      };
      this.tiSuportes.add(e);
    });

    [340, 1000, 1600].forEach((x) => {
      const drone = new DroneDeVigilancia(this, x, FLOOR_Y - 180);
      drone.target = this.player;
      drone.onBomb = (bx, by) => {
        const bomb = this.enemyProjectiles.create(bx, by, "tex-inkproj") as Phaser.Physics.Arcade.Sprite;
        const bbody = bomb.body as Phaser.Physics.Arcade.Body;
        bbody.setVelocity(0, 200);
        bomb.setData("damage", 14);
        bomb.setTint(0xffaa00);
        this.time.delayedCall(2000, () => { if (bomb.active) bomb.destroy(); });
      };
      this.drones.add(drone);
    });

    [600, 1350].forEach((x) => {
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

    // Boss — stored in this.boss, NOT in scrums group (prevents double-damage)
    const boss = new ScrumMasterCaotico(this, 1800, FLOOR_Y - 60);
    boss.target = this.player;
    boss.hp = 120;
    boss.isBoss = true;
    boss.onShout = (bx, by) => {
      if (!this.player.isInvulnerable(this.time.now) &&
        Phaser.Math.Distance.Between(this.player.x, this.player.y, bx, by) < 160) {
        this.player.takeDamage(12, 10, bx);
        this.player.applyFreeze(600);
      }
    };
    boss.onRetrospectiva = (bx, by) => {
      const aoeW = 300;
      this.cameras.main.shake(220, 0.014);
      const shockwave = this.add.rectangle(bx, FLOOR_Y + 4, aoeW, 18, 0xaa44ff, 0.75);
      this.tweens.add({ targets: shockwave, scaleX: 1.4, alpha: 0, duration: 550, onComplete: () => shockwave.destroy() });
      if (!this.player.isInvulnerable(this.time.now) &&
        Math.abs(this.player.x - bx) < aoeW / 2 &&
        this.player.y > by - 80) {
        this.player.takeDamage(20, 9);
        this.player.applyFreeze(900);
      }
    };
    this.boss = boss as any;

    this.enemyGroups.push(
      { group: this.cabos,      vrDrop: 2 },
      { group: this.tiSuportes, vrDrop: 3 },
      { group: this.drones,     vrDrop: 3, aerial: true },
      { group: this.segurancas, vrDrop: 4 },
    );
  }

  protected onEnemyKilledByMelee(e: any) {
    this.tweens.add({
      targets: e,
      scaleX: 1.6, scaleY: 0.2, alpha: 0,
      duration: 120,
      onComplete: () => e.destroy(),
    });
    e.setActive(false);
  }

  protected onEnemyKilledByProjectile(e: any) {
    this.tweens.add({
      targets: e,
      scaleX: 1.6, scaleY: 0.2, alpha: 0,
      duration: 120,
      onComplete: () => e.destroy(),
    });
    e.setActive(false);
  }
}
