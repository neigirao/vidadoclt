# Auditoria de sprites — Corporate Escape (A Vida do CLT)

> Gerado por `node scripts/sprite-audit.mjs`. Não editar à mão — rodar o script.

Varre `public/assets/sprites/*.png` (a FONTE do atlas) e sinaliza defeitos de
qualidade que estragam a animação/leitura. Complementa `FRAME_COVERAGE.md` (que
só conta frames). Regras: vazio < 25 px opacos; chapado > 92% de 1 cor;
tamanho divergente na família; altura de conteúdo fora de ±25% da mediana.

- **Sprites analisados:** 1093
- **Com algum problema:** 80
- **Vazios:** 0 · **Chapados:** 0 · **Tamanho inconsistente:** 39 · **Altura outlier:** 50

> ⚠️ Nem todo flag é bug: frames de FX/impacto (ex.: `*-hurt2` explosão) podem ser
> "chapados"/"altura" legítimos, e famílias com frames idle/walk não-usados podem
> ter tamanho divergente sem afetar o jogo. Conferir no LAB SPRITES antes de mexer.

| Família | Frame | Problemas |
| --- | --- | --- |
| `boss-ceo-death` | `boss-ceo-death0` | altura 64 vs mediana 43 |
| `enemy-analista-attack` | `enemy-analista-attack0` | altura 31 vs mediana 58 |
| `enemy-analista-attack` | `enemy-analista-attack1` | altura 31 vs mediana 58 |
| `enemy-bateria-attack` | `enemy-bateria-attack0` | altura 44 vs mediana 21 |
| `enemy-bateria-attack` | `enemy-bateria-attack1` | altura 10 vs mediana 21 |
| `enemy-bateria-idle` | `enemy-bateria-idle0` | altura 44 vs mediana 25 |
| `enemy-bateria-idle` | `enemy-bateria-idle2` | altura 13 vs mediana 25 |
| `enemy-cabo-attack` | `enemy-cabo-attack0` | altura 27 vs mediana 41 |
| `enemy-cabo-attack` | `enemy-cabo-attack1` | altura 29 vs mediana 41 |
| `enemy-cabo-idle` | `enemy-cabo-idle1` | altura 43 vs mediana 31 |
| `enemy-coletor-attack` | `enemy-coletor-attack0` | altura 43 vs mediana 28 |
| `enemy-coletor-death` | `enemy-coletor-death0` | altura 43 vs mediana 29 |
| `enemy-coletor-death` | `enemy-coletor-death1` | altura 17 vs mediana 29 |
| `enemy-coord-boss-attack` | `enemy-coord-boss-attack1` | altura 39 vs mediana 58 |
| `enemy-coordenador-attack` | `enemy-coordenador-attack1` | altura 39 vs mediana 58 |
| `enemy-diretor-death` | `enemy-diretor-death1` | altura 44 vs mediana 60 |
| `enemy-diretor-death` | `enemy-diretor-death2` | altura 36 vs mediana 60 |
| `enemy-drone-attack` | `enemy-drone-attack0` | altura 14 vs mediana 20 |
| `enemy-estagiario-attack` | `enemy-estagiario-attack0` | tamanho 48x64 |
| `enemy-estagiario-attack` | `enemy-estagiario-attack1` | tamanho 48x64 · altura 61 vs mediana 41 |
| `enemy-estagiario-attack` | `enemy-estagiario-attack2` | tamanho 32x48 |
| `enemy-estagiario-attack` | `enemy-estagiario-attack3` | tamanho 32x48 |
| `enemy-evangelista-boss-death` | `enemy-evangelista-boss-death1` | altura 44 vs mediana 60 |
| `enemy-evangelista-boss-death` | `enemy-evangelista-boss-death2` | altura 36 vs mediana 60 |
| `enemy-evangelista-idle` | `enemy-evangelista-idle0` | tamanho 64x64 · altura 59 vs mediana 40 |
| `enemy-evangelista-idle` | `enemy-evangelista-idle1` | tamanho 64x64 |
| `enemy-evangelista-idle` | `enemy-evangelista-idle2` | tamanho 32x48 |
| `enemy-evangelista-idle` | `enemy-evangelista-idle3` | tamanho 32x48 |
| `enemy-evangelista-walk` | `enemy-evangelista-walk0` | tamanho 64x64 |
| `enemy-evangelista-walk` | `enemy-evangelista-walk1` | tamanho 64x64 · altura 60 vs mediana 43 |
| `enemy-evangelista-walk` | `enemy-evangelista-walk2` | tamanho 32x48 |
| `enemy-evangelista-walk` | `enemy-evangelista-walk3` | tamanho 32x48 |
| `enemy-facilitador-attack` | `enemy-facilitador-attack0` | tamanho 48x64 |
| `enemy-facilitador-attack` | `enemy-facilitador-attack1` | tamanho 48x64 |
| `enemy-facilitador-attack` | `enemy-facilitador-attack2` | tamanho 32x48 · altura 40 vs mediana 56 |
| `enemy-facilitador-attack` | `enemy-facilitador-attack3` | tamanho 32x48 · altura 40 vs mediana 56 |
| `enemy-gerente-death` | `enemy-gerente-death0` | altura 39 vs mediana 64 |
| `enemy-gerente-hurt` | `enemy-gerente-hurt2` | altura 39 vs mediana 63 |
| `enemy-impressora-attack` | `enemy-impressora-attack0` | tamanho 64x64 |
| `enemy-impressora-attack` | `enemy-impressora-attack1` | tamanho 64x64 |
| `enemy-impressora-attack` | `enemy-impressora-attack2` | tamanho 32x48 |
| `enemy-impressora-attack` | `enemy-impressora-attack3` | tamanho 32x48 |
| `enemy-impressora-c-walk` | `enemy-impressora-c-walk5` | altura 52 vs mediana 36 |
| `enemy-impressora-idle` | `enemy-impressora-idle0` | tamanho 64x64 |
| `enemy-impressora-idle` | `enemy-impressora-idle1` | tamanho 32x48 |
| `enemy-impressora-idle` | `enemy-impressora-idle2` | tamanho 32x48 |
| `enemy-impressora-idle` | `enemy-impressora-idle3` | tamanho 32x48 |
| `enemy-impressora-walk` | `enemy-impressora-walk5` | altura 25 vs mediana 34 |
| `enemy-noticeboard-attack` | `enemy-noticeboard-attack1` | altura 42 vs mediana 33 |
| `enemy-noticeboard-hurt` | `enemy-noticeboard-hurt1` | altura 29 vs mediana 42 |
| `enemy-noticeboard-walk` | `enemy-noticeboard-walk2` | altura 26 vs mediana 42 |
| `enemy-planilha-attack` | `enemy-planilha-attack1` | altura 14 vs mediana 23 |
| `enemy-seguranca-attack` | `enemy-seguranca-attack0` | tamanho 64x64 |
| `enemy-seguranca-attack` | `enemy-seguranca-attack1` | tamanho 64x64 |
| `enemy-seguranca-attack` | `enemy-seguranca-attack2` | tamanho 32x48 · altura 38 vs mediana 60 |
| `enemy-seguranca-attack` | `enemy-seguranca-attack3` | tamanho 32x48 · altura 38 vs mediana 60 |
| `enemy-seguranca-idle` | `enemy-seguranca-idle0` | tamanho 64x64 · altura 60 vs mediana 38 |
| `enemy-seguranca-idle` | `enemy-seguranca-idle1` | tamanho 32x48 |
| `enemy-seguranca-idle` | `enemy-seguranca-idle2` | tamanho 32x48 |
| `enemy-seguranca-idle` | `enemy-seguranca-idle3` | tamanho 32x48 |
| `enemy-telemarketer-death` | `enemy-telemarketer-death0` | altura 43 vs mediana 32 |
| `enemy-ti-suporte-death` | `enemy-ti-suporte-death2` | altura 24 vs mediana 34 |
| `enemy-ti-suporte-idle` | `enemy-ti-suporte-idle0` | tamanho 64x64 · altura 60 vs mediana 38 |
| `enemy-ti-suporte-idle` | `enemy-ti-suporte-idle1` | tamanho 32x48 |
| `enemy-ti-suporte-idle` | `enemy-ti-suporte-idle2` | tamanho 32x48 |
| `enemy-ti-suporte-idle` | `enemy-ti-suporte-idle3` | tamanho 32x48 |
| `item-cafe-cold` | `item-cafe-cold0` | altura 12 vs mediana 25 |
| `item-cafe-empty` | `item-cafe-empty1` | altura 25 vs mediana 16 |
| `item-cafe-empty` | `item-cafe-empty2` | altura 4 vs mediana 16 |
| `item-coffee-cup-broken` | `item-coffee-cup-broken0` | tamanho 40x48 |
| `item-coffee-cup-broken` | `item-coffee-cup-broken1` | tamanho 40x48 |
| `item-coffee-cup-broken` | `item-coffee-cup-broken2` | tamanho 32x40 |
| `item-email-idle` | `item-email-idle0` | altura 20 vs mediana 27 |
| `item-email-idle` | `item-email-idle1` | altura 20 vs mediana 27 |
| `npc-faxineiro-hurt` | `npc-faxineiro-hurt0` | altura 24 vs mediana 35 |
| `npc-faxineiro-walk` | `npc-faxineiro-walk0` | altura 24 vs mediana 35 |
| `prop-fase2-` | `prop-fase2-00` | altura 21 vs mediana 40 |
| `prop-fase2-` | `prop-fase2-04` | altura 62 vs mediana 40 |
| `prop-fase4-` | `prop-fase4-00` | altura 20 vs mediana 36 |
| `prop-fase4-` | `prop-fase4-02` | altura 57 vs mediana 36 |
