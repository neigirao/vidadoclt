# CLAUDE.md — A Vida do CLT

Contexto para assistentes de IA trabalhando neste projeto.

## O que é este projeto

Roguelite 2D side-scrolling em pixel art, temática corporativa brasileira. O jogador é um funcionário CLT preso num loop temporal tentando escapar do escritório às 18h. Cada morte reinicia o mesmo dia. Referências: Dead Cells (combate), Hades (NPCs que lembram loops), Enter the Gungeon (armas-piada).

**GDD completo em:** `.lovable/plan.md`

## Stack

| Camada | Tecnologia | Versão |
|--------|-----------|--------|
| Engine de jogo | Phaser | 4.1.0 |
| UI framework | React | 19.2.0 |
| Meta-framework | TanStack Start | 1.167.50 |
| Roteamento | TanStack Router | 1.168.25 |
| Linguagem | TypeScript | 5.8.3 |
| Build | Vite | 7.3.1 |
| Runtime / PM | Bun | 1.x |
| CSS | Tailwind CSS | 4.2.1 |

Phaser roda 100% no cliente. Nenhuma server function é usada pelo jogo — TanStack Start serve apenas o shell React.

## Estrutura do repositório

```
src/
  game/
    config.ts              # GAME_WIDTH, GAME_HEIGHT, COLORS, buildGameConfig()
    GameMount.tsx          # Componente React que instancia/destrói Phaser.Game
    constants.ts           # COLORS, GAME_WIDTH=960, GAME_HEIGHT=540
    scenes/
      BootScene.ts         # Gera texturas placeholder (retângulos coloridos)
      MenuScene.ts         # Tela inicial — título "VIDA DO CLT", 5 itens de menu
      OpenSpaceScene.ts    # Fase 1 — Área 1: gameplay principal (1920×540)
      CopaScene.ts         # Área segura — Copa Corporativa
      GameOverScene.ts     # Tela de "Rescisão da tentativa"
    entities/
      Player.ts            # Controller do jogador
      Enemies.ts           # EstagiarioDesesperado, AnalistaJunior,
                           # FacilitadorDeWorkshop, PostIt,
                           # ScrumMasterCaotico, CoordenadorDeSinergia,
                           # AnalistaSeniorExausto
    systems/
      Hud.ts               # HUD completo: portrait, barras, VR, boss bar, ação
      SanityFx.ts          # Efeitos visuais de Sanidade (vinheta, câmera)
      PlayerState.ts       # Estado da run via scene.registry (RunState)
  routes/
    __root.tsx             # Layout raiz (QueryClient, error boundary)
    index.tsx              # Rota "/" — monta GameMount full-screen
  components/ui/           # shadcn/ui — não usado pelo jogo ainda
  lib/utils.ts             # clsx + tailwind-merge
```

## Constantes de gameplay (config.ts e Player.ts)

```ts
// Física
GRAVITY         = 1200
WALK_SPEED      = 200   // px/s
JUMP_VEL        = -520  // velocidade inicial do pulo
DASH_SPEED      = 600   // px/s durante dash
DASH_MS         = 150   // duração do dash em ms
DASH_COOLDOWN   = 1500  // ms
COYOTE_MS       = 100   // grace window após sair de plataforma
JUMP_BUFFER_MS  = 100   // janela de input do pulo

// Combate
COMBO_WINDOW_MS = 250   // janela entre hits do combo
HIT_INVULN_MS   = 600   // i-frames após tomar dano
// hit 1/2: 10 dano | hit 3: 15 dano + 320 knockback
```

## Controles

| Ação | Tecla |
|------|-------|
| Andar | ← → ou A D |
| Pular | Espaço ou W |
| Dash | Shift |
| Atacar | J |
| Ataque especial | K *(não implementado)* |
| Interagir | E |

## Fluxo de cenas

```
BootScene → MenuScene → OpenSpaceScene ↔ CopaScene
                  ↓
            GameOverScene → OpenSpaceScene (restart)
```

