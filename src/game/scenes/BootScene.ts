import Phaser from "phaser";
import { COLORS } from "../constants";

/**
 * Generates colored-rectangle textures used as placeholders for sprites.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  preload() {
    this.load.image("bg-menu", "/assets/bg-menu.png");
    this.load.image("bg-openspace", "/assets/bg-openspace.png");
  }

  create() {
    this.makePlayerSprites();
    this.makeRect("tex-estagiario", 22, 30, COLORS.estagiario);
    this.makeRect("tex-analista", 28, 38, COLORS.analista);
    this.makeRect("tex-vr", 12, 12, COLORS.vr);
    this.makeRect("tex-platform", 32, 16, COLORS.platform);
    this.makeRect("tex-floor", 32, 16, COLORS.floor);
    this.makeRect("tex-baia", 64, 40, COLORS.baia);
    this.makeRect("tex-hitbox", 28, 24, 0xffffff);
    this.makeRect("tex-faxineiro", 32, 44, COLORS.faxineiro, 0xeeeeee);
    this.makeRect("tex-door", 36, 60, COLORS.door, 0xc9a36a);
    this.makeRect("tex-coffee", 28, 40, 0x6a4a3a, 0xeac08a);
    this.makeRect("tex-ponto", 28, 40, COLORS.ponto, 0x222222);
    // novos inimigos
    this.makeRect("tex-facilitador", 24, 36, 0x3a6a2a, 0xfff066); // verde com post-it amarelo
    this.makeRect("tex-scrum",       26, 34, 0x6a2a4a, 0xff8800); // roxo com laranja
    this.makeRect("tex-coordenador", 28, 40, 0x1a4a6a, 0x44ff88); // azul com verde neón
    this.makeRect("tex-senior",      32, 46, 0x3a3a3a, 0x884444); // cinza escuro com vermelho
    this.makeRect("tex-postit",      14, 14, 0xffee22, 0xffaa00); // post-it amarelo
    // boss + traps
    this.makeRect("tex-gerente",     36, 52, 0x1a0a2a, 0xf2c14e); // roxo escuro, gravata dourada
    this.makeRect("tex-convite",     46, 30, 0xf4f8f4, 0x22aa22); // papel branco com badge verde
    this.makeRect("tex-email",       22, 16, 0xf2c14e, 0x1a1a1a); // envelope dourado
    // weapons / projectiles
    this.makeRect("tex-inkproj",     10,  5, 0x2244cc, 0x88aaff); // ink projectile (caneta)

    this.scene.start("MenuScene");
  }

  private makePlayerSprites() {
    const W = 32, H = 48;
    // Palette
    const SK = 0xd4a07a; // skin
    const HR = 0x1a0c06; // hair (dark brown)
    const SH = 0xe8e8e0; // shirt (off-white)
    const TI = 0x1a2a5a; // tie (navy)
    const BT = 0x2a1a08; // belt/buckle
    const PT = 0x1a2030; // pants (dark navy)
    const SO = 0x0c0808; // shoes (black)
    const GL = 0x111111; // glasses frame
    const GS = 0xaabbcc; // glass lens tint

    // Draw head (hair + face + glasses) at (hx, hy) offset
    const dHead = (g: Phaser.GameObjects.Graphics, hx: number, hy: number) => {
      g.fillStyle(HR, 1);
      g.fillRect(hx + 9,  hy,      14, 4); // hair top
      g.fillRect(hx + 7,  hy + 2,  18, 5); // hair widened
      g.fillStyle(SK, 1);
      g.fillRect(hx + 6,  hy + 6,   3, 5); // L ear
      g.fillRect(hx + 23, hy + 6,   3, 5); // R ear
      g.fillRect(hx + 8,  hy + 5,  16, 14); // face
      g.fillStyle(HR, 1);
      g.fillRect(hx + 9,  hy + 5,  14, 3); // hair fringe over face
      g.fillStyle(GL, 1);
      g.fillRect(hx + 8,  hy + 9,   6, 4); // L lens frame
      g.fillRect(hx + 18, hy + 9,   6, 4); // R lens frame
      g.fillRect(hx + 14, hy + 10,  4, 1); // bridge
      g.fillRect(hx + 5,  hy + 11,  3, 1); // L arm
      g.fillRect(hx + 24, hy + 11,  3, 1); // R arm
      g.fillStyle(GS, 0.45);
      g.fillRect(hx + 9,  hy + 10,  4, 2); // L lens
      g.fillRect(hx + 19, hy + 10,  4, 2); // R lens
      g.fillStyle(0x8a6040, 1);
      g.fillRect(hx + 13, hy + 16,  6, 2); // mouth
    };

    // Draw torso (shirt + tie + belt) at (tx, ty)
    const dTorso = (g: Phaser.GameObjects.Graphics, tx: number, ty: number) => {
      g.fillStyle(SH, 1);
      g.fillRect(tx + 6,  ty,      20, 14); // shirt body
      g.fillRect(tx + 7,  ty,       5,  5); // L collar
      g.fillRect(tx + 20, ty,       5,  5); // R collar
      g.fillStyle(0xd0d0c8, 1);
      g.fillRect(tx + 7,  ty + 3,   4,  5); // L pocket
      g.fillStyle(TI, 1);
      g.fillRect(tx + 13, ty,       6, 14); // tie body
      g.fillRect(tx + 12, ty + 8,   8,  6); // tie wide end
      g.fillStyle(BT, 1);
      g.fillRect(tx + 6,  ty + 13, 20,  3); // belt
    };

    // ── IDLE ──────────────────────────────────────────────
    {
      const g = this.add.graphics();
      dHead(g, 0, 0);
      g.fillStyle(SK, 1); g.fillRect(13, 19, 6, 3); // neck
      dTorso(g, 0, 21);
      g.fillStyle(SH, 1);
      g.fillRect(1, 21, 5, 13); g.fillRect(26, 21, 5, 13); // arms
      g.fillStyle(SK, 1);
      g.fillRect(1, 33, 5,  4); g.fillRect(26, 33, 5,  4); // hands
      g.fillStyle(PT, 1);
      g.fillRect(8, 37, 7, 9); g.fillRect(17, 37, 7, 9);  // legs
      g.fillStyle(SO, 1);
      g.fillRect(7, 45, 9, 4); g.fillRect(16, 45, 10, 4); // shoes
      g.generateTexture("tex-player-idle", W, H);
      g.generateTexture("tex-player", W, H); // alias for HUD
      g.destroy();
    }

    // ── WALK 0 (R foot forward, L arm forward) ────────────
    {
      const g = this.add.graphics();
      dHead(g, 0, -1); // bob up
      g.fillStyle(SK, 1); g.fillRect(13, 18, 6, 3);
      dTorso(g, 0, 20);
      g.fillStyle(SH, 1);
      g.fillRect(1, 19, 5, 11); g.fillRect(26, 22, 5, 14); // L fwd, R back
      g.fillStyle(SK, 1);
      g.fillRect(1, 30, 5,  4); g.fillRect(26, 35, 5,  4);
      g.fillStyle(PT, 1);
      g.fillRect(7,  36, 7,  8); // L leg back
      g.fillRect(17, 35, 8, 10); // R leg forward
      g.fillStyle(SO, 1);
      g.fillRect(6,  43, 9,  4); // L shoe back
      g.fillRect(17, 44, 12, 4); // R shoe forward
      g.generateTexture("tex-player-walk0", W, H);
      g.destroy();
    }

    // ── WALK 1 (L foot forward, R arm forward) ────────────
    {
      const g = this.add.graphics();
      dHead(g, 0, 0); // bob down
      g.fillStyle(SK, 1); g.fillRect(13, 19, 6, 3);
      dTorso(g, 0, 21);
      g.fillStyle(SH, 1);
      g.fillRect(1, 22, 5, 14); g.fillRect(26, 19, 5, 11); // L back, R fwd
      g.fillStyle(SK, 1);
      g.fillRect(1, 35, 5,  4); g.fillRect(26, 30, 5,  4);
      g.fillStyle(PT, 1);
      g.fillRect(8,  35, 8, 10); // L leg forward
      g.fillRect(17, 36, 7,  8); // R leg back
      g.fillStyle(SO, 1);
      g.fillRect(7,  44, 12, 4); // L shoe forward
      g.fillRect(16, 43,  9, 4); // R shoe back
      g.generateTexture("tex-player-walk1", W, H);
      g.destroy();
    }

    // ── JUMP (arms raised, knees tucked) ──────────────────
    {
      const g = this.add.graphics();
      dHead(g, 0, 0);
      g.fillStyle(SK, 1); g.fillRect(13, 19, 6, 3);
      dTorso(g, 0, 21);
      g.fillStyle(SH, 1);
      g.fillRect(0, 16, 5, 9); g.fillRect(27, 16, 5, 9); // arms raised
      g.fillStyle(SK, 1);
      g.fillRect(0, 25, 5, 4); g.fillRect(27, 25, 5, 4);
      g.fillStyle(PT, 1);
      g.fillRect(7, 36, 7,  6); g.fillRect(16, 36, 7,  6); // upper legs
      g.fillRect(5, 40, 9,  4); g.fillRect(16, 40, 9,  4); // lower legs swept back
      g.fillStyle(SO, 1);
      g.fillRect(4, 43, 11, 4); g.fillRect(15, 43, 11, 4); // shoes tucked
      g.generateTexture("tex-player-jump", W, H);
      g.destroy();
    }

    // ── FALL (arms spread, legs down) ─────────────────────
    {
      const g = this.add.graphics();
      dHead(g, 0, 0);
      g.fillStyle(SK, 1); g.fillRect(13, 19, 6, 3);
      dTorso(g, 0, 21);
      g.fillStyle(SH, 1);
      g.fillRect(0, 21, 6, 10); g.fillRect(26, 21, 6, 10); // arms wide
      g.fillStyle(SK, 1);
      g.fillRect(0, 31, 6,  4); g.fillRect(26, 31, 6,  4);
      g.fillStyle(PT, 1);
      g.fillRect(8, 37, 7, 10); g.fillRect(17, 37, 7, 10); // legs extended
      g.fillStyle(SO, 1);
      g.fillRect(7, 46, 9,  2); g.fillRect(16, 46, 10, 2); // toe tips visible
      g.generateTexture("tex-player-fall", W, H);
      g.destroy();
    }

    // ── ATTACK (forward lean, grampeador extended) ─────────
    {
      const g = this.add.graphics();
      dHead(g, 1, 0); // slight lean
      g.fillStyle(SK, 1); g.fillRect(14, 19, 6, 3);
      dTorso(g, 1, 21);
      // Right arm extended with weapon
      g.fillStyle(SH, 1);
      g.fillRect(26, 20, 5,  8);
      g.fillStyle(SK, 1);
      g.fillRect(27, 27, 5,  4); // hand
      // Grampeador (weapon)
      g.fillStyle(0x777777, 1);
      g.fillRect(29, 21,  9,  6); // body
      g.fillStyle(0x444444, 1);
      g.fillRect(30, 27,  7,  3); // jaw
      g.fillStyle(0xcc4444, 1);
      g.fillRect(34, 21,  3,  4); // trigger guard
      // Left arm back/bracing
      g.fillStyle(SH, 1);
      g.fillRect(0, 21, 5, 14);
      g.fillStyle(SK, 1);
      g.fillRect(0, 35, 5,  4);
      // Legs — wide attack stance
      g.fillStyle(PT, 1);
      g.fillRect(6,  37, 8, 10); // L back
      g.fillRect(17, 36, 9, 11); // R forward
      g.fillStyle(SO, 1);
      g.fillRect(5,  46, 10, 4);
      g.fillRect(17, 46, 12, 4);
      g.generateTexture("tex-player-attack", W, H);
      g.destroy();
    }

    // ── DASH (body horizontal, speed lines) ───────────────
    {
      const g = this.add.graphics();
      // Head shifted right/forward, tilted
      g.fillStyle(HR, 1);
      g.fillRect(17, 13, 13, 3);
      g.fillRect(16, 15, 14, 5);
      g.fillStyle(SK, 1);
      g.fillRect(16, 18, 13, 10);
      g.fillStyle(GL, 1);
      g.fillRect(17, 20, 5, 4);
      g.fillRect(23, 20, 5, 4);
      g.fillRect(22, 21, 1, 1);
      g.fillStyle(GS, 0.4);
      g.fillRect(18, 21, 3, 2);
      g.fillRect(24, 21, 3, 2);
      // Tilted body
      g.fillStyle(SH, 1);
      g.fillRect(4, 25, 18, 9);
      g.fillStyle(TI, 1);
      g.fillRect(12, 25, 5, 9);
      g.fillStyle(BT, 1);
      g.fillRect(4, 33, 18, 3);
      // Trailing legs
      g.fillStyle(PT, 1);
      g.fillRect(0, 30,  8, 5);
      g.fillRect(2, 34,  7, 5);
      g.fillStyle(SO, 1);
      g.fillRect(0, 34,  9, 4);
      g.fillRect(2, 38,  7, 3);
      // Speed lines
      g.fillStyle(0xffffff, 0.22);
      g.fillRect(0, 23, 8, 2);
      g.fillRect(0, 28, 5, 2);
      g.fillRect(0, 32, 6, 2);
      g.generateTexture("tex-player-dash", W, H);
      g.destroy();
    }
  }

  private makeRect(key: string, w: number, h: number, fill: number, accent?: number) {
    const g = this.add.graphics();
    g.fillStyle(fill, 1);
    g.fillRect(0, 0, w, h);
    if (accent !== undefined) {
      // little "shirt" stripe
      g.fillStyle(accent, 1);
      g.fillRect(0, Math.floor(h * 0.45), w, Math.floor(h * 0.2));
    }
    g.lineStyle(2, 0x000000, 0.4);
    g.strokeRect(1, 1, w - 2, h - 2);
    g.generateTexture(key, w, h);
    g.destroy();
  }
}
