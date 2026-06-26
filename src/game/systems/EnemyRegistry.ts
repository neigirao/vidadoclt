import Phaser from "phaser";
import { EnemyId, ENEMIES } from "./EnemyCatalog";
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
import {
  EstagiarioDesesperado,
  FacilitadorDeWorkshop,
  ScrumMasterCaotico,
  CoordenadorDeSinergia,
  AnalistaSeniorExausto,
  EnemyRH,
  AnalistaJunior,
} from "../entities/Enemies";

type AnyEnemy = Phaser.Physics.Arcade.Sprite & { hp: number; maxHp?: number };

type ConstructorFn = (scene: Phaser.Scene, x: number, y: number) => AnyEnemy;

const CONSTRUCTORS: Partial<Record<EnemyId, ConstructorFn>> = {
  estagiario_desesperado:  (s, x, y) => new EstagiarioDesesperado(s, x, y) as unknown as AnyEnemy,
  facilitador_workshop:    (s, x, y) => new FacilitadorDeWorkshop(s, x, y) as unknown as AnyEnemy,
  scrum_master_caotico:    (s, x, y) => new ScrumMasterCaotico(s, x, y) as unknown as AnyEnemy,
  coordenador_sinergia:    (s, x, y) => new CoordenadorDeSinergia(s, x, y) as unknown as AnyEnemy,
  analista_senior_exausto: (s, x, y) => new AnalistaSeniorExausto(s, x, y) as unknown as AnyEnemy,
  enemy_rh:                (s, x, y) => new EnemyRH(s, x, y) as unknown as AnyEnemy,
  analista_junior:         (s, x, y) => new AnalistaJunior(s, x, y) as unknown as AnyEnemy,

  telemarketer_zumbi:      (s, x, y) => new TelemarketerZumbi(s, x, y) as unknown as AnyEnemy,
  impressora_assombrada:   (s, x, y) => new ImpressoraAssombrada(s, x, y) as unknown as AnyEnemy,
  guardiao_cafe:           (s, x, y) => new GuardiaoDoCafe(s, x, y) as unknown as AnyEnemy,
  nuvem_board_sentinela:   (s, x, y) => new NuvemBoardSentinela(s, x, y) as unknown as AnyEnemy,
  evangelista_corporativo: (s, x, y) => new EvangelistaCorporativo(s, x, y) as unknown as AnyEnemy,
  coletor_dados:           (s, x, y) => new ColetorDeDados(s, x, y) as unknown as AnyEnemy,
  planilha_viva:           (s, x, y) => new PlanilhaViva(s, x, y) as unknown as AnyEnemy,
  cabo_rede:               (s, x, y) => new CaboDeRede(s, x, y) as unknown as AnyEnemy,
  ti_suporte:              (s, x, y) => new TiSuporte(s, x, y) as unknown as AnyEnemy,
  drone_vigilancia:        (s, x, y) => new DroneDeVigilancia(s, x, y) as unknown as AnyEnemy,
  seguranca_corporativa:   (s, x, y) => new SegurancaCorporativa(s, x, y) as unknown as AnyEnemy,
  carimbador_automatico:   (s, x, y) => new CarimbadorAutomatico(s, x, y) as unknown as AnyEnemy,
  arquivo_ambulante:       (s, x, y) => new ArquivoAmbulante(s, x, y) as unknown as AnyEnemy,
  bateria_social:          (s, x, y) => new BateriaSocial(s, x, y) as unknown as AnyEnemy,
};

export type SpawnOpts = {
  loopCount?: number;
  group?: Phaser.Physics.Arcade.Group;
};

export function spawnEnemy(
  scene: Phaser.Scene,
  id: EnemyId,
  x: number,
  y: number,
  opts: SpawnOpts = {},
): AnyEnemy | null {
  const ctor = CONSTRUCTORS[id];
  if (!ctor) {
    console.warn(`[EnemyRegistry] No constructor for "${id}"`);
    return null;
  }

  const def = ENEMIES[id];
  const enemy = ctor(scene, x, y);

  // Apply bodySize override from catalog if defined
  if (def.bodySize && enemy.body) {
    const body = enemy.body as Phaser.Physics.Arcade.Body;
    const bs = def.bodySize;
    body.setSize(bs.w, bs.h);
    body.setOffset(bs.offsetX ?? 0, bs.offsetY ?? 0);
  }

  // Loop HP scaling
  const loopCount = opts.loopCount ?? 0;
  if (loopCount > 0) {
    const mult = 1 + loopCount * 0.15;
    enemy.hp = Math.round(enemy.hp * mult);
    if (typeof enemy.maxHp === "number") {
      enemy.maxHp = Math.round(enemy.maxHp * mult);
    }
  }

  if (opts.group) {
    opts.group.add(enemy, true);
  }

  return enemy;
}
