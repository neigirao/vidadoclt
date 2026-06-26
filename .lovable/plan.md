## Estado atual (o que já está pronto)

- ✅ **Refit de sprites concluído**: 406 frames re-centralizados; atlas re-empacotado (988 frames); `check-sprites.mjs` valida 987 PNGs.
- ✅ **Etapa 1 — `EnemyDef` estendido** (`src/game/systems/EnemyCatalog.ts`): 21 inimigos catalogados com `archetype`, `spritePrefix`, `bodySize`, `attacks`, `drops`, `description`. Helpers `getEnemyDef`, `getEnemiesByPhase`, `getEnemiesByArchetype`.
- ✅ **Etapa 2 — `EnemyRegistry`** (`src/game/systems/EnemyRegistry.ts`): `spawnEnemy(scene, id, x, y, opts)` + `loopScaling(loopCount)`. Não-destrutivo: cenas existentes seguem instanciando classes diretamente.

## Próximas adequações (continuação do roadmap)

Etapas 3 a 5 da expansão do catálogo, ainda pendentes:

### Etapa 1 — Estender `EnemyDef` (não-destrutivo)
Adicionar campos opcionais ao `src/game/systems/EnemyCatalog.ts`:
```ts
type EnemyArchetype = "rusher" | "ranged" | "charger" | "tank"
                    | "healer" | "aerial" | "splitter" | "support";
type EnemyDef = {
  // campos atuais...
  archetype?: EnemyArchetype;
  spritePrefix?: string;        // ex: "telemarketer" → enemy-telemarketer-*
  bodySize?: { w: number; h: number; offsetX?: number; offsetY?: number };
  attacks?: Array<{ name: string; telegraphMs: number; damage: number; cooldownMs: number }>;
  drops?: { vr?: [number, number]; coffeeChance?: number; postitChance?: number };
  audio?: { spawn?: string; hurt?: string; death?: string; attack?: string };
  description?: string;         // bestiário
};
```
Preencher 21 inimigos existentes com dados reais (cruzando `Enemies.ts` + `PhaseEnemies.ts`). Nenhuma classe runtime é tocada nessa etapa.

### Etapa 2 — Criar `EnemyRegistry`
Novo arquivo `src/game/systems/EnemyRegistry.ts`:
```ts
export function spawnEnemy(
  scene: Phaser.Scene,
  id: EnemyId,
  x: number, y: number,
  opts?: { scaleHp?: number; scaleDmg?: number }
): Phaser.Physics.Arcade.Sprite
```
- Mapa interno `id → classConstructor` (TelemarketerZumbi, GuardiaoCafe, etc.).
- Aplica `bodySize` do catálogo automaticamente.
- Aplica scaling de loop (`opts.scaleHp = 1 + loopCount * 0.15`).
- Reativa `EnemySpawns.ts` (hoje órfão) para usar o registry.

Cenas continuam funcionando como hoje; migração das cenas para `spawnEnemy()` é opcional e gradual.

### Etapa 3 — Reforçar `SpriteLibrary`
- `getAnimFrames(prefix, state) → string[]` para criar animações Phaser sem hardcode.
- `bindEnemySprite(sprite, prefix)` — helper de flip automático por `body.velocity.x`.
- `warnMissing()` em dev: loga se um prefixo não tem frames no atlas.
- Mover `EXPLICIT_ALIASES` para JSON co-localizado (`sprite-aliases.json`).

### Etapa 4 — `BossCatalog` expandido
Catalogar os 7 bosses cuja arte já existe em `_sources/` mas não estão no jogo:
`arquiteto, cacador-metas, coordenador, diretor, guardiao-ordem, product-owner, rh-predador, vice-presidente`.
Apenas dados (HP/fase/sprite); spawn fica para sprint futura.

### Etapa 5 — Tela "Bestiário"
Nova `BestiaryScene` acessada do menu:
- Lista inimigos com sprite animado (idle), nome, fase, arquétipo, descrição.
- Inimigos não derrotados aparecem como silhueta `???`.
- Persiste em `localStorage` via `RunState.bestiary: Set<EnemyId>`.
- Hook em `Enemies.hit()` quando `hp ≤ 0` registra o id.

### Ordem de execução
1 → 2 → 3 → 4 → 5. Etapas 1 e 2 são não-destrutivas e podem ser feitas no mesmo ciclo. Etapa 5 depende das 1-2.

### Pergunta de aprovação
Sigo direto com **Etapas 1 + 2 nesta passagem** (catálogo estendido + registry + dados preenchidos), deixando 3-5 para o próximo turno? Ou prefere que eu execute as 5 etapas em sequência num só ciclo?
