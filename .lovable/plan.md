# Fase 1 & MVP — Análise e plano de fechamento

> **RECONCILIAÇÃO (status real do código, jul/2026).** Quase tudo deste plano
> foi entregue — mantido como histórico. O que sobrou de verdade:
> - 🔴 **Porta da Copa** ainda é `tint`+`[BLOQUEADO]` (item D / P1 #10) — só falta sprite.
> - 🟨 Fundos high-res das Fases 3/4/5 + cobertura (placeholders ~32–43KB) — arte externa.
>
> Já FEITO (era listado como pendente): background da Fase 1 (`bg-openspace.png` 1.07MB),
> plataforma real (`buildPlatform` desenha mesa completa, não `fillStyle`), spawn
> Fases 2–5 à esquerda, tutorial contextual, marcadores de ameaça, ensino de parry,
> beat de fim de fase, momento de enrage (+ agora com dentes na cadência), APAGÃO
> como stealth, extintor como JATO DE CO2, e o Burnout redesenhado (VAI NA RAÇA).
> O texto abaixo é o diagnóstico ORIGINAL — leia como registro, não como TODO.


Análise feita lendo `OpenSpaceV2Scene`, `Boss.ts` (Gerente), `Enemies.ts`, `Player.ts`, `Background.ts`, o inventário de sprites em `public/assets/sprites/` e o `ROADMAP.md`. Foco no que **falta** para chamar a Fase 1 de "vertical slice pronta" e o MVP de "jogável de ponta a ponta sem constrangimento".

---

## Diagnóstico — como Game Designer

**O que já está bom (não mexer):**

- Loop de combate tem base sólida: coyote, jump buffer, dash com i-frames, combo com janela de 250ms, hitbox generosa (`MELEE_ACTIVE_MS`, +24 range, altura 52), juice via `CombatFx`, healers marcados com "+" flutuante.
- Fase 1 tem **coisa que Fases 2–5 não têm**: 4 variantes de layout por seed, 6 eventos de sala com badge, medidor de Produtividade, APAGÃO com lanterna radial, segredo do extintor, café como drop de sanidade, memo colecionável, recompensa vertical, boss com 6 ataques + fase 2 aos 30% HP.
- Boss Gerente é **o único boss "de verdade"** hoje (repertório real, telegraph, phase 2, âncora `homeX`).

**Buracos reais da Fase 1 (ordenados por impacto):**

1. **Onboarding zero dentro da fase.** Nenhum prompt contextual. Parry (Reclamar), Dash, Especial e mesmo Interagir (E) não são ensinados. `parryTaught` existe como flag mas está morto. Player novo sai sem saber metade do sistema.
2. **Leitura de ameaça inconsistente.** Healer tem "+" mas Facilitador/Onboarding (ranged com windup) e Sênior (elite pesado) não têm marcador; o telegraph do Facilitador é bom mas o novato não sabe que aquilo é o padrão.
3. **Falta consequência forte no APAGÃO e no segredo do extintor.** Segredo dá 3 VR (irrisório vs. custo da Copa 6–32), APAGÃO só escurece — não altera comportamento de inimigo nem drop.
4. **Economia de VR da Fase 1 rasa.** Único sink dentro da fase é morrer; ganhos vão todos pra Copa. Faltaria pelo menos 1 pickup arriscado ou 1 escolha in-fase.
   &nbsp;

---

## Diagnóstico — como Artista 2D

**Estado atual dos assets:**

- Backgrounds das Fases 2–5 são PNGs curados em `public/assets/backgrounds/`. **A Fase 1 não tem `bg-openspace.png**`— usa`pxbg-openspace`gerado proceduralmente (parallax mid-layer + dithering em`create()`). Fica visivelmente mais pobre que Fases 2–5.
- Inimigos da Fase 1 (estagiário, analista, RH, facilitador, scrum, coordenador, sênior) têm idle/walk/attack/hurt no atlas. Consistência ok.
- Tiles de mobília (`tile-fase1-03`, `-04`) existem mas plataformas hoje são **desenhadas por `graphics.fillStyle(0x5c3318)**` — retângulos marrons chapados. Contrastam feio com o parallax detalhado.
- HUD (`Hud.ts`, 1166 linhas) tem boss bar, minimapa, ícones — está denso mas coerente.

**Buracos de arte:**

A. **Sem background dedicado da Fase 1.** É a única fase sem PNG próprio. Impacto visual grande (primeira impressão do jogo).
B. **Plataformas chapadas.** `graphics.fillStyle` marrom sem textura, borda, sombra ou highlight. Poderiam usar `tile-platform` do atlas (já existe, é usado em Base) OU um novo sprite temático (mesa de escritório com pés visíveis).
C. **Chão sem transição.** Carpete `tile-floor` ladrilha ok, mas encontro com parede/porta é abrupto (sem rodapé, sem plinth).
D. **Porta da Copa é um retângulo tintado** (`tint: 0x555555`) com label `[BLOQUEADO]`. Merecia sprite dedicado com estado bloqueado/desbloqueado + brilho ao desbloquear.  
F. **Drops pequenos (VR-coin, café) sem outline** — somem contra o mid-parallax em algumas alturas.
G. **Feedback de kill fraco visualmente.** `CombatFx` tem hit-stop/shake, mas falta um "impact frame" claro (branco full-screen ou vinheta radial) no finisher.

---

## O que falta para "Fase 1 perfeita" — plano priorizado

**P0 — MVP não fecha sem isto (1–2 dias de trabalho):**

1. **Background dedicado da Fase 1** (`bg-openspace.png`) no mesmo padrão de arte das Fases 2–5 (gerado via `imagegen` ou pintado manualmente). Cortar o parallax procedural para camada só de profundidade.
2. **Tutorial contextual (5 prompts, só na 1ª run):** Andar, Pular, Atacar, Dash, Especial. Sistema já desenhado no plano anterior — `TutorialPrompts` + hooks em `onPhaseUpdate`/`MeleeHost`/`handleSpecial`.
3. **Fix do spawn Fases 2–5** (bug já documentado no ROADMAP). Sem isso o MVP não sobrevive a um playtest — Fase 1 até funciona, mas o jogo "acaba" na Copa.
4. **Sprite de plataforma real** substituindo o `fillStyle` chapado — reusar `tile-platform` do atlas ou desenhar mesa de escritório com pé (via `gen-sprites.mjs`).
   &nbsp;

**P1 — polimento que separa "protótipo" de "MVP publicável" (2–3 dias):**

6. **Momento de fase 2 do boss** (30% HP): flash vermelho, grito ("PRAZO ESTOUROU"), +1 padrão de ataque exclusivo (ex: `deadline` já existe no enum mas sub-usado), tint na arena.
7. **Marcadores de leitura de ameaça** consistentes: ícone tiny sobre Facilitador/Onboarding ("!" amarelo = ranged), sobre Sênior ("♦" vermelho = elite). Padrão já feito para healer.
8. **Ensinar Parry (Reclamar)** — 1 prompt extra quando o Facilitador armar o 1º windup; matar o `parryTaught` morto.
9. **Fim de fase com beat**: kill do Gerente → slow-mo 400ms + zoom-pop + drop de "Ponto Eletrônico" (item narrativo consumível ou +10 VR bônus) + porta faz "clunk" audiovisual ao desbloquear.
10. **Porta da Copa como sprite** (`obj-porta-locked` / `-unlocked`, 2 estados) via `gen-sprites.mjs`.
11. **Outline em drops** (VR-coin, café): 1px preto ao redor do sprite (já dá pra fazer no atlas ou via `postFX.addGlow` mono).

**P2 — nice-to-have (fica para pós-MVP):**

12. Consequência real do APAGÃO: inimigos ficam mais lentos, café aparece garantido, lanterna vira "recurso" (esvazia).
13. Buff do segredo do extintor: em vez de 3 VR, dar +1 uso de especial ou refill de energia.
14. Fim de zona 3 dropar "escolha" de 2 perks temporários (arma emprestada por 30s, dobrar VR por 1 kill).
15. Rodapé/plinth entre chão e parede (`tile-floor-trim`).

---

## Escopo desta execução

**Recomendação:** aprovar **P0 (itens 1–5)** como próxima entrega. É o mínimo para chamar Fase 1 de vertical slice e destravar o MVP. P1 vira o sprint seguinte, P2 fica no ROADMAP.

Se preferir recortar mais fino, os menores blocos independentes são:

- **Bloco A (arte, ~½ dia):** itens 1 + 4 + 10 (background + plataforma + porta).
- **Bloco B (design, ~1 dia):** itens 2 + 5 (tutorial + presença do boss).
- **Bloco C (correção crítica, ~½ dia):** item 3 (spawn Fases 2–5).

Diz qual bloco (ou o P0 inteiro) eu implemento e eu começo pela arte se for tudo, porque um `imagegen` do background roda em paralelo enquanto o resto é código.

## Detalhes técnicos

- **Background novo:** `imagegen--generate_image` premium, 1920×512, salvar em `public/assets/bg-openspace.png`, carregar em `BootScene`, substituir `pxbg-openspace` em `OpenSpaceV2Scene.getBgKey()`. Manter o mid-parallax de cubículos como camada de profundidade sobreposta.
- **Plataforma:** trocar `add.graphics().fillStyle(0x5c3318)` por `add.tileSprite(x, y, w, h, "sprites", "tile-platform")` (já existe no atlas). Se o visual não convencer, adicionar `obj-mesa-escritorio` no `gen-sprites.mjs`.
- **Tutorial:** sistema já planejado. `src/game/systems/TutorialPrompts.ts` + hooks. Só rodar quando `run.loopCount === 0`..
- **Momento fase 2:** hook `onPhase2` já existe no `GerenteMicrogestor.ts` — hoje só liga a flag; conectar a `combatFx.shake` + tint + música + texto.
- **Spawn Fases 2–5:** ajustar `SPAWN_X` (ou equivalente) em `BasePhaseScene.buildPlayer` de x≈1800 para x≈100, e mover os pools de spawn de inimigos de borda para dentro do mapa.
