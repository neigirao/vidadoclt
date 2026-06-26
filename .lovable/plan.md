
# Roadmap de Publicação — Steam & Epic Games Store

> Versão do documento: 2026-06-26. Atualizar à medida que itens forem concluídos.

---

## Visão geral

O jogo está jogável do ponto de vista técnico (loop completo: Open Space → Copa → Fases 2-5 → CEO → Vitória). Para publicar nas lojas, precisamos cobrir **6 grandes frentes**: Conteúdo, Técnica/Plataforma, Áudio, Polimento/UX, Loja/Negócios e Jurídico/Compliance.

Estimativa de esforço total: **4-6 meses de desenvolvimento em equipe pequena** antes de entrar em Early Access.

---

## 🔴 CRÍTICO — Bloqueadores de lançamento

### 1. Conteúdo mínimo jogável

| # | Item | Detalhes |
|---|---|---|
| 1.1 | **Áudio completo** | Trilha sonora (loopable por fase), SFX de combate (acerto, esquiva, morte, level-up), stingers de boss, jingle de vitória/derrota. Atualmente zero áudio. |
| 1.2 | **Balanceamento de dificuldade** | Curva de HP/dano validada em playtest por 5+ jogadores externos. HP scaling de loop (implementado) precisa de validação numérica. |
| 1.3 | **Tela de título / créditos** | Créditos completos com todos os colaboradores. Tela de título com versão do jogo visível. |
| 1.4 | **Game Over + Vitória polidos** | Animações, estatísticas da run (tempo, inimigos mortos, VR coletado), call-to-action para nova tentativa. |
| 1.5 | **Tutorial ou onboarding** | Primeiros 60 segundos ensinando: andar, pular, dash, atacar, especial, interagir. Pode ser diegético (pop-ups in-world) ou sala de treino separada. |
| 1.6 | **Sprites faltantes** | `tex-extintor`, gerente com tamanho correto, EvangelistaCorporativo (2 chars no frame), objetos decorativos V1 (cadeira, armário, estante, vaso). |
| 1.7 | **Localização PT-BR completa** | Todos os textos em português — sem inglês residual no código (chaves, mensagens de erro expostas). |

### 2. Técnica obrigatória para desktop

| # | Item | Detalhes |
|---|---|---|
| 2.1 | **Empacotamento desktop** | Build Electron ou Tauri que roda offline, sem browser. Necessário para Steam/Epic (não aceitam web apps puros). |
| 2.2 | **Suporte a gamepad** | Xbox/DualSense via Gamepad API ou SDL2. Steam exige que jogos com suporte a controle declarem isso; Epic idem. Mapeamento básico já existe (`gamepadInteractJustPressed`), precisa completar todos os controles. |
| 2.3 | **Resolução e janela** | Fullscreen / windowed mode com alt+Enter. Suporte a resoluções 1080p, 1440p, 4K (pixel art upscale). |
| 2.4 | **Salvamento robusto** | Migrar de `localStorage` para arquivo em disco (`userData` do Electron/Tauri). Backup automático. Proteção contra save corruption. |
| 2.5 | **Crash reporting** | Captura de erros não-tratados com stack trace, sem expor dados do usuário. Sentry ou equivalente. |

---

## 🟡 IMPORTANTE — Necessário para aprovação nas lojas

### 3. Steam (Valve)

