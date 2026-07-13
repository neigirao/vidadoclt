import { bgUrl } from "../systems/BgOverrides";
import Phaser from "phaser";
import { BasePhaseScene, FLOOR_Y, LEVEL_WIDTH } from "./BasePhaseScene";
import { BossPresence } from "../systems/BossPresence";
import { getRun } from "../systems/PlayerState";
import { AnalistaSeniorExausto } from "../entities/Enemies";
import { BrendaDoRH } from "../entities/BrendaBoss";
import {
  EvangelistaCorporativo,
  ColetorDeDados,
  PlanilhaViva,
  ImpressoraVermelha,
} from "../entities/PhaseEnemies";

type ClimaZone = { x: number; w: number; until: number; gfx: Phaser.GameObjects.Rectangle };

export class Phase3Scene extends BasePhaseScene {
  private evangelistas!: Phaser.Physics.Arcade.Group;
  private coletores!: Phaser.Physics.Arcade.Group;
  private planilhas!: Phaser.Physics.Arcade.Group;
  private impressorasV!: Phaser.Physics.Arcade.Group;
  private seniors!: Phaser.Physics.Arcade.Group;
  private brenda?: BrendaDoRH;
  private climaZones: ClimaZone[] = [];
  private nextClimaDmgAt = 0;

  constructor() {
    super("Phase3Scene");
  }

  // Rota divergente (2ª bifurcação, run.route2): a Brenda (RH) impõe a CULTURA
  // da área escolhida pós-Fase 2. Produto (3A) = hype/evangelismo (bg-comercial,
  // escada da carreira, mais evangelistas). Tecnologia (3B) = dados/débito técnico
  // (bg-tecnologia, torres de data center, mais coletores/planilhas). Boss é a
  // mesma Brenda — a rota diverge na jornada. Default (sem route2) = produto.
  private isTecnologia(): boolean {
    return getRun(this).route2 === "tecnologia";
  }

  preload() {
    this.load.image("bg-comercial", bgUrl("bg-comercial"));
    this.load.image("bg-tecnologia", bgUrl("bg-tecnologia"));
  }

  protected getBgKey() {
    return this.isTecnologia() ? "bg-tecnologia" : "bg-comercial";
  }
  protected getPhaseNumber(): 3 {
    return 3;
  }
  protected getPhaseTitle() {
    return this.isTecnologia() ? "FASE 3 — CULTURA TECH" : "FASE 3 — CULTURA DE PRODUTO";
  }
  protected getInitialObjective() {
    return "Derrote a Brenda do RH e avance";
  }

  protected getPlatSurface() {
    return this.isTecnologia()
      ? { surf: "tex-rack", body: "tex-rack-body" }
      : { surf: "tex-degrau-rh", body: "tex-degrau-rh-body" };
  }

