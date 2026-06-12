export type WeaponRarity = "comum" | "raro" | "epico" | "lendario";

export type WeaponId =
  | "grampeador" | "caneta" | "regua" | "furador"
  | "mouse" | "teclado" | "caneca" | "impressora" | "notebook"
  | "projetor" | "extintor"
  | "grampeador_eletrico";

export type SpecialType =
  | "burst_ranged" | "wide_sweep" | "aerial_spike" | "throw_weapon"
  | "emp_pulse" | "paper_spread" | "caneca_arc" | "wide_beam"
  | "spray_knockback" | "chain_lightning";

export type WeaponDef = {
  id: WeaponId;
  name: string;
  rarity: WeaponRarity;
  type: "melee" | "ranged";
  hitDamages: [number, number, number];  // combo steps 1/2/3
  attackRange: number;       // melee range px (ignored for ranged primary)
  attackSpeedMult: number;   // multiplier on 220ms base interval (0.7=faster)
  comboKnockback: number;    // final-hit knockback px
  hitSlow: number;           // ms to slow enemy on hit (0=none)
  rangedDamage: number;      // 0 if melee-only primary
  rangedSpeed: number;       // px/sec
  rangedPiercing: boolean;
  rangedBounce: number;      // max bounces (0=none)
  rangedHoming: boolean;
  hitAutoRanged: boolean;    // fires ranged on every melee hit
  specialName: string;
  specialCooldown: number;   // ms
  specialType: SpecialType;
  shopCost: number;          // VR cost (0 = not sold, e.g. starter or lendário)
};

export type ClassId = "estagiario" | "analista" | "terceirizado";

