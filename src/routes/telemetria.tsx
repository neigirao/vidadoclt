import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Telemetry, type TelemetrySummary } from "@/game/systems/Telemetry";

export const Route = createFileRoute("/telemetria")({
  head: () => ({
    meta: [{ title: "Telemetria — A Vida do CLT" }],
  }),
  component: TelemetriaPage,
});

// Painel de telemetria (dev/dono). Lê o Telemetry.summary() LOCAL (buffer em
// localStorage deste navegador — persiste entre sessões). A telemetria também
// sobe automática pro Supabase (agregado de todos os playtesters); este painel é
// a visão rápida sem exportar JSON. Usa recharts (já no bundle via shadcn).

const CARD = "rounded-lg border border-white/10 bg-white/[0.03] p-4";
const SCENE_LABEL: Record<string, string> = {
  OpenSpaceV2Scene: "Fase 1",
  Phase2Scene: "Fase 2",
  Phase3Scene: "Fase 3",
  Phase4Scene: "Fase 4",
  Phase5Scene: "Fase 5",
  CeoScene: "CEO",
  CopaScene: "Copa",
};
const shortScene = (s: string) => SCENE_LABEL[s] ?? s.replace(/Scene$/, "");

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className={CARD}>
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="text-xs uppercase tracking-wide text-white/50">{label}</div>
      {hint && <div className="mt-1 text-[11px] text-white/35">{hint}</div>}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className={CARD}>
      <div className="mb-3 text-sm font-semibold text-white/80">{title}</div>
      {children}
    </div>
  );
}

const AXIS = { fontSize: 11, fill: "#9aa4b0" };
const tip = {
  contentStyle: {
    background: "#0d0f14",
    border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: 6,
    fontSize: 12,
  },
  labelStyle: { color: "#cfd6de" },
};

function TelemetriaPage() {
  const [s, setS] = useState<TelemetrySummary | null>(null);
  const [count, setCount] = useState(0);

  const load = () => {
    setS(Telemetry.summary());
    setCount(Telemetry.count());
  };
  useEffect(load, []);

  if (!s) return <div className="p-8 font-mono text-white/60">Carregando telemetria…</div>;

  const deathsByScene = Object.entries(s.deathsByScene)
    .map(([scene, n]) => ({ scene: shortScene(scene), n }))
    .sort((a, b) => b.n - a.n);
  const verbs = [
    { verb: "Dash", n: s.avgVerbsPerRun.dash },
    { verb: "Especial", n: s.avgVerbsPerRun.special },
    { verb: "Parry", n: s.avgVerbsPerRun.parry },
  ];
  const clearByScene = Object.entries(s.avgClearMsByScene).map(([scene, ms]) => ({
    scene: shortScene(scene),
    seg: +(ms / 1000).toFixed(1),
  }));
  const dmgByScene = Object.entries(s.avgPhaseDmgByScene).map(([scene, dmg]) => ({
    scene: shortScene(scene),
    dmg,
  }));
  const terminated = s.deaths + s.victories;
  const winRate = terminated > 0 ? Math.round((s.victories / terminated) * 100) : 0;

  return (
    <div className="min-h-screen bg-[#0b0d11] px-6 py-8 text-white">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Telemetria de Playtest</h1>
            <p className="text-sm text-white/50">
              Buffer LOCAL deste navegador ({count} eventos). Sobe automático pro Supabase.
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              to="/"
              className="rounded-md border border-white/15 px-3 py-1.5 text-sm hover:bg-white/5"
            >
              ← Voltar ao jogo
            </Link>
            <button
              onClick={() => {
                if (confirm("Zerar a telemetria LOCAL deste navegador?")) {
                  Telemetry.clear();
                  load();
                }
              }}
              className="rounded-md border border-red-500/30 px-3 py-1.5 text-sm text-red-300 hover:bg-red-500/10"
            >
              Zerar local
            </button>
          </div>
        </div>

        {count === 0 ? (
          <div className={CARD}>
            <p className="text-white/60">
              Nenhum evento ainda neste navegador. Jogue algumas runs e volte aqui.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Runs" value={s.runs} />
              <Stat label="Vitórias" value={s.victories} hint={`${winRate}% de win rate`} />
              <Stat label="Mortes" value={s.deaths} />
              <Stat label="Runs com Burnout" value={s.burnoutRuns} hint="entraram no VAI NA RAÇA" />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Panel title="Onde as runs terminam (mortes por cena)">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={deathsByScene}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="scene" tick={AXIS} />
                    <YAxis tick={AXIS} allowDecimals={false} />
                    <Tooltip {...tip} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                    <Bar dataKey="n" radius={[3, 3, 0, 0]}>
                      {deathsByScene.map((d, i) => (
                        <Cell key={i} fill={d.scene === "Copa" ? "#e0574a" : "#d8a441"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Panel>

              <Panel title="Uso de verbos por run terminada">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={verbs}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="verb" tick={AXIS} />
                    <YAxis tick={AXIS} />
                    <Tooltip {...tip} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                    <Bar dataKey="n" fill="#66aaff" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Panel>

              <Panel title="Tempo médio por fase (segundos, quem sobrevive)">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={clearByScene}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="scene" tick={AXIS} />
                    <YAxis tick={AXIS} />
                    <Tooltip {...tip} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                    <Bar dataKey="seg" fill="#66cc99" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Panel>

              <Panel title="Dano médio tomado por fase (dificuldade)">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={dmgByScene}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="scene" tick={AXIS} />
                    <YAxis tick={AXIS} />
                    <Tooltip {...tip} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                    <Bar dataKey="dmg" fill="#c47a3a" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Panel>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
