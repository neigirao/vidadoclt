import Phaser from "phaser";
import { BasePhaseScene, FLOOR_Y, LEVEL_WIDTH } from "./BasePhaseScene";
import { AnalistaSeniorExausto } from "../entities/Enemies";
import {
  EvangelistaCorporativo,
  ColetorDeDados,
  PlanilhaViva,
  ImpressoraVermelha,
} from "../entities/PhaseEnemies";

export class Phase3Scene extends BasePhaseScene {
  private evangelistas!: Phaser.Physics.Arcade.Group;
  private coletores!: Phaser.Physics.Arcade.Group;
  private planilhas!: Phaser.Physics.Arcade.Group;
  private impressorasV!: Phaser.Physics.Arcade.Group;
  private seniors!: Phaser.Physics.Arcade.Group;

  constructor() {
    super("Phase3Scene");
  }

  preload() {
    this.load.image("bg-comercial", "/assets/bg-comercial.png");
  }

  protected getBgKey() { return "bg-comercial"; }
  protected getPhaseNumber(): 3 { return 3; }
  protected getPhaseTitle() { return "FASE 3 — RH / ENDOMARKETING"; }
  protected getInitialObjective() { return "Derrote o Analista Sênior e avance"; }

  protected getPlatformLayout(): Array<[number, number, number]> {
    return [
      [220, FLOOR_Y - 30, 5],
      [500, FLOOR_Y - 72, 4],
      [760, FLOOR_Y - 30, 6],
      [1050, FLOOR_Y - 72, 5],
      [1320, FLOOR_Y - 30, 6],
      [1600, FLOOR_Y - 72, 4],
    ];
  }

  protected getDoorConfig() {
    return {
      x: LEVEL_WIDTH - 60,
      tint: 0x555555,
      label: "COPA\n[BLOQUEADO]",
      cameFrom: "phase3",
      destScene: "CopaScene",
      nextScene: "Phase4Scene",
      nearLabel: "Entrar na Copa",
    };
  }

  protected getBossName() { return "Analista Sênior Exausto"; }

