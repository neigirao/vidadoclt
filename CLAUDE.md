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
      MenuScene.ts           # Menu principal (JOGAR / TESTAR FASE* / RECONHECIMENTO / RANKING / BESTIÁRIO / HORA EXTRA / LAB). *TESTAR FASE = ferramenta TEMPORÁRIA de teste (pula direto pra qualquer fase criada; remover depois)
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
      PerkSystem.ts          # Perks pós-boss + sinergias perk×perk (SYNERGIES) e arma×perk (WEAPON_SYNERGIES)
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
      ThreatMarkers.ts       # Ícones de ameaça por arquétipo (!/♦/+) acima dos inimigos
      BossPresence.ts        # "Cara de chefão": escala + aura + sombra + coroa 👑
      TutorialPrompts.ts     # Dicas contextuais de 1ª sessão (VR, Sanidade, Copa, loop)
      Telemetry.ts           # Telemetria de playtest → Supabase dedicado (fire-and-forget)
      telemetryClient.ts     # Cliente Supabase da telemetria (projeto consultável)
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

### Pipeline de cobertura de frames (check / fill / dry)

Fluxo de qualidade para as contagens de frames por família. **3 formas de usar:**

1. **`bun run check:frames`** — GATE (roda no **CI**). Conta os frames contíguos de cada
   família no atlas e **reprova** se ficar abaixo de um piso por categoria (`FLOORS` em
   `scripts/frame-coverage-check.mjs`: player walk/run 16; inimigo/boss walk 8, idle 4,
   attack 4, hurt 2, death 3; itens isentos). **Também é coherence-aware**: parseia
   `EnemyAnimConfig.ts` e falha se o jogo ciclar MAIS frames do que o atlas tem (o caso
   perigoso: `%count` pede um índice inexistente → frame faltando em runtime). Relaxar
   um piso exige uma `EXCEPTION` **documentada** — nunca baixar o piso global.
2. **`bun run fill:frames`** — AUTO-FILL em lote. Pega as violações do gate e resolve as
   **interpoláveis** (walk/idle/run/attack) chamando `gen-inbetweens.mjs` (dobra o ciclo
   até o piso, determinístico, sem IA), reempacota 1× no fim. Use ao adicionar conteúdo
   novo com poucos frames em vez de rodar `gen-inbetweens` família a família.
3. **`bun run fill:frames --dry`** — só imprime o plano e **separa o interpolável do que
   precisa de ARTE** (hurt/death/loops curtos). É a "lista de compras de arte" — ver
   `docs/ART_GAPS.md` (o que só arte resolve) e `docs/FRAME_COVERAGE.md` / `SPRITE_AUDIT.md`.

**Limite conhecido:** o gate garante *quantidade* e coerência de *contagem*, mas é cego para
arte *mismatched* (frame de personagem diferente com a dimensão certa) — isso só o
`runFullAudit()` do LAB (canvas, no navegador) detecta.

### Gerador procedural de sprites (`scripts/gen-sprites.mjs`)

**Aprendizado-raiz:** vários assets vieram de extrações de IA mal recortadas (blocos chapados, respingos, frames trocados/vazios). A alternativa robusta é **desenhar sprites simples direto em código**, via um "canvas painter" de pixel-art (helpers `px`/`rect`/`hline`, composição alpha-over). É versionado (diff revisável no PR), reproduzível (packing determinístico → mesmo byte) e sem dependência externa.

- Uso: `node scripts/gen-sprites.mjs [filtro] && node scripts/pack-atlas.mjs`.
- Já gera: Post-it (projétil), drop de Café, copo estático da Copa e os tiles de cenário (`tile-floor` = carpete de escritório usado no rodapé de todas as fases; `tile-platform` = tampo de madeira). Tiles usam RNG determinístico (mulberry32) para textura reproduzível e ladrilham na horizontal. Adicionar novo asset = escrever uma função `canvas(w,h)…save("item-x.png")` e registrar em `SPRITES`.
- Regra de bolso: use o gerador quando o asset em uso estiver quebrado **e** for simples. Para arte complexa (ex: CEO), prefira copiar um frame bom vizinho.

### Upload de sprite no Lab (DEV) — troca de arte ao vivo

No **LAB SPRITES**, com `bun dev`, o botão **⬆ SUBIR PNG NESTE FRAME** manda um
PNG pro frame atualmente selecionado. Um plugin DEV do Vite (`vite.config.ts`,
`apply: "serve"`, endpoint `POST /__sprite-upload`) grava em
`public/assets/sprites/<frame>.png` e roda `pack-atlas.mjs`; o Lab recarrega o
atlas na hora. O nome do frame no atlas **é** o nome do PNG-fonte, então a troca
é direta e o arquivo já entra no repo pronto pra commitar. Só existe no dev (some
do build publicado); grava só dentro de `sprites/` (sem path traversal). É o loop
rápido pra substituir arte procedural por arte desenhada à mão sem editar arquivo.
**Regra de padrão:** o PNG novo precisa ter a **mesma dimensão** do frame que
substitui (senão quebra a família de animação / causa "encolhimento" no atlas) —
validado no cliente (feedback na hora) E no servidor (rejeita sem gravar).