BootScene gera texturas e inicia MenuScene.
JOGAR no menu → fade → `scene.start("OpenSpaceScene")`.
Porta COPA (tecla E) → `scene.start("CopaScene")`.
Morte → `scene.start("GameOverScene", { vr, cause })`.
Restart → `scene.start("OpenSpaceScene")`.

## Catálogo de inimigos implementados

| Classe | HP | Dano | Mecânica | VR drop |
|--------|----|------|----------|---------|
| `EstagiarioDesesperado` | 1 | 15 contato | Patrulha, inverte direção em parede | 1 |
| `AnalistaJunior` | 3 | 20 swing | walk → telegraph 400ms → swing → recover | 3 |
| `FacilitadorDeWorkshop` | 2 | 0 contato | walk → telegraph 350ms → shoot → cooldown; dispara `PostIt` via `onShoot` | 2 |
| `PostIt` | — | 12 sanidade | Projétil do Facilitador, voa em linha reta, sem gravidade | — |
| `ScrumMasterCaotico` | 2 | 8 contato | walk → charge 500ms → shout → recover; grito puxa o jogador via `onShout` | 2 |
| `CoordenadorDeSinergia` | 4 | 5 contato | Lento; pulso de buff a cada 3,2s acelera inimigos num raio 160px | 4 |
| `AnalistaSeniorExausto` | 8 | 35 slam | walk → telegraph 650ms → slam → exhausted 1,6s; knockback 0,25× | 6 |

## Estado atual

### Implementado
- Player controller completo: andar, pular (coyote + buffer), dash (i-frames), combo 3 hits
- **Menu** com título "VIDA DO CLT", 5 itens navegáveis (teclado + mouse)
- **HUD redesenhado**: portrait, barra Energia, barra Sanidade, VR em R$, fase/objetivo, relógio, barra de boss (oculta), barra de ação inferior com slots de arma/especial/skills + minimapa
- **6 inimigos + 1 projétil** (ver catálogo acima)
- Fase 1 — Open Space hardcoded (1920×540): chão + 6 plataformas + 4 áreas de spawn progressivas
- Copa básica (cena existente, sem NPC ainda)
- Drop de VR ao matar inimigos (proporcional ao HP)
- Game Over com conversão VR → Reconhecimento (×0.25)
- Efeitos de Sanidade: vinheta + aberração cromática via `SanityFx`
- Persistência de estado entre cenas via `PlayerState` / `scene.registry`

### Não implementado (próximos sprints)
- Efeitos de Sanidade por faixa (50%, 25%, 0% → burnout)
- Persistência de Reconhecimento entre runs (`localStorage`)
- Faxineiro na Copa (cura de sanidade + diálogo)
- Café disponível para compra na Copa
- Ponto Eletrônico (checkpoint + loja)
- FGTS (meta-recurso acumulado entre runs)
- Burnout como fail state alternativo
- Classes (Estagiário, Analista Pleno, Terceirizado)
- Sistema de armas (12 armas temáticas)
- Perks (8 no MVP)
- Chefe: Gerente Microgestor
- Armadilhas: Convites de Reunião (Área 2)
- Áreas 2–4 do Open Space com layout próprio
- Fases 2–5 e CEO
- Cultura Corporativa (modificadores de run)
- NPCs narrativos (Faxineiro com diálogos, Estagiário Conspiracionista, Analista LinkedIn)
- Áudio

## Padrões e convenções

### Adicionar novo inimigo
1. Criar classe em `src/game/entities/Enemies.ts` estendendo `Phaser.Physics.Arcade.Sprite`
2. Implementar `preUpdate(t, dt)` para lógica de IA (state machine recomendada)
3. Implementar `hit(damage, knockback): boolean` retornando `true` se morreu
4. Para efeitos que precisam de mediação da cena (projéteis, pull do jogador): usar callbacks (`onShoot`, `onShout`, etc.) — o inimigo NÃO acessa a cena diretamente
5. Registrar textura no `BootScene.create()` via `makeRect()`
6. Em `OpenSpaceScene`:
   - Declarar `private grupo!: Phaser.Physics.Arcade.Group`
   - Instanciar em `create()`, adicionar collider com `platforms`
   - Se contato com jogador causa dano, adicionar `physics.add.overlap`
   - Se tem hitbox especial de ataque: checar em `update()` com `Phaser.Geom.Intersects.RectangleToRectangle`
   - Adicionar ao `resolveAttack()` para receber golpes do jogador

