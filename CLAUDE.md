# CLAUDE.md — Corporate Escape (A Vida do CLT)

Contexto para assistentes de IA trabalhando neste projeto.

## O que é este projeto

Roguelite 2D side-scrolling em pixel art, temática corporativa brasileira. O jogador é um funcionário CLT preso num loop temporal tentando escapar do escritório às 18h. Cada morte reinicia o mesmo dia. Referências: Dead Cells (combate), Hades (NPCs que lembram loops), Enter the Gungeon (armas-piada).

**GDD completo em:** `.lovable/plan.md`

## Stack

| Camada         | Tecnologia      | Versão   |
| -------------- | --------------- | -------- |
| Engine de jogo | Phaser          | 4.1.0    |
| UI framework   | React           | 19.2.0   |
| Meta-framework | TanStack Start  | 1.167.50 |
| Roteamento     | TanStack Router | 1.168.25 |
| Linguagem      | TypeScript      | 5.8.3    |
| Build          | Vite            | 7.3.1    |
| Runtime / PM   | Bun             | 1.x      |
| CSS            | Tailwind CSS    | 4.2.1    |

Phaser roda 100% no cliente. Nenhuma server function é usada pelo jogo — TanStack Start serve apenas o shell React.

## Estrutura do repositório

```
src/
  game/
    config.ts                # buildGameConfig() + registro do array `scene`
    constants.ts             # GAME_WIDTH, GAME_HEIGHT, COLORS
    GameMount.tsx            # Componente React que instancia/destrói Phaser.Game
    scenes/
      PreloadScene.ts        # Splash estilo AMI BIOS enquanto o atlas carrega
      BootScene.ts           # Carrega atlas + backgrounds, gera texturas restantes
      MenuScene.ts           # Menu principal (JOGAR / RECONHECIMENTO / RANKING / BESTIÁRIO / HORA EXTRA / LAB)
      ClassSelectScene.ts    # Seleção de classe (Estagiário/Analista/Terceirizado)
      CulturaSelectScene.ts  # Modificador de run (Cultura Corporativa)
      ReconhecimentoScene.ts # Loja de upgrades permanentes (meta-progressão)
      HoraExtraScene.ts      # Heat System — dificuldade opt-in por bônus de VR/Reco
      RankingScene.ts        # Leaderboard online (Supabase/Lovable Cloud)
      BestiaryScene.ts       # Bestiário — inimigos derrotados persistidos em LS
      SpriteLabScene.ts      # Lab de sprites: valida todos os assets (ver abaixo)
      OpenSpaceV2Scene.ts    # Fase 1 — Open Space (rendering sólido, ver abaixo)
      BasePhaseScene.ts      # Classe base compartilhada pelas Fases 2–5
      Phase2Scene.ts         # Fases 2–5
      Phase3Scene.ts
      Phase4Scene.ts
      Phase5Scene.ts
      CopaScene.ts           # Área segura entre fases: cura sanidade + loja (Faxineiro)
      CeoScene.ts            # Chefe final (CEO)
      VitoriaScene.ts        # Tela de vitória
      GameOverScene.ts       # "Rescisão da tentativa"
      PauseScene.ts          # Overlay de pause (invocado com scene.launch)
    entities/
      Player.ts              # Controller do jogador
      Enemies.ts             # Inimigos da Fase 1 + projéteis (PostIt, InkProjectile)
      PhaseEnemies.ts        # Inimigos das fases 2–5
      Boss.ts                # GerenteMicrogestor + EmailProjectil
      CeoBoss.ts             # CeoBoss
      Faxineiro.ts           # NPC da Copa
    systems/
      SpriteLibrary.ts       # resolveSprite() + getAnimFrames/bindEnemySprite/warnMissing
      TextureFactory.ts      # makeRect/makeX — texturas geradas em runtime
      Background.ts          # addPhaseBackground()/addPhaseDecor()
      ParticleFactory.ts     # Emitters compartilhados (sparks, dust, hitfx)
      Hud.ts                 # HUD (Energia, Sanidade, VR, boss bar, minimapa)
      PlayerState.ts         # RunState (registry "run"), persistência localStorage
      RNG.ts                 # Seed determinística (seedrandom) + prefixos temáticos
      WeaponSystem.ts        # CLASSES + WEAPONS (3 classes, 12 armas)
      PerkSystem.ts          # Perks aleatórios pós-boss
      CulturaSystem.ts       # 12 Culturas Corporativas (modificadores de run)
      ReconhecimentoSystem.ts# Upgrades permanentes comprados com Reconhecimento
      Shop.ts                # Loja da Copa
      SanityFx.ts            # Efeitos visuais por faixa de sanidade
      sanity.ts              # sanityBand() puro (faixas), testável
      ProductivityMeter.ts   # Medidor de Produtividade da Fase 1 (streak → mult VR)
      Apagao.ts              # Evento APAGÃO (lanterna radial) da Fase 1
      CombatFx.ts            # Juice de combate (hitStop, shake, flash, finisher)
      MeleeCombat.ts         # resolveMeleeAttack() canônico (host pattern)
      CorporateAI.ts         # Helpers de IA (windup, telegraph, dashes)
      AudioSystem.ts         # SFX procedural via Web Audio (sem arquivos)
      MusicSystem.ts         # Trilha ambiente procedural (office/boss/burnout)
      EnemyCatalog.ts        # Metadados de 29 inimigos (fase/HP/dano/drops/desc.)
      BestiarySystem.ts      # Persistência de kills + contagens (localStorage)
      Ranking.ts             # Submissão/leitura do leaderboard via Supabase
      LevelValidator.ts      # Validação de invariantes de fase + overlay DEV
  integrations/supabase/     # Cliente + tipos auto-gerados (Lovable Cloud)
  routes/
    __root.tsx               # Layout raiz (QueryClient, error boundary)
    index.tsx                # Rota "/" — monta GameMount full-screen
  components/ui/             # shadcn/ui — não usado pelo jogo
  lib/utils.ts               # clsx + tailwind-merge
```

