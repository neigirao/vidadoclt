// ─────────────────────────────────────────────────────────────────────────────
// GATE de qualidade VISUAL de sprites (canvas) — roda o `runFullAudit()` do
// SpriteLabScene num navegador headless e falha se houver defeito MECÂNICO.
//
// POR QUE EXISTE: o `check:frames` garante QUANTIDADE e coerência de contagem,
// e agora TAMANHO de canvas, mas é cego para o CONTEÚDO do pixel — frame vazio,
// chapado (lixo de extração), ou que o LAB esconde mas o jogo cicla. Só o audit
// por canvas do LAB pega isso. Este script sobe o jogo, chama runFullAudit() e
// transforma o resultado num portão de CI.
//
// POLÍTICA (espelha o FLOORS/EXCEPTIONS do check:frames):
//  - HARD-FAIL nos defeitos MECÂNICOS e inequívocos: `missing`, `quase-vazio`,
//    `chapado`, `LAB<jogo`. São objetivamente bugs (frame ausente/vazio/lixo, ou
//    o jogo ciclando mais do que o LAB mostra).
//  - WARNING (não falha) em `altura … (pulo de tamanho)`: é ambíguo — muitas
//    poses legítimas (agachar no ataque, colapsar na morte, frame de FX) disparam.
//    Reportado p/ inspeção, mas não reprova o CI. (O tamanho de CANVAS entre
//    estados JÁ é hard-gated no check:frames.)
//
// USO:  bun run audit:sprites   (sobe o vite sozinho, roda, derruba)
// CI:   passo no job `smoke` (reusa o Chromium já instalado).
// ─────────────────────────────────────────────────────────────────────────────
import { spawn } from "node:child_process";

const PORT = 8080;
const BASE = `http://localhost:${PORT}/`;
// Issues que REPROVAM (mecânicos). O resto (altura) é warning.
const HARD = /^(missing|quase-vazio|chapado|LAB<jogo)/;

async function loadChromium() {
  try {
    return (await import("playwright")).chromium;
  } catch {
    const mod = await import("/opt/node22/lib/node_modules/playwright/index.js");
    return (mod.default ?? mod).chromium;
  }
}
async function launch(chromium) {
  try {
    return await chromium.launch();
  } catch {
    return await chromium.launch({
      executablePath: process.env.PW_CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    });
  }
}
async function waitForServer(timeoutMs = 40000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try {
      const r = await fetch(BASE);
      if (r.ok) return;
    } catch {
      /* ainda subindo */
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error("servidor vite não respondeu a tempo");
}

async function main() {
  let server = null;
  if (!process.env.SMOKE_NO_SERVER) {
    server = spawn("bunx", ["vite", "dev", "--port", String(PORT), "--mode", "smoke"], {
      stdio: "ignore",
      detached: false,
    });
  }
  await waitForServer();

  const chromium = await loadChromium();
  const browser = await launch(chromium);
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.__game?.scene?.scenes?.length > 0, { timeout: 25000 });

  const rep = await page.evaluate(async () => {
    const m = window.__game.scene;
    m.start("SpriteLabScene");
    await new Promise((r) => setTimeout(r, 2500));
    const scn = m.getScene("SpriteLabScene");
    if (!scn || typeof scn.runFullAudit !== "function")
      return { err: "SpriteLabScene/runFullAudit indisponível" };
    return scn.runFullAudit();
  });

  await browser.close();
  if (server) server.kill("SIGTERM");

  if (rep.err) {
    console.error("❌ audit-sprites:", rep.err);
    process.exit(1);
  }

  const bad = rep.bad ?? [];
  const hard = bad.filter((b) => HARD.test(String(b.issue)));
  const soft = bad.filter((b) => !HARD.test(String(b.issue)));

  console.log(`[audit-sprites] ${rep.subjects} sujeitos, ${rep.frames} frames varridos.`);
  if (soft.length) {
    console.warn(`⚠ ${soft.length} aviso(s) de altura (pose/FX legítimos não reprovam):`);
    for (const b of soft) console.warn(`   · ${b.subj}/${b.state}#${b.frame ?? "-"}: ${b.issue}`);
  }
  if (hard.length) {
    console.error(`❌ audit-sprites: ${hard.length} defeito(s) MECÂNICO(s):`);
    for (const b of hard)
      console.error(
        `   · ${b.subj}/${b.state}#${b.frame ?? "-"} (${b.atlasFrame ?? b.key ?? "?"}): ${b.issue}`,
      );
    console.error("");
    console.error(
      "Conserte no LAB SPRITES (🔧 CONSERTAR SEGUROS / COPIAR VIZINHO) ou re-fatie do source.",
    );
    process.exit(1);
  }
  console.log(
    `✅ audit-sprites: 0 defeitos mecânicos${soft.length ? ` (${soft.length} aviso de altura)` : ""}.`,
  );
  process.exit(0);
}

main().catch((e) => {
  console.error("audit-sprites falhou:", e);
  process.exit(1);
});
