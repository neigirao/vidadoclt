import { describe, it, expect } from "bun:test";
import { sanityBand } from "../sanity";

describe("sanityBand — faixas de sanidade", () => {
  it("mapeia os limites corretamente", () => {
    expect(sanityBand(100)).toBe("ok");
    expect(sanityBand(75)).toBe("ok");
    expect(sanityBand(74)).toBe("stressed");
    expect(sanityBand(50)).toBe("stressed");
    expect(sanityBand(49)).toBe("anxious");
    expect(sanityBand(25)).toBe("anxious");
    expect(sanityBand(24)).toBe("burnout");
    expect(sanityBand(0)).toBe("burnout");
  });

  it("burnout inclui valores negativos (sanidade nunca deve passar disso)", () => {
    expect(sanityBand(-5)).toBe("burnout");
  });
});
