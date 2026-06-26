export type EnemyId =
  | "estagiario_desesperado"
  | "facilitador_workshop"
  | "scrum_master_caotico"
  | "coordenador_sinergia"
  | "analista_senior_exausto"
  | "enemy_rh"
  | "analista_junior"
  | "telemarketer_zumbi"
  | "impressora_assombrada"
  | "guardiao_cafe"
  | "nuvem_board_sentinela"
  | "evangelista_corporativo"
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
  | "rusher"    // runs at player, melee
  | "ranged"    // keeps distance, shoots projectiles
  | "charger"   // telegraphs then bursts forward
  | "tank"      // slow, high HP, high contact damage
  | "healer"    // buffs/heals nearby enemies
  | "aerial"    // flies or floats, ignores ground
  | "splitter"  // spawns smaller units on death
  | "support";  // debuffs player, doesn't deal direct damage

export type EnemyAttackDef = {
  name: string;
  telegraphMs: number;
  damage: number;
  cooldownMs: number;
};

export type EnemyDef = {
  id: EnemyId;
  label: string;
  hp: number;
  speed: number;
  contactDamage: number;
  vrReward: number;
  phase: 1 | 2 | 3 | 4 | 5;
  archetype?: EnemyArchetype;
  spritePrefix?: string;
  bodySize?: { w: number; h: number; offsetX?: number; offsetY?: number };
  attacks?: EnemyAttackDef[];
  drops?: { vr?: [number, number]; coffeeChance?: number; postitChance?: number };
  audio?: { spawn?: string; hurt?: string; death?: string; attack?: string };
  description?: string;
};

