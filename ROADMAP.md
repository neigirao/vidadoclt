# ROADMAP — A Vida do CLT

Baseado no GDD v2.0. Cada sprint adiciona uma camada jogável e completa sobre a anterior.

---

## Sprint 1 — Núcleo jogável ✅ CONCLUÍDO

**Entregável:** protótipo jogável no navegador, Área 1 do Open Space.

- [x] Player controller: andar, pular (coyote time 0,1s + jump buffer), dash (i-frames 150ms, cooldown 1,5s)
- [x] Combo de 3 hits melee com knockback no 3º hit
- [x] Energia e Sanidade (barras no HUD, sem efeitos de Sanidade ainda)
- [x] Drop de VR ao derrotar inimigos
- [x] Estagiário Desesperado (patrulha simples, contato = 15 dano, 1 HP)
- [x] Analista Júnior (state machine: walk → telegraph 400ms → swing → recover)
- [x] Área 1 hardcoded: chão + 6 plataformas + decoração "baias"
- [x] HUD: barra Energia, barra Sanidade, contador VR, relógio cosmético
- [x] Morte → "Rescisão da tentativa" → conversão VR → Reconhecimento → restart
- [x] Efeitos visuais de Sanidade: vinheta + aberração cromática (`SanityFx`)
- [x] Persistência de estado entre cenas via `PlayerState` / `scene.registry`

---

## Sprint 1.5 — UX e novos inimigos ✅ CONCLUÍDO

**Entregável:** menu de entrada, HUD profissional, 4 novos inimigos com mecânicas únicas.

- [x] **MenuScene** com título "VIDA DO CLT", 5 itens (JOGAR, RANKING, ARSENAL, CONQUISTAS, CONFIGURAÇÕES), navegação teclado + mouse, fade de entrada
- [x] **HUD redesenhado**: portrait do jogador, barra Energia, barra Sanidade, VR em formato R$, nome da fase, objetivo, relógio, barra de boss (oculta por padrão), barra de ação inferior (arma + especial + skills + minimapa)
- [x] **FacilitadorDeWorkshop** (HP 2): walk → telegraph → shoot → cooldown; dispara PostIts que causam dano de Sanidade
- [x] **PostIt** (projétil): voa em linha reta, sem gravidade, 12 de dano de Sanidade
- [x] **ScrumMasterCaotico** (HP 2): walk → charge → shout → recover; grito puxa o jogador
- [x] **CoordenadorDeSinergia** (HP 4): suporte; pulso de buff acelera inimigos num raio de 160px a cada 3,2s
- [x] **AnalistaSeniorExausto** (HP 8, tanque): walk → telegraph 650ms → slam 35 dano → exhausted; quasi-imune a knockback
- [x] Spawn organizado em 4 áreas progressivas na Área 1 do Open Space
- [x] Copa básica (cena separada, navegação via porta com tecla E)

---

## Sprint 2 — Loop de run

**Entregável:** run com início, área segura completa, checkpoint e fail state alternativo de Burnout.

- [ ] **Sistema de Sanidade por faixas**
  - 75–51%: notificações falsas na HUD (ruído visual)
  - 50–26%: sons fantasmas (Teams/Outlook), inimigos ilusórios ocasionais
  - 25–11%: inimigos ilusórios frequentes, distorção leve de tela
  - 10–1%: distorção forte, input lag leve
  - 0%: **BURNOUT** — run termina, mantém 50% VR convertido com bônus
- [ ] **Persistência de Reconhecimento** entre runs (`localStorage`)
- [ ] **Copa Corporativa** completa (Área 3 do Open Space)
  - NPC Faxineiro: cura +10 Sanidade, diálogo que muda a cada loop
  - Café disponível para compra (+20 Energia)
- [ ] **Ponto Eletrônico** entre fases
  - Checkpoint: salva progresso da run
  - Loja básica (Analista LinkedIn): 3 itens aleatórios à venda
  - Passar correndo sem bater o ponto = pular a loja (speedrun trade-off)
- [ ] **FGTS**
  - Cresce passivamente a cada run (+10 por run completa, independente de vitória)
  - Opção "Pedir para ser demitido" no menu de pausa
  - Ao usar: encerra run imediatamente, converte todo FGTS em Reconhecimento × 1,5

---

## Sprint 3 — Fase 1 completa

**Entregável:** Fase 1 (Open Space) jogável do início ao fim, com todos os inimigos e chefe.

- [x] Inimigos Área 2 — Corredor das Reuniões: Facilitador de Workshop, Scrum Master Caótico
- [x] Inimigos Área 4 — Ala da Gestão: Coordenador de Sinergia, Analista Sênior Exausto
- [ ] **Armadilha Área 2**: Convites de Reunião (pop-ups flutuantes, toque = lentidão 2s + −10 sanidade)
- [ ] **Chefe: Gerente Microgestor**
  - Frase de entrada: *"Antes de você sair precisamos alinhar algumas coisas."*
  - Ataques:
    - Follow-Up: projétil teleguiado (e-mail)
    - Alinhamento: puxa jogador ao centro da arena
    - Atualização Rápida: 3 investidas em sequência
    - Reunião Emergencial: invoca 2 Estagiários Desesperados
    - Você Tem 5 Minutos?: congela jogador 5s reais (esquivável atrás de baia)
    - Deadline Inadiável (fase 2, <30% HP): arena encolhe + relógio acelera
  - Recompensa: perk Autonomia + VR extra
