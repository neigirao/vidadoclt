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

- **Ramificação de rotas**: bifurcação após Fase 1 (2A Comercial / 2B Atendimento) e Fase 2 (3A Produto / 3B Tecnologia).
- **Bosses únicos das Fases 2–5** (Caçador de Metas, Coordenador de Escala, Product Owner, Arquiteto, RH Predador, Diretor) — hoje enemy-classes com HP inflado. _Depende de arte nova (a arte-fonte de `_sources/` foi removida)._
- **Salas opcionais**: Reunião (horda), TI (armas), RH (roleta de eventos), Financeiro (VR + armadilhas), Banheiro (+sanidade). Só a Copa existe.
- **NPCs / narrativa**: Estagiário Conspiracionista, Analista LinkedIn (lojista), Veterano (atalhos), eventos de RH/Cultura.
- **New Game+ "Quinta-feira"**.

### Balanceamento (decisões)

- **Economia de VR**: run rende ~57–120 VR e a Copa inteira custa ~40–50 → sem tensão de escolha na 1ª Copa.
- **Ataques especiais próprios** para os bosses das Fases 2–4.

### Acessibilidade (Sprint 8 — quase intocado)

- Opção "reduzir efeitos de Sanidade" (fotossensibilidade), desativar input-lag, remap de teclas, modo daltônico p/ telegraphs, texto escalável.

---

## Como este roadmap se relaciona com os outros docs

- **`.lovable/plan.md`** — plano de trabalho ativo do Lovable (onboarding + burnout). Este ROADMAP absorve o status; o plano detalha a execução.
- **`CLAUDE.md` → "Pendente / em aberto"** — recorte de engenharia/level-design (mesmos itens, mais detalhe técnico).
- **`ARCHITECTURE.md`** — como o código está montado (não é roadmap).
