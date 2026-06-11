import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH, COLORS } from "../constants";
import { Player } from "../entities/Player";
import {
  EstagiarioDesesperado, AnalistaJunior,
  FacilitadorDeWorkshop, PostIt,
  ScrumMasterCaotico,
  CoordenadorDeSinergia,
  AnalistaSeniorExausto,
} from "../entities/Enemies";
import { getRun } from "../systems/PlayerState";
import { SanityFx } from "../systems/SanityFx";
import { Hud } from "../systems/Hud";

const LEVEL_WIDTH = 1920;
const FLOOR_Y = GAME_HEIGHT - 32;

export class OpenSpaceScene extends Phaser.Scene {
  private player!: Player;
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private estagiarios!: Phaser.Physics.Arcade.Group;
  private analistas!: Phaser.Physics.Arcade.Group;
  private facilitadores!: Phaser.Physics.Arcade.Group;
  private scrums!: Phaser.Physics.Arcade.Group;
  private coordenadores!: Phaser.Physics.Arcade.Group;
  private seniors!: Phaser.Physics.Arcade.Group;
  private postits!: Phaser.Physics.Arcade.Group;
  private drops!: Phaser.Physics.Arcade.Group;
  private startTimeMs = 0;
  private fx!: SanityFx;
  private hud!: Hud;
  private doorCopa!: Phaser.GameObjects.Image;
  private interactKey!: Phaser.Input.Keyboard.Key;

  constructor() {
    super("OpenSpaceScene");
  }

  create() {
    const run = getRun(this);
    this.startTimeMs = this.time.now;
    this.physics.world.setBounds(0, 0, LEVEL_WIDTH, GAME_HEIGHT);
    this.cameras.main.setBounds(0, 0, LEVEL_WIDTH, GAME_HEIGHT);
    this.cameras.main.setBackgroundColor(COLORS.bg);

    const bg = this.add.graphics();
    bg.fillStyle(COLORS.bgDark, 1);
    for (let x = 0; x < LEVEL_WIDTH; x += 120) bg.fillRect(x, 60, 60, GAME_HEIGHT - 120);
    bg.setScrollFactor(0.4);

    for (let x = 80; x < LEVEL_WIDTH; x += 260) {
      const baia = this.add.image(x, FLOOR_Y - 28, "tex-baia");
      baia.setTint(0x4b525e);
    }

    this.platforms = this.physics.add.staticGroup();
    this.buildFloor();
    this.buildPlatform(260, FLOOR_Y - 110, 6);
    this.buildPlatform(520, FLOOR_Y - 180, 5);
    this.buildPlatform(780, FLOOR_Y - 110, 6);
    this.buildPlatform(1080, FLOOR_Y - 200, 4);
    this.buildPlatform(1300, FLOOR_Y - 120, 6);
    this.buildPlatform(1580, FLOOR_Y - 180, 5);

    // Door to Copa at end
    this.doorCopa = this.add.image(LEVEL_WIDTH - 60, FLOOR_Y - 30, "tex-door");
    this.add.text(LEVEL_WIDTH - 60, FLOOR_Y - 72, "COPA", {
      fontFamily: "monospace", fontSize: "10px", color: "#c9a36a",
    }).setOrigin(0.5);

    const spawnX = run.cameFrom === "copa" ? LEVEL_WIDTH - 120 : 80;
    this.player = new Player(this, spawnX, FLOOR_Y - 60);
    this.player.energy = run.energy;
    this.player.sanity = run.sanity;
    this.player.vr = run.vr;
    this.physics.add.collider(this.player, this.platforms);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);

    this.player.onDeath = (cause) => {
      this.persist();
      this.scene.start("GameOverScene", { vr: this.player.vr, cause });
    };
    this.player.onAttack = (hb, step) => this.resolveAttack(hb, step);