## Constantes de gameplay (constants.ts e Player.ts)

```ts
// Física
GRAVITY = 1200;
WALK_SPEED = 200; // px/s (modulado por classDef.speedMult)
JUMP_VEL = -520; // velocidade inicial do pulo
DASH_SPEED = 600; // px/s durante dash
DASH_MS = 150; // duração do dash em ms
DASH_COOLDOWN = 1500; // ms
COYOTE_MS = 100; // grace window após sair de plataforma
JUMP_BUFFER_MS = 100; // janela de input do pulo

// Combate
COMBO_WINDOW_MS = 250; // janela entre hits do combo
HIT_INVULN_MS = 600; // i-frames após tomar dano
// dano/knockback por arma vêm de WEAPONS[weaponId].hitDamages / comboKnockback
// Hitbox de melee (Player.ts): começa 8px atrás do centro (pega inimigo
// colado), alcance = attackRange + 24, altura 52 (pega inimigo em degrau/
// plataforma baixa logo acima/abaixo). Margem de perdão contra o
// "bati e não acertou". A hitbox fica ATIVA por MELEE_ACTIVE_MS (120ms): o
// Player re-dispara onAttack a cada frame da janela (hitbox segue o player), e
// a cena dedup por swingId (getData("hitSwing")) → 1 hit por inimigo por golpe.
// Assim inimigos que entram no alcance logo após o input ainda são acertados.
```

## Controles

| Ação                    | Tecla       |
| ----------------------- | ----------- |
| Andar                   | ← → ou A D  |
| Pular                   | Espaço ou W |
| Dash                    | Shift       |
| Atacar                  | J           |
| Ataque especial         | K           |
| Interagir (portas/loja) | E           |

## Fluxo de cenas

