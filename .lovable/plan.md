# Auditoria 2D — sprites, frames e animações

Análise a partir de `CLAUDE.md`, `docs/ANIM_POLICY.md`, `docs/ART_GAPS.md`, `docs/SPRITE_AUDIT.md`, `scripts/anim-baseline.json` e o estado do atlas (1373 sprites, 185 famílias, 16 frames/ação como piso em walk/idle).

## Diagnóstico — o que está bom, o que está ruim

### Pontos fortes (não mexer)

- **Infra de qualidade sólida**: gates de CI para contagem (`check:frames`), conteúdo (`audit:sprites`), paleta (`audit:palette`) e ratchet de suavidade (`audit:anim`). Raro num projeto deste porte.
- **Fundos pintados dos 2 primeiros biomas** (`bg-openspace`, `bg-atendimento` em WebP) — leitura rica, paleta coerente, parallax denso.
- **Player**: sprite base bem cortado, squash & stretch tunado em fonte única (`Juice.ts`), crachá com follow-through.
- **Legibilidade de combate**: rim-light, sombras de contato, threat markers, boss presence — a camada espacial está madura.
- **Cobertura de 16 frames em idle/walk**: uniforme no atlas.

### Problemas reais (por severidade)

**S1 — Suavidade de animação está travada num teto ruim**

- `audit:anim` baseline: **jerk=93, loop-pop=62, padded=67, dead=4**. Ou seja, 62 ciclos "estalam" ao repetir, 67 estados têm metade dos frames como filler quase-duplicado.
- Causa raiz documentada em `docs/ANIM_POLICY.md`: os 16 frames por ação vieram de **interpolação por blend**, que em pixel-art não cria pose intermediária — cria ghost/filler. **Duas tentativas de "melhorar com mais blend" pioraram os números.** É beco sem saída.
- Efeito no jogador: as animações leem como "16 frames no papel", mas na tela parecem 4 frames com fantasmas.

**S2 — Attack incoerente em vários inimigos (arte trocada por IA)**

- `analista`, `scrum`, `coordenador`, `estagiario`, `scrum-boss`, `coord-boss` receberam `attack2/3` que são um **personagem diferente da base** (musculoso/chicote/ícone de som). O jogo cicla só 2 frames coerentes de propósito — o ataque parece "travado" comparado ao walk.
- Não é bug de código; é lote de arte mismatched preservado no atlas.

**S3 — Clímax visual (CEO) fraco**

- Fundo do CEO (`bg-cobertura`) é skyline chapado ~40KB, no encontro mais importante. Contradiz o pico dramático da run.
- Sprite do CEO: idle/walk ok, mas sem beat de entrada visual (assinatura de mid-boss existe pros outros).

**S4 — Bosses reusando arte de inimigo comum**

- **Coordenador** e **Scrum** são inimigos comuns "inflados" via `BossPresence` (escala+aura+coroa). Leem como inimigo grande, não boss.
- **Brenda** reusa sprite de `rh`; **Diretor** reusa `evangelista-boss`. Máquina de estados é dela, mas o corpo é emprestado.

**S5 — Fundos intermediários (Fases 3/4/5) destoam**

- `bg-comercial`/`bg-tecnologia`/`bg-diretoria`/`bg-cobertura` são skylines chapados 32–42KB. Ficam ok isolados, mas a progressão visual **regride** ao sair da Fase 2 pintada. Paleta por bioma (`applyBiomePalette`) mitiga, não resolve.

**S6 — Especiais (K) sem FX próprio por classe**

- Estagiário/Analista/Terceirizado compartilham a mesma AoE visual. É o maior teto de "identidade" desperdiçado hoje.

## Plano de ação (ordem = ROI)

Cada bloco tem gatekeeper mensurável — não é "achismo".

### Passo 1 · Consertar o TETO de suavidade (S1) — código + revert

Objetivo: parar de "encher com blend" e restabelecer um baseline honesto.

1. Rodar `bun audit:anim --top=30 --json > /tmp/anim-top.json` — listar os 30 piores loop-pop/jerk.
2. Rodar `scripts/trim-filler.mjs` na lista, com dry-run primeiro; padded=67 → alvo padded ≤ 40.
3. Nas famílias onde trim ainda deixa loop-pop, **reverter** o último lote de in-betweens (voltar a 8 frames limpos > 16 fantasmas). Ferramentas: `git log --all -- public/assets/sprites/<prefix>-walk*` para achar o commit anterior; se não achar, o `check:frames` FLOOR permite reduzir (walk 8 é o piso oficial).
4. Rodar `bun audit:anim --update-baseline` e commitar `scripts/anim-baseline.json`. Ratchet trava o ganho.
5. Documentar as famílias reduzidas em `docs/ART_GAPS.md` como "aguardando arte autoral" (não é dívida, é honestidade).

**Gatekeeper:** loop-pop ≤ 40, padded ≤ 40, jerk ≤ 80 (queda de ~15–30% em cada). Se não bater, para e re-avalia.

### Passo 2 · Attack coerente (S2) — arte via IA guiada

Objetivo: os 6 inimigos ciclarem attack completo, não travado em 2 frames.

