# Auditoria — Arte 2D · Design · UX · Game Design

Recorte focado nas 4 disciplinas pedidas. Reconciliado com o código atual (itens já resolvidos vêm marcados ✅ pra não repetir trabalho). Severidade: 🔴 alto · 🟡 médio · ⚪ baixo.

---

## 1) ARTE 2D

| Sev | Achado | Nota |
|-----|--------|------|
| 🔴 | **Fundos das Fases 2–5 chapados** (skyline PNG 32–44 KB) vs. Fase 1/Copa pintadas ricas | Pipeline (upload no LAB → `💾 FIXAR NO REPO`) pronto. Bloqueado em arte externa. |
| 🔴 | **CEO tem o pior fundo do jogo** — clímax visual falha | Prioridade sobre as outras fases. |
| 🔴 | **Sem NPCs de cenário** além de Faxineiro | 2–3 sprites "vivos" (colega no cubículo, chefe passando) contariam história barato. |
| 🟡 | **Parallax raso** — 1 camada distante em `Background.ts` | Hollow Knight/Blasphemous fazem 4–6 camadas com desat progressivo. |
| 🟡 | **Sem paleta por bioma** — RH/TI/Diretoria compartilham a mesma cor | Leitura de progresso pobre. Resolve com ColorMatrix filter por fase. |
| 🟡 | **AmbientLore genérico** — sistema plugado, conteúdo não-curatorial | Post-its/e-mails vazando por fase × rota. |
| ⚪ | Band-aids de sprite ativos = 0 | Pipeline maduro (`gen-sprites` + `frame-fix` + Gemini). Sem ROI em revisitar. |

## 2) DESIGN VISUAL (UI/HUD/telas)

| Sev | Achado | Nota |
|-----|--------|------|
| 🔴 | **Sem identidade tipográfica** — Menu/HUD/GameOver em fonte de sistema | Maior ganho/hora do projeto. 1 display pixel + 1 mono legível resolve em 1 dia. |
| 🔴 | **Sem paleta por bioma** (mesma raiz de Arte) | ColorMatrix por fase é 1 shader parametrizado. |
| 🟡 | **Tela de Vitória sem epílogo** — `run.` tem tudo (loops, kills, sanidade, cultura, causa) | Carta de rescisão + manchete "CLT escapa às 18h" + gancho NG+ é montável do que existe. |
| 🟡 | **Beat de entrada de mid-boss só na Fase 1** | Reusa `BossPresence` nas Fases 2–5 (câmera para, stinger, portal fecha). |
| ⚪ | HUD já mostra perks + cooldowns · Death recap no GameOver · Fundos WebP | ✅ |

## 3) UX

| Sev | Achado | Nota |
|-----|--------|------|
| 🔴 | **Class + Cultura antes da 1ª jogada** — 3 classes × 12 culturas sem contexto | Padrão moderno: 1ª run fixa, sistemas destravam a cada morte. Menor fricção. |
| 🔴 | **Meta-loja não projeta impacto** — sem "próxima run começa com +X sanidade" | Sem projeção, meta-progressão vira paisagem. |
| 🟡 | **Sem popup de VR flutuante ao matar** — `onKill` hook existe, falta o número dourado + fade | Kill lucrativo (segredo/produtividade) não "estala". |
| 🟡 | **Micro-legenda de sanidade some após tutorial** | "-2 sanidade — email do chefe" por evento. |
| 🟡 | **NG+ invisível pra 95%** (aparece só pós-vitória) | Teaser na tela de Vitória. |
| ⚪ | **Heat é slider chato** — só multiplica HP+VR | Modificadores flavored ("inimigos revivem 1×", "sem Copa", "boss 2ª fase") viram decisão. |

## 4) GAME DESIGN