```
PreloadScene → BootScene → MenuScene ─┬─ JOGAR ──→ ClassSelectScene → CulturaSelectScene → OpenSpaceV2Scene ─┐
                                      ├─ RECONHECIMENTO ──→ ReconhecimentoScene (loja permanente)            ↓
                                      ├─ RANKING ──→ RankingScene (Supabase)                                  │
                                      ├─ BESTIÁRIO ──→ BestiaryScene                                          │
                                      ├─ HORA EXTRA ──→ HoraExtraScene (heat system)                          │
                                      └─ LAB SPRITES ──→ SpriteLabScene                                       │
                                                                                                              ↓
   CopaScene ↔ Phase2 → Phase3 → Phase4 → Phase5 → CeoScene → VitoriaScene
                                                             ↓
                                                      GameOverScene
```

- **PreloadScene** mostra splash AMI BIOS enquanto o atlas carrega; encadeia BootScene → MenuScene.
- **MenuScene** roteia para todas as sub-telas listadas acima.
- **ClassSelectScene → CulturaSelectScene** aplicam upgrades/modificadores no `run` e iniciam `OpenSpaceV2Scene`. A `CulturaSelectScene` tem **dois modos**: cheia (`scene.start` com `nextScene` — antes da Fase 1) e overlay (`scene.launch` com `caller` — oferecida de novo após cada boss, pausa/retoma a fase).
- Após derrotar o boss da fase, a porta da **Copa** desbloqueia (tecla E).
- **PauseScene** entra via `scene.launch` (overlay) — não substitui a cena ativa.
- Morte do jogador → `scene.start("GameOverScene", { vr, cause })`.
- **A V1 (`OpenSpaceScene`) foi aposentada**: não está no array `scene` do `config.ts`. Só existe a V2.

## OpenSpaceV2Scene (rendering limpo)

Versão limpa da Fase 1 (a antiga V1 foi descontinuada). Pontos-chave:

- **Móveis com corpo sólido**: plataformas usam `this.add.graphics().fillStyle(0x5c3318)` em vez de texturas esticadas (a V1 esticava texturas de estante coloridas → efeito "arco-íris").
- **Superfícies do atlas direto**: `this.add.image(x, y, "sprites", "tile-platform")`.
- **4 variantes de layout por seed** (`seedNum % 4`): default, elevado, denso e **escada** (escalonado, exige pulos encadeados). Cada carga valida no `LevelValidator`.
- **Encontros por seed** (`spawnEnemyOfType` + `Phaser.Math.RandomDataGenerator([seed])`): as zonas 1–4 variam o **tipo** de inimigo por run a partir de presets do mesmo tier, com **contagem fixa por zona** (3/4/2/4) → orçamento de ameaça e distribuição do validador estáveis. A zona 5 (Scrum + Coordenador-healer + Sênior-tank) é âncora fixa. Rejogabilidade sem desbalancear.
- **Recompensa de exploração vertical**: `spawnVerticalReward()` põe um cache de 💰 (5 VR) na plataforma mais alta do layout — premia subir. Alcançabilidade garantida pelo validador.
- **`furnitureBodies` é um StaticGroup separado** de `platforms`. **Player E inimigos de chão colidem** com os móveis (antes só o player, e inimigos atravessavam). Para não travar os perseguidores contra a mesa, um callback de colisão (`hopOverFurniture`) dá um pulinho quando o inimigo trava de lado no chão — sobe mesa baixa rumo ao alvo; patrulheiros também viram pela lógica de `body.blocked`. Throttle de 500ms por inimigo (`getData("nextHop")`).

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
- O `pack-atlas.mjs` roda uma **validação** ao final: avisa sobre frames vazios/quase-vazios e famílias de animação com tamanho inconsistente.

### Gerador procedural de sprites (`scripts/gen-sprites.mjs`)

