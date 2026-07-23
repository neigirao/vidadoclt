# Pipeline Aseprite — fonte de animação editável

> Fecha a lacuna-raiz do `docs/ANIM_POLICY.md`: os 3.8k PNGs de
> `public/assets/sprites/` são frames soltos **sem source** (sem timeline/tags) —
> por isso "mais frames" virou blend (que não suaviza). Este pipeline dá o caminho
> de arte AUTORAL: animar num `.aseprite` e importar para a convenção do repo.

## Fluxo

1. **Animar** no [Aseprite](https://www.aseprite.org) (pago) ou
   [LibreSprite](https://libresprite.github.io) (fork grátis): um arquivo por
   personagem, com **tags** na timeline nomeadas pelos estados do jogo
   (`walk`, `idle`, `attack`, `hurt`, `death`).
   - Canvas **uniforme** por arquivo (a regra do `check:frames`); não usar trim
     variável no export.
2. **Exportar** sheet + JSON (CLI ou File → Export Sprite Sheet):

   ```bash
   aseprite -b personagem.aseprite \
     --sheet sheet.png --data sheet.json \
     --format json-array --list-tags
   ```

3. **Importar** no repo:

   ```bash
   bun import:aseprite sheet.json enemy-estagiario          # grava + repack do atlas
   bun import:aseprite sheet.json enemy-estagiario --dry    # só o plano
   bun import:aseprite sheet.json x --out=/tmp/teste        # grava fora do repo (teste)
   ```

   O script fatia cada tag em `public/assets/sprites/<prefixo>-<tag><N>.png`
   (a convenção que `resolveSprite`/atlas já entendem) e re-empacota o atlas 1×.

4. **Timing**: o script imprime o `duration` da timeline por tag como **sugestão**
   de MS — aplicar à mão em `EnemyAnimConfig.ts` (timing é design; o script não
   edita config).

5. **Gates**: o import passa pelos mesmos portões de sempre — `check:frames`
   (contagem/canvas), `audit:sprites` (conteúdo), `audit:anim --gate` (ratchet de
   suavidade). Arte autoral que MELHORA os números → `bun audit:anim
--update-baseline` pra travar o ganho.

## Guardrails do importador

- Exige `json-array` + `frameTags` (erro claro se o export vier noutro formato).
- Valida canvas uniforme por tag (evita o "incha/encolhe" entre frames).
- Recompõe cada frame no canvas cheio respeitando o offset de trim
  (`spriteSourceSize`) — fiel ao pixel (≤2/255 de arredondamento de alpha em
  bordas semi-transparentes, inerente ao composite).
- `--out=DIR` nunca re-empacota (sandbox de teste); sem `--out`, grava no repo e
  roda `pack-atlas.mjs`.

## Migração (opcional, incremental)

Não é preciso migrar tudo: comece pelo personagem que mais aparece (player,
estagiário). Um `.aseprite` novo **substitui** os PNGs da família no próximo
import — os frames antigos continuam válidos até lá. Sugerido versionar os
`.aseprite` em `art/` (fora de `public/`).
