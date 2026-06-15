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
    // Sprites carregados de forma redundante foram removidos: agora TODOS
    // os frames de personagem/inimigo/chefe/objeto/decoração vêm do atlas
    // único (resolveSprite/addImage/applyTexture). Mantemos como textura
    // standalone apenas as 6 chaves criadas DIRETO via fábrica do Phaser
    // (tileSprite / group.create / add.image sem passar pela SpriteLibrary):
    this.load.image("tex-floor",   "/assets/sprites/tile-floor.png");   // tileSprite do chão
    this.load.image("tex-vr",      "/assets/sprites/item-vr-coin.png"); // drops (group.create)
    this.load.image("tex-inkproj", "/assets/sprites/item-inkproj.png"); // projéteis (group.create)
    this.load.image("tex-coffee",  "/assets/sprites/item-coffee-cup.png"); // add.image (Copa)
    this.load.image("tex-door",    "/assets/sprites/obj-door.png");     // add.image (portas)
    this.load.image("tex-ponto",   "/assets/sprites/obj-ponto.png");    // add.image (Copa)
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