1. Para cada família mismatched, abrir LAB SPRITES → selecionar `<enemy>-attack2` → botão `🤖 REFAZER COM IA (GEMINI)`.
2. Passar como **vizinhos-referência** os frames coerentes de attack0/1 + idle0. HINT: "same character as reference frames, attack pose, no other character".
3. Aprovar 1 a 1 (comparação ANTES/DEPOIS/ANIMADO). O guardrail de paleta trava a coerência de cor; alinhamento dos pés trava a baseline.
4. Aprovado → override em runtime (não commit direto). Depois de N frames validados no jogo, promover via LAB.

**Gatekeeper:** `audit:palette` sem novos outliers; visual QA no LAB ANIMADO em 60fps sem "trocar de personagem".

### Passo 3 · Fundo do CEO (S3) — arte externa

Objetivo: elevar o clímax.

1. Gerar via `imagegen--generate_image` (premium, 1920×1024, prompt específico: "cobertura executiva à noite, luzes de sao paulo, vidro reflexivo, paleta vermelho tenso + âmbar frio, pintura digital estilo Dead Cells, sem personagens, sem texto"). Salvar em `/tmp` para review.
2. Se aprovado: converter p/ WebP q82, adicionar a `WEBP_BGS` em `BgOverrides`, gravar em `public/assets/bg-cobertura.webp`.
3. Beat de entrada do CEO: reusar `playBossEnrageMoment` como referência — implementar `playCeoEntranceBeat` com fade-in do fundo + travelling da câmera + tint vermelho crescente (2–3s).

**Gatekeeper:** review lado-a-lado com `bg-openspace` — mesma densidade visual.

### Passo 4 · Bosses com corpo próprio (S4) — arte via IA + arte autoral

Objetivo: Coordenador e Scrum lerem como boss (S3), Brenda e Diretor terem identidade.

1. **Coordenador (Post-it Manager)**: gerar 1 frame base novo (48×72, escala boss), estilo boss consistente com CEO. IA + guardrail.
2. **Scrum Master**: idem, com adereço de boss (coroa de post-its).
3. **Brenda (RH)**: reforçar sprite atual (recorte de cabelo, pasta) — arte pequena, dá pra fazer no LAB com refazer-frame.
4. **Diretor**: mais complexo — candidato a **Aseprite autoral** (ver `docs/ASEPRITE_PIPELINE.md`), não IA.
5. Para cada: 1 idle base + `gen-inbetweens` para walk (temporário, até arte autoral) + variação por afixo de Elite mantida.

**Gatekeeper:** `audit:palette` limpo; playtest de reconhecimento: um jogador novo entra na sala e sabe que é boss em <1s.

### Passo 5 · Fundos das Fases 3/4/5 (S5) — arte externa

- Mesmo pipeline do CEO (Passo 3), 3 imagens pintadas. Ordem: `bg-diretoria` → `bg-tecnologia` → `bg-comercial` (impacto narrativo decrescente).
- Manter os PNGs skyline como fallback (não deletar até promoção).

**Gatekeeper:** 3 WebPs no `WEBP_BGS`, boot < 300KB total para fundos, review lado-a-lado.

### Passo 6 · FX de especial por classe (S6) — código + partículas

Independente de arte nova. Reusar `Vfx.ts` catálogo:

- **Estagiário** — grito de socorro: onda de choque azul (`ringPulse` intenso) + partículas de nota de rodapé.
- **Analista** — planilha AoE: grid amarelo pulsante + números caindo.
- **Terceirizado** — boleto explosivo: papel voando + flash vermelho.

Cada um vira uma função em `Vfx.ts`, plugada em `Player.doSpecial()`. Testável via `LAB VFX`.

**Gatekeeper:** LAB VFX mostra 3 efeitos distintos; jogar 1 run por classe e sentir que o K é "meu".

## Detalhes técnicos (para reference)

- **Baseline anim atual**: `{jerk:93, loop-pop:62, dead:4, padded:67}` — todo passo do plano precisa provar redução via `bun audit:anim --update-baseline`.
- **Overrides de sprite** (IA) NÃO entram no atlas — vivem em Supabase Storage `sprite-overrides` + IndexedDB, aplicados em runtime pelo `SpriteOverrides.ts`. Só promover ao repo depois de aprovado em playtest.
- **Fundos**: `WEBP_BGS` em `BgOverrides.ts` é o registro; `bgUrl()` já é extension-aware. Adicionar entrada = arquivo ativa.
- **Ratchet**: `scripts/anim-baseline.json` é o contrato de não-regressão. Melhorou → `--update-baseline`. Piorou → CI reprova. Não editar à mão.
- **Ordem de risco**: Passos 1 e 6 são baixo risco (código puro). Passos 2/3/4/5 dependem de arte gerada — review manual obrigatório antes de promover.

## Entregável

Ao final: doc `/mnt/documents/auditoria-2d-plano.md` com os passos priorizados + snapshots do baseline anim (antes/depois de cada passo) + lista dos assets promovidos.

---

**Recomendação de execução**: começar pelo **Passo 1** (100% código, risco zero, ganho perceptível imediato) e **Passo 6** (independente, alto retorno de identidade). Passos 2–5 ficam para uma sessão dedicada de arte com você validando cada asset aprovado.
