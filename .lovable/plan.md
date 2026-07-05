
# Onboarding guiado + HUD de sintomas de Burnout

Duas frentes complementares: **reduzir fricção da primeira run** e **tornar o Burnout legível** para o jogador conseguir jogar em torno dele em vez de sofrer sem entender.

## 1. Onboarding da primeira run

**Sinal de "primeira run"**: usar `loopCount === 0` no `PlayerState` (já persistido em `localStorage`), sem novo storage.

Mudanças:

- **MenuScene**: se `loopCount === 0`, mostrar só `JOGAR` em destaque. `RECONHECIMENTO`, `RANKING`, `BESTIÁRIO`, `HORA EXTRA` só aparecem a partir do 2º loop (após a 1ª morte ou vitória). `LAB SPRITES` fica em DEV.
- **ClassSelectScene**: com `loopCount === 0`, força Estagiário e pula direto (mostra tooltip "Novas classes destravam ao chegar na Copa"). Analista e Terceirizado passam a destravar por **marco** (`run.openSpaceCleared` na 1ª vez) — não mais só por Reconhecimento.
- **CulturaSelectScene**: com `loopCount === 0`, pula a tela e aplica uma cultura no-op "Padrão CLT" (sem modificador). A partir do 2º loop, escolhe normalmente.
- **OpenSpaceV2Scene**: se `loopCount === 0`, tutorial-prompts contextuais (3 dicas curtas com fade): "← → andar / Espaço pular" no spawn, "J atacar" ao ver o 1º inimigo, "Shift dash (i-frames)" no 1º Post-it voando. Cada dica aparece 1x, dismiss automático após 3s ou input. Sem modal, sem pausar.

Nada disso quebra runs subsequentes — todo o comportamento é gated em `loopCount === 0`.

## 2. HUD de sintomas de Burnout

Adiciona uma **linha de status** ao lado da barra de Sanidade no `Hud.ts`, mostrando ícones dos sintomas ativos com tooltip visual (label curto embaixo). Cores por severidade.

Sintomas exibidos (lidos de `Player.getBurnoutMods()` + estado do tremor):

| Ícone      | Condição                    | Label                    |
| ---------- | --------------------------- | ------------------------ |
| 🔻         | `speedMult < 1`             | "LENTIDÃO −15%"          |
| 🛡️✖       | `parryDisabled`             | "PARRY OFF"              |
| 💥         | `damageTakenMult > 1`       | "DANO +30%"              |
| 💸         | `vrDropMult < 1`            | "VR −20%"                |
| ⏳         | `specialCooldownMult > 1`   | "K COOLDOWN +30%"        |
| ⚡ piscando | `_nextTremorAt - t < 500ms` | "TREMOR EM Xs" (contagem) |
| ⚡          | `isTremoring()`             | "TREMOR!" (magenta pulse) |

Tudo desenhado com `Graphics` + `Text` no container do HUD (mesmo padrão das barras). Sem novos assets.

## 3. Telegrafo do tremor

Hoje o tremor **começa sem aviso**. Adiciona janela de aviso:

- `Player.tickBurnoutTremor()`: 500ms antes de `_nextTremorAt`, emite evento `scene.events.emit("burnout:tremor-warn", ms)`.
- `Hud` escuta e faz o ícone ⚡ piscar com contagem regressiva.
- Player ganha outline magenta pulsante nos mesmos 500ms (`setTint` + tween alpha).
- Só na banda `burnout` (a `anxious` não avisa — mantém o incômodo leve).

Contra-jogo real: o jogador pode parar de andar, atacar rápido, ou usar a janela para se posicionar.

## Detalhes técnicos

**Arquivos que mudam:**

- `src/game/systems/Hud.ts` — nova seção `renderBurnoutStatus()` chamada em `update()`. Recebe mods via param novo.
- `src/game/entities/Player.ts` — em `tickBurnoutTremor()`, disparar evento de warn 500ms antes; expor `getTremorWarnMs(t)`.
- `src/game/scenes/MenuScene.ts` — gating dos botões por `loopCount`.
- `src/game/scenes/ClassSelectScene.ts` — auto-skip em 1ª run; unlock por `openSpaceCleared` além de Reconhecimento.
- `src/game/scenes/CulturaSelectScene.ts` — auto-skip em 1ª run, aplica "Padrão CLT" (no-op — adicionar entrada em `CulturaSystem.ts`).
- `src/game/scenes/OpenSpaceV2Scene.ts` — tutorial prompts condicionais (3 dicas).
- `src/game/systems/CulturaSystem.ts` — adiciona `padrao_clt` como cultura no-op (não aparece na lista de escolha).

**Sem mudanças em:** MeleeCombat, LevelValidator, sprites/atlas, PlayerState schema, RunState schema, backend.

**Persistência**: só `openSpaceCleared` no `RunState` (já existe no tipo). Nenhum novo `localStorage`.

## Escopo fora deste plano

- Drops de sanidade em fase, novos consumíveis → próximo plano ("contra-jogo do Burnout" completo).
- BossCatalog, rotas ramificadas, rebalanço econômico → planos separados.
