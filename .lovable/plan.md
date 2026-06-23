## Análise V1 vs V2 (Open Space)

**OpenSpaceScene (V1) – 882 linhas**
- Layout em "zonas" (Entrada, Open Space A/B, Boss) com clusters de mesas/estantes/armários.
- `buildPlatform(x, kind, tiles)` — altura derivada do tipo de móvel.
- Mais inimigos no roster (inclui `ConviteReuniao`), tem `phase2Active`, `buildDecor()` e `buildInteractiveObjects()` separados.
- Mais "vida" e variação visual, porém com mais acoplamento e código duplicado.

**OpenSpaceV2Scene (V2) – 660 linhas**
- Layout linear: 6 plataformas alternando mesa (30 px) / prateleira (72 px) com `buildPlatform(x, y, tiles)` explícito → previsível.
- Decorativos coerentes (café, bebedouro, ponto eletrônico, extintor, monitores nas mesas, quadros motivacionais em parallax).
- Sem `ConviteReuniao` e sem fase 2 separada — fluxo mais limpo.
- Código ~25% menor, mais legível, mais fácil de evoluir.

**Veredito:** V2 é melhor como base de progressão (legibilidade, parallax, pacing de plataformas). V1 tem variedade visual interessante mas está sobrecarregada. Recomendo **manter V2 como padrão** e portar 2 ideias de V1 quando fizer sentido: cluster de baias variado e o inimigo `ConviteReuniao`.

---

## Pendências de Sprites

> Atualizado em 2026-06-22. Marcar como ✅ quando concluído.

### 🔴 Alta prioridade

| Status | Item | Problema | Ação |
|---|---|---|---|
| ⬜ | **Gerente Microgestor (Chefão F1)** | Arte atual 56×72 é *menor* que o player 80×80. Frames `hurt0-1`, `death0`, `run-charge0-2` existem no atlas mas não são usados no código. Arte de 44×56 misturada deve ser removida. | Enviar sheet novo com personagem maior que o player. Pasta: `public/assets/sprites/chefao/` |
| ⬜ | **Player walk / run / jump / fall** | Personagem preenche o frame 80×80 sem margem — corte em poses extremas. Sheets enviados: `personagem/ozydij` (walk), `nk603k` (run), `iiu1fn` (jump). Frames extraídos mas ainda com borda cheia. | Verificar in-game se animação está aceitável; se não, pedir sheets com margem |

### 🟡 Média prioridade — sprites faltando no atlas

| Status | Chave `tex-` | Cena que usa | Ação |
|---|---|---|---|
| ⬜ | `tex-extintor` | OpenSpaceV2Scene, OpenSpaceScene | Criar/enviar sprite do extintor |
| ⬜ | `tex-cadeira` | OpenSpaceScene (V1) | Criar/enviar sprite da cadeira |
| ⬜ | `tex-armario` | OpenSpaceScene (V1) | Criar/enviar sprite do armário |
| ⬜ | `tex-estante` | OpenSpaceScene (V1) | Criar/enviar sprite da estante |
| ⬜ | `tex-vaso` | OpenSpaceScene (V1) | Criar/enviar sprite do vaso |

> Nota: `tex-armario-body`, `tex-estante-body`, `tex-mesa-body`, `tex-vaso-body`, `tex-impressora-body` são texturas geradas em runtime pelo TextureFactory — não precisam de PNG.

### 🟡 Média prioridade — frames no atlas não conectados ao código

| Status | Personagem | Frames disponíveis mas ignorados | Ação |
|---|---|---|---|
| ⬜ | **CEO** | `walk0-1`, `attack0-1`, `hurt0`, `death0-1`, `special0-1` | Conectar no `CeoBoss.ts` `updateTexture` |
| ⬜ | **Faxineiro** | `idle0-2`, `walk0-3`, `attack0-2`, `hurt0-1`, `death0-2`, `special0-2` | Conectar no `Faxineiro.ts` |
| ⬜ | **Gerente** | `hurt0-1`, `death0`, `run-charge0-2` | Conectar após novos sprites aprovados |

