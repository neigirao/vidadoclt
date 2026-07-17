// ─────────────────────────────────────────────────────────────────────────────
// Loader de nível no formato LDtk (https://ldtk.io) — POC do pipeline "híbrido"
// (salas DESENHADAS à mão no LDtk + código que costura a fase). Lê o subconjunto
// do JSON de export do LDtk que nos importa:
//   • uma camada IntGrid  → células sólidas viram PLATAFORMAS ([x, surfY, tiles])
//   • uma camada Entities → marcadores de spawn (PlayerStart / Enemy / Exit)
//
// POR QUE LDtk aqui: numa PARTE SEM FUNDO PINTADO próprio, os tiles do grid são
// o visual — então dá pra desenhar a sala no editor LDtk sem conflitar com a arte
// pintada das outras fases. O editor GUI do LDtk não roda no sandbox do agente,
// então o .json de exemplo foi escrito no MESMO schema que o LDtk exporta (um
// export real do editor cai aqui sem mudar código).
//
// Módulo puro (sem Phaser) → testável em bun:test.
// ─────────────────────────────────────────────────────────────────────────────

export type LdtkEntity = { id: string; x: number; y: number };
export type LdtkPlatform = [x: number, surfY: number, tiles: number];
export type LdtkLevel = {
  gridSize: number;
  widthPx: number;
  heightPx: number;
  /** células sólidas do IntGrid (para desenhar os tiles) */
  solids: Array<{ cx: number; cy: number }>;
  /** runs horizontais de sólidos → plataformas para o BasePhaseScene */
  platforms: LdtkPlatform[];
  entities: LdtkEntity[];
};

type RawLayer = {
  __identifier?: string;
  __type?: string;
  __cWid?: number;
  __cHei?: number;
  __gridSize?: number;
  intGridCsv?: number[];
  entityInstances?: Array<{ __identifier?: string; px?: [number, number] }>;
};
type RawLdtk = { levels?: Array<{ layerInstances?: RawLayer[] }> };

/**
 * Converte o JSON do LDtk (1º nível) numa estrutura pronta pra montar a fase.
 * `solidValue` = valor do IntGrid tratado como sólido (default 1).
 */
export function parseLdtk(json: RawLdtk, solidValue = 1): LdtkLevel {
  const level = json.levels?.[0];
  if (!level) throw new Error("LDtk: nenhum nível no JSON");
  const layers = level.layerInstances ?? [];

  const intLayer = layers.find((l) => l.__type === "IntGrid" && Array.isArray(l.intGridCsv));
  const entLayer = layers.find((l) => l.__type === "Entities");

  const gridSize = intLayer?.__gridSize ?? 32;
  const cWid = intLayer?.__cWid ?? 0;
  const cHei = intLayer?.__cHei ?? 0;
  const csv = intLayer?.intGridCsv ?? [];

  const solids: Array<{ cx: number; cy: number }> = [];
  for (let cy = 0; cy < cHei; cy++) {
    for (let cx = 0; cx < cWid; cx++) {
      if (csv[cy * cWid + cx] === solidValue) solids.push({ cx, cy });
    }
  }

  // Runs horizontais por linha → uma plataforma cada. x = col*grid, surfY =
  // topo da célula (row*grid), tiles = largura em blocos.
  const platforms: LdtkPlatform[] = [];
  for (let cy = 0; cy < cHei; cy++) {
    let runStart = -1;
    for (let cx = 0; cx <= cWid; cx++) {
      const solid = cx < cWid && csv[cy * cWid + cx] === solidValue;
      if (solid && runStart < 0) runStart = cx;
      else if (!solid && runStart >= 0) {
        platforms.push([runStart * gridSize, cy * gridSize, cx - runStart]);
        runStart = -1;
      }
    }
  }

  const entities: LdtkEntity[] = (entLayer?.entityInstances ?? [])
    .filter((e) => e.__identifier && e.px)
    .map((e) => ({ id: e.__identifier!, x: e.px![0], y: e.px![1] }));

  return {
    gridSize,
    widthPx: cWid * gridSize,
    heightPx: cHei * gridSize,
    solids,
    platforms,
    entities,
  };
}
