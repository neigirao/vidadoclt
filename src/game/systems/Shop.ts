import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../constants";
import { getRun } from "./PlayerState";

export type ShopItem = {
  key: string;
  label: string;
  cost: number;
  apply: (scene: Phaser.Scene) => string | void; // returns optional message
};

const ITEMS: ShopItem[] = [
  {
    key: "cafe",
    label: "Café Triplo (+30 Energia)",
    cost: 4,
    apply: (s) => {
      const r = getRun(s);
      r.energy = Math.min(100, r.energy + 30);
    },
  },
  {
    key: "pausa",
    label: "Pausa de 5min (+40 Sanidade)",
    cost: 6,
    apply: (s) => {
      const r = getRun(s);
      r.sanity = Math.min(100, r.sanity + 40);
    },
  },
  {
    key: "bater_ponto",
    label: "Bater o ponto e avançar (próxima área)",
    cost: 0,
    apply: () => "next",
  },
];

export class ShopUI {
  private container?: Phaser.GameObjects.Container;
  private msg?: Phaser.GameObjects.Text;
  private keys: Phaser.Input.Keyboard.Key[] = [];
  private escKey?: Phaser.Input.Keyboard.Key;
  private prevDown = [false, false, false, false];
  open = false;
  onAdvance?: () => void;

  constructor(private scene: Phaser.Scene) {}

  toggle() {
    if (this.open) this.close();
    else this.show();
  }

  show() {
    if (this.open) return;
    this.open = true;
    const run = getRun(this.scene);

    const c = this.scene.add.container(GAME_WIDTH / 2, GAME_HEIGHT / 2).setScrollFactor(0).setDepth(2000);
    const panel = this.scene.add.rectangle(0, 0, 480, 280, 0x0a0c10, 0.95).setStrokeStyle(2, 0xf2c14e);
    const title = this.scene.add
      .text(0, -120, "PONTO ELETRÔNICO", { fontFamily: "monospace", fontSize: "18px", color: "#f2c14e" })
      .setOrigin(0.5);
    const vr = this.scene.add
      .text(0, -94, `VR disponível: ${run.vr}`, { fontFamily: "monospace", fontSize: "12px", color: "#eaeaea" })
      .setOrigin(0.5);

    c.add([panel, title, vr]);

    ITEMS.forEach((item, i) => {
      const y = -50 + i * 44;
      const row = this.scene.add
        .text(0, y, `[${i + 1}]  ${item.label}${item.cost ? `  —  ${item.cost} VR` : "  —  grátis"}`, {
          fontFamily: "monospace",
          fontSize: "14px",
          color: "#ffffff",
        })
        .setOrigin(0.5);
      c.add(row);
    });

    const hint = this.scene.add
      .text(0, 110, "1/2/3 para comprar  •  ESC para fechar", {
        fontFamily: "monospace",
        fontSize: "11px",
        color: "#aaaaaa",
      })
      .setOrigin(0.5);
    c.add(hint);

    this.msg = this.scene.add
      .text(0, 80, "", { fontFamily: "monospace", fontSize: "12px", color: "#f2c14e" })
      .setOrigin(0.5);
    c.add(this.msg);

    this.container = c;

    const kb = this.scene.input.keyboard!;
    this.keys = [
      kb.addKey(Phaser.Input.Keyboard.KeyCodes.ONE),
      kb.addKey(Phaser.Input.Keyboard.KeyCodes.TWO),
      kb.addKey(Phaser.Input.Keyboard.KeyCodes.THREE),
    ];
    this.escKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.prevDown = [false, false, false, false];
  }

  close() {
    if (!this.open) return;
    this.open = false;
    this.container?.destroy();
    this.container = undefined;
    this.msg = undefined;
  }

  update() {
    if (!this.open) return;
    if (this.escKey?.isDown) {
      this.close();
      return;
    }
    for (let i = 0; i < ITEMS.length; i++) {
      const down = this.keys[i]?.isDown ?? false;
      if (down && !this.prevDown[i]) this.buy(ITEMS[i]);
      this.prevDown[i] = down;
    }
  }

  private buy(item: ShopItem) {
    const run = getRun(this.scene);
    if (run.vr < item.cost) {
      this.msg?.setText("VR insuficiente.");
      return;
    }
    run.vr -= item.cost;
    const result = item.apply(this.scene);
    if (result === "next") {
      this.close();
      this.onAdvance?.();
      return;
    }
    this.msg?.setText(`Comprado: ${item.label}`);
  }
}
