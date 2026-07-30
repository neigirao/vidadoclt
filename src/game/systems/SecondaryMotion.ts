import Phaser from "phaser";
import { loadSettings } from "./Settings";

// ─────────────────────────────────────────────────────────────────────────────
// SECONDARY MOTION — crachá corporativo pendurado no CLT que BALANÇA com o
// movimento. É o princípio de animação de "follow-through / overlapping action":
// um acessório com inércia própria que arrasta e ultrapassa o corpo → dá VIDA
// sem redesenhar sprite. Perfeito no tema (o crachá é o símbolo do CLT).
//
// POR QUE UM ELEMENTO SEPARADO (e não deformar o sprite): a arte é pixel-art de
// frames chapados (sem rig) e `pixelArt:true` faz rotação de sprite CINTILAR.
// Um crachá desenhado à parte (cordão + cartão) pode girar em torno do peito sem
// esse artefato — é pequeno e vetorial (graphics).
//
// FÍSICA: pêndulo mola-amortecedor. O ângulo-alvo é puxado pela ACELERAÇÃO
// horizontal do player (arranca → crachá fica pra trás; freia/vira → ultrapassa
// e oscila). Mola devolve a 0 (gravidade), amortecimento estabiliza. Determinístico.
//
// No-op sob `reduceSanityFx` (acessibilidade/perf).
// ─────────────────────────────────────────────────────────────────────────────

type Bodyish = { velocity: { x: number } };

export class SecondaryMotion {
  private g?: Phaser.GameObjects.Graphics;
  private angle = 0; // rad, 0 = pendurado reto pra baixo
  private angVel = 0;
  private prevVx = 0;
  // GEOMETRIA — conferida AMPLIANDO o player a 12×, não estimada.
  //
  // Estava `pivotDy = -12` e `len = 13`. Num sprite de 64px com origem no CENTRO,
  // -12 não é o peito: é a altura do ROSTO (20/64 a partir do topo). O cordão era
  // então desenhado por cima da cara, de cima a baixo, e o cartão caía na cintura
  // — a leitura resultante não era "crachá pendurado", era **um walkie-talkie com
  // antena**: caixa clara no quadril + risco vertical subindo pelo rosto.
  //
  // Peito de verdade fica logo abaixo do centro; e o cordão precisa ser CURTO,
  // senão o cartão desce para fora do torso.
  private readonly len = 6; // comprimento do cordão (px)
  private readonly pivotDy = 1; // altura do peito relativa ao centro do sprite

  constructor(
    private scene: Phaser.Scene,
    private target: Phaser.GameObjects.Sprite & { body?: Bodyish | null },
  ) {
    if (loadSettings().reduceSanityFx) return;
    this.g = scene.add.graphics().setDepth((target.depth ?? 10) + 1);
  }

  /** Integra o pêndulo e redesenha. Chamar no update da cena (dt em ms). */
  update(dt: number): void {
    const g = this.g;
    const t = this.target;
    if (!g) return;
    if (!t.active) {
      g.clear();
      return;
    }
    const h = Math.min(dt, 32) / 1000; // s (clamp p/ estabilidade em frame-drop)
    const vx = (t.body?.velocity.x ?? 0) as number;
    const ax = (vx - this.prevVx) / Math.max(h, 1e-3);
    this.prevVx = vx;

    // Alvo do ângulo: aceleração empurra o crachá pra trás; velocidade dá um leve
    // arrasto contínuo. Escalas pequenas → balanço sutil.
    const target = Phaser.Math.Clamp(-ax * 0.00035 - vx * 0.0009, -0.9, 0.9);
    const stiffness = 90; // mola (rad/s²/rad)
    const damping = 6.5; // amortecimento
    this.angVel += (stiffness * (target - this.angle) - damping * this.angVel) * h;
    this.angle += this.angVel * h;

    // Pivô no peito; cartão na ponta do cordão.
    const px = t.x;
    const py = t.y + this.pivotDy;
    const ex = px + Math.sin(this.angle) * this.len;
    const ey = py + Math.cos(this.angle) * this.len;

    g.clear();
    // Cordão (lanyard)
    g.lineStyle(1, 0x24406b, 1).lineBetween(px, py, ex, ey);
    // Cartão do crachá. Era 6×8 em BRANCO PURO (#f2f2ea) — medido, virava o pixel
    // MAIS CLARO de todo o personagem (lum 241 contra 229 do sprite inteiro) e
    // quase o dobro do brilho do torso (152 contra 82). Um acessório de movimento
    // secundário roubando o ponto focal do rosto é o oposto do objetivo: 4×5 num
    // cinza-papel, para ler como crachá e não como farol.
    const card = new Phaser.Geom.Rectangle(ex - 2, ey - 1, 4, 5);
    g.fillStyle(0xbcc0c6, 1).fillRectShape(card);
    g.fillStyle(0x2f5d8a, 1).fillRect(ex - 1, ey + 1, 2, 1); // "foto"
    g.lineStyle(1, 0x6a7078, 1).strokeRectShape(card);
  }

  destroy(): void {
    this.g?.destroy();
    this.g = undefined;
  }
}
