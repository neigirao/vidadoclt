import Phaser from "phaser";
import { ENEMIES, EnemyId, EnemyDef } from "./EnemyCatalog";
import {
  EstagiarioDesesperado,
  FacilitadorDeWorkshop,
  ScrumMasterCaotico,
  CoordenadorDeSinergia,
  AnalistaSeniorExausto,
  EnemyRH,
  AnalistaJunior,
} from "../entities/Enemies";
import {
  TelemarketerZumbi,
  ImpressoraAssombrada,
  GuardiaoDoCafe,
  NuvemBoardSentinela,
  EvangelistaCorporativo,
  ColetorDeDados,
  PlanilhaViva,
  CaboDeRede,
  TiSuporte,
  DroneDeVigilancia,
  SegurancaCorporativa,
  CarimbadorAutomatico,
  ArquivoAmbulante,
  BateriaSocial,
} from "../entities/PhaseEnemies";

type AnyEnemySprite = Phaser.Physics.Arcade.Sprite & {
  hp?: number;
  contactDamage?: number;
};

type EnemyCtor = new (
  scene: Phaser.Scene,
  x: number,
  y: number,
) => AnyEnemySprite;

const REGISTRY: Record<EnemyId, EnemyCtor> = {
  estagiario_desesperado: EstagiarioDesesperado as unknown as EnemyCtor,
  facilitador_workshop: FacilitadorDeWorkshop as unknown as EnemyCtor,
  scrum_master_caotico: ScrumMasterCaotico as unknown as EnemyCtor,
  coordenador_sinergia: CoordenadorDeSinergia as unknown as EnemyCtor,
  analista_senior_exausto: AnalistaSeniorExausto as unknown as EnemyCtor,
  enemy_rh: EnemyRH as unknown as EnemyCtor,
  analista_junior: AnalistaJunior as unknown as EnemyCtor,
  telemarketer_zumbi: TelemarketerZumbi as unknown as EnemyCtor,
  impressora_assombrada: ImpressoraAssombrada as unknown as EnemyCtor,
  guardiao_cafe: GuardiaoDoCafe as unknown as EnemyCtor,
  nuvem_board_sentinela: NuvemBoardSentinela as unknown as EnemyCtor,
  evangelista_corporativo: EvangelistaCorporativo as unknown as EnemyCtor,
  coletor_dados: ColetorDeDados as unknown as EnemyCtor,
  planilha_viva: PlanilhaViva as unknown as EnemyCtor,
  cabo_rede: CaboDeRede as unknown as EnemyCtor,
  ti_suporte: TiSuporte as unknown as EnemyCtor,
  drone_vigilancia: DroneDeVigilancia as unknown as EnemyCtor,
  seguranca_corporativa: SegurancaCorporativa as unknown as EnemyCtor,
  carimbador_automatico: CarimbadorAutomatico as unknown as EnemyCtor,
  arquivo_ambulante: ArquivoAmbulante as unknown as EnemyCtor,
  bateria_social: BateriaSocial as unknown as EnemyCtor,
};

export type SpawnOpts = {
  scaleHp?: number;
  scaleDmg?: number;
};

/**
 * Factory unificada de inimigos. Instancia a classe correspondente ao `id`
 * do catálogo, aplica `bodySize` (se definido) e escala HP/dano por loop.
 *
 * As cenas existentes continuam a instanciar classes diretamente; este
 * registry é opt-in para novos spawns e para reativar `EnemySpawns.ts`.
 */
export function spawnEnemy(
  scene: Phaser.Scene,
  id: EnemyId,
  x: number,
  y: number,
  opts: SpawnOpts = {},
): AnyEnemySprite {
  const Ctor = REGISTRY[id];
  if (!Ctor) {
    throw new Error(`[EnemyRegistry] Unknown enemy id: ${id}`);
  }
  const def: EnemyDef = ENEMIES[id];
  const enemy = new Ctor(scene, x, y);

  // Aplica bodySize do catálogo se a classe não tiver setado um próprio.
  if (def.bodySize && enemy.body) {
    const body = enemy.body as Phaser.Physics.Arcade.Body;
    body.setSize(def.bodySize.w, def.bodySize.h);
    if (def.bodySize.offsetX != null || def.bodySize.offsetY != null) {
      body.setOffset(def.bodySize.offsetX ?? 0, def.bodySize.offsetY ?? 0);
    }
  }

  // Scaling de loop / dificuldade.
  const scaleHp = opts.scaleHp ?? 1;
  const scaleDmg = opts.scaleDmg ?? 1;
  if (scaleHp !== 1 && typeof enemy.hp === "number") {
    enemy.hp = Math.round(enemy.hp * scaleHp);
  }
  if (scaleDmg !== 1 && typeof enemy.contactDamage === "number") {
    enemy.contactDamage = Math.round(enemy.contactDamage * scaleDmg);
  }

  return enemy;
}

/**
 * Calcula multiplicador de scaling a partir do `loopCount` do RunState.
 * 15% de HP e 8% de dano por loop, cap em 3x.
 */
export function loopScaling(loopCount: number): Required<SpawnOpts> {
  return {
    scaleHp: Math.min(3, 1 + loopCount * 0.15),
    scaleDmg: Math.min(3, 1 + loopCount * 0.08),
  };
}

export function isKnownEnemyId(id: string): id is EnemyId {
  return id in REGISTRY;
}
