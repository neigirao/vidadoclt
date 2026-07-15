# ROADMAP — Corporate Escape (A Vida do CLT)

**Fonte única e verídica do estado do jogo.** Reconciliado com o código real
(o roadmap antigo por sprints tinha a tabela travada no Sprint 1, mas o jogo já
está por volta do fim do Sprint 6). Absorve o plano do Lovable
(`.lovable/plan.md`, que segue como plano de trabalho ativo de onboarding) e os
itens de engenharia do `CLAUDE.md`.

---

## Status por camada (GDD original)

| Camada / Sprint            | Status       | Observação                                                                                                                   |
| -------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| 1 — Núcleo jogável         | ✅ Concluído | Player, combo, HUD, VR, morte→Reconhecimento                                                                                 |
| 2 — Loop de run            | ✅ Concluído | Sanidade/faixas, Copa, Ponto Eletrônico, Reconhecimento, FGTS                                                                |
| 3 — Fase 1 completa        | ✅ Concluído | Áreas 2/4, Gerente Microgestor (6 ataques), Autonomia, boss bar                                                              |
| 4 — Rogue-lite             | 🟢 ~95%      | 3 classes, 12 armas, perks, 12 Culturas, sinergias perk×perk + arma×perk. Falta só rota **divergente de verdade** (conteúdo) |
| 5 — Fases 2–3              | 🟢 Boa       | Bosses temáticos com assinatura + enrage com dentes; falta conteúdo próprio (eventos/verticalidade como a Fase 1)            |
| 6 — Fases 4–5 + CEO        | ✅ Concluído | Fases 4/5, CEO, Vitória; Diretor com Cascata de Metas na phase 2                                                             |
| 7 — NPCs / eventos         | 🟢 Boa       | Faxineiro, Conspiracionista, LinkedIn, Veterano + eventos de RH na Copa                                                      |
| 8 — Áudio / acessibilidade | 🟡 Parcial   | Áudio procedural ✅ + toggle de fotossensibilidade ✅; falta remap/daltônico/texto escalável                                 |

### Extras entregues (fora do GDD original)

- Sistema de **Burnout "VAI NA RAÇA"** (glass-cannon opt-in: dano ×1.35, VR/kill ×1.5, +4 sanidade/kill como saída por agressão, contra dano recebido ×1.4 e parry apertado; ensinado 1× via `TutorialPrompts`). Deixou de ser relógio-de-derrota.
- **Qualidade**: `tsc` strict + ESLint 0 erros, **37 testes unitários** (bun:test), **CI** (GitHub Actions).
- **Encontros por seed** (Fase 1 varia tipos; Fases 2–5 variam posições).
- **Sinergias de build** em dois eixos: perk×perk (`SYNERGIES`, 8) e **arma×perk** (`WEAPON_SYNERGIES`, 4 — Cafeína Pura, Queda de Produtividade, Choque Térmico, Planilha Infinita), avaliadas no `buildPlayer`, badge compartilhado.
- **Arquitetura**: Fase 1 migrada p/ `BasePhaseScene`; God-scene decomposto (`ProductivityMeter`, `Apagao`).

---

## Backlog ativo (priorizado)

### 🔴 Bugs / correções

- _(vazio — o spawn das Fases 2–5 já nasce à esquerda: `spawnX = cameFrom==="copa" ? 120 : 80`.)_

### Onboarding + Burnout (plano do Lovable — ✅ concluído)

- ✅ 1ª run: `padrao_clt` (cultura no-op), auto-skip Class/Cultura, unlock por marco, dicas contextuais.
- ✅ **Contra-jogo do Burnout**: drops de sanidade + consumível; e o Burnout virou VAI NA RAÇA (cura por kill = saída por agressão).

### Conteúdo de jogo (GDD — lacunas reais)

