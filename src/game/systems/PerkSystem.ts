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
  flavor: string;
  shopCost: number;
  icon: string;
};

export const PERKS: Record<PerkId, PerkDef> = {
  autonomia:          { id: "autonomia",          name: "Autonomia",             description: "Congelamentos e ralentamentos duram 50% menos.",       flavor: "Você não precisa de permissão pra sair cedo.",                   shopCost: 10, icon: "⚡" },
  hora_extra:         { id: "hora_extra",          name: "Hora Extra",            description: "+20% de dano em todos os ataques.",                    flavor: "Sem adicional. Como sempre.",                                    shopCost: 12, icon: "💢" },
  vale_transporte:    { id: "vale_transporte",     name: "Vale Transporte",       description: "+15% de velocidade de movimento.",                     flavor: "Só funciona de segunda a sexta, claro.",                         shopCost: 10, icon: "🚌" },
  seguro_de_vida:     { id: "seguro_de_vida",      name: "Seguro de Vida",        description: "Revive uma vez por run com 30 de Energia.",            flavor: "A franquia é a alma da sua autoestima.",                         shopCost: 18, icon: "❤️" },
  plr:                { id: "plr",                 name: "PLR",                   description: "Inimigos dropam 25% mais VR.",                         flavor: "Meta batida. Pagamento: parcialmente.",                          shopCost: 12, icon: "💰" },
  cafe_forte:         { id: "cafe_forte",          name: "Café Forte",            description: "Consumíveis de Energia e Sanidade curam 50% mais.",    flavor: "A torneira da copa vive entupida mas esse daí funciona.",        shopCost: 10, icon: "☕" },
  piso_de_vidro:      { id: "piso_de_vidro",       name: "Piso de Vidro",         description: "Permite um segundo pulo no ar.",                       flavor: "Voar é mais fácil que pedir aumento.",                           shopCost: 15, icon: "🪟" },
  sindrome_impostor:  { id: "sindrome_impostor",   name: "Síndrome do Impostor",  description: "Primeiro golpe de cada área causa +50% de dano.",      flavor: "Na dúvida, chega primeiro. Pergunte depois.",                    shopCost: 10, icon: "👤" },
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
      player.firstStrikeReady = true;
      break;
  }
}

export function reapplyAllPerks(player: Player, run: RunState) {
  for (const id of (run.perks ?? [])) {
    switch (id) {
      case "autonomia":       player.autonomia = true; break;
      case "hora_extra":      player.damageMult *= 1.2; break;
      case "vale_transporte": player.walkSpeed  *= 1.15; break;
      case "seguro_de_vida":  /* run.extraLives already persisted */ break;
      case "plr":             player.vrDropMult *= 1.25; break;
      case "cafe_forte":      run.cafeForte = true; break;
      case "piso_de_vidro":   player.doubleJump = true; break;
      case "sindrome_impostor": player.firstStrikeReady = true; break;
    }
  }
}
