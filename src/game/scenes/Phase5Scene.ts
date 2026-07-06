import Phaser from "phaser";
import { BasePhaseScene, FLOOR_Y, LEVEL_WIDTH } from "./BasePhaseScene";
import { getRun, savePersisted } from "../systems/PlayerState";
import { GAME_WIDTH, GAME_HEIGHT } from "../constants";
import { GameEnemy } from "../entities/types";
import {
  CarimbadorAutomatico,
  ArquivoAmbulante,
  BateriaSocial,
  ImpressoraNecromorfa,
  EvangelistaMegaCorp,
} from "../entities/PhaseEnemies";

export class Phase5Scene extends BasePhaseScene {
  private carimbadores!: Phaser.Physics.Arcade.Group;
  private arquivos!: Phaser.Physics.Arcade.Group;
  private baterias!: Phaser.Physics.Arcade.Group;
  private impressorasN!: Phaser.Physics.Arcade.Group;
  private evangelistasM!: Phaser.Physics.Arcade.Group;
  private allDefeated = false;
  private enemyCount = 8;

  constructor() {
    super("Phase5Scene");
  }

  preload() {
    this.load.image("bg-diretoria", "/assets/bg-diretoria.png");
  }

  protected getBgKey() {
    return "bg-diretoria";
  }
  protected getPhaseNumber(): 5 {
    return 5;
  }
  protected getPhaseTitle() {
    return "FASE 5 — DIRETORIA";
  }
  protected getInitialObjective() {
    return `Derrote todos os inimigos (${this.enemyCount} restantes)`;
  }

  protected getPlatformLayout(): Array<[number, number, number]> {
    return [
      [200, FLOOR_Y - 30, 5],
      [520, FLOOR_Y - 72, 4],
      [820, FLOOR_Y - 30, 6],
      [1120, FLOOR_Y - 72, 5],
      [1400, FLOOR_Y - 30, 6],
      [1700, FLOOR_Y - 72, 4],
    ];
  }

  protected getDoorConfig() {
    return {
      x: LEVEL_WIDTH - 60,
      tint: 0xaa4400,
      label: "DIRETOR\n[BLOQUEADO]",
      cameFrom: "phase5",
      destScene: "CeoScene",
      nextScene: undefined,
      nearLabel: "Entrar na Diretoria",
    };
  }

  protected getBossName() {
    return "";
  }

