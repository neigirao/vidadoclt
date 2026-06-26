
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
