import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Ponto de extensão para telemetria remota do Vida do CLT.
 *
 * Não há backend próprio configurado. Retornar null mantém o buffer local de
 * Telemetry.ts, sem enviar eventos de jogadores ao projeto de outro app.
 * Para religar a coleta, criar um backend próprio, revisar consentimento e
 * dados coletados e configurar este cliente explicitamente em outro PR.
 */
export function telemetryClient(): SupabaseClient | null {
  return null;
}
