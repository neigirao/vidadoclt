import Phaser from "phaser";
import { GAME_WIDTH } from "../constants";

/**
 * TutorialPrompts — dicas contextuais de 1 linha para a PRIMEIRA sessão.
 *
 * Legenda os SISTEMAS do jogo no momento em que aparecem (não só os controles):
 * VR = moeda, Sanidade = Burnout, marcadores de ameaça, Copa, e o loop
 * roguelite na 1ª morte. Cada dica aparece 1× para sempre (flag em localStorage)
 * — some no minuto em que o jogador aprende. Zero impacto em gameplay.
 *
 * Uso: `TutorialPrompts.maybeShow(scene, "vr", "VR é sua moeda...")` no gatilho.
 */
const LS_KEY = "vidaclt:tut";

function seenSet(): Set<string> {
  if (typeof localStorage === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(LS_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function markSeen(id: string) {
  if (typeof localStorage === "undefined") return;
  try {
    const s = seenSet();
    s.add(id);
    localStorage.setItem(LS_KEY, JSON.stringify([...s]));
  } catch {
    /* storage indisponível — ignora */
  }
}

// Fila por cena: se duas dicas disparam juntas, a 2ª espera a 1ª sumir.
type QueueItem = { id: string; text: string };
const _queues = new WeakMap<Phaser.Scene, QueueItem[]>();
const _showing = new WeakSet<Phaser.Scene>();

const SHOW_MS = 4500;

function render(scene: Phaser.Scene, item: QueueItem) {
  _showing.add(scene);
  const y = 96;
  const bg = scene.add
    .rectangle(
      GAME_WIDTH / 2,
      y,
      Math.min(GAME_WIDTH - 40, item.text.length * 8 + 48),
      34,
      0x0d1018,
      0.92,
    )
    .setStrokeStyle(1, 0xf2a800, 0.8)
    .setScrollFactor(0)
    .setDepth(1200);
  const label = scene.add
    .text(GAME_WIDTH / 2, y, `💡 ${item.text}`, {
      fontFamily: "monospace",
      fontSize: "12px",
      color: "#ffe0a0",
      align: "center",
      wordWrap: { width: GAME_WIDTH - 70 },
    })
    .setOrigin(0.5)
    .setScrollFactor(0)
    .setDepth(1201);

  const dismiss = () => {
    if (!bg.active) return;
    scene.tweens.add({
      targets: [bg, label],
      alpha: 0,
      duration: 350,
      onComplete: () => {
        bg.destroy();
        label.destroy();
        _showing.delete(scene);
        next(scene); // puxa a próxima da fila
      },
    });
  };

  scene.time.delayedCall(SHOW_MS, dismiss);
  scene.input.keyboard?.once("keydown", dismiss);
}

function next(scene: Phaser.Scene) {
  if (_showing.has(scene)) return;
  const q = _queues.get(scene);
  if (!q || q.length === 0) return;
  render(scene, q.shift()!);
}

export const TutorialPrompts = {
  /** Enfileira a dica `id` se ela nunca foi vista. */
  maybeShow(scene: Phaser.Scene, id: string, text: string) {
    if (typeof window === "undefined") return;
    if (seenSet().has(id)) return;
    markSeen(id);
    const q = _queues.get(scene) ?? [];
    q.push({ id, text });
    _queues.set(scene, q);
    next(scene);
  },

  /** Zera todas as flags (útil para testar a 1ª sessão de novo). */
  reset() {
    if (typeof localStorage !== "undefined") localStorage.removeItem(LS_KEY);
  },

  /** True se a dica já foi vista (para gatilhos que precisam checar antes). */
  seen(id: string) {
    return seenSet().has(id);
  },
};
