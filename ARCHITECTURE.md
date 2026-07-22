# ARCHITECTURE — Corporate Escape

## Visão geral

O jogo roda inteiramente no cliente (browser). O servidor existe apenas para servir o bundle — nenhuma lógica de jogo é server-side.

```
Browser
  └── React (TanStack Start shell)
        └── GameMount.tsx
              └── Phaser.Game (canvas)
                    ├── PreloadScene → BootScene → MenuScene
                    ├── OpenSpaceV2Scene (Fase 1) → Copa → Fase 2..5 → CEO
                    └── VitoriaScene / GameOverScene
```

> Nota histórica: a V1 `OpenSpaceScene` foi aposentada — só existe a
> `OpenSpaceV2Scene`. As cenas de fase estendem `BasePhaseScene`.

## Camadas

### 1. Shell React (TanStack Start)

Responsabilidades:

- Servir o HTML inicial
- Gerenciar rotas (`/`, potencial `/menu`, `/credits`)
- Fornecer contexto de React Query para futuras integrações (leaderboard, saves na nuvem)

**Não faz:** não gerencia estado de jogo, não renderiza nada do jogo, não conhece Phaser.

### 2. GameMount.tsx

Ponte entre React e Phaser.

```tsx
useEffect(() => {
  const game = new Phaser.Game(buildGameConfig(divRef.current));
  return () => game.destroy(true); // cleanup no unmount
}, []);
```

Regras:

- SSR-safe: checa `typeof window !== 'undefined'` antes de instanciar
- Sem props passadas para o Phaser — configuração fica em `config.ts`
- O `<div>` pai é o canvas container; Phaser injeta o `<canvas>` dentro dele

### 3. config.ts

Fonte única de verdade para:

- Dimensões (`GAME_WIDTH = 960`, `GAME_HEIGHT = 540`)
- Paleta de cores (`COLORS`)
- Configuração do Phaser (`buildGameConfig`)

Qualquer constante visual ou de física que precise ser compartilhada entre cenas vai aqui.

### 4. Cenas Phaser

Cada cena é uma classe `extends Phaser.Scene`. Ciclo de vida:

- `create()`: instancia objetos, configura físicas, cria HUD
- `update(time, delta)`: loop principal (60fps)
- `preUpdate()` nos sprites: lógica de IA dos inimigos

**Transição entre cenas:**

```ts
this.scene.start("NomeDaCena", { dados: passados });
// os dados chegam como parâmetro em create(data)
```

### 5. Entidades

Herdam de `Phaser.Physics.Arcade.Sprite`. Padrão:

```ts
class MinhaEntidade extends Phaser.Physics.Arcade.Sprite {
  // estado
  hp = 3;

  constructor(scene, x, y) {
    super(scene, x, y, "tex-nome");
    scene.add.existing(this);
    scene.physics.add.existing(this);
    // configurar body
  }

  preUpdate(t, dt) {
    super.preUpdate(t, dt); // obrigatório para física funcionar
    // lógica de IA
  }

  hit(damage, knockback): boolean {
    // retorna true se morreu
  }
}
```

**Por que `preUpdate` e não `update`?**
Os inimigos são adicionados a `physics.add.group({ runChildUpdate: false })`. A cena chama `preUpdate` automaticamente nos sprites do grupo via Phaser internals; `update` não seria chamado sem `runChildUpdate: true`.

### 6. Sistema de combate

Não usa `physics.add.overlap` para ataques do jogador — usa hitboxes calculadas manualmente:

```
Player.onAttack(hb, step, swingId, firstFrame)
  → cena.resolveAttack(...) → systems/MeleeCombat.resolveMeleeAttack(host, ...)
    → para cada inimigo ativo:
        Phaser.Geom.Intersects.RectangleToRectangle(hb, enemy.getBounds())
        → se colidiu (dedup por swingId): enemy.hit(damage, knockback)
```

