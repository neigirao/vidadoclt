import { bgUrl } from "../systems/BgOverrides";
import Phaser from "phaser";
import { BasePhaseScene, FLOOR_Y, LEVEL_WIDTH } from "./BasePhaseScene";
import { BossPresence } from "../systems/BossPresence";
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
import { DiretorDeResultados } from "../entities/DiretorBoss";

export class Phase5Scene extends BasePhaseScene {
  private carimbadores!: Phaser.Physics.Arcade.Group;
  private arquivos!: Phaser.Physics.Arcade.Group;
  private baterias!: Phaser.Physics.Arcade.Group;
  private impressorasN!: Phaser.Physics.Arcade.Group;
  private evangelistasM!: Phaser.Physics.Arcade.Group;
  private diretor?: DiretorDeResultados;

  constructor() {
    super("Phase5Scene");
  }

  preload() {
    this.load.image("bg-diretoria", bgUrl("bg-diretoria"));
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
    return "Derrote o Diretor de Resultados";
  }

  protected getPlatSurface() {
    return { surf: "tex-exec", body: "tex-exec-body" };
  }

  // Identidade "Átrio Executivo": poucas plataformas GRANDES com vãos LARGOS —
  // o mezanino aberto e luxuoso da diretoria. Cruzar a rota alta exige dash. A
  // "Reestruturação" do Diretor troca os lados desse átrio.
  protected getPlatformLayout(): Array<[number, number, number]> {
    return [
      [240, FLOOR_Y - 40, 6],
      [660, FLOOR_Y - 70, 5],
      [1080, FLOOR_Y - 70, 5],
      [1500, FLOOR_Y - 44, 6],
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
    return "Diretor de Resultados";
  }

  protected setupEnemiesAndGroups() {
    this.carimbadores = this.physics.add.group({ runChildUpdate: false });
    this.arquivos = this.physics.add.group({ runChildUpdate: false });
    this.baterias = this.physics.add.group({ runChildUpdate: false });
    this.impressorasN = this.physics.add.group({ runChildUpdate: false });
    this.evangelistasM = this.physics.add.group({ runChildUpdate: false });

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
    });

    [760, 960].forEach((x) => {
      const e = new ArquivoAmbulante(this, x, FLOOR_Y - 60);
      e.target = this.player;
      this.arquivos.add(e);
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
    });

    // Boss — Diretor de Resultados. Guardado em this.diretor (ref tipada) e em
    // this.boss (contrato da base: barra de HP, contato, ink→boss, defeat).
    const diretor = new DiretorDeResultados(this, 1800, FLOOR_Y - 66);
    diretor.target = this.player;
    diretor.onMeta = (bx, by) => this.metaInalcancavel(bx, by);
    diretor.onReestrutura = (fromX) => this.reestruturacao(fromX);
    diretor.onCascata = (bx, by) => this.cascataDeMetas(bx, by);
    this.diretor = diretor;
    this.boss = diretor;
    this.bossPresence = new BossPresence(this, diretor, 0xffaa22);