| # | Item | Detalhes |
|---|---|---|
| 3.1 | **Steam Direct fee** | U$100 por jogo (taxa única, reembolsada após U$1.000 em receita). |
| 3.2 | **Steamworks SDK** | Integração via `steamworks.js` (Node/Electron): achievements, cloud saves, overlay (Shift+Tab), rich presence. |
| 3.3 | **Steam Achievements** | Mínimo 10-15 conquistas. Ex: "Primeiro Dia", "Sobreviveu ao Loop", "CEO Demitido", "Burnout Total". Necessário aprovação Valve. |
| 3.4 | **Steam Cloud** | Salvar `RunState` + Reconhecimento/FGTS/Loops na nuvem. Implementar via `ISteamRemoteStorage`. |
| 3.5 | **Steam Input** | Configuração de controle compatível com Steam Input API — permite remapping pelo jogador dentro da overlay Steam. |
| 3.6 | **Página da loja Steam** | Descrição curta (<300 chars), descrição longa, 5+ screenshots (1280×720 ou 1920×1080), cápsula horizontal (460×215), cápsula vertical (231×87), trailer de 30-90s. |
| 3.7 | **Classificação etária** | IARC (sistema unificado que Steam usa) — formulário online, gratuito. Provável classificação: 12+ ou 14+ (violência estilizada, temática laboral). |
| 3.8 | **Política de privacidade** | URL pública obrigatória na página da loja. Declarar que não coleta dados. |
| 3.9 | **Build de revisão Valve** | Valve revisa antes de publicar. Processo leva 3-5 dias úteis após submissão final. |
| 3.10 | **Steam Deck** | Verificação "Playable" ou "Verified" no Steam Deck. Requer teste em resolução 1280×800, controle touchpad/giroscópio. Muito vantajoso para roguelites. |

### 4. Epic Games Store

| # | Item | Detalhes |
|---|---|---|
| 4.1 | **Developer Agreement** | Contrato com Epic. Taxa de distribuição: 12% (vs 30% Steam). Pagamento mínimo trimestral. |
| 4.2 | **EOS SDK** | Epic Online Services: achievements, cloud saves, overlay, anti-cheat (se necessário). `eos-sdk` para Node/Electron. |
| 4.3 | **Página EDA (Epic Dev Portal)** | Imagens: keyart 2560×1440, cápsula 480×270, screenshots 1920×1080, trailer. |
| 4.4 | **Rating IARC** | Mesmo formulário IARC do Steam — pode reaproveitar resultado. |
| 4.5 | **Revisão Epic** | Epic revisa mais rigorosamente que Valve. Prazo médio: 1-2 semanas. Exige build funcional sem crashes em 30 min de gameplay. |
| 4.6 | **EGS Free Games** | Opcional: negociar para ser jogo gratuito semanal da Epic (requer curadoria e garantia mínima de receita negociada). |

---

## 🟢 RECOMENDADO — Aumenta retenção e avaliações

### 5. Polimento de gameplay (baseado em best practices dos grandes roguelites)

| # | Item | Referência |
|---|---|---|
| 5.1 | **Hit-feel / "juice"** | Screen shake calibrado por força de ataque; flash branco no inimigo; hit-pause de 2-4 frames no golpe final; números de dano flutuantes. (Dead Cells) |
| 5.2 | **Feedback visual de build** | Highlight de synergias ativas no HUD; tooltip ao pegar item mostrando combos possíveis. (Hades) |
| 5.3 | **Narrativa no loop** | Faxineiro e NPCs comentam mortes anteriores; textos diferentes a cada loop (variáveis: `loopCount`, `cause`). (Hades) |
| 5.4 | **Meta-progressão visível** | Árvore de desbloqueios de armas/perks permanentes. "O que ganho ao morrer?" precisa ser claro. (Dead Cells / Hades) |
| 5.5 | **Run summary** | Tela pós-run com: mapa do percurso, inimigos mortos, dano total, VR ganho, perk mais usado. (Enter the Gungeon) |
| 5.6 | **Seeding de runs** | Exibir seed da run na tela de Game Over — permite compartilhar e comparar runs. (Binding of Isaac) |
| 5.7 | **Modo acessibilidade** | Opção de reduzir screen shake, aumentar contraste, pausar no hit. Obrigatório para Steam Deck Verified. |
| 5.8 | **Pause funcional** | PauseScene com: retomar, controles, som, sair ao menu. Já existe esqueleto, precisa completar. |
| 5.9 | **Leaderboard local + online** | Top 10 de tempo por fase e VR acumulado. Steam Leaderboards via Steamworks. |
| 5.10 | **Conquistas in-game** | Sistema visual dentro do jogo (além das Steam Achievements) — pop-up ao desbloquear. |

### 6. Assets de marketing (para trailer e store page)

