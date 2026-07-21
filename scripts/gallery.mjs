// ─────────────────────────────────────────────────────────────────────────────
// Beauty Gallery — captura TODAS as cenas/fases num contact-sheet único para um
// "beauty pass" humano e review visual no PR.
//
// POR QUE EXISTE: o `bun visual` só cobre cenas de UI ESTÁVEIS (baseline pixel);
// o `bun smoke` só checa erro de console. Nenhum dá uma VISÃO do jogo inteiro de
// uma vez — a foto que deixa "ver o feio" (fundo chapado, contraste ruim, sprite
// destoando) e priorizar polimento. Esta ferramenta boota cada cena em SEED FIXO,
// tira o screenshot e compõe uma folha de contato + um index.html.
//
// USO:
//   bun gallery                 → tests/gallery/contact-sheet.png + index.html
//   bun gallery --out=/tmp/g     → diretório de saída custom
//
// Determinístico por seed. Compõe a folha via HTML+screenshot do próprio
// Playwright (sem lib de compositing). Não é gate — é ferramenta de inspeção.
// ─────────────────────────────────────────────────────────────────────────────
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PORT = 8080;
const BASE = `http://localhost:${PORT}/`;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const outArg = process.argv.find((a) => a.startsWith("--out="));
const OUT = outArg ? outArg.split("=")[1] : join(ROOT, "tests", "gallery");
const SHOTS = join(OUT, "shots");
const SEED = "GALLERY-CLT"; // seed fixo p/ layout/encontros reproduzíveis

// Cenas a fotografar: foco em GAMEPLAY (onde mora a beleza) + telas-chave.
// `run` é setado antes do start (classe/seed) p/ as fases montarem o player.
const SCENES = [
  ["MenuScene", {}, "Menu principal"],
  ["OpenSpaceV2Scene", {}, "Fase 1 — Open Space"],
  ["Phase2Scene", { fromRoute: true }, "Fase 2 — Atendimento/Comercial"],
  ["Phase3Scene", { fromRoute: true }, "Fase 3 — Produto/Tecnologia"],
  ["Phase4Scene", { fromRoute: true }, "Fase 4 — TI/Servidores"],
  ["Phase5Scene", { fromRoute: true }, "Fase 5 — Diretoria"],
  ["CeoScene", {}, "CEO — Clímax (iluminado)"],
  ["CopaScene", {}, "Copa — área segura"],
  ["VitoriaScene", { vr: 120 }, "Vitória"],
];

// Ruído externo que não é bug do jogo.
const IGNORE = /tunnel|supabase|ERR_|net::|favicon|404|Failed to load resource|toLocaleString/i;

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
      if ((await fetch(BASE)).ok) return;
    } catch {
      /* subindo */
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error("servidor vite não respondeu a tempo");
}

async function main() {
  mkdirSync(SHOTS, { recursive: true });

  let server = null;
  if (!process.env.SMOKE_NO_SERVER) {
    server = spawn("bunx", ["vite", "dev", "--port", String(PORT), "--mode", "smoke"], {
      stdio: "ignore",
    });
  }
  await waitForServer();

  const chromium = await loadChromium();
  const browser = await launch(chromium);
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  page.on("console", (m) => {
    if (m.type() === "error" && !IGNORE.test(m.text())) console.warn(`  ⚠ console: ${m.text()}`);
  });

  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.__game?.scene?.scenes?.length > 0, { timeout: 25000 });
  await page.waitForFunction(() => document.fonts?.ready);

  const cells = [];
  for (const [key, data, label] of SCENES) {
    await page.evaluate(
      async ([k, d, seed]) => {
        const g = window.__game;
        // run mínimo p/ as fases montarem o player de forma reprodutível.
        const run = g.registry.get("run");
        if (run) {
          run.seed = seed;
          run.characterClass = run.characterClass ?? "analista";
          run.weaponId = run.weaponId ?? "grampeador";
          run.energy = run.energy ?? 100;
          run.sanity = run.sanity ?? 100;
          run.vr = run.vr ?? 25;
        }
        const m = g.scene;
        m.getScenes(true).forEach((s) => m.stop(s.scene.key));
        m.start(k, d);
        await new Promise((r) => setTimeout(r, 1800)); // deixa fundo/sprites/luz assentarem
        // Congela p/ um frame limpo (tweens/relógio/emissores parados).
        const s = m.getScene(k);
        if (s) {
          s.tweens?.pauseAll?.();
          if (s.time) s.time.paused = true;
          s.children?.list?.forEach((o) => {
            try {
              o.stop?.();
            } catch {
              /* nem todo objeto é emissor */
            }
          });
        }
      },
      [key, data, SEED],
    );
    await new Promise((r) => setTimeout(r, 150));
    const canvas = await page.$("canvas");
    const buf = await canvas.screenshot();
    writeFileSync(join(SHOTS, `${key}.png`), buf);
    cells.push({ key, label, dataUri: `data:image/png;base64,${buf.toString("base64")}` });
    console.log(`  ✓ ${key}`);
  }

  // Contact-sheet: HTML em grade → screenshot fullPage (sem lib de compositing).
  const cardsHtml = cells
    .map(
      (c) =>
        `<figure><img src="${c.dataUri}" width="480"/><figcaption>${c.label}<br><span>${c.key}</span></figcaption></figure>`,
    )
    .join("\n");
  const html = `<!doctype html><meta charset="utf-8"><style>
    body{margin:0;background:#0c0e14;color:#e8e8ef;font-family:system-ui,sans-serif;padding:24px}
    h1{font-size:20px;margin:0 0 4px}p{color:#8a8fa0;margin:0 0 20px;font-size:13px}
    .grid{display:grid;grid-template-columns:repeat(3,480px);gap:20px}
    figure{margin:0;background:#15171f;border:1px solid #262a38;border-radius:8px;overflow:hidden}
    img{display:block;width:480px;height:auto}
    figcaption{padding:8px 12px;font-size:14px;font-weight:600}
    figcaption span{color:#6b7180;font-weight:400;font-size:12px}
  </style>
  <h1>A Vida do CLT — Beauty Gallery</h1>
  <p>Seed ${SEED} · ${cells.length} cenas · gerado por <code>bun gallery</code></p>
  <div class="grid">${cardsHtml}</div>`;

  writeFileSync(join(OUT, "index.html"), html);
  const sheetPage = await browser.newPage({ viewport: { width: 1560, height: 800 } });
  await sheetPage.setContent(html, { waitUntil: "networkidle" });
  await sheetPage.screenshot({ path: join(OUT, "contact-sheet.png"), fullPage: true });

  await browser.close();
  if (server) server.kill("SIGTERM");

  console.log(`\n✓ Gallery gerada:`);
  console.log(`  ${join(OUT, "contact-sheet.png")}`);
  console.log(`  ${join(OUT, "index.html")}  (+ ${cells.length} shots em ${SHOTS})`);
  process.exit(0);
}

main().catch((e) => {
  console.error("gallery crashou:", e);
  process.exit(1);
});