  protected setupEnemiesAndGroups() {
    this.carimbadores = this.physics.add.group({ runChildUpdate: false });
    this.arquivos = this.physics.add.group({ runChildUpdate: false });
    this.baterias = this.physics.add.group({ runChildUpdate: false });
    this.impressorasN = this.physics.add.group({ runChildUpdate: false });
    this.evangelistasM = this.physics.add.group({ runChildUpdate: false });

    this.enemyCount = 0;

    // Encontros por seed: contagem fixa, posições variam por run.
    this.pickPositions([300, 400, 500, 600], 3).forEach((x) => {
      const e = new CarimbadorAutomatico(this, x, FLOOR_Y - 60);
      e.target = this.player;
      e.onStamp = (sx, sy) => {
        const stamp = this.add
          .text(sx, sy - 10, "NEGADO!", {
            fontFamily: "monospace",
            fontSize: "13px",
            fontStyle: "bold",
            color: "#ff2222",
            stroke: "#000000",
            strokeThickness: 3,
          })
          .setOrigin(0.5)
          .setDepth(400);
        this.tweens.add({
          targets: stamp,
          scaleX: 1.8,
          scaleY: 1.8,
          alpha: 0,
          duration: 700,
          onComplete: () => stamp.destroy(),
        });
        if (
          !this.player.isInvulnerable(this.time.now) &&
          Phaser.Math.Distance.Between(this.player.x, this.player.y, sx, sy) < 50
        ) {
          this.player.takeDamage(12, 8);
        }
      };
      this.carimbadores.add(e);
      this.enemyCount++;
    });

    [760, 960].forEach((x) => {
      const e = new ArquivoAmbulante(this, x, FLOOR_Y - 60);
      e.target = this.player;
      this.arquivos.add(e);
      this.enemyCount++;
    });

    this.pickPositions([600, 760, 1000, 1240, 1380], 3).forEach((x) => {
      const e = new BateriaSocial(this, x, FLOOR_Y - 60);
      e.target = this.player;
      e.onDeath = () => {
        // "Bateria Social": ao descarregar (morrer), recarrega os colegas ao
        // redor — cura 30 HP em cada inimigo no raio da aura. Vale matá-la longe
        // do grupo (ou matar o grupo antes). Ring verde de feedback.
        const range = e.getAuraRange();
        const ring = this.add.graphics().setDepth(400);
        ring.lineStyle(2, 0x44ff88, 0.85);
        ring.strokeCircle(e.x, e.y, range);
        this.tweens.add({
          targets: ring,
          alpha: 0,
          scaleX: 1.25,
          scaleY: 1.25,
          duration: 520,
          onComplete: () => ring.destroy(),
        });
        const nearby = [
          ...this.carimbadores.getChildren(),
          ...this.arquivos.getChildren(),
          ...this.baterias.getChildren(),
        ] as GameEnemy[];
        nearby.forEach((en) => {
          const spr = en as unknown as Phaser.Physics.Arcade.Sprite;
          if (spr === (e as unknown as Phaser.Physics.Arcade.Sprite)) return;
          if (!en.active || en.hp === undefined) return;
          if (Phaser.Math.Distance.Between(en.x, en.y, e.x, e.y) < range) {
            en.hp += 30;
            spr.setTint(0x44ff88);
            this.time.delayedCall(300, () => {
              if (spr.active) spr.clearTint();
            });
          }
        });
      };
      this.baterias.add(e);
      this.enemyCount++;
    });

    [1200, 1450].forEach((x) => {
      const imn = new ImpressoraNecromorfa(this, x, FLOOR_Y - 60);
      imn.target = this.player;
      imn.onFire = (fx, fy, dir) =>
        this.spawnEnemyProjectile(fx, fy, fx + dir * 200, fy, 18, 0x440022, 240);
      imn.onDeath = () => {
        // ao morrer, cospe 3 projéteis
        for (let i = -1; i <= 1; i++) {
          this.spawnEnemyProjectile(
            imn.x,
            imn.y - 10,
            imn.x + i * 120,
            imn.y - 80,
            12,
            0x440022,
            200,
          );
        }
      };
      this.impressorasN.add(imn);
      this.enemyCount++;
    });

    // 1600 (era 1660) fica >140px do spawn vindo da Copa (x≈1800) → spawn-seguro.
    [1480, 1600].forEach((x) => {
      const ev = new EvangelistaMegaCorp(this, x, FLOOR_Y - 60);
      ev.target = this.player;
      ev.onFire = (fx, fy, tx, ty) => this.spawnEnemyProjectile(fx, fy, tx, ty, 12, 0xff6600, 200);
      ev.onHeal = () => {
        [
          this.carimbadores,
          this.arquivos,
          this.baterias,
          this.impressorasN,
          this.evangelistasM,
        ].forEach((g) =>
          g.getChildren().forEach((c) => {
            const en = c as GameEnemy;
            if (en.active && en.hp !== undefined) en.hp = Math.min(en.hp + 50, en.hp + 50);
          }),
        );
      };
      this.evangelistasM.add(ev);
      this.enemyCount++;
    });

    // No boss for Phase5
    this.boss = undefined;

    this.enemyGroups.push(
      { group: this.carimbadores, vrDrop: 4 },
      { group: this.arquivos, vrDrop: 15 },
      { group: this.baterias, vrDrop: 4 },
      { group: this.impressorasN, vrDrop: 16 },
      { group: this.evangelistasM, vrDrop: 9 },
    );

    // Update objective now that we know enemyCount
    this.hud.setObjective(`Derrote todos os inimigos (${this.enemyCount} restantes)`);
  }

  protected onEnemyKilledByMelee(_e: GameEnemy) {
    this.checkAllDefeated();
  }

  protected onEnemyKilledByProjectile(_e: GameEnemy) {
    this.checkAllDefeated();
  }

  protected handleBossDefeat() {
    // Phase5 has no boss — no-op
  }

  private checkAllDefeated() {
    const remaining =
      this.carimbadores.countActive() +
      this.arquivos.countActive() +
      this.baterias.countActive() +
      this.impressorasN.countActive() +
      this.evangelistasM.countActive();

    this.hud.setObjective(
      remaining > 0
        ? `Derrote todos os inimigos (${remaining} restantes)`
        : "Acesso ao CEO liberado! Use [ E ] na porta.",
    );

    if (remaining === 0 && !this.allDefeated) {
      this.allDefeated = true;
      this.bossDefeated = true; // enables door interaction in base class
      this.hud.hideBoss();
      savePersisted(getRun(this).reconhecimento, getRun(this).fgts, getRun(this).loopCount);
      this.doorEl.clearTint();
      this.doorLabel.setText("CEO").setColor("#c9a36a");

      // Drop VR
      for (let i = 0; i < 8; i++) {
        this.time.delayedCall(i * 60, () => {
          this.dropVR(LEVEL_WIDTH - 60 + Phaser.Math.Between(-60, 60), FLOOR_Y - 60);
        });
      }

      const msg = this.add
        .text(
          GAME_WIDTH / 2,
          GAME_HEIGHT / 2 - 30,
          "DIRETORIA LIMPA!\n\nAcesso ao CEO desbloqueado ->",
          {
            fontFamily: "monospace",
            fontSize: "15px",
            color: "#f2c14e",
            stroke: "#000000",
            strokeThickness: 3,
            align: "center",
          },
        )
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(999);
      this.tweens.add({
        targets: msg,
        alpha: 0,
        duration: 900,
        delay: 3500,
        onComplete: () => msg.destroy(),
      });

      this._launchCulturaSelect();
    }
  }
}
