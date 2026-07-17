import Phaser from "phaser";
import { Telemetry } from "../systems/Telemetry";
import {
  makeFurnitureTextures,
  makeOfficeBackgrounds,
  makeUiTextures,
  makeObjectTextures,
  applyBackgroundFilters,
} from "../systems/TextureFactory";
import { initSpriteLibrary } from "../systems/SpriteLibrary";
import { scanAtlasFrameCounts } from "../systems/AtlasFrameScan";
import { loadSpriteOverrides, installSpriteOverrides } from "../systems/SpriteOverrides";
import { bgUrl } from "../systems/BgOverrides";
import { applyAudioSettings } from "../systems/applyAudio";

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
    this.load.image("bg-menu", bgUrl("bg-menu"));
    this.load.image("bg-openspace", bgUrl("bg-openspace"));
    this.load.image("tex-floor", "/assets/sprites/tile-floor.png");
    this.load.image("tex-vr", "/assets/sprites/item-vr-coin.png");
    this.load.image("tex-inkproj", "/assets/sprites/item-inkproj.png");
    this.load.image("tex-coffee", "/assets/sprites/item-coffee-cup.png");
    this.load.image("tex-door", "/assets/sprites/obj-door.png");
    this.load.image("tex-ponto", "/assets/sprites/obj-ponto.png");
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

    // Conta os frames que REALMENTE existem no atlas (arte subida pelo LAB direto
    // no atlas) e ajusta as contagens de animação → o jogo cicla o que está lá,
    // sem precisar editar EnemyAnimConfig na mão. Só AUMENTA; lixo legado vazio
    // continua fora (para na 1ª lacuna/frame vazio).
    scanAtlasFrameCounts(this);

    // Overrides de FRAME refeitos pela IA online (Supabase Storage/IndexedDB) —
    // aplicados POR CIMA do atlas sem reempacotar. Fire-and-forget: carrega e
    // instala em background (o MenuScene não usa sprites de jogo; as fases só
    // começam bem depois, já com os overrides no lugar).
    void loadSpriteOverrides().then(() => installSpriteOverrides(this));

    // Aplica volumes/mudo salvos antes de qualquer áudio tocar.
    applyAudioSettings();
    Telemetry.newSession();

    this.scene.start("MenuScene");
  }
}
