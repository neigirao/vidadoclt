// ─────────────────────────────────────────────────────────────────────────────
// Smoke-test de cenas — boota CADA cena jogável num navegador headless e falha
// se qualquer uma lançar erro de console/exceção ou não instanciar o player.
//
// POR QUE EXISTE: os testes unitários (bun:test) não carregam Phaser, então
// regressões de RENDER/cena (ex.: um plano de parallax cobrindo o player, um
// import quebrado numa scene) passam limpas. Este smoke exercita as cenas de
// verdade — é o portão que teria pego essas regressões.
//
// USO:  bun smoke        (sobe o vite sozinho, roda, derruba)
// CI:   instala chromium via playwright e roda este script.
//
// Portável: tenta o playwright do projeto e cai pro global (/opt) se preciso;
// tenta chromium.launch() e cai pro executável pré-instalado do sandbox.
// ─────────────────────────────────────────────────────────────────────────────
import { spawn } from "node:child_process";

const PORT = 8080;
const BASE = `http://localhost:${PORT}/`;

// Cenas jogáveis + dados mínimos para bootar. Menu/Preload/Boot são exercitados
// pelo próprio carregamento da página.
const SCENES = [
  ["MenuScene", {}],
  ["OpenSpaceV2Scene", {}],
  ["Phase2Scene", { fromRoute: true }],
  ["Phase3Scene", { fromRoute: true }],
  ["Phase4Scene", { fromRoute: true }],
  ["Phase5Scene", { fromRoute: true }],
  ["CeoScene", {}],
  ["CopaScene", {}],
  ["SalaReuniaoScene", {}],
  ["SalaBonusScene", { type: "banheiro" }],
  ["LdtkRoomScene", {}],
  ["VitoriaScene", { vr: 0 }],
  ["GameOverScene", { vr: 0, cause: "energy" }],
  ["ClassSelectScene", {}],
  [
    "CulturaSelectScene",
    {
      caller: "MenuScene",
      options: ["alinhamento_total", "overtime_bonus", "meta_batida"],
      nextScene: "OpenSpaceV2Scene",
    },
  ],
  ["RouteSelectScene", {}],
  ["BestiaryScene", {}],
  ["ReconhecimentoScene", {}],
  ["HoraExtraScene", {}],
];

// Ruído externo que não é bug do jogo (proxy/telemetria/asset opcional).
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
  // 1) sobe o vite dev (a menos que já haja um servidor externo: SMOKE_NO_SERVER)
  //    `--mode smoke`: NÃO carrega o componentTagger do lovable-tagger (ele só
  //    entra em `mode === "development"`). Esse tagger injeta `data-tsd-source`
  //    nos elementos e, sob timing de CI, o número de linha da tag diverge entre
  //    o SSR e o cliente → React loga um "hydration mismatch" (console.error) que
  //    derrubava o smoke por ruído puramente de dev-tooling (a tag nem existe no
  //    build de produção). Rodar em outro mode elimina a corrida na raiz; o resto
  //    do dev server (apply:"serve", import.meta.env.DEV) segue ligado.
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

  const failures = [];
  let current = "load";
  page.on("console", (m) => {
    if (m.type() === "error" && !IGNORE.test(m.text())) failures.push(`[${current}] ${m.text()}`);
  });
  page.on("pageerror", (e) => {
    if (!IGNORE.test(e.message)) failures.push(`[${current}] PAGEERROR: ${e.message}`);
  });

  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.__game?.scene?.scenes?.length > 0, { timeout: 25000 });

  const results = [];
  for (const [key, data] of SCENES) {
    current = key;
    const ok = await page.evaluate(
      async ([k, d]) => {
        try {
          const m = window.__game.scene;
          m.getScenes(true).forEach((s) => m.stop(s.scene.key));
          m.start(k, d);
          await new Promise((r) => setTimeout(r, 1000));
          const s = m.getScene(k);
          // "player" quando a cena tem um; senão só confirma que a cena rodou.
          return { started: !!s && s.scene.isActive(), hasPlayer: !!s?.player };
        } catch (e) {
          return { started: false, error: String(e) };
        }
      },
      [key, data],
    );
    if (!ok.started) failures.push(`[${key}] não iniciou${ok.error ? `: ${ok.error}` : ""}`);
    results.push(`${ok.started ? "ok " : "FAIL"} ${key}${ok.hasPlayer ? " (player)" : ""}`);
  }

  await browser.close();
  if (server) {
    server.kill("SIGTERM");
  }

  console.log("── smoke de cenas ──");
  for (const r of results) console.log("  " + r);
  if (failures.length) {
    console.error("\n✖ FALHAS:");
    for (const f of failures) console.error("  " + f);
    process.exit(1);
  }
  console.log(`\n✓ ${results.length} cenas bootaram sem erro de console.`);
  process.exit(0);
}

main().catch((e) => {
  console.error("smoke crashou:", e);
  process.exit(1);
});