  protected setupEnemiesAndGroups() {
    this.evangelistas  = this.physics.add.group({ runChildUpdate: false });
    this.coletores     = this.physics.add.group({ runChildUpdate: false });
    this.planilhas     = this.physics.add.group({ runChildUpdate: false });
    this.impressorasV  = this.physics.add.group({ runChildUpdate: false });
    this.seniors       = this.physics.add.group({ runChildUpdate: false });

    [240, 420, 600, 780].forEach((x) => {
      const e = new EvangelistaCorporativo(this, x, FLOOR_Y - 60);
      e.target = this.player;
      e.onFire = (fx, fy, tx, ty) => this.spawnEnemyProjectile(fx, fy, tx, ty, 12, 0xff6600, 190);
      this.evangelistas.add(e);
    });

    [550, 950, 1350].forEach((x) => {
      const e = new ColetorDeDados(this, x, FLOOR_Y - 160);
      e.target = this.player;
      e.onStealVR = () => {
        let nearest: Phaser.Physics.Arcade.Sprite | null = null;
        let bestDist = 50;
        this.drops.getChildren().forEach(d => {
          const drop = d as Phaser.Physics.Arcade.Sprite;
          const dist = Phaser.Math.Distance.Between(e.x, e.y, drop.x, drop.y);
          if (dist < bestDist) { bestDist = dist; nearest = drop; }
        });
        if (nearest) (nearest as Phaser.Physics.Arcade.Sprite).destroy();
      };
      this.coletores.add(e);
    });

    [940, 1140].forEach((x) => {
      const planilha = new PlanilhaViva(this, x, FLOOR_Y - 60);
      planilha.target = this.player;
      planilha.onFire = (px, py) => {
        const col = this.add.rectangle(px, FLOOR_Y - 80, 16, 160, 0x44aaff, 0.5).setDepth(200);
        this.tweens.add({ targets: col, alpha: 0, duration: 600, onComplete: () => col.destroy() });
        if (Math.abs(this.player.x - px) < 20) {
          if (!this.player.isInvulnerable(this.time.now)) this.player.takeDamage(15, 0);
        }
      };
      planilha.onSplit = (sx, sy) => {
        for (let i = 0; i < 2; i++) {
          const mini = new PlanilhaViva(this, sx + (i === 0 ? -40 : 40), sy);
          mini.hp = 160;
          mini.maxHp = 160;
          mini.target = this.player;
          this.planilhas.add(mini);
          this.physics.add.collider(mini, this.platforms);
          this.physics.add.overlap(this.inkProjectiles, mini, (inkObj) => {
            const ink = inkObj as Phaser.Physics.Arcade.Sprite;
            if (!ink.active) return;
            const dmg = (ink.getData("damage") as number) ?? 10;
            const piercing = (ink.getData("piercing") as boolean) ?? false;
            const died = mini.hit(Math.round(dmg * this.player.damageMult), 0);
            if (!piercing) ink.destroy();
            if (died) { this.dropVR(mini.x, mini.y, 3); mini.destroy(); }
          });
        }
      };
      this.planilhas.add(planilha);
    });

    [1340, 1520].forEach((x) => {
      const iv = new ImpressoraVermelha(this, x, FLOOR_Y - 60);
      iv.target = this.player;
      iv.onFire = (fx, fy, dir) => this.spawnEnemyProjectile(fx, fy, fx + dir * 200, fy, 12, 0xcc2200, 220);
      this.impressorasV.add(iv);
    });

    // Boss — stored in this.boss, NOT in seniors group (prevents double-damage)
    const boss = new AnalistaSeniorExausto(this, 1750, FLOOR_Y - 60);
    boss.target = this.player;
    boss.hp = 100;
    // @ts-ignore
    boss.maxHp = 100;
    this.boss = boss as any;

    this.enemyGroups.push(
      { group: this.evangelistas, vrDrop: 3 },
      { group: this.coletores,    vrDrop: 1, aerial: true },
      { group: this.planilhas,    vrDrop: 6 },
      { group: this.impressorasV, vrDrop: 10 },
      { group: this.seniors,      vrDrop: 6 },
    );
  }

  protected onPhaseUpdate(time: number, _delta: number) {
    // ColetorDeDados steals nearby VR drops each frame
    this.coletores.getChildren().forEach(c => {
      const col = c as ColetorDeDados;
      if (!col.active) return;
      this.drops.getChildren().forEach(d => {
        const drop = d as Phaser.Physics.Arcade.Sprite;
        if (!drop.active) return;
        if (Phaser.Math.Distance.Between(col.x, col.y, drop.x, drop.y) < 50) {
          drop.destroy();
        }
      });
    });

    // AnalistaSenior swing attack (non-boss seniors in group)
    this.seniors.getChildren().forEach((c) => {
      const sr = c as AnalistaSeniorExausto;
      if (sr.swingActive && sr.swingHitbox) {
        if (!this.player.isInvulnerable(time) &&
          Phaser.Geom.Intersects.RectangleToRectangle(sr.swingHitbox, this.player.getBounds())) {
          this.player.takeDamage(sr.swingDamage, 3, sr.x);
          sr.swingActive = false;
          sr.swingHitbox = null;
        }
      }
    });

    // Boss swing attack
    if (this.boss?.active) {
      const bossSr = this.boss as unknown as AnalistaSeniorExausto;
      if (bossSr.swingActive && bossSr.swingHitbox) {
        if (!this.player.isInvulnerable(time) &&
          Phaser.Geom.Intersects.RectangleToRectangle(bossSr.swingHitbox, this.player.getBounds())) {
          this.player.takeDamage(bossSr.swingDamage, 3, bossSr.x);
          bossSr.swingActive = false;
          bossSr.swingHitbox = null;
        }
      }
    }
  }
}
