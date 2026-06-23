export type BossPhase = {
  hpThreshold: number;
  speed: number;
  tint?: number;
};

export type BossAttackDef = {
  duration: number;
  color: number;
  name: string;
};

export const GERENTE_HP = 500;
export const GERENTE_SWING_DAMAGE = 28;
export const GERENTE_CONTACT_DAMAGE = 10;

export const GERENTE_PHASES: BossPhase[] = [
  { hpThreshold: 1.0, speed: 0, tint: undefined },
  { hpThreshold: 0.3, speed: 0, tint: 0xff7755 },
];

export const GERENTE_ATTACKS: Record<string, BossAttackDef> = {
  follow_up:   { duration: 500, color: 0xffaa00, name: "Follow-Up!" },
  alinhamento: { duration: 680, color: 0x4488ff, name: "ALINHAMENTO" },
  atualizacao: { duration: 380, color: 0xff3300, name: "ATUALIZACAO RAPIDA!" },
  reuniao:     { duration: 780, color: 0xaa00aa, name: "REUNIAO EMERGENCIAL" },
  freeze:      { duration: 880, color: 0xf0f0ff, name: "VOCE TEM 5 MINUTOS?" },
  deadline:    { duration: 480, color: 0xff0000, name: "DEADLINE INADIAVEL!" },
};

export const CEO_HP = 500;
export const CEO_SWING_DAMAGE = 25;
export const CEO_CONTACT_DAMAGE = 18;

export const CEO_PHASES: BossPhase[] = [
  { hpThreshold: 1.0,  speed: 60,  tint: undefined },
  { hpThreshold: 350 / CEO_HP, speed: 100, tint: 0xff8800 },
  { hpThreshold: 150 / CEO_HP, speed: 130, tint: 0xff0000 },
];
