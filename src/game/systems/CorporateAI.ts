import { Noise, StringGenerator } from "rot-js";

// ── Simplex Noise ──────────────────────────────────────────────────────────────
// One shared instance (stateless reads, no per-enemy allocation needed).
const _simplex = new Noise.Simplex();

/**
 * Sample 2D simplex noise in [-1, 1].
 * Scale inputs to taste: small x/y scales → smooth variation; larger → faster.
 */
export function noise2d(x: number, y: number): number {
  return _simplex.get(x, y);
}

// ── Corporate-speak generator (Markov chain, order 2) ─────────────────────────
// Trained on Brazilian corporate buzzwords. Used for boss attack telegraphs,
// SanityFx notification subjects, and Game Over captions.
const CORPUS = [
  "alinhamento estrategico", "visao de negocio", "sinergia corporativa",
  "entrega de valor", "mindset de crescimento", "inovacao disruptiva",
  "lean thinking agil", "culture fit organizacional", "gestao de stakeholders",
  "quick win de alto impacto", "low hanging fruit de resultado",
  "mover o ponteiro do indicador", "vestir a camisa da empresa",
  "proatividade e ownership", "empoderamento de equipe",
  "onboarding do processo novo", "offboarding humanizado",
  "feedback construtivo e urgente", "reuniao de alinhamento rapido",
  "daily de acompanhamento", "sprint de entregaveis prioritarios",
  "roadmap de evolucao continua", "okr de crescimento exponencial",
  "kpi de eficiencia operacional", "benchmark de mercado competitivo",
  "pivotagem de estrategia agil", "scale up de operacoes",
  "cultura de alta performance", "engajamento do colaborador",
  "jornada do cliente interno", "transformacao digital integrada",
];

const _gen = new StringGenerator({ order: 2, prior: 0.01 });
for (const phrase of CORPUS) _gen.observe(phrase);

/**
 * Generate a random corporate buzzword phrase (2–5 words).
 * Each call returns a different plausible-sounding corporate speak fragment.
 */
export function generateCorporateSpeak(): string {
  // Generate and clean — StringGenerator sometimes returns very short strings
  for (let attempt = 0; attempt < 8; attempt++) {
    const raw = _gen.generate().trim();
    if (raw.length >= 8) return raw.toUpperCase();
  }
  return CORPUS[Math.floor(Math.random() * CORPUS.length)].toUpperCase();
}

/**
 * Returns a fake corporate notification subject line using generated speak.
 */
export function generateNotifSubject(): string {
  const prefix = ["[Teams]", "[Outlook]", "[Slack]", "[Jira]", "[Calendario]"][
    Math.floor(Math.random() * 5)
  ];
  return `${prefix} RE: ${generateCorporateSpeak()}`;
}
