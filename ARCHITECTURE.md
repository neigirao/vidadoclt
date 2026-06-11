# ARCHITECTURE — Corporate Escape

## Visão geral

O jogo roda inteiramente no cliente (browser). O servidor existe apenas para servir o bundle — nenhuma lógica de jogo é server-side.

```
Browser
  └── React (TanStack Start shell)
        └── GameMount.tsx
              └── Phaser.Game (canvas)
                    ├── BootScene
                    ├── OpenSpaceScene
                    └── GameOverScene
```

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
  const game = new Phaser.Game(buildGameConfig(divRef.current))
  return () => game.destroy(true)  // cleanup no unmount
}, [])
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
this.scene.start("NomeDaCena", { dados: passados })
// os dados chegam como parâmetro em create(data)
```

### 5. Entidades

Herdam de `Phaser.Physics.Arcade.Sprite`. Padrão:

```ts
class MinhaEntidade extends Phaser.Physics.Arcade.Sprite {
  // estado
  hp = 3

  constructor(scene, x, y) {
    super(scene, x, y, "tex-nome")
    scene.add.existing(this)
    scene.physics.add.existing(this)
    // configurar body
  }

  preUpdate(t, dt) {
    super.preUpdate(t, dt) // obrigatório para física funcionar
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
Player.onAttack(hitbox, comboStep)
  → OpenSpaceScene.resolveAttack(hb, step)
    → para cada inimigo ativo:
        Phaser.Geom.Intersects.RectangleToRectangle(hb, enemy.getBounds())
        → se colidiu: enemy.hit(damage, knockback)
```

**Motivo:** controle preciso sobre o frame exato do hit, sem depender de eventos de física assíncronos. O ataque existe por exatamente 1 frame (hitbox criada e resolvida no mesmo tick).

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

### 8. Texturas (BootScene)

Todas as texturas são retângulos coloridos gerados em runtime via `Graphics.generateTexture()`. Isso permite rodar o jogo sem nenhum asset externo (zero requisições de rede para sprites).

Quando sprites reais forem adicionados:
1. Colocar imagens em `public/assets/`
2. Carregar em `BootScene.preload()`: `this.load.image("tex-player", "assets/player.png")`
3. Remover o `makeRect("tex-player", ...)` correspondente
4. Ativar `pixelArt: true` já está no config — funciona sem mudança

### 9. Persistência (não implementado ainda)

Para Reconhecimento e progresso entre runs, usar `localStorage`:

```ts
// salvar
localStorage.setItem("ce-reconhecimento", String(total))
// carregar
const saved = Number(localStorage.getItem("ce-reconhecimento") ?? "0")
```

Criar um módulo `src/game/systems/SaveData.ts` com funções `load()` e `save()` para centralizar.

## Decisões de design técnico

| Decisão | Motivo |
|---------|--------|
| Phaser 4 (não 3) | Versão mais recente; API compatível com Phaser 3, melhor performance |
| Arcade physics | Simples, rápido, suficiente para plataformer 2D sem polígonos complexos |
| `pixelArt: true` | Desativa interpolação bilinear — crisp pixels em qualquer escala |
| Scale FIT | Mantém proporção 16:9 em qualquer resolução de janela sem distorção |
| `runChildUpdate: false` + `preUpdate` | Phaser 4 chama `preUpdate` em sprites mesmo sem runChildUpdate; usar `preUpdate` é mais confiável |
| Hitboxes manuais no combate | Controle de frame preciso, sem latência do sistema de física |
| Sem server functions no jogo | Phaser não é compatível com SSR; todo estado de jogo é client-only |

## Adicionando uma nova fase

1. Criar `src/game/scenes/NomeDaFaseScene.ts`
2. Registrar em `config.ts` → `buildGameConfig()` → array `scene`
3. Adicionar transição ao final da fase anterior:
   ```ts
   this.scene.start("NomeDaFaseScene", { vr: this.player.vr, sanity: this.player.sanity })
   ```
4. No `create(data)` da nova cena, restaurar os atributos do jogador a partir de `data`
5. Criar entidades e layout próprios da fase

## Estrutura de dados futura (meta-progressão)

```ts
// src/game/systems/SaveData.ts
interface SaveData {
  reconhecimento: number      // meta-moeda permanente
  fgts: number                // acumulado entre runs
  loopsCount: number          // para diálogos do Faxineiro
  unlockedClasses: string[]
  unlockedWeapons: string[]
  unlockedPerks: string[]
}

// src/game/systems/RunData.ts
interface RunData {
  class: "estagiario" | "analista" | "terceirizado"
  currentWeapon: string
  activePerks: string[]
  corporateCulture: string
  vr: number
  energy: number
  sanity: number
  currentPhase: number
  checkpointPhase: number
}
```