### Adicionar nova cena
1. Criar `src/game/scenes/NomeDaCena.ts` estendendo `Phaser.Scene`
2. Registrar no array `scene` em `config.ts` → `buildGameConfig()`
3. Navegar via `this.scene.start("NomeDaCena", dados)`

### Texturas
Todas as texturas são geradas em runtime em `BootScene` via `makeRect()`. Quando sprites reais forem adicionados, carregar em `BootScene.preload()` e remover o `makeRect` correspondente. Chave de textura: prefixo `tex-` + nome (ex: `tex-player`, `tex-analista`).

### HUD (`src/game/systems/Hud.ts`)
Instanciar com `new Hud(this, LEVEL_WIDTH)`. Chamar `hud.update({...})` no `update()` da cena.
Constantes exportadas: `HUD_TOP_H = 68`, `HUD_BOT_H = 56`, `HUD_BOT_Y = GAME_HEIGHT - HUD_BOT_H`.
Para boss: `hud.showBoss(name, maxHp)` / `hud.updateBoss(hp)` / `hud.hideBoss()`.
Para objetivo: `hud.setObjective(text)`.
Todos os elementos usam `setScrollFactor(0)` e `setDepth(1000+)`.

### Nomenclatura
- Arquivos de cena: `NomeDaFaseScene.ts`
- Arquivos de entidade: nome da entidade em PascalCase
- Texturas: `tex-nome-kebab-case`
- Constantes de gameplay: UPPER_SNAKE_CASE no topo do arquivo
- Termos do jogo em português (VR, Energia, Sanidade, Reconhecimento, Burnout)

## Terminologia do jogo → código

| GDD | Código |
|-----|--------|
| Energia | `player.energy` |
| Sanidade | `player.sanity` |
| Vale Refeição | `player.vr` |
| Reconhecimento | calculado em `GameOverScene` (vr × 0.25) |
| Rescisão | tela de Game Over |
| Ponto Eletrônico | checkpoint (não implementado) |
| Burnout | sanidade = 0, fail state alternativo (não implementado) |

## Comandos

```bash
bun dev       # servidor de desenvolvimento
bun build     # build de produção
bun lint      # ESLint
bun format    # Prettier
```

## Decisões de arquitetura

- **Phaser isolado do React**: `GameMount.tsx` é o único ponto de contato. O jogo não usa hooks, estado React ou context — tudo é gerenciado pelo Phaser.
- **Sem geração procedural ainda**: o nível é hardcoded. Geração procedural fica para Sprint 4+.
- **Arcade physics**: suficiente para o estilo de jogo. Não mudar para Matter.js sem necessidade concreta.
- **pixelArt: true** no config Phaser: desativa antialiasing. Não remover.
- **Hitboxes manuais no resolveAttack**: o ataque não usa `physics.add.overlap` — usa `Phaser.Geom.Intersects.RectangleToRectangle` com hitbox calculada pelo Player. Mantém controle preciso sobre timing do combo.
- **Callbacks de efeitos especiais em inimigos**: inimigos como `FacilitadorDeWorkshop` e `ScrumMasterCaotico` expõem callbacks (`onShoot`, `onShout`) que a cena implementa, em vez de o inimigo acessar a cena diretamente. Isso mantém os inimigos reutilizáveis entre cenas.
- **HUD como classe separada**: `Hud` em `src/game/systems/Hud.ts` é independente da cena. Qualquer cena pode instanciar um `Hud` sem duplicar código.
