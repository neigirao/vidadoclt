export type EnemyId =
  | "estagiario_desesperado"
  | "estagiario_sobrecarregado"
  | "analista_onboarding"
  | "facilitador_workshop"
  | "scrum_master_caotico"
  | "coordenador_sinergia"
  | "analista_senior_exausto"
  | "enemy_rh"
  | "analista_junior"
  | "telemarketer_zumbi"
  | "impressora_assombrada"
  | "impressora_vermelha"
  | "impressora_fantasma"
  | "impressora_necromorfa"
  | "guardiao_cafe"
  | "nuvem_board_sentinela"
  | "reuniao_corporativa"
  | "evangelista_corporativo"
  | "evangelista_avancado"
  | "evangelista_megacorp"
  | "coletor_dados"
  | "planilha_viva"
  | "cabo_rede"
  | "ti_suporte"
  | "drone_vigilancia"
  | "seguranca_corporativa"
  | "carimbador_automatico"
  | "arquivo_ambulante"
  | "bateria_social";

export type EnemyArchetype =
  | "rusher"
  | "ranged"
  | "charger"
  | "tank"
  | "healer"
  | "aerial"
  | "splitter"
  | "support";

export type EnemyAttackDef = {
  name: string;
  telegraphMs: number;
  damage: number;
  cooldownMs: number;
};

export type EnemyBodySize = {
  w: number;
  h: number;
  offsetX?: number;
  offsetY?: number;
};

export type EnemyDrops = {
  vr?: [number, number];
  coffeeChance?: number;
  postitChance?: number;
};

export type EnemyAudio = {
  spawn?: string;
  hurt?: string;
  death?: string;
  attack?: string;
};

export type EnemyDef = {
  id: EnemyId;
  label: string;
  hp: number;
  speed: number;
  contactDamage: number;
  vrReward: number;
  phase: 1 | 2 | 3 | 4 | 5;
  // Campos opcionais (Etapa 1 — não-destrutivos)
  archetype?: EnemyArchetype;
  spritePrefix?: string;
  bodySize?: EnemyBodySize;
  attacks?: EnemyAttackDef[];
  drops?: EnemyDrops;
  audio?: EnemyAudio;
  description?: string;
};