**Motivo:** controle preciso do frame do hit, sem latência de eventos de física.
`systems/MeleeCombat.ts` é a implementação **canônica** (dedup por swingId, juice,
sparks, healOnKill, elite VR, `flash` de luz reativa); OpenSpaceV2/BasePhaseScene/
CeoScene delegam via um `MeleeHost`. **Não** reimplementar `resolveAttack` numa
cena nova — montar um host.

Ataques dos inimigos (Analista Júnior) usam o caminho inverso: o inimigo mantém `swingHitbox` ativo durante o estado `swing`, e a cena checa a intersecção com o player em `update()`.

### 7. HUD

Implementado como `Phaser.GameObjects.Container` com `setScrollFactor(0)` — fica fixo na tela independente do scroll da câmera.

```
hudContainer (scrollFactor 0, depth 1000)
  ├── panel (retângulo semi-transparente)
  ├── hudEnergy (Graphics — redesenhado todo frame)
  ├── hudSanity (Graphics — redesenhado todo frame)
  ├── hudVR (Text)
  └── hudClock (Text)
```

`Graphics` é mais eficiente para barras dinâmicas que `Image` escalada porque evita criar texturas intermediárias.

### 8. Sprites (atlas empacotado)

Os sprites de personagem/inimigo/boss/objeto vêm de um **atlas empacotado**
(`public/assets/atlas.png` + `atlas.json`), carregado em `BootScene` como textura
`"sprites"`. `resolveSprite("tex-<nome>")` (SpriteLibrary) resolve a chave lógica
para `[textura, frame]`. Alguns assets soltos (backgrounds, tex-floor, projéteis)
vêm de `load.image`. Texturas simples/geradas em runtime ainda existem em
`TextureFactory.ts` (makeRect/makeX) para placeholders.

Fonte dos sprites: PNGs individuais em `public/assets/sprites/` (a **fonte** do
atlas). Após editar qualquer PNG, re-empacotar: `node scripts/pack-atlas.mjs`.
Ver `CLAUDE.md` → "Sistema de sprites" para o pipeline completo (cobertura de
frames, audits, LAB de sprites, geração procedural).

### 8b. Camada de sistemas visuais (juice/leitura)

Sobre o gameplay há uma camada de sistemas puramente visuais, cada um seguindo o
padrão "follow" (lista de pares repovoada no `update` da cena):

- **`ContactShadows`** — elipse de sombra sob cada personagem, ancorada ao chão
  (encolhe ao pular).
- **`RimLight`** — contorno quente que separa o sprite do fundo (cópia ADD
  deslocada; `sprite.preFX` não existe nesta build).
- **`SecondaryMotion`** — crachá pendular do player (follow-through por pêndulo
  mola-amortecedor).
- **`Lighting`** — lightmap aditivo (penumbra + poças de luz) com `flash()`
  reativo a combate (impacto/morte acendem o ambiente). Ligado no CEO + Fases 2–5.
- **`ParticleFactory` + `Vfx`** — catálogo único de VFX (paleta `VFX_PALETTE`);
  `VfxLabScene` (DEV) é o visualizador.
- **`BossPresence`**, **`ThreatMarkers`**, **`EliteSystem`**, **`SanityFx`**,
  **`PostFx`**, **`CombatFx`/`Juice`** — presença de boss, leitura de ameaça,
  elites, efeitos de sanidade, grade cinematográfico e juice de combate.

Todos respeitam `reduceSanityFx` (acessibilidade) onde faz sentido.

### 8c. Portões de qualidade (CI)

Além de `tsc`/lint/testes, o CI roda gates determinísticos (ver `CLAUDE.md` →
Comandos):

- `check:frames` — piso de cobertura de frames por categoria×ação.
- `smoke` — boota cada cena headless (erro de console = falha).
- `validate:levels` — boota cada fase × seed × rota e reprova nível **injogável**
  (`LevelValidator` headless; `scene.lastLevelReport`).
- `audit:sprites` — defeito mecânico de frame (vazio/chapado/faltando).
- `audit:anim --gate` — **ratchet de suavidade** (não-regressão vs
  `anim-baseline.json`; ver `docs/ANIM_POLICY.md`).
