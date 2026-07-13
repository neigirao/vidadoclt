import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { writeFileSync, readFileSync, existsSync, copyFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import type { Plugin } from "vite";

// Lê largura×altura de um PNG direto do IHDR (bytes 16–24), sem depender de lib.
// Valida a assinatura PNG antes. Retorna null se não for PNG válido.
function pngDims(buf: Buffer): { w: number; h: number } | null {
  const SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buf.length < 24 || !buf.subarray(0, 8).equals(SIG)) return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

// ─────────────────────────────────────────────────────────────────────────────
// Plugin DEV: upload pelo LAB DE SPRITES. Recebe um PNG (base64). Dois modos:
//   • sprite (default): grava public/assets/sprites/<frame>.png + re-empacota o
//     atlas; regra de dimensão (mesmo tamanho do frame).
//   • background (kind:"background"): grava public/assets/<bg-*>.png; sem repack
//     e sem regra de dimensão (o fundo é esticado p/ preencher a fase).
// Só existe no `bun dev` (apply:"serve") — some do build publicado. Valida nome,
// assinatura PNG e bloqueia caminho fora do diretório alvo.
// ─────────────────────────────────────────────────────────────────────────────
function spriteUploadDevPlugin(): Plugin {
  return {
    name: "sprite-upload-dev",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/__sprite-upload", (req, res, next) => {
        if (req.method !== "POST") return next();
        let body = "";
        req.on("data", (c) => (body += c));
        req.on("end", () => {
          const send = (code: number, obj: unknown) => {
            res.statusCode = code;
            res.setHeader("content-type", "application/json");
            res.end(JSON.stringify(obj));
          };
          try {
            const { name, dataUrl, kind } = JSON.parse(body) as {
              name?: string;
              dataUrl?: string;
              kind?: string;
            };
            const isBg = kind === "background";
            // Fundo: imagem solta em assets/ (bg-*). Sprite: frame-fonte em
            // sprites/ (re-empacota o atlas).
            if (isBg) {
              if (!name || !/^bg-[a-z0-9-]+$/i.test(name))
                throw new Error("nome de fundo inválido");
            } else if (!name || !/^[a-z0-9][a-z0-9_-]*$/i.test(name)) {
              throw new Error("nome de frame inválido");
            }
            const m = /^data:image\/png;base64,(.+)$/.exec(dataUrl ?? "");
            if (!m) throw new Error("esperado PNG em base64");
            const dir = resolve(process.cwd(), isBg ? "public/assets" : "public/assets/sprites");
            const file = resolve(dir, `${name}.png`);
            if (!file.startsWith(dir + "/")) throw new Error("caminho inválido");
            const buf = Buffer.from(m[1], "base64");
            const up = pngDims(buf);
            if (!up) throw new Error("PNG inválido");
            // REGRA (só sprite): a dimensão do upload tem que casar com a do
            // PNG-fonte substituído (senão quebra a família de animação). Fundos
            // são esticados p/ preencher — sem regra de dimensão exata.
            if (!isBg && existsSync(file)) {
              const cur = pngDims(readFileSync(file));
              if (cur && (cur.w !== up.w || cur.h !== up.h))
                throw new Error(
                  `dimensão ${up.w}×${up.h} ≠ frame ${cur.w}×${cur.h} — mantenha o tamanho`,
                );
            }
            writeFileSync(file, buf);
            if (isBg) {
              send(200, { ok: true, file: `assets/${name}.png` });
              return;
            }
            // re-empacota o atlas a partir de sprites/ (serializado com os demais
            // endpoints que também re-empacotam — evita atlas truncado por corrida).
            void repackAtlas().then((packed) =>
              send(packed ? 200 : 500, {
                ok: packed,
                file: `assets/sprites/${name}.png`,
              }),
            );
          } catch (e) {
            send(400, { ok: false, error: String(e) });
          }
        });
      });
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Plugin DEV: conserto de UM frame (botões do LAB). Três endpoints:
//   • POST /__frame-fix  — rescale/copy-nearest (determinístico, frame-fix.mjs) →
//     grava o frame e re-empacota o atlas na hora (seguro, preserva o design).
//     mode=gemini → gera uma PRÉVIA (frame-gemini.mjs --preview) em
//     .frame-preview/<frame>.png SEM tocar no frame real nem re-empacotar; devolve
//     o PNG (dataUrl) p/ o LAB mostrar o "depois".
//   • POST /__frame-approve — aprova a prévia da IA: copia .frame-preview/<frame>
//     por cima do frame real, re-empacota o atlas e faz `git commit` do PNG+atlas.
//   • POST /__frame-discard — descarta a prévia (remove o arquivo).
// Só em `vite dev` (apply:"serve").
// ─────────────────────────────────────────────────────────────────────────────
const FRAME_RE = /^[a-z0-9][a-z0-9_-]*$/i;
const SPRITES_DIR = "public/assets/sprites";
const PREVIEW_DIR = "public/assets/.frame-preview";

function readBody(req: import("node:http").IncomingMessage): Promise<string> {
  return new Promise((ok) => {
    let b = "";
    req.on("data", (c: Buffer) => (b += c));
    req.on("end", () => ok(b));
  });
}

// Serializa TODOS os re-empacotamentos do atlas. `/__sprite-upload`,
// `/__frame-fix` e `/__frame-approve` spawnam pack-atlas.mjs (readdirSync +
// writeFile de atlas.png/json). Dois repacks concorrentes intercalariam as
// escritas → atlas.png/json truncados/dessincronizados. Esta fila garante um de
// cada vez, mesmo entre plugins (módulo compartilhado).
let packChain: Promise<unknown> = Promise.resolve();
function repackAtlas(): Promise<boolean> {
  const run = () =>
    new Promise<boolean>((ok) => {
      const p = spawn("node", ["scripts/pack-atlas.mjs"], { cwd: process.cwd() });
      p.on("close", (code) => ok(code === 0));
      p.on("error", () => ok(false));
    });
  const result = packChain.then(run, run);
  packChain = result.catch(() => {});
  return result;
}

// Spawn com coleta de stdout/stderr e timeout opcional (mata o processo se
// estourar — ex.: a chamada de imagem do Gemini que pode travar sem retornar).
function spawnCollect(
  cmd: string,
  args: string[],
  timeoutMs?: number,
): Promise<{ code: number | null; out: string; timedOut: boolean }> {
  return new Promise((ok) => {
    const child = spawn(cmd, args, { cwd: process.cwd() });
    let out = "";
    let timedOut = false;
    const timer = timeoutMs
      ? setTimeout(() => {
          timedOut = true;
          child.kill("SIGKILL");
        }, timeoutMs)
      : null;
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    child.on("close", (code) => {
      if (timer) clearTimeout(timer);
      ok({ code, out, timedOut });
    });
    child.on("error", (e) => {
      if (timer) clearTimeout(timer);
      ok({ code: 1, out: out + String(e), timedOut });
    });
  });
}

function frameFixDevPlugin(): Plugin {
  return {
    name: "frame-fix-dev",
    apply: "serve",
    configureServer(server) {
      const json = (res: import("node:http").ServerResponse, code: number, obj: unknown) => {
        res.statusCode = code;
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify(obj));
      };

      server.middlewares.use("/__frame-fix", (req, res, next) => {
        if (req.method !== "POST") return next();
        void readBody(req).then(async (body) => {
          try {
            const { frame, mode } = JSON.parse(body) as { frame?: string; mode?: string };
            if (!frame || !FRAME_RE.test(frame)) throw new Error("nome de frame inválido");
            const isGemini = mode === "gemini";
            // gemini → PRÉVIA (não sobrescreve, não re-empacota). Timeout de 120s
            // (a chamada de imagem do Gemini pode travar sem retornar).
            const args = isGemini
              ? ["scripts/frame-gemini.mjs", frame, "--preview"]
              : [
                  "scripts/frame-fix.mjs",
                  frame,
                  mode === "copy-nearest" ? "copy-nearest" : "rescale",
                ];
            const { code, out, timedOut } = await spawnCollect(
              "node",
              args,
              isGemini ? 120000 : 30000,
            );
            if (timedOut)
              return json(res, 504, { ok: false, error: "a IA demorou demais (timeout 120s)" });
            let result: unknown;
            try {
              result = JSON.parse(out.trim().split("\n").pop() ?? "{}");
            } catch {
              result = { ok: false, error: out.slice(-300) };
            }
            if (code !== 0) return json(res, 500, result);
            // Prévia da IA: nada de re-empacotar — o LAB só mostra o "depois".
            if (isGemini) return json(res, 200, result);
            // Determinístico: re-empacota o atlas (serializado) com o frame consertado.
            const packed = await repackAtlas();
            return json(res, packed ? 200 : 500, { ...(result as object), repacked: packed });
          } catch (e) {
            json(res, 400, { ok: false, error: String(e) });
          }
        });
      });

      server.middlewares.use("/__frame-approve", (req, res, next) => {
        if (req.method !== "POST") return next();
        void readBody(req).then(async (body) => {
          try {
            const { frame } = JSON.parse(body) as { frame?: string };
            if (!frame || !FRAME_RE.test(frame)) throw new Error("nome de frame inválido");
            const preview = resolve(process.cwd(), PREVIEW_DIR, `${frame}.png`);
            const dest = resolve(process.cwd(), SPRITES_DIR, `${frame}.png`);
            if (!preview.startsWith(resolve(process.cwd(), PREVIEW_DIR) + "/"))
              throw new Error("caminho inválido");
            if (!existsSync(preview))
              throw new Error("sem prévia p/ aprovar (gere com a IA antes)");
            // approve CONSERTA um frame existente — não cria frame novo no atlas.
            if (!existsSync(dest))
              throw new Error("frame não existe em sprites/ (approve não cria)");
            // ATÔMICO: guarda o original, troca, re-empacota; se o pack falhar,
            // restaura o original e mantém a prévia (nada é perdido).
            const backup = readFileSync(dest);
            copyFileSync(preview, dest);
            const packed = await repackAtlas();
            if (!packed) {
              writeFileSync(dest, backup); // rollback do frame
              await repackAtlas(); // restaura o atlas ao estado bom
              return json(res, 500, {
                ok: false,
                error: "pack-atlas falhou — frame original restaurado, prévia mantida",
              });
            }
            rmSync(preview, { force: true }); // só some com a prévia após sucesso
            // commit ESCOPADO (só estes 3 paths — não arrasta staged não-relacionado).
            const files = [
              `${SPRITES_DIR}/${frame}.png`,
              "public/assets/atlas.png",
              "public/assets/atlas.json",
            ];
            const msg = `LAB: refaz frame ${frame} via IA (Gemini)`;
            const { code: gitCode, out: glog } = await spawnCollect(
              "git",
              ["commit", "-m", msg, "--", ...files],
              30000,
            );
            return json(res, 200, {
              ok: true,
              frame,
              committed: gitCode === 0,
              gitLog: glog.slice(-300),
            });
          } catch (e) {
            json(res, 400, { ok: false, error: String(e) });
          }
        });
      });

      server.middlewares.use("/__frame-discard", (req, res, next) => {
        if (req.method !== "POST") return next();
        void readBody(req).then((body) => {
          try {
            const { frame } = JSON.parse(body) as { frame?: string };
            if (!frame || !FRAME_RE.test(frame)) throw new Error("nome de frame inválido");
            const preview = resolve(process.cwd(), PREVIEW_DIR, `${frame}.png`);
            if (!preview.startsWith(resolve(process.cwd(), PREVIEW_DIR) + "/"))
              throw new Error("caminho inválido");
            rmSync(preview, { force: true });
            json(res, 200, { ok: true, frame, discarded: true });
          } catch (e) {
            json(res, 400, { ok: false, error: String(e) });
          }
        });
      });
    },
  };
}

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    server: { host: "0.0.0.0" },
    plugins: [spriteUploadDevPlugin(), frameFixDevPlugin()],
  },
});
