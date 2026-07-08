import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../constants";
import { getRun, RunState } from "./PlayerState";
import { Sfx } from "./AudioSystem";
import { WEAPONS, WeaponId, WeaponDef } from "./WeaponSystem";
import { PERKS, PerkId, applyPerk } from "./PerkSystem";
import { Player } from "../entities/Player";

export type ConsumableId = "cafe_triplo" | "pausa_5min";

export type ConsumableDef = {
  id: ConsumableId;
  label: string;
  basePrice: number;
  healAmount: number;
  healAmountWithPerk: number;
  statHealed: "sanity" | "energy";
};

export const CONSUMABLES: Record<ConsumableId, ConsumableDef> = {
  cafe_triplo: {
    id: "cafe_triplo",
    label: "Café Triplo",
    basePrice: 6, // era 4 — economia de VR: mais tensão de escolha na 1ª Copa
    healAmount: 30,
    healAmountWithPerk: 45,
    statHealed: "energy",
  },
  pausa_5min: {
    id: "pausa_5min",
    label: "Pausa de 5min",
    basePrice: 9, // era 6
    healAmount: 40,
    healAmountWithPerk: 60,
    statHealed: "sanity",
  },
};

const RARITY_COLORS: Record<string, string> = {
  comum: "#aaaaaa",
  raro: "#4488ff",
  epico: "#aa44ff",
  lendario: "#ffaa00",
};

const WEAPON_FLAVOR: Partial<Record<WeaponId, string>> = {
  regua: "Ideal pra medir quanto da sua paciência ainda sobrou.",
  furador: "Já furou 400 folhas de relatório inútil hoje.",
  mouse: "Sem fio. Sem limite. Sem processo trabalhista.",
  teclado: "R$ 800 na Amazon. Custo emocional: inestimável.",
  caneca: "Diz 'Melhor Funcionário 2019'. O único prêmio que você ganhou.",
  impressora: "O papel emperrou. O inimigo também vai emperrar.",
  notebook: "Leva 15 min pra ligar e ainda te persegue.",
  projetor: "A reunião durou 3h. O projetor dói mais.",
  extintor: "Certificado pra extinguir incêndios, expectativas e carreiras.",
  grampeador_eletrico: "Modificado pelo TI terceirizado. Provavelmente ilegal.",
};

function rollShopWeapon(currentWeaponId: string, exclude: WeaponId[] = []): WeaponId {
  const pool: Array<{ id: WeaponId; weight: number }> = [];
  for (const [id, def] of Object.entries(WEAPONS) as [WeaponId, WeaponDef][]) {
    if (def.shopCost === 0) continue; // not sold (starter / lendário)
    if (id === currentWeaponId) continue;
    if (exclude.includes(id)) continue;
    let weight = 0;
    if (def.rarity === "raro") weight = 60;
    if (def.rarity === "epico") weight = 30;
    if (def.rarity === "lendario") weight = 10;
    if (def.rarity === "comum") weight = 0; // comum not in shop
    if (weight > 0) pool.push({ id, weight });
  }
  if (pool.length === 0) return "regua"; // fallback
  const total = pool.reduce((s, e) => s + e.weight, 0);
  let r = Math.random() * total;
  for (const entry of pool) {
    r -= entry.weight;
    if (r <= 0) return entry.id;
  }
  return pool[pool.length - 1].id;
}

// Rola até `n` armas DISTINTAS. Oferecer mais de uma cria a escolha "qual arma"
// e faz a prateleira da Copa custar mais que a carteira → tensão de decisão.
function rollShopWeapons(currentWeaponId: string, n: number): WeaponId[] {
  const out: WeaponId[] = [];
  for (let i = 0; i < n; i++) {
    const w = rollShopWeapon(currentWeaponId, out);
    if (out.includes(w)) break; // pool esgotou
    out.push(w);
  }
  return out;
}

function rollShopPerk(ownedPerks: PerkId[], exclude: PerkId[] = []): PerkId | null {
  const all = Object.keys(PERKS) as PerkId[];
  const available = all.filter((p) => !ownedPerks.includes(p) && !exclude.includes(p));
  if (available.length === 0) return null;
  return available[Math.floor(Math.random() * available.length)];
}

function rollShopPerks(ownedPerks: PerkId[], n: number): PerkId[] {
  const out: PerkId[] = [];
  for (let i = 0; i < n; i++) {
    const p = rollShopPerk(ownedPerks, out);
    if (!p) break;
    out.push(p);
  }
  return out;
}