export type ClassDef = {
  id: ClassId;
  label: string;
  description: string;
  maxEnergy: number;
  maxSanity: number;
  speedMult: number;
  damageMult: number;
  vrMult: number;
  startWeapon: WeaponId;
  trait: string;
  color: number;
};

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  grampeador: {
    id: "grampeador", name: "Grampeador Tático", rarity: "comum", type: "melee",
    hitDamages: [10, 10, 15], attackRange: 32, attackSpeedMult: 1.0, comboKnockback: 320, hitSlow: 0,
    rangedDamage: 0, rangedSpeed: 0, rangedPiercing: false, rangedBounce: 0, rangedHoming: false, hitAutoRanged: false,
    specialName: "Rajada de Grampos", specialCooldown: 3000, specialType: "burst_ranged", shopCost: 0,
  },
  caneta: {
    id: "caneta", name: "Caneta Bic Tática", rarity: "comum", type: "ranged",
    hitDamages: [7, 7, 10], attackRange: 20, attackSpeedMult: 1.0, comboKnockback: 180, hitSlow: 0,
    rangedDamage: 10, rangedSpeed: 500, rangedPiercing: false, rangedBounce: 0, rangedHoming: false, hitAutoRanged: false,
    specialName: "Burst de 3 Tiros", specialCooldown: 3000, specialType: "paper_spread", shopCost: 0,
  },
  regua: {
    id: "regua", name: "Régua Metálica", rarity: "comum", type: "melee",
    hitDamages: [9, 9, 14], attackRange: 48, attackSpeedMult: 1.1, comboKnockback: 300, hitSlow: 0,
    rangedDamage: 0, rangedSpeed: 0, rangedPiercing: false, rangedBounce: 0, rangedHoming: false, hitAutoRanged: false,
    specialName: "Varredura Ampla", specialCooldown: 4000, specialType: "wide_sweep", shopCost: 8,
  },
  furador: {
    id: "furador", name: "Furador de Papel", rarity: "comum", type: "melee",
    hitDamages: [8, 8, 12], attackRange: 28, attackSpeedMult: 0.7, comboKnockback: 240, hitSlow: 0,
    rangedDamage: 0, rangedSpeed: 0, rangedPiercing: false, rangedBounce: 0, rangedHoming: false, hitAutoRanged: false,
    specialName: "Lançamento Vertical", specialCooldown: 4000, specialType: "aerial_spike", shopCost: 8,
  },
  mouse: {
    id: "mouse", name: "Mouse Sem Fio", rarity: "raro", type: "ranged",
    hitDamages: [8, 8, 12], attackRange: 24, attackSpeedMult: 1.0, comboKnockback: 200, hitSlow: 0,
    rangedDamage: 15, rangedSpeed: 550, rangedPiercing: false, rangedBounce: 2, rangedHoming: false, hitAutoRanged: false,
    specialName: "Chuva de Cliques", specialCooldown: 5000, specialType: "burst_ranged", shopCost: 12,
  },
  teclado: {
    id: "teclado", name: "Teclado Mecânico", rarity: "raro", type: "melee",
    hitDamages: [16, 25, 0], attackRange: 44, attackSpeedMult: 1.4, comboKnockback: 380, hitSlow: 600,
    rangedDamage: 0, rangedSpeed: 0, rangedPiercing: false, rangedBounce: 0, rangedHoming: false, hitAutoRanged: false,
    specialName: "Arremesso de Teclado", specialCooldown: 5000, specialType: "throw_weapon", shopCost: 12,
  },
  caneca: {
    id: "caneca", name: "Caneca de Café", rarity: "raro", type: "melee",
    hitDamages: [11, 11, 16], attackRange: 30, attackSpeedMult: 1.0, comboKnockback: 280, hitSlow: 0,
    rangedDamage: 0, rangedSpeed: 280, rangedPiercing: false, rangedBounce: 0, rangedHoming: false, hitAutoRanged: false,
    specialName: "Arremesso em Parábola", specialCooldown: 4500, specialType: "caneca_arc", shopCost: 10,
  },
  impressora: {
    id: "impressora", name: "Impressora", rarity: "raro", type: "ranged",
    hitDamages: [9, 9, 14], attackRange: 26, attackSpeedMult: 1.1, comboKnockback: 220, hitSlow: 0,
    rangedDamage: 18, rangedSpeed: 380, rangedPiercing: true, rangedBounce: 0, rangedHoming: false, hitAutoRanged: false,
    specialName: "Papel em 3 Vias", specialCooldown: 5000, specialType: "paper_spread", shopCost: 12,
  },
  notebook: {
    id: "notebook", name: "Notebook Corporativo", rarity: "raro", type: "ranged",
    hitDamages: [10, 10, 15], attackRange: 22, attackSpeedMult: 1.0, comboKnockback: 200, hitSlow: 0,
    rangedDamage: 20, rangedSpeed: 480, rangedPiercing: false, rangedBounce: 0, rangedHoming: true, hitAutoRanged: false,
    specialName: "Pulso EMP", specialCooldown: 7000, specialType: "emp_pulse", shopCost: 15,
  },
  projetor: {
    id: "projetor", name: "Projetor Corporativo", rarity: "epico", type: "ranged",
    hitDamages: [12, 12, 18], attackRange: 28, attackSpeedMult: 1.1, comboKnockback: 260, hitSlow: 0,
    rangedDamage: 22, rangedSpeed: 900, rangedPiercing: true, rangedBounce: 0, rangedHoming: false, hitAutoRanged: false,
    specialName: "Feixe Total", specialCooldown: 6000, specialType: "wide_beam", shopCost: 20,
  },
  extintor: {
    id: "extintor", name: "Extintor de Incêndio", rarity: "epico", type: "melee",
    hitDamages: [20, 20, 30], attackRange: 36, attackSpeedMult: 1.2, comboKnockback: 800, hitSlow: 400,
    rangedDamage: 0, rangedSpeed: 0, rangedPiercing: false, rangedBounce: 0, rangedHoming: false, hitAutoRanged: false,
    specialName: "Jato de CO₂", specialCooldown: 6000, specialType: "spray_knockback", shopCost: 20,
  },
  grampeador_eletrico: {
    id: "grampeador_eletrico", name: "Grampeador Elétrico", rarity: "lendario", type: "melee",
    hitDamages: [18, 18, 28], attackRange: 32, attackSpeedMult: 1.0, comboKnockback: 400, hitSlow: 0,
    rangedDamage: 0, rangedSpeed: 600, rangedPiercing: false, rangedBounce: 0, rangedHoming: false, hitAutoRanged: true,
    specialName: "Raio em Cadeia", specialCooldown: 8000, specialType: "chain_lightning", shopCost: 0,
  },
};

export const CLASSES: Record<ClassId, ClassDef> = {
  estagiario: {
    id: "estagiario", label: "Estagiario",
    description: "Rapido e agil.\nAtaque a distancia\ncom Caneta Bic.",
    maxEnergy: 80, maxSanity: 120,
    speedMult: 1.2, damageMult: 1.0, vrMult: 1.0,
    startWeapon: "caneta",
    trait: "+20% velocidade",
    color: 0x3a7a5a,
  },
  analista: {
    id: "analista", label: "Analista Pleno",
    description: "Equilibrado.\nGrampeador corpo-a-corpo\ncom bom dano.",
    maxEnergy: 100, maxSanity: 100,
    speedMult: 1.0, damageMult: 1.0, vrMult: 1.1,
    startWeapon: "grampeador",
    trait: "+10% VR drops",
    color: 0x3a4a8a,
  },
  terceirizado: {
    id: "terceirizado", label: "Terceirizado",
    description: "Resistente e potente.\nRegua de alcance longo\nmas mais lento.",
    maxEnergy: 130, maxSanity: 70,
    speedMult: 0.85, damageMult: 1.15, vrMult: 1.0,
    startWeapon: "regua",
    trait: "+15% dano, -15% velocidade",
    color: 0x8a3a3a,
  },
};