- **Fundos de alta-res das Fases 3/4/5** — 🟡 _em andamento (arte externa)_: Fases 1 e 2 têm fundos ricos (~1.5 MB); Fases 3/4/5 usam PNGs baixa-res (32–40 KB, `bg-comercial`/`bg-tecnologia`/`bg-diretoria`). O dono está **gerando fundos novos** com o prompt de referência (estilo Fase 1/2). **Fase 3 (RH) já gerada** — falta o dono subir como `public/assets/bg-comercial.png` no repo (a chave já é carregada; troca sem código). Depois: Fase 4 → `bg-tecnologia.png`, Fase 5 → `bg-diretoria.png`. Ao receber, validar render + enquadramento no bot.

- **Ramificação de rotas**: 🟢 _fundação + 1ª rota divergente DE VERDADE_ — `RouteSelectScene` após a Fase 1 (2A Comercial / 2B Atendimento → `run.route`) e após a Fase 2 (3A Produto / 3B Tecnologia → `run.route2`), cada uma com modificador de run. **As DUAS bifurcações agora divergem de verdade** (fundo + título + layout + inimigos, todos validados no `LevelValidator`, verificados headless):
  - **Fase 2** por `run.route`: Comercial (CHÃO DE VENDAS, `bg-comercial`, aberto/vertical, ranged agressivo) vs Atendimento (REUNIÃO INFINITA, `bg-atendimento`, baias apertadas, atrito defensivo).
  - **Fase 3** por `run.route2`: Produto (CULTURA DE PRODUTO, `bg-comercial`, escada da carreira, +evangelistas) vs Tecnologia (CULTURA TECH, `bg-tecnologia`, torres de servidor, +coletores/planilhas).
  - O boss de cada fase é o mesmo nas duas rotas (diverge a jornada, não o chefe). Falta só conteúdo divergente nas Fases 4/5 (mesmo molde, opcional).
- **Bosses únicos das Fases 2–5** — 🟢 _mecânica pronta_: cada fase tem um chefão temático com repertório telegrafado — Coordenador de Sinergia (F2: balões orbitando + tiro em cruz), Brenda do RH (F3: zonas de sorriso obrigatório + feedback dirigido), Scrum Master Caótico (F4: firewall dividindo a arena + Daily/Retro), Diretor de Resultados (F5: meta que estoura + reestruturação + **CASCATA DE METAS** — golpe-assinatura só na phase 2: barragem bullet-hell em faixas telegrafadas com brechas seguras, que marca o boss FINAL vs. os hits únicos dos mid-bosses). CEO é a cena final. O **enrage aos 35% HP tem dentes** (`bossEnraged` + `onBossEnrage()`): Coordenador/Scrum apertam a cadência de especial, disparam um na virada **e intensificam a assinatura** (Coordenador: 4 balões/cruz dupla em vez de 2; Scrum: 3 grades de firewall em vez de 2); Brenda/Diretor/Gerente auto-escalam via phase2 interno (Diretor ganha a CASCATA DE METAS). A 2ª metade de toda luta ramp-a com mecânica nova, não só cadência.
  - **"cara de chefão" (arte)** — ✅ _feito_: os 5 bosses têm sprite DEDICADO, derivado da arte pintada à mão da casa via recolor (`recolorFrames`/`tintDark` em `gen-sprites.mjs`) — fidelidade máxima, mantém animação. **Brenda** (F3, do `enemy-rh` → magenta), **Coordenador** (F2, do `enemy-coordenador` → teal), **Scrum** (F4, do `enemy-scrum` → roxo), **Diretor** (F5, do `evangelista-boss` → aço). Coordenador/Scrum ganharam flag `asBoss` (troca só o prefixo de textura; o trash da Fase 1 segue na cor original). CEO e Gerente já tinham arte própria. As cores casam com as auras do `BossPresence`.
