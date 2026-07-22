# Bestiário — A Vida do CLT

> Gerado de `src/game/systems/EnemyCatalog.ts` (fonte única). Não editar à mão — re-gerar quando o catálogo mudar.
> **31 inimigos** + 6 chefes. Qualquer inimigo comum pode surgir **Elite** por seed (ver `EliteAffixes.ts`).

## Fase 1 — Open Space

| Inimigo | Arquétipo | HP | Contato | Ataque | VR | Descrição |
|---|---|---:|---:|---|---:|---|
| Estagiário Desesperado | rusher | 12 | 6 | lunge (15) | 1 | Foi contratado pela 'oportunidade'. Agora corre por café. |
| Analista em Onboarding | ranged | 18 | 0 | duvida_existencial (4) | 2 | Ainda no período de experiência. Mas já te manda dúvida no chat. |
| Facilitador de Workshop | support | 20 | 0 | — | 2 | Cobra dynamics até no horário de almoço. |
| Estagiário Sobrecarregado | rusher | 22 | 8 | — | 2 | Faz o trabalho de três. Recebe de zero. |
| Scrum Master Caótico | ranged | 25 | 9 | postit_throw (6) | 2 | Move o post-it sem perguntar. Joga o post-it em você. |
| Analista Júnior | ranged | 30 | 0 | email_storm (5) | 3 | Dispara e-mails em cópia oculta. Letais. |
| Coordenador de Sinergia | support | 40 | 10 | — | 4 | Convoca reunião sem pauta para drenar tua sanidade. |
| Analista de RH | charger | 55 | 10 | feedback_360 (12) | 3 | Quer 'bater um papo rápido na salinha'. |
| Analista Sênior Exausto | tank | 80 | 12 | slam_planilha (10) | 6 | Sustentou o time por 12 anos. Restam casca e Excel. |

**Chefe:** Gerente Microgestor

## Fase 2 — Atendimento / Comercial

| Inimigo | Arquétipo | HP | Contato | Ataque | VR | Descrição |
|---|---|---:|---:|---|---:|---|
| Telemarketer Zumbi | rusher | 160 | 12 | — | 2 | Repete o script desde 2008. Não respira. |
| Nuvem Board Sentinela | aerial | 250 | 0 | broadcast (8) | 3 | Anuncia metas impossíveis em alto-falante. |
| Guardião do Café | charger | 280 | 20 | hot_splash (18) | 4 | Defende a cafeteira como se fosse a última. |
| Reunião Corporativa | support | 320 | 0 | pauta_infinita (10) | 5 | Convocada sem pauta. Dura mais que o expediente. |
| Impressora Assombrada | tank | 400 | 8 | ink_burst (14) | 8 | Atola toner com olhos vermelhos. |

**Chefe:** Coordenador de Sinergia

## Fase 3 — Produto / Tecnologia

| Inimigo | Arquétipo | HP | Contato | Ataque | VR | Descrição |
|---|---|---:|---:|---|---:|---|
| Coletor de Dados | aerial | 150 | 0 | scrape (6) | 1 | Quer só 'mais alguns dados pra melhorar o serviço'. |
| Evangelista Corporativo | support | 224 | 8 | — | 3 | Posta no LinkedIn enquanto te ataca. |
| Planilha Viva | tank | 400 | 10 | vlookup (16) | 6 | 12.000 linhas. Sem cabeçalho. Está cheia de macros. |
| Brenda do RH | charger | 470 | 12 | pesquisa_de_clima (10), feedback_360 (12), dinamica_de_grupo (22) | 32 | Marca zonas de sorriso obrigatório e joga feedback que persegue. |
| Impressora Vermelha | tank | 480 | 12 | toner_burst (16) | 10 | Errou o cartucho. Imprime a raiva. |

**Chefe:** Brenda do RH ★ (mid-boss)

## Fase 4 — TI / Servidores

| Inimigo | Arquétipo | HP | Contato | Ataque | VR | Descrição |
|---|---|---:|---:|---|---:|---|
| Drone de Vigilância | aerial | 144 | 0 | laser (10) | 3 | Reporta seus minutos no banheiro à diretoria. |
| Cabo de Rede | rusher | 176 | 10 | — | 2 | Chicoteia quem ousar tropeçar. |
| Segurança Corporativa | charger | 280 | 10 | headlock (14) | 4 | Crachá vence em segundos. Você também. |
| TI Suporte | ranged | 300 | 12 | have_you_tried_restarting (12) | 3 | Pergunta se você reiniciou. Três vezes. |
| Evangelista Avançado | support | 400 | 12 | — | 6 | Palestrante motivacional com síndrome do impostor avançado. |
| Impressora Fantasma | tank | 460 | 15 | ghost_print (18) | 12 | Imprime documentos que ninguém pediu às 3h da manhã. |

**Chefe:** Scrum Master Caótico

## Fase 5 — Diretoria

| Inimigo | Arquétipo | HP | Contato | Ataque | VR | Descrição |
|---|---|---:|---:|---|---:|---|
| Bateria Social | support | 200 | 8 | drain (9) | 4 | Drena sua energia só de existir perto. |
| Carimbador Automático | tank | 256 | 8 | stamp (11) | 4 | Carimba 'INDEFERIDO' na sua testa. |
| Evangelista MegaCorp | support | 460 | 16 | — | 9 | Transcendeu o corporativo. É o corporativo agora. |
| Impressora Necromorfa | tank | 470 | 22 | paper_storm (24) | 16 | Mutação final. Alimentada por toner e ressentimento. |
| Arquivo Ambulante | tank | 500 | 14 | paper_avalanche (28) | 15 | Contém todos os RHs que vieram antes. |
| Diretor de Resultados | charger | 620 | 14 | meta_inalcancavel (18), reestruturacao (0), pdi_involuntario (26) | 40 | Ergue a meta até estourar e te reestrutura pra fora da posição. |

**Chefe:** Diretor de Resultados ★ (mid-boss)

## Clímax

**CEO — Milton Freitas da Cunha IV** (`CeoBoss`, cobertura) — chefe final.

## Elites (afixos)

Por seed, alguns comuns viram elite (aura + badge + recompensa maior). Chance escala com loop/Heat (teto 25%).

| Afixo | Badge | Efeito |
|---|---|---|
| Efetivado | 🛡️ | Blindado: +120% HP |
| Cafeinado | ⚡ | Frenético: +50% velocidade, +40% dano |
| Bonificado | 💰 | +18 VR bônus |
| Homologado | 🧨 | Explode ao morrer (AoE) |
| Sindicalizado | 🛡️ | Barreira: absorve 2 golpes |
