import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { writeFileSync, readFileSync, existsSync } from "node:fs";
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

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    server: { host: "0.0.0.0" },
    plugins: [spriteUploadDevPlugin()],
  },
});