- **Porta da Copa (Fase 1)** — ✅ _feito_: sprite `obj-door` refeito via `gen-sprites.mjs` (`copaDoor()`, 36×60) — porta de escritório com vidro aramado + luz quente da Copa. Bloqueada = tint cinza; ao derrotar o boss, `playDoorUnlockGlow` (anéis quentes + faíscas + `Sfx.doorOpen`). Fim do último placeholder visual da Fase 1.
- **Identidade visual das fases** — ✅ _feito_: cada Fase 2–5 tem geometria de plataforma própria (baias/escada/torres/átrio), superfície temática (tecido/carpete/rack/mármore), prop de chão (headset/standee/cabos/troféu) e partículas ambientes (papel/confete/faíscas/ouro). Fica pendente só arte de plataforma por sprite dedicado (opcional).
- **Parallax multi-camada** — ✅ _feito (todas as fases)_: `addParallaxLayers` (Background.ts) adiciona planos de profundidade sobre o bg — FRENTE (viga+luminárias do teto sf 1.12, baias em silhueta nos cantos sf 1.2, centro livre p/ combate) e NEAR-BACK (baias distantes sf 0.6). Cores por tema de fase; respeita `reduceSanityFx` (desliga o plano rápido). Comunica que o escritório tem camadas; game feel de velocidade no dash/corrida.
- **Salas opcionais**: ✅ _feito_ — `SalaReuniaoScene` (horda) + `SalaBonusScene` (Banheiro/TI/RH/Financeiro). A porta lateral da Copa sorteia uma sala não-limpa por visita (roguelite), 1×/run cada via `run.optionalRoomsCleared`.
- **NPCs / narrativa**: ✅ _feito_ — Estagiário Conspiracionista (teorias por loop), Analista LinkedIn (jargão) e **Veterano** (favor por 20 VR → +1 vida) na Copa; + **eventos de RH/Cultura** aleatórios ao entrar na Copa (Amigo Secreto, Happy Hour, Peixe no Micro-ondas).
- **New Game+ "Quinta-feira"**: ✅ _feito_ — desbloqueado na 1ª vitória; `run.ngPlus` dá +40% HP aos inimigos. Botão na Vitória + entrada 🌩 no menu.

### Balanceamento (decisões)

- **Economia de VR**: ✅ _feito_ — cap do empilhamento evento×produtividade em 2.5× + preços da Copa mais altos (Café 6, Pausa 9). Economia **in-fase** da Fase 1 também: extintor virou JATO DE CO2 (AoE + VR escalado por inimigos pegos, decisão de iscar a horda); APAGÃO virou stealth (inimigos longe dormem — você dita o ritmo).
- **Ataques especiais próprios** para os bosses das Fases 2–4: ✅ _feito_ (Fase 4 já tinha; Fases 2 e 3 agora têm especiais telegrafados).

### Acessibilidade (Sprint 8)

- ✅ Opção "reduzir efeitos de Sanidade" (fotossensibilidade) — toggle no Pause.
- ✅ Gamepad completo: consumível em **L2** e troca de arma (Q) em **R2** — as duas ações que faltavam no controle.
- ✅ Legibilidade de HUD: 💰 no contador de VR e ícone de faixa na Sanidade (🙂/😰/😱/🔥).
- Pendente: desativar input-lag, remap de teclas, modo daltônico p/ telegraphs, texto escalável.

---

## LAB SPRITES — melhorias no fluxo de IA (a fazer juntos)

Vindos do uso real do REFAZER COM IA online:

- ✅ **Fundo transparente** — a saída da IA às vezes vinha sobre fundo opaco (bloco).
  `applyGuardrails` agora roda `stripBackground` (flood-fill das bordas, amostrando
  a cor dos cantos) antes da trava de paleta. Corrigido.