### 🟢 OK — bem servidos

| Personagem | Animações no atlas |
|---|---|
| Estagiário | idle, walk, attack, hurt, death ✅ |
| Analista | idle, walk, attack, hurt, death ✅ |
| Facilitador | idle, walk, attack, hurt, death ✅ |
| Scrum Master | idle, walk, attack, hurt, death ✅ |
| Coordenador | idle, walk, attack, hurt, death ✅ |
| Analista Sênior | idle, walk, attack, hurt, death ✅ |
| RH | idle, walk, attack, hurt, death ✅ |
| Moeda VR | idle, active, broken, used, empty ✅ (padding corrigido) |
| Items / Objetos | 226 frames com padding corrigido ✅ |

---

## Mudanças propostas (backlog técnico)

### 1. Tornar V2 o caminho padrão
- `ClassSelectScene.ts` linha 265: trocar `run.v2Mode ? "OpenSpaceV2Scene" : "OpenSpaceScene"` por `"OpenSpaceV2Scene"` sempre.
- `MenuScene.ts`: remover a opção "JOGAR V2" e deixar só "JOGAR" (mantém comportamento V2).
- Não deletar `OpenSpaceScene.ts` ainda — fica como referência até a próxima iteração.

### 2. Conectar animações existentes no código
- `CeoBoss.ts`: implementar `updateTexture()` usando frames `boss-ceo-*` já existentes no atlas.
- `Faxineiro.ts`: animar com frames `npc-faxineiro-*` já existentes.
- `Boss.ts` (Gerente): conectar `hurt` e `death` quando novos sprites forem aprovados.

### 3. Substituir sprite do player (histórico)
Arquivo: `public/assets/sprites/Gemini_Generated_Image_iiu1fniiu1fniiu1.png` (2750×1536, RGBA com transparência completa, frames declarados como 64×96).

O sheet **não é uma grade limpa** — tem títulos, paleta e painel de acessórios. Cada seção (IDLE, WALK, RUN, JUMP, FALL, DASH, ATTACK, HURT, INTERACT, BURNOUT) começa em um Y diferente e tem contagens distintas. Estratégia:

1. **Novo script `scripts/extract-player-from-sheet.py`** que:
   - Recebe um mapa hardcoded de seções (animName → {x, y, count, frameW=64, frameH=96}).
   - Para cada seção, recorta `count` células 64×96 a partir de (x, y), salva como `player-<anim><i>.png` em `public/assets/sprites/`.
   - Detecta o offset inicial de cada banda automaticamente procurando o primeiro pixel não-transparente (robustez contra ajuste fino dos Y).
   - Reduz para o padrão atual (idle 6, walk 8, run 8, jump 4, fall 3, dash 4, attack 6, hurt 2, interact 3, burnout 4) **amostrando frames uniformemente** para não quebrar o `Player.ts` (que indexa por `Math.floor(now/N) % count`).
2. Rodar `scripts/normalize-frames.py` para padronizar para 48×64 com pés alinhados (já existe e é o que o resto do jogo espera).
3. Rodar `scripts/check-sprites.mjs` para garantir que todos têm alpha.
4. Rodar `scripts/pack-atlas.py` para reempacotar `atlas.png` + `atlas.json`.
5. Atualizar `mem://design/player-sprite` com a origem do novo sheet.

### 4. Validações gerais
- Abrir o preview e verificar idle/walk/run/jump/fall/dash/attack visualmente.
- Conferir alinhamento dos pés (já corrigido via `setOffset(14, 28)`).
- Build TS deve passar (sem mudança de API).

## Arquivos tocados
- `src/game/scenes/ClassSelectScene.ts` (1 linha)
- `src/game/scenes/MenuScene.ts` (1 item de menu)
- `scripts/extract-player-from-sheet.py` (novo)
- ~41 PNGs em `public/assets/sprites/player-*.png` (regerados)
- `public/assets/atlas.png` + `public/assets/atlas.json` (regerados)