  // Layout diverge por rota:
  //  • Produto "Escada da Carreira": plataformas que SOBEM da esq→dir — o discurso
  //    de "crescer na empresa". Premia subir; aéreos pressionam quem fica no alto.
  //  • Tecnologia "Torres de Servidor": pares empilhados (degrau baixo + topo alto)
  //    separados por vãos — pilares de rack. Cruzar exige dash.
  protected getPlatformLayout(): Array<[number, number, number]> {
    if (this.isTecnologia()) {
      return [
        [240, FLOOR_Y - 42, 3],
        [380, FLOOR_Y - 82, 3],
        [760, FLOOR_Y - 42, 3],
        [900, FLOOR_Y - 82, 3],
        [1240, FLOOR_Y - 42, 3],
        [1380, FLOOR_Y - 82, 3],
        [1620, FLOOR_Y - 50, 4],
      ];
    }
    return [
      [220, FLOOR_Y - 30, 4],
      [470, FLOOR_Y - 44, 4],
      [720, FLOOR_Y - 58, 4],
      [980, FLOOR_Y - 70, 4],
      [1240, FLOOR_Y - 82, 4],
      [1520, FLOOR_Y - 84, 5],
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

  protected getBossName() {
    return "Brenda do RH";
  }

  protected setupEnemiesAndGroups() {
    this.evangelistas = this.physics.add.group({ runChildUpdate: false });
    this.coletores = this.physics.add.group({ runChildUpdate: false });
    this.planilhas = this.physics.add.group({ runChildUpdate: false });
    this.impressorasV = this.physics.add.group({ runChildUpdate: false });
    this.seniors = this.physics.add.group({ runChildUpdate: false });

    // Composição diverge por rota: Produto = mais EVANGELISTAS (hype/pitch);
    // Tecnologia = mais COLETORES + PLANILHAS (dados/débito técnico).
    const tec = this.isTecnologia();

    // Encontros por seed: contagem fixa por rota, posições variam por run.
    this.pickPositions([300, 420, 540, 660, 780, 900], tec ? 3 : 4).forEach((x) => {
      const e = new EvangelistaCorporativo(this, x, FLOOR_Y - 60);
      e.target = this.player;
      e.onFire = (fx, fy, tx, ty) => this.spawnEnemyProjectile(fx, fy, tx, ty, 12, 0xff6600, 190);
      this.evangelistas.add(e);
    });

    this.pickPositions([480, 650, 950, 1200, 1350], tec ? 4 : 3).forEach((x) => {
      const e = new ColetorDeDados(this, x, FLOOR_Y - 160);
      e.target = this.player;
      e.onStealVR = () => {
        let nearest: Phaser.Physics.Arcade.Sprite | null = null;
        let bestDist = 50;
        this.drops.getChildren().forEach((d) => {
          const drop = d as Phaser.Physics.Arcade.Sprite;
          const dist = Phaser.Math.Distance.Between(e.x, e.y, drop.x, drop.y);
          if (dist < bestDist) {
            bestDist = dist;
            nearest = drop;
          }
        });
        if (nearest) (nearest as Phaser.Physics.Arcade.Sprite).destroy();
      };
      this.coletores.add(e);
    });

    // Planilhas Vivas (débito técnico): Tecnologia 3, Produto 2.
    (tec ? [760, 1040, 1320] : [940, 1140]).forEach((x) => {
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
          mini.hp = 40;
          mini.maxHp = 40;
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
            if (died) {
              this.dropVR(mini.x, mini.y, 3);
              mini.destroy();
            }
          });
        }
      };
      this.planilhas.add(planilha);
    });

    [1340, 1520].forEach((x) => {
      const iv = new ImpressoraVermelha(this, x, FLOOR_Y - 60);
      iv.target = this.player;
      iv.onFire = (fx, fy, dir) =>
        this.spawnEnemyProjectile(fx, fy, fx + dir * 200, fy, 12, 0xcc2200, 220);
      this.impressorasV.add(iv);
    });

    // Boss — Brenda do RH ("Clima Organizacional"). Guardada em this.brenda
    // (ref tipada) e em this.boss (contrato da base). Substitui o Analista
    // Sênior, que não combinava com o tema RH / Endomarketing da fase.
    const boss = new BrendaDoRH(this, 1750, FLOOR_Y - 62);
    boss.target = this.player;
    boss.onClima = (px) => this.pesquisaDeClima(px);
    boss.onFeedback = (bx, by) => this.feedback360(bx, by);
    this.brenda = boss;
    this.boss = boss;
    this.bossPresence = new BossPresence(this, boss, 0xff66aa);

    this.enemyGroups.push(
      { group: this.evangelistas, vrDrop: 3 },
      { group: this.coletores, vrDrop: 1, aerial: true },
      { group: this.planilhas, vrDrop: 6 },
      { group: this.impressorasV, vrDrop: 10 },
      { group: this.seniors, vrDrop: 6 },
    );
  }

  // "PESQUISA DE CLIMA": marca 2 zonas de piso "sorriso obrigatório" perto do
  // player. Ficar PARADO numa zona fere — força movimento constante (a assinatura
  // temática da Brenda). As zonas expiram sozinhas; o dano é checado no update.
  private pesquisaDeClima(px: number) {
    const spots = [px - 70, px + 70];
    const now = this.time.now;
    spots.forEach((zx) => {
      const cx = Phaser.Math.Clamp(zx, 60, LEVEL_WIDTH - 60);
      const w = 90;
      // Telegrafa (aviso rosa) antes de ativar
      const warn = this.add.rectangle(cx, FLOOR_Y - 6, w, 12, 0xff66aa, 0.2).setDepth(150);
      this.time.delayedCall(500, () => {
        warn.destroy();
        const gfx = this.add.rectangle(cx, FLOOR_Y - 6, w, 12, 0xff3388, 0.4).setDepth(150);
        this.add
          .text(cx, FLOOR_Y - 26, "☺", {
            fontFamily: "monospace",
            fontSize: "16px",
            color: "#ff99cc",
          })
          .setOrigin(0.5)
          .setDepth(151)
          .setData("climaIcon", true);
        this.climaZones.push({ x: cx, w, until: this.time.now + 2600, gfx });
      });
    });
    void now;
  }

  // "FEEDBACK 360": leque de 3 post-its de feedback dirigidos ao player.
  private feedback360(bx: number, by: number) {
    const base = Phaser.Math.Angle.Between(bx, by, this.player.x, this.player.y);
    [-0.28, 0, 0.28].forEach((off, i) => {
      this.time.delayedCall(i * 90, () => {
        const ang = base + off;
        const tx = bx + Math.cos(ang) * 300;
        const ty = by + Math.sin(ang) * 300;
        this.spawnEnemyProjectile(bx, by, tx, ty, 12, 0xffcc33, 240);
      });
    });
  }

  // Dano das zonas de clima: parado (|vx|<40) e no chão dentro de uma zona ativa.
  private tickClimaZones(time: number) {
    if (this.climaZones.length === 0) return;
    this.climaZones = this.climaZones.filter((z) => {
      if (time >= z.until) {
        this.tweens.add({
          targets: z.gfx,
          alpha: 0,
          duration: 250,
          onComplete: () => z.gfx.destroy(),
        });
        return false;
      }
      return true;
    });
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const nearlyStill = Math.abs(body.velocity.x) < 40;
    if (!nearlyStill || time < this.nextClimaDmgAt) return;
    for (const z of this.climaZones) {
      if (Math.abs(this.player.x - z.x) < z.w / 2) {
        if (!this.player.isInvulnerable(time)) {
          this.player.takeDamage(9, 0);
          this.nextClimaDmgAt = time + 700;
        }
        break;
      }
    }
  }

  protected onPhaseUpdate(time: number, _delta: number) {
    this.tickClimaZones(time);

    // ColetorDeDados steals nearby VR drops each frame
    this.coletores.getChildren().forEach((c) => {
      const col = c as ColetorDeDados;
      if (!col.active) return;
      this.drops.getChildren().forEach((d) => {
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
        if (
          !this.player.isInvulnerable(time) &&
          Phaser.Geom.Intersects.RectangleToRectangle(sr.swingHitbox, this.player.getBounds())
        ) {
          this.player.takeDamage(sr.swingDamage, 3, sr.x);
          sr.swingActive = false;
          sr.swingHitbox = null;
        }
      }
    });

    // Boss swing attack (Brenda "Dinâmica de Grupo" — investida com contato)
    const br = this.brenda;
    if (br?.active && br.swingActive && br.swingHitbox) {
      if (
        !this.player.isInvulnerable(time) &&
        Phaser.Geom.Intersects.RectangleToRectangle(br.swingHitbox, this.player.getBounds())
      ) {
        this.player.takeDamage(br.swingDamage, 3, br.x);
        br.swingActive = false;
        br.swingHitbox = null;
      }
    }
  }
}