**Aprendizado-raiz:** vários assets vieram de extrações de IA mal recortadas (blocos chapados, respingos, frames trocados/vazios). A alternativa robusta é **desenhar sprites simples direto em código**, via um "canvas painter" de pixel-art (helpers `px`/`rect`/`hline`, composição alpha-over). É versionado (diff revisável no PR), reproduzível (packing determinístico → mesmo byte) e sem dependência externa.

- Uso: `node scripts/gen-sprites.mjs [filtro] && node scripts/pack-atlas.mjs`.
- Já gera: Post-it (projétil), drop de Café, copo estático da Copa e os tiles de cenário (`tile-floor` = carpete de escritório usado no rodapé de todas as fases; `tile-platform` = tampo de madeira). Tiles usam RNG determinístico (mulberry32) para textura reproduzível e ladrilham na horizontal. Adicionar novo asset = escrever uma função `canvas(w,h)…save("item-x.png")` e registrar em `SPRITES`.
- Regra de bolso: use o gerador quando o asset em uso estiver quebrado **e** for simples. Para arte complexa (ex: CEO), prefira copiar um frame bom vizinho.

### SpriteLabScene — validação visual (menu "LAB SPRITES")

Área de teste que mostra **todos os assets renderizados** (personagens, inimigos das Fases 1–4, bosses, objetos, drops, projéteis, **cenário: tiles + fundo**) com botões clicáveis: clique no sujeito (2 colunas à esquerda) e na ação (embaixo) → a animação roda em loop. Mostra bounding box, linha dos pés, strip de frames e um painel de diagnóstico; loga `[SpriteLab] nome/ação: Nf sizes=… missing=… → OK/PROBLEMA`. É a forma rápida de flagrar frame trocado/cortado/faltando. Preview auto-escala (assets grandes como o fundo 1920px encolhem para caber).

### Validador de fase (`systems/LevelValidator.ts`)

`validateLevel(spec)` roda contra uma cena **já montada** e verifica invariantes que garantem que a fase é jogável/justa num roguelite (layout varia por seed). Roda só em DEV no fim de `create()` da `OpenSpaceV2Scene` e loga `[LevelValidator] … PASS/FAIL`. Checa: chão contínuo, plataformas alcançáveis por **grafo de pulos encadeados** (`computeReachability` faz BFS do chão; aresta A→B usa a cinemática — apex `v²/2g` + alcance horizontal `walk·tAr + dash`), mesas puláveis (não bloqueiam o corredor), móveis sem sobreposição, spawn seguro (sem inimigo perto do player), inimigos nos limites, boss posicionado, saída presente, e distribuição de inimigos por zonas (ritmo de dificuldade). É agnóstico de fase — dá pra validar Fases 2–5 passando as refs no `LevelSpec`.

`drawLevelOverlay(scene, spec, report)` desenha o diagnóstico **em cima da fase** (tecla **V** em DEV): raio seguro de spawn, arco de pulo, teto de pulo, plataformas/mesas coloridas (verde=ok, vermelho=problema), zonas de dificuldade com contagem, boss/saída, pontos de inimigos, e um painel fixo com PASS/FAIL + checks.

**Ligado em todas as fases**: OpenSpaceV2 e `BasePhaseScene` (Fases 2–5) rodam o validador em DEV. `expectBoss: false` para fases sem boss por design (Fase 5 → CEO é a cena seguinte). As Fases 2–5 têm **3 variantes de layout por seed** (0 original, 1 espelhado, 2 alturas alternadas) aplicadas genericamente sobre `getPlatformLayout()` — todas validadas.

### Padrão de inimigo de fase (2–5)

- **Animação**: `animPhase(this, t, "<prefixo>", nFrames)` no fim do `preUpdate` — cicla `enemy-<prefixo>-walkN` em movimento, volta à base parado. Whitelist: só prefixos cujo walk tem o MESMO tamanho da base (evangelista fora: 64×64 vs 32×48).
- **Telegrafia**: atirador usa `fxGlow` + `showTelegraph` + `delayedCall(320)` antes do disparo (padrão leve; o windup travado do Facilitador/Onboarding é o padrão pesado da Fase 1).

