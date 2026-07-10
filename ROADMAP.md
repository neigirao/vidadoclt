# ROADMAP — Corporate Escape (A Vida do CLT)

**Fonte única e verídica do estado do jogo.** Reconciliado com o código real
(o roadmap antigo por sprints tinha a tabela travada no Sprint 1, mas o jogo já
está por volta do fim do Sprint 6). Absorve o plano do Lovable
(`.lovable/plan.md`, que segue como plano de trabalho ativo de onboarding) e os
itens de engenharia do `CLAUDE.md`.

---

## Status por camada (GDD original)

| Camada / Sprint            | Status       | Observação                                                              |
| -------------------------- | ------------ | ----------------------------------------------------------------------- |
| 1 — Núcleo jogável         | ✅ Concluído | Player, combo, HUD, VR, morte→Reconhecimento                            |
| 2 — Loop de run            | ✅ Concluído | Sanidade/faixas, Copa, Ponto Eletrônico, Reconhecimento, FGTS           |
| 3 — Fase 1 completa        | ✅ Concluído | Áreas 2/4, Gerente Microgestor (6 ataques), Autonomia, boss bar         |
| 4 — Rogue-lite             | 🟢 ~90%      | 3 classes, 12 armas, perks, 12 Culturas. **Falta ramificação de rotas** |
| 5 — Fases 2–3              | 🟡 Parcial   | Fases existem mas **lineares**; bosses são enemy-classes, não os únicos |
| 6 — Fases 4–5 + CEO        | ✅ Concluído | Fases 4/5, CEO, tela de vitória                                         |
| 7 — NPCs / eventos         | 🟡 Parcial   | Faxineiro + eventos de sala; falta o resto dos NPCs e eventos           |
| 8 — Áudio / acessibilidade | 🟡 Parcial   | Áudio procedural ✅; **acessibilidade quase toda pendente**             |

### Extras entregues (fora do GDD original)

- Sistema de **Burnout** (penalidades por faixa + telegrafo do tremor + HUD de sintomas) — Lovable.
- **Qualidade**: `tsc` strict + ESLint 0 erros, **37 testes unitários** (bun:test), **CI** (GitHub Actions).
- **Encontros por seed** (Fase 1 varia tipos; Fases 2–5 variam posições).
- **Arquitetura**: Fase 1 migrada p/ `BasePhaseScene`; God-scene decomposto (`ProductivityMeter`, `Apagao`).

---

## Backlog ativo (priorizado)

### 🔴 Bugs / correções

- **Spawn das Fases 2–5**: nascem em x≈1800 (em cima do boss/saída, trash atrás). Fix: spawn à esquerda + reajuste dos pools de borda.

### Onboarding + Burnout (plano do Lovable — em andamento)

- Terminar 1ª run: `padrao_clt` (cultura no-op), auto-skip Class/Cultura, unlock de classe por marco (`openSpaceCleared`), 3 dicas contextuais.
- **Contra-jogo do Burnout**: drops de sanidade em fase + consumível de sanidade.

### Conteúdo de jogo (GDD — lacunas reais)

- **Fundos de alta-res das Fases 3/4/5** — 🟡 _em andamento (arte externa)_: Fases 1 e 2 têm fundos ricos (~1.5 MB); Fases 3/4/5 usam PNGs baixa-res (32–40 KB, `bg-comercial`/`bg-tecnologia`/`bg-diretoria`). O dono está **gerando fundos novos** com o prompt de referência (estilo Fase 1/2). **Fase 3 (RH) já gerada** — falta o dono subir como `public/assets/bg-comercial.png` no repo (a chave já é carregada; troca sem código). Depois: Fase 4 → `bg-tecnologia.png`, Fase 5 → `bg-diretoria.png`. Ao receber, validar render + enquadramento no bot.

