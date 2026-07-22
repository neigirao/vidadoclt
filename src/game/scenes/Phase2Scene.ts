import { bgUrl } from "../systems/BgOverrides";
import Phaser from "phaser";
import { BasePhaseScene, FLOOR_Y, LEVEL_WIDTH, type PhaseEventDef } from "./BasePhaseScene";
import { BossPresence } from "../systems/BossPresence";
import { getRun } from "../systems/PlayerState";
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

  // Rota divergente de verdade (piloto): a escolha 2A/2B após a Fase 1 muda a
  // Fase 2 além de um modificador de stat — fundo, título, layout e composição
  // de inimigos. Comercial (2A) = chão de vendas ABERTO e AGRESSIVO (ranged);
  // Atendimento (2B) = call center APERTADO e de ATRITO (auras). Boss é o mesmo
  // (Coordenador) — a rota diverge na JORNADA, não no chefe.
  private isComercial(): boolean {
    return getRun(this).route === "comercial";
  }

  preload() {
    this.load.image("bg-atendimento", bgUrl("bg-atendimento"));
    this.load.image("bg-comercial", bgUrl("bg-comercial"));
  }

  protected getBgKey() {
    return this.isComercial() ? "bg-comercial" : "bg-atendimento";
  }
  protected getPhaseNumber(): 2 {
    return 2;
  }
  protected getPhaseTitle() {
    return this.isComercial() ? "FASE 2 — CHAO DE VENDAS" : "FASE 2 — REUNIAO INFINITA";
  }
  protected getInitialObjective() {
    return this.isComercial()
      ? "Bata a meta: derrote o Coordenador"
      : "Derrote o Coordenador e avance";
  }

  protected getPlatSurface() {
    return { surf: "tex-baia", body: "tex-baia-body" };
  }

  // Layout diverge por rota (piloto):
  //  • Atendimento "Baias": muitas plataformas BAIXAS/CURTAS bem próximas — o
  //    chão de call center apertado. Pulinhos rápidos encadeados.
  //  • Comercial "Chão de Vendas": poucas plataformas ALTAS com vãos maiores —
  //    o open space de vendas. Premia dash + verticalidade (ilhas de "mesa de
  //    fechamento"). Chão contínuo garante jogabilidade mesmo sem pular.
  protected getPlatformLayout(): Array<[number, number, number]> {
    if (this.isComercial()) {
      return [
        [280, FLOOR_Y - 46, 4],
        [560, FLOOR_Y - 84, 3],
        [880, FLOOR_Y - 50, 4],
        [1180, FLOOR_Y - 84, 3],
        [1460, FLOOR_Y - 46, 4],
      ];
    }
    return [
      [180, FLOOR_Y - 34, 3],
      [380, FLOOR_Y - 52, 3],
      [580, FLOOR_Y - 34, 3],
      [800, FLOOR_Y - 52, 3],
      [1000, FLOOR_Y - 34, 3],
      [1220, FLOOR_Y - 52, 3],
      [1420, FLOOR_Y - 34, 3],
      [1620, FLOOR_Y - 52, 3],
    ];
  }

  protected getDoorConfig() {
    return {
      x: LEVEL_WIDTH - 60,
      tint: 0x8a8a8a,
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

  // Eventos de sala próprios da Fase 2 (call center) — personalidade além do boss.
  protected getPhaseEvents(): PhaseEventDef[] {
    return [
      {
        id: "sistema-fora",
        name: "SISTEMA FORA DO AR",
        desc: "O sistema cai de tempos em tempos — os inimigos travam. +30% VR",
        tip: "Aproveite o freeze pra encaixar combos de graça.",
        color: "#66ddff",
        apply: () => {
          this.phaseEventVrMult = 1.3;
          this.time.addEvent({
            delay: 9000,
            loop: true,
            callback: () => {
              this.forEachEnemy((e) =>
                (e as unknown as { applyFreeze?: (ms: number) => void }).applyFreeze?.(1200),
              );
              this.cameras.main.shake(160, 0.006);
              this.cameras.main.flash(120, 90, 200, 255);
            },
          });
        },
      },
      {
        id: "pausa-cafe",
        name: "PAUSA PRO CAFÉ",
        desc: "Ninguém liga por um instante — sua sanidade não cai. +20% VR",
        tip: "Explore o alto com calma e junte tudo.",
        color: "#ffcc66",
        apply: () => {
          this.phaseEventNoSanityDrain = true;
          this.phaseEventVrMult = 1.2;
        },
      },
    ];
  }

  protected setupEnemiesAndGroups() {
    this.telemarketers = this.physics.add.group({ runChildUpdate: false });
    this.impressoras = this.physics.add.group({ runChildUpdate: false });
    this.guardioes = this.physics.add.group({ runChildUpdate: false });
    this.nuvens = this.physics.add.group({ runChildUpdate: false });
    this.reunioes = this.physics.add.group({ runChildUpdate: false });
    this.coordenadores = this.physics.add.group({ runChildUpdate: false });

    // Composição diverge por rota: Comercial = mais pressão RANGED (cold-call +
    // quadro de metas caindo), menos atrito defensivo. Atendimento = o inverso.
    const com = this.isComercial();

    // Encontros por seed: contagem fixa por rota, posições/densidade variam por run.
    this.pickPositions([280, 380, 480, 580, 680, 780, 880], com ? 6 : 5).forEach((x) => {
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

    // Quadro de metas (NuvemBoard) caindo do teto: Comercial tem 3 (pressão
    // vertical de "meta"), Atendimento 2.
    (com ? [560, 1040, 1440] : [620, 1380]).forEach((x) => {
      const e = new NuvemBoardSentinela(this, x, FLOOR_Y - 200);
      e.onFire = (fx, fy) => this.spawnEnemyProjectile(fx, fy, fx, fy + 300, 12, 0xff4444, 200);
      this.nuvens.add(e);
    });

    // Auras de Reunião (atrito defensivo): Comercial 2 (menos), Atendimento 3.
    this.pickPositions([900, 1030, 1130, 1240, 1340], com ? 2 : 3).forEach((x) => {
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
    const boss = new CoordenadorDeSinergia(this, 1800, FLOOR_Y - 60, true);
    boss.target = this.player;
    // Rebalance v2 (telemetria: Fase 2 era paredão): trash caiu p/ 42-95, então
    // o boss desce junto p/ manter a proporção "maior luta da fase" sem paredão.
    boss.hp = 200;
    this.boss = boss;
    this.bossPresence = new BossPresence(this, boss, 0x44ccff);

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
    // Enrage: cadência aperta na 2ª metade (7s → ~4s) — a luta ramp-a.
    this.nextSpecialAt = time + (this.bossEnraged ? 4000 : 7000);
    this.coordenadorSpecial(boss.x, boss.y);
  }

  /** Virada aos 35% HP: convoca a Reunião de Alinhamento na hora. */
  protected override onBossEnrage() {
    const boss = this.boss;
    if (boss?.active) {
      this.coordenadorSpecial(boss.x, boss.y);
      this.nextSpecialAt = this.time.now + 4000;
    }
  }

  // "REUNIÃO DE ALINHAMENTO": convoca 2 balões de fala que orbitam o Coordenador
  // durante o telegraph e depois disparam em CRUZ (4 direções). Personalidade:
  // a reunião sem pauta que ninguém pediu, atirando pautas para todo lado. O
  // player fura o padrão batendo no Coordenador (ou saindo das linhas de tiro).
  private coordenadorSpecial(bx: number, by: number) {
    const label = this.add
      .text(bx, by - 74, "REUNIÃO DE ALINHAMENTO!", {
        fontFamily: "monospace",
        fontSize: "12px",
        fontStyle: "bold",
        color: "#ffcc44",
        stroke: "#000000",
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(400);

    // 2 balões orbitando (satélites de "pauta")
    // Enrage (assinatura F2): a reunião "incha" — 4 balões (cruz dupla) em vez
    // de 2, dobrando as linhas de tiro. Gear-shift na 2ª metade, não só cadência.
    const phases = this.bossEnraged ? [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2] : [0, Math.PI];
    const balloons = phases.map((phase0) => {
      const b = this.add
        .text(bx, by, "💬", { fontFamily: "monospace", fontSize: "20px" })
        .setOrigin(0.5)
        .setDepth(401)
        .setData("phase0", phase0);
      return b;
    });

    const orbitR = 54;
    const start = this.time.now;
    const orbitEvt = this.time.addEvent({
      delay: 16,
      loop: true,
      callback: () => {
        const boss = this.boss;
        const cx = boss?.active ? boss.x : bx;
        const cy = boss?.active ? boss.y : by;
        const el = (this.time.now - start) / 1000;
        balloons.forEach((b) => {
          if (!b.active) return;
          const ang = (b.getData("phase0") as number) + el * 4;
          b.setPosition(cx + Math.cos(ang) * orbitR, cy + Math.sin(ang) * orbitR);
        });
      },
    });

    // após o telegraph: dispara em cruz de cada balão e limpa
    this.time.delayedCall(900, () => {
      orbitEvt.remove();
      label.destroy();
      const dirs: Array<[number, number]> = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ];
      balloons.forEach((b) => {
        if (!b.active) return;
        const px = b.x;
        const py = b.y;
        dirs.forEach(([dx, dy]) => {
          this.spawnEnemyProjectile(px, py, px + dx * 260, py + dy * 260, 12, 0xffcc44, 260);
        });
        this.tweens.add({
          targets: b,
          scale: 1.6,
          alpha: 0,
          duration: 220,
          onComplete: () => b.destroy(),
        });
      });
    });
  }
}
