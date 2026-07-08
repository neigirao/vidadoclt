# Roteiro de Playtest — A Vida do CLT

Guia para rodar sessões de teste com jogadores reais e transformar o que você
observa em decisões de design. Combina **observação qualitativa** (o que a
pessoa sente/faz) com a **telemetria** já embutida (`window.__telemetry`).

> Meta das sessões: descobrir onde o jogo **trava, confunde, entedia ou
> frustra** — não confirmar que está bom. Vá atrás dos problemas.

---

## 0. Antes de começar

- **Amostra:** mire 8–15 pessoas para achar padrões (5 já revelam os problemas
  grandes; ~15 dá confiança). Misture perfis: quem joga roguelite (Hades/Dead
  Cells) e quem não joga quase nada.
- **Ambiente:** deixe a pessoa jogar sozinha, do jeito dela. Não explique nada
  além de "é um roguelite, seu objetivo é escapar às 18h".
- **Grave a tela + áudio** (com permissão) e/ou anote ao vivo.
- **Sessão:** 20–30 min de jogo + 5–10 min de conversa no fim.

### Coleta de dados (telemetria)

Ao final de cada sessão, no console do navegador (modo dev):

```js
window.__telemetry.summary(); // resumo agregado
window.__telemetry.exportJSON(); // copie e salve por tester (ex.: tester03.json)
window.__telemetry.clear(); // limpe antes do próximo tester
```

Guarde um JSON por pessoa → depois some tudo para ver os padrões.

---

## 1. Regra de ouro: NÃO ajude

Quando a pessoa travar, **fique quieto e observe**. Cada "como eu faço isso?"
é um bug de UX/onboarding. Só intervenha se ela desistir de vez — e anote o
ponto exato.

Frases-gatilho para anotar (sinais de atrito):

- "O que eu faço agora?"
- "Como eu ataco/desvio?"
- "Por que eu morri?"
- "Isso é bug?"
- "Ahn?" / silêncio confuso olhando a tela

---

## 2. Checklist de observação por fase

### 🏢 Fase 1 — Open Space (onboarding implícito)

- [ ] Descobre andar/pular/atacar **sem instrução**? Em quanto tempo?
- [ ] Entende o **dash** (Shift)? Usa espontaneamente ou nunca?
- [ ] Percebe a barra de **Sanidade** separada da Energia? Sabe o que faz?
- [ ] Entende o **parry (Reclamar)**? (é o mais provável de passar batido)
- [ ] Lê os **eventos de sala** (SEXTOU, APAGÃO...)? Reage a eles?
- [ ] Coleta VR/💰 de propósito ou por acaso?
- [ ] A luta do **Gerente** (boss) é lida como "boss"? Telegrafa o ataque?

### ☕ Copa (o momento de decisão)

- [ ] Entende que é uma **loja**? Sabe como comprar (teclas 1–7)?
- [ ] **Hesita** na escolha (bom) ou compra tudo sem pensar (economia frouxa)?
- [ ] O que compra primeiro — cura, arma ou perk? _(telemetria: `purchases`)_
- [ ] Fala com os NPCs? Entende o Veterano?

### 🏭 Fases 2–5

- [ ] Onde **acelera** (fica fácil/tedioso) e onde **empaca** (pico de morte)?
- [ ] Consegue **ler as ameaças** no meio do caos (muitos inimigos + FX)?
- [ ] Os bosses (Coordenador/Sênior/Scrum) parecem **distintos** ou "mais do mesmo"?
- [ ] A escolha de **rota** (Comercial/Atendimento, Produto/Tecnologia) parece
      importar, ou é ignorada?

### 💀 Morte / 🏆 Vitória

- [ ] A morte parece **justa** ("errei") ou **injusta** ("que sacanagem")?
- [ ] Entende **por que** morreu (burnout vs energia)?
- [ ] Ao morrer, quer **jogar de novo** na hora, ou fecha? _(sinal de retenção)_

---

## 3. Perguntas por sistema (pós-sessão)

Faça poucas e abertas. Deixe a pessoa falar.

**Diversão / retenção**

- Numa palavra, como foi? Você jogaria de novo? Por quê?
- Qual foi o momento mais divertido? E o mais frustrante?

**Combate**

- O combate parecia gostoso/responsivo? Alguma arma marcou?
- Você usou o parry (Reclamar)? Entendeu pra que serve?

**Sanidade / Burnout** _(o sistema mais ambicioso e menos validado)_

- Você percebeu a Sanidade? Ela te fez **jogar diferente**, ou só era uma 2ª
  barra de vida? _(se for "2ª barra", o sistema não está pagando o custo)_

**Economia / Copa**

- Na Copa, você sentiu que **teve que escolher**, ou deu pra comprar tudo?

**Onboarding**

- Teve algum momento em que você não sabia o que fazer? Qual?

**Dificuldade**

- Foi fácil, justo ou injusto? Onde ficou mais difícil?

---

## 4. 🚩 Red flags (se aparecerem, são prioridade)

| Sinal                                | O que provavelmente significa                    |
| ------------------------------------ | ------------------------------------------------ |
| Ninguém usa parry/dash               | Onboarding falha em ensinar mecânica central     |
| "2ª barra de vida" p/ Sanidade       | Sistema-âncora não gera decisão → repensar       |
| Compra tudo na Copa sem hesitar      | Economia ainda sem tensão → apertar mais         |
| Todos morrem na mesma fase           | Pico de dificuldade mal calibrado                |
| Fecha o jogo ao morrer (não re-joga) | Falta o "só mais uma run" → problema de retenção |
| "Isso é bug?" recorrente             | Feedback visual ambíguo naquele ponto            |

---

## 5. Lendo a telemetria (do número → à decisão)

Some os `summary()` de todos os testers e cruze com o que você observou:

| Campo            | Pergunta que responde                                | Ação se ruim                        |
| ---------------- | ---------------------------------------------------- | ----------------------------------- |
| `reachedPhase`   | Onde está o **funil**? Quantos % chegam a cada fase? | Queda brusca = paredão ali          |
| `deathsByScene`  | Qual fase mais **mata**?                             | Rebalancear a campeã de mortes      |
| `deathsByCause`  | Morrem de **burnout** ou **energia**?                | Muito burnout = drenagem punitiva   |
| `purchases`      | Compram **cura** e ignoram armas/perks?              | Reequilibrar preços/valor           |
| `quits`          | Onde **desistem** (fecham a aba)?                    | Investigar tédio/frustração ali     |
| `victories/runs` | Taxa de vitória                                      | <5% muito difícil; >40% muito fácil |

**A regra:** decisão de balanceamento só entra com **dado + observação**
concordando. Um sem o outro é chute.

---

## 6. Depois

1. Junte os JSONs → um `summary` agregado.
2. Liste os 3–5 problemas mais recorrentes (aparecem em vários testers **e** nos
   dados).
3. Priorize por frequência × severidade.
4. Itere → re-teste. Duas ou três voltas desse loop é o que leva GD/UX de B a A+.