- `visual` — regressão pixel-a-pixel de cenas de UI (não-bloqueante por ora).

### 9. Persistência (`systems/PlayerState.ts`)

O estado da run vive no `scene.registry` (chave `"run"`, tipo `RunState`).
`getRun(scene)` lê/cria; `savePersisted(reconhecimento, fgts, loopCount)` grava a
**meta-progressão** em `localStorage`. Testes unitários cobrem a lógica pura
(faixas de sanidade, culturas, perks, upgrades).

```ts
const run = getRun(this); // RunState no registry
savePersisted(run.reconhecimento, run.fgts, run.loopCount); // meta em localStorage
```

Regra de testabilidade: sistemas de lógica pura (`CulturaSystem`, `PerkSystem`)
importam `Player`/`RunState` como `import type` para não puxar Phaser no runtime
(que não importa no `bun:test`); funções puras isoláveis vão para módulos sem
Phaser (ex.: `sanity.ts`).

## Decisões de design técnico

| Decisão                               | Motivo                                                                                            |
| ------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Phaser 4 (não 3)                      | Versão mais recente; API compatível com Phaser 3, melhor performance                              |
| Arcade physics                        | Simples, rápido, suficiente para plataformer 2D sem polígonos complexos                           |
| `pixelArt: true`                      | Desativa interpolação bilinear — crisp pixels em qualquer escala                                  |
| Scale FIT                             | Mantém proporção 16:9 em qualquer resolução de janela sem distorção                               |
| `runChildUpdate: false` + `preUpdate` | Phaser 4 chama `preUpdate` em sprites mesmo sem runChildUpdate; usar `preUpdate` é mais confiável |
| Hitboxes manuais no combate           | Controle de frame preciso, sem latência do sistema de física                                      |
| Sem server functions no jogo          | Phaser não é compatível com SSR; todo estado de jogo é client-only                                |

## Adicionando uma nova fase (2–5)

As Fases 2–5 estendem `BasePhaseScene`, que centraliza create/update, combate,
colliders, boss wiring, validador e HUD. Uma nova fase implementa só os métodos
abstratos:

1. Criar `src/game/scenes/NomeDaFaseScene.ts` estendendo `BasePhaseScene`.
2. Implementar: `getBgKey`, `getPhaseTitle`, `getPhaseNumber`, `getInitialObjective`,
   `getPlatformLayout`, `getDoorConfig`, `getBossName`, `setupEnemiesAndGroups`
   (cria os grupos, popula `this.enemyGroups` e `this.boss`).
3. Registrar em `config.ts` → `buildGameConfig()` → array `scene`.
4. O estado do jogador vem do `run` (registry) via `buildPlayer` — não passar
   dados por `scene.start`. A transição entre fases passa pela Copa (`cameFrom`).

A Fase 1 (`OpenSpaceV2Scene`) também estende `BasePhaseScene`, mas mantém
`create()` próprio (mecânicas exclusivas) reusando os helpers da base.

## Estado da run (`RunState` em `PlayerState.ts`)

O tipo real que persiste no registry (resumo dos campos principais):

```ts
type RunState = {
  characterClass?: ClassId; // classe escolhida
  weaponId?: WeaponId; // arma atual
  perks?: PerkId[]; // perks ativos
  culturas?: CulturaId[]; // culturas da run
  vr: number; // moeda in-run
  energy: number;
  sanity: number;
  reconhecimento: number; // meta-moeda (persistida)
  fgts: number; // acumulado entre runs (persistido)
  loopCount: number; // nº de loops (persistido; gate de onboarding)
  cameFrom?: string; // origem da cena atual (ex.: "copa")
  nextScene?: string; // próxima fase após a Copa
  openSpaceCleared?: boolean; // marco: Fase 1 concluída
  seed?: string; // seed determinística da run
  extraLives?: number;
  // + upgrades de Reconhecimento (upgMaxEnergy, upgVrDropMult, ...)
};
```
