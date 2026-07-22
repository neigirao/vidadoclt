// ─────────────────────────────────────────────────────────────────────────────
// Gera docs/BESTIARIO.md a partir do EnemyCatalog (fonte única). Roda com bun.
// Uso: bun docs:bestiary  (re-gerar quando o catálogo mudar).
// ─────────────────────────────────────────────────────────────────────────────
import { writeFileSync } from "node:fs";
import { ENEMIES } from "../src/game/systems/EnemyCatalog.ts";

const BOSS = {
  1: "Gerente Microgestor",
  2: "Coordenador de Sinergia",
  3: "Brenda do RH ★ (mid-boss)",
  4: "Scrum Master Caótico",
  5: "Diretor de Resultados ★ (mid-boss)",
};
const NAMES = {
  1: "Open Space",
  2: "Atendimento / Comercial",
  3: "Produto / Tecnologia",
  4: "TI / Servidores",
  5: "Diretoria",
};

const byPhase = {};
for (const e of Object.values(ENEMIES)) (byPhase[e.phase] = byPhase[e.phase] || []).push(e);

let md = `# Bestiário — A Vida do CLT\n\n`;
md += `> Gerado de \`src/game/systems/EnemyCatalog.ts\` por \`bun docs:bestiary\` (fonte única).\n`;
md += `> Não editar à mão — re-gerar quando o catálogo mudar.\n`;
md += `> **${Object.keys(ENEMIES).length} inimigos** + 6 chefes. Qualquer comum pode surgir **Elite** por seed (\`EliteAffixes.ts\`).\n\n`;

for (const ph of [1, 2, 3, 4, 5]) {
  md += `## Fase ${ph} — ${NAMES[ph]}\n\n`;
  md += `| Inimigo | Arquétipo | HP | Contato | Ataque | VR | Descrição |\n|---|---|---:|---:|---|---:|---|\n`;
  for (const e of byPhase[ph].sort((a, b) => a.hp - b.hp)) {
    const atk = (e.attacks || []).map((a) => `${a.name} (${a.damage})`).join(", ") || "—";
    md += `| ${e.label} | ${e.archetype || "?"} | ${e.hp} | ${e.contactDamage || 0} | ${atk} | ${e.vrReward} | ${(e.description || "").replace(/\|/g, "/")} |\n`;
  }
  md += `\n**Chefe:** ${BOSS[ph]}\n\n`;
}

md += `## Clímax\n\n**CEO — Milton Freitas da Cunha IV** (\`CeoBoss\`, cobertura) — chefe final.\n\n`;
md += `## Elites (afixos)\n\n`;
md += `Por seed, alguns comuns viram elite (aura + badge + recompensa maior). Chance escala com loop/Heat (teto 25%).\n\n`;
md += `| Afixo | Badge | Efeito |\n|---|---|---|\n`;
md += `| Efetivado | 🛡️ | Blindado: +120% HP |\n`;
md += `| Cafeinado | ⚡ | Frenético: +50% velocidade, +40% dano |\n`;
md += `| Bonificado | 💰 | +18 VR bônus |\n`;
md += `| Homologado | 🧨 | Explode ao morrer (AoE) |\n`;
md += `| Sindicalizado | 🛡️ | Barreira: absorve 2 golpes |\n`;

writeFileSync(new URL("../docs/BESTIARIO.md", import.meta.url), md);
console.log(
  `docs/BESTIARIO.md escrito (${md.length} chars, ${Object.keys(ENEMIES).length} inimigos)`,
);