| # | Item |
|---|---|
| 6.1 | Keyart 2560×1440 com personagem principal, temática corporativa, logo do jogo |
| 6.2 | Trailer gameplay de 60-90s mostrando: combate, dash, boss, loop de morte/respawn, perk choice |
| 6.3 | 8+ screenshots in-game em 1920×1080 (combate, mapa, boss, tela de Game Over, menu) |
| 6.4 | GIFs/clips para redes sociais (Twitter/X, TikTok, Instagram Reels) |
| 6.5 | Presskit (presskit.html ou similar) com bio, screenshots, contato para press/influencers |
| 6.6 | Página no itch.io para demo gratuita pré-lançamento (gera wishlist Steam) |

---

## 📋 Jurídico / Compliance

| # | Item | Urgência |
|---|---|---|
| 7.1 | **Razão social ou CNPJ** | Steam e Epic precisam de entidade legal para pagamento. PF (CPF) aceito para pessoas físicas, mas CNPJ reduz alíquota de IR. | Antes de publicar |
| 7.2 | **Política de privacidade** | Página web pública declarando: sem coleta de dados pessoais, uso de cookies (se web demo), LGPD compliance. | Antes de publicar |
| 7.3 | **EULA** | End User License Agreement. Pode usar templates gratuitos (Steam tem modelo padrão que basta aceitar). | Antes de publicar |
| 7.4 | **Licença de assets** | Confirmar que todos os sprites gerados por IA (ChatGPT/Gemini) têm licença comercial permitida. Verificar termos do plano utilizado. | Imediato |
| 7.5 | **Direitos musicais** | Toda música/SFX precisa ter licença comercial (CC0 ou comprada). Sem conteúdo de royalty-free apenas para uso pessoal. | Antes de áudio |
| 7.6 | **Referências culturais** | "CLT", "FGTS", "Vale Refeição" são termos públicos/culturais — sem risco. Verificar se há nomes de empresas reais nos textos do jogo. | Antes de publicar |
| 7.7 | **DJCTQ** | Classificação etária brasileira. Não obrigatória para Steam (usa IARC), mas recomendada para visibilidade local. | Recomendado |

---

## 🗓 Sequência sugerida de milestones

```
Milestone 0 — AGORA (em andamento)
  ✅ Loop de jogo completo (Fases 1-5 + CEO + Copa)
  ✅ Sistema de perks, culturas, armas (15)
  ✅ Sprites reais via atlas
  ✅ Loop scaling por morte
  ⬜ Áudio (bloqueador crítico)
  ⬜ Sprites faltantes (gerente, extintor)

Milestone 1 — Alpha fechado (1-2 meses)
  ⬜ Áudio completo (SFX + trilha)
  ⬜ Tutorial in-game
  ⬜ Balanceamento validado com playtesters
  ⬜ Build Electron funcional (Windows + Mac)
  ⬜ Saves em disco
  ⬜ Gamepad completo

Milestone 2 — Beta / demo pública (1 mês)
  ⬜ itch.io demo (Fase 1 + 2 + CEO)
  ⬜ Leaderboard local
  ⬜ Run summary screen
  ⬜ Polimento de juice (hit-feel, números de dano)
  ⬜ Narrativa de loop (NPCs que lembram mortes)
  ⬜ Página Steam (Coming Soon) + wishlist aberta

Milestone 3 — Submissão (1 mês)
  ⬜ Steam Achievements (10+)
  ⬜ Steam Cloud saves
  ⬜ IARC rating
  ⬜ Store page completa (screenshots, trailer, descrições)
  ⬜ Build de revisão Valve
  ⬜ Política de privacidade publicada
  ⬜ CNPJ / entidade legal configurada no Steamworks

Milestone 4 — Early Access (launch)
  ⬜ Launch no Steam
  ⬜ Submissão Epic Games Store
  ⬜ Presskit + contato com influencers BR
  ⬜ itch.io com versão demo mantida

Milestone 5 — 1.0 / Full Release (2-3 meses pós-EA)
  ⬜ Conteúdo extra (fases adicionais, bosses, armas, perks)
  ⬜ Localização EN-US para mercado internacional
  ⬜ Steam Deck Verified
  ⬜ Conquistas adicionais
  ⬜ Patch de balanceamento pós-feedback da comunidade
```

---

## Prioridade imediata (próximos 2 sprints)

