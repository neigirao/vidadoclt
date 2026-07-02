import { supabase } from "@/integrations/supabase/client";

export type ScoreEntry = {
  id: string;
  apelido: string;
  reconhecimento: number;
  loop_count: number;
  reached_phase: string;
  seed: string;
  character_class: string | null;
  created_at: string;
};

export type SubmitScore = Omit<ScoreEntry, "id" | "created_at">;

/**
 * Maps internal scene names to readable phase labels.
 */
export function phaseLabel(sceneName: string): string {
  const map: Record<string, string> = {
    OpenSpaceV2Scene: "Fase 1",
    Phase2Scene: "Fase 2",
    Phase3Scene: "Fase 3",
    Phase4Scene: "Fase 4",
    Phase5Scene: "Fase 5",
    CeoScene: "CEO",
    VitoriaScene: "ESCAPE",
  };
  return map[sceneName] ?? "Fase 1";
}

/**
 * Inserts a score into the leaderboard. Fire-and-forget — does not throw.
 */
export async function submitScore(entry: SubmitScore): Promise<void> {
  try {
    await supabase.from("scores").insert(entry);
  } catch (e) {
    console.warn("[Ranking] submitScore failed silently:", e);
  }
}

/**
 * Returns the top N scores ordered by reconhecimento descending.
 */
export async function getTopScores(limit = 15): Promise<ScoreEntry[]> {
  try {
    const { data, error } = await supabase
      .from("scores")
      .select(
        "id, apelido, reconhecimento, loop_count, reached_phase, seed, character_class, created_at",
      )
      .order("reconhecimento", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []) as ScoreEntry[];
  } catch (e) {
    console.warn("[Ranking] getTopScores failed:", e);
    return [];
  }
}
