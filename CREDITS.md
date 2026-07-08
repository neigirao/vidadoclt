# Créditos & Proveniência de Assets

Este documento acompanha o `LICENSE` (MIT) e detalha **o que é original do
projeto**, **o que é de terceiros**, e **o que tem proveniência incerta e
precisa de saneamento** antes de qualquer uso comercial ou distribuição sob a
licença MIT.

> ⚠️ **Leitura jurídica em uma frase:** o MIT só pode licenciar aquilo cujos
> direitos são do autor. Assets de origem incerta listados abaixo **não estão
> cobertos** pela licença deste repositório enquanto não forem substituídos por
> arte original/licenciada.

---

## 1. Trabalho original do projeto — coberto pelo MIT

- **Todo o código-fonte** (`src/`, `scripts/`) — TypeScript/React/Phaser.
- **Áudio 100% procedural** — `src/game/systems/AudioSystem.ts` (SFX) e
  `MusicSystem.ts` (trilha). Gerado por síntese Web Audio, sem arquivos.
- **Texturas geradas em runtime** — `TextureFactory.ts` (UI/objetos) e os
  fundos de escritório procedurais (`drawOffice`, ex.: `pxbg-openspace`).
- **Sprites procedurais de pixel-art** (desenhados em código, `gen-sprites.mjs`)
  — **29 arquivos**, autoria limpa:
  - Post-it: `item-postit-active{0,1,2}`
  - Café: `item-coffee-cup-active{0,1,2}`, `item-coffee-cup`
  - Moeda VR: `item-vr-coin`, `item-vr-coin-active{0,1,2}`
  - E-mail: `item-email-idle{0,1}`
  - Convite: `item-convite-accepted{0,1,2}`
  - Tiles: `tile-floor`, `tile-platform`
  - Fase 5: `enemy-carimbador`, `enemy-arquivo`, `enemy-bateria`
  - Fase 2: `enemy-guardiao-cafe` (+ `walk0..3`), `enemy-reuniao` (+ `idle0`)
  - `enemy-analista-novo-walk3`

Estes são reproduzíveis byte-a-byte por
`node scripts/gen-sprites.mjs && node scripts/pack-atlas.mjs`.

---

## 2. ⚠️ Assets de proveniência INCERTA — NÃO cobertos pelo MIT

Vieram de **extrações assistidas por IA** cujos direitos de origem não estão
comprovados. **Devem ser substituídos por arte original ou licenciada antes de
distribuição comercial / clearance jurídico.** O MIT deste repositório não os
saneia.

- **Sprites de personagem/inimigo/boss/objeto** empacotados no atlas
  (`public/assets/atlas.png` / `.json`) e suas fontes em
  `public/assets/sprites/*.png` — **~795 arquivos** (todos os PNGs menos os 29
  procedurais da seção 1). Inclui: player, estagiário, analista, sênior,
  coordenador, scrum, RH, facilitador, telemarketer, evangelista, TI-suporte,
  segurança, impressoras, e os bosses (Gerente, CEO), entre outros.
- **Backgrounds pintados** — `public/assets/bg-menu.png`,
  `bg-atendimento.png`, `bg-comercial.png`, `bg-tecnologia.png`,
  `bg-diretoria.png`, `bg-cobertura.png` (6 arquivos).

**Plano de saneamento recomendado:** substituir progressivamente por (a) arte
procedural no padrão de `gen-sprites.mjs`, ou (b) arte encomendada/licenciada
com cadeia de direitos documentada. A cada substituição, mover o item da
seção 2 para a seção 1.

---

## 3. Dependências de terceiros

Bibliotecas de código aberto sob suas próprias licenças (majoritariamente MIT).
Ver `package.json` para a lista completa e versões. Principais:

- **Phaser** (MIT) — engine de jogo
- **React**, **React DOM** (MIT)
- **TanStack** Start / Router / Query (MIT)
- **Radix UI**, **shadcn/ui**, **lucide-react**, **cmdk**, **vaul** (MIT)
- **Tailwind CSS** (MIT)
- **rot-js** (BSD-3-Clause) — ruído/geradores
- **seedrandom** (MIT) — RNG determinística
- **zod**, **react-hook-form**, **recharts**, **date-fns**, **sonner** (MIT)
- **@supabase/supabase-js** (MIT) — cliente do leaderboard

Cada dependência retém sua licença original; nada aqui a substitui.

---

## 4. Fontes & áudio

- **Fontes:** apenas `monospace`/system fonts do navegador — sem fonte
  embarcada de terceiros.
- **Áudio:** 100% sintetizado em runtime — sem samples/trilhas de terceiros.
