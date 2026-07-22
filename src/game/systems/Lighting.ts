import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "../constants";
import { loadSettings } from "./Settings";

// ─────────────────────────────────────────────────────────────────────────────
// SISTEMA DE ILUMINAÇÃO — lightmap aditivo ("iluminação que chama atenção").
//
// POR QUE ESTA ABORDAGEM: a build do Phaser NÃO tem sprite.preFX/postFX e a rota
// de luz normal-mapeada (addImageLight) é um spike grande (ver docs/LIGHTING_SPIKE.md).
// Aqui usamos a técnica 2D clássica e proven: uma camada de ESCURECIMENTO ambiente
// + POÇAS DE LUZ radiais aditivas (BLEND_ADD) por fonte. O escuro assenta o clima;
// as luzes "cortam" o escuro e acendem player/monitores/aura do boss. Roda em
// qualquer WebGL, é barato (1 quad escuro + N quads aditivos) e determinístico.
//
// Precedente no código: o `Apagao` faz o inverso (escuridão com furo radial no
// player). Este é genérico e multi-fonte, pensado como TOOL reusável por fase.
//
// ACESSIBILIDADE/PERF: no-op sob `reduceSanityFx` (fotossensibilidade) e quando
// os Filters/WebGL não existem. As luzes são objetos de MUNDO (acompanham a
// câmera); o escuro ambiente é screen-space (cobre o viewport, scrollFactor 0).
// ─────────────────────────────────────────────────────────────────────────────

const LIGHT_TEX = "light-radial";
const DARK_DEPTH = 900; // acima do gameplay, abaixo do HUD (HUD usa 1000+)
const LIGHT_DEPTH = 901;

/** Gera 1× a textura de luz radial (branco no centro → transparente na borda). */
function ensureLightTexture(scene: Phaser.Scene): boolean {
  if (scene.textures.exists(LIGHT_TEX)) return true;
  const S = 256;
  const cnv = scene.textures.createCanvas(LIGHT_TEX, S, S);
  if (!cnv) return false;
  const ctx = cnv.getContext();
  const grad = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  // Falloff suave (quadrático) — centro cheio, cauda longa que sangra na borda.
  grad.addColorStop(0.0, "rgba(255,255,255,1)");
  grad.addColorStop(0.35, "rgba(255,255,255,0.55)");
  grad.addColorStop(0.7, "rgba(255,255,255,0.15)");
  grad.addColorStop(1.0, "rgba(255,255,255,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, S, S);
  cnv.refresh();
  return true;
}

export type LightOpts = {
  /** Raio da poça de luz em px (metade da largura do quad). Default 160. */
  radius?: number;
  /** Cor da luz (tint). Default 0xffffff (branca). */
  color?: number;
  /** Intensidade 0..~2 (alpha aditivo base). Default 1. */
  intensity?: number;
  /** Amplitude do flicker (0 = estável). Default 0. */
  flicker?: number;
  /** Velocidade do flicker (rad/s). Default 6. */
  flickerSpeed?: number;
};

/** Uma fonte de luz — mova com `setPosition`, remova com `destroy`. */
export class Light {
  readonly img: Phaser.GameObjects.Image;
  private base: number;
  private flicker: number;
  private flickerSpeed: number;
  private phase: number;

  constructor(scene: Phaser.Scene, x: number, y: number, opts: LightOpts) {
    const radius = opts.radius ?? 160;
    this.base = opts.intensity ?? 1;
    this.flicker = opts.flicker ?? 0;
    this.flickerSpeed = opts.flickerSpeed ?? 6;
    this.phase = Math.random() * Math.PI * 2;
    this.img = scene.add
      .image(x, y, LIGHT_TEX)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(LIGHT_DEPTH)
      .setDisplaySize(radius * 2, radius * 2)
      .setTint(opts.color ?? 0xffffff)
      .setAlpha(this.base);
  }

  setPosition(x: number, y: number): void {
    this.img.setPosition(x, y);
  }

  setRadius(radius: number): void {
    this.img.setDisplaySize(radius * 2, radius * 2);
  }

  setIntensity(v: number): void {
    this.base = v;
    this.img.setAlpha(v);
  }

  /** Chamado no update da cena p/ animar o flicker (t em ms). */
  tick(t: number): void {
    if (this.flicker <= 0) return;
    const f = Math.sin((t / 1000) * this.flickerSpeed + this.phase);
    this.img.setAlpha(Math.max(0, this.base + f * this.flicker));
  }

  destroy(): void {
    this.img.destroy();
  }
}

/**
 * Camada de iluminação de uma cena: escurecimento ambiente + luzes aditivas.
 * Instanciar 1× no create; `addLight` p/ cada fonte; `update(t)` no update.
 */
export class Lighting {
  private dark?: Phaser.GameObjects.Rectangle;
  private lights: Light[] = [];
  private enabled = false;

  /**
   * @param ambient 0..1 — quão escura fica a cena (0 = sem escurecimento,
   *   0.5 = penumbra, 0.8 = quase breu). Default 0.4.
   * @param ambientColor cor do escurecimento (frio/quente por bioma). Default azul-noite.
   */
  constructor(
    private scene: Phaser.Scene,
    ambient = 0.4,
    ambientColor = 0x060a14,
  ) {
    if (loadSettings().reduceSanityFx) return; // acessibilidade / fotossensibilidade
    if (!ensureLightTexture(scene)) return; // sem canvas/WebGL → no-op
    this.enabled = true;
    this.dark = scene.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, ambientColor, ambient)
      .setScrollFactor(0)
      .setDepth(DARK_DEPTH);
  }

  get active(): boolean {
    return this.enabled;
  }

  /** Adiciona uma fonte de luz (mundo). Retorna o handle (mova/pulse/destrua). */
  addLight(x: number, y: number, opts: LightOpts = {}): Light | null {
    if (!this.enabled) return null;
    const l = new Light(this.scene, x, y, opts);
    this.lights.push(l);
    return l;
  }

  /**
   * FLASH reativo one-shot: uma poça de luz que ACENDE forte e apaga sozinha —
   * a iluminação responde ao combate (impacto/morte/tiro clareiam o ambiente por
   * um instante em vez do lightmap ficar estático). Auto-destrói ao fim; barato.
   *
   * @param color cor do lampejo (branco p/ hit, dourado p/ VR, vermelho p/ boss…).
   * @param radius raio no ápice. @param intensity alpha no ápice. @param ms duração.
   */
  flash(x: number, y: number, color = 0xffffff, radius = 130, intensity = 1.1, ms = 200): void {
    if (!this.enabled) return;
    const img = this.scene.add
      .image(x, y, LIGHT_TEX)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(LIGHT_DEPTH)
      .setDisplaySize(radius * 0.6, radius * 0.6)
      .setTint(color)
      .setAlpha(intensity);
    this.scene.tweens.add({
      targets: img,
      displayWidth: radius * 2,
      displayHeight: radius * 2,
      alpha: 0,
      duration: ms,
      ease: "Quad.easeOut",
      onComplete: () => img.destroy(),
    });
  }

  /** Anima o flicker das luzes. Chamar no update da cena (t = this.time.now). */
  update(t: number): void {
    if (!this.enabled) return;
    for (const l of this.lights) l.tick(t);
  }

  destroy(): void {
    this.dark?.destroy();
    for (const l of this.lights) l.destroy();
    this.lights = [];
    this.enabled = false;
  }
}
