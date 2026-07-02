## Estado atual (o que já está pronto)

- ✅ **Refit de sprites concluído**: 406 frames re-centralizados; atlas re-empacotado (988 frames); `check-sprites.mjs` valida 987 PNGs.
- ✅ **Etapa 1 — `EnemyDef` estendido** (`src/game/systems/EnemyCatalog.ts`): 29 inimigos catalogados com `archetype`, `spritePrefix`, `bodySize`, `attacks`, `drops`, `description`. Helpers `getEnemyDef`, `getEnemiesByPhase`, `getEnemiesByArchetype`.
- ✅ **Etapa 2 — `EnemyRegistry`** (`src/game/systems/EnemyRegistry.ts`): `spawnEnemy(scene, id, x, y, opts)` + `loopScaling(loopCount)`. Não-destrutivo: cenas existentes seguem instanciando classes diretamente.
- ✅ **Etapa 3 — SpriteLibrary reforçada**: `getAnimFrames(prefix, states, expectedCount)`, `bindEnemySprite(sprite, texKey)` (flip automático), `warnMissing(scene, prefix)` para diagnóstico em DEV.
- ✅ **Etapa 5 — Tela "Bestiário"** (`src/game/scenes/BestiaryScene.ts` + `src/game/systems/BestiarySystem.ts`): lista inimigos com sprite idle, nome, fase, arquétipo, descrição; silhueta `???` para não-vistos; persistência em `localStorage` com contagem de kills; hook em `Enemies.hit()` no `hp ≤ 0`.

## Próxima adequação pendente

### Etapa 4 — `BossCatalog` expandido

Catalogar os 7 bosses cuja arte já existe em `_sources/` mas não estão no jogo:
`arquiteto, cacador-metas, coordenador, diretor, guardiao-ordem, product-owner, rh-predador, vice-presidente`.

Apenas dados por enquanto (HP/fase/sprite/ataques/descrição) — o spawn e as cenas de encontro ficam para uma sprint dedicada.

Estrutura sugerida (`src/game/systems/BossCatalog.ts`):

```ts
export type BossId =
  | "gerente_microgestor"
  | "arquiteto"
  | "cacador_metas"
  | "coordenador"
  | "diretor"
  | "guardiao_ordem"
  | "product_owner"
  | "rh_predador"
  | "vice_presidente"
  | "ceo";

export interface BossDef {
  id: BossId;
  name: string;
  phase: number;
  spritePrefix: string; // ex: "boss-arquiteto"
  hp: number;
  contactDamage: number;
  attacks: Array<{ name: string; telegraphMs: number; damage: number; cooldownMs: number }>;
  description: string;
  implemented: boolean; // false por enquanto para os 7 novos
}
```

Uma vez pronto, a `BestiaryScene` pode ganhar uma aba "Bosses" reaproveitando o mesmo padrão de silhueta `???`/derrotado.
