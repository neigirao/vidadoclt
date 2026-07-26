import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { KEEP } from "../../../../scripts/prune-deploy.mjs";

// A poda do deploy (scripts/prune-deploy.mjs) apaga os PNGs-fonte do atlas do
// build publicado, preservando só os soltos da lista KEEP. Se alguém adicionar
// um `load.image` de um PNG solto e esquecer de registrar em KEEP,
// a textura some SÓ EM PRODUÇÃO — o dev nunca veria. Este teste fecha isso:
// varre o código-fonte atrás desses caminhos e cruza com a lista.

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const SRC = join(ROOT, "src");
const RE = /\/assets\/sprites\/([a-zA-Z0-9._-]+\.png)/g;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    // Testes ficam de fora: este arquivo cita caminhos de exemplo em comentário.
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

function referencedLooseSprites(): Map<string, string[]> {
  const found = new Map<string, string[]>();
  for (const file of walk(SRC)) {
    const text = readFileSync(file, "utf8");
    for (const m of text.matchAll(RE)) {
      const png = m[1];
      // Referências dentro de template string com interpolação (`${frame}.png`)
      // são dinâmicas — ferramenta DEV (LAB), não carga de runtime do jogo.
      if (png.includes("$")) continue;
      found.set(png, [...(found.get(png) ?? []), file]);
    }
  }
  return found;
}

describe("poda do deploy — lista KEEP", () => {
  test("todo PNG solto referenciado no código está preservado", () => {
    const refs = referencedLooseSprites();
    const missing = [...refs.keys()].filter((p) => !KEEP.includes(p));
    // Mensagem acionável: diz exatamente o que adicionar e onde foi visto.
    expect({ missing, seenIn: missing.map((p) => refs.get(p)) }).toEqual({
      missing: [],
      seenIn: [],
    });
  });

  test("KEEP não guarda arquivo morto (todo item é realmente referenciado)", () => {
    const refs = referencedLooseSprites();
    expect(KEEP.filter((p) => !refs.has(p))).toEqual([]);
  });

  test("KEEP não tem duplicata", () => {
    expect(new Set(KEEP).size).toBe(KEEP.length);
  });
});
