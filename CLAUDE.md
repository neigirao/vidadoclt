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
    constants.ts           # GAME_WIDTH, GAME_HEIGHT, COLORS
    GameMount.tsx          # Componente React que instancia/destrói Phaser.Game
    scenes/
      BootScene.ts         # Carrega atlas + backgrounds, gera texturas restantes
      MenuScene.ts         # Menu principal (JOGAR / JOGAR V2 / ...)
      ClassSelectScene.ts  # Seleção de classe (Estagiário/Analista/Terceirizado)
      OpenSpaceScene.ts    # Fase 1 — Open Space (versão original)
      OpenSpaceV2Scene.ts  # Fase 1 — versão limpa (rendering sólido, ver abaixo)
      CopaScene.ts         # Área segura: cura sanidade + loja (Faxineiro)
      Phase2Scene.ts       # Fases 2–5
      Phase3Scene.ts
      Phase4Scene.ts
      Phase5Scene.ts
      CeoScene.ts          # Chefe final (CEO)
      VitoriaScene.ts      # Tela de vitória
      GameOverScene.ts     # "Rescisão da tentativa"
    entities/
      Player.ts            # Controller do jogador
      Enemies.ts           # Inimigos da Fase 1 + projéteis (PostIt, InkProjectile)
      PhaseEnemies.ts      # Inimigos das fases 2–5
      Boss.ts              # GerenteMicrogestor + EmailProjectil
      CeoBoss.ts           # CeoBoss
      Faxineiro.ts         # NPC da Copa
    systems/
      SpriteLibrary.ts     # resolveSprite() — roteia chaves tex-* p/ frames do atlas
      TextureFactory.ts    # makeRect/makeX — texturas geradas em runtime
      Background.ts        # addPhaseBackground()
      Hud.ts               # HUD (Energia, Sanidade, VR, boss bar, minimapa)
      PlayerState.ts       # RunState (registry "run"), persistência localStorage
      WeaponSystem.ts      # CLASSES + WEAPONS (3 classes, 15 armas)
      PerkSystem.ts        # Perks
      Shop.ts              # Loja da Copa
      SanityFx.ts          # Efeitos visuais por faixa de sanidade
  routes/
    __root.tsx             # Layout raiz (QueryClient, error boundary)
    index.tsx              # Rota "/" — monta GameMount full-screen
  components/ui/           # shadcn/ui — não usado pelo jogo ainda
  lib/utils.ts             # clsx + tailwind-merge
```

## Constantes de gameplay (constants.ts e Player.ts)

```ts
// Física
GRAVITY         = 1200
WALK_SPEED      = 200   // px/s (modulado por classDef.speedMult)
JUMP_VEL        = -520  // velocidade inicial do pulo
DASH_SPEED      = 600   // px/s durante dash
DASH_MS         = 150   // duração do dash em ms
DASH_COOLDOWN   = 1500  // ms
COYOTE_MS       = 100   // grace window após sair de plataforma
JUMP_BUFFER_MS  = 100   // janela de input do pulo

// Combate
COMBO_WINDOW_MS = 250   // janela entre hits do combo
HIT_INVULN_MS   = 600   // i-frames após tomar dano
// dano/knockback por arma vêm de WEAPONS[weaponId].hitDamages / comboKnockback
```

## Controles

| Ação | Tecla |
|------|-------|
| Andar | ← → ou A D |
| Pular | Espaço ou W |
| Dash | Shift |
| Atacar | J |
| Ataque especial | K |
| Interagir (portas/loja) | E |

## Fluxo de cenas

```
BootScene → MenuScene → ClassSelectScene → OpenSpaceScene  ─┐
                                        └→ OpenSpaceV2Scene ─┤
                                                            ↓
   CopaScene ↔ Phase2 → Phase3 → Phase4 → Phase5 → CeoScene → VitoriaScene
                                                            ↓
                                                     GameOverScene
