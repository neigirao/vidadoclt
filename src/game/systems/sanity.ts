// Faixas de Sanidade — lógica pura (sem Phaser), separada de PlayerState para
// ser testável em unidade. As penalidades de burnout derivam destas faixas
// (ver Player.getBurnoutMods).
export type SanityBand = "ok" | "stressed" | "anxious" | "burnout";

export function sanityBand(s: number): SanityBand {
  if (s > 74) return "ok";
  if (s > 49) return "stressed";
  if (s > 24) return "anxious";
  return "burnout";
}