1. **Áudio** — contratar/comissionar trilha e SFX ou usar biblioteca CC0 (Freesound, OpenGameArt)
2. **Build Electron** — empacotar o jogo para Windows `.exe` como prova de conceito
3. **Tutorial mínimo** — 3 salas ensinando move/attack/dash antes do Open Space
4. **Sprites críticos** — refazer os 50 frames defeituosos (Opção A do plano de sprites abaixo)
5. **Conta no Steamworks** — abrir hoje, pagar a taxa $100, já iniciar página "Em breve"

---

# Auditoria de qualidade dos sprites + plano de refazer os defeituosos

## Diagnóstico (1.021 PNGs em `public/assets/sprites/`)

### O que está bom
- **Tamanhos consistentes por entidade**: 0 entidades misturando canvas diferentes entre estados (`idle/walk/attack/hurt/death`). A grade canônica é:
  - **Inimigos comuns**: `48×64` (231 frames) ou `32×48` (128 frames placeholder)
  - **Player**: `64×64` (279 frames)
  - **Bosses**: `80×80`, `128×128` (CEO)
  - **Itens/objetos**: `40×48`, `44×44`, `36×44`, `52×52`
- **Alpha** validado pelo `check-sprites.mjs` (984 PNGs OK).

### Problemas encontrados (163 frames com defeito real)

O script de extração (`scripts/extract-*`) recortou várias linhas das spritesheets fonte com **bounding box errado** — o desenho ocupa <40% do canvas, ficando "perdido no vazio". Causa visual em jogo: pixel art parecendo flutuar, hitbox visualmente desalinhada, animação que "treme" porque cada frame tem o sprite num lugar diferente do canvas.

**Casos críticos (cobertura alpha <6%):**

| Arquivo | Canvas | bbox | Diagnóstico |
|---|---|---|---|
| `enemy-analista-hurt0` | 48×64 | 7×15 | **quase vazio** — recorte falhou |
| `enemy-planilha-attack1/death2/hurt1` | 48×64 | 42×12-21 | sprite achatado vertical |
| `enemy-arquivo-death1` | 48×64 | 42×21 | só metade superior |
| `enemy-drone-attack1/2`, `death2`, `walk3`, `idle3` | 48×64 | bh 13-24 | série inteira mal recortada |
| `enemy-bateria-hurt0/attack1/2/death1` | 48×64 | 14-19 wide | tudo deslocado |
| `enemy-carimbador-walk3/idle1/death1` | 48×64 | bh ~23 | sprite cortado no meio |
| `enemy-coletor-attack2/death1` | 48×64 | bbox <50% | recorte parcial |
| `enemy-cabo-death2`, `enemy-telemarketer-hurt0`, `enemy-noticeboard-death1` | 48×64 | bbox <40% | idem |
| `enemy-facilitador-death0` | 64×64 | 29×58 | OK em altura, padding lateral |
| `obj-pen-drive-use/active` | 28×20 | 9×12 | item minúsculo dentro de canvas pequeno |
| `obj-bomba-energia-*`, `obj-planta-empresa-*`, `obj-teclado-destroyed`, `obj-chave-inglesa-active` | 36-44 | <50% | extração truncada |
| `item-cafe-hot1` | 44×44 | 36×5 | **linha fina** — frame quebrado |
| `item-convite-idle1/expired1/expired2` | 48×36 | bbox <60% | recorte parcial |
| `boss-ceo-run2` | 128×128 | 74×117 | OK (sprite alto, padding lateral aceitável) |

**Total a refazer:** ~50 frames críticos + ~110 com padding excessivo aceitável.

### Arquivos a ignorar (fontes, não bugs)
- 32 PNGs em `1536×1024` (`ChatGPT Image *`, `Gemini_Generated_Image_*`, hashes `0b97…`, `40d08d2f…`, `4f9ff812…`) — são **as spritesheets fonte** dos quais os frames foram extraídos. Mover para `public/assets/sprites/_sources/` (fora do atlas) para limpar.
- 10 PNGs `enemy-<nome>.png` em `32×48` — placeholders pré-extração; podem ser excluídos.

---

