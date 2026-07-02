import { Player } from "../entities/Player";
import type { RunState } from "./PlayerState";

export type CulturaId =
  | "alinhamento_total"
  | "overtime_bonus"
  | "meta_batida"
  | "gestao_burnout"
  | "happy_hour"
  | "daily_scrum"
  | "pdi_completo"
  | "banco_horas"
  | "feedback_semanal"
  | "refeicao_executiva"
  | "autonomia_total"
  | "plano_imediato";

export interface CulturaDef {
  id: CulturaId;
  name: string;
  description: string;
  icon: string;
}

export const CULTURAS: Record<CulturaId, CulturaDef> = {
  alinhamento_total: {
    id: "alinhamento_total",
    name: "Alinhamento Total",
    icon: ">>",
    description: "+20% velocidade de movimento.",
  },
  overtime_bonus: {
    id: "overtime_bonus",
    name: "Bonus de Overtime",
    icon: "$$",
    description: "+20% dano em todos os ataques.",
  },
  meta_batida: {
    id: "meta_batida",
    name: "Meta Batida",
    icon: "<>",
    description: "Inimigos dropam 50% mais VR.",
  },
  gestao_burnout: {
    id: "gestao_burnout",
    name: "Gestao de Burnout",
    icon: "~~",
    description: "Sanidade maxima +30.",
  },
  happy_hour: {
    id: "happy_hour",
    name: "Happy Hour",
    icon: "HH",
    description: "Energia maxima +25.",
  },
  daily_scrum: {
    id: "daily_scrum",
    name: "Daily Scrum",
    icon: "[]",
    description: "Cooldown do especial -40%.",
  },
  pdi_completo: {
    id: "pdi_completo",
    name: "PDI Completo",
    icon: "**",
    description: "Velocidade de ataque +25%.",
  },
  banco_horas: {
    id: "banco_horas",
    name: "Banco de Horas",
    icon: "++",
    description: "Uma vida extra.",
  },
  feedback_semanal: {
    id: "feedback_semanal",
    name: "Feedback Semanal",
    icon: "~~",
    description: "+25% alcance de ataque.",
  },
  refeicao_executiva: {
    id: "refeicao_executiva",
    name: "Refeicao Executiva",
    icon: "~~",
    description: "+20 Energia e +20 Sanidade maximas.",
  },
  autonomia_total: {
    id: "autonomia_total",
    name: "Autonomia Total",
    icon: "!!",
    description: "Congelamentos e ralentamentos duram 50% menos.",
  },
  plano_imediato: {
    id: "plano_imediato",
    name: "Plano Imediato",
    icon: "^^",
    description: "Energia maxima +40, Sanidade maxima -20.",
  },
};

export function reapplyAllCulturas(player: Player, run: RunState) {
  // Called AFTER reapplyAllPerks. Applies stat changes additively.
  for (const id of run.culturas ?? []) {
    switch (id as CulturaId) {
      case "alinhamento_total":
        player.walkSpeed *= 1.2;
        break;
      case "overtime_bonus":
        player.damageMult *= 1.2;
        break;
      case "meta_batida":
        player.vrDropMult *= 1.5;
        break;
      case "gestao_burnout":
        player.maxSanity += 30;
        break;
      case "happy_hour":
        player.maxEnergy += 25;
        break;
      case "daily_scrum":
        player.specialCooldown = Math.round(player.specialCooldown * 0.6);
        break;
      case "pdi_completo":
        player.attackIntervalMs = Math.round(player.attackIntervalMs * 0.75);
        break;
      // banco_horas is NOT applied here — only at selection time
      case "feedback_semanal":
        player.attackRange *= 1.25;
        break;
      case "refeicao_executiva":
        player.maxEnergy += 20;
        player.maxSanity += 20;
        break;
      case "autonomia_total":
        player.autonomia = true;
        break;
      case "plano_imediato":
        player.maxEnergy += 40;
        player.maxSanity -= 20;
        break;
    }
  }
}