- **Ramificação de rotas**: 🟢 _feita (fundação das duas bifurcações)_ — `RouteSelectScene` após a Fase 1 (2A Comercial / 2B Atendimento → `run.route`) **e** após a Fase 2 (3A Produto / 3B Tecnologia → `run.route2`), cada rota com um modificador de run. Falta só as **fases divergentes de verdade** (conteúdo distinto por rota, dependente de arte/level design).
- **Bosses únicos das Fases 2–5** — 🟢 _mecânica pronta_: cada fase tem um chefão temático com repertório telegrafado — Coordenador de Sinergia (F2: balões orbitando + tiro em cruz), Brenda do RH (F3: zonas de sorriso obrigatório + feedback dirigido), Scrum Master Caótico (F4: firewall dividindo a arena + Daily/Retro), Diretor de Resultados (F5: meta que estoura + reestruturação). CEO é a cena final.
  - **"cara de chefão" (arte)** — 🟡 _em andamento (pixel-art em código, via `gen-sprites.mjs`)_: **Brenda do RH (F3) já tem sprite DEDICADO** (`enemy-brenda-*`, 13 frames: blazer magenta, coque, óculos, crachá, prancheta de feedback + saia lápis/saltos) — piloto do estilo. **Faltam:** Coordenador (F2) e Scrum (F4) — que hoje reusam a classe do trash mob da Fase 1, então exigem separar boss de lixo antes do swap — e Diretor (F5, reusa `evangelista-boss`). CEO e Gerente já tinham arte própria.
- **Identidade visual das fases** — ✅ _feito_: cada Fase 2–5 tem geometria de plataforma própria (baias/escada/torres/átrio), superfície temática (tecido/carpete/rack/mármore), prop de chão (headset/standee/cabos/troféu) e partículas ambientes (papel/confete/faíscas/ouro). Fica pendente só arte de plataforma por sprite dedicado (opcional).
- **Salas opcionais**: ✅ _feito_ — `SalaReuniaoScene` (horda) + `SalaBonusScene` (Banheiro/TI/RH/Financeiro). A porta lateral da Copa sorteia uma sala não-limpa por visita (roguelite), 1×/run cada via `run.optionalRoomsCleared`.
- **NPCs / narrativa**: ✅ _feito_ — Estagiário Conspiracionista (teorias por loop), Analista LinkedIn (jargão) e **Veterano** (favor por 20 VR → +1 vida) na Copa; + **eventos de RH/Cultura** aleatórios ao entrar na Copa (Amigo Secreto, Happy Hour, Peixe no Micro-ondas).
- **New Game+ "Quinta-feira"**: ✅ _feito_ — desbloqueado na 1ª vitória; `run.ngPlus` dá +40% HP aos inimigos. Botão na Vitória + entrada 🌩 no menu.

### Balanceamento (decisões)

- **Economia de VR**: ✅ _feito_ — cap do empilhamento evento×produtividade em 2.5× + preços da Copa mais altos (Café 6, Pausa 9).
- **Ataques especiais próprios** para os bosses das Fases 2–4: ✅ _feito_ (Fase 4 já tinha; Fases 2 e 3 agora têm especiais telegrafados).

### Acessibilidade (Sprint 8)

- ✅ Opção "reduzir efeitos de Sanidade" (fotossensibilidade) — toggle no Pause.
- ✅ Gamepad completo: consumível em **L2** e troca de arma (Q) em **R2** — as duas ações que faltavam no controle.
- ✅ Legibilidade de HUD: 💰 no contador de VR e ícone de faixa na Sanidade (🙂/😰/😱/🔥).
- Pendente: desativar input-lag, remap de teclas, modo daltônico p/ telegraphs, texto escalável.

---

## Como este roadmap se relaciona com os outros docs

- **`.lovable/plan.md`** — plano de trabalho ativo do Lovable (onboarding + burnout). Este ROADMAP absorve o status; o plano detalha a execução.
- **`CLAUDE.md` → "Pendente / em aberto"** — recorte de engenharia/level-design (mesmos itens, mais detalhe técnico).
- **`ARCHITECTURE.md`** — como o código está montado (não é roadmap).
