import { Player } from "../entities/Player";
import { RunState } from "./PlayerState";

export type PerkId =
  | "autonomia"
  | "hora_extra"
  | "vale_transporte"
  | "seguro_de_vida"
  | "plr"
  | "cafe_forte"
  | "piso_de_vidro"
  | "sindrome_impostor";

export type PerkDef = {
  id: PerkId;
  name: string;
  description: string;
  shopCost: number;
  icon: string;
};

export const PERKS: Record<PerkId, PerkDef> = {
  autonomia:          { id: "autonomia",          name: "Autonomia",             description: "Congelamentos e ralentamentos duram 50% menos.",       shopCost: 10, icon: "⚡" },
  hora_extra:         { id: "hora_extra",          name: "Hora Extra",            description: "+20% de dano em todos os ataques.",                    shopCost: 12, icon: "💢" },
  vale_transporte:    { id: "vale_transporte",     name: "Vale Transporte",       description: "+15% de velocidade de movimento.",                     shopCost: 10, icon: "🚌" },
  seguro_de_vida:     { id: "seguro_de_vida",      name: "Seguro de Vida",        description: "Revive uma vez por run com 30 de Energia.",            shopCost: 18, icon: "❤️" },
  plr:                { id: "plr",                 name: "PLR",                   description: "Inimigos dropam 25% mais VR.",                         shopCost: 12, icon: "💰" },
  cafe_forte:         { id: "cafe_forte",          name: "Café Forte",            description: "Consumíveis de Energia e Sanidade curam 50% mais.",    shopCost: 10, icon: "☕" },
  piso_de_vidro:      { id: "piso_de_vidro",       name: "Piso de Vidro",         description: "Permite um segundo pulo no ar.",                       shopCost: 15, icon: "🪟" },
  sindrome_impostor:  { id: "sindrome_impostor",   name: "Síndrome do Impostor",  description: "Inimigos só te detectam na metade do alcance normal.",  shopCost: 10, icon: "👤" },
};

export function applyPerk(id: PerkId, player: Player, run: RunState) {
  run.perks = [...(run.perks ?? [])];
  if (run.perks.includes(id)) return; // already have it
  run.perks.push(id);

  switch (id) {
    case "autonomia":
      player.autonomia = true;
      break;
    case "hora_extra":
      player.damageMult *= 1.2;
      break;
    case "vale_transporte":
      player.walkSpeed *= 1.15;
      break;
    case "seguro_de_vida":
      run.extraLives = (run.extraLives ?? 0) + 1;
      break;
    case "plr":
      player.vrDropMult *= 1.25;
      break;
    case "cafe_forte":
      run.cafeForte = true;
      break;
    case "piso_de_vidro":
      player.doubleJump = true;
      break;
    case "sindrome_impostor":
      player.aggroRadius = 100; // half of default 200
      break;
  }
}

export function reapplyAllPerks(player: Player, run: RunState) {
  // Reset to base then re-apply (called after revive/area transition)
  // Note: only re-apply perks that modify boolean/flag state
  for (const id of (run.perks ?? [])) {
    switch (id) {
      case "autonomia":       player.autonomia = true; break;
      case "hora_extra":      /* already in damageMult, don't stack */ break;
      case "vale_transporte": /* already in walkSpeed, don't stack */ break;
      case "seguro_de_vida":  /* handled by run.extraLives */ break;
      case "plr":             /* already in vrDropMult */ break;
      case "cafe_forte":      run.cafeForte = true; break;
      case "piso_de_vidro":   player.doubleJump = true; break;
      case "sindrome_impostor": player.aggroRadius = 100; break;
    }
  }
}
