import { createFileRoute } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { GameMount } from "@/game/GameMount";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "A Vida do CLT — Protótipo" },
      {
        name: "description",
        content:
          "Rogue-lite 2D onde você só queria ir para casa às 18h. Protótipo jogável da Fase 1.",
      },
      { property: "og:title", content: "A Vida do CLT — Protótipo" },
      {
        property: "og:description",
        content: "Rogue-lite 2D onde você só queria ir para casa às 18h.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="w-screen h-screen bg-black flex items-center justify-center overflow-hidden">
      <ClientOnly
        fallback={<div className="text-white font-mono text-sm">Carregando o expediente…</div>}
      >
        <GameMount />
      </ClientOnly>
    </div>
  );
}
