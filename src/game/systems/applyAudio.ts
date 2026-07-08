// Cola entre as Settings persistidas e os sistemas de áudio. Fica separado do
// Settings.ts (que é dado puro/testável) e é chamado no boot e a cada mudança
// na tela de Configurações.
import { setSfxVolume, setSfxMuted } from "./AudioSystem";
import { Music } from "./MusicSystem";
import { loadSettings, Settings } from "./Settings";

// Ganho-base da música (o slider a 100% entrega o volume DESENHADO, não 1.0).
const MUSIC_BASE = 0.28;

/** Aplica os volumes/mudo das Settings aos sistemas de SFX e música. */
export function applyAudioSettings(s: Settings = loadSettings()): void {
  setSfxVolume(s.sfxVolume * s.masterVolume);
  setSfxMuted(s.muted);
  Music.setVolume(MUSIC_BASE * s.musicVolume * s.masterVolume);
  Music.setMuted(s.muted);
}
