import { describe, expect, it } from "vitest";
import { levelLabel, meanLevel, rmsToLevel, roomLevel } from "../src/lib/level";
import { QUIET_MAX, WORKABLE_MAX } from "../src/lib/types";

describe("roomLevel", () => {
  it("clamps to 0..100", () => {
    expect(roomLevel(-4)).toBe(0);
    expect(roomLevel(140)).toBe(100);
    expect(roomLevel(41.2)).toBe(41.2);
  });

  it("treats non-finite values as 0", () => {
    expect(roomLevel(Number.NaN)).toBe(0);
    expect(roomLevel(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe("rmsToLevel", () => {
  it("maps near-silence below the quiet cutoff", () => {
    expect(rmsToLevel(0.0004)).toBeLessThanOrEqual(QUIET_MAX);
  });

  it("maps a loud signal above the workable cutoff", () => {
    expect(rmsToLevel(0.4)).toBeGreaterThan(WORKABLE_MAX);
  });

  it("is monotonic", () => {
    const quiet = rmsToLevel(0.001);
    const mid = rmsToLevel(0.02);
    const loud = rmsToLevel(0.2);
    expect(quiet).toBeLessThan(mid);
    expect(mid).toBeLessThan(loud);
  });
});

describe("levelLabel", () => {
  it("splits quiet / workable / loud", () => {
    expect(levelLabel(roomLevel(10))).toBe("quiet");
    expect(levelLabel(roomLevel(40))).toBe("workable");
    expect(levelLabel(roomLevel(80))).toBe("loud");
  });
});

describe("meanLevel", () => {
  it("returns null for an empty list", () => {
    expect(meanLevel([])).toBeNull();
  });

  it("averages values", () => {
    expect(meanLevel([roomLevel(10), roomLevel(30)])).toBe(20);
  });
});
