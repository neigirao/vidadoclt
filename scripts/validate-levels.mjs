// ─────────────────────────────────────────────────────────────────────────────
// Gate de NÍVEL — boota cada fase jogável num navegador headless, em VÁRIAS seeds
// (cobrindo todas as variantes de layout) e cada ROTA, e reprova se o
// `LevelValidator` marcar a fase como INJOGÁVEL/injusta (chão descontínuo,
// plataforma inalcançável por grafo de pulos, spawn inseguro, saída ausente…).
//
// POR QUE EXISTE: o `validateLevel` já roda em DEV no fim do `create()` de cada
// fase e loga PASS/FAIL — MAS só na tela, nunca no CI. Uma seed ruim podia gerar
// uma fase impossível de vencer e ninguém pegava sem jogar em DEV. Este é o
// portão que faltava entre "as cenas bootam" (smoke) e "as cenas são JOGÁVEIS".
// O `installLevelDebug` guarda o relatório em `scene.lastLevelReport`; aqui a
// gente lê e reprova.
//
// USO:  bun validate:levels     (sobe o vite sozinho, roda, derruba)
// CI:   instala chromium via playwright e roda este script (job smoke).
// ─────────────────────────────────────────────────────────────────────────────
import { spawn } from "node:child_process";

const PORT = 8081; // porta própria p/ poder rodar junto do smoke sem colidir
const BASE = `http://localhost:${PORT}/`;

// Seeds 0..5 cobrem TODAS as variantes: Fase 1 usa seedNum%4 (→ {0,1,2,3}) e as
// Fases 2–5 usam seedNum%3 (→ {0,1,2}). 6 seeds fecham os dois ciclos.
const SEEDS = ["0", "1", "2", "3", "4", "5"];

// Fase → variações de `run` a mesclar (cobre as rotas que divergem o layout).
const PHASES = [
  { key: "OpenSpaceV2Scene", variants: [{}] },
  { key: "Phase2Scene", variants: [{ route: "comercial" }, { route: "atendimento" }] },
  { key: "Phase3Scene", variants: [{ route2: "produto" }, { route2: "tecnologia" }] },
  { key: "Phase4Scene", variants: [{}] },
  { key: "Phase5Scene", variants: [{}] },
];

const IGNORE = /tunnel|supabase|ERR_|net::|favicon|404|Failed to load resource/i;

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
  if (!process.env.VALIDATE_NO_SERVER) {
    server = spawn("bunx", ["vite", "dev", "--port", String(PORT), "--mode", "smoke"], {
      stdio: "ignore",
      detached: false,
    });
  }
  await waitForServer();

  const chromium = await loadChromium();
  const browser = await launch(chromium);
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  page.on("pageerror", (e) => {
    if (!IGNORE.test(e.message)) console.error("  PAGEERROR:", e.message);
  });

  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.__game?.scene?.scenes?.length > 0, { timeout: 25000 });

  const results = [];
  const failures = [];

  for (const { key, variants } of PHASES) {
    for (const variant of variants) {
      for (const seed of SEEDS) {
        const rep = await page.evaluate(
          async ([k, seed, variant]) => {
            const g = window.__game;
            const run = g.registry.get("run") ?? {};
            Object.assign(run, {
              seed,
              loopCount: 0,
              characterClass: "analista",
              weaponId: "grampeador",
              energy: 100,
              sanity: 100,
              vr: 25,
              ...variant,
            });
            g.registry.set("run", run);
            const m = g.scene;
            m.getScenes(true).forEach((s) => m.stop(s.scene.key));
            m.start(k);
            await new Promise((r) => setTimeout(r, 900));
            const s = m.getScene(k);
            const lr = s?.lastLevelReport;
            if (!lr) return { missing: true };
            return {
              pass: lr.pass,
              errors: lr.checks
                .filter((c) => !c.ok && c.severity === "error")
                .map((c) => `${c.name}: ${c.detail}`),
            };
          },
          [key, seed, variant],
        );

        const tag = `${key}[seed=${seed}${Object.keys(variant).length ? " " + JSON.stringify(variant) : ""}]`;
        if (rep.missing) {
          failures.push(`${tag}: sem lastLevelReport (validador não rodou?)`);
          results.push(`FAIL ${tag} — sem relatório`);
        } else if (!rep.pass) {
          failures.push(`${tag}: ${rep.errors.join(" | ")}`);
          results.push(`FAIL ${tag} — ${rep.errors.join(" | ")}`);
        } else {
          results.push(`ok   ${tag}`);
        }
      }
    }
  }

  await browser.close();
  if (server) server.kill("SIGTERM");

  console.log("── gate de nível (LevelValidator headless) ──");
  for (const r of results) console.log("  " + r);
  if (failures.length) {
    console.error(`\n✖ ${failures.length} configuração(ões) de nível INJOGÁVEL:`);
    for (const f of failures) console.error("  " + f);
    process.exit(1);
  }
  console.log(`\n✓ ${results.length} configurações de nível (fase × seed × rota) válidas.`);
  process.exit(0);
}

main().catch((e) => {
  console.error("validate-levels crashou:", e);
  process.exit(1);
});
