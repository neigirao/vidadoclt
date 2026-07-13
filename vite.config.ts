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
            // re-empacota o atlas a partir de sprites/
            const child = spawn("node", ["scripts/pack-atlas.mjs"], { cwd: process.cwd() });
            let log = "";
            child.stdout.on("data", (d) => (log += d));
            child.stderr.on("data", (d) => (log += d));
            child.on("close", (code) =>
              send(code === 0 ? 200 : 500, {
                ok: code === 0,
                file: `assets/sprites/${name}.png`,
                log: log.slice(-600),
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
        void readBody(req).then((body) => {
          try {
            const { frame, mode } = JSON.parse(body) as { frame?: string; mode?: string };
            if (!frame || !FRAME_RE.test(frame)) throw new Error("nome de frame inválido");
            const isGemini = mode === "gemini";
            // gemini → PRÉVIA (não sobrescreve, não re-empacota).
            const fix = isGemini
              ? spawn("node", ["scripts/frame-gemini.mjs", frame, "--preview"], {
                  cwd: process.cwd(),
                })
              : spawn(
                  "node",
                  [
                    "scripts/frame-fix.mjs",
                    frame,
                    mode === "copy-nearest" ? "copy-nearest" : "rescale",
                  ],
                  { cwd: process.cwd() },
                );
            let out = "";
            fix.stdout.on("data", (d) => (out += d));
            fix.stderr.on("data", (d) => (out += d));
            fix.on("close", (fixCode) => {
              let result: unknown;
              try {
                result = JSON.parse(out.trim().split("\n").pop() ?? "{}");
              } catch {
                result = { ok: false, error: out.slice(-300) };
              }
              if (fixCode !== 0) return json(res, 500, result);
              // Prévia da IA: nada de re-empacotar — o LAB só mostra o "depois".
              if (isGemini) return json(res, 200, result);
              // Determinístico: re-empacota o atlas com o frame consertado.
              const pack = spawn("node", ["scripts/pack-atlas.mjs"], { cwd: process.cwd() });
              pack.on("close", (packCode) =>
                json(res, packCode === 0 ? 200 : 500, {
                  ...(result as object),
                  repacked: packCode === 0,
                }),
              );
            });
          } catch (e) {
            json(res, 400, { ok: false, error: String(e) });
          }
        });
      });

      server.middlewares.use("/__frame-approve", (req, res, next) => {
        if (req.method !== "POST") return next();
        void readBody(req).then((body) => {
          try {
            const { frame } = JSON.parse(body) as { frame?: string };
            if (!frame || !FRAME_RE.test(frame)) throw new Error("nome de frame inválido");
            const preview = resolve(process.cwd(), PREVIEW_DIR, `${frame}.png`);
            const dest = resolve(process.cwd(), SPRITES_DIR, `${frame}.png`);
            if (!preview.startsWith(resolve(process.cwd(), PREVIEW_DIR) + "/"))
              throw new Error("caminho inválido");
            if (!existsSync(preview))
              throw new Error("sem prévia p/ aprovar (gere com a IA antes)");
            copyFileSync(preview, dest);
            rmSync(preview, { force: true });
            // re-empacota o atlas e commita PNG-fonte + atlas gerado.
            const pack = spawn("node", ["scripts/pack-atlas.mjs"], { cwd: process.cwd() });
            pack.on("close", (packCode) => {
              if (packCode !== 0) return json(res, 500, { ok: false, error: "pack-atlas falhou" });
              const files = [
                `${SPRITES_DIR}/${frame}.png`,
                "public/assets/atlas.png",
                "public/assets/atlas.json",
              ];
              const git = spawn(
                "bash",
                [
                  "-c",
                  `git add ${files.join(" ")} && git commit -m ${JSON.stringify(`LAB: refaz frame ${frame} via IA (Gemini)`)}`,
                ],
                { cwd: process.cwd() },
              );
              let glog = "";
              git.stdout.on("data", (d) => (glog += d));
              git.stderr.on("data", (d) => (glog += d));
              git.on("close", (gitCode) =>
                json(res, 200, {
                  ok: true,
                  frame,
                  committed: gitCode === 0,
                  gitLog: glog.slice(-300),
                }),
              );
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