    this.estagiarios = this.physics.add.group({ classType: EstagiarioDesesperado, runChildUpdate: false });
    this.analistas = this.physics.add.group({ classType: AnalistaJunior, runChildUpdate: false });
    this.facilitadores = this.physics.add.group({ classType: FacilitadorDeWorkshop, runChildUpdate: false });
    this.scrums = this.physics.add.group({ classType: ScrumMasterCaotico, runChildUpdate: false });
    this.coordenadores = this.physics.add.group({ classType: CoordenadorDeSinergia, runChildUpdate: false });
    this.seniors = this.physics.add.group({ classType: AnalistaSeniorExausto, runChildUpdate: false });
    this.postits = this.physics.add.group();
    this.drops = this.physics.add.group();

    if (run.cameFrom !== "copa") this.spawnEnemies();

    this.physics.add.collider(this.estagiarios, this.platforms);
    this.physics.add.collider(this.analistas, this.platforms);
    this.physics.add.collider(this.facilitadores, this.platforms);
    this.physics.add.collider(this.scrums, this.platforms);
    this.physics.add.collider(this.coordenadores, this.platforms);
    this.physics.add.collider(this.seniors, this.platforms);
    this.physics.add.collider(this.drops, this.platforms);

    this.physics.add.overlap(this.player, this.estagiarios, (_p, eObj) => {
      const e = eObj as EstagiarioDesesperado;
      if (this.player.isInvulnerable(this.time.now)) return;
      this.player.takeDamage(e.contactDamage, 4);
    });

    this.physics.add.overlap(this.player, this.scrums, (_p, eObj) => {
      const e = eObj as ScrumMasterCaotico;
      if (this.player.isInvulnerable(this.time.now)) return;
      this.player.takeDamage(e.contactDamage, 4);
    });

    this.physics.add.overlap(this.player, this.coordenadores, (_p, eObj) => {
      const e = eObj as CoordenadorDeSinergia;
      if (this.player.isInvulnerable(this.time.now)) return;
      this.player.takeDamage(e.contactDamage, 3);
    });

    this.physics.add.overlap(this.player, this.seniors, (_p, eObj) => {
      const e = eObj as AnalistaSeniorExausto;
      if (this.player.isInvulnerable(this.time.now)) return;
      this.player.takeDamage(e.contactDamage, 3);
    });

    this.physics.add.overlap(this.player, this.postits, (_p, pObj) => {
      const p = pObj as PostIt;
      if (!p.active) return;
      if (this.player.isInvulnerable(this.time.now)) return;
      this.player.sanity = Math.max(0, this.player.sanity - p.sanityDamage);
      p.destroy();
    });

    this.physics.add.overlap(this.player, this.drops, (_p, dObj) => {
      this.player.addVR(1);
      (dObj as Phaser.Physics.Arcade.Sprite).destroy();
    });

    this.interactKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    const doorZone = this.add.zone(this.doorCopa.x, this.doorCopa.y, 40, 60);
    this.physics.add.existing(doorZone, true);
    this.physics.add.overlap(this.player, doorZone, () => {
      if (Phaser.Input.Keyboard.JustDown(this.interactKey)) {
        this.persist();
        const r = getRun(this);
        r.cameFrom = "openspace";
        this.scene.start("CopaScene");
      }
    });

    this.fx = new SanityFx(this);
    this.hud = new Hud(this, LEVEL_WIDTH);
    this.hud.setObjective("Chegue ao elevador e desça para o próximo andar");

