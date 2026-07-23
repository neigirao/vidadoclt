# Análise: o que o Claude fez nas últimas subidas

4 PRs mesclados em ~22/jul (assinatura `Co-Authored-By: Claude Opus 4.8`) + 1 WIP automático do Lovable hoje. Todos com foco em **ferramentas / gates de qualidade** e **fundações de conteúdo** — nenhum toca sistemas de gameplay existentes.

## PR #108 — Gate de nível headless + fix de spawn injusto

**O que:** `scripts/validate-levels.mjs` boota cada fase (F1 + 2–5) em navegador headless em 6 seeds × rotas e reprova se o `LevelValidator` marcar a fase injogável. Ligado no job `smoke` do CI. `installLevelDebug` passa a guardar `scene.lastLevelReport` para o gate ler.

**Bug real caçado pelo próprio gate:** em `BasePhaseScene`, `spawnPhaseVerticalReward` relocava um inimigo ranged/healer para a plataforma mais alta — em layouts variante-2 (alturas alternadas), essa plataforma podia cair dentro do raio seguro do spawn do player, reprovando Phase2/atendimento seeds 2 e 5. Fix: filtro exige distância mínima do spawn.

Também formatou `close-loops.mjs` / `trim-filler.mjs` (drift de prettier).

**Valor:** fecha a lacuna "validador só rodava em DEV na tela". Bem executado.

## PR #109 — Gate de suavidade ratchet + reconciliação de docs

**O que:** promove `bun audit:anim` de informativo para **gate de não-regressão** no CI (job `check`). Compara `dead / jerk / loop-pop / padded` contra `scripts/anim-baseline.json` e reprova se qualquer tipo piorar. Baseline inicial trava o estado atual (jerk 93, loop-pop 62, padded 67, dead 4).

**Doc nova (`docs/ANIM_POLICY.md`):** formaliza a política "blend não suaviza pixel-art" — cita as duas tentativas de encher para 16 frames por blend que pioraram jerk/loop-pop (77→93, 50→62). Suavidade real só sai de arte autoral.

**Reconciliação:** ARCHITECTURE.md, ROADMAP.md, CLAUDE.md atualizados (V2 é a F1 canônica, atlas empacotado, MeleeCombat canônico, ContactShadows/RimLight/SecondaryMotion/Vfx na estrutura).

**Valor:** honesto sobre o beco sem saída do blend e usa o CI para travar. Deixa claro o próximo destravamento (arte autoral via Aseprite — que o #110 pavimenta).

## PR #110 — Fundações: Aseprite + LDtk jogável + pathfinding

Três verticais independentes:

**(a) Pipeline Aseprite** — `bun import:aseprite` importa export CLI do Aseprite/LibreSprite (sheet + json com tags) fatiando para a convenção do repo + repack. Round-trip fiel ao pixel (≤2/255 em bordas alpha). É o caminho de arte autoral que o ANIM_POLICY apontou.

**(b) LDtk POC → jogável** — `LdtkRoomScene` "Arquivo Morto" ganha inimigos reais, mini-combate, +30 VR, volta pra Copa. Registrada em pool de salas opcionais **atrás da flag `OPTIONAL_ROOMS_ENABLED` desligada** no alpha → não afeta produção.

**(c) Pathfinding (`systems/Pathing.ts`, rot-js A*)** — núcleo puro/testável, grade coarse com teto de pulo por coluna. Consumido pelo `hopOverFurniture` da F1: pula só quando há rota até o player; sem rota, meia-volta em vez de quicar à toa. 8 testes novos (131 no total).

**Valor:** três alavancas fortes. Aseprite é o único destravamento sério de suavidade. Pathfinding faz IA da F1 parar de parecer estúpida contra móveis. LDtk fica dormente e pronto.

## PR #111 — Salas LDtk autoradas em ASCII + Depósito

`scripts/gen-ldtk-rooms.mjs` compila salas **desenhadas em ASCII** (`#` sólido, `P/E/X/D/C/L` entidades, 1 char = 32px) para o schema LDtk — o diff do PR mostra o desenho da sala. Sala nova **Depósito**: escada de caixotes até prateleira alta guardada por inimigo + mureta pulável, 3 inimigos, +35 VR. `LdtkRoomScene` parametrizada por `init {room}`. Editor LDtk continua substituindo o `.json` sem código quando quiser.

**Valor:** baixa barreira para iterar salas. Continua atrás da flag desligada.

## Commit `cbebc24` (WIP do Lovable, hoje)

Só regerou `src/routeTree.gen.ts` (+10 linhas). Auto-gerado, sem impacto. Não é do Claude.

## Leitura geral

- **Direção acertada:** o Claude atacou ferramentas de qualidade e fundações, não gameplay. Cada PR fecha uma lacuna real (nível injogável passando batido, blend piorando animação sem CI notar, ausência de fonte editável de arte, IA travando em móveis).
- **Rigor honesto:** o ratchet de animação assume que o blend fracassou 2× e trava. ANIM_POLICY.md é o documento mais valioso do lote.
- **Riscos baixos:** LDtk/salas opcionais atrás de flag, pipeline Aseprite não altera arte existente, pathfinding só refina `hopOverFurniture`.
- **Único ponto de atenção:** 4 PRs em ~1h30 (20:20 → 21:55). Volume alto, mas cada um é vertical isolado e testável. Nada acoplado.

**Veredito:** boas subidas, focadas em fundação. Nada a reverter. O que resta cobrar é **uso**: rodar `bun import:aseprite` com arte de verdade (a própria ANIM_POLICY já disse que é o único caminho para subir suavidade acima do baseline atual) e ligar `OPTIONAL_ROOMS_ENABLED` quando quiser expor as salas LDtk.