### Eventos de sala (Fase 1) e segredo

`rollRoomEvent` tem 6 eventos + sala normal, com um **badge fixo** do evento ativo (nome + efeito) no canto durante toda a fase. Os **mecânicos** são APAGÃO (sistema `Apagao`: escuridão com lanterna no player — textura 2× da tela com furo radial, pois GeometryMask é Canvas-only no Phaser 4; **acende quando o boss ativa**) e FISCALIZAÇÃO (Sênior extra). O medidor de Produtividade (streak de kills → mult de VR) é o sistema `ProductivityMeter`. Segredo: bater no extintor (x≈1793) derruba +3 VR, 1× por run (`checkExtintorSecret`).

### Band-aids de sprite ativos

Nenhum band-aid ativo no momento.

- ✅ **Post-it / Café (drop) / copo da Copa**: refeitos via `gen-sprites.mjs` (eram bloco amarelo / respingos).
- ✅ **CEO em corrida** (`boss-ceo-run1/2`): frames-lixo substituídos por vizinhos válidos.
- ✅ Inimigos das Fases 2–4 auditados: bases limpas. Inconsistências de tamanho remanescentes são frames idle/walk **não usados** (esses inimigos renderizam base estática).
- ✅ **Ataque animado (Fase 1)**: `setEnemyTex` cicla o estado `attack` via `ATTACK_FRAME_COUNTS` (whitelist de frames validados por inimigo — senior 3, rh/facilitador/analista 2). Frames-lixo 32×48 (facilitador/analista/scrum-attack2) ficam de fora; prefixo ausente → frame 0 estático (sem regressão). `walk`/`idle` já eram consistentes; `hurt` segue single-frame.

## Estado atual

### Implementado

- Player completo: andar, pular (coyote + buffer), dash (i-frames), combo, ataque especial (K), interação (E)
- 3 classes (Estagiário, Analista, Terceirizado) com stats próprios
- 12 armas (WeaponSystem) + perks aleatórios pós-boss (PerkSystem)
- **12 Culturas Corporativas** (CulturaSystem) — modificadores de run selecionados antes da Fase 1
- Inimigos da Fase 1 (Enemies.ts) e Fases 2–5 (PhaseEnemies.ts); catálogo de metadados em `EnemyCatalog.ts` (29 IDs)
- Bosses: Gerente Microgestor (Boss.ts), CEO (CeoBoss.ts)
- Fases: Open Space (V2), Fases 2–5 via `BasePhaseScene`, CEO, Copa, Vitória
- Sprites reais via atlas; Sanidade com efeitos visuais por faixa (SanityFx)
- **Áudio 100% procedural** (Web Audio): SFX em `AudioSystem.ts`, trilha ambiente em `MusicSystem.ts` (temas office/boss/burnout)
- **Meta-progressão**: Reconhecimento persistente, loja de upgrades permanentes (`ReconhecimentoScene` + `ReconhecimentoSystem`)
- **Heat System / Hora Extra**: dificuldade opt-in que multiplica HP inimigo em troca de VR/Reconhecimento
- **Ranking online**: submissão e leitura de scores via Supabase/Lovable Cloud (`Ranking.ts`)
- **Bestiário persistente**: `BestiarySystem` grava kills + contagens em `localStorage`; `BestiaryScene` mostra silhueta `???` para não-vistos
- **RNG determinística** por seed temática (`RNG.ts` — prefixos CLT/FGTS/META/...)
- Persistência de Reconhecimento/FGTS/Loops em `localStorage` (PlayerState)
- Copa: cura de sanidade + loja (Faxineiro), checkpoint
- HUD com boss bar e minimapa; Game Over (VR → Reconhecimento ×0.25)
- **Encontros por seed**: Fase 1 varia o TIPO de inimigo por zona (`spawnEnemyOfType`); Fases 2–5 variam POSIÇÃO/densidade (`pickPositions` em `BasePhaseScene`) — contagem fixa p/ o validador
- **Qualidade**: `tsc` strict + ESLint 0 erros; **testes unitários** (bun:test) de EnemyCatalog, WeaponSystem, ReconhecimentoSystem, **CulturaSystem, PerkSystem, sanityBand** (37 testes); **CI** (GitHub Actions: tsc + lint + test) em `.github/workflows/ci.yml`

