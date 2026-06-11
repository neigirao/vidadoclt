# CLAUDE.md — Corporate Escape (A Vida do CLT)

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
    scenes/
      BootScene.ts         # Gera texturas placeholder (retângulos coloridos)
      OpenSpaceScene.ts    # Fase 1 — Área 1: gameplay principal
      GameOverScene.ts     # Tela de "Rescisão da tentativa"
    entities/
      Player.ts            # Controller do jogador
      Enemies.ts           # EstagiarioDesesperado, AnalistaJunior
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
| Interagir | E *(não implementado)* |

## Fluxo de cenas

```
BootScene → OpenSpaceScene ↔ GameOverScene
```

BootScene gera texturas e imediatamente inicia OpenSpaceScene.
Morte do jogador → `scene.start("GameOverScene", { vr })`.
Restart → `scene.start("OpenSpaceScene")`.

## Estado atual (Sprint 1 concluída)

### Implementado
- Player controller completo: andar, pular (coyote + buffer), dash (i-frames), combo 3 hits
- 2 inimigos: EstagiarioDesesperado (patrulha simples), AnalistaJunior (state machine: walk → telegraph → swing → recover)
- Nível hardcoded: Área 1 do Open Space (1920×540), 1 chão + 6 plataformas
- HUD: barra Energia, barra Sanidade, contador VR, relógio cosmético
- Drop de VR ao matar inimigos
- Game Over com conversão VR → Reconhecimento (×0.25)

### Não implementado (próximos sprints)
- Efeitos de Sanidade por faixa (50%, 25%, 0% → burnout)
- Persistência de Reconhecimento entre runs (`localStorage`)
- Copa + Faxineiro (área segura, cura de sanidade)
- Ponto Eletrônico (checkpoint + loja)
- Burnout como fail state alternativo
- Classes (Estagiário, Analista Pleno, Terceirizado)
- Sistema de armas (12 armas temáticas)
- Perks (8 no MVP)
- Chefe: Gerente Microgestor
- Áreas 2–4 do Open Space
- Fases 2–5 e CEO
- Cultura Corporativa (modificadores de run)
- NPCs (Faxineiro, Estagiário Conspiracionista, Analista LinkedIn)
- Áudio

## Padrões e convenções

### Adicionar novo inimigo
1. Criar classe em `src/game/entities/Enemies.ts` estendendo `Phaser.Physics.Arcade.Sprite`
2. Implementar `preUpdate(t, dt)` para lógica de IA
3. Implementar `hit(damage, knockback): boolean` retornando `true` se morreu
4. Registrar textura no `BootScene.create()` via `makeRect()`
5. Criar grupo em `OpenSpaceScene`, adicionar collider com platforms, registrar no `resolveAttack()`

### Adicionar nova cena
1. Criar `src/game/scenes/NomeDaCena.ts` estendendo `Phaser.Scene`
2. Registrar no array `scene` em `config.ts` → `buildGameConfig()`
3. Navegar via `this.scene.start("NomeDaCena", dados)`

### Texturas
Todas as texturas são geradas em runtime em `BootScene` via `makeRect()`. Quando sprites reais forem adicionados, carregar em `BootScene.preload()` e remover o `makeRect` correspondente. Chave de textura: prefixo `tex-` + nome (ex: `tex-player`, `tex-analista`).

### HUD
O HUD usa `setScrollFactor(0)` para fixar à câmera. Sempre adicionar ao container `hud` em `OpenSpaceScene.buildHud()` ou criar container análogo em novas cenas.

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
