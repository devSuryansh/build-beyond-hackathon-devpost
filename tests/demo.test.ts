import { describe, expect, it } from "vitest";
import { buildSampleWeek, demoLevelAt } from "../src/lib/demo";

describe("demoLevelAt", () => {
  it("is deterministic for the same timestamp and seed", () => {
    const at = Date.UTC(2026, 7, 14, 21, 0, 0);
    expect(demoLevelAt({ at, seed: 7 })).toBe(demoLevelAt({ at, seed: 7 }));
  });

  it("is quieter at 3am than at 9pm on a weekday", () => {
    const night = demoLevelAt({
      at: new Date(2026, 7, 12, 3, 0, 0).getTime(),
      seed: 11,
    });
    const evening = demoLevelAt({
      at: new Date(2026, 7, 12, 21, 0, 0).getTime(),
      seed: 11,
    });
    expect(night).toBeLessThan(evening);
  });
});

describe("buildSampleWeek", () => {
  it("covers seven days at six-minute intervals", () => {
    const now = Date.UTC(2026, 7, 14, 12, 0, 0);
    const samples = buildSampleWeek({ now, seed: 3 });
    expect(samples.length).toBe(7 * 24 * 10);
    expect(samples[0]?.at).toBe(now - 7 * 24 * 60 * 60 * 1000);
    expect(samples.at(-1)?.at).toBeLessThan(now);
  });
});