    this.enemyGroups.push(
      { group: this.carimbadores, vrDrop: 4 },
      { group: this.arquivos, vrDrop: 15 },
      { group: this.baterias, vrDrop: 4 },
      { group: this.impressorasN, vrDrop: 16 },
      { group: this.evangelistasM, vrDrop: 9 },
    );
  }

  // ── "META INALCANÇÁVEL": barra que sobe sozinha; ao estourar, dispara uma
  //    cobrança (projétil rápido dirigido). O Diretor fica exposto na subida. ──
  private metaInalcancavel(bx: number, by: number) {
    const w = 60;
    const barBg = this.add.rectangle(bx, by - 84, w, 8, 0x220000, 0.85).setDepth(500);
    const bar = this.add
      .rectangle(bx - w / 2, by - 84, 2, 6, 0xff3322)
      .setOrigin(0, 0.5)
      .setDepth(501);
    const label = this.add
      .text(bx, by - 98, "META", {
        fontFamily: "monospace",
        fontSize: "10px",
        fontStyle: "bold",
        color: "#ffaa22",
        stroke: "#000000",
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(501);
    this.tweens.add({
      targets: bar,
      width: w,
      duration: 1300,
      ease: "Sine.easeIn",
      onComplete: () => {
        barBg.destroy();
        bar.destroy();
        label.destroy();
        // Cobrança: projétil rápido em direção ao player
        this.spawnEnemyProjectile(bx, by - 12, this.player.x, this.player.y, 18, 0xff3322, 320);
      },
    });
  }

  // ── "REESTRUTURAÇÃO": some e reaparece no lado oposto da arena, forçando o
  //    player a reposicionar. Flash de feedback nos dois pontos. ──
  private reestruturacao(fromX: number) {
    const mid = LEVEL_WIDTH / 2;
    const targetX = fromX < mid ? LEVEL_WIDTH - 240 : 240;
    const y = FLOOR_Y - 66;
    const flashOut = this.add.circle(fromX, y, 30, 0x9966ff, 0.6).setDepth(300);
    this.tweens.add({
      targets: flashOut,
      scale: 2,
      alpha: 0,
      duration: 300,
      onComplete: () => flashOut.destroy(),
    });
    this.diretor?.teleportTo(targetX);
    const flashIn = this.add.circle(targetX, y, 10, 0x9966ff, 0.7).setDepth(300);
    this.tweens.add({
      targets: flashIn,
      scale: 3,
      alpha: 0,
      duration: 360,
      onComplete: () => flashIn.destroy(),
    });
  }

  // ── "CASCATA DE METAS" (assinatura, phase 2): barragem de metas caindo em
  //    faixas telegrafadas com brechas seguras. O padrão bullet-hell que marca o
  //    boss FINAL — leitura + costura, não hit único. Uma brecha sempre nasce
  //    perto do player (dodgeável), e as ondas deslocam a brecha (pressão). ──
  private cascataDeMetas(bx: number, by: number): void {
    const view = this.cameras.main.worldView;
    const left = Math.max(60, view.left + 40);
    const right = Math.min(LEVEL_WIDTH - 60, view.right - 40);
    const cols = 9;
    const step = (right - left) / (cols - 1);
    const topY = Math.max(40, FLOOR_Y - 320);
    const WAVES = 2;

    // brecha inicial na coluna mais perto do player → sempre há saída.
    let gap = Phaser.Math.Clamp(Math.round((this.player.x - left) / step), 0, cols - 1);

    for (let wv = 0; wv < WAVES; wv++) {
      const delay = wv * 720;
      // desloca a brecha a cada onda (±1..2) p/ obrigar movimento.
      const gapThis = gap;
      const deadly: number[] = [];
      for (let i = 0; i < cols; i++) if (Math.abs(i - gapThis) > 0) deadly.push(i);
      gap = Phaser.Math.Clamp(gapThis + Phaser.Math.Between(-2, 2), 1, cols - 2);

      // telegraph: retículas nas colunas mortais + realce da brecha segura.
      this.time.delayedCall(delay, () => {
        for (const i of deadly) {
          const x = left + i * step;
          const warn = this.add
            .rectangle(x, (topY + FLOOR_Y) / 2, 10, FLOOR_Y - topY, 0xffdd33, 0.14)
            .setDepth(180);
          this.time.delayedCall(560, () => warn.destroy());
        }
        const gx = left + gapThis * step;
        const safe = this.add
          .rectangle(gx, FLOOR_Y - 8, step * 0.8, 6, 0x33ff88, 0.5)
          .setDepth(181);
        this.tweens.add({
          targets: safe,
          alpha: 0,
          duration: 900,
          onComplete: () => safe.destroy(),
        });
      });

      // disparo: metas caem retas nas colunas mortais, escalonadas.
      this.time.delayedCall(delay + 600, () => {
        deadly.forEach((i, k) => {
          this.time.delayedCall(k * 45, () => {
            const x = left + i * step;
            this.spawnEnemyProjectile(x, topY, x, FLOOR_Y, 16, 0xffcc22, 300);
          });
        });
      });
    }

    // "grito" temático em cima do boss
    const shout = this.add
      .text(bx, by - 84, "BATE A META OU RODA!", {
        fontFamily: "monospace",
        fontSize: "11px",
        fontStyle: "bold",
        color: "#ffdd33",
        stroke: "#000000",
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(600);
    this.tweens.add({
      targets: shout,
      alpha: 0,
      y: shout.y - 20,
      duration: 1000,
      delay: 500,
      onComplete: () => shout.destroy(),
    });
  }

  // Boss derrotado → porta do CEO liberada. Override da base (que fala "Copa").
  protected handleBossDefeat() {
    this.bossDefeated = true;
    this.playPhaseClearBeat();
    this.hud.hideBoss();
    this.hud.setObjective("Acesso ao CEO liberado! Use [ E ] na porta.");

    if (this.boss?.active) {
      const bx = this.boss.x;
      for (let i = 0; i < 12; i++) {
        this.time.delayedCall(i * 60, () => {
          if (this.boss) this.dropVR(this.boss.x + Phaser.Math.Between(-60, 60), this.boss.y - 20);
        });
      }
      (this.boss as Phaser.Physics.Arcade.Sprite).destroy();
      this.bossPresence?.destroy();
      this.dropBossWeapon(bx);
    }

    savePersisted(getRun(this).reconhecimento, getRun(this).fgts, getRun(this).loopCount);
    this.doorEl.clearTint();
    this.doorLabel.setText("CEO").setColor("#c9a36a");

    const msg = this.add
      .text(
        GAME_WIDTH / 2,
        GAME_HEIGHT / 2 - 30,
        "DIRETOR DE RESULTADOS DERROTADO!\n\nAcesso ao CEO desbloqueado ->",
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
