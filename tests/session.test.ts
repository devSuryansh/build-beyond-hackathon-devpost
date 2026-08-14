import { describe, expect, it } from "vitest";
import { addSample, finishSession, startSession } from "../src/lib/session";
import { roomLevel } from "../src/lib/level";
import { INTERRUPT_STREAK } from "../src/lib/types";

describe("session interruptions", () => {
  it("counts one interruption after a sustained loud streak", () => {
    let acc = startSession(0);
    for (let i = 0; i < INTERRUPT_STREAK; i += 1) {
      acc = addSample(acc, { at: i * 250, level: roomLevel(80) });
    }
    const summary = finishSession({ acc, endedAt: 1000 });
    expect(summary.interruptions).toBe(1);
    expect(summary.peak).toBe(80);
    expect(summary.quietShare).toBe(0);
  });

  it("does not count a single spike as an interruption", () => {
    let acc = startSession(0);
    acc = addSample(acc, { at: 0, level: roomLevel(90) });
    acc = addSample(acc, { at: 250, level: roomLevel(20) });
    expect(finishSession({ acc, endedAt: 500 }).interruptions).toBe(0);
  });

  it("requires a drop before counting a second interruption", () => {
    let acc = startSession(0);
    for (let i = 0; i < 6; i += 1) {
      acc = addSample(acc, { at: i * 250, level: roomLevel(80) });
    }
    expect(finishSession({ acc, endedAt: 2000 }).interruptions).toBe(1);

    acc = addSample(acc, { at: 2000, level: roomLevel(20) });
    for (let i = 0; i < 3; i += 1) {
      acc = addSample(acc, { at: 2250 + i * 250, level: roomLevel(80) });
    }
    expect(finishSession({ acc, endedAt: 4000 }).interruptions).toBe(2);
  });

  it("computes quiet share from samples at or below the quiet cutoff", () => {
    let acc = startSession(0);
    acc = addSample(acc, { at: 0, level: roomLevel(10) });
    acc = addSample(acc, { at: 250, level: roomLevel(10) });
    acc = addSample(acc, { at: 500, level: roomLevel(70) });
    acc = addSample(acc, { at: 750, level: roomLevel(70) });
    const summary = finishSession({ acc, endedAt: 1000 });
    expect(summary.quietShare).toBe(0.5);
    expect(summary.average).toBe(40);
    expect(summary.sampleCount).toBe(4);
  });
});