- ✅ **Gerar frames faltantes (multi-frame)** — implementado. O LAB detecta a lacuna
  do estado atual vs o padrão (`TARGET_FRAMES`: walk 4 / idle 4 / attack 2) e o botão
  **🎞 COMPLETAR FAMÍLIA `[C]`** gera por IA o próximo frame faltante, reusando o
  preview/guardrails/transparência do REFAZER. Ao aprovar, o frame novo entra como
  override de runtime e o jogo passa a ciclá-lo. Como funcionou:
  1. Contagem **dinâmica**: `EnemyAnimConfig` ganhou `frameCount(state,prefix)` =
     `max(base const, aumentos de runtime)`; `setEnemyTex` e o LAB leem via os
     acessores (`walkFrames`/`idleFrames`/`attackFrames`).
  2. `resolveSprite` agora serve override **inexistente no atlas** (frame virtual).
  3. `SpriteOverrides.registerFrameSlot` parseia `enemy-<prefixo>-<estado><n>` no
     boot/upload e registra o aumento de contagem.
  4. Testes: `EnemyAnimConfig.test.ts` cobrem base/default/max/reset/estados +
     `runtimeFrameAddition`/`hasAnimConfig`.
- ✅ **Multi-frame nos inimigos das Fases 2–5** — `animPhase` passou a ciclar
  `max(frames hardcoded, runtimeFrameAddition("walk", prefix))`, então os frames
  extras aprovados no LAB também animam nesses inimigos. O COMPLETAR FAMÍLIA é
  liberado por consumidor de animação (`hasAnimConfig` p/ setEnemyTex; categorias
  Fase 2–4 p/ animPhase), com o prefixo inferido das chaves quando o sujeito não
  tem `prefix` próprio.
- 🟨 **Geração em lote** — adiada (roadmap): hoje 1 frame por clique, com preview
  individual (o gate de qualidade).
- ✅ **Objetos e fundos ANIMAM (procedural)** — decisão: "fazer animar". Descoberta:
  objetos usam variantes de estado semânticas (não ciclos numerados) e fundos são
  imagens **full-res soltas** (não frames de atlas) — frame-a-frame por IA seria
  pesado/propenso a flicker. Implementado com **animação procedural** (sem gerar
  frames): `addPhaseDecor` dá um balanço/respiração idle sutil aos props; e
  `addPhaseBackground` dá um "respiro" de luz + micro-zoom muito lentos ao fundo.
  Ambos respeitam `reduceSanityFx` (acessibilidade). Verificado headless (tint do
  fundo variando, tweens ativos na Phase2). Aberto: se quiser frames de IA de
  verdade nos objetos (ciclo numerado `obj-<nome>-idleN` + gerador no LAB), é um
  subsistema à parte — dá pra fazer sob demanda.

---

## Auditoria — Sistema de Configurações (Lovable, guardar p/ ver juntos)

Análise das "configurações" (tela ⚙, painel de acessibilidade do Pause, `Settings.ts`
e as configs de run espalhadas). Plano priorizado por esforço×impacto.

**Quick wins (1 sessão):** remover texto morto (Resolução/Idioma/Controles fixos) e
pôr info útil (versão, seed copiável, loops) [P5]; tela cheia [F11] [P6]; portar as 3
barras de volume + Mudo para o PauseScene [P15]; toggle "mostrar dicas de novo"
(`TutorialPrompts.reset`) [P9]; botão Créditos (`CREDITS.md`) [P16]; mover "Exportar
dados de teste" para sub-seção Desenvolvedor [P13].

**UX médio (2–3 sessões):** sliders de volume clicáveis/arrastáveis, passo 5% [P1];
reestruturar o overlay em abas ÁUDIO·VÍDEO·CONTROLES·ACESSIBILIDADE·JOGO·DADOS·SOBRE
com scroll [P14]; aba CONTROLES mostrando a tabela do Pause (fonte única) [P2]; aba
DADOS com reset de progresso em 2 etapas (Reconhecimento/FGTS/Loops/NG+/Bestiário/
tutoriais/overrides) [P8].

