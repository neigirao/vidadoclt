import { EnemyId } from "./EnemyCatalog";

const LS_KEY = "vidadoclt_bestiary";
const LS_COUNTS_KEY = "vidadoclt_bestiary_counts";

// --- Boolean kill set (has seen / killed once) ---
let _cache: Set<EnemyId> | null = null;

function load(): Set<EnemyId> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as EnemyId[]);
  } catch {
    return new Set();
  }
}

function persist(set: Set<EnemyId>) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify([...set]));
  } catch {
    /* storage/áudio indisponível — ignorar */
  }
}

function cache(): Set<EnemyId> {
  if (!_cache) _cache = load();
  return _cache;
}

// --- Kill counts ---
let _counts: Record<string, number> | null = null;

function loadCounts(): Record<string, number> {
  try {
    const raw = localStorage.getItem(LS_COUNTS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, number>;
  } catch {
    return {};
  }
}

function persistCounts(counts: Record<string, number>) {
  try {
    localStorage.setItem(LS_COUNTS_KEY, JSON.stringify(counts));
  } catch {
    /* storage/áudio indisponível — ignorar */
  }
}

function counts(): Record<string, number> {
  if (!_counts) _counts = loadCounts();
  return _counts;
}

// Contador de kills da RUN atual (volátil, não persiste). markKilled é o caminho
// comum de TODA morte de inimigo/boss, então é o lugar certo p/ contar. Reiniciado
// por resetRunKills() no começo de cada run (PlayerState.resetRun). Consumido pelo
// death recap da Rescisão.
let _runKills = 0;
export function runKills(): number {
  return _runKills;
}
export function resetRunKills(): void {
  _runKills = 0;
}

export function markKilled(id: EnemyId): void {
  _runKills++;
  const s = cache();
  if (!s.has(id)) {
    s.add(id);
    persist(s);
  }
  const c = counts();
  c[id] = (c[id] ?? 0) + 1;
  persistCounts(c);
}

export function hasKilled(id: EnemyId): boolean {
  return cache().has(id);
}

export function getKillCount(id: EnemyId): number {
  return counts()[id] ?? 0;
}

export function getAllKilled(): ReadonlySet<EnemyId> {
  return cache();
}
