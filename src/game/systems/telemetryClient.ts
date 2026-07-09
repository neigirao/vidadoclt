import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase DEDICADO à telemetria de playtest.
 *
 * Aponta para um projeto Supabase separado do banco do jogo (o ranking usa o
 * projeto gerenciado pelo Lovable). Motivo: esse projeto é acessível às
 * ferramentas de análise do dev, permitindo consultar os dados de playtest
 * direto por SQL — sem exportar JSON à mão.
 *
 * A chave abaixo é a PUBLISHABLE/anon key (pública por design, igual à que já
 * vai no bundle do cliente do jogo). O RLS da tabela `playtest_events` só
 * permite INSERT anônimo — ninguém lê os dados uns dos outros pela chave anon.
 * Sem PII: só um id de sessão aleatório + eventos de game design.
 */
const TELEMETRY_URL = "https://hafxruwnggitvtyngedy.supabase.co";
const TELEMETRY_KEY = "sb_publishable_NEWf5itOs4cecw4y7Pcpjg_SSxnpuik";

let _client: SupabaseClient | null = null;

export function telemetryClient(): SupabaseClient | null {
  if (typeof window === "undefined") return null;
  if (!_client) {
    try {
      _client = createClient(TELEMETRY_URL, TELEMETRY_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
    } catch {
      return null;
    }
  }
  return _client;
}
