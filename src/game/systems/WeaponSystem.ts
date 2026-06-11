export type WeaponId = "grampeador" | "caneta" | "regua";
export type ClassId  = "estagiario" | "analista" | "terceirizado";

export type WeaponDef = {
  id: WeaponId;
  name: string;
  hitDamage: number;
  ranged: boolean;
  rangedDamage: number;
  attackRange: number;
};

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
  grampeador: { id: "grampeador", name: "Grampeador",    hitDamage: 14, ranged: false, rangedDamage: 0,  attackRange: 32 },
  caneta:     { id: "caneta",     name: "Caneta Bic",    hitDamage: 7,  ranged: true,  rangedDamage: 12, attackRange: 20 },
  regua:      { id: "regua",      name: "Regua de 30cm", hitDamage: 11, ranged: false, rangedDamage: 0,  attackRange: 44 },
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