### Pendente / em aberto

- **🔴 Bug (decisão pendente) — spawn das Fases 2–5**: `BasePhaseScene.buildPlayer` usa `run.cameFrom === "copa" ? LEVEL_WIDTH - 120 : 80`. Como a Copa seta `cameFrom="copa"`, as Fases 2–5 nascem em **x ≈ 1800 (direita)** — em cima do boss e a 60px da saída (x=1860), com todo o trash (x 200–1550) atrás, nunca enfrentado. Provável fix: `LEVEL_WIDTH - 120` → **`120`** (nascer na esquerda, atravessar até o boss). Exige empurrar os pools da borda esquerda das 4 fases (spawn-seguro) → reformula o ritmo. **Aguarda confirmação antes de reformular.**
- **Ataques especiais dos bosses 2–4**: hoje são classes de inimigo (Coordenador @Fase2, Sênior @Fase3, Scrum @Fase4) com HP inflado, sem repertório telegrafado próprio (diferente do Gerente/CEO). Aditivo.
- **Economia de VR (decisão de balanceamento)**: uma run rende ~57–120 VR e a loja da Copa inteira custa ~40–50 VR (consumíveis 4–6, armas 8–20, perks 10–18) → sem tensão de escolha na 1ª Copa. Opções: subir preços da Copa e/ou limitar o empilhamento de multiplicadores (produtividade × evento × vrDropMult). O excedente vira Reconhecimento (VR×0.25), então não é desperdiçado — é falta de pressão de decisão in-run.
- **Fase 5 falha no `LevelValidator`?** — RESOLVIDO (evangelista movida p/ fora do raio de spawn).
- **Etapa 4 (BossCatalog dos 7 bosses)** — OBSOLETO: a arte-fonte em `_sources/` foi removida; só entra com arte nova.

## Padrões e convenções

### Adicionar novo inimigo

1. Criar classe em `Enemies.ts` (Fase 1) ou `PhaseEnemies.ts` (Fases 2–5) estendendo `Phaser.Physics.Arcade.Sprite`
2. No construtor, usar `resolveSprite("tex-<nome>-idle0")` para a textura inicial
3. Implementar `preUpdate(t, dt)` (IA) e `hit(damage, knockback): boolean` (retorna `true` se morreu)
4. Animar via `setEnemyTex(this, t, "<prefixo>", state)` — exige frames `<prefixo>-{idle,walk,attack,hurt}N` no atlas
5. Garantir que os frames existem no atlas (adicionar em `sprites/` + `pack-atlas.mjs`)
6. Na cena: criar grupo, collider com `platforms` **e** com `furnitureBodies` (usando o callback de pulinho, p/ respeitar mesas sem travar), registrar em `resolveAttack()`
7. **Todo ataque ativo (projétil/lunge) deve telegrafar**: `showTelegraph(this, cor)` + trava/glow antes de disparar (padrão do `FacilitadorDeWorkshop` / `AnalistaOnboarding`). Ataque só por contato (contactDamage) não precisa.

### Adicionar nova cena

1. Criar `src/game/scenes/NomeDaCena.ts` estendendo `Phaser.Scene`
2. Importar e registrar no array `scene` em `config.ts` → `buildGameConfig()`
3. Navegar via `this.scene.start("NomeDaCena", dados)`

### Sprites / texturas