**Fundos de fase** (categoria FUNDOS no Lab: `bg-atendimento`/`bg-comercial`/
`bg-tecnologia`/`bg-diretoria`/`bg-cobertura`) também aceitam upload pelo mesmo
botão. O upload de fundo persiste via `BgOverrides` (IndexedDB device-local +
Supabase Storage bucket `bg-overrides`) — **override em runtime**, funciona no
build publicado, mas **não** entra no repo/git.

**`💾 FIXAR FUNDO NO REPO (dev)`** (SpriteLabScene, dev-only): "promove" o override
de fundo (que vive no Storage/IndexedDB do navegador) para o REPO — pega o dataURL
(local direto; nuvem via `fetch`→dataURL no navegador do usuário, que tem acesso ao
Supabase) e manda pro endpoint `/__sprite-upload` com `kind:"background"`, que grava
`public/assets/<bg-*>.png` (imagem solta, **sem** re-empacotar e **sem** regra de
dimensão). Assim o fundo subido pelo LAB deixa de ser só override em runtime e passa
a ser **versionado** (entra no bundle/commit). É o caminho pra fixar as artes de
alta-res no repo. (O sandbox do agente não alcança o Supabase — 403 no proxy —, por
isso a promoção roda no navegador do usuário.)

### SpriteLabScene — validação visual (menu "LAB SPRITES")

Área de teste que mostra **todos os assets renderizados** (personagens, inimigos das Fases 1–4, bosses, objetos, drops, projéteis, **cenário: tiles + fundo**) com botões clicáveis: clique no sujeito (2 colunas à esquerda) e na ação (embaixo) → a animação roda em loop. Mostra bounding box, linha dos pés, strip de frames e um painel de diagnóstico; loga `[SpriteLab] nome/ação: Nf sizes=… missing=… → OK/PROBLEMA`. É a forma rápida de flagrar frame trocado/cortado/faltando. Preview auto-escala (assets grandes como o fundo 1920px encolhem para caber).

**Fonte única de animação**: o LAB lê `systems/EnemyAnimConfig.ts` (mesma config que `Enemies.ts` usa em `setEnemyTex`) → o painel mostra "JOGO cicla N@Mms" e flaga **direcional**: `LAB<jogo` = ⚠ arte que o jogo usa mas o LAB esconde (PROBLEMA); `LAB>jogo` = ℹ o jogo pula um extra/corrompido (ok). Antes o LAB tinha definição paralela e podia "mentir".

**Controles**: `[ESPAÇO]` pausa · `[← →]` passo a passo · `[ [ ] ]` velocidade (default = ms REAL do jogo) · `[R]` reset · `[O]` onion-skin (fantasma azul do idle0 no mesmo scale/baseline → pega pulo de tamanho entre estados) · `[A]` fila PROBLEMAS · upload em 2 passos (ENVIAR).

**Audit headless (p/ o agente)**: `window.__game.scene.getScene("SpriteLabScene").runFullAudit()` varre TODOS os sujeitos/estados/frames numa chamada e retorna JSON dos frames RUINS com motivo — além de missing/tamanho/LAB<jogo, mede **conteúdo via canvas**: quase-vazio (alpha%), chapado (% cor dominante = lixo de extração) e **altura do personagem fora da mediana da família** (pulo/encolhimento). Loga `[SpriteAudit] …`. É o caminho pra localizar e priorizar sprites ruins sem dirigir a UI frame a frame.

**Fila PROBLEMAS (tecla `[A]`, dev)**: overlay clicável que roda o `runFullAudit()` e lista os frames ruins na UI (o que o audit achava só saía no console). Cada linha pula direto pro sujeito/estado/frame (`jumpTo`); roda do mouse dá scroll. Um botão **🔧 CONSERTAR SEGUROS** conserta em lote os defeitos MECÂNICOS (missing/quase-vazio/chapado de frame do atlas → `copy-nearest`); `rescale`/altura fica de fora (pode ser pose legítima) e é resolvido 1 a 1 com o gate. Fecha o loop achar→consertar→verificar.

**Conserto de frame (botões no LAB, dev-only)**: três botões consertam o frame atual.

