import { EnemyId } from "./EnemyCatalog";

const LS_KEY = "vidadoclt_bestiary";

let _cache: Set<EnemyId> | null = null;

function load(): Set<EnemyId> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as EnemyId[]);
  } catch { return new Set(); }
}

function persist(set: Set<EnemyId>) {
  try { localStorage.setItem(LS_KEY, JSON.stringify([...set])); } catch {}
}

function cache(): Set<EnemyId> {
  if (!_cache) _cache = load();
  return _cache;
}

export function markKilled(id: EnemyId): void {
  const s = cache();
  if (!s.has(id)) {
    s.add(id);
    persist(s);
  }
}

export function hasKilled(id: EnemyId): boolean {
  return cache().has(id);
}

export function getAllKilled(): ReadonlySet<EnemyId> {
  return cache();
}
