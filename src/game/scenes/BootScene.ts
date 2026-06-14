import Phaser from "phaser";
import {
  makeFurnitureTextures,
  makeOfficeBackgrounds,
  makeUiTextures,
  makeObjectTextures,
  applyBackgroundFilters,
} from "../systems/TextureFactory";
import { initSpriteLibrary } from "../systems/SpriteLibrary";

/**
 * Loads image assets and delegates runtime texture generation
 * to systems/TextureFactory before starting the menu.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  preload() {
    this.load.image("bg-menu",       "/assets/bg-menu.png");
    this.load.image("bg-openspace",  "/assets/bg-openspace.png");
    this.load.image("bg-atendimento","/assets/bg-atendimento.png");
    this.load.image("bg-comercial",  "/assets/bg-comercial.png");
    this.load.image("bg-produto",    "/assets/bg-produto.png");
    this.load.image("bg-tecnologia", "/assets/bg-tecnologia.png");
    this.load.image("bg-rh",         "/assets/bg-rh.png");
    this.load.image("bg-compliance", "/assets/bg-compliance.png");
    this.load.image("bg-diretoria",  "/assets/bg-diretoria.png");
    this.load.image("bg-presidencia","/assets/bg-presidencia.png");
    this.load.image("bg-cobertura",  "/assets/bg-cobertura.png");
    this.load.image("bg-copa",       "/assets/bg-copa.png");
    // Real character sprites — 48 frames extracted from spritesheet v2 (48×64)
    this.load.image("tex-player",         "/assets/sprites/player-idle0.png"); // HUD alias
    // Idle (6 frames)
    for (let i = 0; i < 6; i++)
      this.load.image(`tex-player-idle${i}`, `/assets/sprites/player-idle${i}.png`);
    this.load.image("tex-player-idle", "/assets/sprites/player-idle0.png");
    // Walk (8 frames)
    for (let i = 0; i < 8; i++)
      this.load.image(`tex-player-walk${i}`, `/assets/sprites/player-walk${i}.png`);
    // Run (8 frames)
    for (let i = 0; i < 8; i++)
      this.load.image(`tex-player-run${i}`, `/assets/sprites/player-run${i}.png`);
    // Jump (4 frames), Fall (3 frames)
    for (let i = 0; i < 4; i++)
      this.load.image(`tex-player-jump${i}`, `/assets/sprites/player-jump${i}.png`);
    for (let i = 0; i < 3; i++)
      this.load.image(`tex-player-fall${i}`, `/assets/sprites/player-fall${i}.png`);
    this.load.image("tex-player-jump", "/assets/sprites/player-jump1.png");
    this.load.image("tex-player-fall", "/assets/sprites/player-fall0.png");
    // Attack (6 frames), Dash (4 frames)
    for (let i = 0; i < 6; i++)
      this.load.image(`tex-player-attack${i}`, `/assets/sprites/player-attack${i}.png`);
    for (let i = 0; i < 4; i++)
      this.load.image(`tex-player-dash${i}`, `/assets/sprites/player-dash${i}.png`);
    this.load.image("tex-player-attack", "/assets/sprites/player-attack2.png");
    this.load.image("tex-player-dash",   "/assets/sprites/player-dash0.png");
    // Hurt (2 frames), Interact (3 frames), Burnout (4 frames)
    for (let i = 0; i < 2; i++)
      this.load.image(`tex-player-hurt${i}`, `/assets/sprites/player-hurt${i}.png`);
    for (let i = 0; i < 3; i++)
      this.load.image(`tex-player-interact${i}`, `/assets/sprites/player-interact${i}.png`);
    for (let i = 0; i < 4; i++)
      this.load.image(`tex-player-burnout${i}`, `/assets/sprites/player-burnout${i}.png`);
    // Enemies (fase 1) — base + animated frames
    const phase1Enemies = ["estagiario", "analista", "facilitador", "scrum", "coordenador", "senior"];
    for (const name of phase1Enemies) {
      this.load.image(`tex-${name}`, `/assets/sprites/enemy-${name}.png`);
      for (let i = 0; i < 4; i++) this.load.image(`tex-${name}-idle${i}`, `/assets/sprites/enemy-${name}-idle${i}.png`);
      for (let i = 0; i < 4; i++) this.load.image(`tex-${name}-walk${i}`, `/assets/sprites/enemy-${name}-walk${i}.png`);
      for (let i = 0; i < 3; i++) this.load.image(`tex-${name}-attack${i}`, `/assets/sprites/enemy-${name}-attack${i}.png`);
      this.load.image(`tex-${name}-hurt0`, `/assets/sprites/enemy-${name}-hurt0.png`);
      for (let i = 0; i < 3; i++) this.load.image(`tex-${name}-death${i}`, `/assets/sprites/enemy-${name}-death${i}.png`);
    }
    // Boss — Gerente Microgestor
    this.load.image("tex-gerente",       "/assets/sprites/enemy-gerente.png");
    for (let i = 0; i < 2; i++) this.load.image(`tex-gerente-idle${i}`, `/assets/sprites/enemy-gerente-idle${i}.png`);
    for (let i = 0; i < 4; i++) this.load.image(`tex-gerente-walk${i}`, `/assets/sprites/enemy-gerente-walk${i}.png`);
    for (let i = 0; i < 4; i++) this.load.image(`tex-gerente-run${i}`,  `/assets/sprites/enemy-gerente-run${i}.png`);
    for (let i = 0; i < 3; i++) this.load.image(`tex-gerente-run-charge${i}`, `/assets/sprites/enemy-gerente-run-charge${i}.png`);
    for (let i = 0; i < 4; i++) this.load.image(`tex-gerente-attack-deadline${i}`, `/assets/sprites/enemy-gerente-attack-deadline${i}.png`);
    for (let i = 0; i < 4; i++) this.load.image(`tex-gerente-attack-escopo${i}`, `/assets/sprites/enemy-gerente-attack-escopo${i}.png`);
    for (let i = 0; i < 3; i++) this.load.image(`tex-gerente-attack-sprint${i}`, `/assets/sprites/enemy-gerente-attack-sprint${i}.png`);
    for (let i = 0; i < 3; i++) this.load.image(`tex-gerente-hurt${i}`,  `/assets/sprites/enemy-gerente-hurt${i}.png`);
    for (let i = 0; i < 3; i++) this.load.image(`tex-gerente-death${i}`, `/assets/sprites/enemy-gerente-death${i}.png`);
    // NPCs
    this.load.image("tex-faxineiro",     "/assets/sprites/npc-faxineiro.png");
    // Futuros inimigos (fases 2-5)
    this.load.image("tex-telemarketer",  "/assets/sprites/enemy-telemarketer.png");
    this.load.image("tex-impressora",    "/assets/sprites/enemy-impressora.png");
    this.load.image("tex-cabo",          "/assets/sprites/enemy-cabo.png");
    this.load.image("tex-evangelista",   "/assets/sprites/enemy-evangelista.png");
    this.load.image("tex-seguranca",     "/assets/sprites/enemy-seguranca.png");
    this.load.image("tex-ti-suporte",    "/assets/sprites/enemy-ti-suporte.png");
    this.load.image("tex-coletor",       "/assets/sprites/enemy-coletor.png");
    this.load.image("tex-noticeboard",   "/assets/sprites/enemy-noticeboard.png");
    this.load.image("tex-drone",         "/assets/sprites/enemy-drone.png");
    this.load.image("tex-carimbador",    "/assets/sprites/enemy-carimbador.png");
    this.load.image("tex-planilha",      "/assets/sprites/enemy-planilha.png");
    this.load.image("tex-arquivo",       "/assets/sprites/enemy-arquivo.png");
    this.load.image("tex-bateria",       "/assets/sprites/enemy-bateria.png");
    // Objetos interativos — usar estados idle para máxima qualidade
    this.load.image("tex-cafe-machine",  "/assets/sprites/obj-cafe-machine-idle.png");
    this.load.image("tex-bebedouro",     "/assets/sprites/obj-bebedouro-idle.png");
    this.load.image("tex-obj-impressora","/assets/sprites/obj-impressora-idle.png");
    this.load.image("tex-elevador",      "/assets/sprites/obj-elevador-idle.png");
    this.load.image("tex-porta-reuniao", "/assets/sprites/obj-porta-reuniao.png");
    // Decoração real — sprites PNG substituem texturas geradas por código
    this.load.image("tex-quadro-motivacional", "/assets/sprites/obj-quadro-motivacional-idle.png");
    this.load.image("tex-quadro-branco",       "/assets/sprites/obj-quadro-branco-idle.png");
    this.load.image("tex-planta-deco",         "/assets/sprites/obj-planta-empresa-idle.png");
    this.load.image("tex-bebedouro-deco",      "/assets/sprites/obj-bebedouro-idle.png");
    this.load.image("tex-pilha-docs",          "/assets/sprites/obj-pilha-papel-idle.png");
    this.load.image("tex-caixa-papel",         "/assets/sprites/obj-caixa-arquivos-idle.png");
    this.load.image("tex-monitor",             "/assets/sprites/obj-monitor-idle.png");
    this.load.image("tex-relogio",             "/assets/sprites/obj-relogio-idle.png");
    this.load.image("tex-lixeira",             "/assets/sprites/obj-lixeira-idle.png");
    this.load.image("tex-mesa-deco",           "/assets/sprites/obj-mesa-idle.png");
    // Tiles e decoração
    this.load.image("tex-platform",      "/assets/sprites/tile-platform.png");
    this.load.image("tex-floor",         "/assets/sprites/tile-floor.png");
    this.load.image("tex-baia",          "/assets/sprites/obj-baia.png");
    this.load.image("tex-door",          "/assets/sprites/obj-door.png");
    this.load.image("tex-ponto",         "/assets/sprites/obj-ponto.png");
    // Itens / collectibles
    this.load.image("tex-vr",            "/assets/sprites/item-vr-coin.png");
    this.load.image("tex-coffee",        "/assets/sprites/item-coffee-cup.png");
    this.load.image("tex-postit",        "/assets/sprites/item-postit.png");
    this.load.image("tex-convite",       "/assets/sprites/item-convite.png");
    this.load.image("tex-email",         "/assets/sprites/item-email.png");
    this.load.image("tex-inkproj",       "/assets/sprites/item-inkproj.png");
    // Sprite atlas (additive — provides tex keys via atlas lookup)
    this.load.atlas('sprites', '/assets/atlas.png', '/assets/atlas.json');
  }

  create() {
    makeUiTextures(this);
    makeFurnitureTextures(this);
    makeObjectTextures(this);
    makeOfficeBackgrounds(this);
    applyBackgroundFilters(this);

    // Indexa o atlas para que entidades/cenas resolvam sprites a partir de
    // uma única textura compartilhada (fim do rebind por frame = fim do flicker).
    initSpriteLibrary(this);

    this.scene.start("MenuScene");
  }
}