- **`🔧 RESCALE MEDIANA` / `🔧 COPIAR VIZINHO`** — consertos DETERMINÍSTICOS que preservam o design (reusam os pixels, não é redesenho de IA) — `scripts/frame-fix.mjs <frame> <mode>`, via endpoint `/__frame-fix` (grava e re-empacota o atlas na hora). `rescale` reescala o personagem p/ a mediana de altura da família (conserta pulo de tamanho); `copy-nearest` copia o vizinho bom (conserta vazio/quebrado).
- **`🤖 REFAZER COM IA (GEMINI)` — ONLINE (funciona no jogo publicado, sem `bun dev`)**. Redesenho por IA (`gemini-2.5-flash-image`) via uma **Supabase Edge Function** (`supabase/functions/frame-refazer`) que mantém a `GEMINI_API_KEY` **secreta no servidor** (chamada por `supabase.functions.invoke("frame-refazer", …)`). O cliente extrai o PNG do frame-alvo + vizinhos do atlas (canvas), manda pra função, e aplica os **guardrails de pixel-art no navegador** (`applyGuardrails`: resize exato, limpeza de halos, trava de paleta aos vizinhos, alinhamento dos pés à baseline mediana). Modal com **ANTES · DEPOIS · ANIMADO**, **escolher vizinhos-referência**, **HINT** e **🔄 GERAR DE NOVO**. `✅ APROVAR` **NÃO** reempacota o atlas nem commita: sobe o frame pro **Supabase Storage (bucket `sprite-overrides`)** + IndexedDB via `uploadSpriteOverride`, e o jogo aplica o override **por cima do atlas em runtime** (`systems/SpriteOverrides.ts` → `setSpriteOverrideResolver` no `resolveSprite`), carregado no `BootScene`. Resultado: **aprovou → entra em produção na hora** (ao vivo pra quem aprovou; pros demais, no próximo load — igual `BgOverrides`). **Deploy (feito 1× via Supabase/Lovable):** `supabase functions deploy frame-refazer`, `supabase secrets set GEMINI_API_KEY=…` (billing ligado), e a migration `20260714_create_sprite_overrides_bucket.sql` cria o bucket. (Os endpoints DEV antigos `/__frame-approve`//**frame-discard`/gemini de `/**frame-fix` viraram legado — o fluxo agora é online.)
  - **Guardrails de pixel-art** no output da IA (`frame-gemini.mjs`): **trava de paleta** (cada pixel opaco vai pra cor mais próxima da paleta dos vizinhos + limpa halos semi-transparentes), **alinhamento dos pés** à baseline mediana da família (o resize `contain` centraliza e faz "flutuar"), e **flag de altura** fora da mediana (avisa no toast/modal). Sem isso o resize nearest deixa drift de cor e desalinhamento.

**Robustez dos endpoints (dev)**: os 3 repacks (`/__sprite-upload`, `/__frame-fix`, `/__frame-approve`) compartilham um **mutex de re-empacotamento** (dois pack-atlas concorrentes truncavam o atlas). Approve é **atômico** (guarda o original, troca, re-empacota; se o pack falhar restaura e mantém a prévia) e o commit é **escopado** a 3 paths. A IA tem **timeout** (AbortController 90s + kill-timer 120s). O modal é **lifecycle-safe** (listener guardado por token, limpeza no shutdown, APROVAR travado até o DEPOIS carregar).

**Aplicar CONSCIENTEMENTE**: o audit só sinaliza candidatos — rescale cego corrompe frame de FX/pose (ex.: `gerente-hurt2` é uma explosão de impacto, não o personagem), e a IA pode destoar do estilo (por isso o gate ANTES/DEPOIS/ANIMADO + guardrails). Confira sempre antes de aprovar.

### Validador de fase (`systems/LevelValidator.ts`)

`validateLevel(spec)` roda contra uma cena **já montada** e verifica invariantes que garantem que a fase é jogável/justa num roguelite (layout varia por seed). Roda só em DEV no fim de `create()` da `OpenSpaceV2Scene` e loga `[LevelValidator] … PASS/FAIL`. Checa: chão contínuo, plataformas alcançáveis por **grafo de pulos encadeados** (`computeReachability` faz BFS do chão; aresta A→B usa a cinemática — apex `v²/2g` + alcance horizontal `walk·tAr + dash`), mesas puláveis (não bloqueiam o corredor), móveis sem sobreposição, spawn seguro (sem inimigo perto do player), inimigos nos limites, boss posicionado, saída presente, e distribuição de inimigos por zonas (ritmo de dificuldade). É agnóstico de fase — dá pra validar Fases 2–5 passando as refs no `LevelSpec`.

`drawLevelOverlay(scene, spec, report)` desenha o diagnóstico **em cima da fase** (tecla **V** em DEV): raio seguro de spawn, arco de pulo, teto de pulo, plataformas/mesas coloridas (verde=ok, vermelho=problema), zonas de dificuldade com contagem, boss/saída, pontos de inimigos, e um painel fixo com PASS/FAIL + checks.

**Ligado em todas as fases**: OpenSpaceV2 e `BasePhaseScene` (Fases 2–5) rodam o validador em DEV. `expectBoss: false` para fases sem boss por design (Fase 5 → CEO é a cena seguinte). As Fases 2–5 têm **3 variantes de layout por seed** (0 original, 1 espelhado, 2 alturas alternadas) aplicadas genericamente sobre `getPlatformLayout()` — todas validadas.

### Padrão de inimigo de fase (2–5)

- **Animação**: `animPhase(this, t, "<prefixo>", nFrames)` no fim do `preUpdate` — cicla `enemy-<prefixo>-walkN` em movimento, volta à base parado. Whitelist: só prefixos cujo walk tem o MESMO tamanho da base (evangelista fora: 64×64 vs 32×48).
- **Telegrafia**: atirador usa `fxGlow` + `showTelegraph` + `delayedCall(320)` antes do disparo (padrão leve; o windup travado do Facilitador/Onboarding é o padrão pesado da Fase 1).

### Eventos de sala (Fase 1) e segredo

`rollRoomEvent` tem 6 eventos + sala normal, com um **badge fixo** do evento ativo (nome + efeito) no canto durante toda a fase. Os **mecânicos** são APAGÃO (sistema `Apagao`: escuridão com lanterna no player — textura 2× da tela com furo radial, pois GeometryMask é Canvas-only no Phaser 4; **acende quando o boss ativa**. A escuridão corta dos dois lados: `applyApagaoDormancy` reaplica um freeze curto por frame nos inimigos além do raio de luz+penumbra — eles dormem e acordam ao entrar na luz → o APAGÃO vira stealth, não só handicap visual) e FISCALIZAÇÃO (Sênior extra). O medidor de Produtividade (streak de kills → mult de VR) é o sistema `ProductivityMeter`. Segredo: quebrar o extintor (x≈1793) solta um **JATO DE CO2** — AoE que fere/mata inimigos no raio e dá VR escalado por quantos foram pegos (base 5 + 4/inimigo, teto 25), 1× por run (`checkExtintorSecret`). Deixou de ser token de +3 VR; vira decisão de iscar a horda.

### Band-aids de sprite ativos

Nenhum band-aid ativo no momento.

- ✅ **Post-it / Café (drop) / copo da Copa**: refeitos via `gen-sprites.mjs` (eram bloco amarelo / respingos).
- ✅ **Porta da Copa** (`obj-door`, 36×60): refeita via `gen-sprites.mjs` (`copaDoor()`) — era retângulo tintado + `[BLOQUEADO]`. Agora porta de escritório com vidro aramado + luz quente. Estado: tint cinza (bloqueada) → clearTint + `playDoorUnlockGlow` (anéis quentes + faíscas + `Sfx.doorOpen`) ao derrotar o boss.
- ✅ **CEO em corrida** (`boss-ceo-run1/2`): frames-lixo substituídos por vizinhos válidos.
- ✅ Inimigos das Fases 2–4 auditados: bases limpas. Inconsistências de tamanho remanescentes são frames idle/walk **não usados** (esses inimigos renderizam base estática).
- ✅ **Ataque animado (Fase 1)**: `setEnemyTex` cicla o estado `attack` via `ATTACK_FRAME_COUNTS` (whitelist de frames validados por inimigo — senior 3, rh/facilitador/analista 2). Frames-lixo 32×48 (facilitador/analista/scrum-attack2) ficam de fora; prefixo ausente → frame 0 estático (sem regressão). `walk`/`idle` já eram consistentes; `hurt` segue single-frame.

## Estado atual

### Implementado

- Player completo: andar, pular (coyote + buffer), dash (i-frames), combo, ataque especial (K), interação (E)
- 3 classes (Estagiário, Analista, Terceirizado) com stats próprios
- 12 armas (WeaponSystem) + perks aleatórios pós-boss (PerkSystem); **sinergias** em dois eixos: perk×perk (`SYNERGIES`, 8) e **arma×perk** (`WEAPON_SYNERGIES`, 4 — a arma equipada casa com um perk; reusam campos já consumidos, avaliadas no `buildPlayer`, badge compartilhado)
- **12 Culturas Corporativas** (CulturaSystem) — modificadores de run selecionados antes da Fase 1 e re-oferecidos pós-boss. **7 são TRADEOFFS** (presa + custo → decisão de COMO jogar, não só qual stat inflar; ex.: Overtime = +30% dano causado / +20% dano recebido; PDI = +35% cadência / −20% dano/golpe; Meta Batida = +60% VR / −20% Energia máx) e 5 são picks "seguros" (buffs planos: +sanidade/+energia/vida extra/resist. a freeze). A tela de seleção mostra o custo e tem **[R] Recusar** (manter o build limpo = custo de oportunidade real). Distingue-se do meta-shop, que é buff permanente puro.
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
- **Qualidade**: `tsc` strict + ESLint 0 erros; **testes unitários** (bun:test) de EnemyCatalog, WeaponSystem, ReconhecimentoSystem, **CulturaSystem, PerkSystem (incl. sinergias arma×perk), sanityBand** (49 testes); **CI** (GitHub Actions: tsc + lint + test) em `.github/workflows/ci.yml`
- **Legibilidade/onboarding**: marcadores de ameaça por arquétipo (`ThreatMarkers`), presença de chefão (`BossPresence`: escala+aura+coroa), momento de enrage do boss aos 35% HP (`playBossEnrageMoment` — beat visual; e o flag `bossEnraged` + hook `onBossEnrage()` que **apertam a cadência de especial** na 2ª metade da luta: Coordenador/Scrum aceleram e disparam um especial na virada; Brenda/Diretor/Gerente já auto-escalam via phase2 interno), beat de fim de fase (`playPhaseClearBeat`), e **dicas contextuais de 1ª sessão** (`TutorialPrompts`)
- **Armas no meio da fase**: drop de arma por kill/boss (`dropWeapon`) + slot secundário com troca (Q); telemetria de playtest gravada no Supabase dedicado (`Telemetry` + `telemetryClient`)
- **Passe de polimento visual/juice/UX** (sessão de auditoria): (a) **pós-FX cinematográfico** por câmera (`systems/PostFx.ts` — grade ColorMatrix + vignette, via Phaser 4 Filters) ligado em todas as fases; (b) **paleta-assinatura por bioma** (`applyBiomePalette` — tint por canal quente/frio com `ColorMatrix.multiply`: TI/Servidores frio azul, Diretoria âmbar, CEO vermelho tenso — leitura de progresso); (c) **fundos pintados em WebP** (−94% boot — ver Decisões); (d) **tipografia self-hosted** (`systems/Fonts.ts`: Press Start 2P títulos / VT323 corpo; woff2 OFL em `public/assets/fonts/` + `@font-face` em `styles.css` — **sem CDN**, que o ambiente bloqueia); (e) **telegrafia por cor padronizada** (`TELEGRAPH` em `Enemies.ts`: 🔴 danger = investida/AoE → parry/reposicione, 🟡 ranged = projétil → saia da linha; ensinada 1× por `TutorialPrompts`); (f) **micro-legenda de sanidade** (`Player.drainSanity(amount, reason)` — "−N Sanidade · post-it na cara"); (g) **dash ofensivo** (perk `dashDamage` agora consumido: atravessar inimigo no dash fere, dedup por `dashId`); (h) **verticalidade nas Fases 2–5** (`spawnPhaseVerticalReward` — cache no topo + healer/ranged relocado); (i) **parallax denso** (Lovable). Além de fixes: crash de render por override de sprite inválido (`SpriteOverrides` valida o source), lote da IA que não refletia no LAB (`extendSubjectForNewFrame` achava o sujeito pelo prefixo, não pelo selecionado), erro legível do Gemini (429/teto de gasto).

### Pendente / em aberto

Design e combate estão fechados (ver "Aprendizados de design" abaixo). O que **resta** é
majoritariamente conteúdo/arte, não código de sistema:

- 🟨 **Fundos high-res das Fases 3/4/5 + CEO (cobertura)** — arte externa. Os 4 (`bg-comercial`/`bg-tecnologia`/`bg-diretoria`/`bg-cobertura`, ~32–42KB) são skylines chapados competentes, mas destoam dos 2 pintados ricos (`bg-openspace`/`bg-atendimento`, agora WebP). Bloqueado em geração de imagem; o botão de upload do LAB (FUNDOS) é o pipeline. **O clímax (CEO) tem o pior fundo — prioridade.** (Mitigado parcialmente: paleta por bioma dá cor-assinatura a cada andar mesmo com o skyline chapado.)
- 🟨 **Sprites abaixo do piso de 4 frames/ação** (task): boss-ceo, brenda, diretor, evangelista-boss/mega, gerente, facilitador, impressora-b/c/d em idle/walk. Bloqueado no **teto de gasto do Gemini** (429) — quando liberado, o LAB (FRAMES FALTANTES) gera; após o fix, o lote reflete corretamente (recarregar após gerar).
- ⬜ **Luz dinâmica (Lights2D)** — o jogo é unlit (só vignette/parallax/apagão). Phaser 4 tem LightsManager + `addLight`, MAS o pipeline de render mudou (via Filters `addImageLight`/`addNormalTools`, não o `setPipeline('Light2D')` do Phaser 3). **Exige um spike antes de virar sprint** — não é drop-in. **`addBloom`/`sprite.postFX` NÃO existem nesta build** (sondado headless); usar `addGlow`/`addColorMatrix`/`addVignette` (que existem) ou shader custom.
- ✅ **Rotas divergentes de verdade — FEITO** (era stale nesta doc). As DUAS bifurcações já divergem em conteúdo, não só stat: Fase 2 (`run.route` comercial/atendimento) e Fase 3 (`run.route2` produto/tecnologia) variam **fundo, título, objetivo, layout de plataformas E composição de inimigos** (ver `Phase2Scene.isComercial()`/`Phase3Scene.isTecnologia()`). O **boss é compartilhado** por rota **de propósito** ("a rota diverge na jornada, não no chefe"). O que resta é opcional/scope-creep: bifurcar também Fases 4/5, ou boss distinto por rota.
- ✅ **Fases 2–3 com personalidade própria — FEITO** (era stale): têm eventos de sala (`getPhaseEvents`) e verticalidade com propósito (`spawnPhaseVerticalReward` — cache no topo + healer/ranged relocado). Continuam com menos verticalidade que a Fase 1 (que tem 4 layouts + apagão + medidor), mas não são "lineares".
- ⬜ **Acessibilidade (deferida)** — remap de teclas, modo daltônico p/ telegraphs, texto escalável. (Toggle de fotossensibilidade já existe.)
- ✅ **Resolvidos nesta sessão**: Burnout→VAI NA RAÇA, curva de bosses (enrage com dentes + assinaturas de mid-boss + Cascata do Diretor), economia in-fase (extintor/APAGÃO), onboarding dos verbos (dash/especial), sinergias arma×perk, porta da Copa, FX de Burnout alinhado.
- **BossCatalog dos 7 bosses** — OBSOLETO: a arte-fonte em `_sources/` foi removida; só entra com arte nova.

### Aprendizados de design (princípios que guiaram as últimas iterações)

Regras de bolso extraídas do trabalho recente — aplicar antes de "só ajustar um número":

1. **Sistema deve gerar DECISÃO, não só ajustar número.** Burnout era um relógio-de-derrota (só penalidade) → virou VAI NA RAÇA (glass-cannon opt-in com saída por agressão). Extintor era +3 VR (token) → virou JATO DE CO2 (isca a horda, AoE, VR escalado). APAGÃO só escurecia → virou stealth (inimigos longe dormem). Se o jogador não **escolhe** nada, o sistema é raso.
2. **O visual tem que casar com a intenção mecânica.** O Burnout foi redesenhado pra empoderar, mas o FX continuava "agonia/cego" (túnel cinza) — contradizia a mecânica. Alinhado: vermelho-adrenalina, vinhete aberto (`SanityFx`). Sempre revisar se a arte diz o que o sistema faz.
3. **Enrage/escalada deve adicionar MECÂNICA, não HP/velocidade.** Bosses "ficam mais gordos, não mais interessantes" é o anti-padrão. O enrage aos 35% agora intensifica a assinatura de cada boss (`bossEnraged` + `onBossEnrage()`): Coordenador 2→4 balões, Scrum 2→3 firewalls, Diretor ganha a Cascata. A 2ª metade da luta ramp-a com algo novo. E a **ameaça** (loop+Heat+NG+, `systems/Menace.ts` → `menaceEnrageThreshold`) ANTECIPA o enrage (35% → até 60% de HP) em vez de só inflar HP: em dificuldade alta as assinaturas rodam por MAIS TEMPO da luta, não só contra um boss mais gordo. Puro/testável.
4. **Ensinar VERBO por CONTEXTO, não por tela de ajuda.** Dash/Especial/Parry são legendados no momento de uso (ameaça perto → dash; grupo → especial; contato parryável → parry), não num tutorial isolado. Red-flag "ninguém usa dash/especial" atacado assim.
5. **Docs de auditoria envelhecem — reconcilie contra o CÓDIGO, não contra a doc.** Metade dos "pendentes" já estava feita; a auditoria virou mentira parcial e parou de servir pra priorizar. Antes de agir num item "aberto", confirme no código.
6. **Verificar mudança de gameplay dirigindo o jogo headless.** Padrão: subir `vite dev`, abrir via Playwright, acessar `window.__game.scene.getScene(...)` e chamar métodos da cena (privados de TS são chamáveis em runtime), medir desfechos numéricos + screenshots. Foi assim que o desalinhamento visual do Burnout apareceu e que as intensificações de enrage foram confirmadas (F2 2→4 balões, F4 2→3 firewalls). Cuidado com guardas de early-return ao chamar direto (ex.: `sprintReview` exige player perto do boss e `nextSprintAt` não-zero).

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

### Onboarding de 1ª sessão (TutorialPrompts.ts)

`TutorialPrompts.maybeShow(scene, id, text)` enfileira um banner de 1 linha (💡, topo-centro, `setScrollFactor(0)` depth 1200) que **some sozinho** em 4,5s ou ao 1º `keydown`. Cada `id` aparece **1× para sempre** (flag em `localStorage` `vidaclt:tut`); a fila é por-cena (2 dicas juntas → a 2ª espera). Zero impacto em gameplay — só legenda o SISTEMA no momento em que ele aparece. `reset()` limpa as flags (retestar), `seen(id)` checa antes.

Gatilhos ligados (9): `goal` (objetivo da Fase 1), `vr` (1º VR pego — moeda), `dash` (ameaça a <240px → esquiva), `special` (grupo de ≥2 inimigos → AoE), `sanity` (1ª piora de faixa, em `SanityFx`), `burnout` (entrada no Burnout/VAI NA RAÇA, em `SanityFx`), `threat` (1º marcador de ameaça, em `ThreatMarkers`), `copa` (entrada na Copa), `death` (1ª Rescisão — explica o loop, em `GameOverScene`). Parry é ensinado à parte, por demonstração na zona 1 (`parryTaught`).

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

| GDD              | Código                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Energia          | `player.energy`                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Sanidade         | `player.sanity`                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Vale Refeição    | `player.vr`                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Reconhecimento   | `run.reconhecimento` (persistido)                                                                                                                                                                                                                                                                                                                                                                                                |
| Rescisão         | tela de Game Over                                                                                                                                                                                                                                                                                                                                                                                                                |
| Ponto Eletrônico | checkpoint (Copa)                                                                                                                                                                                                                                                                                                                                                                                                                |
| Autonomia        | `run.autonomia` (perk pós-boss)                                                                                                                                                                                                                                                                                                                                                                                                  |
| Burnout          | faixa "burnout" (`sanityBand`, sanidade ≤24) = **VAI NA RAÇA**: glass-cannon opt-in em `Player.getBurnoutMods()`. Presas (dano causado ×1.35, VR/kill ×1.5, +4 sanidade/kill = saída por agressão) contra fragilidade (dano recebido ×1.4, parry apertado −60ms **mas ativo**, velocidade ×0.9). Ensinado 1× (`TutorialPrompts` id `burnout` em `SanityFx`). Tremor (`isTremoring`) invertendo L/R segue como hazard telegrafado |

## Comandos

```bash
bun dev                      # servidor de desenvolvimento
bun run build                # build de produção (vite build)
bun lint                     # ESLint
bun test src/game            # testes unitários (bun:test) — mesma checagem do CI
bun smoke                    # smoke de cenas: boota CADA cena headless; falha se houver erro de console (rode ANTES de subir mudança visual/de cena)
bun visual                   # regressão visual: compara cenas de UI estáveis vs baselines (tests/visual/baseline)
bun visual:update            # (re)grava os baselines — rodar quando a mudança visual é INTENCIONAL (conferir o diff no PR)
bun format                   # Prettier
node scripts/gen-sprites.mjs # (re)gera sprites procedurais (post-it, café, copo)
node scripts/pack-atlas.mjs  # re-empacota o atlas a partir de public/assets/sprites/
```

## Decisões de arquitetura

- **Phaser isolado do React**: `GameMount.tsx` é o único ponto de contato. O jogo não usa hooks, estado React ou context — tudo via Phaser + registry (`run`).
- **Estado da run no registry**: `getRun(scene)` lê/cria `RunState` no `scene.registry`; persiste Reconhecimento/FGTS/Loops em `localStorage`.
- **Atlas empacotado**: sprites reais vêm de `atlas.png`. Editar PNG individual exige `pack-atlas.mjs`.
- **Ferramentas DEV no menu (DECISÃO DELIBERADA — não é bug)**: `LAB SPRITES` e `TESTAR FASE` aparecem no `MenuScene` (flag `firstRun: true`) **de propósito** durante o desenvolvimento — são o loop rápido de validar arte/pular pra qualquer fase. **Serão removidas na publicação** (decisão do dono do projeto). **NÃO listar isso como problema em auditorias** — é intencional e já tem plano de remoção. Quando for publicar: filtrar esses itens do menu e (idealmente) excluir `SpriteLabScene` do bundle via `import.meta.env.DEV`.
- **Tipografia SELF-HOSTED (sem CDN)**: identidade em `systems/Fonts.ts` (`display` = Press Start 2P títulos, `body` = VT323 corpo, `mono` = system p/ números de HUD). As woff2 (OFL, obtidas via fontsource) vivem em `public/assets/fonts/` e são declaradas por `@font-face` em `src/styles.css`. **NÃO usar Google Fonts CDN**: o ambiente/CSP bloqueia `fonts.googleapis.com` → o CDN caía sempre no fallback monospace (a tipografia ficava invisível). `pixelArt: true` põe `image-rendering: pixelated` no canvas → o texto TTF é upscalado nearest-neighbor junto com os sprites e fica **crisp** (sondado a 1600×900); por isso BitmapText é desnecessário aqui.
- **Fundos pintados em WebP**: os 3 fundos pintados grandes (`bg-menu`, `bg-openspace`, `bg-atendimento`) são `.webp` q82 — PNG era péssimo p/ arte pintada (gradientes), o WebP corta **~94%** (3,5MB → 0,2MB no boot) sem perda visível. `bgUrl()` (BgOverrides) é **extension-aware** via `WEBP_BGS`: retorna `.webp` p/ esses 3, `.png` p/ os skylines chapados das Fases 2–5 (que ainda são pequenos, 32–44KB; quando ganharem arte pintada de alta-res, converter p/ WebP e adicionar ao `WEBP_BGS`). **Caveat DEV**: o endpoint `FIXAR FUNDO NO REPO` grava `.png` — promover um dos 3 WebP por lá geraria um `.png` órfão (não carregado). Não afeta o jogo (esses 3 já têm arte boa); só re-promover exigiria gravar `.webp`.
- **furnitureBodies separado de platforms** (V2): móveis bloqueiam player **e** inimigos de chão; inimigos dão um pulinho ao travar (respeitam a mesa sem clipar/prender).
- **Arcade physics**: suficiente. Não mudar para Matter.js sem necessidade concreta.
- **pixelArt: true** no config Phaser: desativa antialiasing. Não remover.
- **Hitboxes manuais no resolveAttack**: o ataque usa `Phaser.Geom.Intersects.RectangleToRectangle` com hitbox calculada pelo Player, não `physics.add.overlap`. Mantém controle preciso do timing do combo.
- **Combate melee ÚNICO em `systems/MeleeCombat.ts`**: `resolveMeleeAttack(host, hb, step, swingId, firstFrame)` é a implementação canônica (dedup por swingId da janela ativa, juice 1×/golpe, sparks, slow, healOnKill). OpenSpaceV2, BasePhaseScene (Fases 2–5) e CeoScene delegam via um `MeleeHost` (hooks: `killVrMult` p/ produtividade×evento, `onSwingStart` p/ segredo do extintor, `onBossDied`). **Não** reimplementar resolveAttack em cena nova — montar um host. (CopaScene mantém uma mini-versão própria de sandbox, com gate de 1º frame.)
- **OpenSpaceV2Scene estende `BasePhaseScene`**: a Fase 1 herda os helpers compartilhados (`buildPlayer`, `persist`, `spawnProjectile`, `spawnEnemyProjectile`, `resolveAttack`, `handleSpecial`) e implementa os métodos abstratos (`getBgKey`/`getPhaseTitle`/`getDoorConfig`/etc.). Ainda mantém `create()` próprio (não chama `super.create()`) por conta das mecânicas exclusivas (4 variantes de layout, eventos de sala, apagão, medidor de produtividade, healers, café, memo) — mas reusa os **blocos idênticos** de Base via helpers (`setupWorldAndCamera`, `wireParryReclamar`, `setupPauseKey`, `installLevelDebug`). O `super.create()` monolítico **não** é usado de propósito: a Base tem escalonamento de HP por loop (+15%) que colidiria com o da Fase 1 (+20% com inimigos "TRAVADOS"), além de colliders de móveis/postits/café que a Base não conhece — usá-lo dobraria o balanceamento. Overrides da Fase 1: `buildFloor`/`buildPlatform` (mesas desenhadas vs. tiles de PLAT_DEFS), `dropVR` (tint dourado + hover), `getMeleeHost` (hooks `killVrMult`/`onSwingStart`). O boss é um `GerenteMicrogestor` guardado em `this.gerente` (ref tipada) além do `this.boss` herdado (supertipo `BossEntity`); a derrota é `handleGerenteDefeat` (renomeado p/ não colidir com `handleBossDefeat` da base). O **`update()` já foi unificado**: a Fase 1 não tem mais `update()` próprio — implementa `onPhaseUpdate()` (prod meter, healers, apagão, body-sleep, hitboxes de golpe dos inimigos/Gerente, tutorial, entrada do boss, sombras) e o hook `sanityDrainEnabled()` (evento HOME OFFICE), enquanto `BasePhaseScene.update()` cuida de player.update, tickPassive gated, homing ink (por isso a Fase 1 popula `this.enemyGroups`), contato+HUD do boss, sanity fx, near-door e hud.update. O `create()` compartilha os blocos idênticos com Base via helpers (acima); o restante permanece próprio por divergência real de gameplay (escalonamento por loop, colliders, eventos).
- **Testes com `bun:test`**: o `import "phaser"` quebra no bun:test (precisa de globals de browser). Sistemas de **lógica pura** (`CulturaSystem`, `PerkSystem`) importam `Player`/`RunState` como `import type` — o tipo some do runtime, o Phaser não é carregado e o módulo fica testável. Funções puras que valem isolar (ex.: `sanityBand`) ficam em módulos sem Phaser (`sanity.ts`) e são re-exportadas de onde eram usadas. Não instanciar `Player` nos testes — passar um objeto fake tipado `as unknown as Player` (as funções só mutam campos simples).
- **CI contorna o registry privado**: `bun.lock` aponta tarballs para o cache do Lovable (`europe-westN-npm.pkg.dev`), inacessível fora do sandbox. O workflow (`.github/workflows/ci.yml`) reescreve esses URLs para o npm público (mesmo pacote/hash) via `sed` antes do `bun install`.