- Personagens/objetos: usar `resolveSprite`/`addImage`/`addSprite` (SpriteLibrary) com chave `tex-*`.
- Texturas geradas em runtime: `TextureFactory.ts`.
- Assets simples quebrados: refazer em `scripts/gen-sprites.mjs` (pixel-art em código).
- Após mexer em PNG de `sprites/`, rodar `node scripts/pack-atlas.mjs`. Valide no **LAB SPRITES**.

### Juice de combate (CombatFx.ts)

- `hitStop`, `shake`, `flash`, `comboFinisher`, `finisherImpact`. **Não** rotacionar a câmera: num side-scroller preso aos limites do mundo, girar na borda joga o alvo/boss para fora do frame (era a causa do "boss some ao tomar hit"). Zoom-pop centrado é seguro.
- Distorção por sanidade fica em `SanityFx.ts` (vignette + barrel + chromatic). O barrel do burnout foi limitado (pincushion ≤7%) para não desalinhar a mira do combate.

### HUD

O HUD (`Hud.ts`) usa `setScrollFactor(0)` para fixar à câmera. Instanciar `new Hud(this, levelWidth)` na cena e chamar `hud.update({...})` no `update`.

### Nomenclatura

- Arquivos de cena: `NomeDaFaseScene.ts`
- Arquivos de entidade: nome da entidade em PascalCase
- Chaves de sprite: `tex-nome-kebab-case`
- Constantes de gameplay: UPPER_SNAKE_CASE no topo do arquivo
- Termos do jogo em português (VR, Energia, Sanidade, Reconhecimento, Burnout)

## Terminologia do jogo → código

| GDD              | Código                                                                                                                                                                                              |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Energia          | `player.energy`                                                                                                                                                                                     |
| Sanidade         | `player.sanity`                                                                                                                                                                                     |
| Vale Refeição    | `player.vr`                                                                                                                                                                                         |
| Reconhecimento   | `run.reconhecimento` (persistido)                                                                                                                                                                   |
| Rescisão         | tela de Game Over                                                                                                                                                                                   |
| Ponto Eletrônico | checkpoint (Copa)                                                                                                                                                                                   |
| Autonomia        | `run.autonomia` (perk pós-boss)                                                                                                                                                                     |
| Burnout          | sanidade = 0, faixa "burnout" (`sanityBand`); penalidades sistêmicas em `Player.getBurnoutMods()` — velocidade, cooldowns, dano recebido, parry desabilitado, tremor (`isTremoring`) invertendo L/R |

## Comandos

```bash
bun dev                      # servidor de desenvolvimento
bun run build                # build de produção (vite build)
bun lint                     # ESLint
bun test src/game            # testes unitários (bun:test) — mesma checagem do CI
bun format                   # Prettier
node scripts/gen-sprites.mjs # (re)gera sprites procedurais (post-it, café, copo)
node scripts/pack-atlas.mjs  # re-empacota o atlas a partir de public/assets/sprites/
```

## Decisões de arquitetura

