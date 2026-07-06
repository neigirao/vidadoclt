import { describe, it, expect } from "bun:test";
import { DEFAULT_SETTINGS, loadSettings, saveSettings, toggleReduceSanityFx } from "../Settings";

// localStorage fake mínimo para o ambiente bun:test (sem browser).
const store = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: () => null,
  length: 0,
} as Storage;

describe("Settings", () => {
  it("sem storage devolve os defaults", () => {
    store.clear();
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
    expect(DEFAULT_SETTINGS.reduceSanityFx).toBe(false);
  });

  it("saveSettings + loadSettings faz round-trip", () => {
    store.clear();
    saveSettings({ reduceSanityFx: true });
    expect(loadSettings().reduceSanityFx).toBe(true);
  });

  it("toggleReduceSanityFx alterna e persiste", () => {
    store.clear();
    expect(toggleReduceSanityFx()).toBe(true);
    expect(loadSettings().reduceSanityFx).toBe(true);
    expect(toggleReduceSanityFx()).toBe(false);
    expect(loadSettings().reduceSanityFx).toBe(false);
  });

  it("JSON corrompido não quebra (volta ao default)", () => {
    store.set("vidaclt:settings", "{ not json");
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it("merge preserva defaults para chaves ausentes", () => {
    store.set("vidaclt:settings", "{}");
    expect(loadSettings().reduceSanityFx).toBe(false);
  });
});
