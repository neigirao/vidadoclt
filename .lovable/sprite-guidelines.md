# Guia de Criação e Aplicação de Sprites — Vida do CLT

Referência para toda revisão ou criação de sprites de personagens, inimigos, chefões e objetos. Baseado no que funcionou (e no que não funcionou) no projeto.

---

## 1. Dimensões e grade

| Tipo                     | Tamanho do PNG    | Observação                                      |
| ------------------------ | ----------------- | ----------------------------------------------- |
| Personagem jogador       | 80×80 px          | margem de ~10px em cada lado                    |
| Inimigos comuns          | 48×64 px          | corpo centrado, pés na base                     |
| Chefões (Gerente, CEO)   | 64×96 px ou maior | proporção livre, mas consistente dentro do boss |
| Objetos de cena          | 48×48 px          | `obj-*` no atlas                                |
| Itens coletáveis         | 24×24 px          | `item-*` no atlas                               |
| Tiles (chão, plataforma) | 16×16 px          | tileable horizontalmente                        |

**Regra:** todos os frames de uma mesma entidade **devem ter exatamente o mesmo tamanho**. Frames de tamanhos diferentes causam saltos visuais e quebram os offsets de hitbox.

---

## 2. Transparência e fundo

- **Fundo sempre transparente** (PNG-32 com canal alpha).
- Não usar branco `#ffffff` ou preto puro `#000000` como fundo — são confundidos com pixels reais em extrações automáticas.
- Manter pelo menos **4px de margem** em todos os lados do sprite para evitar cortes no atlas.
- Pixels escuros do personagem (sombras, contornos) **não devem ser removidos** na extração — usar threshold de cor, não threshold de luminância.

---

## 3. Outline de 1px

Todos os personagens e inimigos recebem **outline preto de 1px** automático via script. Não adicionar outline manualmente no sprite — o script `pack-atlas.mjs` aplica via `outline-sprites.mjs`.

Benefícios comprovados no projeto:

- Legibilidade sobre fundos variados (claro, escuro, colorido).
- Consistência visual entre sprites de origens diferentes.

---

## 4. Nomenclatura de frames no atlas

Padrão: `<categoria>-<nome>-<estado><frame>`

| Categoria      | Prefixo   | Exemplo                  |
| -------------- | --------- | ------------------------ |
| Inimigo        | `enemy-`  | `enemy-estagiario-idle0` |
| Chefão         | `boss-`   | `boss-gerente-idle0`     |
| Jogador        | `player-` | `player-walk2`           |
| Objeto de cena | `obj-`    | `obj-mesa-idle`          |
| Item coletável | `item-`   | `item-coffee-cup`        |
| NPC            | `npc-`    | `npc-faxineiro-idle0`    |
| Tile           | `tile-`   | `tile-platform`          |

**Estados obrigatórios** para inimigos: `idle0`, `walk0`, `walk1`, `hurt0`, `attack0`.
**Estados opcionais:** `death0–death3`, `attack1`, `idle1`.

Frames começam em 0. Nunca pular índices (ex: idle0, idle2 sem idle1 causa bugs de animação).

---

## 5. Registro no atlas

Após criar ou editar qualquer PNG em `public/assets/sprites/`:

```bash
node scripts/pack-atlas.mjs
```

O atlas (`public/assets/atlas.png` + `atlas.json`) é o **único** arquivo carregado pelo jogo. Editar o PNG isolado não tem efeito.

Para verificar se os frames foram empacotados corretamente:

```bash
node scripts/check-sprites.mjs
```

---

## 6. Integração no código

### Novo inimigo

```ts
// No construtor:
super(scene, x, y, ...resolveSprite("tex-<nome>-idle0"));

// Na animação (preUpdate):
setEnemyTex(this, t, "<nome>", "idle" | "walk" | "attack" | "hurt");

// No hit() ao morrer:
if (this.hp <= 0) markKilled("<enemy_id_do_catalogo>");
```

### Novo objeto

```ts
addImage(scene, x, y, "tex-<nome>"); // imagem estática
addSprite(scene, x, y, "tex-<nome>-idle0"); // sprite animável
```

