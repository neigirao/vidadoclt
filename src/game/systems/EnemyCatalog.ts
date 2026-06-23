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

export type EnemyDef = {
  id: EnemyId;
  label: string;
  hp: number;
  speed: number;
  contactDamage: number;
  vrReward: number;
  phase: 1 | 2 | 3 | 4 | 5;
};

export const ENEMIES: Record<EnemyId, EnemyDef> = {
  estagiario_desesperado: {
    id: "estagiario_desesperado",
    label: "Estagiário Desesperado",
    hp: 12,
    speed: 200,
    contactDamage: 15,
    vrReward: 1,
    phase: 1,
  },
  facilitador_workshop: {
    id: "facilitador_workshop",
    label: "Facilitador de Workshop",
    hp: 20,
    speed: 100,
    contactDamage: 0,
    vrReward: 2,
    phase: 1,
  },
  scrum_master_caotico: {
    id: "scrum_master_caotico",
    label: "Scrum Master Caótico",
    hp: 25,
    speed: 130,
    contactDamage: 8,
    vrReward: 2,
    phase: 1,
  },
  coordenador_sinergia: {
    id: "coordenador_sinergia",
    label: "Coordenador de Sinergia",
    hp: 40,
    speed: 60,
    contactDamage: 5,
    vrReward: 4,
    phase: 1,
  },
  analista_senior_exausto: {
    id: "analista_senior_exausto",
    label: "Analista Sênior Exausto",
    hp: 80,
    speed: 45,
    contactDamage: 5,
    vrReward: 6,
    phase: 1,
  },
  enemy_rh: {
    id: "enemy_rh",
    label: "Analista de RH",
    hp: 55,
    speed: 85,
    contactDamage: 8,
    vrReward: 3,
    phase: 1,
  },
  analista_junior: {
    id: "analista_junior",
    label: "Analista Júnior",
    hp: 30,
    speed: 80,
    contactDamage: 0,
    vrReward: 3,
    phase: 1,
  },
  telemarketer_zumbi: {
    id: "telemarketer_zumbi",
    label: "Telemarketer Zumbi",
    hp: 160,
    speed: 70,
    contactDamage: 12,
    vrReward: 2,
    phase: 2,
  },
  impressora_assombrada: {
    id: "impressora_assombrada",
    label: "Impressora Assombrada",
    hp: 400,
    speed: 0,
    contactDamage: 8,
    vrReward: 8,
    phase: 2,
  },
  guardiao_cafe: {
    id: "guardiao_cafe",
    label: "Guardião do Café",
    hp: 280,
    speed: 90,
    contactDamage: 20,
    vrReward: 4,
    phase: 2,
  },
  nuvem_board_sentinela: {
    id: "nuvem_board_sentinela",
    label: "Nuvem Board Sentinela",
    hp: 250,
    speed: 40,
    contactDamage: 0,
    vrReward: 3,
    phase: 2,
  },
  evangelista_corporativo: {
    id: "evangelista_corporativo",
    label: "Evangelista Corporativo",
    hp: 224,
    speed: 60,
    contactDamage: 8,
    vrReward: 3,
    phase: 3,
  },
  coletor_dados: {
    id: "coletor_dados",
    label: "Coletor de Dados",
    hp: 150,
    speed: 130,
    contactDamage: 0,
    vrReward: 1,
    phase: 3,
  },
  planilha_viva: {
    id: "planilha_viva",
    label: "Planilha Viva",
    hp: 400,
    speed: 40,
    contactDamage: 10,
    vrReward: 6,
    phase: 3,
  },
  cabo_rede: {
    id: "cabo_rede",
    label: "Cabo de Rede",
    hp: 176,
    speed: 80,
    contactDamage: 10,
    vrReward: 2,
    phase: 4,
  },
  ti_suporte: {
    id: "ti_suporte",
    label: "TI Suporte",
    hp: 300,
    speed: 90,
    contactDamage: 12,
    vrReward: 3,
    phase: 4,
  },
  drone_vigilancia: {
    id: "drone_vigilancia",
    label: "Drone de Vigilância",
    hp: 144,
    speed: 80,
    contactDamage: 0,
    vrReward: 3,
    phase: 4,
  },
  seguranca_corporativa: {
    id: "seguranca_corporativa",
    label: "Segurança Corporativa",
    hp: 280,
    speed: 120,
    contactDamage: 10,
    vrReward: 4,
    phase: 4,
  },
  carimbador_automatico: {
    id: "carimbador_automatico",
    label: "Carimbador Automático",
    hp: 256,
    speed: 50,
    contactDamage: 8,
    vrReward: 4,
    phase: 5,
  },
  arquivo_ambulante: {
    id: "arquivo_ambulante",
    label: "Arquivo Ambulante",
    hp: 800,
    speed: 30,
    contactDamage: 35,
    vrReward: 15,
    phase: 5,
  },
  bateria_social: {
    id: "bateria_social",
    label: "Bateria Social",
    hp: 200,
    speed: 60,
    contactDamage: 8,
    vrReward: 4,
    phase: 5,
  },
};