```

- **BootScene** carrega o atlas (`/assets/atlas.png` + `.json`) e backgrounds, depois vai pra MenuScene.
- **MenuScene** → "JOGAR" (cena V1) ou "JOGAR V2" (define `run.v2Mode = true`) → ClassSelectScene.
- **ClassSelectScene** → `this.scene.start(run.v2Mode ? "OpenSpaceV2Scene" : "OpenSpaceScene")`.
- Após derrotar o boss da fase, a porta da **Copa** desbloqueia (tecla E).
- Morte do jogador → `scene.start("GameOverScene", { vr, cause })`.

## OpenSpaceV2Scene (rendering limpo)

Versão re-escrita da Fase 1 criada para evitar bugs de rendering da V1. Diferenças principais:

- **Móveis com corpo sólido**: plataformas usam `this.add.graphics().fillStyle(0x5c3318)` em vez de texturas esticadas (a V1 esticava texturas de estante coloridas → efeito "arco-íris").
- **Superfícies do atlas direto**: `this.add.image(x, y, "sprites", "tile-platform")`.
- **`furnitureBodies` é um StaticGroup separado** de `platforms`: só o **player** colide com os corpos dos móveis; inimigos de chão atravessam livremente (evita "parede invisível" que travava patrulha).
- Mesmo elenco de inimigos/boss da V1.

Acesso: menu "JOGAR V2".

## Sistema de sprites (atlas)

Os sprites de personagem/inimigo/chefe/objeto vêm de um **atlas empacotado** (`public/assets/atlas.png` + `atlas.json`), carregado em `BootScene` como textura `"sprites"`. Alguns assets soltos (tex-floor, tex-vr, tex-inkproj, backgrounds) são carregados via `load.image`.

### resolveSprite (SpriteLibrary.ts)
Chaves lógicas `tex-<nome>` são resolvidas para `[textura, frame?]`:
- `tex-estagiario-idle0` → frame `enemy-estagiario-idle0` do atlas
- prefixos testados: `<nome>`, `<nome>-idle`, `enemy-<nome>`, `obj-<nome>`, `obj-<nome>-idle`, `item-<nome>`, `npc-<nome>`, `tile-<nome>`
- `EXPLICIT_ALIASES` cobre exceções (ex: `postit` → `item-postit-active0`)

### Fonte dos sprites e re-empacotamento
- Os PNGs individuais ficam em `public/assets/sprites/`. São a **fonte** do atlas.
- Após editar qualquer PNG em `sprites/`, **re-empacote**: `node scripts/pack-atlas.mjs` (regenera `atlas.png` + `atlas.json`). Editar só o PNG individual **não** reflete no jogo, que carrega o atlas.
- Scripts de extração de spritesheets em `scripts/` (extract-*, pack-atlas).

### Band-aids de sprite ativos
Nenhum band-aid ativo no momento.
- ✅ **CoordenadorDeSinergia**: arte nova extraída (`enemy-coordenador-*`), prefixo `coordenador` funcionando.
- ✅ **AnalistaSeniorExausto**: spawn ativo em `OpenSpaceV2Scene`, arte nova em `enemy-senior-*`.

## Estado atual

### Implementado
- Player completo: andar, pular (coyote + buffer), dash (i-frames), combo, ataque especial (K), interação (E)
- 3 classes (Estagiário, Analista, Terceirizado) com stats próprios
- 15 armas (WeaponSystem) + perks (PerkSystem)
- Inimigos da Fase 1 (Enemies.ts) e fases 2–5 (PhaseEnemies.ts)
- Bosses: Gerente Microgestor (Boss.ts), CEO (CeoBoss.ts)
- Fases: Open Space (V1 e V2), Fases 2–5, CEO, Copa, Vitória
- Sprites reais via atlas; Sanidade com efeitos visuais por faixa (SanityFx)
- Persistência de Reconhecimento/FGTS/Loops em `localStorage` (PlayerState)
- Copa: cura de sanidade + loja (Faxineiro), checkpoint
- HUD com boss bar e minimapa; Game Over (VR → Reconhecimento ×0.25)

### Pendente / em aberto
- Áudio

## Padrões e convenções

### Adicionar novo inimigo
1. Criar classe em `Enemies.ts` (Fase 1) ou `PhaseEnemies.ts` (Fases 2–5) estendendo `Phaser.Physics.Arcade.Sprite`
2. No construtor, usar `resolveSprite("tex-<nome>-idle0")` para a textura inicial
3. Implementar `preUpdate(t, dt)` (IA) e `hit(damage, knockback): boolean` (retorna `true` se morreu)
4. Animar via `setEnemyTex(this, t, "<prefixo>", state)` — exige frames `<prefixo>-{idle,walk,attack,hurt}N` no atlas
5. Garantir que os frames existem no atlas (adicionar em `sprites/` + `pack-atlas.mjs`)
6. Na cena: criar grupo, collider com `platforms` (não com `furnitureBodies`), registrar em `resolveAttack()`

### Adicionar nova cena
1. Criar `src/game/scenes/NomeDaCena.ts` estendendo `Phaser.Scene`
2. Importar e registrar no array `scene` em `config.ts` → `buildGameConfig()`
3. Navegar via `this.scene.start("NomeDaCena", dados)`

### Sprites / texturas
- Personagens/objetos: usar `resolveSprite`/`addImage`/`addSprite` (SpriteLibrary) com chave `tex-*`.
- Texturas geradas em runtime: `TextureFactory.ts`.
- Após mexer em PNG de `sprites/`, rodar `node scripts/pack-atlas.mjs`.

### HUD
O HUD (`Hud.ts`) usa `setScrollFactor(0)` para fixar à câmera. Instanciar `new Hud(this, levelWidth)` na cena e chamar `hud.update({...})` no `update`.

### Nomenclatura
- Arquivos de cena: `NomeDaFaseScene.ts`
- Arquivos de entidade: nome da entidade em PascalCase
- Chaves de sprite: `tex-nome-kebab-case`
- Constantes de gameplay: UPPER_SNAKE_CASE no topo do arquivo
- Termos do jogo em português (VR, Energia, Sanidade, Reconhecimento, Burnout)

## Terminologia do jogo → código

| GDD | Código |
|-----|--------|
| Energia | `player.energy` |
| Sanidade | `player.sanity` |
| Vale Refeição | `player.vr` |
| Reconhecimento | `run.reconhecimento` (persistido) |
| Rescisão | tela de Game Over |
| Ponto Eletrônico | checkpoint (Copa) |
| Autonomia | `run.autonomia` (perk pós-boss) |
| Burnout | sanidade = 0, faixa "burnout" (`sanityBand`) |

## Comandos

```bash
bun dev                      # servidor de desenvolvimento
bun run build                # build de produção (vite build)
bun lint                     # ESLint
bun format                   # Prettier
node scripts/pack-atlas.mjs  # re-empacota o atlas a partir de public/assets/sprites/
```

## Decisões de arquitetura

- **Phaser isolado do React**: `GameMount.tsx` é o único ponto de contato. O jogo não usa hooks, estado React ou context — tudo via Phaser + registry (`run`).
- **Estado da run no registry**: `getRun(scene)` lê/cria `RunState` no `scene.registry`; persiste Reconhecimento/FGTS/Loops em `localStorage`.
- **Atlas empacotado**: sprites reais vêm de `atlas.png`. Editar PNG individual exige `pack-atlas.mjs`.
- **furnitureBodies separado de platforms** (V2): móveis bloqueiam só o player; inimigos de chão patrulham livremente.
- **Arcade physics**: suficiente. Não mudar para Matter.js sem necessidade concreta.
- **pixelArt: true** no config Phaser: desativa antialiasing. Não remover.
- **Hitboxes manuais no resolveAttack**: o ataque usa `Phaser.Geom.Intersects.RectangleToRectangle` com hitbox calculada pelo Player, não `physics.add.overlap`. Mantém controle preciso do timing do combo.
