
# Protótipo jogável — A Vida do CLT (Fase 1, Área 1)

Objetivo: ter algo jogável no navegador em uma única rota, com o "feel" do jogo. Sem arte final, sem meta-progressão — só o núcleo do Sprint 1 do GDD.

## O que entra neste protótipo

**Player controller**
- Andar (← →), pular (Espaço) com coyote time 0.1s
- Dash (Shift): 150ms de i-frames, cooldown 1.5s
- Ataque melee (J): combo de 3 hits, 3º hit aplica knockback ("grampeia")
- Vida (Energia) base 100, Sanidade base 100 (ainda sem efeitos visuais por faixa — só barra)
- Morte aos 0 de Energia → tela "Rescisão da tentativa" → botão para reiniciar

**Cenário — Área 1 (Estações de Trabalho)**
- Tilemap simples montado em código (plataformas como retângulos coloridos)
- Chão, 3-4 plataformas, "baias" decorativas
- Fundo cinza-corporativo, paleta sóbria (off-white, cinza, azul-petróleo, vermelho aviso)

**Inimigos (Sprint 1 do GDD)**
- Estagiário Desesperado: corre em linha reta, dano por contato, 1 hit kill
- Analista Júnior: anda devagar, ataque melee curto telegrafado, 3 hits para morrer

**HUD**
- Barra de Energia (vermelha)
- Barra de Sanidade (azul)
- Contador de VR (Vale Refeição)
- Relógio no canto: começa "18:00", avança devagar (cosmético)

**Coleta**
- Inimigo derrotado dropa VR (cubinho amarelo); encostar coleta e soma ao HUD

## O que NÃO entra (fica para próximos sprints)

- Áreas 2–4, Copa, Faxineiro, Ponto Eletrônico
- Chefe Gerente Microgestor
- Sistema de classes, perks, armas além do melee inicial
- Burnout com distorção de tela, sons fantasmas, input lag
- Cultura Corporativa, FGTS, Reconhecimento, NPCs, loja
- Áudio (placeholders silenciosos; SFX ficam para depois)

Esses ficam visíveis no plano como sprints futuros mas não são implementados agora.

## Arquitetura técnica

```text
src/
  routes/
    index.tsx              -> monta <GameMount /> em tela cheia (replace do placeholder)
  game/
    GameMount.tsx          -> componente React que cria/destrói o Phaser.Game
    config.ts              -> Phaser.Game config (960x540, scale FIT, arcade physics)
    scenes/
      BootScene.ts         -> gera texturas coloridas (rect) via Graphics → texture
      OpenSpaceScene.ts    -> Área 1: tilemap, player, inimigos, drops, HUD
      GameOverScene.ts     -> "Rescisão da tentativa" + botão reiniciar
    entities/
      Player.ts            -> movimento, pulo, dash, combo melee, vida/sanidade
      EstagiarioDesesperado.ts
      AnalistaJunior.ts
      VRDrop.ts
    systems/
      Hud.ts               -> barras + contador + relógio
      Combat.ts            -> hitboxes do combo, knockback, i-frames
```

- `bun add phaser` antes de criar os arquivos do jogo.
- `GameMount` usa `useEffect` para instanciar `new Phaser.Game(config)` apontando para um `<div ref>` e faz `game.destroy(true)` no cleanup. SSR-safe: monta só no client (`if (typeof window === 'undefined') return null`).
- Phaser fica 100% no cliente; nenhuma server function envolvida.
- Route `index.tsx` ganha `head()` com title "A Vida do CLT — Protótipo" e meta description curta.

## Detalhes de gameplay (números iniciais, fáceis de ajustar)

- Gravidade: 1200
- Velocidade andar: 200 px/s
- Pulo: velocidade -520 (~2.5 tiles), coyote 100ms, jump buffer 100ms
- Dash: 600 px/s por 150ms, i-frames durante, cooldown 1500ms
- Combo melee: janelas de 250ms entre hits; hit 1/2 dano 10, hit 3 dano 15 + knockback 200
- Estagiário Desesperado: 200 px/s, contato = 15 dano, 1 HP
- Analista Júnior: 80 px/s, telegraph 400ms antes do swing, swing dano 20, 3 HP

## Critério de "pronto"

- Abrir o preview → ver o cenário corporativo cinza e o player
- Andar/pular/dash/ataque funcionam com feedback (flash branco no hit, knockback)
- Matar inimigos derruba VR; HUD atualiza
- Tomar dano até 0 → tela de Game Over → reiniciar volta ao começo da área

## Próximos sprints (referência, não implementar agora)

1. Sprint 2 — Sanidade com faixas de efeito, Copa + Faxineiro, Ponto Eletrônico + loja básica
2. Sprint 3 — Áreas 2–4, armadilha Convite de Reunião, chefe Gerente Microgestor, perk Autonomia
3. Sprint 4 — Classes, armas, perks, Cultura Corporativa, ramificação 2A/2B, FGTS/burnout
4. Sprints seguintes — Fases 3–5, CEO, eventos aleatórios, áudio, acessibilidade

Posso aprovar e começar pelo Sprint 1 assim que você confirmar.
