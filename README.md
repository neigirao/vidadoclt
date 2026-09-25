# A Vida do CLT

Jogo 2D de ação e progressão roguelite: você só queria sair do trabalho às 18h. Enfrente o expediente, escolha seu caminho entre departamentos e sobreviva aos próximos loops. Este repositório contém o jogo, os testes e as ferramentas de arte e de playtest.

## Estado

Protótipo jogável em desenvolvimento. O menu inclui ferramentas de teste no modo de desenvolvimento; conteúdo, equilíbrio e arte ainda podem mudar. Não há link público de distribuição confirmado neste README.

## Rodar localmente

Requer [Bun](https://bun.sh/) (a CI usa Bun 1.3.11). Na raiz do repositório:

```sh
bun install
bun run dev
```

Abra o endereço local exibido pelo Vite. Para testar o build de produção:

```sh
bun run build
bun run preview
```

## Testes e qualidade

```sh
bun run lint
bun run typecheck
bun run test
bun run smoke
bun run visual
```

A CI executa verificações, smoke e regressão visual. Para atualizar baselines visuais de propósito, inspecione as imagens antes de usar `bun run visual:update`. Há também `bun run validate:levels`, `bun run check:frames` e `bun run audit:sprites` para níveis e sprites.

## Stack e organização

- TypeScript, React e TanStack Start/Vite para a aplicação web; Phaser para as cenas e o jogo.
- `src/game/` contém cenas, entidades, sistemas e testes; `src/routes/` contém as rotas web.
- `public/assets/` contém os recursos visuais; `scripts/` contém ferramentas de build e auditoria; `supabase/migrations/` guarda o histórico de migrações.

A telemetria de playtest permanece no navegador (`localStorage`/memória) e pode ser exportada manualmente. Não é enviada ao banco de outro projeto. Veja [PLAYTEST.md](PLAYTEST.md) e [docs/TELEMETRIA.md](docs/TELEMETRIA.md) antes de coletar dados de testadores. O ranking usa Supabase; seu endpoint de escrita anônima ainda precisa de validação no servidor antes de ser tratado como confiável.

Licença: [MIT](LICENSE).