- [ ] **Perk Autonomia** funcional: −50% efeitos de lentidão/controle
- [ ] **Transição de fase**: acesso ao Ponto Eletrônico após derrotar o chefe
- [ ] **Barra de HP do boss** no HUD (infraestrutura já existe em `Hud.showBoss()`)

---

## Sprint 4 — Rogue-lite completo

**Entregável:** meta-progressão, múltiplas classes, armas e modificadores de run.

### Classes (3)
- [ ] **Estagiário**: 80 Energia, 120 Sanidade, Caneta Bic Tática, +20% velocidade
- [ ] **Analista Pleno**: 100/100, Grampeador Tático, +10% VR coletado
- [ ] **Terceirizado**: 130 Energia, 70 Sanidade, Régua Metálica, +15% dano / lojas +20%
- [ ] Tela de seleção de classe antes de cada run

### Armas (12, divididas em 3 raridades)
**Comuns:**
- [ ] Grampeador Tático: melee, 3º hit "grampeia" no chão 1s
- [ ] Caneta Bic Tática: ranged rápido e fraco, recarga "mordendo a tampa"
- [ ] Régua Metálica: melee alcance longo, knockback forte
- [ ] Mouse Sem Fio: bumerangue arremessável, 10% chance de "perder sinal"

**Raras:**
- [ ] Impressora Multifuncional: cadência alta, 15% chance de atolar papel (1,5s travada)
- [ ] Caneca de Café Escaldante: arremesso AoE + recupera 5 Sanidade ao acertar
- [ ] Telefone Corporativo: invoca "ligação em espera" que persegue inimigo por 4s
- [ ] Projetor Laser: feixe contínuo consome Sanidade enquanto dispara

**Épicas:**
- [ ] PowerPoint Devastador: hipnotiza inimigos no alcance por 3s (dormem na apresentação)
- [ ] Planilha da Morte: AoE, inimigos ficam congelados "analisando dados" por 2s
- [ ] VPN Corporativa: invisibilidade 4s, mas tudo (inclusive jogador) fica lento
- [ ] Cadeira Gamer Executiva: investida giratória, dano cresce com combo

### Perks (8)
- [ ] Autonomia: −50% efeitos de lentidão (drop do Gerente Microgestor)
- [ ] Terapia no Convênio: +1 Sanidade a cada 5s
- [ ] Banco de Horas: acumula horas → desacelera o tempo 3s
- [ ] Home Office: teleporta à Copa mais próxima (1×/fase)
- [ ] Coffee Break: Cafés curam +50%
- [ ] Inbox Zero: imune a notificações falsas (faixa 75–51%)
- [ ] Cara do Networking: lojas −15%
- [ ] Pelo Menos é CLT: sobrevive 1× com 1 Energia (1×/run)

### Cultura Corporativa (5 modificadores de run)
- [ ] Startup: +20% velocidade, épicas mais cedo mas 10% quebram
- [ ] Banco: chefes ganham Compliance Check (bloqueia dash 3s), +1 inimigo/sala, mais VR
- [ ] Consultoria: mini-chefes extras, lojas mais raras
- [ ] Telecom: portas/elevadores falham aleatoriamente, +50% eventos aleatórios
- [ ] Big Tech: inimigo exclusivo Algoritmo de Performance (drone que buffa vizinhos)

### Ramificação
- [ ] Bifurcação após Fase 1: escolha entre Fase 2A (Comercial) ou Fase 2B (Atendimento)
- [ ] Bifurcação após Fase 2: Fase 3A (Produto) ou Fase 3B (Tecnologia)

---

## Sprint 5 — Fases 2 e 3

**Entregável:** dois caminhos completos com chefes.

### Fase 2A — Comercial
- [ ] Cenário: metas, gongos de venda, dashboards
- [ ] Chefe: Caçador de Metas — a cada 20s bate meta e ganha buff; gongo destruível remove buff

### Fase 2B — Atendimento
- [ ] Cenário: headsets, filas, painéis de chamados
- [ ] Chefe: Coordenador de Escala — invoca filas de "clientes insatisfeitos"; "Sua ligação é muito importante" prende em espera

### Fase 3A — Produto
- [ ] Cenário: post-its, roadmaps, Kanban
- [ ] Chefe: Product Owner Obcecado — reordena a arena movendo plataformas; copia último movimento do jogador

