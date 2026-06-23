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
    // BootScene is kept as fallback only — PreloadScene handles the real load.
    // If BootScene is ever started directly, load the same minimal set.
    this.load.image("bg-menu",    "/assets/bg-menu.png");
    this.load.image("tex-floor",  "/assets/sprites/tile-floor.png");
    this.load.image("tex-vr",     "/assets/sprites/item-vr-coin.png");
    this.load.image("tex-inkproj","/assets/sprites/item-inkproj.png");
    this.load.image("tex-coffee", "/assets/sprites/item-coffee-cup.png");
    this.load.image("tex-door",   "/assets/sprites/obj-door.png");
    this.load.image("tex-ponto",  "/assets/sprites/obj-ponto.png");
    this.load.atlas("sprites", "/assets/atlas.png", "/assets/atlas.json");
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
