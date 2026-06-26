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

export type BossDef = {
  id: string;
  label: string;
  hp: number;
  swingDamage: number;
  contactDamage: number;
  spritePrefix: string;
  bodySize: { w: number; h: number; offsetX?: number; offsetY?: number };
  phases: BossPhase[];
  attacks: Record<string, BossAttackDef>;
  description: string;
  gamePhase: 1 | 2 | 3 | 4 | 5 | 6;
};

// ── Existing bosses (Phase 1 / CEO) ──────────────────────────────────────────

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

// ── Future bosses catalog ────────────────────────────────────────────────────

export const BOSS_CATALOG: Record<string, BossDef> = {
  gerente_microgestor: {
    id: "gerente_microgestor",
    label: "Gerente Microgestor",
    hp: GERENTE_HP,
    swingDamage: GERENTE_SWING_DAMAGE,
    contactDamage: GERENTE_CONTACT_DAMAGE,
    spritePrefix: "boss-gerente",
    bodySize: { w: 38, h: 64, offsetX: 5, offsetY: 4 },
    phases: GERENTE_PHASES,
    attacks: GERENTE_ATTACKS,
    description: "Chefe da Fase 1. Microgerencia com e-mails e reuniões de emergência.",
    gamePhase: 1,
  },

  ceo_iluminado: {
    id: "ceo_iluminado",
    label: "CEO Iluminado",
    hp: CEO_HP,
    swingDamage: CEO_SWING_DAMAGE,
    contactDamage: CEO_CONTACT_DAMAGE,
    spritePrefix: "boss-ceo",
    bodySize: { w: 52, h: 90, offsetX: 38, offsetY: 30 },
    phases: CEO_PHASES,
    attacks: {
      slam:   { duration: 600, color: 0xff4400, name: "VISAO ESTRATEGICA!" },
      charge: { duration: 300, color: 0xff8800, name: "DISRUPCAO TOTAL!" },
      laser:  { duration: 800, color: 0xffff00, name: "MINDSET DE DONO" },
    },
    description: "Chefe final. Anda, corre e solta ataques orbitais.",
    gamePhase: 6,
  },

  arquiteto_sistemas: {
    id: "arquiteto_sistemas",
    label: "Arquiteto de Sistemas",
    hp: 650,
    swingDamage: 22,
    contactDamage: 12,
    spritePrefix: "boss-arquiteto",
    bodySize: { w: 40, h: 68, offsetX: 4, offsetY: 4 },
    phases: [
      { hpThreshold: 1.0,         speed: 50,  tint: undefined },
      { hpThreshold: 400 / 650,   speed: 80,  tint: 0x8844ff },
      { hpThreshold: 200 / 650,   speed: 110, tint: 0x4400ff },
    ],
    attacks: {
      deploy:    { duration: 700, color: 0x8844ff, name: "DEPLOY EM PRODUCAO!" },
      refactor:  { duration: 500, color: 0x4488ff, name: "REFACTOR INFINITO" },
      microservicos: { duration: 900, color: 0x00aaff, name: "MICROSERVICOS!!" },
    },
    description: "Fase 2. Invoca serviços secundários que atuam como minions.",
    gamePhase: 2,
  },

  cacador_metas: {
    id: "cacador_metas",
    label: "Caçador de Metas",
    hp: 700,
    swingDamage: 30,
    contactDamage: 15,
    spritePrefix: "boss-cacador",
    bodySize: { w: 36, h: 64, offsetX: 6, offsetY: 4 },
    phases: [
      { hpThreshold: 1.0,       speed: 80,  tint: undefined },
      { hpThreshold: 400 / 700, speed: 120, tint: 0xff6600 },
      { hpThreshold: 200 / 700, speed: 160, tint: 0xff0000 },
    ],
    attacks: {
      kpi:     { duration: 400, color: 0xff6600, name: "KPI VIOLADO!" },
      sprint:  { duration: 250, color: 0xff3300, name: "SPRINT DE FIM DE ANO" },
      meta:    { duration: 600, color: 0xff0000, name: "META OU DEMISSAO!" },
    },
    description: "Fase 3. Fica mais rápido a cada fase. Último patamar é quase impossível de esquivar.",
    gamePhase: 3,
  },

  coordenador_reunioes: {
    id: "coordenador_reunioes",
    label: "Coordenador de Reuniões",
    hp: 600,
    swingDamage: 18,
    contactDamage: 10,
    spritePrefix: "boss-coordenador",
    bodySize: { w: 38, h: 64, offsetX: 5, offsetY: 4 },
    phases: [
      { hpThreshold: 1.0,       speed: 40,  tint: undefined },
      { hpThreshold: 350 / 600, speed: 60,  tint: 0x4488ff },
      { hpThreshold: 150 / 600, speed: 80,  tint: 0x2244ff },
    ],
    attacks: {
      convoca:    { duration: 900, color: 0x4488ff, name: "CONVOCACAO IMEDIATA!" },
      planeja:    { duration: 700, color: 0x6644cc, name: "PLANEJAMENTO Q4!" },
      apresenta:  { duration: 1100, color: 0x2266ff, name: "SLIDES INFINITOS" },
    },
    description: "Fase 4. Invoca ondas de inimigos de suporte durante a luta.",
    gamePhase: 4,
  },

  diretor_financeiro: {
    id: "diretor_financeiro",
    label: "Diretor Financeiro",
    hp: 750,
    swingDamage: 35,
    contactDamage: 20,
    spritePrefix: "boss-diretor",
    bodySize: { w: 42, h: 70, offsetX: 3, offsetY: 2 },
    phases: [
      { hpThreshold: 1.0,       speed: 55,  tint: undefined },
      { hpThreshold: 400 / 750, speed: 85,  tint: 0x228800 },
      { hpThreshold: 200 / 750, speed: 115, tint: 0x006600 },
    ],
    attacks: {
      corte:      { duration: 600, color: 0x228800, name: "CORTE DE BUDGET!" },
      auditoria:  { duration: 800, color: 0x44aa00, name: "AUDITORIA SURPRESA" },
      roi:        { duration: 500, color: 0x00ff44, name: "ROI NEGATIVO!" },
    },
    description: "Fase 5 mini-chefe. Cria zonas de dano baseadas em 'cortes de orçamento'.",
    gamePhase: 5,
  },

  guardiao_ordem: {
    id: "guardiao_ordem",
    label: "Guardião da Ordem",
    hp: 800,
    swingDamage: 40,
    contactDamage: 25,
    spritePrefix: "boss-guardiao",
    bodySize: { w: 48, h: 76, offsetX: 0, offsetY: 0 },
    phases: [
      { hpThreshold: 1.0,       speed: 70,  tint: undefined },
      { hpThreshold: 450 / 800, speed: 100, tint: 0xaa2200 },
      { hpThreshold: 200 / 800, speed: 130, tint: 0xff0000 },
    ],
    attacks: {
      barricada: { duration: 700, color: 0xaa2200, name: "BARRICADA!" },
      patrul:    { duration: 400, color: 0xff4400, name: "PATRULHA AMPLIADA" },
      expulsa:   { duration: 550, color: 0xff0000, name: "EXPULSAO SUMARIA!" },
    },
    description: "Guarda a saída do andar. Forma escudo e empurra o jogador de volta.",
    gamePhase: 5,
  },

  product_owner_caos: {
    id: "product_owner_caos",
    label: "Product Owner do Caos",
    hp: 580,
    swingDamage: 20,
    contactDamage: 12,
    spritePrefix: "boss-po",
    bodySize: { w: 36, h: 62, offsetX: 6, offsetY: 5 },
    phases: [
      { hpThreshold: 1.0,       speed: 65,  tint: undefined },
      { hpThreshold: 320 / 580, speed: 95,  tint: 0xff8800 },
      { hpThreshold: 150 / 580, speed: 125, tint: 0xffaa00 },
    ],
    attacks: {
      pivot:      { duration: 350, color: 0xff8800, name: "PIVOTEANDO!" },
      backlog:    { duration: 600, color: 0xffaa00, name: "BACKLOG INFINITO" },
      escopo:     { duration: 800, color: 0xffcc00, name: "MUDANCA DE ESCOPO!" },
    },
    description: "Muda de ataque aleatoriamente entre fases. Imprevisível.",
    gamePhase: 3,
  },

  vice_presidente: {
    id: "vice_presidente",
    label: "Vice-Presidente Executivo",
    hp: 900,
    swingDamage: 45,
    contactDamage: 28,
    spritePrefix: "boss-vp",
    bodySize: { w: 50, h: 80, offsetX: 2, offsetY: 0 },
    phases: [
      { hpThreshold: 1.0,       speed: 45,  tint: undefined },
      { hpThreshold: 500 / 900, speed: 80,  tint: 0x880044 },
      { hpThreshold: 250 / 900, speed: 115, tint: 0xff0055 },
      { hpThreshold: 100 / 900, speed: 150, tint: 0xff0000 },
    ],
    attacks: {
      veto:       { duration: 600, color: 0x880044, name: "VETADO!" },
      estrategia: { duration: 900, color: 0xff0055, name: "ESTRATEGIA CORPORATIVA" },
      fusao:      { duration: 1200, color: 0xff0000, name: "FUSAO E AQUISICAO!" },
      downsizing: { duration: 700, color: 0xaa0033, name: "DOWNSIZING MASSIVO!" },
    },
    description: "Penúltimo chefe. 4 fases, ataques diversificados. Prelúdio ao CEO.",
    gamePhase: 5,
  },

  rh_predador: {
    id: "rh_predador",
    label: "RH Predador",
    hp: 480,
    swingDamage: 16,
    contactDamage: 8,
    spritePrefix: "boss-rh",
    bodySize: { w: 34, h: 60, offsetX: 7, offsetY: 6 },
    phases: [
      { hpThreshold: 1.0,       speed: 90,  tint: undefined },
      { hpThreshold: 250 / 480, speed: 130, tint: 0xaa4488 },
      { hpThreshold: 120 / 480, speed: 170, tint: 0xff44aa },
    ],
    attacks: {
      entrevista: { duration: 500, color: 0xaa4488, name: "ENTREVISTA SURPRISE!" },
      avaliacao:  { duration: 700, color: 0xff44aa, name: "AVALIACAO 360!" },
      pip:        { duration: 600, color: 0xff0088, name: "PLANO DE MELHORIA!" },
    },
    description: "Boss secreto. Aparece aleatoriamente em qualquer fase, drena sanidade.",
    gamePhase: 2,
  },
};
