// ─────────────────────────────────────────────────────────────────────────────
// Regressão VISUAL — captura screenshots das cenas de UI estáveis e compara
// pixel-a-pixel contra baselines commitados. Falha se a diferença exceder um
// limiar. Pega o que o `bun smoke` NÃO pega: a cena boota sem erro de console,
// mas a arte "sumiu"/desalinhou (fundo faltando, painel movido, botão escondido
// atrás de outro — exatamente a classe do bug do ENVIAR no LAB).
//
// USO:
//   bun visual            → compara contra os baselines (falha em regressão)
//   bun visual:update     → (re)grava os baselines (rodar de propósito quando a
//                           mudança visual é INTENCIONAL, e conferir o diff no PR)
//
// ESCOPO: só cenas de UI/menu ESTÁVEIS (sem combate/RNG/partícula pesada), onde
// o layout é determinístico. Cenas de gameplay têm animação/seed e dariam falso-
// positivo — essas seguem cobertas pelo `bun smoke` (erro de console) e pelos
// screenshots manuais no fluxo de review.
//
// Tolerância: limiar por-canal (ruído de AA/subpixel) + fração máx. de pixels
// divergentes (absorve timing de fonte/tween; um fundo faltando é >30%, então
// ainda pega a regressão real). Cross-ambiente (sandbox vs CI chromium) é o
// motivo do limiar generoso — o alvo é regressão GROSSA, não perfeição de pixel.
// ─────────────────────────────────────────────────────────────────────────────
import { spawn } from "node:child_process";
import { mkdirSync, existsSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";

const PORT = 8080;
const BASE = `http://localhost:${PORT}/`;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = join(ROOT, "tests", "visual");
const BASELINE = join(DIR, "baseline");
const CURRENT = join(DIR, "current");
const DIFF = join(DIR, "diff");

const UPDATE = process.argv.includes("--update");

// Limiares (ver cabeçalho). PER_CHANNEL: quão diferente um canal RGB pode estar
// antes de contar como "pixel divergente". MAX_FRAC: fração de pixels divergentes
// tolerada por cena.
const PER_CHANNEL = 40;
const MAX_FRAC = 0.04;

// Cenas de UI estáveis + dados mínimos. Determinísticas o bastante p/ baseline.
const SCENES = [
  ["MenuScene", {}],
  ["IntroScene", { nextScene: "OpenSpaceV2Scene" }],
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
  ["GameOverScene", { vr: 42, cause: "energy" }],
  ["VitoriaScene", { vr: 120 }],
];

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

// Diferença: retorna { frac, w, h, diffPng } ou { sizeMismatch:true }.
function compare(baseBuf, curBuf) {
  const a = PNG.sync.read(baseBuf);
  const b = PNG.sync.read(curBuf);
  if (a.width !== b.width || a.height !== b.height) {
    return { sizeMismatch: true, a: `${a.width}x${a.height}`, b: `${b.width}x${b.height}` };
  }
  const diff = new PNG({ width: a.width, height: a.height });
  let bad = 0;
  const n = a.width * a.height;
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    const dr = Math.abs(a.data[o] - b.data[o]);
    const dg = Math.abs(a.data[o + 1] - b.data[o + 1]);
    const db = Math.abs(a.data[o + 2] - b.data[o + 2]);
    const badPixel = dr > PER_CHANNEL || dg > PER_CHANNEL || db > PER_CHANNEL;
    if (badPixel) {
      bad++;
      diff.data[o] = 255;
      diff.data[o + 1] = 0;
      diff.data[o + 2] = 0;
      diff.data[o + 3] = 255;
    } else {
      // cinza esmaecido do baseline p/ contexto
      const g = (a.data[o] + a.data[o + 1] + a.data[o + 2]) / 3;
      diff.data[o] = diff.data[o + 1] = diff.data[o + 2] = g * 0.3;
      diff.data[o + 3] = 255;
    }
  }
  return { frac: bad / n, w: a.width, h: a.height, diffPng: PNG.sync.write(diff) };
}

async function main() {
  [BASELINE, CURRENT, DIFF].forEach((d) => mkdirSync(d, { recursive: true }));

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
  // Fontes carregadas (woff2 self-hosted) antes de qualquer captura — senão o
  // 1º frame pega o fallback monospace e diverge.
  await page.evaluate(() => document.fonts?.ready);

  const results = [];
  const failures = [];

  for (const [key, data] of SCENES) {
    await page.evaluate(
      async ([k, d]) => {
        const m = window.__game.scene;
        m.getScenes(true).forEach((s) => m.stop(s.scene.key));
        m.start(k, d);
        await new Promise((r) => setTimeout(r, 1200));
        // Congela movimento p/ o frame ser reproduzível: pausa tweens e o relógio
        // da cena, e para emissores de partícula.
        const s = m.getScene(k);
        if (s) {
          s.tweens?.pauseAll?.();
          if (s.time) s.time.paused = true;
          s.children?.list?.forEach((o) => {
            if (o.stop) {
              try {
                o.stop();
              } catch {
                /* nem todo objeto é emissor */
              }
            }
          });
        }
      },
      [key, data],
    );
    await new Promise((r) => setTimeout(r, 120));

    const canvas = await page.$("canvas");
    const buf = await canvas.screenshot();
    writeFileSync(join(CURRENT, `${key}.png`), buf);

    if (UPDATE) {
      writeFileSync(join(BASELINE, `${key}.png`), buf);
      results.push(`base ${key} (gravado)`);
      continue;
    }

    const basePath = join(BASELINE, `${key}.png`);
    if (!existsSync(basePath)) {
      failures.push(`[${key}] sem baseline — rode 'bun visual:update'`);
      results.push(`?    ${key} (sem baseline)`);
      continue;
    }
    const cmp = compare(readFileSync(basePath), buf);
    if (cmp.sizeMismatch) {
      failures.push(`[${key}] tamanho mudou: baseline ${cmp.a} vs atual ${cmp.b}`);
      results.push(`FAIL ${key} (tamanho ${cmp.a}→${cmp.b})`);
      continue;
    }
    const pct = (cmp.frac * 100).toFixed(2);
    if (cmp.frac > MAX_FRAC) {
      writeFileSync(join(DIFF, `${key}.png`), cmp.diffPng);
      failures.push(
        `[${key}] ${pct}% divergente (> ${(MAX_FRAC * 100).toFixed(0)}%) → tests/visual/diff/${key}.png`,
      );
      results.push(`FAIL ${key} (${pct}% divergente)`);
    } else {
      results.push(`ok   ${key} (${pct}% divergente)`);
    }
  }

  await browser.close();
  if (server) server.kill("SIGTERM");

  console.log("── regressão visual ──");
  for (const r of results) console.log("  " + r);
  if (UPDATE) {
    const files = readdirSync(BASELINE).filter((f) => f.endsWith(".png"));
    console.log(`\n✓ ${files.length} baselines gravados em tests/visual/baseline/`);
    process.exit(0);
  }
  if (failures.length) {
    console.error("\n✖ REGRESSÕES:");
    for (const f of failures) console.error("  " + f);
    process.exit(1);
  }
  console.log(`\n✓ ${results.length} cenas dentro do limiar.`);
  process.exit(0);
}

main().catch((e) => {
  console.error("visual-regression crashou:", e);
  process.exit(1);
});