### Fase 3B — Tecnologia
- [ ] Cenário: servidores, cabos, logs
- [ ] Chefe: Arquiteto Supremo — constrói torres de defesa (microsserviços) que devem ser derrubadas antes de expô-lo

### Salas opcionais (em todas as fases)
- [ ] Copa (área segura já implementada em Sprint 2)
- [ ] Sala de Reunião: horda por recompensa maior
- [ ] TI: armas/upgrades (mini-puzzle "abrir chamado")
- [ ] RH: eventos aleatórios (roleta)
- [ ] Financeiro: muito VR, armadilhas letais
- [ ] Banheiro: +15 Sanidade, risco de flagra pelo chefe

---

## Sprint 6 — Fases 4 e 5 + CEO

**Entregável:** jogo completo do início ao fim.

### Fase 4 — RH & Compliance
- [ ] Cenário: crachás, formulários, câmeras
- [ ] Luta dupla: RH Predador + Guardiã da Ordem
  - RH Predador: "convoca para conversinha" (hitkill telegrafado)
  - Guardiã: cria zonas de conformidade que limitam onde pisar

### Fase 5 — Diretoria
- [ ] Cenário: carpete, vidro, troféus
- [ ] Mini-boss: Diretor de Resultados
- [ ] Transição para área do CEO

### Chefe Final — CEO (Chief Everything Officer)
- [ ] Visual monstruoso; rosto nunca aparece por completo
- [ ] Ataques:
  - Transformação Digital: cenário vira "versão beta" com bugs (plataformas piscam)
  - Mudança Estratégica: inverte controles por 4s
  - Reorganização Global: embaralha posições de jogador e inimigos
  - Corte de Custos: remove curas da arena e drena VR
- [ ] Fase final: invoca versões-sombra dos chefes anteriores
- [ ] Tela de vitória: "Você chegou em casa." → fade → despertador → corte para preto
- [ ] New Game+ desbloqueado: "Quinta-feira" (mesma dificuldade, porém pior)

---

## Sprint 7 — NPCs, Eventos e Narrativa

- [ ] **Faxineiro**: diálogos diferentes por número de loops (contador persistido)
- [ ] **Estagiário Conspiracionista**: teorias sobre o CEO que evoluem a cada run
- [ ] **Analista LinkedIn**: lojista com falas em jargão corporativo
- [ ] **Veterano (35 anos de casa)**: desbloqueia atalhos mediante favores
- [ ] Eventos aleatórios (sala de RH / Cultura Telecom):
  - Happy Hour Obrigatório: horda festiva 60s, VR dobrado
  - Amigo Secreto: item aleatório
  - Colega do Peixe no Micro-ondas: nuvem de dano de Sanidade na Copa
  - Pesquisa de Clima: 3 perguntas; resposta "errada" invoca RH Predador mais cedo
  - Sextou: sextas-feiras reais +10% VR + música especial

---

## Sprint 8 — Áudio e Acessibilidade

### Áudio
- [ ] Trilha: elevator music corrompida que degrada com a Sanidade
- [ ] Variação temática por departamento (Comercial = motivacional agressiva; TI = synth glitch)
- [ ] SFX de inimigos com sons reais de notificação (Teams, Outlook, Slack) como telegraphs
- [ ] Vozes de chefes com reverb de sala de reunião
- [ ] Estado de Burnout: áudio abafa + zumbido + despertador ao reiniciar

### Acessibilidade
- [ ] Opção "Reduzir efeitos de Sanidade" (remove distorção e flashes — fotossensibilidade)
- [ ] Opção de desativar input lag do estado de Sanidade baixa
- [ ] Remapeamento de teclas
- [ ] Modo daltônico para telegraphs de ataque
- [ ] Texto escalável nos diálogos

---

## Pós-lançamento

- [ ] Fases adicionais (pós-MVP)
- [ ] Classes extras: Gerente Rebaixado, PJ
- [ ] Armas lendárias: RH Supremo, Contrato Vitalício, PowerPoint Dourado
- [ ] Bosses sazonais
- [ ] Mobile (stretch goal)

---

## Resumo de progresso

| Sprint | Status | Entregável |
|--------|--------|-----------|
| Sprint 1 | ✅ Concluído | Protótipo jogável (Área 1) |
| Sprint 1.5 | ✅ Concluído | Menu, HUD redesenhado, 4 novos inimigos |
| Sprint 2 | ⬜ Pendente | Sistema de Sanidade + loop de run completo |
| Sprint 3 | 🔄 Parcial | Fase 1 completa com chefe (inimigos ✅, armadilhas + chefe ⬜) |
| Sprint 4 | ⬜ Pendente | Meta-progressão rogue-lite |
| Sprint 5 | ⬜ Pendente | Fases 2 e 3 |
| Sprint 6 | ⬜ Pendente | Fases 4 e 5 + CEO + vitória |
| Sprint 7 | ⬜ Pendente | NPCs, narrativa, eventos |
| Sprint 8 | ⬜ Pendente | Áudio e acessibilidade |