export const ENEMIES: Record<EnemyId, EnemyDef> = {
  estagiario_sobrecarregado: {
    id: "estagiario_sobrecarregado",
    label: "Estagiário Sobrecarregado",
    hp: 22,
    speed: 180,
    contactDamage: 12,
    vrReward: 2,
    phase: 1,
    archetype: "rusher",
    spritePrefix: "estagiario-b",
    bodySize: { w: 20, h: 28 },
    drops: { vr: [1, 3], coffeeChance: 0.08 },
    description: "Faz o trabalho de três. Recebe de zero.",
  },
  analista_onboarding: {
    id: "analista_onboarding",
    label: "Analista em Onboarding",
    hp: 18,
    speed: 90,
    contactDamage: 0,
    vrReward: 2,
    phase: 1,
    archetype: "ranged",
    spritePrefix: "analista-novo",
    bodySize: { w: 24, h: 36 },
    attacks: [{ name: "duvida_existencial", telegraphMs: 350, damage: 4, cooldownMs: 1200 }],
    drops: { vr: [1, 3], postitChance: 0.2 },
    description: "Ainda no período de experiência. Mas já te manda dúvida no chat.",
  },
  estagiario_desesperado: {
    id: "estagiario_desesperado",
    label: "Estagiário Desesperado",
    hp: 12,
    speed: 200,
    contactDamage: 15,
    vrReward: 1,
    phase: 1,
    archetype: "rusher",
    spritePrefix: "estagiario",
    bodySize: { w: 28, h: 48 },
    attacks: [{ name: "lunge", telegraphMs: 200, damage: 15, cooldownMs: 900 }],
    drops: { vr: [1, 2], coffeeChance: 0.05 },
    description: "Foi contratado pela 'oportunidade'. Agora corre por café.",
  },
  facilitador_workshop: {
    id: "facilitador_workshop",
    label: "Facilitador de Workshop",
    hp: 20,
    speed: 100,
    contactDamage: 0,
    vrReward: 2,
    phase: 1,
    archetype: "support",
    spritePrefix: "facilitador",
    bodySize: { w: 32, h: 52 },
    drops: { vr: [2, 3], postitChance: 0.15 },
    description: "Cobra dynamics até no horário de almoço.",
  },
  scrum_master_caotico: {
    id: "scrum_master_caotico",
    label: "Scrum Master Caótico",
    hp: 25,
    speed: 130,
    contactDamage: 8,
    vrReward: 2,
    phase: 1,
    archetype: "ranged",
    spritePrefix: "scrum",
    bodySize: { w: 30, h: 52 },
    attacks: [{ name: "postit_throw", telegraphMs: 300, damage: 6, cooldownMs: 1400 }],
    drops: { vr: [2, 3], postitChance: 0.4 },
    description: "Move o post-it sem perguntar. Joga o post-it em você.",
  },
  coordenador_sinergia: {
    id: "coordenador_sinergia",
    label: "Coordenador de Sinergia",
    hp: 40,
    speed: 60,
    contactDamage: 5,
    vrReward: 4,
    phase: 1,
    archetype: "support",
    spritePrefix: "coordenador",
    bodySize: { w: 36, h: 56 },
    drops: { vr: [3, 5] },
    description: "Convoca reunião sem pauta para drenar tua sanidade.",
  },
  analista_senior_exausto: {
    id: "analista_senior_exausto",
    label: "Analista Sênior Exausto",
    hp: 80,
    speed: 45,
    contactDamage: 5,
    vrReward: 6,
    phase: 1,
    archetype: "tank",
    spritePrefix: "senior",
    bodySize: { w: 38, h: 58 },
    attacks: [{ name: "slam_planilha", telegraphMs: 500, damage: 10, cooldownMs: 1800 }],
    drops: { vr: [5, 8], coffeeChance: 0.5 },
    description: "Sustentou o time por 12 anos. Restam casca e Excel.",
  },
  enemy_rh: {
    id: "enemy_rh",
    label: "Analista de RH",
    hp: 55,
    speed: 85,
    contactDamage: 8,
    vrReward: 3,
    phase: 1,
    archetype: "charger",
    spritePrefix: "rh",
    bodySize: { w: 32, h: 56 },
    attacks: [{ name: "feedback_360", telegraphMs: 400, damage: 12, cooldownMs: 1600 }],
    drops: { vr: [2, 4] },
    description: "Quer 'bater um papo rápido na salinha'.",
  },
  analista_junior: {
    id: "analista_junior",
    label: "Analista Júnior",
    hp: 30,
    speed: 80,
    contactDamage: 0,
    vrReward: 3,
    phase: 1,
    archetype: "ranged",
    spritePrefix: "analista",
    bodySize: { w: 30, h: 52 },
    attacks: [{ name: "email_storm", telegraphMs: 250, damage: 5, cooldownMs: 1100 }],
    drops: { vr: [2, 4] },
    description: "Dispara e-mails em cópia oculta. Letais.",
  },
  telemarketer_zumbi: {
    id: "telemarketer_zumbi",
    label: "Telemarketer Zumbi",
    hp: 160,
    speed: 70,
    contactDamage: 12,
    vrReward: 2,
    phase: 2,
    archetype: "rusher",
    spritePrefix: "telemarketer",
    bodySize: { w: 32, h: 56 },
    drops: { vr: [1, 3] },
    description: "Repete o script desde 2008. Não respira.",
  },
  impressora_vermelha: {
    id: "impressora_vermelha",
    label: "Impressora Vermelha",
    hp: 480,
    speed: 30,
    contactDamage: 12,
    vrReward: 10,
    phase: 3,
    archetype: "tank",
    spritePrefix: "impressora-b",
    bodySize: { w: 44, h: 56 },
    attacks: [{ name: "toner_burst", telegraphMs: 550, damage: 16, cooldownMs: 2000 }],
    drops: { vr: [8, 14] },
    description: "Errou o cartucho. Imprime a raiva.",
  },
  impressora_fantasma: {
    id: "impressora_fantasma",
    label: "Impressora Fantasma",
    hp: 560,
    speed: 50,
    contactDamage: 15,
    vrReward: 12,
    phase: 4,
    archetype: "tank",
    spritePrefix: "impressora-c",
    bodySize: { w: 44, h: 56 },
    attacks: [{ name: "ghost_print", telegraphMs: 700, damage: 18, cooldownMs: 2400 }],
    drops: { vr: [10, 16] },
    description: "Imprime documentos que ninguém pediu às 3h da manhã.",
  },
  impressora_necromorfa: {
    id: "impressora_necromorfa",
    label: "Impressora Necromorfa",
    hp: 720,
    speed: 65,
    contactDamage: 22,
    vrReward: 16,
    phase: 5,
    archetype: "tank",
    spritePrefix: "impressora-d",
    bodySize: { w: 44, h: 56 },
    attacks: [{ name: "paper_storm", telegraphMs: 800, damage: 24, cooldownMs: 2800 }],
    drops: { vr: [14, 22], coffeeChance: 0.3 },
    description: "Mutação final. Alimentada por toner e ressentimento.",
  },
  reuniao_corporativa: {
    id: "reuniao_corporativa",
    label: "Reunião Corporativa",
    hp: 320,
    speed: 45,
    contactDamage: 0,
    vrReward: 5,
    phase: 2,
    archetype: "support",
    spritePrefix: "reuniao",
    bodySize: { w: 40, h: 52 },
    attacks: [{ name: "pauta_infinita", telegraphMs: 800, damage: 10, cooldownMs: 3000 }],
    drops: { vr: [4, 7] },
    description: "Convocada sem pauta. Dura mais que o expediente.",
  },
  evangelista_avancado: {
    id: "evangelista_avancado",
    label: "Evangelista Avançado",
    hp: 400,
    speed: 80,
    contactDamage: 12,
    vrReward: 6,
    phase: 4,
    archetype: "support",
    spritePrefix: "evangelista-boss",
    bodySize: { w: 34, h: 58 },
    drops: { vr: [5, 8], postitChance: 0.25 },
    description: "Palestrante motivacional com síndrome do impostor avançado.",
  },
  evangelista_megacorp: {
    id: "evangelista_megacorp",
    label: "Evangelista MegaCorp",
    hp: 600,
    speed: 100,
    contactDamage: 16,
    vrReward: 9,
    phase: 5,
    archetype: "support",
    spritePrefix: "evangelista-mega",
    bodySize: { w: 38, h: 60 },
    drops: { vr: [8, 14], postitChance: 0.35 },
    description: "Transcendeu o corporativo. É o corporativo agora.",
  },
  impressora_assombrada: {
    id: "impressora_assombrada",
    label: "Impressora Assombrada",
    hp: 400,
    speed: 0,
    contactDamage: 8,
    vrReward: 8,
    phase: 2,
    archetype: "tank",
    spritePrefix: "impressora",
    bodySize: { w: 44, h: 56 },
    attacks: [{ name: "ink_burst", telegraphMs: 600, damage: 14, cooldownMs: 2200 }],
    drops: { vr: [6, 12] },
    description: "Atola toner com olhos vermelhos.",
  },
  guardiao_cafe: {
    id: "guardiao_cafe",
    label: "Guardião do Café",
    hp: 280,
    speed: 90,
    contactDamage: 20,
    vrReward: 4,
    phase: 2,
    archetype: "charger",
    spritePrefix: "guardiao-cafe",
    bodySize: { w: 40, h: 58 },
    attacks: [{ name: "hot_splash", telegraphMs: 450, damage: 18, cooldownMs: 1700 }],
    drops: { vr: [3, 6], coffeeChance: 0.6 },
    description: "Defende a cafeteira como se fosse a última.",
  },
  nuvem_board_sentinela: {
    id: "nuvem_board_sentinela",
    label: "Nuvem Board Sentinela",
    hp: 250,
    speed: 40,
    contactDamage: 0,
    vrReward: 3,
    phase: 2,
    archetype: "aerial",
    spritePrefix: "noticeboard",
    bodySize: { w: 40, h: 40 },
    attacks: [{ name: "broadcast", telegraphMs: 700, damage: 8, cooldownMs: 2500 }],
    drops: { vr: [2, 4] },
    description: "Anuncia metas impossíveis em alto-falante.",
  },
  evangelista_corporativo: {
    id: "evangelista_corporativo",
    label: "Evangelista Corporativo",
    hp: 224,
    speed: 60,
    contactDamage: 8,
    vrReward: 3,
    phase: 3,
    archetype: "support",
    spritePrefix: "evangelista",
    bodySize: { w: 34, h: 56 },
    drops: { vr: [2, 5], postitChance: 0.2 },
    description: "Posta no LinkedIn enquanto te ataca.",
  },
  coletor_dados: {
    id: "coletor_dados",
    label: "Coletor de Dados",
    hp: 150,
    speed: 130,
    contactDamage: 0,
    vrReward: 1,
    phase: 3,
    archetype: "aerial",
    spritePrefix: "coletor",
    bodySize: { w: 30, h: 32 },
    attacks: [{ name: "scrape", telegraphMs: 200, damage: 6, cooldownMs: 1000 }],
    drops: { vr: [1, 2] },
    description: "Quer só 'mais alguns dados pra melhorar o serviço'.",
  },
  planilha_viva: {
    id: "planilha_viva",
    label: "Planilha Viva",
    hp: 400,
    speed: 40,
    contactDamage: 10,
    vrReward: 6,
    phase: 3,
    archetype: "tank",
    spritePrefix: "planilha",
    bodySize: { w: 42, h: 50 },
    attacks: [{ name: "vlookup", telegraphMs: 550, damage: 16, cooldownMs: 2000 }],
    drops: { vr: [5, 9] },
    description: "12.000 linhas. Sem cabeçalho. Está cheia de macros.",
  },
  cabo_rede: {
    id: "cabo_rede",
    label: "Cabo de Rede",
    hp: 176,
    speed: 80,
    contactDamage: 10,
    vrReward: 2,
    phase: 4,
    archetype: "rusher",
    spritePrefix: "cabo",
    bodySize: { w: 30, h: 54 },
    drops: { vr: [1, 3] },
    description: "Chicoteia quem ousar tropeçar.",
  },
  ti_suporte: {
    id: "ti_suporte",
    label: "TI Suporte",
    hp: 300,
    speed: 90,
    contactDamage: 12,
    vrReward: 3,
    phase: 4,
    archetype: "ranged",
    spritePrefix: "ti-suporte",
    bodySize: { w: 34, h: 56 },
    attacks: [{ name: "have_you_tried_restarting", telegraphMs: 350, damage: 12, cooldownMs: 1500 }],
    drops: { vr: [2, 5] },
    description: "Pergunta se você reiniciou. Três vezes.",
  },
  drone_vigilancia: {
    id: "drone_vigilancia",
    label: "Drone de Vigilância",
    hp: 144,
    speed: 80,
    contactDamage: 0,
    vrReward: 3,
    phase: 4,
    archetype: "aerial",
    spritePrefix: "drone",
    bodySize: { w: 32, h: 28 },
    attacks: [{ name: "laser", telegraphMs: 400, damage: 10, cooldownMs: 1400 }],
    drops: { vr: [2, 4] },
    description: "Reporta seus minutos no banheiro à diretoria.",
  },
  seguranca_corporativa: {
    id: "seguranca_corporativa",
    label: "Segurança Corporativa",
    hp: 280,
    speed: 120,
    contactDamage: 10,
    vrReward: 4,
    phase: 4,
    archetype: "charger",
    spritePrefix: "seguranca",
    bodySize: { w: 36, h: 60 },
    attacks: [{ name: "headlock", telegraphMs: 500, damage: 14, cooldownMs: 1800 }],
    drops: { vr: [3, 6] },
    description: "Crachá vence em segundos. Você também.",
  },
  carimbador_automatico: {
    id: "carimbador_automatico",
    label: "Carimbador Automático",
    hp: 256,
    speed: 50,
    contactDamage: 8,
    vrReward: 4,
    phase: 5,
    archetype: "tank",
    spritePrefix: "carimbador",
    bodySize: { w: 38, h: 56 },
    attacks: [{ name: "stamp", telegraphMs: 400, damage: 11, cooldownMs: 1300 }],
    drops: { vr: [3, 6] },
    description: "Carimba 'INDEFERIDO' na sua testa.",
  },
  arquivo_ambulante: {
    id: "arquivo_ambulante",
    label: "Arquivo Ambulante",
    hp: 800,
    speed: 30,
    contactDamage: 35,
    vrReward: 15,
    phase: 5,
    archetype: "tank",
    spritePrefix: "arquivo",
    bodySize: { w: 48, h: 60 },
    attacks: [{ name: "paper_avalanche", telegraphMs: 800, damage: 28, cooldownMs: 2800 }],
    drops: { vr: [12, 20], coffeeChance: 0.4 },
    description: "Contém todos os RHs que vieram antes.",
  },
  bateria_social: {
    id: "bateria_social",
    label: "Bateria Social",
    hp: 200,
    speed: 60,
    contactDamage: 8,
    vrReward: 4,
    phase: 5,
    archetype: "support",
    spritePrefix: "bateria",
    bodySize: { w: 32, h: 52 },
    attacks: [{ name: "drain", telegraphMs: 600, damage: 9, cooldownMs: 2000 }],
    drops: { vr: [3, 6] },
    description: "Drena sua energia só de existir perto.",
  },
};

export function getEnemyDef(id: EnemyId): EnemyDef {
  return ENEMIES[id];
}

export function getEnemiesByPhase(phase: 1 | 2 | 3 | 4 | 5): EnemyDef[] {
  return Object.values(ENEMIES).filter((e) => e.phase === phase);
}

export function getEnemiesByArchetype(archetype: EnemyArchetype): EnemyDef[] {
  return Object.values(ENEMIES).filter((e) => e.archetype === archetype);
}