export const ENEMIES: Record<EnemyId, EnemyDef> = {
  estagiario_desesperado: {
    id: "estagiario_desesperado",
    label: "Estagiário Desesperado",
    hp: 12, speed: 200, contactDamage: 15, vrReward: 1, phase: 1,
    archetype: "rusher",
    spritePrefix: "estagiario",
    bodySize: { w: 24, h: 40, offsetX: 4, offsetY: 8 },
    attacks: [{ name: "Avanco", telegraphMs: 100, damage: 15, cooldownMs: 800 }],
    drops: { vr: [0, 1], postitChance: 0.1 },
    description: "Corre em pânico em direção ao jogador. Fraco mas rápido.",
  },
  facilitador_workshop: {
    id: "facilitador_workshop",
    label: "Facilitador de Workshop",
    hp: 20, speed: 100, contactDamage: 0, vrReward: 2, phase: 1,
    archetype: "support",
    spritePrefix: "facilitador",
    bodySize: { w: 26, h: 40, offsetX: 3, offsetY: 8 },
    attacks: [{ name: "Post-it Toxico", telegraphMs: 400, damage: 8, cooldownMs: 2000 }],
    drops: { vr: [1, 2], postitChance: 0.4 },
    description: "Atira post-its que drenam sanidade. Evita contato direto.",
  },
  scrum_master_caotico: {
    id: "scrum_master_caotico",
    label: "Scrum Master Caótico",
    hp: 25, speed: 130, contactDamage: 8, vrReward: 2, phase: 1,
    archetype: "charger",
    spritePrefix: "scrum",
    bodySize: { w: 28, h: 42, offsetX: 2, offsetY: 6 },
    attacks: [{ name: "Sprint!", telegraphMs: 300, damage: 12, cooldownMs: 1500 }],
    drops: { vr: [0, 2] },
    description: "Para abruptamente, telegrafía um sprint e arremessa o jogador.",
  },
  coordenador_sinergia: {
    id: "coordenador_sinergia",
    label: "Coordenador de Sinergia",
    hp: 40, speed: 60, contactDamage: 5, vrReward: 4, phase: 1,
    archetype: "support",
    spritePrefix: "coordenador",
    bodySize: { w: 28, h: 44, offsetX: 2, offsetY: 4 },
    attacks: [{ name: "Alinhamento", telegraphMs: 600, damage: 0, cooldownMs: 3000 }],
    drops: { vr: [1, 3], coffeeChance: 0.15 },
    description: "Burocrática. Buffa inimigos próximos e resiste a knockback.",
  },
  analista_senior_exausto: {
    id: "analista_senior_exausto",
    label: "Analista Sênior Exausto",
    hp: 80, speed: 45, contactDamage: 5, vrReward: 6, phase: 1,
    archetype: "tank",
    spritePrefix: "senior",
    bodySize: { w: 30, h: 44, offsetX: 1, offsetY: 4 },
    attacks: [{ name: "Relatorio Infinito", telegraphMs: 800, damage: 10, cooldownMs: 2500 }],
    drops: { vr: [2, 5], coffeeChance: 0.3 },
    description: "Lento e resistente. Joga papelada no jogador de vez em quando.",
  },
  enemy_rh: {
    id: "enemy_rh",
    label: "Analista de RH",
    hp: 55, speed: 85, contactDamage: 8, vrReward: 3, phase: 1,
    archetype: "ranged",
    spritePrefix: "rh",
    bodySize: { w: 26, h: 42, offsetX: 3, offsetY: 6 },
    attacks: [{ name: "Email Ameaca", telegraphMs: 350, damage: 10, cooldownMs: 1800 }],
    drops: { vr: [1, 3] },
    description: "Mantém distância e dispara emails ameaçadores.",
  },
  analista_junior: {
    id: "analista_junior",
    label: "Analista Júnior",
    hp: 30, speed: 80, contactDamage: 0, vrReward: 3, phase: 1,
    archetype: "support",
    spritePrefix: "junior",
    bodySize: { w: 24, h: 40, offsetX: 4, offsetY: 8 },
    attacks: [{ name: "Reuniao Urgente", telegraphMs: 500, damage: 5, cooldownMs: 2200 }],
    drops: { vr: [1, 2], postitChance: 0.25 },
    description: "Drena sanidade com conversas desnecessárias.",
  },

  // ── Fase 2 ────────────────────────────────────────────────────────────────
  telemarketer_zumbi: {
    id: "telemarketer_zumbi",
    label: "Telemarketer Zumbi",
    hp: 160, speed: 70, contactDamage: 12, vrReward: 2, phase: 2,
    archetype: "rusher",
    spritePrefix: "telemarketer",
    bodySize: { w: 28, h: 44, offsetX: 2, offsetY: 4 },
    attacks: [{ name: "Ligacao Indesejada", telegraphMs: 200, damage: 12, cooldownMs: 1000 }],
    drops: { vr: [0, 2] },
    description: "Anda devagar mas não para. Quando morre, levanta de novo uma vez.",
  },
  impressora_assombrada: {
    id: "impressora_assombrada",
    label: "Impressora Assombrada",
    hp: 400, speed: 0, contactDamage: 8, vrReward: 8, phase: 2,
    archetype: "ranged",
    spritePrefix: "impressora",
    bodySize: { w: 48, h: 36, offsetX: 0, offsetY: 12 },
    attacks: [
      { name: "Jato de Tinta", telegraphMs: 600, damage: 14, cooldownMs: 2000 },
      { name: "Papel Picado", telegraphMs: 400, damage: 8, cooldownMs: 1200 },
    ],
    drops: { vr: [4, 8] },
    description: "Estacionária. Cospe tinta e projeta papéis em arco.",
  },
  guardiao_cafe: {
    id: "guardiao_cafe",
    label: "Guardião do Café",
    hp: 280, speed: 90, contactDamage: 20, vrReward: 4, phase: 2,
    archetype: "charger",
    spritePrefix: "guardiao",
    bodySize: { w: 32, h: 48, offsetX: 0, offsetY: 0 },
    attacks: [{ name: "Cafezada", telegraphMs: 350, damage: 22, cooldownMs: 1600 }],
    drops: { vr: [2, 4], coffeeChance: 0.6 },
    description: "Protege a máquina de café a todo custo. Carga rápida e pesada.",
  },
  nuvem_board_sentinela: {
    id: "nuvem_board_sentinela",
    label: "Nuvem Board Sentinela",
    hp: 250, speed: 40, contactDamage: 0, vrReward: 3, phase: 2,
    archetype: "aerial",
    spritePrefix: "nuvem",
    bodySize: { w: 44, h: 30, offsetX: 2, offsetY: 8 },
    attacks: [{ name: "Ticket Bloqueado", telegraphMs: 700, damage: 12, cooldownMs: 2500 }],
    drops: { vr: [1, 3] },
    description: "Flutua e lança tickets de bloqueio que param o jogador.",
  },

  // ── Fase 3 ────────────────────────────────────────────────────────────────
  evangelista_corporativo: {
    id: "evangelista_corporativo",
    label: "Evangelista Corporativo",
    hp: 224, speed: 60, contactDamage: 8, vrReward: 3, phase: 3,
    archetype: "support",
    spritePrefix: "evangelista",
    bodySize: { w: 28, h: 44, offsetX: 2, offsetY: 4 },
    attacks: [{ name: "Palestra Motivacional", telegraphMs: 800, damage: 10, cooldownMs: 3000 }],
    drops: { vr: [1, 3], coffeeChance: 0.2 },
    description: "Buffa inimigos próximos com discursos motivacionais. Prioridade de eliminação.",
  },
  coletor_dados: {
    id: "coletor_dados",
    label: "Coletor de Dados",
    hp: 150, speed: 130, contactDamage: 0, vrReward: 1, phase: 3,
    archetype: "ranged",
    spritePrefix: "coletor",
    bodySize: { w: 24, h: 40, offsetX: 4, offsetY: 8 },
    attacks: [{ name: "Formulario LGPD", telegraphMs: 300, damage: 8, cooldownMs: 1200 }],
    drops: { vr: [0, 1] },
    description: "Rápido. Foge do jogador e atira formulários que desviam a mira.",
  },
  planilha_viva: {
    id: "planilha_viva",
    label: "Planilha Viva",
    hp: 400, speed: 40, contactDamage: 10, vrReward: 6, phase: 3,
    archetype: "tank",
    spritePrefix: "planilha",
    bodySize: { w: 40, h: 40, offsetX: 4, offsetY: 8 },
    attacks: [{ name: "Macro Maldita", telegraphMs: 600, damage: 15, cooldownMs: 2000 }],
    drops: { vr: [3, 6] },
    description: "Lenta e pesada. Quando chega perto invoca uma macro que cria area de dano.",
  },

  // ── Fase 4 ────────────────────────────────────────────────────────────────
  cabo_rede: {
    id: "cabo_rede",
    label: "Cabo de Rede",
    hp: 176, speed: 80, contactDamage: 10, vrReward: 2, phase: 4,
    archetype: "charger",
    spritePrefix: "cabo",
    bodySize: { w: 20, h: 44, offsetX: 6, offsetY: 4 },
    attacks: [{ name: "Chicote", telegraphMs: 250, damage: 12, cooldownMs: 1000 }],
    drops: { vr: [1, 2] },
    description: "Elástico e imprevisível. Chicoteia o jogador em alcance médio.",
  },
  ti_suporte: {
    id: "ti_suporte",
    label: "TI Suporte",
    hp: 300, speed: 90, contactDamage: 12, vrReward: 3, phase: 4,
    archetype: "ranged",
    spritePrefix: "ti",
    bodySize: { w: 28, h: 44, offsetX: 2, offsetY: 4 },
    attacks: [
      { name: "Pen Drive Infectado", telegraphMs: 400, damage: 14, cooldownMs: 1500 },
      { name: "Reset Forcado", telegraphMs: 600, damage: 18, cooldownMs: 3000 },
    ],
    drops: { vr: [1, 3], coffeeChance: 0.1 },
    description: "Dispara pen drives e tenta dar reset no jogador (stun).",
  },
  drone_vigilancia: {
    id: "drone_vigilancia",
    label: "Drone de Vigilância",
    hp: 144, speed: 80, contactDamage: 0, vrReward: 3, phase: 4,
    archetype: "aerial",
    spritePrefix: "drone",
    bodySize: { w: 36, h: 22, offsetX: 6, offsetY: 12 },
    attacks: [{ name: "Camera Flash", telegraphMs: 500, damage: 10, cooldownMs: 2000 }],
    drops: { vr: [1, 3] },
    description: "Voa em patrulha. Flash da câmera deixa o jogador temporariamente cego.",
  },
  seguranca_corporativa: {
    id: "seguranca_corporativa",
    label: "Segurança Corporativa",
    hp: 280, speed: 120, contactDamage: 10, vrReward: 4, phase: 4,
    archetype: "tank",
    spritePrefix: "seguranca",
    bodySize: { w: 32, h: 50, offsetX: 0, offsetY: 2 },
    attacks: [{ name: "Cassetete", telegraphMs: 300, damage: 16, cooldownMs: 1200 }],
    drops: { vr: [2, 4] },
    description: "Robusto. Bloqueia projéteis com o escudo e avança com golpe de cassetete.",
  },

  // ── Fase 5 ────────────────────────────────────────────────────────────────
  carimbador_automatico: {
    id: "carimbador_automatico",
    label: "Carimbador Automático",
    hp: 256, speed: 50, contactDamage: 8, vrReward: 4, phase: 5,
    archetype: "support",
    spritePrefix: "carimbador",
    bodySize: { w: 34, h: 40, offsetX: 3, offsetY: 8 },
    attacks: [{ name: "Carimbo INDEFERIDO", telegraphMs: 700, damage: 12, cooldownMs: 2500 }],
    drops: { vr: [2, 4] },
    description: "Carimba áreas do chão com zona de dano temporária.",
  },
  arquivo_ambulante: {
    id: "arquivo_ambulante",
    label: "Arquivo Ambulante",
    hp: 800, speed: 30, contactDamage: 35, vrReward: 15, phase: 5,
    archetype: "tank",
    spritePrefix: "arquivo",
    bodySize: { w: 44, h: 56, offsetX: 2, offsetY: 4 },
    attacks: [
      { name: "Avalanche de Pastas", telegraphMs: 900, damage: 30, cooldownMs: 3500 },
      { name: "Esmagamento", telegraphMs: 500, damage: 35, cooldownMs: 2000 },
    ],
    drops: { vr: [8, 15], coffeeChance: 0.4 },
    description: "Mini-chefe. Enorme pilha de arquivos que esmaga tudo na frente.",
  },
  bateria_social: {
    id: "bateria_social",
    label: "Bateria Social",
    hp: 200, speed: 60, contactDamage: 8, vrReward: 4, phase: 5,
    archetype: "support",
    spritePrefix: "bateria",
    bodySize: { w: 28, h: 44, offsetX: 2, offsetY: 4 },
    attacks: [{ name: "Networking Compulsorio", telegraphMs: 600, damage: 10, cooldownMs: 2200 }],
    drops: { vr: [2, 4], coffeeChance: 0.2 },
    description: "Drena sanidade massivamente se o jogador ficar perto. Foge quando atingido.",
  },
};
