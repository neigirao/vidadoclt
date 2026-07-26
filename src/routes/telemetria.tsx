import { createFileRoute, Link } from "@tanstack/react-router";
import { Suspense, lazy } from "react";

// Rota do painel de telemetria — FERRAMENTA DE DESENVOLVIMENTO, igual aos itens
// DEV do MenuScene (TESTAR FASE / LAB SPRITES / LAB VFX).
//
// O painel usa `recharts`, que sozinho pesava ~380KB no bundle PUBLICADO — um
// painel interno que nenhum jogador abre. O import dinâmico atrás de
// `import.meta.env.DEV` resolve: no build de produção a constante vira `false`,
// o ternário é eliminado por DCE e o `import()` do painel (e o recharts junto)
// desaparece do output. Em `bun dev` nada muda.
//
// A rota em si continua existindo em produção — o roteamento é gerado por
// arquivo (routeTree.gen.ts) — mas responde com o aviso abaixo em vez do painel.
const TelemetriaPanel = import.meta.env.DEV
  ? lazy(() => import("@/components/TelemetriaPanel"))
  : null;

export const Route = createFileRoute("/telemetria")({
  head: () => ({
    meta: [{ title: "Telemetria — A Vida do CLT" }],
  }),
  component: TelemetriaRoute,
});

function TelemetriaRoute() {
  if (!TelemetriaPanel) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#0b0d11] px-6 text-center text-white">
        <h1 className="text-xl font-bold">Painel indisponível</h1>
        <p className="max-w-md text-sm text-white/50">
          A telemetria de playtest é uma ferramenta de desenvolvimento e não faz parte do jogo
          publicado.
        </p>
        <Link
          to="/"
          className="rounded-md border border-white/15 px-3 py-1.5 text-sm hover:bg-white/5"
        >
          ← Voltar ao jogo
        </Link>
      </div>
    );
  }
  return (
    <Suspense fallback={<div className="p-8 font-mono text-white/60">Carregando painel…</div>}>
      <TelemetriaPanel />
    </Suspense>
  );
}
