import Phaser from "phaser";

// ─────────────────────────────────────────────────────────────────────────────
// Storytelling ambiental — post-its de flavor (piada corporativa BR) espalhados
// pelas fases. É o diferencial temático do jogo aparecendo NO MUNDO, não só nos
// NPCs. Puramente visual: não colidem, não afetam gameplay.
//
// - Deterministas por seed (mesma run → mesmos bilhetes/posições).
// - O texto fica ESCONDIDO até o player chegar perto (revela por proximidade),
//   pra não poluir a tela nem competir com o combate.
// - Um único timer por cena varre os bilhetes (leve). Zero acoplamento: a cena
//   só chama seedAmbientLore(...) uma vez e passa um getter de X do player.
// ─────────────────────────────────────────────────────────────────────────────

// Falas por fase (1 linha cada). Curtas, secas — humor de escritório CLT.
const LORE: Record<number, string[]> = {
  1: [
    "Reunião que podia ser e-mail.\nE-mail que virou reunião.",
    "Café acabou.\nA esperança também.",
    '"Segue o baile."\nAnexo: 47 pendências.',
    "Clima organizacional:\nnublado, com chance de PIP.",
    "Quem marcou daily às 8h\ntem lugar reservado no inferno.",
  ],
  2: [
    "Sua ligação é muito importante.\nAguarde 40 minutos.",
    'Script: "entendo sua frustração."\nRepetir 200x por dia.',
    "Meta de NPS: 9.\nSalário: 1,2.",
    "Headset novo?\nSó quando o antigo virar pó.",
  ],
  3: [
    "Bateu a meta? Ótimo.\nA meta subiu.",
    '"Vende que nem água."\nA água é de graça.',
    'Comissão retida\npor "ajuste sistêmico".',
    "O CRM caiu.\nAs desculpas, não.",
  ],
  4: [
    "Funciona na minha máquina.\n¯\\_(ツ)_/¯",
    "Deploy na sexta, 17h59.\nCoragem ou demissão?",
    '"Só um hotfix rapidinho."\n(três dias depois...)',
    "A senha expira a cada 30 dias.\nA sanidade também.",
  ],
  5: [
    "Sinergia, disrupção\ne outras palavras caras.",
    "Corte de custos:\ncomeça pela sua cadeira.",
    '"Somos uma família."\nFamília que demite no Q3.',
    "Bônus do CEO =\nfolha inteira do andar.",
  ],
};

// Cores de post-it (papelzinho) — variadas p/ não ficar monótono.
const NOTE_COLORS = [0xf6e05e, 0xf9a8d4, 0x93c5fd, 0xa7f3d0];

type Note = {
  x: number;
  bubble: Phaser.GameObjects.Text;
  shown: boolean;
};

/**
 * Semeia os post-its de flavor da fase. Chamar 1x no create() da fase, depois do
 * fundo/decor. `playerX` devolve o X atual do player (a revelação é por proximidade).
 */
export function seedAmbientLore(
  scene: Phaser.Scene,
  phase: number,
  floorY: number,
  levelWidth: number,
  seed: string,
  playerX: () => number,
): void {
  const pool = LORE[phase] ?? LORE[1];
  if (!pool.length) return;
  const rng = new Phaser.Math.RandomDataGenerator([`lore-${seed}-${phase}`]);
  const picks = rng.shuffle([...pool]).slice(0, Math.min(4, pool.length));

  const notes: Note[] = [];
  // Distribui ao longo do miolo do nível (evita o spawn à esquerda e o boss à
  // direita): faixas iguais, com jitter determinístico por bilhete.
  const usableStart = levelWidth * 0.22;
  const usableEnd = levelWidth * 0.86;
  const span = (usableEnd - usableStart) / picks.length;

  picks.forEach((text, i) => {
    const x = Math.round(usableStart + span * i + rng.between(0, span * 0.6));
    const y = floorY - rng.between(118, 196); // na parede, acima do chão

    // Post-it: papelzinho com dobra no canto. Depth baixo (atrás do gameplay).
    const w = 16;
    const color = NOTE_COLORS[i % NOTE_COLORS.length];
    const g = scene.add.graphics().setDepth(2);
    g.fillStyle(0x000000, 0.25);
    g.fillRect(x - w / 2 + 1, y - w / 2 + 2, w, w); // sombra
    g.fillStyle(color, 0.92);
    g.fillRect(x - w / 2, y - w / 2, w, w);
    g.fillStyle(0x000000, 0.18);
    g.fillTriangle(x + w / 2 - 5, y + w / 2, x + w / 2, y + w / 2, x + w / 2, y + w / 2 - 5); // dobra
    // rabiscos de "texto" no papel (2-3 traços)
    g.lineStyle(1, 0x000000, 0.35);
    g.lineBetween(x - 5, y - 3, x + 5, y - 3);
    g.lineBetween(x - 5, y, x + 4, y);
    g.lineBetween(x - 5, y + 3, x + 2, y + 3);

    // Balão do texto (escondido até a proximidade).
    const bubble = scene.add
      .text(x, y - 20, text, {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#20160a",
        align: "center",
        backgroundColor: "#f6e8b0",
        padding: { x: 6, y: 4 },
        lineSpacing: 2,
      })
      .setOrigin(0.5, 1)
      .setDepth(600)
      .setAlpha(0)
      .setVisible(false);

    notes.push({ x, bubble, shown: false });
  });

  // Poll leve (160ms): revela o balão do bilhete mais próximo dentro do raio.
  const REVEAL = 96;
  const timer = scene.time.addEvent({
    delay: 160,
    loop: true,
    callback: () => {
      const px = playerX();
      for (const n of notes) {
        const near = Math.abs(px - n.x) < REVEAL;
        if (near && !n.shown) {
          n.shown = true;
          n.bubble.setVisible(true);
          scene.tweens.add({ targets: n.bubble, alpha: 1, duration: 180 });
        } else if (!near && n.shown) {
          n.shown = false;
          scene.tweens.add({
            targets: n.bubble,
            alpha: 0,
            duration: 220,
            onComplete: () => n.bubble.setVisible(false),
          });
        }
      }
    },
  });
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => timer.remove());
}