    const title = this.add
      .text(GAME_WIDTH / 2, 110, "18:00 — Quarta-feira\nÁrea 1: Estações de Trabalho", {
        fontFamily: "monospace", fontSize: "18px", color: "#eaeaea", align: "center",
        stroke: "#000000", strokeThickness: 3,
      })
      .setOrigin(0.5).setScrollFactor(0).setDepth(999);
    this.tweens.add({ targets: title, alpha: 0, duration: 800, delay: 2200, onComplete: () => title.destroy() });
  }

  private persist() {
    const r = getRun(this);
    r.energy = this.player.energy;
    r.sanity = this.player.sanity;
    r.vr = this.player.vr;
  }

  private buildFloor() {
    const floor = this.add.rectangle(LEVEL_WIDTH / 2, FLOOR_Y + 16, LEVEL_WIDTH, 32, COLORS.floor);
    this.physics.add.existing(floor, true);
    this.platforms.add(floor);
  }

  private buildPlatform(x: number, y: number, tiles: number) {
    const w = tiles * 32;
    const plat = this.add.rectangle(x + w / 2, y, w, 14, COLORS.platform);
    this.physics.add.existing(plat, true);
    this.platforms.add(plat);
  }

  private spawnEnemies() {
    // Area 1 (x 300-700): Estagiários básicos
    [380, 560, 700].forEach((x) => {
      const e = new EstagiarioDesesperado(this, x, FLOOR_Y - 40, Math.random() > 0.5 ? 1 : -1);
      this.estagiarios.add(e);
    });

    // Area 2 (x 700-1100): Facilitadores + Scrums
    [820, 1020].forEach((x) => {
      const f = new FacilitadorDeWorkshop(this, x, FLOOR_Y - 60);
      f.target = this.player;
      f.onShoot = (fx, fy, tx, ty) => this.spawnPostIt(fx, fy, tx, ty);
      this.facilitadores.add(f);
    });
    [950].forEach((x) => {
      const s = new ScrumMasterCaotico(this, x, FLOOR_Y - 60);
      s.target = this.player;
      s.onShout = (fromX, fromY) => this.handleScrumShout(fromX, fromY);
      this.scrums.add(s);
    });

    // Area 3 (x 1100-1500): Mix com AnalistaJunior
    [600, 1150, 1350].forEach((x) => {
      const a = new AnalistaJunior(this, x, FLOOR_Y - 60);
      a.target = this.player;
      this.analistas.add(a);
    });

    // Area 4 (x 1500-1900): Coordenadores + Seniors (elite)
    [1500, 1700].forEach((x) => {
      const e = new EstagiarioDesesperado(this, x, FLOOR_Y - 40, Math.random() > 0.5 ? 1 : -1);
      this.estagiarios.add(e);
    });
    [1620].forEach((x) => {
      const c = new CoordenadorDeSinergia(this, x, FLOOR_Y - 60);
      c.target = this.player;
      this.coordenadores.add(c);
    });
    [1780].forEach((x) => {
      const sr = new AnalistaSeniorExausto(this, x, FLOOR_Y - 60);
      sr.target = this.player;
      this.seniors.add(sr);
    });
  }

  private spawnPostIt(fx: number, fy: number, tx: number, ty: number) {
    const p = new PostIt(this, fx, fy);
    this.postits.add(p);
    p.fire(tx, ty);
  }

  private handleScrumShout(fromX: number, fromY: number) {
    // Pull player toward scrum master if close enough
    const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, fromX, fromY);
    if (dist < 260) {
      const dir = fromX < this.player.x ? -1 : 1;
      const body = this.player.body as Phaser.Physics.Arcade.Body;
      body.setVelocityX(dir * -220);
      this.player.takeDamage(0, 0); // trigger flash without damage
    }
  }

  private resolveAttack(hb: Phaser.Geom.Rectangle, step: number) {
    const damage = step === 3 ? 15 : 10;
    const knockback = (step === 3 ? 320 : 120) * this.player.facing;
    const slash = this.add.rectangle(hb.x + hb.width / 2, hb.y + hb.height / 2, hb.width, hb.height, 0xffffff, 0.5);
    this.tweens.add({ targets: slash, alpha: 0, duration: 140, onComplete: () => slash.destroy() });

    const tryHit = (sprite: Phaser.Physics.Arcade.Sprite) =>
      Phaser.Geom.Intersects.RectangleToRectangle(hb, sprite.getBounds());

    this.estagiarios.getChildren().forEach((c) => {
      const e = c as EstagiarioDesesperado;
      if (!e.active) return;
      if (tryHit(e)) {
        if (e.hit(damage, knockback)) { this.dropVR(e.x, e.y); e.destroy(); }
      }
    });

    this.analistas.getChildren().forEach((c) => {
      const a = c as AnalistaJunior;
      if (!a.active) return;
      if (tryHit(a)) {
        if (a.hit(damage, knockback)) { this.dropVR(a.x, a.y, 3); a.destroy(); }
      }
    });

    this.facilitadores.getChildren().forEach((c) => {
      const f = c as FacilitadorDeWorkshop;
      if (!f.active) return;
      if (tryHit(f)) {
        if (f.hit(damage, knockback)) { this.dropVR(f.x, f.y, 2); f.destroy(); }
      }
    });

    this.scrums.getChildren().forEach((c) => {
      const s = c as ScrumMasterCaotico;
      if (!s.active) return;
      if (tryHit(s)) {
        if (s.hit(damage, knockback)) { this.dropVR(s.x, s.y, 2); s.destroy(); }
      }
    });

    this.coordenadores.getChildren().forEach((c) => {
      const coord = c as CoordenadorDeSinergia;
      if (!coord.active) return;
      if (tryHit(coord)) {
        if (coord.hit(damage, knockback)) { this.dropVR(coord.x, coord.y, 4); coord.destroy(); }
      }
    });

    this.seniors.getChildren().forEach((c) => {
      const sr = c as AnalistaSeniorExausto;
      if (!sr.active) return;
      if (tryHit(sr)) {
        if (sr.hit(damage, knockback)) { this.dropVR(sr.x, sr.y, 6); sr.destroy(); }
      }
    });
  }

  private dropVR(x: number, y: number, count = 1) {
    for (let i = 0; i < count; i++) {
      const d = this.drops.create(x + (i - count / 2) * 8, y - 10, "tex-vr") as Phaser.Physics.Arcade.Sprite;
      const body = d.body as Phaser.Physics.Arcade.Body;
      body.setVelocity(Phaser.Math.Between(-120, 120), Phaser.Math.Between(-260, -160));
      body.setBounce(0.4);
      body.setDrag(120, 0);
    }
  }

  update(time: number, delta: number) {
    this.player.update(time, delta);
    this.player.tickPassive(time);

    this.analistas.getChildren().forEach((c) => {
      const a = c as AnalistaJunior;
      if (a.swingActive && a.swingHitbox) {
        const pb = this.player.getBounds();
        if (Phaser.Geom.Intersects.RectangleToRectangle(a.swingHitbox, pb)) {
          this.player.takeDamage(a.swingDamage, 6);
          a.swingActive = false; a.swingHitbox = null;
        }
      }
    });

    this.seniors.getChildren().forEach((c) => {
      const sr = c as AnalistaSeniorExausto;
      if (sr.swingActive && sr.swingHitbox) {
        const pb = this.player.getBounds();
        if (Phaser.Geom.Intersects.RectangleToRectangle(sr.swingHitbox, pb)) {
          if (!this.player.isInvulnerable(time)) {
            this.player.takeDamage(sr.swingDamage, 3);
            sr.swingActive = false; sr.swingHitbox = null;
          }
        }
      }
    });

    // Coordenador buff: speed up nearby enemies when isBuffing
    this.coordenadores.getChildren().forEach((c) => {
      const coord = c as CoordenadorDeSinergia;
      if (!coord.active || !coord.isBuffing) return;
      const buffAllInRange = (group: Phaser.Physics.Arcade.Group) => {
        group.getChildren().forEach((e) => {
          const enemy = e as Phaser.Physics.Arcade.Sprite & { speed?: number };
          if (!enemy.active) return;
          const dist = Phaser.Math.Distance.Between(coord.x, coord.y, enemy.x, enemy.y);
          if (dist < 160 && enemy.speed !== undefined) {
            const body = enemy.body as Phaser.Physics.Arcade.Body;
            body.setVelocityX(body.velocity.x * 1.4);
          }
        });
      };
      buffAllInRange(this.estagiarios);
      buffAllInRange(this.analistas);
      buffAllInRange(this.scrums);
    });

    this.fx.update(time, this.player.sanity);

    const nearDoor = Phaser.Math.Distance.Between(
      this.player.x, this.player.y, this.doorCopa.x, this.doorCopa.y
    ) < 40;

    const run = getRun(this);
    this.hud.update({
      energy: Math.ceil(this.player.energy),
      maxEnergy: 100,
      sanity: Math.ceil(this.player.sanity),
      maxSanity: 100,
      vr: this.player.vr,
      reconhecimento: run.reconhecimento,
      time,
      startTime: this.startTimeMs,
      playerX: this.player.x,
      interactHint: nearDoor ? "[ E ]  Entrar na Copa" : undefined,
    });
  }
}
