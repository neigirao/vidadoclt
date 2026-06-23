import { EnemyId } from "./EnemyCatalog";

export type SpawnEntry = {
  enemyId: EnemyId;
  x: number;
  yOffsetFromFloor: number;
};

export const SPAWN_CONFIGS: Record<string, SpawnEntry[]> = {
  OpenSpaceV2Scene: [
    { enemyId: "estagiario_desesperado", x: 380,  yOffsetFromFloor: -40 },
    { enemyId: "estagiario_desesperado", x: 560,  yOffsetFromFloor: -40 },
    { enemyId: "estagiario_desesperado", x: 700,  yOffsetFromFloor: -40 },
    { enemyId: "facilitador_workshop",   x: 820,  yOffsetFromFloor: -60 },
    { enemyId: "facilitador_workshop",   x: 1020, yOffsetFromFloor: -60 },
    { enemyId: "scrum_master_caotico",   x: 950,  yOffsetFromFloor: -60 },
    { enemyId: "analista_junior",        x: 1150, yOffsetFromFloor: -60 },
    { enemyId: "analista_junior",        x: 1250, yOffsetFromFloor: -60 },
    { enemyId: "analista_junior",        x: 1400, yOffsetFromFloor: -60 },
    { enemyId: "estagiario_desesperado", x: 1500, yOffsetFromFloor: -40 },
    { enemyId: "estagiario_desesperado", x: 1700, yOffsetFromFloor: -40 },
    { enemyId: "enemy_rh",              x: 600,  yOffsetFromFloor: -60 },
    { enemyId: "enemy_rh",              x: 900,  yOffsetFromFloor: -60 },
    { enemyId: "enemy_rh",              x: 1300, yOffsetFromFloor: -60 },
    { enemyId: "coordenador_sinergia",  x: 1620, yOffsetFromFloor: -60 },
    { enemyId: "analista_senior_exausto", x: 1700, yOffsetFromFloor: -60 },
  ],

  Phase2Scene: [
    { enemyId: "telemarketer_zumbi",    x: 300,  yOffsetFromFloor: -60 },
    { enemyId: "telemarketer_zumbi",    x: 550,  yOffsetFromFloor: -60 },
    { enemyId: "telemarketer_zumbi",    x: 800,  yOffsetFromFloor: -60 },
    { enemyId: "telemarketer_zumbi",    x: 1100, yOffsetFromFloor: -60 },
    { enemyId: "telemarketer_zumbi",    x: 1400, yOffsetFromFloor: -60 },
    { enemyId: "impressora_assombrada", x: 600,  yOffsetFromFloor: -60 },
    { enemyId: "impressora_assombrada", x: 1200, yOffsetFromFloor: -60 },
    { enemyId: "guardiao_cafe",         x: 900,  yOffsetFromFloor: -60 },
    { enemyId: "nuvem_board_sentinela", x: 400,  yOffsetFromFloor: -200 },
    { enemyId: "nuvem_board_sentinela", x: 1500, yOffsetFromFloor: -200 },
  ],

  Phase3Scene: [
    { enemyId: "evangelista_corporativo", x: 250,  yOffsetFromFloor: -60 },
    { enemyId: "evangelista_corporativo", x: 600,  yOffsetFromFloor: -60 },
    { enemyId: "evangelista_corporativo", x: 950,  yOffsetFromFloor: -60 },
    { enemyId: "evangelista_corporativo", x: 1300, yOffsetFromFloor: -60 },
    { enemyId: "coletor_dados",           x: 400,  yOffsetFromFloor: -160 },
    { enemyId: "coletor_dados",           x: 800,  yOffsetFromFloor: -160 },
    { enemyId: "coletor_dados",           x: 1200, yOffsetFromFloor: -160 },
    { enemyId: "planilha_viva",           x: 500,  yOffsetFromFloor: -60 },
    { enemyId: "planilha_viva",           x: 1100, yOffsetFromFloor: -60 },
  ],

  Phase4Scene: [
    { enemyId: "cabo_rede",             x: 280,  yOffsetFromFloor: -60 },
    { enemyId: "cabo_rede",             x: 700,  yOffsetFromFloor: -60 },
    { enemyId: "cabo_rede",             x: 1200, yOffsetFromFloor: -60 },
    { enemyId: "ti_suporte",            x: 450,  yOffsetFromFloor: -60 },
    { enemyId: "ti_suporte",            x: 900,  yOffsetFromFloor: -60 },
    { enemyId: "ti_suporte",            x: 1450, yOffsetFromFloor: -60 },
    { enemyId: "drone_vigilancia",      x: 340,  yOffsetFromFloor: -180 },
    { enemyId: "drone_vigilancia",      x: 1000, yOffsetFromFloor: -180 },
    { enemyId: "drone_vigilancia",      x: 1600, yOffsetFromFloor: -180 },
    { enemyId: "seguranca_corporativa", x: 600,  yOffsetFromFloor: -60 },
    { enemyId: "seguranca_corporativa", x: 1350, yOffsetFromFloor: -60 },
  ],

  Phase5Scene: [
    { enemyId: "carimbador_automatico", x: 250,  yOffsetFromFloor: -60 },
    { enemyId: "carimbador_automatico", x: 750,  yOffsetFromFloor: -60 },
    { enemyId: "carimbador_automatico", x: 1300, yOffsetFromFloor: -60 },
    { enemyId: "arquivo_ambulante",     x: 600,  yOffsetFromFloor: -60 },
    { enemyId: "arquivo_ambulante",     x: 1500, yOffsetFromFloor: -60 },
    { enemyId: "bateria_social",        x: 400,  yOffsetFromFloor: -60 },
    { enemyId: "bateria_social",        x: 1000, yOffsetFromFloor: -60 },
    { enemyId: "bateria_social",        x: 1700, yOffsetFromFloor: -60 },
  ],
};