## Posso refazer? Sim — três abordagens, do mais barato ao mais robusto

### Opção A — Re-extrair das spritesheets fonte (recomendada, custo zero)
Os PNGs fonte (`Gemini_Generated_Image_*`, `ChatGPT Image *`) **ainda contêm os frames bons** — o problema é só o grid de recorte no script. Eu posso:

1. Inspecionar cada spritesheet fonte (já estão na pasta).
2. Re-medir grid (linhas/colunas, offsets) frame por frame com `auto-bbox`: detectar bounding box opaco de cada célula e re-centralizar no canvas alvo (48×64 ou o que for).
3. Reescrever `scripts/extract-phase-enemies.py` / `extract-enemies-v2.cjs` com **auto-trim + center on canvas** — independe de coordenadas hardcoded.
4. Rodar `node scripts/pack-atlas.mjs` para regerar atlas.

**Vantagens:** preserva arte original; sem regeração via IA; reprodutível.

### Opção B — Auto-corrigir os 50 frames críticos (script único)
Para cada PNG defeituoso já em `sprites/`:
- Detectar bbox opaco; se < 50% do canvas, tentar reconstruir a partir do **frame irmão** (ex: `hurt0` defeituoso → usar `idle0` + tint vermelho).
- Útil só para `hurt` e alguns `death` — não recupera animação real.

**Vantagens:** rápido. **Desvantagens:** perde animação genuína.

### Opção C — Regerar via geração de imagem (mais caro)
Usar `imagegen` para refazer cada inimigo defeituoso como um set completo (idle/walk/attack/hurt/death), em estilo pixel-art consistente.

**Vantagens:** qualidade visual potencialmente superior. **Desvantagens:** custo de geração; risco de quebrar consistência estilística com os ~800 frames que já estão bons.

---

## Plano proposto (Opção A primeiro, B como complemento)

1. **Mover fontes para `_sources/`** — limpa `sprites/` e impede que o `pack-atlas` puxe sheets gigantes por engano. (~32 arquivos)
2. **Excluir placeholders** `enemy-<nome>.png` (sem sufixo de estado) — 10 arquivos.
3. **Criar `scripts/refit-sprites.mjs`** — varre `sprites/*.png`, e para cada arquivo com bbox <50% do canvas:
   - Detecta bbox opaco real.
   - Crop + paste centralizado no canvas alvo do mesmo tamanho.
   - Sobrescreve com versão "refit". (Não destrói arte, só re-centra.)
4. **Reescrever extração com auto-bbox** (`scripts/extract-auto.mjs`) e re-extrair os 4 inimigos com defeitos profundos: `analista-hurt`, `drone`, `bateria`, `carimbador`, `planilha`. Lê o JSON de grid existente, mas aplica `trim → center` em cada célula.
5. **Re-empacotar atlas** (`node scripts/pack-atlas.mjs`).
6. **Validar** com `check-sprites.mjs` + relatório novo de cobertura alpha (≥30% em todos os ≤48×64).
7. **Ajustes finos manuais** (lista curta, com `imagegen.edit_image`) só para frames que o refit não salva — provavelmente `item-cafe-hot1` (linha fina) e `enemy-analista-hurt0` (quase vazio).

### Vantagens de ter o pipeline corrigido
- **Animações deixam de tremer** (cada frame centralizado igual).
- **Hitbox visual = hitbox física** (sprite ocupa o canvas previsto).
- **Adicionar inimigo novo** vira só "joga sheet em `_sources/`, roda extract-auto, roda pack-atlas". Hoje exige ajustar coordenadas no script.
- **CI guard**: `check-sprites.mjs` ganha verificação de cobertura mínima (falha se algum frame voltar a ficar <30%).

---

## Pergunta de aprovação

Para começar (em modo build), prefere:
- **(a) Opção A completa** — passos 1-7 acima, ~50-80 frames corrigidos sem regerar arte.
- **(b) Opção A + C híbrido** — passos 1-5 + regerar via IA só os ~5 frames mais quebrados (analista-hurt0, item-cafe-hot1, enemy-drone série).
- **(c) Só o refit-sprites.mjs** (passo 3) — correção rápida, sem mexer no pipeline de extração.
