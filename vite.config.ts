import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import type { Plugin } from "vite";

// ─────────────────────────────────────────────────────────────────────────────
// Plugin DEV: upload de sprite pelo LAB DE SPRITES. Recebe um PNG (base64),
// grava em public/assets/sprites/<frame>.png e re-empacota o atlas. Só existe no
// `bun dev` (apply: "serve") — some do build publicado. Grava só dentro de
// sprites/ (sem path traversal) e valida o nome do frame.
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
            const { name, dataUrl } = JSON.parse(body) as { name?: string; dataUrl?: string };
            if (!name || !/^[a-z0-9][a-z0-9_-]*$/i.test(name))
              throw new Error("nome de frame inválido");
            const m = /^data:image\/png;base64,(.+)$/.exec(dataUrl ?? "");
            if (!m) throw new Error("esperado PNG em base64");
            const dir = resolve(process.cwd(), "public/assets/sprites");
            const file = resolve(dir, `${name}.png`);
            if (!file.startsWith(dir + "/")) throw new Error("caminho fora de sprites/");
            writeFileSync(file, Buffer.from(m[1], "base64"));
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