**Estrutural (múltiplas sessões):** toggle "reduzir movimento/impacto" (screen-shake/
hitstop/zoom-pop de `CombatFx`, distinto do reduceSanityFx) [P10]; modo daltônico
(3 perfis, usado em `ThreatMarkers` + projéteis) [P11]; escala de HUD/texto 100/125/
150% [P12]; remap de teclas (nova camada `Input.ts` ação→tecla, refatorar os 8+
`addKey`) [P3]; gamepad na navegação de UI [P4]; cross-link de dificuldade na aba JOGO
("Heat atual / NG+ ativo — abrir tela") [P7]; aba SOBRE com seed copiável + "usar
seed…" [P7].

**`Settings.ts`:** estender schema (`fullscreen`, `reduceMotion`, `colorblindMode`,
`hudScale`, `showTutorials`, `keyBindings`, `gamepadEnabled`, `preferredSeed?`) e
criar `applyAll(settings)` (hoje só `applyAudioSettings`).

---

## Auditoria HOLÍSTICA de game design (Lovable, guardar p/ ver juntos)

Passada por todas as áreas. Sequência sugerida em 5 sprints.

**Sprint 1 — percepção (quick wins):**
1. Death recap na `GameOverScene` (causa, kills, VR, sanidade, +Reconhecimento, recorde).
2. Popup de VR flutuante ao matar.
3. Cooldown/carga do Especial (K) visível na HUD.
4. HUD mostra perks ativos com tooltip.
6. Beat de entrada de boss médio (câmera para, stinger, portal fecha).

**Sprint 2 — identidade:**
10. NPC que lembra do loop (Faxineiro comenta mortes/culturas/bosses por milestone).
11. Storytelling ambiental (`AmbientLore`: post-its com piada corporativa BR por seed).
5. Remover "TESTAR FASE" do menu (ou esconder atrás de dev-only).
8. Tela de vitória com epílogo (carta de demissão + gancho NG+).
7. Micro-legenda de perda de sanidade por evento ("−2 sanidade: viu email do chefe").

**Sprint 3 — onboarding:**
9. 1ª run fixa (classe default, sem cultura/loja); sistemas destravam após 1ª morte,
   cada tela nova ganha 1 tutorial.
14. Modo assistido opcional (dano recebido ×0.7, +1 vida/fase; sem estigma na UI).

**Sprint 4 — conteúdo (tirar Fases 2–5 da magreza):**
12. 1 evento de sala próprio por fase 2–5 (inventar por tema, não copiar APAGÃO).
13. 1 healer + 1 arquétipo verticalizador por fase 2–5 (força usar plataformas).
20. Fundos high-res Fases 3/4/5 + CEO (CEO é o mais crítico; pipeline do LAB pronto).

**Sprint 5 — estrutural (teto do jogo):**
16. Rotas divergentes de verdade (cada rota → variante da fase: encontros/layout/boss mod).
18. Sala de aposta/tesouro entre zonas (40 VR agora VS arma aleatória VS reroll perk).
19. Heat com modificadores _flavored_ (inimigos revivem 1×, boss ganha 2ª fase, sem Copa).
17. Meta-loja projeta impacto ("sua próxima run começa com X").
15. Especial/Dash ofensivos (dash cancela recovery; especial ganha variante aérea).

Problemas de fundo transversais (severidade GD): classes não se _sentem_ diferentes no
1º minuto (arma-assinatura + habilidade única, não só stats); especial/parry/dash
sub-utilizados; Fases 2–3 mais magras que a 1; nenhum inimigo pede verticalidade;
paralysis-by-analysis no 1º build; HUD não conta a história do build; nenhum NPC
lembra do loop (referência Hades); CEO chega sem buildup; sem modo fácil/assistido;
sem death recap. Cada item vira 1 plano executável quando escolhermos a direção.

---

## Como este roadmap se relaciona com os outros docs

- **`.lovable/plan.md`** — plano de trabalho ativo do Lovable (onboarding + burnout). Este ROADMAP absorve o status; o plano detalha a execução.
- **`CLAUDE.md` → "Pendente / em aberto"** — recorte de engenharia/level-design (mesmos itens, mais detalhe técnico).
- **`ARCHITECTURE.md`** — como o código está montado (não é roadmap).
