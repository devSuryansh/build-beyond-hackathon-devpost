import { describe, expect, it } from "vitest";
import { emptyState, parseStored } from "../src/lib/store";
import { roomLevel } from "../src/lib/level";

describe("parseStored", () => {
  it("returns empty state for garbage", () => {
    expect(parseStored(null)).toEqual(emptyState());
    expect(parseStored({ version: 1 })).toEqual(emptyState());
  });

  it("keeps valid samples and drops broken ones", () => {
    const parsed = parseStored({
      version: 2,
      samples: [
        { at: 10, level: 44 },
        { at: "nope", level: 12 },
        { level: 9 },
      ],
      sessions: [
        {
          startedAt: 1,
          endedAt: 2,
          sampleCount: 4,
          average: 20,
          peak: 50,
          quietShare: 1.4,
          interruptions: -2,
        },
      ],
    });
    expect(parsed.samples).toEqual([{ at: 10, level: roomLevel(44) }]);
    expect(parsed.sessions[0]?.quietShare).toBe(1);
    expect(parsed.sessions[0]?.interruptions).toBe(0);
  });
});