| Sev | Achado | Nota |
|-----|--------|------|
| 🔴 | **Classes lidas como planilha** — Estagiário/Analista/Terceirizado só variam mult de speed/HP/energia | Mudança de mais alto teto. Cada classe deveria ter especial (K) mecânica e visualmente único (Estagiário: grito que chama colega; Analista: planilha AoE; Terceirizado: boleto explosivo). |
| 🔴 | **Fase 1 ainda é o pico de densidade** mesmo após melhorias em 2–3 | Medir com telemetria antes de tunar. |
| 🟡 | **Dash tem 1 uso** (esquivar) — sem cancel de recovery, sem dash aéreo ofensivo | Benchmark: Dead Cells. |
| 🟡 | **Parry invisível fora da zona 1** — nenhum inimigo tem marker "parryável" | Sistema esquecido. |
| 🟡 | **Sem sala de tesouro/aposta/mini-boss opcional entre zonas** — drop linear | Benchmark: Gungeon. Zero risco/recompensa mid-run. |
| 🟡 | **Nenhum inimigo pede verticalidade** — todos atiram horizontal | Plataformas viram cenário. |
| 🟡 | **Healers (mecânica mais rica da F1) sub-replicados** nas outras fases | |
| ⚪ | **Faxineiro não lembra do loop** (Hades era referência declarada) | 6 linhas condicionais por `run.lastDeathCause`/`loops`. |
| ⚪ | **CEO chega frio** — sem buildup (menção no Faxineiro, memo, outdoor) | |

---

## PLANO CONSOLIDADO — 3 SPRINTS

### 🟢 Sprint 1 — Leitura + Juice (~1 semana)
1. Fonte assinatura (1 display pixel + 1 mono) aplicada em Menu/HUD/GameOver
2. Popup de VR flutuante ao matar (número dourado + fade)
3. Micro-legenda de sanidade por evento
4. Parry-hint no marker de ameaça (contorno pulsante em inimigos parryáveis)
5. Beat de entrada de mid-boss nas Fases 2–5 (reusa `BossPresence`)

### 🟡 Sprint 2 — Bioma + Ambientação (~1 semana)
6. ColorMatrix filter por fase (paleta por bioma: RH/TI/Diretoria/Cobertura)
7. Parallax denso em `Background.ts` (4 camadas com desat progressivo)
8. AmbientLore curatorial (passe de conteúdo por fase × rota)
9. NPCs de cenário (colega/chefe/faxineira em outra fase — 2–3 sprites sem interação)

### 🔴 Sprint 3 — Onboarding + Progressão (~1 semana)
10. 1ª run fixa (classe default, sem cultura, sem loja) — sistemas destravam a cada morte
11. Meta-loja projeta impacto ("comprando X, próxima run começa com Y")
12. Faxineiro lembra do loop (6–10 linhas condicionais)
13. Vitória com epílogo (carta de rescisão + manchete + gancho NG+)
14. Modo assistido opcional (dano ×0.7, +1 vida por fase)

### 🟣 Backlog estrutural (multi-sprint, alto teto)
- **Identidade por classe** — especial K único (Estagiário/Analista/Terceirizado) — muda "planilha" pra "estilo"
- **Sala de tesouro/aposta** entre zonas (40 VR vs. arma vs. reroll perk)
- **Heat flavored** ("inimigos revivem", "sem Copa", "boss 2ª fase")
- **Dash ofensivo** + variante aérea de especial
- **Inimigo verticalizador** por fase
- **Fundos pintados Fases 2–5 + CEO prioridade** (arte externa — bloqueado)

---

## RESUMO

- **Item de maior ROI:** tipografia assinatura (Sprint 1) — visual muda de patamar em 1 dia.
- **Item de maior teto:** identidade por classe (Backlog) — muda a percepção de "planilha" pra "estilo".
- **Bloqueado em arte externa:** fundos pintados Fases 2–5 + CEO. Pipeline pronto, falta imagem.

Diz qual sprint (ou item específico) quer começar e eu passo pra build.
