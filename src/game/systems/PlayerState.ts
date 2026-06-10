// Singleton-ish run state, lives in scene.registry across scene transitions.
import Phaser from "phaser";

export type RunState = {
  energy: number;
  sanity: number;
  vr: number;
  reconhecimento: number;
  cameFrom?: string;
};

export const DEFAULT_RUN: RunState = {
  energy: 100,
  sanity: 100,
  vr: 0,
  reconhecimento: 0,
};

export function getRun(scene: Phaser.Scene): RunState {
  const r = scene.registry.get("run") as RunState | undefined;
  if (!r) {
    const fresh = { ...DEFAULT_RUN };
    scene.registry.set("run", fresh);
    return fresh;
  }
  return r;
}

export function resetRun(scene: Phaser.Scene): RunState {
  const fresh = { ...DEFAULT_RUN };
  scene.registry.set("run", fresh);
  return fresh;
}

export function sanityBand(s: number): "ok" | "stressed" | "anxious" | "burnout" {
  if (s >= 75) return "ok";
  if (s >= 50) return "stressed";
  if (s >= 25) return "anxious";
  return "burnout";
}
