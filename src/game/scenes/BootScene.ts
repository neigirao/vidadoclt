import Phaser from "phaser";
import {
  makeFurnitureTextures,
  makeOfficeBackgrounds,
  makeUiTextures,
  makeObjectTextures,
  applyBackgroundFilters,
} from "../systems/TextureFactory";

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
    // Real character sprites (PNG with transparency)
    this.load.image("tex-player-idle",   "/assets/sprites/player-idle.png");
    this.load.image("tex-player",        "/assets/sprites/player-idle.png"); // HUD alias
    this.load.image("tex-player-walk0",  "/assets/sprites/player-walk0.png");
    this.load.image("tex-player-walk1",  "/assets/sprites/player-walk1.png");
    this.load.image("tex-player-jump",   "/assets/sprites/player-jump.png");
    this.load.image("tex-player-fall",   "/assets/sprites/player-jump.png"); // reuse jump for fall
    this.load.image("tex-player-attack", "/assets/sprites/player-attack.png");
    this.load.image("tex-player-dash",   "/assets/sprites/player-dash.png");
    // Enemies (fase 1 — já implementados)
    this.load.image("tex-estagiario",    "/assets/sprites/enemy-estagiario.png");
    this.load.image("tex-analista",      "/assets/sprites/enemy-analista.png");
    this.load.image("tex-facilitador",   "/assets/sprites/enemy-facilitador.png");
    this.load.image("tex-scrum",         "/assets/sprites/enemy-scrum.png");
    this.load.image("tex-coordenador",   "/assets/sprites/enemy-coordenador.png");
    this.load.image("tex-senior",        "/assets/sprites/enemy-senior.png");
    // Boss
    this.load.image("tex-gerente",       "/assets/sprites/enemy-gerente.png");
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
    // Objetos interativos
    this.load.image("tex-cafe-machine",  "/assets/sprites/obj-cafe-machine.png");
    this.load.image("tex-bebedouro",     "/assets/sprites/obj-bebedouro.png");
    this.load.image("tex-obj-impressora","/assets/sprites/obj-impressora.png");
    this.load.image("tex-elevador",      "/assets/sprites/obj-elevador.png");
    this.load.image("tex-porta-reuniao", "/assets/sprites/obj-porta-reuniao.png");
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
  }

  create() {
    makeUiTextures(this);
    makeFurnitureTextures(this);
    makeObjectTextures(this);
    makeOfficeBackgrounds(this);
    applyBackgroundFilters(this);

    this.scene.start("MenuScene");
  }
}