### Verificar frames em dev

```ts
// No create() da cena, para cada inimigo novo:
warnMissing(this, "<nome>");
// Loga no console se idle0, walk0 ou hurt0 estiverem ausentes.
```

---

## 7. Hitbox (corpo físico)

- A hitbox **não deve cobrir o sprite inteiro** — sempre menor que o sprite visual.
- Regra geral para inimigos 48×64: corpo ~60–70% da área, centrado horizontalmente, alinhado aos pés.
- Exemplo padrão: `body.setSize(24, 36); body.setOffset(12, 28);` para sprite 48×64.
- Chefões grandes: testar no modo debug (`?debug` na URL) e ajustar até parecer justo para o jogador.

---

## 8. Ancoragem (origin)

- **Inimigos e jogador:** `setOrigin(0.5, 1)` — âncora nos pés. Facilita alinhar com o chão e calcular hitboxes.
- **Objetos de cena:** `setOrigin(0.5, 1)` ou `setOrigin(0.5, 0.5)` dependendo da posição de referência.
- **HUD:** `setScrollFactor(0)` + origin livre conforme layout.

`bindEnemySprite(sprite, "tex-<nome>-idle0")` aplica textura e origin correto automaticamente.

---

## 9. Animação — boas práticas

- **Não usar `setTexture` diretamente** — usar `applyTexture(sprite, "tex-...")` que só troca se o frame mudou (evita rebind WebGL).
- Velocidade de animação: walk ~220ms por frame, ataques mais rápidos (~100–150ms).
- Offset de fase aleatório por instância: evita que todos os inimigos piscam no mesmo frame (já implementado em `setEnemyTex` via `_animOffsets`).
- Inimigos sem frames de walk distintos: usar idle0 estático — não esticar ou reutilizar frames errados.

---

## 10. Chefões — regras adicionais

- Todo boss deve ter as fases de sprite: `idle`, `walk`, `attack`, `hurt`, `death`.
- Sprite de morte: sequência de 3–4 frames com dissolve/colapso. Não usar fade alpha simples.
- Boss invulnerável durante i-frames: aplicar tint vermelho `0xff8888`, não remover o sprite.
- Hitbox de ataque do boss: calcular manualmente com `Phaser.Geom.Rectangle` em `swingHitbox` — não usar physics overlap (timing impreciso para ataques de melee rápidos).
- Catalogar no `BossCatalog.ts` com `spritePrefix`, `bodySize`, `phases` e `attacks` antes de integrar na cena.

---

## 11. Checklist antes de integrar um sprite novo

- [ ] PNG com fundo transparente e margem de 4px
- [ ] Todos os frames do mesmo tamanho
- [ ] Nomenclatura seguindo `<categoria>-<nome>-<estado><frame>`
- [ ] `pack-atlas.mjs` rodado
- [ ] `check-sprites.mjs` sem erros
- [ ] `warnMissing(scene, "<nome>")` no `create()` da cena (remover após validar)
- [ ] Hitbox testada com `?debug` na URL
- [ ] `markKilled("<id>")` no `hit()` se for inimigo catalogado
- [ ] Entrada no `EnemyCatalog.ts` ou `BossCatalog.ts`

---

## 12. Anti-patterns conhecidos (não repetir)

| Problema            | O que não fazer                            | Solução                                                  |
| ------------------- | ------------------------------------------ | -------------------------------------------------------- |
| Flicker de textura  | `setTexture()` a cada frame                | `applyTexture()` — troca só quando muda                  |
| Arco-íris em móveis | Esticar texturas de estante colorida       | `add.graphics().fillStyle()` sólido                      |
| Parede invisível    | Inimigos colidindo com `furnitureBodies`   | Só player colide com móveis; inimigos só com `platforms` |
| Frames fantasma     | PNG com pixels residuais de frame anterior | Re-extrair com threshold correto                         |
| Sprite cortado      | Margem insuficiente no PNG                 | Mínimo 4px de margem em cada lado                        |
| Outline duplo       | Outline manual + outline do script         | Não adicionar outline manual                             |
