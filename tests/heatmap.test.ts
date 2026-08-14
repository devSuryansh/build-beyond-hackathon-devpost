import { describe, expect, it } from "vitest";
import { buildHeatmap, quietestWindows } from "../src/lib/heatmap";
import { roomLevel } from "../src/lib/level";
import type { Sample } from "../src/lib/types";

function sample(at: number, level: number): Sample {
  return { at, level: roomLevel(level) };
}

describe("buildHeatmap", () => {
  it("buckets samples into day offset and hour", () => {
    const now = new Date(2026, 7, 14, 18, 0, 0).getTime();
    const todayMorning = new Date(2026, 7, 14, 7, 10, 0).getTime();
    const yesterdayEvening = new Date(2026, 7, 13, 21, 40, 0).getTime();
    const cells = buildHeatmap({
      now,
      samples: [sample(todayMorning, 20), sample(yesterdayEvening, 70)],
    });

    const morning = cells.find((c) => c.dayOffset === 0 && c.hour === 7);
    const evening = cells.find((c) => c.dayOffset === 1 && c.hour === 21);
    expect(morning?.average).toBe(20);
    expect(morning?.count).toBe(1);
    expect(evening?.average).toBe(70);
  });

  it("ignores samples older than the window", () => {
    const now = new Date(2026, 7, 14, 12, 0, 0).getTime();
    const old = new Date(2026, 6, 1, 12, 0, 0).getTime();
    const cells = buildHeatmap({
      now,
      samples: [sample(old, 90)],
    });
    expect(cells.every((c) => c.count === 0)).toBe(true);
  });
});

describe("quietestWindows", () => {
  it("picks the lowest two-hour block that has data", () => {
    const now = new Date(2026, 7, 14, 23, 0, 0).getTime();
    const samples: Sample[] = [];
    for (let hour = 0; hour < 24; hour += 1) {
      const at = new Date(2026, 7, 14, hour, 0, 0).getTime();
      samples.push(sample(at, hour === 5 || hour === 6 ? 12 : 60));
    }
    const cells = buildHeatmap({ now, samples });
    const windows = quietestWindows({ cells, lengthHours: 2, limit: 1 });
    expect(windows[0]?.startHour).toBe(5);
    expect(windows[0]?.average).toBe(12);
  });

  it("skips blocks with missing hours", () => {
    const now = new Date(2026, 7, 14, 12, 0, 0).getTime();
    const samples = [sample(new Date(2026, 7, 14, 8, 0, 0).getTime(), 10)];
    const cells = buildHeatmap({ now, samples });
    expect(quietestWindows({ cells, lengthHours: 2, limit: 3 })).toEqual([]);
  });
});
