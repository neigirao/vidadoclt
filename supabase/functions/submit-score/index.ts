// Playtest anti-spam, not anti-cheat: a modified client can still invent a score.
// Deploy only after the additive score_rate_limits migration is applied.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const response = (status: number, data: unknown) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
const phases = new Set(["Fase 1", "Fase 2", "Fase 3", "Fase 4", "Fase 5", "CEO", "ESCAPE"]);
const classes = new Set(["estagiario", "analista", "terceirizado"]);

type Score = {
  apelido: string;
  reconhecimento: number;
  loop_count: number;
  reached_phase: string;
  seed: string;
  character_class: string | null;
};

function parseScore(data: unknown): Score | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const v = data as Record<string, unknown>;
  if (
    Object.keys(v).sort().join() !==
    "apelido,character_class,loop_count,reached_phase,reconhecimento,seed"
  )
    return null;
  if (
    typeof v.apelido !== "string" ||
    v.apelido.length > 16 ||
    !/^[\p{L}\p{N} _.-]{1,16}$/u.test(v.apelido)
  )
    return null;
  if (
    !Number.isInteger(v.reconhecimento) ||
    (v.reconhecimento as number) < 0 ||
    (v.reconhecimento as number) > 100000
  )
    return null;
  if (
    !Number.isInteger(v.loop_count) ||
    (v.loop_count as number) < 0 ||
    (v.loop_count as number) > 10000
  )
    return null;
  if (typeof v.reached_phase !== "string" || !phases.has(v.reached_phase)) return null;
  if (typeof v.seed !== "string" || !/^[A-Z]{3,4}-[0-9]{4}$/.test(v.seed)) return null;
  if (
    v.character_class !== null &&
    (typeof v.character_class !== "string" || !classes.has(v.character_class))
  )
    return null;
  return v as Score;
}

async function hashSubject(ip: string, pepper: string): Promise<string> {
  const bytes = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    bytes.encode(pepper),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const result = await crypto.subtle.sign("HMAC", key, bytes.encode(ip));
  return [...new Uint8Array(result)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return response(405, { ok: false, error: "method" });
  const raw = req.headers.get("content-length");
  if (raw && Number(raw) > 2048) return response(413, { ok: false, error: "size" });
  let score: Score | null;
  try {
    const body = await req.text();
    if (new TextEncoder().encode(body).length > 2048)
      return response(413, { ok: false, error: "size" });
    score = parseScore(JSON.parse(body));
  } catch {
    return response(400, { ok: false, error: "json" });
  }
  if (!score) return response(400, { ok: false, error: "score" });

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const pepper = Deno.env.get("SCORE_RATE_LIMIT_PEPPER");
  if (!url || !serviceKey || !pepper) return response(503, { ok: false, error: "config" });
  // Supabase's proxy supplies X-Forwarded-For. Verify at the live gateway that
  // client-supplied values cannot override this header before claiming IP protection.
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (!ip || ip.length > 45 || !/^[0-9a-fA-F.:]+$/.test(ip))
    return response(503, { ok: false, error: "network" });
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const subject = await hashSubject(ip, pepper);
  const { data: allowed, error: rateError } = await admin.rpc("accept_score_rate_limit", {
    p_subject_hash: subject,
  });
  if (rateError) return response(503, { ok: false, error: "rate_backend" });
  if (allowed !== true) return response(429, { ok: false, error: "rate_limited" });
  const { error } = await admin.from("scores").insert(score);
  if (error) return response(503, { ok: false, error: "write" });
  return response(201, { ok: true });
});
