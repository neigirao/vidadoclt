import type { Player } from "../entities/Player";
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
  | "plano_imediato"
  | "padrao_clt";

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
    description: "+25% velocidade de movimento, mas -15% de alcance.",
  },
  overtime_bonus: {
    id: "overtime_bonus",
    name: "Bonus de Overtime",
    icon: "$$",
    description: "+30% dano causado, porem voce recebe +20% de dano.",
  },
  meta_batida: {
    id: "meta_batida",
    name: "Meta Batida",
    icon: "<>",
    description: "Inimigos dropam +60% VR, mas Energia maxima -20%.",
  },
  gestao_burnout: {
    id: "gestao_burnout",
    name: "Gestao de Burnout",
    icon: "~~",
    description: "Sanidade maxima +40, mas Energia maxima -10.",
  },
  happy_hour: {
    id: "happy_hour",
    name: "Happy Hour",
    icon: "HH",
    description: "Energia maxima +35, mas Sanidade maxima -10.",
  },
  daily_scrum: {
    id: "daily_scrum",
    name: "Daily Scrum",
    icon: "[]",
    description: "Cooldown do especial -50%, mas Sanidade maxima -20.",
  },
  pdi_completo: {
    id: "pdi_completo",
    name: "PDI Completo",
    icon: "**",
    description: "Velocidade de ataque +35%, mas -20% de dano por golpe.",
  },
  banco_horas: {
    id: "banco_horas",
    // Nome distinto do perk "Banco de Horas" (PerkSystem) — antes colidiam na UI
    // com efeitos diferentes (perk = +1 Energia/kill; esta Cultura = vida extra).
    name: "Estabilidade no Emprego",
    icon: "++",
    description: "Uma vida extra.",
  },
  feedback_semanal: {
    id: "feedback_semanal",
    name: "Feedback Semanal",
    icon: "~~",
    description: "+35% de alcance, mas -12% de velocidade de movimento.",
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
  // No-op: atribuída à primeira run (loopCount === 0) para pular a escolha de
  // Cultura sem fricção. Nunca aparece na roleta de seleção (ver
  // selectableCulturaIds) e não altera nenhum stat em reapplyAllCulturas.
  padrao_clt: {
    id: "padrao_clt",
    name: "Padrao CLT",
    icon: "==",
    description: "Sem modificadores. O regime padrao da CLT.",
  },
};

/**
 * Ids de Cultura oferecíveis na roleta de seleção — exclui `padrao_clt`, que é
 * o no-op reservado para a primeira run. Usado por ClassSelectScene e pelos
 * overlays pós-boss (BasePhaseScene/OpenSpaceV2/Phase5).
 */
export function selectableCulturaIds(): CulturaId[] {
  return (Object.keys(CULTURAS) as CulturaId[]).filter((id) => id !== "padrao_clt");
}

export function reapplyAllCulturas(player: Player, run: RunState) {
  // Called AFTER reapplyAllPerks. Applies stat changes additively.
  for (const id of run.culturas ?? []) {
    switch (id as CulturaId) {
      // ── Tradeoffs (decisão, não só número): cada um tem presa E custo, para o
      // pick (inclusive o pós-boss) virar uma escolha de COMO jogar, não só qual
      // stat inflar. Distingue-se do meta-shop (que é buff permanente puro).
      case "alinhamento_total": // mobilidade × alcance
        player.walkSpeed *= 1.25;
        player.attackRange *= 0.85;
        break;
      case "overtime_bonus": // glass cannon: bate mais forte, apanha mais
        player.damageMult *= 1.3;
        player.damageReductionMult *= 1.2;
        break;
      case "meta_batida": // ganância custa fôlego
        player.vrDropMult *= 1.6;
        player.maxEnergy = Math.round(player.maxEnergy * 0.8);
        break;
      case "gestao_burnout": // buffer mental à custa de fôlego
        player.maxSanity += 40;
        player.maxEnergy -= 10;
        break;
      case "happy_hour": // fôlego à custa de sanidade (espelho do gestao_burnout)
        player.maxEnergy += 35;
        player.maxSanity -= 10;
        break;
      case "daily_scrum": // spam de especial pesa na saúde mental
        player.specialCooldown = Math.round(player.specialCooldown * 0.5);
        player.maxSanity -= 20;
        break;
      case "pdi_completo": // cadência × peso (muda o feel do combo, DPS ~neutro)
        player.attackIntervalMs = Math.round(player.attackIntervalMs * 0.65);
        player.damageMult *= 0.8;
        break;
      // banco_horas is NOT applied here — only at selection time
      case "feedback_semanal": // alcance × mobilidade
        player.attackRange *= 1.35;
        player.walkSpeed *= 0.88;
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
      case "padrao_clt":
        // no-op: regime padrão, sem modificadores.
        break;
    }
  }
}