type DynamicItem = {
  key: string;
  label: string;
  description: string;
  flavor?: string;
  cost: number;
  rarityColor?: string;
  apply: (run: RunState, shop: ShopUI) => string | "next" | void;
};

export class ShopUI {
  private container?: Phaser.GameObjects.Container;
  private msg?: Phaser.GameObjects.Text;
  private keys: Phaser.Input.Keyboard.Key[] = [];
  private escKey?: Phaser.Input.Keyboard.Key;
  private prevDown: boolean[] = [];
  private bought = new Set<string>(); // armas/perks já compradas nesta visita
  private items: DynamicItem[] = [];
  open = false;
  onAdvance?: () => void;
  onWeaponChange?: (id: WeaponId) => void;
  private player?: Player;

  constructor(private scene: Phaser.Scene) {}

  setPlayer(player: Player) {
    this.player = player;
  }

  toggle() {
    if (this.open) this.close();
    else this.show();
  }

  show() {
    if (this.open) return;
    this.open = true;
    const run = getRun(this.scene);

    // Roll shop inventory if not already rolled. Oferece 2 armas + 2 perks
    // (prateleira > carteira) → o jogador precisa escolher, não compra tudo.
    if (run.shopWeapons === undefined) {
      run.shopWeapons = rollShopWeapons(run.weaponId ?? "grampeador", 2);
    }
    if (run.shopPerks === undefined) {
      run.shopPerks = rollShopPerks(run.perks ?? [], 2);
    }

    // Build item list
    this.items = [];

    // Consumíveis
    const cafe = CONSUMABLES.cafe_triplo;
    const cafeHeal = run.cafeForte ? cafe.healAmountWithPerk : cafe.healAmount;
    this.items.push({
      key: "cafe",
      label: `${cafe.label} (+${cafeHeal} Energia)`,
      description: run.cafeForte ? "Café Forte ativo: cura bônus!" : "Restaura Energia.",
      cost: cafe.basePrice,
      apply: (_r, shop) => {
        if (shop.player) {
          shop.player.energy = Math.min(shop.player.maxEnergy, shop.player.energy + cafeHeal);
        }
      },
    });

    const pausa = CONSUMABLES.pausa_5min;
    const pausaHeal = run.cafeForte ? pausa.healAmountWithPerk : pausa.healAmount;
    this.items.push({
      key: "pausa",
      label: `${pausa.label} (+${pausaHeal} Sanidade)`,
      description: run.cafeForte ? "Café Forte ativo: cura bônus!" : "Restaura Sanidade.",
      cost: pausa.basePrice,
      apply: (_r, shop) => {
        if (shop.player) {
          shop.player.sanity = Math.min(shop.player.maxSanity, shop.player.sanity + pausaHeal);
        }
      },
    });

    // Weapon slots (até 2 armas — escolha "qual arma"; comprar uma remove só ela)
    (run.shopWeapons ?? []).forEach((wid) => {
      const wdef = WEAPONS[wid];
      this.items.push({
        key: `weapon_${wid}`,
        label: wdef.name,
        description: `${wdef.type === "ranged" ? "Ranged" : "Melee"} — Dano: ${wdef.hitDamages[0]}/${wdef.hitDamages[1]}/${wdef.hitDamages[2] || "—"}`,
        flavor: WEAPON_FLAVOR[wid],
        cost: wdef.shopCost,
        rarityColor: RARITY_COLORS[wdef.rarity],
        apply: (r, shop) => {
          r.weaponId = wid;
          run.shopWeapons = (run.shopWeapons ?? []).filter((w) => w !== wid);
          shop.onWeaponChange?.(wid);
        },
      });
    });

    // Perk slots (até 2 perks — perks empilham; comprar um remove só ele)
    (run.shopPerks ?? []).forEach((pid) => {
      const pdef = PERKS[pid];
      this.items.push({
        key: `perk_${pid}`,
        label: `${pdef.icon} ${pdef.name}`,
        description: pdef.description,
        flavor: pdef.flavor,
        cost: pdef.shopCost,
        rarityColor: "#44cc88",
        apply: (r, shop) => {
          if (shop.player) applyPerk(pid, shop.player, r);
          run.shopPerks = (run.shopPerks ?? []).filter((pp) => pp !== pid);
        },
      });
    });

    // Advance
    this.items.push({
      key: "bater_ponto",
      label: "Bater o ponto e avançar",
      description: "Próxima área.",
      cost: 0,
      apply: () => "next",
    });

    // Render
    const c = this.scene.add
      .container(GAME_WIDTH / 2, GAME_HEIGHT / 2)
      .setScrollFactor(0)
      .setDepth(2000);
    const rowH = 64;
    const panelH = 80 + this.items.length * rowH;
    const panel = this.scene.add
      .rectangle(0, 0, 530, panelH, 0x0a0c10, 0.95)
      .setStrokeStyle(2, 0xf2c14e);
    const title = this.scene.add
      .text(0, -panelH / 2 + 16, "PONTO ELETRÔNICO", {
        fontFamily: "monospace",
        fontSize: "18px",
        color: "#f2c14e",
      })
      .setOrigin(0.5);
    const vrText = this.scene.add
      .text(0, -panelH / 2 + 36, `VR disponível: ${run.vr}`, {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#eaeaea",
      })
      .setOrigin(0.5);
    c.add([panel, title, vrText]);

    const startY = -panelH / 2 + 66;
    this.items.forEach((item, i) => {
      const y = startY + i * rowH;
      const color = item.rarityColor ?? "#ffffff";
      const costStr = item.cost > 0 ? `  —  ${item.cost} VR` : "  —  grátis";
      const row = this.scene.add
        .text(0, y, `[${i + 1}]  ${item.label}${costStr}`, {
          fontFamily: "monospace",
          fontSize: "13px",
          color,
        })
        .setOrigin(0.5);
      const desc = this.scene.add
        .text(0, y + 16, item.description, {
          fontFamily: "monospace",
          fontSize: "10px",
          color: "#888888",
        })
        .setOrigin(0.5);
      c.add([row, desc]);
      if (item.flavor) {
        const flav = this.scene.add
          .text(0, y + 30, `"${item.flavor}"`, {
            fontFamily: "monospace",
            fontSize: "9px",
            color: "#998866",
            fontStyle: "italic",
          })
          .setOrigin(0.5);
        c.add(flav);
      }
    });

    const hint = this.scene.add
      .text(0, panelH / 2 - 20, `1-${this.items.length} para comprar  •  ESC para fechar`, {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#aaaaaa",
      })
      .setOrigin(0.5);
    c.add(hint);

    this.msg = this.scene.add
      .text(0, panelH / 2 - 6, "", { fontFamily: "monospace", fontSize: "11px", color: "#f2c14e" })
      .setOrigin(0.5);
    c.add(this.msg);

    this.container = c;

    const kb = this.scene.input.keyboard!;
    // Uma tecla por item (a Copa agora oferece até 7: 2 consumíveis + 2 armas +
    // 2 perks + avançar). Antes só ONE..FIVE — itens 6/7 ficavam inalcançáveis.
    const NUM = [
      Phaser.Input.Keyboard.KeyCodes.ONE,
      Phaser.Input.Keyboard.KeyCodes.TWO,
      Phaser.Input.Keyboard.KeyCodes.THREE,
      Phaser.Input.Keyboard.KeyCodes.FOUR,
      Phaser.Input.Keyboard.KeyCodes.FIVE,
      Phaser.Input.Keyboard.KeyCodes.SIX,
      Phaser.Input.Keyboard.KeyCodes.SEVEN,
      Phaser.Input.Keyboard.KeyCodes.EIGHT,
    ];
    this.keys = this.items.map((_, i) => kb.addKey(NUM[Math.min(i, NUM.length - 1)]));
    this.escKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.prevDown = new Array(this.items.length).fill(false);
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
    for (let i = 0; i < this.items.length; i++) {
      const down = this.keys[i]?.isDown ?? false;
      if (down && !this.prevDown[i]) this.buy(this.items[i]);
      this.prevDown[i] = down;
    }
  }

  private buy(item: DynamicItem) {
    const run = getRun(this.scene);
    // Armas/perks são compra única; café/pausa (consumíveis) repetem de propósito.
    const oneShot = item.key.startsWith("weapon_") || item.key.startsWith("perk_");
    if (oneShot && this.bought.has(item.key)) {
      this.msg?.setText("Já comprado.");
      return;
    }
    if (run.vr < item.cost) {
      this.msg?.setText("VR insuficiente.");
      return;
    }
    run.vr -= item.cost;
    if (oneShot) this.bought.add(item.key);
    Sfx.buy();
    const result = item.apply(run, this);
    if (result === "next") {
      this.close();
      this.onAdvance?.();
      return;
    }
    this.msg?.setText(`Comprado: ${item.label}`);
  }
}
