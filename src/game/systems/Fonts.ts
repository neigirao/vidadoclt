/**
 * Identidade tipográfica (Sprint 1 — Auditoria).
 *
 * O jogo é pixel-art de sátira corporativa. Antes: TUDO em `monospace` do
 * sistema (sem cara). Agora:
 *   - `display`  → "Press Start 2P" (títulos chunky, retro-arcade — casa com a
 *                  linguagem pixel do combate/HUD e vende a identidade)
 *   - `body`     → "VT323" (terminal retro — legível em corpo pequeno, textura
 *                  de tela CRT, se encaixa com o clima escritório/monitor)
 *   - `mono`     → "monospace" do sistema — MANTIDO para NÚMEROS de HUD
 *                  (energia/sanidade/VR): fontes de terminal são estáveis em
 *                  contagens rápidas e não pulam largura.
 *
 * Fontes carregadas via `<link>` em `src/routes/__root.tsx` (TanStack Start
 * exige — Tailwind v4 não @import remoto). Fallback pra monospace garante que
 * a tela nunca fica em branco se a rede falha.
 */
export const Fonts = {
  display: '"Press Start 2P", "Courier New", monospace',
  body: '"VT323", "Courier New", monospace',
  mono: "monospace",
} as const;