- **Phaser isolado do React**: `GameMount.tsx` é o único ponto de contato. O jogo não usa hooks, estado React ou context — tudo via Phaser + registry (`run`).
- **Estado da run no registry**: `getRun(scene)` lê/cria `RunState` no `scene.registry`; persiste Reconhecimento/FGTS/Loops em `localStorage`.
- **Atlas empacotado**: sprites reais vêm de `atlas.png`. Editar PNG individual exige `pack-atlas.mjs`.
- **furnitureBodies separado de platforms** (V2): móveis bloqueiam player **e** inimigos de chão; inimigos dão um pulinho ao travar (respeitam a mesa sem clipar/prender).
- **Arcade physics**: suficiente. Não mudar para Matter.js sem necessidade concreta.
- **pixelArt: true** no config Phaser: desativa antialiasing. Não remover.
- **Hitboxes manuais no resolveAttack**: o ataque usa `Phaser.Geom.Intersects.RectangleToRectangle` com hitbox calculada pelo Player, não `physics.add.overlap`. Mantém controle preciso do timing do combo.
- **Combate melee ÚNICO em `systems/MeleeCombat.ts`**: `resolveMeleeAttack(host, hb, step, swingId, firstFrame)` é a implementação canônica (dedup por swingId da janela ativa, juice 1×/golpe, sparks, slow, healOnKill). OpenSpaceV2, BasePhaseScene (Fases 2–5) e CeoScene delegam via um `MeleeHost` (hooks: `killVrMult` p/ produtividade×evento, `onSwingStart` p/ segredo do extintor, `onBossDied`). **Não** reimplementar resolveAttack em cena nova — montar um host. (CopaScene mantém uma mini-versão própria de sandbox, com gate de 1º frame.)
- **OpenSpaceV2Scene estende `BasePhaseScene`**: a Fase 1 herda os helpers compartilhados (`buildPlayer`, `persist`, `spawnProjectile`, `spawnEnemyProjectile`, `resolveAttack`, `handleSpecial`) e implementa os métodos abstratos (`getBgKey`/`getPhaseTitle`/`getDoorConfig`/etc.). Ainda mantém `create()` próprio (não chama `super.create()`) por conta das mecânicas exclusivas (4 variantes de layout, eventos de sala, apagão, medidor de produtividade, healers, café, memo) — mas reusa os **blocos idênticos** de Base via helpers (`setupWorldAndCamera`, `wireParryReclamar`, `setupPauseKey`, `installLevelDebug`). O `super.create()` monolítico **não** é usado de propósito: a Base tem escalonamento de HP por loop (+15%) que colidiria com o da Fase 1 (+20% com inimigos "TRAVADOS"), além de colliders de móveis/postits/café que a Base não conhece — usá-lo dobraria o balanceamento. Overrides da Fase 1: `buildFloor`/`buildPlatform` (mesas desenhadas vs. tiles de PLAT_DEFS), `dropVR` (tint dourado + hover), `getMeleeHost` (hooks `killVrMult`/`onSwingStart`). O boss é um `GerenteMicrogestor` guardado em `this.gerente` (ref tipada) além do `this.boss` herdado (supertipo `BossEntity`); a derrota é `handleGerenteDefeat` (renomeado p/ não colidir com `handleBossDefeat` da base). O **`update()` já foi unificado**: a Fase 1 não tem mais `update()` próprio — implementa `onPhaseUpdate()` (prod meter, healers, apagão, body-sleep, hitboxes de golpe dos inimigos/Gerente, tutorial, entrada do boss, sombras) e o hook `sanityDrainEnabled()` (evento HOME OFFICE), enquanto `BasePhaseScene.update()` cuida de player.update, tickPassive gated, homing ink (por isso a Fase 1 popula `this.enemyGroups`), contato+HUD do boss, sanity fx, near-door e hud.update. O `create()` compartilha os blocos idênticos com Base via helpers (acima); o restante permanece próprio por divergência real de gameplay (escalonamento por loop, colliders, eventos).
- **Testes com `bun:test`**: o `import "phaser"` quebra no bun:test (precisa de globals de browser). Sistemas de **lógica pura** (`CulturaSystem`, `PerkSystem`) importam `Player`/`RunState` como `import type` — o tipo some do runtime, o Phaser não é carregado e o módulo fica testável. Funções puras que valem isolar (ex.: `sanityBand`) ficam em módulos sem Phaser (`sanity.ts`) e são re-exportadas de onde eram usadas. Não instanciar `Player` nos testes — passar um objeto fake tipado `as unknown as Player` (as funções só mutam campos simples).
- **CI contorna o registry privado**: `bun.lock` aponta tarballs para o cache do Lovable (`europe-westN-npm.pkg.dev`), inacessível fora do sandbox. O workflow (`.github/workflows/ci.yml`) reescreve esses URLs para o npm público (mesmo pacote/hash) via `sed` antes do `bun install`.
